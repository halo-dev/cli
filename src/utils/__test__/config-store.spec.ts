import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vitest";

import type { HaloProfile } from "../../shared/profile.js";
import { ConfigStore } from "../config-store.js";

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
    expect(loaded.activeProfile).toBe("default");
    expect(loaded.profiles.default?.baseUrl).toBe("https://demo.halo.run");

    const active = await store.getActiveProfile();
    expect(active.name).toBe("default");
  });
});

test("ConfigStore resolves explicit profiles without using active profile", async () => {
  await withTempStore(async (store) => {
    await store.upsertProfile(createProfile("default"), true);
    await store.upsertProfile(createProfile("staging"), false);

    const active = await store.getActiveProfile("staging");
    expect(active.name).toBe("staging");
  });
});

test("ConfigStore lists profiles and marks the active profile", async () => {
  await withTempStore(async (store) => {
    await store.upsertProfile(createProfile("prod"), true);
    await store.upsertProfile(createProfile("staging"), false);

    const result = await store.listProfiles();
    expect(result.activeProfile).toBe("prod");
    const names = result.profiles.map((profile) => profile.name);
    expect(names).toContain("prod");
    expect(names).toContain("staging");
  });
});

test("ConfigStore switches the active profile", async () => {
  await withTempStore(async (store) => {
    await store.upsertProfile(createProfile("prod"), true);
    await store.upsertProfile(createProfile("staging"), false);

    const profile = await store.setActiveProfile("staging");
    expect(profile.name).toBe("staging");

    const result = await store.listProfiles();
    expect(result.activeProfile).toBe("staging");
  });
});

test("ConfigStore rejects missing active profiles", async () => {
  await withTempStore(async (store) => {
    await expect(store.getActiveProfile()).rejects.toThrow(/No active Halo profile found/);
  });
});
