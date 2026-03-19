import { createConsoleApiClient, createCoreApiClient } from "@halo-dev/api-client";
import axios, { type AxiosInstance } from "axios";

import type { HaloProfile } from "../shared/profile.js";
import { ConfigStore } from "./config-store.js";
import { normalizeBaseUrl } from "./url.js";

export interface HaloClients {
  axios: AxiosInstance;
  console: ReturnType<typeof createConsoleApiClient>;
  core: ReturnType<typeof createCoreApiClient>;
}

export interface ProfileSelectionOptions {
  profile?: string;
}

export function buildAuthHeader(profile: HaloProfile): string {
  if (profile.auth.type === "basic") {
    const token = Buffer.from(`${profile.auth.username}:${profile.auth.password}`, "utf8").toString(
      "base64",
    );
    return `Basic ${token}`;
  }

  return `Bearer ${profile.auth.token}`;
}

function createAxiosClient(profile: HaloProfile): AxiosInstance {
  return axios.create({
    baseURL: normalizeBaseUrl(profile.baseUrl),
    timeout: 30_000,
    maxBodyLength: Infinity,
    headers: {
      Accept: "application/json",
      Authorization: buildAuthHeader(profile),
    },
  });
}

export class RuntimeContext {
  readonly configStore: ConfigStore;

  constructor(configStore = new ConfigStore()) {
    this.configStore = configStore;
  }

  async getProfile(options?: ProfileSelectionOptions): Promise<HaloProfile> {
    return this.configStore.getActiveProfile(options?.profile);
  }

  getClients(profile: HaloProfile): HaloClients {
    const axiosInstance = createAxiosClient(profile);
    return {
      axios: axiosInstance,
      console: createConsoleApiClient(axiosInstance),
      core: createCoreApiClient(axiosInstance),
    };
  }

  async getClientsForOptions(
    options?: ProfileSelectionOptions,
  ): Promise<{ profile: HaloProfile; clients: HaloClients }> {
    const profile = await this.getProfile(options);
    return {
      profile,
      clients: this.getClients(profile),
    };
  }
}
