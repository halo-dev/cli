import { expect, test } from "vitest";

import { buildNotificationListRequest, resolveNotificationMarkAsReadTarget } from "../index.js";

test("buildNotificationListRequest defaults to unread notifications", () => {
  expect(buildNotificationListRequest({})).toEqual({
    page: undefined,
    size: undefined,
    fieldSelector: ["spec.unread=true"],
    sort: undefined,
  });
});

test("buildNotificationListRequest maps filters and pagination", () => {
  expect(
    buildNotificationListRequest({
      page: "1",
      size: "20",
      unread: "true",
      sort: "metadata.creationTimestamp,desc",
    }),
  ).toEqual({
    page: 1,
    size: 20,
    fieldSelector: ["spec.unread=true"],
    sort: ["metadata.creationTimestamp,desc"],
  });
});

test("resolveNotificationMarkAsReadTarget accepts a single notification name", () => {
  expect(resolveNotificationMarkAsReadTarget("notification-1", {})).toEqual({
    mode: "single",
    name: "notification-1",
  });
});

test("resolveNotificationMarkAsReadTarget accepts --all", () => {
  expect(resolveNotificationMarkAsReadTarget(undefined, { all: true })).toEqual({
    mode: "all",
  });
});

test("resolveNotificationMarkAsReadTarget rejects invalid combinations", () => {
  expect(() => resolveNotificationMarkAsReadTarget("notification-1", { all: true })).toThrow(
    /does not accept a notification name/i,
  );
  expect(() => resolveNotificationMarkAsReadTarget(undefined, {})).toThrow(
    /requires a notification name, or use `--all`/i,
  );
});
