import cac from "cac";

import packageJson from "../package.json";
import { registerAttachmentCommands } from "./commands/attachment.js";
import { registerAuthCommands, tryHandleAuthHelp } from "./commands/auth.js";
import { registerBackupCommands } from "./commands/backup.js";
import { registerPluginCommands } from "./commands/plugin.js";
import { registerPostCommands } from "./commands/post.js";
import { formatError } from "./utils/errors.js";
import { RuntimeContext } from "./utils/runtime.js";

const cli = cac("halo");
const runtime = new RuntimeContext();

registerAuthCommands(cli, runtime);
registerPostCommands(cli, runtime);
registerPluginCommands(cli, runtime);
registerAttachmentCommands(cli, runtime);
registerBackupCommands(cli, runtime);

cli.help();
cli.version(packageJson.version);

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    cli.outputHelp();
    return;
  }

  if (tryHandleAuthHelp(args)) {
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
