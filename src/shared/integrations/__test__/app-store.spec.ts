import { afterEach, expect, test, vi } from "vite-plus/test";

vi.mock("@inquirer/prompts", () => ({
  confirm: vi.fn(),
  input: vi.fn(),
}));

import { confirm } from "@inquirer/prompts";

import {
  APP_STORE_PAT_SECRET_NAME,
  buildAppStoreReleaseUrl,
  confirmAppStoreReleaseReview,
  formatHaloProAuthorizationToken,
  getAppStoreHeaders,
  resolveLatestAppStoreRelease,
  resolveLatestAppStoreDownloadUrl,
  resolvePluginAppStoreAppId,
  resolvePluginUpdateInfo,
  resolvePluginUpgradeSource,
  resolveUpgradeSource,
  resolveThemeAppStoreAppId,
  satisfiesRequires,
} from "../app-store.js";

afterEach(() => {
  vi.restoreAllMocks();
});

test("resolvePluginUpgradeSource accepts url source", () => {
  expect(resolvePluginUpgradeSource({ url: "https://example.com/plugin.jar" })).toEqual({
    kind: "url",
    url: "https://example.com/plugin.jar",
  });
});

test("resolvePluginUpgradeSource accepts file source", () => {
  expect(resolvePluginUpgradeSource({ file: "./plugin.jar" })).toEqual({
    kind: "file",
    file: "./plugin.jar",
  });
});

test("resolvePluginUpgradeSource accepts online source", () => {
  expect(resolvePluginUpgradeSource({ online: true })).toEqual({
    kind: "online",
  });
});

test("resolvePluginUpgradeSource rejects missing sources", () => {
  expect(() => resolvePluginUpgradeSource({})).toThrow(/Provide exactly one plugin upgrade source/);
});

test("resolvePluginUpgradeSource rejects multiple sources", () => {
  expect(() =>
    resolvePluginUpgradeSource({
      url: "https://example.com/plugin.jar",
      online: true,
    }),
  ).toThrow(/Use only one plugin upgrade source/);
});

test("resolveUpgradeSource uses custom resource name in errors", () => {
  expect(() => resolveUpgradeSource({}, "theme")).toThrow(/exactly one theme upgrade source/);
  expect(() =>
    resolveUpgradeSource({ url: "https://example.com/theme.zip", online: true }, "theme"),
  ).toThrow(/only one theme upgrade source/);
});

test("resolvePluginAppStoreAppId reads store annotation", () => {
  const appId = resolvePluginAppStoreAppId({
    metadata: {
      annotations: {
        "store.halo.run/app-id": "plugin-app-store-integration",
      },
    },
  } as never);

  expect(appId).toBe("plugin-app-store-integration");
});

test("resolvePluginAppStoreAppId rejects plugins without store annotation", () => {
  expect(() =>
    resolvePluginAppStoreAppId({
      metadata: {},
    } as never),
  ).toThrow(/store\.halo\.run\/app-id/);
});

test("formatHaloProAuthorizationToken normalizes activation code for X-Authorization", () => {
  expect(formatHaloProAuthorizationToken(" code=with=padding=\n")).toBe("lxl_codewithpadding");
});

test("formatHaloProAuthorizationToken rejects empty activation codes", () => {
  expect(() => formatHaloProAuthorizationToken("  ")).toThrow(/activation code is empty/i);
});

test("satisfiesRequires matches plugin-app-store semantics", () => {
  expect(satisfiesRequires("2.0.0", ">=2.0.0")).toBe(true);
  expect(satisfiesRequires("2.0.0", "2.0.0")).toBe(true);
  expect(satisfiesRequires("2.0.0-beta.1", ">=2.0.0")).toBe(true);
  expect(satisfiesRequires("2.0.0", ">2.0.0")).toBe(false);
});

test("resolvePluginUpdateInfo reports compatible updates", () => {
  expect(resolvePluginUpdateInfo("1.0.0", "1.1.0", "2.20.0", ">=2.0.0")).toEqual({
    latestVersion: "1.1.0",
    compatible: true,
  });
});

test("resolvePluginUpdateInfo reports incompatible updates", () => {
  expect(resolvePluginUpdateInfo("1.0.0", "1.1.0", "2.0.0", ">=2.5.0")).toEqual({
    latestVersion: "1.1.0",
    compatible: false,
  });
});

test("resolvePluginUpdateInfo ignores invalid semver versions", () => {
  expect(resolvePluginUpdateInfo("main", "1.1.0", "2.20.0", ">=2.0.0")).toBeUndefined();
});

test("resolvePluginUpdateInfo ignores non-upgrades", () => {
  expect(resolvePluginUpdateInfo("1.1.0", "1.1.0", "2.20.0", ">=2.0.0")).toBeUndefined();
});

test("resolveThemeAppStoreAppId reads store annotation", () => {
  const appId = resolveThemeAppStoreAppId({
    metadata: {
      annotations: {
        "store.halo.run/app-id": "theme-app-store-integration",
      },
    },
  } as never);

  expect(appId).toBe("theme-app-store-integration");
});

test("resolveThemeAppStoreAppId rejects themes without store annotation", () => {
  expect(() =>
    resolveThemeAppStoreAppId({
      metadata: {},
    } as never),
  ).toThrow(/store\.halo\.run\/app-id/);
});

test("getAppStoreHeaders includes PAT and Halo Pro authorization headers when available", async () => {
  const clients = {
    core: {
      secret: {
        getSecret: async ({ name }: { name: string }) => {
          expect(name).toBe(APP_STORE_PAT_SECRET_NAME);
          return {
            data: {
              stringData: {
                token: "pat-token",
              },
            },
          };
        },
      },
    },
    axios: {
      get: async (url: string) => {
        if (url === "/actuator/info") {
          return {
            data: {
              build: {
                name: "halo-pro",
                version: "2.20.0",
              },
            },
          };
        }

        if (url === "/apis/console.api.license.pro.halo.run/v1alpha1/activations") {
          return {
            data: [
              {
                status: {
                  state: "active",
                  activationCode: "code=with=padding=",
                },
              },
            ],
          };
        }

        throw new Error(`Unexpected axios.get call: ${url}`);
      },
    },
  } as never;

  await expect(getAppStoreHeaders(clients)).resolves.toEqual({
    Accept: "application/json",
    Authorization: "Bearer pat-token",
    "X-Authorization": "Bearer lxl_codewithpadding",
  });
});

test("getAppStoreHeaders falls back to Accept-only headers when optional auth is unavailable", async () => {
  const clients = {
    core: {
      secret: {
        getSecret: async () => {
          throw new Error("secret lookup failed");
        },
      },
    },
    axios: {
      get: async () => {
        throw new Error("actuator lookup failed");
      },
    },
  } as never;

  await expect(getAppStoreHeaders(clients)).resolves.toEqual({
    Accept: "application/json",
  });
});

test("resolveLatestAppStoreDownloadUrl resolves the latest downloadable asset URL", async () => {
  const appStoreClient = {
    get: async (url: string) => {
      if (url === "/apis/api.store.halo.run/v1alpha1/applications/demo-app") {
        return {
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
        };
      }

      if (
        url ===
        "/apis/api.store.halo.run/v1alpha1/applications/demo-app/releases/release-1/download/plugin.jar"
      ) {
        return {
          data: {
            url: "https://downloads.example.com/plugin.jar",
          },
        };
      }

      throw new Error(`Unexpected app store get call: ${url}`);
    },
  } as never;

  await expect(resolveLatestAppStoreDownloadUrl(appStoreClient, " demo-app ")).resolves.toBe(
    "https://downloads.example.com/plugin.jar",
  );
});

test("resolveLatestAppStoreRelease resolves the latest release detail", async () => {
  const appStoreClient = {
    get: async (url: string) => {
      if (url === "/apis/api.store.halo.run/v1alpha1/applications/demo-app") {
        return {
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
        };
      }

      if (
        url ===
        "/apis/api.store.halo.run/v1alpha1/applications/demo-app/releases/release-1/download/plugin.jar"
      ) {
        return {
          data: {
            url: "https://downloads.example.com/plugin.jar",
          },
        };
      }

      throw new Error(`Unexpected app store get call: ${url}`);
    },
  } as never;

  await expect(resolveLatestAppStoreRelease(appStoreClient, "demo-app")).resolves.toEqual({
    appName: "demo-app",
    releaseName: "release-1",
    releaseUrl: "https://www.halo.run/store/apps/demo-app/releases/release-1",
    downloadUrl: "https://downloads.example.com/plugin.jar",
  });
});

test("buildAppStoreReleaseUrl builds Halo App Store release pages", () => {
  expect(buildAppStoreReleaseUrl(" demo-app ", " release-1 ")).toBe(
    "https://www.halo.run/store/apps/demo-app/releases/release-1",
  );
});

test("confirmAppStoreReleaseReview skips prompting with --yes", async () => {
  await expect(
    confirmAppStoreReleaseReview(
      {
        commandPath: "halo plugin upgrade",
        actionLabel: "upgrading App Store plugins",
        items: [
          {
            name: "Demo Plugin",
            releaseUrl: "https://www.halo.run/store/apps/demo/releases/release-1",
          },
        ],
      },
      { yes: true },
    ),
  ).resolves.toBe(true);

  expect(confirm).not.toHaveBeenCalled();
});

test("confirmAppStoreReleaseReview returns false when user cancels", async () => {
  Object.defineProperty(process.stdin, "isTTY", {
    value: true,
    configurable: true,
  });
  Object.defineProperty(process.stdout, "isTTY", {
    value: true,
    configurable: true,
  });

  vi.mocked(confirm).mockResolvedValue(false);
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  await expect(
    confirmAppStoreReleaseReview(
      {
        commandPath: "halo plugin upgrade",
        actionLabel: "upgrading App Store plugins",
        items: [
          {
            name: "Demo Plugin",
            releaseUrl: "https://www.halo.run/store/apps/demo/releases/release-1",
          },
        ],
      },
      {},
    ),
  ).resolves.toBe(false);

  expect(stdoutSpy).toHaveBeenCalledWith("Release notes:\n");
  expect(stdoutSpy).toHaveBeenCalledWith(
    "- Demo Plugin: https://www.halo.run/store/apps/demo/releases/release-1\n",
  );
});

test("resolveLatestAppStoreDownloadUrl rejects empty app ids", async () => {
  const appStoreClient = {
    get: async () => {
      throw new Error("should not be called");
    },
  } as never;

  await expect(resolveLatestAppStoreDownloadUrl(appStoreClient, "  ")).rejects.toThrow(
    /app id is empty/i,
  );
});

test("resolveLatestAppStoreDownloadUrl rejects releases without installable assets", async () => {
  const appStoreClient = {
    get: async () => ({
      data: {
        latestRelease: {
          release: {
            metadata: {
              name: "release-1",
            },
          },
          assets: [],
        },
      },
    }),
  } as never;

  await expect(resolveLatestAppStoreDownloadUrl(appStoreClient, "demo-app")).rejects.toThrow(
    /does not have an installable latest release/i,
  );
});

test("resolveLatestAppStoreDownloadUrl rejects missing downloadable asset URLs", async () => {
  const appStoreClient = {
    get: async (url: string) => {
      if (url === "/apis/api.store.halo.run/v1alpha1/applications/demo-app") {
        return {
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
        };
      }

      return {
        data: {
          url: "   ",
        },
      };
    },
  } as never;

  await expect(resolveLatestAppStoreDownloadUrl(appStoreClient, "demo-app")).rejects.toThrow(
    /did not return a downloadable asset URL/i,
  );
});
