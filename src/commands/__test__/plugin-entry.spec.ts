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
