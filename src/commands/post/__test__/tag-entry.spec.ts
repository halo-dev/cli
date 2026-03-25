import { describe, expect, it, vi } from "vitest";

import { tryRunPostCommand } from "../index.js";

// Mock the tag module
vi.mock("../tag.js", () => ({
  buildTagCli: vi.fn(() => {
    const mockCli = {
      outputHelp: vi.fn(),
      parse: vi.fn(),
      matchedCommand: undefined,
      args: [],
      runMatchedCommand: vi.fn(),
    };
    return mockCli;
  }),
}));

describe("tryRunPostCommand", () => {
  const mockRuntime = {
    getClientsForOptions: vi.fn(),
  } as unknown as Parameters<typeof tryRunPostCommand>[1];

  it("returns false for non-post commands", async () => {
    const result = await tryRunPostCommand(["other"], mockRuntime);
    expect(result).toBe(false);
  });

  it("handles tag subcommand", async () => {
    const result = await tryRunPostCommand(["post", "tag", "list"], mockRuntime);
    expect(result).toBe(true);
  });

  it("handles bare tag subcommand", async () => {
    const result = await tryRunPostCommand(["post", "tag"], mockRuntime);
    expect(result).toBe(true);
  });
});
