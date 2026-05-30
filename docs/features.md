# Videogame Journal — Features

UI and feature reference. For infrastructure setup see `docs/project-setup.md`.

---

## Table of contents
1. [Layout and auth UI](#1-layout-and-auth-ui)
2. [Backlog board](#2-backlog-board)
3. [Session logger modal](#3-session-logger-modal)
4. [Profile dashboard](#4-profile-dashboard)

---

## 1. Layout and auth UI

### Files
| File | What it does |
|------|-------------|
| `app/globals.css` | Forced dark theme (`zinc-950` background) |
| `app/layout.tsx` | Root layout — includes `<Navbar />` on every page |
| `components/Navbar.tsx` | Server Component — shows avatar + nav links when signed in |
| `components/SignOutButton.tsx` | Client Component — the interactive sign-out button |
| `app/signin/page.tsx` | Custom sign-in page with Google button (Server Action) |
| `app/page.tsx` | Landing page — redirects to `/dashboard` if already signed in |
| `next.config.mjs` | Whitelists Google and RAWG image CDN domains |
| `auth.ts` | Added `pages: { signIn: "/signin" }` to use our custom page |

### Server Components vs Client Components

**Server Components** (the default — no directive needed):
- Render on the server; browser gets finished HTML.
- Can be `async` — `await` DB calls and `auth()` directly.
- Cannot use `onClick`, `useState`, `useEffect`, or browser APIs.

**Client Components** (`"use client"` at the top):
- Hydrate in the browser after the initial server render.
- Can use event handlers, hooks, and browser APIs.
- Their JS is included in the bundle sent to the browser.

**The key rule:** keep things Server Components by default. Only add `"use client"`
when you genuinely need interactivity.

```
Navbar.tsx              ← Server Component (calls auth(), no interactivity)
  └── SignOutButton.tsx ← Client Component (needs onClick)
```

### Server Actions
The sign-in form uses a Server Action — an async function with `"use server"` inside
a Server Component. The form POSTs to the server; no API route needed.

```tsx
<form action={async () => {
  "use server";
  await signIn("google", { redirectTo: "/dashboard" });
}}>
```

### Route protection pattern
```tsx
export default async function ProtectedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  // rest of the page...
}
```

### `next/image` vs `<img>`
Always use `<Image />` from `next/image`. It auto-resizes, converts to WebP, and
lazy-loads. Remote hostnames must be whitelisted in `next.config.mjs`.

---

## 2. Backlog board

### Files
| File | What it does |
|------|-------------|
| `lib/types.ts` | Shared TS types safe to import in Client Components |
| `app/api/games/search/route.ts` | GET — RAWG search proxy, keeps API key server-side |
| `app/api/user-games/route.ts` | GET (list backlog) + POST (add game) |
| `app/api/user-games/[id]/route.ts` | PATCH (change status) + DELETE (remove) |
| `components/BacklogBoard.tsx` | Client Component — three-column board |
| `components/GameCard.tsx` | Client Component — single game card |
| `components/AddGameModal.tsx` | Client Component — RAWG search + add modal |
| `app/dashboard/page.tsx` | Server Component — fetches initial data, passes to board |

### The server-fetches / client-mutates pattern
```
DashboardPage (Server Component)
  └── fetches games from DB on the server
  └── passes them as props to BacklogBoard (Client Component)
        └── useState owns the list from here on
        └── fetch() calls API routes to mutate data
        └── local state updates instantly — no page reload
```

### API route conventions
Every route returns `{ data, error }`:
```ts
// Success: { data: <result>, error: null }
// Failure: { data: null,    error: "message" }
```

### Zod validation
```ts
const Schema = z.object({ status: z.enum(["PLAYING", "BACKLOG", "COMPLETED", "DROPPED"]) })
const parsed = Schema.safeParse(body)
if (!parsed.success) return Response.json({ data: null, error: parsed.error.flatten() }, { status: 400 })
```
`safeParse` returns `{ success, data/error }` instead of throwing — lets us return
a clean 400 without crashing the route handler.

### Debouncing search input
```ts
useEffect(() => {
  const timer = setTimeout(() => { /* fetch */ }, 400)
  return () => clearTimeout(timer) // cancel if query changes before 400ms
}, [query])
```
Without debounce, every keystroke fires an API request. The cleanup function
cancels the pending timer before the next effect runs.

### `upsert` when adding a game
```ts
const game = await db.game.upsert({
  where:  { rawgId },
  update: {},
  create: { rawgId, title, coverUrl, genre, releaseYear },
})
```
Two users adding the same game share one `Game` row. `upsert` creates it the
first time and silently returns the existing row every time after.

### Dropped games — collapsible archive section
Dropped games don't appear in the three main columns. A "Dropped (X)" toggle bar
appears below the board when at least one game is dropped. Collapsed by default —
out of the way but still accessible.

```
[ Playing ]  [ Backlog ]  [ Completed ]

▶ Dropped  3                         Show   ← click to expand
```

The footer count separates active from dropped:
`4 active games · 2 dropped`

### `lib/types.ts` — why separate types?
`PrismaClient` is server-only (imports Node.js APIs). But plain TypeScript types
are just annotations — they vanish at runtime and are safe in Client Components.
We mirror the Prisma shape in `lib/types.ts` so client code has full type safety.

---

## 3. Session logger modal

### Files
| File | What it does |
|------|-------------|
| `app/api/play-sessions/route.ts` | POST — create a play session |
| `components/LogSessionModal.tsx` | Client Component — form modal with hours/date/notes |
| `components/GameCard.tsx` | Updated to include the ⏱ button |

### How it works
A ⏱ button on each GameCard opens the modal. The form takes:
- **Hours played** (required, 0.1–24)
- **Date** (optional, defaults to today)
- **Notes** (optional, max 500 chars)

On submit, it POSTs to `/api/play-sessions`. The API verifies the `UserGame`
belongs to the signed-in user before writing (authorisation check).

### Why verify ownership in the API?
```ts
const userGame = await db.userGame.findFirst({
  where: { id: userGameId, userId: session.user.id },
})
if (!userGame) return Response.json({ error: "Not found" }, { status: 404 })
```
Without this, any signed-in user could log sessions against another user's games
by guessing their `userGameId`. Always verify ownership before writing.

### Date handling: client → API → DB
The `<input type="date">` gives a `YYYY-MM-DD` string.
The API expects a full ISO datetime (`z.string().datetime()`).
The component converts: `new Date(date + "T12:00:00Z").toISOString()`.
The DB stores a `DateTime`. This chain is explicit at every step.

---

## 4. Profile dashboard

### Files
| File | What it does |
|------|-------------|
| `app/profile/page.tsx` | Server Component — stats computed in parallel DB queries |
| `components/Navbar.tsx` | Updated to include "Profile" link |

### Stats displayed
- Total games in backlog
- Total hours played (summed across all play sessions)
- Total sessions logged
- Games completed
- Status breakdown (Playing / Backlog / Completed / Dropped counts)
- 5 most recent play sessions
- 5 most recently completed games

### `Promise.all` for parallel queries
```ts
const [statusCounts, hoursResult, sessionCount, recentSessions, recentlyCompleted] =
  await Promise.all([
    db.userGame.groupBy(...),
    db.playSession.aggregate(...),
    db.playSession.count(...),
    db.playSession.findMany(...),
    db.userGame.findMany(...),
  ])
```
All five queries run at the same time. Total wait = the slowest query, not the
sum of all queries. Always use `Promise.all` for independent DB calls.

### `groupBy` for status counts
```ts
const statusCounts = await db.userGame.groupBy({
  by: ["status"],
  where: { userId },
  _count: { _all: true },
})
// → [{ status: "PLAYING", _count: { _all: 2 } }, ...]
```
`groupBy` is a single query that groups rows by a column and counts them —
equivalent to `SELECT status, COUNT(*) FROM user_games GROUP BY status`.

### Traversing relations in a `where` clause
```ts
db.playSession.aggregate({
  where: { userGame: { userId } },  // PlaySession → UserGame → userId
  _sum: { hoursPlayed: true },
})
```
Prisma lets you filter through relations by nesting the related model's fields
inside the `where`. No manual JOIN needed.
