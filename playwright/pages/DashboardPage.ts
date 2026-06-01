// playwright/pages/DashboardPage.ts — the backlog board at /dashboard
// (rendered by components/BacklogBoard.tsx).
//
// Step 7 builds ONLY what the data-free dashboard tests need: an empty board, since
// our test user has no games yet. The per-card and per-column COMPONENT objects
// (GameCard, BacklogColumn) arrive in Step 9 — once seeded data gives them real
// instances to scope. Building them now would be inventing abstractions for tests
// that don't exist yet, which the build plan deliberately avoids.

import { expect, type Page, type Locator } from "@playwright/test";
import { BasePage } from "./BasePage";
import { AddGameModal } from "../components/AddGameModal";

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

  // The board header's "+ Add game" button. The /add game/i name won't collide with
  // a result row's bare "Add" button (no "game"), so it's unambiguous.
  readonly addGameButton: Locator;

  constructor(page: Page) {
    super(page);
    this.emptyStates = page.getByText("No games here yet");
    this.droppedToggle = page.getByRole("button", { name: /dropped/i });
    this.addGameButton = page.getByRole("button", { name: /add game/i });
  }

  // Open the Add-game modal and return its component object. A method that opens a
  // modal hands back the modal's object so the spec's next call auto-waits — no
  // explicit "wait for the modal to appear" boilerplate needed.
  //
  // BacklogBoard is a Client Component: right after navigation the "+ Add game"
  // button is already in the SSR'd HTML (so it's clickable), but its React onClick
  // may not be attached yet — hydration hasn't finished. A single click can land
  // before the handler exists and silently do nothing, so the modal never opens.
  // This only bites under parallel load (slower hydration), which makes it a nasty
  // flake. expect.toPass retries the click until the modal actually appears, i.e.
  // until hydration has wired the handler up. (This is an actionability/reliability
  // concern, not a behavioural assertion — the test still asserts the modal opened
  // in the spec.) The trigger only ever sets isOpen=true, so re-clicking is safe.
  async openAddGame(): Promise<AddGameModal> {
    const modal = new AddGameModal(this.page);
    await expect(async () => {
      await this.addGameButton.click();
      await expect(modal.heading).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    return modal;
  }

  // A column header is an <h2> (emoji + label). `level: 2` excludes the page's
  // <h1> "My Backlog", so the label "Backlog" doesn't match both headings. Returns
  // a locator for the spec to assert on — the page object never asserts itself.
  columnHeading(label: string): Locator {
    return this.page.getByRole("heading", { name: label, level: 2 });
  }
}
