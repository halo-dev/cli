import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, test, vi } from "vite-plus/test";

const promptState = vi.hoisted(() => ({
  checkbox: vi.fn(),
  input: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
  checkbox: promptState.checkbox,
  input: promptState.input,
  confirm: promptState.confirm,
}));

import { tryRunPostCommand } from "../index.js";

afterEach(() => {
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

    const draftPost = vi.fn().mockResolvedValue({
      data: { metadata: { name: "post-1" } },
    });
    const publishPost = vi.fn().mockResolvedValue(undefined);

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
        ["post", "import-markdown", "--file", filePath, "--json"],
        runtimeMock as never,
      ),
    ).resolves.toBe(true);

    expect(draftPost).toHaveBeenCalledOnce();
    expect(publishPost).toHaveBeenCalledWith({ name: "post-1" });
    expect(promptState.checkbox).not.toHaveBeenCalled();

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

    const getPost = vi
      .fn()
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
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
        ["post", "import-markdown", "--file", filePath, "--force", "--json"],
        runtimeMock as never,
      ),
    ).resolves.toBe(true);

    expect(updateDraftPost).toHaveBeenCalledOnce();
    expect(publishPost).toHaveBeenCalledWith({ name: "post-1" });
    expect(promptState.checkbox).not.toHaveBeenCalled();

    const fileContent = await readFile(filePath, "utf8");
    expect(fileContent).toContain("site: https://example.com");
    expect(fileContent).toContain("name: post-1");
    expect(fileContent).toContain("publish: true");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("tryRunPostCommand prints markdown import summary when permalink is unavailable", async () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  const tempDir = await mkdtemp(join(tmpdir(), "halo-post-import-markdown-summary-"));
  const filePath = join(tempDir, "hello-halo.md");

  try {
    await writeFile(
      filePath,
      `---
title: Hello Halo
---
# Hello Halo
`,
      "utf8",
    );

    const draftPost = vi.fn().mockResolvedValue({
      data: { metadata: { name: "post-1" } },
    });

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
          publish: false,
        },
        status: {},
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
                draftPost,
                publishPost: vi.fn().mockResolvedValue(undefined),
                unpublishPost: vi.fn().mockResolvedValue(undefined),
                fetchPostHeadContent,
              },
            },
          },
        },
      }),
    };

    await expect(
      tryRunPostCommand(["post", "import-markdown", "--file", filePath], runtimeMock as never),
    ).resolves.toBe(true);

    const output = stdoutSpy.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain(`Markdown post imported successfully from ${filePath}.`);
    expect(output).toContain("\n\nmetadata.name: post-1");
    expect(output).toContain("metadata.name: post-1");
    expect(output).toContain("permalink: (not available until published)");
    expect(output).toContain("inspect: halo post get post-1");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
