import { expect, test } from "vite-plus/test";

import { renderContentByRawType } from "../content.js";

test("renderContentByRawType adds heading anchors for markdown headings", () => {
  const rendered = renderContentByRawType("# Hello Halo", "markdown");

  expect(rendered).toContain('id="hello-halo"');
  expect(rendered).toContain(">Hello Halo</h1>");
});

test("renderContentByRawType leaves html raw content unchanged", () => {
  expect(renderContentByRawType("<h1>Hello Halo</h1>", "html")).toBe("<h1>Hello Halo</h1>");
});
