import { expect, test } from "vitest";

import { buildBackupCreatePayload, resolveWaitTimeoutMs } from "../backup.js";

test("resolveWaitTimeoutMs uses the default timeout when omitted", () => {
  expect(resolveWaitTimeoutMs(undefined)).toBe(300_000);
});

test("resolveWaitTimeoutMs converts seconds to milliseconds", () => {
  expect(resolveWaitTimeoutMs("15")).toBe(15_000);
});

test("resolveWaitTimeoutMs rejects non-positive values", () => {
  expect(() => resolveWaitTimeoutMs("0")).toThrow(/must be a positive number of seconds/i);
});

test("buildBackupCreatePayload uses explicit name and trimmed options", () => {
  expect(
    buildBackupCreatePayload(" demo-backup ", {
      format: " tar ",
      expiresAt: " 2026-03-18T10:00:00.000Z ",
    }),
  ).toEqual({
    apiVersion: "migration.halo.run/v1alpha1",
    kind: "Backup",
    metadata: {
      name: "demo-backup",
      generateName: undefined,
    },
    spec: {
      format: "tar",
      expiresAt: "2026-03-18T10:00:00.000Z",
    },
  });
});

test("buildBackupCreatePayload falls back to generated names and zip format", () => {
  expect(buildBackupCreatePayload(undefined, {})).toEqual({
    apiVersion: "migration.halo.run/v1alpha1",
    kind: "Backup",
    metadata: {
      name: "",
      generateName: "backup-",
    },
    spec: {
      format: "zip",
      expiresAt: undefined,
    },
  });
});
