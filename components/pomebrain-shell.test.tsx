// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PomebrainShell } from "@/components/pomebrain-shell";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Pomebrain customer shell", () => {
  it("moves from the Brain to a governed Crown build plan", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        persisted: {
          projectId: "00000000-0000-4000-8000-000000000001",
          runId: "00000000-0000-4000-8000-000000000002",
          status: "processing",
          taskCount: 7,
          approvalCount: 3,
        },
      }),
    } as Response);
    render(<PomebrainShell isAdmin />);

    expect(screen.getByText("Every seed in its place.")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /open crown console/i })[0]);

    expect(screen.getByText(/tell pomebrain what/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/what do you want pomebrain to build/i), {
      target: { value: "Build an invoice approval dashboard for a finance team" },
    });
    fireEvent.click(screen.getByRole("button", { name: /run the crown/i }));

    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    expect(screen.getAllByText("Database Schema Provisioner").length).toBeGreaterThan(0);
    expect(screen.getAllByText("NextJS Boilerplate Architect").length).toBeGreaterThan(0);
    expect(screen.getByText("Awaiting approval")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /approve build plan/i }));
    });

    expect(screen.getByText("Agent work ready")).toBeTruthy();
    expect(screen.getByText(/app factory run created/i)).toBeTruthy();
    expect(screen.getByText(/ready to run agents/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /start agent work/i })).toBeTruthy();
  });

  it("starts non-admin users in Crown without private Brain navigation", () => {
    render(<PomebrainShell isAdmin={false} />);

    expect(screen.getByText(/tell pomebrain what/i)).toBeTruthy();
    expect(screen.queryByText("Brain View")).toBeNull();
    expect(screen.queryByText("Seed Library")).toBeNull();
    expect(screen.queryByText("Agent Foundry")).toBeNull();
    expect(screen.getAllByText("Crown Console").length).toBeGreaterThan(0);
    expect(screen.getByText("Connectors")).toBeTruthy();
  });

  it("shows customers only connector capabilities that are executable today", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ status: "healthy" }) } as Response);
    render(<PomebrainShell isAdmin={false} />);

    fireEvent.click(screen.getByRole("button", { name: /connectors/i }));

    expect(screen.getAllByText("GitHub").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Vercel").length).toBeGreaterThan(0);
    expect(screen.queryByText("Fathom")).toBeNull();
    expect(screen.getAllByText("Google Workspace").length).toBeGreaterThan(0);
    expect(screen.queryByText("execute_sql")).toBeNull();
  });
});
