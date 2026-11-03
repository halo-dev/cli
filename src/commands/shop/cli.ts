import cac, { type CAC } from "cac";

import { CliError } from "../../utils/errors.js";
import { parseBooleanOption } from "../../utils/options.js";

/** Options that may legitimately be passed more than once. */
const REPEATABLE_OPTIONS = new Set(["item", "username"]);

function camelCaseOptionName(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function kebabCaseOptionName(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function parseOptionToken(token: string): { name: string; value?: string } | undefined {
  if (!token.startsWith("--") || token === "--") {
    return undefined;
  }

  const equalsIndex = token.indexOf("=");
  const rawName = equalsIndex === -1 ? token.slice(2) : token.slice(2, equalsIndex);
  if (rawName.length === 0) {
    return undefined;
  }

  return {
    name: camelCaseOptionName(rawName),
    value: equalsIndex === -1 ? undefined : token.slice(equalsIndex + 1),
  };
}

function collectOptionKinds(cli: CAC): {
  booleanOptions: Set<string>;
  valueOptions: Set<string>;
} {
  const booleanOptions = new Set<string>();
  const valueOptions = new Set<string>();

  for (const command of [cli.globalCommand, ...cli.commands]) {
    for (const option of command.options) {
      if (option.isBoolean) {
        booleanOptions.add(option.name);
      } else {
        valueOptions.add(option.name);
      }
    }
  }

  return { booleanOptions, valueOptions };
}

function negatedBooleanBaseName(name: string): string {
  return `${(name[2] as string).toLowerCase()}${name.slice(3)}`;
}

function isNegatedBooleanOption(name: string, booleanOptions: Set<string>): boolean {
  if (!name.startsWith("no") || name.length <= 2) {
    return false;
  }

  return booleanOptions.has(negatedBooleanBaseName(name));
}

function normalizeEmptyEqualsValues(argv: string[], valueOptions: Set<string>): string[] {
  const normalized: string[] = [];

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index] as string;
    if (token === "--") {
      normalized.push(...argv.slice(index));
      break;
    }

    const option = parseOptionToken(token);
    if (option && option.value === "" && valueOptions.has(option.name)) {
      normalized.push(token.slice(0, -1), "");
      continue;
    }

    normalized.push(token);
  }

  return normalized;
}

function normalizeDashValues(argv: string[], valueOptions: Set<string>): string[] {
  const normalized: string[] = [];

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index] as string;
    if (token === "--") {
      normalized.push(...argv.slice(index));
      break;
    }

    const option = parseOptionToken(token);

    if (
      option &&
      option.value === undefined &&
      argv[index + 1] === "-" &&
      valueOptions.has(option.name)
    ) {
      normalized.push(`${token}=-`);
      index++;
      continue;
    }

    normalized.push(token);
  }

  return normalized;
}

function normalizeBooleanOptions(argv: string[], booleanOptions: Set<string>): string[] {
  const normalized: string[] = [];

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index] as string;
    if (token === "--") {
      normalized.push(...argv.slice(index));
      break;
    }

    const option = parseOptionToken(token);
    if (!option) {
      normalized.push(token);
      continue;
    }

    if (booleanOptions.has(option.name)) {
      if (option.value === undefined) {
        normalized.push(`--${option.name}`);
        continue;
      }

      const parsed = parseBooleanOption(option.value);
      normalized.push(parsed ? `--${option.name}` : `--no-${option.name}`);
      continue;
    }

    if (isNegatedBooleanOption(option.name, booleanOptions)) {
      const baseName = negatedBooleanBaseName(option.name);
      if (option.value === undefined) {
        normalized.push(`--no-${baseName}`);
        continue;
      }

      const parsed = parseBooleanOption(option.value);
      normalized.push(parsed ? `--no-${baseName}` : `--${baseName}`);
      continue;
    }

    normalized.push(token);
  }

  return normalized;
}

function collectRawValues(argv: string[], booleanOptions: Set<string>): Map<string, string[]> {
  const values = new Map<string, string[]>();

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index] as string;
    if (token === "--") {
      break;
    }

    const option = parseOptionToken(token);
    if (!option) {
      continue;
    }

    if (booleanOptions.has(option.name) || isNegatedBooleanOption(option.name, booleanOptions)) {
      continue;
    }

    let value: string;
    if (option.value !== undefined) {
      value = option.value;
    } else {
      const next = argv[index + 1];
      if (next === undefined || (next.startsWith("-") && next !== "-")) {
        continue;
      }

      value = next;
      index++;
    }

    const existing = values.get(option.name);
    if (existing) {
      existing.push(value);
    } else {
      values.set(option.name, [value]);
    }
  }

  return values;
}

/**
 * cac/mri coerces numeric-looking option values into numbers and empty values
 * into 0. That loses leading zeros and makes empty input indistinguishable from
 * an explicit zero. Restore the raw string values after parsing so shop
 * commands can validate and preserve what the user actually typed.
 */
export function createShopCli(name: string): CAC {
  const cli = cac(name);
  const originalParse = cli.parse.bind(cli);

  cli.parse = ((argv: string[] = [], config?: { run?: boolean }) => {
    const { booleanOptions, valueOptions } = collectOptionKinds(cli);
    const normalizedArgv = normalizeBooleanOptions(
      normalizeDashValues(normalizeEmptyEqualsValues(argv, valueOptions), valueOptions),
      booleanOptions,
    );
    const rawValues = collectRawValues(normalizedArgv, booleanOptions);

    for (const [optionName, values] of rawValues) {
      if (values.length > 1 && !REPEATABLE_OPTIONS.has(optionName)) {
        throw new CliError(
          `Option --${kebabCaseOptionName(optionName)} was provided multiple times.`,
        );
      }
    }

    const parsed = originalParse(normalizedArgv, config);

    for (const optionName of booleanOptions) {
      const value = cli.options[optionName];
      if (Array.isArray(value)) {
        cli.options[optionName] = value.at(-1);
      }
    }

    for (const [optionName, values] of rawValues) {
      cli.options[optionName] = values.length === 1 ? values[0] : values;
    }

    return parsed;
  }) as CAC["parse"];

  return cli;
}
