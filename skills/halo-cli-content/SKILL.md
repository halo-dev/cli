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
- `category` (subcommand)
- `tag` (subcommand)

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
halo post create --title "Hello Halo" --content "# Hello Halo" --publish true
halo post create --title "Hello Halo" --content "<h1>Hello Halo</h1>" --raw-type html
halo post update my-post --title "Updated title"
halo post update my-post --content "Updated content" --publish true
halo post update my-post --new-name my-post-renamed
```

Taxonomy-aware create/update:

```bash
halo post create \
  --title "Release Notes" \
  --content "Release notes content" \
  --categories News,CLI \
  --tags Halo,Release
```

JSON round-trip:

```bash
halo post export-json my-post --output ./post.json
halo post import-json --file ./post.json --force
```

Markdown round-trip:

```bash
halo post export-markdown my-post
halo post export-markdown my-post --output ./post.md
halo post import-markdown --file ./post.md --force
```

Rules:

- `--raw-type` defaults to `markdown`, so `--content` is rendered as Markdown unless you set `--raw-type html`.
- Prefer `--content` for direct inline updates, or use `import-markdown` for Markdown files.
- `open` only works for published content; with `--json` it returns the URL.
- Import payload must contain `post.metadata.name`.
- Import payload must contain `content.raw` or `content.content`.

## Post Categories

Manage post categories:

```bash
halo post category list
halo post category list --keyword Technology
halo post category get category-abc123
halo post category create --display-name "Technology" --slug "tech"
halo post category create --display-name "News" --description "Latest news" --priority 100
halo post category update category-abc123 --display-name "Tech News"
halo post category delete category-abc123 --force
```

## Post Tags

Manage post tags:

```bash
halo post tag list
halo post tag list --keyword Halo
halo post tag get tag-abc123
halo post tag create --display-name "Halo" --slug "halo" --color "#1890ff"
halo post tag update tag-abc123 --display-name "Halo CMS"
halo post tag delete tag-abc123 --force
```

## Single Pages

List and inspect:

```bash
halo single-page list
halo single-page get about --json
```

Create or update:

```bash
halo single-page create --title "About" --content "# About" --publish true
halo single-page create --title "About" --content "<h1>Hello Halo</h1>" --raw-type html
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
