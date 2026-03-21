import { afterEach, expect, test, vi } from "vitest";

vi.mock("@inquirer/prompts", () => ({
  checkbox: vi.fn(),
  confirm: vi.fn(),
}));

import { confirm } from "@inquirer/prompts";

import { confirmThemeMutation, resolveThemeInstallSource } from "../index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

test("resolveThemeInstallSource accepts urls", () => {
  expect(resolveThemeInstallSource({ url: " https://example.com/theme.zip " })).toEqual({
    url: "https://example.com/theme.zip",
    file: undefined,
  });
});

test("resolveThemeInstallSource accepts files", () => {
  expect(resolveThemeInstallSource({ file: " ./theme.zip " })).toEqual({
    url: undefined,
    file: "./theme.zip",
  });
});

test("resolveThemeInstallSource requires exactly one source", () => {
  expect(() => resolveThemeInstallSource({})).toThrow(/Provide either --url or --file/);
  expect(() =>
    resolveThemeInstallSource({
      url: "https://example.com/theme.zip",
      file: "./theme.zip",
    }),
  ).toThrow(/Use only one theme source/);
});

test("confirmThemeMutation skips prompting with --force", async () => {
  await expect(confirmThemeMutation("delete", "demo-theme", { force: true })).resolves.toBe(true);
});

test("confirmThemeMutation requires --force outside interactive terminals", async () => {
  Object.defineProperty(process.stdin, "isTTY", {
    value: false,
    configurable: true,
  });
  Object.defineProperty(process.stdout, "isTTY", {
    value: false,
    configurable: true,
  });

  await expect(confirmThemeMutation("delete", "demo-theme", {})).rejects.toThrow(
    /requires confirmation in interactive mode or use --force/i,
  );
});

test("confirmThemeMutation returns false when user cancels", async () => {
  Object.defineProperty(process.stdin, "isTTY", {
    value: true,
    configurable: true,
  });
  Object.defineProperty(process.stdout, "isTTY", {
    value: true,
    configurable: true,
  });

  vi.mocked(confirm).mockResolvedValue(false);
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  await expect(confirmThemeMutation("delete", "demo-theme", {})).resolves.toBe(false);

  expect(stdoutSpy).toHaveBeenCalledWith("Cancelled deleting theme demo-theme.\n");
});
