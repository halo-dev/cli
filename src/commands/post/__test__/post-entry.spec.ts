import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, test, vi } from "vitest";

import * as browserUtils from "../browser.js";
import { tryRunPostCommand } from "../index.js";

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
    labelSelector: ["content.halo.run/deleted=false"],
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

test("tryRunPostCommand prints post detail in table mode", async () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  const getPost = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "post-1" },
      spec: { title: "Hello Halo", publish: true },
      status: {},
    },
  });
  const fetchPostHeadContent = vi.fn().mockResolvedValue({
    data: { raw: "# Hello Halo\nBody", rawType: "markdown" },
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

  await expect(tryRunPostCommand(["post", "get", "post-1"], runtimeMock as never)).resolves.toBe(
    true,
  );

  const output = stdoutSpy.mock.calls.map((call) => String(call[0])).join("");
  expect(output).toContain("metadata.name");
  expect(output).toContain("post-1");
  expect(output).toContain("content.rawType");
  expect(output).toContain("markdown");
  expect(output).not.toContain("# Hello Halo");
  expect(output).toContain('Use "--json" to view the full content payload.');
});

test("tryRunPostCommand dispatches export-json subcommands", async () => {
  silenceStdout();

  const previousCwd = process.cwd();
  const tempDir = await mkdtemp(join(tmpdir(), "halo-post-export-default-"));

  try {
    process.chdir(tempDir);

    const getPost = vi.fn().mockResolvedValue({
      data: { metadata: { name: "post-1" } },
    });
    const fetchPostHeadContent = vi.fn().mockResolvedValue({
      data: { raw: "# Halo", content: "<h1>Halo</h1>", rawType: "markdown" },
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
      tryRunPostCommand(["post", "export-json", "post-1"], runtimeMock as never),
    ).resolves.toBe(true);

    expect(getPost).toHaveBeenCalledWith({ name: "post-1" });
    expect(fetchPostHeadContent).toHaveBeenCalledWith({ name: "post-1" });
    await expect(readFile(join(tempDir, "post-1.json"), "utf8")).resolves.toContain(
      '"name": "post-1"',
    );
  } finally {
    process.chdir(previousCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("tryRunPostCommand exports json to an output file", async () => {
  silenceStdout();

  const tempDir = await mkdtemp(join(tmpdir(), "halo-post-export-"));
  const outputPath = join(tempDir, "post.json");

  try {
    const getPost = vi.fn().mockResolvedValue({
      data: { metadata: { name: "post-1" } },
    });
    const fetchPostHeadContent = vi.fn().mockResolvedValue({
      data: { raw: "# Halo", content: "<h1>Halo</h1>", rawType: "markdown" },
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
      tryRunPostCommand(
        ["post", "export-json", "post-1", "--output", outputPath],
        runtimeMock as never,
      ),
    ).resolves.toBe(true);

    await expect(readFile(outputPath, "utf8")).resolves.toContain('"name": "post-1"');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("tryRunPostCommand dispatches export-markdown subcommands with default output", async () => {
  silenceStdout();

  const previousCwd = process.cwd();
  const tempDir = await mkdtemp(join(tmpdir(), "halo-post-export-markdown-default-"));

  try {
    process.chdir(tempDir);

    const getPost = vi.fn().mockResolvedValue({
      data: {
        metadata: { name: "post-1" },
        spec: {
          title: "Hello Halo",
          slug: "hello-halo",
          excerpt: { autoGenerate: false, raw: "Summary" },
          cover: "https://example.com/cover.png",
          categories: [],
          tags: [],
          publish: true,
        },
      },
    });
    const fetchPostHeadContent = vi.fn().mockResolvedValue({
      data: {
        raw: "<h1>Hello Halo</h1>\n<p>HTML body</p>",
        content: "<h1>Hello Halo</h1>\n<p>HTML body</p>",
        rawType: "html",
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
      tryRunPostCommand(["post", "export-markdown", "post-1"], runtimeMock as never),
    ).resolves.toBe(true);

    const output = await readFile(join(tempDir, "post-1.md"), "utf8");
    expect(getPost).toHaveBeenCalledWith({ name: "post-1" });
    expect(fetchPostHeadContent).toHaveBeenCalledWith({ name: "post-1" });
    expect(output).toContain("title: Hello Halo");
    expect(output).toContain("slug: hello-halo");
    expect(output).toContain("excerpt: Summary");
    expect(output).toContain("cover: https://example.com/cover.png");
    expect(output).toContain("site: https://example.com");
    expect(output).toContain("name: post-1");
    expect(output).toContain("publish: true");
    expect(output).toContain("<h1>Hello Halo</h1>");
    expect(output).toContain("<p>HTML body</p>");
  } finally {
    process.chdir(previousCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("tryRunPostCommand exports markdown to a specific output file", async () => {
  silenceStdout();

  const tempDir = await mkdtemp(join(tmpdir(), "halo-post-export-markdown-"));
  const outputPath = join(tempDir, "exported-post.md");

  try {
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
        ["post", "export-markdown", "post-1", "--output", outputPath],
        runtimeMock as never,
      ),
    ).resolves.toBe(true);

    const output = await readFile(outputPath, "utf8");
    expect(output).toContain("title: Hello Halo");
    expect(output).toContain("slug: hello-halo");
    expect(output).toContain("publish: false");
    expect(output).toContain("# Hello Halo");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
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
    tryRunPostCommand(["post", "delete", "post-1", "--json", "--force"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(deletePost).toHaveBeenCalledWith({ name: "post-1" });
});
