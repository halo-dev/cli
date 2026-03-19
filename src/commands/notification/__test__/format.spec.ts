import { afterEach, expect, test, vi } from "vitest";

import { printNotification, printNotificationList } from "../format.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

test("printNotificationList writes JSON when json mode is enabled", () => {
  const stdoutSpy = mockStdout();

  const payload = {
    items: [],
    total: 0,
  };

  printNotificationList(payload as never, true);

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(stdoutSpy).toHaveBeenCalledWith(`${JSON.stringify(payload, null, 2)}\n`);
});

test("printNotificationList renders notification rows in table mode", () => {
  const stdoutSpy = mockStdout();

  Object.defineProperty(process.stdout, "columns", {
    value: 120,
    configurable: true,
  });

  printNotificationList({
    items: [
      {
        metadata: {
          name: "notification-1",
          creationTimestamp: "2026-03-18T10:30:00.000Z",
        },
        spec: {
          title: "A very important notification",
          unread: true,
        },
      },
      {
        metadata: {
          name: "notification-2",
          creationTimestamp: "invalid-date",
        },
        spec: {
          unread: false,
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
  expect(tableOutput).toContain("UNREAD");
  expect(tableOutput).toContain("CREATED AT");
  expect(tableOutput).toContain("notification-1");
  expect(tableOutput).toContain("A very important notification");
  expect(tableOutput).toContain("yes");
  expect(tableOutput).toContain("notification-2");
  expect(tableOutput).toContain("no");
  expect(tableOutput).toContain("invalid-date");
  expect(summaryOutput).toBe("\n2 notification(s)\n");
});

test("printNotificationList falls back to metadata name when title is missing", () => {
  const stdoutSpy = mockStdout();

  printNotificationList({
    items: [
      {
        metadata: {
          name: "notification-3",
        },
        spec: {
          unread: false,
        },
      },
    ],
    total: 1,
  } as never);

  const tableOutput = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(tableOutput).toContain("notification-3");
});

test("printNotification writes JSON when json mode is enabled", () => {
  const stdoutSpy = mockStdout();

  printNotification(
    {
      metadata: {
        name: "notification-1",
      },
      spec: {
        title: "Notification Title",
        rawContent: "Plain notification content",
        unread: true,
      },
    } as never,
    true,
  );

  expect(stdoutSpy).toHaveBeenCalledOnce();
  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain('"name": "notification-1"');
  expect(output).toContain('"rawContent": "Plain notification content"');
});

test("printNotification prefers raw content for detail preview output", () => {
  const stdoutSpy = mockStdout();

  printNotification({
    metadata: {
      name: "notification-1",
    },
    spec: {
      title: "Notification Title",
      rawContent: "Plain notification content",
      htmlContent: "<p>Ignored <strong>HTML</strong></p>",
      unread: true,
    },
  } as never);

  expect(stdoutSpy).toHaveBeenCalledOnce();

  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain("metadata.name");
  expect(output).toContain("notification-1");
  expect(output).toContain("spec.contentPreview");
  expect(output).toContain("Plain notification content");
  expect(output).not.toContain("Ignored HTML");
});

test("printNotification falls back to stripped HTML when raw content is missing", () => {
  const stdoutSpy = mockStdout();

  printNotification({
    metadata: {
      name: "notification-2",
    },
    spec: {
      title: "HTML Notification",
      htmlContent: "<p>Hello&nbsp;<strong>Halo</strong> &amp; Friends</p>",
      unread: false,
    },
  } as never);

  expect(stdoutSpy).toHaveBeenCalledOnce();

  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain("spec.contentPreview");
  expect(output).toContain("Hello Halo & Friends");
});
