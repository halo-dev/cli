import { type CAC } from "cac";

import { CliError } from "../../utils/errors.js";
import { RuntimeContext } from "../../utils/runtime.js";
import { ShopApi } from "./api.js";
import { createShopCli } from "./cli.js";
import { printDailyStatistics } from "./format.js";

interface StatsDailyOptions {
  profile?: string;
  json?: boolean;
  start?: string;
  end?: string;
}

function validateDateOption(value: string | undefined, optionName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsed = match === null ? new Date(Number.NaN) : new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new CliError(`${optionName} must be a valid date in yyyy-MM-dd format, got "${value}".`);
  }

  return value;
}

export function buildStatsCli(runtime: RuntimeContext): CAC {
  const statsCli = createShopCli("halo shop stats");

  statsCli
    .command("daily", "Show daily order statistics")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--start <date>", "Start date, defaults to 30 days ago (yyyy-MM-dd)")
    .option("--end <date>", "End date, defaults to today (yyyy-MM-dd)")
    .action(async (options: StatsDailyOptions) => {
      const { clients } = await runtime.getClientsForOptions(options);
      const api = new ShopApi(clients.axios);
      const statistics = await api.getDailyStatistics(
        validateDateOption(options.start, "--start"),
        validateDateOption(options.end, "--end"),
      );
      printDailyStatistics(statistics, options.json);
    });

  statsCli.usage("<command> [flags]");
  statsCli.example((bin) => `${bin} daily`);
  statsCli.example((bin) => `${bin} daily --start 2026-01-01 --end 2026-01-31`);
  statsCli.help();

  return statsCli;
}
