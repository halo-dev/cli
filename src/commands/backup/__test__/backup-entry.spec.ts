import { afterEach, expect, test, vi } from "vite-plus/test";

import { tryRunBackupCommand } from "../index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function silenceStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

function createRuntimeMock() {
  return {
    getClientsForOptions: vi.fn().mockResolvedValue({
      profile: {
        baseUrl: "https://example.com",
      },
      clients: {
        axios: {},
      },
    }),
  };
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
  const runtimeMock = createRuntimeMock();

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

test("tryRunBackupCommand dispatches get subcommands", async () => {
  silenceStdout();

  const getBackup = vi.fn().mockResolvedValue({
    data: {
      metadata: {
        name: "backup-1",
      },
      spec: {
        format: "zip",
      },
      status: {
        phase: "SUCCEEDED",
      },
    },
  });
  const runtimeMock = createRuntimeMock();

  const { BackupV1alpha1Api } = await import("@halo-dev/api-client");
  vi.spyOn(BackupV1alpha1Api.prototype, "getBackup").mockImplementation(getBackup);

  await expect(
    tryRunBackupCommand(["backup", "get", "backup-1", "--json"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(runtimeMock.getClientsForOptions).toHaveBeenCalledOnce();
  expect(getBackup).toHaveBeenCalledWith({
    name: "backup-1",
  });
});

test("tryRunBackupCommand dispatches create subcommands", async () => {
  silenceStdout();

  const createBackup = vi.fn().mockResolvedValue({
    data: {
      metadata: {
        name: "backup-1",
      },
      spec: {
        format: "zip",
      },
      status: {
        phase: "PENDING",
      },
    },
  });
  const runtimeMock = createRuntimeMock();

  const { BackupV1alpha1Api } = await import("@halo-dev/api-client");
  vi.spyOn(BackupV1alpha1Api.prototype, "createBackup").mockImplementation(createBackup);

  await expect(
    tryRunBackupCommand(
      ["backup", "create", "backup-1", "--format", "zip", "--json"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(runtimeMock.getClientsForOptions).toHaveBeenCalledOnce();
  expect(createBackup).toHaveBeenCalledWith({
    backup: {
      apiVersion: "migration.halo.run/v1alpha1",
      kind: "Backup",
      metadata: {
        name: "backup-1",
        generateName: undefined,
      },
      spec: {
        format: "zip",
        expiresAt: undefined,
      },
    },
  });
});

test("tryRunBackupCommand dispatches delete subcommands", async () => {
  silenceStdout();

  const deleteBackup = vi.fn().mockResolvedValue({});
  const runtimeMock = createRuntimeMock();

  const { BackupV1alpha1Api } = await import("@halo-dev/api-client");
  vi.spyOn(BackupV1alpha1Api.prototype, "deleteBackup").mockImplementation(deleteBackup);

  await expect(
    tryRunBackupCommand(
      ["backup", "delete", "backup-1", "--json", "--force"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(runtimeMock.getClientsForOptions).toHaveBeenCalledOnce();
  expect(deleteBackup).toHaveBeenCalledWith({
    name: "backup-1",
  });
});
