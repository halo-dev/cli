import { afterEach, expect, test, vi } from "vitest";

import { printPostList } from "../format.js";

afterEach(() => {
  vi.restoreAllMocks();
});

test("printPostList writes json when requested", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  const list = {
    items: [
      {
        post: {
          metadata: {
            name: "post-1",
            creationTimestamp: "2026-03-18T10:30:00.000Z",
          },
          spec: {
            title: "Hello Halo",
            publish: true,
          },
        },
      },
    ],
    total: 1,
  };

  printPostList(list as never, true);

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(stdoutSpy).toHaveBeenCalledWith(`${JSON.stringify(list, null, 2)}\n`);
});

test("printPostList renders table rows and summary in table mode", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  Object.defineProperty(process.stdout, "columns", {
    value: 120,
    configurable: true,
  });

  printPostList({
    items: [
      {
        post: {
          metadata: {
            name: "post-1",
            creationTimestamp: "2026-03-18T10:30:00.000Z",
          },
          spec: {
            title: "Hello Halo",
            publish: true,
          },
        },
      },
      {
        post: {
          metadata: {
            name: "post-2",
            creationTimestamp: "invalid-date",
          },
          spec: {
            title: "Draft Post",
            publish: false,
          },
        },
      },
    ],
    total: 2,
  } as never);

  expect(stdoutSpy).toHaveBeenCalledTimes(2);

  const tableOutput = String(stdoutSpy.mock.calls[0]?.[0]);
  const summaryOutput = String(stdoutSpy.mock.calls[1]?.[0]);

  expect(tableOutput).toContain("NAME");
  expect(tableOutput).toContain("TITLE");
  expect(tableOutput).toContain("STATE");
  expect(tableOutput).toContain("CREATED AT");
  expect(tableOutput).toContain("post-1");
  expect(tableOutput).toContain("Hello Halo");
  expect(tableOutput).toContain("published");
  expect(tableOutput).toContain("2026-03-18");
  expect(tableOutput).toContain("post-2");
  expect(tableOutput).toContain("Draft Post");
  expect(tableOutput).toContain("draft");
  expect(tableOutput).toContain("invalid-date");
  expect(summaryOutput).toBe("\nShowing 1-2 of 2 post(s) · page 1 · size 2\n");
});

test("printPostList truncates long titles without breaking the table", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  Object.defineProperty(process.stdout, "columns", {
    value: 90,
    configurable: true,
  });

  printPostList({
    items: [
      {
        post: {
          metadata: {
            name: "post-long-title",
            creationTimestamp: "2026-03-18T10:30:00.000Z",
          },
          spec: {
            title:
              "这是一篇标题非常非常长的文章，用来验证在表格宽度有限时会被安全截断而不是破坏输出布局",
            publish: true,
          },
        },
      },
    ],
    total: 1,
  } as never);

  const tableOutput = String(stdoutSpy.mock.calls[0]?.[0]);

  expect(tableOutput).toContain("post-long-title");
  expect(tableOutput).toContain("published");
  expect(tableOutput).toContain("...");
});
