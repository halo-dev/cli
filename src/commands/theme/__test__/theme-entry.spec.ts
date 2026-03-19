import { afterEach, expect, test, vi } from "vitest";

import { tryRunThemeCommand } from "../index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function silenceStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
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
