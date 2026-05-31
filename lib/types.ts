// lib/types.ts — shared TypeScript types used across server and client code.
//
// We define these here instead of importing from the Prisma generated client
// because the Prisma client is server-only. Client Components can import plain
// TypeScript types from anywhere, but not code that uses Node.js APIs.

export type GameStatus = "PLAYING" | "BACKLOG" | "COMPLETED" | "DROPPED";

export type Game = {
  id: string;
  rawgId: number;
  title: string;
  coverUrl: string | null;
  genre: string | null;
  releaseYear: number | null;
};

export type Review = {
  id: string;
  userGameId: string;
  score: number;
  body: string;
  createdAt: string; // serialised as a string when sent over the network via JSON
};

// A backlog entry — one game on one user's list.
export type UserGameWithGame = {
  id: string;
  userId: string;
  gameId: string;
  status: GameStatus;
  addedAt: string; // serialised as a string when sent over the network via JSON
  game: Game;
  review: Review | null;
};
