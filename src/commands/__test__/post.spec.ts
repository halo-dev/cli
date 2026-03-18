import { expect, test } from "vitest";

import { CONTENT_JSON_ANNOTATION } from "../../utils/post-input.js";
import { toMutationInput, withSerializedContentAnnotation } from "../post.js";

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

test("withSerializedContentAnnotation preserves existing annotations", () => {
  const metadata = withSerializedContentAnnotation(
    {
      name: "post-1",
      annotations: {
        existing: "value",
      },
    },
    {
      raw: "# Halo",
      content: "<h1>Halo</h1>",
      rawType: "markdown",
    },
  );

  expect(metadata.annotations).toMatchObject({
    existing: "value",
    [CONTENT_JSON_ANNOTATION]: '{"raw":"# Halo","content":"<h1>Halo</h1>","rawType":"markdown"}',
  });
});
