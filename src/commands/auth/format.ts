import type { DetailedUser } from "@halo-dev/api-client";
import Table from "cli-table3";
import stringWidth from "string-width";

import type { HaloProfile } from "../../shared/profile.js";
import { printDetailObject, printJson } from "../../utils/output.js";

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
