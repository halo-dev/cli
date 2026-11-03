import { type CAC } from "cac";

import { confirmDangerousAction } from "../../utils/confirmation.js";
import { parseBooleanOption } from "../../utils/options.js";
import { printJson } from "../../utils/output.js";
import { RuntimeContext } from "../../utils/runtime.js";
import { ShopApi } from "./api.js";
import { createShopCli } from "./cli.js";
import { printCategory, printCategoryList } from "./format.js";
import {
  mergeDefined,
  parsePositiveInteger,
  readJsonPayload,
  requireString,
  type JsonInputOptions,
} from "./input.js";
import type { ProductCategory, ProductCategoryRequest } from "./types.js";

interface ShopCommandOptions {
  profile?: string;
  json?: boolean;
}

interface CategoryListOptions extends ShopCommandOptions {
  tree?: boolean | string;
}

interface CategoryMutationOptions extends ShopCommandOptions, JsonInputOptions {
  name?: string;
  slug?: string;
  description?: string;
  image?: string;
  parent?: string;
}

interface CategoryDeleteOptions extends ShopCommandOptions {
  force?: boolean;
}

function categoryToRequest(category: ProductCategory): ProductCategoryRequest {
  return {
    name: category.name,
    slug: category.slug,
    description: category.description,
    image: category.image,
    parentId: category.parentId,
  };
}

function buildCategoryFlagPatch(options: CategoryMutationOptions): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (options.name !== undefined) patch.name = options.name;
  if (options.slug !== undefined) patch.slug = options.slug;
  if (options.description !== undefined) patch.description = options.description;
  if (options.image !== undefined) patch.image = options.image;
  if (options.parent !== undefined) {
    patch.parentId = parsePositiveInteger(options.parent, "--parent");
  }

  return patch;
}

function validateCategoryRequest(request: ProductCategoryRequest): void {
  request.name = requireString(request.name, "Category name is required. Use --name or --file.");
  request.slug = requireString(request.slug, "Category slug is required. Use --slug or --file.");
}

export function buildCategoryCli(runtime: RuntimeContext): CAC {
  const categoryCli = createShopCli("halo shop category");

  categoryCli
    .command("list", "List product categories")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--tree", "Return categories as a tree")
    .action(async (options: CategoryListOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const categories = await api.listCategories(parseBooleanOption(options.tree) ?? false);
      printCategoryList(categories, options.json);
    });

  categoryCli
    .command("get <id>", "Show category details")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (id: string, options: ShopCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const category = await api.getCategory(parsePositiveInteger(id, "Category ID"));
      printCategory(category, options.json);
    });

  categoryCli
    .command("create", "Create a product category")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--file <path>", "Read a ProductCategoryRequest JSON file, use - for stdin")
    .option("--stdin", "Read a ProductCategoryRequest JSON payload from stdin")
    .option("--name <name>", "Category name")
    .option("--slug <slug>", "Category slug")
    .option("--description <text>", "Category description")
    .option("--image <url>", "Category image URL")
    .option("--parent <id>", "Parent category ID")
    .action(async (options: CategoryMutationOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const payload: Record<string, unknown> = {
        ...(await readJsonPayload(options)),
        ...buildCategoryFlagPatch(options),
      };
      const request = payload as unknown as ProductCategoryRequest;
      validateCategoryRequest(request);

      const category = await api.createCategory(request);

      if (options.json) {
        printJson(category);
        return;
      }

      process.stdout.write(`Created category ${category.id} (${category.name}).\n`);
    });

  categoryCli
    .command("update <id>", "Update a product category")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--file <path>", "Read a partial ProductCategoryRequest JSON file, use - for stdin")
    .option("--stdin", "Read a partial ProductCategoryRequest JSON payload from stdin")
    .option("--name <name>", "Category name")
    .option("--slug <slug>", "Category slug")
    .option("--description <text>", "Category description")
    .option("--image <url>", "Category image URL")
    .option("--parent <id>", "Parent category ID")
    .action(async (id: string, options: CategoryMutationOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const categoryId = parsePositiveInteger(id, "Category ID");
      const current = await api.getCategory(categoryId);
      const payload = mergeDefined(
        categoryToRequest(current) as unknown as Record<string, unknown>,
        {
          ...(await readJsonPayload(options)),
          ...buildCategoryFlagPatch(options),
        },
      );
      const request = payload as unknown as ProductCategoryRequest;
      validateCategoryRequest(request);

      const category = await api.updateCategory(categoryId, request);

      if (options.json) {
        printJson(category);
        return;
      }

      process.stdout.write(`Updated category ${category.id} (${category.name}).\n`);
    });

  categoryCli
    .command("delete <id>", "Delete a product category")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--force", "Delete without confirmation")
    .action(async (id: string, options: CategoryDeleteOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const categoryId = parsePositiveInteger(id, "Category ID");

      if (
        !(await confirmDangerousAction(
          {
            commandPath: "halo shop category delete",
            actionLabel: "Delete",
            resourceLabel: "category",
            resourceName: String(categoryId),
            cancellationVerb: "deleting",
          },
          options,
        ))
      ) {
        return;
      }

      const api = new ShopApi(clients.axios);
      await api.deleteCategory(categoryId);

      if (options.json) {
        printJson({ deleted: true, id: categoryId });
        return;
      }

      process.stdout.write(`Deleted category ${categoryId}.\n`);
    });

  categoryCli.usage("<command> [flags]");
  categoryCli.example((bin) => `${bin} list --tree`);
  categoryCli.example((bin) => `${bin} create --name "Digital goods" --slug digital-goods`);
  categoryCli.example((bin) => `${bin} update 1 --name "New name"`);
  categoryCli.example((bin) => `${bin} delete 1 --force`);
  categoryCli.help();

  return categoryCli;
}
