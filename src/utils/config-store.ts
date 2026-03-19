import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { HaloConfig, HaloProfile, StoredHaloProfile } from "../shared/profile.js";
import { toStoredHaloProfile } from "../shared/profile.js";
import { KeyringCredentialStore, type CredentialStore } from "./credential-store.js";
import { CliError } from "./errors.js";

const DEFAULT_CONFIG: HaloConfig = {
  profiles: {},
};

function createEmptyConfig(): HaloConfig {
  return {
    activeProfile: DEFAULT_CONFIG.activeProfile,
    profiles: {},
  };
}

export type ProfileCredentialHealthStatus = "ok" | "missing-credentials" | "auth-type-mismatch";

export interface ProfileCredentialHealth {
  name: string;
  baseUrl: string;
  authType: StoredHaloProfile["auth"]["type"];
  status: ProfileCredentialHealthStatus;
}

export interface ProfileCredentialDoctorReport {
  activeProfile?: string;
  ok: boolean;
  profiles: ProfileCredentialHealth[];
}

interface ConfigFileStoredProfile {
  name?: string;
  baseUrl?: string;
  auth?: {
    type?: unknown;
    username?: unknown;
    password?: unknown;
    token?: unknown;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface ConfigFileContents {
  activeProfile?: string;
  profiles?: Record<string, ConfigFileStoredProfile>;
}

function resolveConfigRoot(): string {
  if (process.env.HALO_CLI_CONFIG_DIR) {
    return process.env.HALO_CLI_CONFIG_DIR;
  }

  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return join(xdgConfigHome, "halo");
  }

  return join(homedir(), ".config", "halo");
}

export class ConfigStore {
  readonly configPath: string;
  readonly credentialStore: CredentialStore;

  constructor(
    configPath = join(resolveConfigRoot(), "config.json"),
    credentialStore: CredentialStore = new KeyringCredentialStore(),
  ) {
    this.configPath = configPath;
    this.credentialStore = credentialStore;
  }

  async load(): Promise<HaloConfig> {
    try {
      const raw = await readFile(this.configPath, "utf8");
      const parsed = JSON.parse(raw) as ConfigFileContents;
      return {
        activeProfile: parsed.activeProfile,
        profiles: this.validateStoredProfiles(parsed.profiles ?? {}),
      };
    } catch (error) {
      const maybeNodeError = error as NodeJS.ErrnoException;
      if (maybeNodeError.code === "ENOENT") {
        return createEmptyConfig();
      }

      throw new CliError(`Failed to read CLI config: ${maybeNodeError.message}`);
    }
  }

  async save(config: HaloConfig): Promise<void> {
    await mkdir(dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  }

  async upsertProfile(profile: HaloProfile, setActive = true): Promise<HaloConfig> {
    const config = await this.load();
    await this.credentialStore.setProfileCredentials(profile.name, profile.auth);
    config.profiles[profile.name] = toStoredHaloProfile(profile);
    if (setActive) {
      config.activeProfile = profile.name;
    }
    await this.save(config);
    return config;
  }

  async getResolvedProfile(name: string): Promise<HaloProfile | undefined> {
    const config = await this.load();
    const storedProfile = config.profiles[name];
    if (!storedProfile) {
      return undefined;
    }

    return this.resolveProfile(storedProfile);
  }

  async getStoredProfile(name: string): Promise<StoredHaloProfile | undefined> {
    const config = await this.load();
    return config.profiles[name];
  }

  async listProfiles(): Promise<{ activeProfile?: string; profiles: StoredHaloProfile[] }> {
    const config = await this.load();
    const profiles = Object.values(config.profiles).sort((left, right) =>
      left.name.localeCompare(right.name),
    );

    return {
      activeProfile: config.activeProfile,
      profiles,
    };
  }

  async setActiveProfile(name: string): Promise<StoredHaloProfile> {
    const config = await this.load();
    const profile = config.profiles[name];

    if (!profile) {
      throw new CliError(`Halo profile "${name}" does not exist.`);
    }

    config.activeProfile = name;
    await this.save(config);
    return profile;
  }

  async deleteProfile(
    name: string,
  ): Promise<{ profile: StoredHaloProfile; activeProfile?: string }> {
    const config = await this.load();
    const profile = config.profiles[name];

    if (!profile) {
      throw new CliError(`Halo profile "${name}" does not exist.`);
    }

    delete config.profiles[name];
    if (config.activeProfile === name) {
      delete config.activeProfile;
    }

    await this.save(config);

    try {
      await this.credentialStore.deleteProfileCredentials(name);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown keyring error.";
      throw new CliError(
        `Profile "${name}" was removed from config, but deleting its saved credentials failed: ${message}`,
      );
    }

    return {
      profile,
      activeProfile: config.activeProfile,
    };
  }

  async getActiveStoredProfile(explicitName?: string): Promise<StoredHaloProfile> {
    const config = await this.load();
    const profileName = explicitName ?? config.activeProfile;

    if (!profileName) {
      throw new CliError("No active Halo profile found. Run `halo auth login` first.");
    }

    const profile = config.profiles[profileName];
    if (!profile) {
      throw new CliError(`Halo profile "${profileName}" does not exist.`);
    }

    return profile;
  }

  async getActiveResolvedProfile(explicitName?: string): Promise<HaloProfile> {
    return this.resolveProfile(await this.getActiveStoredProfile(explicitName));
  }

  async inspectProfileCredentials(): Promise<ProfileCredentialDoctorReport> {
    const { activeProfile, profiles } = await this.listProfiles();
    const reportProfiles = await Promise.all(
      profiles.map(async (profile) => {
        const credentials = await this.credentialStore.getProfileCredentials(profile.name);

        let status: ProfileCredentialHealthStatus = "ok";
        if (!credentials) {
          status = "missing-credentials";
        } else if (credentials.type !== profile.auth.type) {
          status = "auth-type-mismatch";
        }

        return {
          name: profile.name,
          baseUrl: profile.baseUrl,
          authType: profile.auth.type,
          status,
        } satisfies ProfileCredentialHealth;
      }),
    );

    return {
      activeProfile,
      ok: reportProfiles.every((profile) => profile.status === "ok"),
      profiles: reportProfiles,
    };
  }

  private validateStoredProfiles(
    profiles: Record<string, ConfigFileStoredProfile>,
  ): Record<string, StoredHaloProfile> {
    const validatedProfiles: Record<string, StoredHaloProfile> = {};

    for (const [profileName, profile] of Object.entries(profiles)) {
      const name =
        typeof profile.name === "string" && profile.name.trim() ? profile.name : profileName;
      const baseUrl = profile.baseUrl?.trim();
      const createdAt = profile.createdAt?.trim();
      const updatedAt = profile.updatedAt?.trim();

      if (!baseUrl || !createdAt || !updatedAt) {
        throw new CliError(`Halo profile "${profileName}" is invalid in config.json.`);
      }

      if (
        profile.auth &&
        (typeof profile.auth.username === "string" ||
          typeof profile.auth.password === "string" ||
          typeof profile.auth.token === "string")
      ) {
        throw new CliError(
          `Halo profile "${profileName}" uses an unsupported legacy credential format in config.json. Run \`halo auth login --profile ${name}\` again to recreate it securely.`,
        );
      }

      const authType = profile.auth?.type;
      if (authType !== "basic" && authType !== "bearer") {
        throw new CliError(`Halo profile "${profileName}" is missing auth type information.`);
      }

      validatedProfiles[name] = {
        name,
        baseUrl,
        auth: {
          type: authType,
        },
        createdAt,
        updatedAt,
      };
    }

    return validatedProfiles;
  }

  private async resolveProfile(storedProfile: StoredHaloProfile): Promise<HaloProfile> {
    const credentials = await this.credentialStore.getProfileCredentials(storedProfile.name);

    if (!credentials || credentials.type !== storedProfile.auth.type) {
      throw new CliError(
        `Credentials for profile "${storedProfile.name}" are missing from the system keyring. Run \`halo auth login --profile ${storedProfile.name}\` again to restore them.`,
      );
    }

    return {
      ...storedProfile,
      auth: credentials,
    };
  }
}
