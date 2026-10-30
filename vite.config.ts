import { fileURLToPath } from "node:url";

import { defineConfig } from "vite-plus";
import { configDefaults } from "vite-plus/test/config";

export default defineConfig({
  pack: {
    deps: {
      // tsdown <0.23 compatibility: resolve external dependency subpaths.
      // Remove to preserve subpath imports as written (the new default).
      // https://tsdown.dev/options/dependencies#deps-resolvedepsubpath
      resolveDepSubpath: true,
    },
    entry: ["src/cli.ts"],
    format: ["esm"],
    dts: {
      generator: "tsgo",
    },
    clean: true,
    outDir: "dist",
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    environment: "node",
    include: ["src/**/__test__/**/*.spec.ts"],
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
