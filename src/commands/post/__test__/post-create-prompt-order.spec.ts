import { afterEach, expect, test, vi } from "vite-plus/test";

const promptState = vi.hoisted(() => ({
  input: vi.fn(),
  confirm: vi.fn(),
  checkbox: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
  input: promptState.input,
  confirm: promptState.confirm,
  checkbox: promptState.checkbox,
}));

import { tryRunPostCommand } from "../index.js";

const originalStdinTty = process.stdin.isTTY;
const originalStdoutTty = process.stdout.isTTY;

afterEach(() => {
  promptState.input.mockReset();
  promptState.confirm.mockReset();
  promptState.checkbox.mockReset();
  vi.restoreAllMocks();
  Object.defineProperty(process.stdin, "isTTY", { value: originalStdinTty, configurable: true });
  Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutTty, configurable: true });
});

test("tryRunPostCommand prompts title and slug before categories and tags on create", async () => {
  Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
  Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  const order: string[] = [];

  promptState.input.mockImplementation(async (config: { message: string }) => {
    order.push(config.message);

    if (config.message === "Post title") {
      return "Hello Halo";
    }

    if (config.message === "Post slug") {
      return "hello-halo";
    }

    if (config.message === "Post content") {
      return "# Hello Halo";
    }

    return "";
  });

  promptState.confirm.mockImplementation(async (config: { message: string }) => {
    order.push(config.message);
    return false;
  });

  promptState.checkbox.mockImplementation(async (config: { message: string }) => {
    order.push(config.message);
    return [];
  });

  const draftPost = vi.fn().mockResolvedValue({
    data: { metadata: { name: "post-1" } },
  });
  const getPost = vi.fn().mockResolvedValue({
    data: { metadata: { name: "post-1" } },
  });

  const runtimeMock = {
    getClientsForOptions: vi.fn().mockResolvedValue({
      profile: { baseUrl: "https://example.com" },
      clients: {
        axios: {
          get: vi.fn().mockImplementation(async (url: string) => {
            if (url.includes("/categories")) {
              return { data: { items: [] } };
            }

            if (url.includes("/tags")) {
              return { data: { items: [] } };
            }

            throw new Error(`Unexpected axios.get url: ${url}`);
          }),
          post: vi.fn(),
        },
        console: {
          content: {
            post: {
              draftPost,
              publishPost: vi.fn().mockResolvedValue(undefined),
              unpublishPost: vi.fn().mockResolvedValue(undefined),
            },
          },
        },
        core: {
          content: {
            post: {
              getPost,
            },
          },
        },
      },
    }),
  };

  await expect(tryRunPostCommand(["post", "create", "--json"], runtimeMock as never)).resolves.toBe(
    true,
  );

  expect(order.indexOf("Post title")).toBe(0);
  expect(order.indexOf("Post slug")).toBe(1);
  expect(order.indexOf("Select categories")).toBeGreaterThan(order.indexOf("Post slug"));
  expect(order.indexOf("Select tags")).toBeGreaterThan(order.indexOf("Select categories"));
});
