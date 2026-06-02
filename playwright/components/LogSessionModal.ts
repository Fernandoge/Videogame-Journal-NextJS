// playwright/components/LogSessionModal.ts — the play-session logger
// (components/LogSessionModal.tsx).
//
// Like AddGameModal, this is a SINGLETON modal — every GameCard renders its own ⏱
// trigger, but only one modal is ever open — so it takes the `page` and targets the
// open modal's (page-unique) fields directly. The hours/minutes inputs are reachable
// by `getByLabel` thanks to the aria-labels we added (both shared placeholder="0").

import type { Page, Locator } from "@playwright/test";

export class LogSessionModal {
  readonly heading: Locator;
  readonly hoursInput: Locator;
  readonly minutesInput: Locator;
  readonly notesInput: Locator;
  readonly saveButton: Locator;
  readonly success: Locator;
  readonly closeButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole("heading", { name: "Log session" });
    this.hoursInput = page.getByLabel("Hours");
    this.minutesInput = page.getByLabel("Minutes");
    this.notesInput = page.getByPlaceholder("What did you do?");
    this.saveButton = page.getByRole("button", { name: /save session/i });
    this.success = page.getByText("Session logged! ✓");
    this.closeButton = page.getByRole("button", { name: "✕" });
  }

  // The validation error paragraph, addressed by its message text. The spec passes
  // the exact message it expects, e.g. "Please enter at least 1 minute."
  errorMessage(text: string): Locator {
    return this.page.getByText(text);
  }

  // Fill the form and submit. Any field left undefined keeps its current value, so
  // `save()` with no args submits the defaults (0h 0m → triggers the "no time" error).
  async save(
    opts: { hours?: number | string; minutes?: number | string; notes?: string } = {},
  ): Promise<void> {
    if (opts.hours !== undefined) await this.hoursInput.fill(String(opts.hours));
    if (opts.minutes !== undefined) await this.minutesInput.fill(String(opts.minutes));
    if (opts.notes !== undefined) await this.notesInput.fill(opts.notes);
    await this.saveButton.click();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
  }
}
