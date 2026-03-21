import { afterEach, expect, test, vi } from "vitest";

const promptState = vi.hoisted(() => ({
  input: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
  input: promptState.input,
  confirm: promptState.confirm,
}));

import { normalizeCreateSinglePageInput } from "../input.js";

const originalStdinTty = process.stdin.isTTY;
const originalStdoutTty = process.stdout.isTTY;

afterEach(() => {
  promptState.input.mockReset();
  promptState.confirm.mockReset();
  Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTty, configurable: true });
  Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTty, configurable: true });
});

test("normalizeCreateSinglePageInput does not prompt for non-critical toggles", async () => {
  Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
  Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
  promptState.input.mockResolvedValue("# About Halo");

  await normalizeCreateSinglePageInput({
    title: "About Halo",
    slug: "about-halo",
    content: "# About Halo",
    publish: true,
  });

  expect(promptState.confirm).not.toHaveBeenCalled();
});
