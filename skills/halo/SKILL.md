---
name: halo
version: 1.0.0
description: "Complete Halo CLI skill set: authentication, content management, site operations, moderation, and notifications."
references:
  - ../halo-shared
  - ../halo-auth
  - ../halo-content
  - ../halo-operations
  - ../halo-moderation-notifications
metadata:
  openclaw:
    category: "developer-tools"
    requires:
      bins: ["halo"]
    cliHelp: "halo --help"
---

# halo

This is the root skill for the Halo CLI. Importing this skill pulls in every
domain-specific skill through the `references` list above, so tools such as
openclaw can publish or install the full set in a single operation.

## Included skills

| Skill                           | Description                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `halo-shared`                   | Installation, authentication, profiles, global flags, JSON output, and safety rules. |
| `halo-auth`                     | Authentication, profile management, and connection setup.                            |
| `halo-content`                  | Post and single-page management.                                                     |
| `halo-operations`               | Themes, plugins, attachments, backups, and moments.                                  |
| `halo-moderation-notifications` | Comment moderation, reply workflows, and notification management.                    |

## Quick start

```bash
# Install the CLI globally
npm install -g @halo-dev/cli

# Log in to a Halo instance
halo auth login --url https://your-halo.example --username admin

# Explore available commands
halo --help
```

Read `halo-shared` first for foundational conventions, then jump to the skill
that matches your task.
