import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { computeCompletions, tryRunCompletionCommand } from "../index.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  process.exitCode = 0;
});

function silenceStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

// ─── computeCompletions ────────────────────────────────────────────────────────

describe("computeCompletions (fish/word-array mode)", () => {
  test("returns top-level commands when no args after binary", () => {
    const result = computeCompletions(["halo"]);
    expect(result).toContain("auth");
    expect(result).toContain("post");
    expect(result).toContain("completion");
  });

  test("returns top-level commands when current word is empty", () => {
    const result = computeCompletions(["halo", ""]);
    expect(result).toContain("auth");
    expect(result).toContain("post");
  });

  test("filters top-level commands by partial current word", () => {
    const result = computeCompletions(["halo", "po"]);
    expect(result).toEqual(["post"]);
  });

  test("filters top-level commands by single-page prefix", () => {
    const result = computeCompletions(["halo", "sin"]);
    expect(result).toEqual(["single-page"]);
  });

  test("returns subcommands for a complete first-level command", () => {
    const result = computeCompletions(["halo", "post", ""]);
    expect(result).toContain("list");
    expect(result).toContain("create");
    expect(result).toContain("import-json");
  });

  test("filters subcommands by partial word", () => {
    const result = computeCompletions(["halo", "post", "li"]);
    expect(result).toEqual(["list"]);
  });

  test("returns auth subcommands", () => {
    const result = computeCompletions(["halo", "auth", ""]);
    expect(result).toContain("login");
    expect(result).toContain("current");
    expect(result).toContain("profile");
  });

  test("returns auth profile nested subcommands", () => {
    const result = computeCompletions(["halo", "auth", "profile", ""]);
    expect(result).toContain("list");
    expect(result).toContain("get");
    expect(result).toContain("doctor");
  });

  test("filters auth profile subcommands by partial word", () => {
    const result = computeCompletions(["halo", "auth", "profile", "d"]);
    expect(result).toContain("delete");
    expect(result).toContain("doctor");
    expect(result).not.toContain("list");
  });

  test("returns comment reply nested subcommands", () => {
    const result = computeCompletions(["halo", "comment", "reply", ""]);
    expect(result).toContain("list");
    expect(result).toContain("approve");
    expect(result).toContain("delete");
  });

  test("returns empty array for unknown command", () => {
    const result = computeCompletions(["halo", "unknown", ""]);
    expect(result).toEqual([]);
  });

  test("returns empty array when context contains option flags", () => {
    const result = computeCompletions(["halo", "--profile", "post", ""]);
    expect(result).toEqual([]);
  });

  test("returns empty array for deeper-than-supported nesting", () => {
    const result = computeCompletions(["halo", "auth", "profile", "list", ""]);
    expect(result).toEqual([]);
  });
});

describe("computeCompletions (bash/zsh COMP_LINE mode)", () => {
  beforeEach(() => {
    vi.stubEnv("COMP_LINE", "");
    vi.stubEnv("COMP_POINT", "");
  });

  test("returns top-level commands when line is 'halo '", () => {
    vi.stubEnv("COMP_LINE", "halo ");
    vi.stubEnv("COMP_POINT", "5");
    const result = computeCompletions([]);
    expect(result).toContain("auth");
    expect(result).toContain("post");
  });

  test("filters top-level by partial word using COMP_LINE", () => {
    vi.stubEnv("COMP_LINE", "halo po");
    vi.stubEnv("COMP_POINT", "7");
    const result = computeCompletions([]);
    expect(result).toEqual(["post"]);
  });

  test("returns post subcommands for 'halo post '", () => {
    vi.stubEnv("COMP_LINE", "halo post ");
    vi.stubEnv("COMP_POINT", "10");
    const result = computeCompletions([]);
    expect(result).toContain("list");
    expect(result).toContain("create");
  });

  test("returns auth profile subcommands for 'halo auth profile '", () => {
    vi.stubEnv("COMP_LINE", "halo auth profile ");
    vi.stubEnv("COMP_POINT", "18");
    const result = computeCompletions([]);
    expect(result).toContain("list");
    expect(result).toContain("doctor");
  });

  test("handles invalid COMP_POINT gracefully", () => {
    vi.stubEnv("COMP_LINE", "halo post ");
    vi.stubEnv("COMP_POINT", "not-a-number");
    const result = computeCompletions([]);
    expect(result).toContain("list");
  });
});

// ─── tryRunCompletionCommand ───────────────────────────────────────────────────

describe("tryRunCompletionCommand routing", () => {
  test("returns false for unrelated commands", async () => {
    await expect(tryRunCompletionCommand(["post"], {} as never)).resolves.toBe(false);
  });

  test("shows help for bare completion command", async () => {
    silenceStdout();
    await expect(tryRunCompletionCommand(["completion"], {} as never)).resolves.toBe(true);
  });

  test("outputs bash script for completion bash", async () => {
    const writeSpy = silenceStdout();
    await expect(tryRunCompletionCommand(["completion", "bash"], {} as never)).resolves.toBe(true);
    const output = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("###-begin-halo-completion-###");
    expect(output).toContain("complete -o default -F _halo_completion halo");
  });

  test("outputs zsh script for completion zsh", async () => {
    const writeSpy = silenceStdout();
    await expect(tryRunCompletionCommand(["completion", "zsh"], {} as never)).resolves.toBe(true);
    const output = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("compdef _halo_completion halo");
  });

  test("outputs fish script for completion fish", async () => {
    const writeSpy = silenceStdout();
    await expect(tryRunCompletionCommand(["completion", "fish"], {} as never)).resolves.toBe(true);
    const output = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("complete -c halo -f");
  });

  test("handles inline completion callback with --", async () => {
    const writeSpy = silenceStdout();
    await expect(
      tryRunCompletionCommand(["completion", "--", "halo", "post", ""], {} as never),
    ).resolves.toBe(true);
    const output = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("list");
    expect(output).toContain("create");
  });

  test("inline completion with -- returns nothing for unknown command", async () => {
    const writeSpy = silenceStdout();
    await expect(
      tryRunCompletionCommand(["completion", "--", "halo", "unknown", ""], {} as never),
    ).resolves.toBe(true);
    expect(writeSpy).not.toHaveBeenCalled();
  });
});
