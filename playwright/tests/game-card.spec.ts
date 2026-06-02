// game-card.spec.ts — one game card on the backlog board (components/GameCard.tsx).
//
// Each test seeds a single game over the API (the `backlog` fixture, which also cleans
// up), loads the dashboard, and drives the card through its DashboardPage → BacklogColumn
// → GameCard objects. Assertions stay here as web-first expect(locator) calls.

import { test, expect } from "../fixtures/data";
import { DashboardPage } from "../pages/DashboardPage";

test.describe("Game card", () => {
  test("clicking the title navigates to the game detail page", async ({ page, backlog }) => {
    const game = await backlog.addGame({ title: "Detail Link Game", status: "BACKLOG" });
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    // The title is a real <a href="/games/[id]">, so this navigates with or without
    // hydration. The id in the URL is the UserGame id the seeder returned.
    await dashboard.column("Backlog").card("Detail Link Game").titleLink.click();
    await expect(page).toHaveURL(new RegExp(`/games/${game.id}`));
  });

  test("changing the status select moves the card to another column", async ({ page, backlog }) => {
    await backlog.addGame({ title: "Status Mover", status: "BACKLOG" });
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const card = dashboard.column("Backlog").card("Status Mover");
    await expect(card.root).toBeVisible();

    await card.setStatus("PLAYING");

    // The board moves the card: gone from Backlog, present in Playing.
    await expect(dashboard.column("Backlog").card("Status Mover").root).toHaveCount(0);
    await expect(dashboard.column("Playing").card("Status Mover").root).toBeVisible();
  });

  test("the delete button opens a confirmation modal", async ({ page, backlog }) => {
    await backlog.addGame({ title: "Confirm Game", status: "BACKLOG" });
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const card = dashboard.column("Backlog").card("Confirm Game");
    await card.openDeleteConfirm();

    await expect(card.confirmHeading).toBeVisible();
  });

  test("cancelling the confirmation keeps the game on the board", async ({ page, backlog }) => {
    await backlog.addGame({ title: "Keep Game", status: "BACKLOG" });
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const card = dashboard.column("Backlog").card("Keep Game");
    await card.openDeleteConfirm();
    await card.cancelButton.click();

    // Modal dismissed, card still there.
    await expect(card.confirmHeading).toBeHidden();
    await expect(card.root).toBeVisible();
  });

  test("confirming deletion removes the game from the board", async ({ page, backlog }) => {
    await backlog.addGame({ title: "Delete Game", status: "BACKLOG" });
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const card = dashboard.column("Backlog").card("Delete Game");
    await card.openDeleteConfirm();
    await card.confirmDelete.click();

    await expect(dashboard.column("Backlog").card("Delete Game").root).toHaveCount(0);
  });
});
