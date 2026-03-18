import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ConfigStore } from "../src/utils/config-store.js";
import type { HaloProfile } from "../src/types.js";

async function withTempStore(run: (store: ConfigStore) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "halo-cli-test-"));
  const store = new ConfigStore(join(root, "config.json"));

  try {
    await run(store);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function createProfile(name: string): HaloProfile {
  return {
    name,
    baseUrl: "https://demo.halo.run",
    auth: {
      type: "bearer",
      token: "token-value",
    },
    createdAt: "2026-03-18T00:00:00.000Z",
    updatedAt: "2026-03-18T00:00:00.000Z",
  };
}

test("ConfigStore persists profiles and active profile", async () => {
  await withTempStore(async (store) => {
    await store.upsertProfile(createProfile("default"), true);

    const loaded = await store.load();
    assert.equal(loaded.activeProfile, "default");
    assert.equal(loaded.profiles.default?.baseUrl, "https://demo.halo.run");

    const active = await store.getActiveProfile();
    assert.equal(active.name, "default");
  });
});

test("ConfigStore resolves explicit profiles without using active profile", async () => {
  await withTempStore(async (store) => {
    await store.upsertProfile(createProfile("default"), true);
    await store.upsertProfile(createProfile("staging"), false);

    const active = await store.getActiveProfile("staging");
    assert.equal(active.name, "staging");
  });
});

test("ConfigStore lists profiles and marks the active profile", async () => {
  await withTempStore(async (store) => {
    await store.upsertProfile(createProfile("prod"), true);
    await store.upsertProfile(createProfile("staging"), false);

    const result = await store.listProfiles();
    assert.equal(result.activeProfile, "prod");
    const names = result.profiles.map((profile) => profile.name);
    assert.ok(names.includes("prod"));
    assert.ok(names.includes("staging"));
  });
});

test("ConfigStore switches the active profile", async () => {
  await withTempStore(async (store) => {
    await store.upsertProfile(createProfile("prod"), true);
    await store.upsertProfile(createProfile("staging"), false);

    const profile = await store.setActiveProfile("staging");
    assert.equal(profile.name, "staging");

    const result = await store.listProfiles();
    assert.equal(result.activeProfile, "staging");
  });
});