import { afterEach, expect, test, vi } from "vitest";

vi.mock("@inquirer/prompts", () => ({
  checkbox: vi.fn(),
  confirm: vi.fn(),
  input: vi.fn(),
}));

import { confirm, input } from "@inquirer/prompts";

import { tryRunPluginCommand } from "../index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function silenceStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

function setInteractiveTerminal() {
  Object.defineProperty(process.stdin, "isTTY", {
    value: true,
    configurable: true,
  });
  Object.defineProperty(process.stdout, "isTTY", {
    value: true,
    configurable: true,
  });
}

function createPluginRuntimeMock(clients: Record<string, unknown>) {
  return {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients,
    }),
  };
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
      [
        "plugin",
        "upgrade",
        "demo-plugin",
        "--url",
        "https://example.com/plugin.jar",
        "--yes",
        "--json",
      ],
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
    tryRunPluginCommand(["plugin", "list", "--enabled", "true", "--json"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(listPlugins).toHaveBeenCalledWith({
    page: 1,
    keyword: undefined,
    enabled: true,
    size: 100,
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
      ["plugin", "install", "--url", "https://example.com/plugin.jar", "--yes", "--json"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(installPluginFromUri).toHaveBeenCalledWith({
    installFromUriRequest: {
      uri: "https://example.com/plugin.jar",
    },
  });
});

test("tryRunPluginCommand rejects third-party install urls without --yes outside interactive terminals", async () => {
  silenceStdout();

  const runtimeMock = createPluginRuntimeMock({
    console: {
      plugin: {
        plugin: {
          installPluginFromUri: vi.fn(),
        },
      },
    },
  });

  await expect(
    tryRunPluginCommand(
      ["plugin", "install", "--url", "https://example.com/plugin.jar", "--json"],
      runtimeMock as never,
    ),
  ).rejects.toThrow(/requires confirmation in interactive mode.*or use --yes/i);

  expect(runtimeMock.getClientsForOptions).not.toHaveBeenCalled();
});

test("tryRunPluginCommand dispatches install subcommands from files", async () => {
  silenceStdout();

  const installPlugin = vi.fn().mockResolvedValue({
    data: {
      metadata: {
        name: "demo-plugin",
      },
    },
  });
  const runtimeMock = createPluginRuntimeMock({
    console: {
      plugin: {
        plugin: {
          installPlugin,
        },
      },
    },
  });

  await expect(
    tryRunPluginCommand(
      [
        "plugin",
        "install",
        "--file",
        "./src/commands/plugin/__test__/plugin-entry.spec.ts",
        "--json",
      ],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(installPlugin).toHaveBeenCalledTimes(1);
  expect(installPlugin.mock.calls[0]?.[0]).toMatchObject({
    file: expect.any(File),
  });
});

test("tryRunPluginCommand dispatches online upgrade commands", async () => {
  const stdoutSpy = silenceStdout();
  setInteractiveTerminal();
  vi.mocked(confirm).mockResolvedValue(true);
  vi.mocked(input).mockResolvedValue("y");

  const getPlugin = vi.fn().mockResolvedValue({
    data: {
      metadata: {
        name: "demo-plugin",
        annotations: {
          "store.halo.run/app-id": "demo-plugin-app",
        },
      },
    },
  });
  const upgradePluginFromUri = vi.fn().mockResolvedValue({
    data: {
      metadata: {
        name: "demo-plugin",
      },
    },
  });
  const runtimeMock = createPluginRuntimeMock({
    core: {
      plugin: {
        plugin: {
          getPlugin,
        },
      },
      secret: {
        getSecret: vi.fn().mockResolvedValue({
          data: {
            stringData: {},
          },
        }),
      },
    },
    console: {
      plugin: {
        plugin: {
          upgradePluginFromUri,
        },
      },
    },
    axios: {
      get: vi.fn().mockImplementation((url: string) => {
        if (url === "/actuator/info") {
          return Promise.resolve({
            data: {
              build: {
                name: "halo",
                version: "2.20.0",
              },
            },
          });
        }

        return Promise.reject(new Error(`Unexpected axios.get call: ${url}`));
      }),
    },
  });

  const axiosCreateSpy = vi.spyOn((await import("axios")).default, "create").mockReturnValue({
    get: vi.fn().mockImplementation((url: string) => {
      if (url === "/apis/api.store.halo.run/v1alpha1/applications/demo-plugin-app") {
        return Promise.resolve({
          data: {
            latestRelease: {
              release: {
                metadata: {
                  name: "release-1",
                },
              },
              assets: [
                {
                  metadata: {
                    name: "plugin.jar",
                  },
                },
              ],
            },
          },
        });
      }

      if (
        url ===
        "/apis/api.store.halo.run/v1alpha1/applications/demo-plugin-app/releases/release-1/download/plugin.jar"
      ) {
        return Promise.resolve({
          data: {
            url: "https://downloads.example.com/demo-plugin.jar",
          },
        });
      }

      return Promise.reject(new Error(`Unexpected app store get call: ${url}`));
    }),
  } as never);

  await expect(
    tryRunPluginCommand(
      ["plugin", "upgrade", "demo-plugin", "--online", "--json"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(axiosCreateSpy).toHaveBeenCalledOnce();
  expect(getPlugin).toHaveBeenCalledWith({ name: "demo-plugin" });
  expect(stdoutSpy).toHaveBeenCalledWith(
    "- demo-plugin: https://www.halo.run/store/apps/demo-plugin-app/releases/release-1\n",
  );
  expect(upgradePluginFromUri).toHaveBeenCalledWith({
    name: "demo-plugin",
    upgradeFromUriRequest: {
      uri: "https://downloads.example.com/demo-plugin.jar",
    },
  });
});

test("tryRunPluginCommand skips release note confirmation with --yes", async () => {
  vi.clearAllMocks();
  silenceStdout();

  const getPlugin = vi.fn().mockResolvedValue({
    data: {
      metadata: {
        name: "demo-plugin",
        annotations: {
          "store.halo.run/app-id": "demo-plugin-app",
        },
      },
    },
  });
  const upgradePluginFromUri = vi.fn().mockResolvedValue({
    data: {
      metadata: {
        name: "demo-plugin",
      },
    },
  });
  const runtimeMock = createPluginRuntimeMock({
    core: {
      plugin: {
        plugin: {
          getPlugin,
        },
      },
      secret: {
        getSecret: vi.fn().mockResolvedValue({
          data: {
            stringData: {},
          },
        }),
      },
    },
    console: {
      plugin: {
        plugin: {
          upgradePluginFromUri,
        },
      },
    },
    axios: {
      get: vi.fn().mockImplementation((url: string) => {
        if (url === "/actuator/info") {
          return Promise.resolve({
            data: {
              build: {
                name: "halo",
                version: "2.20.0",
              },
            },
          });
        }

        return Promise.reject(new Error(`Unexpected axios.get call: ${url}`));
      }),
    },
  });

  vi.spyOn((await import("axios")).default, "create").mockReturnValue({
    get: vi.fn().mockImplementation((url: string) => {
      if (url === "/apis/api.store.halo.run/v1alpha1/applications/demo-plugin-app") {
        return Promise.resolve({
          data: {
            latestRelease: {
              release: {
                metadata: {
                  name: "release-1",
                },
              },
              assets: [
                {
                  metadata: {
                    name: "plugin.jar",
                  },
                },
              ],
            },
          },
        });
      }

      if (
        url ===
        "/apis/api.store.halo.run/v1alpha1/applications/demo-plugin-app/releases/release-1/download/plugin.jar"
      ) {
        return Promise.resolve({
          data: {
            url: "https://downloads.example.com/demo-plugin.jar",
          },
        });
      }

      return Promise.reject(new Error(`Unexpected app store get call: ${url}`));
    }),
  } as never);

  await expect(
    tryRunPluginCommand(
      ["plugin", "upgrade", "demo-plugin", "--online", "--yes", "--json"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(confirm).not.toHaveBeenCalled();
  expect(input).not.toHaveBeenCalled();
  expect(upgradePluginFromUri).toHaveBeenCalledOnce();
});

test("tryRunPluginCommand rejects unknown install flags during parsing", async () => {
  silenceStdout();

  const runtimeMock = {
    getClientsForOptions: vi.fn(),
  };

  await expect(
    tryRunPluginCommand(["plugin", "install", "--online"], runtimeMock as never),
  ).rejects.toThrow(/Unknown option `--online`/i);

  await expect(
    tryRunPluginCommand(
      ["plugin", "install", "--uri", "https://example.com/plugin.jar"],
      runtimeMock as never,
    ),
  ).rejects.toThrow(/Unknown option `--uri`/i);
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

test("tryRunPluginCommand prints empty batch upgrade results in json mode", async () => {
  silenceStdout();

  const listPlugins = vi.fn().mockResolvedValue({
    data: {
      items: [],
      total: 0,
      hasNext: false,
    },
  });
  const runtimeMock = createPluginRuntimeMock({
    console: {
      plugin: {
        plugin: {
          listPlugins,
        },
      },
    },
  });

  const axiosCreateSpy = vi.spyOn((await import("axios")).default, "create").mockReturnValue({
    get: vi.fn(),
  } as never);

  await expect(
    tryRunPluginCommand(["plugin", "upgrade", "--all", "--json"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(listPlugins).toHaveBeenCalledWith({
    page: 1,
    size: 100,
    keyword: undefined,
    enabled: undefined,
  });
  expect(axiosCreateSpy).toHaveBeenCalledOnce();
});

test("tryRunPluginCommand upgrades batch plugin candidates in json mode", async () => {
  const stdoutSpy = silenceStdout();
  setInteractiveTerminal();
  vi.mocked(confirm).mockResolvedValue(true);

  const listPlugins = vi.fn().mockResolvedValue({
    data: {
      items: [
        {
          metadata: {
            name: "demo-plugin",
            annotations: {
              "store.halo.run/app-id": "demo-plugin-app",
            },
          },
          spec: {
            version: "1.0.0",
            displayName: "Demo Plugin",
          },
        },
      ],
      total: 1,
      hasNext: false,
    },
  });
  const upgradePluginFromUri = vi.fn().mockResolvedValue({
    data: {
      metadata: {
        name: "demo-plugin",
      },
    },
  });
  const runtimeMock = createPluginRuntimeMock({
    core: {
      secret: {
        getSecret: vi.fn().mockResolvedValue({
          data: {
            stringData: {},
          },
        }),
      },
    },
    console: {
      plugin: {
        plugin: {
          listPlugins,
          upgradePluginFromUri,
        },
      },
    },
    axios: {
      get: vi.fn().mockResolvedValue({
        data: {
          build: {
            name: "halo",
            version: "2.20.0",
          },
        },
      }),
    },
  });

  const appStoreGet = vi
    .fn()
    .mockImplementation((url: string, options?: { params?: Record<string, unknown> }) => {
      if (url === "/apis/api.store.halo.run/v1alpha1/applications") {
        expect(options).toEqual({
          params: {
            type: "PLUGIN",
            names: ["demo-plugin-app"],
          },
        });

        return Promise.resolve({
          data: {
            items: [
              {
                downloadable: true,
                application: {
                  metadata: {
                    name: "demo-plugin-app",
                  },
                },
                latestRelease: {
                  spec: {
                    version: "1.1.0",
                    requires: ">=2.0.0",
                  },
                },
              },
            ],
          },
        });
      }

      if (url === "/apis/api.store.halo.run/v1alpha1/applications/demo-plugin-app") {
        return Promise.resolve({
          data: {
            latestRelease: {
              release: {
                metadata: {
                  name: "release-1",
                },
              },
              assets: [
                {
                  metadata: {
                    name: "plugin.jar",
                  },
                },
              ],
            },
          },
        });
      }

      if (
        url ===
        "/apis/api.store.halo.run/v1alpha1/applications/demo-plugin-app/releases/release-1/download/plugin.jar"
      ) {
        return Promise.resolve({
          data: {
            url: "https://downloads.example.com/demo-plugin.jar",
          },
        });
      }

      return Promise.reject(new Error(`Unexpected app store get call: ${url}`));
    });

  const axiosCreateSpy = vi.spyOn((await import("axios")).default, "create").mockReturnValue({
    get: appStoreGet,
  } as never);

  await expect(
    tryRunPluginCommand(["plugin", "upgrade", "--all", "--json"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(axiosCreateSpy).toHaveBeenCalledTimes(2);
  expect(listPlugins).toHaveBeenCalledWith({
    page: 1,
    size: 100,
    keyword: undefined,
    enabled: undefined,
  });
  expect(upgradePluginFromUri).toHaveBeenCalledWith({
    name: "demo-plugin",
    upgradeFromUriRequest: {
      uri: "https://downloads.example.com/demo-plugin.jar",
    },
  });
  expect(stdoutSpy).toHaveBeenCalledWith(
    "- Demo Plugin: https://www.halo.run/store/apps/demo-plugin-app/releases/release-1\n",
  );
});
