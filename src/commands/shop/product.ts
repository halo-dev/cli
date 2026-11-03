import { type CAC } from "cac";

import { resolvePermalinkUrl } from "../../utils/browser.js";
import { confirmDangerousAction } from "../../utils/confirmation.js";
import { CliError } from "../../utils/errors.js";
import { parseBooleanOption } from "../../utils/options.js";
import { printJson } from "../../utils/output.js";
import { RuntimeContext } from "../../utils/runtime.js";
import { ShopApi } from "./api.js";
import { createShopCli } from "./cli.js";
import { printProduct, printProductList } from "./format.js";
import {
  hasAnyOption,
  mergeDefined,
  parseEnumListOption,
  parseEnumOption,
  parseMoneyOption,
  parsePageOption,
  parsePositiveInteger,
  parseSizeOption,
  readJsonPayload,
  requireString,
  type JsonInputOptions,
} from "./input.js";
import type { Product, ProductRequest, ProductStatus, ProductVariant } from "./types.js";

const PRODUCT_TYPES = ["PHYSICAL", "VIRTUAL", "EXTERNAL", "SUBSCRIPTION"] as const;
const PRODUCT_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
const PRICING_TYPES = ["FIXED", "INQUIRY"] as const;
const VARIANT_PATCH_OPTIONS = [
  "variant",
  "price",
  "originalPrice",
  "stock",
  "sku",
  "barcode",
  "variantStatus",
  "shippingRequired",
  "trackInventory",
];

interface ShopCommandOptions {
  profile?: string;
  json?: boolean;
}

interface ProductListOptions extends ShopCommandOptions {
  page?: string;
  size?: string;
  keyword?: string;
  category?: string;
  status?: string;
  type?: string;
  sort?: string;
}

interface ProductMutationOptions extends ShopCommandOptions, JsonInputOptions {
  title?: string;
  handle?: string;
  description?: string;
  category?: string;
  type?: string;
  status?: string;
  content?: string;
  images?: string;
  cover?: string;
  externalUrl?: string;
  externalButtonText?: string;
  variant?: string;
  price?: string;
  originalPrice?: string;
  stock?: string;
  sku?: string;
  barcode?: string;
  variantStatus?: string;
  shippingRequired?: string;
  trackInventory?: string;
  force?: boolean;
}

interface ProductDeleteOptions extends ShopCommandOptions {
  force?: boolean;
}

interface ProductUnpublishOptions extends ShopCommandOptions {
  force?: boolean;
}

function parseStock(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value.trim().length === 0) {
    throw new CliError("--stock requires a non-empty value.");
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new CliError(`--stock must be a non-negative integer, got "${value}".`);
  }
  return parsed;
}

function buildVariantPatch(options: ProductMutationOptions): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  const price = parseMoneyOption(options.price, "--price");
  if (price !== undefined) patch.price = price;

  const originalPrice = parseMoneyOption(options.originalPrice, "--original-price");
  if (originalPrice !== undefined) patch.originalPrice = originalPrice;

  const stock = parseStock(options.stock);
  if (stock !== undefined) {
    patch.stock = stock;
    patch.trackInventory = parseBooleanOption(options.trackInventory) ?? true;
  } else if (options.trackInventory !== undefined) {
    patch.trackInventory = parseBooleanOption(options.trackInventory);
  }

  if (options.sku !== undefined) patch.skuCode = options.sku;
  if (options.barcode !== undefined) patch.barcode = options.barcode;

  const variantStatus = parseEnumOption(
    options.variantStatus,
    PRODUCT_STATUSES,
    "--variant-status",
  );
  if (variantStatus !== undefined) patch.status = variantStatus;

  if (options.shippingRequired !== undefined) {
    patch.shippingRequired = parseBooleanOption(options.shippingRequired);
  }

  return patch;
}

function hasVariantPatch(options: ProductMutationOptions): boolean {
  return hasAnyOption(options as unknown as Record<string, unknown>, VARIANT_PATCH_OPTIONS);
}

function variantToRequest(variant: ProductVariant): ProductVariant {
  return {
    id: variant.id,
    specValues: variant.specValues,
    price: variant.price,
    originalPrice: variant.originalPrice,
    pricingType: variant.pricingType,
    trackInventory: variant.trackInventory,
    stock: variant.stock ?? 0,
    maxPerOrder: variant.maxPerOrder,
    maxPerUser: variant.maxPerUser,
    skuCode: variant.skuCode,
    barcode: variant.barcode,
    shippingProfileId: variant.shippingProfileId,
    shippingRequired: variant.shippingRequired,
    weightG: variant.weightG,
    lengthMm: variant.lengthMm,
    widthMm: variant.widthMm,
    heightMm: variant.heightMm,
    imageUrl: variant.imageUrl,
    status: variant.status ?? "DRAFT",
  };
}

function productToRequest(product: Product): ProductRequest {
  return {
    title: product.title,
    productType: product.productType,
    status: product.status,
    handle: product.handle,
    description: product.description,
    categoryId: product.categoryId,
    externalLinkUrl: product.externalLinkUrl,
    externalLinkButtonText: product.externalLinkButtonText,
    content: product.content,
    images: product.images,
    specDefinition: product.specDefinition,
    productVariants:
      product.productType === "SUBSCRIPTION"
        ? undefined
        : product.productVariants?.map(variantToRequest),
  };
}

function buildProductFlagPatch(options: ProductMutationOptions): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (options.title !== undefined) patch.title = options.title;
  if (options.handle !== undefined) patch.handle = options.handle;
  if (options.description !== undefined) patch.description = options.description;
  if (options.content !== undefined) patch.content = options.content;

  if (options.category !== undefined) {
    patch.categoryId = parsePositiveInteger(options.category, "--category");
  }

  const productType = parseEnumOption(options.type, PRODUCT_TYPES, "--type");
  if (productType !== undefined) patch.productType = productType;

  const status = parseEnumOption(options.status, PRODUCT_STATUSES, "--status");
  if (status !== undefined) patch.status = status;

  if (options.externalUrl !== undefined) patch.externalLinkUrl = options.externalUrl;
  if (options.externalButtonText !== undefined) {
    patch.externalLinkButtonText = options.externalButtonText;
  }

  if (options.images !== undefined) {
    patch.images = options.images
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return patch;
}

function applyCover(payload: Record<string, unknown>, options: ProductMutationOptions): void {
  if (options.cover === undefined) {
    return;
  }

  const existingImages = Array.isArray(payload.images) ? [...payload.images] : [];
  if (existingImages.length === 0) {
    payload.images = [options.cover];
    return;
  }

  existingImages[0] = options.cover;
  payload.images = existingImages;
}

function parseVariantNumber(value: unknown, label: string, integer = false): number {
  const parsed = typeof value === "string" && value.trim().length > 0 ? Number(value) : value;
  if (
    typeof parsed !== "number" ||
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    (integer && !Number.isInteger(parsed))
  ) {
    throw new CliError(
      `${label} must be a non-negative ${integer ? "integer" : "number"}, got "${String(value)}".`,
    );
  }
  return parsed;
}

function normalizeVariants(payload: Record<string, unknown>, current?: Product): void {
  const variants = payload.productVariants;
  if (variants === undefined || variants === null) {
    return;
  }
  if (!Array.isArray(variants)) {
    throw new CliError("productVariants must be an array.");
  }

  const currentStatusById = new Map(
    (current?.productVariants ?? []).flatMap((variant) =>
      variant.id === undefined ? [] : [[variant.id, variant.status] as const],
    ),
  );

  for (const variant of variants as (ProductVariant | null)[]) {
    if (!variant || typeof variant !== "object" || Array.isArray(variant)) {
      throw new CliError("Product variants must be objects.");
    }

    const variantLabel = `Variant ${variant.id ?? "(new)"}`;
    if (variant.price != null) {
      variant.price = parseVariantNumber(variant.price, `${variantLabel} price`);
    }
    if (variant.originalPrice != null) {
      variant.originalPrice = parseVariantNumber(
        variant.originalPrice,
        `${variantLabel} originalPrice`,
      );
    }
    if (variant.stock != null) {
      variant.stock = parseVariantNumber(variant.stock, `${variantLabel} stock`, true);
    }

    const pricingType =
      variant.pricingType == null
        ? "FIXED"
        : parseEnumOption(variant.pricingType, PRICING_TYPES, "variant pricingType");
    variant.pricingType = pricingType;

    if (pricingType === "FIXED" && variant.price == null) {
      throw new CliError(
        `${variantLabel} requires a price for FIXED pricing. Use --price or set price in --file.`,
      );
    }

    const status =
      variant.status == null
        ? undefined
        : parseEnumOption(variant.status, PRODUCT_STATUSES, "variant status");
    variant.status =
      status ??
      (variant.id === undefined ? undefined : currentStatusById.get(variant.id)) ??
      "DRAFT";
  }
}

function validateVariantOwnership(payload: Record<string, unknown>, current: Product): void {
  if (!Array.isArray(payload.productVariants)) {
    return;
  }

  const currentIds = new Set(
    (current.productVariants ?? []).flatMap((variant) =>
      variant.id === undefined ? [] : [variant.id],
    ),
  );
  const seen = new Set<number>();

  for (const variant of payload.productVariants as ProductVariant[]) {
    if (variant.id == null) {
      continue;
    }

    if (!currentIds.has(variant.id)) {
      throw new CliError(`Variant ${variant.id} was not found on this product.`);
    }
    if (seen.has(variant.id)) {
      throw new CliError(`Variant ${variant.id} was provided multiple times.`);
    }
    seen.add(variant.id);
  }
}

function applyVariantFlagsToProduct(
  payload: Record<string, unknown>,
  options: ProductMutationOptions,
  variantOptionSupported: boolean,
): void {
  if (!hasVariantPatch(options)) {
    return;
  }

  if (payload.productType === "SUBSCRIPTION") {
    throw new CliError(
      "Subscription product variants are managed by subscription plan APIs and are not supported by this command.",
    );
  }

  if (payload.productType === "EXTERNAL") {
    throw new CliError("External products do not support product variants.");
  }

  const variantPatch = buildVariantPatch(options);
  const variants = Array.isArray(payload.productVariants)
    ? ([...payload.productVariants] as ProductVariant[])
    : [];

  let target: ProductVariant;
  if (options.variant !== undefined) {
    const variantId = parsePositiveInteger(options.variant, "--variant");
    const found = variants.find((variant) => variant.id === variantId);
    if (!found) {
      throw new CliError(`Variant ${variantId} was not found on this product.`);
    }
    target = found;
  } else if (variants.length === 1) {
    target = variants[0] as ProductVariant;
  } else if (variants.length === 0) {
    if (variantPatch.price === undefined) {
      throw new CliError("--price is required when adding the first product variant.");
    }
    target = { price: variantPatch.price as number };
    variants.push(target);
  } else {
    throw new CliError(
      variantOptionSupported
        ? "This product has multiple variants. Use --variant <id> to choose one, or use --file to edit variants."
        : "This product has multiple variants. Use --file to edit variants.",
    );
  }

  Object.assign(target, variantPatch);
  payload.productVariants = variants;
}

async function buildCreateRequest(options: ProductMutationOptions): Promise<ProductRequest> {
  const filePayload = (await readJsonPayload(options)) ?? {};
  const payload: Record<string, unknown> = { ...filePayload };

  Object.assign(payload, buildProductFlagPatch(options));
  applyCover(payload, options);

  payload.productType ??= "PHYSICAL";
  payload.status ??= "DRAFT";

  const request = payload as unknown as ProductRequest;
  request.title = requireString(request.title, "Product title is required. Use --title or --file.");

  if (!PRODUCT_TYPES.includes(request.productType)) {
    throw new CliError(`Invalid product type "${request.productType}".`);
  }
  if (!PRODUCT_STATUSES.includes(request.status)) {
    throw new CliError(`Invalid product status "${request.status}".`);
  }
  if (
    request.productType !== "EXTERNAL" &&
    (request.externalLinkUrl != null || request.externalLinkButtonText != null)
  ) {
    throw new CliError("External link fields are only supported for EXTERNAL products.");
  }
  if (payload.productVariants != null && !Array.isArray(payload.productVariants)) {
    throw new CliError("productVariants must be an array.");
  }

  if (hasVariantPatch(options)) {
    applyVariantFlagsToProduct(payload, options, false);
  }

  normalizeVariants(payload);
  return request;
}

interface ProductUpdateChanges {
  basicInfo: boolean;
  content: boolean;
  status: boolean;
  specifications: boolean;
}

function hasOwn(payload: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(payload, key);
}

function detectProductUpdateChanges(
  filePayload: Record<string, unknown>,
  options: ProductMutationOptions,
): ProductUpdateChanges {
  return {
    basicInfo:
      hasOwn(filePayload, "title") ||
      hasOwn(filePayload, "handle") ||
      hasOwn(filePayload, "description") ||
      hasOwn(filePayload, "categoryId") ||
      options.title !== undefined ||
      options.handle !== undefined ||
      options.description !== undefined ||
      options.category !== undefined,
    content:
      hasOwn(filePayload, "content") ||
      hasOwn(filePayload, "images") ||
      options.content !== undefined ||
      options.images !== undefined ||
      options.cover !== undefined,
    status: hasOwn(filePayload, "status") || options.status !== undefined,
    specifications:
      hasOwn(filePayload, "specDefinition") ||
      hasOwn(filePayload, "productVariants") ||
      hasVariantPatch(options),
  };
}

function mergeVariantsWithCurrent(payload: Record<string, unknown>, current: Product): void {
  const variants = payload.productVariants;
  if (!Array.isArray(variants)) {
    return;
  }

  const currentById = new Map(
    (current.productVariants ?? []).flatMap((variant) =>
      variant.id === undefined ? [] : [[variant.id, variant] as const],
    ),
  );

  payload.productVariants = variants.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return value;
    }

    const variant = value as ProductVariant;
    if (variant.id == null) {
      return variant;
    }

    const existing = currentById.get(variant.id);
    return existing === undefined ? variant : { ...variantToRequest(existing), ...variant };
  });
}

interface ProductUpdatePlan {
  request: ProductRequest;
  changes: ProductUpdateChanges;
}

function buildUpdateRequestFrom(
  current: Product,
  filePayload: Record<string, unknown>,
  options: ProductMutationOptions,
): ProductUpdatePlan {
  const payload = mergeDefined(
    productToRequest(current) as unknown as Record<string, unknown>,
    filePayload,
  );

  Object.assign(payload, buildProductFlagPatch(options));
  applyCover(payload, options);

  if (payload.productVariants === null) {
    payload.productVariants = [];
  }
  if (payload.productVariants != null && !Array.isArray(payload.productVariants)) {
    throw new CliError("productVariants must be an array.");
  }

  if (payload.productType !== current.productType) {
    throw new CliError(`Product type cannot be changed (current: ${current.productType}).`);
  }

  if (!PRODUCT_STATUSES.includes(payload.status as ProductStatus)) {
    throw new CliError(`Invalid product status "${String(payload.status)}".`);
  }

  const hasExternalFields =
    hasOwn(filePayload, "externalLinkUrl") ||
    hasOwn(filePayload, "externalLinkButtonText") ||
    options.externalUrl !== undefined ||
    options.externalButtonText !== undefined;
  if (hasExternalFields && payload.productType !== "EXTERNAL") {
    throw new CliError("External link fields are only supported for EXTERNAL products.");
  }

  mergeVariantsWithCurrent(payload, current);

  if (hasVariantPatch(options)) {
    applyVariantFlagsToProduct(payload, options, true);
  }

  normalizeVariants(payload, current);
  validateVariantOwnership(payload, current);
  return {
    request: payload as unknown as ProductRequest,
    changes: detectProductUpdateChanges(filePayload, options),
  };
}

async function buildUpdateRequest(
  api: ShopApi,
  id: number,
  options: ProductMutationOptions,
): Promise<{
  current: Product;
  filePayload: Record<string, unknown>;
  plan: ProductUpdatePlan;
}> {
  const filePayload = (await readJsonPayload(options)) ?? {};
  const current = await api.getProduct(id);
  return {
    current,
    filePayload,
    plan: buildUpdateRequestFrom(current, filePayload, options),
  };
}

interface ProductUpdateDanger {
  unpublish: boolean;
  disabledVariantIds: number[];
}

function detectProductUpdateDanger(current: Product, request: ProductRequest): ProductUpdateDanger {
  return {
    unpublish: current.status === "PUBLISHED" && request.status !== "PUBLISHED",
    disabledVariantIds:
      current.status === "PUBLISHED" && request.status === "PUBLISHED"
        ? findDisabledVariantIds(current, request)
        : [],
  };
}

async function confirmProductUpdateDanger(
  danger: ProductUpdateDanger,
  options: ProductMutationOptions,
  productId: number,
): Promise<boolean> {
  if (danger.unpublish) {
    if (
      !(await confirmDangerousAction(
        {
          commandPath: "halo shop product update",
          actionLabel: "Unpublish",
          resourceLabel: "product",
          resourceName: String(productId),
          cancellationVerb: "unpublishing",
        },
        options,
      ))
    ) {
      return false;
    }
  }

  if (danger.disabledVariantIds.length > 0) {
    if (
      !(await confirmDangerousAction(
        {
          commandPath: "halo shop product update",
          actionLabel: "Disable",
          resourceLabel: "variants of product",
          resourceName: `${productId}: ${danger.disabledVariantIds.join(", ")}`,
          cancellationVerb: "disabling",
        },
        options,
      ))
    ) {
      return false;
    }
  }

  return true;
}

function hasProductUpdateDanger(danger: ProductUpdateDanger): boolean {
  return danger.unpublish || danger.disabledVariantIds.length > 0;
}

function newProductUpdateDanger(
  previous: ProductUpdateDanger,
  next: ProductUpdateDanger,
): ProductUpdateDanger {
  return {
    unpublish: next.unpublish && !previous.unpublish,
    disabledVariantIds: next.disabledVariantIds.filter(
      (id) => !previous.disabledVariantIds.includes(id),
    ),
  };
}

function mergeProductUpdateDanger(
  previous: ProductUpdateDanger,
  next: ProductUpdateDanger,
): ProductUpdateDanger {
  return {
    unpublish: previous.unpublish || next.unpublish,
    disabledVariantIds: [...new Set([...previous.disabledVariantIds, ...next.disabledVariantIds])],
  };
}

function findDisabledVariantIds(current: Product, request: ProductRequest): number[] {
  if (current.productType === "SUBSCRIPTION") {
    return [];
  }

  const requestedVariants = request.productVariants;
  if (!Array.isArray(requestedVariants)) {
    return [];
  }

  const nextStatus = new Map(
    requestedVariants.flatMap((variant) =>
      variant.id === undefined ? [] : [[variant.id, variant.status] as const],
    ),
  );

  return (current.productVariants ?? []).flatMap((variant) => {
    if (variant.id === undefined || variant.status !== "PUBLISHED") {
      return [];
    }

    if (!nextStatus.has(variant.id)) {
      return [variant.id];
    }

    const status = nextStatus.get(variant.id);
    return status === "DRAFT" || status === "ARCHIVED" ? [variant.id] : [];
  });
}

function reportProduct(
  product: Product,
  action: "Created" | "Updated",
  baseUrl: string,
  json = false,
): void {
  if (json) {
    printJson(product);
    return;
  }

  process.stdout.write(`${action} product ${product.id} (${product.title}).\n`);
  if (product.permalink) {
    process.stdout.write(
      `permalink: ${resolvePermalinkUrl(baseUrl, product.permalink, "Product")}\n`,
    );
  }
  process.stdout.write(`inspect: halo shop product get ${product.id}\n`);
}

export function buildProductCli(runtime: RuntimeContext): CAC {
  const productCli = createShopCli("halo shop product");

  productCli
    .command("list", "List products")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number", { default: 1 })
    .option("--size <number>", "Page size", { default: 20 })
    .option("--keyword <keyword>", "Filter by keyword")
    .option("--category <id>", "Filter by category ID")
    .option("--status <items>", "Comma separated statuses: DRAFT, PUBLISHED, ARCHIVED")
    .option("--type <items>", "Comma separated types: PHYSICAL, VIRTUAL, EXTERNAL, SUBSCRIPTION")
    .option("--sort <sort>", "Sort expression, e.g. id,desc")
    .action(async (options: ProductListOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const page = await api.listProducts({
        page: parsePageOption(options.page),
        size: parseSizeOption(options.size),
        keyword: options.keyword,
        categoryId:
          options.category === undefined
            ? undefined
            : parsePositiveInteger(options.category, "--category"),
        statuses: parseEnumListOption(options.status, PRODUCT_STATUSES, "--status"),
        types: parseEnumListOption(options.type, PRODUCT_TYPES, "--type"),
        sort: options.sort,
      });
      printProductList(page, options.json);
    });

  productCli
    .command("get <id>", "Show product details")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (id: string, options: ShopCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const product = await api.getProduct(parsePositiveInteger(id, "Product ID"));
      printProduct(product, options.json);
    });

  productCli
    .command("create", "Create a product")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--file <path>", "Read a ProductRequest JSON file, use - for stdin")
    .option("--stdin", "Read a ProductRequest JSON payload from stdin")
    .option("--title <title>", "Product title")
    .option("--handle <handle>", "Product handle")
    .option("--description <text>", "Short description")
    .option("--category <id>", "Category ID")
    .option("--type <type>", "PHYSICAL, VIRTUAL, EXTERNAL, or SUBSCRIPTION")
    .option("--status <status>", "DRAFT, PUBLISHED, or ARCHIVED")
    .option("--content <content>", "Product content")
    .option("--images <urls>", "Comma separated image URLs")
    .option("--cover <url>", "Cover image URL")
    .option("--external-url <url>", "External link URL for EXTERNAL products")
    .option("--external-button-text <text>", "External link button text")
    .option("--price <number>", "Create or update the first variant price")
    .option("--original-price <number>", "Variant original price")
    .option("--stock <number>", "Variant stock")
    .option("--sku <sku>", "Variant SKU code")
    .option("--barcode <barcode>", "Variant barcode")
    .option("--variant-status <status>", "Variant status: DRAFT, PUBLISHED, or ARCHIVED")
    .option("--shipping-required <boolean>", "Whether the variant requires shipping")
    .option("--track-inventory <boolean>", "Whether the variant tracks inventory")
    .action(async (options: ProductMutationOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const request = await buildCreateRequest(options);
      const product = await api.createProduct(request);
      reportProduct(product, "Created", profile.baseUrl, options.json);
    });

  productCli
    .command("update <id>", "Update a product")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--file <path>", "Read a partial ProductRequest JSON file, use - for stdin")
    .option("--stdin", "Read a partial ProductRequest JSON payload from stdin")
    .option("--title <title>", "Product title")
    .option("--handle <handle>", "Product handle")
    .option("--description <text>", "Short description")
    .option("--category <id>", "Category ID")
    .option("--status <status>", "DRAFT, PUBLISHED, or ARCHIVED")
    .option("--content <content>", "Product content")
    .option("--images <urls>", "Comma separated image URLs")
    .option("--cover <url>", "Cover image URL")
    .option("--external-url <url>", "External link URL for EXTERNAL products")
    .option("--external-button-text <text>", "External link button text")
    .option("--variant <id>", "Variant ID to edit")
    .option("--price <number>", "Variant price")
    .option("--original-price <number>", "Variant original price")
    .option("--stock <number>", "Variant stock")
    .option("--sku <sku>", "Variant SKU code")
    .option("--barcode <barcode>", "Variant barcode")
    .option("--variant-status <status>", "Variant status: DRAFT, PUBLISHED, or ARCHIVED")
    .option("--shipping-required <boolean>", "Whether the variant requires shipping")
    .option("--track-inventory <boolean>", "Whether the variant tracks inventory")
    .option("--force", "Unpublish, archive, or disable variants without confirmation")
    .action(async (id: string, options: ProductMutationOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const productId = parsePositiveInteger(id, "Product ID");
      const { current, filePayload, plan } = await buildUpdateRequest(api, productId, options);
      let { request, changes } = plan;
      const initialDanger = detectProductUpdateDanger(current, request);
      let confirmedDanger = initialDanger;

      if (!(await confirmProductUpdateDanger(confirmedDanger, options, productId))) {
        return;
      }

      let refreshPending = changes.specifications;
      while (refreshPending || hasProductUpdateDanger(confirmedDanger)) {
        refreshPending = false;
        const refreshedCurrent = await api.getProduct(productId);
        const refreshedPlan = buildUpdateRequestFrom(refreshedCurrent, filePayload, options);
        const refreshedDanger = detectProductUpdateDanger(refreshedCurrent, refreshedPlan.request);
        const newDanger = newProductUpdateDanger(confirmedDanger, refreshedDanger);

        if (!hasProductUpdateDanger(newDanger)) {
          request = refreshedPlan.request;
          changes = refreshedPlan.changes;
          break;
        }

        if (!(await confirmProductUpdateDanger(newDanger, options, productId))) {
          return;
        }
        confirmedDanger = mergeProductUpdateDanger(confirmedDanger, newDanger);
      }

      let product: Product;
      if (request.productType === "PHYSICAL" || request.productType === "VIRTUAL") {
        let updated: Product | undefined;
        const appliedDomains: string[] = [];
        let failedDomain = "";

        try {
          if (changes.basicInfo) {
            failedDomain = "basic-info";
            updated = await api.updateProductBasicInfo(productId, {
              title: request.title,
              handle: request.handle,
              description: request.description,
              categoryId: request.categoryId,
            });
            appliedDomains.push("basic-info");
          }
          if (changes.content) {
            failedDomain = "content";
            updated = await api.updateProductContent(productId, {
              content: request.content,
              images: request.images,
            });
            appliedDomains.push("content");
          }
          if (changes.specifications) {
            failedDomain = "specifications";
            updated = await api.updateProductSpecifications(productId, {
              specDefinition: request.specDefinition,
              productVariants: request.productVariants,
            });
            appliedDomains.push("specifications");
          }
          if (changes.status) {
            failedDomain = "status";
            updated = await api.updateProductStatus(productId, request.status);
            appliedDomains.push("status");
          }
        } catch (error) {
          const applied = appliedDomains.length > 0 ? appliedDomains.join(", ") : "none";
          process.stderr.write(
            `Product ${productId} update failed during ${failedDomain}. Applied domains: ${applied}. The failed domain may have been partially applied; re-read the product before retrying. Remaining domains were not sent.\n`,
          );
          throw error;
        }

        if (updated === undefined) {
          throw new CliError(
            "No product changes were provided. Use --file or at least one update flag.",
          );
        }
        product = updated;
      } else {
        const latestCurrent = await api.getProduct(productId);
        const latestPlan = buildUpdateRequestFrom(latestCurrent, filePayload, options);
        const latestDanger = detectProductUpdateDanger(latestCurrent, latestPlan.request);
        if (hasProductUpdateDanger(newProductUpdateDanger(confirmedDanger, latestDanger))) {
          throw new CliError(
            "The product changed while preparing the update. Re-run the command to review the new changes.",
          );
        }
        request = latestPlan.request;
        changes = latestPlan.changes;
        product = await api.updateProduct(productId, request);
      }

      reportProduct(product, "Updated", profile.baseUrl, options.json);
    });

  productCli
    .command("publish <id>", "Publish a product")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (id: string, options: ShopCommandOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const product = await api.updateProductStatus(
        parsePositiveInteger(id, "Product ID"),
        "PUBLISHED",
      );
      reportProduct(product, "Updated", profile.baseUrl, options.json);
    });

  productCli
    .command("unpublish <id>", "Move a product back to draft")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--force", "Unpublish without confirmation")
    .action(async (id: string, options: ProductUnpublishOptions) => {
      const productId = parsePositiveInteger(id, "Product ID");

      if (
        !(await confirmDangerousAction(
          {
            commandPath: "halo shop product unpublish",
            actionLabel: "Unpublish",
            resourceLabel: "product",
            resourceName: String(productId),
            cancellationVerb: "unpublishing",
          },
          options,
        ))
      ) {
        return;
      }

      const { profile, clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const product = await api.updateProductStatus(productId, "DRAFT");
      reportProduct(product, "Updated", profile.baseUrl, options.json);
    });

  productCli
    .command("delete <id>", "Delete a product")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--force", "Delete without confirmation")
    .action(async (id: string, options: ProductDeleteOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const productId = parsePositiveInteger(id, "Product ID");

      if (
        !(await confirmDangerousAction(
          {
            commandPath: "halo shop product delete",
            actionLabel: "Delete",
            resourceLabel: "product",
            resourceName: String(productId),
            cancellationVerb: "deleting",
          },
          options,
        ))
      ) {
        return;
      }

      const api = new ShopApi(clients.axios);
      await api.deleteProduct(productId);

      if (options.json) {
        printJson({ deleted: true, id: productId });
        return;
      }

      process.stdout.write(`Deleted product ${productId}.\n`);
    });

  productCli.usage("<command> [flags]");
  productCli.example((bin) => `${bin} list --status DRAFT,PUBLISHED`);
  productCli.example((bin) => `${bin} get 1`);
  productCli.example((bin) => `${bin} create --title "Example" --type VIRTUAL --price 9.9`);
  productCli.example((bin) => `${bin} update 1 --file product.json`);
  productCli.example((bin) => `${bin} publish 1`);
  productCli.example((bin) => `${bin} delete 1 --force`);
  productCli.help();

  return productCli;
}
