// playwright/fixtures/rawg.ts — a deterministic stub for the RAWG-backed search.
//
// The "Add a game" modal searches by calling OUR endpoint /api/games/search, which
// proxies RAWG server-side (the API key never reaches the browser). In tests we
// intercept that endpoint IN THE BROWSER with page.route and return fixed JSON.
//
// Why mock it (see docs/learning/10-playwright-testing.md → "Network mocking"):
//   - speed: no real network round-trip
//   - determinism: RAWG's live results drift over time and would break assertions
//     that have nothing to do with our code
//   - no flakiness from rate limits / RAWG being down, and no API key needed in CI
// We mock the BOUNDARY (the search endpoint) and test the search-RESULTS UI — not
// RAWG's mapping logic, which belongs in a separate API/integration test.

import type { Page } from "@playwright/test";

// The minimal slice of RAWG's game shape the modal actually reads (see
// components/AddGameModal.tsx and lib/rawg `RawgGame`): id, name, genres[].name,
// released, background_image. We omit fields the UI ignores (e.g. `rating`).
export type RawgGameStub = {
  id: number;
  name: string;
  genres: { name: string }[];
  released: string | null;
  background_image: string | null;
};

// Ready-made results so specs don't re-declare the shape. background_image is null
// on purpose — a real URL would make next/image attempt an actual network fetch,
// reintroducing exactly the flakiness we're mocking away.
export const SAMPLE_GAMES: RawgGameStub[] = [
  { id: 1, name: "Hades", genres: [{ name: "Indie" }], released: "2020-09-17", background_image: null },
  { id: 2, name: "Celeste", genres: [{ name: "Platformer" }], released: "2018-01-25", background_image: null },
];

// Intercept /api/games/search and reply with `games` (default: SAMPLE_GAMES). Pass
// [] to exercise the modal's "No games found." empty state. The route is fulfilled
// in the browser, so the real handler — and RAWG — are never reached.
export async function mockGameSearch(
  page: Page,
  games: RawgGameStub[] = SAMPLE_GAMES,
): Promise<void> {
  // "**" globs the query string (?q=…) and any host/path prefix. The body mirrors
  // the real route's { data, error } shape (app/api/games/search/route.ts).
  await page.route("**/api/games/search**", (route) =>
    route.fulfill({ json: { data: games, error: null } }),
  );
}
