import { afterEach, expect, test, vi } from "vitest";

vi.mock("@inquirer/prompts", () => ({
  confirm: vi.fn(),
}));

import { confirm } from "@inquirer/prompts";

import { tryRunCommentCommand } from "../index.js";

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

test("tryRunCommentCommand dispatches reply get subcommands", async () => {
  silenceStdout();

  const getReply = vi.fn().mockResolvedValue({
    data: {
      metadata: {
        name: "reply-1",
      },
      spec: {
        content: "<p>Hello</p>",
        approved: true,
        hidden: false,
      },
    },
  });
  const runtimeMock = createRuntimeMock();

  const { ReplyV1alpha1Api } = await import("@halo-dev/api-client");
  vi.spyOn(ReplyV1alpha1Api.prototype, "getReply").mockImplementation(getReply);

  await expect(
    tryRunCommentCommand(["comment", "reply", "get", "reply-1", "--json"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(runtimeMock.getClientsForOptions).toHaveBeenCalledOnce();
  expect(getReply).toHaveBeenCalledWith({ name: "reply-1" });
});

test("tryRunCommentCommand dispatches reply approve subcommands", async () => {
  silenceStdout();

  const patchReply = vi.fn().mockResolvedValue({
    data: {
      metadata: {
        name: "reply-1",
      },
      spec: {
        content: "<p>Hello</p>",
        approved: true,
        hidden: false,
      },
    },
  });
  const runtimeMock = createRuntimeMock();

  const { ReplyV1alpha1Api } = await import("@halo-dev/api-client");
  vi.spyOn(ReplyV1alpha1Api.prototype, "patchReply").mockImplementation(patchReply);

  await expect(
    tryRunCommentCommand(
      ["comment", "reply", "approve", "reply-1", "--json"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(runtimeMock.getClientsForOptions).toHaveBeenCalledOnce();

  const firstCall = patchReply.mock.calls[0]?.[0] as {
    name: string;
    jsonPatchInner: Array<{ op: string; path: string; value?: unknown }>;
  };

  expect(firstCall.name).toBe("reply-1");
  expect(firstCall.jsonPatchInner).toHaveLength(2);
  expect(firstCall.jsonPatchInner[0]).toEqual({
    op: "add",
    path: "/spec/approved",
    value: true,
  });
  expect(firstCall.jsonPatchInner[1]?.op).toBe("add");
  expect(firstCall.jsonPatchInner[1]?.path).toBe("/spec/approvedTime");
  expect(typeof firstCall.jsonPatchInner[1]?.value).toBe("string");
  expect(Date.parse(String(firstCall.jsonPatchInner[1]?.value))).not.toBeNaN();
});

test("tryRunCommentCommand dispatches reply delete subcommands with --force", async () => {
  silenceStdout();

  const deleteReply = vi.fn().mockResolvedValue({});
  const runtimeMock = createRuntimeMock();

  const { ReplyV1alpha1Api } = await import("@halo-dev/api-client");
  vi.spyOn(ReplyV1alpha1Api.prototype, "deleteReply").mockImplementation(deleteReply);

  await expect(
    tryRunCommentCommand(
      ["comment", "reply", "delete", "reply-1", "--json", "--force"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(runtimeMock.getClientsForOptions).toHaveBeenCalledOnce();
  expect(deleteReply).toHaveBeenCalledWith({ name: "reply-1" });
});

test("tryRunCommentCommand cancels reply delete subcommands when user declines", async () => {
  const stdoutSpy = silenceStdout();

  Object.defineProperty(process.stdin, "isTTY", {
    value: true,
    configurable: true,
  });
  Object.defineProperty(process.stdout, "isTTY", {
    value: true,
    configurable: true,
  });

  vi.mocked(confirm).mockResolvedValue(false);

  const deleteReply = vi.fn().mockResolvedValue({});
  const runtimeMock = createRuntimeMock();

  const { ReplyV1alpha1Api } = await import("@halo-dev/api-client");
  vi.spyOn(ReplyV1alpha1Api.prototype, "deleteReply").mockImplementation(deleteReply);

  await expect(
    tryRunCommentCommand(["comment", "reply", "delete", "reply-1"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(runtimeMock.getClientsForOptions).toHaveBeenCalledOnce();
  expect(deleteReply).not.toHaveBeenCalled();
  expect(stdoutSpy).toHaveBeenCalledWith("Cancelled deleting reply reply-1.\n");
});
