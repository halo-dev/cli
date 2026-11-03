import Table from "cli-table3";
import dayjs from "dayjs";

import { printDetailObject, printJson, printPaginationFooter } from "../../utils/output.js";
import type {
  Address,
  Coupon,
  Customer,
  DailyStatistics,
  Discount,
  Order,
  Page,
  Product,
  ProductCategory,
} from "./types.js";

function normalizeCell(value: string | number | boolean | undefined | null): string {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
}

function printTable(headers: string[], rows: Array<Array<string>>, colWidths?: number[]): void {
  const table = new Table({
    head: headers,
    colWidths,
    colAligns: headers.map(() => "left"),
    style: {
      compact: true,
      head: [],
      border: [],
      "padding-left": 0,
      "padding-right": 0,
    },
    wordWrap: false,
    chars: {
      top: "",
      "top-mid": "",
      "top-left": "",
      "top-right": "",
      bottom: "",
      "bottom-mid": "",
      "bottom-left": "",
      "bottom-right": "",
      left: "",
      "left-mid": "",
      mid: "",
      "mid-mid": "",
      right: "",
      "right-mid": "",
      middle: "  ",
    },
  });

  for (const row of rows) {
    table.push(row.map(normalizeCell));
  }

  process.stdout.write(`${table.toString()}\n`);
}

function formatDate(value?: string): string {
  if (!value) {
    return "";
  }

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD HH:mm") : value;
}

function formatMoney(value?: number): string {
  if (value === undefined || value === null) {
    return "";
  }
  return value.toFixed(2);
}

function formatPriceRange(min?: number, max?: number): string {
  if (min === undefined && max === undefined) {
    return "";
  }
  if (min !== undefined && max !== undefined && min !== max) {
    return `${formatMoney(min)} ~ ${formatMoney(max)}`;
  }
  return formatMoney(min ?? max);
}

function formatCustomerName(customer?: Customer): string {
  if (!customer) {
    return "";
  }
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ");
  return name || customer.email || customer.userId || String(customer.id);
}

function printPageFooter(page: Page<unknown>, itemLabel: string): void {
  printPaginationFooter({
    page: page.number + 1,
    size: page.size,
    total: page.totalElements,
    totalPages: page.totalPages,
    hasNext: !page.last,
    hasPrevious: !page.first,
    itemLabel,
  });
}

export function printProductList(page: Page<Product>, json = false): void {
  if (json) {
    printJson(page);
    return;
  }

  printTable(
    ["ID", "TITLE", "TYPE", "STATUS", "PRICE", "CATEGORY", "UPDATED AT"],
    page.content.map((product) => [
      String(product.id),
      product.title,
      product.productType,
      product.status,
      formatPriceRange(product.minPrice, product.maxPrice),
      product.categoryId === undefined ? "" : String(product.categoryId),
      formatDate(product.updatedAt ?? product.createdAt),
    ]),
    [6, 36, 13, 10, 18, 10, 17],
  );
  printPageFooter(page, "product");
}

export function printProduct(product: Product, json = false): void {
  if (json) {
    printJson(product);
    return;
  }

  printDetailObject(product as unknown as Record<string, unknown>);
}

export function printCategoryList(categories: ProductCategory[], json = false): void {
  if (json) {
    printJson(categories);
    return;
  }

  const flatten = (items: ProductCategory[], depth = 0): Array<Array<string>> =>
    items.flatMap((category) => [
      [
        String(category.id),
        `${"  ".repeat(depth)}${category.name}`,
        category.slug,
        category.parentId === undefined ? "" : String(category.parentId),
        formatDate(category.updatedAt ?? category.createdAt),
      ],
      ...flatten(category.children ?? [], depth + 1),
    ]);

  printTable(
    ["ID", "NAME", "SLUG", "PARENT", "UPDATED AT"],
    flatten(categories),
    [6, 36, 24, 8, 17],
  );
}

export function printCategory(category: ProductCategory, json = false): void {
  if (json) {
    printJson(category);
    return;
  }

  printDetailObject(category as unknown as Record<string, unknown>);
}

export function printOrderList(page: Page<Order>, json = false): void {
  if (json) {
    printJson(page);
    return;
  }

  printTable(
    ["ID", "CODE", "CUSTOMER", "STATUS", "PAYMENT", "FULFILLMENT", "PAYABLE", "PAID", "CREATED AT"],
    page.content.map((order) => [
      String(order.id),
      order.orderCode ?? "",
      formatCustomerName(order.customer),
      order.status,
      order.paymentStatus ?? "",
      order.fulfillmentStatus ?? "",
      formatMoney(order.payableAmount),
      formatMoney(order.paidAmount),
      formatDate(order.createdAt),
    ]),
    [6, 20, 18, 9, 12, 12, 10, 10, 17],
  );
  printPageFooter(page, "order");
}

export function printOrder(order: Order, json = false): void {
  if (json) {
    printJson(order);
    return;
  }

  printDetailObject(order as unknown as Record<string, unknown>);
}

export function printCustomerList(page: Page<Customer>, json = false): void {
  if (json) {
    printJson(page);
    return;
  }

  printTable(
    ["ID", "NAME", "EMAIL", "TYPE", "STATUS", "ORDERS", "SPENT", "CREATED AT"],
    page.content.map((customer) => [
      String(customer.id),
      formatCustomerName(customer),
      customer.email ?? "",
      customer.type ?? "",
      customer.status ?? "",
      customer.ordersCount === undefined ? "" : String(customer.ordersCount),
      formatMoney(customer.totalSpent),
      formatDate(customer.createdAt),
    ]),
    [6, 22, 26, 7, 9, 7, 10, 17],
  );
  printPageFooter(page, "customer");
}

export function printCustomer(customer: Customer, json = false): void {
  if (json) {
    printJson(customer);
    return;
  }

  printDetailObject(customer as unknown as Record<string, unknown>);
}

export function printAddressList(addresses: Address[], json = false): void {
  if (json) {
    printJson(addresses);
    return;
  }

  printTable(
    ["ID", "NAME", "PHONE", "REGION", "STREET", "DEFAULT"],
    addresses.map((address) => [
      String(address.id),
      [address.firstName, address.lastName].filter(Boolean).join(" "),
      address.contactPhone ?? "",
      [address.province, address.city, address.district].filter(Boolean).join(" "),
      address.streetAddress ?? "",
      address.isDefault ? "yes" : "no",
    ]),
    [6, 16, 16, 24, 32, 7],
  );
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function printEntitlements(value: unknown, json = false): void {
  const parsed = typeof value === "string" ? tryParseJson(value) : value;
  const normalized = parsed === undefined ? value : parsed;

  if (json) {
    printJson(normalized);
    return;
  }

  if (typeof normalized !== "object" || normalized === null) {
    process.stdout.write(`${String(normalized)}\n`);
    return;
  }

  printDetailObject(normalized as Record<string, unknown>);
}

function formatDiscountValue(calculationType: Coupon["calculationType"], value: number): string {
  return calculationType === "PERCENTAGE" ? `${value}%` : formatMoney(value);
}

export function printCouponList(page: Page<Coupon>, json = false): void {
  if (json) {
    printJson(page);
    return;
  }

  printTable(
    ["ID", "NAME", "TYPE", "VALUE", "SCOPE", "ENABLED", "ISSUED", "CREATED AT"],
    page.content.map((coupon) => [
      String(coupon.id),
      coupon.name,
      coupon.calculationType,
      formatDiscountValue(coupon.calculationType, coupon.discountValue),
      coupon.scope,
      coupon.isEnabled ? "yes" : "no",
      coupon.totalCount === undefined
        ? String(coupon.issuedCount ?? "")
        : `${coupon.issuedCount ?? 0}/${coupon.totalCount}`,
      formatDate(coupon.createdAt),
    ]),
    [6, 26, 12, 10, 18, 8, 10, 17],
  );
  printPageFooter(page, "coupon");
}

export function printCoupon(coupon: Coupon, json = false): void {
  if (json) {
    printJson(coupon);
    return;
  }

  printDetailObject(coupon as unknown as Record<string, unknown>);
}

export function printDiscountList(page: Page<Discount>, json = false): void {
  if (json) {
    printJson(page);
    return;
  }

  printTable(
    ["ID", "NAME", "APPLICATION", "TYPE", "VALUE", "SCOPE", "ENABLED", "USAGE", "CREATED AT"],
    page.content.map((discount) => [
      String(discount.id),
      discount.name,
      discount.application,
      discount.calculationType,
      formatDiscountValue(discount.calculationType, discount.discountValue),
      discount.scope,
      discount.isEnabled ? "yes" : "no",
      String(discount.usageCount ?? 0),
      formatDate(discount.createdAt),
    ]),
    [6, 24, 12, 12, 10, 18, 8, 8, 17],
  );
  printPageFooter(page, "discount");
}

export function printDiscount(discount: Discount, json = false): void {
  if (json) {
    printJson(discount);
    return;
  }

  printDetailObject(discount as unknown as Record<string, unknown>);
}

export function printDailyStatistics(statistics: DailyStatistics[], json = false): void {
  if (json) {
    printJson(statistics);
    return;
  }

  printTable(
    ["DATE", "ORDERS", "SALES", "PRODUCTS SOLD", "NEW CUSTOMERS"],
    statistics.map((item) => [
      item.date,
      String(item.orders),
      formatMoney(item.sales),
      String(item.productsSold),
      String(item.customers),
    ]),
    [12, 10, 12, 14, 14],
  );
}

export function printConfig(value: unknown, json = false): void {
  if (json) {
    printJson(value);
    return;
  }

  if (typeof value === "string") {
    process.stdout.write(`${value}\n`);
    return;
  }

  if (!value || typeof value !== "object") {
    process.stdout.write(`${String(value)}\n`);
    return;
  }

  printDetailObject(value as Record<string, unknown>);
}
