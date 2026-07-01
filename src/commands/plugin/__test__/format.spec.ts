import { afterEach, expect, test, vi } from "vite-plus/test";

import { printPlugin, printPluginList } from "../format.js";

afterEach(() => {
  vi.restoreAllMocks();
});

test("printPluginList writes JSON when json mode is enabled", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  printPluginList(
    [
      {
        metadata: {
          name: "demo-plugin",
        },
        spec: {
          displayName: "Demo Plugin",
          version: "1.0.0",
        },
        status: {
          phase: "STARTED",
        },
      } as never,
    ],
    true,
  );

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain('"name": "demo-plugin"');
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain('"displayName": "Demo Plugin"');
});

test("printPluginList renders plugin rows and update information in table mode", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  Object.defineProperty(process.stdout, "columns", {
    value: 120,
    configurable: true,
  });

  printPluginList(
    [
      {
        metadata: {
          name: "demo-plugin",
        },
        spec: {
          displayName: "Demo Plugin",
          version: "1.0.0",
        },
        status: {
          phase: "STARTED",
        },
      } as never,
      {
        metadata: {
          name: "legacy-plugin",
        },
        spec: {
          displayName: "Legacy Plugin",
          version: "0.9.0",
        },
        status: {
          phase: "STOPPED",
        },
      } as never,
    ],
    false,
    new Map([
      [
        "demo-plugin",
        {
          latestVersion: "1.1.0",
          compatible: true,
        },
      ],
      [
        "legacy-plugin",
        {
          latestVersion: "2.0.0",
          compatible: false,
        },
      ],
    ]),
  );

  expect(stdoutSpy).toHaveBeenCalledTimes(2);

  const tableOutput = String(stdoutSpy.mock.calls[0]?.[0]);
  const summaryOutput = String(stdoutSpy.mock.calls[1]?.[0]);

  expect(tableOutput).toContain("NAME");
  expect(tableOutput).toContain("DISPLAY NAME");
  expect(tableOutput).toContain("VERSION");
  expect(tableOutput).toContain("UPDATE");
  expect(tableOutput).toContain("PHASE");
  expect(tableOutput).toContain("demo-plugin");
  expect(tableOutput).toContain("Demo Plugin");
  expect(tableOutput).toContain("1.0.0");
  expect(tableOutput).toContain("1.1.0");
  expect(tableOutput).toContain("STARTED");
  expect(tableOutput).toContain("legacy-plugin");
  expect(tableOutput).toContain("Legacy Plugin");
  expect(tableOutput).toContain("2.0.0 !compat");
  expect(tableOutput).toContain("STOPPED");
  expect(summaryOutput).toBe("\n2 plugin(s)\n");
});

test("printPlugin renders JSON when json mode is enabled", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  printPlugin(
    {
      metadata: {
        name: "demo-plugin",
      },
      spec: {
        displayName: "Demo Plugin",
        version: "1.0.0",
      },
      status: {
        phase: "STARTED",
      },
    } as never,
    true,
  );

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain('"name": "demo-plugin"');
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain('"phase": "STARTED"');
});

test("printPlugin renders detail output in table mode", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  Object.defineProperty(process.stdout, "columns", {
    value: 100,
    configurable: true,
  });

  printPlugin({
    metadata: {
      name: "demo-plugin",
    },
    spec: {
      displayName: "Demo Plugin",
      version: "1.0.0",
    },
    status: {
      phase: "STARTED",
    },
  } as never);

  expect(stdoutSpy).toHaveBeenCalledOnce();

  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain("FIELD");
  expect(output).toContain("VALUE");
  expect(output).toContain("metadata.name");
  expect(output).toContain("demo-plugin");
  expect(output).toContain("spec.displayName");
  expect(output).toContain("Demo Plugin");
  expect(output).toContain("spec.version");
  expect(output).toContain("1.0.0");
  expect(output).toContain("status.phase");
  expect(output).toContain("STARTED");
});
