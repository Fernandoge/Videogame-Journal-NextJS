// dashboard.spec.ts — the backlog board (/dashboard).
//
// Every case is real. The data-free cases (an empty board) landed in Step 7; the cases
// that need SEEDED games landed in Step 9 via the `backlog` seeder. All run as the
// logged-in user automatically, via the chromium project's default storageState (no
// `test.use` needed). Interaction goes through the DashboardPage page object;
// assertions stay here in the spec as web-first `expect(locator)` calls — the POM
// golden rule (expose locators, assert in the test).

// We import `test`/`expect` from our data fixture (not @playwright/test) so the
// data-dependent cases can request the `backlog` seeder. Tests that don't destructure
// `backlog` (the empty-board cases below) are unaffected — Playwright only sets up a
// fixture when a test actually uses it.
import { test, expect } from "../fixtures/data";
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

  test("shows the active game count in the footer", async ({ page, backlog }) => {
    // Two non-dropped games → "2 active games". The seeder creates them over the API
    // before we load the page; the `backlog` fixture cleans up afterwards.
    await backlog.addGame({ title: "Footer Game A", status: "BACKLOG" });
    await backlog.addGame({ title: "Footer Game B", status: "PLAYING" });

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    await expect(dashboard.activeCount).toHaveText(/2 active games/);
  });

  test("shows the game count badge on each column header", async ({ page, backlog }) => {
    await backlog.addGame({ title: "Badge Playing", status: "PLAYING" });
    await backlog.addGame({ title: "Badge Backlog 1", status: "BACKLOG" });
    await backlog.addGame({ title: "Badge Backlog 2", status: "BACKLOG" });

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    // Each column's badge reflects how many of the user's games are in that status.
    await expect(dashboard.column("Playing").countBadge).toHaveText("1");
    await expect(dashboard.column("Backlog").countBadge).toHaveText("2");
    await expect(dashboard.column("Completed").countBadge).toHaveText("0");
  });

  test("expanding the Dropped archive reveals dropped games", async ({ page, backlog }) => {
    await backlog.addGame({ title: "Dropped Game", status: "DROPPED" });

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    // The archive is collapsed by default: the toggle shows, but the dropped card is
    // not in the DOM until you expand it.
    const droppedCard = page.getByRole("link", { name: "Dropped Game" });
    await expect(dashboard.droppedToggle).toBeVisible();
    await expect(droppedCard).toBeHidden();

    await dashboard.expandDropped();
    await expect(droppedCard).toBeVisible();
  });
});
