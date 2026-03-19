import type { ListedPostList } from "@halo-dev/api-client";
import Table from "cli-table3";
import dayjs from "dayjs";
import stringWidth from "string-width";

import { printJson } from "../../utils/output.js";

function resolveTerminalWidth(): number {
  return process.stdout.columns && process.stdout.columns > 0 ? process.stdout.columns : 120;
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

function getPostListWidths(): number[] {
  const width = resolveTerminalWidth();
  const nameWidth = 38;
  const stateWidth = 10;
  const createdAtWidth = 17;
  const reservedWidth = nameWidth + stateWidth + createdAtWidth + 6;
  const titleWidth = Math.min(Math.max(24, width - reservedWidth), 60);
  return [nameWidth, titleWidth, stateWidth, createdAtWidth];
}

export function printPostList(list: ListedPostList, json = false): void {
  if (json) {
    printJson(list);
    return;
  }

  const widths = getPostListWidths();
  const table = new Table({
    head: ["NAME", "TITLE", "STATE", "CREATED AT"],
    colWidths: widths,
    colAligns: ["left", "left", "left", "left"],
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

  for (const item of list.items) {
    table.push([
      item.post.metadata.name,
      truncateDisplayText(item.post.spec.title, widths[1]!),
      item.post.spec.publish ? "published" : "draft",
      formatTimestamp(item.post.metadata.creationTimestamp ?? undefined),
    ]);
  }

  process.stdout.write(`${table.toString()}\n`);
  process.stdout.write(`\n${list.total} post(s)\n`);
}
