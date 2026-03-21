import { expect, test } from "vitest";

import { renderContentByRawType } from "../../../utils/content.js";
import {
  parseSinglePageTransferPayload,
  resolveSinglePageTransferPayload,
  toMutationInput,
} from "../index.js";

test("toMutationInput parses primitive mutation fields", () => {
  expect(
    toMutationInput({
      name: "about",
      title: "About Halo",
      slug: "about-halo",
      content: "# About Halo",
      rawType: "markdown",
      excerpt: "about summary",
      cover: "https://example.com/cover.png",
      template: "page",
      visible: "PUBLIC",
      publish: "true",
      allowComment: "yes",
      priority: "2",
    }),
  ).toEqual({
    name: "about",
    title: "About Halo",
    slug: "about-halo",
    content: "# About Halo",
    contentFile: undefined,
    rawType: "markdown",
    excerpt: "about summary",
    cover: "https://example.com/cover.png",
    template: "page",
    visible: "PUBLIC",
    publish: true,
    allowComment: true,
    priority: 2,
  });
});

test("parseSinglePageTransferPayload normalizes exported single page json", () => {
  expect(
    parseSinglePageTransferPayload(
      JSON.stringify({
        page: {
          metadata: { name: "about" },
          spec: { publish: true },
        },
        content: {
          raw: "# About Halo",
          content: "<h1>About Halo</h1>",
          rawType: "markdown",
        },
      }),
    ),
  ).toEqual({
    page: {
      metadata: { name: "about" },
      spec: { publish: true },
    },
    content: {
      raw: "# About Halo",
      content: renderContentByRawType("# About Halo", "markdown"),
      rawType: "markdown",
    },
  });
});

test("parseSinglePageTransferPayload falls back from content.content to content.raw", () => {
  expect(
    parseSinglePageTransferPayload(
      JSON.stringify({
        page: {
          metadata: { name: "about" },
          spec: { publish: false },
        },
        content: {
          raw: "# About Halo",
        },
      }),
    ),
  ).toEqual({
    page: {
      metadata: { name: "about" },
      spec: { publish: false },
    },
    content: {
      raw: "# About Halo",
      content: renderContentByRawType("# About Halo", "markdown"),
      rawType: "markdown",
    },
  });
});

test("parseSinglePageTransferPayload requires page metadata name", () => {
  expect(() =>
    parseSinglePageTransferPayload(
      JSON.stringify({
        page: {
          metadata: { name: "" },
        },
        content: {
          raw: "# About Halo",
        },
      }),
    ),
  ).toThrow(/page\.metadata\.name/i);
});

test("parseSinglePageTransferPayload rejects invalid json", () => {
  expect(() => parseSinglePageTransferPayload("{invalid-json")).toThrow(
    /invalid single page json payload/i,
  );
});

test("parseSinglePageTransferPayload rejects non-object payloads", () => {
  expect(() => parseSinglePageTransferPayload('"hello"')).toThrow(
    /must be an object with `page` and `content`/i,
  );
});

test("parseSinglePageTransferPayload requires page object", () => {
  expect(() =>
    parseSinglePageTransferPayload(
      JSON.stringify({
        content: {
          raw: "# About Halo",
        },
      }),
    ),
  ).toThrow(/must include a `page` object/i);
});

test("parseSinglePageTransferPayload requires content object", () => {
  expect(() =>
    parseSinglePageTransferPayload(
      JSON.stringify({
        page: {
          metadata: { name: "about" },
        },
      }),
    ),
  ).toThrow(/must include a `content` object/i);
});

test("parseSinglePageTransferPayload requires raw or rendered content", () => {
  expect(() =>
    parseSinglePageTransferPayload(
      JSON.stringify({
        page: {
          metadata: { name: "about" },
        },
        content: {},
      }),
    ),
  ).toThrow(/must include `content\.raw` or `content\.content`/i);
});

test("resolveSinglePageTransferPayload requires exactly one source", async () => {
  await expect(resolveSinglePageTransferPayload({})).rejects.toThrow(
    /exactly one single page json source/i,
  );

  await expect(
    resolveSinglePageTransferPayload({
      file: "./single-page.json",
      raw: '{"page":{"metadata":{"name":"about"}},"content":{"raw":"# About Halo"}}',
    }),
  ).rejects.toThrow(/exactly one single page json source/i);
});
