import { afterEach, expect, test, vi } from "vitest";

vi.mock("@inquirer/prompts", () => ({
  checkbox: vi.fn(),
  confirm: vi.fn(),
  input: vi.fn(),
}));

import { confirm, input } from "@inquirer/prompts";

import { tryRunThemeCommand } from "../index.js";

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

test("tryRunThemeCommand fetches all themes when listing in table mode", async () => {
  silenceStdout();

  const listThemes = vi
    .fn()
    .mockResolvedValueOnce({
      data: {
        items: [
          {
            apiVersion: "theme.halo.run/v1alpha1",
            kind: "Theme",
            metadata: { name: "active-theme" },
            spec: {
              displayName: "Active Theme",
              version: "1.0.0",
              author: { name: "Halo" },
            },
          },
        ],
        total: 2,
        first: true,
        last: false,
        hasNext: true,
        hasPrevious: false,
        page: 1,
        size: 100,
        totalPages: 2,
      },
    })
    .mockResolvedValueOnce({
      data: {
        items: [
          {
            apiVersion: "theme.halo.run/v1alpha1",
            kind: "Theme",
            metadata: { name: "other-theme" },
            spec: {
              displayName: "Other Theme",
              version: "1.1.0",
              author: { name: "Halo" },
            },
          },
        ],
        total: 2,
        first: false,
        last: true,
        hasNext: false,
        hasPrevious: true,
        page: 2,
        size: 100,
        totalPages: 2,
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

  await expect(tryRunThemeCommand(["theme", "list"], runtimeMock as never)).resolves.toBe(true);

  expect(listThemes).toHaveBeenNthCalledWith(1, {
    page: 1,
    size: 100,
    uninstalled: undefined,
  });
  expect(listThemes).toHaveBeenNthCalledWith(2, {
    page: 2,
    size: 100,
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
      ["theme", "install", "--url", "https://example.com/theme.zip", "--yes", "--json"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(installThemeFromUri).toHaveBeenCalledWith({
    installFromUriRequest: {
      uri: "https://example.com/theme.zip",
    },
  });
});

test("tryRunThemeCommand rejects third-party install urls without --yes outside interactive terminals", async () => {
  silenceStdout();

  const runtimeMock = createThemeRuntimeMock({
    console: {
      theme: {
        theme: {
          installThemeFromUri: vi.fn(),
        },
      },
    },
  });

  await expect(
    tryRunThemeCommand(
      ["theme", "install", "--url", "https://example.com/theme.zip", "--json"],
      runtimeMock as never,
    ),
  ).rejects.toThrow(/requires confirmation in interactive mode.*or use --yes/i);

  expect(runtimeMock.getClientsForOptions).not.toHaveBeenCalled();
});

test("tryRunThemeCommand rejects unknown online install flags during parsing", async () => {
  silenceStdout();

  const runtimeMock = {
    getClientsForOptions: vi.fn(),
  };

  await expect(
    tryRunThemeCommand(["theme", "install", "--online"], runtimeMock as never),
  ).rejects.toThrow(/Unknown option `--online`/i);

  await expect(
    tryRunThemeCommand(
      ["theme", "install", "--uri", "https://example.com/theme.zip"],
      runtimeMock as never,
    ),
  ).rejects.toThrow(/Unknown option `--uri`/i);
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
      [
        "theme",
        "upgrade",
        "demo-theme",
        "--url",
        "https://example.com/theme.zip",
        "--yes",
        "--json",
      ],
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

test("tryRunThemeCommand dispatches online upgrade commands after release note confirmation", async () => {
  const stdoutSpy = silenceStdout();
  setInteractiveTerminal();
  vi.mocked(confirm).mockResolvedValue(true);
  vi.mocked(input).mockResolvedValue("y");

  const getTheme = vi.fn().mockResolvedValue({
    data: {
      metadata: {
        name: "demo-theme",
        annotations: {
          "store.halo.run/app-id": "demo-theme-app",
        },
      },
      spec: {
        displayName: "Demo Theme",
      },
    },
  });
  const upgradeThemeFromUri = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "demo-theme" },
    },
  });
  const runtimeMock = createThemeRuntimeMock({
    core: {
      theme: {
        theme: {
          getTheme,
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
      theme: {
        theme: {
          upgradeThemeFromUri,
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

  vi.spyOn((await import("axios")).default, "create").mockReturnValue({
    get: vi.fn().mockImplementation((url: string) => {
      if (url === "/apis/api.store.halo.run/v1alpha1/applications/demo-theme-app") {
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
                    name: "theme.zip",
                  },
                },
              ],
            },
          },
        });
      }

      if (
        url ===
        "/apis/api.store.halo.run/v1alpha1/applications/demo-theme-app/releases/release-1/download/theme.zip"
      ) {
        return Promise.resolve({
          data: {
            url: "https://downloads.example.com/demo-theme.zip",
          },
        });
      }

      return Promise.reject(new Error(`Unexpected app store get call: ${url}`));
    }),
  } as never);

  await expect(
    tryRunThemeCommand(
      ["theme", "upgrade", "demo-theme", "--online", "--json"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(stdoutSpy).toHaveBeenCalledWith(
    "- Demo Theme: https://www.halo.run/store/apps/demo-theme-app/releases/release-1\n",
  );
  expect(upgradeThemeFromUri).toHaveBeenCalledWith({
    name: "demo-theme",
    upgradeFromUriRequest: {
      uri: "https://downloads.example.com/demo-theme.zip",
    },
  });
});

test("tryRunThemeCommand skips release note confirmation with --yes", async () => {
  vi.clearAllMocks();
  silenceStdout();

  const getTheme = vi.fn().mockResolvedValue({
    data: {
      metadata: {
        name: "demo-theme",
        annotations: {
          "store.halo.run/app-id": "demo-theme-app",
        },
      },
      spec: {
        displayName: "Demo Theme",
      },
    },
  });
  const upgradeThemeFromUri = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "demo-theme" },
    },
  });
  const runtimeMock = createThemeRuntimeMock({
    core: {
      theme: {
        theme: {
          getTheme,
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
      theme: {
        theme: {
          upgradeThemeFromUri,
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

  vi.spyOn((await import("axios")).default, "create").mockReturnValue({
    get: vi.fn().mockImplementation((url: string) => {
      if (url === "/apis/api.store.halo.run/v1alpha1/applications/demo-theme-app") {
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
                    name: "theme.zip",
                  },
                },
              ],
            },
          },
        });
      }

      if (
        url ===
        "/apis/api.store.halo.run/v1alpha1/applications/demo-theme-app/releases/release-1/download/theme.zip"
      ) {
        return Promise.resolve({
          data: {
            url: "https://downloads.example.com/demo-theme.zip",
          },
        });
      }

      return Promise.reject(new Error(`Unexpected app store get call: ${url}`));
    }),
  } as never);

  await expect(
    tryRunThemeCommand(
      ["theme", "upgrade", "demo-theme", "--online", "--yes", "--json"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(confirm).not.toHaveBeenCalled();
  expect(input).not.toHaveBeenCalled();
  expect(upgradeThemeFromUri).toHaveBeenCalledOnce();
});

test("tryRunThemeCommand upgrades batch theme candidates after release note confirmation", async () => {
  const stdoutSpy = silenceStdout();
  setInteractiveTerminal();
  vi.mocked(confirm).mockResolvedValue(true);

  const listThemes = vi.fn().mockResolvedValue({
    data: {
      items: [
        {
          metadata: {
            name: "demo-theme",
            annotations: {
              "store.halo.run/app-id": "demo-theme-app",
            },
          },
          spec: {
            version: "1.0.0",
            displayName: "Demo Theme",
          },
        },
      ],
      total: 1,
      hasNext: false,
    },
  });
  const upgradeThemeFromUri = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "demo-theme" },
    },
  });
  const runtimeMock = createThemeRuntimeMock({
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
      theme: {
        theme: {
          listThemes,
          upgradeThemeFromUri,
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

  vi.spyOn((await import("axios")).default, "create").mockReturnValue({
    get: vi
      .fn()
      .mockImplementation((url: string, options?: { params?: Record<string, unknown> }) => {
        if (url === "/apis/api.store.halo.run/v1alpha1/applications") {
          expect(options).toEqual({
            params: {
              type: "THEME",
              names: ["demo-theme-app"],
            },
          });

          return Promise.resolve({
            data: {
              items: [
                {
                  downloadable: true,
                  application: {
                    metadata: {
                      name: "demo-theme-app",
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

        if (url === "/apis/api.store.halo.run/v1alpha1/applications/demo-theme-app") {
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
                      name: "theme.zip",
                    },
                  },
                ],
              },
            },
          });
        }

        if (
          url ===
          "/apis/api.store.halo.run/v1alpha1/applications/demo-theme-app/releases/release-1/download/theme.zip"
        ) {
          return Promise.resolve({
            data: {
              url: "https://downloads.example.com/demo-theme.zip",
            },
          });
        }

        return Promise.reject(new Error(`Unexpected app store get call: ${url}`));
      }),
  } as never);

  await expect(
    tryRunThemeCommand(["theme", "upgrade", "--all", "--json"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(stdoutSpy).toHaveBeenCalledWith(
    "- Demo Theme: https://www.halo.run/store/apps/demo-theme-app/releases/release-1\n",
  );
  expect(upgradeThemeFromUri).toHaveBeenCalledWith({
    name: "demo-theme",
    upgradeFromUriRequest: {
      uri: "https://downloads.example.com/demo-theme.zip",
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
