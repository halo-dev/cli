import cac from "cac";

import packageJson from "../package.json";
import { registerAuthCommands } from "./commands/auth.js";
import { registerPluginCommands } from "./commands/plugin.js";
import { registerPostCommands } from "./commands/post.js";
import { printCommandHelp } from "./utils/command-help.js";
import { formatError } from "./utils/errors.js";
import { RuntimeContext } from "./utils/runtime.js";

const cli = cac("halo");
const runtime = new RuntimeContext();

registerAuthCommands(cli, runtime);
registerPostCommands(cli, runtime);
registerPluginCommands(cli, runtime);

cli.help();
cli.version(packageJson.version);

function printRootHelp(): void {
  printCommandHelp({
    summary: "Work with Halo instances.",
    usage: "halo <command> [flags]",
    sections: [
      {
        title: "COMMANDS",
        commands: [
          { name: "auth", description: "Manage authentication and profiles" },
          { name: "post", description: "Work with posts" },
          { name: "plugin", description: "Work with plugins" },
        ],
      },
    ],
    flags: [
      { name: "--help", description: "Show help for command" },
      { name: "--version", description: "Show version number" },
    ],
    inheritedFlags: [],
    examples: ["halo auth login", "halo post list", "halo plugin upgrade <name> --online"],
    learnMore: ["Use `halo <command> --help` for more information about a command."],
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.every((arg) => arg === "--help" || arg === "-h")) {
    printRootHelp();
    return;
  }

  cli.parse(process.argv, { run: false });
  await cli.runMatchedCommand();
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${formatError(error)}\n`);
  process.exitCode = 1;
}
