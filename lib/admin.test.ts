import { describe, expect, it } from "vitest";
import { isPlatformAdmin } from "@/lib/admin";

describe("platform admin detection", () => {
  it("allows only explicit Pomebrain admin metadata", () => {
    expect(isPlatformAdmin("user@example.com", { pomebrain_role: "admin" })).toBe(true);
    expect(isPlatformAdmin("user@example.com", { role: "admin" })).toBe(false);
    expect(isPlatformAdmin("customer@example.com")).toBe(false);
  });
});
