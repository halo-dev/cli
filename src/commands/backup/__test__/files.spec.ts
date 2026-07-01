import { expect, test } from "vite-plus/test";

import { ensureBackupFilename, resolveBackupDownloadFilePath } from "../files.js";

test("resolveBackupDownloadFilePath prefers an explicit output path", () => {
  expect(resolveBackupDownloadFilePath("demo.zip", "./downloads/demo.zip")).toMatch(
    /downloads\/demo\.zip$/,
  );
});

test("resolveBackupDownloadFilePath falls back to backup filename", () => {
  expect(resolveBackupDownloadFilePath("demo.zip")).toMatch(/demo\.zip$/);
});

test("ensureBackupFilename trims the filename", () => {
  expect(ensureBackupFilename(" demo.zip ")).toBe("demo.zip");
});

test("ensureBackupFilename rejects empty filename", () => {
  expect(() => ensureBackupFilename("")).toThrow(
    "This backup does not have a downloadable backup file yet.",
  );
});
