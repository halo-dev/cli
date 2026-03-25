import type {
  Category,
  CategoryList,
  ListedPostList,
  Post,
  Tag,
  TagList,
} from "@halo-dev/api-client";
import Table from "cli-table3";
import dayjs from "dayjs";
import stringWidth from "string-width";

import { printDetailObject, printJson, printPaginationFooter } from "../../utils/output.js";

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
  printPaginationFooter({
    page: list.page,
    size: list.size,
    total: list.total,
    totalPages: list.totalPages,
    hasNext: list.hasNext,
    hasPrevious: list.hasPrevious,
    itemLabel: "post",
  });
}

interface PostDetailPayload {
  post: Post;
  content: {
    raw: string;
    content: string;
    rawType: string;
  };
}

export function printPostDetail(detail: PostDetailPayload, json = false): void {
  if (json) {
    printJson(detail);
    return;
  }

  printDetailObject({
    metadata: detail.post.metadata,
    spec: detail.post.spec,
    status: detail.post.status,
    content: {
      rawType: detail.content.rawType,
    },
  });

  process.stdout.write('\nUse "--json" to view the full content payload.\n');
}

function getTagListWidths(): number[] {
  const width = resolveTerminalWidth();
  const nameWidth = 36;
  const slugWidth = 24;
  const colorWidth = 10;
  const createdAtWidth = 17;
  const reservedWidth = nameWidth + slugWidth + colorWidth + createdAtWidth + 8;
  const displayNameWidth = Math.min(Math.max(20, width - reservedWidth), 40);
  return [nameWidth, displayNameWidth, slugWidth, colorWidth, createdAtWidth];
}

export function printTagList(list: TagList, json = false): void {
  if (json) {
    printJson(list);
    return;
  }

  const widths = getTagListWidths();
  const table = new Table({
    head: ["NAME", "DISPLAY NAME", "SLUG", "COLOR", "CREATED AT"],
    colWidths: widths,
    colAligns: ["left", "left", "left", "left", "left"],
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
      item.metadata.name,
      truncateDisplayText(item.spec.displayName, widths[1]!),
      truncateDisplayText(item.spec.slug, widths[2]!),
      item.spec.color ?? "",
      formatTimestamp(item.metadata.creationTimestamp ?? undefined),
    ]);
  }

  process.stdout.write(`${table.toString()}\n`);
  printPaginationFooter({
    page: list.page,
    size: list.size,
    total: list.total,
    totalPages: list.totalPages,
    hasNext: list.hasNext,
    hasPrevious: list.hasPrevious,
    itemLabel: "tag",
  });
}

export function printTag(tag: Tag, json = false, successMessage?: string): void {
  if (json) {
    printJson(tag);
    return;
  }

  if (successMessage) {
    process.stdout.write(`${successMessage}\n\n`);
  }

  printDetailObject({
    metadata: tag.metadata,
    spec: tag.spec,
    status: tag.status,
  });
}

function getCategoryListWidths(): number[] {
  const width = resolveTerminalWidth();
  const nameWidth = 36;
  const slugWidth = 24;
  const priorityWidth = 10;
  const createdAtWidth = 17;
  const reservedWidth = nameWidth + slugWidth + priorityWidth + createdAtWidth + 8;
  const displayNameWidth = Math.min(Math.max(20, width - reservedWidth), 40);
  return [nameWidth, displayNameWidth, slugWidth, priorityWidth, createdAtWidth];
}

export function printCategoryList(list: CategoryList, json = false): void {
  if (json) {
    printJson(list);
    return;
  }

  const widths = getCategoryListWidths();
  const table = new Table({
    head: ["NAME", "DISPLAY NAME", "SLUG", "PRIORITY", "CREATED AT"],
    colWidths: widths,
    colAligns: ["left", "left", "left", "left", "left"],
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
      item.metadata.name,
      truncateDisplayText(item.spec.displayName, widths[1]!),
      truncateDisplayText(item.spec.slug, widths[2]!),
      String(item.spec.priority ?? ""),
      formatTimestamp(item.metadata.creationTimestamp ?? undefined),
    ]);
  }

  process.stdout.write(`${table.toString()}\n`);
  printPaginationFooter({
    page: list.page,
    size: list.size,
    total: list.total,
    totalPages: list.totalPages,
    hasNext: list.hasNext,
    hasPrevious: list.hasPrevious,
    itemLabel: "category",
  });
}

export function printCategory(category: Category, json = false, successMessage?: string): void {
  if (json) {
    printJson(category);
    return;
  }

  if (successMessage) {
    process.stdout.write(`${successMessage}\n\n`);
  }

  printDetailObject({
    metadata: category.metadata,
    spec: category.spec,
    status: category.status,
  });
}
