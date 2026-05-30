# 6. Data Fetching

## The two places data can be fetched

In Next.js 14 there are two places you fetch data, and they work very differently.

| | Server Component | Client Component |
|---|---|---|
| How | `await db.xxx()` or `await fetch()` directly | `fetch()` inside `useEffect` or an event handler |
| Runs on | Server | Browser |
| Can access | Database directly, secret env vars | Only public API routes |
| When | At request time (before HTML is sent) | After the page loads in the browser |

---

## Server-side fetching — `app/profile/page.tsx`

This is the cleanest pattern. The component is `async`, so you `await` data
directly at the top.

```tsx
export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const [statusCounts, hoursResult, sessionCount, recentSessions, recentlyCompleted] =
    await Promise.all([
      db.userGame.groupBy({ ... }),
      db.playSession.aggregate({ ... }),
      db.playSession.count({ ... }),
      db.playSession.findMany({ ... }),
      db.userGame.findMany({ ... }),
    ])

  return <div>... render the data ...</div>
}
```

By the time this page's HTML reaches the browser, all five queries are done and
the data is baked into the HTML. The user sees real content immediately — no
loading spinners, no skeleton screens.

### `Promise.all` — parallel queries

```tsx
// SLOW — queries run one after another: 20ms + 15ms + 10ms = 45ms total
const counts = await db.userGame.groupBy(...)
const hours  = await db.playSession.aggregate(...)
const count  = await db.playSession.count(...)

// FAST — all three run at the same time: max(20ms, 15ms, 10ms) = 20ms total
const [counts, hours, count] = await Promise.all([
  db.userGame.groupBy(...),
  db.playSession.aggregate(...),
  db.playSession.count(...),
])
```

Use `Promise.all` any time you have independent queries. The total wait is the
slowest query, not the sum of all queries.

---

## The server-fetches / client-mutates pattern — `app/dashboard/page.tsx`

Some pages need both: initial data from the server (fast first load) AND the
ability to update that data without a full page reload (interactivity).

The solution: split it across two components.

```tsx
// app/dashboard/page.tsx — Server Component
// Runs on the server, fetches data, passes it as props
export default async function DashboardPage() {
  const rawGames = await db.userGame.findMany({ include: { game: true } })
  return <BacklogBoard initialGames={games} />
  //                   ^^^^^^^^^^^^^^^^^^^^
  //                   data "injected" from server into client
}
```

```tsx
// components/BacklogBoard.tsx — Client Component
// Receives the initial data, then owns it in useState
export default function BacklogBoard({ initialGames }: Props) {
  const [games, setGames] = useState(initialGames)
  //            ^^^^^^^^^
  //            from here, the client owns the data
}
```

The page loads with real data (server-rendered). After that, all changes happen
client-side: adding a game calls an API route and updates `games` via `setGames`
— no page reload needed.

---

## Client-side fetching — `components/AddGameModal.tsx`

When you click Search, the modal calls the API route from the browser:

```tsx
async function runSearch() {
  const res = await fetch(`/api/games/search?q=${encodeURIComponent(query)}`)
  const json = await res.json()
  setResults(json.data ?? [])
}
```

This `fetch()` is the standard browser `fetch` API. It hits our Next.js API
route at `/api/games/search`, which in turn calls RAWG server-side. The browser
never touches RAWG directly.

### Why go through our API route?
The RAWG API key is a secret. If the browser called RAWG directly, the key would
be visible in DevTools. Our route acts as a proxy — the browser calls our server,
our server calls RAWG, our server returns the results.

---

## Next.js extended fetch cache — `lib/rawg.ts`

Next.js extends the native `fetch` with a `next` option for server-side caching:

```ts
const response = await fetch(`${RAWG_BASE_URL}/games?${params}`, {
  next: { revalidate: 3600 } // cache this response for 1 hour
})
```

If the same URL is fetched again within 3600 seconds, Next.js returns the cached
response without making a new network request. This happens entirely on the
server — the browser never knows.

`revalidate: 0` = never cache (always fresh)
`revalidate: 3600` = cache for 1 hour
`revalidate: 86400` = cache for 24 hours (used for individual game details)

---

## Loading and error states

When fetching client-side, you need to handle the time between "request sent"
and "response received." This is the `isSearching` / `isAdding` pattern in
the modals:

```tsx
async function runSearch() {
  setIsSearching(true)    // show "Searching…" in UI
  try {
    const res = await fetch(...)
    setResults(await res.json())
  } catch {
    setResults([])
  } finally {
    setIsSearching(false) // always reset, even if it errored
  }
}
```

`finally` runs whether the `try` succeeded or threw. Without it, `isSearching`
would stay `true` forever if the request failed.

---

## Try this

1. Open `app/profile/page.tsx`.
2. Change `Promise.all([...])` to sequential awaits instead:
   ```ts
   const statusCounts = await db.userGame.groupBy(...)
   const hoursResult  = await db.playSession.aggregate(...)
   // etc.
   ```
3. The page still works, but now the queries run in series. On a real production
   server with network latency, this would be noticeably slower.
4. Change it back to `Promise.all`.
