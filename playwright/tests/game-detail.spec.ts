// game-detail.spec.ts — the per-game detail page (/games/[id]).
//
// The [id] is the UserGame id, not the Game id (the page is personal — your sessions,
// your review, your status). Each test seeds its own data over the API (the `backlog`
// fixture, which also cleans up), navigates to that game's page via GameDetailPage,
// and asserts web-first on the page object's locators.

import { test, expect } from "../fixtures/data";
import { GameDetailPage } from "../pages/GameDetailPage";
import { DashboardPage } from "../pages/DashboardPage";

test.describe("Game detail page", () => {
  test("shows the back link to the dashboard", async ({ page, backlog }) => {
    const game = await backlog.addGame({ title: "Back Link Game", status: "BACKLOG" });
    const detail = new GameDetailPage(page, game.id);
    await detail.goto();

    // It's a real <a href="/dashboard">, so clicking navigates with or without
    // hydration — the cheapest, most robust thing to assert is the navigation itself.
    await expect(detail.backLink).toBeVisible();
    await detail.backLink.click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("shows the game title and metadata in the hero", async ({ page, backlog }) => {
    const game = await backlog.addGame({
      title: "Hero Game",
      status: "BACKLOG",
      genre: "Action RPG",
      releaseYear: 2017,
    });
    const detail = new GameDetailPage(page, game.id);
    await detail.goto();

    await expect(detail.title).toHaveText("Hero Game");
    // Genre and year share one <p> ("Action RPG · 2017"); assert each as a substring
    // so the test never depends on the exact middot separator.
    await expect(detail.metadata("Action RPG")).toBeVisible();
    await expect(detail.metadata("2017")).toBeVisible();
  });

  test("changing the status persists across a reload", async ({ page, backlog }) => {
    const game = await backlog.addGame({ title: "Status Detail Game", status: "BACKLOG" });
    const detail = new GameDetailPage(page, game.id);
    await detail.goto();

    // setStatus waits for the PATCH to land, so the reload below reads the saved
    // state rather than racing (and cancelling) the in-flight request.
    await detail.setStatus("COMPLETED");
    await detail.goto();

    await expect(detail.statusSelect).toHaveValue("COMPLETED");
  });

  test("shows the stats row (total hours, session count)", async ({ page, backlog }) => {
    const game = await backlog.addGame({ title: "Stats Row Game", status: "PLAYING" });
    // 2h + 1h30m + 30m = 4h across 3 sessions.
    await backlog.logSession(game.id, { hoursPlayed: 2 });
    await backlog.logSession(game.id, { hoursPlayed: 1.5 });
    await backlog.logSession(game.id, { hoursPlayed: 0.5 });

    const detail = new GameDetailPage(page, game.id);
    await detail.goto();

    await expect(detail.statLabel("Total hours")).toBeVisible();
    await expect(detail.statValue("4h")).toBeVisible();
    await expect(detail.statLabel("Sessions")).toBeVisible();
    await expect(detail.statValue("3")).toBeVisible();
  });

  test("shows the empty state when there are no sessions", async ({ page, backlog }) => {
    const game = await backlog.addGame({ title: "No Sessions Game", status: "BACKLOG" });
    const detail = new GameDetailPage(page, game.id);
    await detail.goto();

    await expect(detail.sessionsEmptyState).toBeVisible();
    await expect(detail.sessions).toHaveCount(0);
  });

  test("lists logged play sessions", async ({ page, backlog }) => {
    const game = await backlog.addGame({ title: "Sessions List Game", status: "PLAYING" });
    await backlog.logSession(game.id, { hoursPlayed: 1, notes: "Beat the first boss" });
    await backlog.logSession(game.id, { hoursPlayed: 2, notes: "Explored the whole map" });

    const detail = new GameDetailPage(page, game.id);
    await detail.goto();

    await expect(detail.sessions).toHaveCount(2);
    await expect(detail.session("Beat the first boss")).toBeVisible();
    await expect(detail.session("Explored the whole map")).toBeVisible();
  });

  test("deleting a session removes it from the list", async ({ page, backlog }) => {
    const game = await backlog.addGame({ title: "Delete Session Game", status: "PLAYING" });
    await backlog.logSession(game.id, { hoursPlayed: 1, notes: "The only session" });

    const detail = new GameDetailPage(page, game.id);
    await detail.goto();
    await expect(detail.sessions).toHaveCount(1);

    await detail.deleteSession("The only session");

    // The list refreshes from the server: the row is gone and the empty state returns.
    await expect(detail.sessions).toHaveCount(0);
    await expect(detail.sessionsEmptyState).toBeVisible();
  });

  test("shows the empty state when there is no review", async ({ page, backlog }) => {
    const game = await backlog.addGame({ title: "No Review Game", status: "BACKLOG" });
    const detail = new GameDetailPage(page, game.id);
    await detail.goto();

    await expect(detail.reviewEmptyState).toBeVisible();
  });

  test("shows the written review with its score", async ({ page, backlog }) => {
    const game = await backlog.addGame({ title: "Reviewed Detail Game", status: "COMPLETED" });
    await backlog.addReview(game.id, { score: 8, body: "A near-perfect roguelike experience." });

    const detail = new GameDetailPage(page, game.id);
    await detail.goto();

    await expect(detail.reviewBody("A near-perfect roguelike experience.")).toBeVisible();
    // The "Your score" stat only renders when a review exists; its value is "N / 10".
    await expect(detail.statLabel("Your score")).toBeVisible();
    await expect(detail.statValue("8 / 10")).toBeVisible();
  });

  test("returns a 404 for a game id that does not exist", async ({ page }) => {
    // No matching UserGame → the page calls notFound(), which serves Next's 404.
    const response = await page.goto("/games/does-not-exist");
    expect(response?.status()).toBe(404);
  });
});
