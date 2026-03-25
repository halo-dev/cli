import { CliError } from "./errors.js";

interface CompletionNode {
  flags?: string[];
  subcommands?: Record<string, CompletionNode>;
}

const HELP_FLAGS = ["-h", "--help"];
const ROOT_FLAGS = [...HELP_FLAGS, "-v", "--version"];
const PROFILE_JSON_FLAGS = ["--profile", "--json", ...HELP_FLAGS];
const FORCE_FLAGS = ["--force", ...PROFILE_JSON_FLAGS];

const COMPLETION_TREE: CompletionNode = {
  flags: ROOT_FLAGS,
  subcommands: {
    auth: {
      flags: HELP_FLAGS,
      subcommands: {
        login: {
          flags: [
            "--profile",
            "--url",
            "--auth-type",
            "--username",
            "--password",
            "--token",
            "--json",
            ...HELP_FLAGS,
          ],
        },
        current: {
          flags: ["--profile", "--json", ...HELP_FLAGS],
        },
        profile: {
          flags: HELP_FLAGS,
          subcommands: {
            list: {
              flags: ["--json", ...HELP_FLAGS],
            },
            current: {
              flags: ["--json", ...HELP_FLAGS],
            },
            get: {
              flags: ["--profile", "--json", ...HELP_FLAGS],
            },
            use: {
              flags: ["--profile", "--json", ...HELP_FLAGS],
            },
            delete: {
              flags: ["--profile", "--json", "--force", ...HELP_FLAGS],
            },
            doctor: {
              flags: ["--json", ...HELP_FLAGS],
            },
          },
        },
      },
    },
    post: {
      flags: HELP_FLAGS,
      subcommands: {
        list: {
          flags: [
            ...PROFILE_JSON_FLAGS,
            "--page",
            "--size",
            "--keyword",
            "--publish-phase",
            "--category",
          ],
        },
        get: {
          flags: PROFILE_JSON_FLAGS,
        },
        open: {
          flags: PROFILE_JSON_FLAGS,
        },
        create: {
          flags: PROFILE_JSON_FLAGS,
        },
        update: {
          flags: PROFILE_JSON_FLAGS,
        },
        delete: {
          flags: FORCE_FLAGS,
        },
        "export-json": {
          flags: [...PROFILE_JSON_FLAGS, "--output"],
        },
        "export-markdown": {
          flags: ["--profile", "--output", ...HELP_FLAGS],
        },
        "import-json": {
          flags: [...FORCE_FLAGS, "--file", "--raw"],
        },
        "import-markdown": {
          flags: [...FORCE_FLAGS, "--file"],
        },
        category: {
          flags: HELP_FLAGS,
          subcommands: {
            list: { flags: [...PROFILE_JSON_FLAGS, "--page", "--size", "--keyword", "--sort"] },
            get: { flags: PROFILE_JSON_FLAGS },
            create: {
              flags: [
                ...PROFILE_JSON_FLAGS,
                "--display-name",
                "--slug",
                "--description",
                "--cover",
                "--priority",
              ],
            },
            update: {
              flags: [
                ...PROFILE_JSON_FLAGS,
                "--display-name",
                "--slug",
                "--description",
                "--cover",
                "--priority",
              ],
            },
            delete: { flags: FORCE_FLAGS },
          },
        },
        tag: {
          flags: HELP_FLAGS,
          subcommands: {
            list: { flags: [...PROFILE_JSON_FLAGS, "--page", "--size", "--keyword", "--sort"] },
            get: { flags: PROFILE_JSON_FLAGS },
            create: {
              flags: [...PROFILE_JSON_FLAGS, "--display-name", "--slug", "--color", "--cover"],
            },
            update: {
              flags: [...PROFILE_JSON_FLAGS, "--display-name", "--slug", "--color", "--cover"],
            },
            delete: { flags: FORCE_FLAGS },
          },
        },
      },
    },
    "single-page": {
      flags: HELP_FLAGS,
      subcommands: {
        list: {
          flags: [
            ...PROFILE_JSON_FLAGS,
            "--page",
            "--size",
            "--keyword",
            "--publish-phase",
            "--visible",
          ],
        },
        get: {
          flags: PROFILE_JSON_FLAGS,
        },
        open: {
          flags: PROFILE_JSON_FLAGS,
        },
        create: {
          flags: PROFILE_JSON_FLAGS,
        },
        update: {
          flags: PROFILE_JSON_FLAGS,
        },
        delete: {
          flags: FORCE_FLAGS,
        },
        "export-json": {
          flags: [...PROFILE_JSON_FLAGS, "--output"],
        },
        "import-json": {
          flags: [...FORCE_FLAGS, "--file", "--raw"],
        },
      },
    },
    search: {
      flags: ["--profile", "--url", "--keyword", "--limit", "--json", ...HELP_FLAGS],
    },
    plugin: {
      flags: HELP_FLAGS,
      subcommands: {
        list: { flags: PROFILE_JSON_FLAGS },
        get: { flags: PROFILE_JSON_FLAGS },
        enable: { flags: PROFILE_JSON_FLAGS },
        disable: { flags: FORCE_FLAGS },
        uninstall: { flags: FORCE_FLAGS },
        install: { flags: PROFILE_JSON_FLAGS },
        upgrade: { flags: [...PROFILE_JSON_FLAGS, "--all"] },
      },
    },
    theme: {
      flags: HELP_FLAGS,
      subcommands: {
        list: { flags: PROFILE_JSON_FLAGS },
        get: { flags: PROFILE_JSON_FLAGS },
        current: { flags: PROFILE_JSON_FLAGS },
        install: { flags: PROFILE_JSON_FLAGS },
        upgrade: { flags: [...PROFILE_JSON_FLAGS, "--all"] },
        activate: { flags: PROFILE_JSON_FLAGS },
        reload: { flags: PROFILE_JSON_FLAGS },
        delete: { flags: FORCE_FLAGS },
      },
    },
    attachment: {
      flags: HELP_FLAGS,
      subcommands: {
        list: { flags: PROFILE_JSON_FLAGS },
        get: { flags: PROFILE_JSON_FLAGS },
        delete: { flags: FORCE_FLAGS },
        upload: { flags: PROFILE_JSON_FLAGS },
        download: { flags: [...PROFILE_JSON_FLAGS, "--output"] },
      },
    },
    backup: {
      flags: HELP_FLAGS,
      subcommands: {
        list: { flags: [...PROFILE_JSON_FLAGS, "--page", "--size"] },
        get: { flags: PROFILE_JSON_FLAGS },
        create: {
          flags: [...PROFILE_JSON_FLAGS, "--format", "--expires-at", "--wait", "--wait-timeout"],
        },
        download: { flags: [...PROFILE_JSON_FLAGS, "--output"] },
        delete: { flags: FORCE_FLAGS },
      },
    },
    moment: {
      flags: HELP_FLAGS,
      subcommands: {
        list: { flags: PROFILE_JSON_FLAGS },
        get: { flags: PROFILE_JSON_FLAGS },
        create: { flags: PROFILE_JSON_FLAGS },
        update: { flags: PROFILE_JSON_FLAGS },
        delete: { flags: FORCE_FLAGS },
      },
    },
    comment: {
      flags: HELP_FLAGS,
      subcommands: {
        list: { flags: PROFILE_JSON_FLAGS },
        get: { flags: PROFILE_JSON_FLAGS },
        approve: { flags: PROFILE_JSON_FLAGS },
        delete: { flags: FORCE_FLAGS },
        "create-reply": { flags: PROFILE_JSON_FLAGS },
        reply: {
          flags: HELP_FLAGS,
          subcommands: {
            list: { flags: [...PROFILE_JSON_FLAGS, "--comment", "--page", "--size"] },
            get: { flags: PROFILE_JSON_FLAGS },
            approve: { flags: PROFILE_JSON_FLAGS },
            delete: { flags: FORCE_FLAGS },
          },
        },
      },
    },
    notification: {
      flags: HELP_FLAGS,
      subcommands: {
        list: { flags: PROFILE_JSON_FLAGS },
        get: { flags: PROFILE_JSON_FLAGS },
        delete: { flags: FORCE_FLAGS },
        "mark-as-read": { flags: [...PROFILE_JSON_FLAGS, "--all"] },
      },
    },
    completion: {
      flags: HELP_FLAGS,
    },
  },
};

function resolveCompletionNode(path: string[]): CompletionNode {
  let node = COMPLETION_TREE;

  for (const token of path) {
    const next = node.subcommands?.[token];
    if (!next) {
      return node;
    }
    node = next;
  }

  return node;
}

function normalizeCommandPath(argsBeforeCurrent: string[]): string[] {
  const path: string[] = [];

  for (const token of argsBeforeCurrent) {
    if (token.startsWith("-")) {
      break;
    }
    path.push(token);
  }

  return path;
}

export function getCompletionCandidates(argsBeforeCurrent: string[], current: string): string[] {
  const path = normalizeCommandPath(argsBeforeCurrent);
  const node = resolveCompletionNode(path);
  const currentValue = current.trim();
  const includeFlags = currentValue.startsWith("-") || currentValue.length === 0;

  const candidates = new Set<string>();

  for (const name of Object.keys(node.subcommands ?? {})) {
    candidates.add(name);
  }

  if (includeFlags) {
    for (const flag of node.flags ?? []) {
      candidates.add(flag);
    }
  }

  return [...candidates].filter((item) => item.startsWith(currentValue)).sort();
}

export function renderBashCompletion(bin = "halo"): string {
  return `_${bin}_completion() {
  local cur
  cur="\${COMP_WORDS[COMP_CWORD]}"
  local -a args
  args=("\${COMP_WORDS[@]:1:COMP_CWORD}")

  local completions
  if ! completions=$(HALO_COMP_CUR="$cur" ${bin} __complete "\${args[@]}" 2>/dev/null); then
    return 0
  fi

  COMPREPLY=()
  while IFS= read -r line; do
    [[ -n "$line" ]] && COMPREPLY+=("$line")
  done <<< "$completions"
}

complete -F _${bin}_completion ${bin}
`;
}

export function renderZshCompletion(bin = "halo"): string {
  return `#compdef ${bin}

_${bin}_completion() {
  local cur
  cur="\${words[CURRENT]}"
  local -a args
  if (( CURRENT > 1 )); then
    args=("\${(@)words[2,CURRENT-1]}")
  else
    args=()
  fi

  local -a completions
  completions=("\${(@f)$(HALO_COMP_CUR="$cur" ${bin} __complete "\${args[@]}" 2>/dev/null)}")
  compadd -- "\${completions[@]}"
}

compdef _${bin}_completion ${bin}
`;
}

export function renderCompletionScript(shell: string, bin = "halo"): string {
  const normalized = shell.trim().toLowerCase();
  if (normalized === "bash") {
    return renderBashCompletion(bin);
  }
  if (normalized === "zsh") {
    return renderZshCompletion(bin);
  }
  throw new CliError(`Unsupported shell "${shell}". Supported shells: bash, zsh.`);
}
