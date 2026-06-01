// auth.spec.ts — authentication boundaries (Step 5).
//
// These are real, runnable tests (not todos) because they need ZERO setup:
// no login, no database. They verify that the protected pages bounce a
// logged-OUT visitor to /signin — server-side redirects from each page's
// `if (!session) redirect("/signin")` guard.
//
// Because these test the logged-OUT state, they must run WITHOUT any saved
// session. We force a clean, empty storage state below. Right now nothing sets a
// default anyway, but once Step 6 attaches a logged-in storageState to the
// chromium project, this line keeps THESE tests logged out regardless.

import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Protected routes redirect when logged out", () => {
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

  // These need a logged-IN session, which arrives with the auth fixture in Step 6.
  // test.fixme = planned/not-yet-implemented (Playwright has no test.todo).
  test.fixme("a signed-in user visiting /signin is sent to /dashboard", () => {});
  test.fixme("a signed-in user visiting / is sent to /dashboard", () => {});
});
