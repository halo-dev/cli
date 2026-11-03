import { type CAC } from "cac";

import { CliError } from "../../utils/errors.js";
import { parseBooleanOption } from "../../utils/options.js";
import { printJson } from "../../utils/output.js";
import { RuntimeContext } from "../../utils/runtime.js";
import { ShopApi } from "./api.js";
import { createShopCli } from "./cli.js";
import { printConfig } from "./format.js";
import { hasAnyOption, readJsonPayload, type JsonInputOptions } from "./input.js";
import type { ShopSetting } from "./types.js";

interface ShopCommandOptions {
  profile?: string;
  json?: boolean;
}

interface ConfigGetOptions extends ShopCommandOptions {
  group?: string;
}

interface ConfigSetOptions extends ShopCommandOptions, JsonInputOptions {
  group?: string;
  guestCheckout?: string;
  subscriptionMenu?: string;
  inquiryRedirectUrl?: string;
}

const SHOP_SETTING_OPTIONS = ["guestCheckout", "subscriptionMenu", "inquiryRedirectUrl"];

function buildShopSettingPatch(options: ConfigSetOptions): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (options.guestCheckout !== undefined) {
    patch.guestCheckoutEnabled = parseBooleanOption(options.guestCheckout);
  }
  if (options.subscriptionMenu !== undefined) {
    patch.subscriptionMenuEnabled = parseBooleanOption(options.subscriptionMenu);
  }
  if (options.inquiryRedirectUrl !== undefined) {
    patch.inquiryRedirectUrl = options.inquiryRedirectUrl;
  }

  return patch;
}

export function buildConfigCli(runtime: RuntimeContext): CAC {
  const configCli = createShopCli("halo shop config");

  configCli
    .command("get", "Show shop configuration")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--group <group>", "Read an arbitrary ecommerce config group instead of shop")
    .action(async (options: ConfigGetOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const config =
        options.group === undefined
          ? await api.getShopConfig()
          : await api.getConfigGroup(options.group);
      printConfig(config, options.json);
    });

  configCli
    .command("set", "Update shop configuration")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--group <group>", "Update an arbitrary ecommerce config group instead of shop")
    .option("--file <path>", "Read a JSON object from file, use - for stdin")
    .option("--stdin", "Read a JSON object from stdin")
    .option("--guest-checkout <boolean>", "Whether guest checkout is enabled")
    .option("--subscription-menu <boolean>", "Whether the subscription menu is shown")
    .option("--inquiry-redirect-url <url>", "Redirect URL for inquiry products")
    .action(async (options: ConfigSetOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const filePayload = await readJsonPayload(options);

      if (options.group !== undefined) {
        if (hasAnyOption(options as unknown as Record<string, unknown>, SHOP_SETTING_OPTIONS)) {
          throw new CliError("--group cannot be combined with shop setting options.");
        }
        if (filePayload === undefined) {
          throw new CliError("Use --file or --stdin to provide the config group payload.");
        }

        const current = await api.getConfigGroup(options.group);
        if (!current || typeof current !== "object" || Array.isArray(current)) {
          throw new CliError(`Config group "${options.group}" did not return a JSON object.`);
        }

        const config = await api.updateConfigGroup(options.group, {
          ...(current as Record<string, unknown>),
          ...filePayload,
        });

        if (options.json) {
          printJson(config ?? { group: options.group, updated: true });
          return;
        }

        process.stdout.write(`Updated config group "${options.group}".\n`);
        return;
      }

      if (
        filePayload === undefined &&
        !hasAnyOption(options as unknown as Record<string, unknown>, SHOP_SETTING_OPTIONS)
      ) {
        throw new CliError("Provide --file, --stdin, or at least one shop setting option.");
      }

      const current = await api.getShopConfig();
      const payload: Record<string, unknown> = {
        ...current,
        ...filePayload,
        ...buildShopSettingPatch(options),
      };
      const config = await api.updateShopConfig(payload as unknown as ShopSetting);

      if (options.json) {
        printJson(config ?? { updated: true });
        return;
      }

      process.stdout.write("Updated shop configuration.\n");
    });

  configCli.usage("<command> [flags]");
  configCli.example((bin) => `${bin} get`);
  configCli.example((bin) => `${bin} set --guest-checkout true`);
  configCli.example((bin) => `${bin} set --file payment.json --group payment`);
  configCli.help();

  return configCli;
}
