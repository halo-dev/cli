import { afterEach, expect, test, vi } from "vitest";

import { tryRunAuthCommand } from "../index.js";

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = 0;
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

test("tryRunAuthCommand dispatches profile get subcommands", async () => {
  silenceStdout();

  const runtimeMock = {
    configStore: {
      getStoredProfile: vi.fn().mockResolvedValue({
        name: "local",
        baseUrl: "https://demo.halo.run",
        auth: { type: "bearer" },
        createdAt: "2026-03-18T00:00:00.000Z",
        updatedAt: "2026-03-18T00:00:00.000Z",
      }),
    },
  };

  await expect(
    tryRunAuthCommand(["auth", "profile", "get", "local", "--json"], runtimeMock as never),
  ).resolves.toBe(true);
  expect(runtimeMock.configStore.getStoredProfile).toHaveBeenCalledWith("local");
});

test("tryRunAuthCommand dispatches profile delete subcommands", async () => {
  silenceStdout();

  const runtimeMock = {
    configStore: {
      deleteProfile: vi.fn().mockResolvedValue({
        profile: {
          name: "local",
          baseUrl: "https://demo.halo.run",
          auth: { type: "bearer" },
          createdAt: "2026-03-18T00:00:00.000Z",
          updatedAt: "2026-03-18T00:00:00.000Z",
        },
        activeProfile: undefined,
      }),
    },
  };

  await expect(
    tryRunAuthCommand(
      ["auth", "profile", "delete", "local", "--json", "--force"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);
  expect(runtimeMock.configStore.deleteProfile).toHaveBeenCalledWith("local");
});

test("tryRunAuthCommand dispatches profile doctor subcommands", async () => {
  silenceStdout();

  const runtimeMock = {
    configStore: {
      inspectProfileCredentials: vi.fn().mockResolvedValue({
        activeProfile: "local",
        ok: true,
        profiles: [
          {
            name: "local",
            baseUrl: "https://demo.halo.run",
            authType: "bearer",
            status: "ok",
          },
        ],
      }),
    },
  };

  await expect(
    tryRunAuthCommand(["auth", "profile", "doctor", "--json"], runtimeMock as never),
  ).resolves.toBe(true);
  expect(runtimeMock.configStore.inspectProfileCredentials).toHaveBeenCalledOnce();
});

test("tryRunAuthCommand shows help for bare profile subcommands", async () => {
  silenceStdout();

  await expect(tryRunAuthCommand(["auth", "profile"], {} as never)).resolves.toBe(true);
});
