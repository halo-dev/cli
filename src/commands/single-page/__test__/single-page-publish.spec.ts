import { expect, test, vi } from "vitest";

import { syncSinglePagePublishState } from "../index.js";

test("syncSinglePagePublishState publishes single pages when requested", async () => {
  const publishSinglePage = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "about" },
      spec: { publish: true },
    },
  });
  const updateSinglePage = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "about" },
      spec: { publish: false },
    },
  });

  const clients = {
    console: {
      content: {
        singlePage: {
          publishSinglePage,
        },
      },
    },
    core: {
      content: {
        singlePage: {
          updateSinglePage,
        },
      },
    },
  };

  const page = {
    metadata: { name: "about" },
    spec: { publish: false },
  };

  const result = await syncSinglePagePublishState(clients as never, page as never, true);

  expect(publishSinglePage).toHaveBeenCalledWith({ name: "about" });
  expect(updateSinglePage).not.toHaveBeenCalled();
  expect(result).toEqual({
    metadata: { name: "about" },
    spec: { publish: true },
  });
});

test("syncSinglePagePublishState unpublishes single pages by updating the resource", async () => {
  const publishSinglePage = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "about" },
      spec: { publish: true },
    },
  });
  const updateSinglePage = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "about" },
      spec: { publish: false },
    },
  });

  const clients = {
    console: {
      content: {
        singlePage: {
          publishSinglePage,
        },
      },
    },
    core: {
      content: {
        singlePage: {
          updateSinglePage,
        },
      },
    },
  };

  const page = {
    metadata: { name: "about" },
    spec: {
      publish: true,
      title: "About",
      slug: "about",
      allowComment: true,
      deleted: false,
      excerpt: { autoGenerate: true },
      pinned: false,
      priority: 0,
      visible: "PUBLIC",
    },
  };

  const result = await syncSinglePagePublishState(clients as never, page as never, false);

  expect(updateSinglePage).toHaveBeenCalledWith({
    name: "about",
    singlePage: {
      ...page,
      spec: {
        ...page.spec,
        publish: false,
      },
    },
  });
  expect(publishSinglePage).not.toHaveBeenCalled();
  expect(result).toEqual({
    metadata: { name: "about" },
    spec: { publish: false },
  });
});

test("syncSinglePagePublishState skips API calls when publish state is unchanged", async () => {
  const publishSinglePage = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "about" },
      spec: { publish: true },
    },
  });
  const updateSinglePage = vi.fn().mockResolvedValue({
    data: {
      metadata: { name: "about" },
      spec: { publish: false },
    },
  });

  const clients = {
    console: {
      content: {
        singlePage: {
          publishSinglePage,
        },
      },
    },
    core: {
      content: {
        singlePage: {
          updateSinglePage,
        },
      },
    },
  };

  const page = {
    metadata: { name: "about" },
    spec: { publish: false },
  };

  const result = await syncSinglePagePublishState(clients as never, page as never, undefined);

  expect(publishSinglePage).not.toHaveBeenCalled();
  expect(updateSinglePage).not.toHaveBeenCalled();
  expect(result).toBe(page);
});
