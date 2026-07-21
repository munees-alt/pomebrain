import { describe, expect, it } from "vitest";
import { normalizeRoleKey } from "@/lib/app-factory/utils";

describe("normalizeRoleKey", () => {
  it.each([
    ["Team Lead", "teamlead"],
    ["  Senior  ", "senior"],
    ["Ju nior", "junior"],
    ["Ｔｅａｍ Lead", "teamlead"],
  ])("normalizes %s before role matching", (input, expected) => {
    expect(normalizeRoleKey(input)).toBe(expected);
  });
});
