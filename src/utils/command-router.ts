import type { CAC } from "cac";

interface CommandCliRouteOptions {
  command: string;
  cliName: string;
  args: string[];
  buildCli: () => CAC | Promise<CAC>;
}

interface NestedCliRouteOptions {
  branch: string;
  cliName: string;
  args: string[];
  buildCli: () => CAC;
}

export async function tryRunCommandCliRoute(options: CommandCliRouteOptions): Promise<boolean> {
  if (options.args[0] !== options.command) {
    return false;
  }

  const cli = await options.buildCli();

  if (options.args.length === 1) {
    cli.outputHelp();
    return true;
  }

  cli.parse(["node", options.cliName, ...options.args.slice(1)], { run: false });
  await cli.runMatchedCommand();
  return true;
}

export async function tryRunNestedCliRoute(options: NestedCliRouteOptions): Promise<boolean> {
  if (options.args[1] !== options.branch) {
    return false;
  }

  const nestedCli = options.buildCli();

  if (options.args.length === 2 || options.args[2] === "--help" || options.args[2] === "-h") {
    nestedCli.outputHelp();
    return true;
  }

  nestedCli.parse(["node", options.cliName, ...options.args.slice(2)], { run: false });
  await nestedCli.runMatchedCommand();
  return true;
}
