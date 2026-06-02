// playwright/components/ReviewModal.ts — the write/edit review modal
// (components/ReviewModal.tsx).
//
// Singleton modal (one open at a time) → takes the `page`. Handles both "create"
// (heading "Write a review", Save) and "edit" (heading "Edit review", Update + Delete,
// fields pre-filled). The score picker is ten buttons labelled 1..10 — we match them
// by accessible name with exact:true so "1" never matches "10".

import type { Page, Locator } from "@playwright/test";

export class ReviewModal {
  // "Write a review" (new) or "Edit review" (existing) — both contain "review".
  readonly heading: Locator;
  readonly bodyInput: Locator;
  readonly saveButton: Locator;
  readonly deleteButton: Locator; // only present when editing
  readonly success: Locator;
  readonly closeButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole("heading", { name: /review/i });
    this.bodyInput = page.getByPlaceholder("What did you think?");
    this.saveButton = page.getByRole("button", { name: /save review|update review/i });
    this.deleteButton = page.getByRole("button", { name: "Delete", exact: true });
    this.success = page.getByText("Review saved! ✓");
    this.closeButton = page.getByRole("button", { name: "✕" });
  }

  // One score button, 1..10. exact:true so "1" ≠ "10".
  scoreButton(n: number): Locator {
    return this.page.getByRole("button", { name: String(n), exact: true });
  }

  // The descriptive label shown for the selected score, e.g. "Excellent" for 9.
  // exact:true so a one-word label like "Good" doesn't also match a review body that
  // happens to contain that word (getByText is substring + case-insensitive otherwise).
  scoreLabel(text: string): Locator {
    return this.page.getByText(text, { exact: true });
  }

  errorMessage(text: string): Locator {
    return this.page.getByText(text);
  }

  async selectScore(n: number): Promise<void> {
    await this.scoreButton(n).click();
  }

  // Pick a score and/or write the body, then submit. The body textarea is `required`,
  // so to exercise the "no score" error the spec must still supply a body.
  async save(opts: { score?: number; body?: string } = {}): Promise<void> {
    if (opts.score !== undefined) await this.selectScore(opts.score);
    if (opts.body !== undefined) await this.bodyInput.fill(opts.body);
    await this.saveButton.click();
  }

  async delete(): Promise<void> {
    await this.deleteButton.click();
  }
}
