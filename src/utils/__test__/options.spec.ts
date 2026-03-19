import { expect, test } from "vitest";

import { parseBooleanOption, parseCsvOption, parseNumberOption } from "../options.js";

test("parseBooleanOption handles common truthy and falsy values", () => {
  expect(parseBooleanOption(" yes ")).toBe(true);
  expect(parseBooleanOption("0")).toBe(false);
  expect(parseBooleanOption(true)).toBe(true);
  expect(parseBooleanOption(undefined)).toBeUndefined();
});

test("parseBooleanOption rejects invalid values", () => {
  expect(() => parseBooleanOption("maybe")).toThrow(/Invalid boolean value/);
});

test("parseNumberOption parses strings and ignores empty values", () => {
  expect(parseNumberOption(" 2 ")).toBe(2);
  expect(parseNumberOption(3)).toBe(3);
  expect(parseNumberOption(" ")).toBeUndefined();
});

test("parseNumberOption rejects invalid values", () => {
  expect(() => parseNumberOption("many")).toThrow(/Invalid number value/);
});

test("parseCsvOption trims items and removes empties", () => {
  expect(parseCsvOption(" news, halo ,, cli ")).toEqual(["news", "halo", "cli"]);
  expect(parseCsvOption("")).toBeUndefined();
});
