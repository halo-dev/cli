import { fileURLToPath } from "node:url";

import { defineConfig } from "vite-plus";
import { configDefaults } from "vitest/config";

export default defineConfig({
  pack: {
    entry: ["src/cli.ts"],
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "node20",
    outDir: "dist",
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.spec.ts"],
    root: fileURLToPath(new URL("./", import.meta.url)),
    exclude: [...configDefaults.exclude],
  },
  staged: {
    "*": "vp check --fix",
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  fmt: {
    printWidth: 100,
    useTabs: false,
    tabWidth: 2,
    sortImports: {},
    sortPackageJson: true,
    insertFinalNewline: true,
  },
});
