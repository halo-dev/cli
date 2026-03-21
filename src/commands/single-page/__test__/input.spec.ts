import { expect, test } from "vitest";

import { renderContentByRawType } from "../../../utils/content.js";
import {
  normalizeCreateSinglePageInput,
  normalizeUpdateSinglePageInput,
  slugify,
} from "../input.js";

test("slugify normalizes text and falls back for blank titles", () => {
  expect(slugify(" Hello, Halo CLI! ")).toBe("hello-halo-cli");
  expect(slugify("%%%")).toBe("single-page");
});

test("normalizeCreateSinglePageInput builds a complete SinglePageRequest", async () => {
  const request = await normalizeCreateSinglePageInput({
    title: "About Halo",
    slug: "about-halo",
    content: "# About Halo",
    excerpt: "short summary",
    publish: true,
    allowComment: true,
    priority: 2,
    cover: "https://example.com/cover.png",
    template: "about",
    visible: "PUBLIC",
  });

  expect(request.page.metadata.name).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(request.page.spec.title).toBe("About Halo");
  expect(request.page.spec.slug).toBe("about-halo");
  expect(request.page.spec.publish).toBe(true);
  expect(request.page.spec.excerpt.autoGenerate).toBe(false);
  expect(request.page.spec.cover).toBe("https://example.com/cover.png");
  expect(request.page.spec.template).toBe("about");
  expect(request.page.spec.visible).toBe("PUBLIC");
  expect(request.content.raw).toBe("# About Halo");
  expect(request.content.content).toBe(renderContentByRawType("# About Halo", "markdown"));
  expect(request.content.rawType).toBe("markdown");
  expect(request.content.version).toBeUndefined();
});

test("normalizeCreateSinglePageInput uses provided resource name", async () => {
  const request = await normalizeCreateSinglePageInput({
    name: "about-page",
    title: "About",
    slug: "about",
    content: "# About",
  });

  expect(request.page.metadata.name).toBe("about-page");
});

test("normalizeUpdateSinglePageInput merges provided fields over current remote state", async () => {
  const request = await normalizeUpdateSinglePageInput(
    {
      apiVersion: "content.halo.run/v1alpha1",
      kind: "SinglePage",
      metadata: { name: "about-page", version: 3 },
      spec: {
        allowComment: true,
        deleted: false,
        excerpt: { autoGenerate: true },
        pinned: false,
        priority: 0,
        publish: false,
        slug: "about",
        title: "About",
        visible: "PUBLIC",
      },
    },
    {
      raw: "old content",
      content: "old rendered content",
      rawType: "markdown",
    },
    {
      title: "About Halo",
      content: "new content",
      publish: true,
      visible: "PRIVATE",
    },
  );

  expect(request.page.spec.title).toBe("About Halo");
  expect(request.page.metadata.name).toBe("about-page");
  expect(request.page.spec.publish).toBe(true);
  expect(request.page.spec.pinned).toBe(false);
  expect(request.page.spec.visible).toBe("PRIVATE");
  expect(request.content.raw).toBe("new content");
  expect(request.content.content).toBe(renderContentByRawType("new content", "markdown"));
  expect(request.content.rawType).toBe("markdown");
  expect(request.content.version).toBeUndefined();
});

test("normalizeCreateSinglePageInput keeps html content unchanged when raw type is html", async () => {
  const request = await normalizeCreateSinglePageInput({
    title: "About HTML",
    slug: "about-html",
    content: "<h1>Hello Halo</h1>",
    rawType: "html",
  });

  expect(request.content.raw).toBe("<h1>Hello Halo</h1>");
  expect(request.content.content).toBe("<h1>Hello Halo</h1>");
  expect(request.content.rawType).toBe("html");
});

test("normalizeUpdateSinglePageInput updates resource name when provided", async () => {
  const request = await normalizeUpdateSinglePageInput(
    {
      apiVersion: "content.halo.run/v1alpha1",
      kind: "SinglePage",
      metadata: { name: "about-page" },
      spec: {
        allowComment: true,
        deleted: false,
        excerpt: { autoGenerate: true },
        pinned: false,
        priority: 0,
        publish: false,
        slug: "about",
        title: "About",
        visible: "PUBLIC",
      },
    },
    {
      raw: "old content",
      content: "old content",
      rawType: "markdown",
    },
    {
      name: "about-page-renamed",
    },
  );

  expect(request.page.metadata.name).toBe("about-page-renamed");
  expect(request.content.raw).toBe("old content");
});

test("normalizeCreateSinglePageInput requires title, slug, and content", async () => {
  await expect(
    normalizeCreateSinglePageInput({
      title: "About",
      slug: "about",
    }),
  ).rejects.toThrow(/single-page create/i);
});
