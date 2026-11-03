import { type CAC, type Command } from "cac";

import { confirmDangerousAction } from "../../utils/confirmation.js";
import { CliError } from "../../utils/errors.js";
import { parseBooleanOption } from "../../utils/options.js";
import { printJson } from "../../utils/output.js";
import { RuntimeContext } from "../../utils/runtime.js";
import { ShopApi } from "./api.js";
import { createShopCli } from "./cli.js";
import { printCoupon, printCouponList } from "./format.js";
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
  toStringArray,
  type JsonInputOptions,
} from "./input.js";
import type { CalculationType, Coupon, CouponRequest, DiscountScope } from "./types.js";

const CALCULATION_TYPES = ["AMOUNT", "PERCENTAGE"] as const;
const DISCOUNT_SCOPES = ["ALL", "QUALIFYING_ITEMS"] as const;

interface ShopCommandOptions {
  profile?: string;
  json?: boolean;
}

interface CouponListOptions extends ShopCommandOptions {
  page?: string;
  size?: string;
  keyword?: string;
  enabled?: string;
  sort?: string;
}

interface CouponMutationOptions extends ShopCommandOptions, JsonInputOptions {
  name?: string;
  description?: string;
  calculationType?: string;
  discountValue?: string;
  maxDiscountAmount?: string;
  scope?: string;
  qualifyingProductIds?: string;
  qualifyingCategoryIds?: string;
  excludedProductIds?: string;
  excludedCategoryIds?: string;
  excludeSaleItems?: string;
  minOrderAmount?: string;
  totalCount?: string;
  perCustomerLimit?: string;
  enabled?: string;
  startsAt?: string;
  endsAt?: string;
  validDays?: string;
  combineWithCoupons?: string;
  combineWithOrderDiscount?: string;
  force?: boolean;
}

interface CouponDeleteOptions extends ShopCommandOptions {
  force?: boolean;
}

interface CouponDistributeOptions extends ShopCommandOptions {
  all?: boolean;
  username?: string | string[];
  force?: boolean;
}

function toPositiveIntegerOption(value: string | undefined, label: string): number | undefined {
  return value === undefined ? undefined : parsePositiveInteger(value, label);
}

function buildCouponPatch(options: CouponMutationOptions): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (options.name !== undefined) patch.name = options.name;
  if (options.description !== undefined) patch.description = options.description;

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

  const qualifyingProductIds = parseNumberListOption(options.qualifyingProductIds);
  if (qualifyingProductIds !== undefined) {
    patch.qualifyingProductIds = qualifyingProductIds;
  }

  const qualifyingCategoryIds = parseNumberListOption(options.qualifyingCategoryIds);
  if (qualifyingCategoryIds !== undefined) {
    patch.qualifyingCategoryIds = qualifyingCategoryIds;
  }

  const excludedProductIds = parseNumberListOption(options.excludedProductIds);
  if (excludedProductIds !== undefined) patch.excludedProductIds = excludedProductIds;

  const excludedCategoryIds = parseNumberListOption(options.excludedCategoryIds);
  if (excludedCategoryIds !== undefined) {
    patch.excludedCategoryIds = excludedCategoryIds;
  }

  if (options.excludeSaleItems !== undefined) {
    patch.excludeSaleItems = parseBooleanOption(options.excludeSaleItems);
  }

  const minOrderAmount = parseMoneyOption(options.minOrderAmount, "--min-order-amount");
  if (minOrderAmount !== undefined) patch.minOrderAmount = minOrderAmount;

  const totalCount = toPositiveIntegerOption(options.totalCount, "--total-count");
  if (totalCount !== undefined) patch.totalCount = totalCount;

  const perCustomerLimit = toPositiveIntegerOption(
    options.perCustomerLimit,
    "--per-customer-limit",
  );
  if (perCustomerLimit !== undefined) patch.perCustomerLimit = perCustomerLimit;

  if (options.enabled !== undefined) patch.isEnabled = parseBooleanOption(options.enabled);
  if (options.startsAt !== undefined) patch.startsAt = options.startsAt;
  if (options.endsAt !== undefined) patch.endsAt = options.endsAt;

  const validDays = toPositiveIntegerOption(options.validDays, "--valid-days");
  if (validDays !== undefined) patch.validDays = validDays;

  if (options.combineWithCoupons !== undefined) {
    patch.combineWithCoupons = parseBooleanOption(options.combineWithCoupons);
  }
  if (options.combineWithOrderDiscount !== undefined) {
    patch.combineWithOrderDiscount = parseBooleanOption(options.combineWithOrderDiscount);
  }

  return patch;
}

function couponToRequest(coupon: Coupon): CouponRequest {
  return {
    name: coupon.name,
    description: coupon.description,
    calculationType: coupon.calculationType,
    discountValue: coupon.discountValue,
    maxDiscountAmount: coupon.maxDiscountAmount,
    scope: coupon.scope,
    qualifyingProductIds: coupon.qualifyingProductIds,
    qualifyingCategoryIds: coupon.qualifyingCategoryIds,
    excludedProductIds: coupon.excludedProductIds,
    excludedCategoryIds: coupon.excludedCategoryIds,
    excludeSaleItems: coupon.excludeSaleItems,
    minOrderAmount: coupon.minOrderAmount,
    totalCount: coupon.totalCount,
    perCustomerLimit: coupon.perCustomerLimit,
    isEnabled: coupon.isEnabled,
    startsAt: coupon.startsAt,
    endsAt: coupon.endsAt,
    validDays: coupon.validDays,
    combineWithCoupons: coupon.combineWithCoupons,
    combineWithOrderDiscount: coupon.combineWithOrderDiscount,
  };
}

function validateCouponRequest(request: CouponRequest): void {
  request.name = requireString(request.name, "Coupon name is required. Use --name or --file.");

  if (request.calculationType === undefined) {
    throw new CliError("Coupon calculation type is required. Use --calculation-type.");
  }
  if (!CALCULATION_TYPES.includes(request.calculationType as CalculationType)) {
    throw new CliError(`Invalid calculation type "${String(request.calculationType)}".`);
  }
  if (request.discountValue === undefined) {
    throw new CliError("Coupon discount value is required. Use --discount-value.");
  }
  const discountValue = parseMoneyOption(request.discountValue, "Coupon discount value");
  if (discountValue === undefined) {
    throw new CliError("Coupon discount value must be a non-negative number.");
  }
  if (request.calculationType === "PERCENTAGE" && discountValue > 100) {
    throw new CliError("Percentage coupon discount value must be between 0 and 100.");
  }
  request.discountValue = discountValue;
  if (request.scope === undefined) {
    throw new CliError("Coupon scope is required. Use --scope.");
  }
  if (!DISCOUNT_SCOPES.includes(request.scope as DiscountScope)) {
    throw new CliError(`Invalid coupon scope "${String(request.scope)}".`);
  }
  if (request.validDays === undefined) {
    throw new CliError("Coupon valid days is required. Use --valid-days.");
  }
  request.validDays = parsePositiveInteger(request.validDays, "Coupon valid days");
}

function normalizeCouponRequest(request: CouponRequest): void {
  request.startsAt = parseInstantOption(request.startsAt, "Coupon startsAt");
  request.endsAt = parseInstantOption(request.endsAt, "Coupon endsAt");

  if (request.isEnabled === undefined) {
    return;
  }

  const enabled = parseBooleanOption(request.isEnabled);
  if (enabled === undefined) {
    throw new CliError("Coupon isEnabled must be a boolean.");
  }

  request.isEnabled = enabled;
}

export function buildCouponCli(runtime: RuntimeContext): CAC {
  const couponCli = createShopCli("halo shop coupon");

  couponCli
    .command("list", "List coupons")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number", { default: 1 })
    .option("--size <number>", "Page size", { default: 20 })
    .option("--keyword <keyword>", "Filter by keyword")
    .option("--enabled <boolean>", "Filter by enabled state")
    .option("--sort <sort>", "Sort expression, e.g. id,desc")
    .action(async (options: CouponListOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const page = await api.listCoupons({
        page: parsePageOption(options.page),
        size: parseSizeOption(options.size),
        keyword: options.keyword,
        isEnabled: options.enabled === undefined ? undefined : parseBooleanOption(options.enabled),
        sort: options.sort,
      });
      printCouponList(page, options.json);
    });

  couponCli
    .command("get <id>", "Show coupon details")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (id: string, options: ShopCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const coupon = await api.getCoupon(parsePositiveInteger(id, "Coupon ID"));
      printCoupon(coupon, options.json);
    });

  const addMutationOptions = (command: Command): Command =>
    command
      .option("--profile <name>", "Halo profile name")
      .option("--json", "Output JSON")
      .option("--file <path>", "Read a CouponRequest JSON file, use - for stdin")
      .option("--stdin", "Read a CouponRequest JSON payload from stdin")
      .option("--name <name>", "Coupon name")
      .option("--description <text>", "Coupon description")
      .option("--calculation-type <type>", "AMOUNT or PERCENTAGE")
      .option("--discount-value <number>", "Discount value")
      .option("--max-discount-amount <number>", "Maximum discount amount")
      .option("--scope <scope>", "ALL or QUALIFYING_ITEMS")
      .option("--qualifying-product-ids <ids>", "Comma separated product IDs")
      .option("--qualifying-category-ids <ids>", "Comma separated category IDs")
      .option("--excluded-product-ids <ids>", "Comma separated product IDs")
      .option("--excluded-category-ids <ids>", "Comma separated category IDs")
      .option("--exclude-sale-items <boolean>", "Exclude sale items")
      .option("--min-order-amount <number>", "Minimum order amount")
      .option("--total-count <number>", "Total issue count")
      .option("--per-customer-limit <number>", "Per-customer limit")
      .option("--enabled <boolean>", "Whether the coupon is enabled")
      .option("--starts-at <instant>", "Start time (ISO-8601)")
      .option("--ends-at <instant>", "End time (ISO-8601)")
      .option("--valid-days <number>", "Valid days after claiming")
      .option("--combine-with-coupons <boolean>", "Allow combining with coupons")
      .option("--combine-with-order-discount <boolean>", "Allow combining with order discounts");

  addMutationOptions(couponCli.command("create", "Create a coupon")).action(
    async (options: CouponMutationOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const payload: Record<string, unknown> = {
        ...(await readJsonPayload(options)),
        ...buildCouponPatch(options),
      };
      const request = payload as unknown as CouponRequest;
      validateCouponRequest(request);
      normalizeCouponRequest(request);
      const coupon = await api.createCoupon(request);

      if (options.json) {
        printJson(coupon);
        return;
      }

      process.stdout.write(`Created coupon ${coupon.id} (${coupon.name}).\n`);
    },
  );

  addMutationOptions(couponCli.command("update <id>", "Update a coupon"))
    .option("--force", "Disable the coupon without confirmation")
    .action(async (id: string, options: CouponMutationOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const couponId = parsePositiveInteger(id, "Coupon ID");
      const current = await api.getCoupon(couponId);
      const payload = mergeDefined(couponToRequest(current) as unknown as Record<string, unknown>, {
        ...(await readJsonPayload(options)),
        ...buildCouponPatch(options),
      });
      const request = payload as unknown as CouponRequest;
      validateCouponRequest(request);
      normalizeCouponRequest(request);

      if (current.isEnabled === true && request.isEnabled === false) {
        if (
          !(await confirmDangerousAction(
            {
              commandPath: "halo shop coupon update",
              actionLabel: "Disable",
              resourceLabel: "coupon",
              resourceName: String(couponId),
              cancellationVerb: "disabling",
            },
            options,
          ))
        ) {
          return;
        }
      }

      const coupon = await api.updateCoupon(couponId, request);

      if (options.json) {
        printJson(coupon);
        return;
      }

      process.stdout.write(`Updated coupon ${coupon.id} (${coupon.name}).\n`);
    });

  couponCli
    .command("delete <id>", "Delete a coupon")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--force", "Delete without confirmation")
    .action(async (id: string, options: CouponDeleteOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const couponId = parsePositiveInteger(id, "Coupon ID");

      if (
        !(await confirmDangerousAction(
          {
            commandPath: "halo shop coupon delete",
            actionLabel: "Delete",
            resourceLabel: "coupon",
            resourceName: String(couponId),
            cancellationVerb: "deleting",
          },
          options,
        ))
      ) {
        return;
      }

      const api = new ShopApi(clients.axios);
      await api.deleteCoupon(couponId);

      if (options.json) {
        printJson({ deleted: true, id: couponId });
        return;
      }

      process.stdout.write(`Deleted coupon ${couponId}.\n`);
    });

  couponCli
    .command("distribute <id>", "Distribute a coupon to customers")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--all", "Distribute to all customers")
    .option("--username <usernames>", "Comma separated usernames, repeatable")
    .option("--force", "Distribute to all customers without confirmation")
    .action(async (id: string, options: CouponDistributeOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const couponId = parsePositiveInteger(id, "Coupon ID");
      const usernames = toStringArray(options.username)
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean);

      if (options.all && usernames.length > 0) {
        throw new CliError("Use either --all or --username, not both.");
      }
      if (!options.all && usernames.length === 0) {
        throw new CliError("Provide --all or at least one --username.");
      }

      if (
        options.all &&
        !(await confirmDangerousAction(
          {
            commandPath: "halo shop coupon distribute",
            actionLabel: "Distribute",
            resourceLabel: "coupon",
            resourceName: `${couponId} to all customers`,
            cancellationVerb: "distributing",
          },
          options,
        ))
      ) {
        return;
      }

      const api = new ShopApi(clients.axios);
      const result = await api.distributeCoupon(couponId, {
        allCustomers: Boolean(options.all),
        usernames: usernames.length > 0 ? usernames : undefined,
      });

      if (options.json) {
        printJson(result ?? { id: couponId, distributionScheduled: true });
        return;
      }

      process.stdout.write(`Scheduled coupon ${couponId} distribution.\n`);
    });

  couponCli.usage("<command> [flags]");
  couponCli.example((bin) => `${bin} list --enabled true`);
  couponCli.example((bin) => `${bin} get 1`);
  couponCli.example(
    (bin) =>
      `${bin} create --name "Spring sale" --calculation-type PERCENTAGE --discount-value 10 --scope ALL --valid-days 30`,
  );
  couponCli.example((bin) => `${bin} distribute 1 --username demo`);
  couponCli.example((bin) => `${bin} delete 1 --force`);
  couponCli.help();

  return couponCli;
}
