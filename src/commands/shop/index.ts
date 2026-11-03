import { type CAC } from "cac";

import { tryRunCommandCliRoute, tryRunNestedCliRoute } from "../../utils/command-router.js";
import { printJson } from "../../utils/output.js";
import { RuntimeContext } from "../../utils/runtime.js";
import { buildCategoryCli } from "./category.js";
import { createShopCli } from "./cli.js";
import { buildConfigCli } from "./config.js";
import { buildCouponCli } from "./coupon.js";
import { buildCustomerCli } from "./customer.js";
import { buildDiscountCli } from "./discount.js";
import { printShopDoctor, resolveShopDoctor } from "./doctor.js";
import { buildOrderCli } from "./order.js";
import { buildProductCli } from "./product.js";
import { buildStatsCli } from "./stats.js";
import { resolveShopStatus, type ShopStatusOptions } from "./status.js";

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
      const activation =
        status.activationState === undefined
          ? "unknown"
          : status.commercialActivated
            ? "yes"
            : "no";
      process.stdout.write(`commercial activated: ${activation}\n`);
      if (status.activationState) {
        process.stdout.write(`activation state: ${status.activationState}\n`);
      }
      process.stdout.write(`shop API available: ${status.shopApiAvailable ? "yes" : "no"}\n`);
    });

  shopCli
    .command("doctor", "Diagnose shop capabilities, permissions, and configuration")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (options: ShopStatusOptions) => {
      const result = await resolveShopDoctor(runtime, options);

      if (options.json) {
        printJson(result);
        return;
      }

      printShopDoctor(result);
    });

  for (const group of SHOP_GROUPS) {
    shopCli.command(group.name, group.description);
  }

  shopCli.usage("<command> [flags]");
  shopCli.example((bin) => `${bin} status`);
  shopCli.example((bin) => `${bin} doctor --json`);
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
