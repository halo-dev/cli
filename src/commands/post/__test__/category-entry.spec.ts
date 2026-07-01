import { describe, expect, it, vi } from "vite-plus/test";

import { tryRunPostCommand } from "../index.js";

// Mock the category module
vi.mock("../category.js", () => ({
  buildCategoryCli: vi.fn(() => {
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

describe("tryRunPostCommand category", () => {
  const mockRuntime = {
    getClientsForOptions: vi.fn(),
  } as unknown as Parameters<typeof tryRunPostCommand>[1];

  it("handles category subcommand", async () => {
    const result = await tryRunPostCommand(["post", "category", "list"], mockRuntime);
    expect(result).toBe(true);
  });

  it("handles bare category subcommand", async () => {
    const result = await tryRunPostCommand(["post", "category"], mockRuntime);
    expect(result).toBe(true);
  });
});
