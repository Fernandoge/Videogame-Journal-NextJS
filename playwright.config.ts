// playwright.config.ts — global configuration for the Playwright test runner.
//
// This is read once, before any test runs. It answers four questions:
//   1. Where are the tests?            → testDir
//   2. What URL do they talk to?       → use.baseURL
//   3. Who starts the app for them?    → webServer
//   4. What browser(s) do they use?    → projects
//
// We keep it deliberately MINIMAL for now (Step 2 of the build plan in
// docs/learning/10-playwright-testing.md). No auth project yet — that arrives in
// Step 6. Fewer moving parts means an easier first run to debug.

import { defineConfig, devices } from "@playwright/test";

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

  // For now just Chromium. We can add firefox/webkit projects later by copying
  // this entry — the tests don't change.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
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
  },
});
