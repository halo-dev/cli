import { readFile, writeFile } from "node:fs/promises";

import type { ContentWrapper, SinglePage } from "@halo-dev/api-client";
import axios from "axios";
import cac, { type CAC } from "cac";

import { tryRunCommandCliRoute } from "../../utils/command-router.js";
import { confirmDangerousAction } from "../../utils/confirmation.js";
import { DEFAULT_CONTENT_RAW_TYPE, renderContentByRawType } from "../../utils/content.js";
import { CliError } from "../../utils/errors.js";
import { parseBooleanOption, parseNumberOption } from "../../utils/options.js";
import { printJson, printResourceMutationSuccess, stringifyJson } from "../../utils/output.js";
import { type HaloClients, RuntimeContext } from "../../utils/runtime.js";
import { openUrlInBrowser, resolveSinglePageOpenUrl } from "./browser.js";
import { printSinglePageDetail, printSinglePageList } from "./format.js";
import { normalizeCreateSinglePageInput, normalizeUpdateSinglePageInput } from "./input.js";

interface SinglePageCommandOptions {
  profile?: string;
  json?: boolean;
  page?: string;
  size?: string;
  keyword?: string;
  publishPhase?: string;
  visible?: string;
  name?: string;
  title?: string;
  slug?: string;
  content?: string;
  contentFile?: string;
  rawType?: string;
  excerpt?: string;
  cover?: string;
  template?: string;
  publish?: string;
  allowComment?: string;
  priority?: string;
  force?: boolean;
  newName?: string;
}

interface SinglePageJsonCommandOptions extends SinglePageCommandOptions {
  file?: string;
  raw?: string;
  output?: string;
}

interface SinglePageTransferPayload {
  page: SinglePage;
  content: {
    content: string;
    raw: string;
    rawType: string;
  };
}

interface SinglePageMutationInput {
  name?: string;
  title?: string;
  slug?: string;
  content?: string;
  contentFile?: string;
  rawType?: string;
  excerpt?: string;
  cover?: string;
  template?: string;
  visible?: string;
  publish?: boolean;
  allowComment?: boolean;
  priority?: number;
}

export function toMutationInput(options: SinglePageCommandOptions): SinglePageMutationInput {
  return {
    name: options.name,
    title: options.title,
    slug: options.slug,
    content: options.content,
    contentFile: options.contentFile,
    rawType: options.rawType,
    excerpt: options.excerpt,
    cover: options.cover,
    template: options.template,
    visible: options.visible,
    publish: parseBooleanOption(options.publish),
    allowComment: parseBooleanOption(options.allowComment),
    priority: parseNumberOption(options.priority),
  };
}

export function parseSinglePageTransferPayload(raw: string): SinglePageTransferPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CliError("Invalid single page JSON payload.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new CliError("Single page JSON payload must be an object with `page` and `content`.");
  }

  const payload = parsed as Record<string, unknown>;
  const page = payload.page;
  const content = payload.content;

  if (!page || typeof page !== "object") {
    throw new CliError("Single page JSON payload must include a `page` object.");
  }

  if (!content || typeof content !== "object") {
    throw new CliError("Single page JSON payload must include a `content` object.");
  }

  const contentRecord = content as Record<string, unknown>;
  const rawContent =
    typeof contentRecord.raw === "string"
      ? contentRecord.raw
      : typeof contentRecord.content === "string"
        ? contentRecord.content
        : undefined;
  const rawType =
    typeof contentRecord.rawType === "string" && contentRecord.rawType.trim().length > 0
      ? contentRecord.rawType.trim()
      : DEFAULT_CONTENT_RAW_TYPE;
  const renderedContent = rawContent ? renderContentByRawType(rawContent, rawType) : undefined;

  if (!rawContent || !renderedContent) {
    throw new CliError("Single page JSON payload must include `content.raw` or `content.content`.");
  }

  const typedPage = page as SinglePage;
  const pageName = typedPage.metadata?.name?.trim();
  if (!pageName) {
    throw new CliError("Single page JSON payload must include `page.metadata.name`.");
  }

  return {
    page: {
      ...typedPage,
      metadata: {
        ...typedPage.metadata,
        name: pageName,
      },
    },
    content: {
      raw: rawContent,
      content: renderedContent,
      rawType,
    },
  };
}

export async function resolveSinglePageTransferPayload(
  options: SinglePageJsonCommandOptions,
): Promise<SinglePageTransferPayload> {
  return (await resolveSinglePageTransferInput(options)).payload;
}

async function resolveSinglePageTransferInput(
  options: SinglePageJsonCommandOptions,
): Promise<{ payload: SinglePageTransferPayload; sourceLabel: string }> {
  const file = options.file?.trim();
  const raw = options.raw?.trim();
  const sourceCount = Number(Boolean(file)) + Number(Boolean(raw));

  if (sourceCount !== 1) {
    throw new CliError("Provide exactly one single page JSON source: --file or --raw.");
  }

  const payload = file ? await readFile(file, "utf8") : raw!;
  return {
    payload: parseSinglePageTransferPayload(payload),
    sourceLabel: file ? `JSON file ${file}` : "inline JSON",
  };
}

function resolveSinglePageExportOutputPath(name: string, output?: string): string {
  const normalized = output?.trim();
  return normalized && normalized.length > 0 ? normalized : `./${name}.json`;
}

async function loadSinglePageDetail(
  clients: HaloClients,
  name: string,
): Promise<SinglePageTransferPayload> {
  const [pageResponse, contentResponse] = await Promise.all([
    clients.core.content.singlePage.getSinglePage({ name }),
    clients.console.content.singlePage.fetchSinglePageHeadContent({ name }),
  ]);

  const rawType = contentResponse.data.rawType ?? DEFAULT_CONTENT_RAW_TYPE;
  const raw = contentResponse.data.raw ?? contentResponse.data.content ?? "";
  const content = renderContentByRawType(raw, rawType);

  return {
    page: pageResponse.data,
    content: {
      raw,
      content,
      rawType,
    },
  };
}

async function loadEditableSinglePageState(
  clients: HaloClients,
  name: string,
): Promise<{ page: SinglePage; content: ContentWrapper | undefined }> {
  const detail = await loadSinglePageDetail(clients, name);
  return {
    page: detail.page,
    content: detail.content,
  };
}

export async function syncSinglePagePublishState(
  clients: HaloClients,
  page: SinglePage,
  publish: boolean | undefined,
): Promise<SinglePage> {
  if (publish === undefined) {
    return page;
  }

  const name = page.metadata.name;

  if (publish) {
    const response = await clients.console.content.singlePage.publishSinglePage({ name });
    return response.data;
  }

  if (page.spec.publish) {
    const response = await clients.core.content.singlePage.updateSinglePage({
      name,
      singlePage: {
        ...page,
        spec: {
          ...page.spec,
          publish: false,
        },
      },
    });
    return response.data;
  }

  return page;
}

export function registerSinglePageCommands(cli: CAC): void {
  cli.command("single-page", "Single page management commands");
}

function buildSinglePageCli(runtime: RuntimeContext): CAC {
  const singlePageCli = cac("halo single-page");

  singlePageCli
    .command("list", "List single pages")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number", { default: 1 })
    .option("--size <number>", "Page size", { default: 20 })
    .option("--keyword <keyword>", "Filter by keyword")
    .option("--publish-phase <phase>", "Filter by publish phase")
    .option("--visible <visibility>", "Filter by visibility")
    .action(async (options: SinglePageCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const response = await clients.console.content.singlePage.listSinglePages({
        page: parseNumberOption(options.page),
        size: parseNumberOption(options.size),
        keyword: options.keyword,
        publishPhase: options.publishPhase as never,
        visible: options.visible as never,
      });

      printSinglePageList(response.data as never, options.json);
    });

  singlePageCli
    .command("get <name>", "Show single page details")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (name: string, options: SinglePageCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const detail = await loadSinglePageDetail(clients, name);
      printSinglePageDetail(detail, options.json);
    });

  singlePageCli
    .command("open <name>", "Open a published single page in the browser")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (name: string, options: SinglePageCommandOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const response = await clients.core.content.singlePage.getSinglePage({
        name,
      });
      const permalink = response.data.status?.permalink;

      if (!permalink) {
        throw new CliError(
          "This single page does not have a permalink yet. It may not be published.",
        );
      }

      const url = resolveSinglePageOpenUrl(profile.baseUrl, permalink);

      if (options.json) {
        printJson({ name, url });
        return;
      }

      await openUrlInBrowser(url);
      process.stdout.write(`Opened ${url}\n`);
    });

  singlePageCli
    .command("create", "Create a single page")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--name <name>", "Single page resource name")
    .option("--title <title>", "Single page title")
    .option("--slug <slug>", "Single page slug")
    .option("--content <content>", "Inline single page content")
    .option("--raw-type <type>", "Content raw type, defaults to markdown")
    .option("--excerpt <excerpt>", "Explicit excerpt")
    .option("--cover <url>", "Cover image URL")
    .option("--template <name>", "Template name")
    .option("--visible <visibility>", "PUBLIC, INTERNAL, or PRIVATE")
    .option("--publish <true|false>", "Whether the single page is published")
    .option("--allow-comment <true|false>", "Whether comments are allowed")
    .option("--priority <number>", "Single page priority")
    .action(async (options: SinglePageCommandOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const request = await normalizeCreateSinglePageInput(toMutationInput(options));

      const createResponse = await clients.console.content.singlePage.draftSinglePage({
        singlePageRequest: {
          page: {
            ...request.page,
            spec: {
              ...request.page.spec,
              publish: false,
            },
          },
          content: request.content,
        },
      });

      const latestPage = await syncSinglePagePublishState(
        clients,
        createResponse.data,
        request.page.spec.publish,
      );

      if (options.json) {
        printJson(latestPage);
        return;
      }

      printResourceMutationSuccess({
        message: "Single page created successfully.",
        baseUrl: profile.baseUrl,
        name: latestPage.metadata.name,
        permalink: latestPage.status?.permalink,
        resourceLabel: "Single page",
        inspectCommand: `halo single-page get ${latestPage.metadata.name}`,
      });
    });

  singlePageCli
    .command("update <name>", "Update a single page")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--new-name <name>", "Update the resource name")
    .option("--title <title>", "Single page title")
    .option("--slug <slug>", "Single page slug")
    .option("--content <content>", "Inline single page content")
    .option("--raw-type <type>", "Content raw type, defaults to markdown")
    .option("--excerpt <excerpt>", "Explicit excerpt")
    .option("--cover <url>", "Cover image URL")
    .option("--template <name>", "Template name")
    .option("--visible <visibility>", "PUBLIC, INTERNAL, or PRIVATE")
    .option("--publish <true|false>", "Whether the single page is published")
    .option("--allow-comment <true|false>", "Whether comments are allowed")
    .option("--priority <number>", "Single page priority")
    .action(async (name: string, options: SinglePageCommandOptions) => {
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const currentState = await loadEditableSinglePageState(clients, name);

      const request = await normalizeUpdateSinglePageInput(
        currentState.page,
        currentState.content,
        {
          ...toMutationInput(options),
          name: options.newName,
        },
      );

      const updateResponse = await clients.console.content.singlePage.updateDraftSinglePage({
        name,
        singlePageRequest: {
          page: {
            ...request.page,
            spec: {
              ...request.page.spec,
              publish: currentState.page.spec.publish,
            },
          },
          content: request.content,
        },
      });

      const updatedPage = await syncSinglePagePublishState(
        clients,
        updateResponse.data,
        request.page.spec.publish,
      );

      if (options.json) {
        printJson(updatedPage);
        return;
      }

      printResourceMutationSuccess({
        message: "Single page updated successfully.",
        baseUrl: profile.baseUrl,
        name: updatedPage.metadata.name,
        permalink: updatedPage.status?.permalink,
        resourceLabel: "Single page",
        inspectCommand: `halo single-page get ${updatedPage.metadata.name}`,
      });
    });

  singlePageCli
    .command("delete <name>", "Delete a single page")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--force", "Delete without confirmation")
    .action(async (name: string, options: SinglePageCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);

      if (
        !(await confirmDangerousAction(
          {
            commandPath: "halo single-page delete",
            actionLabel: "Delete",
            resourceLabel: "single page",
            resourceName: name,
            cancellationVerb: "deleting",
          },
          options,
        ))
      ) {
        return;
      }

      await clients.core.content.singlePage.deleteSinglePage({ name });

      if (options.json) {
        printJson({ deleted: true, name });
        return;
      }

      process.stdout.write(`Deleted single page ${name}.\n`);
    });

  singlePageCli
    .command("export-json <name>", "Export a single page as JSON")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--output <path>", "Write JSON to a specific file path")
    .action(async (name: string, options: SinglePageJsonCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const detail = await loadSinglePageDetail(clients, name);
      const outputPath = resolveSinglePageExportOutputPath(name, options.output);

      await writeFile(outputPath, stringifyJson(detail));
      if (options.json) {
        printJson({ name, outputPath });
        return;
      }
      process.stdout.write(`Exported single page ${name} to ${outputPath}.\n`);
    });

  singlePageCli
    .command("import-json", "Import a single page from JSON")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--file <path>", "Read single page JSON from a file")
    .option("--raw <json>", "Inline single page JSON payload")
    .option("--force", "Update without confirmation when the single page already exists")
    .action(async (options: SinglePageJsonCommandOptions) => {
      const { payload, sourceLabel } = await resolveSinglePageTransferInput(options);
      const { profile, clients } = await runtime.getClientsForOptions(options);
      const targetName = payload.page.metadata.name;
      let resultName = targetName;
      let action: "imported" | "updated" = "imported";

      try {
        const currentState = await loadEditableSinglePageState(clients, targetName);

        if (
          !(await confirmDangerousAction(
            {
              commandPath: "halo single-page import-json",
              actionLabel: "Update",
              resourceLabel: "single page",
              resourceName: targetName,
              cancellationVerb: "updating",
            },
            options,
          ))
        ) {
          return;
        }

        const updateResponse = await clients.console.content.singlePage.updateDraftSinglePage({
          name: targetName,
          singlePageRequest: {
            page: {
              ...payload.page,
              spec: {
                ...payload.page.spec,
                publish: currentState.page.spec.publish,
              },
            },
            content: payload.content,
          },
        });

        resultName = updateResponse.data.metadata.name;
        await syncSinglePagePublishState(clients, updateResponse.data, payload.page.spec.publish);
        action = "updated";
      } catch (error) {
        if (!axios.isAxiosError(error) || error.response?.status !== 404) {
          throw error;
        }

        const createResponse = await clients.console.content.singlePage.draftSinglePage({
          singlePageRequest: {
            page: {
              ...payload.page,
              spec: {
                ...payload.page.spec,
                publish: false,
              },
            },
            content: payload.content,
          },
        });

        resultName = createResponse.data.metadata.name;
        await syncSinglePagePublishState(clients, createResponse.data, payload.page.spec.publish);
      }

      const detail = await loadSinglePageDetail(clients, resultName);

      if (options.json) {
        printJson(detail);
        return;
      }

      printResourceMutationSuccess({
        message:
          action === "updated"
            ? `Single page import updated an existing page from ${sourceLabel}.`
            : `Single page imported successfully from ${sourceLabel}.`,
        baseUrl: profile.baseUrl,
        name: detail.page.metadata.name,
        permalink: detail.page.status?.permalink,
        resourceLabel: "Single page",
        inspectCommand: `halo single-page get ${detail.page.metadata.name}`,
      });
    });

  singlePageCli.usage("<command> [flags]");
  singlePageCli.example((bin) => `${bin} list --page 1 --size 20`);
  singlePageCli.example((bin) => `${bin} get about --json`);
  singlePageCli.example((bin) => `${bin} export-json about`);
  singlePageCli.example((bin) => `${bin} export-json about --output ./single-page.json`);
  singlePageCli.example((bin) => `${bin} open about`);
  singlePageCli.example(
    (bin) => `${bin} create --title "About" --content "# About" --publish true`,
  );
  singlePageCli.example(
    (bin) => `${bin} create --title "About" --content "<h1>Hello Halo</h1>" --raw-type "html"`,
  );
  singlePageCli.example((bin) => `${bin} update about --title "About Halo"`);
  singlePageCli.example((bin) => `${bin} import-json --file ./single-page.json`);
  singlePageCli.example((bin) => `${bin} import-json --raw '{"page":...,"content":...}'`);
  singlePageCli.example((bin) => `${bin} delete about --force`);
  singlePageCli.help();

  return singlePageCli;
}

export async function tryRunSinglePageCommand(
  args: string[],
  runtime: RuntimeContext,
): Promise<boolean> {
  return tryRunCommandCliRoute({
    command: "single-page",
    cliName: "halo single-page",
    args,
    buildCli: () => buildSinglePageCli(runtime),
  });
}
