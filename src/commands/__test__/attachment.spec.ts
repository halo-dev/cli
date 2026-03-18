import { expect, test } from "vitest";

import { resolveAttachmentUploadSource } from "../attachment.js";

test("resolveAttachmentUploadSource accepts local files", () => {
  expect(resolveAttachmentUploadSource({ file: " ./assets/photo.png " })).toEqual({
    file: "./assets/photo.png",
    url: undefined,
    sourceLabel: "photo.png",
  });
});

test("resolveAttachmentUploadSource accepts remote urls", () => {
  expect(resolveAttachmentUploadSource({ url: " https://example.com/photo.png " })).toEqual({
    file: undefined,
    url: "https://example.com/photo.png",
    sourceLabel: "https://example.com/photo.png",
  });
});

test("resolveAttachmentUploadSource requires exactly one source", () => {
  expect(() => resolveAttachmentUploadSource({})).toThrow(/Provide exactly one upload source/i);
  expect(() =>
    resolveAttachmentUploadSource({
      file: "./assets/photo.png",
      url: "https://example.com/photo.png",
    }),
  ).toThrow(/Provide exactly one upload source/i);
});
