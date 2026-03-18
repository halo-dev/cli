import test from "node:test";
import assert from "node:assert/strict";

import { getBrowserOpenCommand, resolvePostOpenUrl } from "../src/utils/browser.js";

test("resolvePostOpenUrl keeps absolute permalinks", () => {
  assert.equal(
    resolvePostOpenUrl("https://example.com", "https://blog.example.com/posts/hello"),
    "https://blog.example.com/posts/hello",
  );
});

test("resolvePostOpenUrl joins root-relative permalinks with site origin", () => {
  assert.equal(
    resolvePostOpenUrl("https://example.com/console", "/archives/hello-world"),
    "https://example.com/archives/hello-world",
  );
});

test("resolvePostOpenUrl joins relative permalinks with base URL", () => {
  assert.equal(
    resolvePostOpenUrl("https://example.com", "archives/hello-world"),
    "https://example.com/archives/hello-world",
  );
});

test("getBrowserOpenCommand returns macOS open command", () => {
  assert.deepEqual(getBrowserOpenCommand("https://example.com", "darwin"), {
    command: "open",
    args: ["https://example.com"],
  });
});

test("getBrowserOpenCommand returns Windows start command", () => {
  assert.deepEqual(getBrowserOpenCommand("https://example.com", "win32"), {
    command: "cmd",
    args: ["/c", "start", "", "https://example.com"],
  });
});