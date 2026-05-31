"use client";

// GameDetailActions — the interactive strip on the game detail page.
//
// Everything on /games/[id] that needs user interaction lives here.
// The parent (page.tsx) is a Server Component and can't run client code directly,
// so we isolate only the interactive parts into this Client Component.
//
// After any mutation (status change, session logged, review saved/deleted) we call
// router.refresh(). That re-runs the Server Component, fetches fresh data from the
// DB, and passes updated props back down — so the sessions list and review always
// reflect the real state without us managing a local copy.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GameStatus, Review } from "@/lib/types";
import LogSessionModal from "./LogSessionModal";
import ReviewModal from "./ReviewModal";

const STATUS_LABELS: Record<GameStatus, string> = {
  PLAYING:   "Playing",
  BACKLOG:   "Backlog",
  COMPLETED: "Completed",
  DROPPED:   "Dropped",
};

const ALL_STATUSES: GameStatus[] = ["PLAYING", "BACKLOG", "COMPLETED", "DROPPED"];

type Props = {
  userGameId:     string;
  gameTitle:      string;
  currentStatus:  GameStatus;
  existingReview: Review | null;
};

export default function GameDetailActions({
  userGameId,
  gameTitle,
  currentStatus,
  existingReview,
}: Props) {
  const router = useRouter();
  // Track the status locally so the select updates instantly before the refresh lands.
  const [status, setStatus] = useState<GameStatus>(currentStatus);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  async function handleStatusChange(newStatus: GameStatus) {
    if (newStatus === status) return;
    setIsChangingStatus(true);
    setStatus(newStatus); // optimistic update

    const res = await fetch(`/api/user-games/${userGameId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!res.ok) {
      // Revert the optimistic update if the request failed.
      setStatus(status);
    }

    setIsChangingStatus(false);
    // Refresh the Server Component so the page header reflects the new status.
    router.refresh();
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {/* Status select */}
      <select
        value={status}
        onChange={(e) => handleStatusChange(e.target.value as GameStatus)}
        disabled={isChangingStatus}
        className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-violet-500 disabled:cursor-not-allowed"
      >
        {ALL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>

      {/* Log a session — uses the existing LogSessionModal.
          onSessionLogged fires after a successful save; router.refresh() re-fetches
          the sessions list from the server. */}
      <LogSessionModal
        userGameId={userGameId}
        gameTitle={gameTitle}
        onSessionLogged={() => router.refresh()}
      />

      {/* Write / edit review */}
      <ReviewModal
        userGameId={userGameId}
        gameTitle={gameTitle}
        existingReview={existingReview}
        onReviewSaved={(_saved) => router.refresh()}
        onReviewDeleted={() => router.refresh()}
      />
    </div>
  );
}
