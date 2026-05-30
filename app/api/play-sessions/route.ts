// app/api/play-sessions/route.ts
//
// POST /api/play-sessions — log a play session for a game in the user's backlog.

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const CreateSessionSchema = z.object({
  userGameId:  z.string().min(1),
  hoursPlayed: z.number().positive().max(24), // 24h max per session is a reasonable guard
  notes:       z.string().max(500).optional(),
  // date is optional — defaults to now if not provided.
  // We accept an ISO string from the client (Date objects can't travel over JSON).
  date: z.string().datetime({ offset: true }).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ data: null, error: "Unauthorised" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = CreateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.flatten() }, { status: 400 });
  }

  const { userGameId, hoursPlayed, notes, date } = parsed.data;

  // Verify the UserGame belongs to this user before writing.
  const userGame = await db.userGame.findFirst({
    where: { id: userGameId, userId: session.user.id },
  });

  if (!userGame) {
    return Response.json({ data: null, error: "Game not found in your backlog." }, { status: 404 });
  }

  const playSession = await db.playSession.create({
    data: {
      userGameId,
      hoursPlayed,
      notes,
      date: date ? new Date(date) : new Date(),
    },
  });

  return Response.json({ data: playSession, error: null }, { status: 201 });
}
