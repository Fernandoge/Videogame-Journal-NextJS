// playwright/components/GameCard.ts — one game card on the backlog board
// (components/GameCard.tsx).
//
// COMPONENT object scoped to a single card's `Locator` (the <li> wrapping it). Every
// locator below is relative to that subtree, so a card's controls — and its
// delete-confirmation modal, which React renders inside the same card fragment — are
// found without matching a different card. BacklogColumn.card(title) builds these.

import type { Locator } from "@playwright/test";
import { LogSessionModal } from "./LogSessionModal";
import { ReviewModal } from "./ReviewModal";

export class GameCard {
  // The title (the only link in a card) — navigates to /games/[id].
  readonly titleLink: Locator;
  // The native status <select> (role "combobox").
  readonly statusSelect: Locator;
  // The ⏱ button that opens the log-session modal — found by its title attribute.
  readonly logSessionButton: Locator;
  // The ✍ / ★N button that opens the review modal. Its title is "Write a review" when
  // there's no review yet and "Your review: N/10" once one exists — match either, so
  // the same locator opens the modal in both states.
  readonly reviewButton: Locator;
  // The 🗑 button — found by its title attribute, not its emoji.
  readonly deleteButton: Locator;

  // The delete-confirmation modal, which appears after clicking 🗑:
  readonly confirmHeading: Locator;
  readonly confirmDelete: Locator;
  readonly cancelButton: Locator;

  constructor(readonly root: Locator) {
    this.titleLink = root.getByRole("link");
    this.statusSelect = root.getByRole("combobox");
    this.logSessionButton = root.getByTitle("Log a play session");
    this.reviewButton = root.getByTitle(/write a review|your review/i);
    this.deleteButton = root.getByTitle("Remove from backlog");
    this.confirmHeading = root.getByRole("heading", { name: "Remove from backlog?" });
    this.confirmDelete = root.getByRole("button", { name: /yes, delete/i });
    this.cancelButton = root.getByRole("button", { name: "Cancel" });
  }

  // Move the card to another status via its <select>. Pass the enum value
  // ("PLAYING" | "BACKLOG" | "COMPLETED" | "DROPPED"). The board then moves the card
  // to the matching column; the spec asserts that move.
  async setStatus(status: "PLAYING" | "BACKLOG" | "COMPLETED" | "DROPPED"): Promise<void> {
    await this.statusSelect.selectOption(status);
  }

  // Open the delete-confirmation modal (🗑). The spec then asserts / clicks
  // confirmDelete or cancelButton.
  async openDeleteConfirm(): Promise<void> {
    await this.deleteButton.click();
  }

  // Open this card's log-session modal (⏱) and return its component object. Only one
  // log-session modal is ever open, so it's addressed at the page level.
  async openLogSession(): Promise<LogSessionModal> {
    await this.logSessionButton.click();
    return new LogSessionModal(this.root.page());
  }

  // Open this card's review modal (✍ / ★N) and return its component object.
  async openReview(): Promise<ReviewModal> {
    await this.reviewButton.click();
    return new ReviewModal(this.root.page());
  }
}
