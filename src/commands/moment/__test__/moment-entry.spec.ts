import { afterEach, expect, test, vi } from "vitest";

import { tryRunMomentCommand } from "../index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function silenceStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

test("tryRunMomentCommand returns false for unrelated commands", async () => {
  await expect(tryRunMomentCommand(["comment"], {} as never)).resolves.toBe(false);
});

test("tryRunMomentCommand shows help for bare moment commands", async () => {
  silenceStdout();

  await expect(tryRunMomentCommand(["moment"], {} as never)).resolves.toBe(true);
});

test("tryRunMomentCommand dispatches list subcommands", async () => {
  silenceStdout();

  const get = vi.fn().mockResolvedValue({
    data: {
      items: [],
      total: 0,
    },
  });
  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      clients: {
        axios: {
          get,
        },
      },
    }),
  };

  await expect(
    tryRunMomentCommand(
      [
        "moment",
        "list",
        "--page",
        "2",
        "--size",
        "10",
        "--tag",
        "life",
        "--visible",
        "PUBLIC",
        "--approved",
        "true",
        "--json",
      ],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(runtimeMock.getClientsForOptions).toHaveBeenCalledOnce();
  expect(get).toHaveBeenCalledWith("/apis/uc.api.moment.halo.run/v1alpha1/moments", {
    params: {
      page: 2,
      size: 10,
      keyword: undefined,
      tag: "life",
      visible: "PUBLIC",
      approved: true,
    },
  });
});
