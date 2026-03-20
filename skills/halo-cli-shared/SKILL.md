---
name: halo-cli-shared
version: 1.0.0
description: Use when a task broadly involves Halo CLI and the correct command area is not yet clear, or when you need shared rules for profiles, JSON output, help discovery, config paths, and destructive actions.
metadata:
  openclaw:
    category: developer-tools
    requires:
      bins: ["halo"]
    cliHelp: "halo --help"
---

# Halo CLI Shared

Start here when the task says "use Halo CLI" but does not yet say whether it is auth, content, search, operations, or moderation.

## Install And Verify

Install globally:

```bash
npm install -g @halo-dev/cli
```

Binary name:

```bash
halo
```

Check version and top-level help:

```bash
halo --version
halo --help
```

## Top-Level Areas

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

## Shared Rules

- Most command areas require an authenticated profile.
- Use `halo auth login` to create a profile.
- Use `--profile <name>` when more than one profile exists.
- Use `--json` when output is meant for automation or follow-up parsing.
- In non-interactive mode, dangerous commands usually require `--force`.
- Read `--help` before guessing flags for a specific command.

## Public vs Authenticated

Most areas require auth.

The main public workflow is `halo search`, which can use a direct site URL without login:

```bash
halo search --keyword "halo" --url https://www.halo.run
```

## Config And Secrets

Profile metadata is stored in:

- `$HALO_CLI_CONFIG_DIR/config.json` if `HALO_CLI_CONFIG_DIR` is set
- otherwise `$XDG_CONFIG_HOME/halo/config.json`
- otherwise `~/.config/halo/config.json`

Credentials are stored in the system keyring.

## Routing

- Use `halo-cli-auth` for login, current profile, profile list/use/delete, and credential repair.
- Use `halo-cli-content` for posts and single pages.
- Use `halo-cli-search` for public site search.
- Use `halo-cli-operations` for themes, plugins, attachments, backups, and moments.
- Use `halo-cli-moderation-notifications` for comments, replies, and notifications.
