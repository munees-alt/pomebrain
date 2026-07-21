import { expect, test } from "@playwright/test";

test("login and legal surfaces are available", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in to Pomebrain" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
  await expect(page.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");

  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
});

test("health response exposes status but never credentials", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.status).toBe("healthy");
  expect(body.service).toBe("pomebrain");
  const serialized = JSON.stringify(body).toLowerCase();
  expect(serialized).not.toContain("service_role_key");
  expect(serialized).not.toContain("client_secret");
  expect(serialized).not.toContain("access_token");

  const readiness = await request.get("/api/health/readiness");
  expect([200, 503]).toContain(readiness.status());
  const readinessBody = await readiness.json();
  expect(["ready", "degraded"]).toContain(readinessBody.status);
  expect(JSON.stringify(readinessBody).toLowerCase()).not.toContain("service_role_key");
});

test("workspace APIs reject anonymous callers", async ({ request }) => {
  const readiness = await request.post("/api/connectors/readiness", { data: {} });
  expect(readiness.status()).toBe(401);

  const runs = await request.get("/api/app-factory/runs");
  expect(runs.status()).toBe(401);

  const runState = await request.get("/api/app-factory/runs/00000000-0000-0000-0000-000000000000");
  expect(runState.status()).toBe(401);
});
