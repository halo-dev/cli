import type { Tag } from "@halo-dev/api-client";
import { TagV1alpha1Api } from "@halo-dev/api-client";
import { input } from "@inquirer/prompts";
import cac, { type CAC } from "cac";

import { confirmDangerousAction } from "../../utils/confirmation.js";
import { CliError } from "../../utils/errors.js";
import { isInteractive, parseNumberOption } from "../../utils/options.js";
import { printJson } from "../../utils/output.js";
import { RuntimeContext } from "../../utils/runtime.js";
import { printTag, printTagList } from "./format.js";
import { slugifyTaxonomyDisplayName } from "./input.js";

interface TagCommandOptions {
  profile?: string;
  json?: boolean;
}

interface TagListOptions extends TagCommandOptions {
  page?: string;
  size?: string;
  keyword?: string;
  sort?: string;
}

interface TagCreateOptions extends TagCommandOptions {
  displayName?: string;
  slug?: string;
  color?: string;
  cover?: string;
}

interface TagUpdateOptions extends TagCommandOptions {
  displayName?: string;
  slug?: string;
  color?: string;
  cover?: string;
}

interface TagDeleteOptions extends TagCommandOptions {
  force?: boolean;
}

async function resolveTagDisplayName(displayName: string | undefined): Promise<string> {
  if (displayName?.trim()) {
    return displayName.trim();
  }

  if (!isInteractive()) {
    throw new CliError("Tag display name is required. Use --display-name or run interactively.");
  }

  const value = await input({
    message: "Display name",
    validate: (value) => (value.trim().length > 0 ? true : "Display name is required."),
  });

  return value.trim();
}

async function resolveTagSlug(slug: string | undefined, displayName: string): Promise<string> {
  if (slug?.trim()) {
    return slug.trim();
  }

  const generatedSlug = slugifyTaxonomyDisplayName(displayName, "tag");

  if (!isInteractive()) {
    return generatedSlug;
  }

  const value = await input({
    message: "Slug",
    default: generatedSlug,
  });

  return value.trim() || generatedSlug;
}

async function resolveTagColor(color: string | undefined): Promise<string | undefined> {
  if (color !== undefined) {
    return color.trim() || undefined;
  }

  if (!isInteractive()) {
    return undefined;
  }

  const value = await input({
    message: "Color (hex, optional)",
  });

  return value.trim() || undefined;
}

async function resolveTagCover(cover: string | undefined): Promise<string | undefined> {
  if (cover !== undefined) {
    return cover.trim() || undefined;
  }

  if (!isInteractive()) {
    return undefined;
  }

  const value = await input({
    message: "Cover URL (optional)",
  });

  return value.trim() || undefined;
}

function buildTagRequestPayload(
  displayName: string,
  slug: string,
  color: string | undefined,
  cover: string | undefined,
): Tag {
  return {
    apiVersion: "content.halo.run/v1alpha1",
    kind: "Tag",
    metadata: {
      name: "",
      generateName: "tag-",
    },
    spec: {
      displayName,
      slug,
      color,
      cover,
    },
  };
}

function buildTagUpdatePayload(
  existingTag: Tag,
  displayName: string | undefined,
  slug: string | undefined,
  color: string | undefined,
  cover: string | undefined,
): Tag {
  return {
    ...existingTag,
    spec: {
      ...existingTag.spec,
      displayName: displayName ?? existingTag.spec.displayName,
      slug: slug ?? existingTag.spec.slug,
      color: color !== undefined ? color : existingTag.spec.color,
      cover: cover !== undefined ? cover : existingTag.spec.cover,
    },
  };
}

export function buildTagCli(runtime: RuntimeContext): CAC {
  const tagCli = cac("halo post tag");

  tagCli
    .command("list", "List tags")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number", { default: 1 })
    .option("--size <number>", "Page size", { default: 50 })
    .option("--keyword <keyword>", "Filter by keyword")
    .option("--sort <sort>", "Sort expression, e.g. metadata.creationTimestamp,desc")
    .action(async (options: TagListOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const tagApi = new TagV1alpha1Api(undefined, profile.baseUrl, clients.axios);

      const response = await tagApi.listTag({
        page: parseNumberOption(options.page),
        size: parseNumberOption(options.size),
        fieldSelector: options.keyword ? [`spec.displayName=${options.keyword}`] : undefined,
        sort: options.sort?.trim() ? [options.sort.trim()] : undefined,
      });

      printTagList(response.data, options.json);
    });

  tagCli
    .command("get <name>", "Show tag details")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (name: string, options: TagCommandOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const tagApi = new TagV1alpha1Api(undefined, profile.baseUrl, clients.axios);

      const response = await tagApi.getTag({ name });
      printTag(response.data, options.json);
    });

  tagCli
    .command("create", "Create a tag")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--display-name <name>", "Tag display name")
    .option("--slug <slug>", "Tag slug")
    .option("--color <color>", "Tag color (hex)")
    .option("--cover <url>", "Tag cover URL")
    .action(async (options: TagCreateOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const tagApi = new TagV1alpha1Api(undefined, profile.baseUrl, clients.axios);

      const displayName = await resolveTagDisplayName(options.displayName);
      const slug = await resolveTagSlug(options.slug, displayName);
      const color = await resolveTagColor(options.color);
      const cover = await resolveTagCover(options.cover);

      const payload = buildTagRequestPayload(displayName, slug, color, cover);
      const response = await tagApi.createTag({ tag: payload });

      printTag(response.data, options.json, "Tag created successfully.");
    });

  tagCli
    .command("update <name>", "Update a tag")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--display-name <name>", "Tag display name")
    .option("--slug <slug>", "Tag slug")
    .option("--color <color>", "Tag color (hex)")
    .option("--cover <url>", "Tag cover URL")
    .action(async (name: string, options: TagUpdateOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const tagApi = new TagV1alpha1Api(undefined, profile.baseUrl, clients.axios);

      // Fetch existing tag first
      const existingResponse = await tagApi.getTag({ name });
      const existingTag = existingResponse.data;

      // Resolve new values
      const displayName = options.displayName?.trim();
      const slug = options.slug?.trim();
      const color = options.color !== undefined ? options.color.trim() || undefined : undefined;
      const cover = options.cover !== undefined ? options.cover.trim() || undefined : undefined;

      // Interactive prompts for empty fields if in TTY mode
      let finalDisplayName = displayName;
      let finalSlug = slug;

      if (!finalDisplayName && isInteractive()) {
        finalDisplayName = await input({
          message: "Display name",
          default: existingTag.spec.displayName,
        });
      }

      if (!finalSlug && isInteractive() && finalDisplayName) {
        const defaultSlug = slugifyTaxonomyDisplayName(finalDisplayName, "tag");
        finalSlug = await input({
          message: "Slug",
          default: defaultSlug,
        });
      }

      const payload = buildTagUpdatePayload(existingTag, finalDisplayName, finalSlug, color, cover);

      const response = await tagApi.updateTag({ name, tag: payload });
      printTag(response.data, options.json, "Tag updated successfully.");
    });

  tagCli
    .command("delete <name>", "Delete a tag")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--force", "Delete without confirmation")
    .action(async (name: string, options: TagDeleteOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const tagApi = new TagV1alpha1Api(undefined, profile.baseUrl, clients.axios);

      if (
        !(await confirmDangerousAction(
          {
            commandPath: "halo post tag delete",
            actionLabel: "Delete",
            resourceLabel: "tag",
            resourceName: name,
            cancellationVerb: "deleting",
          },
          options,
        ))
      ) {
        return;
      }

      await tagApi.deleteTag({ name });

      if (options.json) {
        printJson({ deleted: true, name });
        return;
      }

      process.stdout.write(`Deleted tag ${name}.\n`);
    });

  tagCli.usage("<command> [flags]");
  tagCli.example((bin) => `${bin} list`);
  tagCli.example((bin) => `${bin} get tag-abc123`);
  tagCli.example((bin) => `${bin} create --display-name "Technology" --color "#1890ff"`);
  tagCli.example((bin) => `${bin} update tag-abc123 --display-name "Tech"`);
  tagCli.example((bin) => `${bin} delete tag-abc123 --force`);
  tagCli.help();

  return tagCli;
}
