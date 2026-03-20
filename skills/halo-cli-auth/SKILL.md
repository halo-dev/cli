---
name: halo-cli-auth
version: 1.0.0
description: Use when working with Halo CLI login, bearer token or basic auth, profile setup, profile switching, current profile inspection, or fixing missing keyring credentials.
references:
  - ../halo-cli-shared
metadata:
  openclaw:
    category: developer-tools
    requires:
      bins: ["halo"]
    cliHelp: "halo auth --help"
---

# Halo CLI Auth

Use this skill for `halo auth` and `halo auth profile`.

If authentication is not set up yet, do this first before running `post`, `single-page`, `plugin`, `theme`, `attachment`, `backup`, `moment`, `comment`, or `notification` commands.

## Commands

```bash
halo auth --help
halo auth login --help
halo auth profile --help
```

Main workflows:

- `halo auth login`
- `halo auth current`
- `halo auth profile list`
- `halo auth profile current`
- `halo auth profile get <name>`
- `halo auth profile use <name>`
- `halo auth profile delete <name>`
- `halo auth profile doctor`

## Common Flows

Login with bearer token:

```bash
halo auth login \
  --profile local \
  --url http://127.0.0.1:8090 \
  --auth-type bearer \
  --token <token>
```

Login with basic auth:

```bash
halo auth login \
  --profile local \
  --url http://127.0.0.1:8090 \
  --auth-type basic \
  --username admin \
  --password <password>
```

Inspect and switch profiles:

```bash
halo auth current
halo auth profile list
halo auth profile use production
halo auth profile get production --json
```

Diagnose broken credentials:

```bash
halo auth profile doctor
halo auth profile delete production --force
halo auth login --profile production --url https://halo.example.com --auth-type bearer --token <token>
```

## Rules

- In non-interactive mode, `halo auth login` requires `--profile`, `--url`, and `--auth-type`.
- `basic` auth requires `--username` and `--password`.
- `bearer` auth requires `--token`.
- Use `--json` when another tool needs structured output.
- `profile delete` is destructive; use `--force` in non-interactive mode.
- Profile metadata lives in config, but secrets live in the system keyring.

## Routing

- Use `halo-cli-content` for posts and single pages.
- Use `halo-cli-search` for public site search.
- Use `halo-cli-operations` for themes, plugins, attachments, backups, and moments.
- Use `halo-cli-moderation-notifications` for comments, replies, and notifications.
