// app/api/play-sessions/[id]/route.ts
//
// DELETE /api/play-sessions/:id — delete a play session.

import { auth } from "@/auth";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ data: null, error: "Unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  // Verify ownership by joining through UserGame to User.
  // A user must not be able to delete someone else's session.
  const playSession = await db.playSession.findFirst({
    where: { id, userGame: { userId: session.user.id } },
  });

  if (!playSession) {
    return Response.json({ data: null, error: "Session not found." }, { status: 404 });
  }

  await db.playSession.delete({ where: { id } });

  return Response.json({ data: { id }, error: null });
}
