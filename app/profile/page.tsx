// app/profile/page.tsx — profile dashboard with stats (route: /profile).
//
// Pure Server Component — all stats are computed in one pass of DB queries
// on the server. No client state needed here; nothing is interactive.

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Image from "next/image";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const userId = session.user.id;

  // Run all queries in parallel with Promise.all — faster than awaiting them
  // one by one because they don't depend on each other.
  const [statusCounts, hoursResult, sessionCount, recentSessions, recentlyCompleted] =
    await Promise.all([

      // Count how many games the user has in each status bucket.
      db.userGame.groupBy({
        by: ["status"],
        where: { userId },
        _count: { _all: true },
      }),

      // Sum all hours logged across all play sessions for this user.
      // The nested `where` traverses the relation: PlaySession → UserGame → userId.
      db.playSession.aggregate({
        where: { userGame: { userId } },
        _sum: { hoursPlayed: true },
      }),

      // Total number of individual play sessions logged.
      db.playSession.count({
        where: { userGame: { userId } },
      }),

      // The 5 most recent play sessions, with game names for display.
      db.playSession.findMany({
        where: { userGame: { userId } },
        include: { userGame: { include: { game: true } } },
        orderBy: { date: "desc" },
        take: 5,
      }),

      // The 5 most recently completed games.
      db.userGame.findMany({
        where: { userId, status: "COMPLETED" },
        include: { game: true },
        orderBy: { addedAt: "desc" },
        take: 5,
      }),
    ]);

  // Build a lookup map from the groupBy result: { PLAYING: 2, BACKLOG: 5, ... }
  const countByStatus = Object.fromEntries(
    statusCounts.map((row) => [row.status, row._count._all])
  );

  const totalHours = hoursResult._sum.hoursPlayed ?? 0;
  const totalGames = Object.values(countByStatus).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">

      {/* User header */}
      <div className="flex items-center gap-4">
        {session.user?.image && (
          <Image
            src={session.user.image}
            alt={session.user?.name ?? "Avatar"}
            width={64}
            height={64}
            className="rounded-full"
          />
        )}
        <div>
          <h1 className="text-2xl font-bold text-white">{session.user?.name}</h1>
          <p className="text-sm text-zinc-400">{session.user?.email}</p>
        </div>
      </div>

      {/* Stats grid */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Overview
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total games"     value={totalGames} />
          <StatCard label="Hours played"    value={Math.round(totalHours * 10) / 10} unit="hrs" />
          <StatCard label="Sessions logged" value={sessionCount} />
          <StatCard label="Completed"       value={countByStatus["COMPLETED"] ?? 0} />
        </div>
      </section>

      {/* Status breakdown */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Backlog breakdown
        </h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {(["PLAYING", "BACKLOG", "COMPLETED", "DROPPED"] as const).map((s) => (
            <div key={s} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
              <p className="text-2xl font-bold text-white">{countByStatus[s] ?? 0}</p>
              <p className="mt-1 text-xs text-zinc-400 capitalize">{s.toLowerCase()}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* Recent sessions */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Recent sessions
          </h2>
          {recentSessions.length === 0 ? (
            <p className="text-sm text-zinc-500">No sessions logged yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentSessions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {s.userGame.game.title}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {/* toLocaleDateString formats the date nicely for the user's locale */}
                      {new Date(s.date).toLocaleDateString()}
                    </p>
                    {s.notes && (
                      <p className="mt-0.5 truncate text-xs text-zinc-400">{s.notes}</p>
                    )}
                  </div>
                  <span className="ml-4 shrink-0 text-sm font-semibold text-violet-400">
                    {s.hoursPlayed}h
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recently completed */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Recently completed
          </h2>
          {recentlyCompleted.length === 0 ? (
            <p className="text-sm text-zinc-500">No completed games yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentlyCompleted.map((ug) => (
                <li
                  key={ug.id}
                  className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"
                >
                  <div className="relative h-10 w-8 shrink-0 overflow-hidden rounded">
                    {ug.game.coverUrl ? (
                      <Image src={ug.game.coverUrl} alt={ug.game.title} fill className="object-cover" sizes="32px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-zinc-700 text-sm">🎮</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{ug.game.title}</p>
                    {ug.game.releaseYear && (
                      <p className="text-xs text-zinc-500">{ug.game.releaseYear}</p>
                    )}
                  </div>
                  <span className="ml-auto shrink-0 text-lg">✅</span>
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>
    </div>
  );
}

// Small reusable stat card — defined in the same file since it's only used here.
function StatCard({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-2xl font-bold text-white">
        {value}
        {unit && <span className="ml-1 text-base font-normal text-zinc-400">{unit}</span>}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}
