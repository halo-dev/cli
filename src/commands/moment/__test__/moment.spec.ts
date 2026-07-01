import { expect, test } from "vite-plus/test";

import {
  buildMomentPayload,
  escapeHtml,
  looksLikeHtml,
  normalizeMomentHtml,
  normalizeVisible,
} from "../index.js";

test("escapeHtml escapes special HTML characters", () => {
  expect(escapeHtml(`<tag attr="1">it's & ok</tag>`)).toBe(
    "&lt;tag attr=&quot;1&quot;&gt;it&#39;s &amp; ok&lt;/tag&gt;",
  );
});

test("looksLikeHtml detects HTML fragments", () => {
  expect(looksLikeHtml("<p>Hello</p>")).toBe(true);
  expect(looksLikeHtml("Hello world")).toBe(false);
});

test("normalizeMomentHtml preserves existing HTML", () => {
  expect(normalizeMomentHtml(" <p>Hello</p> ")).toBe("<p>Hello</p>");
});

test("normalizeMomentHtml converts plain text into HTML paragraphs", () => {
  expect(normalizeMomentHtml("Hello\nWorld\n\nHalo")).toBe("<p>Hello<br />World</p><p>Halo</p>");
});

test("normalizeVisible normalizes supported values", () => {
  expect(normalizeVisible(" private ")).toBe("PRIVATE");
  expect(normalizeVisible(undefined)).toBeUndefined();
});

test("normalizeVisible rejects unsupported values", () => {
  expect(() => normalizeVisible("friends")).toThrow(/must be PUBLIC or PRIVATE/i);
});

test("buildMomentPayload fills defaults and generated names", () => {
  const payload = buildMomentPayload("Hello\nHalo", {
    tags: "life, cli",
    approved: "true",
  });

  expect(payload.metadata).toEqual({
    name: "",
    generateName: "moment-",
  });
  expect(payload.spec.content.raw).toBe("<p>Hello<br />Halo</p>");
  expect(payload.spec.content.html).toBe("<p>Hello<br />Halo</p>");
  expect(payload.spec.visible).toBe("PUBLIC");
  expect(payload.spec.tags).toEqual(["life", "cli"]);
  expect(payload.spec.approved).toBe(true);
  expect(payload.spec.releaseTime).toBeTruthy();
  expect(Date.parse(payload.spec.releaseTime!)).not.toBeNaN();
});

test("buildMomentPayload keeps explicit names and visibility", () => {
  const payload = buildMomentPayload(
    "<p>Hello</p>",
    {
      name: "from-option",
      visible: "PRIVATE",
      releaseTime: "2026-03-18T10:00:00.000Z",
    },
    "from-arg",
  );

  expect(payload.metadata).toEqual({
    name: "from-arg",
    generateName: undefined,
  });
  expect(payload.spec.visible).toBe("PRIVATE");
  expect(payload.spec.releaseTime).toBe("2026-03-18T10:00:00.000Z");
});
