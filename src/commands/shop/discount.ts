import { type CAC, type Command } from "cac";

import { confirmDangerousAction } from "../../utils/confirmation.js";
import { CliError } from "../../utils/errors.js";
import { parseBooleanOption } from "../../utils/options.js";
import { printJson } from "../../utils/output.js";
import { RuntimeContext } from "../../utils/runtime.js";
import { ShopApi } from "./api.js";
import { createShopCli } from "./cli.js";
import { printDiscount, printDiscountList } from "./format.js";
import {
  mergeDefined,
  parseEnumOption,
  parseInstantOption,
  parseMoneyOption,
  parseNumberListOption,
  parsePageOption,
  parsePositiveInteger,
  parseSizeOption,
  readJsonPayload,
  requireString,
  type JsonInputOptions,
} from "./input.js";
import type {
  CalculationType,
  Discount,
  DiscountApplication,
  DiscountRequest,
  DiscountScope,
} from "./types.js";

const CALCULATION_TYPES = ["AMOUNT", "PERCENTAGE"] as const;
const DISCOUNT_SCOPES = ["ALL", "QUALIFYING_ITEMS"] as const;
const DISCOUNT_APPLICATIONS = ["AUTOMATIC", "CODE"] as const;

interface ShopCommandOptions {
  profile?: string;
  json?: boolean;
}

interface DiscountListOptions extends ShopCommandOptions {
  page?: string;
  size?: string;
  sort?: string;
}

interface DiscountMutationOptions extends ShopCommandOptions, JsonInputOptions {
  name?: string;
  description?: string;
  application?: string;
  calculationType?: string;
  discountValue?: string;
  maxDiscountAmount?: string;
  scope?: string;
  code?: string;
  productIds?: string;
  categoryIds?: string;
  excludedProductIds?: string;
  excludedCategoryIds?: string;
  excludeSaleItems?: string;
  minOrderAmount?: string;
  totalUsageLimit?: string;
  usageLimitPerCustomer?: string;
  enabled?: string;
  startsAt?: string;
  endsAt?: string;
  force?: boolean;
}

interface DiscountDeleteOptions extends ShopCommandOptions {
  force?: boolean;
}

function toPositiveIntegerOption(value: string | undefined, label: string): number | undefined {
  return value === undefined ? undefined : parsePositiveInteger(value, label);
}

function buildDiscountPatch(options: DiscountMutationOptions): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (options.name !== undefined) patch.name = options.name;
  if (options.description !== undefined) patch.description = options.description;

  const application = parseEnumOption(options.application, DISCOUNT_APPLICATIONS, "--application");
  if (application !== undefined) patch.application = application;

  const calculationType = parseEnumOption(
    options.calculationType,
    CALCULATION_TYPES,
    "--calculation-type",
  );
  if (calculationType !== undefined) patch.calculationType = calculationType;

  const discountValue = parseMoneyOption(options.discountValue, "--discount-value");
  if (discountValue !== undefined) patch.discountValue = discountValue;

  const maxDiscountAmount = parseMoneyOption(options.maxDiscountAmount, "--max-discount-amount");
  if (maxDiscountAmount !== undefined) patch.maxDiscountAmount = maxDiscountAmount;

  const scope = parseEnumOption(options.scope, DISCOUNT_SCOPES, "--scope");
  if (scope !== undefined) patch.scope = scope;

  if (options.code !== undefined) patch.code = options.code;

  const productIds = parseNumberListOption(options.productIds);
  if (productIds !== undefined) patch.productIds = productIds;

  const categoryIds = parseNumberListOption(options.categoryIds);
  if (categoryIds !== undefined) patch.categoryIds = categoryIds;

  const excludedProductIds = parseNumberListOption(options.excludedProductIds);
  if (excludedProductIds !== undefined) patch.excludedProductIds = excludedProductIds;

  const excludedCategoryIds = parseNumberListOption(options.excludedCategoryIds);
  if (excludedCategoryIds !== undefined) patch.excludedCategoryIds = excludedCategoryIds;

  if (options.excludeSaleItems !== undefined) {
    patch.excludeSaleItems = parseBooleanOption(options.excludeSaleItems);
  }

  const minOrderAmount = parseMoneyOption(options.minOrderAmount, "--min-order-amount");
  if (minOrderAmount !== undefined) patch.minOrderAmount = minOrderAmount;

  const totalUsageLimit = toPositiveIntegerOption(options.totalUsageLimit, "--total-usage-limit");
  if (totalUsageLimit !== undefined) patch.totalUsageLimit = totalUsageLimit;

  const usageLimitPerCustomer = toPositiveIntegerOption(
    options.usageLimitPerCustomer,
    "--usage-limit-per-customer",
  );
  if (usageLimitPerCustomer !== undefined) {
    patch.usageLimitPerCustomer = usageLimitPerCustomer;
  }

  if (options.enabled !== undefined) patch.isEnabled = parseBooleanOption(options.enabled);
  if (options.startsAt !== undefined) patch.startsAt = options.startsAt;
  if (options.endsAt !== undefined) patch.endsAt = options.endsAt;

  return patch;
}

function discountToRequest(discount: Discount): DiscountRequest {
  return {
    name: discount.name,
    description: discount.description,
    application: discount.application,
    calculationType: discount.calculationType,
    discountValue: discount.discountValue,
    maxDiscountAmount: discount.maxDiscountAmount,
    scope: discount.scope,
    code: discount.code,
    productIds: discount.productIds,
    categoryIds: discount.categoryIds,
    excludedProductIds: discount.excludedProductIds,
    excludedCategoryIds: discount.excludedCategoryIds,
    excludeSaleItems: discount.excludeSaleItems,
    minOrderAmount: discount.minOrderAmount,
    totalUsageLimit: discount.totalUsageLimit,
    usageLimitPerCustomer: discount.usageLimitPerCustomer,
    isEnabled: discount.isEnabled,
    startsAt: discount.startsAt,
    endsAt: discount.endsAt,
  };
}

function validateDiscountRequest(request: DiscountRequest): void {
  request.name = requireString(request.name, "Discount name is required. Use --name or --file.");

  if (request.application === undefined) {
    throw new CliError("Discount application is required. Use --application.");
  }
  if (!DISCOUNT_APPLICATIONS.includes(request.application as DiscountApplication)) {
    throw new CliError(`Invalid discount application "${String(request.application)}".`);
  }
  if (request.calculationType === undefined) {
    throw new CliError("Discount calculation type is required. Use --calculation-type.");
  }
  if (!CALCULATION_TYPES.includes(request.calculationType as CalculationType)) {
    throw new CliError(`Invalid calculation type "${String(request.calculationType)}".`);
  }
  if (request.discountValue === undefined) {
    throw new CliError("Discount value is required. Use --discount-value.");
  }
  const discountValue = parseMoneyOption(request.discountValue, "Discount value");
  if (discountValue === undefined) {
    throw new CliError("Discount value must be a non-negative number.");
  }
  if (request.calculationType === "PERCENTAGE" && discountValue > 100) {
    throw new CliError("Percentage discount value must be between 0 and 100.");
  }
  request.discountValue = discountValue;
  if (request.scope === undefined) {
    throw new CliError("Discount scope is required. Use --scope.");
  }
  if (!DISCOUNT_SCOPES.includes(request.scope as DiscountScope)) {
    throw new CliError(`Invalid discount scope "${String(request.scope)}".`);
  }
}

function normalizeDiscountRequest(request: DiscountRequest): void {
  request.startsAt = parseInstantOption(request.startsAt, "Discount startsAt");
  request.endsAt = parseInstantOption(request.endsAt, "Discount endsAt");

  if (request.application === "AUTOMATIC") {
    request.code = undefined;
  } else if (
    request.application === "CODE" &&
    (typeof request.code !== "string" || request.code.trim().length === 0)
  ) {
    throw new CliError("Discount code is required for CODE discounts. Use --code or --file.");
  }

  if (request.isEnabled === undefined) {
    return;
  }

  const enabled = parseBooleanOption(request.isEnabled);
  if (enabled === undefined) {
    throw new CliError("Discount isEnabled must be a boolean.");
  }

  request.isEnabled = enabled;
}

export function buildDiscountCli(runtime: RuntimeContext): CAC {
  const discountCli = createShopCli("halo shop discount");

  discountCli
    .command("list", "List discounts")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number", { default: 1 })
    .option("--size <number>", "Page size", { default: 20 })
    .option("--sort <sort>", "Sort expression, e.g. id,desc")
    .action(async (options: DiscountListOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const page = await api.listDiscounts({
        page: parsePageOption(options.page),
        size: parseSizeOption(options.size),
        sort: options.sort,
      });
      printDiscountList(page, options.json);
    });

  discountCli
    .command("get <id>", "Show discount details")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (id: string, options: ShopCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const discount = await api.getDiscount(parsePositiveInteger(id, "Discount ID"));
      printDiscount(discount, options.json);
    });

  const addMutationOptions = (command: Command): Command =>
    command
      .option("--profile <name>", "Halo profile name")
      .option("--json", "Output JSON")
      .option("--file <path>", "Read a DiscountRequest JSON file, use - for stdin")
      .option("--stdin", "Read a DiscountRequest JSON payload from stdin")
      .option("--name <name>", "Discount name")
      .option("--description <text>", "Discount description")
      .option("--application <type>", "AUTOMATIC or CODE")
      .option("--calculation-type <type>", "AMOUNT or PERCENTAGE")
      .option("--discount-value <number>", "Discount value")
      .option("--max-discount-amount <number>", "Maximum discount amount")
      .option("--scope <scope>", "ALL or QUALIFYING_ITEMS")
      .option("--code <code>", "Discount code for CODE discounts")
      .option("--product-ids <ids>", "Comma separated product IDs")
      .option("--category-ids <ids>", "Comma separated category IDs")
      .option("--excluded-product-ids <ids>", "Comma separated product IDs")
      .option("--excluded-category-ids <ids>", "Comma separated category IDs")
      .option("--exclude-sale-items <boolean>", "Exclude sale items")
      .option("--min-order-amount <number>", "Minimum order amount")
      .option("--total-usage-limit <number>", "Total usage limit")
      .option("--usage-limit-per-customer <number>", "Usage limit per customer")
      .option("--enabled <boolean>", "Whether the discount is enabled")
      .option("--starts-at <instant>", "Start time (ISO-8601)")
      .option("--ends-at <instant>", "End time (ISO-8601)");

  addMutationOptions(discountCli.command("create", "Create a discount")).action(
    async (options: DiscountMutationOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const payload: Record<string, unknown> = {
        ...(await readJsonPayload(options)),
        ...buildDiscountPatch(options),
      };
      const request = payload as unknown as DiscountRequest;
      validateDiscountRequest(request);
      normalizeDiscountRequest(request);
      const discount = await api.createDiscount(request);

      if (options.json) {
        printJson(discount);
        return;
      }

      process.stdout.write(`Created discount ${discount.id} (${discount.name}).\n`);
    },
  );

  addMutationOptions(discountCli.command("update <id>", "Update a discount"))
    .option("--force", "Disable the discount without confirmation")
    .action(async (id: string, options: DiscountMutationOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const discountId = parsePositiveInteger(id, "Discount ID");
      const current = await api.getDiscount(discountId);
      const payload = mergeDefined(
        discountToRequest(current) as unknown as Record<string, unknown>,
        {
          ...(await readJsonPayload(options)),
          ...buildDiscountPatch(options),
        },
      );
      const request = payload as unknown as DiscountRequest;
      validateDiscountRequest(request);
      normalizeDiscountRequest(request);

      if (current.isEnabled === true && request.isEnabled === false) {
        if (
          !(await confirmDangerousAction(
            {
              commandPath: "halo shop discount update",
              actionLabel: "Disable",
              resourceLabel: "discount",
              resourceName: String(discountId),
              cancellationVerb: "disabling",
            },
            options,
          ))
        ) {
          return;
        }
      }

      const discount = await api.updateDiscount(discountId, request);

      if (options.json) {
        printJson(discount);
        return;
      }

      process.stdout.write(`Updated discount ${discount.id} (${discount.name}).\n`);
    });

  discountCli
    .command("delete <id>", "Delete a discount")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--force", "Delete without confirmation")
    .action(async (id: string, options: DiscountDeleteOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const discountId = parsePositiveInteger(id, "Discount ID");

      if (
        !(await confirmDangerousAction(
          {
            commandPath: "halo shop discount delete",
            actionLabel: "Delete",
            resourceLabel: "discount",
            resourceName: String(discountId),
            cancellationVerb: "deleting",
          },
          options,
        ))
      ) {
        return;
      }

      const api = new ShopApi(clients.axios);
      await api.deleteDiscount(discountId);

      if (options.json) {
        printJson({ deleted: true, id: discountId });
        return;
      }

      process.stdout.write(`Deleted discount ${discountId}.\n`);
    });

  discountCli.usage("<command> [flags]");
  discountCli.example((bin) => `${bin} list`);
  discountCli.example((bin) => `${bin} get 1`);
  discountCli.example(
    (bin) =>
      `${bin} create --name "10% off" --application AUTOMATIC --calculation-type PERCENTAGE --discount-value 10 --scope ALL`,
  );
  discountCli.example((bin) => `${bin} delete 1 --force`);
  discountCli.help();

  return discountCli;
}
