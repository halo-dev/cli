import { expect, test, vi } from "vitest";

import { syncPostPublishState } from "../post.js";

test("syncPostPublishState publishes posts when requested", async () => {
  const ucPostApiMock = {
    publishMyPost: vi.fn().mockResolvedValue(undefined),
    unpublishMyPost: vi.fn().mockResolvedValue(undefined),
  };

  await syncPostPublishState(ucPostApiMock as never, "post-1", true);

  expect(ucPostApiMock.publishMyPost).toHaveBeenCalledWith({ name: "post-1" });
  expect(ucPostApiMock.unpublishMyPost).not.toHaveBeenCalled();
});

test("syncPostPublishState unpublishes posts when requested", async () => {
  const ucPostApiMock = {
    publishMyPost: vi.fn().mockResolvedValue(undefined),
    unpublishMyPost: vi.fn().mockResolvedValue(undefined),
  };

  await syncPostPublishState(ucPostApiMock as never, "post-1", false);

  expect(ucPostApiMock.unpublishMyPost).toHaveBeenCalledWith({ name: "post-1" });
  expect(ucPostApiMock.publishMyPost).not.toHaveBeenCalled();
});

test("syncPostPublishState skips API calls when publish state is unchanged", async () => {
  const ucPostApiMock = {
    publishMyPost: vi.fn().mockResolvedValue(undefined),
    unpublishMyPost: vi.fn().mockResolvedValue(undefined),
  };

  await syncPostPublishState(ucPostApiMock as never, "post-1", undefined);

  expect(ucPostApiMock.publishMyPost).not.toHaveBeenCalled();
  expect(ucPostApiMock.unpublishMyPost).not.toHaveBeenCalled();
});
