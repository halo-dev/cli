---
name: halo-moderation-notifications
version: 1.0.0
description: "Halo CLI skill for comment moderation, reply workflows, and notification management."
metadata:
  openclaw:
    category: "content-management"
    requires:
      bins: ["halo"]
    cliHelp: "halo comment --help && halo notification --help"
---

# halo moderation and notifications

Use this skill when you need to moderate comments, manage replies, or work with user notifications in a Halo instance through the `halo` CLI.

> **PREREQUISITE:** Read `../halo-shared/SKILL.md` first for installation, authentication, profile usage, `--json`, and safety conventions.

## Covered command areas

This skill covers:

- `halo comment`
- `halo comment reply`
- `halo notification`

## Command discovery

Before running specific operations, inspect the available commands:

```bash
halo comment --help
halo comment reply --help
halo notification --help
```

## Comment moderation

The `comment` command group is used for comment listing, inspection, approval, deletion, and reply creation.

### Available comment commands

- `list`
- `get <name>`
- `approve <name>`
- `delete <name>`
- `create-reply <commentName>`

### Common examples

List comments:

```bash
halo comment list
```

List only unapproved comments:

```bash
halo comment list --approved=false
```

List comments for a specific owner:

```bash
halo comment list --owner-kind Post --owner-name my-post
```

Inspect a comment:

```bash
halo comment get comment-abc123
```

Approve a comment:

```bash
halo comment approve comment-abc123
```

Delete a comment:

```bash
halo comment delete comment-abc123 --force
```

### Filtering comment lists

Useful flags for `halo comment list`:

- `--page <number>`
- `--size <number>`
- `--keyword <keyword>`
- `--owner-name <name>`
- `--owner-kind <kind>`
- `--approved <boolean>`
- `--sort <sort>`

Example with sorting:

```bash
halo comment list --approved=false --sort metadata.creationTimestamp,desc
```

## Reply workflows

Replies are managed through the nested `halo comment reply` command group.

### Available reply commands

- `list <commentName>`
- `get <name>`
- `approve <name>`
- `delete <name>`

Inspect reply help first if needed:

```bash
halo comment reply --help
```

### Common reply examples

List replies under a comment:

```bash
halo comment reply list comment-abc123
```

Inspect a reply:

```bash
halo comment reply get reply-abc123
```

Approve a reply:

```bash
halo comment reply approve reply-abc123
```

Delete a reply:

```bash
halo comment reply delete reply-abc123 --force
```

## Creating replies

Use `halo comment create-reply` to create a reply directly under a comment.

### Common examples

Reply with inline text:

```bash
halo comment create-reply comment-abc123 --content "Thanks for your feedback"
```

Reply from a file:

```bash
halo comment create-reply comment-abc123 --content-file ./reply.txt
```

Reply to a specific reply:

```bash
halo comment create-reply comment-abc123 --content "Following up here" --quote-reply reply-abc123
```

Create a hidden reply:

```bash
halo comment create-reply comment-abc123 --content "Internal moderation note" --hidden
```

Disable notification delivery for the reply:

```bash
halo comment create-reply comment-abc123 --content "Acknowledged" --allow-notification=false
```

### Reply content rules

If you do not provide content non-interactively, the command fails.

Use one of:

- `--content <text>`
- `--content-file <path>`

## Notification management

The `notification` command group is used for listing, inspecting, deleting, and marking notifications as read.

### Available notification commands

- `list`
- `get <name>`
- `delete <name>`
- `mark-as-read [name]`
- `mark-as-read --all`

### Common notification examples

List unread notifications:

```bash
halo notification list
```

List all notifications, including read ones:

```bash
halo notification list --unread=false
```

Inspect a notification:

```bash
halo notification get notification-abc123
```

Delete a notification:

```bash
halo notification delete notification-abc123 --force
```

Mark one notification as read:

```bash
halo notification mark-as-read notification-abc123
```

Mark all unread notifications as read:

```bash
halo notification mark-as-read --all
```

### Notification list filters

Useful flags for `halo notification list`:

- `--page <number>`
- `--size <number>`
- `--unread <boolean>`
- `--sort <sort>`

Example:

```bash
halo notification list --unread=false --sort metadata.creationTimestamp,desc
```

## JSON output

Both moderation and notification commands support `--json` in many places.

Use JSON output when:

- scripting moderation workflows
- feeding results into other tools
- debugging unexpected results
- collecting machine-readable output for automation

Examples:

```bash
halo comment list --approved=false --json
halo comment get comment-abc123 --json
halo comment reply list comment-abc123 --json
halo notification list --json
halo notification get notification-abc123 --json
```

## Profiles

All commands in this skill support `--profile <name>`.

Examples:

```bash
halo comment list --profile production
halo notification list --profile staging --json
```

If you do not specify a profile, Halo CLI uses the current active profile.

## Safety rules

Some operations are destructive or state-changing.

These include:

- deleting comments
- deleting replies
- deleting notifications

In interactive terminals, Halo CLI may ask for confirmation.
In non-interactive usage, use `--force` for dangerous operations.

Examples:

```bash
halo comment delete comment-abc123 --force
halo comment reply delete reply-abc123 --force
halo notification delete notification-abc123 --force
```

## Recommended moderation workflow

A common moderation loop looks like this:

1. List unapproved comments
2. Inspect a specific comment
3. Approve or delete it
4. If needed, create an official reply
5. Review notifications

Example:

```bash
halo comment list --approved=false
halo comment get comment-abc123
halo comment approve comment-abc123
halo comment create-reply comment-abc123 --content "Thanks, your comment has been reviewed."
halo notification list
```

## Troubleshooting

### "requires content"

You tried to create a reply without `--content` or `--content-file` in non-interactive mode.

### "requires a notification name, or use --all"

You ran `halo notification mark-as-read` without a name and without `--all`.

### "does not accept a notification name"

You used `halo notification mark-as-read --all <name>`. Remove the name when using `--all`.

### "not found"

The target resource name does not exist in the selected Halo profile, or you are pointing at the wrong environment.

## Quick reference

### Moderate comments

```bash
halo comment list --approved=false
halo comment approve comment-abc123
halo comment delete comment-abc123 --force
```

### Work with replies

```bash
halo comment create-reply comment-abc123 --content "Thanks"
halo comment reply list comment-abc123
halo comment reply approve reply-abc123
```

### Manage notifications

```bash
halo notification list
halo notification mark-as-read --all
halo notification delete notification-abc123 --force
```
