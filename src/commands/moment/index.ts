import { readFile } from "node:fs/promises";

import { input } from "@inquirer/prompts";
import cac, { type CAC } from "cac";

import { tryRunCommandCliRoute } from "../../utils/command-router.js";
import { confirmDangerousAction } from "../../utils/confirmation.js";
import { CliError } from "../../utils/errors.js";
import {
  isInteractive,
  parseBooleanOption,
  parseCsvOption,
  parseNumberOption,
} from "../../utils/options.js";
import { printJson } from "../../utils/output.js";
import { RuntimeContext } from "../../utils/runtime.js";
import { printMoment, printMomentList } from "./format.js";
import type { ListedMomentList, Moment, MomentVisible } from "./types.js";

const MOMENT_API_VERSION = "moment.halo.run/v1alpha1";
const MOMENT_KIND = "Moment";
const MOMENT_API_BASE = "/apis/uc.api.moment.halo.run/v1alpha1/moments";

interface MomentCommandOptions {
  profile?: string;
  json?: boolean;
}

interface MomentListOptions extends MomentCommandOptions {
  page?: string;
  size?: string;
  keyword?: string;
  tag?: string;
  visible?: string;
  approved?: string;
}

interface MomentMutationOptions extends MomentCommandOptions {
  name?: string;
  content?: string;
  contentFile?: string;
  visible?: string;
  tags?: string;
  releaseTime?: string;
  approved?: string;
}

interface MomentDeleteOptions extends MomentCommandOptions {
  force?: boolean;
}

async function resolveMomentContent(
  content?: string,
  contentFile?: string,
): Promise<string | undefined> {
  if (contentFile?.trim()) {
    return readFile(contentFile.trim(), "utf8");
  }

  return content;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(value);
}

export function normalizeMomentHtml(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (looksLikeHtml(trimmed)) {
    return trimmed;
  }

  return trimmed
    .split(/\r?\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\r?\n/g, "<br />")}</p>`)
    .join("");
}

export function normalizeVisible(value: string | undefined): MomentVisible | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized !== "PUBLIC" && normalized !== "PRIVATE") {
    throw new CliError("`--visible` must be PUBLIC or PRIVATE.");
  }

  return normalized;
}

async function promptForMomentContent(
  content: string | undefined,
  mode: "create" | "update",
): Promise<string | undefined> {
  if (content || !isInteractive()) {
    return content;
  }

  return input({
    message: mode === "create" ? "Moment content" : "Updated moment content",
    validate: (value) => (value.trim().length > 0 ? true : "Content is required."),
  });
}

export function buildMomentPayload(
  content: string,
  options: MomentMutationOptions,
  name?: string,
): Moment {
  const html = normalizeMomentHtml(content);
  const visible = normalizeVisible(options.visible) ?? "PUBLIC";
  const tags = parseCsvOption(options.tags) ?? [];
  const approved = parseBooleanOption(options.approved);

  return {
    apiVersion: MOMENT_API_VERSION,
    kind: MOMENT_KIND,
    metadata: {
      name: name?.trim() || options.name?.trim() || "",
      generateName: name?.trim() || options.name?.trim() ? undefined : "moment-",
    },
    spec: {
      content: {
        raw: html,
        html,
        medium: [],
      },
      releaseTime: options.releaseTime?.trim() || new Date().toISOString(),
      owner: "",
      visible,
      tags,
      approved: approved ?? false,
    },
  };
}

async function buildMomentCli(runtime: RuntimeContext): Promise<CAC> {
  const momentCli = cac("halo moment");

  momentCli
    .command("list", "List moments")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number", { default: 1 })
    .option("--size <number>", "Page size", { default: 20 })
    .option("--keyword <keyword>", "Filter by keyword")
    .option("--tag <name>", "Filter by tag")
    .option("--visible <state>", "Filter by visibility: PUBLIC or PRIVATE")
    .option("--approved <boolean>", "Filter by approval state")
    .action(async (options: MomentListOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const response = await clients.axios.get<ListedMomentList>(MOMENT_API_BASE, {
        params: {
          page: parseNumberOption(options.page),
          size: parseNumberOption(options.size),
          keyword: options.keyword,
          tag: options.tag,
          visible: normalizeVisible(options.visible),
          approved: parseBooleanOption(options.approved),
        },
      });

      printMomentList(response.data, options.json);
    });

  momentCli
    .command("get <name>", "Show moment details")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (name: string, options: MomentCommandOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const response = await clients.axios.get<Moment>(
        `${MOMENT_API_BASE}/${encodeURIComponent(name)}`,
      );
      printMoment(response.data, options.json);
    });

  momentCli
    .command("create", "Create a moment")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--name <name>", "Explicit moment name")
    .option("--content <text>", "Moment content")
    .option("--content-file <path>", "Read moment content from file")
    .option("--visible <state>", "Moment visibility: PUBLIC or PRIVATE")
    .option("--tags <tags>", "Comma-separated tags")
    .option("--release-time <datetime>", "Release time in ISO-8601 format")
    .option("--approved <boolean>", "Initial approval state")
    .action(async (options: MomentMutationOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const resolvedContent = await resolveMomentContent(options.content, options.contentFile);
      const content = (await promptForMomentContent(resolvedContent?.trim(), "create"))?.trim();

      if (!content) {
        throw new CliError(
          "`halo moment create` requires content. Use --content, --content-file, or run interactively.",
        );
      }

      const payload = buildMomentPayload(content, options);
      const response = await clients.axios.post<Moment>(MOMENT_API_BASE, payload);
      printMoment(response.data, options.json);
    });

  momentCli
    .command("update <name>", "Update a moment")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--content <text>", "Updated moment content")
    .option("--content-file <path>", "Read updated content from file")
    .option("--visible <state>", "Moment visibility: PUBLIC or PRIVATE")
    .option("--tags <tags>", "Comma-separated tags")
    .option("--release-time <datetime>", "Release time in ISO-8601 format")
    .option("--approved <boolean>", "Approval state")
    .action(async (name: string, options: MomentMutationOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const existingResponse = await clients.axios.get<Moment>(
        `${MOMENT_API_BASE}/${encodeURIComponent(name)}`,
      );
      const existing = existingResponse.data;
      const resolvedContent = await resolveMomentContent(options.content, options.contentFile);
      const nextContent = await promptForMomentContent(
        resolvedContent?.trim() || existing.spec.content.raw,
        "update",
      );

      if (!nextContent?.trim()) {
        throw new CliError("Updated content cannot be empty.");
      }

      const html = normalizeMomentHtml(nextContent.trim());
      const response = await clients.axios.put<Moment>(
        `${MOMENT_API_BASE}/${encodeURIComponent(name)}`,
        {
          ...existing,
          spec: {
            ...existing.spec,
            content: {
              ...existing.spec.content,
              raw: html,
              html,
            },
            visible: normalizeVisible(options.visible) ?? existing.spec.visible,
            tags: parseCsvOption(options.tags) ?? existing.spec.tags,
            releaseTime: options.releaseTime?.trim() || existing.spec.releaseTime,
            approved: parseBooleanOption(options.approved) ?? existing.spec.approved,
          },
        } satisfies Moment,
      );

      printMoment(response.data, options.json);
    });

  momentCli
    .command("delete <name>", "Delete a moment")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--force", "Delete without confirmation")
    .action(async (name: string, options: MomentDeleteOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);

      if (
        !(await confirmDangerousAction(
          {
            commandPath: "halo moment delete",
            actionLabel: "Delete",
            resourceLabel: "moment",
            resourceName: name,
            cancellationVerb: "deleting",
          },
          options,
        ))
      ) {
        return;
      }

      await clients.axios.delete(`${MOMENT_API_BASE}/${encodeURIComponent(name)}`);

      if (options.json) {
        printJson({ deleted: true, name });
        return;
      }

      process.stdout.write(`Deleted moment ${name}.\n`);
    });

  momentCli.usage("<command> [flags]");
  momentCli.example((bin) => `${bin} list --page 1 --size 20`);
  momentCli.example((bin) => `${bin} get moment-abc123`);
  momentCli.example((bin) => `${bin} create --content "Hello Halo" --tags life,cli`);
  momentCli.example((bin) => `${bin} update moment-abc123 --content-file ./moment.html`);
  momentCli.example((bin) => `${bin} delete moment-abc123 --force`);
  momentCli.help();

  return momentCli;
}

export async function tryRunMomentCommand(
  args: string[],
  runtime: RuntimeContext,
): Promise<boolean> {
  return tryRunCommandCliRoute({
    command: "moment",
    cliName: "halo moment",
    args,
    buildCli: () => buildMomentCli(runtime),
  });
}

export function registerMomentCommands(cli: CAC): void {
  cli.command("moment", "Moment management commands");
}
