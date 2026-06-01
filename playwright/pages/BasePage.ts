// playwright/pages/BasePage.ts — the small shared base every Page Object extends.
//
// A "Page Object" models ONE route of the app: it owns that route's locators and
// the actions a user can take there, so specs read like user intent and a UI change
// is fixed in ONE place instead of across dozens of tests. Everything common to
// every page lives here:
//   - a reference to Playwright's `page` (the browser tab), and
//   - the route's own path, so navigating is uniform.
//
// The defining rule of this layer (see docs/learning/10-playwright-testing.md):
// PAGES take a `Page`; COMPONENTS (built just-in-time in Step 9) take a `Locator`
// scoped to their subtree. That single difference is what makes components reusable
// across however many instances appear on screen.

import type { Page } from "@playwright/test";

export abstract class BasePage {
  // `protected` so subclasses can use it to build their locators, while specs
  // interact through the page object's methods/locators rather than reaching for
  // `page` directly.
  constructor(protected readonly page: Page) {}

  // Each concrete page declares its own route, e.g. "/dashboard".
  abstract readonly path: string;

  // Navigate to this page. baseURL (in playwright.config.ts) makes `path` relative.
  async goto(): Promise<void> {
    await this.page.goto(this.path);
  }
}
