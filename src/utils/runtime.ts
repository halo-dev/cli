import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import {
  createConsoleApiClient,
  createCoreApiClient,
  type DetailedUser,
} from "@halo-dev/api-client";
import axios, { type AxiosInstance } from "axios";

import type { CommandOptions, HaloProfile } from "../types.js";
import { ConfigStore } from "./config-store.js";
import { CliError } from "./errors.js";

export interface HaloClients {
  axios: AxiosInstance;
  console: ReturnType<typeof createConsoleApiClient>;
  core: ReturnType<typeof createCoreApiClient>;
}

export interface PackageFileOptions {
  type: string;
  fileName?: string;
}

export function normalizeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(normalized)) {
    throw new CliError("Halo base URL must start with http:// or https://.");
  }
  return normalized;
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

export async function loadFileAsPackage(
  filePath: string,
  options: PackageFileOptions,
): Promise<File> {
  const buffer = await readFile(filePath);
  return new File([buffer], options.fileName ?? basename(filePath), {
    type: options.type,
  });
}

export async function loadFileAsJar(filePath: string): Promise<File> {
  return loadFileAsPackage(filePath, {
    type: "application/java-archive",
  });
}

export async function loadFileAsZip(filePath: string): Promise<File> {
  return loadFileAsPackage(filePath, {
    type: "application/zip",
  });
}

export class RuntimeContext {
  readonly configStore: ConfigStore;

  constructor(configStore = new ConfigStore()) {
    this.configStore = configStore;
  }

  async getProfile(options?: CommandOptions): Promise<HaloProfile> {
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
    options?: CommandOptions,
  ): Promise<{ profile: HaloProfile; clients: HaloClients }> {
    const profile = await this.getProfile(options);
    return {
      profile,
      clients: this.getClients(profile),
    };
  }

  async validateProfile(profile: HaloProfile): Promise<DetailedUser> {
    const clients = this.getClients(profile);
    const response = await clients.console.user.getCurrentUserDetail();
    return response.data;
  }
}
