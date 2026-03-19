import type { Theme, ThemeList } from "@halo-dev/api-client";
import Table from "cli-table3";

import type { ThemeUpdateInfo } from "../../shared/integrations/app-store.js";
import { printDetailObject, printJson } from "../../utils/output.js";

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

function getThemeListWidths(): number[] {
  const width = resolveTerminalWidth();
  const displayNameWidth = Math.min(Math.max(16, Math.floor(width * 0.28)), 30);
  const updateWidth = Math.min(Math.max(12, Math.floor(width * 0.18)), 20);
  return [24, displayNameWidth, 14, updateWidth, 8];
}

export function printThemeList(
  list: ThemeList,
  json = false,
  updates?: Map<string, ThemeUpdateInfo>,
  activeThemeName?: string,
): void {
  if (json) {
    printJson(list);
    return;
  }

  const widths = getThemeListWidths();

  const rows = list.items.map((item) => {
    const update = updates?.get(item.metadata.name);
    const updateText = update
      ? update.compatible
        ? update.latestVersion
        : `${update.latestVersion} !compat`
      : "";

    return [
      item.metadata.name,
      truncateDisplayText(item.spec.displayName, widths[1]!),
      item.spec.version ?? "",
      truncateDisplayText(updateText, widths[3]!),
      item.metadata.name === activeThemeName ? "*" : "",
    ];
  });

  printTable(["NAME", "DISPLAY NAME", "VERSION", "UPDATE", "ACTIVE"], rows, widths);
  process.stdout.write(`\n${list.total} theme(s)\n`);
}

export function printTheme(theme: Theme, json = false): void {
  if (json) {
    printJson(theme);
    return;
  }

  printDetailObject(theme as unknown as Record<string, unknown>);
}
