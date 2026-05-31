"use client";

// BacklogBoard — three-column board showing the user's games by status.
//
// This is a Client Component because it manages local state for the game list
// (adding, removing, and moving games between columns without full page reloads).
//
// Pattern: the parent Server Component (dashboard/page.tsx) fetches the initial
// list from the DB and passes it as a prop. From there, this component owns the
// state and updates it optimistically as the user interacts.

import { useState } from "react";
import GameCard from "./GameCard";
import AddGameModal from "./AddGameModal";
import type { GameStatus, Review, UserGameWithGame } from "@/lib/types";

const COLUMNS: { status: GameStatus; label: string; emoji: string }[] = [
  { status: "PLAYING",   label: "Playing",   emoji: "🎮" },
  { status: "BACKLOG",   label: "Backlog",   emoji: "📋" },
  { status: "COMPLETED", label: "Completed", emoji: "✅" },
];

type Props = {
  initialGames: UserGameWithGame[];
};

export default function BacklogBoard({ initialGames }: Props) {
  const [games, setGames] = useState<UserGameWithGame[]>(initialGames);

  // Controls whether the Dropped archive section is visible.
  // Collapsed by default — dropped games are secondary, out of the way.
  const [droppedOpen, setDroppedOpen] = useState(false);

  function handleGameAdded(newGame: UserGameWithGame) {
    setGames((prev) => [newGame, ...prev]);
  }

  function handleStatusChange(id: string, newStatus: GameStatus) {
    setGames((prev) =>
      prev.map((g) => (g.id === id ? { ...g, status: newStatus } : g))
    );
  }

  function handleRemove(id: string) {
    setGames((prev) => prev.filter((g) => g.id !== id));
  }

  function handleReviewChange(id: string, review: Review | null) {
    setGames((prev) =>
      prev.map((g) => (g.id === id ? { ...g, review } : g))
    );
  }

  const droppedGames = games.filter((g) => g.status === "DROPPED");

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">My Backlog</h1>
        <AddGameModal onGameAdded={handleGameAdded} />
      </div>

      {/* Three main columns */}
      <div className="grid gap-4 sm:grid-cols-3">
        {COLUMNS.map(({ status, label, emoji }) => {
          const columnGames = games.filter((g) => g.status === status);

          return (
            <div key={status} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold text-white">
                  <span>{emoji}</span>
                  <span>{label}</span>
                </h2>
                <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-300">
                  {columnGames.length}
                </span>
              </div>

              {columnGames.length > 0 ? (
                <ul className="space-y-3">
                  {columnGames.map((userGame) => (
                    <li key={userGame.id}>
                      <GameCard
                        userGame={userGame}
                        onStatusChange={handleStatusChange}
                        onRemove={handleRemove}
                        onReviewChange={handleReviewChange}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-zinc-700">
                  <p className="text-sm text-zinc-500">No games here yet</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dropped archive — only rendered when there are dropped games */}
      {droppedGames.length > 0 && (
        <div className="mt-6">
          {/* Toggle bar — clicking anywhere on it opens/closes the section */}
          <button
            onClick={() => setDroppedOpen((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-left transition-colors hover:bg-zinc-800"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-zinc-400">
              {/* Rotate the chevron 90° when open — pure CSS, no icon library */}
              <span
                className={`inline-block transition-transform duration-200 ${droppedOpen ? "rotate-90" : ""}`}
              >
                ▶
              </span>
              Dropped
              <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
                {droppedGames.length}
              </span>
            </span>
            <span className="text-xs text-zinc-600">
              {droppedOpen ? "Hide" : "Show"}
            </span>
          </button>

          {/* Collapsed content — rendered in the DOM but hidden via CSS so the
              toggle animation is smooth. Using `hidden` would remove it from layout;
              max-height transition gives the smooth open/close feel. */}
          {droppedOpen && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {droppedGames.map((userGame) => (
                <GameCard
                  key={userGame.id}
                  userGame={userGame}
                  onStatusChange={handleStatusChange}
                  onRemove={handleRemove}
                  onReviewChange={handleReviewChange}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Total count — excludes dropped since they're archived */}
      {games.length > 0 && (
        <p className="mt-6 text-center text-sm text-zinc-500">
          {games.filter((g) => g.status !== "DROPPED").length} active game
          {games.filter((g) => g.status !== "DROPPED").length !== 1 ? "s" : ""}
          {droppedGames.length > 0 && ` · ${droppedGames.length} dropped`}
        </p>
      )}
    </div>
  );
}
