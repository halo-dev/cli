import { resolve as resolvePath } from "node:path";

import { CliError } from "./errors.js";

export function ensureBackupFilename(filename?: string): string {
  const normalized = filename?.trim();
  if (!normalized) {
    throw new CliError("This backup does not have a downloadable backup file yet.");
  }

  return normalized;
}

export function resolveBackupDownloadFilePath(filename: string, outputPath?: string): string {
  if (outputPath?.trim()) {
    return resolvePath(outputPath.trim());
  }

  return resolvePath(filename.trim());
}
