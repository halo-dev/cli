import { afterEach, expect, test, vi } from "vitest";

import { printAttachment, printAttachmentList } from "../format.js";

afterEach(() => {
  vi.restoreAllMocks();
});

test("printAttachmentList writes json output when requested", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  printAttachmentList(
    {
      items: [],
      total: 0,
    } as never,
    true,
  );

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain('"items": []');
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain('"total": 0');
});

test("printAttachmentList renders table output with summary", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  Object.defineProperty(process.stdout, "columns", {
    value: 120,
    configurable: true,
  });

  printAttachmentList({
    items: [
      {
        metadata: {
          name: "attachment-1",
        },
        spec: {
          displayName: "image.png",
          size: 2048,
          mediaType: "image/png",
        },
      },
    ],
    total: 1,
  } as never);

  expect(stdoutSpy).toHaveBeenCalledTimes(2);

  const tableOutput = String(stdoutSpy.mock.calls[0]?.[0]);
  const summaryOutput = String(stdoutSpy.mock.calls[1]?.[0]);

  expect(tableOutput).toContain("NAME");
  expect(tableOutput).toContain("DISPLAY NAME");
  expect(tableOutput).toContain("SIZE");
  expect(tableOutput).toContain("MEDIA TYPE");
  expect(tableOutput).toContain("attachment-1");
  expect(tableOutput).toContain("image.png");
  expect(tableOutput).toContain("2 KiB");
  expect(tableOutput).toContain("image/png");
  expect(summaryOutput).toContain("1 attachment(s)");
});

test("printAttachmentList falls back to metadata name when display name is missing", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  printAttachmentList({
    items: [
      {
        metadata: {
          name: "attachment-2",
        },
        spec: {
          size: undefined,
          mediaType: "application/octet-stream",
        },
      },
    ],
    total: 1,
  } as never);

  const tableOutput = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(tableOutput).toContain("attachment-2");
  expect(tableOutput).toContain("application/octet");
});

test("printAttachment writes json output when requested", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  printAttachment(
    {
      metadata: {
        name: "attachment-1",
      },
      spec: {
        displayName: "image.png",
      },
      status: {
        permalink: "https://example.com/image.png",
      },
    } as never,
    true,
  );

  expect(stdoutSpy).toHaveBeenCalledOnce();
  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain('"name": "attachment-1"');
  expect(output).toContain('"permalink": "https://example.com/image.png"');
});

test("printAttachment omits permalink in detail output", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  Object.defineProperty(process.stdout, "columns", {
    value: 100,
    configurable: true,
  });

  printAttachment({
    metadata: {
      name: "attachment-1",
    },
    spec: {
      displayName: "image.png",
    },
    status: {
      permalink: "https://example.com/image.png",
      phase: "READY",
    },
  } as never);

  expect(stdoutSpy).toHaveBeenCalledOnce();
  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain("metadata.name");
  expect(output).toContain("attachment-1");
  expect(output).toContain("status.phase");
  expect(output).toContain("READY");
  expect(output).not.toContain("https://example.com/image.png");
});
