import { afterEach, expect, test, vi } from "vitest";

import { tryRunPostCommand } from "../post.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function silenceStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

test("tryRunPostCommand returns false for unrelated commands", async () => {
  await expect(tryRunPostCommand(["plugin"], {} as never)).resolves.toBe(false);
});

test("tryRunPostCommand shows help for bare post commands", async () => {
  silenceStdout();

  await expect(tryRunPostCommand(["post"], {} as never)).resolves.toBe(true);
});

test("tryRunPostCommand dispatches list subcommands", async () => {
  silenceStdout();

  const listPosts = vi.fn().mockResolvedValue({
    data: {
      items: [],
      total: 0,
    },
  });
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients: {
        console: {
          content: {
            post: {
              listPosts,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunPostCommand(
      ["post", "list", "--page", "2", "--size", "10", "--keyword", "halo", "--json"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(runtimeMock.getClientsForOptions).toHaveBeenCalledOnce();
  expect(listPosts).toHaveBeenCalledWith({
    page: 2,
    size: 10,
    keyword: "halo",
    publishPhase: undefined,
    categoryWithChildren: undefined,
  });
});
