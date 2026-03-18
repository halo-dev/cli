import { afterEach, expect, test, vi } from "vitest";

import { tryRunPluginCommand } from "../plugin.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function silenceStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

test("tryRunPluginCommand returns false for unrelated commands", async () => {
  await expect(tryRunPluginCommand(["post"], {} as never)).resolves.toBe(false);
});

test("tryRunPluginCommand shows help for bare plugin commands", async () => {
  silenceStdout();

  await expect(tryRunPluginCommand(["plugin"], {} as never)).resolves.toBe(true);
});

test("tryRunPluginCommand dispatches single-plugin upgrade commands", async () => {
  silenceStdout();

  const upgradePluginFromUri = vi.fn().mockResolvedValue({
    data: {
      metadata: {
        name: "demo-plugin",
      },
    },
  });
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients: {
        console: {
          plugin: {
            plugin: {
              upgradePluginFromUri,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunPluginCommand(
      ["plugin", "upgrade", "demo-plugin", "--url", "https://example.com/plugin.jar", "--json"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(runtimeMock.getClientsForOptions).toHaveBeenCalledOnce();
  expect(upgradePluginFromUri).toHaveBeenCalledWith({
    name: "demo-plugin",
    upgradeFromUriRequest: {
      uri: "https://example.com/plugin.jar",
    },
  });
});

test("tryRunPluginCommand dispatches list subcommands in json mode", async () => {
  silenceStdout();

  const listPlugins = vi.fn().mockResolvedValue({
    data: {
      items: [],
      total: 0,
    },
  });
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients: {
        console: {
          plugin: {
            plugin: {
              listPlugins,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunPluginCommand(
      ["plugin", "list", "--page", "1", "--size", "20", "--enabled", "true", "--json"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(listPlugins).toHaveBeenCalledWith({
    page: 1,
    size: 20,
    keyword: undefined,
    enabled: true,
  });
});

test("tryRunPluginCommand dispatches get subcommands", async () => {
  silenceStdout();

  const getPlugin = vi.fn().mockResolvedValue({
    data: {
      metadata: {
        name: "demo-plugin",
      },
    },
  });
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients: {
        core: {
          plugin: {
            plugin: {
              getPlugin,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunPluginCommand(["plugin", "get", "demo-plugin", "--json"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(getPlugin).toHaveBeenCalledWith({ name: "demo-plugin" });
});

test("tryRunPluginCommand dispatches enable subcommands", async () => {
  silenceStdout();

  const changePluginRunningState = vi.fn().mockResolvedValue({
    data: {
      metadata: {
        name: "demo-plugin",
      },
    },
  });
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients: {
        console: {
          plugin: {
            plugin: {
              changePluginRunningState,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunPluginCommand(
      ["plugin", "enable", "demo-plugin", "--json", "--force"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(changePluginRunningState).toHaveBeenCalledWith({
    name: "demo-plugin",
    pluginRunningStateRequest: {
      enable: true,
    },
  });
});

test("tryRunPluginCommand dispatches disable subcommands", async () => {
  silenceStdout();

  const changePluginRunningState = vi.fn().mockResolvedValue({
    data: {
      metadata: {
        name: "demo-plugin",
      },
    },
  });
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients: {
        console: {
          plugin: {
            plugin: {
              changePluginRunningState,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunPluginCommand(
      ["plugin", "disable", "demo-plugin", "--json", "--force"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(changePluginRunningState).toHaveBeenCalledWith({
    name: "demo-plugin",
    pluginRunningStateRequest: {
      enable: false,
    },
  });
});

test("tryRunPluginCommand dispatches uninstall subcommands", async () => {
  silenceStdout();

  const deletePlugin = vi.fn().mockResolvedValue({});
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients: {
        core: {
          plugin: {
            plugin: {
              deletePlugin,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunPluginCommand(
      ["plugin", "uninstall", "demo-plugin", "--json", "--force"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(deletePlugin).toHaveBeenCalledWith({ name: "demo-plugin" });
});

test("tryRunPluginCommand dispatches install subcommands from urls", async () => {
  silenceStdout();

  const installPluginFromUri = vi.fn().mockResolvedValue({
    data: {
      metadata: {
        name: "demo-plugin",
      },
    },
  });
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients: {
        console: {
          plugin: {
            plugin: {
              installPluginFromUri,
            },
          },
        },
      },
    }),
  };

  await expect(
    tryRunPluginCommand(
      ["plugin", "install", "--url", "https://example.com/plugin.jar", "--json"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(installPluginFromUri).toHaveBeenCalledWith({
    installFromUriRequest: {
      uri: "https://example.com/plugin.jar",
    },
  });
});

test("tryRunPluginCommand rejects unknown install flags during parsing", async () => {
  silenceStdout();

  const runtimeMock = {
    getClientsForOptions: vi.fn(),
  };

  await expect(
    tryRunPluginCommand(["plugin", "install", "--online"], runtimeMock as never),
  ).rejects.toThrow(/Unknown option `--online`/i);
});

test("tryRunPluginCommand rejects invalid --all combinations", async () => {
  silenceStdout();

  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients: {},
    }),
  };

  await expect(
    tryRunPluginCommand(["plugin", "upgrade", "demo-plugin", "--all"], runtimeMock as never),
  ).rejects.toThrow(/does not accept a plugin name/i);
});
