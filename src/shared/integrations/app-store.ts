import type { Plugin, Theme } from "@halo-dev/api-client";
import { confirm, input } from "@inquirer/prompts";
import axios, { type AxiosInstance } from "axios";
import semver from "semver";

import { CliError } from "../../utils/errors.js";
import type { HaloClients } from "../../utils/runtime.js";
import { normalizeBaseUrl } from "../../utils/url.js";

export const DEFAULT_APP_STORE_BASE_URL = "https://www.halo.run";
export const APP_STORE_PAT_SECRET_NAME = "halo-run-app-store-pat-secret";
export const STORE_APP_ID_ANNOTATION = "store.halo.run/app-id";
const APP_STORE_AUX_REQUEST_TIMEOUT_MS = 8_000;

export interface PluginUpdateInfo {
  latestVersion: string;
  compatible: boolean;
}

export interface ThemeUpdateInfo {
  latestVersion: string;
  compatible: boolean;
}

export interface AppStoreLatestRelease {
  appName: string;
  releaseName: string;
  releaseUrl: string;
  downloadUrl: string;
}

export interface AppStoreReleaseConfirmationOptions {
  json?: boolean;
  yes?: boolean;
}

interface AppStoreReleaseConfirmationItem {
  name: string;
  releaseUrl: string;
}

interface AppStoreReleaseConfirmationConfig {
  commandPath: string;
  actionLabel: string;
  items: AppStoreReleaseConfirmationItem[];
  requireTypedYes?: boolean;
}

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

interface AppStoreApplicationSearchResultList {
  items: AppStoreApplicationSearchResult[];
}

interface AppStoreApplicationSearchResult {
  downloadable?: boolean;
  application?: {
    metadata?: {
      name?: string;
    };
  };
  latestRelease?: {
    spec?: {
      version?: string;
      requires?: string;
    };
  };
}

interface HaloActuatorInfo {
  build?: {
    name?: string;
    version?: string;
  };
}

interface HaloProActivation {
  status?: {
    state?: string;
    activationCode?: string;
  };
}

export interface UpgradeSourceOptions {
  url?: string;
  file?: string;
  online?: boolean;
}

/** @deprecated Use UpgradeSourceOptions instead */
export type PluginUpgradeSourceOptions = UpgradeSourceOptions;

export type UpgradeSource =
  | { kind: "url"; url: string }
  | { kind: "file"; file: string }
  | { kind: "online" };

/** @deprecated Use UpgradeSource instead */
export type PluginUpgradeSource = UpgradeSource;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function resolveUpgradeSource(
  options: UpgradeSourceOptions,
  resourceName = "plugin",
): UpgradeSource {
  const url = options.url?.trim();
  const file = options.file?.trim();
  const online = Boolean(options.online);
  const sourceCount = Number(Boolean(url)) + Number(Boolean(file)) + Number(online);

  if (sourceCount === 0) {
    throw new CliError(
      `Provide exactly one ${resourceName} upgrade source: --url, --file, or --online.`,
    );
  }

  if (sourceCount > 1) {
    throw new CliError(`Use only one ${resourceName} upgrade source: --url, --file, or --online.`);
  }

  if (url) {
    return { kind: "url", url };
  }

  if (file) {
    return { kind: "file", file };
  }

  return { kind: "online" };
}

export function resolvePluginUpgradeSource(options: UpgradeSourceOptions): UpgradeSource {
  return resolveUpgradeSource(options, "plugin");
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

export function resolveThemeAppStoreAppId(theme: Pick<Theme, "metadata">): string {
  const appId = theme.metadata.annotations?.[STORE_APP_ID_ANNOTATION]?.trim();
  if (!appId) {
    throw new CliError(
      "This theme is not linked to the Halo App Store. Missing metadata annotation `store.halo.run/app-id`, so `--online` cannot determine which app to upgrade.",
    );
  }

  return appId;
}

export async function getAppStoreToken(clients: HaloClients): Promise<string | undefined> {
  try {
    const response = await withTimeout(
      clients.core.secret.getSecret({ name: APP_STORE_PAT_SECRET_NAME }),
      APP_STORE_AUX_REQUEST_TIMEOUT_MS,
    );
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

export function satisfiesRequires(version?: string, requires?: string): boolean {
  if (!version || !requires) {
    return true;
  }

  const normalizedVersion = version.replace(/-.+$/, "");
  let normalizedRequires = requires.trim();

  if (/^\d+\.\d+\.\d+$/.test(normalizedRequires)) {
    normalizedRequires = `>=${normalizedRequires}`;
  }

  return semver.satisfies(normalizedVersion, normalizedRequires, {
    includePrerelease: true,
  });
}

export function resolvePluginUpdateInfo(
  currentVersion?: string,
  latestVersion?: string,
  haloVersion?: string,
  requires?: string,
): PluginUpdateInfo | undefined {
  if (!currentVersion || !latestVersion) {
    return undefined;
  }

  if (!semver.valid(currentVersion) || !semver.valid(latestVersion)) {
    return undefined;
  }

  if (!semver.lt(currentVersion, latestVersion)) {
    return undefined;
  }

  return {
    latestVersion,
    compatible: satisfiesRequires(haloVersion, requires),
  };
}

export function resolveThemeUpdateInfo(
  currentVersion?: string,
  latestVersion?: string,
  haloVersion?: string,
  requires?: string,
): ThemeUpdateInfo | undefined {
  return resolvePluginUpdateInfo(currentVersion, latestVersion, haloVersion, requires);
}

export async function getHaloSystemInfo(
  clients: HaloClients,
): Promise<HaloActuatorInfo | undefined> {
  try {
    const response = await withTimeout(
      clients.axios.get<HaloActuatorInfo>("/actuator/info"),
      APP_STORE_AUX_REQUEST_TIMEOUT_MS,
    );
    return response.data;
  } catch {
    return undefined;
  }
}

export async function getHaloProAuthorizationToken(
  clients: HaloClients,
): Promise<string | undefined> {
  try {
    const info = await getHaloSystemInfo(clients);
    if (info?.build?.name !== "halo-pro") {
      return undefined;
    }

    const activationResponse = await withTimeout(
      clients.axios.get<HaloProActivation[]>(
        "/apis/console.api.license.pro.halo.run/v1alpha1/activations",
      ),
      APP_STORE_AUX_REQUEST_TIMEOUT_MS,
    );

    const activationCode = activationResponse.data.find((item) => item.status?.state === "active")
      ?.status?.activationCode;
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
    paramsSerializer: (params) => {
      const searchParams = new URLSearchParams();
      const serializeQueryParam = (value: unknown): string => {
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean" ||
          typeof value === "bigint"
        ) {
          return String(value);
        }

        return JSON.stringify(value);
      };

      for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
        if (value === undefined || value === null) {
          continue;
        }

        if (Array.isArray(value)) {
          for (const item of value) {
            if (item !== undefined && item !== null) {
              searchParams.append(key, serializeQueryParam(item));
            }
          }
          continue;
        }

        searchParams.append(key, serializeQueryParam(value));
      }

      return searchParams.toString();
    },
  });
}

export async function resolvePluginUpdates(
  clients: HaloClients,
  plugins: Plugin[],
): Promise<Map<string, PluginUpdateInfo>> {
  const appIds = [
    ...new Set(
      plugins
        .map((plugin) => plugin.metadata.annotations?.[STORE_APP_ID_ANNOTATION])
        .filter(Boolean),
    ),
  ];
  if (appIds.length === 0) {
    return new Map();
  }

  try {
    const [info, appStoreClient] = await Promise.all([
      getHaloSystemInfo(clients),
      createAppStoreClient(clients),
    ]);

    const haloVersion = info?.build?.version;
    const response = await appStoreClient.get<AppStoreApplicationSearchResultList>(
      "/apis/api.store.halo.run/v1alpha1/applications",
      {
        params: {
          type: "PLUGIN",
          names: appIds,
        },
      },
    );

    const appsById = new Map(
      response.data.items.map((item) => [item.application?.metadata?.name, item] as const),
    );

    const updates = new Map<string, PluginUpdateInfo>();
    for (const plugin of plugins) {
      const appId = plugin.metadata.annotations?.[STORE_APP_ID_ANNOTATION];
      if (!appId) {
        continue;
      }

      const app = appsById.get(appId);
      if (!app?.downloadable) {
        continue;
      }

      const latestVersion = app.latestRelease?.spec?.version;
      const requires = app.latestRelease?.spec?.requires;
      const update = resolvePluginUpdateInfo(
        plugin.spec.version,
        latestVersion,
        haloVersion,
        requires,
      );

      if (update) {
        updates.set(plugin.metadata.name, update);
      }
    }

    return updates;
  } catch {
    return new Map();
  }
}

export async function resolveThemeUpdates(
  clients: HaloClients,
  themes: Theme[],
): Promise<Map<string, ThemeUpdateInfo>> {
  const appIds = [
    ...new Set(
      themes.map((theme) => theme.metadata.annotations?.[STORE_APP_ID_ANNOTATION]).filter(Boolean),
    ),
  ];
  if (appIds.length === 0) {
    return new Map();
  }

  try {
    const [info, appStoreClient] = await Promise.all([
      getHaloSystemInfo(clients),
      createAppStoreClient(clients),
    ]);

    const haloVersion = info?.build?.version;
    const response = await appStoreClient.get<AppStoreApplicationSearchResultList>(
      "/apis/api.store.halo.run/v1alpha1/applications",
      {
        params: {
          type: "THEME",
          names: appIds,
        },
      },
    );

    const appsById = new Map(
      response.data.items.map((item) => [item.application?.metadata?.name, item] as const),
    );

    const updates = new Map<string, ThemeUpdateInfo>();
    for (const theme of themes) {
      const appId = theme.metadata.annotations?.[STORE_APP_ID_ANNOTATION];
      if (!appId) {
        continue;
      }

      const app = appsById.get(appId);
      if (!app?.downloadable) {
        continue;
      }

      const latestVersion = app.latestRelease?.spec?.version;
      const requires = app.latestRelease?.spec?.requires;
      const update = resolveThemeUpdateInfo(
        theme.spec.version,
        latestVersion,
        haloVersion,
        requires,
      );

      if (update) {
        updates.set(theme.metadata.name, update);
      }
    }

    return updates;
  } catch {
    return new Map();
  }
}

export async function resolveLatestAppStoreDownloadUrl(
  appStoreClient: AxiosInstance,
  appId: string,
): Promise<string> {
  const release = await resolveLatestAppStoreRelease(appStoreClient, appId);
  return release.downloadUrl;
}

export function buildAppStoreReleaseUrl(
  appName: string,
  releaseName: string,
  baseUrl = DEFAULT_APP_STORE_BASE_URL,
): string {
  const normalizedAppName = appName.trim();
  const normalizedReleaseName = releaseName.trim();

  if (!normalizedAppName) {
    throw new CliError("Halo App Store app id is empty.");
  }

  if (!normalizedReleaseName) {
    throw new CliError("Halo App Store release name is empty.");
  }

  return `${normalizeBaseUrl(baseUrl)}/store/apps/${normalizedAppName}/releases/${normalizedReleaseName}`;
}

export async function resolveLatestAppStoreRelease(
  appStoreClient: AxiosInstance,
  appId: string,
): Promise<AppStoreLatestRelease> {
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

  return {
    appName,
    releaseName,
    releaseUrl: buildAppStoreReleaseUrl(appName, releaseName),
    downloadUrl,
  };
}

export async function confirmAppStoreReleaseReview(
  config: AppStoreReleaseConfirmationConfig,
  options: AppStoreReleaseConfirmationOptions,
): Promise<boolean> {
  if (options.yes) {
    return true;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new CliError(
      `\`${config.commandPath}\` requires confirmation in interactive mode after reviewing release notes.`,
    );
  }

  process.stdout.write("Release notes:\n");
  for (const item of config.items) {
    process.stdout.write(`- ${item.name}: ${item.releaseUrl}\n`);
  }

  const confirmed = await confirm({
    message: `Have you reviewed the ${config.items.length === 1 ? "release notes above" : "release notes above for all selected items"}?`,
    default: false,
  });

  if (!confirmed) {
    if (!options.json) {
      process.stdout.write(`Cancelled ${config.actionLabel}.\n`);
    }
    return false;
  }

  if (!config.requireTypedYes) {
    return true;
  }

  const answer = await input({
    message: "Type `y` to continue upgrading, or anything else to cancel",
  });

  if (answer.trim().toLowerCase() === "y") {
    return true;
  }

  if (!options.json) {
    process.stdout.write(`Cancelled ${config.actionLabel}.\n`);
  }

  return false;
}
