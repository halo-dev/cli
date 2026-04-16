import { readFile, writeFile } from "node:fs/promises";

import type {
  Category,
  CategoryList,
  Post,
  PostV1alpha1ConsoleApi,
  Tag,
  TagList,
} from "@halo-dev/api-client";
import { checkbox, input } from "@inquirer/prompts";
import axios from "axios";
import cac, { type CAC } from "cac";

import { tryRunCommandCliRoute, tryRunNestedCliRoute } from "../../utils/command-router.js";
import { confirmDangerousAction } from "../../utils/confirmation.js";
import { DEFAULT_CONTENT_RAW_TYPE, renderContentByRawType } from "../../utils/content.js";
import { CliError } from "../../utils/errors.js";
import {
  isInteractive,
  parseBooleanOption,
  parseCsvOption,
  parseNumberOption,
} from "../../utils/options.js";
import { printJson, printResourceMutationSuccess, stringifyJson } from "../../utils/output.js";
import { type HaloClients, RuntimeContext } from "../../utils/runtime.js";
import { openUrlInBrowser, resolvePostOpenUrl } from "./browser.js";
import { buildCategoryCli } from "./category.js";
import { printPostDetail, printPostList } from "./format.js";
import {
  normalizeCreatePostInput,
  normalizeUpdatePostInput,
  promptCreatePostPrimaryFields,
  promptUpdatePostPrimaryFields,
  slugifyTaxonomyDisplayName,
} from "./input.js";
import {
  assertMarkdownTrackingSite,
  buildPostMarkdownFrontMatter,
  resolvePostMarkdownExportOutputPath,
  resolvePostMarkdownImportPayload,
  writePostMarkdownDocument,
} from "./markdown.js";
import { buildTagCli } from "./tag.js";
import type { PostMutationInput } from "./types.js";

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

interface PostMarkdownCommandOptions extends PostCommandOptions {
  file?: string;
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
  const rawType =
    typeof contentRecord.rawType === "string" && contentRecord.rawType.trim().length > 0
      ? contentRecord.rawType.trim()
      : DEFAULT_CONTENT_RAW_TYPE;
  const renderedContent = rawContent ? renderContentByRawType(rawContent, rawType) : undefined;

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

function resolvePostExportOutputPath(name: string, output?: string): string {
  const normalized = output?.trim();
  return normalized && normalized.length > 0 ? normalized : `./${name}.json`;
}

export async function syncPostPublishState(
  consolePostApi: PostV1alpha1ConsoleApi,
  name: string,
  publish: boolean | undefined,
): Promise<void> {
  if (publish === undefined) {
    return;
  }

  if (publish) {
    await consolePostApi.publishPost({ name });
    return;
  }

  await consolePostApi.unpublishPost({ name });
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

  const rawType = contentResponse.data.rawType ?? DEFAULT_CONTENT_RAW_TYPE;
  const raw = contentResponse.data.raw ?? contentResponse.data.content ?? "";
  const content = renderContentByRawType(raw, rawType);

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
          slug: slugifyTaxonomyDisplayName(displayName, "category"),
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
          slug: slugifyTaxonomyDisplayName(displayName, "tag"),
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

async function resolveCategoryDisplayNames(
  clients: HaloClients,
  values?: string[],
): Promise<string[] | undefined> {
  if (!values || values.length === 0) {
    return undefined;
  }

  const allCategories = await listCategories(clients);
  const displayNames = values
    .map((value) => {
      const normalized = value.trim();
      if (!normalized) {
        return undefined;
      }

      const found = allCategories.find((item: Category) => item.metadata.name === normalized);
      return found?.spec.displayName;
    })
    .filter((value): value is string => Boolean(value));

  return displayNames.length > 0 ? displayNames : undefined;
}

async function resolveTagDisplayNames(
  clients: HaloClients,
  values?: string[],
): Promise<string[] | undefined> {
  if (!values || values.length === 0) {
    return undefined;
  }

  const allTags = await listTags(clients);
  const displayNames = values
    .map((value) => {
      const normalized = value.trim();
      if (!normalized) {
        return undefined;
      }

      const found = allTags.find((item: Tag) => item.metadata.name === normalized);
      return found?.spec.displayName;
    })
    .filter((value): value is string => Boolean(value));

  return displayNames.length > 0 ? displayNames : undefined;
}

async function importPostPayload(
  clients: HaloClients,
  options: Pick<PostCommandOptions, "force">,
  payload: PostTransferPayload,
  commandPath: string,
  targetName?: string,
): Promise<{ action: "imported" | "updated"; name: string } | undefined> {
  const consolePostApi = clients.console.content.post;

  if (targetName) {
    try {
      const currentPostResponse = await clients.core.content.post.getPost({ name: targetName });
      const currentPost = currentPostResponse.data;

      if (
        !(await confirmDangerousAction(
          {
            commandPath,
            actionLabel: "Update",
            resourceLabel: "post",
            resourceName: targetName,
            cancellationVerb: "updating",
          },
          options,
        ))
      ) {
        return undefined;
      }

      await consolePostApi.updateDraftPost({
        name: targetName,
        postRequest: {
          post: {
            ...currentPost,
            metadata: {
              ...currentPost.metadata,
              ...payload.post.metadata,
              name: currentPost.metadata.name,
            },
            spec: {
              ...currentPost.spec,
              ...payload.post.spec,
              publish: currentPost.spec.publish,
              headSnapshot: currentPost.spec.headSnapshot,
              baseSnapshot: currentPost.spec.baseSnapshot,
              releaseSnapshot: currentPost.spec.releaseSnapshot,
              owner: currentPost.spec.owner,
              deleted: currentPost.spec.deleted,
            },
          },
          content: payload.content,
        },
      });

      await syncPostPublishState(consolePostApi, targetName, payload.post.spec.publish);
      return {
        action: "updated",
        name: targetName,
      };
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 404) {
        throw error;
      }
    }
  }

  const createResponse = await consolePostApi.draftPost({
    postRequest: {
      post: {
        ...payload.post,
        spec: {
          ...payload.post.spec,
          publish: false,
        },
      },
      content: payload.content,
    },
  });

  const createdName = createResponse.data.metadata.name;
  await syncPostPublishState(consolePostApi, createdName, payload.post.spec.publish);
  return {
    action: "imported",
    name: createdName,
  };
}

async function syncMarkdownFileAfterImport(
  filePath: string,
  profileBaseUrl: string,
  clients: HaloClients,
  detail: PostTransferPayload,
): Promise<void> {
  const [categories, tags] = await Promise.all([
    resolveCategoryDisplayNames(clients, detail.post.spec.categories),
    resolveTagDisplayNames(clients, detail.post.spec.tags),
  ]);

  await writePostMarkdownDocument(
    filePath,
    detail.content.raw,
    buildPostMarkdownFrontMatter(detail.post, {
      site: profileBaseUrl,
      categories,
      tags,
    }),
  );
}

async function exportMarkdownFile(
  filePath: string,
  profileBaseUrl: string,
  clients: HaloClients,
  detail: PostTransferPayload,
): Promise<void> {
  const [categories, tags] = await Promise.all([
    resolveCategoryDisplayNames(clients, detail.post.spec.categories),
    resolveTagDisplayNames(clients, detail.post.spec.tags),
  ]);

  await writePostMarkdownDocument(
    filePath,
    detail.content.raw,
    buildPostMarkdownFrontMatter(detail.post, {
      site: profileBaseUrl,
      categories,
      tags,
    }),
  );
}

async function enrichPostMutationInput(
  clients: HaloClients,
  baseInput: PostMutationInput,
  currentPost?: Post,
  options?: {
    promptForTaxonomy?: boolean;
  },
) {
  const nextInput = { ...baseInput };
  const promptForTaxonomy = options?.promptForTaxonomy ?? true;

  if (nextInput.categories === undefined && promptForTaxonomy && isInteractive()) {
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

  if (nextInput.tags === undefined && promptForTaxonomy && isInteractive()) {
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
    .option("--page <number>", "Page number", { default: 1 })
    .option("--size <number>", "Page size", { default: 20 })
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
        labelSelector: ["content.halo.run/deleted=false"],
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
      printPostDetail(detail, options.json);
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
      const consolePostApi = clients.console.content.post;

      const postRequest = await normalizeCreatePostInput(
        await enrichPostMutationInput(
          clients,
          await promptCreatePostPrimaryFields(toMutationInput(options)),
        ),
      );

      const createResponse = await consolePostApi.draftPost({
        postRequest: {
          post: {
            ...postRequest.post,
            spec: {
              ...postRequest.post.spec,
              publish: false,
            },
          },
          content: postRequest.content,
        },
      });

      await syncPostPublishState(
        consolePostApi,
        createResponse.data.metadata.name,
        postRequest.post.spec.publish,
      );

      const latestPost = await clients.core.content.post.getPost({
        name: createResponse.data.metadata.name,
      });

      if (options.json) {
        printJson(latestPost.data);
        return;
      }

      printResourceMutationSuccess({
        message: "Post created successfully.",
        baseUrl: profile.baseUrl,
        name: latestPost.data.metadata.name,
        permalink: latestPost.data.status?.permalink,
        resourceLabel: "Post",
        inspectCommand: `halo post get ${latestPost.data.metadata.name}`,
      });
    });

  postCli
    .command("update <name>", "Update a post")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--new-name <name>", "Update the resource name")
    .option("--title <title>", "Post title")
    .option("--slug <slug>", "Post slug")
    .option("--content <content>", "Inline post content")
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
      const consolePostApi = clients.console.content.post;

      const currentPostResponse = await clients.core.content.post.getPost({ name });
      const currentPost = currentPostResponse.data;
      const currentContentResponse = await consolePostApi.fetchPostHeadContent({ name });
      const currentContent = currentContentResponse.data;

      const postRequest = await normalizeUpdatePostInput(
        currentPost,
        currentContent,
        await enrichPostMutationInput(
          clients,
          await promptUpdatePostPrimaryFields(
            {
              ...toMutationInput(options),
              name: options.newName,
            },
            currentPost,
          ),
          currentPost,
        ),
      );

      const updatePostResponse = await consolePostApi.updateDraftPost({
        name,
        postRequest: {
          post: {
            ...postRequest.post,
            spec: {
              ...postRequest.post.spec,
              publish: currentPost.spec.publish,
            },
          },
          content: postRequest.content,
        },
      });

      const updatedName = updatePostResponse.data.metadata.name;

      await syncPostPublishState(consolePostApi, updatedName, postRequest.post.spec.publish);

      const latestPost = await clients.core.content.post.getPost({ name: updatedName });

      if (options.json) {
        printJson(latestPost.data);
        return;
      }

      printResourceMutationSuccess({
        message: "Post updated successfully.",
        baseUrl: profile.baseUrl,
        name: latestPost.data.metadata.name,
        permalink: latestPost.data.status?.permalink,
        resourceLabel: "Post",
        inspectCommand: `halo post get ${latestPost.data.metadata.name}`,
      });
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
    .option("--json", "Output JSON")
    .option("--output <path>", "Write JSON to a specific file path")
    .action(async (name: string, options: PostJsonCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const detail = await loadPostDetail(clients, name);
      const outputPath = resolvePostExportOutputPath(name, options.output);
      await writeFile(outputPath, stringifyJson(detail));
      if (options.json) {
        printJson({ name, outputPath });
        return;
      }
      process.stdout.write(`Exported post ${name} to ${outputPath}.\n`);
    });

  postCli
    .command("export-markdown <name>", "Export a post as a Markdown file")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--output <path>", "Write Markdown to a specific file path")
    .action(async (name: string, options: PostMarkdownCommandOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const detail = await loadPostDetail(clients, name);
      const outputPath = resolvePostMarkdownExportOutputPath(name, options.output);

      await exportMarkdownFile(outputPath, profile.baseUrl, clients, detail);
      if (options.json) {
        printJson({ name, outputPath });
        return;
      }
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
      const importResult = await importPostPayload(
        clients,
        options,
        payload,
        "halo post import-json",
        payload.post.metadata.name,
      );
      if (!importResult) {
        return;
      }
      const { action, name: resultName } = importResult;

      const detail = await loadPostDetail(clients, resultName);

      if (options.json) {
        printJson(detail);
        return;
      }

      printResourceMutationSuccess({
        message:
          action === "updated"
            ? `Post import updated an existing post from ${sourceLabel}.`
            : `Post imported successfully from ${sourceLabel}.`,
        baseUrl: profile.baseUrl,
        name: detail.post.metadata.name,
        permalink: detail.post.status?.permalink,
        resourceLabel: "Post",
        inspectCommand: `halo post get ${detail.post.metadata.name}`,
      });
    });

  postCli
    .command("import-markdown", "Import a post from a Markdown file")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--file <path>", "Read post Markdown from a file")
    .option("--force", "Update without confirmation when the tracked post already exists")
    .action(async (options: PostMarkdownCommandOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const markdownPayload = await resolvePostMarkdownImportPayload(options.file);
      assertMarkdownTrackingSite(markdownPayload.trackedSite, profile.baseUrl);

      const normalizedInput = await enrichPostMutationInput(
        clients,
        markdownPayload.mutationInput,
        undefined,
        {
          promptForTaxonomy: false,
        },
      );

      let currentPost: Post | undefined;
      let currentContent: import("@halo-dev/api-client").ContentWrapper | undefined;

      if (markdownPayload.trackedName) {
        try {
          const postResponse = await clients.core.content.post.getPost({
            name: markdownPayload.trackedName,
          });
          currentPost = postResponse.data;
          const contentResponse = await clients.console.content.post.fetchPostHeadContent({
            name: markdownPayload.trackedName,
          });
          currentContent = contentResponse.data;
        } catch (error) {
          if (!axios.isAxiosError(error) || error.response?.status !== 404) {
            throw error;
          }
        }
      }

      const postRequest = currentPost
        ? await normalizeUpdatePostInput(currentPost, currentContent, normalizedInput)
        : await normalizeCreatePostInput(normalizedInput);

      const payload: PostTransferPayload = {
        post: postRequest.post,
        content: postRequest.content,
      };

      const importResult = await importPostPayload(
        clients,
        options,
        payload,
        "halo post import-markdown",
        currentPost?.metadata.name,
      );
      if (!importResult) {
        return;
      }
      const { action, name: resultName } = importResult;

      const detail = await loadPostDetail(clients, resultName);
      await syncMarkdownFileAfterImport(markdownPayload.filePath, profile.baseUrl, clients, detail);

      if (options.json) {
        printJson(detail);
        return;
      }

      printResourceMutationSuccess({
        message:
          action === "updated"
            ? `Markdown import updated an existing post from ${markdownPayload.filePath}.`
            : `Markdown post imported successfully from ${markdownPayload.filePath}.`,
        baseUrl: profile.baseUrl,
        name: detail.post.metadata.name,
        permalink: detail.post.status?.permalink,
        resourceLabel: "Post",
        inspectCommand: `halo post get ${detail.post.metadata.name}`,
      });
    });

  postCli.command("category", "Category management commands");
  postCli.command("tag", "Tag management commands");

  postCli.usage("<command> [flags]");
  postCli.example((bin) => `${bin} list --page 1 --size 20`);
  postCli.example((bin) => `${bin} get my-post --json`);
  postCli.example((bin) => `${bin} export-json my-post`);
  postCli.example((bin) => `${bin} export-json my-post --output ./post.json`);
  postCli.example((bin) => `${bin} export-markdown my-post`);
  postCli.example((bin) => `${bin} export-markdown my-post --output ./post.md`);
  postCli.example((bin) => `${bin} open my-post`);
  postCli.example(
    (bin) => `${bin} create --title "Hello Halo" --content "# Hello Halo" --publish true`,
  );
  postCli.example(
    (bin) => `${bin} create --title "Hello Halo" --content "<h1>Hello Halo</h1>" --raw-type "html"`,
  );
  postCli.example((bin) => `${bin} update my-post --title "Updated title" --tags Halo,CLI`);
  postCli.example((bin) => `${bin} import-json --file ./post.json`);
  postCli.example((bin) => `${bin} import-json --raw '{"post":...,"content":...}'`);
  postCli.example((bin) => `${bin} import-markdown --file ./post.md`);
  postCli.example((bin) => `${bin} delete my-post --force`);
  postCli.help();

  return postCli;
}

export async function tryRunPostCommand(args: string[], runtime: RuntimeContext): Promise<boolean> {
  if (args[0] !== "post") {
    return false;
  }

  if (
    await tryRunNestedCliRoute({
      branch: "category",
      cliName: "halo post category",
      args,
      buildCli: () => buildCategoryCli(runtime),
    })
  ) {
    return true;
  }

  if (
    await tryRunNestedCliRoute({
      branch: "tag",
      cliName: "halo post tag",
      args,
      buildCli: () => buildTagCli(runtime),
    })
  ) {
    return true;
  }

  return tryRunCommandCliRoute({
    command: "post",
    cliName: "halo post",
    args,
    buildCli: () => buildPostCli(runtime),
  });
}
