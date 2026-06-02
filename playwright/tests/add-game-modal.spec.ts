// add-game-modal.spec.ts — the RAWG search + add flow (components/AddGameModal.tsx).
//
// Every case is real. The search is intercepted at the browser boundary with
// mockGameSearch (fixtures/rawg.ts), so these run fast, offline, and deterministic.
// Interaction goes through the DashboardPage → AddGameModal objects; assertions stay
// here as web-first expect(locator) calls.
//
// All cases run as the logged-in user via the chromium project's default storageState.
// The final case (Add → card appears in Backlog) POSTs to /api/user-games — it was the
// last case unblocked, in Step 9 (data seeding), and uses the `backlog` seeder purely
// for its auto-cleanup of the row it creates through the UI.

// `test`/`expect` come from our data fixture so the Add→Backlog case can request the
// `backlog` seeder purely for its auto-cleanup (it adds a real DB row through the UI).
// The other cases don't destructure `backlog`, so Playwright never sets it up for them.
import { test, expect } from "../fixtures/data";
import { DashboardPage } from "../pages/DashboardPage";
import { mockGameSearch, SAMPLE_GAMES } from "../fixtures/rawg";

test.describe("Add game modal", () => {
  test("opens when the Add game button is clicked", async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const modal = await dashboard.openAddGame();
    await expect(modal.heading).toBeVisible();
  });

  test("disables the Search button while the query is empty", async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    const modal = await dashboard.openAddGame();

    // On open the query is empty, so the button is disabled; typing enables it.
    await expect(modal.searchButton).toBeDisabled();
    await modal.searchInput.fill("hades");
    await expect(modal.searchButton).toBeEnabled();
  });

  test("triggers a search when Enter is pressed in the input", async ({ page }) => {
    await mockGameSearch(page); // default SAMPLE_GAMES
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    const modal = await dashboard.openAddGame();

    await modal.searchWithEnter("hades");

    // Enter is a different code path from the Search button; results still arrive.
    await expect(modal.results).toHaveCount(SAMPLE_GAMES.length);
  });

  test("renders the search results returned from the API", async ({ page }) => {
    await mockGameSearch(page); // Hades + Celeste
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    const modal = await dashboard.openAddGame();

    await modal.search("anything"); // the mock ignores the query text

    await expect(modal.results).toHaveCount(2);
    await expect(modal.result("Hades")).toBeVisible();
    await expect(modal.result("Celeste")).toBeVisible();
  });

  test("shows 'No games found' when the search returns nothing", async ({ page }) => {
    await mockGameSearch(page, []); // empty result set
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    const modal = await dashboard.openAddGame();

    await modal.search("nonexistent game");

    await expect(modal.noResults).toBeVisible();
    await expect(modal.results).toHaveCount(0);
  });

  test("closes via the ✕ button", async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    const modal = await dashboard.openAddGame();
    await expect(modal.heading).toBeVisible();

    await modal.close();
    await expect(modal.heading).toBeHidden();
  });

  test("closes when clicking the backdrop", async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    const modal = await dashboard.openAddGame();
    await expect(modal.heading).toBeVisible();

    await modal.closeByBackdrop();
    await expect(modal.heading).toBeHidden();
  });

  test("adding a game from the results places it in the Backlog column", async ({ page, backlog }) => {
    // `backlog` is requested only so its fixture deletes the game we add through the
    // UI afterwards, keeping the shared test user's board clean for the next test.
    void backlog;

    await mockGameSearch(page); // Hades + Celeste
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const modal = await dashboard.openAddGame();
    await modal.search("hades");
    await modal.addResult("Hades");

    // On success the modal closes and the new card appears in Backlog (the default
    // status), without a page reload — BacklogBoard updates its state optimistically.
    await expect(modal.heading).toBeHidden();
    await expect(dashboard.column("Backlog").card("Hades").root).toBeVisible();
  });
});
