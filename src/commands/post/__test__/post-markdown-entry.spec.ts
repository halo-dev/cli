import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, test, vi } from "vitest";

const ucPostApiState = vi.hoisted(() => ({
  implementation: {} as Record<string, unknown>,
}));
const promptState = vi.hoisted(() => ({
  checkbox: vi.fn(),
  input: vi.fn(),
  confirm: vi.fn(),
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

vi.mock("@inquirer/prompts", () => ({
  checkbox: promptState.checkbox,
  input: promptState.input,
  confirm: promptState.confirm,
}));

import { tryRunPostCommand } from "../index.js";
import { CONTENT_JSON_ANNOTATION } from "../input.js";

afterEach(() => {
  ucPostApiState.implementation = {};
  promptState.checkbox.mockReset();
  promptState.input.mockReset();
  promptState.confirm.mockReset();
  vi.restoreAllMocks();
});

function silenceStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

test("tryRunPostCommand imports markdown as a new post and writes back front matter", async () => {
  silenceStdout();

  const tempDir = await mkdtemp(join(tmpdir(), "halo-post-import-markdown-create-"));
  const filePath = join(tempDir, "hello-halo.md");

  try {
    await writeFile(
      filePath,
      `---
title: Hello Halo
halo:
  publish: true
---
# Hello Halo
`,
      "utf8",
    );

    const createMyPost = vi.fn().mockResolvedValue({
      data: { metadata: { name: "post-1" } },
    });
    const publishMyPost = vi.fn().mockResolvedValue(undefined);

    ucPostApiState.implementation = {
      createMyPost,
      publishMyPost,
      unpublishMyPost: vi.fn(),
    };

    const getPost = vi.fn().mockResolvedValue({
      data: {
        metadata: { name: "post-1" },
        spec: {
          title: "Hello Halo",
          slug: "hello-halo",
          excerpt: { autoGenerate: true },
          cover: "",
          categories: [],
          tags: [],
          publish: true,
        },
      },
    });
    const fetchPostHeadContent = vi.fn().mockResolvedValue({
      data: {
        raw: "# Hello Halo",
        content: "<h1>Hello Halo</h1>\n",
        rawType: "markdown",
      },
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
        ["post", "import-markdown", "--file", filePath, "--json"],
        runtimeMock as never,
      ),
    ).resolves.toBe(true);

    expect(createMyPost).toHaveBeenCalledOnce();
    expect(publishMyPost).toHaveBeenCalledWith({ name: "post-1" });
    expect(promptState.checkbox).not.toHaveBeenCalled();
    expect(
      createMyPost.mock.calls[0]?.[0]?.post?.metadata?.annotations?.[CONTENT_JSON_ANNOTATION],
    ).toContain("<h1>Hello Halo</h1>");

    const fileContent = await readFile(filePath, "utf8");
    expect(fileContent).toContain("title: Hello Halo");
    expect(fileContent).toContain("slug: hello-halo");
    expect(fileContent).toContain("name: post-1");
    expect(fileContent).toContain("publish: true");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("tryRunPostCommand updates tracked markdown posts and preserves round-trip metadata", async () => {
  silenceStdout();

  const tempDir = await mkdtemp(join(tmpdir(), "halo-post-import-markdown-update-"));
  const filePath = join(tempDir, "hello-halo.md");

  try {
    await writeFile(
      filePath,
      `---
title: Hello Halo
halo:
  site: https://example.com
  name: post-1
  publish: true
---
# Updated Body
`,
      "utf8",
    );

    const getMyPost = vi.fn().mockResolvedValue({
      data: {
        metadata: { name: "post-1" },
        spec: {
          title: "Hello Halo",
          slug: "hello-halo",
          categories: [],
          tags: [],
          cover: "",
          excerpt: { autoGenerate: true },
          publish: false,
          pinned: false,
          allowComment: true,
          deleted: false,
          priority: 0,
          visible: "PUBLIC",
        },
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
      data: {
        metadata: { name: "post-1" },
        spec: {
          title: "Hello Halo",
          slug: "hello-halo",
          excerpt: { autoGenerate: true },
          cover: "",
          categories: [],
          tags: [],
          publish: true,
        },
      },
    });
    const fetchPostHeadContent = vi.fn().mockResolvedValue({
      data: {
        raw: "# Updated Body",
        content: "<h1>Updated Body</h1>\n",
        rawType: "markdown",
      },
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
        ["post", "import-markdown", "--file", filePath, "--force", "--json"],
        runtimeMock as never,
      ),
    ).resolves.toBe(true);

    expect(updateMyPost).toHaveBeenCalledOnce();
    expect(updateMyPostDraft).toHaveBeenCalledOnce();
    expect(publishMyPost).toHaveBeenCalledWith({ name: "post-1" });
    expect(promptState.checkbox).not.toHaveBeenCalled();

    const fileContent = await readFile(filePath, "utf8");
    expect(fileContent).toContain("site: https://example.com");
    expect(fileContent).toContain("name: post-1");
    expect(fileContent).toContain("publish: true");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
