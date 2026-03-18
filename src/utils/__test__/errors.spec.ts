import { AxiosError } from "axios";
import { expect, test } from "vitest";

import { CliError, formatError, toCliError } from "../errors.js";

function createAxiosError(status?: number, data?: unknown, message = "Request failed"): AxiosError {
  return new AxiosError(message, undefined, undefined, undefined, {
    status,
    data,
    statusText: status ? String(status) : "",
    headers: {},
    config: {
      headers: {},
    },
  } as never);
}

test("formatError returns CliError messages directly", () => {
  expect(formatError(new CliError("boom"))).toBe("boom");
});

test("formatError prefers API-provided messages for axios errors", () => {
  const error = createAxiosError(500, { detail: "Something broke upstream." });
  expect(formatError(error)).toBe("Something broke upstream.");
});

test("formatError uses auth fallback for unauthorized axios errors", () => {
  const error = createAxiosError(401);
  expect(formatError(error)).toBe("Authentication failed. Check the selected profile credentials.");
});

test("toCliError preserves CliError instances", () => {
  const error = new CliError("already normalized");
  expect(toCliError(error)).toBe(error);
});

test("toCliError normalizes unauthorized axios errors", () => {
  const cliError = toCliError(createAxiosError(401, { message: "ignored" }));
  expect(cliError).toBeInstanceOf(CliError);
  expect(cliError.message).toBe("Authentication failed. Check the selected profile credentials.");
  expect(cliError.exitCode).toBe(1);
});

test("toCliError wraps unknown values", () => {
  const cliError = toCliError({ foo: "bar" });
  expect(cliError.message).toBe("Unknown CLI error.");
  expect(cliError.exitCode).toBe(1);
});
