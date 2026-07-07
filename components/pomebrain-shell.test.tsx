// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PomebrainShell } from "@/components/pomebrain-shell";

afterEach(() => {
  vi.useRealTimers();
});

describe("Pomebrain Phase 0 shell", () => {
  it("moves from the Brain to a governed Crown build plan", async () => {
    vi.useFakeTimers();
    render(<PomebrainShell />);

    expect(screen.getByText("Every seed in its place.")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /open crown console/i })[0]);

    expect(screen.getByText(/tell the brain what/i)).toBeTruthy();
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
    fireEvent.click(screen.getByRole("button", { name: /approve build plan/i }));
    expect(screen.getByText("Plan approved")).toBeTruthy();
    expect(screen.getByText(/execution arrives in app factory/i)).toBeTruthy();
  });
});
