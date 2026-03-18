import { input, password, select } from "@inquirer/prompts";
import cac, { type CAC } from "cac";

import type { AuthType, HaloProfile } from "../types.js";
import { createProfileTimestamp } from "../utils/config-store.js";
import { CliError } from "../utils/errors.js";
import {
  printAuthLoginSuccess,
  printCurrentProfile,
  printJson,
  printProfileList,
  printProfileUseSuccess,
} from "../utils/format.js";
import { isInteractive } from "../utils/post-input.js";
import { normalizeBaseUrl, RuntimeContext } from "../utils/runtime.js";

interface AuthLoginOptions {
  profile?: string;
  url?: string;
  authType?: AuthType;
  username?: string;
  password?: string;
  token?: string;
  json?: boolean;
}

interface AuthCurrentOptions {
  profile?: string;
  json?: boolean;
}

interface AuthProfileUseOptions {
  profile?: string;
  json?: boolean;
}

function createAuthProfileCli(runtime: RuntimeContext): CAC {
  const profileCli = cac("halo auth profile");

  profileCli
    .command("list", "List saved profiles")
    .option("--json", "Output JSON")
    .action(async (options: { json?: boolean }) => {
      const { activeProfile, profiles } = await runtime.configStore.listProfiles();
      printProfileList(activeProfile, profiles, options.json);
    });

  profileCli
    .command("current", "Show the active saved profile")
    .option("--json", "Output JSON")
    .action(async (options: { json?: boolean }) => {
      const profile = await runtime.configStore.getActiveProfile();
      printCurrentProfile(profile, options.json);
    });

  profileCli
    .command("use [name]", "Switch the active profile")
    .option("--profile <name>", "Profile name to activate")
    .option("--json", "Output JSON")
    .action(async (name: string | undefined, options: AuthProfileUseOptions) => {
      const profileName = name ?? options.profile;
      if (!profileName) {
        throw new CliError(
          "`halo auth profile use` requires a profile name, for example: `halo auth profile use local`. You can also use `--profile <name>`.",
        );
      }

      const profile = await runtime.configStore.setActiveProfile(profileName);
      printProfileUseSuccess(profile, options.json);
    });

  profileCli.usage("<command> [flags]");
  profileCli.example((bin) => `${bin} list`);
  profileCli.example((bin) => `${bin} current`);
  profileCli.example((bin) => `${bin} use local`);
  profileCli.help();

  return profileCli;
}

function createAuthCli(runtime: RuntimeContext): CAC {
  const authCli = cac("halo auth");

  authCli
    .command("login", "Login and save a Halo profile")
    .option("--profile <name>", "Profile name to save")
    .option("--url <url>", "Halo base URL")
    .option("--auth-type <type>", "Authentication type: basic or bearer")
    .option("--username <username>", "Basic Auth username")
    .option("--password <password>", "Basic Auth password")
    .option("--token <token>", "Bearer personal access token")
    .option("--json", "Output JSON")
    .action(async (options: AuthLoginOptions) => {
      const resolved = await resolveLoginInput(options);
      const existing = await runtime.configStore.getProfile(resolved.profile);
      const timestamps = createProfileTimestamp(existing);
      const profile: HaloProfile = {
        name: resolved.profile,
        baseUrl: normalizeBaseUrl(resolved.url),
        auth:
          resolved.authType === "basic"
            ? {
                type: "basic",
                username: resolved.username!,
                password: resolved.password!,
              }
            : {
                type: "bearer",
                token: resolved.token!,
              },
        ...timestamps,
      };

      const user = await runtime.validateProfile(profile);
      await runtime.configStore.upsertProfile(profile, true);

      if (options.json) {
        printJson({
          profile,
          user,
        });
        return;
      }

      printAuthLoginSuccess(profile, user, false);
    });

  authCli
    .command("current", "Show the current active profile")
    .option("--profile <name>", "Inspect a specific profile by name")
    .option("--json", "Output JSON")
    .action(async (options: AuthCurrentOptions) => {
      const profile = await runtime.configStore.getActiveProfile(options.profile);
      printCurrentProfile(profile, options.json);
    });

  authCli.command("profile", "Manage saved profiles");

  authCli.usage("<command> [flags]");
  authCli.example(
    (bin) =>
      `${bin} login --profile local --url http://127.0.0.1:8090 --auth-type bearer --token <token>`,
  );
  authCli.example((bin) => `${bin} current`);
  authCli.example((bin) => `${bin} profile list`);
  authCli.example((bin) => `${bin} profile use local`);
  authCli.help();

  return authCli;
}

export async function tryRunAuthCommand(args: string[], runtime: RuntimeContext): Promise<boolean> {
  if (args[0] !== "auth") {
    return false;
  }

  if (args[1] === "profile") {
    const profileCli = createAuthProfileCli(runtime);

    if (args.length === 2) {
      profileCli.outputHelp();
      return true;
    }

    profileCli.parse(["node", "halo auth profile", ...args.slice(2)], { run: false });
    await profileCli.runMatchedCommand();
    return true;
  }

  const authCli = createAuthCli(runtime);

  if (args.length === 1) {
    authCli.outputHelp();
    return true;
  }

  authCli.parse(["node", "halo auth", ...args.slice(1)], { run: false });
  await authCli.runMatchedCommand();
  return true;
}

async function resolveLoginInput(
  options: AuthLoginOptions,
): Promise<Required<Pick<AuthLoginOptions, "profile" | "url" | "authType">> & AuthLoginOptions> {
  const interactive = isInteractive();

  const profile =
    options.profile ??
    (interactive ? await input({ message: "Profile name", default: "default" }) : undefined);
  const url =
    options.url ??
    (interactive
      ? await input({
          message: "Halo base URL",
          validate: (value) => (value.trim().length > 0 ? true : "Base URL is required."),
        })
      : undefined);
  const authType =
    options.authType ??
    (interactive
      ? ((await select({
          message: "Authentication type",
          choices: [
            { name: "Basic Auth", value: "basic" },
            { name: "Bearer token", value: "bearer" },
          ],
        })) as AuthType)
      : undefined);

  if (!profile || !url || !authType) {
    throw new CliError(
      "`halo auth login` requires --profile, --url, and --auth-type in non-interactive mode.",
    );
  }

  let username = options.username;
  let passwordValue = options.password;
  let token = options.token;

  if (authType === "basic") {
    if (!username && interactive) {
      username = await input({ message: "Username" });
    }
    if (!passwordValue && interactive) {
      passwordValue = await password({ message: "Password" });
    }
    if (!username || !passwordValue) {
      throw new CliError("Basic Auth requires --username and --password.");
    }
  } else {
    if (!token && interactive) {
      token = await password({ message: "Personal access token" });
    }
    if (!token) {
      throw new CliError("Bearer Auth requires --token.");
    }
  }

  return {
    ...options,
    profile,
    url,
    authType,
    username,
    password: passwordValue,
    token,
  };
}

export function registerAuthCommands(cli: CAC): void {
  cli.command("auth", "Authentication commands");
}
