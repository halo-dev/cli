import Table from "cli-table3";

import { printDetailObject, printJson } from "../../utils/output.js";
import type { ListedMomentList, Moment } from "./types.js";

function resolveTerminalWidth(): number {
  return process.stdout.columns && process.stdout.columns > 0 ? process.stdout.columns : 120;
}

function truncateDisplayText(value: string, maxWidth: number): string {
  if (value.length <= maxWidth) {
    return value;
  }

  if (maxWidth <= 3) {
    return ".".repeat(maxWidth);
  }

  return `${value.slice(0, Math.max(0, maxWidth - 3))}...`;
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
    table.push(row);
  }

  process.stdout.write(`${table.toString()}\n`);
}

function getMomentListWidths(): number[] {
  const width = resolveTerminalWidth();
  const nameWidth = 28;
  const visibleWidth = 9;
  const releaseTimeWidth = 17;
  const approvedWidth = 10;
  const tagsWidth = Math.min(Math.max(18, Math.floor(width * 0.18)), 24);
  const reservedWidth =
    nameWidth + visibleWidth + releaseTimeWidth + approvedWidth + tagsWidth + 10;
  const contentWidth = Math.min(Math.max(28, width - reservedWidth), 60);
  return [nameWidth, contentWidth, visibleWidth, tagsWidth, releaseTimeWidth, approvedWidth];
}

function formatTimestamp(value: string | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function stripHtmlTags(value: string | undefined): string {
  if (!value) {
    return "";
  }

  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function printMomentList(list: ListedMomentList, json = false): void {
  if (json) {
    printJson(list);
    return;
  }

  const widths = getMomentListWidths();
  const rows = list.items.map((item) => [
    item.moment.metadata.name,
    truncateDisplayText(stripHtmlTags(item.moment.spec.content.raw), widths[1]!),
    item.moment.spec.visible ?? "PUBLIC",
    truncateDisplayText((item.moment.spec.tags ?? []).join(", "), widths[3]!),
    formatTimestamp(item.moment.spec.releaseTime),
    item.moment.spec.approved ? "approved" : "pending",
  ]);

  printTable(["NAME", "CONTENT", "VISIBLE", "TAGS", "RELEASED AT", "APPROVAL"], rows, widths);
  process.stdout.write(`\n${list.total} moment(s)\n`);
}

export function printMoment(moment: Moment, json = false): void {
  if (json) {
    printJson(moment);
    return;
  }

  printDetailObject({
    ...moment,
    spec: {
      ...moment.spec,
      contentPreview: stripHtmlTags(moment.spec.content.raw),
    },
  } as Record<string, unknown>);
}
