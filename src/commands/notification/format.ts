import type { Notification, NotificationList } from "@halo-dev/api-client";
import Table from "cli-table3";
import dayjs from "dayjs";
import stringWidth from "string-width";

import { printDetailObject, printJson } from "../../utils/output.js";

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

function getNotificationListWidths(): number[] {
  const width = resolveTerminalWidth();
  const nameWidth = 28;
  const unreadWidth = 8;
  const createdAtWidth = 17;
  const reservedWidth = nameWidth + unreadWidth + createdAtWidth + 6;
  const titleWidth = Math.min(Math.max(28, width - reservedWidth), 60);
  return [nameWidth, titleWidth, unreadWidth, createdAtWidth];
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

export function printNotificationList(list: NotificationList, json = false): void {
  if (json) {
    printJson(list);
    return;
  }

  const widths = getNotificationListWidths();
  const rows = list.items.map((item) => [
    item.metadata.name,
    truncateDisplayText(item.spec?.title ?? item.metadata.name, widths[1]!),
    item.spec?.unread ? "yes" : "no",
    formatTimestamp(item.metadata.creationTimestamp ?? undefined),
  ]);

  printTable(["NAME", "TITLE", "UNREAD", "CREATED AT"], rows, widths);
  process.stdout.write(`\n${list.total} notification(s)\n`);
}

export function printNotification(notification: Notification, json = false): void {
  if (json) {
    printJson(notification);
    return;
  }

  printDetailObject({
    ...notification,
    spec: {
      ...notification.spec,
      contentPreview:
        notification.spec?.rawContent || stripHtmlTags(notification.spec?.htmlContent),
    },
  } as Record<string, unknown>);
}
