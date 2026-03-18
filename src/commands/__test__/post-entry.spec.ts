import { afterEach, expect, test, vi } from "vitest";

import * as browserUtils from "../../utils/browser.js";
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

test("tryRunPostCommand dispatches get subcommands", async () => {
  silenceStdout();

  const getPost = vi.fn().mockResolvedValue({
    data: { metadata: { name: "post-1" } },
  });
  const fetchPostHeadContent = vi.fn().mockResolvedValue({
    data: { raw: "# Halo" },
  });
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients: {
        core: {
          content: {
            post: {
              getPost,
            },
          },
        },
        console: {
          content: {
            post: {
              fetchPostHeadContent,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunPostCommand(["post", "get", "post-1", "--json"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(getPost).toHaveBeenCalledWith({ name: "post-1" });
  expect(fetchPostHeadContent).toHaveBeenCalledWith({ name: "post-1" });
});

test("tryRunPostCommand dispatches open subcommands in json mode", async () => {
  silenceStdout();
  const openUrlInBrowser = vi.spyOn(browserUtils, "openUrlInBrowser").mockResolvedValue();
  const getPost = vi.fn().mockResolvedValue({
    data: {
      status: {
        permalink: "/archives/hello-world",
      },
    },
  });
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      profile: {
        baseUrl: "https://example.com/console",
      },
      clients: {
        core: {
          content: {
            post: {
              getPost,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunPostCommand(["post", "open", "post-1", "--json"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(getPost).toHaveBeenCalledWith({ name: "post-1" });
  expect(openUrlInBrowser).not.toHaveBeenCalled();
});

test("tryRunPostCommand rejects opening unpublished posts", async () => {
  silenceStdout();

  const getPost = vi.fn().mockResolvedValue({
    data: {
      status: {},
    },
  });
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      profile: {
        baseUrl: "https://example.com",
      },
      clients: {
        core: {
          content: {
            post: {
              getPost,
            },
          },
        },
      },
    }),
  };

  await expect(tryRunPostCommand(["post", "open", "post-1"], runtimeMock as never)).rejects.toThrow(
    /does not have a permalink yet/i,
  );
});

test("tryRunPostCommand dispatches delete subcommands in json mode", async () => {
  silenceStdout();

  const deletePost = vi.fn().mockResolvedValue(undefined);
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients: {
        core: {
          content: {
            post: {
              deletePost,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunPostCommand(["post", "delete", "post-1", "--json"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(deletePost).toHaveBeenCalledWith({ name: "post-1" });
});
