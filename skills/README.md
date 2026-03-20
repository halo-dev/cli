# Halo CLI Skills

This directory is a flat skill namespace for Halo CLI.

Recommended loading order for agents:

1. `halo` when the task is broad or mixed.
2. `halo-shared` when shared rules matter but the domain is still unclear.
3. One focused domain skill:
   - `halo-auth`
   - `halo-content`
   - `halo-search`
   - `halo-operations`
   - `halo-moderation-notifications`

Design goals:

- trigger-oriented descriptions for better skill discovery
- minimal frontmatter for Codex-compatible loading
- command-accurate examples aligned with the current CLI
- explicit routing between skills instead of hidden coupling
