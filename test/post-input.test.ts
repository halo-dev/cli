import test from "node:test";
import assert from "node:assert/strict";

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

  assert.equal(request.post.metadata.name, "hello-world");
  assert.equal(request.post.spec.title, "Hello World");
  assert.equal(request.post.spec.slug, "hello-world");
  assert.equal(request.post.spec.publish, true);
  assert.equal(request.post.spec.excerpt.autoGenerate, false);
  assert.equal(request.content.raw, "# Hello World");
  assert.equal(request.content.rawType, "markdown");
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

  assert.equal(request.post.spec.title, "Updated Title");
  assert.equal(request.post.spec.publish, true);
  assert.equal(request.post.spec.pinned, true);
  assert.equal(request.content.raw, "new content");
});