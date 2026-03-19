import type { Plugin, PluginList } from "@halo-dev/api-client";
import Table from "cli-table3";

import type { PluginUpdateInfo } from "../../shared/integrations/app-store.js";
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

function getPluginListWidths(): number[] {
  const width = resolveTerminalWidth();
  const displayNameWidth = Math.min(Math.max(16, Math.floor(width * 0.28)), 30);
  const updateWidth = Math.min(Math.max(12, Math.floor(width * 0.18)), 20);
  return [24, displayNameWidth, 14, updateWidth, 10];
}

export function printPluginList(
  list: PluginList,
  json = false,
  updates?: Map<string, PluginUpdateInfo>,
): void {
  if (json) {
    printJson(list);
    return;
  }

  const widths = getPluginListWidths();

  const rows = list.items.map((item) => {
    const update = updates?.get(item.metadata.name);
    const updateText = update
      ? update.compatible
        ? update.latestVersion
        : `${update.latestVersion} !compat`
      : "";

    return [
      item.metadata.name,
      truncateDisplayText(item.spec.displayName ?? item.metadata.name, widths[1]!),
      item.spec.version ?? "",
      truncateDisplayText(updateText, widths[3]!),
      item.status?.phase ?? "",
    ];
  });

  printTable(["NAME", "DISPLAY NAME", "VERSION", "UPDATE", "PHASE"], rows, widths);
  process.stdout.write(`\n${list.total} plugin(s)\n`);
}

export function printPlugin(plugin: Plugin, json = false): void {
  if (json) {
    printJson(plugin);
    return;
  }

  printDetailObject(plugin as unknown as Record<string, unknown>);
}
