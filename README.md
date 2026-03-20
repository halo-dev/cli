# Halo CLI

[简体中文](./README.zh-CN.md)

A command-line tool for managing [Halo](https://www.halo.run) instances.

## Install

```sh
npm install -g @halo-dev/cli
```

The installed binary is:

```sh
halo
```

Check the version:

```sh
halo --version
```

## Requirements

- Node.js `>= 22`

## Quick Start

### Login with a bearer token

```sh
halo auth login \
  --profile local \
  --url http://127.0.0.1:8090 \
  --auth-type bearer \
  --token <your-token>
```

### Login with Basic Auth

Before using Basic Auth, make sure your Halo instance enables it.

Start Halo with:

```sh
--halo.security.basic-auth.disabled=false
```

Then login:

```sh
halo auth login \
  --profile local \
  --url http://127.0.0.1:8090 \
  --auth-type basic \
  --username admin \
  --password <your-password>
```

### Verify the current profile

```sh
halo auth current
halo auth profile list
```

## Common Usage

Get help:

```sh
halo --help
halo auth --help
halo post --help
halo single-page --help
```

Example root help output:

```text
halo/1.0.0

Usage:
  $ halo <command> [options]

Commands:
  auth          Authentication commands
  post          Post management commands
  single-page   Single page management commands
  search        Search public site content
  plugin        Plugin management commands
  theme         Theme management commands
  attachment    Attachment management commands
  backup        Backup management commands
  moment        Moment management commands
  comment       Comment management commands
  notification  Notification management commands

For more info, run any command with the `--help` flag:
  $ halo auth --help
  $ halo post --help
  $ halo single-page --help
  $ halo search --help
  $ halo plugin --help
  $ halo theme --help
  $ halo attachment --help
  $ halo backup --help
  $ halo moment --help
  $ halo comment --help
  $ halo notification --help

Options:
  -h, --help     Display this message
  -v, --version  Display version number
```

Use a specific saved profile:

```sh
halo post list --profile production
```

Use JSON output for scripting:

```sh
halo post list --json
halo single-page get about --json
```

## Main Command Areas

Halo CLI currently includes these command groups:

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

For details on any command, use `--help`.

## Agent Skills

This package also ships with reusable skills under the root `skills/` directory.

Included skills:

- `halo`
- `halo-shared`
- `halo-auth`
- `halo-content`
- `halo-search`
- `halo-operations`
- `halo-moderation-notifications`

Add the skills with:

```sh
npx skills add halo-dev/cli
```

Recommended starting point after installation:

```sh
skills/halo/SKILL.md
```

## Configuration

Profile metadata is stored in:

- `$HALO_CLI_CONFIG_DIR/config.json` if `HALO_CLI_CONFIG_DIR` is set
- otherwise `$XDG_CONFIG_HOME/halo/config.json`
- otherwise `~/.config/halo/config.json`

Credentials are stored in the system keyring.

## Development

Useful commands:

```sh
pnpm typecheck
vp lint
vp test
vp pack
```

## Publishing

Before publishing, verify the package contents:

```sh
npm pack --dry-run
```

The published package should include:

- `dist/`
- `skills/`
- `README.md`
- `LICENSE`

## License

MIT
