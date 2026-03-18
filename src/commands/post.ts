import type { Category, CategoryList, Post, Tag, TagList } from "@halo-dev/api-client";
import { PostV1alpha1UcApi } from "@halo-dev/api-client";
import { checkbox, input } from "@inquirer/prompts";
import type { CAC } from "cac";

import { openUrlInBrowser, resolvePostOpenUrl } from "../utils/browser.js";
import { printCommandHelp } from "../utils/command-help.js";
import { CliError } from "../utils/errors.js";
import { printDetailObject, printJson, printPostList } from "../utils/format.js";
import {
  CONTENT_JSON_ANNOTATION,
  extractDraftContent,
  isInteractive,
  normalizeCreatePostInput,
  normalizeUpdatePostInput,
  parseBooleanOption,
  parseCsvOption,
  parseNumberOption,
  serializeDraftContent,
  slugify,
} from "../utils/post-input.js";
import { type HaloClients, normalizeBaseUrl, RuntimeContext } from "../utils/runtime.js";

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

function toMutationInput(options: PostCommandOptions) {
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

function withSerializedContentAnnotation(
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

async function loadEditablePostState(ucPostApi: PostV1alpha1UcApi, name: string) {
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

async function syncPostPublishState(
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
      (item) => item.metadata.name === normalized || item.spec.displayName === normalized,
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

  return [...new Set([...existingNames, ...created.map((item) => item.data.metadata.name)])];
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
      (item) => item.metadata.name === normalized || item.spec.displayName === normalized,
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

  return [...new Set([...existingNames, ...created.map((item) => item.data.metadata.name)])];
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
      categories.map((item) => ({
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
      tags.map((item) => ({
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

export function registerPostCommands(cli: CAC, runtime: RuntimeContext): void {
  cli
    .command("post [action] [name]", "Post management commands")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number")
    .option("--size <number>", "Page size")
    .option("--keyword <keyword>", "Filter by keyword")
    .option("--publish-phase <phase>", "Filter by publish phase")
    .option("--category <category>", "Filter by category including children")
    .option("--name <name>", "Post resource name")
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
    .option("--force", "Delete without confirmation")
    .action(
      async (action: string | undefined, name: string | undefined, options: PostCommandOptions) => {
        if (!action) {
          printCommandHelp({
            summary: "Work with Halo posts.",
            usage: "halo post <command> [flags]",
            sections: [
              {
                title: "COMMANDS",
                commands: [
                  { name: "list", description: "List posts" },
                  { name: "get", description: "Show post details" },
                  { name: "open", description: "Open a post in the browser" },
                  { name: "create", description: "Create a new post" },
                  { name: "update", description: "Update an existing post" },
                  { name: "delete", description: "Delete a post" },
                ],
              },
            ],
            flags: [
              { name: "--profile <name>", description: "Halo profile name" },
              { name: "--json", description: "Output JSON" },
            ],
            examples: [
              "halo post list",
              "halo post get <name>",
              "halo post open <name>",
              'halo post create --title "Hello Halo" --content "# Hello"',
            ],
            learnMore: [
              "Use `halo post <subcommand> --help` for more information about a command.",
            ],
          });
          return;
        }

        const { profile, clients } = await runtime.getClientsForOptions(options);
        const ucPostApi = new PostV1alpha1UcApi(
          undefined,
          normalizeBaseUrl(profile.baseUrl),
          clients.axios,
        );

        if (action === "list") {
          const response = await clients.console.content.post.listPosts({
            page: parseNumberOption(options.page),
            size: parseNumberOption(options.size),
            keyword: options.keyword,
            publishPhase: options.publishPhase as never,
            categoryWithChildren: options.category,
          });

          printPostList(response.data, options.json);
          return;
        }

        if (action === "get") {
          if (!name) {
            throw new CliError("`halo post get` requires a post name.");
          }

          const [postResponse, contentResponse] = await Promise.all([
            clients.core.content.post.getPost({ name }),
            clients.console.content.post.fetchPostHeadContent({ name }),
          ]);

          if (options.json) {
            printJson({
              post: postResponse.data,
              content: contentResponse.data,
            });
            return;
          }

          printDetailObject({
            post: postResponse.data,
            content: contentResponse.data,
          });
          return;
        }

        if (action === "open") {
          if (!name) {
            throw new CliError("`halo post open` requires a post name.");
          }

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
          return;
        }

        if (action === "create") {
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

          const latestPost = await ucPostApi.getMyPost({
            name: createResponse.data.metadata.name,
          });

          if (options.json) {
            printJson(latestPost.data);
            return;
          }

          process.stdout.write(`Created post ${latestPost.data.metadata.name}.\n`);
          return;
        }

        if (action === "update") {
          if (!name) {
            throw new CliError("`halo post update` requires a post name.");
          }

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
          return;
        }

        if (action === "delete") {
          if (!name) {
            throw new CliError("`halo post delete` requires a post name.");
          }

          if (!options.force && process.stdin.isTTY) {
            throw new CliError(
              "`halo post delete` requires --force in this MVP to avoid accidental deletion.",
            );
          }

          await clients.core.content.post.deletePost({ name });

          if (options.json) {
            printJson({ deleted: true, name });
            return;
          }

          process.stdout.write(`Deleted post ${name}.\n`);
          return;
        }

        throw new CliError(
          `Unsupported post action: ${action}. Supported actions: list, get, open, create, update, delete.`,
        );
      },
    );
}
