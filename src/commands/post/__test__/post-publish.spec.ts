import { expect, test, vi } from "vitest";

import { syncPostPublishState } from "../index.js";

test("syncPostPublishState publishes posts when requested", async () => {
  const consolePostApiMock = {
    publishPost: vi.fn().mockResolvedValue(undefined),
    unpublishPost: vi.fn().mockResolvedValue(undefined),
  };

  await syncPostPublishState(consolePostApiMock as never, "post-1", true);

  expect(consolePostApiMock.publishPost).toHaveBeenCalledWith({ name: "post-1" });
  expect(consolePostApiMock.unpublishPost).not.toHaveBeenCalled();
});

test("syncPostPublishState unpublishes posts when requested", async () => {
  const consolePostApiMock = {
    publishPost: vi.fn().mockResolvedValue(undefined),
    unpublishPost: vi.fn().mockResolvedValue(undefined),
  };

  await syncPostPublishState(consolePostApiMock as never, "post-1", false);

  expect(consolePostApiMock.unpublishPost).toHaveBeenCalledWith({ name: "post-1" });
  expect(consolePostApiMock.publishPost).not.toHaveBeenCalled();
});

test("syncPostPublishState skips API calls when publish state is unchanged", async () => {
  const consolePostApiMock = {
    publishPost: vi.fn().mockResolvedValue(undefined),
    unpublishPost: vi.fn().mockResolvedValue(undefined),
  };

  await syncPostPublishState(consolePostApiMock as never, "post-1", undefined);

  expect(consolePostApiMock.publishPost).not.toHaveBeenCalled();
  expect(consolePostApiMock.unpublishPost).not.toHaveBeenCalled();
});
