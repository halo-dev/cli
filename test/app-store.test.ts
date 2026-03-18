import test from "node:test";
import assert from "node:assert/strict";

import {
  formatHaloProAuthorizationToken,
  resolvePluginUpdateInfo,
  resolvePluginAppStoreAppId,
  resolvePluginUpgradeSource,
  satisfiesRequires,
} from "../src/utils/app-store.js";

test("resolvePluginUpgradeSource accepts url source", () => {
  assert.deepEqual(resolvePluginUpgradeSource({ url: "https://example.com/plugin.jar" }), {
    kind: "url",
    url: "https://example.com/plugin.jar",
  });
});

test("resolvePluginUpgradeSource accepts file source", () => {
  assert.deepEqual(resolvePluginUpgradeSource({ file: "./plugin.jar" }), {
    kind: "file",
    file: "./plugin.jar",
  });
});

test("resolvePluginUpgradeSource accepts online source", () => {
  assert.deepEqual(resolvePluginUpgradeSource({ online: true }), {
    kind: "online",
  });
});

test("resolvePluginUpgradeSource rejects multiple sources", () => {
  assert.throws(
    () => resolvePluginUpgradeSource({ url: "https://example.com/plugin.jar", online: true }),
    /Use only one plugin upgrade source/,
  );
});

test("resolvePluginAppStoreAppId reads store annotation", () => {
  const appId = resolvePluginAppStoreAppId({
    metadata: {
      annotations: {
        "store.halo.run/app-id": "plugin-app-store-integration",
      },
    },
  } as never);

  assert.equal(appId, "plugin-app-store-integration");
});

test("resolvePluginAppStoreAppId rejects plugins without store annotation", () => {
  assert.throws(
    () =>
      resolvePluginAppStoreAppId({
        metadata: {},
      } as never),
    /store\.halo\.run\/app-id/,
  );
});

test("formatHaloProAuthorizationToken normalizes activation code for X-Authorization", () => {
  assert.equal(
    formatHaloProAuthorizationToken(" code=with=padding=\n"),
    "lxl_codewithpadding",
  );
});

test("satisfiesRequires matches plugin-app-store semantics", () => {
  assert.equal(satisfiesRequires("2.0.0", ">=2.0.0"), true);
  assert.equal(satisfiesRequires("2.0.0", "2.0.0"), true);
  assert.equal(satisfiesRequires("2.0.0-beta.1", ">=2.0.0"), true);
  assert.equal(satisfiesRequires("2.0.0", ">2.0.0"), false);
});

test("resolvePluginUpdateInfo reports compatible updates", () => {
  assert.deepEqual(
    resolvePluginUpdateInfo("1.0.0", "1.1.0", "2.20.0", ">=2.0.0"),
    { latestVersion: "1.1.0", compatible: true },
  );
});

test("resolvePluginUpdateInfo reports incompatible updates", () => {
  assert.deepEqual(
    resolvePluginUpdateInfo("1.0.0", "1.1.0", "2.0.0", ">=2.5.0"),
    { latestVersion: "1.1.0", compatible: false },
  );
});

test("resolvePluginUpdateInfo ignores non-upgrades", () => {
  assert.equal(resolvePluginUpdateInfo("1.1.0", "1.1.0", "2.20.0", ">=2.0.0"), undefined);
});