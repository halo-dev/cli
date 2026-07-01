import { expect, test } from "vite-plus/test";

import { renderContentByRawType } from "../../../utils/content.js";
import { parsePostTransferPayload, resolvePostTransferPayload, toMutationInput } from "../index.js";

test("toMutationInput parses primitive mutation fields", () => {
  expect(
    toMutationInput({
      name: "post-1",
      title: "Hello Halo",
      slug: "hello-halo",
      content: "# Halo",
      rawType: "markdown",
      excerpt: "summary",
      categories: "news, cli",
      tags: "halo, release",
      cover: "https://example.com/cover.png",
      template: "post",
      visible: "PUBLIC",
      publish: "true",
      pinned: "false",
      allowComment: "yes",
      priority: "2",
    }),
  ).toEqual({
    name: "post-1",
    title: "Hello Halo",
    slug: "hello-halo",
    content: "# Halo",
    contentFile: undefined,
    rawType: "markdown",
    excerpt: "summary",
    categories: ["news", "cli"],
    tags: ["halo", "release"],
    cover: "https://example.com/cover.png",
    template: "post",
    visible: "PUBLIC",
    publish: true,
    pinned: false,
    allowComment: true,
    priority: 2,
  });
});

test("parsePostTransferPayload normalizes exported post json", () => {
  expect(
    parsePostTransferPayload(
      JSON.stringify({
        post: {
          metadata: { name: "post-1" },
          spec: { publish: true },
        },
        content: {
          raw: "# Halo",
          content: "<h1>Halo</h1>",
          rawType: "markdown",
        },
      }),
    ),
  ).toEqual({
    post: {
      metadata: { name: "post-1" },
      spec: { publish: true },
    },
    content: {
      raw: "# Halo",
      content: renderContentByRawType("# Halo", "markdown"),
      rawType: "markdown",
    },
  });
});

test("parsePostTransferPayload requires post metadata name", () => {
  expect(() =>
    parsePostTransferPayload(
      JSON.stringify({
        post: {
          metadata: { name: "" },
        },
        content: {
          raw: "# Halo",
        },
      }),
    ),
  ).toThrow(/post\.metadata\.name/i);
});

test("parsePostTransferPayload rejects invalid json", () => {
  expect(() => parsePostTransferPayload("{invalid-json")).toThrow(/invalid post json payload/i);
});

test("resolvePostTransferPayload requires exactly one source", async () => {
  await expect(resolvePostTransferPayload({})).rejects.toThrow(/exactly one post json source/i);
  await expect(
    resolvePostTransferPayload({
      file: "./post.json",
      raw: '{"post":{"metadata":{"name":"post-1"}},"content":{"raw":"# Halo"}}',
    }),
  ).rejects.toThrow(/exactly one post json source/i);
});
