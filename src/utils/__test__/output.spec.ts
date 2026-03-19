import { afterEach, expect, test, vi } from "vitest";

import { printDetailObject, printExecutionTarget, printJson } from "../output.js";

afterEach(() => {
  vi.restoreAllMocks();
});

test("printJson writes formatted JSON followed by a newline", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  printJson({
    name: "halo",
    nested: {
      enabled: true,
    },
  });

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(stdoutSpy).toHaveBeenCalledWith(
    `${JSON.stringify(
      {
        name: "halo",
        nested: {
          enabled: true,
        },
      },
      null,
      2,
    )}\n`,
  );
});

test("printExecutionTarget prints nothing in json mode", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  printExecutionTarget(
    {
      profileName: "local",
      baseUrl: "https://demo.halo.run",
    },
    true,
  );

  expect(stdoutSpy).not.toHaveBeenCalled();
});

test("printExecutionTarget prints profile and base url in table mode", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  printExecutionTarget({
    profileName: "local",
    baseUrl: "https://demo.halo.run",
  });

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain("TARGET");
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain("profile");
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain("local");
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain("https://demo.halo.run");
});

test("printExecutionTarget prints url label when no profile name is available", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  printExecutionTarget({
    baseUrl: "https://demo.halo.run",
  });

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain("TARGET");
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain("url");
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain("https://demo.halo.run");
});

test("printDetailObject flattens nested values into table output", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  Object.defineProperty(process.stdout, "columns", {
    value: 100,
    configurable: true,
  });

  printDetailObject({
    metadata: {
      name: "demo-post",
      labels: {
        app: "halo",
      },
    },
    spec: {
      published: true,
      tags: ["news", "cli"],
      visits: 3,
      extra: null,
    },
  });

  expect(stdoutSpy).toHaveBeenCalledOnce();

  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain("FIELD");
  expect(output).toContain("VALUE");
  expect(output).toContain("metadata.name");
  expect(output).toContain("demo-post");
  expect(output).toContain("metadata.labels.app");
  expect(output).toContain("halo");
  expect(output).toContain("spec.published");
  expect(output).toContain("true");
  expect(output).toContain("spec.tags");
  expect(output).toContain("news, cli");
  expect(output).toContain("spec.visits");
  expect(output).toContain("3");
  expect(output).toContain("spec.extra");
  expect(output).toContain("null");
});

test("printDetailObject renders empty nested objects as braces", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  printDetailObject({
    status: {},
  });

  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain("status");
  expect(output).toContain("{}");
});
