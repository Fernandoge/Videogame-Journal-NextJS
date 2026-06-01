// dashboard.spec.ts — the backlog board (/dashboard).
//
// Step 4 skeleton: planned cases declared with test.fixme. Playwright has no
// test.todo (that's a Jest API); test.fixme declares the test, lists it in the
// report as not-yet-implemented, and skips its body. Bodies get filled in at
// Step 9 (data-dependent — they need a logged-in user with seeded games).

import { test } from "@playwright/test";

test.describe("Dashboard — backlog board", () => {
  test.fixme("renders the Playing, Backlog, and Completed columns", () => {});
  test.fixme("shows an empty-state placeholder in a column with no games", () => {});
  test.fixme("shows the game count badge on each column header", () => {});
  test.fixme("hides the Dropped archive when there are no dropped games", () => {});
  test.fixme("expanding the Dropped archive reveals dropped games", () => {});
  test.fixme("shows the active game count in the footer", () => {});
});
