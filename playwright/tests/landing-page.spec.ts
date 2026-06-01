// landing-page.spec.ts — the "walking skeleton" smoke test (Step 3).
//
// This is intentionally the simplest possible real test. Its job isn't to cover
// the landing page thoroughly — it's to prove the WHOLE pipeline works:
//   install → config → webServer boots the app → browser opens → assertion runs.
//
// We test the landing page ("/") because it's PUBLIC: no login, no database
// writes. That isolates infrastructure problems (port, build, browser) from test
// problems. If this is green, the foundation is solid and we can build on it.
//
// Note the assertions are all web-first (`expect(locator)...`) — they auto-retry
// until they pass or time out, so there are no manual waits anywhere.

import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("shows the hero and a Get started CTA linking to /signin", async ({ page }) => {
    // baseURL (from the config) means "/" resolves to http://localhost:3000/.
    await page.goto("/");

    // The hero <h1>. We match by ROLE + accessible name, not by CSS class, so the
    // test survives any restyling. A regex gives a forgiving, case-insensitive,
    // partial match against "Your gaming backlog, organised."
    await expect(
      page.getByRole("heading", { name: /your gaming backlog/i })
    ).toBeVisible();

    // The call-to-action is a link ("Get started — it's free"). We assert it's
    // visible AND points at the sign-in route — without clicking yet.
    const cta = page.getByRole("link", { name: /get started/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/signin");
  });

  test("Get started navigates to the sign-in page", async ({ page }) => {
    await page.goto("/");

    // Exercise real client-side navigation by actually clicking the link.
    await page.getByRole("link", { name: /get started/i }).click();

    // toHaveURL auto-waits for the navigation to settle.
    await expect(page).toHaveURL(/\/signin$/);
    await expect(
      page.getByRole("heading", { name: /welcome back/i })
    ).toBeVisible();
  });

  // Planned: assert the three feature cards (Backlog board / Session logger / Reviews).
  // test.fixme = planned/not-yet-implemented (Playwright has no test.todo).
  test.fixme("renders the three feature cards", () => {});
});
