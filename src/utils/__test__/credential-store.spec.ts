import { beforeEach, expect, test, vi } from "vite-plus/test";

const entryState = new Map<string, string | null>();

vi.mock("@napi-rs/keyring", () => ({
  Entry: class MockEntry {
    private readonly key: string;

    constructor(service: string, account: string) {
      this.key = `${service}:${account}`;
    }

    setPassword(value: string) {
      entryState.set(this.key, value);
    }

    getPassword() {
      return entryState.get(this.key) ?? null;
    }

    deletePassword() {
      entryState.delete(this.key);
    }
  },
}));

import { KeyringCredentialStore } from "../credential-store.js";
import { CliError } from "../errors.js";

beforeEach(() => {
  entryState.clear();
});

test("KeyringCredentialStore round-trips bearer credentials", async () => {
  const store = new KeyringCredentialStore();

  await store.setProfileCredentials("local", {
    type: "bearer",
    token: "token-value",
  });

  await expect(store.getProfileCredentials("local")).resolves.toEqual({
    type: "bearer",
    token: "token-value",
  });
});

test("KeyringCredentialStore rejects invalid JSON returned from keyring", async () => {
  entryState.set("@halo-dev/cli:profile:broken-json", "not-json");
  const store = new KeyringCredentialStore();

  await expect(store.getProfileCredentials("broken-json")).rejects.toEqual(
    new CliError('Stored credentials for profile "broken-json" are invalid.'),
  );
});

test("KeyringCredentialStore rejects invalid credential structures from keyring", async () => {
  entryState.set(
    "@halo-dev/cli:profile:broken-shape",
    JSON.stringify({
      type: "bearer",
      username: "admin",
    }),
  );
  const store = new KeyringCredentialStore();

  await expect(store.getProfileCredentials("broken-shape")).rejects.toEqual(
    new CliError('Stored credentials for profile "broken-shape" are invalid.'),
  );
});
