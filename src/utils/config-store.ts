import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { HaloConfig, HaloProfile } from "../types.js";
import { CliError } from "./errors.js";

const DEFAULT_CONFIG: HaloConfig = {
  profiles: {},
};

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

  constructor(configPath = join(resolveConfigRoot(), "config.json")) {
    this.configPath = configPath;
  }

  async load(): Promise<HaloConfig> {
    try {
      const raw = await readFile(this.configPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<HaloConfig>;
      return {
        activeProfile: parsed.activeProfile,
        profiles: parsed.profiles ?? {},
      };
    } catch (error) {
      const maybeNodeError = error as NodeJS.ErrnoException;
      if (maybeNodeError.code === "ENOENT") {
        return { ...DEFAULT_CONFIG };
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
    config.profiles[profile.name] = profile;
    if (setActive) {
      config.activeProfile = profile.name;
    }
    await this.save(config);
    return config;
  }

  async getProfile(name: string): Promise<HaloProfile | undefined> {
    const config = await this.load();
    return config.profiles[name];
  }

  async listProfiles(): Promise<{ activeProfile?: string; profiles: HaloProfile[] }> {
    const config = await this.load();
    const profiles = Object.values(config.profiles).sort((left, right) => left.name.localeCompare(right.name));

    return {
      activeProfile: config.activeProfile,
      profiles,
    };
  }

  async setActiveProfile(name: string): Promise<HaloProfile> {
    const config = await this.load();
    const profile = config.profiles[name];

    if (!profile) {
      throw new CliError(`Halo profile \"${name}\" does not exist.`);
    }

    config.activeProfile = name;
    await this.save(config);
    return profile;
  }

  async getActiveProfile(explicitName?: string): Promise<HaloProfile> {
    const config = await this.load();
    const profileName = explicitName ?? config.activeProfile;

    if (!profileName) {
      throw new CliError("No active Halo profile found. Run `halo auth login` first.");
    }

    const profile = config.profiles[profileName];
    if (!profile) {
      throw new CliError(`Halo profile \"${profileName}\" does not exist.`);
    }

    return profile;
  }
}

export function createProfileTimestamp(existing?: HaloProfile): { createdAt: string; updatedAt: string } {
  const now = new Date().toISOString();
  return {
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}