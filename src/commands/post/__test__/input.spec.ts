import { expect, test } from "vite-plus/test";

import { renderContentByRawType } from "../../../utils/content.js";
import {
  CONTENT_JSON_ANNOTATION,
  PATCHED_CONTENT_ANNOTATION,
  PATCHED_RAW_ANNOTATION,
  extractDraftContent,
  normalizeCreatePostInput,
  normalizeUpdatePostInput,
  serializeDraftContent,
  slugify,
  slugifyTaxonomyDisplayName,
} from "../input.js";

test("slugify normalizes text and falls back for blank titles", () => {
  expect(slugify(" Hello, Halo CLI! ")).toBe("hello-halo-cli");
  expect(slugify("%%%")).toBe("post");
});

test("slugifyTaxonomyDisplayName preserves readable names and removes URL-hostile characters", () => {
  expect(slugifyTaxonomyDisplayName("分类 一", "category")).toBe("分类-一");
  expect(slugifyTaxonomyDisplayName("Halo / CLI?", "tag")).toBe("Halo-CLI");
  expect(slugifyTaxonomyDisplayName("%%% ", "tag")).toBe("tag");
});

test("normalizeCreatePostInput builds a complete PostRequest", async () => {
  const request = await normalizeCreatePostInput({
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

  expect(request.post.metadata.name).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(request.post.spec.title).toBe("Hello World");
  expect(request.post.spec.slug).toBe("hello-world");
  expect(request.post.spec.publish).toBe(true);
  expect(request.post.spec.excerpt.autoGenerate).toBe(false);
  expect(request.content.raw).toBe("# Hello World");
  expect(request.content.content).toBe(renderContentByRawType("# Hello World", "markdown"));
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
  expect(request.post.metadata.name).toBe("hello-world");
  expect(request.post.spec.publish).toBe(true);
  expect(request.post.spec.pinned).toBe(true);
  expect(request.content.raw).toBe("new content");
  expect(request.content.content).toBe(renderContentByRawType("new content", "markdown"));
});

test("normalizeCreatePostInput keeps html content unchanged when raw type is html", async () => {
  const request = await normalizeCreatePostInput({
    title: "Hello HTML",
    slug: "hello-html",
    content: "<h1>Hello Halo</h1>",
    rawType: "html",
  });

  expect(request.content.raw).toBe("<h1>Hello Halo</h1>");
  expect(request.content.content).toBe("<h1>Hello Halo</h1>");
  expect(request.content.rawType).toBe("html");
});

test("extractDraftContent prefers serialized content annotation from draft snapshot", () => {
  const content = {
    raw: "# Hello from draft",
    content: renderContentByRawType("# Hello from draft", "markdown"),
    rawType: "markdown",
  };

  const extracted = extractDraftContent({
    apiVersion: "snapshot.halo.run/v1alpha1",
    kind: "Snapshot",
    metadata: {
      name: "snapshot-1",
      annotations: {
        [CONTENT_JSON_ANNOTATION]: serializeDraftContent(content),
      },
    },
    spec: {
      owner: "test-user",
      rawType: "markdown",
      subjectRef: {
        group: "content.halo.run",
        kind: "Post",
        name: "hello-world",
        version: "v1alpha1",
      },
    },
  });

  expect(extracted).toEqual(content);
});

test("extractDraftContent falls back to patched annotations", () => {
  const extracted = extractDraftContent({
    apiVersion: "snapshot.halo.run/v1alpha1",
    kind: "Snapshot",
    metadata: {
      name: "snapshot-1",
      annotations: {
        [CONTENT_JSON_ANNOTATION]: "{invalid json",
        [PATCHED_RAW_ANNOTATION]: "# Draft",
        [PATCHED_CONTENT_ANNOTATION]: "<p>Draft</p>",
      },
    },
    spec: {
      owner: "test-user",
      rawType: "markdown",
      subjectRef: {
        group: "content.halo.run",
        kind: "Post",
        name: "hello-world",
        version: "v1alpha1",
      },
    },
  });

  expect(extracted).toEqual({
    raw: "# Draft",
    content: renderContentByRawType("# Draft", "markdown"),
    rawType: "markdown",
  });
});
