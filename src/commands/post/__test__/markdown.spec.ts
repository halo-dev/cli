import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vite-plus/test";

import { renderContentByRawType } from "../../../utils/content.js";
import {
  buildPostMarkdownFrontMatter,
  parsePostMarkdownDocument,
  resolvePostMarkdownImportPayload,
  stringifyPostMarkdownDocument,
} from "../markdown.js";

test("parsePostMarkdownDocument reads supported front matter fields", () => {
  const parsed = parsePostMarkdownDocument(`---
title: Hello Halo
slug: hello-halo
excerpt: Summary
cover: https://example.com/cover.png
categories:
  - News
tags:
  - CLI
halo:
  site: https://example.com
  name: post-1
  publish: true
---
# Hello
`);

  expect(parsed.frontMatter).toEqual({
    title: "Hello Halo",
    slug: "hello-halo",
    excerpt: "Summary",
    cover: "https://example.com/cover.png",
    categories: ["News"],
    tags: ["CLI"],
    halo: {
      site: "https://example.com",
      name: "post-1",
      publish: true,
    },
  });
  expect(parsed.content).toContain("# Hello");
});

test("parsePostMarkdownDocument rejects invalid category shapes", () => {
  expect(() =>
    parsePostMarkdownDocument(`---
categories: invalid
---
# Hello
`),
  ).toThrow(/categories/i);
});

test("resolvePostMarkdownImportPayload derives title, slug, and rendered markdown", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "halo-post-markdown-"));
  const filePath = join(tempDir, "hello-world.md");

  try {
    await writeFile(filePath, "# Hello World\n\nParagraph.", "utf8");

    const payload = await resolvePostMarkdownImportPayload(filePath);

    expect(payload.trackedName).toBeUndefined();
    expect(payload.mutationInput.title).toBe("hello-world");
    expect(payload.mutationInput.slug).toBe("hello-world");
    expect(payload.mutationInput.rawType).toBe("markdown");
    expect(payload.mutationInput.content).toBe("# Hello World\n\nParagraph.");
    expect(payload.mutationInput.renderedContent).toBe(
      renderContentByRawType("# Hello World\n\nParagraph.", "markdown"),
    );
    expect(payload.mutationInput.renderedContent).toContain('id="hello-world"');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("stringifyPostMarkdownDocument writes round-trip Halo metadata", () => {
  const frontMatter = buildPostMarkdownFrontMatter(
    {
      metadata: { name: "post-1" },
      spec: {
        title: "Hello Halo",
        slug: "hello-halo",
        excerpt: { autoGenerate: false, raw: "Summary" },
        cover: "https://example.com/cover.png",
        categories: [],
        tags: ["tag-1"],
        publish: true,
      },
    } as never,
    {
      site: "https://example.com/",
      categories: ["News"],
      tags: ["CLI"],
    },
  );

  const markdown = stringifyPostMarkdownDocument("# Hello Halo", frontMatter);

  expect(markdown).toContain("title: Hello Halo");
  expect(markdown).toContain("slug: hello-halo");
  expect(markdown).toContain("excerpt: Summary");
  expect(markdown).toContain("categories:");
  expect(markdown).toContain("halo:");
  expect(markdown).toContain("site: https://example.com");
  expect(markdown).toContain("name: post-1");
  expect(markdown).toContain("publish: true");
});
