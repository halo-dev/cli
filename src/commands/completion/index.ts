import type { CAC } from "cac";
import cac from "cac";

import { tryRunCommandCliRoute } from "../../utils/command-router.js";
import type { RuntimeContext } from "../../utils/runtime.js";

// ─── Command Tree ─────────────────────────────────────────────────────────────

const TOP_LEVEL_COMMANDS = [
  "auth",
  "post",
  "single-page",
  "search",
  "plugin",
  "theme",
  "attachment",
  "backup",
  "moment",
  "comment",
  "notification",
  "completion",
];

const SUBCOMMANDS: Record<string, string[]> = {
  auth: ["login", "current", "profile"],
  "auth profile": ["list", "current", "get", "use", "delete", "doctor"],
  post: ["list", "get", "create", "update", "delete", "open", "import-json", "export-json"],
  "single-page": [
    "list",
    "get",
    "create",
    "update",
    "delete",
    "open",
    "import-json",
    "export-json",
  ],
  plugin: ["list", "get", "enable", "disable", "install", "uninstall", "upgrade"],
  theme: ["list", "get", "current", "install", "upgrade", "activate", "reload", "delete"],
  attachment: ["list", "get", "delete", "upload", "download"],
  backup: ["list", "get", "create", "download", "delete"],
  moment: ["list", "get", "create", "update", "delete"],
  comment: ["list", "get", "approve", "delete", "create-reply", "reply"],
  "comment reply": ["list", "get", "approve", "delete"],
  notification: ["list", "get", "delete", "mark-as-read"],
  completion: ["bash", "zsh", "fish"],
};

// ─── Completion Logic ─────────────────────────────────────────────────────────

function getCandidates(context: string[], current: string): string[] {
  // Bail out if any context word looks like an option flag
  if (context.some((w) => w.startsWith("-"))) {
    return [];
  }

  let candidates: string[];

  if (context.length === 0) {
    candidates = TOP_LEVEL_COMMANDS;
  } else if (context.length === 1) {
    candidates = SUBCOMMANDS[context[0]] ?? [];
  } else if (context.length === 2) {
    const nestedKey = `${context[0]} ${context[1]}`;
    candidates = SUBCOMMANDS[nestedKey] ?? [];
  } else {
    return [];
  }

  // Filter by the partial word being typed (skip filtering for option flags)
  if (current !== "" && !current.startsWith("-")) {
    return candidates.filter((c) => c.startsWith(current));
  }

  return candidates;
}

/**
 * Returns shell-completion candidates for the given command-line words.
 *
 * When bash/zsh call back via COMP_LINE + COMP_POINT the env vars are used
 * for precise cursor-position analysis.  For fish (no such env vars) the
 * explicit words array is used instead.
 *
 * @param words - The full command line words including the binary name
 *                e.g. ["halo", "post", "li"] or ["halo", "auth", ""]
 */
export function computeCompletions(words: string[]): string[] {
  const compLine = process.env.COMP_LINE;
  const compPointStr = process.env.COMP_POINT;

  if (compLine !== undefined && compPointStr !== undefined) {
    // Bash / zsh mode – use COMP_LINE and COMP_POINT for accurate cursor info
    const point = parseInt(compPointStr, 10);
    const lineUpToCursor = compLine.slice(0, isNaN(point) ? compLine.length : point);
    const parts = lineUpToCursor.split(/\s+/);
    // parts[0] is the binary name ("halo"), drop it
    const afterBin = parts.slice(1);
    if (afterBin.length === 0) {
      return getCandidates([], "");
    }
    const current = afterBin[afterBin.length - 1]!;
    const context = afterBin.slice(0, -1).filter(Boolean);
    return getCandidates(context, current);
  }

  // Fish mode – rely on the passed words array
  // words = ["halo", ...contextWords..., currentPartial]
  const afterBin = words.slice(1);
  if (afterBin.length === 0) {
    return getCandidates([], "");
  }
  const current = afterBin[afterBin.length - 1]!;
  const context = afterBin.slice(0, -1).filter(Boolean);
  return getCandidates(context, current);
}

// ─── Shell Script Generators ──────────────────────────────────────────────────

function generateBashScript(): string {
  return [
    "###-begin-halo-completion-###",
    "if type complete &>/dev/null; then",
    "  _halo_completion() {",
    '    local si="$IFS"',
    "    IFS=$'\\n' COMPREPLY=($(COMP_CWORD=\"$COMP_CWORD\" \\",
    '                             COMP_LINE="$COMP_LINE" \\',
    '                             COMP_POINT="$COMP_POINT" \\',
    '                             halo completion -- "${COMP_WORDS[@]}" \\',
    "                             2>/dev/null)) || true",
    '    IFS="$si"',
    "  }",
    "  complete -o default -F _halo_completion halo",
    "fi",
    "###-end-halo-completion-###",
  ].join("\n");
}

function generateZshScript(): string {
  return [
    "###-begin-halo-completion-###",
    "if type compdef &>/dev/null; then",
    "  _halo_completion() {",
    '    local si="$IFS"',
    '    compadd -- $(COMP_CWORD="$((CURRENT-1))" \\',
    '                 COMP_LINE="$BUFFER" \\',
    '                 COMP_POINT="${#BUFFER}" \\',
    '                 halo completion -- "${words[@]}" \\',
    "                 2>/dev/null) || true",
    '    IFS="$si"',
    "  }",
    "  compdef _halo_completion halo",
    "fi",
    "###-end-halo-completion-###",
  ].join("\n");
}

function generateFishScript(): string {
  return [
    "###-begin-halo-completion-###",
    "function __halo_complete_fish",
    "    set -l args (commandline -opc)",
    "    set -l current (commandline -ct)",
    '    if test -n "$current"',
    "        halo completion -- $args 2>/dev/null",
    "    else",
    '        halo completion -- $args "" 2>/dev/null',
    "    end",
    "end",
    "",
    'complete -c halo -f -a "(__halo_complete_fish)"',
    "###-end-halo-completion-###",
  ].join("\n");
}

// ─── CAC Sub-CLI ──────────────────────────────────────────────────────────────

function buildCompletionCli(): CAC {
  const completionCli = cac("halo completion");

  completionCli.command("bash", "Generate bash completion script").action(() => {
    process.stdout.write(generateBashScript() + "\n");
  });

  completionCli.command("zsh", "Generate zsh completion script").action(() => {
    process.stdout.write(generateZshScript() + "\n");
  });

  completionCli.command("fish", "Generate fish completion script").action(() => {
    process.stdout.write(generateFishScript() + "\n");
  });

  completionCli.help();
  return completionCli;
}

// ─── Command Module Exports ───────────────────────────────────────────────────

export function registerCompletionCommands(cli: CAC): void {
  cli.command("completion", "Generate shell completion scripts");
}

export async function tryRunCompletionCommand(
  args: string[],
  _runtime: RuntimeContext,
): Promise<boolean> {
  if (args[0] !== "completion") {
    return false;
  }

  // Handle the inline completion callback:  halo completion -- word1 word2 ...
  if (args[1] === "--") {
    const words = args.slice(2);
    const completions = computeCompletions(words);
    if (completions.length > 0) {
      process.stdout.write(completions.join("\n") + "\n");
    }
    return true;
  }

  return tryRunCommandCliRoute({
    command: "completion",
    cliName: "halo completion",
    args,
    buildCli: () => buildCompletionCli(),
  });
}
