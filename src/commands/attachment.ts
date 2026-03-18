import { File } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

import { AttachmentV1alpha1Api, AttachmentV1alpha1ConsoleApi } from "@halo-dev/api-client";
import { confirm } from "@inquirer/prompts";
import type { CAC } from "cac";
import ora from "ora";
import prettyBytes from "pretty-bytes";

import {
  ensureAttachmentPermalink,
  resolveDownloadFilePath,
  resolveUploadFilename,
} from "../utils/attachment.js";
import { printCommandHelp } from "../utils/command-help.js";
import { CliError } from "../utils/errors.js";
import { printAttachment, printAttachmentList, printJson } from "../utils/format.js";
import { parseNumberOption } from "../utils/post-input.js";
import { RuntimeContext } from "../utils/runtime.js";

interface AttachmentCommandOptions {
  profile?: string;
  json?: boolean;
  page?: string;
  size?: string;
  keyword?: string;
  file?: string;
  url?: string;
  output?: string;
  force?: boolean;
}

async function loadFileAsAttachment(filePath: string): Promise<File> {
  const normalizedPath = filePath.trim();
  const buffer = await readFile(normalizedPath);
  return new File([buffer], basename(normalizedPath), {
    type: "application/octet-stream",
  });
}

function createSpinner(enabled: boolean, text: string) {
  return enabled ? ora(text).start() : undefined;
}

export function registerAttachmentCommands(cli: CAC, runtime: RuntimeContext): void {
  cli
    .command("attachment [action] [name]", "Attachment management commands")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number")
    .option("--size <number>", "Page size")
    .option("--keyword <keyword>", "Filter by keyword")
    .option("--file <path>", "Local file path to upload")
    .option("--url <url>", "Remote URL to upload")
    .option("--output <path>", "Output path for download")
    .option("--force", "Delete without confirmation")
    .action(
      async (
        action: string | undefined,
        name: string | undefined,
        options: AttachmentCommandOptions,
      ) => {
        if (!action) {
          printCommandHelp({
            summary: "Work with Halo attachments.",
            usage: "halo attachment <command> [flags]",
            sections: [
              {
                title: "COMMANDS",
                commands: [
                  { name: "list", description: "List attachments" },
                  { name: "get", description: "Show attachment details" },
                  { name: "delete", description: "Delete an attachment" },
                  {
                    name: "upload",
                    description: "Upload an attachment from file or URL",
                  },
                  {
                    name: "download",
                    description: "Download an attachment file",
                  },
                ],
              },
            ],
            flags: [
              { name: "--profile <name>", description: "Halo profile name" },
              { name: "--json", description: "Output JSON" },
              {
                name: "--file <path>",
                description: "Local file path to upload",
              },
              { name: "--url <url>", description: "Remote URL to upload" },
              {
                name: "--output <path>",
                description: "Output path for download",
              },
            ],
            examples: [
              "halo attachment list",
              "halo attachment get <name>",
              "halo attachment upload --file ./image.png",
              "halo attachment upload --url https://example.com/image.png",
              "halo attachment download <name>",
            ],
            learnMore: [
              "Use `halo attachment <subcommand> --help` for more information about a command.",
            ],
          });
          return;
        }

        const { profile, clients } = await runtime.getClientsForOptions(options);
        const attachmentApi = new AttachmentV1alpha1Api(undefined, profile.baseUrl, clients.axios);
        const attachmentConsoleApi = new AttachmentV1alpha1ConsoleApi(
          undefined,
          profile.baseUrl,
          clients.axios,
        );
        const spinnerEnabled = Boolean(process.stdout.isTTY && !options.json);

        if (action === "list") {
          const response = await attachmentConsoleApi.searchAttachments({
            page: parseNumberOption(options.page),
            size: parseNumberOption(options.size),
            keyword: options.keyword,
          });
          printAttachmentList(response.data, options.json);
          return;
        }

        if (action === "get") {
          if (!name) {
            throw new CliError("`halo attachment get` requires an attachment name.");
          }

          const response = await attachmentApi.getAttachment({ name });
          printAttachment(response.data, options.json);
          return;
        }

        if (action === "delete") {
          if (!name) {
            throw new CliError("`halo attachment delete` requires an attachment name.");
          }

          if (!options.force) {
            if (!process.stdin.isTTY || !process.stdout.isTTY) {
              throw new CliError(
                "`halo attachment delete` requires confirmation in interactive mode or use --force.",
              );
            }

            const confirmed = await confirm({
              message: `Delete attachment ${name}?`,
              default: false,
            });

            if (!confirmed) {
              if (options.json) {
                printJson({ deleted: false, name, cancelled: true });
                return;
              }

              process.stdout.write(`Cancelled deleting attachment ${name}.\n`);
              return;
            }
          }

          await attachmentApi.deleteAttachment({ name });

          if (options.json) {
            printJson({ deleted: true, name });
            return;
          }

          process.stdout.write(`Deleted attachment ${name}.\n`);
          return;
        }

        if (action === "upload") {
          const file = options.file?.trim();
          const url = options.url?.trim();
          const sourceCount = Number(Boolean(file)) + Number(Boolean(url));

          if (sourceCount !== 1) {
            throw new CliError("Provide exactly one upload source: --file or --url.");
          }

          const sourceLabel = file ? basename(file) : url!;
          const spinner = createSpinner(spinnerEnabled, `Uploading attachment ${sourceLabel}...`);

          try {
            const response = file
              ? await attachmentConsoleApi.uploadAttachmentForConsole(
                  {
                    file: await loadFileAsAttachment(file),
                  },
                  spinnerEnabled
                    ? {
                        onUploadProgress: (event) => {
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
                          spinner.text = `Uploading attachment ${sourceLabel}... ${loaded}${total}`;
                        },
                      }
                    : undefined,
                )
              : await attachmentConsoleApi.uploadAttachmentForConsole({
                  url,
                  filename: resolveUploadFilename(undefined, url),
                });

            spinner?.succeed(`Uploaded attachment ${response.data.metadata.name}.`);
            printAttachment(response.data, options.json);
            return;
          } catch (error) {
            spinner?.fail(`Failed to upload attachment ${sourceLabel}.`);
            throw error;
          }
        }

        if (action === "download") {
          if (!name) {
            throw new CliError("`halo attachment download` requires an attachment name.");
          }

          const response = await attachmentApi.getAttachment({ name });
          const attachment = response.data;
          const permalink = ensureAttachmentPermalink(attachment.status?.permalink);
          const outputPath = resolveDownloadFilePath(
            attachment.metadata.name,
            permalink,
            attachment.spec.displayName,
            options.output,
          );

          const spinner = createSpinner(
            spinnerEnabled,
            `Downloading attachment ${attachment.metadata.name}...`,
          );

          try {
            const downloadResponse = await clients.axios.get<ArrayBuffer>(permalink, {
              responseType: "arraybuffer",
              baseURL: undefined,
              headers: {
                Accept: "*/*",
              },
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
                    spinner.text = `Downloading attachment ${attachment.metadata.name}... ${loaded}${total}`;
                  }
                : undefined,
            });

            await writeFile(outputPath, Buffer.from(downloadResponse.data));
            spinner?.succeed(`Downloaded attachment ${attachment.metadata.name} to ${outputPath}.`);
          } catch (error) {
            spinner?.fail(`Failed to download attachment ${attachment.metadata.name}.`);
            throw error;
          }

          if (options.json) {
            printJson({
              name: attachment.metadata.name,
              outputPath,
              permalink,
            });
            return;
          }

          if (!spinnerEnabled) {
            process.stdout.write(
              `Downloaded attachment ${attachment.metadata.name} to ${outputPath}.\n`,
            );
          }

          return;
        }

        throw new CliError(
          `Unsupported attachment action: ${action}. Supported actions: list, get, delete, upload, download.`,
        );
      },
    );
}
