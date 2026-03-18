import { expect, test } from "vitest";

import { getBrowserOpenCommand, resolvePostOpenUrl } from "../src/utils/browser.js";

test("resolvePostOpenUrl keeps absolute permalinks", () => {
  expect(resolvePostOpenUrl("https://example.com", "https://blog.example.com/posts/hello")).toBe(
    "https://blog.example.com/posts/hello",
  );
});

test("resolvePostOpenUrl joins root-relative permalinks with site origin", () => {
  expect(resolvePostOpenUrl("https://example.com/console", "/archives/hello-world")).toBe(
    "https://example.com/archives/hello-world",
  );
});

test("resolvePostOpenUrl joins relative permalinks with base URL", () => {
  expect(resolvePostOpenUrl("https://example.com", "archives/hello-world")).toBe(
    "https://example.com/archives/hello-world",
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
