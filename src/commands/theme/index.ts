import type { Theme } from "@halo-dev/api-client";
import { checkbox } from "@inquirer/prompts";
import cac, { type CAC } from "cac";
import ora, { type Ora } from "ora";

import {
  createAppStoreClient,
  resolveLatestAppStoreDownloadUrl,
  resolveThemeAppStoreAppId,
  resolveThemeUpdates,
  resolvePluginUpgradeSource,
} from "../../shared/integrations/app-store.js";
import { tryRunCommandCliRoute } from "../../utils/command-router.js";
import { confirmDangerousAction } from "../../utils/confirmation.js";
import { CliError } from "../../utils/errors.js";
import { parseNumberOption } from "../../utils/options.js";
import { printJson } from "../../utils/output.js";
import { loadFileAsZip } from "../../utils/package-file.js";
import { RuntimeContext } from "../../utils/runtime.js";
import { printTheme, printThemeList } from "./format.js";

interface ThemeCommandOptions {
  profile?: string;
  json?: boolean;
  page?: string;
  size?: string;
  url?: string;
  uri?: string;
  file?: string;
  online?: boolean;
  all?: boolean;
  yes?: boolean;
  uninstalled?: boolean;
}

interface ThemeMutationOptions extends ThemeCommandOptions {
  force?: boolean;
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

function getThemeMutationVerb(_action: "delete"): string {
  return "deleting";
}

export async function confirmThemeMutation(
  action: "delete",
  name: string,
  options: ThemeMutationOptions,
): Promise<boolean> {
  return confirmDangerousAction(
    {
      commandPath: `halo theme ${action}`,
      actionLabel: `${action[0]!.toUpperCase()}${action.slice(1)}`,
      resourceLabel: "theme",
      resourceName: name,
      cancellationVerb: getThemeMutationVerb(action),
    },
    options,
  );
}

export function resolveThemeInstallSource(options: ThemeCommandOptions): {
  url?: string;
  file?: string;
} {
  const url = options.url?.trim() || options.uri?.trim();
  const file = options.file?.trim();

  if (!url && !file) {
    throw new CliError("Provide either --url or --file.");
  }

  if (url && file) {
    throw new CliError("Use only one theme source: --url or --file.");
  }

  return { url, file };
}

function resolveThemeUpgradeTarget(
  name: string | undefined,
  options: ThemeCommandOptions,
): { mode: "all" } | { mode: "single"; name: string } {
  if (options.all) {
    if (name) {
      throw new CliError("`halo theme upgrade --all` does not accept a theme name.");
    }

    if (options.url || options.uri || options.file) {
      throw new CliError(
        "`halo theme upgrade --all` only supports App Store upgrades. Do not combine it with --url, --uri, or --file.",
      );
    }

    return { mode: "all" };
  }

  if (!name) {
    throw new CliError("`halo theme upgrade` requires a theme name, or use `--all`.");
  }

  return { mode: "single", name };
}

async function getActivatedTheme(runtime: RuntimeContext, options?: ThemeCommandOptions) {
  const { clients } = await runtime.getClientsForOptions(options);
  const response = await clients.console.theme.theme.fetchActivatedTheme();
  return response.data;
}

async function getActivatedThemeName(runtime: RuntimeContext, options?: ThemeCommandOptions) {
  try {
    const theme = await getActivatedTheme(runtime, options);
    return theme.metadata.name;
  } catch {
    return undefined;
  }
}

async function listAllThemes(runtime: RuntimeContext, options: ThemeCommandOptions) {
  const { clients } = await runtime.getClientsForOptions(options);
  const items: Theme[] = [];
  let page = 1;

  while (true) {
    const response = await clients.console.theme.theme.listThemes({
      page,
      size: 100,
      uninstalled: options.uninstalled,
    });

    items.push(...response.data.items);
    if (!response.data.hasNext) {
      return { clients, items };
    }

    page += 1;
  }
}

async function upgradeAllThemes(
  runtime: RuntimeContext,
  options: ThemeCommandOptions,
  onProgress?: (event: BatchUpgradeProgressEvent) => void,
): Promise<BatchUpgradeResult> {
  onProgress?.({ type: "checking" });
  const { clients, items } = await listAllThemes(runtime, options);
  onProgress?.({ type: "discovering", count: items.length });
  const updates = await resolveThemeUpdates(clients, items);
  onProgress?.({ type: "resolving", count: updates.size });
  const appStoreClient = await createAppStoreClient(clients);

  const result: BatchUpgradeResult = {
    upgraded: [],
    skipped: [],
    failed: [],
  };

  const candidates = items
    .map((theme) => ({ theme, update: updates.get(theme.metadata.name) }))
    .filter(
      (
        item,
      ): item is {
        theme: (typeof items)[number];
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
      name: item.theme.metadata.name,
      fromVersion: item.theme.spec.version,
      toVersion: item.update.latestVersion,
      reason: "incompatible-with-current-halo",
    });
    result.skipped.push({
      name: item.theme.metadata.name,
      fromVersion: item.theme.spec.version,
      toVersion: item.update.latestVersion,
      reason: "incompatible-with-current-halo",
    });
  }

  let selectedThemeNames = new Set(compatibleCandidates.map((item) => item.theme.metadata.name));

  if (
    compatibleCandidates.length > 0 &&
    !options.yes &&
    process.stdin.isTTY &&
    process.stdout.isTTY &&
    !options.json
  ) {
    onProgress?.({ type: "selecting", count: compatibleCandidates.length });

    const selected = await checkbox({
      message: "Select themes to upgrade",
      choices: compatibleCandidates.map((item) => ({
        name: `${item.theme.spec.displayName} (${item.theme.spec.version ?? "unknown"} -> ${item.update.latestVersion})`,
        value: item.theme.metadata.name,
        checked: true,
      })),
      required: false,
      loop: false,
    });

    selectedThemeNames = new Set(selected);
  }

  const selectedCandidates = compatibleCandidates.filter((item) =>
    selectedThemeNames.has(item.theme.metadata.name),
  );
  const unselectedCandidates = compatibleCandidates.filter(
    (item) => !selectedThemeNames.has(item.theme.metadata.name),
  );

  for (const item of unselectedCandidates) {
    onProgress?.({
      type: "skipped",
      name: item.theme.metadata.name,
      fromVersion: item.theme.spec.version,
      toVersion: item.update.latestVersion,
      reason: "not-selected",
    });
    result.skipped.push({
      name: item.theme.metadata.name,
      fromVersion: item.theme.spec.version,
      toVersion: item.update.latestVersion,
      reason: "not-selected",
    });
  }

  onProgress?.({ type: "queued", count: selectedCandidates.length });

  for (const item of selectedCandidates) {
    try {
      onProgress?.({
        type: "upgrading",
        name: item.theme.metadata.name,
        fromVersion: item.theme.spec.version,
        toVersion: item.update.latestVersion,
      });

      const appId = resolveThemeAppStoreAppId(item.theme);
      const downloadUrl = await resolveLatestAppStoreDownloadUrl(appStoreClient, appId);
      await clients.console.theme.theme.upgradeThemeFromUri({
        name: item.theme.metadata.name,
        upgradeFromUriRequest: { uri: downloadUrl },
      });

      onProgress?.({
        type: "upgraded",
        name: item.theme.metadata.name,
        fromVersion: item.theme.spec.version,
        toVersion: item.update.latestVersion,
      });

      result.upgraded.push({
        name: item.theme.metadata.name,
        fromVersion: item.theme.spec.version,
        toVersion: item.update.latestVersion,
      });
    } catch (error) {
      result.failed.push({
        name: item.theme.metadata.name,
        error: error instanceof Error ? error.message : "Unknown upgrade error.",
      });

      onProgress?.({
        type: "failed",
        name: item.theme.metadata.name,
        fromVersion: item.theme.spec.version,
        toVersion: item.update.latestVersion,
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
    spinner.start("Loading installed themes...");
    return;
  }

  if (event.type === "discovering") {
    spinner.update(`Checking App Store metadata for ${event.count ?? 0} installed theme(s)...`);
    return;
  }

  if (event.type === "resolving") {
    spinner.update(`Resolved ${event.count ?? 0} theme update candidate(s).`);
    return;
  }

  if (event.type === "selecting") {
    spinner.stop();
    process.stdout.write(`Select themes to upgrade (${event.count ?? 0} available):\n`);
    return;
  }

  if (event.type === "queued") {
    spinner.info(`Selected ${event.count ?? 0} theme(s) for upgrade.`);
    return;
  }

  if (event.type === "upgrading") {
    spinner.start(
      `Upgrading theme ${event.name}: ${event.fromVersion ?? "unknown"} -> ${event.toVersion ?? "unknown"}...`,
    );
    return;
  }

  if (event.type === "upgraded") {
    spinner.succeed(
      `Upgraded theme ${event.name}: ${event.fromVersion ?? "unknown"} -> ${event.toVersion ?? "unknown"}.`,
    );
    return;
  }

  if (event.type === "skipped") {
    spinner.info(
      `Skipped theme ${event.name}: ${event.fromVersion ?? "unknown"} -> ${event.toVersion ?? "unknown"} (${event.reason}).`,
    );
    return;
  }

  if (event.type === "failed") {
    spinner.fail(`Failed theme ${event.name}: ${event.error ?? "Unknown upgrade error."}`);
  }
}

function printBatchUpgradeResult(result: BatchUpgradeResult, json = false): void {
  if (json) {
    printJson(result);
    return;
  }

  if (result.upgraded.length === 0 && result.skipped.length === 0 && result.failed.length === 0) {
    process.stdout.write("No App Store theme updates available.\n");
    return;
  }

  process.stdout.write(
    `\nSummary: ${result.upgraded.length} upgraded, ${result.skipped.length} skipped, ${result.failed.length} failed.\n`,
  );
}

export function registerThemeCommands(cli: CAC): void {
  cli.command("theme", "Theme management commands");
}

function buildThemeCli(runtime: RuntimeContext): CAC {
  const themeCli = cac("halo theme");

  themeCli
    .command("list", "List themes")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number")
    .option("--size <number>", "Page size")
    .option("--uninstalled", "Include uninstalled themes")
    .action(async (options: ThemeCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const [response, activeThemeName] = await Promise.all([
        clients.console.theme.theme.listThemes({
          page: parseNumberOption(options.page),
          size: parseNumberOption(options.size),
          uninstalled: options.uninstalled,
        }),
        options.json ? Promise.resolve(undefined) : getActivatedThemeName(runtime, options),
      ]);

      const updates = options.json
        ? undefined
        : await resolveThemeUpdates(clients, response.data.items);
      printThemeList(response.data, options.json, updates, activeThemeName);
    });

  themeCli
    .command("get <name>", "Show theme details")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (name: string, options: ThemeCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const response = await clients.core.theme.theme.getTheme({ name });
      printTheme(response.data, options.json);
    });

  const printCurrentTheme = async (options: ThemeCommandOptions) => {
    const theme = await getActivatedTheme(runtime, options);
    printTheme(theme, options.json);
  };

  themeCli
    .command("current", "Show the currently activated theme")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(printCurrentTheme);

  themeCli
    .command("install", "Install a theme")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--url <url>", "Remote ZIP URL")
    .option("--uri <uri>", "Remote ZIP URI")
    .option("--file <path>", "Local ZIP file path")
    .action(async (options: ThemeCommandOptions) => {
      if (options.online) {
        throw new CliError("`halo theme install` does not support --online. Use --url or --file.");
      }

      const { clients } = await runtime.getClientsForOptions(options);
      const source = resolveThemeInstallSource(options);
      const formData = new FormData();
      if (source.file) {
        formData.append("file", await loadFileAsZip(source.file));
      }
      const response = source.url
        ? await clients.console.theme.theme.installThemeFromUri({
            installFromUriRequest: { uri: source.url },
          })
        : await clients.axios.post<Theme>(
            "/apis/api.console.halo.run/v1alpha1/themes/install",
            formData,
          );

      if (options.json) {
        printJson(response.data);
        return;
      }

      process.stdout.write(`Installed theme ${response.data.metadata.name}.\n`);
    });

  themeCli
    .command("upgrade [name]", "Upgrade a theme")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--url <url>", "Remote ZIP URL")
    .option("--uri <uri>", "Remote ZIP URI")
    .option("--file <path>", "Local ZIP file path")
    .option("--online", "Upgrade from the Halo App Store")
    .option("--all", "Upgrade all compatible App Store themes")
    .option("-y, --yes", "Skip selection and upgrade all compatible themes")
    .action(async (name: string | undefined, options: ThemeCommandOptions) => {
      const spinner = createSpinnerReporter(options.json);
      const { clients } = await runtime.getClientsForOptions(options);
      const target = resolveThemeUpgradeTarget(name, options);

      if (target.mode === "all") {
        try {
          const progressHandler = options.json
            ? undefined
            : (event: BatchUpgradeProgressEvent) => reportBatchUpgradeProgress(spinner, event);
          const result = await upgradeAllThemes(runtime, options, progressHandler);
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
          spinner.start(`Upgrading theme ${target.name} from remote URL...`);
          response = await clients.console.theme.theme.upgradeThemeFromUri({
            name: target.name,
            upgradeFromUriRequest: { uri: source.url },
          });
          spinner.succeed(`Upgraded theme ${target.name}.`);
        } else if (source.kind === "file") {
          spinner.start(`Uploading local package for theme ${target.name}...`);
          response = await clients.console.theme.theme.upgradeTheme({
            name: target.name,
            file: await loadFileAsZip(source.file),
          });
          spinner.succeed(`Upgraded theme ${target.name}.`);
        } else {
          spinner.start(`Resolving App Store package for theme ${target.name}...`);
          const themeResponse = await clients.core.theme.theme.getTheme({ name: target.name });
          const appId = resolveThemeAppStoreAppId(themeResponse.data);
          const appStoreClient = await createAppStoreClient(clients);
          const downloadUrl = await resolveLatestAppStoreDownloadUrl(appStoreClient, appId);

          spinner.update(`Upgrading theme ${target.name} from Halo App Store...`);
          response = await clients.console.theme.theme.upgradeThemeFromUri({
            name: target.name,
            upgradeFromUriRequest: { uri: downloadUrl },
          });
          spinner.succeed(`Upgraded theme ${target.name}.`);
        }
      } finally {
        spinner.stop();
      }

      if (options.json) {
        printJson(response?.data ?? { upgraded: true, name: target.name });
      }
    });

  themeCli
    .command("activate <name>", "Activate a theme")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (name: string, options: ThemeCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const response = await clients.console.theme.theme.activateTheme({ name });

      if (options.json) {
        printJson(response.data);
        return;
      }

      process.stdout.write(`Activated theme ${response.data.metadata.name}.\n`);
    });

  themeCli
    .command("reload <name>", "Reload theme settings")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (name: string, options: ThemeCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const response = await clients.console.theme.theme.reload({ name });

      if (options.json) {
        printJson(response.data);
        return;
      }

      process.stdout.write(`Reloaded theme ${response.data.metadata.name}.\n`);
    });

  themeCli
    .command("delete <name>", "Delete a theme")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--force", "Delete without confirmation")
    .action(async (name: string, options: ThemeMutationOptions) => {
      if (!(await confirmThemeMutation("delete", name, options))) {
        return;
      }

      const { clients } = await runtime.getClientsForOptions(options);
      await clients.core.theme.theme.deleteTheme({ name });

      if (options.json) {
        printJson({ deleted: true, name });
        return;
      }

      process.stdout.write(`Deleted theme ${name}.\n`);
    });

  themeCli.usage("<command> [flags]");
  themeCli.example((bin) => `${bin} list --page 1 --size 20`);
  themeCli.example((bin) => `${bin} get ThemeName`);
  themeCli.example((bin) => `${bin} current`);
  themeCli.example((bin) => `${bin} install --uri file:///tmp/example.zip`);
  themeCli.example((bin) => `${bin} install --url https://example.com/theme.zip`);
  themeCli.example((bin) => `${bin} upgrade ThemeName --online`);
  themeCli.example((bin) => `${bin} activate ThemeName`);
  themeCli.example((bin) => `${bin} delete ThemeName --force`);
  themeCli.help();

  return themeCli;
}

export async function tryRunThemeCommand(
  args: string[],
  runtime: RuntimeContext,
): Promise<boolean> {
  return tryRunCommandCliRoute({
    command: "theme",
    cliName: "halo theme",
    args,
    buildCli: () => buildThemeCli(runtime),
  });
}
