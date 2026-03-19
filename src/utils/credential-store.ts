import { Entry } from "@napi-rs/keyring";

import type { HaloCredentials } from "../shared/profile.js";
import { CliError } from "./errors.js";

const HALO_CLI_KEYRING_SERVICE = "@halo-dev/cli";

function formatProfileLabel(profileName: string): string {
  return `"${profileName}"`;
}

export interface CredentialStore {
  setProfileCredentials(profileName: string, credentials: HaloCredentials): Promise<void>;
  getProfileCredentials(profileName: string): Promise<HaloCredentials | undefined>;
  deleteProfileCredentials(profileName: string): Promise<void>;
}

function getProfileKeyringEntry(profileName: string): Entry {
  return new Entry(HALO_CLI_KEYRING_SERVICE, `profile:${profileName}`);
}

function isHaloCredentials(value: unknown): value is HaloCredentials {
  if (!value || typeof value !== "object") {
    return false;
  }

  const auth = value as Partial<HaloCredentials> & Record<string, unknown>;
  if (auth.type === "basic") {
    return typeof auth.username === "string" && typeof auth.password === "string";
  }

  if (auth.type === "bearer") {
    return typeof auth.token === "string";
  }

  return false;
}

export class KeyringCredentialStore implements CredentialStore {
  async setProfileCredentials(profileName: string, credentials: HaloCredentials): Promise<void> {
    try {
      getProfileKeyringEntry(profileName).setPassword(JSON.stringify(credentials));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown keyring error.";
      throw new CliError(
        `Failed to store credentials for profile ${formatProfileLabel(profileName)}: ${message}`,
      );
    }
  }

  async getProfileCredentials(profileName: string): Promise<HaloCredentials | undefined> {
    let raw: string | null;

    try {
      raw = getProfileKeyringEntry(profileName).getPassword();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown keyring error.";
      throw new CliError(
        `Failed to read credentials for profile ${formatProfileLabel(profileName)}: ${message}`,
      );
    }

    if (!raw) {
      return undefined;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new CliError(
        `Stored credentials for profile ${formatProfileLabel(profileName)} are invalid.`,
      );
    }

    if (!isHaloCredentials(parsed)) {
      throw new CliError(
        `Stored credentials for profile ${formatProfileLabel(profileName)} are invalid.`,
      );
    }

    return parsed;
  }

  async deleteProfileCredentials(profileName: string): Promise<void> {
    try {
      getProfileKeyringEntry(profileName).deletePassword();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown keyring error.";
      throw new CliError(
        `Failed to delete credentials for profile ${formatProfileLabel(profileName)}: ${message}`,
      );
    }
  }
}
