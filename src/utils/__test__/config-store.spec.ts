import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vite-plus/test";

import type { HaloProfile } from "../../shared/profile.js";
import { ConfigStore } from "../config-store.js";
import type { CredentialStore } from "../credential-store.js";

async function withTempStore(
  run: (context: { store: ConfigStore; credentials: Map<string, string> }) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "halo-cli-test-"));
  const credentials = new Map<string, string>();
  const credentialStore: CredentialStore = {
    async setProfileCredentials(profileName, auth) {
      credentials.set(profileName, JSON.stringify(auth));
    },
    async getProfileCredentials(profileName) {
      const raw = credentials.get(profileName);
      return raw ? (JSON.parse(raw) as HaloProfile["auth"]) : undefined;
    },
    async deleteProfileCredentials(profileName) {
      credentials.delete(profileName);
    },
  };
  const store = new ConfigStore(join(root, "config.json"), credentialStore);

  try {
    await run({ store, credentials });
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
  await withTempStore(async ({ store }) => {
    await store.upsertProfile(createProfile("default"), true);

    const loaded = await store.load();
    expect(loaded.activeProfile).toBe("default");
    expect(loaded.profiles.default?.baseUrl).toBe("https://demo.halo.run");
    expect(loaded.profiles.default?.auth).toEqual({ type: "bearer" });

    const active = await store.getActiveResolvedProfile();
    expect(active.name).toBe("default");
    expect(active.auth).toEqual({
      type: "bearer",
      token: "token-value",
    });
  });
});

test("ConfigStore keeps secrets out of config.json", async () => {
  await withTempStore(async ({ store }) => {
    await store.upsertProfile(createProfile("default"), true);

    const configJson = await readFile(store.configPath, "utf8");
    expect(configJson).not.toContain("token-value");
  });
});

test("ConfigStore rejects legacy inline credentials in config.json", async () => {
  await withTempStore(async ({ store }) => {
    await writeFile(
      store.configPath,
      `${JSON.stringify(
        {
          activeProfile: "legacy",
          profiles: {
            legacy: {
              name: "legacy",
              baseUrl: "https://demo.halo.run",
              auth: {
                type: "bearer",
                token: "token-value",
              },
              createdAt: "2026-03-18T00:00:00.000Z",
              updatedAt: "2026-03-18T00:00:00.000Z",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await expect(store.load()).rejects.toThrow(/unsupported legacy credential format/i);
  });
});

test("ConfigStore resolves explicit profiles without using active profile", async () => {
  await withTempStore(async ({ store }) => {
    await store.upsertProfile(createProfile("default"), true);
    await store.upsertProfile(createProfile("staging"), false);

    const active = await store.getActiveResolvedProfile("staging");
    expect(active.name).toBe("staging");
  });
});

test("ConfigStore lists profiles and marks the active profile", async () => {
  await withTempStore(async ({ store }) => {
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
  await withTempStore(async ({ store }) => {
    await store.upsertProfile(createProfile("prod"), true);
    await store.upsertProfile(createProfile("staging"), false);

    const profile = await store.setActiveProfile("staging");
    expect(profile.name).toBe("staging");

    const result = await store.listProfiles();
    expect(result.activeProfile).toBe("staging");
  });
});

test("ConfigStore rejects missing active profiles", async () => {
  await withTempStore(async ({ store }) => {
    await expect(store.getActiveResolvedProfile()).rejects.toThrow(/No active Halo profile found/);
  });
});

test("ConfigStore deletes profiles and clears their stored credentials", async () => {
  await withTempStore(async ({ store, credentials }) => {
    await store.upsertProfile(createProfile("prod"), true);

    const result = await store.deleteProfile("prod");

    expect(result.profile.name).toBe("prod");
    expect(result.activeProfile).toBeUndefined();
    expect(await store.getStoredProfile("prod")).toBeUndefined();
    expect(credentials.has("prod")).toBe(false);
  });
});

test("ConfigStore inspects profile credential health", async () => {
  await withTempStore(async ({ store, credentials }) => {
    await store.upsertProfile(createProfile("prod"), true);
    await store.upsertProfile(createProfile("staging"), false);
    credentials.delete("staging");

    const report = await store.inspectProfileCredentials();

    expect(report.ok).toBe(false);
    expect(report.activeProfile).toBe("prod");
    expect(report.profiles).toEqual([
      {
        name: "prod",
        baseUrl: "https://demo.halo.run",
        authType: "bearer",
        status: "ok",
      },
      {
        name: "staging",
        baseUrl: "https://demo.halo.run",
        authType: "bearer",
        status: "missing-credentials",
      },
    ]);
  });
});
