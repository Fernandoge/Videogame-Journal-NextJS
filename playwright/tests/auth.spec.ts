// auth.spec.ts — authentication boundaries (Steps 5 + 6).
//
// Two halves, both real and runnable:
//   1. Logged-OUT: protected pages bounce a visitor to /signin (each page's
//      `if (!session) redirect("/signin")` guard). Needs no setup at all.
//   2. Logged-IN: a signed-in user is pushed OFF the public/auth pages to
//      /dashboard. This is what the Step 6 auth fixture unblocks.
//
// The two halves need OPPOSITE auth states, so each `describe` sets its own
// `storageState` (overriding the chromium project's logged-in default).

import { test, expect } from "@playwright/test";

test.describe("Protected routes redirect when logged out", () => {
  // Opt OUT of the project's default logged-in session: an EMPTY storage state, so
  // these tests run with no cookie and exercise the unauthenticated path.
  test.use({ storageState: { cookies: [], origins: [] } });

  // The three guarded routes. We use the same assertion for each, so we generate
  // one test per route in a loop — this is parametrisation at collection time,
  // not runtime branching, so each still reports as its own independent test.
  const protectedRoutes = ["/dashboard", "/profile", "/games/any-game-id"];

  for (const route of protectedRoutes) {
    test(`visiting ${route} while logged out redirects to /signin`, async ({ page }) => {
      await page.goto(route);

      // The server redirects to /signin before any data loads. goto() follows it,
      // and toHaveURL auto-waits for the final URL to settle.
      await expect(page).toHaveURL(/\/signin/);

      // Confirm we actually landed on the sign-in page, not just any URL.
      await expect(
        page.getByRole("heading", { name: /welcome back/i })
      ).toBeVisible();
    });
  }
});

test.describe("Signed-in users skip the public and sign-in pages", () => {
  // No `test.use` here: these INHERIT the chromium project's default logged-in
  // storageState (the cookie minted by auth.setup.ts). Reaching /dashboard at all
  // proves the cookie decrypted into a valid `session.user.id` — an unauthenticated
  // visitor would have been redirected to /signin instead.
  test("a signed-in user visiting /signin is sent to /dashboard", async ({ page }) => {
    await page.goto("/signin");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("a signed-in user visiting / is sent to /dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
