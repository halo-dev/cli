import type { CAC } from "cac";

import {
  createAppStoreClient,
  resolveLatestAppStoreDownloadUrl,
  resolvePluginAppStoreAppId,
  resolvePluginUpdates,
  resolvePluginUpgradeSource,
} from "../utils/app-store.js";
import { printCommandHelp } from "../utils/command-help.js";
import { CliError } from "../utils/errors.js";
import { printJson, printPlugin, printPluginList } from "../utils/format.js";
import { parseBooleanOption, parseNumberOption } from "../utils/post-input.js";
import { loadFileAsJar, RuntimeContext } from "../utils/runtime.js";

interface PluginCommandOptions {
  profile?: string;
  json?: boolean;
  page?: string;
  size?: string;
  keyword?: string;
  enabled?: string;
  url?: string;
  uri?: string;
  file?: string;
  online?: boolean;
  all?: boolean;
}

interface BatchUpgradeResult {
  upgraded: Array<{ name: string; fromVersion?: string; toVersion: string }>;
  skipped: Array<{ name: string; fromVersion?: string; toVersion: string; reason: string }>;
  failed: Array<{ name: string; error: string }>;
}

function resolvePluginInstallSource(options: PluginCommandOptions): { url?: string; file?: string } {
  const url = options.url?.trim() || options.uri?.trim();
  const file = options.file?.trim();

  if (!url && !file) {
    throw new CliError("Provide either --url or --file.");
  }

  if (url && file) {
    throw new CliError("Use only one plugin source: --url or --file.");
  }

  return { url, file };
}

async function listAllPlugins(runtime: RuntimeContext, options: PluginCommandOptions) {
  const { clients } = await runtime.getClientsForOptions(options);
  const items = [];
  let page = 1;

  while (true) {
    const response = await clients.console.plugin.plugin.listPlugins({
      page,
      size: 100,
      keyword: options.keyword,
      enabled: parseBooleanOption(options.enabled),
    });

    items.push(...response.data.items);
    if (!response.data.hasNext) {
      return { clients, items };
    }

    page += 1;
  }
}

async function upgradeAllPlugins(runtime: RuntimeContext, options: PluginCommandOptions): Promise<BatchUpgradeResult> {
  const { clients, items } = await listAllPlugins(runtime, options);
  const updates = await resolvePluginUpdates(clients, items);
  const appStoreClient = await createAppStoreClient(clients);

  const result: BatchUpgradeResult = {
    upgraded: [],
    skipped: [],
    failed: [],
  };

  for (const plugin of items) {
    const update = updates.get(plugin.metadata.name);
    if (!update) {
      continue;
    }

    if (!update.compatible) {
      result.skipped.push({
        name: plugin.metadata.name,
        fromVersion: plugin.spec.version,
        toVersion: update.latestVersion,
        reason: "incompatible-with-current-halo",
      });
      continue;
    }

    try {
      const appId = resolvePluginAppStoreAppId(plugin);
      const downloadUrl = await resolveLatestAppStoreDownloadUrl(appStoreClient, appId);
      await clients.console.plugin.plugin.upgradePluginFromUri({
        name: plugin.metadata.name,
        upgradeFromUriRequest: { uri: downloadUrl },
      });

      result.upgraded.push({
        name: plugin.metadata.name,
        fromVersion: plugin.spec.version,
        toVersion: update.latestVersion,
      });
    } catch (error) {
      result.failed.push({
        name: plugin.metadata.name,
        error: error instanceof Error ? error.message : "Unknown upgrade error.",
      });
    }
  }

  return result;
}

function printBatchUpgradeResult(result: BatchUpgradeResult, json = false): void {
  if (json) {
    printJson(result);
    return;
  }

  if (result.upgraded.length === 0 && result.skipped.length === 0 && result.failed.length === 0) {
    process.stdout.write("No App Store plugin updates available.\n");
    return;
  }

  for (const item of result.upgraded) {
    process.stdout.write(`Upgraded plugin ${item.name}: ${item.fromVersion ?? "unknown"} -> ${item.toVersion}.\n`);
  }

  for (const item of result.skipped) {
    process.stdout.write(`Skipped plugin ${item.name}: ${item.fromVersion ?? "unknown"} -> ${item.toVersion} (${item.reason}).\n`);
  }

  for (const item of result.failed) {
    process.stdout.write(`Failed plugin ${item.name}: ${item.error}\n`);
  }

  process.stdout.write(
    `\nSummary: ${result.upgraded.length} upgraded, ${result.skipped.length} skipped, ${result.failed.length} failed.\n`,
  );
}

export function registerPluginCommands(cli: CAC, runtime: RuntimeContext): void {
  cli
    .command("plugin [action] [name]", "Plugin management commands")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number")
    .option("--size <number>", "Page size")
    .option("--keyword <keyword>", "Filter by keyword")
    .option("--enabled <true|false>", "Filter by running state")
    .option("--url <url>", "Remote JAR URL")
    .option("--uri <uri>", "Remote JAR URI")
    .option("--file <path>", "Local JAR file path")
    .option("--online", "Upgrade from the Halo App Store")
    .option("--all", "Upgrade all compatible App Store plugins")
    .action(async (action: string | undefined, name: string | undefined, options: PluginCommandOptions) => {
      if (!action) {
        printCommandHelp({
          summary: "Work with Halo plugins.",
          usage: "halo plugin <command> [flags]",
          sections: [
            {
              title: "COMMANDS",
              commands: [
                { name: "list", description: "List plugins" },
                { name: "get", description: "Show plugin details" },
                { name: "install", description: "Install a plugin from URL or file" },
                { name: "upgrade", description: "Upgrade a plugin from URL, file, or Halo App Store" },
              ],
            },
          ],
          flags: [
            { name: "--profile <name>", description: "Halo profile name" },
            { name: "--json", description: "Output JSON" },
            { name: "--url <url>", description: "Remote JAR URL" },
            { name: "--file <path>", description: "Local JAR file path" },
            { name: "--online", description: "Upgrade from the Halo App Store" },
            { name: "--all", description: "Upgrade all compatible App Store plugins" },
          ],
          examples: [
            "halo plugin list",
            "halo plugin get <name>",
            "halo plugin install --url https://example.com/plugin.jar",
            "halo plugin upgrade <name> --file ./plugin.jar",
            "halo plugin upgrade <name> --online",
            "halo plugin upgrade --all",
          ],
          learnMore: [
            "Use `halo plugin <subcommand> --help` for more information about a command.",
          ],
        });
        return;
      }

      const { clients } = await runtime.getClientsForOptions(options);

      if (action === "list") {
        const response = await clients.console.plugin.plugin.listPlugins({
          page: parseNumberOption(options.page),
          size: parseNumberOption(options.size),
          keyword: options.keyword,
          enabled: parseBooleanOption(options.enabled),
        });

        const updates = options.json ? undefined : await resolvePluginUpdates(clients, response.data.items);
        printPluginList(response.data, options.json, updates);
        return;
      }

      if (action === "get") {
        if (!name) {
          throw new CliError("`halo plugin get` requires a plugin name.");
        }

        const response = await clients.core.plugin.plugin.getPlugin({ name });
        printPlugin(response.data, options.json);
        return;
      }

      if (action === "install") {
        if (options.online) {
          throw new CliError("`halo plugin install` does not support --online. Use --url or --file.");
        }

        const source = resolvePluginInstallSource(options);
        const response = source.url
          ? await clients.console.plugin.plugin.installPluginFromUri({
              installFromUriRequest: { uri: source.url },
            })
          : await clients.console.plugin.plugin.installPlugin({
              file: await loadFileAsJar(source.file!),
            });

        if (options.json) {
          printJson(response.data);
          return;
        }

        process.stdout.write(`Installed plugin ${response.data.metadata.name}.\n`);
        return;
      }

      if (action === "upgrade") {
        if (options.all) {
          if (name) {
            throw new CliError("`halo plugin upgrade --all` does not accept a plugin name.");
          }

          if (options.url || options.uri || options.file) {
            throw new CliError("`halo plugin upgrade --all` only supports App Store upgrades. Do not combine it with --url, --uri, or --file.");
          }

          const result = await upgradeAllPlugins(runtime, options);
          printBatchUpgradeResult(result, options.json);
          return;
        }

        if (!name) {
          throw new CliError("`halo plugin upgrade` requires a plugin name, or use `--all`.");
        }

        const source = resolvePluginUpgradeSource(options);

        let response;

        if (source.kind === "url") {
          response = await clients.console.plugin.plugin.upgradePluginFromUri({
            name,
            upgradeFromUriRequest: { uri: source.url },
          });
        } else if (source.kind === "file") {
          response = await clients.console.plugin.plugin.upgradePlugin({
            name,
            file: await loadFileAsJar(source.file),
          });
        } else {
          const pluginResponse = await clients.core.plugin.plugin.getPlugin({ name });
          const appId = resolvePluginAppStoreAppId(pluginResponse.data);
          const appStoreClient = await createAppStoreClient(clients);
          const downloadUrl = await resolveLatestAppStoreDownloadUrl(appStoreClient, appId);

          response = await clients.console.plugin.plugin.upgradePluginFromUri({
            name,
            upgradeFromUriRequest: { uri: downloadUrl },
          });
        }

        if (options.json) {
          printJson(response.data ?? { upgraded: true, name });
          return;
        }

        process.stdout.write(`Upgraded plugin ${name}.\n`);
        return;
      }

      throw new CliError(`Unsupported plugin action: ${action}. Supported actions: list, get, install, upgrade.`);
    });
}