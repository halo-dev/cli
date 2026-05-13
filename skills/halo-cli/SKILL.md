---
name: halo-cli
version: 1.0.0
description: Use when the task involves Halo CLI, Halo CMS terminal operations, or any command-line interaction with Halo. This includes login, profiles, posts, single pages, search, plugins, themes, attachments, backups, moments, comments, notifications, or shell completion. Trigger this skill whenever the user mentions 'halo', 'Halo CLI', or wants to manage Halo from the terminal, even if the exact command area is unclear.
references:
  - ../halo-cli-shared
  - ../halo-cli-auth
  - ../halo-cli-content
  - ../halo-cli-search
  - ../halo-cli-operations
  - ../halo-cli-moderation-notifications
metadata:
  openclaw:
    category: developer-tools
    requires:
      bins: ["halo"]
    cliHelp: "halo --help"
---

# Halo CLI

This is the routing skill for the Halo CLI skill set.

If the request only says "use Halo CLI" or mixes multiple areas, start here, then jump to the domain skill that matches the task.

## Skill Map

- `halo-cli-shared`: shared rules, top-level command map, profiles, JSON output, destructive-action conventions
- `halo-cli-auth`: login, profile setup, profile switching, keyring and credential repair
- `halo-cli-content`: posts and single pages
- `halo-cli-search`: public site search
- `halo-cli-operations`: themes, plugins, attachments, backups, moments
- `halo-cli-moderation-notifications`: comments, replies, notifications

## Fast Routing

Use these commands to identify the right area:

```bash
halo --help
halo auth --help
halo post --help
halo single-page --help
halo search --help
halo plugin --help
halo theme --help
halo attachment --help
halo backup --help
halo moment --help
halo comment --help
halo notification --help
halo completion --help
```

## Shared Defaults

- Prefer an authenticated profile unless the task is public `halo search --url`.
- Use `--profile <name>` when the environment matters.
- Use `--json` for automation.
- Use `--force` carefully for destructive non-interactive operations.
