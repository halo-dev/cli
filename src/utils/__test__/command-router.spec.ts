import { afterEach, expect, test, vi } from "vitest";

import { tryRunCommandCliRoute, tryRunNestedCliRoute } from "../command-router.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function createCliMock() {
  return {
    outputHelp: vi.fn(),
    parse: vi.fn(),
    runMatchedCommand: vi.fn().mockResolvedValue(undefined),
  };
}

test("tryRunCommandCliRoute returns false for unrelated commands", async () => {
  const buildCli = vi.fn();

  await expect(
    tryRunCommandCliRoute({
      command: "post",
      cliName: "halo post",
      args: ["theme"],
      buildCli,
    }),
  ).resolves.toBe(false);

  expect(buildCli).not.toHaveBeenCalled();
});

test("tryRunCommandCliRoute shows help for bare commands", async () => {
  const cliMock = createCliMock();

  await expect(
    tryRunCommandCliRoute({
      command: "post",
      cliName: "halo post",
      args: ["post"],
      buildCli: () => cliMock as never,
    }),
  ).resolves.toBe(true);

  expect(cliMock.outputHelp).toHaveBeenCalledOnce();
  expect(cliMock.parse).not.toHaveBeenCalled();
  expect(cliMock.runMatchedCommand).not.toHaveBeenCalled();
});

test("tryRunCommandCliRoute forwards args to parse and runs the matched command", async () => {
  const cliMock = createCliMock();

  await expect(
    tryRunCommandCliRoute({
      command: "post",
      cliName: "halo post",
      args: ["post", "list", "--json"],
      buildCli: () => cliMock as never,
    }),
  ).resolves.toBe(true);

  expect(cliMock.parse).toHaveBeenCalledWith(["node", "halo post", "list", "--json"], {
    run: false,
  });
  expect(cliMock.runMatchedCommand).toHaveBeenCalledOnce();
});

test("tryRunNestedCliRoute returns false for unrelated nested branches", async () => {
  const buildCli = vi.fn();

  await expect(
    tryRunNestedCliRoute({
      branch: "reply",
      cliName: "halo comment reply",
      args: ["comment", "list"],
      buildCli,
    }),
  ).resolves.toBe(false);

  expect(buildCli).not.toHaveBeenCalled();
});

test("tryRunNestedCliRoute shows help for bare nested branches", async () => {
  const cliMock = createCliMock();

  await expect(
    tryRunNestedCliRoute({
      branch: "reply",
      cliName: "halo comment reply",
      args: ["comment", "reply"],
      buildCli: () => cliMock as never,
    }),
  ).resolves.toBe(true);

  expect(cliMock.outputHelp).toHaveBeenCalledOnce();
  expect(cliMock.parse).not.toHaveBeenCalled();
  expect(cliMock.runMatchedCommand).not.toHaveBeenCalled();
});

test("tryRunNestedCliRoute shows help for explicit nested help flags", async () => {
  const cliMock = createCliMock();

  await expect(
    tryRunNestedCliRoute({
      branch: "reply",
      cliName: "halo comment reply",
      args: ["comment", "reply", "--help"],
      buildCli: () => cliMock as never,
    }),
  ).resolves.toBe(true);

  expect(cliMock.outputHelp).toHaveBeenCalledOnce();
  expect(cliMock.parse).not.toHaveBeenCalled();
  expect(cliMock.runMatchedCommand).not.toHaveBeenCalled();
});

test("tryRunNestedCliRoute forwards nested args to parse and runs the matched command", async () => {
  const cliMock = createCliMock();

  await expect(
    tryRunNestedCliRoute({
      branch: "reply",
      cliName: "halo comment reply",
      args: ["comment", "reply", "list", "comment-1", "--json"],
      buildCli: () => cliMock as never,
    }),
  ).resolves.toBe(true);

  expect(cliMock.parse).toHaveBeenCalledWith(
    ["node", "halo comment reply", "list", "comment-1", "--json"],
    { run: false },
  );
  expect(cliMock.runMatchedCommand).toHaveBeenCalledOnce();
});
