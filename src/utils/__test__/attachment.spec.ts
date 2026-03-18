import { expect, test } from "vitest";

import {
  ensureAttachmentPermalink,
  resolveDownloadFilePath,
  resolveUploadFilename,
} from "../attachment.js";

test("resolveUploadFilename derives a name from a file path", () => {
  expect(resolveUploadFilename("/tmp/assets/photo.png")).toBe("photo.png");
});

test("resolveUploadFilename derives a name from a URL", () => {
  expect(
    resolveUploadFilename(undefined, "https://cdn.example.com/files/photo.png?token=123"),
  ).toBe("photo.png");
});

test("resolveUploadFilename returns undefined for invalid URLs", () => {
  expect(resolveUploadFilename(undefined, "not-a-url")).toBeUndefined();
});

test("resolveDownloadFilePath prefers explicit output path", () => {
  expect(
    resolveDownloadFilePath(
      "attachment-1",
      "https://cdn.example.com/file.png",
      "hero",
      "./downloads/output.png",
    ),
  ).toMatch(/downloads\/output\.png$/);
});

test("resolveDownloadFilePath falls back to display name plus permalink extension", () => {
  expect(
    resolveDownloadFilePath("attachment-1", "https://cdn.example.com/file.png", "hero-banner"),
  ).toMatch(/hero-banner\.png$/);
});

test("resolveDownloadFilePath preserves display name extension", () => {
  expect(
    resolveDownloadFilePath("attachment-1", "https://cdn.example.com/file.png", "hero-banner.webp"),
  ).toMatch(/hero-banner\.webp$/);
});

test("ensureAttachmentPermalink rejects empty permalink", () => {
  expect(() => ensureAttachmentPermalink("")).toThrow(
    "This attachment does not have a downloadable permalink.",
  );
});
