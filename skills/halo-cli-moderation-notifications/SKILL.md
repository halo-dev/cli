---
name: halo-cli-moderation-notifications
version: 1.0.0
description: Use when moderating Halo comments or replies, creating official replies, listing unread notifications, deleting notifications, or marking notifications as read.
references:
  - ../halo-cli-shared
metadata:
  openclaw:
    category: content-management
    requires:
      bins: ["halo"]
    cliHelp: "halo comment --help && halo notification --help"
---

# Halo CLI Moderation And Notifications

Use this skill for `halo comment`, `halo comment reply`, and `halo notification`.

## Commands

```bash
halo comment --help
halo comment reply --help
halo notification --help
```

## Comments

Common flows:

```bash
halo comment list
halo comment list --approved=false
halo comment list --owner-kind Post --owner-name my-post
halo comment get comment-abc123
halo comment approve comment-abc123
halo comment delete comment-abc123 --force
```

Useful filters for `comment list`:

- `--page`
- `--size`
- `--keyword`
- `--owner-name`
- `--owner-kind`
- `--approved`
- `--sort`

## Replies

Common flows:

```bash
halo comment reply list comment-abc123
halo comment reply get reply-abc123
halo comment reply approve reply-abc123
halo comment reply delete reply-abc123 --force
```

Create a reply:

```bash
halo comment create-reply comment-abc123 --content "Thanks for your feedback"
halo comment create-reply comment-abc123 --content-file ./reply.txt
halo comment create-reply comment-abc123 --content "Following up here" --quote-reply reply-abc123
halo comment create-reply comment-abc123 --content "Internal note" --hidden
```

Rules:

- In non-interactive mode, `create-reply` requires `--content` or `--content-file`.
- `create-reply` creates an already approved reply in console context.
- Replies can be quoted with `--quote-reply`.

## Notifications

Common flows:

```bash
halo notification list
halo notification list --unread=false
halo notification get notification-abc123
halo notification mark-as-read notification-abc123
halo notification mark-as-read --all
halo notification delete notification-abc123 --force
```

Useful filters for `notification list`:

- `--page`
- `--size`
- `--unread`
- `--sort`

## Safety And Automation

- Use `--profile <name>` when moderating a non-default environment.
- Use `--json` for machine-readable moderation pipelines.
- Use `--force` for destructive deletes in non-interactive mode.
- If a resource is not found, confirm the selected profile and exact resource name.
