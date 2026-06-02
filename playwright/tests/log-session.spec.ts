// log-session.spec.ts — the play-session logger (components/LogSessionModal.tsx).
//
// The validation rules mirror the app: time must be > 0 and <= 24 hours (see the
// modal's checks and app/api/play-sessions/route.ts). Each test seeds a game over the
// API, opens that card's ⏱ modal, and drives it through the LogSessionModal object.

import { test, expect } from "../fixtures/data";
import type { Page } from "@playwright/test";
import { BacklogSeeder } from "../fixtures/data";
import { DashboardPage } from "../pages/DashboardPage";
import type { LogSessionModal } from "../components/LogSessionModal";

// Seed one PLAYING game and open its log-session modal — the common setup.
async function openLogModal(page: Page, backlog: BacklogSeeder, title: string): Promise<LogSessionModal> {
  await backlog.addGame({ title, status: "PLAYING" });
  const dashboard = new DashboardPage(page);
  await dashboard.goto();
  return dashboard.column("Playing").card(title).openLogSession();
}

test.describe("Log session modal", () => {
  test("shows an error when no time is entered", async ({ page, backlog }) => {
    const modal = await openLogModal(page, backlog, "No Time Game");

    // Submit the defaults (0h 0m) → the modal rejects it before any request.
    await modal.save();

    await expect(modal.errorMessage("Please enter at least 1 minute.")).toBeVisible();
  });

  test("shows an error when the time exceeds 24 hours", async ({ page, backlog }) => {
    const modal = await openLogModal(page, backlog, "Too Long Game");

    await modal.save({ hours: 24, minutes: 30 }); // 24.5h

    await expect(modal.errorMessage("A single session can't exceed 24 hours.")).toBeVisible();
  });

  test("logs a session with valid time and shows a success message", async ({ page, backlog }) => {
    const modal = await openLogModal(page, backlog, "Valid Session Game");

    await modal.save({ hours: 2, minutes: 30 });

    await expect(modal.success).toBeVisible();
  });

  test("closes itself after a successful save", async ({ page, backlog }) => {
    const modal = await openLogModal(page, backlog, "Auto Close Game");

    await modal.save({ hours: 1, minutes: 0 });

    // The modal auto-closes ~1.2s after success. We assert the observable outcome —
    // the success message, then the dialog going away — not the timing.
    await expect(modal.success).toBeVisible();
    await expect(modal.heading).toBeHidden();
  });

  test("treats notes as optional", async ({ page, backlog }) => {
    const modal = await openLogModal(page, backlog, "No Notes Game");

    await modal.save({ hours: 1, minutes: 15 }); // no notes supplied

    await expect(modal.success).toBeVisible();
  });

  test("resets the form when reopened", async ({ page, backlog }) => {
    await backlog.addGame({ title: "Reset Game", status: "PLAYING" });
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    const card = dashboard.column("Playing").card("Reset Game");

    const modal = await card.openLogSession();
    await modal.hoursInput.fill("5");
    await modal.close();

    // Reopening starts fresh — the hours field is empty again.
    const reopened = await card.openLogSession();
    await expect(reopened.hoursInput).toHaveValue("");
  });
});
