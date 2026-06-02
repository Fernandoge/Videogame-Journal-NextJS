// playwright/pages/GameDetailPage.ts — the per-game detail page (/games/[id]),
// rendered by app/games/[id]/page.tsx (a Server Component) + GameDetailActions
// (the interactive strip) + DeleteSessionButton.
//
// The [id] in the route is the UserGame id, NOT the Game id — the page is personal
// (your sessions, your review, your status). Because the path is dynamic, this page
// object takes the id in its constructor and builds `path` from it, so the inherited
// BasePage.goto() still works.
//
// Like every page object here: it OWNS the locators and the "how to interact"
// actions; the SPEC owns the assertions (web-first expect(locator), which auto-retry).

import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

export class GameDetailPage extends BasePage {
  readonly path: string;

  // Back to the board — a real <a href="/dashboard">; the arrow is part of the text.
  readonly backLink: Locator;
  // The game title is the page's only <h1>, so role+level pins it without its text.
  readonly title: Locator;
  // The single status <select> on the page (GameDetailActions renders exactly one).
  // The modals' fields only exist while a modal is open, so this stays unambiguous.
  readonly statusSelect: Locator;

  // Every play session is a <li>. They're the ONLY list items on this page (the
  // review, when present, is a <div>, not a list), so the bare listitem role is safe.
  readonly sessions: Locator;
  // The "No sessions logged yet…" placeholder, shown when there are zero sessions.
  readonly sessionsEmptyState: Locator;
  // The "No review yet…" placeholder, shown when the user hasn't written a review.
  readonly reviewEmptyState: Locator;

  constructor(
    page: Page,
    // The UserGame id the seeder returned — this is what /games/[id] keys on.
    private readonly userGameId: string,
  ) {
    super(page);
    this.path = `/games/${userGameId}`;

    this.backLink = page.getByRole("link", { name: /back to backlog/i });
    this.title = page.getByRole("heading", { level: 1 });
    this.statusSelect = page.getByRole("combobox");
    this.sessions = page.getByRole("listitem");
    this.sessionsEmptyState = page.getByText(/No sessions logged yet/i);
    this.reviewEmptyState = page.getByText(/No review yet/i);
  }

  // ── content-parameterised locators (same idea as ReviewModal.scoreLabel) ──────────
  // The hero/stats are plain <p>s with no role, so we find them by their visible text
  // (rung 4 of the locator ladder — fine for non-interactive content). The spec passes
  // the exact text it expects; exact:true keeps a value like "Sessions" from also
  // matching the "Play sessions" section heading.

  // A stat block's LABEL ("Total hours" | "Sessions" | "Your score").
  statLabel(label: string): Locator {
    return this.page.getByText(label, { exact: true });
  }

  // A stat block's VALUE, e.g. "4h" or "8 / 10". exact:true so a single digit doesn't
  // match a fragment of a date or a formatted duration elsewhere on the page.
  statValue(value: string): Locator {
    return this.page.getByText(value, { exact: true });
  }

  // The genre/year line under the title, matched on a substring so we never depend on
  // the exact " · " separator character.
  metadata(text: string): Locator {
    return this.page.getByText(text);
  }

  // One session row, located by its (unique) notes text. Returned for the spec to
  // assert on, and used internally by deleteSession().
  session(notes: string): Locator {
    return this.sessions.filter({ hasText: notes });
  }

  // The written review's body text.
  reviewBody(text: string): Locator {
    return this.page.getByText(text);
  }

  // ── actions ───────────────────────────────────────────────────────────────────────

  // Change the status via the <select>, and DON'T return until the PATCH that persists
  // it has actually completed. This matters because the handler fires the request
  // asynchronously: if a test navigated/reloaded immediately after selectOption(), the
  // pending PATCH would be cancelled by the navigation and the change would never hit
  // the DB. waitForResponse is a real condition (the mutation landing), not a
  // waitForTimeout sleep — it's the right tool here.
  async setStatus(status: "PLAYING" | "BACKLOG" | "COMPLETED" | "DROPPED"): Promise<void> {
    await Promise.all([
      this.page.waitForResponse(
        (res) =>
          res.url().includes(`/api/user-games/${this.userGameId}`) &&
          res.request().method() === "PATCH",
      ),
      this.statusSelect.selectOption(status),
    ]);
  }

  // Delete one session via its two-step button (🗑 arms it → "Sure?" confirms). Both
  // clicks are scoped to that session's row so we never confirm a different one. The
  // spec then asserts the row is gone.
  async deleteSession(notes: string): Promise<void> {
    const row = this.session(notes);
    await row.getByTitle("Delete session").click(); // first click: arm
    await row.getByRole("button", { name: "Sure?" }).click(); // second click: confirm
  }
}
