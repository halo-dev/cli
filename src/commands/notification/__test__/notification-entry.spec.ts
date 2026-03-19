import { afterEach, expect, test, vi } from "vitest";

import { tryRunNotificationCommand } from "../index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function silenceStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

function createRuntimeMock() {
  return {
    getClientsForOptions: vi.fn().mockResolvedValue({
      profile: {
        baseUrl: "https://example.com",
      },
      clients: {
        axios: {},
        console: {
          user: {
            getCurrentUserDetail: vi.fn().mockResolvedValue({
              data: {
                user: {
                  metadata: {
                    name: "demo-user",
                  },
                },
              },
            }),
          },
        },
      },
    }),
  };
}

test("tryRunNotificationCommand returns false for unrelated commands", async () => {
  await expect(tryRunNotificationCommand(["post"], {} as never)).resolves.toBe(false);
});

test("tryRunNotificationCommand shows help for bare notification commands", async () => {
  silenceStdout();

  await expect(tryRunNotificationCommand(["notification"], {} as never)).resolves.toBe(true);
});

test("tryRunNotificationCommand dispatches notification list subcommands", async () => {
  silenceStdout();

  const runtimeMock = createRuntimeMock();
  const listUserNotifications = vi.fn().mockResolvedValue({
    data: {
      items: [],
      total: 0,
    },
  });

  const { NotificationV1alpha1UcApi } = await import("@halo-dev/api-client");
  vi.spyOn(NotificationV1alpha1UcApi.prototype, "listUserNotifications").mockImplementation(
    listUserNotifications,
  );

  await expect(
    tryRunNotificationCommand(
      [
        "notification",
        "list",
        "--page",
        "1",
        "--size",
        "20",
        "--unread",
        "true",
        "--sort",
        "metadata.creationTimestamp,desc",
        "--json",
      ],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(listUserNotifications).toHaveBeenCalledWith({
    username: "demo-user",
    page: 1,
    size: 20,
    fieldSelector: ["spec.unread=true"],
    sort: ["metadata.creationTimestamp,desc"],
  });
});

test("tryRunNotificationCommand defaults notification list to unread", async () => {
  silenceStdout();

  const runtimeMock = createRuntimeMock();
  const listUserNotifications = vi.fn().mockResolvedValue({
    data: {
      items: [],
      total: 0,
    },
  });

  const { NotificationV1alpha1UcApi } = await import("@halo-dev/api-client");
  vi.spyOn(NotificationV1alpha1UcApi.prototype, "listUserNotifications").mockImplementation(
    listUserNotifications,
  );

  await expect(
    tryRunNotificationCommand(["notification", "list", "--json"], runtimeMock as never),
  ).resolves.toBe(true);

  expect(listUserNotifications).toHaveBeenCalledWith({
    username: "demo-user",
    page: 1,
    size: 20,
    fieldSelector: ["spec.unread=true"],
    sort: undefined,
  });
});

test("tryRunNotificationCommand dispatches notification get subcommands", async () => {
  silenceStdout();

  const runtimeMock = createRuntimeMock();
  const listUserNotifications = vi.fn().mockResolvedValue({
    data: {
      items: [
        {
          apiVersion: "notification.halo.run/v1alpha1",
          kind: "Notification",
          metadata: { name: "notification-1" },
          spec: {
            title: "A notification",
            reason: "new-comment",
            rawContent: "content",
            htmlContent: "<p>content</p>",
            recipient: "demo-user",
            unread: true,
          },
        },
      ],
      total: 1,
    },
  });

  const { NotificationV1alpha1UcApi } = await import("@halo-dev/api-client");
  vi.spyOn(NotificationV1alpha1UcApi.prototype, "listUserNotifications").mockImplementation(
    listUserNotifications,
  );

  await expect(
    tryRunNotificationCommand(
      ["notification", "get", "notification-1", "--json"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(listUserNotifications).toHaveBeenCalledWith({
    username: "demo-user",
    size: 1,
    fieldSelector: ["metadata.name==notification-1"],
  });
});

test("tryRunNotificationCommand dispatches notification delete subcommands", async () => {
  silenceStdout();

  const runtimeMock = createRuntimeMock();
  const deleteSpecifiedNotification = vi.fn().mockResolvedValue({});

  const { NotificationV1alpha1UcApi } = await import("@halo-dev/api-client");
  vi.spyOn(NotificationV1alpha1UcApi.prototype, "deleteSpecifiedNotification").mockImplementation(
    deleteSpecifiedNotification,
  );

  await expect(
    tryRunNotificationCommand(
      ["notification", "delete", "notification-1", "--json", "--force"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(deleteSpecifiedNotification).toHaveBeenCalledWith({
    username: "demo-user",
    name: "notification-1",
  });
});

test("tryRunNotificationCommand dispatches notification mark-as-read subcommands", async () => {
  silenceStdout();

  const runtimeMock = createRuntimeMock();
  const markNotificationAsRead = vi.fn().mockResolvedValue({
    data: {
      apiVersion: "notification.halo.run/v1alpha1",
      kind: "Notification",
      metadata: { name: "notification-1" },
      spec: {
        title: "A notification",
        reason: "new-comment",
        rawContent: "content",
        htmlContent: "<p>content</p>",
        recipient: "demo-user",
        unread: false,
      },
    },
  });

  const { NotificationV1alpha1UcApi } = await import("@halo-dev/api-client");
  vi.spyOn(NotificationV1alpha1UcApi.prototype, "markNotificationAsRead").mockImplementation(
    markNotificationAsRead,
  );

  await expect(
    tryRunNotificationCommand(
      ["notification", "mark-as-read", "notification-1", "--json"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(markNotificationAsRead).toHaveBeenCalledWith({
    username: "demo-user",
    name: "notification-1",
  });
});

test("tryRunNotificationCommand dispatches notification mark-as-read --all", async () => {
  silenceStdout();

  const runtimeMock = createRuntimeMock();
  const listUserNotifications = vi.fn().mockResolvedValue({
    data: {
      items: [{ metadata: { name: "notification-1" } }, { metadata: { name: "notification-2" } }],
      total: 2,
    },
  });
  const markNotificationsAsRead = vi.fn().mockResolvedValue({
    data: ["notification-1", "notification-2"],
  });

  const { NotificationV1alpha1UcApi } = await import("@halo-dev/api-client");
  vi.spyOn(NotificationV1alpha1UcApi.prototype, "listUserNotifications").mockImplementation(
    listUserNotifications,
  );
  vi.spyOn(NotificationV1alpha1UcApi.prototype, "markNotificationsAsRead").mockImplementation(
    markNotificationsAsRead,
  );

  await expect(
    tryRunNotificationCommand(
      ["notification", "mark-as-read", "--all", "--json"],
      runtimeMock as never,
    ),
  ).resolves.toBe(true);

  expect(listUserNotifications).toHaveBeenCalledWith({
    username: "demo-user",
    size: 1000,
    fieldSelector: ["spec.unread=true"],
  });
  expect(markNotificationsAsRead).toHaveBeenCalledWith({
    username: "demo-user",
    markSpecifiedRequest: {
      names: ["notification-1", "notification-2"],
    },
  });
});
