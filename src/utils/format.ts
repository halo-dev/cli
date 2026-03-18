import type { DetailedUser, ListedPostList, Plugin, PluginList } from "@halo-dev/api-client";
import Table from "cli-table3";
import stringWidth from "string-width";

import type { HaloProfile } from "../types.js";
import type { PluginUpdateInfo } from "./app-store.js";

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function resolveTerminalWidth(): number {
  return process.stdout.columns && process.stdout.columns > 0 ? process.stdout.columns : 120;
}

function normalizeCell(value: string | undefined): string {
  return value ?? "";
}

function printTable(
  headers: string[],
  rows: Array<Array<string>>,
  colWidths?: number[],
  truncate = true,
): void {
  const table = new Table({
    head: headers,
    colWidths,
    truncate: truncate ? "..." : undefined,
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

function getProfileListWidths(): number[] {
  const width = resolveTerminalWidth();
  const baseUrlWidth = Math.min(Math.max(28, Math.floor(width * 0.4)), 56);
  return [18, baseUrlWidth, 10, 6];
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

function getPluginListWidths(): number[] {
  const width = resolveTerminalWidth();
  const displayNameWidth = Math.min(Math.max(16, Math.floor(width * 0.28)), 30);
  const updateWidth = Math.min(Math.max(12, Math.floor(width * 0.18)), 20);
  return [24, displayNameWidth, 14, updateWidth, 10];
}

function getDetailTableWidths(): number[] {
  const width = resolveTerminalWidth();
  const fieldWidth = Math.min(Math.max(22, Math.floor(width * 0.28)), 36);
  const valueWidth = Math.max(30, width - fieldWidth - 4);
  return [fieldWidth, valueWidth];
}

function formatLeafValue(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (
      value.every(
        (item) => item == null || ["string", "number", "boolean", "bigint"].includes(typeof item),
      )
    ) {
      return value.map((item) => formatLeafValue(item)).join(", ");
    }

    return JSON.stringify(value);
  }

  return JSON.stringify(value);
}

function formatTimestamp(value: string | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function flattenValue(prefix: string, value: unknown, rows: Array<Array<string>>): void {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);

    if (entries.length === 0) {
      rows.push([prefix, "{}"]);
      return;
    }

    for (const [key, nestedValue] of entries) {
      const nextKey = prefix ? `${prefix}.${key}` : key;
      flattenValue(nextKey, nestedValue, rows);
    }

    return;
  }

  rows.push([prefix, formatLeafValue(value)]);
}

export function printDetailObject(value: Record<string, unknown>): void {
  const rows: Array<Array<string>> = [];
  flattenValue("", value, rows);
  printTable(["FIELD", "VALUE"], rows, getDetailTableWidths());
}

export function printAuthLoginSuccess(
  profile: HaloProfile,
  user: DetailedUser,
  json = false,
): void {
  if (json) {
    printJson({
      profile: profile.name,
      baseUrl: profile.baseUrl,
      user,
    });
    return;
  }

  process.stdout.write(
    `Logged in to ${profile.baseUrl} as ${user.user.spec.displayName ?? user.user.metadata.name} using profile ${profile.name}.\n`,
  );
}

export function printProfileList(
  activeProfile: string | undefined,
  profiles: HaloProfile[],
  json = false,
): void {
  if (json) {
    printJson({ activeProfile, profiles });
    return;
  }

  if (profiles.length === 0) {
    process.stdout.write("No Halo profiles configured. Run `halo auth login` first.\n");
    return;
  }

  const rows = profiles.map((profile) => [
    profile.name,
    truncateDisplayText(profile.baseUrl, getProfileListWidths()[1]!),
    profile.auth.type,
    activeProfile === profile.name ? "*" : "",
  ]);

  printTable(["NAME", "BASE URL", "AUTH", "ACTIVE"], rows, getProfileListWidths(), false);
}

export function printCurrentProfile(profile: HaloProfile, json = false): void {
  if (json) {
    printJson(profile);
    return;
  }

  printDetailObject(profile as unknown as Record<string, unknown>);
}

export function printProfileUseSuccess(profile: HaloProfile, json = false): void {
  if (json) {
    printJson({ activeProfile: profile.name, profile });
    return;
  }

  process.stdout.write(`Active profile set to ${profile.name}.\n`);
}

export function printPostList(list: ListedPostList, json = false): void {
  if (json) {
    printJson(list);
    return;
  }

  const widths = getPostListWidths();

  const rows = list.items.map((item) => {
    const post = item.post;
    return [
      post.metadata.name,
      truncateDisplayText(post.spec.title, widths[1]!),
      post.spec.publish ? "published" : "draft",
      formatTimestamp(post.metadata.creationTimestamp ?? undefined),
    ];
  });

  printTable(["NAME", "TITLE", "STATE", "CREATED AT"], rows, widths, false);
  process.stdout.write(`\n${list.total} post(s)\n`);
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

  printTable(["NAME", "DISPLAY NAME", "VERSION", "UPDATE", "PHASE"], rows, widths, false);
  process.stdout.write(`\n${list.total} plugin(s)\n`);
}

export function printPlugin(plugin: Plugin, json = false): void {
  if (json) {
    printJson(plugin);
    return;
  }

  printDetailObject(plugin as unknown as Record<string, unknown>);
}
