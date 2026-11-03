import axios from "axios";
import { type CAC } from "cac";

import { tryRunCommandCliRoute, tryRunNestedCliRoute } from "../../utils/command-router.js";
import { CliError } from "../../utils/errors.js";
import { printJson } from "../../utils/output.js";
import { RuntimeContext } from "../../utils/runtime.js";
import { ShopApi } from "./api.js";
import { buildCategoryCli } from "./category.js";
import { createShopCli } from "./cli.js";
import { buildConfigCli } from "./config.js";
import { buildCouponCli } from "./coupon.js";
import { buildCustomerCli } from "./customer.js";
import { buildDiscountCli } from "./discount.js";
import { buildOrderCli } from "./order.js";
import { buildProductCli } from "./product.js";
import { buildStatsCli } from "./stats.js";
import type { LicenseActivation } from "./types.js";

const COMMERCIAL_PRODUCT_NAMES = new Set(["product-halo-commercial", "product-halo-pro"]);

interface ShopStatusOptions {
  profile?: string;
  json?: boolean;
}

interface HaloActuatorInfo {
  build?: {
    name?: string;
    version?: string;
  };
}

interface ShopStatusResult {
  profile: string;
  baseUrl: string;
  edition: string;
  version?: string;
  commercialActivated: boolean;
  activationState?: string;
  shopApiAvailable: boolean;
}

function isNotFoundError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

function isShopApiUnavailableError(error: unknown): boolean {
  return error instanceof CliError && error.message.startsWith("Shop API is not available");
}

async function resolveShopStatus(
  runtime: RuntimeContext,
  options: ShopStatusOptions,
): Promise<ShopStatusResult> {
  const { profile, clients } = await runtime.getClientsForOptions(options);

  let info: HaloActuatorInfo | undefined;
  try {
    const response = await clients.axios.get<HaloActuatorInfo>("/actuator/info");
    info = response.data;
  } catch (error) {
    // Older or restricted instances may not expose actuator info.
    if (!isNotFoundError(error)) {
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
    // Non-Pro instances do not expose the license API.
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  let shopApiAvailable = false;
  try {
    await new ShopApi(clients.axios).listProducts({ page: 1, size: 1 });
    shopApiAvailable = true;
  } catch (error) {
    // The shop API is absent on non-commercial instances.
    if (!isNotFoundError(error) && !isShopApiUnavailableError(error)) {
      throw error;
    }
  }

  return {
    profile: profile.name,
    baseUrl: profile.baseUrl,
    edition: info?.build?.name ?? "unknown",
    version: info?.build?.version,
    commercialActivated: activation?.status?.state === "active",
    activationState: activation?.status?.state,
    shopApiAvailable,
  };
}

const SHOP_GROUPS = [
  {
    name: "product",
    description: "Product management commands",
    build: buildProductCli,
  },
  {
    name: "category",
    description: "Product category management commands",
    build: buildCategoryCli,
  },
  {
    name: "order",
    description: "Order management commands",
    build: buildOrderCli,
  },
  {
    name: "customer",
    description: "Customer management commands",
    build: buildCustomerCli,
  },
  {
    name: "coupon",
    description: "Coupon management commands",
    build: buildCouponCli,
  },
  {
    name: "discount",
    description: "Discount management commands",
    build: buildDiscountCli,
  },
  {
    name: "stats",
    description: "Shop statistics commands",
    build: buildStatsCli,
  },
  {
    name: "config",
    description: "Shop configuration commands",
    build: buildConfigCli,
  },
] as const;

export function registerShopCommands(cli: CAC): void {
  cli.command("shop", "Shop management commands (Halo Pro/Commercial)");
}

function buildShopCli(runtime: RuntimeContext): CAC {
  const shopCli = createShopCli("halo shop");

  shopCli
    .command("status", "Show shop edition, activation, and API availability")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (options: ShopStatusOptions) => {
      const status = await resolveShopStatus(runtime, options);

      if (options.json) {
        printJson(status);
        return;
      }

      process.stdout.write(`edition: ${status.edition}\n`);
      if (status.version) {
        process.stdout.write(`version: ${status.version}\n`);
      }
      process.stdout.write(`commercial activated: ${status.commercialActivated ? "yes" : "no"}\n`);
      if (status.activationState) {
        process.stdout.write(`activation state: ${status.activationState}\n`);
      }
      process.stdout.write(`shop API available: ${status.shopApiAvailable ? "yes" : "no"}\n`);
    });

  for (const group of SHOP_GROUPS) {
    shopCli.command(group.name, group.description);
  }

  shopCli.usage("<command> [flags]");
  shopCli.example((bin) => `${bin} status`);
  shopCli.example((bin) => `${bin} product list`);
  shopCli.example((bin) => `${bin} order list --payment-status PAID`);
  shopCli.example((bin) => `${bin} stats daily --start 2026-01-01`);
  shopCli.help();

  return shopCli;
}

export async function tryRunShopCommand(args: string[], runtime: RuntimeContext): Promise<boolean> {
  if (args[0] !== "shop") {
    return false;
  }

  for (const group of SHOP_GROUPS) {
    if (
      await tryRunNestedCliRoute({
        branch: group.name,
        cliName: `halo shop ${group.name}`,
        args,
        buildCli: () => group.build(runtime),
      })
    ) {
      return true;
    }
  }

  return tryRunCommandCliRoute({
    command: "shop",
    cliName: "halo shop",
    args,
    buildCli: () => buildShopCli(runtime),
  });
}
