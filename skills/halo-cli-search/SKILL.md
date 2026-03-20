---
name: halo-cli-search
version: 1.0.0
description: Use when searching public content on a Halo site with Halo CLI, especially for keyword search, site URL based search, result limits, or search without authenticated console access.
references:
  - ../halo-cli-shared
metadata:
  openclaw:
    category: developer-tools
    requires:
      bins: ["halo"]
    cliHelp: "halo search --help"
---

# Halo CLI Search

Use this skill for `halo search`.

This is the main Halo CLI workflow that can run without authenticated console access when `--url` is provided.

## Command

```bash
halo search --help
```

## Common Flows

Search with a direct public site URL:

```bash
halo search --keyword "halo" --url https://www.halo.run
```

Search with the active or selected profile:

```bash
halo search --keyword "release notes"
halo search --keyword "release notes" --profile production
```

Limit results and emit JSON:

```bash
halo search --keyword "plugin" --limit 5 --json
```

## Rules

- `--keyword` is required.
- `--limit` must be a positive number.
- `--url` targets a public Halo site directly and avoids authenticated console access.
- If `--url` is omitted, Halo CLI resolves the base URL from the active or selected profile.
- Use `--json` when another tool needs to parse search results.

## Related Skills

- Use `halo-cli-auth` if the task first needs a profile.
- Use `halo-cli-content` after search when the goal shifts to editing posts or pages.
