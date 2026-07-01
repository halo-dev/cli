import { afterEach, expect, test, vi } from "vite-plus/test";

vi.mock("@inquirer/prompts", () => ({
  confirm: vi.fn(),
}));

import { confirm } from "@inquirer/prompts";

import {
  confirmThirdPartyPackageSource,
  requiresThirdPartyPackageSourceConfirmation,
} from "../remote-source.js";

afterEach(() => {
  vi.restoreAllMocks();
});

test("requiresThirdPartyPackageSourceConfirmation skips halo.run URLs", () => {
  expect(
    requiresThirdPartyPackageSourceConfirmation("https://www.halo.run/plugins/demo-plugin.jar"),
  ).toBe(false);
});

test("requiresThirdPartyPackageSourceConfirmation skips file URIs", () => {
  expect(requiresThirdPartyPackageSourceConfirmation("file:///tmp/demo-plugin.jar")).toBe(false);
});

test("requiresThirdPartyPackageSourceConfirmation flags third-party URLs", () => {
  expect(
    requiresThirdPartyPackageSourceConfirmation("https://downloads.example.com/demo-plugin.jar"),
  ).toBe(true);
});

test("confirmThirdPartyPackageSource skips prompting with --yes", async () => {
  await expect(
    confirmThirdPartyPackageSource(
      "https://downloads.example.com/demo-plugin.jar",
      {
        commandPath: "halo plugin install",
        actionLabel: "installing plugin",
      },
      { yes: true },
    ),
  ).resolves.toBe(true);

  expect(confirm).not.toHaveBeenCalled();
});

test("confirmThirdPartyPackageSource requires --yes outside interactive terminals", async () => {
  Object.defineProperty(process.stdin, "isTTY", {
    value: false,
    configurable: true,
  });
  Object.defineProperty(process.stdout, "isTTY", {
    value: false,
    configurable: true,
  });

  await expect(
    confirmThirdPartyPackageSource(
      "https://downloads.example.com/demo-plugin.jar",
      {
        commandPath: "halo plugin install",
        actionLabel: "installing plugin",
      },
      {},
    ),
  ).rejects.toThrow(/requires confirmation in interactive mode.*or use --yes/i);
});

test("confirmThirdPartyPackageSource returns false when user cancels", async () => {
  Object.defineProperty(process.stdin, "isTTY", {
    value: true,
    configurable: true,
  });
  Object.defineProperty(process.stdout, "isTTY", {
    value: true,
    configurable: true,
  });

  vi.mocked(confirm).mockResolvedValue(false);
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  await expect(
    confirmThirdPartyPackageSource(
      "https://downloads.example.com/demo-plugin.jar",
      {
        commandPath: "halo plugin install",
        actionLabel: "installing plugin",
      },
      {},
    ),
  ).resolves.toBe(false);

  expect(stdoutSpy).toHaveBeenCalledWith(
    "Warning: remote package URL is not hosted on www.halo.run: https://downloads.example.com/demo-plugin.jar\n",
  );
  expect(stdoutSpy).toHaveBeenCalledWith("Cancelled installing plugin.\n");
});
