import { afterEach, expect, test, vi } from "vite-plus/test";

import { printThemeList } from "../format.js";

afterEach(() => {
  vi.restoreAllMocks();
});

test("printThemeList renders the active theme marker without status or deleted columns", () => {
  let output = "";

  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    output += String(chunk);
    return true;
  });

  printThemeList(
    [
      {
        apiVersion: "theme.halo.run/v1alpha1",
        kind: "Theme",
        metadata: { name: "active-theme" },
        spec: {
          displayName: "Active Theme",
          version: "1.0.0",
          author: { name: "Halo" },
        },
      },
      {
        apiVersion: "theme.halo.run/v1alpha1",
        kind: "Theme",
        metadata: { name: "other-theme" },
        spec: {
          displayName: "Other Theme",
          version: "1.1.0",
          author: { name: "Halo" },
        },
      },
    ],
    false,
    undefined,
    "active-theme",
  );

  expect(output).toContain("ACTIVE");
  expect(output).not.toContain("STATUS");
  expect(output).not.toContain("DELETED");
  expect(output).toContain("active-theme");
  expect(output).toContain("other-theme");
  expect(output).toContain("* ");
  expect(output).toContain("2 theme(s)");
});
