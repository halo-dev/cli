---
name: halo-auth
version: 1.0.0
description: "Halo CLI: authentication, profiles, and connection setup."
metadata:
  openclaw:
    category: "developer-tools"
    requires:
      bins: ["halo"]
    cliHelp: "halo auth --help"
---

# halo auth

Use this skill when you need to authenticate to a Halo instance, manage saved profiles, switch between environments, or verify that stored credentials are healthy.

> **PREREQUISITE:** Start with `../halo-shared/SKILL.md` for global usage patterns, JSON output behavior, profile selection, and safety conventions.

## What this skill covers

This skill is for:

- logging in to a Halo instance
- saving credentials under a named profile
- switching the active profile
- inspecting saved profiles
- deleting profiles
- checking profile/keyring consistency

It is **not** for managing posts, pages, plugins, themes, or attachments directly.

## Core commands

```bash
halo auth <command> [flags]
halo auth profile <command> [flags]
```

## Quick start

### Login with bearer token

```bash
halo auth login \
  --profile local \
  --url http://127.0.0.1:8090 \
  --auth-type bearer \
  --token <your-token>
```

### Login with basic auth

```bash
halo auth login \
  --profile local \
  --url http://127.0.0.1:8090 \
  --auth-type basic \
  --username admin \
  --password <your-password>
```

### Check current profile

```bash
halo auth current
```

### List saved profiles

```bash
halo auth profile list
```

### Switch active profile

```bash
halo auth profile use local
```

## Available commands

### `halo auth login`

Log in to a Halo instance and save a profile.

Flags:

- `--profile <name>` — profile name to save
- `--url <url>` — Halo base URL
- `--auth-type <basic|bearer>` — authentication type
- `--username <username>` — required for basic auth
- `--password <password>` — required for basic auth
- `--token <token>` — required for bearer auth
- `--json` — output machine-readable JSON

Examples:

```bash
halo auth login --profile local --url http://127.0.0.1:8090 --auth-type bearer --token <token>
halo auth login --profile prod --url https://halo.example.com --auth-type basic --username admin --password <password>
```

### `halo auth current`

Show the current active profile.

Flags:

- `--profile <name>` — inspect a specific profile by name
- `--json`

Examples:

```bash
halo auth current
halo auth current --json
```

### `halo auth profile list`

List all saved profiles.

Flags:

- `--json`

Examples:

```bash
halo auth profile list
halo auth profile list --json
```

### `halo auth profile current`

Show the active saved profile.

Flags:

- `--json`

Examples:

```bash
halo auth profile current
halo auth profile current --json
```

### `halo auth profile get [name]`

Show one saved profile.

Flags:

- `--profile <name>` — alternative way to provide the name
- `--json`

Examples:

```bash
halo auth profile get local
halo auth profile get --profile production --json
```

### `halo auth profile use [name]`

Switch the active profile.

Flags:

- `--profile <name>` — alternative way to provide the name
- `--json`

Examples:

```bash
halo auth profile use local
halo auth profile use --profile production
```

### `halo auth profile delete [name]`

Delete a saved profile and its stored credentials.

Flags:

- `--profile <name>` — alternative way to provide the name
- `--force` — skip confirmation in non-interactive use
- `--json`

Examples:

```bash
halo auth profile delete local --force
halo auth profile delete --profile production
```

### `halo auth profile doctor`

Check saved profiles against stored credentials.

Flags:

- `--json`

Examples:

```bash
halo auth profile doctor
halo auth profile doctor --json
```

## Common workflows

## 1. Create local and production profiles

```bash
halo auth login --profile local --url http://127.0.0.1:8090 --auth-type bearer --token <local-token>
halo auth login --profile production --url https://halo.example.com --auth-type bearer --token <prod-token>
```

Then verify:

```bash
halo auth profile list
```

## 2. Switch before running a command

```bash
halo auth profile use production
halo post list
```

Or avoid switching globally and pass the profile explicitly:

```bash
halo post list --profile production
```

## 3. Diagnose a broken profile

```bash
halo auth profile doctor
halo auth profile get production
```

If a profile exists but credentials are missing or invalid, delete it and log in again:

```bash
halo auth profile delete production --force
halo auth login --profile production --url https://halo.example.com --auth-type bearer --token <new-token>
```

## Non-interactive usage rules

For scripts and automation:

- always pass all required login flags explicitly
- prefer `--json` when downstream tooling parses output
- use `--force` for destructive profile operations in non-interactive contexts

Example:

```bash
halo auth login --profile ci --url https://halo.example.com --auth-type bearer --token "$HALO_TOKEN" --json
```

## Output behavior

Most auth commands support `--json`.

Without `--json`, output is human-readable.
With `--json`, output is structured for automation.

Examples:

```bash
halo auth current --json
halo auth profile list --json
halo auth profile doctor --json
```

## Discovery tips

Inspect help before choosing flags:

```bash
halo auth --help
halo auth login --help
halo auth profile --help
halo auth profile doctor --help
```

## Safety notes

- profile metadata is saved in config
- actual credentials are stored separately in the system keyring
- deleting a profile should also remove its saved credentials
- avoid putting raw passwords or tokens directly into shell history on shared systems

## Recommended next skills

After auth is set up, continue with:

- `../halo-content/SKILL.md` for `post` and `single-page`
- `../halo-operations/SKILL.md` for `plugin`, `theme`, `attachment`, `backup`, and `moment`
- `../halo-moderation-notifications/SKILL.md` for `comment` and `notification`
