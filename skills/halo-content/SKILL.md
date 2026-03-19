---
name: halo-content
version: 1.0.0
description: "Halo CLI: Manage posts and single pages from the terminal."
metadata:
  openclaw:
    category: "content-management"
    requires:
      bins: ["halo"]
    cliHelp: "halo post --help && halo single-page --help"
---

# halo-content

Use this skill when you need to create, update, inspect, export, import, or open Halo content from the terminal.

This skill covers:

- `halo post`
- `halo single-page`

> **PREREQUISITE:** Read `../halo-shared/SKILL.md` first for installation, authentication, profile selection, `--json`, and general safety rules.

## Command Families

### Posts

```bash
halo post <command> [flags]
```

Available workflows include:

- `list`
- `get`
- `open`
- `create`
- `update`
- `delete`
- `export-json`
- `import-json`

### Single Pages

```bash
halo single-page <command> [flags]
```

Available workflows include:

- `list`
- `get`
- `open`
- `create`
- `update`
- `delete`
- `export-json`
- `import-json`

## Discoverability

Before taking action, inspect the command help:

```bash
halo post --help
halo single-page --help
halo post create --help
halo single-page create --help
```

## Global Usage Notes

Most content commands support:

- `--profile <name>` — choose which Halo profile to use
- `--json` — return machine-readable JSON instead of table/detail output

Examples:

```bash
halo post list --profile production --json
halo single-page get about --json
```

## Posts

## List posts

```bash
halo post list
halo post list --page 1 --size 20
halo post list --keyword halo
halo post list --publish-phase PUBLISHED
halo post list --category news
halo post list --json
```

Use this to browse post resources and inspect names before running mutating commands.

## Get a post

```bash
halo post get my-post
halo post get my-post --json
```

Use `--json` if you want to pipe the result into scripts or compare resource state.

## Open a published post

```bash
halo post open my-post
halo post open my-post --json
```

Notes:

- This only works when the post has a published permalink.
- In JSON mode, the command returns the resolved URL instead of opening a browser.

## Create a post

```bash
halo post create \
  --title "Hello Halo" \
  --content-file ./post.md \
  --publish true
```

More complete example:

```bash
halo post create \
  --title "Hello Halo" \
  --slug hello-halo \
  --content-file ./post.md \
  --excerpt "A short summary" \
  --categories News,CLI \
  --tags Halo,Release \
  --cover https://example.com/cover.png \
  --template post \
  --visible PUBLIC \
  --publish true \
  --pinned false \
  --allow-comment true \
  --priority 0
```

Content input options:

- `--content <text>`
- `--content-file <path>`

Do not pass both unless you know which one should win. Prefer `--content-file` for real documents.

## Update a post

```bash
halo post update my-post --title "Updated title"
```

Update content from a file:

```bash
halo post update my-post \
  --content-file ./post-updated.md \
  --publish true
```

Rename the resource:

```bash
halo post update my-post --new-name my-post-renamed
```

## Delete a post

```bash
halo post delete my-post
halo post delete my-post --force
halo post delete my-post --json --force
```

Safety notes:

- In interactive mode, deletion should ask for confirmation.
- In non-interactive mode, use `--force`.

## Export a post as JSON

```bash
halo post export-json my-post
halo post export-json my-post --output ./post.json
```

Default output path is:

```bash
./<post-name>.json
```

## Import a post from JSON

From file:

```bash
halo post import-json --file ./post.json
```

From inline JSON:

```bash
halo post import-json --raw '{"post":{...},"content":{...}}'
```

Force update when the post already exists:

```bash
halo post import-json --file ./post.json --force
```

### Post JSON shape

`post import-json` expects this shape:

```json
{
  "post": {
    "metadata": {
      "name": "my-post"
    },
    "spec": {
      "publish": true
    }
  },
  "content": {
    "raw": "# Hello Halo",
    "content": "<h1>Hello Halo</h1>",
    "rawType": "markdown"
  }
}
```

Notes:

- `post.metadata.name` is required
- `content.raw` or `content.content` must exist
- exported JSON is intended to be re-importable

## Single Pages

## List single pages

```bash
halo single-page list
halo single-page list --page 1 --size 20
halo single-page list --keyword about
halo single-page list --publish-phase PUBLISHED
halo single-page list --visible PUBLIC
halo single-page list --json
```

## Get a single page

```bash
halo single-page get about
halo single-page get about --json
```

## Open a published single page

```bash
halo single-page open about
halo single-page open about --json
```

Notes:

- This only works when the single page has a published permalink.
- In JSON mode, the command returns the resolved URL instead of opening a browser.

## Create a single page

```bash
halo single-page create \
  --title "About" \
  --content-file ./about.md \
  --publish true
```

More complete example:

```bash
halo single-page create \
  --name about \
  --title "About" \
  --slug about \
  --content-file ./about.md \
  --excerpt "About this site" \
  --cover https://example.com/about-cover.png \
  --template about \
  --visible PUBLIC \
  --publish true \
  --allow-comment true \
  --priority 0
```

Content input options:

- `--content <text>`
- `--content-file <path>`

Important differences from posts:

- use `halo single-page`, not `halo singlePage`
- there is no category/tag flow here
- there is no `--pinned` CLI option

## Update a single page

```bash
halo single-page update about --title "About Halo"
```

Update content from a file:

```bash
halo single-page update about \
  --content-file ./about-updated.md \
  --publish true
```

Rename the resource:

```bash
halo single-page update about --new-name about-page
```

## Delete a single page

```bash
halo single-page delete about
halo single-page delete about --force
halo single-page delete about --json --force
```

Safety notes:

- In interactive mode, deletion should ask for confirmation.
- In non-interactive mode, use `--force`.

## Export a single page as JSON

```bash
halo single-page export-json about
halo single-page export-json about --output ./single-page.json
```

Default output path is:

```bash
./<page-name>.json
```

## Import a single page from JSON

From file:

```bash
halo single-page import-json --file ./single-page.json
```

From inline JSON:

```bash
halo single-page import-json --raw '{"page":{...},"content":{...}}'
```

Force update when the page already exists:

```bash
halo single-page import-json --file ./single-page.json --force
```

### Single-page JSON shape

`single-page import-json` expects this shape:

```json
{
  "page": {
    "metadata": {
      "name": "about"
    },
    "spec": {
      "publish": true
    }
  },
  "content": {
    "raw": "# About",
    "content": "<h1>About</h1>",
    "rawType": "markdown"
  }
}
```

Notes:

- `page.metadata.name` is required
- `content.raw` or `content.content` must exist
- exported JSON is intended to be re-importable

## Safety and Automation Rules

### Prefer `--json` for scripts

If another program needs to read the output, use:

```bash
halo post get my-post --json
halo single-page list --json
```

### Be explicit for destructive actions

Use `--force` in non-interactive contexts:

```bash
halo post delete my-post --force
halo single-page delete about --force
```

### Inspect before mutating

Good workflow:

```bash
halo post list
halo post get my-post
halo post update my-post --title "Updated title"
```

Or:

```bash
halo single-page list
halo single-page get about
halo single-page update about --title "About Halo"
```

## Common Mistakes

- Using `halo singlePage` instead of `halo single-page`
- Forgetting `--profile` when multiple Halo profiles exist
- Expecting `open` to work for unpublished content
- Importing malformed JSON payloads
- Forgetting `--force` for destructive non-interactive workflows
- Assuming `single-page` supports the same category/tag flags as `post`

## Recommended Workflow

For posts:

```bash
halo post create --title "Draft" --content-file ./draft.md --publish false
halo post get <name>
halo post update <name> --publish true
halo post open <name>
```

For single pages:

```bash
halo single-page create --title "About" --content-file ./about.md --publish true
halo single-page get about
halo single-page export-json about --output ./about.json
```

## Validation by Inspection

If you're unsure what is currently supported, always inspect the CLI help:

```bash
halo post --help
halo post create --help
halo single-page --help
halo single-page update --help
```
