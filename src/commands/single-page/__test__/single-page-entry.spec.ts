import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, test, vi } from "vitest";

import * as browserUtils from "../browser.js";
import { tryRunSinglePageCommand } from "../index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function silenceStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

test("tryRunSinglePageCommand returns false for unrelated commands", async () => {
  await expect(tryRunSinglePageCommand(["plugin"], {} as never)).resolves.toBe(false);
});

test("tryRunSinglePageCommand shows help for bare single-page commands", async () => {
  silenceStdout();

  await expect(tryRunSinglePageCommand(["single-page"], {} as never)).resolves.toBe(true);
});

test("tryRunSinglePageCommand dispatches list subcommands", async () => {
  silenceStdout();

  const listSinglePages = vi.fn().mockResolvedValue({
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
            singlePage: {
              listSinglePages,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunSinglePageCommand(
      [
        "single-page",
        "list",
        "--page",
        "2",
        "--size",
        "10",
        "--keyword",
        "halo",
        "--publish-phase",
        "PUBLISHED",
        "--visible",
        "PUBLIC",
        "--json",
      ],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(runtimeMock.getClientsForOptions).toHaveBeenCalledOnce();
  expect(listSinglePages).toHaveBeenCalledWith({
    page: 2,
    size: 10,
    keyword: "halo",
    publishPhase: "PUBLISHED",
    visible: "PUBLIC",
  });
});

test("tryRunSinglePageCommand dispatches get subcommands", async () => {
  silenceStdout();

  const getSinglePage = vi.fn().mockResolvedValue({
    data: { metadata: { name: "about" } },
  });
  const fetchSinglePageHeadContent = vi.fn().mockResolvedValue({
    data: { raw: "# About" },
  });
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients: {
        core: {
          content: {
            singlePage: {
              getSinglePage,
            },
          },
        },
        console: {
          content: {
            singlePage: {
              fetchSinglePageHeadContent,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunSinglePageCommand(["single-page", "get", "about", "--json"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(getSinglePage).toHaveBeenCalledWith({ name: "about" });
  expect(fetchSinglePageHeadContent).toHaveBeenCalledWith({ name: "about" });
});

test("tryRunSinglePageCommand prints single page detail in table mode", async () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  const getSinglePage = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "about" },
      spec: { title: "About", publish: true },
      status: {},
    },
  });
  const fetchSinglePageHeadContent = vi.fn().mockResolvedValue({
    data: { raw: "# About\nBody", rawType: "markdown" },
  });
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients: {
        core: {
          content: {
            singlePage: {
              getSinglePage,
            },
          },
        },
        console: {
          content: {
            singlePage: {
              fetchSinglePageHeadContent,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunSinglePageCommand(["single-page", "get", "about"], runtimeMock as never),
  ).resolves.toBe(true);

  const output = stdoutSpy.mock.calls.map((call) => String(call[0])).join("");
  expect(output).toContain("metadata.name");
  expect(output).toContain("about");
  expect(output).toContain("content.rawType");
  expect(output).toContain("markdown");
  expect(output).not.toContain("# About");
  expect(output).toContain('Use "--json" to view the full content payload.');
});

test("tryRunSinglePageCommand dispatches export-json subcommands", async () => {
  silenceStdout();

  const previousCwd = process.cwd();
  const tempDir = await mkdtemp(join(tmpdir(), "halo-single-page-export-default-"));

  try {
    process.chdir(tempDir);

    const getSinglePage = vi.fn().mockResolvedValue({
      data: { metadata: { name: "about" } },
    });
    const fetchSinglePageHeadContent = vi.fn().mockResolvedValue({
      data: { raw: "# About", content: "<h1>About</h1>", rawType: "markdown" },
    });
    const runtimeMock = {
      getClientsForOptions: vi.fn().mockResolvedValue({
        clients: {
          core: {
            content: {
              singlePage: {
                getSinglePage,
              },
            },
          },
          console: {
            content: {
              singlePage: {
                fetchSinglePageHeadContent,
              },
            },
          },
        },
      }),
    };

    await expect(
      tryRunSinglePageCommand(["single-page", "export-json", "about"], runtimeMock as never),
    ).resolves.toBe(true);

    expect(getSinglePage).toHaveBeenCalledWith({ name: "about" });
    expect(fetchSinglePageHeadContent).toHaveBeenCalledWith({ name: "about" });
    await expect(readFile(join(tempDir, "about.json"), "utf8")).resolves.toContain(
      '"name": "about"',
    );
  } finally {
    process.chdir(previousCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("tryRunSinglePageCommand exports json to an output file", async () => {
  silenceStdout();

  const tempDir = await mkdtemp(join(tmpdir(), "halo-single-page-export-"));
  const outputPath = join(tempDir, "single-page.json");

  try {
    const getSinglePage = vi.fn().mockResolvedValue({
      data: { metadata: { name: "about" } },
    });
    const fetchSinglePageHeadContent = vi.fn().mockResolvedValue({
      data: { raw: "# About", content: "<h1>About</h1>", rawType: "markdown" },
    });
    const runtimeMock = {
      getClientsForOptions: vi.fn().mockResolvedValue({
        clients: {
          core: {
            content: {
              singlePage: {
                getSinglePage,
              },
            },
          },
          console: {
            content: {
              singlePage: {
                fetchSinglePageHeadContent,
              },
            },
          },
        },
      }),
    };

    await expect(
      tryRunSinglePageCommand(
        ["single-page", "export-json", "about", "--output", outputPath],
        runtimeMock as never,
      ),
    ).resolves.toBe(true);

    await expect(readFile(outputPath, "utf8")).resolves.toContain('"name": "about"');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("tryRunSinglePageCommand dispatches open subcommands in json mode", async () => {
  silenceStdout();

  const openUrlInBrowser = vi.spyOn(browserUtils, "openUrlInBrowser").mockResolvedValue();
  const getSinglePage = vi.fn().mockResolvedValue({
    data: {
      status: {
        permalink: "/about",
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
            singlePage: {
              getSinglePage,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunSinglePageCommand(["single-page", "open", "about", "--json"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(getSinglePage).toHaveBeenCalledWith({ name: "about" });
  expect(openUrlInBrowser).not.toHaveBeenCalled();
});

test("tryRunSinglePageCommand rejects opening unpublished single pages", async () => {
  silenceStdout();

  const getSinglePage = vi.fn().mockResolvedValue({
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
            singlePage: {
              getSinglePage,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunSinglePageCommand(["single-page", "open", "about"], runtimeMock as never),
  ).rejects.toThrow(/does not have a permalink yet/i);
});

test("tryRunSinglePageCommand dispatches delete subcommands in json mode", async () => {
  silenceStdout();

  const deleteSinglePage = vi.fn().mockResolvedValue(undefined);
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients: {
        core: {
          content: {
            singlePage: {
              deleteSinglePage,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunSinglePageCommand(
      ["single-page", "delete", "about", "--json", "--force"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(deleteSinglePage).toHaveBeenCalledWith({ name: "about" });
});
