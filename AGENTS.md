<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, but it invokes Vite through `vp dev` and `vp build`.

## Vite+ Workflow

`vp` is a global binary that handles the full development lifecycle. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

### Start

- create - Create a new project from a template
- migrate - Migrate an existing project to Vite+
- config - Configure hooks and agent integration
- staged - Run linters on staged files
- install (`i`) - Install dependencies
- env - Manage Node.js versions

### Develop

- dev - Run the development server
- check - Run format, lint, and TypeScript type checks
- lint - Lint code
- fmt - Format code
- test - Run tests

### Execute

- run - Run monorepo tasks
- exec - Execute a command from local `node_modules/.bin`
- dlx - Execute a package binary without installing it as a dependency
- cache - Manage the task cache

### Build

- build - Build for production
- pack - Build libraries
- preview - Preview production build

### Manage Dependencies

Vite+ automatically detects and wraps the underlying package manager such as pnpm, npm, or Yarn through the `packageManager` field in `package.json` or package manager-specific lockfiles.

- add - Add packages to dependencies
- remove (`rm`, `un`, `uninstall`) - Remove packages from dependencies
- update (`up`) - Update packages to latest versions
- dedupe - Deduplicate dependencies
- outdated - Check for outdated packages
- list (`ls`) - List installed packages
- why (`explain`) - Show why a package is installed
- info (`view`, `show`) - View package information from the registry
- link (`ln`) / unlink - Manage local package links
- pm - Forward a command to the package manager

### Maintain

- upgrade - Update `vp` itself to the latest version

These commands map to their corresponding tools. For example, `vp dev --port 3000` runs Vite's dev server and works the same as Vite. `vp test` runs JavaScript tests through the bundled Vitest. The version of all tools can be checked using `vp --version`. This is useful when researching documentation, features, and bugs.

## Common Pitfalls

- **Using the package manager directly:** Do not use pnpm, npm, or Yarn directly. Vite+ can handle all package manager operations.
- **Always use Vite commands to run tools:** Don't attempt to run `vp vitest` or `vp oxlint`. They do not exist. Use `vp test` and `vp lint` instead.
- **Running scripts:** Vite+ commands take precedence over `package.json` scripts. If there is a `test` script defined in `scripts` that conflicts with the built-in `vp test` command, run it using `vp run test`.
- **Do not install Vitest, Oxlint, Oxfmt, or tsdown directly:** Vite+ wraps these tools. They must not be installed directly. You cannot upgrade these tools by installing their latest versions. Always use Vite+ commands.
- **Use Vite+ wrappers for one-off binaries:** Use `vp dlx` instead of package-manager-specific `dlx`/`npx` commands.
- **Import JavaScript modules from `vite-plus`:** Instead of importing from `vite` or `vitest`, all modules should be imported from the project's `vite-plus` dependency. For example, `import { defineConfig } from 'vite-plus';` or `import { expect, test, vi } from 'vite-plus/test';`. You must not install `vitest` to import test utilities.
- **Type-Aware Linting:** There is no need to install `oxlint-tsgolint`, `vp lint --type-aware` works out of the box.

## Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
<!--VITE PLUS END-->

# Project Status

This repository is a TypeScript CLI for managing Halo instances.

## Runtime and Packaging

- Runtime: Node.js >= 20
- Language: TypeScript, ESM
- CLI entry: `src/cli.ts`
- Published binary: `halo`
- Local development entry: `tsx src/cli.ts`
- Build output: `dist/cli.mjs`

## Current Command Surface

The root CLI currently registers these business areas:

- `auth`
- `post`
- `search`
- `plugin`
- `theme`
- `attachment`
- `backup`
- `moment`
- `comment`

## Command Architecture

This project no longer implements large nested command trees directly on the root `cac` instance.

Use this pattern instead:

1. Register a placeholder root command in `src/cli.ts` via `registerXxxCommands(cli)`.
2. Implement a dedicated sub-CLI in `src/commands/xxx.ts` with its own `cac("halo xxx")` instance.
3. Export `tryRunXxxCommand(args, runtime)`.
4. In `src/cli.ts`, dispatch in order by calling `tryRunXxxCommand(...)` before the final root parse.

This pattern is important because it gives correct help output for:

- `halo xxx`
- `halo xxx --help`
- nested subcommands like `halo comment reply`

If a business area has a nested namespace, create another dedicated sub-CLI for that nested branch instead of trying to handle help manually in a single root command.

## Runtime and Auth Model

Authentication and HTTP clients are centralized in `src/utils/runtime.ts`.

- `RuntimeContext.getClientsForOptions(...)` returns:
  - `clients.axios`
  - `clients.console`
  - `clients.core`
- Auth supports:
  - Basic Auth
  - Bearer token
- Profile storage is handled by `src/utils/config-store.ts`
- Config path defaults to:
  - `$HALO_CLI_CONFIG_DIR/config.json` if set
  - otherwise `$XDG_CONFIG_HOME/halo/config.json`
  - otherwise `~/.config/halo/config.json`

## Implemented Business Areas

### `auth`

- login
- current
- profile list/current/use
- supports multi-profile management

### `post`

- list/get/create/update/delete/open
- uses Halo UC post APIs
- draft content is persisted through content annotations
- create/update support taxonomy resolution and creation for categories/tags

### `search`

- public site search
- does not require authenticated console access when `--url` is provided

### `plugin`

- list/get/enable/disable/install/uninstall/upgrade and related management flows
- includes App Store-aware upgrade logic

### `theme`

- list/get/current/install/upgrade/activate/reload/delete
- uses Halo theme console/core APIs
- includes App Store-aware upgrade logic similar to `plugin`
- local installation uses multipart upload to the theme install endpoint because the generated SDK install signature is not file-parameter-friendly
- `list` marks the currently activated theme in table output

### `attachment`

- list/get/delete/upload/download
- upload/download include progress feedback in TTY mode

### `backup`

- list/get/create/download/delete
- `create --wait` polls until completion

### `moment`

- list/get/create/update/delete
- does not use `@halo-dev/api-client` for business APIs
- uses manual `axios` requests against the moments plugin UC endpoints
- this was necessary because the main Halo SDK does not expose moments business APIs

### `comment`

- `comment list`
- `comment get`
- `comment approve`
- `comment delete`
- `comment create-reply`
- `comment reply list`
- `comment reply get`
- `comment reply approve`
- `comment reply delete`

Comment approval behavior follows the Halo console frontend:

- approving a comment uses `core.content.comment.patchComment` with JSON Patch
- approving a reply uses `core.content.reply.patchReply` with JSON Patch
- creating a reply uses `console.content.comment.createReply`, which creates an already approved reply in console context

## Formatting and Output Conventions

Output helpers live in `src/utils/format.ts`.

- Prefer adding business-specific `printXxxList(...)` and `printXxx(...)` helpers there
- Table output is standardized via `cli-table3`
- Time formatting uses `dayjs`
- Byte formatting uses `pretty-bytes`
- JSON output is controlled by `--json`

When adding a new business area, keep raw object printing out of command files as much as possible and route formatting through `src/utils/format.ts`.

## UX Conventions

- Use `@inquirer/prompts` for interactive flows only when running in TTY mode
- Use `CliError` for user-facing validation errors
- Require `--force` for destructive operations in non-interactive mode
- Prefer consistent success/cancel/delete messaging with existing commands
- For long-running upload/download/polling flows, use `ora` when stdout is a TTY and `--json` is not enabled

## Validation Workflow

For dependency management and general project tooling, prefer Vite+ as described above.

For this CLI specifically, the most useful validation commands are:

- `pnpm typecheck`
- `vp lint`
- `vp check`
- `vp test`

`pnpm typecheck` is currently the fastest way to catch TypeScript regressions during command development.

## Extension Guidance

When implementing a new command area:

1. Check whether `@halo-dev/api-client` already exposes the needed console/core/public API.
2. If it does, prefer the SDK over manual HTTP.
3. If it does not, inspect upstream Halo or plugin code under `current-repos/` and implement with manual `axios` requests.
4. Keep root command registration minimal and put real logic in a dedicated sub-CLI file under `src/commands/`.
5. Add list/detail printers in `src/utils/format.ts`.
6. Validate with typecheck and lint before finishing.

## Upstream Reference Repositories

The workspace currently includes reference repos under `current-repos/`:

- `halo/`
- `plugin-app-store/`
- `plugin-moments/`
- `vscode-extension-halo/`

These are used as implementation references for API behavior, frontend console behavior, and feature parity.
