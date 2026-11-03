import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, test } from "vite-plus/test";

import { CliError } from "../../../utils/errors.js";
import {
  mergeDefined,
  parseEnumListOption,
  parseEnumOption,
  parseMoneyOption,
  parseNumberListOption,
  parsePageOption,
  parsePositiveInteger,
  readJsonPayload,
  requireString,
  toStringArray,
} from "../input.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function writeTempJson(content: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "halo-shop-"));
  tempDirectories.push(directory);
  const file = join(directory, "payload.json");
  await writeFile(file, content, "utf8");
  return file;
}

test("readJsonPayload returns undefined without file input", async () => {
  await expect(readJsonPayload({})).resolves.toBeUndefined();
});

test("readJsonPayload reads an object from a file", async () => {
  const file = await writeTempJson('{"title":"Example"}');

  await expect(readJsonPayload({ file })).resolves.toEqual({ title: "Example" });
});

test("readJsonPayload rejects invalid JSON", async () => {
  const file = await writeTempJson("{");

  await expect(readJsonPayload({ file })).rejects.toThrow(CliError);
  await expect(readJsonPayload({ file })).rejects.toThrow("Invalid JSON input");
});

test("readJsonPayload rejects non-object JSON", async () => {
  const file = await writeTempJson("[]");

  await expect(readJsonPayload({ file })).rejects.toThrow("must be an object");
});

test("readJsonPayload rejects an empty file path", async () => {
  await expect(readJsonPayload({ file: "" })).rejects.toThrow("The --file path is empty.");
});

test("readJsonPayload rejects empty input", async () => {
  const file = await writeTempJson("  ");

  await expect(readJsonPayload({ file })).rejects.toThrow("empty");
});

test("mergeDefined keeps base values and applies defined overrides", () => {
  expect(mergeDefined({ a: 1, b: 2 }, { a: undefined, b: 3 })).toEqual({ a: 1, b: 3 });
});

test("parsePositiveInteger and parsePageOption validate integers", () => {
  expect(parsePositiveInteger("12", "ID")).toBe(12);
  expect(parsePageOption("1")).toBe(1);
  expect(() => parsePositiveInteger("0", "ID")).toThrow(CliError);
  expect(() => parsePageOption("1.5")).toThrow(CliError);
});

test("parseEnumOption validates and normalizes enums", () => {
  expect(parseEnumOption("draft", ["DRAFT", "PUBLISHED"] as const, "--status")).toBe("DRAFT");
  expect(parseEnumOption(undefined, ["DRAFT"] as const, "--status")).toBeUndefined();
  expect(() => parseEnumOption("bad", ["DRAFT"] as const, "--status")).toThrow("Invalid --status");
});

test("parseEnumListOption and parseNumberListOption parse CSV values", () => {
  expect(
    parseEnumListOption("DRAFT, published", ["DRAFT", "PUBLISHED"] as const, "--status"),
  ).toEqual(["DRAFT", "PUBLISHED"]);
  expect(parseNumberListOption("1, 2,3")).toEqual([1, 2, 3]);
  expect(parseNumberListOption(undefined)).toBeUndefined();
});

test("parseMoneyOption validates non-negative numbers", () => {
  expect(parseMoneyOption("9.9", "--price")).toBe(9.9);
  expect(parseMoneyOption(undefined, "--price")).toBeUndefined();
  expect(() => parseMoneyOption("", "--price")).toThrow("requires a non-empty value");
  expect(() => parseMoneyOption("-1", "--price")).toThrow(CliError);
  expect(() => parseMoneyOption("abc", "--price")).toThrow(CliError);
});

test("toStringArray normalizes repeated options", () => {
  expect(toStringArray(undefined)).toEqual([]);
  expect(toStringArray("a")).toEqual(["a"]);
  expect(toStringArray(["a", "b"])).toEqual(["a", "b"]);
  expect(toStringArray(123)).toEqual(["123"]);
});

test("requireString accepts numeric option values parsed by cac", () => {
  expect(requireString(35, "required")).toBe("35");
  expect(() => requireString(undefined, "required")).toThrow("required");
  expect(() => requireString("   ", "required")).toThrow("required");
});

test("string helpers tolerate numeric option values", () => {
  expect(parseNumberListOption(1)).toEqual([1]);
  expect(() => parseEnumListOption(1, ["DRAFT"] as const, "--status")).toThrow("Invalid --status");
  expect(() => parseEnumOption(1, ["DRAFT"] as const, "--status")).toThrow("Invalid --status");
});
