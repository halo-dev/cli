import { afterEach, expect, test, vi } from "vitest";

import { renderContentByRawType } from "../../../utils/content.js";
import { tryRunSinglePageCommand } from "../index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function silenceStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

test("tryRunSinglePageCommand imports json as a new single page when it does not exist", async () => {
  silenceStdout();

  const getSinglePage = vi
    .fn()
    .mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 404 },
    })
    .mockResolvedValue({
      data: {
        metadata: { name: "about" },
        spec: { publish: true },
      },
    });
  const draftSinglePage = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "about" },
      spec: { publish: false },
    },
  });
  const publishSinglePage = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "about" },
      spec: { publish: true },
    },
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
              draftSinglePage,
              publishSinglePage,
              fetchSinglePageHeadContent,
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
        "import-json",
        "--raw",
        '{"page":{"metadata":{"name":"about"},"spec":{"publish":true}},"content":{"raw":"# About","content":"<h1>About</h1>","rawType":"markdown"}}',
        "--json",
      ],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(getSinglePage).toHaveBeenCalledWith({ name: "about" });
  expect(draftSinglePage).toHaveBeenCalledOnce();
  expect(draftSinglePage).toHaveBeenCalledWith({
    singlePageRequest: {
      page: {
        metadata: { name: "about" },
        spec: { publish: false },
      },
      content: {
        raw: "# About",
        content: renderContentByRawType("# About", "markdown"),
        rawType: "markdown",
      },
    },
  });
  expect(publishSinglePage).toHaveBeenCalledWith({ name: "about" });
  expect(fetchSinglePageHeadContent).toHaveBeenCalledWith({ name: "about" });
});

test("tryRunSinglePageCommand imports json by updating an existing single page", async () => {
  silenceStdout();

  const getSinglePage = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "about" },
      spec: { publish: false },
    },
  });
  const fetchSinglePageHeadContent = vi.fn().mockResolvedValue({
    data: { raw: "# About", content: "<h1>About</h1>", rawType: "markdown" },
  });
  const updateDraftSinglePage = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "about" },
      spec: { publish: false },
    },
  });
  const publishSinglePage = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "about" },
      spec: { publish: true },
    },
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
              updateDraftSinglePage,
              publishSinglePage,
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
        "import-json",
        "--raw",
        '{"page":{"metadata":{"name":"about"},"spec":{"publish":true}},"content":{"raw":"# About","content":"<h1>About</h1>","rawType":"markdown"}}',
        "--json",
        "--force",
      ],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(getSinglePage).toHaveBeenCalledWith({ name: "about" });
  expect(updateDraftSinglePage).toHaveBeenCalledOnce();
  expect(updateDraftSinglePage).toHaveBeenCalledWith({
    name: "about",
    singlePageRequest: {
      page: {
        metadata: { name: "about" },
        spec: { publish: false },
      },
      content: {
        raw: "# About",
        content: renderContentByRawType("# About", "markdown"),
        rawType: "markdown",
      },
    },
  });
  expect(publishSinglePage).toHaveBeenCalledWith({ name: "about" });
  expect(fetchSinglePageHeadContent).toHaveBeenCalledWith({ name: "about" });
});

test("tryRunSinglePageCommand prints single page import summary with permalink and inspect command", async () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  const getSinglePage = vi
    .fn()
    .mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 404 },
    })
    .mockResolvedValue({
      data: {
        metadata: { name: "about" },
        spec: { publish: true },
        status: { permalink: "/about" },
      },
    });
  const draftSinglePage = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "about" },
      spec: { publish: false },
      status: {},
    },
  });
  const publishSinglePage = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "about" },
      spec: { publish: true },
      status: { permalink: "/about" },
    },
  });
  const fetchSinglePageHeadContent = vi.fn().mockResolvedValue({
    data: { raw: "# About", content: "<h1>About</h1>", rawType: "markdown" },
  });

  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      profile: { baseUrl: "https://example.com/console" },
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
              draftSinglePage,
              publishSinglePage,
              fetchSinglePageHeadContent,
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
        "import-json",
        "--raw",
        '{"page":{"metadata":{"name":"about"},"spec":{"publish":true}},"content":{"raw":"# About","content":"<h1>About</h1>","rawType":"markdown"}}',
      ],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  const output = stdoutSpy.mock.calls.map((call) => String(call[0])).join("");
  expect(output).toContain("Single page imported successfully from inline JSON.");
  expect(output).toContain("\n\nmetadata.name: about");
  expect(output).toContain("metadata.name: about");
  expect(output).toContain("permalink: https://example.com/about");
  expect(output).toContain("inspect: halo single-page get about");
});

test("tryRunSinglePageCommand rejects invalid inline json", async () => {
  const runtimeMock = {
    getClientsForOptions: vi.fn(),
  };

  await expect(
    tryRunSinglePageCommand(
      ["single-page", "import-json", "--raw", "{invalid-json"],
      runtimeMock as never,
    ),
  ).rejects.toThrow(/invalid single page json payload/i);

  expect(runtimeMock.getClientsForOptions).not.toHaveBeenCalled();
});

test("tryRunSinglePageCommand rejects missing import files", async () => {
  const runtimeMock = {
    getClientsForOptions: vi.fn(),
  };

  await expect(
    tryRunSinglePageCommand(
      ["single-page", "import-json", "--file", "/tmp/halo-cli-single-page-import-missing.json"],
      runtimeMock as never,
    ),
  ).rejects.toThrow(/no such file|enoent/i);

  expect(runtimeMock.getClientsForOptions).not.toHaveBeenCalled();
});
