import { afterEach, expect, test, vi } from "vitest";

import { tryRunCommentCommand } from "../comment.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function silenceStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

test("tryRunCommentCommand returns false for unrelated commands", async () => {
  await expect(tryRunCommentCommand(["moment"], {} as never)).resolves.toBe(false);
});

test("tryRunCommentCommand shows help for bare comment commands", async () => {
  silenceStdout();

  await expect(tryRunCommentCommand(["comment"], {} as never)).resolves.toBe(true);
});

test("tryRunCommentCommand dispatches comment list subcommands", async () => {
  silenceStdout();

  const listComments = vi.fn().mockResolvedValue({
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

  const { CommentV1alpha1ConsoleApi } = await import("@halo-dev/api-client");
  vi.spyOn(CommentV1alpha1ConsoleApi.prototype, "listComments").mockImplementation(listComments);

  await expect(
    tryRunCommentCommand(
      [
        "comment",
        "list",
        "--page",
        "1",
        "--size",
        "20",
        "--approved",
        "false",
        "--sort",
        "metadata.creationTimestamp,desc",
        "--json",
      ],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(runtimeMock.getClientsForOptions).toHaveBeenCalledOnce();
  expect(listComments).toHaveBeenCalledWith({
    page: 1,
    size: 20,
    keyword: undefined,
    ownerKind: undefined,
    ownerName: undefined,
    fieldSelector: ["spec.approved=false"],
    sort: ["metadata.creationTimestamp,desc"],
  });
});

test("tryRunCommentCommand dispatches reply list subcommands", async () => {
  silenceStdout();

  const listReplies = vi.fn().mockResolvedValue({
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

  const { ReplyV1alpha1ConsoleApi } = await import("@halo-dev/api-client");
  vi.spyOn(ReplyV1alpha1ConsoleApi.prototype, "listReplies").mockImplementation(listReplies);

  await expect(
    tryRunCommentCommand(
      ["comment", "reply", "list", "comment-1", "--page", "2", "--size", "10", "--json"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(runtimeMock.getClientsForOptions).toHaveBeenCalledOnce();
  expect(listReplies).toHaveBeenCalledWith({
    commentName: "comment-1",
    page: 2,
    size: 10,
  });
});

test("tryRunCommentCommand shows help for bare reply subcommands", async () => {
  silenceStdout();

  await expect(tryRunCommentCommand(["comment", "reply"], {} as never)).resolves.toBe(true);
});
