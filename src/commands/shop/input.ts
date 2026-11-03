import { readFile } from "node:fs/promises";

import { CliError } from "../../utils/errors.js";

export interface JsonInputOptions {
  file?: string;
  stdin?: boolean;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function readJsonPayload(
  options: JsonInputOptions,
): Promise<Record<string, unknown> | undefined> {
  const file = options.file === undefined ? undefined : String(options.file).trim();
  if (options.file !== undefined && !file) {
    throw new CliError("The --file path is empty.");
  }
  if (!file && !options.stdin) {
    return undefined;
  }

  if (file && options.stdin) {
    throw new CliError("Provide either --file or --stdin, not both.");
  }

  const raw = file === "-" || options.stdin ? await readStdin() : await readFile(file!, "utf8");

  if (raw.trim().length === 0) {
    throw new CliError("The provided JSON input is empty.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new CliError(
      `Invalid JSON input: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CliError("The JSON input must be an object.");
  }

  return parsed as Record<string, unknown>;
}

export function mergeDefined<T extends Record<string, unknown>>(base: T, overrides: T): T {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged as T;
}

export function requireString(
  value: string | number | boolean | undefined | null,
  message: string,
): string {
  const normalized = value === undefined || value === null ? "" : String(value).trim();
  if (normalized.length === 0) {
    throw new CliError(message);
  }
  return normalized;
}

export function parsePositiveInteger(value: string | number, label: string): number {
  if (typeof value !== "number" && typeof value !== "string") {
    throw new CliError(`${label} must be a positive integer, got "${String(value)}".`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CliError(`${label} must be a positive integer, got "${value}".`);
  }
  return parsed;
}

export function parsePageOption(value?: string | number): number | undefined {
  return value === undefined ? undefined : parsePositiveInteger(value, "Page");
}

export function parseSizeOption(value?: string | number): number | undefined {
  return value === undefined ? undefined : parsePositiveInteger(value, "Size");
}

export function parseMoneyOption(
  value: string | number | undefined,
  label: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" && typeof value !== "string") {
    throw new CliError(`${label} must be a non-negative number, got "${String(value)}".`);
  }
  const normalized = String(value).trim();
  if (normalized.length === 0) {
    throw new CliError(`${label} requires a non-empty value.`);
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new CliError(`${label} must be a non-negative number, got "${value}".`);
  }
  return parsed;
}

const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

export function parseInstantOption(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new CliError(`${label} must be an ISO-8601 instant.`);
  }

  const normalized = value.trim();
  const datePart = normalized.split("T")[0] ?? "";
  const parsedDate = new Date(`${datePart}T00:00:00Z`);
  if (
    !ISO_INSTANT_PATTERN.test(normalized) ||
    Number.isNaN(Date.parse(normalized)) ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== datePart
  ) {
    throw new CliError(`${label} must be an ISO-8601 instant, got "${value}".`);
  }

  return normalized;
}

export function toStringArray(
  value: string | number | Array<string | number> | undefined,
): string[] {
  if (value === undefined) {
    return [];
  }
  return (Array.isArray(value) ? value : [value]).map((item) => String(item));
}

export function parseEnumOption<T extends string>(
  value: string | number | undefined,
  allowed: readonly T[],
  optionName: string,
): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim().toUpperCase() as T;
  if (!allowed.includes(normalized)) {
    throw new CliError(
      `Invalid ${optionName} "${value}". Supported values: ${allowed.join(", ")}.`,
    );
  }
  return normalized;
}

export function parseEnumListOption<T extends string>(
  value: string | number | undefined,
  allowed: readonly T[],
  optionName: string,
): T[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => parseEnumOption(item, allowed, optionName)!);
}

export function parseNumberListOption(value: string | number | undefined): number[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => parsePositiveInteger(item, "ID"));
}

export function hasAnyOption(options: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => options[key] !== undefined);
}
