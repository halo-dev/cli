import type { AxiosInstance } from "axios";

import { RuntimeContext } from "../../utils/runtime.js";
import {
  inspectShopStatus,
  isForbiddenError,
  isNotFoundError,
  isUnauthorizedError,
  type ShopApiProbeStatus,
  type ShopStatusOptions,
} from "./status.js";

const SHOP_API_BASE = "/apis/console.api.ecommerce.halo.run/v1alpha1";
const ECOMMERCE_API_GROUP = "console.api.ecommerce.halo.run";
const PERMISSIONS_PATH = "/apis/uc.api.halo.run/v1alpha1/users/-/permissions";

const SHOP_FEATURES = [
  "products",
  "categories",
  "orders",
  "customers",
  "coupons",
  "discounts",
  "digitalResources",
  "virtualDelivery",
  "cdks",
  "subscriptions",
  "statistics",
  "config",
  "paymentProviders",
  "paymentMethods",
  "shippingProfiles",
  "salesChannels",
  "fulfillmentMethods",
  "specTemplates",
] as const;

export type ShopFeature = (typeof SHOP_FEATURES)[number];

const CONFIGURATION_KEYS = [
  "paymentProviders",
  "paymentMethods",
  "shippingProfiles",
  "salesChannels",
  "fulfillmentMethods",
  "specTemplates",
] as const;

type ConfigurationKey = (typeof CONFIGURATION_KEYS)[number];

export type ShopDoctorWarning = {
  code: string;
  message: string;
};

export interface ShopDoctorResult {
  profile: string;
  baseUrl: string;
  edition: string;
  version?: string;
  commercialActivated: boolean;
  activationState?: string;
  shopApiAvailable: boolean;
  shopApiStatus: ShopApiProbeStatus;
  features: Record<ShopFeature, boolean>;
  permissions: {
    roles: string[];
    read: Record<ShopFeature, boolean>;
    write: Record<ShopFeature, boolean | null>;
  };
  configuration: Record<ConfigurationKey, number | null>;
  warnings: ShopDoctorWarning[];
}

interface ShopProbe {
  key: ShopFeature;
  label: string;
  path: string;
  permission: string;
  required?: boolean;
  configuration?: ConfigurationKey;
}

const PRODUCT_PROBE: ShopProbe = {
  key: "products",
  label: "products",
  path: "/products?page=1&size=1",
  permission: "products",
  required: true,
};

const SHOP_PROBES: ShopProbe[] = [
  {
    key: "categories",
    label: "product categories",
    path: "/product-categories?tree=false",
    permission: "product-categories",
    required: true,
  },
  {
    key: "orders",
    label: "orders",
    path: "/orders?page=1&size=1",
    permission: "orders",
    required: true,
  },
  {
    key: "customers",
    label: "customers",
    path: "/customers?page=1&size=1",
    permission: "customers",
    required: true,
  },
  {
    key: "coupons",
    label: "coupons",
    path: "/coupons?page=1&size=1",
    permission: "coupons",
    required: true,
  },
  {
    key: "discounts",
    label: "discounts",
    path: "/discounts?page=1&size=1",
    permission: "discounts",
    required: true,
  },
  {
    key: "digitalResources",
    label: "digital resources",
    path: "/digital-resources",
    permission: "digital-resources",
  },
  {
    key: "virtualDelivery",
    label: "virtual delivery configurations",
    path: "/virtual-delivery-configs",
    permission: "virtual-delivery-configs",
  },
  {
    key: "cdks",
    label: "CDKs",
    path: "/cdks?page=1&size=1",
    permission: "cdks",
  },
  {
    key: "subscriptions",
    label: "subscriptions",
    path: "/subscriptions?page=1&size=1",
    permission: "subscriptions",
  },
  {
    key: "statistics",
    label: "shop statistics",
    path: "/statistics/orders/daily",
    permission: "statistics",
    required: true,
  },
  {
    key: "config",
    label: "shop configuration",
    path: "/ecommerceconfigs/shop",
    permission: "ecommerceconfigs",
    required: true,
  },
  {
    key: "paymentProviders",
    label: "payment providers",
    path: "/payment-providers",
    permission: "payment-providers",
    configuration: "paymentProviders",
  },
  {
    key: "paymentMethods",
    label: "payment methods",
    path: "/payment-methods",
    permission: "payment-methods",
    configuration: "paymentMethods",
  },
  {
    key: "shippingProfiles",
    label: "shipping profiles",
    path: "/shipping-profiles",
    permission: "shipping-profiles",
    configuration: "shippingProfiles",
  },
  {
    key: "salesChannels",
    label: "sales channels",
    path: "/sales-channels",
    permission: "sales-channels",
    configuration: "salesChannels",
  },
  {
    key: "fulfillmentMethods",
    label: "fulfillment methods",
    path: "/fulfillment-methods",
    permission: "fulfillment-methods",
    configuration: "fulfillmentMethods",
  },
  {
    key: "specTemplates",
    label: "product spec templates",
    path: "/product-spec-templates?page=1&size=1",
    permission: "product-spec-templates",
    configuration: "specTemplates",
  },
];

interface RoleRule {
  apiGroups?: string[];
  resources?: string[];
  verbs?: string[];
}

interface RoleLike {
  metadata?: {
    name?: string;
  };
  rules?: RoleRule[];
}

interface PermissionsResponse {
  roles?: RoleLike[];
  permissions?: RoleLike[];
  uiPermissions?: string[];
}

interface ProbeOutcome {
  ok: boolean;
  status?: number;
  count?: number;
  unexpected?: boolean;
}

function emptyFeatures(): Record<ShopFeature, boolean> {
  return Object.fromEntries(SHOP_FEATURES.map((key) => [key, false])) as Record<
    ShopFeature,
    boolean
  >;
}

function emptyConfiguration(): Record<ConfigurationKey, number | null> {
  return Object.fromEntries(CONFIGURATION_KEYS.map((key) => [key, null])) as Record<
    ConfigurationKey,
    number | null
  >;
}

function readCount(data: unknown): number | undefined {
  if (Array.isArray(data)) {
    return data.length;
  }
  if (data && typeof data === "object") {
    const value = data as Record<string, unknown>;
    if (Array.isArray(value.content)) {
      return typeof value.totalElements === "number" ? value.totalElements : value.content.length;
    }
    if (typeof value.totalElements === "number") {
      return value.totalElements;
    }
  }
  return undefined;
}

function responseStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } }).response?.status;
}

async function probeShopEndpoint(axios: AxiosInstance, probe: ShopProbe): Promise<ProbeOutcome> {
  try {
    const response = await axios.get(`${SHOP_API_BASE}${probe.path}`);
    return { ok: true, count: readCount(response.data) };
  } catch (error) {
    if (isNotFoundError(error)) {
      return { ok: false, status: 404 };
    }
    if (isForbiddenError(error)) {
      return { ok: false, status: 403 };
    }
    if (isUnauthorizedError(error)) {
      throw error;
    }
    return { ok: false, status: responseStatus(error), unexpected: true };
  }
}

function hasPermission(rules: RoleRule[], resource: string, verbs: string[]): boolean {
  return rules.some((rule) => {
    const groups = rule.apiGroups ?? [];
    const resources = rule.resources ?? [];
    const ruleVerbs = rule.verbs ?? [];

    const groupMatches = groups.includes("*") || groups.includes(ECOMMERCE_API_GROUP);
    const resourceMatches = resources.some(
      (candidate) =>
        candidate === "*" ||
        candidate === resource ||
        candidate.startsWith(`${resource}/`) ||
        candidate.startsWith("*/"),
    );
    const verbMatches = ruleVerbs.includes("*") || verbs.some((verb) => ruleVerbs.includes(verb));

    return groupMatches && resourceMatches && verbMatches;
  });
}

async function resolvePermissions(
  axios: AxiosInstance,
): Promise<{ data?: PermissionsResponse; unavailable: boolean; status?: number }> {
  try {
    const response = await axios.get(PERMISSIONS_PATH);
    return { data: response.data as PermissionsResponse, unavailable: false };
  } catch (error) {
    if (isUnauthorizedError(error)) {
      throw error;
    }
    return { unavailable: true, status: responseStatus(error) };
  }
}

export async function resolveShopDoctor(
  runtime: RuntimeContext,
  options: ShopStatusOptions,
): Promise<ShopDoctorResult> {
  const inspection = await inspectShopStatus(runtime, options);
  const { status, shopApiStatus } = inspection;
  const { clients } = inspection.resolved;
  const features = emptyFeatures();
  const configuration = emptyConfiguration();
  const warnings: ShopDoctorWarning[] = [];
  const permissions: ShopDoctorResult["permissions"] = {
    roles: [],
    read: emptyFeatures(),
    write: Object.fromEntries(SHOP_FEATURES.map((key) => [key, null])) as Record<
      ShopFeature,
      boolean | null
    >,
  };

  if (shopApiStatus === "unavailable") {
    warnings.push({
      code: "SHOP_API_UNAVAILABLE",
      message:
        "The shop API is not available. Shop commands require Halo Pro or Halo Commercial with the ecommerce feature enabled.",
    });
    return {
      ...status,
      shopApiStatus,
      features,
      permissions,
      configuration,
      warnings,
    };
  }

  const productsProbe: ProbeOutcome =
    shopApiStatus === "available"
      ? { ok: true }
      : shopApiStatus === "denied"
        ? { ok: false, status: 403 }
        : { ok: false, unexpected: true, status: responseStatus(inspection.shopApiError) };

  const [permissionsResult, ...outcomes] = await Promise.all([
    resolvePermissions(clients.axios),
    ...SHOP_PROBES.map((probe) => probeShopEndpoint(clients.axios, probe)),
  ]);

  const permissionsData = permissionsResult.data;
  const permissionRoles = [
    ...(permissionsData?.roles ?? []),
    ...(permissionsData?.permissions ?? []),
  ];
  const rules = permissionRoles.flatMap((role) => role.rules ?? []);
  const roleNames = (permissionsData?.roles ?? [])
    .map((role) => role.metadata?.name)
    .filter((name): name is string => typeof name === "string" && name.length > 0)
    .sort();
  const writeUnknown = permissionsResult.unavailable;

  permissions.roles = roleNames;

  if (writeUnknown) {
    const statusSuffix = permissionsResult.status ? ` (HTTP ${permissionsResult.status})` : "";
    warnings.push({
      code: "PERMISSIONS_UNAVAILABLE",
      message: `Unable to read the current user's permissions${statusSuffix}; write access is unknown.`,
    });
  }

  const probes = [PRODUCT_PROBE, ...SHOP_PROBES];
  for (const [index, outcome] of [productsProbe, ...outcomes].entries()) {
    const probe = probes[index]!;
    features[probe.key] = outcome.ok;
    permissions.read[probe.key] = outcome.ok;

    if (!writeUnknown) {
      permissions.write[probe.key] = hasPermission(rules, probe.permission, [
        "create",
        "update",
        "patch",
        "delete",
      ]);
    }

    if (outcome.ok) {
      if (probe.configuration !== undefined && outcome.count !== undefined) {
        configuration[probe.configuration] = outcome.count;
      }
      continue;
    }

    if (outcome.status === 403) {
      warnings.push({
        code: "PERMISSION_DENIED",
        message: `Permission denied while checking ${probe.label}.`,
      });
      continue;
    }

    if (outcome.status === 404 && probe.required) {
      warnings.push({
        code: "RESOURCE_UNAVAILABLE",
        message: `The shop API does not expose ${probe.label}.`,
      });
    }

    if (outcome.unexpected || outcome.status === undefined) {
      warnings.push({
        code: "PROBE_FAILED",
        message: `Failed to check ${probe.label}${outcome.status ? ` (HTTP ${outcome.status})` : ""}.`,
      });
    }
  }

  if (!writeUnknown && SHOP_FEATURES.every((key) => permissions.write[key] === false)) {
    warnings.push({
      code: "READ_ONLY_ACCESS",
      message: "The current user has no write permissions for any shop resource.",
    });
  }

  if (status.activationState === undefined) {
    warnings.push({
      code: "ACTIVATION_UNKNOWN",
      message: "Unable to read the Halo Pro or Halo Commercial activation state.",
    });
  } else if (!status.commercialActivated) {
    warnings.push({
      code: "COMMERCIAL_NOT_ACTIVATED",
      message: "Halo Pro or Halo Commercial is not activated.",
    });
  }

  const configurationWarnings: Array<[ConfigurationKey, string, string]> = [
    ["paymentProviders", "NO_PAYMENT_PROVIDERS", "No payment providers are available."],
    ["paymentMethods", "NO_PAYMENT_METHODS", "No payment methods are configured."],
    ["shippingProfiles", "NO_SHIPPING_PROFILES", "No shipping profiles are configured."],
    ["salesChannels", "NO_SALES_CHANNELS", "No sales channels are configured."],
    ["fulfillmentMethods", "NO_FULFILLMENT_METHODS", "No fulfillment methods are configured."],
  ];
  for (const [key, code, message] of configurationWarnings) {
    if (configuration[key] === 0) {
      warnings.push({ code, message });
    }
  }

  warnings.sort((left, right) => left.code.localeCompare(right.code));

  return {
    ...status,
    shopApiStatus,
    features,
    permissions,
    configuration,
    warnings,
  };
}

export function printShopDoctor(result: ShopDoctorResult): void {
  process.stdout.write(`profile: ${result.profile} -> ${result.baseUrl}\n`);
  process.stdout.write(`edition: ${result.edition}\n`);
  if (result.version) {
    process.stdout.write(`version: ${result.version}\n`);
  }
  const activation =
    result.activationState === undefined ? "unknown" : result.commercialActivated ? "yes" : "no";
  process.stdout.write(`commercial activated: ${activation}\n`);
  if (result.activationState) {
    process.stdout.write(`activation state: ${result.activationState}\n`);
  }
  process.stdout.write(`shop API status: ${result.shopApiStatus}\n`);

  const enabled = SHOP_FEATURES.filter((key) => result.features[key]);
  process.stdout.write(`features: ${enabled.length > 0 ? enabled.join(", ") : "none"}\n`);

  if (result.permissions.roles.length > 0) {
    process.stdout.write(`roles: ${result.permissions.roles.join(", ")}\n`);
  }

  const writeStates = SHOP_FEATURES.map((key) => result.permissions.write[key]);
  if (writeStates.every((value) => value === null)) {
    process.stdout.write("write permissions: unknown\n");
  } else {
    const writable = SHOP_FEATURES.filter((key) => result.permissions.write[key] === true);
    process.stdout.write(
      `write permissions: ${writable.length > 0 ? writable.join(", ") : "none"}\n`,
    );
  }

  const configured = CONFIGURATION_KEYS.flatMap((key) => {
    const value = result.configuration[key];
    return value === null ? [] : [`${key}=${value}`];
  });
  if (configured.length > 0) {
    process.stdout.write(`configuration: ${configured.join(", ")}\n`);
  }

  if (result.warnings.length === 0) {
    process.stdout.write("warnings: none\n");
    return;
  }

  process.stdout.write(`warnings (${result.warnings.length}):\n`);
  for (const warning of result.warnings) {
    process.stdout.write(`- ${warning.code}: ${warning.message}\n`);
  }
}
