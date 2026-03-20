import { afterEach, expect, test, vi } from "vitest";

import { printComment, printCommentList, printReply, printReplyList } from "../format.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

test("printCommentList writes table output for listed comments", () => {
  const stdoutSpy = mockStdout();

  Object.defineProperty(process.stdout, "columns", {
    value: 120,
    configurable: true,
  });

  printCommentList({
    items: [
      {
        owner: {
          displayName: "Halo User",
        },
        comment: {
          metadata: {
            name: "46195e7f-1b26-4e99-a0f9-000000000001",
            creationTimestamp: "2026-03-18T10:20:00.000Z",
          },
          spec: {
            content: "<p>Hello&nbsp;<strong>Halo</strong></p>",
            approved: true,
            hidden: false,
          },
        },
      },
    ],
    total: 1,
  } as never);

  expect(stdoutSpy).toHaveBeenCalledTimes(2);

  const tableOutput = String(stdoutSpy.mock.calls[0]?.[0]);
  const summaryOutput = String(stdoutSpy.mock.calls[1]?.[0]);

  expect(tableOutput).toContain("NAME");
  expect(tableOutput).toContain("OWNER");
  expect(tableOutput).toContain("CONTENT");
  expect(tableOutput).toContain("APPROVED");
  expect(tableOutput).toContain("CREATED AT");
  expect(tableOutput).toContain("46195e7f-1b26-4e99-a0f9-000000000001");
  expect(tableOutput).toContain("Halo User");
  expect(tableOutput).toContain("Hello Halo");
  expect(tableOutput).toContain("yes");
  expect(tableOutput).toContain("2026-03-18");
  expect(summaryOutput).toBe("\nShowing 1-1 of 1 comment(s) · page 1 · size 1\n");
});

test("printCommentList prints json when requested", () => {
  const stdoutSpy = mockStdout();

  const payload = {
    items: [],
    total: 0,
  };

  printCommentList(payload as never, true);

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(stdoutSpy).toHaveBeenCalledWith(`${JSON.stringify(payload, null, 2)}\n`);
});

test("printComment writes detail output with stripped html preview", () => {
  const stdoutSpy = mockStdout();

  printComment(
    {
      metadata: {
        name: "comment-1",
      },
      spec: {
        content: "<p>Hello<br>Halo &amp; Friends</p>",
        approved: true,
        hidden: false,
      },
    } as never,
    false,
  );

  expect(stdoutSpy).toHaveBeenCalledOnce();

  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain("metadata.name");
  expect(output).toContain("comment-1");
  expect(output).toContain("spec.contentPreview");
  expect(output).toContain("Hello Halo & Friends");
});

test("printReplyList supports array input and pluralizes summary", () => {
  const stdoutSpy = mockStdout();

  Object.defineProperty(process.stdout, "columns", {
    value: 120,
    configurable: true,
  });

  printReplyList(
    [
      {
        owner: {
          displayName: "Reply User",
        },
        reply: {
          metadata: {
            name: "reply-1",
            creationTimestamp: "2026-03-18T12:30:00.000Z",
          },
          spec: {
            content: "<p>First reply</p>",
            approved: false,
            hidden: true,
          },
        },
      },
      {
        reply: {
          metadata: {
            name: "reply-2",
            creationTimestamp: "invalid-date",
          },
          spec: {
            owner: {
              displayName: "Fallback Owner",
            },
            content: "<p>Second &lt;reply&gt;</p>",
            approved: true,
            hidden: false,
          },
        },
      },
    ] as never,
    false,
  );

  expect(stdoutSpy).toHaveBeenCalledTimes(2);

  const tableOutput = String(stdoutSpy.mock.calls[0]?.[0]);
  const summaryOutput = String(stdoutSpy.mock.calls[1]?.[0]);

  expect(tableOutput).not.toContain("HIDDEN");
  expect(tableOutput).toContain("reply-1");
  expect(tableOutput).toContain("Reply User");
  expect(tableOutput).toContain("First reply");
  expect(tableOutput).toContain("reply-2");
  expect(tableOutput).toContain("Fallback Owner");
  expect(tableOutput).toContain("Second <reply>");
  expect(tableOutput).toContain("invalid-date");
  expect(summaryOutput).toBe("\n2 replies\n");
});

test("printReply writes detail output with stripped html preview", () => {
  const stdoutSpy = mockStdout();

  printReply(
    {
      metadata: {
        name: "reply-1",
      },
      spec: {
        content: "<p>Reply&nbsp;content</p>",
        approved: true,
        hidden: false,
      },
    } as never,
    false,
  );

  expect(stdoutSpy).toHaveBeenCalledOnce();

  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain("metadata.name");
  expect(output).toContain("reply-1");
  expect(output).toContain("spec.contentPreview");
  expect(output).toContain("Reply content");
});
