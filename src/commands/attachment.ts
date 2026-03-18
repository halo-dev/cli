import { File } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

import { AttachmentV1alpha1Api, AttachmentV1alpha1ConsoleApi } from "@halo-dev/api-client";
import { confirm } from "@inquirer/prompts";
import cac, { type CAC } from "cac";
import ora from "ora";
import prettyBytes from "pretty-bytes";

import {
  ensureAttachmentPermalink,
  resolveDownloadFilePath,
  resolveUploadFilename,
} from "../utils/attachment.js";
import { CliError } from "../utils/errors.js";
import { printAttachment, printAttachmentList, printJson } from "../utils/format.js";
import { parseNumberOption } from "../utils/post-input.js";
import { RuntimeContext } from "../utils/runtime.js";

interface AttachmentCommandOptions {
  profile?: string;
  json?: boolean;
}

interface AttachmentListOptions extends AttachmentCommandOptions {
  page?: string;
  size?: string;
  keyword?: string;
}

interface AttachmentUploadOptions extends AttachmentCommandOptions {
  file?: string;
  url?: string;
}

interface AttachmentDownloadOptions extends AttachmentCommandOptions {
  output?: string;
}

interface AttachmentDeleteOptions extends AttachmentCommandOptions {
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

function createAttachmentCli(runtime: RuntimeContext): CAC {
  const attachmentCli = cac("halo attachment");

  attachmentCli
    .command("list", "List attachments")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number")
    .option("--size <number>", "Page size")
    .option("--keyword <keyword>", "Filter by keyword")
    .action(async (options: AttachmentListOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const attachmentConsoleApi = new AttachmentV1alpha1ConsoleApi(
        undefined,
        profile.baseUrl,
        clients.axios,
      );
      const response = await attachmentConsoleApi.searchAttachments({
        page: parseNumberOption(options.page),
        size: parseNumberOption(options.size),
        keyword: options.keyword,
      });
      printAttachmentList(response.data, options.json);
    });

  attachmentCli
    .command("get <name>", "Show attachment details")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (name: string, options: AttachmentCommandOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const attachmentApi = new AttachmentV1alpha1Api(undefined, profile.baseUrl, clients.axios);
      const response = await attachmentApi.getAttachment({ name });
      printAttachment(response.data, options.json);
    });

  attachmentCli
    .command("delete <name>", "Delete an attachment")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--force", "Delete without confirmation")
    .action(async (name: string, options: AttachmentDeleteOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const attachmentApi = new AttachmentV1alpha1Api(undefined, profile.baseUrl, clients.axios);

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
    });

  attachmentCli
    .command("upload", "Upload an attachment")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--file <path>", "Local file path to upload")
    .option("--url <url>", "Remote URL to upload")
    .action(async (options: AttachmentUploadOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const attachmentConsoleApi = new AttachmentV1alpha1ConsoleApi(
        undefined,
        profile.baseUrl,
        clients.axios,
      );
      const spinnerEnabled = Boolean(process.stdout.isTTY && !options.json);
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
      } catch (error) {
        spinner?.fail(`Failed to upload attachment ${sourceLabel}.`);
        throw error;
      }
    });

  attachmentCli
    .command("download <name>", "Download an attachment")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--output <path>", "Output path for download")
    .action(async (name: string, options: AttachmentDownloadOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const attachmentApi = new AttachmentV1alpha1Api(undefined, profile.baseUrl, clients.axios);
      const spinnerEnabled = Boolean(process.stdout.isTTY && !options.json);
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
    });

  attachmentCli.usage("<command> [flags]");
  attachmentCli.example((bin) => `${bin} list`);
  attachmentCli.example((bin) => `${bin} get <name>`);
  attachmentCli.example((bin) => `${bin} delete <name> --force`);
  attachmentCli.example((bin) => `${bin} upload --file ./image.png`);
  attachmentCli.example((bin) => `${bin} upload --url https://example.com/image.png`);
  attachmentCli.example((bin) => `${bin} download <name>`);
  attachmentCli.help();

  return attachmentCli;
}

export async function tryRunAttachmentCommand(
  args: string[],
  runtime: RuntimeContext,
): Promise<boolean> {
  if (args[0] !== "attachment") {
    return false;
  }

  const attachmentCli = createAttachmentCli(runtime);

  if (args.length === 1) {
    attachmentCli.outputHelp();
    return true;
  }

  attachmentCli.parse(["node", "halo attachment", ...args.slice(1)], { run: false });
  await attachmentCli.runMatchedCommand();
  return true;
}

export function registerAttachmentCommands(cli: CAC): void {
  cli.command("attachment", "Attachment management commands");
}
