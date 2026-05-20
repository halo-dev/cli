# AGENTS.md

This file follows the open AGENTS.md convention from https://agents.md. Treat it as
the agent-facing README for this repository: use it to get oriented, make changes
in the existing style, and run the right checks before handing work back.

## Project Overview

`@halo-dev/cli` is a TypeScript, ESM-based CLI for managing Halo instances.

- Runtime: Node.js >= 22
- Published binary: `halo`
- Source entry: `src/cli.ts`
- Local development entry: `tsx src/cli.ts`
- Build output: `dist/cli.mjs`
- Package manager: Vite+ wraps the underlying package manager; prefer `vp`
  commands for project tooling.

The root CLI currently exposes these business areas:

- `auth`
- `post`
- `single-page`
- `search`
- `plugin`
- `theme`
- `attachment`
- `backup`
- `moment`
- `comment`
- `notification`
- `completion`

## Setup Commands

- Install dependencies after pulling changes: `vp install`
- Run the CLI from source: `vp exec tsx src/cli.ts --help`
- Run a command from source: `vp exec tsx src/cli.ts <command> ...`
- Build the published CLI: `vp build`

Do not use `pnpm`, `npm`, or `yarn` directly for dependency management unless the
user explicitly asks for it. Vite+ is the project toolchain wrapper.

## Validation Commands

Use the smallest useful check while iterating, then run broader checks before
finishing a meaningful change.

- Fast TypeScript regression check: `pnpm typecheck`
- Lint: `vp lint`
- Full project check: `vp check`
- Tests: `vp test`
- Build: `vp build`

`pnpm typecheck` is intentionally kept here because it is currently the fastest
way to catch TypeScript regressions in this CLI. For Vite+, do not run commands
such as `vp vitest` or `vp oxlint`; use `vp test` and `vp lint`.

## Vite+ Rules

This project uses Vite+, a unified toolchain built on top of Vite, Rolldown,
Vitest, tsdown, Oxlint, Oxfmt, and Vite Task.

- Run `vp help` or `vp <command> --help` for command details.
- Use `vp run <script>` when you need a `package.json` script whose name
  conflicts with a Vite+ built-in command.
- Use `vp dlx` for one-off package binaries.
- Import Vite+ APIs from `vite-plus`, for example
  `import { defineConfig } from "vite-plus";`.
- Import test APIs from `vite-plus/test`, for example
  `import { expect, test, vi } from "vite-plus/test";`.
- Do not add direct dependencies on Vitest, Oxlint, Oxfmt, or tsdown just to use
  their CLIs or APIs.
- Type-aware linting is available through `vp lint --type-aware`; do not add
  `oxlint-tsgolint` for that purpose.

## Command Architecture

Keep the root `cac` instance small. Do not implement large nested command trees
directly in `src/cli.ts`.

For each business area:

1. Register only a placeholder root command in `src/cli.ts` via
   `registerXxxCommands(cli)`.
2. Put the real command implementation in `src/commands/<area>/index.ts`.
3. Create a dedicated sub-CLI with `cac("halo <area>")`.
4. Export `tryRunXxxCommand(args, runtime)`.
5. Dispatch from `src/cli.ts` by calling each `tryRunXxxCommand(...)` before the
   final root parse.

This pattern preserves correct help output for `halo <area>`,
`halo <area> --help`, and nested namespaces such as `halo comment reply`.

If a business area needs a nested namespace, create another dedicated sub-CLI for
that branch. Avoid manual help handling inside one large command tree.

## File Organization

Prefer command-local files for command-local behavior:

- Command entry: `src/commands/<area>/index.ts`
- Formatting: `src/commands/<area>/format.ts`
- Input parsing or prompts: `src/commands/<area>/input.ts`
- Types: `src/commands/<area>/types.ts`
- Browser or file helpers: colocate under the owning command directory
- Tests: `src/commands/<area>/__test__/`

Use shared modules only for behavior reused across command areas:

- Auth and profiles: `src/shared/profile.ts`
- Runtime client construction: `src/utils/runtime.ts`
- Generic output helpers: `src/utils/output.ts`
- Config storage: `src/utils/config-store.ts`
- Credential storage: `src/utils/credential-store.ts`
- URL normalization: `src/utils/url.ts`
- Package upload helpers: `src/utils/package-file.ts`

Do not move command-local types, prompts, browser helpers, file helpers, or tests
back into shared roots unless at least two command areas actually need them.

## Runtime And Auth

Authentication and HTTP client construction are centralized in
`src/utils/runtime.ts`.

- Keep `RuntimeContext` narrow: it resolves profiles and constructs clients.
- `RuntimeContext.getClientsForOptions(...)` returns `clients.axios`,
  `clients.console`, and `clients.core`.
- Shared profile models live in `src/shared/profile.ts`.
- Auth supports Basic Auth and bearer tokens.
- Profile metadata is stored in `config.json`.
- Credentials are stored in the system keyring via `@napi-rs/keyring`.
- Deleting a profile must also delete the corresponding keyring credentials.
- `auth profile doctor` should remain useful for diagnosing config/keyring drift.

Config path precedence:

1. `$HALO_CLI_CONFIG_DIR/config.json`
2. `$XDG_CONFIG_HOME/halo/config.json`
3. `~/.config/halo/config.json`

## API Usage

When implementing or extending a command:

1. Check whether `@halo-dev/api-client` exposes the needed console, core, UC, or
   public API.
2. Prefer the SDK when it has the required API.
3. If the SDK does not expose the API, inspect upstream references under
   `current-repos/` and use manual `axios` requests.
4. Keep manual HTTP clients behind the command area or a clearly shared helper.

Current upstream reference repositories:

- `current-repos/halo/`
- `current-repos/plugin-app-store/`
- `current-repos/plugin-moments/`
- `current-repos/vscode-extension-halo/`

Use these as references for API behavior, Console behavior, and feature parity.

## Output Conventions

- JSON output is controlled by `--json`.
- Table output uses `cli-table3`.
- Time formatting uses `dayjs`.
- Byte formatting uses `pretty-bytes`.
- Generic JSON/detail helpers belong in `src/utils/output.ts`.
- Business-specific formatters should live in the owning command area, usually
  `src/commands/<area>/format.ts`.

Avoid raw object printing in command files. Route business output through a
command-local formatter first, and use `src/utils/output.ts` only for generic
helpers.

## UX And Safety

- Use `CliError` for user-facing validation errors.
- Use `@inquirer/prompts` only for interactive flows in TTY mode.
- Dangerous operations must require explicit confirmation in TTY mode.
- Dangerous non-interactive operations must require `--force`.
- Treat delete, uninstall, disable, and similar mutating operations as dangerous.
- Keep success, cancel, and delete messages consistent with nearby commands.
- Use `ora` for long-running upload, download, or polling flows only when stdout
  is a TTY and `--json` is not enabled.
- Preserve machine-readable output when `--json` is set.

## Testing Instructions

- Co-locate command tests under `src/commands/<area>/__test__/`.
- Keep cross-cutting utility tests under `src/utils/__test__/`.
- Keep shared integration tests under `src/shared/**/__test__/`.
- When moving command logic into a command folder, move its tests with it.
- Add or update tests for changed behavior, especially parsing, output shape,
  confirmation behavior, and command dispatch/help behavior.
- Prefer focused tests while developing; run `vp test` before finishing
  behavior changes.

## Command Area Notes

- `post` and `single-page` use Halo UC content APIs and persist draft content
  through content annotations.
- `post import-json` and `post export-json` use the `{ post, content }` payload
  shape returned by `post get --json`.
- `plugin` and `theme` include App Store-aware upgrade logic.
- `theme install` uses multipart upload because the generated SDK install
  signature is not file-parameter-friendly.
- `attachment` upload/download commands include progress feedback in TTY mode.
- `backup create --wait` polls until completion.
- `moment` uses manual `axios` requests against the moments plugin UC endpoints
  because the main Halo SDK does not expose moments business APIs.
- `comment` approval follows Halo Console behavior with JSON Patch through the
  core comment/reply APIs.
- `comment create-reply` uses the console API and creates an already approved
  reply in console context.
- `notification get` filters the authenticated user's notification list by
  `metadata.name`.

## Pull Request Checklist

Before handing off a non-trivial change:

- Confirm the implementation follows the dedicated sub-CLI architecture.
- Confirm command-local helpers and tests stayed in the owning command folder.
- Run `pnpm typecheck` for TypeScript changes.
- Run `vp lint`, `vp check`, or `vp test` when the change scope justifies it.
- Mention any checks that were not run and why.
