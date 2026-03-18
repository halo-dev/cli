import { expect, test } from "vitest";

import type { HaloProfile } from "../../types.js";
import { buildAuthHeader, normalizeBaseUrl } from "../runtime.js";

test("buildAuthHeader returns Basic authorization header", () => {
  const profile: HaloProfile = {
    name: "basic",
    baseUrl: "https://demo.halo.run",
    auth: {
      type: "basic",
      username: "admin",
      password: "secret",
    },
    createdAt: "2026-03-18T00:00:00.000Z",
    updatedAt: "2026-03-18T00:00:00.000Z",
  };

  expect(buildAuthHeader(profile)).toBe(`Basic ${Buffer.from("admin:secret").toString("base64")}`);
});

test("buildAuthHeader returns Bearer authorization header", () => {
  const profile: HaloProfile = {
    name: "bearer",
    baseUrl: "https://demo.halo.run",
    auth: {
      type: "bearer",
      token: "personal-access-token",
    },
    createdAt: "2026-03-18T00:00:00.000Z",
    updatedAt: "2026-03-18T00:00:00.000Z",
  };

  expect(buildAuthHeader(profile)).toBe("Bearer personal-access-token");
});

test("normalizeBaseUrl trims trailing slashes", () => {
  expect(normalizeBaseUrl("https://demo.halo.run///")).toBe("https://demo.halo.run");
});

test("normalizeBaseUrl rejects URLs without protocol", () => {
  expect(() => normalizeBaseUrl("demo.halo.run")).toThrow(/must start with http/);
});
