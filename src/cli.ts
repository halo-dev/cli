import cac from "cac";

import packageJson from "../package.json";
import { registerAttachmentCommands, tryRunAttachmentCommand } from "./commands/attachment.js";
import { registerAuthCommands, tryRunAuthCommand } from "./commands/auth.js";
import { registerBackupCommands, tryRunBackupCommand } from "./commands/backup.js";
import { registerCommentCommands, tryRunCommentCommand } from "./commands/comment.js";
import { registerMomentCommands, tryRunMomentCommand } from "./commands/moment.js";
import {
  registerNotificationCommands,
  tryRunNotificationCommand,
} from "./commands/notification.js";
import { registerPluginCommands, tryRunPluginCommand } from "./commands/plugin.js";
import { registerPostCommands, tryRunPostCommand } from "./commands/post.js";
import { registerSearchCommands, tryRunSearchCommand } from "./commands/search.js";
import { registerThemeCommands, tryRunThemeCommand } from "./commands/theme.js";
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

cli.help();
cli.version(packageJson.version);

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    cli.outputHelp();
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
