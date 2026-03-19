import { confirm } from "@inquirer/prompts";

import { CliError } from "./errors.js";
import { printJson } from "./output.js";

export interface DangerousActionOptions {
  force?: boolean;
  json?: boolean;
}

interface DangerousActionConfig {
  commandPath: string;
  actionLabel: string;
  resourceLabel: string;
  resourceName: string;
  cancellationVerb: string;
}

export async function confirmDangerousAction(
  config: DangerousActionConfig,
  options: DangerousActionOptions,
): Promise<boolean> {
  if (options.force) {
    return true;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new CliError(
      `\`${config.commandPath}\` requires confirmation in interactive mode or use --force.`,
    );
  }

  const confirmed = await confirm({
    message: `${config.actionLabel} ${config.resourceLabel} ${config.resourceName}?`,
    default: false,
  });

  if (confirmed) {
    return true;
  }

  if (options.json) {
    printJson({ name: config.resourceName, cancelled: true });
  } else {
    process.stdout.write(
      `Cancelled ${config.cancellationVerb} ${config.resourceLabel} ${config.resourceName}.\n`,
    );
  }

  return false;
}
