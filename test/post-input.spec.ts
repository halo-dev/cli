import { expect, test } from "vitest";

import { normalizeCreatePostInput, normalizeUpdatePostInput } from "../src/utils/post-input.js";

test("normalizeCreatePostInput builds a complete PostRequest", async () => {
  const request = await normalizeCreatePostInput({
    name: "hello-world",
    title: "Hello World",
    slug: "hello-world",
    content: "# Hello World",
    excerpt: "short summary",
    publish: true,
    allowComment: true,
    pinned: false,
    priority: 2,
    categories: ["notes"],
    tags: ["intro"],
  });

  expect(request.post.metadata.name).toBe("hello-world");
  expect(request.post.spec.title).toBe("Hello World");
  expect(request.post.spec.slug).toBe("hello-world");
  expect(request.post.spec.publish).toBe(true);
  expect(request.post.spec.excerpt.autoGenerate).toBe(false);
  expect(request.content.raw).toBe("# Hello World");
  expect(request.content.rawType).toBe("markdown");
});

test("normalizeUpdatePostInput merges provided fields over current remote state", async () => {
  const request = await normalizeUpdatePostInput(
    {
      apiVersion: "content.halo.run/v1alpha1",
      kind: "Post",
      metadata: { name: "hello-world", version: 3 },
      spec: {
        allowComment: true,
        deleted: false,
        excerpt: { autoGenerate: true },
        pinned: false,
        priority: 0,
        publish: false,
        slug: "hello-world",
        title: "Hello World",
        visible: "PUBLIC",
      },
    },
    {
      raw: "old content",
      content: "old content",
      rawType: "markdown",
    },
    {
      title: "Updated Title",
      content: "new content",
      publish: true,
      pinned: true,
    },
  );

  expect(request.post.spec.title).toBe("Updated Title");
  expect(request.post.spec.publish).toBe(true);
  expect(request.post.spec.pinned).toBe(true);
  expect(request.content.raw).toBe("new content");
});
