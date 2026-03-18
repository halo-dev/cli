import type { CAC } from "cac";

import { openUrlInBrowser, resolvePostOpenUrl } from "../utils/browser.js";
import { CliError } from "../utils/errors.js";
import { printDetailObject, printJson, printPostList } from "../utils/format.js";
import {
  normalizeCreatePostInput,
  normalizeUpdatePostInput,
  parseBooleanOption,
  parseCsvOption,
  parseNumberOption,
} from "../utils/post-input.js";
import { RuntimeContext } from "../utils/runtime.js";

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

export function registerPostCommands(cli: CAC, runtime: RuntimeContext): void {
  cli
    .command("post <action> [name]", "Post management commands")
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
    .action(async (action: string, name: string | undefined, options: PostCommandOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);

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
        const postRequest = await normalizeCreatePostInput(toMutationInput(options));

        const createResponse = await clients.core.content.post.createPost({
          post: postRequest.post,
        });

        const updateResponse = await clients.console.content.post.updateDraftPost({
          name: createResponse.data.metadata.name,
          postRequest: {
            post: createResponse.data,
            content: postRequest.content,
          },
        });

        if (options.json) {
          printJson(updateResponse.data);
          return;
        }

        process.stdout.write(`Created post ${updateResponse.data.metadata.name}.\n`);
        return;
      }

      if (action === "update") {
        if (!name) {
          throw new CliError("`halo post update` requires a post name.");
        }

        const [currentPost, currentContent] = await Promise.all([
          clients.core.content.post.getPost({ name }),
          clients.console.content.post.fetchPostHeadContent({ name }),
        ]);

        const postRequest = await normalizeUpdatePostInput(currentPost.data, currentContent.data, {
          ...toMutationInput(options),
          name: options.newName,
        });

        const response = await clients.console.content.post.updateDraftPost({
          name,
          postRequest,
        });

        if (options.json) {
          printJson(response.data);
          return;
        }

        process.stdout.write(`Updated post ${response.data.metadata.name}.\n`);
        return;
      }

      if (action === "delete") {
        if (!name) {
          throw new CliError("`halo post delete` requires a post name.");
        }

        if (!options.force && process.stdin.isTTY) {
          throw new CliError("`halo post delete` requires --force in this MVP to avoid accidental deletion.");
        }

        await clients.core.content.post.deletePost({ name });

        if (options.json) {
          printJson({ deleted: true, name });
          return;
        }

        process.stdout.write(`Deleted post ${name}.\n`);
        return;
      }

      throw new CliError(`Unsupported post action: ${action}. Supported actions: list, get, open, create, update, delete.`);
    });
}