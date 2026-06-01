// game-detail.spec.ts — the per-game detail page (/games/[id]).
//
// Step 4 skeleton (test.fixme = planned). Filled in at Step 9. Note the [id] is
// the UserGame id, not the Game id (the page is personal — your sessions, your
// review, your status).

import { test } from "@playwright/test";

test.describe("Game detail page", () => {
  test.fixme("shows the back link to the dashboard", () => {});
  test.fixme("shows the game title and metadata in the hero", () => {});
  test.fixme("changing the status updates the page", () => {});
  test.fixme("shows the stats row (total hours, session count)", () => {});
  test.fixme("shows the empty state when there are no sessions", () => {});
  test.fixme("lists logged play sessions", () => {});
  test.fixme("deleting a session removes it from the list", () => {});
  test.fixme("shows the empty state when there is no review", () => {});
  test.fixme("shows the written review with its score", () => {});
  test.fixme("returns a 404 for a game id that does not exist", () => {});
});
