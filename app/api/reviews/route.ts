// app/api/reviews/route.ts
//
// POST /api/reviews — create or update the user's review for a game.
//
// Because the schema enforces one review per UserGame (@unique on userGameId),
// we use Prisma's upsert: if a review already exists it gets updated, otherwise
// a new one is created. This means the same endpoint handles both "write review"
// and "edit review" from the client — no need for a separate PATCH route.

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const ReviewSchema = z.object({
  userGameId: z.string().min(1),
  // score must be a whole number between 1 and 10 — the DB stores it as Int.
  score: z.number().int().min(1).max(10),
  body: z.string().min(1, "Review body cannot be empty.").max(2000),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ data: null, error: "Unauthorised" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.flatten() }, { status: 400 });
  }

  const { userGameId, score, body: reviewBody } = parsed.data;

  // Verify the UserGame belongs to this user before writing.
  // Without this check, a user could write a review for someone else's game.
  const userGame = await db.userGame.findFirst({
    where: { id: userGameId, userId: session.user.id },
  });

  if (!userGame) {
    return Response.json({ data: null, error: "Game not found in your backlog." }, { status: 404 });
  }

  // upsert: create a new review if none exists, update it if one already does.
  const review = await db.review.upsert({
    where:  { userGameId },
    create: { userGameId, score, body: reviewBody },
    update: { score, body: reviewBody },
  });

  return Response.json({ data: review, error: null }, { status: 200 });
}
