---
name: halo-cli-content
version: 1.0.0
description: Use when managing Halo posts, single pages, categories, or tags from the terminal. This includes listing, creating, updating, deleting, exporting, importing, or any content management operation for Halo CMS. Trigger this skill whenever the user mentions Halo posts, pages, categories, tags, or content management in a CLI context, even if they do not explicitly mention 'content'.
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
halo post list --category Technology --page 1 --size 20
halo post get my-post --json
```

Create:

```bash
halo post create --title "Hello Halo" --content "# Hello Halo" --publish true
halo post create --title "Hello Halo" --content "<h1>Hello Halo</h1>" --raw-type html
halo post create \
  --title "Release Notes" \
  --content "Release notes content" \
  --slug "release-notes" \
  --excerpt "A brief summary" \
  --categories News,CLI \
  --tags Halo,Release \
  --cover "https://example.com/cover.png" \
  --visible PUBLIC \
  --allow-comment true \
  --pinned false \
  --priority 100 \
  --publish true
```

Update:

```bash
halo post update my-post --title "Updated title"
halo post update my-post --content "Updated content" --publish true
halo post update my-post --new-name my-post-renamed
halo post update my-post --slug "new-slug" --excerpt "Updated excerpt" --cover ""
halo post update my-post --allow-comment false --priority 0
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

`import-json` payload example (for creating a new post):

```json
{
  "post": {
    "apiVersion": "content.halo.run/v1alpha1",
    "kind": "Post",
    "metadata": {
      "name": "56c6d867-9683-4927-ba94-388fedf87443"
    },
    "spec": {
      "allowComment": true,
      "baseSnapshot": "",
      "categories": ["category-xxx"],
      "deleted": false,
      "excerpt": {
        "autoGenerate": false,
        "raw": ""
      },
      "headSnapshot": "",
      "owner": "",
      "pinned": false,
      "priority": 0,
      "publish": false,
      "publishTime": "",
      "releaseSnapshot": "",
      "slug": "sample-post",
      "tags": ["tag-xxx"],
      "title": "Sample Post",
      "visible": "PUBLIC"
    }
  },
  "content": {
    "raw": "# Hello World\n\nThis is a sample post content in **Markdown**.\n",
    "content": "<h1 id=\"hello-world\">Hello World</h1>\n<p>This is a sample post content in <strong>Markdown</strong>.</p>\n",
    "rawType": "markdown"
  }
}
```

Content fields:

- `rawType`: source format, supports `markdown` or `html`.
- `raw`: the source content. Use Markdown text when `rawType` is `markdown`; use HTML text when `rawType` is `html`.
- `content`: the rendered result. Use HTML text when `rawType` is `markdown` (converted from Markdown); use HTML text when `rawType` is `html`.

- `baseSnapshot`, `headSnapshot`, `releaseSnapshot` and `owner` must be left empty (do not construct manually).
- `categories` and `tags` values are the `metadata.name` of existing categories/tags in the system. Query them first with `halo post category list` and `halo post tag list`; create any missing ones before importing.

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
halo post category create --display-name "Featured" --slug "featured" --cover "https://example.com/cover.png"
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
halo post tag create --display-name "Technology" --slug "tech" --color "#52c41a" --cover "https://example.com/tag-cover.png"
halo post tag update tag-abc123 --display-name "Halo CMS"
halo post tag delete tag-abc123 --force
```

## Single Pages

List and inspect:

```bash
halo single-page list
halo single-page get about --json
```

Create:

```bash
halo single-page create --title "About" --content "# About" --publish true
halo single-page create --title "About" --content "<h1>Hello Halo</h1>" --raw-type html
halo single-page create \
  --title "Contact Us" \
  --content "# Contact" \
  --slug "contact" \
  --excerpt "Get in touch" \
  --template "page" \
  --visible PUBLIC \
  --allow-comment true \
  --priority 0 \
  --publish true
```

Update:

```bash
halo single-page update about --title "About Halo"
halo single-page update about --new-name about-page
halo single-page update about --slug "about-halo" --excerpt "Updated description"
halo single-page update about --allow-comment false --template ""
```

JSON round-trip:

```bash
halo single-page export-json about --output ./about.json
halo single-page import-json --file ./about.json --force
```

`import-json` payload example (for creating a new single page):

```json
{
  "page": {
    "apiVersion": "content.halo.run/v1alpha1",
    "kind": "SinglePage",
    "metadata": {
      "name": "373a5f79-f44f-441a-9df1-85a4f553ece8"
    },
    "spec": {
      "allowComment": true,
      "baseSnapshot": "",
      "cover": "",
      "deleted": false,
      "excerpt": {
        "autoGenerate": false,
        "raw": "This is a custom page for demonstration purposes."
      },
      "headSnapshot": "",
      "htmlMetas": [],
      "owner": "",
      "pinned": false,
      "priority": 0,
      "publish": false,
      "publishTime": "",
      "releaseSnapshot": "",
      "slug": "about",
      "template": "",
      "title": "About Us",
      "visible": "PUBLIC"
    }
  },
  "content": {
    "raw": "<h1>About Us</h1><p>This is a <strong>custom page</strong> content.</p>",
    "content": "<h1>About Us</h1><p>This is a <strong>custom page</strong> content.</p>",
    "rawType": "HTML"
  }
}
```

Content fields:

- `rawType`: source format, supports `markdown` or `html`.
- `raw`: the source content. Use Markdown text when `rawType` is `markdown`; use HTML text when `rawType` is `html`.
- `content`: the rendered result. Use HTML text when `rawType` is `markdown` (converted from Markdown); use HTML text when `rawType` is `html`.

- `baseSnapshot`, `headSnapshot`, `releaseSnapshot` and `owner` must be left empty (do not construct manually).

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
