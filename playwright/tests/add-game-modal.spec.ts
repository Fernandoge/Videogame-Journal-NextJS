// add-game-modal.spec.ts — the RAWG search + add flow (AddGameModal).
//
// Step 4 skeleton (test.fixme = planned). The search calls /api/games/search,
// which we'll MOCK at the browser boundary (Step 8) so these tests are fast,
// offline, and deterministic.

import { test } from "@playwright/test";

test.describe("Add game modal", () => {
  test.fixme("opens when the Add game button is clicked", () => {});
  test.fixme("disables the Search button while the query is empty", () => {});
  test.fixme("triggers a search when Enter is pressed in the input", () => {});
  test.fixme("renders the search results returned from the API", () => {});
  test.fixme("shows 'No games found' when the search returns nothing", () => {});
  test.fixme("adding a game from the results places it in the Backlog column", () => {});
  test.fixme("closes via the ✕ button", () => {});
  test.fixme("closes when clicking the backdrop", () => {});
});
