// profile.spec.ts — the profile dashboard with stats (/profile).
//
// Every number here is DERIVED from seeded rows, so each test creates exactly the data
// it asserts on (via the `backlog` fixture, which also cleans up). Name/email come from
// the session JWT, not the DB, so that one test needs no seeding. Assertions stay
// web-first: we scope each stat card / list to kill the "bare number matches everything"
// trap (see ProfilePage).

import { test, expect } from "../fixtures/data";
import { ProfilePage } from "../pages/ProfilePage";
import { TEST_USER } from "../fixtures/test-user";
import type { BacklogSeeder } from "../fixtures/data";

// A fixed mix used by the overview + breakdown tests:
//   5 games total · 1 PLAYING (2 sessions, 2.5h) · 2 BACKLOG · 1 COMPLETED · 1 DROPPED.
async function seedMix(backlog: BacklogSeeder): Promise<void> {
  const playing = await backlog.addGame({ title: "Profile Playing", status: "PLAYING" });
  await backlog.logSession(playing.id, { hoursPlayed: 1 });
  await backlog.logSession(playing.id, { hoursPlayed: 1.5 });
  await backlog.addGame({ title: "Profile Backlog A", status: "BACKLOG" });
  await backlog.addGame({ title: "Profile Backlog B", status: "BACKLOG" });
  await backlog.addGame({ title: "Profile Completed", status: "COMPLETED" });
  await backlog.addGame({ title: "Profile Dropped", status: "DROPPED" });
}

test.describe("Profile page", () => {
  test("shows the user's name and email", async ({ page }) => {
    // Name/email are read from the session JWT, so this needs no seeded data.
    const profile = new ProfilePage(page);
    await profile.goto();

    await expect(profile.name).toHaveText(TEST_USER.name);
    await expect(profile.email(TEST_USER.email)).toBeVisible();
  });

  test("shows the four overview stat cards", async ({ page, backlog }) => {
    await seedMix(backlog);
    const profile = new ProfilePage(page);
    await profile.goto();

    await expect(profile.stat("Total games")).toContainText("5");
    await expect(profile.stat("Hours played")).toContainText("2h 30m");
    await expect(profile.stat("Sessions logged")).toContainText("2");
    await expect(profile.stat("Completed")).toContainText("1");
  });

  test("shows the status breakdown counts", async ({ page, backlog }) => {
    await seedMix(backlog);
    const profile = new ProfilePage(page);
    await profile.goto();

    await expect(profile.breakdown("playing")).toContainText("1");
    await expect(profile.breakdown("backlog")).toContainText("2");
    await expect(profile.breakdown("completed")).toContainText("1");
    await expect(profile.breakdown("dropped")).toContainText("1");
  });

  test("lists recent play sessions", async ({ page, backlog }) => {
    const game = await backlog.addGame({ title: "Session Profile Game", status: "PLAYING" });
    await backlog.logSession(game.id, { hoursPlayed: 1, notes: "First profile session" });
    await backlog.logSession(game.id, { hoursPlayed: 2, notes: "Second profile session" });

    const profile = new ProfilePage(page);
    await profile.goto();

    await expect(profile.recentSessions).toHaveCount(2);
    await expect(profile.recentSession("First profile session")).toBeVisible();
    await expect(profile.recentSession("Second profile session")).toBeVisible();
  });

  test("lists recently completed games", async ({ page, backlog }) => {
    await backlog.addGame({ title: "Completed Profile A", status: "COMPLETED" });
    await backlog.addGame({ title: "Completed Profile B", status: "COMPLETED" });

    const profile = new ProfilePage(page);
    await profile.goto();

    await expect(profile.recentlyCompleted).toHaveCount(2);
    await expect(profile.completedGame("Completed Profile A")).toBeVisible();
    await expect(profile.completedGame("Completed Profile B")).toBeVisible();
  });

  test("lists written reviews", async ({ page, backlog }) => {
    const game = await backlog.addGame({ title: "Reviewed Profile Game", status: "COMPLETED" });
    await backlog.addReview(game.id, { score: 9, body: "A thoughtful, detailed review." });

    const profile = new ProfilePage(page);
    await profile.goto();

    await expect(profile.reviews).toHaveCount(1);
    await expect(profile.review("Reviewed Profile Game")).toContainText("A thoughtful, detailed review.");
    await expect(profile.review("Reviewed Profile Game")).toContainText("9"); // the score badge
  });

  test("shows empty states when there is no data", async ({ page, backlog }) => {
    // Destructuring `backlog` triggers its clean-before hook, guaranteeing an empty board.
    void backlog;
    const profile = new ProfilePage(page);
    await profile.goto();

    await expect(profile.recentSessionsEmpty).toBeVisible();
    await expect(profile.recentlyCompletedEmpty).toBeVisible();
    await expect(profile.reviewsEmpty).toBeVisible();
    // The overview reflects an empty board too.
    await expect(profile.stat("Total games")).toContainText("0");
  });
});
