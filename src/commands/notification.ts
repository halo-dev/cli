import { NotificationV1alpha1UcApi, type Notification } from "@halo-dev/api-client";
import cac, { type CAC } from "cac";

import { confirmDangerousAction } from "../utils/confirmation.js";
import { CliError } from "../utils/errors.js";
import { printJson, printNotification, printNotificationList } from "../utils/format.js";
import { parseNumberOption } from "../utils/post-input.js";
import { RuntimeContext } from "../utils/runtime.js";

interface NotificationCommandOptions {
  profile?: string;
  json?: boolean;
}

interface NotificationListOptions extends NotificationCommandOptions {
  page?: string;
  size?: string;
  unread?: string;
  sort?: string;
}

interface NotificationDeleteOptions extends NotificationCommandOptions {
  force?: boolean;
}

interface NotificationMarkAsReadOptions extends NotificationCommandOptions {
  all?: boolean;
}

export function buildNotificationListRequest(options: NotificationListOptions): {
  page?: number;
  size?: number;
  fieldSelector?: string[];
  sort?: string[];
} {
  const unread = options.unread?.trim() || "true";

  return {
    page: parseNumberOption(options.page),
    size: parseNumberOption(options.size),
    fieldSelector: [`spec.unread=${unread}`],
    sort: options.sort?.trim() ? [options.sort.trim()] : undefined,
  };
}

export function resolveNotificationMarkAsReadTarget(
  name: string | undefined,
  options: NotificationMarkAsReadOptions,
): { mode: "all" } | { mode: "single"; name: string } {
  if (options.all) {
    if (name) {
      throw new CliError(
        "`halo notification mark-as-read --all` does not accept a notification name.",
      );
    }

    return { mode: "all" };
  }

  if (!name) {
    throw new CliError(
      "`halo notification mark-as-read` requires a notification name, or use `--all`.",
    );
  }

  return { mode: "single", name };
}

async function createNotificationApi(
  runtime: RuntimeContext,
  options?: NotificationCommandOptions,
) {
  const { profile, clients } = await runtime.getClientsForOptions(options);
  const api = new NotificationV1alpha1UcApi(undefined, profile.baseUrl, clients.axios);
  const user = await clients.console.user.getCurrentUserDetail();
  const username = user.data.user.metadata.name;

  return { api, username };
}

async function getNotificationByName(
  api: NotificationV1alpha1UcApi,
  username: string,
  name: string,
): Promise<Notification> {
  const response = await api.listUserNotifications({
    username,
    size: 1,
    fieldSelector: [`metadata.name=${name}`],
  });
  const notification = response.data.items[0];

  if (!notification) {
    throw new CliError(`Notification ${name} not found.`);
  }

  return notification;
}

async function listUnreadNotificationNames(
  api: NotificationV1alpha1UcApi,
  username: string,
): Promise<string[]> {
  const response = await api.listUserNotifications({
    username,
    size: 1000,
    fieldSelector: ["spec.unread=true"],
  });

  return response.data.items.map((item) => item.metadata.name);
}

function createNotificationCli(runtime: RuntimeContext): CAC {
  const notificationCli = cac("halo notification");

  notificationCli
    .command("list", "List notifications")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--page <number>", "Page number")
    .option("--size <number>", "Page size")
    .option("--unread <boolean>", "Filter by unread field selector, default true")
    .option("--sort <sort>", "Sort expression, e.g. metadata.creationTimestamp,desc")
    .action(async (options: NotificationListOptions) => {
      const { api, username } = await createNotificationApi(runtime, options);
      const response = await api.listUserNotifications({
        username,
        ...buildNotificationListRequest(options),
      });
      printNotificationList(response.data, options.json);
    });

  notificationCli
    .command("get <name>", "Show notification details")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .action(async (name: string, options: NotificationCommandOptions) => {
      const { api, username } = await createNotificationApi(runtime, options);
      const notification = await getNotificationByName(api, username, name);
      printNotification(notification, options.json);
    });

  notificationCli
    .command("delete <name>", "Delete a notification")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--force", "Delete without confirmation")
    .action(async (name: string, options: NotificationDeleteOptions) => {
      const { api, username } = await createNotificationApi(runtime, options);

      if (
        !(await confirmDangerousAction(
          {
            commandPath: "halo notification delete",
            actionLabel: "Delete",
            resourceLabel: "notification",
            resourceName: name,
            cancellationVerb: "deleting",
          },
          options,
        ))
      ) {
        return;
      }

      await api.deleteSpecifiedNotification({ username, name });

      if (options.json) {
        printJson({ deleted: true, name });
        return;
      }

      process.stdout.write(`Deleted notification ${name}.\n`);
    });

  notificationCli
    .command("mark-as-read [name]", "Mark a notification as read")
    .option("--profile <name>", "Halo profile name")
    .option("--json", "Output JSON")
    .option("--all", "Mark all unread notifications as read")
    .action(async (name: string | undefined, options: NotificationMarkAsReadOptions) => {
      const target = resolveNotificationMarkAsReadTarget(name, options);
      const { api, username } = await createNotificationApi(runtime, options);

      if (target.mode === "single") {
        const response = await api.markNotificationAsRead({
          username,
          name: target.name,
        });
        printNotification(response.data, options.json);
        return;
      }

      const names = await listUnreadNotificationNames(api, username);

      if (names.length === 0) {
        if (options.json) {
          printJson({ markedAsRead: [], count: 0 });
          return;
        }

        process.stdout.write("No unread notifications found.\n");
        return;
      }

      const response = await api.markNotificationsAsRead({
        username,
        markSpecifiedRequest: { names },
      });

      if (options.json) {
        printJson({ markedAsRead: response.data, count: response.data.length });
        return;
      }

      process.stdout.write(`Marked ${response.data.length} notification(s) as read.\n`);
    });

  notificationCli.usage("<command> [flags]");
  notificationCli.example((bin) => `${bin} list`);
  notificationCli.example((bin) => `${bin} list --unread=false`);
  notificationCli.example((bin) => `${bin} get notification-abc123`);
  notificationCli.example((bin) => `${bin} delete notification-abc123 --force`);
  notificationCli.example((bin) => `${bin} mark-as-read notification-abc123`);
  notificationCli.example((bin) => `${bin} mark-as-read --all`);
  notificationCli.help();

  return notificationCli;
}

export function registerNotificationCommands(cli: CAC): void {
  cli.command("notification", "Notification management commands");
}

export async function tryRunNotificationCommand(
  args: string[],
  runtime: RuntimeContext,
): Promise<boolean> {
  if (args[0] !== "notification") {
    return false;
  }

  const notificationCli = createNotificationCli(runtime);

  if (args.length === 1) {
    notificationCli.outputHelp();
    return true;
  }

  notificationCli.parse(["node", "halo notification", ...args.slice(1)], { run: false });
  await notificationCli.runMatchedCommand();
  return true;
}
