---
name: halo-cli-operations
version: 1.0.0
description: Use when operating Halo themes, plugins, attachments, backups, or moments from the terminal, including install, upgrade, activate, upload, download, create, delete, and batch maintenance flows.
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
halo theme upgrade --all
halo theme delete <name> --force
```

Rules:

- `theme list` marks the active theme in table output.
- Local theme install uses `--file`.
- `theme install --url|--uri` and `theme upgrade --url|--uri` prompt for confirmation when the remote host is not `www.halo.run`; use `--yes` to bypass that prompt in automation or other non-interactive runs.
- `upgrade --all` is for App Store-aware upgrades, not direct `--file` or `--url` sources.

## Plugins

```bash
halo plugin list
halo plugin get <name>
halo plugin install --file ./plugin.jar
halo plugin install --url https://example.com/plugin.jar
halo plugin enable <name>
halo plugin disable <name> --force
halo plugin upgrade <name>
halo plugin upgrade --all
halo plugin uninstall <name> --force
```

Rules:

- Plugin upgrades can use App Store-aware logic.
- `plugin install --url|--uri` and `plugin upgrade --url|--uri` prompt for confirmation when the remote host is not `www.halo.run`; use `--yes` to bypass that prompt in automation or other non-interactive runs.
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
halo backup create --wait
halo backup create --wait --wait-timeout 300
halo backup download <name> --output ./backup.zip
halo backup delete <name> --force
```

Rule:

- `backup create --wait` polls until completion or timeout.

## Moments

```bash
halo moment list
halo moment get <name>
halo moment create --content "Hello from Halo CLI"
halo moment create --content-file ./moment.txt
halo moment update <name> --content "Updated content"
halo moment delete <name> --force
```

Useful options include `--visible`, `--tags`, and release-time related flags.

## Safety And Automation

- Use `--profile <name>` for the intended environment.
- Use `--json` when another tool needs structured output.
- Use `--force` for destructive non-interactive actions.
- Prefer `list` or `get` before batch or destructive maintenance.
