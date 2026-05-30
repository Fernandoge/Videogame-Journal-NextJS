"use client";

// AddGameModal — search RAWG and add a game to the backlog.
// Search only fires when the user clicks the Search button or presses Enter —
// no automatic requests on keystroke.

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import type { RawgGame } from "@/lib/rawg";
import type { GameStatus, UserGameWithGame } from "@/lib/types";

type Props = {
  onGameAdded: (userGame: UserGameWithGame) => void;
};

export default function AddGameModal({ onGameAdded }: Props) {
  const [isOpen, setIsOpen]           = useState(false);
  const [query, setQuery]             = useState("");
  const [results, setResults]         = useState<RawgGame[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isAdding, setIsAdding]       = useState<number | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setError(null);
      setHasSearched(false);
    }
  }, [isOpen]);

  // Extracted into a named function so both the button and Enter key can call it.
  async function runSearch() {
    if (!query.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    setError(null);

    try {
      const res = await fetch(`/api/games/search?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      setResults(json.data ?? []);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  // Allow pressing Enter in the input to trigger the search.
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") runSearch();
  }

  async function handleAdd(game: RawgGame, status: GameStatus = "BACKLOG") {
    setIsAdding(game.id);
    setError(null);

    const res = await fetch("/api/user-games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawgId:      game.id,
        title:       game.name,
        coverUrl:    game.background_image,
        genre:       game.genres[0]?.name ?? null,
        releaseYear: game.released ? new Date(game.released).getFullYear() : null,
        status,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Failed to add game.");
    } else {
      onGameAdded(json.data);
      setIsOpen(false);
    }

    setIsAdding(null);
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
      >
        + Add game
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-24"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
              <h2 className="font-semibold text-white">Add a game</h2>
              <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-white">
                ✕
              </button>
            </div>

            {/* Search row — input + button side by side */}
            <div className="flex gap-2 p-4">
              <input
                ref={inputRef}
                type="text"
                placeholder="Search for a game…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              />
              <button
                onClick={runSearch}
                disabled={isSearching || !query.trim()}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSearching ? "Searching…" : "Search"}
              </button>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto px-4 pb-4">
              {isSearching && (
                <p className="text-center text-sm text-zinc-400">Searching…</p>
              )}

              {/* Only show "no results" after the user has actually searched */}
              {!isSearching && hasSearched && results.length === 0 && (
                <p className="text-center text-sm text-zinc-400">No games found.</p>
              )}

              {error && (
                <p className="mb-2 text-center text-sm text-red-400">{error}</p>
              )}

              <ul className="space-y-2">
                {results.map((game) => (
                  <li
                    key={game.id}
                    className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800 p-2"
                  >
                    <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded">
                      {game.background_image ? (
                        <Image
                          src={game.background_image}
                          alt={game.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-zinc-700 text-lg">
                          🎮
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{game.name}</p>
                      <p className="text-xs text-zinc-400">
                        {game.genres[0]?.name ?? "Unknown genre"}
                        {game.released && ` · ${new Date(game.released).getFullYear()}`}
                      </p>
                    </div>

                    <button
                      onClick={() => handleAdd(game)}
                      disabled={isAdding === game.id}
                      className="shrink-0 rounded bg-violet-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                    >
                      {isAdding === game.id ? "Adding…" : "Add"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
