import { expect, test } from "vitest";

import { buildCommentListRequest, buildReplyRequestPayload } from "../index.js";
import { buildApprovePatch } from "../reply.js";

test("buildApprovePatch marks resources approved with a timestamp", () => {
  const patch = buildApprovePatch();
  const approvedTimePatch = patch[1] as {
    op: string;
    path: string;
    value?: unknown;
  };

  expect(patch).toHaveLength(2);
  expect(patch[0]).toEqual({
    op: "add",
    path: "/spec/approved",
    value: true,
  });
  expect(approvedTimePatch.op).toBe("add");
  expect(approvedTimePatch.path).toBe("/spec/approvedTime");
  expect(typeof approvedTimePatch.value).toBe("string");
  expect(Date.parse(String(approvedTimePatch.value))).not.toBeNaN();
});

test("buildCommentListRequest parses pagination and filter options", () => {
  expect(
    buildCommentListRequest({
      page: " 2 ",
      size: " 10 ",
      keyword: "halo",
      ownerKind: "Post",
      ownerName: "post-1",
      approved: "false",
      sort: " metadata.creationTimestamp,desc ",
    }),
  ).toEqual({
    page: 2,
    size: 10,
    keyword: "halo",
    ownerKind: "Post",
    ownerName: "post-1",
    fieldSelector: ["spec.approved=false"],
    sort: ["metadata.creationTimestamp,desc"],
  });
});

test("buildCommentListRequest omits empty optional filters", () => {
  expect(
    buildCommentListRequest({
      page: undefined,
      size: undefined,
      keyword: undefined,
      ownerKind: undefined,
      ownerName: undefined,
      approved: undefined,
      sort: "   ",
    }),
  ).toEqual({
    page: undefined,
    size: undefined,
    keyword: undefined,
    ownerKind: undefined,
    ownerName: undefined,
    fieldSelector: undefined,
    sort: undefined,
  });
});

test("buildReplyRequestPayload applies defaults for notification and hidden flags", () => {
  expect(
    buildReplyRequestPayload("Thanks for your feedback", {
      quoteReply: "reply-1",
    }),
  ).toEqual({
    raw: "Thanks for your feedback",
    content: "Thanks for your feedback",
    allowNotification: true,
    hidden: false,
    quoteReply: "reply-1",
  });
});

test("buildReplyRequestPayload preserves explicit notification and hidden flags", () => {
  expect(
    buildReplyRequestPayload("Hidden reply", {
      allowNotification: false,
      hidden: true,
    }),
  ).toEqual({
    raw: "Hidden reply",
    content: "Hidden reply",
    allowNotification: false,
    hidden: true,
    quoteReply: undefined,
  });
});
