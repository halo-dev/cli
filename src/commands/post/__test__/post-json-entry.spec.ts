import { afterEach, expect, test, vi } from "vite-plus/test";

import { renderContentByRawType } from "../../../utils/content.js";
import { tryRunPostCommand } from "../index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function silenceStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

test("tryRunPostCommand imports json as a new post when it does not exist", async () => {
  silenceStdout();

  const draftPost = vi.fn().mockResolvedValue({
    data: { metadata: { name: "post-1" } },
  });
  const publishPost = vi.fn().mockResolvedValue(undefined);

  const getPost = vi
    .fn()
    .mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 404 },
    })
    .mockResolvedValueOnce({
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
              draftPost,
              publishPost,
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

  expect(draftPost).toHaveBeenCalledOnce();
  expect(draftPost).toHaveBeenCalledWith({
    postRequest: expect.objectContaining({
      post: expect.objectContaining({
        metadata: expect.objectContaining({
          name: "post-1",
        }),
        spec: { publish: false },
      }),
      content: expect.objectContaining({
        raw: "# Halo",
        content: renderContentByRawType("# Halo", "markdown"),
        rawType: "markdown",
      }),
    }),
  });
  expect(publishPost).toHaveBeenCalledWith({ name: "post-1" });
});

test("tryRunPostCommand imports json by updating an existing post", async () => {
  silenceStdout();

  const getPost = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "post-1" },
      spec: { publish: false },
    },
  });
  const fetchPostHeadContent = vi.fn().mockResolvedValue({
    data: { raw: "# Halo", content: "<h1>Halo</h1>", rawType: "markdown" },
  });
  const updateDraftPost = vi.fn().mockResolvedValue({
    data: { metadata: { name: "post-1" } },
  });
  const publishPost = vi.fn().mockResolvedValue(undefined);

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
              updateDraftPost,
              publishPost,
              unpublishPost: vi.fn(),
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

  expect(updateDraftPost).toHaveBeenCalledOnce();
  expect(updateDraftPost).toHaveBeenCalledWith({
    name: "post-1",
    postRequest: expect.objectContaining({
      post: expect.objectContaining({
        metadata: expect.objectContaining({
          name: "post-1",
        }),
        spec: expect.objectContaining({ publish: false }),
      }),
      content: expect.objectContaining({
        raw: "# Halo",
        content: renderContentByRawType("# Halo", "markdown"),
        rawType: "markdown",
      }),
    }),
  });
  expect(publishPost).toHaveBeenCalledWith({ name: "post-1" });
});

test("tryRunPostCommand prints import summary with permalink and inspect command", async () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  const getPost = vi
    .fn()
    .mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 404 },
    })
    .mockResolvedValueOnce({
      data: {
        metadata: { name: "post-1" },
        status: { permalink: "/archives/post-1" },
      },
    });
  const draftPost = vi.fn().mockResolvedValue({
    data: { metadata: { name: "post-1" } },
  });
  const publishPost = vi.fn().mockResolvedValue(undefined);
  const fetchPostHeadContent = vi.fn().mockResolvedValue({
    data: { raw: "# Halo", content: "<h1>Halo</h1>", rawType: "markdown" },
  });

  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      profile: { baseUrl: "https://example.com/console" },
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
              draftPost,
              publishPost,
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
      ],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  const output = stdoutSpy.mock.calls.map((call) => String(call[0])).join("");
  expect(output).toContain("Post imported successfully from inline JSON.");
  expect(output).toContain("\n\nmetadata.name: post-1");
  expect(output).toContain("metadata.name: post-1");
  expect(output).toContain("permalink: https://example.com/archives/post-1");
  expect(output).toContain("inspect: halo post get post-1");
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
