import { writeFile } from "node:fs/promises";

import { type Backup, BackupV1alpha1Api, MigrationV1alpha1ConsoleApi } from "@halo-dev/api-client";
import cac, { type CAC } from "cac";
import ora from "ora";
import prettyBytes from "pretty-bytes";

import { tryRunCommandCliRoute } from "../../utils/command-router.js";
import { confirmDangerousAction } from "../../utils/confirmation.js";
import { CliError } from "../../utils/errors.js";
import { parseNumberOption } from "../../utils/options.js";
import { printJson } from "../../utils/output.js";
import { RuntimeContext } from "../../utils/runtime.js";
import { ensureBackupFilename, resolveBackupDownloadFilePath } from "./files.js";
import { printBackup, printBackupList } from "./format.js";

const BACKUP_API_VERSION = "migration.halo.run/v1alpha1";
const BACKUP_KIND = "Backup";
const BACKUP_POLL_INTERVAL_MS = 2_000;
const DEFAULT_WAIT_TIMEOUT_SECONDS = 300;

interface BackupCommandOptions {
  profile?: string;
  json?: boolean;
}

interface BackupListOptions extends BackupCommandOptions {
  page?: string;
  size?: string;
}

interface BackupDownloadOptions extends BackupCommandOptions {
  output?: string;
}

interface BackupCreateOptions extends BackupCommandOptions {
  format?: string;
  expiresAt?: string;
  wait?: boolean;
  waitTimeout?: string;
}

interface BackupDeleteOptions extends BackupCommandOptions {
  force?: boolean;
}

function createSpinner(enabled: boolean, text: string) {
  return enabled
    ? ora({
        text,
        discardStdin: false,
      }).start()
    : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function resolveWaitTimeoutMs(value: string | undefined): number {
  const timeoutSeconds = parseNumberOption(value) ?? DEFAULT_WAIT_TIMEOUT_SECONDS;
  if (!timeoutSeconds || timeoutSeconds <= 0) {
    throw new CliError("`--wait-timeout` must be a positive number of seconds.");
  }

  return timeoutSeconds * 1_000;
}

export function buildBackupCreatePayload(
  name: string | undefined,
  options: BackupCreateOptions,
): Backup {
  const format = options.format?.trim();
  const expiresAt = options.expiresAt?.trim();
  const normalizedName = name?.trim();

  return {
    apiVersion: BACKUP_API_VERSION,
    kind: BACKUP_KIND,
    metadata: {
      name: normalizedName ?? "",
      generateName: normalizedName ? undefined : "backup-",
    },
    spec: {
      format: format || "zip",
      expiresAt: expiresAt || undefined,
    },
  };
}

async function waitForBackupCompletion(
  backupApi: BackupV1alpha1Api,
  name: string,
  timeoutMs: number,
  onUpdate?: (backup: Backup, elapsedMs: number) => void,
): Promise<Backup> {
  const startedAt = Date.now();

  while (true) {
    const response = await backupApi.getBackup({ name });
    const backup = response.data;
    const elapsedMs = Date.now() - startedAt;
    const phase = backup.status?.phase ?? "PENDING";

    onUpdate?.(backup, elapsedMs);

    if (phase === "SUCCEEDED") {
      return backup;
    }

    if (phase === "FAILED") {
      const reason =
        backup.status?.failureMessage?.trim() ||
        backup.status?.failureReason?.trim() ||
        "Unknown backup failure.";
      throw new CliError(`Backup ${name} failed: ${reason}`);
    }

    if (elapsedMs >= timeoutMs) {
      throw new CliError(
        `Timed out waiting for backup ${name} to complete after ${Math.ceil(timeoutMs / 1_000)}s. Last phase: ${phase}.`,
      );
    }

    await sleep(BACKUP_POLL_INTERVAL_MS);
  }
}

function buildBackupCli(runtime: RuntimeContext): CAC {
  const backupCli = cac("halo backup");

  backupCli
    .command("list", "List backups")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number", { default: 1 })
    .option("--size <number>", "Page size", { default: 20 })
    .action(async (options: BackupListOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const backupApi = new BackupV1alpha1Api(undefined, profile.baseUrl, clients.axios);
      const response = await backupApi.listBackup({
        page: parseNumberOption(options.page),
        size: parseNumberOption(options.size),
      });
      printBackupList(response.data, options.json);
    });

  backupCli
    .command("get <name>", "Show backup details")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (name: string, options: BackupCommandOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const backupApi = new BackupV1alpha1Api(undefined, profile.baseUrl, clients.axios);
      const response = await backupApi.getBackup({ name });
      printBackup(response.data, options.json);
    });

  backupCli
    .command("create [name]", "Create a backup")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--format <type>", "Backup format, default is zip")
    .option("--expires-at <datetime>", "Backup expiration time in ISO-8601 format")
    .option("--wait", "Wait for backup completion after create")
    .option("--wait-timeout <seconds>", "Maximum seconds to wait for backup completion")
    .action(async (name: string | undefined, options: BackupCreateOptions) => {
      const requestedName = name?.trim();
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const backupApi = new BackupV1alpha1Api(undefined, profile.baseUrl, clients.axios);
      const spinnerEnabled = Boolean(process.stdout.isTTY && !options.json);
      const spinner = createSpinner(
        spinnerEnabled,
        requestedName ? `Creating backup ${requestedName}...` : "Creating backup...",
      );

      try {
        const response = await backupApi.createBackup({
          backup: buildBackupCreatePayload(requestedName, options),
        });
        const createdBackup = response.data;
        const createdName = createdBackup.metadata.name?.trim();

        if (!createdName) {
          throw new CliError("Backup creation response did not include a backup name.");
        }

        if (options.wait) {
          const timeoutMs = resolveWaitTimeoutMs(options.waitTimeout);

          if (spinner) {
            spinner.text = `Waiting for backup ${createdName}...`;
          }

          const completedBackup = await waitForBackupCompletion(
            backupApi,
            createdName,
            timeoutMs,
            spinnerEnabled
              ? (backup, elapsedMs) => {
                  if (!spinner) {
                    return;
                  }

                  const phase = backup.status?.phase?.toLowerCase() ?? "pending";
                  const sizeText = backup.status?.size
                    ? `, ${prettyBytes(backup.status.size, {
                        binary: true,
                        maximumFractionDigits: 1,
                      })}`
                    : "";
                  spinner.text = `Waiting for backup ${createdName}... ${phase} (${Math.ceil(elapsedMs / 1_000)}s${sizeText})`;
                }
              : undefined,
          );

          spinner?.succeed(`Backup ${createdName} completed.`);
          printBackup(completedBackup, options.json);
          return;
        }

        spinner?.succeed(`Created backup ${createdName}.`);
        printBackup(createdBackup, options.json);
      } catch (error) {
        spinner?.fail(`Failed to create backup.`);
        throw error;
      }
    });

  backupCli
    .command("download <name>", "Download a backup file")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--output <path>", "Output path for downloaded backup file")
    .action(async (name: string, options: BackupDownloadOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const backupApi = new BackupV1alpha1Api(undefined, profile.baseUrl, clients.axios);
      const migrationConsoleApi = new MigrationV1alpha1ConsoleApi(
        undefined,
        profile.baseUrl,
        clients.axios,
      );
      const spinnerEnabled = Boolean(process.stdout.isTTY && !options.json);

      const backupResponse = await backupApi.getBackup({ name });
      const backup = backupResponse.data;
      const filename = ensureBackupFilename(backup.status?.filename);
      const outputPath = resolveBackupDownloadFilePath(filename, options.output);
      const spinner = createSpinner(spinnerEnabled, `Downloading backup ${name}...`);

      try {
        const downloadResponse = (await migrationConsoleApi.downloadBackups(
          {
            name,
            filename,
          },
          {
            responseType: "arraybuffer",
            onDownloadProgress: spinnerEnabled
              ? (event) => {
                  if (!spinner) {
                    return;
                  }

                  const loaded = prettyBytes(event.loaded ?? 0, {
                    binary: true,
                    maximumFractionDigits: 1,
                  });
                  const total = event.total
                    ? ` / ${prettyBytes(event.total, {
                        binary: true,
                        maximumFractionDigits: 1,
                      })}`
                    : "";
                  spinner.text = `Downloading backup ${name}... ${loaded}${total}`;
                }
              : undefined,
          },
        )) as unknown as { data: ArrayBuffer };

        await writeFile(outputPath, Buffer.from(downloadResponse.data));
        spinner?.succeed(`Downloaded backup ${name} to ${outputPath}.`);
      } catch (error) {
        spinner?.fail(`Failed to download backup ${name}.`);
        throw error;
      }

      if (options.json) {
        printJson({
          name: backup.metadata.name,
          filename,
          outputPath,
        });
        return;
      }

      if (!spinnerEnabled) {
        process.stdout.write(`Downloaded backup ${name} to ${outputPath}.\n`);
      }
    });

  backupCli
    .command("delete <name>", "Delete a backup")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--force", "Delete without confirmation")
    .action(async (name: string, options: BackupDeleteOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const backupApi = new BackupV1alpha1Api(undefined, profile.baseUrl, clients.axios);

      if (
        !(await confirmDangerousAction(
          {
            commandPath: "halo backup delete",
            actionLabel: "Delete",
            resourceLabel: "backup",
            resourceName: name,
            cancellationVerb: "deleting",
          },
          options,
        ))
      ) {
        return;
      }

      await backupApi.deleteBackup({ name });

      if (options.json) {
        printJson({ deleted: true, name });
        return;
      }

      process.stdout.write(`Deleted backup ${name}.\n`);
    });

  backupCli.usage("<command> [flags]");
  backupCli.example((bin) => `${bin} list --page 1 --size 20`);
  backupCli.example((bin) => `${bin} get backup-abc123`);
  backupCli.example((bin) => `${bin} create --wait --wait-timeout 600`);
  backupCli.example((bin) => `${bin} download backup-abc123 --output ./backups`);
  backupCli.example((bin) => `${bin} delete backup-abc123 --force`);
  backupCli.help();

  return backupCli;
}

export async function tryRunBackupCommand(
  args: string[],
  runtime: RuntimeContext,
): Promise<boolean> {
  return tryRunCommandCliRoute({
    command: "backup",
    cliName: "halo backup",
    args,
    buildCli: () => buildBackupCli(runtime),
  });
}

export function registerBackupCommands(cli: CAC): void {
  cli.command("backup", "Backup management commands");
}
