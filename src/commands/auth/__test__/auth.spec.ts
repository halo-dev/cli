import { expect, test } from "vitest";

import {
  createProfileTimestamp,
  resolveAuthProfileName,
  resolveAuthProfileUseName,
  validateResolvedLoginInput,
} from "../index.js";

test("resolveAuthProfileUseName prefers positional names", () => {
  expect(resolveAuthProfileUseName("local", "fallback")).toBe("local");
  expect(resolveAuthProfileUseName(undefined, "fallback")).toBe("fallback");
});

test("resolveAuthProfileUseName rejects missing names", () => {
  expect(() => resolveAuthProfileUseName(undefined, undefined)).toThrow(/requires a profile name/i);
});

test("resolveAuthProfileName uses the provided command path in errors", () => {
  expect(() => resolveAuthProfileName(undefined, undefined, "halo auth profile delete")).toThrow(
    /halo auth profile delete/i,
  );
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

test("createProfileTimestamp preserves createdAt and refreshes updatedAt", () => {
  const existing = {
    name: "prod",
    baseUrl: "https://demo.halo.run",
    auth: {
      type: "bearer" as const,
    },
    createdAt: "2026-03-18T00:00:00.000Z",
    updatedAt: "2026-03-18T00:00:00.000Z",
  };

  const timestamp = createProfileTimestamp(existing);

  expect(timestamp.createdAt).toBe(existing.createdAt);
  expect(Date.parse(timestamp.updatedAt)).not.toBeNaN();
});
