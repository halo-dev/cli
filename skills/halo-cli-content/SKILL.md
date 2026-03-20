---
name: halo-cli-content
version: 1.0.0
description: Use when managing Halo posts or single pages from the terminal, including list, get, create, update, delete, open, export-json, import-json, categories, tags, and content files.
references:
  - ../halo-cli-shared
metadata:
  openclaw:
    category: content-management
    requires:
      bins: ["halo"]
    cliHelp: "halo post --help && halo single-page --help"
---

# Halo CLI Content

Use this skill for `halo post` and `halo single-page`.

If auth may not be ready, check `halo auth current` first or load `halo-cli-auth`.

## Commands

```bash
halo post --help
halo single-page --help
```

Post workflows:

- `list`
- `get <name>`
- `open <name>`
- `create`
- `update <name>`
- `delete <name>`
- `export-json <name>`
- `import-json`

Single-page workflows:

- `list`
- `get <name>`
- `open <name>`
- `create`
- `update <name>`
- `delete <name>`
- `export-json <name>`
- `import-json`

## Posts

List and inspect:

```bash
halo post list
halo post list --keyword halo --publish-phase PUBLISHED
halo post get my-post --json
```

Create or update:

```bash
halo post create --title "Hello Halo" --content-file ./post.md --publish true
halo post update my-post --title "Updated title"
halo post update my-post --content-file ./post.md --publish true
halo post update my-post --new-name my-post-renamed
```

Taxonomy-aware create/update:

```bash
halo post create \
  --title "Release Notes" \
  --content-file ./release.md \
  --categories News,CLI \
  --tags Halo,Release
```

JSON round-trip:

```bash
halo post export-json my-post --output ./post.json
halo post import-json --file ./post.json --force
```

Rules:

- Prefer one content source: `--content` or `--content-file`.
- `open` only works for published content; with `--json` it returns the URL.
- Import payload must contain `post.metadata.name`.
- Import payload must contain `content.raw` or `content.content`.

## Single Pages

List and inspect:

```bash
halo single-page list
halo single-page get about --json
```

Create or update:

```bash
halo single-page create --title "About" --content-file ./about.md --publish true
halo single-page update about --title "About Halo"
halo single-page update about --new-name about-page
```

JSON round-trip:

```bash
halo single-page export-json about --output ./about.json
halo single-page import-json --file ./about.json --force
```

Rules:

- The command name is `single-page`, not `singlePage`.
- Single pages do not use post category/tag flows.
- There is no `--pinned` option for `single-page`.
- Import payload must contain `page.metadata.name`.

## Safety And Automation

- Use `--profile <name>` when more than one Halo profile exists.
- Use `--json` for scripts.
- Use `--force` for destructive non-interactive commands like `delete` or overwrite-style imports.
- Read current state before mutating when the target resource is uncertain.
