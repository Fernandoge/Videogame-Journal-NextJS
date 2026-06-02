// review.spec.ts — writing/editing/deleting a review (components/ReviewModal.tsx).
//
// Score is 1-10; the same modal handles create AND edit, so we cover both. Tests that
// need an existing review seed one over the API first. The card's ✍/★N button both
// opens the modal and reflects the saved score, so several assertions land on it.

import { test, expect } from "../fixtures/data";
import { DashboardPage } from "../pages/DashboardPage";

test.describe("Review modal", () => {
  test("selecting a score highlights it and shows its label", async ({ page, backlog }) => {
    await backlog.addGame({ title: "Score Picker Game", status: "COMPLETED" });
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const modal = await dashboard.column("Completed").card("Score Picker Game").openReview();

    await modal.selectScore(8);
    await expect(modal.scoreLabel("Great")).toBeVisible();

    // Picking a different score swaps the label — proving it tracks the selection.
    await modal.selectScore(2);
    await expect(modal.scoreLabel("Bad")).toBeVisible();
    await expect(modal.scoreLabel("Great")).toBeHidden();
  });

  test("shows an error when submitting without a score", async ({ page, backlog }) => {
    await backlog.addGame({ title: "No Score Game", status: "COMPLETED" });
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const modal = await dashboard.column("Completed").card("No Score Game").openReview();

    // The body textarea is `required`, so we still supply a body — only the score is
    // missing, which is the case under test.
    await modal.save({ body: "Forgot to pick a score." });

    await expect(modal.errorMessage("Please select a score.")).toBeVisible();
  });

  test("saving a review updates the card button to show the score", async ({ page, backlog }) => {
    await backlog.addGame({ title: "New Review Game", status: "COMPLETED" });
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const card = dashboard.column("Completed").card("New Review Game");
    const modal = await card.openReview();
    await modal.save({ score: 9, body: "An absolute masterpiece of a roguelike." });

    await expect(modal.success).toBeVisible();
    // The board updates the card's button from ✍ to ★9.
    await expect(card.reviewButton).toHaveText("★9");
  });

  test("reopening shows the existing review pre-filled (edit mode)", async ({ page, backlog }) => {
    const game = await backlog.addGame({ title: "Edit Review Game", status: "COMPLETED" });
    await backlog.addReview(game.id, { score: 7, body: "Pretty good, a few rough edges." });

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const modal = await dashboard.column("Completed").card("Edit Review Game").openReview();

    // Edit mode reflects the saved review: heading, body, and score label all match.
    await expect(modal.heading).toHaveText("Edit review");
    await expect(modal.bodyInput).toHaveValue("Pretty good, a few rough edges.");
    await expect(modal.scoreLabel("Good")).toBeVisible(); // 7 → "Good"
    await expect(modal.deleteButton).toBeVisible();
  });

  test("deleting a review removes it", async ({ page, backlog }) => {
    const game = await backlog.addGame({ title: "Delete Review Game", status: "COMPLETED" });
    await backlog.addReview(game.id, { score: 5, body: "It was fine." });

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const card = dashboard.column("Completed").card("Delete Review Game");
    const modal = await card.openReview();
    await modal.delete();

    // With the review gone, the button falls back to the ✍ "write a review" state.
    await expect(card.reviewButton).toHaveText("✍");
  });
});
