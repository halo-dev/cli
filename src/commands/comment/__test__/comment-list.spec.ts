import { expect, test } from "vitest";

import { buildCommentListRequest, buildReplyRequestPayload } from "../index.js";

test("buildCommentListRequest normalizes filters and pagination", () => {
  expect(
    buildCommentListRequest({
      page: "2",
      size: "20",
      keyword: "halo",
      ownerKind: "User",
      ownerName: "ryan",
      approved: "false",
      sort: " metadata.creationTimestamp,desc ",
    }),
  ).toEqual({
    page: 2,
    size: 20,
    keyword: "halo",
    ownerKind: "User",
    ownerName: "ryan",
    fieldSelector: ["spec.approved=false"],
    sort: ["metadata.creationTimestamp,desc"],
  });
});

test("buildCommentListRequest omits optional filters when absent", () => {
  expect(buildCommentListRequest({})).toEqual({
    page: undefined,
    size: undefined,
    keyword: undefined,
    ownerKind: undefined,
    ownerName: undefined,
    fieldSelector: undefined,
    sort: undefined,
  });
});

test("buildReplyRequestPayload fills reply defaults", () => {
  expect(
    buildReplyRequestPayload("Thanks for the feedback", {
      quoteReply: "reply-1",
    }),
  ).toEqual({
    raw: "Thanks for the feedback",
    content: "Thanks for the feedback",
    allowNotification: true,
    hidden: false,
    quoteReply: "reply-1",
  });
});

test("buildReplyRequestPayload respects explicit reply flags", () => {
  expect(
    buildReplyRequestPayload("Thanks for the feedback", {
      allowNotification: false,
      hidden: true,
    }),
  ).toEqual({
    raw: "Thanks for the feedback",
    content: "Thanks for the feedback",
    allowNotification: false,
    hidden: true,
    quoteReply: undefined,
  });
});
