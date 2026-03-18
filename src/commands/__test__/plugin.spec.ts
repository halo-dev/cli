import { expect, test } from "vitest";

import { resolvePluginInstallSource } from "../plugin.js";

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
