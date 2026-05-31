// app/api/reviews/[id]/route.ts
//
// DELETE /api/reviews/[id] — delete a review by its ID.

import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ data: null, error: "Unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  // Find the review and confirm it belongs to this user by joining through UserGame.
  const review = await db.review.findFirst({
    where: { id, userGame: { userId: session.user.id } },
  });

  if (!review) {
    return Response.json({ data: null, error: "Review not found." }, { status: 404 });
  }

  await db.review.delete({ where: { id } });

  return Response.json({ data: null, error: null }, { status: 200 });
}
