# Videogame Journal — Project Context for Claude Code

## What this is
A gaming backlog tracker and review platform built with Next.js 14 (App Router).
This is also a learning project — the developer is learning Next.js, so all code
should be written with clear comments explaining WHY decisions are made, not just what.

## Tech stack
- Framework: Next.js 14 with App Router
- Language: TypeScript (strict mode)
- Database: PostgreSQL via Prisma ORM
- Auth: NextAuth.js v5 (Google + email/password)
- Styling: Tailwind CSS
- External APIs: RAWG Video Games Database
- Deployment target: Vercel

## Teaching rules (important)
- Always explain new Next.js concepts inline as comments when first introduced
- When using App Router patterns (Server Components, layouts, loading.tsx, etc.),
  add a short comment explaining what the file does and why it exists
- Prefer clarity over cleverness — no fancy one-liners if a longer form is clearer
- When making an architectural decision, leave a comment explaining the tradeoff

## Project structure conventions
- /app — all routes (App Router)
- /app/api — API route handlers
- /components — reusable UI components
- /lib — utilities, DB client, API wrappers
- /prisma — schema and migrations

## Current phase
Phase 1 MVP. Focus only on:
1. Auth (Google OAuth)
2. RAWG game search
3. Backlog board (three statuses: PLAYING, BACKLOG, COMPLETED)
4. Session logger modal
5. Profile dashboard with basic stats

Do NOT build Phase 2 features (social, goals, AI recommendations) yet.

## Database schema (source of truth)
User: id, email, name, image, createdAt
Game: id, rawgId, title, coverUrl, genre, releaseYear
UserGame: id, userId, gameId, status (PLAYING|BACKLOG|COMPLETED|DROPPED), addedAt
Session (play session): id, userGameId, hoursPlayed, notes, date
Review: id, userGameId, score (1-10), body, createdAt

## API conventions
- All API routes return { data, error } shaped responses
- Use Zod for input validation on all POST/PATCH routes
- RAWG calls happen server-side only (API key must never reach the client)