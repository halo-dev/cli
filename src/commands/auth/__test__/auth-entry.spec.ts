import { afterEach, expect, test, vi } from "vitest";

import { tryRunAuthCommand } from "../index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function silenceStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

test("tryRunAuthCommand returns false for unrelated commands", async () => {
  await expect(tryRunAuthCommand(["post"], {} as never)).resolves.toBe(false);
});

test("tryRunAuthCommand shows help for bare auth commands", async () => {
  silenceStdout();

  await expect(tryRunAuthCommand(["auth"], {} as never)).resolves.toBe(true);
});

test("tryRunAuthCommand dispatches profile list subcommands", async () => {
  silenceStdout();

  const runtimeMock = {
    configStore: {
      listProfiles: vi.fn().mockResolvedValue({
        activeProfile: "local",
        profiles: [],
      }),
    },
  };

  await expect(
    tryRunAuthCommand(["auth", "profile", "list", "--json"], runtimeMock as never),
  ).resolves.toBe(true);
  expect(runtimeMock.configStore.listProfiles).toHaveBeenCalledOnce();
});

test("tryRunAuthCommand shows help for bare profile subcommands", async () => {
  silenceStdout();

  await expect(tryRunAuthCommand(["auth", "profile"], {} as never)).resolves.toBe(true);
});
