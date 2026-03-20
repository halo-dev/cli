import cac from "cac";

import packageJson from "../package.json";
import {
  registerAttachmentCommands,
  tryRunAttachmentCommand,
} from "./commands/attachment/index.js";
import { registerAuthCommands, tryRunAuthCommand } from "./commands/auth/index.js";
import { registerBackupCommands, tryRunBackupCommand } from "./commands/backup/index.js";
import { registerCommentCommands, tryRunCommentCommand } from "./commands/comment/index.js";
import { registerMomentCommands, tryRunMomentCommand } from "./commands/moment/index.js";
import {
  registerNotificationCommands,
  tryRunNotificationCommand,
} from "./commands/notification/index.js";
import { registerPluginCommands, tryRunPluginCommand } from "./commands/plugin/index.js";
import { registerPostCommands, tryRunPostCommand } from "./commands/post/index.js";
import { registerSearchCommands, tryRunSearchCommand } from "./commands/search/index.js";
import {
  registerSinglePageCommands,
  tryRunSinglePageCommand,
} from "./commands/single-page/index.js";
import { registerThemeCommands, tryRunThemeCommand } from "./commands/theme/index.js";
import { getCompletionCandidates, renderCompletionScript } from "./utils/completion.js";
import { formatError } from "./utils/errors.js";
import { RuntimeContext } from "./utils/runtime.js";

const cli = cac("halo");
const runtime = new RuntimeContext();

const commandModules = [
  {
    register: registerAuthCommands,
    tryRun: tryRunAuthCommand,
  },
  {
    register: registerPostCommands,
    tryRun: tryRunPostCommand,
  },
  {
    register: registerSinglePageCommands,
    tryRun: tryRunSinglePageCommand,
  },
  {
    register: registerSearchCommands,
    tryRun: tryRunSearchCommand,
  },
  {
    register: registerPluginCommands,
    tryRun: tryRunPluginCommand,
  },
  {
    register: registerThemeCommands,
    tryRun: tryRunThemeCommand,
  },
  {
    register: registerAttachmentCommands,
    tryRun: tryRunAttachmentCommand,
  },
  {
    register: registerBackupCommands,
    tryRun: tryRunBackupCommand,
  },
  {
    register: registerMomentCommands,
    tryRun: tryRunMomentCommand,
  },
  {
    register: registerCommentCommands,
    tryRun: tryRunCommentCommand,
  },
  {
    register: registerNotificationCommands,
    tryRun: tryRunNotificationCommand,
  },
] as const;

for (const commandModule of commandModules) {
  commandModule.register(cli);
}

cli.command("completion <shell>", "Generate shell completion script").action((shell: string) => {
  process.stdout.write(renderCompletionScript(shell));
});

cli.help();
cli.version(packageJson.version);

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    cli.outputHelp();
    return;
  }

  if (args[0] === "__complete") {
    const current = process.env.HALO_COMP_CUR ?? "";
    process.stdout.write(`${getCompletionCandidates(args.slice(1), current).join("\n")}\n`);
    return;
  }

  for (const commandModule of commandModules) {
    if (await commandModule.tryRun(args, runtime)) {
      return;
    }
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
