import { afterEach, expect, test, vi } from "vitest";

vi.mock("@inquirer/prompts", () => ({
  checkbox: vi.fn(),
  confirm: vi.fn(),
}));

import { confirm } from "@inquirer/prompts";

import { confirmPluginMutation, resolvePluginInstallSource } from "../plugin.js";

afterEach(() => {
  vi.restoreAllMocks();
});

test("resolvePluginInstallSource accepts urls", () => {
  expect(resolvePluginInstallSource({ url: " https://example.com/plugin.jar " })).toEqual({
    url: "https://example.com/plugin.jar",
    file: undefined,
  });
});

test("resolvePluginInstallSource accepts uri aliases", () => {
  expect(resolvePluginInstallSource({ uri: " https://example.com/plugin.jar " })).toEqual({
    url: "https://example.com/plugin.jar",
    file: undefined,
  });
});

test("resolvePluginInstallSource accepts files", () => {
  expect(resolvePluginInstallSource({ file: " ./plugin.jar " })).toEqual({
    url: undefined,
    file: "./plugin.jar",
  });
});

test("resolvePluginInstallSource requires exactly one source", () => {
  expect(() => resolvePluginInstallSource({})).toThrow(/Provide either --url or --file/);
  expect(() =>
    resolvePluginInstallSource({
      url: "https://example.com/plugin.jar",
      file: "./plugin.jar",
    }),
  ).toThrow(/Use only one plugin source/);
});

test("confirmPluginMutation skips prompting with --force", async () => {
  await expect(confirmPluginMutation("enable", "demo-plugin", { force: true })).resolves.toBe(true);
});

test("confirmPluginMutation requires --force outside interactive terminals", async () => {
  Object.defineProperty(process.stdin, "isTTY", {
    value: false,
    configurable: true,
  });
  Object.defineProperty(process.stdout, "isTTY", {
    value: false,
    configurable: true,
  });

  await expect(confirmPluginMutation("disable", "demo-plugin", {})).rejects.toThrow(
    /requires confirmation in interactive mode or use --force/i,
  );
});

test("confirmPluginMutation returns false when user cancels", async () => {
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

  await expect(confirmPluginMutation("uninstall", "demo-plugin", {})).resolves.toBe(false);

  expect(stdoutSpy).toHaveBeenCalledWith("Cancelled uninstalling plugin demo-plugin.\n");
});
