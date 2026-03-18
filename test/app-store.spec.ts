import { expect, test } from "vitest";

import {
  formatHaloProAuthorizationToken,
  resolvePluginUpdateInfo,
  resolvePluginAppStoreAppId,
  resolvePluginUpgradeSource,
  satisfiesRequires,
} from "../src/utils/app-store.js";

test("resolvePluginUpgradeSource accepts url source", () => {
  expect(resolvePluginUpgradeSource({ url: "https://example.com/plugin.jar" })).toEqual({
    kind: "url",
    url: "https://example.com/plugin.jar",
  });
});

test("resolvePluginUpgradeSource accepts file source", () => {
  expect(resolvePluginUpgradeSource({ file: "./plugin.jar" })).toEqual({
    kind: "file",
    file: "./plugin.jar",
  });
});

test("resolvePluginUpgradeSource accepts online source", () => {
  expect(resolvePluginUpgradeSource({ online: true })).toEqual({
    kind: "online",
  });
});

test("resolvePluginUpgradeSource rejects multiple sources", () => {
  expect(() =>
    resolvePluginUpgradeSource({
      url: "https://example.com/plugin.jar",
      online: true,
    }),
  ).toThrow(/Use only one plugin upgrade source/);
});

test("resolvePluginAppStoreAppId reads store annotation", () => {
  const appId = resolvePluginAppStoreAppId({
    metadata: {
      annotations: {
        "store.halo.run/app-id": "plugin-app-store-integration",
      },
    },
  } as never);

  expect(appId).toBe("plugin-app-store-integration");
});

test("resolvePluginAppStoreAppId rejects plugins without store annotation", () => {
  expect(() =>
    resolvePluginAppStoreAppId({
      metadata: {},
    } as never),
  ).toThrow(/store\.halo\.run\/app-id/);
});

test("formatHaloProAuthorizationToken normalizes activation code for X-Authorization", () => {
  expect(formatHaloProAuthorizationToken(" code=with=padding=\n")).toBe("lxl_codewithpadding");
});

test("satisfiesRequires matches plugin-app-store semantics", () => {
  expect(satisfiesRequires("2.0.0", ">=2.0.0")).toBe(true);
  expect(satisfiesRequires("2.0.0", "2.0.0")).toBe(true);
  expect(satisfiesRequires("2.0.0-beta.1", ">=2.0.0")).toBe(true);
  expect(satisfiesRequires("2.0.0", ">2.0.0")).toBe(false);
});

test("resolvePluginUpdateInfo reports compatible updates", () => {
  expect(resolvePluginUpdateInfo("1.0.0", "1.1.0", "2.20.0", ">=2.0.0")).toEqual({
    latestVersion: "1.1.0",
    compatible: true,
  });
});

test("resolvePluginUpdateInfo reports incompatible updates", () => {
  expect(resolvePluginUpdateInfo("1.0.0", "1.1.0", "2.0.0", ">=2.5.0")).toEqual({
    latestVersion: "1.1.0",
    compatible: false,
  });
});

test("resolvePluginUpdateInfo ignores non-upgrades", () => {
  expect(resolvePluginUpdateInfo("1.1.0", "1.1.0", "2.20.0", ">=2.0.0")).toBeUndefined();
});
