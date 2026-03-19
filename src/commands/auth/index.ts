import { input, password, select } from "@inquirer/prompts";
import cac, { type CAC } from "cac";

import type { AuthType, HaloProfile, StoredHaloProfile } from "../../shared/profile.js";
import { toStoredHaloProfile } from "../../shared/profile.js";
import { tryRunCommandCliRoute, tryRunNestedCliRoute } from "../../utils/command-router.js";
import { confirmDangerousAction } from "../../utils/confirmation.js";
import { CliError } from "../../utils/errors.js";
import { isInteractive } from "../../utils/options.js";
import { printJson } from "../../utils/output.js";
import { RuntimeContext } from "../../utils/runtime.js";
import { normalizeBaseUrl } from "../../utils/url.js";
import {
  printAuthLoginSuccess,
  printProfileDeleteSuccess,
  printProfileDoctorReport,
  printProfileList,
  printStoredProfile,
  printProfileUseSuccess,
} from "./format.js";

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

interface AuthProfileGetOptions {
  profile?: string;
  json?: boolean;
}

interface AuthProfileDeleteOptions {
  profile?: string;
  json?: boolean;
  force?: boolean;
}

interface AuthProfileDoctorOptions {
  json?: boolean;
}

export function createProfileTimestamp(existing?: Pick<StoredHaloProfile, "createdAt">): {
  createdAt: string;
  updatedAt: string;
} {
  const now = new Date().toISOString();
  return {
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

async function validateProfile(profile: HaloProfile, runtime: RuntimeContext) {
  const clients = runtime.getClientsForResolvedProfile(profile);
  const response = await clients.console.user.getCurrentUserDetail();
  return response.data;
}

export function resolveAuthProfileUseName(
  name: string | undefined,
  profile: string | undefined,
): string {
  return resolveAuthProfileName(name, profile, "halo auth profile use");
}

export function resolveAuthProfileName(
  name: string | undefined,
  profile: string | undefined,
  commandPath: string,
): string {
  const profileName = name ?? profile;
  if (!profileName) {
    throw new CliError(
      `\`${commandPath}\` requires a profile name, for example: \`${commandPath} local\`. You can also use --profile <name>.`,
    );
  }

  return profileName;
}

export function validateResolvedLoginInput(
  options: AuthLoginOptions,
  profile: string | undefined,
  url: string | undefined,
  authType: AuthType | undefined,
): Required<Pick<AuthLoginOptions, "profile" | "url" | "authType">> & AuthLoginOptions {
  if (!profile || !url || !authType) {
    throw new CliError(
      "`halo auth login` requires --profile, --url, and --auth-type in non-interactive mode.",
    );
  }

  let username = options.username;
  let passwordValue = options.password;
  let token = options.token;

  if (authType === "basic") {
    if (!username || !passwordValue) {
      throw new CliError("Basic Auth requires --username and --password.");
    }
  } else {
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

function buildAuthProfileCli(runtime: RuntimeContext): CAC {
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
      const profile = await runtime.configStore.getActiveStoredProfile();
      printStoredProfile(profile, options.json);
    });

  profileCli
    .command("get [name]", "Show a saved profile")
    .option("--profile <name>", "Profile name to inspect")
    .option("--json", "Output JSON")
    .action(async (name: string | undefined, options: AuthProfileGetOptions) => {
      const profileName = resolveAuthProfileName(name, options.profile, "halo auth profile get");
      const profile = await runtime.configStore.getStoredProfile(profileName);

      if (!profile) {
        throw new CliError(`Halo profile "${profileName}" does not exist.`);
      }

      printStoredProfile(profile, options.json);
    });

  profileCli
    .command("use [name]", "Switch the active profile")
    .option("--profile <name>", "Profile name to activate")
    .option("--json", "Output JSON")
    .action(async (name: string | undefined, options: AuthProfileUseOptions) => {
      const profileName = resolveAuthProfileUseName(name, options.profile);
      const profile = await runtime.configStore.setActiveProfile(profileName);
      printProfileUseSuccess(profile, options.json);
    });

  profileCli
    .command("delete [name]", "Delete a saved profile and its stored credentials")
    .option("--profile <name>", "Profile name to delete")
    .option("--json", "Output JSON")
    .option("--force", "Delete without confirmation")
    .action(async (name: string | undefined, options: AuthProfileDeleteOptions) => {
      const profileName = resolveAuthProfileName(name, options.profile, "halo auth profile delete");

      if (
        !(await confirmDangerousAction(
          {
            commandPath: "halo auth profile delete",
            actionLabel: "Delete",
            resourceLabel: "profile",
            resourceName: profileName,
            cancellationVerb: "deleting",
          },
          options,
        ))
      ) {
        return;
      }

      const result = await runtime.configStore.deleteProfile(profileName);
      printProfileDeleteSuccess(result.profile.name, result.activeProfile, options.json);
    });

  profileCli
    .command("doctor", "Check saved profiles against stored credentials")
    .option("--json", "Output JSON")
    .action(async (options: AuthProfileDoctorOptions) => {
      const report = await runtime.configStore.inspectProfileCredentials();
      printProfileDoctorReport(report, options.json);
      if (!report.ok) {
        process.exitCode = 1;
      }
    });

  profileCli.usage("<command> [flags]");
  profileCli.example((bin) => `${bin} list`);
  profileCli.example((bin) => `${bin} current`);
  profileCli.example((bin) => `${bin} get local`);
  profileCli.example((bin) => `${bin} use local`);
  profileCli.example((bin) => `${bin} delete local --force`);
  profileCli.example((bin) => `${bin} doctor`);
  profileCli.help();

  return profileCli;
}

function buildAuthCli(runtime: RuntimeContext): CAC {
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
      const existing = await runtime.configStore.getStoredProfile(resolved.profile);
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

      const user = await validateProfile(profile, runtime);
      await runtime.configStore.upsertProfile(profile, true);
      const storedProfile = toStoredHaloProfile(profile);

      if (options.json) {
        printJson({
          profile: storedProfile,
          user,
        });
        return;
      }

      printAuthLoginSuccess(storedProfile, user, false);
    });

  authCli
    .command("current", "Show the current active profile")
    .option("--profile <name>", "Inspect a specific profile by name")
    .option("--json", "Output JSON")
    .action(async (options: AuthCurrentOptions) => {
      const profile = await runtime.configStore.getActiveStoredProfile(options.profile);
      printStoredProfile(profile, options.json);
    });

  authCli.command("profile", "Manage saved profiles");

  authCli.usage("<command> [flags]");
  authCli.example(
    (bin) =>
      `${bin} login --profile local --url http://127.0.0.1:8090 --auth-type bearer --token <token>`,
  );
  authCli.example((bin) => `${bin} current`);
  authCli.example((bin) => `${bin} profile list`);
  authCli.example((bin) => `${bin} profile get local`);
  authCli.example((bin) => `${bin} profile use local`);
  authCli.example((bin) => `${bin} profile delete local --force`);
  authCli.example((bin) => `${bin} profile doctor`);
  authCli.help();

  return authCli;
}

export async function tryRunAuthCommand(args: string[], runtime: RuntimeContext): Promise<boolean> {
  if (args[0] !== "auth") {
    return false;
  }

  if (
    await tryRunNestedCliRoute({
      branch: "profile",
      cliName: "halo auth profile",
      args,
      buildCli: () => buildAuthProfileCli(runtime),
    })
  ) {
    return true;
  }

  return tryRunCommandCliRoute({
    command: "auth",
    cliName: "halo auth",
    args,
    buildCli: () => buildAuthCli(runtime),
  });
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

  if (authType === "basic") {
    if (!options.username && interactive) {
      options.username = await input({ message: "Username" });
    }
    if (!options.password && interactive) {
      options.password = await password({ message: "Password" });
    }
  } else {
    if (!options.token && interactive) {
      options.token = await password({ message: "Personal access token" });
    }
  }

  return validateResolvedLoginInput(options, profile, url, authType);
}

export function registerAuthCommands(cli: CAC): void {
  cli.command("auth", "Authentication commands");
}
