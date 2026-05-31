// app/dashboard/page.tsx — the backlog board (route: /dashboard).
//
// Server Component: fetches the user's games from the DB on the server,
// then passes them as props to the BacklogBoard Client Component.
//
// WHY split it this way?
//   - Database access must stay on the server (security + performance).
//   - The board needs client-side state to add/move/remove cards without reloads.
//   - Solution: server fetches the initial data, client owns it from there.

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import BacklogBoard from "@/components/BacklogBoard";
import type { UserGameWithGame } from "@/lib/types";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  // Fetch this user's full backlog with the related game and review data.
  const rawGames = await db.userGame.findMany({
    where:   { userId: session.user.id },
    include: { game: true, review: true },
    orderBy: { addedAt: "desc" },
  });

  // Prisma returns Date objects; JSON serialisation converts them to strings.
  // We do the conversion explicitly here so TypeScript is happy with our
  // UserGameWithGame type (which uses string for dates).
  const games: UserGameWithGame[] = rawGames.map((ug) => ({
    ...ug,
    addedAt: ug.addedAt.toISOString(),
    review: ug.review
      ? { ...ug.review, createdAt: ug.review.createdAt.toISOString() }
      : null,
  }));

  return <BacklogBoard initialGames={games} />;
}
