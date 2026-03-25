import type { Category } from "@halo-dev/api-client";
import { CategoryV1alpha1Api } from "@halo-dev/api-client";
import { input } from "@inquirer/prompts";
import cac, { type CAC } from "cac";

import { confirmDangerousAction } from "../../utils/confirmation.js";
import { CliError } from "../../utils/errors.js";
import { isInteractive, parseNumberOption } from "../../utils/options.js";
import { printJson } from "../../utils/output.js";
import { RuntimeContext } from "../../utils/runtime.js";
import { printCategory, printCategoryList } from "./format.js";
import { slugifyTaxonomyDisplayName } from "./input.js";

interface CategoryCommandOptions {
  profile?: string;
  json?: boolean;
}

interface CategoryListOptions extends CategoryCommandOptions {
  page?: string;
  size?: string;
  keyword?: string;
  sort?: string;
}

interface CategoryCreateOptions extends CategoryCommandOptions {
  displayName?: string;
  slug?: string;
  description?: string;
  cover?: string;
  priority?: string;
}

interface CategoryUpdateOptions extends CategoryCommandOptions {
  displayName?: string;
  slug?: string;
  description?: string;
  cover?: string;
  priority?: string;
}

interface CategoryDeleteOptions extends CategoryCommandOptions {
  force?: boolean;
}

async function resolveCategoryDisplayName(displayName: string | undefined): Promise<string> {
  if (displayName?.trim()) {
    return displayName.trim();
  }

  if (!isInteractive()) {
    throw new CliError(
      "Category display name is required. Use --display-name or run interactively.",
    );
  }

  const value = await input({
    message: "Display name",
    validate: (value) => (value.trim().length > 0 ? true : "Display name is required."),
  });

  return value.trim();
}

async function resolveCategorySlug(slug: string | undefined, displayName: string): Promise<string> {
  if (slug?.trim()) {
    return slug.trim();
  }

  const generatedSlug = slugifyTaxonomyDisplayName(displayName, "category");

  if (!isInteractive()) {
    return generatedSlug;
  }

  const value = await input({
    message: "Slug",
    default: generatedSlug,
  });

  return value.trim() || generatedSlug;
}

async function resolveCategoryDescription(
  description: string | undefined,
): Promise<string | undefined> {
  if (description !== undefined) {
    return description.trim() || undefined;
  }

  if (!isInteractive()) {
    return undefined;
  }

  const value = await input({
    message: "Description (optional)",
  });

  return value.trim() || undefined;
}

async function resolveCategoryCover(cover: string | undefined): Promise<string | undefined> {
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

async function resolveCategoryPriority(priority: string | undefined): Promise<number | undefined> {
  if (priority !== undefined) {
    const parsed = parseNumberOption(priority);
    return parsed;
  }

  if (!isInteractive()) {
    return undefined;
  }

  const value = await input({
    message: "Priority (optional, number)",
  });

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return parsed;
}

function buildCategoryRequestPayload(
  displayName: string,
  slug: string,
  description: string | undefined,
  cover: string | undefined,
  priority: number | undefined,
): Category {
  return {
    apiVersion: "content.halo.run/v1alpha1",
    kind: "Category",
    metadata: {
      name: "",
      generateName: "category-",
    },
    spec: {
      displayName,
      slug,
      description,
      cover,
      priority: priority ?? 0,
      children: [],
    },
  };
}

function buildCategoryUpdatePayload(
  existingCategory: Category,
  displayName: string | undefined,
  slug: string | undefined,
  description: string | undefined,
  cover: string | undefined,
  priority: number | undefined,
): Category {
  return {
    ...existingCategory,
    spec: {
      ...existingCategory.spec,
      displayName: displayName ?? existingCategory.spec.displayName,
      slug: slug ?? existingCategory.spec.slug,
      description: description !== undefined ? description : existingCategory.spec.description,
      cover: cover !== undefined ? cover : existingCategory.spec.cover,
      priority: priority !== undefined ? priority : existingCategory.spec.priority,
    },
  };
}

export function buildCategoryCli(runtime: RuntimeContext): CAC {
  const categoryCli = cac("halo post category");

  categoryCli
    .command("list", "List categories")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number", { default: 1 })
    .option("--size <number>", "Page size", { default: 50 })
    .option("--keyword <keyword>", "Filter by keyword")
    .option("--sort <sort>", "Sort expression, e.g. metadata.creationTimestamp,desc")
    .action(async (options: CategoryListOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const categoryApi = new CategoryV1alpha1Api(undefined, profile.baseUrl, clients.axios);

      const response = await categoryApi.listCategory({
        page: parseNumberOption(options.page),
        size: parseNumberOption(options.size),
        fieldSelector: options.keyword ? [`spec.displayName=${options.keyword}`] : undefined,
        sort: options.sort?.trim() ? [options.sort.trim()] : undefined,
      });

      printCategoryList(response.data, options.json);
    });

  categoryCli
    .command("get <name>", "Show category details")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (name: string, options: CategoryCommandOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const categoryApi = new CategoryV1alpha1Api(undefined, profile.baseUrl, clients.axios);

      const response = await categoryApi.getCategory({ name });
      printCategory(response.data, options.json);
    });

  categoryCli
    .command("create", "Create a category")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--display-name <name>", "Category display name")
    .option("--slug <slug>", "Category slug")
    .option("--description <text>", "Category description")
    .option("--cover <url>", "Category cover URL")
    .option("--priority <number>", "Category priority")
    .action(async (options: CategoryCreateOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const categoryApi = new CategoryV1alpha1Api(undefined, profile.baseUrl, clients.axios);

      const displayName = await resolveCategoryDisplayName(options.displayName);
      const slug = await resolveCategorySlug(options.slug, displayName);
      const description = await resolveCategoryDescription(options.description);
      const cover = await resolveCategoryCover(options.cover);
      const priority = await resolveCategoryPriority(options.priority);

      const payload = buildCategoryRequestPayload(displayName, slug, description, cover, priority);
      const response = await categoryApi.createCategory({ category: payload });

      printCategory(response.data, options.json, "Category created successfully.");
    });

  categoryCli
    .command("update <name>", "Update a category")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--display-name <name>", "Category display name")
    .option("--slug <slug>", "Category slug")
    .option("--description <text>", "Category description")
    .option("--cover <url>", "Category cover URL")
    .option("--priority <number>", "Category priority")
    .action(async (name: string, options: CategoryUpdateOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const categoryApi = new CategoryV1alpha1Api(undefined, profile.baseUrl, clients.axios);

      // Fetch existing category first
      const existingResponse = await categoryApi.getCategory({ name });
      const existingCategory = existingResponse.data;

      // Resolve new values
      const displayName = options.displayName?.trim();
      const slug = options.slug?.trim();
      const description =
        options.description !== undefined ? options.description.trim() || undefined : undefined;
      const cover = options.cover !== undefined ? options.cover.trim() || undefined : undefined;
      const priority = parseNumberOption(options.priority);

      // Interactive prompts for empty fields if in TTY mode
      let finalDisplayName = displayName;
      let finalSlug = slug;

      if (!finalDisplayName && isInteractive()) {
        finalDisplayName = await input({
          message: "Display name",
          default: existingCategory.spec.displayName,
        });
      }

      if (!finalSlug && isInteractive() && finalDisplayName) {
        const defaultSlug = slugifyTaxonomyDisplayName(finalDisplayName, "category");
        finalSlug = await input({
          message: "Slug",
          default: defaultSlug,
        });
      }

      const payload = buildCategoryUpdatePayload(
        existingCategory,
        finalDisplayName,
        finalSlug,
        description,
        cover,
        priority,
      );

      const response = await categoryApi.updateCategory({ name, category: payload });
      printCategory(response.data, options.json, "Category updated successfully.");
    });

  categoryCli
    .command("delete <name>", "Delete a category")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--force", "Delete without confirmation")
    .action(async (name: string, options: CategoryDeleteOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const categoryApi = new CategoryV1alpha1Api(undefined, profile.baseUrl, clients.axios);

      if (
        !(await confirmDangerousAction(
          {
            commandPath: "halo post category delete",
            actionLabel: "Delete",
            resourceLabel: "category",
            resourceName: name,
            cancellationVerb: "deleting",
          },
          options,
        ))
      ) {
        return;
      }

      await categoryApi.deleteCategory({ name });

      if (options.json) {
        printJson({ deleted: true, name });
        return;
      }

      process.stdout.write(`Deleted category ${name}.\n`);
    });

  categoryCli.usage("<command> [flags]");
  categoryCli.example((bin) => `${bin} list`);
  categoryCli.example((bin) => `${bin} get category-abc123`);
  categoryCli.example((bin) => `${bin} create --display-name "Technology" --priority 100`);
  categoryCli.example((bin) => `${bin} update category-abc123 --display-name "Tech"`);
  categoryCli.example((bin) => `${bin} delete category-abc123 --force`);
  categoryCli.help();

  return categoryCli;
}
