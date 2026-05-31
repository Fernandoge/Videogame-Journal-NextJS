// app/api/user-games/route.ts
//
// GET  /api/user-games        — list the signed-in user's backlog
// POST /api/user-games        — add a game to their backlog

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// Zod schema for the POST body.
// z.object() describes the shape; each field declares its type and constraints.
// If the request body doesn't match this shape, Zod throws and we return 400.
const AddGameSchema = z.object({
  rawgId:      z.number().int().positive(),
  title:       z.string().min(1),
  coverUrl:    z.string().url().nullable(),
  genre:       z.string().nullable(),
  releaseYear: z.number().int().nullable(),
  // status defaults to BACKLOG if not provided
  status: z.enum(["PLAYING", "BACKLOG", "COMPLETED"]).default("BACKLOG"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ data: null, error: "Unauthorised" }, { status: 401 });
  }

  const userGames = await db.userGame.findMany({
    where:   { userId: session.user.id },
    // include: { game: true } fetches the related Game row in the same query.
    // Without this, `userGame.game` would be undefined.
    include: { game: true },
    orderBy: { addedAt: "desc" },
  });

  return Response.json({ data: userGames, error: null });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ data: null, error: "Unauthorised" }, { status: 401 });
  }

  // Parse and validate the request body with Zod.
  const body = await req.json();
  const parsed = AddGameSchema.safeParse(body);
  // safeParse returns { success: true, data } or { success: false, error }
  // instead of throwing, so we can return a clean 400 to the client.
  if (!parsed.success) {
    return Response.json(
      { data: null, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { rawgId, title, coverUrl, genre, releaseYear, status } = parsed.data;

  // upsert the Game row: create it if it doesn't exist, otherwise return the
  // existing one. This ensures two users adding the same game share one Game row.
  const game = await db.game.upsert({
    where:  { rawgId },
    update: {}, // don't overwrite anything if it already exists
    create: { rawgId, title, coverUrl, genre, releaseYear },
  });

  // Now create the UserGame (the backlog entry for this specific user).
  // If they somehow already have this game, return a friendly error.
  try {
    const userGame = await db.userGame.create({
      data: {
        userId: session.user.id,
        gameId: game.id,
        status,
      },
      include: { game: true, review: true },
    });

    return Response.json({ data: userGame, error: null }, { status: 201 });
  } catch (err: unknown) {
    // Prisma throws a P2002 error on unique constraint violations.
    // That's the @@unique([userId, gameId]) constraint — game already in backlog.
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return Response.json(
        { data: null, error: "This game is already in your backlog." },
        { status: 409 }
      );
    }
    console.error("[POST /api/user-games]", err);
    return Response.json({ data: null, error: "Failed to add game" }, { status: 500 });
  }
}
