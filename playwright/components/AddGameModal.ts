// playwright/components/AddGameModal.ts — the "Add a game" RAWG search modal
// (components/AddGameModal.tsx).
//
// COMPONENT object. Most components take a scoped `Locator` because many instances
// coexist (e.g. GameCard, coming in Step 9). This modal is a SINGLETON — only one is
// ever open — so it takes the `page` and locates its (page-unique) fields directly.
// The doc sanctions exactly this: "scope by heading, or just target the single open
// modal's fields." We anchor each result row on "a <li> that has an Add button", so
// results stay distinct from backlog cards even when the board behind the modal has
// games (relevant once Step 9 seeds data).

import type { Page, Locator } from "@playwright/test";

export class AddGameModal {
  // The heading's presence == the modal is open; assert on it for open/closed.
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly noResults: Locator;
  readonly closeButton: Locator;
  // Each result row is a <li> containing an "Add" button — that's what separates
  // these from backlog <li> cards, which have no "Add" button.
  readonly results: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole("heading", { name: "Add a game" });
    this.searchInput = page.getByPlaceholder("Search for a game…");
    // Matches both label states: "Search" (idle) and "Searching…" (in flight).
    this.searchButton = page.getByRole("button", { name: /^search/i });
    this.noResults = page.getByText("No games found.");
    this.closeButton = page.getByRole("button", { name: "✕" });
    this.results = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("button", { name: "Add", exact: true }) });
  }

  // One result row by game title, e.g. result("Hades"). Returns a locator for the
  // spec to assert on, or to drill into (its Add button) in Step 9.
  result(name: string): Locator {
    return this.results.filter({ hasText: name });
  }

  // Type a query and run the search via the button. Auto-waiting handles the rest;
  // the spec then asserts on `results` / `noResults`.
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchButton.click();
  }

  // Same search, but triggered by pressing Enter in the input — a separate code path
  // in the component (handleKeyDown), worth covering on its own.
  async searchWithEnter(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchInput.press("Enter");
  }

  async close(): Promise<void> {
    await this.closeButton.click();
  }

  // Dismiss by clicking the backdrop. It covers the whole viewport; the panel sits
  // centred near the top, so a top-left corner click reliably lands on the backdrop,
  // not the panel. (The backdrop <div> has no semantic handle to target directly.)
  async closeByBackdrop(): Promise<void> {
    await this.page.mouse.click(5, 5);
  }
}
