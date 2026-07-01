import { afterEach, expect, test, vi } from "vite-plus/test";

import {
  printDetailObject,
  printExecutionTarget,
  printJson,
  printPaginationFooter,
  printResourceMutationSuccess,
} from "../output.js";

afterEach(() => {
  vi.restoreAllMocks();
});

test("printJson writes formatted JSON followed by a newline", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  printJson({
    name: "halo",
    nested: {
      enabled: true,
    },
  });

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(stdoutSpy).toHaveBeenCalledWith(
    `${JSON.stringify(
      {
        name: "halo",
        nested: {
          enabled: true,
        },
      },
      null,
      2,
    )}\n`,
  );
});

test("printExecutionTarget prints nothing in json mode", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  printExecutionTarget(
    {
      profileName: "local",
      baseUrl: "https://demo.halo.run",
    },
    true,
  );

  expect(stdoutSpy).not.toHaveBeenCalled();
});

test("printExecutionTarget prints profile and base url in table mode", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  printExecutionTarget({
    profileName: "local",
    baseUrl: "https://demo.halo.run",
  });

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain("TARGET");
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain("profile");
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain("local");
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain("https://demo.halo.run");
});

test("printExecutionTarget prints url label when no profile name is available", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  printExecutionTarget({
    baseUrl: "https://demo.halo.run",
  });

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain("TARGET");
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain("url");
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain("https://demo.halo.run");
});

test("printResourceMutationSuccess prints metadata name, absolute permalink, and inspect command", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  printResourceMutationSuccess({
    message: "Post created successfully.",
    baseUrl: "https://demo.halo.run/console",
    name: "hello-world",
    permalink: "/archives/hello-world",
    resourceLabel: "Post",
    inspectCommand: "halo post get hello-world",
  });

  expect(stdoutSpy.mock.calls.map((call) => String(call[0])).join("")).toBe(
    "Post created successfully.\n\n" +
      "metadata.name: hello-world\n" +
      "permalink: https://demo.halo.run/archives/hello-world\n" +
      "inspect: halo post get hello-world\n",
  );
});

test("printResourceMutationSuccess shows unavailable permalink for unpublished resources", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  printResourceMutationSuccess({
    message: "Single page updated successfully.",
    baseUrl: "https://demo.halo.run",
    name: "about",
    resourceLabel: "Single page",
    inspectCommand: "halo single-page get about",
  });

  expect(stdoutSpy.mock.calls.map((call) => String(call[0])).join("")).toBe(
    "Single page updated successfully.\n\n" +
      "metadata.name: about\n" +
      "permalink: (not available until published)\n" +
      "inspect: halo single-page get about\n",
  );
});

test("printDetailObject flattens nested values into table output", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  Object.defineProperty(process.stdout, "columns", {
    value: 100,
    configurable: true,
  });

  printDetailObject({
    metadata: {
      name: "demo-post",
      labels: {
        app: "halo",
      },
    },
    spec: {
      published: true,
      tags: ["news", "cli"],
      visits: 3,
      extra: null,
    },
  });

  expect(stdoutSpy).toHaveBeenCalledOnce();

  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain("FIELD");
  expect(output).toContain("VALUE");
  expect(output).toContain("metadata.name");
  expect(output).toContain("demo-post");
  expect(output).toContain("metadata.labels.app");
  expect(output).toContain("halo");
  expect(output).toContain("spec.published");
  expect(output).toContain("true");
  expect(output).toContain("spec.tags");
  expect(output).toContain("news, cli");
  expect(output).toContain("spec.visits");
  expect(output).toContain("3");
  expect(output).toContain("spec.extra");
  expect(output).toContain("null");
});

test("printDetailObject renders empty nested objects as braces", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  printDetailObject({
    status: {},
  });

  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain("status");
  expect(output).toContain("{}");
});

test("printPaginationFooter renders pagination details with next page hint", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  printPaginationFooter({
    page: 1,
    size: 20,
    total: 130,
    totalPages: 7,
    hasNext: true,
    hasPrevious: false,
    itemLabel: "post",
  });

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(stdoutSpy).toHaveBeenCalledWith(
    "\nShowing 1-20 of 130 post(s) · page 1/7 · size 20 · more results available\n",
  );
});

test("printPaginationFooter renders end-of-results state", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  printPaginationFooter({
    page: 7,
    size: 20,
    total: 130,
    totalPages: 7,
    hasNext: false,
    hasPrevious: true,
    itemLabel: "post",
  });

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(stdoutSpy).toHaveBeenCalledWith(
    "\nShowing 121-130 of 130 post(s) · page 7/7 · size 20 · end of results\n",
  );
});

test("printPaginationFooter infers a single-page summary when only total is available", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  printPaginationFooter({
    total: 3,
    itemLabel: "theme",
  });

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(stdoutSpy).toHaveBeenCalledWith("\nShowing 1-3 of 3 theme(s) · page 1 · size 3\n");
});
