import { type CAC } from "cac";

import { confirmDangerousAction } from "../../utils/confirmation.js";
import { CliError } from "../../utils/errors.js";
import { parseBooleanOption } from "../../utils/options.js";
import { printJson } from "../../utils/output.js";
import { RuntimeContext } from "../../utils/runtime.js";
import { ShopApi } from "./api.js";
import { createShopCli } from "./cli.js";
import { printOrder, printOrderList } from "./format.js";
import {
  parseEnumListOption,
  parseEnumOption,
  parseInstantOption,
  parseMoneyOption,
  parsePageOption,
  parsePositiveInteger,
  parseSizeOption,
  readJsonPayload,
  requireString,
  toStringArray,
  type JsonInputOptions,
} from "./input.js";
import type {
  FulfillmentItemRequest,
  FulfillmentRequest,
  Order,
  OrderCreateItem,
  OrderCreateRequest,
} from "./types.js";

const ORDER_STATUSES = ["OPEN", "ARCHIVED", "CANCELLED"] as const;
const PAYMENT_STATUSES = [
  "PENDING",
  "AUTHORIZING",
  "PAID",
  "REFUNDED",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
] as const;
const FULFILLMENT_STATUSES = ["PENDING", "PROCESSING", "FULFILLED"] as const;
const REFUND_STATUSES = ["NONE", "PARTIAL", "FULL"] as const;
const FULFILLMENT_PROVIDERS = ["MANUAL"] as const;

interface ShopCommandOptions {
  profile?: string;
  json?: boolean;
}

interface OrderListOptions extends ShopCommandOptions {
  page?: string;
  size?: string;
  keyword?: string;
  customer?: string;
  username?: string;
  orderCode?: string;
  status?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  refundStatus?: string;
  startDate?: string;
  endDate?: string;
  sort?: string;
}

interface OrderCreateOptions extends ShopCommandOptions, JsonInputOptions {
  username?: string;
  item?: string | string[];
  note?: string;
  trackInventory?: string;
}

interface OrderActionOptions extends ShopCommandOptions {
  force?: boolean;
}

interface OrderFulfillOptions extends ShopCommandOptions, JsonInputOptions {
  item?: string | string[];
  all?: boolean;
  provider?: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  labelUrl?: string;
  force?: boolean;
}

interface OrderNoteOptions extends ShopCommandOptions {
  message?: string;
  payload?: string;
}

function parseOrderItem(value: string): OrderCreateItem {
  const parts = value.split(":");
  if (parts.length !== 3) {
    throw new CliError(`Invalid --item "${value}". Expected <variantId>:<quantity>:<unitPrice>.`);
  }

  const [variantId, quantity, price] = parts as [string, string, string];
  const productVariantId = parsePositiveInteger(variantId, "Variant ID");
  const parsedQuantity = parsePositiveInteger(quantity, "Quantity");

  if (price.trim().length === 0) {
    throw new CliError(`Unit price is required in --item "${value}".`);
  }

  const customPrice = Number(price);

  if (!Number.isFinite(customPrice) || customPrice < 0) {
    throw new CliError(`Invalid unit price "${price}" in --item "${value}".`);
  }

  return {
    productVariantId,
    quantity: parsedQuantity,
    customPrice,
  };
}

function requireNumericInput(value: unknown, label: string): string | number {
  if (value === undefined || value === null) {
    throw new CliError(`${label} is required.`);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  throw new CliError(`${label} must be a number.`);
}

function normalizeOrderCreateItems(items: unknown): OrderCreateItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CliError(
      "At least one order item is required. Use --item <variantId>:<quantity>:<price> or --file.",
    );
  }

  return items.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new CliError(`Order item ${index + 1} must be an object.`);
    }

    const item = value as Record<string, unknown>;
    const productVariantId = parsePositiveInteger(
      requireNumericInput(item.productVariantId, `items[${index}].productVariantId`),
      `items[${index}].productVariantId`,
    );
    const quantity = parsePositiveInteger(
      requireNumericInput(item.quantity, `items[${index}].quantity`),
      `items[${index}].quantity`,
    );
    const customPrice = parseMoneyOption(
      requireNumericInput(item.customPrice, `items[${index}].customPrice`),
      `items[${index}].customPrice`,
    );

    if (customPrice === undefined) {
      throw new CliError(`items[${index}].customPrice is required.`);
    }

    let subscriptionTrial: boolean | undefined;
    if (item.subscriptionTrial !== undefined && item.subscriptionTrial !== null) {
      subscriptionTrial = parseBooleanOption(item.subscriptionTrial);
      if (subscriptionTrial === undefined) {
        throw new CliError(`items[${index}].subscriptionTrial must be a boolean.`);
      }
    }

    return {
      productVariantId,
      quantity,
      customPrice,
      ...(subscriptionTrial === undefined ? {} : { subscriptionTrial }),
    };
  });
}

async function buildOrderCreateRequest(options: OrderCreateOptions): Promise<OrderCreateRequest> {
  const payload: Record<string, unknown> = {
    ...(await readJsonPayload(options)),
  };

  if (options.username !== undefined) payload.username = options.username;
  if (options.note !== undefined) payload.customerNotes = options.note;
  if (options.trackInventory !== undefined) {
    payload.trackInventory = parseBooleanOption(options.trackInventory);
  }

  const itemFlags = toStringArray(options.item).map(parseOrderItem);
  if (itemFlags.length > 0) {
    payload.items = itemFlags;
  }

  const request = payload as unknown as OrderCreateRequest;
  request.username = requireString(
    request.username,
    "Buyer username is required. Use --username or --file.",
  );
  request.items = normalizeOrderCreateItems(request.items);

  return request;
}

function resolveFulfillmentItems(order: Order): FulfillmentItemRequest[] {
  return (order.items ?? [])
    .filter((item) => item.subscriptionMetadata === undefined || item.subscriptionMetadata === null)
    .map((item) => ({
      orderItemId: item.id,
      quantity: item.quantity - (item.fulfilledQuantity ?? 0),
    }))
    .filter((item) => item.quantity > 0);
}

async function buildFulfillmentRequest(
  api: ShopApi,
  orderId: number,
  options: OrderFulfillOptions,
): Promise<FulfillmentRequest> {
  const filePayload = (await readJsonPayload(options)) ?? {};
  const payload: Record<string, unknown> = { items: [], ...filePayload };

  const itemFlags = toStringArray(options.item);
  if (itemFlags.length > 0) {
    payload.items = itemFlags.map((value) => {
      const parts = value.split(":");
      if (parts.length !== 2) {
        throw new CliError(`Invalid --item "${value}". Expected <orderItemId>:<quantity>.`);
      }
      const [orderItemId, quantity] = parts as [string, string];
      return {
        orderItemId: parsePositiveInteger(orderItemId, "Order item ID"),
        quantity: parsePositiveInteger(quantity, "Quantity"),
      };
    });
  } else if (options.all) {
    const order = await api.getOrder(orderId);
    const items = resolveFulfillmentItems(order);
    payload.items = items;
    if (items.length === 0) {
      const hasSubscriptionLine = (order.items ?? []).some(
        (item) => item.subscriptionMetadata !== undefined && item.subscriptionMetadata !== null,
      );
      throw new CliError(
        hasSubscriptionLine
          ? `Order ${orderId} has no manually fulfillable items. Subscription order lines are fulfilled by the integrator.`
          : `Order ${orderId} has no unfulfilled items.`,
      );
    }
  }

  const provider = parseEnumOption(options.provider, FULFILLMENT_PROVIDERS, "--provider");
  if (provider !== undefined) {
    payload.provider = provider;
  }

  const hasLabel = [
    options.carrier,
    options.trackingNumber,
    options.trackingUrl,
    options.labelUrl,
  ].some((value) => value !== undefined);
  if (hasLabel) {
    payload.labels = [
      {
        carrier: options.carrier,
        trackingNumber: options.trackingNumber,
        trackingUrl: options.trackingUrl,
        labelUrl: options.labelUrl,
      },
    ];
  }

  const request = payload as unknown as FulfillmentRequest;
  request.provider =
    request.provider == null
      ? undefined
      : parseEnumOption(request.provider as string, FULFILLMENT_PROVIDERS, "provider");
  if (!Array.isArray(request.items) || request.items.length === 0) {
    throw new CliError(
      "No fulfillment items provided. Use --item <orderItemId>:<quantity>, --all, or --file.",
    );
  }

  return request;
}

export function buildOrderCli(runtime: RuntimeContext): CAC {
  const orderCli = createShopCli("halo shop order");

  orderCli
    .command("list", "List orders")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number", { default: 1 })
    .option("--size <number>", "Page size", { default: 20 })
    .option("--keyword <keyword>", "Search keyword (order code)")
    .option("--customer <id>", "Filter by customer ID")
    .option("--username <username>", "Filter by buyer username")
    .option("--order-code <code>", "Filter by order code")
    .option("--status <items>", "Comma separated statuses: OPEN, ARCHIVED, CANCELLED")
    .option("--payment-status <items>", "Comma separated payment statuses")
    .option("--fulfillment-status <items>", "Comma separated fulfillment statuses")
    .option("--refund-status <items>", "Comma separated refund statuses")
    .option("--start-date <instant>", "Creation time lower bound (ISO-8601)")
    .option("--end-date <instant>", "Creation time upper bound (ISO-8601)")
    .option("--sort <sort>", "Sort expression, e.g. id,desc")
    .action(async (options: OrderListOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const page = await api.listOrders({
        page: parsePageOption(options.page),
        size: parseSizeOption(options.size),
        keyword: options.keyword ?? options.orderCode,
        customerId:
          options.customer === undefined
            ? undefined
            : parsePositiveInteger(options.customer, "--customer"),
        username: options.username,
        orderCode: options.orderCode,
        statuses: parseEnumListOption(options.status, ORDER_STATUSES, "--status"),
        paymentStatuses: parseEnumListOption(
          options.paymentStatus,
          PAYMENT_STATUSES,
          "--payment-status",
        ),
        fulfillmentStatuses: parseEnumListOption(
          options.fulfillmentStatus,
          FULFILLMENT_STATUSES,
          "--fulfillment-status",
        ),
        refundStatuses: parseEnumListOption(
          options.refundStatus,
          REFUND_STATUSES,
          "--refund-status",
        ),
        startDate: parseInstantOption(options.startDate, "--start-date"),
        endDate: parseInstantOption(options.endDate, "--end-date"),
        sort: options.sort,
      });
      printOrderList(page, options.json);
    });

  orderCli
    .command("get <id>", "Show order details")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (id: string, options: ShopCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const order = await api.getOrder(parsePositiveInteger(id, "Order ID"));
      printOrder(order, options.json);
    });

  orderCli
    .command("create", "Create an order as an administrator")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--file <path>", "Read an AdminOrderCreateRequest JSON file, use - for stdin")
    .option("--stdin", "Read an AdminOrderCreateRequest JSON payload from stdin")
    .option("--username <username>", "Buyer username")
    .option("--item <item>", "Order item as <variantId>:<quantity>:<unitPrice>, repeatable")
    .option("--note <text>", "Customer note")
    .option("--track-inventory <boolean>", "Whether to track inventory")
    .action(async (options: OrderCreateOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const request = await buildOrderCreateRequest(options);
      const order = await api.createOrder(request);

      if (options.json) {
        printJson(order);
        return;
      }

      process.stdout.write(
        `Created order ${order.id}${order.orderCode ? ` (${order.orderCode})` : ""}.\n`,
      );
    });

  orderCli
    .command("cancel <id>", "Cancel an order")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--force", "Cancel without confirmation")
    .action(async (id: string, options: OrderActionOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const orderId = parsePositiveInteger(id, "Order ID");

      if (
        !(await confirmDangerousAction(
          {
            commandPath: "halo shop order cancel",
            actionLabel: "Cancel",
            resourceLabel: "order",
            resourceName: String(orderId),
            cancellationVerb: "cancelling",
          },
          options,
        ))
      ) {
        return;
      }

      const api = new ShopApi(clients.axios);
      await api.cancelOrder(orderId);

      if (options.json) {
        printJson({ id: orderId, cancelled: true });
        return;
      }

      process.stdout.write(`Cancelled order ${orderId}.\n`);
    });

  orderCli
    .command("mark-paid <id>", "Mark an order as paid")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--force", "Mark as paid without confirmation")
    .action(async (id: string, options: OrderActionOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const orderId = parsePositiveInteger(id, "Order ID");

      if (
        !(await confirmDangerousAction(
          {
            commandPath: "halo shop order mark-paid",
            actionLabel: "Mark as paid",
            resourceLabel: "order",
            resourceName: String(orderId),
            cancellationVerb: "marking as paid",
          },
          options,
        ))
      ) {
        return;
      }

      const api = new ShopApi(clients.axios);
      await api.markOrderAsPaid(orderId);

      if (options.json) {
        printJson({ id: orderId, markedAsPaid: true });
        return;
      }

      process.stdout.write(`Marked order ${orderId} as paid.\n`);
    });

  orderCli
    .command("fulfill <id>", "Fulfill order items")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--file <path>", "Read a FulfillmentRequest JSON file, use - for stdin")
    .option("--stdin", "Read a FulfillmentRequest JSON payload from stdin")
    .option("--item <item>", "Order item as <orderItemId>:<quantity>, repeatable")
    .option("--all", "Fulfill all unfulfilled item quantities")
    .option("--provider <provider>", "Fulfillment provider (MANUAL)")
    .option("--carrier <carrier>", "Shipping carrier")
    .option("--tracking-number <number>", "Tracking number")
    .option("--tracking-url <url>", "Tracking URL")
    .option("--label-url <url>", "Shipping label URL")
    .option("--force", "Fulfill without confirmation")
    .action(async (id: string, options: OrderFulfillOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const orderId = parsePositiveInteger(id, "Order ID");
      const request = await buildFulfillmentRequest(api, orderId, options);

      if (
        !(await confirmDangerousAction(
          {
            commandPath: "halo shop order fulfill",
            actionLabel: "Fulfill",
            resourceLabel: "order",
            resourceName: String(orderId),
            cancellationVerb: "fulfilling",
          },
          options,
        ))
      ) {
        return;
      }

      const result = await api.fulfillOrder(orderId, request);

      if (options.json) {
        printJson(result ?? { id: orderId, fulfilled: true });
        return;
      }

      process.stdout.write(`Fulfilled order ${orderId}.\n`);
    });

  orderCli
    .command("note <id>", "Add a timeline note to an order")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--message <text>", "Note message")
    .option("--payload <json>", "Optional payload, preferably a JSON string")
    .action(async (id: string, options: OrderNoteOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const orderId = parsePositiveInteger(id, "Order ID");
      const message = requireString(options.message, "Note message is required. Use --message.");
      if (message.length > 1000) {
        throw new CliError("Note message must be at most 1000 characters.");
      }
      const result = await api.addOrderNote(orderId, message, options.payload);

      if (options.json) {
        printJson(result ?? { id: orderId, noteAdded: true });
        return;
      }

      process.stdout.write(`Added note to order ${orderId}.\n`);
    });

  orderCli.usage("<command> [flags]");
  orderCli.example((bin) => `${bin} list --payment-status PAID`);
  orderCli.example((bin) => `${bin} get 1001`);
  orderCli.example((bin) => `${bin} create --username demo --item 1:1:9.9`);
  orderCli.example((bin) => `${bin} mark-paid 1001 --force`);
  orderCli.example((bin) => `${bin} fulfill 1001 --all`);
  orderCli.example((bin) => `${bin} note 1001 --message "Called the buyer"`);
  orderCli.help();

  return orderCli;
}
