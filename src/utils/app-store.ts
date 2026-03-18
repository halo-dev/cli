import axios, { type AxiosInstance } from "axios";
import type { Plugin } from "@halo-dev/api-client";

import { CliError } from "./errors.js";
import { normalizeBaseUrl, type HaloClients } from "./runtime.js";

export const DEFAULT_APP_STORE_BASE_URL = "https://www.halo.run";
export const APP_STORE_PAT_SECRET_NAME = "halo-run-app-store-pat-secret";
export const STORE_APP_ID_ANNOTATION = "store.halo.run/app-id";

interface AppStoreReleaseAsset {
  metadata: {
    name: string;
  };
}

interface AppStoreReleaseRef {
  metadata?: {
    name?: string;
  };
}

interface AppStoreApplicationDetail {
  latestRelease?: {
    release?: AppStoreReleaseRef;
    assets?: AppStoreReleaseAsset[];
  };
}

interface AppStoreDownloadResponse {
  url?: string;
}

interface HaloActuatorInfo {
  build?: {
    name?: string;
  };
}

interface HaloProActivation {
  status?: {
    state?: string;
    activationCode?: string;
  };
}

export interface PluginUpgradeSourceOptions {
  url?: string;
  uri?: string;
  file?: string;
  online?: boolean;
}

export type PluginUpgradeSource =
  | { kind: "url"; url: string }
  | { kind: "file"; file: string }
  | { kind: "online" };

export function resolvePluginUpgradeSource(options: PluginUpgradeSourceOptions): PluginUpgradeSource {
  const url = options.url?.trim() || options.uri?.trim();
  const file = options.file?.trim();
  const online = Boolean(options.online);
  const sourceCount = Number(Boolean(url)) + Number(Boolean(file)) + Number(online);

  if (sourceCount === 0) {
    throw new CliError("Provide exactly one plugin upgrade source: --url, --file, or --online.");
  }

  if (sourceCount > 1) {
    throw new CliError("Use only one plugin upgrade source: --url, --file, or --online.");
  }

  if (url) {
    return { kind: "url", url };
  }

  if (file) {
    return { kind: "file", file };
  }

  return { kind: "online" };
}

export function resolvePluginAppStoreAppId(plugin: Pick<Plugin, "metadata">): string {
  const appId = plugin.metadata.annotations?.[STORE_APP_ID_ANNOTATION]?.trim();
  if (!appId) {
    throw new CliError(
      "This plugin is not linked to the Halo App Store. Missing metadata annotation `store.halo.run/app-id`, so `--online` cannot determine which app to upgrade.",
    );
  }

  return appId;
}

export async function getAppStoreToken(clients: HaloClients): Promise<string | undefined> {
  try {
    const response = await clients.core.secret.getSecret({ name: APP_STORE_PAT_SECRET_NAME });
    return response.data.stringData?.token?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export function formatHaloProAuthorizationToken(activationCode: string): string {
  const normalizedCode = activationCode.trim();
  if (!normalizedCode) {
    throw new CliError("Halo Pro activation code is empty.");
  }

  return `lxl_${normalizedCode.replace(/=/g, "")}`;
}

export async function getHaloProAuthorizationToken(clients: HaloClients): Promise<string | undefined> {
  try {
    const infoResponse = await clients.axios.get<HaloActuatorInfo>("/actuator/info");
    if (infoResponse.data.build?.name !== "halo-pro") {
      return undefined;
    }

    const activationResponse = await clients.axios.get<HaloProActivation[]>(
      "/apis/console.api.license.pro.halo.run/v1alpha1/activations",
    );

    const activationCode = activationResponse.data.find((item) => item.status?.state === "active")?.status?.activationCode;
    if (!activationCode) {
      return undefined;
    }

    return formatHaloProAuthorizationToken(activationCode);
  } catch {
    return undefined;
  }
}

export async function getAppStoreHeaders(clients: HaloClients): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const [token, haloProToken] = await Promise.all([
    getAppStoreToken(clients),
    getHaloProAuthorizationToken(clients),
  ]);

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (haloProToken) {
    headers["X-Authorization"] = `Bearer ${haloProToken}`;
  }

  return headers;
}

export async function createAppStoreClient(
  clients: HaloClients,
  baseUrl = process.env.HALO_APP_STORE_BASE_URL ?? DEFAULT_APP_STORE_BASE_URL,
): Promise<AxiosInstance> {
  const headers = await getAppStoreHeaders(clients);

  return axios.create({
    baseURL: normalizeBaseUrl(baseUrl),
    timeout: 30_000,
    headers,
  });
}

export async function resolveLatestAppStoreDownloadUrl(
  appStoreClient: AxiosInstance,
  appId: string,
): Promise<string> {
  const appName = appId.trim();
  if (!appName) {
    throw new CliError("Halo App Store app id is empty.");
  }

  const appDetailResponse = await appStoreClient.get<AppStoreApplicationDetail>(
    `/apis/api.store.halo.run/v1alpha1/applications/${appName}`,
  );

  const releaseName = appDetailResponse.data.latestRelease?.release?.metadata?.name;
  const assetName = appDetailResponse.data.latestRelease?.assets?.[0]?.metadata?.name;

  if (!releaseName || !assetName) {
    throw new CliError("The Halo App Store entry does not have an installable latest release.");
  }

  const downloadResponse = await appStoreClient.get<AppStoreDownloadResponse>(
    `/apis/api.store.halo.run/v1alpha1/applications/${appName}/releases/${releaseName}/download/${assetName}`,
  );

  const downloadUrl = downloadResponse.data.url?.trim();
  if (!downloadUrl) {
    throw new CliError("The Halo App Store did not return a downloadable asset URL.");
  }

  return downloadUrl;
}