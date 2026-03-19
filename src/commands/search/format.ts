import type { SearchResult } from "@halo-dev/api-client";
import Table from "cli-table3";
import dayjs from "dayjs";
import stringWidth from "string-width";

import { printJson } from "../../utils/output.js";

function resolveTerminalWidth(): number {
  return process.stdout.columns && process.stdout.columns > 0 ? process.stdout.columns : 120;
}

function normalizeCell(value: string | undefined): string {
  return value ?? "";
}

function printTable(headers: string[], rows: Array<Array<string>>, colWidths?: number[]): void {
  const table = new Table({
    head: headers,
    colWidths,
    truncate: "...",
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

function truncateDisplayText(value: string, maxWidth: number): string {
  if (maxWidth <= 0) {
    return "";
  }

  if (stringWidth(value) <= maxWidth) {
    return value;
  }

  if (maxWidth <= 3) {
    return ".".repeat(maxWidth);
  }

  let result = "";
  let width = 0;
  for (const character of value) {
    const nextWidth = stringWidth(character);
    if (width + nextWidth > maxWidth - 3) {
      break;
    }

    result += character;
    width += nextWidth;
  }

  return `${result}...`;
}

function getSearchResultWidths(): number[] {
  const width = resolveTerminalWidth();
  const nameWidth = 38;
  const typeWidth = 10;
  const createdAtWidth = 17;
  const reservedWidth = nameWidth + typeWidth + createdAtWidth + 6;
  const titleWidth = Math.min(Math.max(24, width - reservedWidth), 60);
  return [nameWidth, titleWidth, typeWidth, createdAtWidth];
}

function formatTimestamp(value: string | undefined): string {
  if (!value) {
    return "";
  }

  const date = dayjs(value);
  if (!date.isValid()) {
    return value;
  }

  return date.format("YYYY-MM-DD HH:mm");
}

export function printSearchResult(result: SearchResult, json = false): void {
  if (json) {
    printJson(result);
    return;
  }

  const hits = result.hits ?? [];
  if (hits.length === 0) {
    process.stdout.write(`No search results found for "${result.keyword ?? ""}".\n`);
    return;
  }

  const widths = getSearchResultWidths();
  const rows = hits.map((hit) => {
    const shortType = hit.type?.split(".")[0] ?? hit.type ?? "";
    return [
      hit.metadataName,
      truncateDisplayText(hit.title, widths[1]!),
      shortType,
      formatTimestamp(hit.creationTimestamp),
    ];
  });

  printTable(["NAME", "TITLE", "TYPE", "CREATED AT"], rows, widths);
  process.stdout.write(`\n${result.total ?? hits.length} result(s)\n`);
}
