import { afterEach, expect, test, vi } from "vite-plus/test";

import { tryRunSearchCommand } from "../index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function silenceStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

test("tryRunSearchCommand returns false for unrelated commands", async () => {
  await expect(tryRunSearchCommand(["post"], {} as never)).resolves.toBe(false);
});

test("tryRunSearchCommand dispatches search requests with explicit urls", async () => {
  silenceStdout();

  const indicesSearch = vi.fn().mockResolvedValue({
    data: {
      keyword: "halo",
      hits: [],
      total: 0,
    },
  });

  const { IndexV1alpha1PublicApi } = await import("@halo-dev/api-client");
  vi.spyOn(IndexV1alpha1PublicApi.prototype, "indicesSearch").mockImplementation(indicesSearch);

  await expect(
    tryRunSearchCommand(
      ["search", "--keyword", "halo", "--limit", "5", "--url", "https://www.halo.run", "--json"],
      {
        configStore: {
          getActiveResolvedProfile: vi.fn(),
        },
      } as never,
    ),
  ).resolves.toBe(true);

  expect(indicesSearch).toHaveBeenCalledWith({
    searchOption: {
      keyword: "halo",
      limit: 5,
    },
  });
});

test("tryRunSearchCommand falls back to the active profile url", async () => {
  silenceStdout();

  const indicesSearch = vi.fn().mockResolvedValue({
    data: {
      keyword: "halo",
      hits: [],
      total: 0,
    },
  });

  const { IndexV1alpha1PublicApi } = await import("@halo-dev/api-client");
  vi.spyOn(IndexV1alpha1PublicApi.prototype, "indicesSearch").mockImplementation(indicesSearch);

  const runtimeMock = {
    configStore: {
      getActiveResolvedProfile: vi.fn().mockResolvedValue({
        baseUrl: "https://demo.halo.run",
      }),
    },
  };

  await expect(
    tryRunSearchCommand(["search", "--keyword", "halo", "--json"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(runtimeMock.configStore.getActiveResolvedProfile).toHaveBeenCalledWith(undefined);
});
