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

export function registerAuthCommands(cli: CAC, runtime: RuntimeContext): void {
  cli
    .command("auth [action] [name] [target]", "Authentication commands")
    .usage("auth <command> [flags]")
    .option("--profile <name>", "Profile name to save")
    .option("--url <url>", "Halo base URL")
    .option("--auth-type <type>", "Authentication type: basic or bearer")
    .option("--username <username>", "Basic Auth username")
    .option("--password <password>", "Basic Auth password")
    .option("--token <token>", "Bearer personal access token")
    .option("--json", "Output JSON")
    .example(
      (bin) =>
        `${bin} auth login --profile local --url http://127.0.0.1:8090 --auth-type bearer --token <token>`,
    )
    .example((bin) => `${bin} auth current`)
    .example((bin) => `${bin} auth profile list`)
    .example((bin) => `${bin} auth profile use local`)
    .action(
      async (
        action: string | undefined,
        name: string | undefined,
        target: string | undefined,
        options: AuthLoginOptions,
      ) => {
        if (!action) {
          outputAuthHelp();
          return;
        }

        if (action === "login") {
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
          return;
        }

        if (action === "profile") {
          if (!name) {
            outputAuthProfileHelp();
            return;
          }

          if (name === "list") {
            const { activeProfile, profiles } = await runtime.configStore.listProfiles();
            printProfileList(activeProfile, profiles, options.json);
            return;
          }

          if (name === "current") {
            const profile = await runtime.configStore.getActiveProfile();
            printCurrentProfile(profile, options.json);
            return;
          }

          if (name === "use") {
            const profileName = target ?? options.profile;
            if (!profileName) {
              throw new CliError(
                "`halo auth profile use` requires a profile name, for example: `halo auth profile use local`. You can also use `--profile <name>`.",
              );
            }

            const profile = await runtime.configStore.setActiveProfile(profileName);
            printProfileUseSuccess(profile, options.json);
            return;
          }

          throw new CliError("`halo auth profile` supports: list, current, use.");
        }

        if (action === "current") {
          const profile = await runtime.configStore.getActiveProfile(options.profile);
          printCurrentProfile(profile, options.json);
          return;
        }

        throw new CliError("Unsupported auth action. Supported actions: login, profile, current.");
      },
    );
}
