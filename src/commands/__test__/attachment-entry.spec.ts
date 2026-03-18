import { afterEach, expect, test, vi } from "vitest";

import { tryRunAttachmentCommand } from "../attachment.js";

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
