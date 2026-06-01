// dashboard.spec.ts — the backlog board (/dashboard).
//
// Step 7 fills in the cases that need ONLY authentication — an empty board, since
// our test user has no games. They run as the logged-in user automatically, via the
// chromium project's default storageState (no `test.use` needed). Interaction goes
// through the DashboardPage page object; assertions stay here in the spec as
// web-first `expect(locator)` calls — the POM golden rule (expose locators, assert
// in the test).
//
// The remaining cases need SEEDED games and are filled in at Step 9; until then they
// stay as test.fixme (declared + listed in the report, body skipped). Playwright has
// no test.todo — test.fixme is the equivalent.

import { test, expect } from "@playwright/test";
import { DashboardPage } from "../pages/DashboardPage";

test.describe("Dashboard — backlog board", () => {
  test("renders the Playing, Backlog, and Completed columns", async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    await expect(dashboard.columnHeading("Playing")).toBeVisible();
    await expect(dashboard.columnHeading("Backlog")).toBeVisible();
    await expect(dashboard.columnHeading("Completed")).toBeVisible();
  });

  test("shows an empty-state placeholder in a column with no games", async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    // All three columns are empty for a fresh user, so the placeholder appears
    // three times. toHaveCount auto-retries until the board has finished rendering.
    await expect(dashboard.emptyStates).toHaveCount(3);
  });

  test("hides the Dropped archive when there are no dropped games", async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    // Guard first: wait until the board is actually up (a column visible). Without
    // this, toHaveCount(0) could pass simply because the page hadn't loaded yet —
    // a false green. THEN assert the Dropped toggle isn't rendered.
    await expect(dashboard.columnHeading("Playing")).toBeVisible();
    await expect(dashboard.droppedToggle).toHaveCount(0);
  });

  // These need SEEDED games — filled in at Step 9.
  test.fixme("shows the game count badge on each column header", () => {});
  test.fixme("expanding the Dropped archive reveals dropped games", () => {});
  test.fixme("shows the active game count in the footer", () => {});
});
