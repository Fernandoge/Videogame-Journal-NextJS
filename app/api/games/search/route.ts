// app/api/games/search/route.ts
//
// A thin server-side proxy to RAWG. The client hits this route; this route
// calls RAWG with the secret API key. The key never touches the browser.
//
// Route: GET /api/games/search?q=elden+ring

import { NextRequest } from "next/server";
import { searchGames } from "@/lib/rawg";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  // Only signed-in users can search — prevents anonymous abuse of the RAWG key.
  const session = await auth();
  if (!session) {
    return Response.json({ data: null, error: "Unauthorised" }, { status: 401 });
  }

  const query = req.nextUrl.searchParams.get("q") ?? "";

  if (!query.trim()) {
    return Response.json({ data: [], error: null });
  }

  try {
    const games = await searchGames(query);
    return Response.json({ data: games, error: null });
  } catch (err) {
    console.error("[/api/games/search]", err);
    return Response.json({ data: null, error: "Search failed" }, { status: 500 });
  }
}
