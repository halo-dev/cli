import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, test } from "vite-plus/test";

import { loadFileAsJar, loadFileAsPackage, loadFileAsZip } from "../package-file.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createTempFile(fileName: string, content: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "halo-cli-package-file-"));
  tempDirectories.push(directory);

  const filePath = join(directory, fileName);
  await writeFile(filePath, content);

  return filePath;
}

test("loadFileAsPackage loads file contents and preserves custom metadata", async () => {
  const filePath = await createTempFile("plugin.jar", "demo-plugin");

  const file = await loadFileAsPackage(filePath, {
    type: "application/x-demo",
    fileName: "renamed.pkg",
  });

  expect(file).toBeInstanceOf(File);
  expect(file.name).toBe("renamed.pkg");
  expect(file.type).toBe("application/x-demo");
  await expect(file.text()).resolves.toBe("demo-plugin");
});

test("loadFileAsPackage falls back to the basename when fileName is omitted", async () => {
  const filePath = await createTempFile("theme.zip", "demo-theme");

  const file = await loadFileAsPackage(filePath, {
    type: "application/octet-stream",
  });

  expect(file.name).toBe("theme.zip");
  expect(file.type).toBe("application/octet-stream");
  await expect(file.text()).resolves.toBe("demo-theme");
});

test("loadFileAsJar uses the java archive content type", async () => {
  const filePath = await createTempFile("sample.jar", "jar-content");

  const file = await loadFileAsJar(filePath);

  expect(file.name).toBe("sample.jar");
  expect(file.type).toBe("application/java-archive");
  await expect(file.text()).resolves.toBe("jar-content");
});

test("loadFileAsZip uses the zip content type", async () => {
  const filePath = await createTempFile("sample.zip", "zip-content");

  const file = await loadFileAsZip(filePath);

  expect(file.name).toBe("sample.zip");
  expect(file.type).toBe("application/zip");
  await expect(file.text()).resolves.toBe("zip-content");
});
