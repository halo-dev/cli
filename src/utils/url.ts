import { CliError } from "./errors.js";

export function normalizeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(normalized)) {
    throw new CliError("Halo base URL must start with http:// or https://.");
  }
  return normalized;
}
