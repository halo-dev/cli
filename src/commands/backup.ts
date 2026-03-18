import { writeFile } from "node:fs/promises";

import { type Backup, BackupV1alpha1Api, MigrationV1alpha1ConsoleApi } from "@halo-dev/api-client";
import { confirm } from "@inquirer/prompts";
import type { CAC } from "cac";
import ora from "ora";
import prettyBytes from "pretty-bytes";

import { ensureBackupFilename, resolveBackupDownloadFilePath } from "../utils/backup.js";
import { printCommandHelp } from "../utils/command-help.js";
import { CliError } from "../utils/errors.js";
import { printBackup, printBackupList, printJson } from "../utils/format.js";
import { parseNumberOption } from "../utils/post-input.js";
import { RuntimeContext } from "../utils/runtime.js";

const BACKUP_API_VERSION = "migration.halo.run/v1alpha1";
const BACKUP_KIND = "Backup";
const BACKUP_POLL_INTERVAL_MS = 2_000;
const DEFAULT_WAIT_TIMEOUT_SECONDS = 300;

interface BackupCommandOptions {
  profile?: string;
  json?: boolean;
  page?: string;
  size?: string;
  output?: string;
  format?: string;
  expiresAt?: string;
  wait?: boolean;
  waitTimeout?: string;
  force?: boolean;
}

function createSpinner(enabled: boolean, text: string) {
  return enabled ? ora(text).start() : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolveWaitTimeoutMs(value: string | undefined): number {
  const timeoutSeconds = parseNumberOption(value) ?? DEFAULT_WAIT_TIMEOUT_SECONDS;
  if (!timeoutSeconds || timeoutSeconds <= 0) {
    throw new CliError("`--wait-timeout` must be a positive number of seconds.");
  }

  return timeoutSeconds * 1_000;
}

function buildBackupCreatePayload(name: string | undefined, options: BackupCommandOptions): Backup {
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

export function registerBackupCommands(cli: CAC, runtime: RuntimeContext): void {
  cli
    .command("backup [action] [name]", "Backup management commands")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number")
    .option("--size <number>", "Page size")
    .option("--format <type>", "Backup format, default is zip")
    .option("--expires-at <datetime>", "Backup expiration time in ISO-8601 format")
    .option("--wait", "Wait for backup completion after create")
    .option("--wait-timeout <seconds>", "Maximum seconds to wait for backup completion")
    .option("--output <path>", "Output path for downloaded backup file")
    .option("--force", "Delete without confirmation")
    .action(
      async (
        action: string | undefined,
        name: string | undefined,
        options: BackupCommandOptions,
      ) => {
        if (!action) {
          printCommandHelp({
            summary: "Work with Halo backups.",
            usage: "halo backup <command> [flags]",
            sections: [
              {
                title: "COMMANDS",
                commands: [
                  { name: "list", description: "List backups" },
                  { name: "get", description: "Show backup details" },
                  { name: "create", description: "Create a new backup" },
                  { name: "download", description: "Download a backup file" },
                  { name: "delete", description: "Delete a backup" },
                ],
              },
            ],
            flags: [
              { name: "--profile <name>", description: "Halo profile name" },
              { name: "--json", description: "Output JSON" },
              { name: "--page <number>", description: "Page number" },
              { name: "--size <number>", description: "Page size" },
              { name: "--format <type>", description: "Backup format, default is zip" },
              {
                name: "--expires-at <datetime>",
                description: "Backup expiration time in ISO-8601 format",
              },
              { name: "--wait", description: "Wait for backup completion after create" },
              {
                name: "--wait-timeout <seconds>",
                description: "Maximum seconds to wait for backup completion",
              },
              { name: "--output <path>", description: "Output path for downloaded backup file" },
              { name: "--force", description: "Delete without confirmation" },
            ],
            examples: [
              "halo backup list",
              "halo backup get <name>",
              "halo backup create",
              "halo backup create --wait",
              "halo backup create daily-backup --expires-at 2026-03-31T00:00:00Z",
              "halo backup download <name>",
            ],
            learnMore: [
              "Use `halo backup <subcommand> --help` for more information about a command.",
            ],
          });
          return;
        }

        const { profile, clients } = await runtime.getClientsForOptions(options);
        const backupApi = new BackupV1alpha1Api(undefined, profile.baseUrl, clients.axios);
        const migrationConsoleApi = new MigrationV1alpha1ConsoleApi(
          undefined,
          profile.baseUrl,
          clients.axios,
        );
        const spinnerEnabled = Boolean(process.stdout.isTTY && !options.json);

        if (action === "list") {
          const response = await backupApi.listBackup({
            page: parseNumberOption(options.page),
            size: parseNumberOption(options.size),
          });
          printBackupList(response.data, options.json);
          return;
        }

        if (action === "get") {
          if (!name) {
            throw new CliError("`halo backup get` requires a backup name.");
          }

          const response = await backupApi.getBackup({ name });
          printBackup(response.data, options.json);
          return;
        }

        if (action === "create") {
          const requestedName = name?.trim();
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
            return;
          } catch (error) {
            spinner?.fail(`Failed to create backup.`);
            throw error;
          }
        }

        if (action === "download") {
          if (!name) {
            throw new CliError("`halo backup download` requires a backup name.");
          }

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
          return;
        }

        if (action === "delete") {
          if (!name) {
            throw new CliError("`halo backup delete` requires a backup name.");
          }

          if (!options.force) {
            if (!process.stdin.isTTY || !process.stdout.isTTY) {
              throw new CliError(
                "`halo backup delete` requires confirmation in interactive mode or use --force.",
              );
            }

            const confirmed = await confirm({
              message: `Delete backup ${name}?`,
              default: false,
            });

            if (!confirmed) {
              if (options.json) {
                printJson({ deleted: false, name, cancelled: true });
                return;
              }

              process.stdout.write(`Cancelled deleting backup ${name}.\n`);
              return;
            }
          }

          await backupApi.deleteBackup({ name });

          if (options.json) {
            printJson({ deleted: true, name });
            return;
          }

          process.stdout.write(`Deleted backup ${name}.\n`);
          return;
        }

        throw new CliError(
          `Unsupported backup action: ${action}. Supported actions: list, get, create, download, delete.`,
        );
      },
    );
}
