import { checkbox } from "@inquirer/prompts";
import cac, { type CAC } from "cac";
import ora, { type Ora } from "ora";

import {
  createAppStoreClient,
  resolveLatestAppStoreDownloadUrl,
  resolvePluginAppStoreAppId,
  resolvePluginUpdates,
  resolvePluginUpgradeSource,
} from "../utils/app-store.js";
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
  yes?: boolean;
}

interface BatchUpgradeResult {
  upgraded: Array<{ name: string; fromVersion?: string; toVersion: string }>;
  skipped: Array<{
    name: string;
    fromVersion?: string;
    toVersion: string;
    reason: string;
  }>;
  failed: Array<{ name: string; error: string }>;
}

interface BatchUpgradeProgressEvent {
  type:
    | "checking"
    | "discovering"
    | "resolving"
    | "selecting"
    | "queued"
    | "upgrading"
    | "upgraded"
    | "skipped"
    | "failed";
  name?: string;
  fromVersion?: string;
  toVersion?: string;
  reason?: string;
  error?: string;
  count?: number;
}

export function resolvePluginUpgradeTarget(
  name: string | undefined,
  options: PluginCommandOptions,
): { mode: "all" } | { mode: "single"; name: string } {
  if (options.all) {
    if (name) {
      throw new CliError("`halo plugin upgrade --all` does not accept a plugin name.");
    }

    if (options.url || options.uri || options.file) {
      throw new CliError(
        "`halo plugin upgrade --all` only supports App Store upgrades. Do not combine it with --url, --uri, or --file.",
      );
    }

    return { mode: "all" };
  }

  if (!name) {
    throw new CliError("`halo plugin upgrade` requires a plugin name, or use `--all`.");
  }

  return { mode: "single", name };
}

class SpinnerReporter {
  private spinner: Ora | undefined;
  private readonly enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  start(text: string): void {
    if (!this.enabled) {
      process.stdout.write(`${text}\n`);
      return;
    }

    this.spinner = ora(text).start();
  }

  update(text: string): void {
    if (!this.enabled) {
      process.stdout.write(`${text}\n`);
      return;
    }

    if (!this.spinner) {
      this.spinner = ora(text).start();
      return;
    }

    this.spinner.text = text;
  }

  succeed(text: string): void {
    if (!this.enabled) {
      process.stdout.write(`${text}\n`);
      return;
    }

    if (this.spinner) {
      this.spinner.succeed(text);
      this.spinner = undefined;
      return;
    }

    ora().succeed(text);
  }

  fail(text: string): void {
    if (!this.enabled) {
      process.stdout.write(`${text}\n`);
      return;
    }

    if (this.spinner) {
      this.spinner.fail(text);
      this.spinner = undefined;
      return;
    }

    ora().fail(text);
  }

  info(text: string): void {
    if (!this.enabled) {
      process.stdout.write(`${text}\n`);
      return;
    }

    if (this.spinner) {
      this.spinner.info(text);
      this.spinner = undefined;
      return;
    }

    ora().info(text);
  }

  stop(): void {
    this.spinner?.stop();
    this.spinner = undefined;
  }
}

function createSpinnerReporter(json = false): SpinnerReporter {
  return new SpinnerReporter(process.stdout.isTTY && !json);
}

export function resolvePluginInstallSource(options: PluginCommandOptions): {
  url?: string;
  file?: string;
} {
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

async function upgradeAllPlugins(
  runtime: RuntimeContext,
  options: PluginCommandOptions,
  onProgress?: (event: BatchUpgradeProgressEvent) => void,
): Promise<BatchUpgradeResult> {
  onProgress?.({ type: "checking" });
  const { clients, items } = await listAllPlugins(runtime, options);
  onProgress?.({ type: "discovering", count: items.length });
  const updates = await resolvePluginUpdates(clients, items);
  onProgress?.({ type: "resolving", count: updates.size });
  const appStoreClient = await createAppStoreClient(clients);

  const result: BatchUpgradeResult = {
    upgraded: [],
    skipped: [],
    failed: [],
  };

  const candidates = items
    .map((plugin) => ({ plugin, update: updates.get(plugin.metadata.name) }))
    .filter(
      (
        item,
      ): item is {
        plugin: (typeof items)[number];
        update: NonNullable<typeof item.update>;
      } => Boolean(item.update),
    );

  if (candidates.length === 0) {
    return result;
  }

  const compatibleCandidates = candidates.filter((item) => item.update.compatible);
  const incompatibleCandidates = candidates.filter((item) => !item.update.compatible);

  for (const item of incompatibleCandidates) {
    onProgress?.({
      type: "skipped",
      name: item.plugin.metadata.name,
      fromVersion: item.plugin.spec.version,
      toVersion: item.update.latestVersion,
      reason: "incompatible-with-current-halo",
    });
    result.skipped.push({
      name: item.plugin.metadata.name,
      fromVersion: item.plugin.spec.version,
      toVersion: item.update.latestVersion,
      reason: "incompatible-with-current-halo",
    });
  }

  let selectedPluginNames = new Set(compatibleCandidates.map((item) => item.plugin.metadata.name));

  if (
    compatibleCandidates.length > 0 &&
    !options.yes &&
    process.stdin.isTTY &&
    process.stdout.isTTY &&
    !options.json
  ) {
    onProgress?.({ type: "selecting", count: compatibleCandidates.length });

    const selected = await checkbox({
      message: "Select plugins to upgrade",
      choices: compatibleCandidates.map((item) => ({
        name: `${item.plugin.spec.displayName ?? item.plugin.metadata.name} (${item.plugin.spec.version ?? "unknown"} -> ${item.update.latestVersion})`,
        value: item.plugin.metadata.name,
        checked: true,
      })),
      required: false,
      loop: false,
    });

    selectedPluginNames = new Set(selected);
  }

  const selectedCandidates = compatibleCandidates.filter((item) =>
    selectedPluginNames.has(item.plugin.metadata.name),
  );
  const unselectedCandidates = compatibleCandidates.filter(
    (item) => !selectedPluginNames.has(item.plugin.metadata.name),
  );

  for (const item of unselectedCandidates) {
    onProgress?.({
      type: "skipped",
      name: item.plugin.metadata.name,
      fromVersion: item.plugin.spec.version,
      toVersion: item.update.latestVersion,
      reason: "not-selected",
    });
    result.skipped.push({
      name: item.plugin.metadata.name,
      fromVersion: item.plugin.spec.version,
      toVersion: item.update.latestVersion,
      reason: "not-selected",
    });
  }

  onProgress?.({ type: "queued", count: selectedCandidates.length });

  for (const item of selectedCandidates) {
    const { plugin, update } = item;

    if (!update.compatible) {
      onProgress?.({
        type: "skipped",
        name: plugin.metadata.name,
        fromVersion: plugin.spec.version,
        toVersion: update.latestVersion,
        reason: "incompatible-with-current-halo",
      });
      result.skipped.push({
        name: plugin.metadata.name,
        fromVersion: plugin.spec.version,
        toVersion: update.latestVersion,
        reason: "incompatible-with-current-halo",
      });
      continue;
    }

    try {
      onProgress?.({
        type: "upgrading",
        name: plugin.metadata.name,
        fromVersion: plugin.spec.version,
        toVersion: update.latestVersion,
      });

      const appId = resolvePluginAppStoreAppId(plugin);
      const downloadUrl = await resolveLatestAppStoreDownloadUrl(appStoreClient, appId);
      await clients.console.plugin.plugin.upgradePluginFromUri({
        name: plugin.metadata.name,
        upgradeFromUriRequest: { uri: downloadUrl },
      });

      onProgress?.({
        type: "upgraded",
        name: plugin.metadata.name,
        fromVersion: plugin.spec.version,
        toVersion: update.latestVersion,
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

      onProgress?.({
        type: "failed",
        name: plugin.metadata.name,
        fromVersion: plugin.spec.version,
        toVersion: update.latestVersion,
        error: error instanceof Error ? error.message : "Unknown upgrade error.",
      });
    }
  }

  return result;
}

function reportBatchUpgradeProgress(
  spinner: SpinnerReporter,
  event: BatchUpgradeProgressEvent,
): void {
  if (event.type === "checking") {
    spinner.start("Loading installed plugins...");
    return;
  }

  if (event.type === "discovering") {
    spinner.update(`Checking App Store metadata for ${event.count ?? 0} installed plugin(s)...`);
    return;
  }

  if (event.type === "resolving") {
    spinner.update(`Resolved ${event.count ?? 0} plugin update candidate(s).`);
    return;
  }

  if (event.type === "selecting") {
    spinner.stop();
    process.stdout.write(`Select plugins to upgrade (${event.count ?? 0} available):\n`);
    return;
  }

  if (event.type === "queued") {
    spinner.info(`Selected ${event.count ?? 0} plugin(s) for upgrade.`);
    return;
  }

  if (event.type === "upgrading") {
    spinner.start(
      `Upgrading plugin ${event.name}: ${event.fromVersion ?? "unknown"} -> ${event.toVersion ?? "unknown"}...`,
    );
    return;
  }

  if (event.type === "upgraded") {
    spinner.succeed(
      `Upgraded plugin ${event.name}: ${event.fromVersion ?? "unknown"} -> ${event.toVersion ?? "unknown"}.`,
    );
    return;
  }

  if (event.type === "skipped") {
    spinner.info(
      `Skipped plugin ${event.name}: ${event.fromVersion ?? "unknown"} -> ${event.toVersion ?? "unknown"} (${event.reason}).`,
    );
    return;
  }

  if (event.type === "failed") {
    spinner.fail(`Failed plugin ${event.name}: ${event.error ?? "Unknown upgrade error."}`);
  }
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

  process.stdout.write(
    `\nSummary: ${result.upgraded.length} upgraded, ${result.skipped.length} skipped, ${result.failed.length} failed.\n`,
  );
}

export function registerPluginCommands(cli: CAC): void {
  cli.command("plugin", "Plugin management commands");
}

function createPluginCli(runtime: RuntimeContext): CAC {
  const pluginCli = cac("halo plugin");

  pluginCli
    .command("list", "List plugins")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number")
    .option("--size <number>", "Page size")
    .option("--keyword <keyword>", "Filter by keyword")
    .option("--enabled <true|false>", "Filter by running state")
    .action(async (options: PluginCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const response = await clients.console.plugin.plugin.listPlugins({
        page: parseNumberOption(options.page),
        size: parseNumberOption(options.size),
        keyword: options.keyword,
        enabled: parseBooleanOption(options.enabled),
      });

      const updates = options.json
        ? undefined
        : await resolvePluginUpdates(clients, response.data.items);
      printPluginList(response.data, options.json, updates);
    });

  pluginCli
    .command("get <name>", "Show plugin details")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (name: string, options: PluginCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const response = await clients.core.plugin.plugin.getPlugin({ name });
      printPlugin(response.data, options.json);
    });

  pluginCli
    .command("install", "Install a plugin")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--url <url>", "Remote JAR URL")
    .option("--uri <uri>", "Remote JAR URI")
    .option("--file <path>", "Local JAR file path")
    .action(async (options: PluginCommandOptions) => {
      if (options.online) {
        throw new CliError("`halo plugin install` does not support --online. Use --url or --file.");
      }

      const { clients } = await runtime.getClientsForOptions(options);
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
    });

  pluginCli
    .command("upgrade [name]", "Upgrade a plugin")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--url <url>", "Remote JAR URL")
    .option("--uri <uri>", "Remote JAR URI")
    .option("--file <path>", "Local JAR file path")
    .option("--online", "Upgrade from the Halo App Store")
    .option("--all", "Upgrade all compatible App Store plugins")
    .option("-y, --yes", "Skip selection and upgrade all compatible plugins")
    .action(async (name: string | undefined, options: PluginCommandOptions) => {
      const spinner = createSpinnerReporter(options.json);
      const { clients } = await runtime.getClientsForOptions(options);
      const target = resolvePluginUpgradeTarget(name, options);

      if (target.mode === "all") {
        try {
          const progressHandler = options.json
            ? undefined
            : (event: BatchUpgradeProgressEvent) => reportBatchUpgradeProgress(spinner, event);
          const result = await upgradeAllPlugins(runtime, options, progressHandler);
          spinner.stop();
          printBatchUpgradeResult(result, options.json);
        } finally {
          spinner.stop();
        }
        return;
      }

      const source = resolvePluginUpgradeSource(options);

      let response;

      try {
        if (source.kind === "url") {
          spinner.start(`Upgrading plugin ${target.name} from remote URL...`);
          response = await clients.console.plugin.plugin.upgradePluginFromUri({
            name: target.name,
            upgradeFromUriRequest: { uri: source.url },
          });
          spinner.succeed(`Upgraded plugin ${target.name}.`);
        } else if (source.kind === "file") {
          spinner.start(`Uploading local package for plugin ${target.name}...`);
          response = await clients.console.plugin.plugin.upgradePlugin({
            name: target.name,
            file: await loadFileAsJar(source.file),
          });
          spinner.succeed(`Upgraded plugin ${target.name}.`);
        } else {
          spinner.start(`Resolving App Store package for plugin ${target.name}...`);
          const pluginResponse = await clients.core.plugin.plugin.getPlugin({ name: target.name });
          const appId = resolvePluginAppStoreAppId(pluginResponse.data);
          const appStoreClient = await createAppStoreClient(clients);
          const downloadUrl = await resolveLatestAppStoreDownloadUrl(appStoreClient, appId);

          spinner.update(`Upgrading plugin ${target.name} from Halo App Store...`);
          response = await clients.console.plugin.plugin.upgradePluginFromUri({
            name: target.name,
            upgradeFromUriRequest: { uri: downloadUrl },
          });
          spinner.succeed(`Upgraded plugin ${target.name}.`);
        }
      } finally {
        spinner.stop();
      }

      if (options.json) {
        printJson(response.data ?? { upgraded: true, name: target.name });
      }
    });

  pluginCli.usage("<command> [flags]");
  pluginCli.example((bin) => `${bin} list --page 1 --size 20`);
  pluginCli.example((bin) => `${bin} get PluginName`);
  pluginCli.example((bin) => `${bin} install --uri file:///tmp/example.jar`);
  pluginCli.example((bin) => `${bin} install --url https://example.com/plugin.jar`);
  pluginCli.example((bin) => `${bin} upgrade PluginName --online`);
  pluginCli.example((bin) => `${bin} upgrade --all --online --yes`);
  pluginCli.help();

  return pluginCli;
}

export async function tryRunPluginCommand(
  args: string[],
  runtime: RuntimeContext,
): Promise<boolean> {
  if (args[0] !== "plugin") {
    return false;
  }

  const pluginCli = createPluginCli(runtime);

  if (args.length === 1) {
    pluginCli.outputHelp();
    return true;
  }

  pluginCli.parse(["node", "halo plugin", ...args.slice(1)], { run: false });
  await pluginCli.runMatchedCommand();
  return true;
}
