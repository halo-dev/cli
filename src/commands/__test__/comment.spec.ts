import { expect, test } from "vitest";

import { buildApprovePatch } from "../comment.js";

test("buildApprovePatch marks resources approved with a timestamp", () => {
  const patch = buildApprovePatch();
  const approvedTimePatch = patch[1] as { op: string; path: string; value?: unknown };

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
