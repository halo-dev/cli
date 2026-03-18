import { basename, extname, resolve as resolvePath } from "node:path";

import { CliError } from "./errors.js";

export function resolveUploadFilename(filePath?: string, sourceUrl?: string): string | undefined {
  if (filePath?.trim()) {
    return basename(filePath.trim());
  }

  if (!sourceUrl?.trim()) {
    return undefined;
  }

  try {
    const parsed = new URL(sourceUrl);
    const name = basename(parsed.pathname);
    return name && name !== "/" ? name : undefined;
  } catch {
    return undefined;
  }
}

export function resolveDownloadFilePath(
  attachmentName: string,
  permalink: string,
  displayName?: string,
  outputPath?: string,
): string {
  if (outputPath?.trim()) {
    return resolvePath(outputPath.trim());
  }

  const preferredName = displayName?.trim() || attachmentName.trim();
  const extension = (() => {
    try {
      const parsed = new URL(permalink);
      return extname(parsed.pathname);
    } catch {
      return "";
    }
  })();

  if (extname(preferredName)) {
    return resolvePath(preferredName);
  }

  return resolvePath(`${preferredName}${extension}`);
}

export function ensureAttachmentPermalink(permalink?: string): string {
  const normalized = permalink?.trim();
  if (!normalized) {
    throw new CliError("This attachment does not have a downloadable permalink.");
  }

  return normalized;
}
