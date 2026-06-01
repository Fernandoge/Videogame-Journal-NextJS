// warmup.setup.ts — compile EVERY route the suite touches, once and serially, before
// the parallel run. This is a SETUP project (like auth.setup.ts), not a real test.
//
// The problem it solves: `next dev` compiles each route the first time it's
// requested, on demand. When the suite fans out across 8 workers they all hit cold
// routes at once, and two things go wrong:
//   1. A control that needs React hydration (the Add-game button) gets clicked
//      before its handler is attached → the click is a no-op.
//   2. Worse, when several routes compile CONCURRENTLY, `next dev` intermittently
//      throws "TypeError: Cannot read properties of null (reading 'useContext')"
//      from SSR — a transient dev-server races, even on an already-warm route.
// Both only appear on the FIRST run after a code change (once .next is warm, runs
// are fast and green), which makes them nasty flakes.
//
// Fix: visit every route here — alone, serially, in BOTH auth states — so Next's
// .next cache is fully warm and NOTHING compiles once the parallel workers start.
// Pairs with the expect.toPass in DashboardPage.openAddGame for the residual
// handler-attach window. On CI we run a production build (no on-demand compilation),
// so this is a local-dev ergonomic — harmless and fast when there's nothing to warm.

import { test as warmup } from "@playwright/test";
import { DashboardPage } from "../pages/DashboardPage";

// The first compile of several cold routes can take a while; give it room. It does
// NOT slow warm runs — each step returns as soon as its page is ready.
warmup.setTimeout(180_000);

// Every route the specs navigate to. Logged-out visits compile the public bodies
// (/, /signin) and the redirect guards (/dashboard, /profile, /games/[id] all run
// auth() → redirect before touching data).
const ROUTES = ["/", "/signin", "/dashboard", "/profile", "/games/warmup"];

warmup("warm up dev routes", async ({ page, browser }) => {
  // 1) Authed: compile AND hydrate the real /dashboard, including the Add-game modal
  //    path (its code ships in the board's client chunk).
  const dashboard = new DashboardPage(page);
  await dashboard.goto();
  await page.waitForLoadState("networkidle");
  const modal = await dashboard.openAddGame();
  await modal.close();

  // 2) Logged OUT: a separate context with empty storage, so these hit the same
  //    unauthenticated code paths the logged-out specs do. Serial, so no two routes
  //    ever compile at the same time.
  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const anonPage = await anon.newPage();
  for (const route of ROUTES) {
    await anonPage.goto(route);
    await anonPage.waitForLoadState("networkidle");
  }
  await anon.close();
});
