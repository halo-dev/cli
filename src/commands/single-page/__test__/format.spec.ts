import { afterEach, expect, test, vi } from "vite-plus/test";

import { printSinglePageList } from "../format.js";

afterEach(() => {
  vi.restoreAllMocks();
});

test("printSinglePageList writes json when requested", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  const list = {
    items: [
      {
        page: {
          metadata: {
            name: "about",
            creationTimestamp: "2026-03-18T10:30:00.000Z",
          },
          spec: {
            title: "About Halo",
            publish: true,
          },
        },
      },
    ],
    total: 1,
  };

  printSinglePageList(list as never, true);

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(stdoutSpy).toHaveBeenCalledWith(`${JSON.stringify(list, null, 2)}\n`);
});

test("printSinglePageList renders table rows and summary in table mode", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  Object.defineProperty(process.stdout, "columns", {
    value: 120,
    configurable: true,
  });

  printSinglePageList({
    items: [
      {
        page: {
          metadata: {
            name: "about",
            creationTimestamp: "2026-03-18T10:30:00.000Z",
          },
          spec: {
            title: "About Halo",
            publish: true,
          },
        },
      },
      {
        page: {
          metadata: {
            name: "contact",
            creationTimestamp: "invalid-date",
          },
          spec: {
            title: "Contact",
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
  expect(tableOutput).toContain("about");
  expect(tableOutput).toContain("About Halo");
  expect(tableOutput).toContain("published");
  expect(tableOutput).toContain("2026-03-18");
  expect(tableOutput).toContain("contact");
  expect(tableOutput).toContain("Contact");
  expect(tableOutput).toContain("draft");
  expect(tableOutput).toContain("invalid-date");
  expect(summaryOutput).toBe("\nShowing 1-2 of 2 single page(s) · page 1 · size 2\n");
});

test("printSinglePageList truncates long titles without breaking the table", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  Object.defineProperty(process.stdout, "columns", {
    value: 90,
    configurable: true,
  });

  printSinglePageList({
    items: [
      {
        page: {
          metadata: {
            name: "about-long-title",
            creationTimestamp: "2026-03-18T10:30:00.000Z",
          },
          spec: {
            title:
              "这是一个非常非常长的单页标题，用来验证在表格宽度有限时会被安全截断而不会破坏命令行输出布局",
            publish: true,
          },
        },
      },
    ],
    total: 1,
  } as never);

  const tableOutput = String(stdoutSpy.mock.calls[0]?.[0]);

  expect(tableOutput).toContain("about-long-title");
  expect(tableOutput).toContain("published");
  expect(tableOutput).toContain("...");
});
