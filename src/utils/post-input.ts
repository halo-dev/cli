import { readFile } from "node:fs/promises";

import { confirm, input } from "@inquirer/prompts";
import type { ContentWrapper, Post, PostRequest } from "@halo-dev/api-client";

import type { PostMutationInput } from "../types.js";
import { CliError } from "./errors.js";

const DEFAULT_RAW_TYPE = "markdown";
const POST_API_VERSION = "content.halo.run/v1alpha1";
const POST_KIND = "Post";

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export function parseBooleanOption(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }

  throw new CliError(`Invalid boolean value: ${value}`);
}

export function parseNumberOption(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new CliError(`Invalid number value: ${value}`);
  }

  return parsed;
}

export function parseCsvOption(value: unknown): string[] | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "post";
}

async function resolveContent(inputValue?: string, contentFile?: string): Promise<string | undefined> {
  if (contentFile) {
    return readFile(contentFile, "utf8");
  }

  return inputValue;
}

async function promptForMissing(inputState: PostMutationInput, mode: "create" | "update", current?: { post: Post; content?: ContentWrapper }): Promise<PostMutationInput> {
  if (!isInteractive()) {
    return inputState;
  }

  const defaults = current?.post.spec;
  const contentDefaults = current?.content;
  const result = { ...inputState };

  if (!result.title) {
    result.title = await input({
      message: "Post title",
      default: defaults?.title,
      validate: (value) => (value.trim().length > 0 ? true : "Title is required."),
    });
  }

  if (!result.slug) {
    result.slug = await input({
      message: "Post slug",
      default: defaults?.slug ?? (result.title ? slugify(result.title) : undefined),
      validate: (value) => (value.trim().length > 0 ? true : "Slug is required."),
    });
  }

  if (!result.name) {
    result.name = await input({
      message: "Resource name",
      default: current?.post.metadata.name ?? result.slug,
      validate: (value) => (value.trim().length > 0 ? true : "Resource name is required."),
    });
  }

  const needsContent = mode === "create" || (!result.content && !result.contentFile);
  if (needsContent) {
    result.content = await input({
      message: "Post content",
      default: contentDefaults?.raw,
      validate: (value) => (value.trim().length > 0 ? true : "Content is required."),
    });
  }

  if (result.publish === undefined) {
    result.publish = await confirm({
      message: "Publish post now?",
      default: defaults?.publish ?? false,
    });
  }

  if (result.allowComment === undefined) {
    result.allowComment = await confirm({
      message: "Allow comments?",
      default: defaults?.allowComment ?? true,
    });
  }

  if (result.pinned === undefined) {
    result.pinned = await confirm({
      message: "Pin this post?",
      default: defaults?.pinned ?? false,
    });
  }

  return result;
}

export async function normalizeCreatePostInput(inputState: PostMutationInput): Promise<PostRequest> {
  const prompted = await promptForMissing(inputState, "create");
  const title = prompted.title?.trim();
  const slug = prompted.slug?.trim();
  const name = prompted.name?.trim() ?? slug;
  const raw = (await resolveContent(prompted.content, prompted.contentFile))?.trim();

  if (!title || !slug || !name || !raw) {
    throw new CliError("`halo post create` requires title, slug/name, and content. Use flags or run it interactively.");
  }

  return {
    post: {
      apiVersion: POST_API_VERSION,
      kind: POST_KIND,
      metadata: {
        name,
      },
      spec: {
        allowComment: prompted.allowComment ?? true,
        categories: prompted.categories,
        cover: prompted.cover,
        deleted: false,
        excerpt: {
          autoGenerate: !prompted.excerpt,
          raw: prompted.excerpt,
        },
        pinned: prompted.pinned ?? false,
        priority: prompted.priority ?? 0,
        publish: prompted.publish ?? false,
        slug,
        tags: prompted.tags,
        template: prompted.template,
        title,
        visible: (prompted.visible?.toUpperCase() as Post["spec"]["visible"]) ?? "PUBLIC",
      },
    },
    content: {
      content: raw,
      raw,
      rawType: prompted.rawType ?? DEFAULT_RAW_TYPE,
    },
  };
}

export async function normalizeUpdatePostInput(
  currentPost: Post,
  currentContent: ContentWrapper | undefined,
  inputState: PostMutationInput,
): Promise<PostRequest> {
  const prompted = await promptForMissing(inputState, "update", {
    post: currentPost,
    content: currentContent,
  });

  const resolvedContent = await resolveContent(prompted.content, prompted.contentFile);

  return {
    post: {
      ...currentPost,
      metadata: {
        ...currentPost.metadata,
        name: prompted.name?.trim() ?? currentPost.metadata.name,
      },
      spec: {
        ...currentPost.spec,
        allowComment: prompted.allowComment ?? currentPost.spec.allowComment,
        categories: prompted.categories ?? currentPost.spec.categories,
        cover: prompted.cover ?? currentPost.spec.cover,
        excerpt: {
          autoGenerate: prompted.excerpt ? false : currentPost.spec.excerpt.autoGenerate,
          raw: prompted.excerpt ?? currentPost.spec.excerpt.raw,
        },
        pinned: prompted.pinned ?? currentPost.spec.pinned,
        priority: prompted.priority ?? currentPost.spec.priority,
        publish: prompted.publish ?? currentPost.spec.publish,
        slug: prompted.slug?.trim() ?? currentPost.spec.slug,
        tags: prompted.tags ?? currentPost.spec.tags,
        template: prompted.template ?? currentPost.spec.template,
        title: prompted.title?.trim() ?? currentPost.spec.title,
        visible: (prompted.visible?.toUpperCase() as Post["spec"]["visible"]) ?? currentPost.spec.visible,
      },
    },
    content: {
      content: resolvedContent ?? currentContent?.content ?? currentContent?.raw ?? "",
      raw: resolvedContent ?? currentContent?.raw ?? currentContent?.content ?? "",
      rawType: prompted.rawType ?? currentContent?.rawType ?? DEFAULT_RAW_TYPE,
    },
  };
}