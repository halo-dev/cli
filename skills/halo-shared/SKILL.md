---
name: halo-shared
version: 1.0.0
description: "Shared usage guidance for Halo CLI: installation, authentication, profiles, global flags, JSON output, and safety rules."
metadata:
  openclaw:
    category: "developer-tools"
    requires:
      bins: ["halo"]
    cliHelp: "halo --help"
---

# halo-shared

Use this skill as the starting point for working with Halo CLI.

It covers:

- installation and binary name
- authentication and profile setup
- global usage patterns
- JSON output and scripting conventions
- destructive action safety rules
- how to discover command-specific help

If you need a more specific workflow, read one of the companion skills after this one:

- `../halo-auth/SKILL.md`
- `../halo-content/SKILL.md`
- `../halo-operations/SKILL.md`
- `../halo-moderation-notifications/SKILL.md`

## Install

Install globally from npm:

```bash
npm install -g @halo-dev/cli
```

The executable name is:

```bash
halo
```

Check the installed version:

```bash
halo --version
```

## Discovering Commands

Start from root help:

```bash
halo --help
```

Inspect a command area:

```bash
halo auth --help
halo post --help
halo single-page --help
halo plugin --help
halo theme --help
halo attachment --help
halo backup --help
halo moment --help
halo comment --help
halo notification --help
```

Inspect a specific command:

```bash
halo post create --help
halo single-page import-json --help
halo plugin upgrade --help
```

## Root Command Areas

Halo CLI currently exposes these top-level areas:

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

## Authentication and Profiles

Most commands operate against an authenticated Halo profile.

Typical login with a bearer token:

```bash
halo auth login \
  --profile local \
  --url http://127.0.0.1:8090 \
  --auth-type bearer \
  --token <token>
```

Typical login with basic auth:

```bash
halo auth login \
  --profile local \
  --url http://127.0.0.1:8090 \
  --auth-type basic \
  --username admin \
  --password <password>
```

Useful profile commands:

```bash
halo auth current
halo auth profile list
halo auth profile get local
halo auth profile use local
halo auth profile delete local --force
halo auth profile doctor
```

## Global Flags and Usage Patterns

Many commands support:

- `--profile <name>` to choose a saved profile
- `--json` for machine-readable output

Examples:

```bash
halo post list --profile production
halo single-page get about --json
halo plugin list --json
halo notification list --profile local --json
```

## JSON Output Rules

Use `--json` when you want to script against the CLI.

Examples:

```bash
halo post list --json
halo theme current --json
halo attachment get attachment-name --json
```

When using `--json`:

- prefer parsing stdout as structured JSON
- avoid relying on human-readable table output
- use profile selection explicitly in automation when needed

## Safety Rules

Some commands are destructive or change server state.

Examples include:

- delete
- uninstall
- disable
- import/update flows that overwrite existing content

Rules:

- in interactive terminals, the CLI may ask for confirmation
- in non-interactive flows, use `--force` when required
- do not assume mutating commands are safe to retry blindly

Examples:

```bash
halo post delete my-post --force
halo theme delete theme-name --force
halo notification delete notification-name --force
```

## Public vs Authenticated Workflows

Most command areas require authentication.

The main exception is `search`, which can query a public site directly when `--url` is provided:

```bash
halo search --keyword "halo" --url https://www.halo.run
```

## Common Output Modes

Human-readable mode typically prints:

- tables for lists
- structured detail output for single resources
- progress indicators for long-running uploads/downloads

JSON mode prints serialized objects suitable for automation:

```bash
halo backup list --json
halo comment get comment-name --json
```

## Configuration Location

Halo CLI stores profile metadata in a config file and stores secrets in the system keyring.

Default config path resolution:

- `$HALO_CLI_CONFIG_DIR/config.json` if `HALO_CLI_CONFIG_DIR` is set
- otherwise `$XDG_CONFIG_HOME/halo/config.json`
- otherwise `~/.config/halo/config.json`

## Recommended Workflow

1. Install the CLI
2. Login and save a profile
3. Verify the current profile
4. Inspect command help
5. Run read-only commands first
6. Use `--json` for automation
7. Use `--force` carefully for destructive operations

Example:

```bash
halo auth login --profile local --url http://127.0.0.1:8090 --auth-type bearer --token <token>
halo auth current
halo post list
halo single-page list
```

## Next Skills

Read these for deeper workflows:

- `../halo-auth/SKILL.md` for login and profile management
- `../halo-content/SKILL.md` for posts and single pages
- `../halo-operations/SKILL.md` for plugins, themes, attachments, backups, and moments
- `../halo-moderation-notifications/SKILL.md` for comments, replies, and notifications
