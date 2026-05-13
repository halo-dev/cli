---
name: halo-cli-operations
version: 1.0.0
description: Use when operating Halo themes, plugins, attachments, backups, or moments from the terminal. This includes install, upgrade, activate, enable, disable, upload, download, create, delete, reload, and batch maintenance flows. Trigger this skill whenever the user mentions Halo themes, plugins, attachments, backups, moments, or any Halo CMS maintenance operation in a CLI context.
references:
  - ../halo-cli-shared
metadata:
  openclaw:
    category: developer-tools
    requires:
      bins: ["halo"]
    cliHelp: "halo --help"
---

# Halo CLI Operations

Use this skill for `halo theme`, `halo plugin`, `halo attachment`, `halo backup`, and `halo moment`.

## Commands

```bash
halo theme --help
halo plugin --help
halo attachment --help
halo backup --help
halo moment --help
```

## Themes

```bash
halo theme list
halo theme current
halo theme get <name>
halo theme install --file ./theme.zip
halo theme install --url https://example.com/theme.zip
halo theme activate <name>
halo theme reload <name>
halo theme upgrade <name>
halo theme upgrade <name> --online
halo theme upgrade --all --online --yes
halo theme delete <name> --force
```

Rules:

- `theme list` marks the active theme in table output.
- Local theme install uses `--file`.
- `theme install --url` and `theme upgrade --url` prompt for confirmation when the remote host is not `www.halo.run`; use `--yes` to bypass that prompt in automation or other non-interactive runs.
- App Store upgrades use `--online`. `upgrade --all --online --yes` upgrades all themes from the App Store without prompting.

## Plugins

```bash
halo plugin list
halo plugin get <name>
halo plugin install --file ./plugin.jar
halo plugin install --url https://example.com/plugin.jar
halo plugin install --app-id app-SnwWD
halo plugin enable <name>
halo plugin disable <name> --force
halo plugin upgrade <name>
halo plugin upgrade <name> --online
halo plugin upgrade --all --online --yes
halo plugin uninstall <name> --force
```

Rules:

- Install from the Halo App Store with `--app-id`.
- App Store upgrades use `--online`. `upgrade --all --online --yes` upgrades all plugins from the App Store without prompting.
- `plugin install --url` and `plugin upgrade --url` prompt for confirmation when the remote host is not `www.halo.run`; use `--yes` to bypass that prompt in automation or other non-interactive runs.
- Treat `disable`, `upgrade`, and `uninstall` as mutating operations.

## Attachments

```bash
halo attachment list
halo attachment get <name>
halo attachment upload --file ./image.png
halo attachment upload --url https://example.com/image.png
halo attachment download <name> --output ./downloads/image.png
halo attachment delete <name> --force
```

Rules:

- Use exactly one upload source: `--file` or `--url`.
- Upload and download show progress in TTY mode unless `--json` is enabled.

## Backups

```bash
halo backup list
halo backup get <name>
halo backup create
halo backup create my-backup
halo backup create --wait
halo backup create --wait --wait-timeout 300
halo backup create --format zip --expires-at "2026-12-31T23:59:59Z"
halo backup download <name> --output ./backup.zip
halo backup delete <name> --force
```

Rules:

- `backup create [name]` accepts an optional backup name.
- `backup create --wait` polls until completion or timeout.
- `--format` sets the backup format (default: `zip`).
- `--expires-at` sets an expiration time in ISO-8601 format.

## Moments

```bash
halo moment list
halo moment get <name>
halo moment create --content "Hello from Halo CLI"
halo moment create --content "<p>Hello Halo</p>" --visible PUBLIC --tags life,cli --approved true
halo moment update <name> --content "Updated content"
halo moment update <name> --visible PRIVATE --tags updated
halo moment delete <name> --force
```

Rules:

- `--visible` accepts `PUBLIC` or `PRIVATE`.
- `--tags` is comma-separated.
- `--release-time` accepts ISO-8601 datetime.
- `--approved` accepts `true` or `false`.

## Safety And Automation

- Use `--profile <name>` for the intended environment.
- Use `--json` when another tool needs structured output.
- Use `--force` for destructive non-interactive actions.
- Prefer `list` or `get` before batch or destructive maintenance.
