import { afterEach, expect, test, vi } from "vite-plus/test";

import { printBackup, printBackupList } from "../format.js";

afterEach(() => {
  vi.restoreAllMocks();
});

test("printBackupList writes json when requested", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  const list = {
    items: [
      {
        metadata: {
          name: "backup-1",
          creationTimestamp: "2026-03-18T10:15:00.000Z",
        },
        status: {
          phase: "SUCCEEDED",
          size: 2048,
          filename: "backup-1.zip",
        },
      },
    ],
    total: 1,
  };

  printBackupList(list as never, true);

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain('"total": 1');
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain('"name": "backup-1"');
});

test("printBackupList renders key backup fields in table mode", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  Object.defineProperty(process.stdout, "columns", {
    value: 120,
    configurable: true,
  });

  const list = {
    items: [
      {
        metadata: {
          name: "backup-1",
          creationTimestamp: "2026-03-18T10:15:00.000Z",
        },
        status: {
          phase: "SUCCEEDED",
          size: 2048,
          filename: "backup-1.zip",
        },
      },
    ],
    total: 1,
  };

  printBackupList(list as never);

  expect(stdoutSpy).toHaveBeenCalledTimes(2);

  const tableOutput = String(stdoutSpy.mock.calls[0]?.[0]);
  const summaryOutput = String(stdoutSpy.mock.calls[1]?.[0]);

  expect(tableOutput).toContain("NAME");
  expect(tableOutput).toContain("PHASE");
  expect(tableOutput).toContain("SIZE");
  expect(tableOutput).toContain("FILE");
  expect(tableOutput).toContain("CREATED AT");
  expect(tableOutput).toContain("backup-1");
  expect(tableOutput).toContain("SUCCEEDED");
  expect(tableOutput).toContain("backup-1.zip");
  expect(tableOutput).toContain("2026-03-18");
  expect(tableOutput).toMatch(/2(\.0)? KiB/);

  expect(summaryOutput).toContain("1 backup(s)");
});

test("printBackupList leaves size and timestamp blank when missing", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  const list = {
    items: [
      {
        metadata: {
          name: "backup-2",
        },
        status: {
          phase: "PENDING",
          filename: "backup-2.zip",
        },
      },
    ],
    total: 1,
  };

  printBackupList(list as never);

  const tableOutput = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(tableOutput).toContain("backup-2");
  expect(tableOutput).toContain("PENDING");
  expect(tableOutput).toContain("backup-2.zip");
});

test("printBackup renders json when requested", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  const backup = {
    metadata: {
      name: "backup-1",
    },
    spec: {
      format: "zip",
    },
    status: {
      phase: "SUCCEEDED",
    },
  };

  printBackup(backup as never, true);

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain('"name": "backup-1"');
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain('"format": "zip"');
});

test("printBackup renders flattened detail fields in table mode", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  Object.defineProperty(process.stdout, "columns", {
    value: 100,
    configurable: true,
  });

  const backup = {
    metadata: {
      name: "backup-1",
    },
    spec: {
      format: "zip",
      expiresAt: "2026-03-20T10:00:00.000Z",
    },
    status: {
      phase: "SUCCEEDED",
      filename: "backup-1.zip",
    },
  };

  printBackup(backup as never);

  const output = String(stdoutSpy.mock.calls[0]?.[0]);

  expect(output).toContain("FIELD");
  expect(output).toContain("VALUE");
  expect(output).toContain("metadata.name");
  expect(output).toContain("backup-1");
  expect(output).toContain("spec.format");
  expect(output).toContain("zip");
  expect(output).toContain("status.phase");
  expect(output).toContain("SUCCEEDED");
  expect(output).toContain("status.filename");
  expect(output).toContain("backup-1.zip");
});
