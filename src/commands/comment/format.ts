import type {
  Comment,
  ListedCommentList,
  ListedReply,
  ListedReplyList,
  Reply,
  ReplyList,
} from "@halo-dev/api-client";
import Table from "cli-table3";

import { printDetailObject, printJson, printPaginationFooter } from "../../utils/output.js";

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

function getCommentListWidths(): number[] {
  const width = resolveTerminalWidth();
  const nameWidth = 36;
  const ownerWidth = 18;
  const approvedWidth = 9;
  const createdAtWidth = 17;
  const reservedWidth = nameWidth + ownerWidth + approvedWidth + createdAtWidth + 8;
  const contentWidth = Math.min(Math.max(26, width - reservedWidth), 56);
  return [nameWidth, ownerWidth, contentWidth, approvedWidth, createdAtWidth];
}

function getReplyListWidths(): number[] {
  return getCommentListWidths();
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

function resolveCommentOwnerName(value: {
  owner?: { displayName?: string };
  comment?: { spec?: { owner?: { displayName?: string } } };
  reply?: { spec?: { owner?: { displayName?: string } } };
}): string {
  return (
    value.owner?.displayName ??
    value.comment?.spec?.owner?.displayName ??
    value.reply?.spec?.owner?.displayName ??
    ""
  );
}

export function printCommentList(list: ListedCommentList, json = false): void {
  if (json) {
    printJson(list);
    return;
  }

  const widths = getCommentListWidths();
  const rows = list.items.map((item) => [
    item.comment.metadata.name,
    truncateDisplayText(resolveCommentOwnerName(item), widths[1]!),
    truncateDisplayText(stripHtmlTags(item.comment.spec.content), widths[2]!),
    item.comment.spec.approved ? "yes" : "no",
    formatTimestamp(item.comment.metadata.creationTimestamp ?? undefined),
  ]);

  printTable(["NAME", "OWNER", "CONTENT", "APPROVED", "CREATED AT"], rows, widths);
  printPaginationFooter({
    page: list.page,
    size: list.size,
    total: list.total,
    totalPages: list.totalPages,
    hasNext: list.hasNext,
    hasPrevious: list.hasPrevious,
    itemLabel: "comment",
  });
}

export function printComment(comment: Comment, json = false): void {
  if (json) {
    printJson(comment);
    return;
  }

  printDetailObject({
    ...comment,
    spec: {
      ...comment.spec,
      contentPreview: stripHtmlTags(comment.spec.content),
    },
  } as Record<string, unknown>);
}

function formatReplyRow(
  reply: Reply,
  widths: number[],
  ownerDisplayName?: string,
): [string, string, string, string, string] {
  return [
    reply.metadata.name,
    truncateDisplayText(ownerDisplayName ?? reply.spec.owner?.displayName ?? "", widths[1]!),
    truncateDisplayText(stripHtmlTags(reply.spec.content), widths[2]!),
    reply.spec.approved ? "yes" : "no",
    formatTimestamp(reply.metadata.creationTimestamp ?? undefined),
  ];
}

export function printReplyList(
  list: ListedReplyList | ListedReply[] | ReplyList,
  json = false,
): void {
  if (json) {
    printJson(list);
    return;
  }

  const widths = getReplyListWidths();

  // Handle ReplyList from Core API (listReply)
  if (
    !Array.isArray(list) &&
    "items" in list &&
    list.items.length > 0 &&
    !("reply" in list.items[0]!)
  ) {
    const replyList = list as ReplyList;
    const rows = replyList.items.map((reply) => formatReplyRow(reply, widths));

    printTable(["NAME", "OWNER", "CONTENT", "APPROVED", "CREATED AT"], rows, widths);
    printPaginationFooter({
      page: replyList.page,
      size: replyList.size,
      total: replyList.total,
      totalPages: replyList.totalPages,
      hasNext: replyList.hasNext,
      hasPrevious: replyList.hasPrevious,
      itemLabel: "reply",
    });
    return;
  }

  // Handle ListedReplyList from Console API (listReplies)
  const items = Array.isArray(list) ? list : list.items;
  const total = Array.isArray(list) ? list.length : list.total;
  const rows = (items as ListedReply[]).map((item) =>
    formatReplyRow(item.reply, widths, item.owner?.displayName),
  );

  printTable(["NAME", "OWNER", "CONTENT", "APPROVED", "CREATED AT"], rows, widths);

  if (Array.isArray(list)) {
    process.stdout.write(`\n${total} repl${total === 1 ? "y" : "ies"}\n`);
    return;
  }

  printPaginationFooter({
    page: list.page,
    size: list.size,
    total: list.total,
    totalPages: list.totalPages,
    hasNext: list.hasNext,
    hasPrevious: list.hasPrevious,
    itemLabel: "reply",
  });
}

export function printReply(reply: Reply, json = false): void {
  if (json) {
    printJson(reply);
    return;
  }

  printDetailObject({
    ...reply,
    spec: {
      ...reply.spec,
      contentPreview: stripHtmlTags(reply.spec.content),
    },
  } as Record<string, unknown>);
}
