---
name: halo-operations
version: 1.0.0
description: "Halo CLI: site operations commands for themes, plugins, attachments, backups, and moments."
metadata:
  openclaw:
    category: "developer-tools"
    requires:
      bins: ["halo"]
    cliHelp: "halo --help"
---

# halo-operations

> **PREREQUISITE:** Read `../halo-shared/SKILL.md` first for installation, authentication, profiles, `--json`, `--profile`, confirmation behavior, and general CLI usage patterns.

This skill covers Halo CLI operational workflows outside of core auth and content publishing, especially:

- themes
- plugins
- attachments
- backups
- moments

Use this skill when you need to operate a Halo site from the command line rather than edit posts or single pages.

## Command Areas

- `halo theme ...`
- `halo plugin ...`
- `halo attachment ...`
- `halo backup ...`
- `halo moment ...`

## Discovering Commands

Before running a command, inspect available subcommands and flags:

```bash
halo theme --help
halo plugin --help
halo attachment --help
halo backup --help
halo moment --help
```

Inspect a specific command before using it:

```bash
halo theme install --help
halo plugin upgrade --help
halo attachment upload --help
halo backup create --help
halo moment update --help
```

## Theme Operations

Use `theme` commands to inspect, install, activate, reload, upgrade, and remove themes.

### Common commands

```bash
halo theme list
halo theme current
halo theme get <name>
halo theme activate <name>
halo theme reload <name>
halo theme delete <name> --force
```

### Install a local theme package

```bash
halo theme install --file ./theme.zip
```

### Install a theme from a URL

```bash
halo theme install --url https://example.com/theme.zip
```

### Upgrade a theme

```bash
halo theme upgrade <name>
```

Upgrade all eligible themes:

```bash
halo theme upgrade --all
```

### Notes

- Theme list output marks the currently activated theme in table mode.
- Local installation uses file upload semantics, so use `--file` for local zip packages.
- Dangerous operations such as deletion should use `--force` in non-interactive mode.

## Plugin Operations

Use `plugin` commands to inspect, install, enable, disable, upgrade, and uninstall plugins.

### Common commands

```bash
halo plugin list
halo plugin get <name>
halo plugin enable <name>
halo plugin disable <name> --force
halo plugin uninstall <name> --force
```

### Install a local plugin package

```bash
halo plugin install --file ./plugin.jar
```

### Install a plugin from a URL

```bash
halo plugin install --url https://example.com/plugin.jar
```

### Upgrade a plugin

```bash
halo plugin upgrade <name>
```

Upgrade all eligible plugins:

```bash
halo plugin upgrade --all
```

### Notes

- Plugin and theme upgrade flows may use Halo App Store-aware logic.
- Use `--all` only when you want batch upgrades from supported sources.
- Do not combine `--all` with direct package sources like `--file` or `--url`.

## Attachment Operations

Use `attachment` commands to inspect, upload, download, and delete media or files.

### Common commands

```bash
halo attachment list
halo attachment get <name>
halo attachment delete <name> --force
```

### Upload a local file

```bash
halo attachment upload --file ./image.png
```

### Upload from a remote URL

```bash
halo attachment upload --url https://example.com/image.png
```

### Download an attachment

```bash
halo attachment download <name>
```

Download to a specific path:

```bash
halo attachment download <name> --output ./downloads/image.png
```

### Notes

- Upload and download operations provide progress feedback in TTY mode unless `--json` is enabled.
- Use exactly one upload source: `--file` or `--url`.

## Backup Operations

Use `backup` commands to create, inspect, download, and delete backups.

### Common commands

```bash
halo backup list
halo backup get <name>
halo backup download <name>
halo backup delete <name> --force
```

### Create a backup

```bash
halo backup create
```

Create and wait until completion:

```bash
halo backup create --wait
```

Set a wait timeout:

```bash
halo backup create --wait --wait-timeout 300
```

### Download a backup

```bash
halo backup download <name>
```

Download to a specific path:

```bash
halo backup download <name> --output ./backup.zip
```

### Notes

- `backup create --wait` polls until the backup finishes or times out.
- Backup download supports progress feedback in TTY mode.
- In automation, prefer `--json` where you need structured results.

## Moment Operations

Use `moment` commands to manage short-form moment content.

### Common commands

```bash
halo moment list
halo moment get <name>
halo moment create --content "Hello from Halo CLI"
halo moment update <name> --content "Updated content"
halo moment delete <name> --force
```

### Create from a file

```bash
halo moment create --content-file ./moment.txt
```

### Set visibility and tags

```bash
halo moment create \
  --content "Hello from Halo CLI" \
  --visible PUBLIC \
  --tags cli,halo
```

### Update a moment

```bash
halo moment update <name> --content-file ./updated-moment.txt
```

### Notes

- `moment` supports `PUBLIC` and `PRIVATE` visibility.
- It also supports tags, release time, and approval flags.
- In interactive terminals, missing content may be prompted for.

## JSON Output

All of these areas generally support `--json` for scripting and machine-readable output.

Examples:

```bash
halo theme list --json
halo plugin get my-plugin --json
halo attachment list --json
halo backup get backup-abc123 --json
halo moment list --json
```

Use `--json` when you need to pipe or parse output reliably.

## Profile Selection

All operational commands can run against a specific saved profile.

Examples:

```bash
halo theme list --profile production
halo plugin upgrade my-plugin --profile staging
halo attachment upload --file ./image.png --profile local
halo backup create --wait --profile production
```

If `--profile` is omitted, the active profile is used.

## Safety Rules

Many operational commands can mutate or remove site resources.

Be careful with:

- `delete`
- `uninstall`
- `disable`
- bulk upgrade flows

In non-interactive mode, prefer explicit flags like:

```bash
halo theme delete my-theme --force
halo plugin disable my-plugin --force
halo plugin uninstall my-plugin --force
halo backup delete backup-abc123 --force
```

## Suggested Workflows

### Upgrade plugins and themes during maintenance

```bash
halo plugin list
halo theme list
halo plugin upgrade --all
halo theme upgrade --all
```

### Upload a file and inspect the result

```bash
halo attachment upload --file ./logo.png
halo attachment list
```

### Create and download a backup

```bash
halo backup create --wait
halo backup list
halo backup download <name>
```

### Publish a quick moment

```bash
halo moment create --content "Deployment finished successfully" --visible PUBLIC
```

## Troubleshooting

If a command fails:

1. Confirm you are authenticated:
   ```bash
   halo auth current
   halo auth profile list
   ```
2. Confirm command syntax:
   ```bash
   halo <area> --help
   ```
3. Retry with `--json` if you need clearer structured output.
4. Verify you are targeting the intended profile with `--profile`.

## Related Skills

- `../halo-shared/SKILL.md` — install, auth, profiles, global behavior
- `../halo-auth/SKILL.md` — login and profile management
- `../halo-content/SKILL.md` — posts and single pages
- `../halo-moderation-notifications/SKILL.md` — comments and notifications
