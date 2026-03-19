import type { Attachment, AttachmentList } from "@halo-dev/api-client";
import Table from "cli-table3";
import prettyBytes from "pretty-bytes";

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

function getAttachmentListWidths(): number[] {
  const width = resolveTerminalWidth();
  const nameWidth = 36;
  const displayNameWidth = Math.min(Math.max(44, Math.floor(width * 0.4)), 56);
  const sizeWidth = 10;
  const mediaTypeWidth = Math.min(
    Math.max(20, width - nameWidth - displayNameWidth - sizeWidth - 6),
    36,
  );
  return [nameWidth, displayNameWidth, sizeWidth, mediaTypeWidth];
}

export function printAttachmentList(list: AttachmentList, json = false): void {
  if (json) {
    printJson(list);
    return;
  }

  const widths = getAttachmentListWidths();
  const rows = list.items.map((item) => [
    item.metadata.name,
    truncateDisplayText(item.spec.displayName ?? item.metadata.name, widths[1]!),
    item.spec.size == null
      ? ""
      : prettyBytes(item.spec.size, {
          binary: true,
          maximumFractionDigits: 1,
        }),
    truncateDisplayText(item.spec.mediaType ?? "", widths[3]!),
  ]);

  printTable(["NAME", "DISPLAY NAME", "SIZE", "MEDIA TYPE"], rows, widths);
  printPaginationFooter({
    page: list.page,
    size: list.size,
    total: list.total,
    totalPages: list.totalPages,
    hasNext: list.hasNext,
    hasPrevious: list.hasPrevious,
    itemLabel: "attachment",
  });
}

export function printAttachment(attachment: Attachment, json = false): void {
  if (json) {
    printJson(attachment);
    return;
  }

  const { status, ...rest } = attachment;

  printDetailObject({
    ...rest,
    status: status
      ? {
          ...status,
          permalink: undefined,
        }
      : undefined,
  } as Record<string, unknown>);
}
