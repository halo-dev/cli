import { readFile } from "node:fs/promises";
import { basename } from "node:path";

export interface PackageFileOptions {
  type: string;
  fileName?: string;
}

export async function loadFileAsPackage(
  filePath: string,
  options: PackageFileOptions,
): Promise<File> {
  const buffer = await readFile(filePath);
  return new File([buffer], options.fileName ?? basename(filePath), {
    type: options.type,
  });
}

export async function loadFileAsJar(filePath: string): Promise<File> {
  return loadFileAsPackage(filePath, {
    type: "application/java-archive",
  });
}

export async function loadFileAsZip(filePath: string): Promise<File> {
  return loadFileAsPackage(filePath, {
    type: "application/zip",
  });
}
