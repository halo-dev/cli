import { expect, test } from "vitest";

import { resolveAuthProfileUseName, validateResolvedLoginInput } from "../auth.js";

test("resolveAuthProfileUseName prefers positional names", () => {
  expect(resolveAuthProfileUseName("local", "fallback")).toBe("local");
  expect(resolveAuthProfileUseName(undefined, "fallback")).toBe("fallback");
});

test("resolveAuthProfileUseName rejects missing names", () => {
  expect(() => resolveAuthProfileUseName(undefined, undefined)).toThrow(/requires a profile name/i);
});

test("validateResolvedLoginInput accepts basic auth inputs", () => {
  expect(
    validateResolvedLoginInput(
      {
        username: "admin",
        password: "secret",
      },
      "local",
      "https://example.com",
      "basic",
    ),
  ).toMatchObject({
    profile: "local",
    url: "https://example.com",
    authType: "basic",
    username: "admin",
    password: "secret",
  });
});

test("validateResolvedLoginInput accepts bearer auth inputs", () => {
  expect(
    validateResolvedLoginInput(
      {
        token: "pat",
      },
      "local",
      "https://example.com",
      "bearer",
    ),
  ).toMatchObject({
    profile: "local",
    url: "https://example.com",
    authType: "bearer",
    token: "pat",
  });
});

test("validateResolvedLoginInput rejects missing required login fields", () => {
  expect(() => validateResolvedLoginInput({}, undefined, "https://example.com", "bearer")).toThrow(
    /requires --profile, --url, and --auth-type/i,
  );
  expect(() => validateResolvedLoginInput({}, "local", "https://example.com", "basic")).toThrow(
    /Basic Auth requires --username and --password/i,
  );
  expect(() => validateResolvedLoginInput({}, "local", "https://example.com", "bearer")).toThrow(
    /Bearer Auth requires --token/i,
  );
});
