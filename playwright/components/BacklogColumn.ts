// playwright/components/BacklogColumn.ts — one status column on the backlog board.
//
// COMPONENT object: it takes a scoped `Locator` (the column's labelled region), not
// the whole `page`. That's what lets the SAME class model any of the three columns —
// every locator below is relative to this column's subtree, so "the empty state" or
// "the card titled X" never accidentally matches a different column.
//
// The column root is reachable because BacklogBoard tags each column with
// role="region" + aria-label={label}; DashboardPage.column(label) supplies it as
// getByRole("region", { name: label }).

import type { Locator } from "@playwright/test";
import { GameCard } from "./GameCard";

export class BacklogColumn {
  // The cards in THIS column — each game is rendered as a <li>.
  readonly cards: Locator;
  // The "No games here yet" placeholder, shown only when this column is empty.
  readonly emptyState: Locator;
  // The count badge in the header. It's the <span> immediately after the column's
  // <h2>; anchoring on the heading keeps it stable without depending on CSS classes.
  readonly countBadge: Locator;

  constructor(private readonly root: Locator) {
    this.cards = root.getByRole("listitem");
    this.emptyState = root.getByText("No games here yet");
    this.countBadge = root.locator("h2 + span");
  }

  // One card by its game title, as a GameCard component object. Cards show the title
  // as a link, so filtering this column's list items by text reliably selects the
  // right one. Use `.root` for presence/visibility assertions.
  card(title: string): GameCard {
    return new GameCard(this.cards.filter({ hasText: title }));
  }
}
