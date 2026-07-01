import { afterEach, expect, test, vi } from "vite-plus/test";

import { printSearchResult } from "../format.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

test("printSearchResult writes json when requested", () => {
  const stdoutSpy = mockStdout();

  const payload = {
    keyword: "halo",
    total: 1,
    hits: [
      {
        metadataName: "post-1",
        title: "Hello Halo",
        type: "post.PublicPost",
        creationTimestamp: "2026-03-18T10:20:00.000Z",
      },
    ],
  };

  printSearchResult(payload as never, true);

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(stdoutSpy).toHaveBeenCalledWith(`${JSON.stringify(payload, null, 2)}\n`);
});

test("printSearchResult writes empty state message when there are no hits", () => {
  const stdoutSpy = mockStdout();

  printSearchResult(
    {
      keyword: "missing",
      total: 0,
      hits: [],
    } as never,
    false,
  );

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(stdoutSpy).toHaveBeenCalledWith('No search results found for "missing".\n');
});

test("printSearchResult renders table output with shortened type and summary", () => {
  const stdoutSpy = mockStdout();

  Object.defineProperty(process.stdout, "columns", {
    value: 120,
    configurable: true,
  });

  printSearchResult(
    {
      keyword: "halo",
      total: 2,
      hits: [
        {
          metadataName: "post-1",
          title: "Hello Halo",
          type: "post.PublicPost",
          creationTimestamp: "2026-03-18T10:20:00.000Z",
        },
        {
          metadataName: "comment-1",
          title:
            "A very long search result title that should be truncated when the terminal width is limited",
          type: "comment.Reply",
          creationTimestamp: "invalid-date",
        },
      ],
    } as never,
    false,
  );

  expect(stdoutSpy).toHaveBeenCalledTimes(2);

  const tableOutput = String(stdoutSpy.mock.calls[0]?.[0]);
  const summaryOutput = String(stdoutSpy.mock.calls[1]?.[0]);

  expect(tableOutput).toContain("NAME");
  expect(tableOutput).toContain("TITLE");
  expect(tableOutput).toContain("TYPE");
  expect(tableOutput).toContain("CREATED AT");
  expect(tableOutput).toContain("post-1");
  expect(tableOutput).toContain("Hello Halo");
  expect(tableOutput).toContain("post");
  expect(tableOutput).toContain("2026-03-18");
  expect(tableOutput).toContain("comment-1");
  expect(tableOutput).toContain("comment");
  expect(tableOutput).toContain("invalid-date");
  expect(summaryOutput).toBe("\n2 result(s)\n");
});

test("printSearchResult falls back to hit count when total is missing", () => {
  const stdoutSpy = mockStdout();

  printSearchResult(
    {
      keyword: "halo",
      hits: [
        {
          metadataName: "post-1",
          title: "Hello Halo",
          type: "post.PublicPost",
          creationTimestamp: undefined,
        },
      ],
    } as never,
    false,
  );

  expect(String(stdoutSpy.mock.calls[1]?.[0])).toBe("\n1 result(s)\n");
});
