import type { CAC } from "cac";

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
  uri?: string;
  file?: string;
}

function ensureSingleSource(options: PluginCommandOptions): { uri?: string; file?: string } {
  if (!options.uri && !options.file) {
    throw new CliError("Provide either --uri or --file.");
  }

  if (options.uri && options.file) {
    throw new CliError("Use only one plugin source: --uri or --file.");
  }

  return {
    uri: options.uri,
    file: options.file,
  };
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
    .option("--uri <uri>", "Remote JAR URI")
    .option("--file <path>", "Local JAR file path")
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
                { name: "install", description: "Install a plugin from URI or file" },
                { name: "upgrade", description: "Upgrade a plugin from URI or file" },
              ],
            },
          ],
          flags: [
            { name: "--profile <name>", description: "Halo profile name" },
            { name: "--json", description: "Output JSON" },
          ],
          examples: [
            "halo plugin list",
            "halo plugin get <name>",
            "halo plugin install --uri https://example.com/plugin.jar",
            "halo plugin upgrade <name> --file ./plugin.jar",
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

        printPluginList(response.data, options.json);
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
        const source = ensureSingleSource(options);
        const response = source.uri
          ? await clients.console.plugin.plugin.installPluginFromUri({
              installFromUriRequest: { uri: source.uri },
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
        if (!name) {
          throw new CliError("`halo plugin upgrade` requires a plugin name.");
        }

        const source = ensureSingleSource(options);

        const response = source.uri
          ? await clients.console.plugin.plugin.upgradePluginFromUri({
              name,
              upgradeFromUriRequest: { uri: source.uri },
            })
          : await clients.console.plugin.plugin.upgradePlugin({
              name,
              file: await loadFileAsJar(source.file!),
            });

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