import { afterEach, expect, test, vi } from "vite-plus/test";

vi.mock("@inquirer/prompts", () => ({
  confirm: vi.fn(),
}));

import { confirm } from "@inquirer/prompts";

import { confirmDangerousAction } from "../confirmation.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const deletePostConfig = {
  commandPath: "halo post delete",
  actionLabel: "Delete",
  resourceLabel: "post",
  resourceName: "post-1",
  cancellationVerb: "deleting",
} as const;

test("confirmDangerousAction skips prompting with --force", async () => {
  await expect(confirmDangerousAction(deletePostConfig, { force: true })).resolves.toBe(true);
});

test("confirmDangerousAction requires --force outside interactive terminals", async () => {
  Object.defineProperty(process.stdin, "isTTY", {
    value: false,
    configurable: true,
  });
  Object.defineProperty(process.stdout, "isTTY", {
    value: false,
    configurable: true,
  });

  await expect(confirmDangerousAction(deletePostConfig, {})).rejects.toThrow(
    /requires confirmation in interactive mode or use --force/i,
  );
});

test("confirmDangerousAction returns false and prints cancellation in text mode", async () => {
  Object.defineProperty(process.stdin, "isTTY", {
    value: true,
    configurable: true,
  });
  Object.defineProperty(process.stdout, "isTTY", {
    value: true,
    configurable: true,
  });

  vi.mocked(confirm).mockResolvedValue(false);
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  await expect(confirmDangerousAction(deletePostConfig, {})).resolves.toBe(false);

  expect(stdoutSpy).toHaveBeenCalledWith("Cancelled deleting post post-1.\n");
});

test("confirmDangerousAction returns false and prints cancellation json in json mode", async () => {
  Object.defineProperty(process.stdin, "isTTY", {
    value: true,
    configurable: true,
  });
  Object.defineProperty(process.stdout, "isTTY", {
    value: true,
    configurable: true,
  });

  vi.mocked(confirm).mockResolvedValue(false);
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  await expect(confirmDangerousAction(deletePostConfig, { json: true })).resolves.toBe(false);

  expect(stdoutSpy).toHaveBeenCalledWith('{\n  "name": "post-1",\n  "cancelled": true\n}\n');
});
