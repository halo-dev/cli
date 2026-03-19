import { afterEach, expect, test, vi } from "vitest";

import { tryRunBackupCommand } from "../index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function silenceStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

test("tryRunBackupCommand returns false for unrelated commands", async () => {
  await expect(tryRunBackupCommand(["attachment"], {} as never)).resolves.toBe(false);
});

test("tryRunBackupCommand shows help for bare backup commands", async () => {
  silenceStdout();

  await expect(tryRunBackupCommand(["backup"], {} as never)).resolves.toBe(true);
});

test("tryRunBackupCommand dispatches list subcommands", async () => {
  silenceStdout();

  const listBackup = vi.fn().mockResolvedValue({
    data: {
      items: [],
      total: 0,
    },
  });
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      profile: {
        baseUrl: "https://example.com",
      },
      clients: {
        axios: {},
      },
    }),
  };

  const { BackupV1alpha1Api } = await import("@halo-dev/api-client");
  vi.spyOn(BackupV1alpha1Api.prototype, "listBackup").mockImplementation(listBackup);

  await expect(
    tryRunBackupCommand(
      ["backup", "list", "--page", "3", "--size", "5", "--json"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(runtimeMock.getClientsForOptions).toHaveBeenCalledOnce();
  expect(listBackup).toHaveBeenCalledWith({
    page: 3,
    size: 5,
  });
});
