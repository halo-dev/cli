import { afterEach, expect, test, vi } from "vite-plus/test";

import type { HaloProfile } from "../../shared/profile.js";
import { buildAuthHeader, RuntimeContext } from "../runtime.js";
import { normalizeBaseUrl } from "../url.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function createBearerProfile(): HaloProfile {
  return {
    name: "bearer",
    baseUrl: "https://demo.halo.run",
    auth: {
      type: "bearer",
      token: "personal-access-token",
    },
    createdAt: "2026-03-18T00:00:00.000Z",
    updatedAt: "2026-03-18T00:00:00.000Z",
  };
}

test("buildAuthHeader returns Basic authorization header", () => {
  const profile: HaloProfile = {
    name: "basic",
    baseUrl: "https://demo.halo.run",
    auth: {
      type: "basic",
      username: "admin",
      password: "secret",
    },
    createdAt: "2026-03-18T00:00:00.000Z",
    updatedAt: "2026-03-18T00:00:00.000Z",
  };

  expect(buildAuthHeader(profile)).toBe(`Basic ${Buffer.from("admin:secret").toString("base64")}`);
});

test("buildAuthHeader returns Bearer authorization header", () => {
  const profile = createBearerProfile();

  expect(buildAuthHeader(profile)).toBe("Bearer personal-access-token");
});

test("normalizeBaseUrl trims trailing slashes", () => {
  expect(normalizeBaseUrl("https://demo.halo.run///")).toBe("https://demo.halo.run");
});

test("normalizeBaseUrl rejects URLs without protocol", () => {
  expect(() => normalizeBaseUrl("demo.halo.run")).toThrow(/must start with http/);
});

test("RuntimeContext.getResolvedProfile delegates to ConfigStore", async () => {
  const profile = createBearerProfile();

  const configStore = {
    getActiveResolvedProfile: vi.fn().mockResolvedValue(profile),
  };
  const runtime = new RuntimeContext(configStore as never);

  await expect(runtime.getResolvedProfile({ profile: "demo" })).resolves.toEqual(profile);
  expect(configStore.getActiveResolvedProfile).toHaveBeenCalledWith("demo");
});

test("RuntimeContext.getClientsForResolvedProfile creates API clients", () => {
  const runtime = new RuntimeContext({} as never);

  const clients = runtime.getClientsForResolvedProfile(createBearerProfile());

  expect(clients.axios.defaults.baseURL).toBe("https://demo.halo.run");
  expect(clients.axios.defaults.headers.Authorization).toBe("Bearer personal-access-token");
});

test("RuntimeContext.getClientsForOptions prints execution target", async () => {
  const profile = createBearerProfile();
  const configStore = {
    getActiveResolvedProfile: vi.fn().mockResolvedValue(profile),
  };
  const runtime = new RuntimeContext(configStore as never);
  const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  await runtime.getClientsForOptions({ profile: "demo" });

  expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining("https://demo.halo.run"));
  expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining("bearer"));
});

test("RuntimeContext.getClientsForOptions skips execution target in json mode", async () => {
  const profile = createBearerProfile();
  const configStore = {
    getActiveResolvedProfile: vi.fn().mockResolvedValue(profile),
  };
  const runtime = new RuntimeContext(configStore as never);
  const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  await runtime.getClientsForOptions({ profile: "demo", json: true });

  expect(writeSpy).not.toHaveBeenCalled();
});
