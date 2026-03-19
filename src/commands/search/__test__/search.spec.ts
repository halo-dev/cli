import { expect, test, vi } from "vitest";

import { buildSearchOption, resolveSearchBaseUrl } from "../index.js";

test("buildSearchOption requires keywords", () => {
  expect(() => buildSearchOption(undefined)).toThrow(/requires --keyword/i);
});

test("buildSearchOption parses keyword and limit", () => {
  expect(buildSearchOption(" halo ", "5")).toEqual({
    keyword: "halo",
    limit: 5,
  });
});

test("buildSearchOption rejects non-positive limits", () => {
  expect(() => buildSearchOption("halo", "0")).toThrow(/must be a positive number/i);
});

test("resolveSearchBaseUrl prefers explicit urls", async () => {
  const runtimeMock = {
    configStore: {
      getActiveResolvedProfile: vi.fn(),
    },
  };

  await expect(
    resolveSearchBaseUrl(runtimeMock as never, {
      url: "https://www.halo.run/",
    }),
  ).resolves.toBe("https://www.halo.run");

  expect(runtimeMock.configStore.getActiveResolvedProfile).not.toHaveBeenCalled();
});

test("resolveSearchBaseUrl falls back to active profile urls", async () => {
  const runtimeMock = {
    configStore: {
      getActiveResolvedProfile: vi.fn().mockResolvedValue({
        baseUrl: "https://demo.halo.run/",
      }),
    },
  };

  await expect(resolveSearchBaseUrl(runtimeMock as never, {})).resolves.toBe(
    "https://demo.halo.run",
  );
  expect(runtimeMock.configStore.getActiveResolvedProfile).toHaveBeenCalledWith(undefined);
});
