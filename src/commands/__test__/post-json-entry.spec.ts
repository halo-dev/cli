import { afterEach, expect, test, vi } from "vitest";

const ucPostApiState = vi.hoisted(() => ({
  implementation: {} as Record<string, unknown>,
}));

vi.mock("@halo-dev/api-client", async () => {
  const actual =
    await vi.importActual<typeof import("@halo-dev/api-client")>("@halo-dev/api-client");

  return {
    ...actual,
    PostV1alpha1UcApi: vi.fn(function MockPostV1alpha1UcApi() {
      return ucPostApiState.implementation;
    }),
  };
});

import { tryRunPostCommand } from "../post.js";

afterEach(() => {
  ucPostApiState.implementation = {};
  vi.restoreAllMocks();
});

function silenceStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

test("tryRunPostCommand imports json as a new post when it does not exist", async () => {
  silenceStdout();

  const getMyPost = vi.fn().mockRejectedValue({
    isAxiosError: true,
    response: { status: 404 },
  });
  const createMyPost = vi.fn().mockResolvedValue({
    data: { metadata: { name: "post-1" } },
  });
  const publishMyPost = vi.fn().mockResolvedValue(undefined);
  ucPostApiState.implementation = {
    getMyPost,
    getMyPostDraft: vi.fn(),
    updateMyPost: vi.fn(),
    updateMyPostDraft: vi.fn(),
    createMyPost,
    publishMyPost,
    unpublishMyPost: vi.fn(),
  };

  const getPost = vi.fn().mockResolvedValue({
    data: { metadata: { name: "post-1" } },
  });
  const fetchPostHeadContent = vi.fn().mockResolvedValue({
    data: { raw: "# Halo", content: "<h1>Halo</h1>", rawType: "markdown" },
  });
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      profile: { baseUrl: "https://example.com" },
      clients: {
        axios: {},
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
    tryRunPostCommand(
      [
        "post",
        "import-json",
        "--raw",
        '{"post":{"metadata":{"name":"post-1"},"spec":{"publish":true}},"content":{"raw":"# Halo","content":"<h1>Halo</h1>","rawType":"markdown"}}',
        "--json",
      ],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(createMyPost).toHaveBeenCalledOnce();
  expect(publishMyPost).toHaveBeenCalledWith({ name: "post-1" });
});

test("tryRunPostCommand imports json by updating an existing post", async () => {
  silenceStdout();

  const getMyPost = vi
    .fn()
    .mockResolvedValueOnce({
      data: {
        metadata: { name: "post-1" },
        spec: { publish: false },
      },
    })
    .mockResolvedValueOnce({
      data: {
        metadata: { name: "post-1" },
      },
    });
  const getMyPostDraft = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "post-1", annotations: {} },
      spec: { rawType: "markdown" },
    },
  });
  const updateMyPost = vi.fn().mockResolvedValue({
    data: { metadata: { name: "post-1" } },
  });
  const updateMyPostDraft = vi.fn().mockResolvedValue(undefined);
  const publishMyPost = vi.fn().mockResolvedValue(undefined);

  ucPostApiState.implementation = {
    getMyPost,
    getMyPostDraft,
    updateMyPost,
    updateMyPostDraft,
    createMyPost: vi.fn(),
    publishMyPost,
    unpublishMyPost: vi.fn(),
  };

  const getPost = vi.fn().mockResolvedValue({
    data: { metadata: { name: "post-1" } },
  });
  const fetchPostHeadContent = vi.fn().mockResolvedValue({
    data: { raw: "# Halo", content: "<h1>Halo</h1>", rawType: "markdown" },
  });
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      profile: { baseUrl: "https://example.com" },
      clients: {
        axios: {},
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
    tryRunPostCommand(
      [
        "post",
        "import-json",
        "--raw",
        '{"post":{"metadata":{"name":"post-1"},"spec":{"publish":true}},"content":{"raw":"# Halo","content":"<h1>Halo</h1>","rawType":"markdown"}}',
        "--json",
        "--force",
      ],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(updateMyPost).toHaveBeenCalledOnce();
  expect(updateMyPostDraft).toHaveBeenCalledOnce();
  expect(publishMyPost).toHaveBeenCalledWith({ name: "post-1" });
});

test("tryRunPostCommand rejects invalid inline json", async () => {
  const runtimeMock = {
    getClientsForOptions: vi.fn(),
  };

  await expect(
    tryRunPostCommand(["post", "import-json", "--raw", "{invalid-json"], runtimeMock as never),
  ).rejects.toThrow(/invalid post json payload/i);

  expect(runtimeMock.getClientsForOptions).not.toHaveBeenCalled();
});

test("tryRunPostCommand rejects missing import files", async () => {
  const runtimeMock = {
    getClientsForOptions: vi.fn(),
  };

  await expect(
    tryRunPostCommand(
      ["post", "import-json", "--file", "/tmp/halo-cli-post-import-missing.json"],
      runtimeMock as never,
    ),
  ).rejects.toThrow(/no such file|enoent/i);

  expect(runtimeMock.getClientsForOptions).not.toHaveBeenCalled();
});
