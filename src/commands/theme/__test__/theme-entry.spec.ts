import { afterEach, expect, test, vi } from "vitest";

import { tryRunThemeCommand } from "../index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function silenceStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

function createThemeRuntimeMock(overrides: Record<string, unknown>) {
  return {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients: overrides,
    }),
  };
}

test("tryRunThemeCommand returns false for unrelated commands", async () => {
  await expect(tryRunThemeCommand(["post"], {} as never)).resolves.toBe(false);
});

test("tryRunThemeCommand shows help for bare theme commands", async () => {
  silenceStdout();

  await expect(tryRunThemeCommand(["theme"], {} as never)).resolves.toBe(true);
});

test("tryRunThemeCommand dispatches current subcommands", async () => {
  silenceStdout();

  const fetchActivatedTheme = vi.fn().mockResolvedValue({
    data: {
      apiVersion: "theme.halo.run/v1alpha1",
      kind: "Theme",
      metadata: { name: "active-theme" },
      spec: {
        displayName: "Active Theme",
        author: { name: "Halo" },
      },
    },
  });
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients: {
        console: {
          theme: {
            theme: {
              fetchActivatedTheme,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunThemeCommand(["theme", "current", "--json"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(fetchActivatedTheme).toHaveBeenCalledOnce();
});

test("tryRunThemeCommand fetches the active theme when listing in table mode", async () => {
  silenceStdout();

  const listThemes = vi.fn().mockResolvedValue({
    data: {
      items: [],
      total: 0,
      first: true,
      last: true,
      hasNext: false,
      hasPrevious: false,
      page: 1,
      size: 20,
      totalPages: 1,
    },
  });
  const fetchActivatedTheme = vi.fn().mockResolvedValue({
    data: {
      apiVersion: "theme.halo.run/v1alpha1",
      kind: "Theme",
      metadata: { name: "active-theme" },
      spec: {
        displayName: "Active Theme",
        author: { name: "Halo" },
      },
    },
  });
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients: {
        console: {
          theme: {
            theme: {
              listThemes,
              fetchActivatedTheme,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunThemeCommand(["theme", "list", "--page", "1", "--size", "20"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(listThemes).toHaveBeenCalledWith({
    page: 1,
    size: 20,
    uninstalled: undefined,
  });
  expect(fetchActivatedTheme).toHaveBeenCalledOnce();
});

test("tryRunThemeCommand dispatches get subcommands", async () => {
  silenceStdout();

  const getTheme = vi.fn().mockResolvedValue({
    data: {
      apiVersion: "theme.halo.run/v1alpha1",
      kind: "Theme",
      metadata: { name: "demo-theme" },
      spec: {
        displayName: "Demo Theme",
        author: { name: "Halo" },
      },
    },
  });
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients: {
        core: {
          theme: {
            theme: {
              getTheme,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunThemeCommand(["theme", "get", "demo-theme", "--json"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(getTheme).toHaveBeenCalledWith({ name: "demo-theme" });
});

test("tryRunThemeCommand dispatches install subcommands from urls", async () => {
  silenceStdout();

  const installThemeFromUri = vi.fn().mockResolvedValue({
    data: {
      apiVersion: "theme.halo.run/v1alpha1",
      kind: "Theme",
      metadata: { name: "demo-theme" },
      spec: {
        displayName: "Demo Theme",
        author: { name: "Halo" },
      },
    },
  });
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients: {
        console: {
          theme: {
            theme: {
              installThemeFromUri,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunThemeCommand(
      ["theme", "install", "--url", "https://example.com/theme.zip", "--json"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(installThemeFromUri).toHaveBeenCalledWith({
    installFromUriRequest: {
      uri: "https://example.com/theme.zip",
    },
  });
});

test("tryRunThemeCommand rejects unknown online install flags during parsing", async () => {
  silenceStdout();

  const runtimeMock = {
    getClientsForOptions: vi.fn(),
  };

  await expect(
    tryRunThemeCommand(["theme", "install", "--online"], runtimeMock as never),
  ).rejects.toThrow(/Unknown option `--online`/i);
});

test("tryRunThemeCommand dispatches activate subcommands", async () => {
  silenceStdout();

  const activateTheme = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "demo-theme" },
    },
  });
  const runtimeMock = createThemeRuntimeMock({
    console: {
      theme: {
        theme: {
          activateTheme,
        },
      },
    },
  });

  await expect(
    tryRunThemeCommand(["theme", "activate", "demo-theme", "--json"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(activateTheme).toHaveBeenCalledWith({ name: "demo-theme" });
});

test("tryRunThemeCommand dispatches reload subcommands", async () => {
  silenceStdout();

  const reload = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "demo-theme" },
    },
  });
  const runtimeMock = createThemeRuntimeMock({
    console: {
      theme: {
        theme: {
          reload,
        },
      },
    },
  });

  await expect(
    tryRunThemeCommand(["theme", "reload", "demo-theme", "--json"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(reload).toHaveBeenCalledWith({ name: "demo-theme" });
});

test("tryRunThemeCommand dispatches upgrade subcommands from urls", async () => {
  silenceStdout();

  const upgradeThemeFromUri = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "demo-theme" },
    },
  });
  const runtimeMock = createThemeRuntimeMock({
    console: {
      theme: {
        theme: {
          upgradeThemeFromUri,
        },
      },
    },
  });

  await expect(
    tryRunThemeCommand(
      ["theme", "upgrade", "demo-theme", "--url", "https://example.com/theme.zip", "--json"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(upgradeThemeFromUri).toHaveBeenCalledWith({
    name: "demo-theme",
    upgradeFromUriRequest: {
      uri: "https://example.com/theme.zip",
    },
  });
});

test("tryRunThemeCommand dispatches delete subcommands", async () => {
  silenceStdout();

  const deleteTheme = vi.fn().mockResolvedValue({});
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients: {
        core: {
          theme: {
            theme: {
              deleteTheme,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunThemeCommand(
      ["theme", "delete", "demo-theme", "--json", "--force"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(deleteTheme).toHaveBeenCalledWith({ name: "demo-theme" });
});
