import { expect, test } from "vite-plus/test";

import {
  getCompletionCandidates,
  renderBashCompletion,
  renderCompletionScript,
  renderZshCompletion,
} from "../completion.js";

test("getCompletionCandidates suggests top-level commands from root", () => {
  expect(getCompletionCandidates([], "")).toContain("post");
  expect(getCompletionCandidates([], "")).toContain("backup");
  expect(getCompletionCandidates([], "")).toContain("completion");
});

test("getCompletionCandidates filters top-level commands by prefix", () => {
  expect(getCompletionCandidates([], "po")).toEqual(["post"]);
});

test("getCompletionCandidates suggests nested auth profile commands", () => {
  expect(getCompletionCandidates(["auth", "profile"], "")).toEqual(
    expect.arrayContaining(["list", "current", "get", "use", "delete", "doctor"]),
  );
});

test("getCompletionCandidates suggests nested comment reply commands", () => {
  expect(getCompletionCandidates(["comment", "reply"], "")).toEqual(
    expect.arrayContaining(["list", "get", "approve", "delete"]),
  );
});

test("getCompletionCandidates includes post markdown import/export commands", () => {
  expect(getCompletionCandidates(["post"], "")).toEqual(
    expect.arrayContaining(["import-markdown", "export-markdown"]),
  );
});

test("getCompletionCandidates suggests flags when current token starts with dash", () => {
  expect(getCompletionCandidates(["post", "get"], "--")).toEqual(
    expect.arrayContaining(["--profile", "--json", "--help"]),
  );
});

test("renderBashCompletion emits a complete function", () => {
  const script = renderBashCompletion();
  expect(script).toContain("complete -F _halo_completion halo");
  expect(script).toContain("HALO_COMP_CUR");
  expect(script).toContain("__complete");
});

test("renderZshCompletion emits a compdef function", () => {
  const script = renderZshCompletion();
  expect(script).toContain("#compdef halo");
  expect(script).toContain("compdef _halo_completion halo");
  expect(script).toContain("__complete");
});

test("renderCompletionScript rejects unsupported shells", () => {
  expect(() => renderCompletionScript("fish")).toThrow(/supported shells: bash, zsh/i);
});
