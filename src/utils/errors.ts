import axios, { AxiosError } from "axios";

export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

function pickApiErrorMessage(data: unknown): string | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const maybeData = data as Record<string, unknown>;
  const fields = ["message", "error", "title", "detail"];

  for (const field of fields) {
    const value = maybeData[field];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

export function formatError(error: unknown): string {
  if (error instanceof CliError) {
    return error.message;
  }

  if (axios.isAxiosError(error)) {
    const responseMessage = pickApiErrorMessage(error.response?.data);
    const status = error.response?.status;

    if (status === 401) {
      return responseMessage ?? "Authentication failed. Check the selected profile credentials.";
    }

    if (status === 404) {
      return responseMessage ?? "Halo resource not found.";
    }

    if (status) {
      return responseMessage ?? `Halo API request failed with status ${status}.`;
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown CLI error.";
}

export function toCliError(error: unknown): CliError {
  if (error instanceof CliError) {
    return error;
  }

  if (error instanceof AxiosError && error.response?.status === 401) {
    return new CliError("Authentication failed. Check the selected profile credentials.", 1);
  }

  return new CliError(formatError(error), 1);
}