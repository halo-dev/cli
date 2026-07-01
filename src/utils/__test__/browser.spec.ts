import { expect, test } from "vite-plus/test";

import { getBrowserOpenCommand, resolvePermalinkUrl } from "../browser.js";

test("resolvePermalinkUrl keeps absolute permalinks", () => {
  expect(
    resolvePermalinkUrl("https://example.com", "https://blog.example.com/posts/hello", "Post"),
  ).toBe("https://blog.example.com/posts/hello");
});

test("resolvePermalinkUrl joins root-relative permalinks with site origin", () => {
  expect(resolvePermalinkUrl("https://example.com/console", "/archives/hello-world", "Post")).toBe(
    "https://example.com/archives/hello-world",
  );
});

test("resolvePermalinkUrl joins relative permalinks with base URL", () => {
  expect(resolvePermalinkUrl("https://example.com", "archives/hello-world", "Post")).toBe(
    "https://example.com/archives/hello-world",
  );
});

test("resolvePermalinkUrl rejects empty permalinks with resource context", () => {
  expect(() => resolvePermalinkUrl("https://example.com", "  ", "Single page")).toThrow(
    /single page permalink is empty/i,
  );
});

test("getBrowserOpenCommand returns macOS open command", () => {
  expect(getBrowserOpenCommand("https://example.com", "darwin")).toEqual({
    command: "open",
    args: ["https://example.com"],
  });
});

test("getBrowserOpenCommand returns Windows start command", () => {
  expect(getBrowserOpenCommand("https://example.com", "win32")).toEqual({
    command: "cmd",
    args: ["/c", "start", "", "https://example.com"],
  });
});

test("getBrowserOpenCommand returns xdg-open on Linux", () => {
  expect(getBrowserOpenCommand("https://example.com", "linux")).toEqual({
    command: "xdg-open",
    args: ["https://example.com"],
  });
});
