import { confirm } from "@inquirer/prompts";

import { CliError } from "./errors.js";
import { printJson } from "./output.js";

export const TRUSTED_REMOTE_PACKAGE_SOURCE_HOST = "www.halo.run";

export interface RemotePackageSourceConfirmationOptions {
  json?: boolean;
  yes?: boolean;
}

interface RemotePackageSourceConfirmationConfig {
  commandPath: string;
  actionLabel: string;
}

function parseRemotePackageSource(sourceUrl: string): URL {
  try {
    return new URL(sourceUrl);
  } catch {
    throw new CliError("Package source must be a valid absolute URL or file URI.");
  }
}

export function requiresThirdPartyPackageSourceConfirmation(sourceUrl: string): boolean {
  const parsedUrl = parseRemotePackageSource(sourceUrl.trim());

  if (parsedUrl.protocol === "file:") {
    return false;
  }

  return parsedUrl.hostname !== TRUSTED_REMOTE_PACKAGE_SOURCE_HOST;
}

export async function confirmThirdPartyPackageSource(
  sourceUrl: string,
  config: RemotePackageSourceConfirmationConfig,
  options: RemotePackageSourceConfirmationOptions,
): Promise<boolean> {
  const normalizedUrl = sourceUrl.trim();

  if (!requiresThirdPartyPackageSourceConfirmation(normalizedUrl)) {
    return true;
  }

  if (options.yes) {
    return true;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new CliError(
      `\`${config.commandPath}\` requires confirmation in interactive mode for third-party package URLs or use --yes.`,
    );
  }

  process.stdout.write(
    `Warning: remote package URL is not hosted on ${TRUSTED_REMOTE_PACKAGE_SOURCE_HOST}: ${normalizedUrl}\n`,
  );

  const confirmed = await confirm({
    message: `Continue ${config.actionLabel} from this third-party URL?`,
    default: false,
  });

  if (confirmed) {
    return true;
  }

  if (options.json) {
    printJson({ cancelled: true, url: normalizedUrl });
  } else {
    process.stdout.write(`Cancelled ${config.actionLabel}.\n`);
  }

  return false;
}
