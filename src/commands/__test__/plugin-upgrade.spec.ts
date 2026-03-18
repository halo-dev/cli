import { expect, test } from "vitest";

import { resolvePluginUpgradeTarget } from "../plugin.js";

test("resolvePluginUpgradeTarget accepts batch upgrades", () => {
  expect(resolvePluginUpgradeTarget(undefined, { all: true })).toEqual({
    mode: "all",
  });
});

test("resolvePluginUpgradeTarget rejects invalid batch upgrade combinations", () => {
  expect(() => resolvePluginUpgradeTarget("plugin-a", { all: true })).toThrow(
    /does not accept a plugin name/i,
  );
  expect(() =>
    resolvePluginUpgradeTarget(undefined, {
      all: true,
      url: "https://example.com/plugin.jar",
    }),
  ).toThrow(/only supports App Store upgrades/i);
});

test("resolvePluginUpgradeTarget requires a plugin name for single upgrades", () => {
  expect(() => resolvePluginUpgradeTarget(undefined, {})).toThrow(
    /requires a plugin name, or use `--all`/i,
  );
});

test("resolvePluginUpgradeTarget accepts single plugin upgrades", () => {
  expect(resolvePluginUpgradeTarget("plugin-a", {})).toEqual({
    mode: "single",
    name: "plugin-a",
  });
});
