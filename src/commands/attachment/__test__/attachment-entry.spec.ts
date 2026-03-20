import { afterEach, expect, test, vi } from "vitest";

import { tryRunAttachmentCommand } from "../index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function silenceStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

test("tryRunAttachmentCommand returns false for unrelated commands", async () => {
  await expect(tryRunAttachmentCommand(["backup"], {} as never)).resolves.toBe(false);
});

test("tryRunAttachmentCommand shows help for bare attachment commands", async () => {
  silenceStdout();

  await expect(tryRunAttachmentCommand(["attachment"], {} as never)).resolves.toBe(true);
});

test("tryRunAttachmentCommand dispatches list subcommands", async () => {
  silenceStdout();

  const searchAttachments = vi.fn().mockResolvedValue({
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

  vi.mocked(runtimeMock.getClientsForOptions);

  const { AttachmentV1alpha1ConsoleApi } = await import("@halo-dev/api-client");
  vi.spyOn(AttachmentV1alpha1ConsoleApi.prototype, "searchAttachments").mockImplementation(
    searchAttachments,
  );

  await expect(
    tryRunAttachmentCommand(
      ["attachment", "list", "--page", "2", "--size", "10", "--keyword", "halo", "--json"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(runtimeMock.getClientsForOptions).toHaveBeenCalledOnce();
  expect(searchAttachments).toHaveBeenCalledWith({
    page: 2,
    size: 10,
    keyword: "halo",
  });
});

test("tryRunAttachmentCommand dispatches get subcommands", async () => {
  silenceStdout();

  const getAttachment = vi.fn().mockResolvedValue({
    data: {
      metadata: {
        name: "attachment-1",
      },
      spec: {
        displayName: "image.png",
      },
      status: {
        permalink: "https://example.com/image.png",
      },
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

  const { AttachmentV1alpha1Api } = await import("@halo-dev/api-client");
  vi.spyOn(AttachmentV1alpha1Api.prototype, "getAttachment").mockImplementation(getAttachment);

  await expect(
    tryRunAttachmentCommand(["attachment", "get", "attachment-1", "--json"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(runtimeMock.getClientsForOptions).toHaveBeenCalledOnce();
  expect(getAttachment).toHaveBeenCalledWith({
    name: "attachment-1",
  });
});

test("tryRunAttachmentCommand dispatches upload subcommands from urls", async () => {
  silenceStdout();

  const uploadAttachmentForConsole = vi.fn().mockResolvedValue({
    data: {
      metadata: {
        name: "attachment-1",
      },
      spec: {
        displayName: "image.png",
      },
      status: {
        permalink: "https://example.com/image.png",
      },
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

  const { AttachmentV1alpha1ConsoleApi } = await import("@halo-dev/api-client");
  vi.spyOn(AttachmentV1alpha1ConsoleApi.prototype, "uploadAttachmentForConsole").mockImplementation(
    uploadAttachmentForConsole,
  );

  await expect(
    tryRunAttachmentCommand(
      ["attachment", "upload", "--url", "https://example.com/image.png", "--json"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(runtimeMock.getClientsForOptions).toHaveBeenCalledOnce();
  expect(uploadAttachmentForConsole).toHaveBeenCalledWith({
    url: "https://example.com/image.png",
    filename: "image.png",
  });
});

test("tryRunAttachmentCommand infers media type for local file uploads", async () => {
  silenceStdout();

  const uploadAttachmentForConsole = vi.fn().mockResolvedValue({
    data: {
      metadata: {
        name: "attachment-1",
      },
      spec: {
        displayName: "image.png",
      },
      status: {
        permalink: "https://example.com/image.png",
      },
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

  const { AttachmentV1alpha1ConsoleApi } = await import("@halo-dev/api-client");
  vi.spyOn(AttachmentV1alpha1ConsoleApi.prototype, "uploadAttachmentForConsole").mockImplementation(
    uploadAttachmentForConsole,
  );

  const fsPromises = await import("node:fs/promises");
  const tempFilePath = "/tmp/halo-cli-attachment-upload-image.png";
  await fsPromises.writeFile(tempFilePath, Buffer.from("png"));

  try {
    await expect(
      tryRunAttachmentCommand(
        ["attachment", "upload", "--file", tempFilePath, "--json"],
        runtimeMock as never,
      ),
    ).resolves.toBe(true);
  } finally {
    await fsPromises.unlink(tempFilePath).catch(() => undefined);
  }

  expect(runtimeMock.getClientsForOptions).toHaveBeenCalledOnce();
  expect(uploadAttachmentForConsole).toHaveBeenCalledOnce();
  expect(uploadAttachmentForConsole.mock.calls[0]?.[0]).toMatchObject({
    file: expect.objectContaining({
      name: "halo-cli-attachment-upload-image.png",
      type: "image/png",
    }),
  });
});

test("tryRunAttachmentCommand dispatches delete subcommands", async () => {
  silenceStdout();

  const deleteAttachment = vi.fn().mockResolvedValue({});
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

  const { AttachmentV1alpha1Api } = await import("@halo-dev/api-client");
  vi.spyOn(AttachmentV1alpha1Api.prototype, "deleteAttachment").mockImplementation(
    deleteAttachment,
  );

  await expect(
    tryRunAttachmentCommand(
      ["attachment", "delete", "attachment-1", "--json", "--force"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(runtimeMock.getClientsForOptions).toHaveBeenCalledOnce();
  expect(deleteAttachment).toHaveBeenCalledWith({
    name: "attachment-1",
  });
});
