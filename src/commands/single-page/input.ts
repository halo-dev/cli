import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import type {
  ContentUpdateParam,
  ContentWrapper,
  SinglePage,
  SinglePageRequest,
} from "@halo-dev/api-client";
import { confirm, input } from "@inquirer/prompts";

import { normalizeContentRawType, renderContentByRawType } from "../../utils/content.js";
import { CliError } from "../../utils/errors.js";
import { isInteractive } from "../../utils/options.js";
import type { SinglePageMutationInput } from "./types.js";

const SINGLE_PAGE_API_VERSION = "content.halo.run/v1alpha1";
const SINGLE_PAGE_KIND = "SinglePage";

export function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "single-page"
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

async function promptForMissing(
  inputState: SinglePageMutationInput,
  mode: "create" | "update",
  current?: { page: SinglePage; content?: ContentWrapper },
): Promise<SinglePageMutationInput> {
  if (!isInteractive()) {
    return inputState;
  }

  const defaults = current?.page.spec;
  const contentDefaults = current?.content;
  const result = { ...inputState };

  if (!result.title) {
    result.title = await input({
      message: "Single page title",
      default: defaults?.title,
      validate: (value) => (value.trim().length > 0 ? true : "Title is required."),
    });
  }

  if (!result.slug) {
    result.slug = await input({
      message: "Single page slug",
      default: defaults?.slug ?? (result.title ? slugify(result.title) : undefined),
      validate: (value) => (value.trim().length > 0 ? true : "Slug is required."),
    });
  }

  const needsContent = mode === "create" || (!result.content && !result.contentFile);
  if (needsContent) {
    result.content = await input({
      message: "Single page content",
      default: contentDefaults?.raw,
      validate: (value) => (value.trim().length > 0 ? true : "Content is required."),
    });
  }

  if (result.publish === undefined) {
    result.publish = await confirm({
      message: "Publish single page now?",
      default: defaults?.publish ?? false,
    });
  }

  return result;
}

function toContentUpdateParam(raw: string, rawType: string): ContentUpdateParam {
  const normalizedRawType = normalizeContentRawType(rawType);
  return {
    raw,
    content: renderContentByRawType(raw, normalizedRawType),
    rawType: normalizedRawType,
  };
}

export async function normalizeCreateSinglePageInput(
  inputState: SinglePageMutationInput,
): Promise<SinglePageRequest> {
  const prompted = await promptForMissing(inputState, "create");
  const title = prompted.title?.trim();
  const slug = prompted.slug?.trim();
  const name = prompted.name?.trim() || randomUUID();
  const raw = (await resolveContent(prompted.content, prompted.contentFile))?.trim();

  if (!title || !slug || !raw) {
    throw new CliError(
      "`halo single-page create` requires title, slug, and content. Use flags or run it interactively.",
    );
  }

  const rawType = normalizeContentRawType(prompted.rawType);

  return {
    page: {
      apiVersion: SINGLE_PAGE_API_VERSION,
      kind: SINGLE_PAGE_KIND,
      metadata: {
        name,
      },
      spec: {
        allowComment: prompted.allowComment ?? true,
        cover: prompted.cover,
        deleted: false,
        excerpt: {
          autoGenerate: !prompted.excerpt,
          raw: prompted.excerpt,
        },
        pinned: false,
        priority: prompted.priority ?? 0,
        publish: prompted.publish ?? false,
        slug,
        template: prompted.template,
        title,
        visible: (prompted.visible?.toUpperCase() as SinglePage["spec"]["visible"]) ?? "PUBLIC",
      },
    },
    content: toContentUpdateParam(raw, rawType),
  };
}

export async function normalizeUpdateSinglePageInput(
  currentPage: SinglePage,
  currentContent: ContentWrapper | undefined,
  inputState: SinglePageMutationInput,
): Promise<SinglePageRequest> {
  const prompted = await promptForMissing(inputState, "update", {
    page: currentPage,
    content: currentContent,
  });

  const resolvedContent = await resolveContent(prompted.content, prompted.contentFile);
  const nextRaw = resolvedContent ?? currentContent?.raw ?? "";
  const nextRawType = normalizeContentRawType(prompted.rawType ?? currentContent?.rawType);

  return {
    page: {
      ...currentPage,
      metadata: {
        ...currentPage.metadata,
        name: prompted.name?.trim() ?? currentPage.metadata.name,
      },
      spec: {
        ...currentPage.spec,
        title: prompted.title?.trim() ?? currentPage.spec.title,
        slug: prompted.slug?.trim() ?? currentPage.spec.slug,
        cover: prompted.cover ?? currentPage.spec.cover,
        template: prompted.template ?? currentPage.spec.template,
        visible:
          (prompted.visible?.toUpperCase() as SinglePage["spec"]["visible"] | undefined) ??
          currentPage.spec.visible,
        publish: prompted.publish ?? currentPage.spec.publish,
        allowComment: prompted.allowComment ?? currentPage.spec.allowComment,
        priority: prompted.priority ?? currentPage.spec.priority,
        excerpt: {
          autoGenerate: !(prompted.excerpt ?? currentPage.spec.excerpt?.raw),
          raw: prompted.excerpt ?? currentPage.spec.excerpt?.raw,
        },
      },
    },
    content: toContentUpdateParam(nextRaw, nextRawType),
  };
}
