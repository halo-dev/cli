import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { CliError } from "./errors.js";
import { normalizeBaseUrl } from "./url.js";

const execFileAsync = promisify(execFile);

export interface BrowserOpenCommand {
  command: string;
  args: string[];
}

export function resolvePermalinkUrl(
  baseUrl: string,
  permalink: string,
  resourceLabel = "Resource",
): string {
  const normalizedPermalink = permalink.trim();
  if (!normalizedPermalink) {
    throw new CliError(`${resourceLabel} permalink is empty.`);
  }

  if (/^https?:\/\//i.test(normalizedPermalink)) {
    return normalizedPermalink;
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const parsedBaseUrl = new URL(normalizedBaseUrl);

  if (normalizedPermalink.startsWith("/")) {
    return new URL(normalizedPermalink, parsedBaseUrl.origin).toString();
  }

  return new URL(normalizedPermalink, `${normalizedBaseUrl}/`).toString();
}

export function getBrowserOpenCommand(
  url: string,
  platform = process.platform,
): BrowserOpenCommand {
  if (platform === "darwin") {
    return { command: "open", args: [url] };
  }

  if (platform === "win32") {
    return { command: "cmd", args: ["/c", "start", "", url] };
  }

  return { command: "xdg-open", args: [url] };
}

export async function openUrlInBrowser(url: string): Promise<void> {
  const { command, args } = getBrowserOpenCommand(url);

  try {
    await execFileAsync(command, args);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown browser error.";
    throw new CliError(`Failed to open browser for ${url}: ${message}`);
  }
}
