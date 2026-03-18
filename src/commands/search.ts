import { type SearchOption, IndexV1alpha1PublicApi } from "@halo-dev/api-client";
import axios from "axios";
import cac, { type CAC } from "cac";

import { tryRunCommandCliRoute } from "../utils/command-router.js";
import { CliError } from "../utils/errors.js";
import { printSearchResult } from "../utils/format.js";
import { parseNumberOption } from "../utils/post-input.js";
import { normalizeBaseUrl, RuntimeContext } from "../utils/runtime.js";

interface SearchCommandOptions {
  profile?: string;
  url?: string;
  keyword?: string;
  limit?: string;
  json?: boolean;
}

export function buildSearchOption(keyword: string | undefined, limit?: string): SearchOption {
  const normalizedKeyword = keyword?.trim();
  if (!normalizedKeyword) {
    throw new CliError("`halo search` requires --keyword.");
  }

  const parsedLimit = parseNumberOption(limit);
  if (parsedLimit !== undefined && parsedLimit <= 0) {
    throw new CliError("`--limit` must be a positive number.");
  }

  return {
    keyword: normalizedKeyword,
    limit: parsedLimit,
  };
}

export async function resolveSearchBaseUrl(
  runtime: RuntimeContext,
  options: SearchCommandOptions,
): Promise<string> {
  if (options.url?.trim()) {
    return normalizeBaseUrl(options.url);
  }

  const profile = await runtime.configStore.getActiveProfile(options.profile);
  return normalizeBaseUrl(profile.baseUrl);
}

function buildSearchCli(runtime: RuntimeContext): CAC {
  const searchCli = cac("halo search");

  searchCli
    .command("", "Search public site content")
    .option("--profile <name>", "Halo profile name")
    .option("--url <url>", "Public Halo site URL without authentication")
    .option("--keyword <keyword>", "Search keyword")
    .option("--limit <number>", "Maximum number of results")
    .option("--json", "Output JSON")
    .action(async (options: SearchCommandOptions) => {
      const baseUrl = await resolveSearchBaseUrl(runtime, options);
      const searchApi = new IndexV1alpha1PublicApi(
        undefined,
        baseUrl,
        axios.create({
          baseURL: baseUrl,
          timeout: 30_000,
          headers: {
            Accept: "application/json",
          },
        }),
      );
      const response = await searchApi.indicesSearch({
        searchOption: buildSearchOption(options.keyword, options.limit),
      });

      printSearchResult(response.data, options.json);
    });

  searchCli.usage("[flags]");
  searchCli.example((bin) => `${bin} --keyword "halo"`);
  searchCli.example((bin) => `${bin} --keyword "halo" --url https://www.halo.run`);
  searchCli.example((bin) => `${bin} --keyword "halo" --limit 5 --json`);
  searchCli.help();

  return searchCli;
}

export async function tryRunSearchCommand(
  args: string[],
  runtime: RuntimeContext,
): Promise<boolean> {
  return tryRunCommandCliRoute({
    command: "search",
    cliName: "halo search",
    args,
    buildCli: () => buildSearchCli(runtime),
  });
}

export function registerSearchCommands(cli: CAC): void {
  cli.command("search", "Search public site content");
}
