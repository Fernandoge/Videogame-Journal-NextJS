// app/api/user-games/[id]/route.ts
//
// PATCH  /api/user-games/:id  — update a game's status
// DELETE /api/user-games/:id  — remove a game from the backlog
//
// The [id] folder name is a dynamic segment — Next.js passes whatever is in
// the URL as params.id. e.g. /api/user-games/clx123 → params.id = "clx123"

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const UpdateStatusSchema = z.object({
  status: z.enum(["PLAYING", "BACKLOG", "COMPLETED", "DROPPED"]),
});

// params is typed as a Promise in Next.js 14+ dynamic routes.
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ data: null, error: "Unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  const body = await req.json();
  const parsed = UpdateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.flatten() }, { status: 400 });
  }

  // Verify the UserGame exists AND belongs to the signed-in user before updating.
  // Without this check, any signed-in user could change anyone else's game status.
  const existing = await db.userGame.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return Response.json({ data: null, error: "Not found" }, { status: 404 });
  }

  const updated = await db.userGame.update({
    where:   { id },
    data:    { status: parsed.data.status },
    include: { game: true },
  });

  return Response.json({ data: updated, error: null });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ data: null, error: "Unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.userGame.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return Response.json({ data: null, error: "Not found" }, { status: 404 });
  }

  await db.userGame.delete({ where: { id } });

  return Response.json({ data: { id }, error: null });
}
