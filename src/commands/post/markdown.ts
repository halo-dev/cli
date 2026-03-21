import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

import type { Post } from "@halo-dev/api-client";
import matter from "gray-matter";
import yaml from "js-yaml";

import { renderContentByRawType } from "../../utils/content.js";
import { CliError } from "../../utils/errors.js";
import { normalizeBaseUrl } from "../../utils/url.js";
import { slugify } from "./input.js";
import type { PostMutationInput } from "./types.js";

export interface HaloMarkdownTrackingData {
  site?: string;
  name?: string;
  publish?: boolean;
}

export interface PostMarkdownFrontMatter {
  title?: string;
  slug?: string;
  excerpt?: string;
  cover?: string;
  categories?: string[];
  tags?: string[];
  halo?: HaloMarkdownTrackingData;
}

export interface ParsedPostMarkdownDocument {
  content: string;
  frontMatter: PostMarkdownFrontMatter;
}

export interface PostMarkdownImportPayload {
  filePath: string;
  trackedSite?: string;
  trackedName?: string;
  mutationInput: PostMutationInput;
}

export function resolvePostMarkdownExportOutputPath(name: string, output?: string): string {
  const normalized = output?.trim();
  return normalized && normalized.length > 0 ? normalized : `./${name}.md`;
}

const frontMatterOptions = {
  engines: {
    yaml: {
      parse: (input: string) => (yaml.load(input) as Record<string, unknown> | undefined) ?? {},
      stringify: (data: object) =>
        yaml.dump(data, {
          styles: { "!!null": "empty" },
        }),
    },
  },
};

function trimOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new CliError(`Markdown front matter field \`${field}\` must be a string.`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOptionalStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new CliError(`Markdown front matter field \`${field}\` must be a string array.`);
  }

  const normalized = value.map((item, index) => {
    if (typeof item !== "string") {
      throw new CliError(`Markdown front matter field \`${field}[${index}]\` must be a string.`);
    }

    return item.trim();
  });

  const filtered = normalized.filter((item) => item.length > 0);
  return filtered.length > 0 ? filtered : undefined;
}

function normalizeTrackingData(value: unknown): HaloMarkdownTrackingData | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new CliError("Markdown front matter field `halo` must be an object.");
  }

  const record = value as Record<string, unknown>;
  const publish = record.publish;

  if (publish !== undefined && typeof publish !== "boolean") {
    throw new CliError("Markdown front matter field `halo.publish` must be a boolean.");
  }

  return compactFrontMatter({
    site: trimOptionalString(record.site, "halo.site"),
    name: trimOptionalString(record.name, "halo.name"),
    publish,
  }) as HaloMarkdownTrackingData | undefined;
}

export function compactFrontMatter<T>(value: T): T {
  if (Array.isArray(value)) {
    const compactedArray = value
      .map((item) => compactFrontMatter(item))
      .filter((item) => item !== undefined);
    return compactedArray as T;
  }

  if (value && typeof value === "object") {
    const compactedObject = Object.entries(value as Record<string, unknown>).reduce<
      Record<string, unknown>
    >((result, [key, entry]) => {
      const compactedEntry = compactFrontMatter(entry);
      if (compactedEntry !== undefined) {
        result[key] = compactedEntry;
      }
      return result;
    }, {});

    return (Object.keys(compactedObject).length > 0 ? compactedObject : undefined) as T;
  }

  return (value === undefined ? undefined : value) as T;
}

export function parsePostMarkdownDocument(source: string): ParsedPostMarkdownDocument {
  const parsed = matter(source, frontMatterOptions);
  const data = parsed.data as Record<string, unknown>;

  return {
    content: parsed.content,
    frontMatter:
      (compactFrontMatter({
        title: trimOptionalString(data.title, "title"),
        slug: trimOptionalString(data.slug, "slug"),
        excerpt: trimOptionalString(data.excerpt, "excerpt"),
        cover: trimOptionalString(data.cover, "cover"),
        categories: normalizeOptionalStringArray(data.categories, "categories"),
        tags: normalizeOptionalStringArray(data.tags, "tags"),
        halo: normalizeTrackingData(data.halo),
      }) as PostMarkdownFrontMatter | undefined) ?? {},
  };
}

function deriveFileTitle(filePath: string): string {
  const fileName = basename(filePath)
    .replace(/\.[^.]+$/, "")
    .trim();
  return fileName.length > 0 ? fileName : "post";
}

export async function resolvePostMarkdownImportPayload(
  filePath: string | undefined,
): Promise<PostMarkdownImportPayload> {
  const normalizedFilePath = filePath?.trim();
  if (!normalizedFilePath) {
    throw new CliError("Provide a Markdown file with `--file`.");
  }

  const source = await readFile(normalizedFilePath, "utf8");
  const { content, frontMatter } = parsePostMarkdownDocument(source);
  const raw = content.trim();

  if (!raw) {
    throw new CliError("Markdown file content cannot be empty.");
  }

  const title = frontMatter.title ?? deriveFileTitle(normalizedFilePath);

  return {
    filePath: normalizedFilePath,
    trackedSite: frontMatter.halo?.site,
    trackedName: frontMatter.halo?.name,
    mutationInput: {
      title,
      slug: frontMatter.slug ?? slugify(title),
      content: raw,
      renderedContent: renderContentByRawType(raw, "markdown"),
      rawType: "markdown",
      excerpt: frontMatter.excerpt,
      categories: frontMatter.categories,
      tags: frontMatter.tags,
      cover: frontMatter.cover,
      publish: frontMatter.halo?.publish,
    },
  };
}

export function assertMarkdownTrackingSite(
  trackedSite: string | undefined,
  currentBaseUrl: string,
): void {
  if (!trackedSite) {
    return;
  }

  if (normalizeBaseUrl(trackedSite) !== normalizeBaseUrl(currentBaseUrl)) {
    throw new CliError("Markdown file Halo site does not match the selected profile base URL.");
  }
}

export function buildPostMarkdownFrontMatter(
  post: Pick<Post, "metadata" | "spec">,
  options: {
    site: string;
    categories?: string[];
    tags?: string[];
  },
): PostMarkdownFrontMatter {
  return compactFrontMatter({
    title: post.spec.title || undefined,
    slug: post.spec.slug || undefined,
    excerpt: post.spec.excerpt?.autoGenerate ? undefined : post.spec.excerpt?.raw,
    cover: post.spec.cover || undefined,
    categories:
      options.categories && options.categories.length > 0 ? options.categories : undefined,
    tags: options.tags && options.tags.length > 0 ? options.tags : undefined,
    halo: {
      site: normalizeBaseUrl(options.site),
      name: post.metadata.name,
      publish: post.spec.publish,
    },
  }) as PostMarkdownFrontMatter;
}

export function stringifyPostMarkdownDocument(
  raw: string,
  frontMatter: PostMarkdownFrontMatter,
): string {
  return matter.stringify(raw, compactFrontMatter(frontMatter) ?? {}, frontMatterOptions);
}

export async function writePostMarkdownDocument(
  filePath: string,
  raw: string,
  frontMatter: PostMarkdownFrontMatter,
): Promise<void> {
  await writeFile(filePath, stringifyPostMarkdownDocument(raw, frontMatter), "utf8");
}
