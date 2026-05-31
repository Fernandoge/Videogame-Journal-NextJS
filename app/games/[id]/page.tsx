// app/games/[id]/page.tsx — game detail page (route: /games/:userGameId).
//
// The [id] here is the UserGame id, not the Game id.
// Why? Because this page is personal — it shows YOUR sessions, YOUR review,
// YOUR status. Two users can have the same game but completely different detail pages.
//
// This is a Server Component: it fetches everything in one DB query on the server,
// then renders the static parts (cover, sessions list, review text) directly as HTML.
// Only the interactive controls are delegated to a Client Component (GameDetailActions).

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import Image from "next/image";
import Link from "next/link";
import GameDetailActions from "@/components/GameDetailActions";
import DeleteSessionButton from "@/components/DeleteSessionButton";
import type { GameStatus, Review } from "@/lib/types";
import { formatPlayTime } from "@/lib/format";

// Next.js passes route segment params as a Promise in the App Router.
// We await them inside the component.
type Props = { params: Promise<{ id: string }> };

export default async function GameDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const { id } = await params;

  // One query to get the UserGame plus all its related data.
  // include: { game, sessions, review } fetches the related rows in the same round-trip.
  const userGame = await db.userGame.findFirst({
    where:   { id, userId: session.user.id },
    include: {
      game:     true,
      sessions: { orderBy: { date: "desc" } }, // newest session first
      review:   true,
    },
  });

  // notFound() renders Next.js's built-in 404 page.
  // We use it (rather than redirect) because the resource genuinely doesn't exist.
  if (!userGame) notFound();

  const { game, sessions, review, status } = userGame;

  const totalHours = sessions.reduce((sum, s) => sum + s.hoursPlayed, 0);

  // Serialise the review's Date fields to strings for the Client Component.
  // Client Components can't receive Date objects as props — they don't survive JSON.
  const reviewForClient: Review | null = review
    ? { ...review, createdAt: review.createdAt.toISOString() }
    : null;

  return (
    <div className="space-y-8">

      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-white"
      >
        ← Back to backlog
      </Link>

      {/* Hero: cover + game info side by side */}
      <div className="flex gap-6">

        {/* Cover art — larger than the card thumbnail */}
        <div className="relative h-48 w-36 shrink-0 overflow-hidden rounded-xl">
          {game.coverUrl ? (
            <Image
              src={game.coverUrl}
              alt={game.title}
              fill
              className="object-cover"
              // sizes tells next/image how wide this slot actually renders so it
              // picks the right file size — 144px = w-36 in Tailwind.
              sizes="144px"
              // priority loads this image eagerly; it's above the fold.
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-4xl">
              🎮
            </div>
          )}
        </div>

        {/* Info column */}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{game.title}</h1>

          {/* Genre and release year */}
          <p className="mt-1 text-sm text-zinc-400">
            {[game.genre, game.releaseYear].filter(Boolean).join(" · ")}
          </p>

          {/* Interactive controls: status select, log session, review */}
          {/* GameDetailActions is a Client Component — see components/GameDetailActions.tsx */}
          <GameDetailActions
            userGameId={userGame.id}
            gameTitle={game.title}
            currentStatus={status as GameStatus}
            existingReview={reviewForClient}
          />

          {/* Stats row — at-a-glance numbers */}
          <div className="mt-5 flex flex-wrap gap-5">
            <Stat label="Total hours"  value={formatPlayTime(totalHours)} />
            <Stat label="Sessions"     value={String(sessions.length)} />
            {review && (
              <Stat label="Your score" value={`${review.score} / 10`} highlight />
            )}
          </div>
        </div>
      </div>

      {/* ── Play sessions ─────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Play sessions
        </h2>

        {sessions.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No sessions logged yet. Hit the ⏱ button above to log one.
          </p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500">
                    {new Date(s.date).toLocaleDateString(undefined, {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </p>
                  {s.notes && (
                    <p className="mt-0.5 text-sm text-zinc-300">{s.notes}</p>
                  )}
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold text-violet-400">
                    {formatPlayTime(s.hoursPlayed)}
                  </span>
                  <DeleteSessionButton sessionId={s.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Your review ───────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Your review
        </h2>

        {review ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed text-zinc-200">{review.body}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  Written {new Date(review.createdAt).toLocaleDateString(undefined, {
                    year: "numeric", month: "short", day: "numeric",
                  })}
                </p>
              </div>
              {/* Score badge */}
              <div className="shrink-0 rounded-xl bg-violet-600 px-3 py-2 text-center">
                <p className="text-2xl font-bold leading-none text-white">{review.score}</p>
                <p className="text-xs text-violet-200">/10</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            No review yet. Hit the ✍ button above to write one.
          </p>
        )}
      </section>

    </div>
  );
}

// Small inline label + value display — only used on this page so defined here.
function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className={`text-lg font-bold ${highlight ? "text-violet-400" : "text-white"}`}>
        {value}
      </p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}
