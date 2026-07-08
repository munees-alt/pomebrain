import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Next 16 Supabase session proxy", () => {
  it("uses proxy.ts, not the deprecated middleware.ts convention", () => {
    expect(existsSync(join(process.cwd(), "proxy.ts"))).toBe(true);
    expect(existsSync(join(process.cwd(), "middleware.ts"))).toBe(false);
  });

  it("refreshes the Supabase session by calling auth.getUser server-side", () => {
    const proxySource = readFileSync(join(process.cwd(), "proxy.ts"), "utf8");

    expect(proxySource).toContain("createServerClient");
    expect(proxySource).toContain("await supabase.auth.getUser()");
    expect(proxySource).toContain("setAll(cookiesToSet)");
  });
});
