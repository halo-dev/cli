import axios from "axios";

import type { HaloProfile } from "../../shared/profile.js";
import { CliError } from "../../utils/errors.js";
import { RuntimeContext, type HaloClients } from "../../utils/runtime.js";
import { ShopApi } from "./api.js";
import type { LicenseActivation } from "./types.js";

const COMMERCIAL_PRODUCT_NAMES = new Set(["product-halo-commercial", "product-halo-pro"]);

export interface ShopStatusOptions {
  profile?: string;
  json?: boolean;
}

interface HaloActuatorInfo {
  build?: {
    name?: string;
    version?: string;
  };
}

export interface ShopStatusResult {
  profile: string;
  baseUrl: string;
  edition: string;
  version?: string;
  commercialActivated: boolean;
  activationState?: string;
  shopApiAvailable: boolean;
}

export type ShopApiProbeStatus = "available" | "denied" | "unavailable" | "unknown";

export interface ResolvedShopRuntime {
  profile: HaloProfile;
  clients: HaloClients;
}

export interface ShopStatusInspection {
  status: ShopStatusResult;
  shopApiStatus: ShopApiProbeStatus;
  shopApiError?: unknown;
  resolved: ResolvedShopRuntime;
}

export function isNotFoundError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

export function isForbiddenError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 403;
}

export function isUnauthorizedError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

function isShopApiUnavailableError(error: unknown): boolean {
  return error instanceof CliError && error.message.startsWith("Shop API is not available");
}

export async function resolveShopStatus(
  runtime: RuntimeContext,
  options: ShopStatusOptions,
): Promise<ShopStatusResult> {
  const inspection = await inspectShopStatus(runtime, options);
  if (inspection.shopApiStatus === "unknown" && inspection.shopApiError !== undefined) {
    throw inspection.shopApiError;
  }
  return inspection.status;
}

export async function inspectShopStatus(
  runtime: RuntimeContext,
  options: ShopStatusOptions,
  resolved?: ResolvedShopRuntime,
): Promise<ShopStatusInspection> {
  const context = resolved ?? (await runtime.getClientsForOptions(options));
  const { profile, clients } = context;

  let info: HaloActuatorInfo | undefined;
  try {
    const response = await clients.axios.get<HaloActuatorInfo>("/actuator/info");
    info = response.data;
  } catch (error) {
    // Older or restricted instances may not expose actuator info.
    if (!isNotFoundError(error) && !isForbiddenError(error)) {
      throw error;
    }
  }

  let activation: LicenseActivation | undefined;
  try {
    const response = await clients.axios.get<LicenseActivation[]>(
      "/apis/console.api.license.pro.halo.run/v1alpha1/activations",
    );
    activation =
      response.data.find(
        (item) =>
          COMMERCIAL_PRODUCT_NAMES.has(item.spec?.productName ?? "") &&
          item.status?.state === "active",
      ) ?? response.data.find((item) => COMMERCIAL_PRODUCT_NAMES.has(item.spec?.productName ?? ""));
  } catch (error) {
    // Non-Pro instances do not expose the license API, and limited tokens may
    // not be allowed to read it.
    if (!isNotFoundError(error) && !isForbiddenError(error)) {
      throw error;
    }
  }

  let shopApiStatus: ShopApiProbeStatus = "unknown";
  let shopApiError: unknown;
  try {
    await new ShopApi(clients.axios).listProducts({ page: 1, size: 1 });
    shopApiStatus = "available";
  } catch (error) {
    if (isUnauthorizedError(error)) {
      throw error;
    }
    if (isForbiddenError(error)) {
      shopApiStatus = "denied";
      shopApiError = error;
    } else if (isNotFoundError(error) || isShopApiUnavailableError(error)) {
      shopApiStatus = "unavailable";
    } else {
      // A server error does not prove the shop API is absent. Keep the status
      // unknown so callers can still report the failure and continue probing.
      shopApiError = error;
    }
  }

  return {
    status: {
      profile: profile.name,
      baseUrl: profile.baseUrl,
      edition: info?.build?.name ?? "unknown",
      version: info?.build?.version,
      commercialActivated: activation?.status?.state === "active",
      activationState: activation?.status?.state,
      shopApiAvailable: shopApiStatus === "available",
    },
    shopApiStatus,
    shopApiError,
    resolved: context,
  };
}
