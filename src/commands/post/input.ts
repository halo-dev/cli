import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { Content, ContentWrapper, Post, PostRequest, Snapshot } from "@halo-dev/api-client";
import { confirm, input } from "@inquirer/prompts";

import {
  DEFAULT_CONTENT_RAW_TYPE,
  normalizeContentRawType,
  renderContentByRawType,
} from "../../utils/content.js";
import { CliError } from "../../utils/errors.js";
import { isInteractive } from "../../utils/options.js";
import type { PostMutationInput } from "./types.js";

const POST_API_VERSION = "content.halo.run/v1alpha1";
const POST_KIND = "Post";
export const CONTENT_JSON_ANNOTATION = "content.halo.run/content-json";
export const PATCHED_CONTENT_ANNOTATION = "content.halo.run/patched-content";
export const PATCHED_RAW_ANNOTATION = "content.halo.run/patched-raw";

export function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "post"
  );
}

export function slugifyTaxonomyDisplayName(value: string, fallback: "category" | "tag"): string {
  return (
    value
      .trim()
      .normalize("NFKC")
      .replace(/\s+/gu, "-")
      .replace(/[^\p{L}\p{N}\p{M}._~-]+/gu, "")
      .replace(/-+/g, "-")
      .replace(/(^-|-$)/g, "") || fallback
  );
}

async function resolveContent(
  inputValue?: string,
  contentFile?: string,
): Promise<string | undefined> {
  if (contentFile) {
    return readFile(contentFile, "utf8");
  }

  return inputValue;
}

export function serializeDraftContent(
  content: Pick<Content, "content" | "raw" | "rawType">,
): string {
  return JSON.stringify(content);
}

export function extractDraftContent(snapshot: Snapshot): ContentWrapper | undefined {
  const annotations = snapshot.metadata.annotations ?? {};
  const contentJson = annotations[CONTENT_JSON_ANNOTATION];

  if (contentJson) {
    try {
      const parsed = JSON.parse(contentJson) as Partial<Content>;
      if (typeof parsed.raw === "string" || typeof parsed.content === "string") {
        const raw = parsed.raw ?? parsed.content ?? "";
        const rawType = parsed.rawType ?? snapshot.spec.rawType ?? DEFAULT_CONTENT_RAW_TYPE;
        return {
          raw,
          content: renderContentByRawType(raw, rawType),
          rawType,
        };
      }
    } catch {
      // Fall through to patched draft annotations.
    }
  }

  const patchedRaw = annotations[PATCHED_RAW_ANNOTATION];
  const patchedContent = annotations[PATCHED_CONTENT_ANNOTATION];

  if (patchedRaw || patchedContent) {
    const raw = patchedRaw ?? patchedContent ?? "";
    const rawType = snapshot.spec.rawType ?? DEFAULT_CONTENT_RAW_TYPE;
    return {
      raw,
      content: renderContentByRawType(raw, rawType),
      rawType,
    };
  }

  return undefined;
}

async function promptForMissing(
  inputState: PostMutationInput,
  mode: "create" | "update",
  current?: { post: Post; content?: ContentWrapper },
): Promise<PostMutationInput> {
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

  const needsContent = !result.content && !result.contentFile;
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

  return result;
}

export async function promptCreatePostPrimaryFields(
  inputState: PostMutationInput,
): Promise<PostMutationInput> {
  if (!isInteractive()) {
    return inputState;
  }

  const result = { ...inputState };

  if (!result.title) {
    result.title = await input({
      message: "Post title",
      validate: (value) => (value.trim().length > 0 ? true : "Title is required."),
    });
  }

  if (!result.slug) {
    result.slug = await input({
      message: "Post slug",
      default: result.title ? slugify(result.title) : undefined,
      validate: (value) => (value.trim().length > 0 ? true : "Slug is required."),
    });
  }

  return result;
}

export async function promptUpdatePostPrimaryFields(
  inputState: PostMutationInput,
  currentPost: Post,
): Promise<PostMutationInput> {
  if (!isInteractive()) {
    return inputState;
  }

  const result = { ...inputState };

  if (!result.title) {
    result.title = await input({
      message: "Post title",
      default: currentPost.spec.title,
      validate: (value) => (value.trim().length > 0 ? true : "Title is required."),
    });
  }

  if (!result.slug) {
    result.slug = await input({
      message: "Post slug",
      default: currentPost.spec.slug ?? (result.title ? slugify(result.title) : undefined),
      validate: (value) => (value.trim().length > 0 ? true : "Slug is required."),
    });
  }

  return result;
}

export async function normalizeCreatePostInput(
  inputState: PostMutationInput,
): Promise<PostRequest> {
  const prompted = await promptForMissing(inputState, "create");
  const title = prompted.title?.trim();
  const slug = prompted.slug?.trim();
  const name = randomUUID();
  const raw = (await resolveContent(prompted.content, prompted.contentFile))?.trim();
  const rawType = normalizeContentRawType(prompted.rawType);
  const content = raw
    ? (prompted.renderedContent?.trim() ?? renderContentByRawType(raw, rawType))
    : raw;

  if (!title || !slug || !raw) {
    throw new CliError(
      "`halo post create` requires title, slug, and content. Use flags or run it interactively.",
    );
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
      content: content ?? raw,
      raw,
      rawType,
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
  const nextRaw = resolvedContent ?? currentContent?.raw ?? "";
  const rawType = normalizeContentRawType(prompted.rawType ?? currentContent?.rawType);
  const renderedContent =
    prompted.renderedContent?.trim() ?? renderContentByRawType(nextRaw, rawType);

  return {
    post: {
      ...currentPost,
      metadata: {
        ...currentPost.metadata,
        name: prompted.name?.trim() ?? currentPost.metadata.name,
      },
      spec: {
        ...currentPost.spec,
        title: prompted.title?.trim() ?? currentPost.spec.title,
        slug: prompted.slug?.trim() ?? currentPost.spec.slug,
        categories: prompted.categories ?? currentPost.spec.categories,
        tags: prompted.tags ?? currentPost.spec.tags,
        cover: prompted.cover ?? currentPost.spec.cover,
        template: prompted.template ?? currentPost.spec.template,
        visible:
          (prompted.visible?.toUpperCase() as Post["spec"]["visible"] | undefined) ??
          currentPost.spec.visible,
        publish: prompted.publish ?? currentPost.spec.publish,
        pinned: prompted.pinned ?? currentPost.spec.pinned,
        allowComment: prompted.allowComment ?? currentPost.spec.allowComment,
        priority: prompted.priority ?? currentPost.spec.priority,
        excerpt: {
          autoGenerate: !(prompted.excerpt ?? currentPost.spec.excerpt?.raw),
          raw: prompted.excerpt ?? currentPost.spec.excerpt?.raw,
        },
      },
    },
    content: {
      content: renderedContent,
      raw: nextRaw,
      rawType,
    },
  };
}
