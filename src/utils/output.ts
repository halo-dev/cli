import { styleText } from "node:util";

import Table from "cli-table3";

import { resolvePermalinkUrl } from "./browser.js";

export interface ExecutionTarget {
  profileName?: string;
  baseUrl: string;
}

export interface ResourceMutationSuccessOptions {
  message: string;
  baseUrl: string;
  name: string;
  permalink?: string;
  resourceLabel: string;
  inspectCommand: string;
}

export interface PaginationFooterOptions {
  page?: number;
  size?: number;
  total?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
  itemLabel: string;
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printExecutionTarget(target: ExecutionTarget, json = false): void {
  if (json) {
    return;
  }

  const badge = styleText(["bold", "black", "bgCyan"], " TARGET ");
  const location = styleText(["bold", "cyanBright"], target.baseUrl);

  if (target.profileName) {
    process.stdout.write(
      `${badge} ${styleText("dim", "profile")} ${styleText(["bold", "white"], target.profileName)} ${styleText("dim", "->")} ${location}\n\n`,
    );
    return;
  }

  process.stdout.write(`${badge} ${styleText("dim", "url")} ${location}\n\n`);
}

export function printResourceMutationSuccess(options: ResourceMutationSuccessOptions): void {
  process.stdout.write(`${options.message}\n\n`);
  process.stdout.write(`metadata.name: ${options.name}\n`);

  const normalizedPermalink = options.permalink?.trim();
  if (normalizedPermalink) {
    process.stdout.write(
      `permalink: ${resolvePermalinkUrl(options.baseUrl, normalizedPermalink, options.resourceLabel)}\n`,
    );
  } else {
    process.stdout.write("permalink: (not available until published)\n");
  }

  process.stdout.write(`inspect: ${options.inspectCommand}\n`);
}

export function printPaginationFooter(options: PaginationFooterOptions): void {
  const total = options.total ?? 0;
  const itemLabel = options.itemLabel;
  const resolvedSize =
    options.size && options.size > 0 ? options.size : total > 0 ? total : undefined;
  const resolvedPage = options.page && options.page > 0 ? options.page : total > 0 ? 1 : undefined;

  const start =
    total > 0 && resolvedPage && resolvedSize ? (resolvedPage - 1) * resolvedSize + 1 : 0;
  const end =
    total > 0 && resolvedPage && resolvedSize ? Math.min(total, start + resolvedSize - 1) : 0;

  const parts: string[] = [];

  if (total > 0 && start > 0 && end > 0) {
    parts.push(`Showing ${start}-${end} of ${total} ${itemLabel}(s)`);
  } else {
    parts.push(`${total} ${itemLabel}(s)`);
  }

  if (resolvedPage) {
    if (options.totalPages && options.totalPages > 0) {
      parts.push(`page ${resolvedPage}/${options.totalPages}`);
    } else {
      parts.push(`page ${resolvedPage}`);
    }
  }

  if (resolvedSize) {
    parts.push(`size ${resolvedSize}`);
  }

  if (options.hasNext) {
    parts.push("more results available");
  } else if (options.hasPrevious) {
    parts.push("end of results");
  }

  process.stdout.write(`\n${parts.join(" · ")}\n`);
}

function resolveTerminalWidth(): number {
  return process.stdout.columns && process.stdout.columns > 0 ? process.stdout.columns : 120;
}

function normalizeCell(value: string | undefined): string {
  return value ?? "";
}

function printTable(
  headers: string[],
  rows: Array<Array<string>>,
  colWidths?: number[],
  truncate = true,
): void {
  const table = new Table({
    head: headers,
    colWidths,
    truncate: truncate ? "..." : undefined,
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

function getDetailTableWidths(): number[] {
  const width = resolveTerminalWidth();
  const fieldWidth = Math.min(Math.max(22, Math.floor(width * 0.28)), 36);
  const valueWidth = Math.max(30, width - fieldWidth - 4);
  return [fieldWidth, valueWidth];
}

function formatLeafValue(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (
      value.every(
        (item) => item == null || ["string", "number", "boolean", "bigint"].includes(typeof item),
      )
    ) {
      return value.map((item) => formatLeafValue(item)).join(", ");
    }

    return JSON.stringify(value);
  }

  return JSON.stringify(value);
}

function flattenValue(prefix: string, value: unknown, rows: Array<Array<string>>): void {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);

    if (entries.length === 0) {
      rows.push([prefix, "{}"]);
      return;
    }

    for (const [key, nestedValue] of entries) {
      const nextKey = prefix ? `${prefix}.${key}` : key;
      flattenValue(nextKey, nestedValue, rows);
    }

    return;
  }

  rows.push([prefix, formatLeafValue(value)]);
}

export function printDetailObject(value: Record<string, unknown>): void {
  const rows: Array<Array<string>> = [];
  flattenValue("", value, rows);
  printTable(["FIELD", "VALUE"], rows, getDetailTableWidths());
}
