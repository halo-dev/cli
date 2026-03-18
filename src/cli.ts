import cac from "cac";

import packageJson from "../package.json";
import { registerAttachmentCommands, tryRunAttachmentCommand } from "./commands/attachment.js";
import { registerAuthCommands, tryRunAuthCommand } from "./commands/auth.js";
import { registerBackupCommands, tryRunBackupCommand } from "./commands/backup.js";
import { registerMomentCommands, tryRunMomentCommand } from "./commands/moment.js";
import { registerPluginCommands, tryRunPluginCommand } from "./commands/plugin.js";
import { registerPostCommands, tryRunPostCommand } from "./commands/post.js";
import { formatError } from "./utils/errors.js";
import { RuntimeContext } from "./utils/runtime.js";

const cli = cac("halo");
const runtime = new RuntimeContext();

registerAuthCommands(cli);
registerPostCommands(cli);
registerPluginCommands(cli);
registerAttachmentCommands(cli);
registerBackupCommands(cli);
registerMomentCommands(cli);

cli.help();
cli.version(packageJson.version);

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    cli.outputHelp();
    return;
  }

  if (await tryRunAuthCommand(args, runtime)) {
    return;
  }

  if (await tryRunAttachmentCommand(args, runtime)) {
    return;
  }

  if (await tryRunPluginCommand(args, runtime)) {
    return;
  }

  if (await tryRunPostCommand(args, runtime)) {
    return;
  }

  if (await tryRunBackupCommand(args, runtime)) {
    return;
  }

  if (await tryRunMomentCommand(args, runtime)) {
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
