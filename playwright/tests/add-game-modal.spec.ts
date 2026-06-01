// add-game-modal.spec.ts — the RAWG search + add flow (components/AddGameModal.tsx).
//
// Step 8 fills in every case EXCEPT the one that writes to the database (actually
// adding a game). The search is intercepted at the browser boundary with
// mockGameSearch (fixtures/rawg.ts), so these run fast, offline, and deterministic.
// Interaction goes through the DashboardPage → AddGameModal objects; assertions stay
// here as web-first expect(locator) calls.
//
// All cases run as the logged-in user via the chromium project's default
// storageState. The final case (Add → card appears in Backlog) POSTs to
// /api/user-games and needs a real DB row + cleanup, so it stays test.fixme for
// Step 9 (data seeding).

import { test, expect } from "@playwright/test";
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

  // Needs a real DB write (POST /api/user-games) + cleanup → Step 9 (data seeding).
  test.fixme("adding a game from the results places it in the Backlog column", () => {});
});
