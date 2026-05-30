"use client";

// GameCard — displays one game in a backlog column.
// It's a Client Component because it has interactive buttons (status change, delete).

import Image from "next/image";
import { useState } from "react";
import type { GameStatus, UserGameWithGame } from "@/lib/types";
import LogSessionModal from "./LogSessionModal";

const STATUS_LABELS: Record<GameStatus, string> = {
  PLAYING:   "Playing",
  BACKLOG:   "Backlog",
  COMPLETED: "Completed",
  DROPPED:   "Dropped",
};

// The statuses a user can move a game to (excluding the current one).
const ALL_STATUSES: GameStatus[] = ["PLAYING", "BACKLOG", "COMPLETED", "DROPPED"];

type Props = {
  userGame: UserGameWithGame;
  onStatusChange: (id: string, status: GameStatus) => void;
  onRemove: (id: string) => void;
};

export default function GameCard({ userGame, onStatusChange, onRemove }: Props) {
  const { game, status, id } = userGame;
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleStatusChange(newStatus: GameStatus) {
    if (newStatus === status) return;
    setIsUpdating(true);

    const res = await fetch(`/api/user-games/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.ok) {
      // Notify the parent (BacklogBoard) so it can move the card to the new column.
      onStatusChange(id, newStatus);
    }
    setIsUpdating(false);
  }

  async function handleRemove() {
    setIsUpdating(true);
    const res = await fetch(`/api/user-games/${id}`, { method: "DELETE" });
    if (res.ok) {
      onRemove(id);
    }
    setIsUpdating(false);
  }

  return (
    <div className={`rounded-lg border border-zinc-700 bg-zinc-800 p-3 transition-opacity ${isUpdating ? "opacity-50" : ""}`}>
      <div className="flex gap-3">
        {/* Cover art */}
        <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded">
          {game.coverUrl ? (
            <Image
              src={game.coverUrl}
              alt={game.title}
              fill
              className="object-cover"
              // sizes tells next/image how wide the image actually renders,
              // so it generates the right-sized file. 48px = w-12 in Tailwind.
              sizes="48px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-700 text-xl">
              🎮
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{game.title}</p>
          {game.genre && (
            <p className="truncate text-xs text-zinc-400">{game.genre}</p>
          )}
          {game.releaseYear && (
            <p className="text-xs text-zinc-500">{game.releaseYear}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center justify-between gap-2">
        {/* Status dropdown */}
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value as GameStatus)}
          disabled={isUpdating}
          className="flex-1 rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 outline-none focus:ring-1 focus:ring-violet-500 disabled:cursor-not-allowed"
        >
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          {/* Log session button — opens the LogSessionModal */}
          <LogSessionModal userGameId={id} gameTitle={game.title} />

          {/* Remove button */}
          <button
            onClick={handleRemove}
            disabled={isUpdating}
            title="Remove from backlog"
            className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-red-400 disabled:cursor-not-allowed"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}
