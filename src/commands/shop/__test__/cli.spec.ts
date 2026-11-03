import { expect, test } from "vite-plus/test";

import { createShopCli } from "../cli.js";

interface CapturedOptions {
  [key: string]: unknown;
}

function buildCli() {
  const cli = createShopCli("test");
  const command = cli.command("run [value]");

  command.option("--json", "Output JSON");
  command.option("--all", "All");
  command.option("--force", "Force");
  command.option("--stdin", "Read stdin");
  command.option("--file <path>", "File");
  command.option("--images <urls>", "Images");
  command.option("--sku <sku>", "SKU");
  command.option("--price <price>", "Price");
  command.option("--track-inventory <boolean>", "Track inventory");
  command.option("--clear-note", "Clear note");
  command.option("--item <item>", "Item");

  let captured: CapturedOptions | undefined;
  command.action((...args: unknown[]) => {
    captured = args.at(-1) as CapturedOptions;
  });

  return {
    cli,
    getOptions: () => captured,
  };
}

test("createShopCli preserves numeric-looking and empty option values", async () => {
  const { cli, getOptions } = buildCli();

  cli.parse(
    ["node", "test", "run", "--sku", "0012", "--price", "", "--track-inventory", "0", "--json"],
    { run: false },
  );
  await cli.runMatchedCommand();

  expect(getOptions()).toMatchObject({
    sku: "0012",
    price: "",
    trackInventory: "0",
    json: true,
  });
});

test("createShopCli supports --file - as stdin", async () => {
  const { cli, getOptions } = buildCli();

  cli.parse(["node", "test", "run", "--file", "-"], { run: false });
  await cli.runMatchedCommand();

  expect(getOptions()).toMatchObject({ file: "-" });
});

test("createShopCli keeps repeated options as arrays", async () => {
  const { cli, getOptions } = buildCli();

  cli.parse(["node", "test", "run", "--item", "1:1:9", "--item", "2:1:9"], { run: false });
  await cli.runMatchedCommand();

  expect(getOptions()).toMatchObject({ item: ["1:1:9", "2:1:9"] });
});

test("createShopCli rejects repeated non-repeatable value options", () => {
  const { cli } = buildCli();

  expect(() =>
    cli.parse(["node", "test", "run", "--images", "a.png", "--images", "b.png"], { run: false }),
  ).toThrow("Option --images was provided multiple times.");
});

test("createShopCli keeps repeated boolean options as a single value", async () => {
  const { cli, getOptions } = buildCli();

  cli.parse(["node", "test", "run", "--force=false", "--force=false", "--all", "--all"], {
    run: false,
  });
  await cli.runMatchedCommand();

  expect(getOptions()).toMatchObject({ force: false, all: true });
});

test("createShopCli parses = values for hyphenated boolean options", async () => {
  const { cli, getOptions } = buildCli();

  cli.parse(["node", "test", "run", "--clear-note=true", "--force=0"], { run: false });
  await cli.runMatchedCommand();

  expect(getOptions()).toMatchObject({ clearNote: true, force: false });
});

test("createShopCli keeps boolean =false values as booleans", async () => {
  const { cli, getOptions } = buildCli();

  cli.parse(["node", "test", "run", "--json=false", "--force=false", "--stdin=false"], {
    run: false,
  });
  await cli.runMatchedCommand();

  expect(getOptions()).toMatchObject({ json: false, force: false, stdin: false });
});

test("createShopCli handles negated boolean options", async () => {
  const { cli, getOptions } = buildCli();

  cli.parse(["node", "test", "run", "--no-json", "value"], { run: false });
  await cli.runMatchedCommand();

  expect(getOptions()).toMatchObject({ json: false });
  expect(cli.args).toEqual(["value"]);
});

test("createShopCli keeps empty = values and following positional arguments", async () => {
  const { cli, getOptions } = buildCli();

  cli.parse(["node", "test", "run", "--images=", "value"], { run: false });
  await cli.runMatchedCommand();

  expect(getOptions()).toMatchObject({ images: "" });
  expect(cli.args).toEqual(["value"]);
});

test("createShopCli leaves arguments after -- unchanged", async () => {
  const { cli, getOptions } = buildCli();

  cli.parse(["node", "test", "run", "--", "--file", "-"], { run: false });
  await cli.runMatchedCommand();

  expect(getOptions()).toMatchObject({ "--": ["--file", "-"] });
  expect(getOptions()).not.toHaveProperty("file");
});

test("createShopCli does not consume positional arguments after hyphenated boolean flags", async () => {
  const { cli, getOptions } = buildCli();

  cli.parse(["node", "test", "run", "--clear-note", "value"], { run: false });
  await cli.runMatchedCommand();

  expect(getOptions()).toMatchObject({ clearNote: true });
  expect(cli.args).toEqual(["value"]);
});

test("createShopCli preserves positional arguments after hyphenated boolean = values", async () => {
  const { cli, getOptions } = buildCli();

  cli.parse(["node", "test", "run", "--clear-note=true", "value"], { run: false });
  await cli.runMatchedCommand();

  expect(getOptions()).toMatchObject({ clearNote: true });
  expect(cli.args).toEqual(["value"]);
});

test("createShopCli preserves positional arguments after negated boolean = values", async () => {
  const { cli, getOptions } = buildCli();

  cli.parse(["node", "test", "run", "--no-clear-note=false", "value"], { run: false });
  await cli.runMatchedCommand();

  expect(getOptions()).toMatchObject({ clearNote: true });
  expect(cli.args).toEqual(["value"]);
});

test("createShopCli does not consume a positional argument for a boolean flag", async () => {
  const { cli, getOptions } = buildCli();

  cli.parse(["node", "test", "run", "--all", "value"], { run: false });
  await cli.runMatchedCommand();

  expect(getOptions()).toMatchObject({ all: true });
  expect(cli.args).toEqual(["value"]);
});
