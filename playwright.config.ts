// playwright.config.ts — global configuration for the Playwright test runner.
//
// This is read once, before any test runs. It answers four questions:
//   1. Where are the tests?            → testDir
//   2. What URL do they talk to?       → use.baseURL
//   3. Who starts the app for them?    → webServer
//   4. What browser(s) do they use?    → projects
//
// Step 6 added the auth layer: a `setup` project mints a logged-in session once,
// and the chromium project defaults every test to that session via `storageState`
// (see docs/learning/10-playwright-testing.md).

import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import { STORAGE_STATE } from "./playwright/fixtures/test-user";

// Load the TEST environment (kept separate from your real .env) BEFORE building the
// config below. This runs in Playwright's main process, so the values land in
// process.env — inherited by the test workers (auth.setup.ts reads AUTH_SECRET) and
// injected into the app we boot (webServer.env), so the cookie our setup signs and
// the cookie the app decrypts use the SAME AUTH_SECRET.
dotenv.config({ path: ".env.test" });

export default defineConfig({
  // All spec files live here. Keeping tests out of /app and /components keeps the
  // app bundle clean — test code never accidentally ships to the browser.
  testDir: "./playwright/tests",

  // Run files in parallel across worker processes. This only stays reliable if
  // tests are isolated (see the doc) — which is exactly why we design for it.
  fullyParallel: true,

  // A stray `test.only(...)` left in the code would silently skip every other
  // test. Fail the CI run if one is committed. (No effect locally.)
  forbidOnly: !!process.env.CI,

  // Retry flaky tests on CI only. Locally, a flake is a bug to fix — not to hide.
  retries: process.env.CI ? 2 : 0,

  // "list" prints live progress in the terminal; "html" writes a rich report.
  // open: "never" stops it from auto-launching a browser tab after the run, which
  // would hang a non-interactive/CI environment.
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    // Lets every test use relative paths: page.goto("/dashboard") instead of the
    // full URL. Change the host in one place and every test follows.
    baseURL: "http://localhost:3000",

    // Capture a full debuggable trace only when a test is retried — zero overhead
    // on green runs, a time-travel recording the moment something flakes.
    trace: "on-first-retry",
  },

  projects: [
    // Runs FIRST. Mints the session cookie and writes it to STORAGE_STATE. It's a
    // separate "project" (not a beforeEach) so the work happens once per run, and so
    // other projects can `depend on` it. Matched by filename, not the *.spec pattern.
    { name: "setup", testMatch: /auth\.setup\.ts/ },

    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // DEFAULT every test to the logged-in session minted by `setup`. Public /
        // logged-out specs (landing-page, and the redirect block in auth.spec) opt
        // OUT with `test.use({ storageState: { cookies: [], origins: [] } })`.
        storageState: STORAGE_STATE,
      },
      // Don't run chromium tests until the cookie file exists.
      dependencies: ["setup"],
    },
  ],

  // Playwright starts the app itself before the run, so you never babysit a
  // separate terminal. Locally we use `next dev` (fast to boot, no full build);
  // on CI we run a production build, which is closer to real and more stable.
  webServer: {
    command: process.env.CI ? "npm run build && npm run start" : "npm run dev",
    url: "http://localhost:3000",
    // Locally, reuse a dev server you already have running on :3000 instead of
    // starting a second one. On CI there's never one running, so always start.
    reuseExistingServer: !process.env.CI,
    // `next dev`'s first compile can be slow; give it room before giving up.
    timeout: 120_000,
    // Boot the app with the TEST secret so it agrees with what auth.setup.ts signs.
    // Next.js only auto-loads .env.test when NODE_ENV=test, and `next dev` forces
    // development — so we pass it explicitly here. (Injected vars win over .env; the
    // rest of the app's config, incl. DATABASE_URL, still comes from .env for now.)
    env: {
      AUTH_SECRET: process.env.AUTH_SECRET!,
    },
  },
});
