// playwright/pages/DashboardPage.ts — the backlog board at /dashboard
// (rendered by components/BacklogBoard.tsx).
//
// Step 7 builds ONLY what the data-free dashboard tests need: an empty board, since
// our test user has no games yet. The per-card and per-column COMPONENT objects
// (GameCard, BacklogColumn) arrive in Step 9 — once seeded data gives them real
// instances to scope. Building them now would be inventing abstractions for tests
// that don't exist yet, which the build plan deliberately avoids.

import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

export class DashboardPage extends BasePage {
  readonly path = "/dashboard";

  // The "No games here yet" placeholder shown inside each empty column. On a fresh
  // board there are three (one per column). Found by its visible text — rung 4 of
  // the locator ladder, since it's just a non-interactive <p>.
  readonly emptyStates: Locator;

  // The "Dropped" archive toggle. The board renders it only when the user has
  // dropped games, so on an empty board this resolves to ZERO elements — exactly
  // what the "hides the archive" test asserts.
  readonly droppedToggle: Locator;

  constructor(page: Page) {
    super(page);
    this.emptyStates = page.getByText("No games here yet");
    this.droppedToggle = page.getByRole("button", { name: /dropped/i });
  }

  // A column header is an <h2> (emoji + label). `level: 2` excludes the page's
  // <h1> "My Backlog", so the label "Backlog" doesn't match both headings. Returns
  // a locator for the spec to assert on — the page object never asserts itself.
  columnHeading(label: string): Locator {
    return this.page.getByRole("heading", { name: label, level: 2 });
  }
}
