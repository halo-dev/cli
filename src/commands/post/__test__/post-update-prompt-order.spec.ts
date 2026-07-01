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

test("tryRunPostCommand prompts title and slug before categories and tags on update", async () => {
  Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
  Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  const order: string[] = [];

  promptState.input.mockImplementation(async (config: { message: string }) => {
    order.push(config.message);

    if (config.message === "Post title") {
      return "Updated Halo";
    }

    if (config.message === "Post slug") {
      return "updated-halo";
    }

    if (config.message === "Post content") {
      return "# Updated Halo";
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

  const getPost = vi
    .fn()
    .mockResolvedValueOnce({
      data: {
        metadata: { name: "post-1" },
        spec: {
          title: "Hello Halo",
          slug: "hello-halo",
          categories: [],
          tags: [],
          cover: "",
          template: "",
          visible: "PUBLIC",
          publish: false,
          pinned: false,
          allowComment: true,
          priority: 0,
          excerpt: { autoGenerate: true },
        },
      },
    })
    .mockResolvedValueOnce({
      data: {
        metadata: { name: "post-1" },
        spec: {
          title: "Updated Halo",
          slug: "updated-halo",
        },
      },
    });
  const fetchPostHeadContent = vi.fn().mockResolvedValue({
    data: { raw: "# Hello Halo", content: "<h1>Hello Halo</h1>", rawType: "markdown" },
  });
  const updateDraftPost = vi.fn().mockResolvedValue({
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
              fetchPostHeadContent,
              updateDraftPost,
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

  await expect(
    tryRunPostCommand(["post", "update", "post-1", "--json"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(order.indexOf("Post title")).toBe(0);
  expect(order.indexOf("Post slug")).toBe(1);
  expect(order.indexOf("Select categories")).toBeGreaterThan(order.indexOf("Post slug"));
  expect(order.indexOf("Select tags")).toBeGreaterThan(order.indexOf("Select categories"));
});
