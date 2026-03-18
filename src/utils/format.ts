import type {
  Attachment,
  AttachmentList,
  Backup,
  BackupList,
  Comment,
  DetailedUser,
  ListedCommentList,
  ListedPostList,
  ListedReply,
  ListedReplyList,
  Notification,
  NotificationList,
  Plugin,
  PluginList,
  Reply,
  SearchResult,
  Theme,
  ThemeList,
} from "@halo-dev/api-client";
import Table from "cli-table3";
import dayjs from "dayjs";
import prettyBytes from "pretty-bytes";
import stringWidth from "string-width";

import type { HaloProfile, ListedMomentList, Moment } from "../types.js";
import type { PluginUpdateInfo, ThemeUpdateInfo } from "./app-store.js";

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function resolveTerminalWidth(): number {
  return process.stdout.columns && process.stdout.columns > 0 ? process.stdout.columns : 120;
}

function normalizeCell(value: string | undefined): string {
  return value ?? "";
}

function printTable(
  headers: string[],
  rows: Array<Array<string>>,
  colWidths?: number[],
  truncate = true,
): void {
  const table = new Table({
    head: headers,
    colWidths,
    truncate: truncate ? "..." : undefined,
    colAligns: headers.map(() => "left"),
    style: {
      compact: true,
      head: [],
      border: [],
      "padding-left": 0,
      "padding-right": 0,
    },
    wordWrap: false,
    chars: {
      top: "",
      "top-mid": "",
      "top-left": "",
      "top-right": "",
      bottom: "",
      "bottom-mid": "",
      "bottom-left": "",
      "bottom-right": "",
      left: "",
      "left-mid": "",
      mid: "",
      "mid-mid": "",
      right: "",
      "right-mid": "",
      middle: "  ",
    },
  });

  for (const row of rows) {
    table.push(row.map(normalizeCell));
  }

  process.stdout.write(`${table.toString()}\n`);
}

function truncateDisplayText(value: string, maxWidth: number): string {
  if (maxWidth <= 0) {
    return "";
  }

  if (stringWidth(value) <= maxWidth) {
    return value;
  }

  if (maxWidth <= 3) {
    return ".".repeat(maxWidth);
  }

  let result = "";
  let width = 0;
  for (const character of value) {
    const nextWidth = stringWidth(character);
    if (width + nextWidth > maxWidth - 3) {
      break;
    }

    result += character;
    width += nextWidth;
  }

  return `${result}...`;
}

function getProfileListWidths(): number[] {
  const width = resolveTerminalWidth();
  const baseUrlWidth = Math.min(Math.max(28, Math.floor(width * 0.4)), 56);
  return [18, baseUrlWidth, 10, 6];
}

function getPostListWidths(): number[] {
  const width = resolveTerminalWidth();
  const nameWidth = 38;
  const stateWidth = 10;
  const createdAtWidth = 17;
  const reservedWidth = nameWidth + stateWidth + createdAtWidth + 6;
  const titleWidth = Math.min(Math.max(24, width - reservedWidth), 60);
  return [nameWidth, titleWidth, stateWidth, createdAtWidth];
}

function getPluginListWidths(): number[] {
  const width = resolveTerminalWidth();
  const displayNameWidth = Math.min(Math.max(16, Math.floor(width * 0.28)), 30);
  const updateWidth = Math.min(Math.max(12, Math.floor(width * 0.18)), 20);
  return [24, displayNameWidth, 14, updateWidth, 10];
}

function getThemeListWidths(): number[] {
  const width = resolveTerminalWidth();
  const displayNameWidth = Math.min(Math.max(16, Math.floor(width * 0.28)), 30);
  const updateWidth = Math.min(Math.max(12, Math.floor(width * 0.18)), 20);
  return [24, displayNameWidth, 14, updateWidth, 8];
}

function getAttachmentListWidths(): number[] {
  const width = resolveTerminalWidth();
  const nameWidth = 36;
  const displayNameWidth = Math.min(Math.max(44, Math.floor(width * 0.4)), 56);
  const sizeWidth = 10;
  const mediaTypeWidth = Math.min(
    Math.max(20, width - nameWidth - displayNameWidth - sizeWidth - 6),
    36,
  );
  return [nameWidth, displayNameWidth, sizeWidth, mediaTypeWidth];
}

function getBackupListWidths(): number[] {
  const width = resolveTerminalWidth();
  const nameWidth = 34;
  const phaseWidth = 11;
  const sizeWidth = 10;
  const createdAtWidth = 17;
  const reservedWidth = nameWidth + phaseWidth + sizeWidth + createdAtWidth + 8;
  const filenameWidth = Math.min(Math.max(24, width - reservedWidth), 48);
  return [nameWidth, phaseWidth, sizeWidth, filenameWidth, createdAtWidth];
}

function getMomentListWidths(): number[] {
  const width = resolveTerminalWidth();
  const nameWidth = 28;
  const visibleWidth = 9;
  const releaseTimeWidth = 17;
  const approvedWidth = 10;
  const tagsWidth = Math.min(Math.max(18, Math.floor(width * 0.18)), 24);
  const reservedWidth =
    nameWidth + visibleWidth + releaseTimeWidth + approvedWidth + tagsWidth + 10;
  const contentWidth = Math.min(Math.max(28, width - reservedWidth), 60);
  return [nameWidth, contentWidth, visibleWidth, tagsWidth, releaseTimeWidth, approvedWidth];
}

function getCommentListWidths(): number[] {
  const width = resolveTerminalWidth();
  const nameWidth = 26;
  const ownerWidth = 18;
  const approvedWidth = 9;
  const hiddenWidth = 8;
  const createdAtWidth = 17;
  const reservedWidth = nameWidth + ownerWidth + approvedWidth + hiddenWidth + createdAtWidth + 10;
  const contentWidth = Math.min(Math.max(26, width - reservedWidth), 56);
  return [nameWidth, ownerWidth, contentWidth, approvedWidth, hiddenWidth, createdAtWidth];
}

function getReplyListWidths(): number[] {
  const width = resolveTerminalWidth();
  const nameWidth = 26;
  const ownerWidth = 18;
  const approvedWidth = 9;
  const hiddenWidth = 8;
  const createdAtWidth = 17;
  const reservedWidth = nameWidth + ownerWidth + approvedWidth + hiddenWidth + createdAtWidth + 10;
  const contentWidth = Math.min(Math.max(26, width - reservedWidth), 56);
  return [nameWidth, ownerWidth, contentWidth, approvedWidth, hiddenWidth, createdAtWidth];
}

function getNotificationListWidths(): number[] {
  const width = resolveTerminalWidth();
  const nameWidth = 28;
  const unreadWidth = 8;
  const createdAtWidth = 17;
  const reservedWidth = nameWidth + unreadWidth + createdAtWidth + 6;
  const titleWidth = Math.min(Math.max(28, width - reservedWidth), 60);
  return [nameWidth, titleWidth, unreadWidth, createdAtWidth];
}

function getDetailTableWidths(): number[] {
  const width = resolveTerminalWidth();
  const fieldWidth = Math.min(Math.max(22, Math.floor(width * 0.28)), 36);
  const valueWidth = Math.max(30, width - fieldWidth - 4);
  return [fieldWidth, valueWidth];
}

function formatLeafValue(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (
      value.every(
        (item) => item == null || ["string", "number", "boolean", "bigint"].includes(typeof item),
      )
    ) {
      return value.map((item) => formatLeafValue(item)).join(", ");
    }

    return JSON.stringify(value);
  }

  return JSON.stringify(value);
}

function formatTimestamp(value: string | undefined): string {
  if (!value) {
    return "";
  }

  const date = dayjs(value);
  if (!date.isValid()) {
    return value;
  }

  return date.format("YYYY-MM-DD HH:mm");
}

function stripHtmlTags(value: string | undefined): string {
  if (!value) {
    return "";
  }

  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function flattenValue(prefix: string, value: unknown, rows: Array<Array<string>>): void {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);

    if (entries.length === 0) {
      rows.push([prefix, "{}"]);
      return;
    }

    for (const [key, nestedValue] of entries) {
      const nextKey = prefix ? `${prefix}.${key}` : key;
      flattenValue(nextKey, nestedValue, rows);
    }

    return;
  }

  rows.push([prefix, formatLeafValue(value)]);
}

export function printDetailObject(value: Record<string, unknown>): void {
  const rows: Array<Array<string>> = [];
  flattenValue("", value, rows);
  printTable(["FIELD", "VALUE"], rows, getDetailTableWidths());
}

export function printAuthLoginSuccess(
  profile: HaloProfile,
  user: DetailedUser,
  json = false,
): void {
  if (json) {
    printJson({
      profile: profile.name,
      baseUrl: profile.baseUrl,
      user,
    });
    return;
  }

  process.stdout.write(
    `Logged in to ${profile.baseUrl} as ${user.user.spec.displayName ?? user.user.metadata.name} using profile ${profile.name}.\n`,
  );
}

export function printProfileList(
  activeProfile: string | undefined,
  profiles: HaloProfile[],
  json = false,
): void {
  if (json) {
    printJson({ activeProfile, profiles });
    return;
  }

  if (profiles.length === 0) {
    process.stdout.write("No Halo profiles configured. Run `halo auth login` first.\n");
    return;
  }

  const rows = profiles.map((profile) => [
    profile.name,
    truncateDisplayText(profile.baseUrl, getProfileListWidths()[1]!),
    profile.auth.type,
    activeProfile === profile.name ? "*" : "",
  ]);

  printTable(["NAME", "BASE URL", "AUTH", "ACTIVE"], rows, getProfileListWidths(), false);
}

export function printCurrentProfile(profile: HaloProfile, json = false): void {
  if (json) {
    printJson(profile);
    return;
  }

  printDetailObject(profile as unknown as Record<string, unknown>);
}

export function printProfileUseSuccess(profile: HaloProfile, json = false): void {
  if (json) {
    printJson({ activeProfile: profile.name, profile });
    return;
  }

  process.stdout.write(`Active profile set to ${profile.name}.\n`);
}

export function printPostList(list: ListedPostList, json = false): void {
  if (json) {
    printJson(list);
    return;
  }

  const widths = getPostListWidths();

  const rows = list.items.map((item) => {
    const post = item.post;
    return [
      post.metadata.name,
      truncateDisplayText(post.spec.title, widths[1]!),
      post.spec.publish ? "published" : "draft",
      formatTimestamp(post.metadata.creationTimestamp ?? undefined),
    ];
  });

  printTable(["NAME", "TITLE", "STATE", "CREATED AT"], rows, widths, false);
  process.stdout.write(`\n${list.total} post(s)\n`);
}

export function printSearchResult(result: SearchResult, json = false): void {
  if (json) {
    printJson(result);
    return;
  }

  const hits = result.hits ?? [];
  if (hits.length === 0) {
    process.stdout.write(`No search results found for "${result.keyword ?? ""}".\n`);
    return;
  }

  const widths = getPostListWidths();
  const rows = hits.map((hit) => {
    const shortType = hit.type?.split(".")[0] ?? hit.type ?? "";
    return [
      hit.metadataName,
      truncateDisplayText(hit.title, widths[1]!),
      shortType,
      formatTimestamp(hit.creationTimestamp),
    ];
  });

  printTable(["NAME", "TITLE", "TYPE", "CREATED AT"], rows, widths, false);
  process.stdout.write(`\n${result.total ?? hits.length} result(s)\n`);
}

export function printPluginList(
  list: PluginList,
  json = false,
  updates?: Map<string, PluginUpdateInfo>,
): void {
  if (json) {
    printJson(list);
    return;
  }

  const widths = getPluginListWidths();

  const rows = list.items.map((item) => {
    const update = updates?.get(item.metadata.name);
    const updateText = update
      ? update.compatible
        ? update.latestVersion
        : `${update.latestVersion} !compat`
      : "";

    return [
      item.metadata.name,
      truncateDisplayText(item.spec.displayName ?? item.metadata.name, widths[1]!),
      item.spec.version ?? "",
      truncateDisplayText(updateText, widths[3]!),
      item.status?.phase ?? "",
    ];
  });

  printTable(["NAME", "DISPLAY NAME", "VERSION", "UPDATE", "PHASE"], rows, widths, false);
  process.stdout.write(`\n${list.total} plugin(s)\n`);
}

export function printPlugin(plugin: Plugin, json = false): void {
  if (json) {
    printJson(plugin);
    return;
  }

  printDetailObject(plugin as unknown as Record<string, unknown>);
}

export function printThemeList(
  list: ThemeList,
  json = false,
  updates?: Map<string, ThemeUpdateInfo>,
  activeThemeName?: string,
): void {
  if (json) {
    printJson(list);
    return;
  }

  const widths = getThemeListWidths();

  const rows = list.items.map((item) => {
    const update = updates?.get(item.metadata.name);
    const updateText = update
      ? update.compatible
        ? update.latestVersion
        : `${update.latestVersion} !compat`
      : "";

    return [
      item.metadata.name,
      truncateDisplayText(item.spec.displayName, widths[1]!),
      item.spec.version ?? "",
      truncateDisplayText(updateText, widths[3]!),
      item.metadata.name === activeThemeName ? "*" : "",
    ];
  });

  printTable(["NAME", "DISPLAY NAME", "VERSION", "UPDATE", "ACTIVE"], rows, widths, false);
  process.stdout.write(`\n${list.total} theme(s)\n`);
}

export function printTheme(theme: Theme, json = false): void {
  if (json) {
    printJson(theme);
    return;
  }

  printDetailObject(theme as unknown as Record<string, unknown>);
}

export function printAttachmentList(list: AttachmentList, json = false): void {
  if (json) {
    printJson(list);
    return;
  }

  const widths = getAttachmentListWidths();
  const rows = list.items.map((item) => [
    item.metadata.name,
    truncateDisplayText(item.spec.displayName ?? item.metadata.name, widths[1]!),
    item.spec.size == null
      ? ""
      : prettyBytes(item.spec.size, {
          binary: true,
          maximumFractionDigits: 1,
        }),
    truncateDisplayText(item.spec.mediaType ?? "", widths[3]!),
  ]);

  printTable(["NAME", "DISPLAY NAME", "SIZE", "MEDIA TYPE"], rows, widths, false);
  process.stdout.write(`\n${list.total} attachment(s)\n`);
}

export function printAttachment(attachment: Attachment, json = false): void {
  if (json) {
    printJson(attachment);
    return;
  }

  const { status, ...rest } = attachment;

  printDetailObject({
    ...rest,
    status: status
      ? {
          ...status,
          permalink: undefined,
        }
      : undefined,
  } as Record<string, unknown>);
}

export function printBackupList(list: BackupList, json = false): void {
  if (json) {
    printJson(list);
    return;
  }

  const widths = getBackupListWidths();
  const rows = list.items.map((item) => [
    item.metadata.name,
    item.status?.phase ?? "",
    item.status?.size == null
      ? ""
      : prettyBytes(item.status.size, {
          binary: true,
          maximumFractionDigits: 1,
        }),
    truncateDisplayText(item.status?.filename ?? "", widths[3]!),
    formatTimestamp(item.metadata.creationTimestamp ?? undefined),
  ]);

  printTable(["NAME", "PHASE", "SIZE", "FILE", "CREATED AT"], rows, widths, false);
  process.stdout.write(`\n${list.total} backup(s)\n`);
}

export function printBackup(backup: Backup, json = false): void {
  if (json) {
    printJson(backup);
    return;
  }

  printDetailObject(backup as unknown as Record<string, unknown>);
}

export function printMomentList(list: ListedMomentList, json = false): void {
  if (json) {
    printJson(list);
    return;
  }

  const widths = getMomentListWidths();
  const rows = list.items.map((item) => [
    item.moment.metadata.name,
    truncateDisplayText(stripHtmlTags(item.moment.spec.content.raw), widths[1]!),
    item.moment.spec.visible ?? "PUBLIC",
    truncateDisplayText((item.moment.spec.tags ?? []).join(", "), widths[3]!),
    formatTimestamp(item.moment.spec.releaseTime),
    item.moment.spec.approved ? "approved" : "pending",
  ]);

  printTable(
    ["NAME", "CONTENT", "VISIBLE", "TAGS", "RELEASED AT", "APPROVAL"],
    rows,
    widths,
    false,
  );
  process.stdout.write(`\n${list.total} moment(s)\n`);
}

export function printMoment(moment: Moment, json = false): void {
  if (json) {
    printJson(moment);
    return;
  }

  printDetailObject({
    ...moment,
    spec: {
      ...moment.spec,
      contentPreview: stripHtmlTags(moment.spec.content.raw),
    },
  } as Record<string, unknown>);
}

function resolveCommentOwnerName(value: {
  owner?: { displayName?: string };
  comment?: { spec?: { owner?: { displayName?: string } } };
  reply?: { spec?: { owner?: { displayName?: string } } };
}): string {
  return (
    value.owner?.displayName ??
    value.comment?.spec?.owner?.displayName ??
    value.reply?.spec?.owner?.displayName ??
    ""
  );
}

export function printCommentList(list: ListedCommentList, json = false): void {
  if (json) {
    printJson(list);
    return;
  }

  const widths = getCommentListWidths();
  const rows = list.items.map((item) => [
    item.comment.metadata.name,
    truncateDisplayText(resolveCommentOwnerName(item), widths[1]!),
    truncateDisplayText(stripHtmlTags(item.comment.spec.content), widths[2]!),
    item.comment.spec.approved ? "yes" : "no",
    item.comment.spec.hidden ? "yes" : "no",
    formatTimestamp(item.comment.metadata.creationTimestamp ?? undefined),
  ]);

  printTable(["NAME", "OWNER", "CONTENT", "APPROVED", "HIDDEN", "CREATED AT"], rows, widths, false);
  process.stdout.write(`\n${list.total} comment(s)\n`);
}

export function printComment(comment: Comment, json = false): void {
  if (json) {
    printJson(comment);
    return;
  }

  printDetailObject({
    ...comment,
    spec: {
      ...comment.spec,
      contentPreview: stripHtmlTags(comment.spec.content),
    },
  } as Record<string, unknown>);
}

export function printReplyList(list: ListedReplyList | ListedReply[], json = false): void {
  if (json) {
    printJson(list);
    return;
  }

  const items = Array.isArray(list) ? list : list.items;
  const total = Array.isArray(list) ? list.length : list.total;
  const widths = getReplyListWidths();
  const rows = items.map((item) => [
    item.reply.metadata.name,
    truncateDisplayText(resolveCommentOwnerName(item), widths[1]!),
    truncateDisplayText(stripHtmlTags(item.reply.spec.content), widths[2]!),
    item.reply.spec.approved ? "yes" : "no",
    item.reply.spec.hidden ? "yes" : "no",
    formatTimestamp(item.reply.metadata.creationTimestamp ?? undefined),
  ]);

  printTable(["NAME", "OWNER", "CONTENT", "APPROVED", "HIDDEN", "CREATED AT"], rows, widths, false);
  process.stdout.write(`\n${total} repl${total === 1 ? "y" : "ies"}\n`);
}

export function printReply(reply: Reply, json = false): void {
  if (json) {
    printJson(reply);
    return;
  }

  printDetailObject({
    ...reply,
    spec: {
      ...reply.spec,
      contentPreview: stripHtmlTags(reply.spec.content),
    },
  } as Record<string, unknown>);
}

export function printNotificationList(list: NotificationList, json = false): void {
  if (json) {
    printJson(list);
    return;
  }

  const widths = getNotificationListWidths();
  const rows = list.items.map((item) => [
    item.metadata.name,
    truncateDisplayText(item.spec?.title ?? item.metadata.name, widths[1]!),
    item.spec?.unread ? "yes" : "no",
    formatTimestamp(item.metadata.creationTimestamp ?? undefined),
  ]);

  printTable(["NAME", "TITLE", "UNREAD", "CREATED AT"], rows, widths, false);
  process.stdout.write(`\n${list.total} notification(s)\n`);
}

export function printNotification(notification: Notification, json = false): void {
  if (json) {
    printJson(notification);
    return;
  }

  printDetailObject({
    ...notification,
    spec: {
      ...notification.spec,
      contentPreview:
        notification.spec?.rawContent || stripHtmlTags(notification.spec?.htmlContent),
    },
  } as Record<string, unknown>);
}
