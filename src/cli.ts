import cac from "cac";

import packageJson from "../package.json";
import { registerAuthCommands } from "./commands/auth.js";
import { registerPluginCommands } from "./commands/plugin.js";
import { registerPostCommands } from "./commands/post.js";
import { formatError } from "./utils/errors.js";
import { RuntimeContext } from "./utils/runtime.js";

const cli = cac("halo");
const runtime = new RuntimeContext();

registerAuthCommands(cli, runtime);
registerPostCommands(cli, runtime);
registerPluginCommands(cli, runtime);

cli.help();
cli.version(packageJson.version);

async function main(): Promise<void> {
	cli.parse(process.argv, { run: false });
	await cli.runMatchedCommand();
}

try {
	await main();
} catch (error) {
	process.stderr.write(`${formatError(error)}\n`);
	process.exitCode = 1;
}
