import { afterEach, expect, test, vi } from "vitest";

const promptState = vi.hoisted(() => ({
  input: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
  input: promptState.input,
  confirm: promptState.confirm,
}));

import { normalizeCreatePostInput } from "../input.js";

const originalStdinTty = process.stdin.isTTY;
const originalStdoutTty = process.stdout.isTTY;

afterEach(() => {
  promptState.input.mockReset();
  promptState.confirm.mockReset();
  Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTty, configurable: true });
  Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTty, configurable: true });
});

test("normalizeCreatePostInput skips prompting for content when content is already provided", async () => {
  Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
  Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });

  await normalizeCreatePostInput({
    title: "Hello World",
    slug: "hello-world",
    content: "# Hello World",
    publish: true,
  });

  expect(promptState.input).not.toHaveBeenCalledWith(
    expect.objectContaining({ message: "Post content" }),
  );
  expect(promptState.confirm).not.toHaveBeenCalled();
});
