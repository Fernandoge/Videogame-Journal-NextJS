// lib/rawg.ts — server-side wrapper for the RAWG Video Games Database API.
//
// WHY server-side only? The RAWG API key must never be sent to the browser.
// If it were in client-side code, anyone could open DevTools, steal the key,
// and make unlimited requests under your account. All functions here use
// process.env directly, which only exists in Node.js (server), not the browser.
//
// Usage: import { searchGames } from "@/lib/rawg"
// Then call it inside a Server Component, a Server Action, or an API route.

const RAWG_BASE_URL = "https://api.rawg.io/api";

// The shape of a single game returned by the RAWG search endpoint.
// Defining this type here means TypeScript will catch typos when we
// access game fields anywhere in the app.
export type RawgGame = {
  id: number;
  name: string;
  background_image: string | null; // cover art URL — can be null for obscure games
  genres: { id: number; name: string }[];
  released: string | null; // ISO date string e.g. "2023-09-22", can be null
  rating: number; // 0–5 community rating from RAWG
};

// The shape of the full API response from /games?search=...
type RawgSearchResponse = {
  count: number;
  results: RawgGame[];
};

/**
 * Search for games by title using the RAWG API.
 * Returns up to `pageSize` results (default 10).
 *
 * Call this only from the server (Server Components, API routes, Server Actions).
 */
export async function searchGames(
  query: string,
  pageSize: number = 10
): Promise<RawgGame[]> {
  const apiKey = process.env.RAWG_API_KEY;

  // Fail loudly at startup if the key is missing rather than making silent
  // requests that return 401 errors at runtime.
  if (!apiKey) {
    throw new Error("RAWG_API_KEY is not set in environment variables.");
  }

  // URLSearchParams handles encoding special characters in the query string
  // (e.g. spaces become %20, & stays literal). Never build query strings by
  // hand with string concatenation — it breaks on special characters.
  const params = new URLSearchParams({
    key: apiKey,
    search: query,
    page_size: String(pageSize),
  });

  const response = await fetch(`${RAWG_BASE_URL}/games?${params}`, {
    // next.cache tells Next.js to cache this fetch result for 1 hour (3600 seconds).
    // The same search query won't hit RAWG again until the cache expires.
    // This is a Next.js 14 App Router feature — standard fetch() doesn't have it.
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    // Include the status code so debugging is easier.
    throw new Error(`RAWG API error: ${response.status} ${response.statusText}`);
  }

  const data: RawgSearchResponse = await response.json();
  return data.results;
}

/**
 * Fetch a single game by its RAWG ID.
 * Used when we need full details (description, platforms, etc.).
 */
export async function getGame(rawgId: number): Promise<RawgGame> {
  const apiKey = process.env.RAWG_API_KEY;

  if (!apiKey) {
    throw new Error("RAWG_API_KEY is not set in environment variables.");
  }

  const response = await fetch(
    `${RAWG_BASE_URL}/games/${rawgId}?key=${apiKey}`,
    {
      next: { revalidate: 86400 }, // cache individual game details for 24 hours
    }
  );

  if (!response.ok) {
    throw new Error(`RAWG API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
