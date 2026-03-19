import chalk from "chalk";
import Table from "cli-table3";

export interface ExecutionTarget {
  profileName?: string;
  baseUrl: string;
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printExecutionTarget(target: ExecutionTarget, json = false): void {
  if (json) {
    return;
  }

  const badge = chalk.bold.black.bgCyan(" TARGET ");
  const location = chalk.bold.cyanBright(target.baseUrl);

  if (target.profileName) {
    process.stdout.write(
      `${badge} ${chalk.dim("profile")} ${chalk.bold.white(target.profileName)} ${chalk.dim("->")} ${location}\n\n`,
    );
    return;
  }

  process.stdout.write(`${badge} ${chalk.dim("url")} ${location}\n\n`);
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
