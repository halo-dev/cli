import { readFile, writeFile } from "node:fs/promises";

import type { Category, CategoryList, Post, Tag, TagList } from "@halo-dev/api-client";
import { PostV1alpha1UcApi } from "@halo-dev/api-client";
import { checkbox, input } from "@inquirer/prompts";
import axios from "axios";
import cac, { type CAC } from "cac";

import { tryRunCommandCliRoute } from "../../utils/command-router.js";
import { confirmDangerousAction } from "../../utils/confirmation.js";
import { CliError } from "../../utils/errors.js";
import {
  isInteractive,
  parseBooleanOption,
  parseCsvOption,
  parseNumberOption,
} from "../../utils/options.js";
import { printDetailObject, printJson } from "../../utils/output.js";
import { type HaloClients, RuntimeContext } from "../../utils/runtime.js";
import { normalizeBaseUrl } from "../../utils/url.js";
import { openUrlInBrowser, resolvePostOpenUrl } from "./browser.js";
import { printPostList } from "./format.js";
import {
  CONTENT_JSON_ANNOTATION,
  extractDraftContent,
  normalizeCreatePostInput,
  normalizeUpdatePostInput,
  serializeDraftContent,
  slugify,
} from "./input.js";

interface PostCommandOptions {
  profile?: string;
  json?: boolean;
  page?: string;
  size?: string;
  keyword?: string;
  publishPhase?: string;
  category?: string;
  name?: string;
  title?: string;
  slug?: string;
  content?: string;
  contentFile?: string;
  rawType?: string;
  excerpt?: string;
  categories?: string;
  tags?: string;
  cover?: string;
  template?: string;
  visible?: string;
  publish?: string;
  pinned?: string;
  allowComment?: string;
  priority?: string;
  force?: boolean;
  newName?: string;
}

interface PostJsonCommandOptions extends PostCommandOptions {
  file?: string;
  raw?: string;
  output?: string;
}

interface PostTransferPayload {
  post: Post;
  content: {
    content: string;
    raw: string;
    rawType: string;
  };
}

export function toMutationInput(options: PostCommandOptions) {
  return {
    name: options.name,
    title: options.title,
    slug: options.slug,
    content: options.content,
    contentFile: options.contentFile,
    rawType: options.rawType,
    excerpt: options.excerpt,
    categories: parseCsvOption(options.categories),
    tags: parseCsvOption(options.tags),
    cover: options.cover,
    template: options.template,
    visible: options.visible,
    publish: parseBooleanOption(options.publish),
    pinned: parseBooleanOption(options.pinned),
    allowComment: parseBooleanOption(options.allowComment),
    priority: parseNumberOption(options.priority),
  };
}

export function withSerializedContentAnnotation(
  metadata: Post["metadata"],
  content: { content: string; raw: string; rawType: string },
): Post["metadata"] {
  return {
    ...metadata,
    annotations: {
      ...metadata.annotations,
      [CONTENT_JSON_ANNOTATION]: serializeDraftContent(content),
    },
  };
}

export function parsePostTransferPayload(raw: string): PostTransferPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CliError("Invalid post JSON payload.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new CliError("Post JSON payload must be an object with `post` and `content`.");
  }

  const payload = parsed as Record<string, unknown>;
  const post = payload.post;
  const content = payload.content;

  if (!post || typeof post !== "object") {
    throw new CliError("Post JSON payload must include a `post` object.");
  }

  if (!content || typeof content !== "object") {
    throw new CliError("Post JSON payload must include a `content` object.");
  }

  const contentRecord = content as Record<string, unknown>;
  const rawContent =
    typeof contentRecord.raw === "string"
      ? contentRecord.raw
      : typeof contentRecord.content === "string"
        ? contentRecord.content
        : undefined;
  const renderedContent =
    typeof contentRecord.content === "string" ? contentRecord.content : rawContent;
  const rawType =
    typeof contentRecord.rawType === "string" && contentRecord.rawType.trim().length > 0
      ? contentRecord.rawType.trim()
      : "markdown";

  if (!rawContent || !renderedContent) {
    throw new CliError("Post JSON payload must include `content.raw` or `content.content`.");
  }

  const typedPost = post as Post;
  const postName = typedPost.metadata?.name?.trim();
  if (!postName) {
    throw new CliError("Post JSON payload must include `post.metadata.name`.");
  }

  return {
    post: {
      ...typedPost,
      metadata: {
        ...typedPost.metadata,
        name: postName,
      },
    },
    content: {
      raw: rawContent,
      content: renderedContent,
      rawType,
    },
  };
}

export async function resolvePostTransferPayload(
  options: PostJsonCommandOptions,
): Promise<PostTransferPayload> {
  return (await resolvePostTransferInput(options)).payload;
}

async function resolvePostTransferInput(
  options: PostJsonCommandOptions,
): Promise<{ payload: PostTransferPayload; sourceLabel: string }> {
  const file = options.file?.trim();
  const raw = options.raw?.trim();
  const sourceCount = Number(Boolean(file)) + Number(Boolean(raw));

  if (sourceCount !== 1) {
    throw new CliError("Provide exactly one post JSON source: --file or --raw.");
  }

  const payload = file ? await readFile(file, "utf8") : raw!;
  return {
    payload: parsePostTransferPayload(payload),
    sourceLabel: file ? `JSON file ${file}` : "inline JSON",
  };
}

function stringifyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function resolvePostExportOutputPath(name: string, output?: string): string {
  const normalized = output?.trim();
  return normalized && normalized.length > 0 ? normalized : `./${name}.json`;
}

export async function loadEditablePostState(ucPostApi: PostV1alpha1UcApi, name: string) {
  const [postResponse, draftResponse] = await Promise.all([
    ucPostApi.getMyPost({ name }),
    ucPostApi.getMyPostDraft({ name, patched: true }),
  ]);

  return {
    post: postResponse.data,
    draft: draftResponse.data,
    content: extractDraftContent(draftResponse.data),
  };
}

export async function syncPostPublishState(
  ucPostApi: PostV1alpha1UcApi,
  name: string,
  publish: boolean | undefined,
): Promise<void> {
  if (publish === undefined) {
    return;
  }

  if (publish) {
    await ucPostApi.publishMyPost({ name });
    return;
  }

  await ucPostApi.unpublishMyPost({ name });
}

async function listCategories(clients: HaloClients): Promise<Category[]> {
  const response = await clients.axios.get<CategoryList>(
    "/apis/content.halo.run/v1alpha1/categories",
  );
  return response.data.items;
}

async function listTags(clients: HaloClients): Promise<Tag[]> {
  const response = await clients.axios.get<TagList>("/apis/content.halo.run/v1alpha1/tags");
  return response.data.items;
}

async function loadPostDetail(clients: HaloClients, name: string): Promise<PostTransferPayload> {
  const [postResponse, contentResponse] = await Promise.all([
    clients.core.content.post.getPost({ name }),
    clients.console.content.post.fetchPostHeadContent({ name }),
  ]);

  const raw = contentResponse.data.raw ?? contentResponse.data.content ?? "";
  const content = contentResponse.data.content ?? contentResponse.data.raw ?? "";
  const rawType = contentResponse.data.rawType ?? "markdown";

  return {
    post: postResponse.data,
    content: {
      raw,
      content,
      rawType,
    },
  };
}

async function promptTaxonomyDisplayNames(
  label: "categories" | "tags",
  items: Array<{ name: string; displayName?: string }>,
  selectedNames?: string[],
): Promise<string[]> {
  if (!isInteractive()) {
    return [];
  }

  const selectedValues = await checkbox({
    message: `Select ${label}`,
    choices: items.map((item) => ({
      name:
        item.displayName && item.displayName !== item.name
          ? `${item.displayName} (${item.name})`
          : (item.displayName ?? item.name),
      value: item.displayName ?? item.name,
      checked: selectedNames?.includes(item.name) ?? false,
    })),
    required: false,
  });

  const extraValues =
    parseCsvOption(
      await input({
        message: `Additional ${label} (comma separated, optional)`,
      }),
    ) ?? [];

  return [...new Set([...selectedValues, ...extraValues])];
}

async function resolveCategoryNames(
  clients: HaloClients,
  values?: string[],
): Promise<string[] | undefined> {
  if (!values) {
    return undefined;
  }

  const allCategories = await listCategories(clients);
  const existingNames: string[] = [];
  const missingDisplayNames: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }

    const found = allCategories.find(
      (item: Category) => item.metadata.name === normalized || item.spec.displayName === normalized,
    );

    if (found) {
      existingNames.push(found.metadata.name);
      continue;
    }

    missingDisplayNames.push(normalized);
  }

  const created = await Promise.all(
    missingDisplayNames.map((displayName, index) =>
      clients.axios.post<Category>("/apis/content.halo.run/v1alpha1/categories", {
        apiVersion: "content.halo.run/v1alpha1",
        kind: "Category",
        metadata: {
          name: "",
          generateName: "category-",
        },
        spec: {
          displayName,
          slug: slugify(displayName),
          description: "",
          cover: "",
          template: "",
          priority: allCategories.length + index,
          children: [],
        },
      }),
    ),
  );

  return [
    ...new Set(
      created.reduce<string[]>(
        (names, response) => {
          names.push(response.data.metadata.name);
          return names;
        },
        [...existingNames],
      ),
    ),
  ];
}

async function resolveTagNames(
  clients: HaloClients,
  values?: string[],
): Promise<string[] | undefined> {
  if (!values) {
    return undefined;
  }

  const allTags = await listTags(clients);
  const existingNames: string[] = [];
  const missingDisplayNames: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }

    const found = allTags.find(
      (item: Tag) => item.metadata.name === normalized || item.spec.displayName === normalized,
    );

    if (found) {
      existingNames.push(found.metadata.name);
      continue;
    }

    missingDisplayNames.push(normalized);
  }

  const created = await Promise.all(
    missingDisplayNames.map((displayName) =>
      clients.axios.post<Tag>("/apis/content.halo.run/v1alpha1/tags", {
        apiVersion: "content.halo.run/v1alpha1",
        kind: "Tag",
        metadata: {
          name: "",
          generateName: "tag-",
        },
        spec: {
          displayName,
          slug: slugify(displayName),
          color: "#ffffff",
          cover: "",
        },
      }),
    ),
  );

  return [
    ...new Set(
      created.reduce<string[]>(
        (names, response) => {
          names.push(response.data.metadata.name);
          return names;
        },
        [...existingNames],
      ),
    ),
  ];
}

async function enrichPostMutationInput(
  clients: HaloClients,
  baseInput: ReturnType<typeof toMutationInput>,
  currentPost?: Post,
) {
  const nextInput = { ...baseInput };

  if (nextInput.categories === undefined && isInteractive()) {
    const categories = await listCategories(clients);
    const selectedDisplayNames = await promptTaxonomyDisplayNames(
      "categories",
      categories.map((item: Category) => ({
        name: item.metadata.name,
        displayName: item.spec.displayName,
      })),
      currentPost?.spec.categories,
    );
    nextInput.categories = await resolveCategoryNames(clients, selectedDisplayNames);
  } else {
    nextInput.categories = await resolveCategoryNames(clients, nextInput.categories);
  }

  if (nextInput.tags === undefined && isInteractive()) {
    const tags = await listTags(clients);
    const selectedDisplayNames = await promptTaxonomyDisplayNames(
      "tags",
      tags.map((item: Tag) => ({
        name: item.metadata.name,
        displayName: item.spec.displayName,
      })),
      currentPost?.spec.tags,
    );
    nextInput.tags = await resolveTagNames(clients, selectedDisplayNames);
  } else {
    nextInput.tags = await resolveTagNames(clients, nextInput.tags);
  }

  return nextInput;
}

export function registerPostCommands(cli: CAC): void {
  cli.command("post", "Post management commands");
}

function buildPostCli(runtime: RuntimeContext): CAC {
  const postCli = cac("halo post");

  postCli
    .command("list", "List posts")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number")
    .option("--size <number>", "Page size")
    .option("--keyword <keyword>", "Filter by keyword")
    .option("--publish-phase <phase>", "Filter by publish phase")
    .option("--category <category>", "Filter by category including children")
    .action(async (options: PostCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const response = await clients.console.content.post.listPosts({
        page: parseNumberOption(options.page),
        size: parseNumberOption(options.size),
        keyword: options.keyword,
        publishPhase: options.publishPhase as never,
        categoryWithChildren: options.category,
      });

      printPostList(response.data, options.json);
    });

  postCli
    .command("get <name>", "Show post details")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (name: string, options: PostCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const detail = await loadPostDetail(clients, name);

      if (options.json) {
        printJson(detail);
        return;
      }

      printDetailObject(detail as unknown as Record<string, unknown>);
    });

  postCli
    .command("open <name>", "Open a published post in the browser")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (name: string, options: PostCommandOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const response = await clients.core.content.post.getPost({ name });
      const permalink = response.data.status?.permalink;

      if (!permalink) {
        throw new CliError("This post does not have a permalink yet. It may not be published.");
      }

      const url = resolvePostOpenUrl(profile.baseUrl, permalink);

      if (options.json) {
        printJson({ name, url });
        return;
      }

      await openUrlInBrowser(url);
      process.stdout.write(`Opened ${url}\n`);
    });

  postCli
    .command("create", "Create a post")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--name <name>", "Post resource name")
    .option("--title <title>", "Post title")
    .option("--slug <slug>", "Post slug")
    .option("--content <content>", "Inline post content")
    .option("--content-file <path>", "Read post content from a file")
    .option("--raw-type <type>", "Content raw type, defaults to markdown")
    .option("--excerpt <excerpt>", "Explicit excerpt")
    .option("--categories <items>", "Comma separated category names")
    .option("--tags <items>", "Comma separated tag names")
    .option("--cover <url>", "Cover image URL")
    .option("--template <name>", "Template name")
    .option("--visible <visibility>", "PUBLIC, INTERNAL, or PRIVATE")
    .option("--publish <true|false>", "Whether the post is published")
    .option("--pinned <true|false>", "Whether to pin the post")
    .option("--allow-comment <true|false>", "Whether comments are allowed")
    .option("--priority <number>", "Post priority")
    .action(async (options: PostCommandOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const ucPostApi = new PostV1alpha1UcApi(
        undefined,
        normalizeBaseUrl(profile.baseUrl),
        clients.axios,
      );

      const postRequest = await normalizeCreatePostInput(
        await enrichPostMutationInput(clients, toMutationInput(options)),
      );

      const createResponse = await ucPostApi.createMyPost({
        post: {
          ...postRequest.post,
          metadata: withSerializedContentAnnotation(
            postRequest.post.metadata,
            postRequest.content,
          ) as Post["metadata"],
          spec: {
            ...postRequest.post.spec,
            publish: false,
          },
        },
      });

      await syncPostPublishState(
        ucPostApi,
        createResponse.data.metadata.name,
        postRequest.post.spec.publish,
      );

      const latestPost = await ucPostApi.getMyPost({ name: createResponse.data.metadata.name });

      if (options.json) {
        printJson(latestPost.data);
        return;
      }

      process.stdout.write(`Created post ${latestPost.data.metadata.name}.\n`);
    });

  postCli
    .command("update <name>", "Update a post")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--new-name <name>", "Update the resource name")
    .option("--title <title>", "Post title")
    .option("--slug <slug>", "Post slug")
    .option("--content <content>", "Inline post content")
    .option("--content-file <path>", "Read post content from a file")
    .option("--raw-type <type>", "Content raw type, defaults to markdown")
    .option("--excerpt <excerpt>", "Explicit excerpt")
    .option("--categories <items>", "Comma separated category names")
    .option("--tags <items>", "Comma separated tag names")
    .option("--cover <url>", "Cover image URL")
    .option("--template <name>", "Template name")
    .option("--visible <visibility>", "PUBLIC, INTERNAL, or PRIVATE")
    .option("--publish <true|false>", "Whether the post is published")
    .option("--pinned <true|false>", "Whether to pin the post")
    .option("--allow-comment <true|false>", "Whether comments are allowed")
    .option("--priority <number>", "Post priority")
    .action(async (name: string, options: PostCommandOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const ucPostApi = new PostV1alpha1UcApi(
        undefined,
        normalizeBaseUrl(profile.baseUrl),
        clients.axios,
      );
      const currentState = await loadEditablePostState(ucPostApi, name);

      const postRequest = await normalizeUpdatePostInput(
        currentState.post,
        currentState.content,
        await enrichPostMutationInput(
          clients,
          {
            ...toMutationInput(options),
            name: options.newName,
          },
          currentState.post,
        ),
      );

      const updatePostResponse = await ucPostApi.updateMyPost({
        name,
        post: {
          ...postRequest.post,
          spec: {
            ...postRequest.post.spec,
            publish: currentState.post.spec.publish,
          },
        },
      });

      const updatedName = updatePostResponse.data.metadata.name;
      const latestDraft = await ucPostApi.getMyPostDraft({
        name: updatedName,
        patched: true,
      });

      latestDraft.data.metadata = withSerializedContentAnnotation(
        latestDraft.data.metadata,
        postRequest.content,
      );

      await ucPostApi.updateMyPostDraft({
        name: updatedName,
        snapshot: latestDraft.data,
      });

      await syncPostPublishState(ucPostApi, updatedName, postRequest.post.spec.publish);

      const latestPost = await ucPostApi.getMyPost({ name: updatedName });

      if (options.json) {
        printJson(latestPost.data);
        return;
      }

      process.stdout.write(`Updated post ${latestPost.data.metadata.name}.\n`);
    });

  postCli
    .command("delete <name>", "Delete a post")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--force", "Delete without confirmation")
    .action(async (name: string, options: PostCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);

      if (
        !(await confirmDangerousAction(
          {
            commandPath: "halo post delete",
            actionLabel: "Delete",
            resourceLabel: "post",
            resourceName: name,
            cancellationVerb: "deleting",
          },
          options,
        ))
      ) {
        return;
      }

      await clients.core.content.post.deletePost({ name });

      if (options.json) {
        printJson({ deleted: true, name });
        return;
      }

      process.stdout.write(`Deleted post ${name}.\n`);
    });

  postCli
    .command("export-json <name>", "Export a post as JSON")
    .option("--profile <name>", "Halo profile name")
    .option("--output <path>", "Write JSON to a specific file path")
    .action(async (name: string, options: PostJsonCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const detail = await loadPostDetail(clients, name);
      const outputPath = resolvePostExportOutputPath(name, options.output);
      await writeFile(outputPath, stringifyJson(detail));
      process.stdout.write(`Exported post ${name} to ${outputPath}.\n`);
    });

  postCli
    .command("import-json", "Import a post from JSON")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--file <path>", "Read post JSON from a file")
    .option("--raw <json>", "Inline post JSON payload")
    .option("--force", "Update without confirmation when the post already exists")
    .action(async (options: PostJsonCommandOptions) => {
      const { payload, sourceLabel } = await resolvePostTransferInput(options);
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const ucPostApi = new PostV1alpha1UcApi(
        undefined,
        normalizeBaseUrl(profile.baseUrl),
        clients.axios,
      );
      const targetName = payload.post.metadata.name;
      let resultName = targetName;
      let action: "imported" | "updated" = "imported";

      try {
        const currentState = await loadEditablePostState(ucPostApi, targetName);

        if (
          !(await confirmDangerousAction(
            {
              commandPath: "halo post import-json",
              actionLabel: "Update",
              resourceLabel: "post",
              resourceName: targetName,
              cancellationVerb: "updating",
            },
            options,
          ))
        ) {
          return;
        }

        const updateResponse = await ucPostApi.updateMyPost({
          name: targetName,
          post: {
            ...payload.post,
            spec: {
              ...payload.post.spec,
              publish: currentState.post.spec.publish,
            },
          },
        });

        resultName = updateResponse.data.metadata.name;

        const latestDraft = await ucPostApi.getMyPostDraft({
          name: resultName,
          patched: true,
        });

        latestDraft.data.metadata = withSerializedContentAnnotation(
          latestDraft.data.metadata,
          payload.content,
        );

        await ucPostApi.updateMyPostDraft({
          name: resultName,
          snapshot: latestDraft.data,
        });

        await syncPostPublishState(ucPostApi, resultName, payload.post.spec.publish);
        action = "updated";
      } catch (error) {
        if (!axios.isAxiosError(error) || error.response?.status !== 404) {
          throw error;
        }

        const createResponse = await ucPostApi.createMyPost({
          post: {
            ...payload.post,
            metadata: withSerializedContentAnnotation(
              payload.post.metadata,
              payload.content,
            ) as Post["metadata"],
            spec: {
              ...payload.post.spec,
              publish: false,
            },
          },
        });

        resultName = createResponse.data.metadata.name;
        await syncPostPublishState(ucPostApi, resultName, payload.post.spec.publish);
      }

      const detail = await loadPostDetail(clients, resultName);

      if (options.json) {
        printJson(detail);
        return;
      }

      process.stdout.write(
        `${action === "updated" ? "Updated existing post" : "Imported post"} ${resultName} from ${sourceLabel}.\n`,
      );
    });

  postCli.usage("<command> [flags]");
  postCli.example((bin) => `${bin} list --page 1 --size 20`);
  postCli.example((bin) => `${bin} get my-post --json`);
  postCli.example((bin) => `${bin} export-json my-post`);
  postCli.example((bin) => `${bin} export-json my-post --output ./post.json`);
  postCli.example((bin) => `${bin} open my-post`);
  postCli.example(
    (bin) => `${bin} create --title "Hello Halo" --content-file ./post.md --publish true`,
  );
  postCli.example((bin) => `${bin} update my-post --title "Updated title" --tags Halo,CLI`);
  postCli.example((bin) => `${bin} import-json --file ./post.json`);
  postCli.example((bin) => `${bin} import-json --raw '{"post":...,"content":...}'`);
  postCli.example((bin) => `${bin} delete my-post --force`);
  postCli.help();

  return postCli;
}

export async function tryRunPostCommand(args: string[], runtime: RuntimeContext): Promise<boolean> {
  return tryRunCommandCliRoute({
    command: "post",
    cliName: "halo post",
    args,
    buildCli: () => buildPostCli(runtime),
  });
}
