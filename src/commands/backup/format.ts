import type { Backup, BackupList } from "@halo-dev/api-client";
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

function getBackupListWidths(): number[] {
  const width = resolveTerminalWidth();
  const nameWidth = 34;
  const phaseWidth = 11;
  const sizeWidth = 10;
  const createdAtWidth = 17;
  const reservedWidth = nameWidth + phaseWidth + sizeWidth + createdAtWidth + 8;
  const filenameWidth = Math.min(Math.max(24, width - reservedWidth), 48);
  return [nameWidth, phaseWidth, sizeWidth, filenameWidth, createdAtWidth];
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

export function printBackupList(list: BackupList, json = false): void {
  if (json) {
    printJson(list);
    return;
  }

  const widths = getBackupListWidths();
  const rows = list.items.map((item) => [
    item.metadata.name,
    item.status?.phase ?? "",
    item.status?.size == null
      ? ""
      : prettyBytes(item.status.size, {
          binary: true,
          maximumFractionDigits: 1,
        }),
    truncateDisplayText(item.status?.filename ?? "", widths[3]!),
    formatTimestamp(item.metadata.creationTimestamp ?? undefined),
  ]);

  printTable(["NAME", "PHASE", "SIZE", "FILE", "CREATED AT"], rows, widths);
  printPaginationFooter({
    page: list.page,
    size: list.size,
    total: list.total,
    totalPages: list.totalPages,
    hasNext: list.hasNext,
    hasPrevious: list.hasPrevious,
    itemLabel: "backup",
  });
}

export function printBackup(backup: Backup, json = false): void {
  if (json) {
    printJson(backup);
    return;
  }

  printDetailObject(backup as unknown as Record<string, unknown>);
}
