# 7. API Routes

## What they are

API routes are server-side functions that handle HTTP requests. They live in
`app/api/` and are defined in `route.ts` files. They return data (usually JSON),
not HTML.

Think of them as the backend of your app, living in the same codebase as the
frontend.

---

## HTTP methods

Every HTTP request has a method that describes the intent:

| Method | Meaning | Example |
|--------|---------|---------|
| `GET` | Read data | Fetch a list of games |
| `POST` | Create something new | Add a game to backlog |
| `PATCH` | Update part of something | Change a game's status |
| `DELETE` | Remove something | Remove a game from backlog |
| `PUT` | Replace something entirely | (not used in this project) |

In a `route.ts` file, you export a function named after the method you want to handle:

```ts
export async function GET(req: Request) { ... }
export async function POST(req: Request) { ... }
```

---

## In this project: `app/api/user-games/route.ts`

```ts
// GET /api/user-games — returns the user's game list
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ data: null, error: "Unauthorised" }, { status: 401 })
  }

  const userGames = await db.userGame.findMany({
    where: { userId: session.user.id },
    include: { game: true },
  })

  return Response.json({ data: userGames, error: null })
}
```

`Response.json()` is the standard way to return JSON from a route handler. The
second argument sets HTTP options — `{ status: 401 }` sends a "Unauthorised"
status code so the client knows the request was rejected (not just empty data).

---

## The `{ data, error }` convention

Every API route in this project returns the same shape:

```ts
// Success
return Response.json({ data: result, error: null })

// Failure
return Response.json({ data: null, error: "Something went wrong" }, { status: 400 })
```

This consistency means every fetch call on the client side can follow the same
pattern:

```ts
const json = await res.json()
if (!res.ok) {
  setError(json.error)  // always a string
} else {
  doSomethingWith(json.data) // always the result
}
```

---

## Reading the request body — `POST` and `PATCH`

```ts
export async function POST(req: Request) {
  const body = await req.json()  // parse the JSON body
  // body is now a plain object — but we don't trust its shape yet
}
```

`req.json()` parses the raw request body. At this point, TypeScript types it as
`any` because we don't know yet what the client sent.

---

## Zod validation — `app/api/user-games/route.ts`

Zod is a schema validation library. It parses unknown data and either returns a
typed, validated result or a detailed error.

```ts
const AddGameSchema = z.object({
  rawgId:   z.number().int().positive(),
  title:    z.string().min(1),
  coverUrl: z.string().url().nullable(),
  status:   z.enum(["PLAYING", "BACKLOG", "COMPLETED"]).default("BACKLOG"),
})

const parsed = AddGameSchema.safeParse(body)

if (!parsed.success) {
  return Response.json(
    { data: null, error: parsed.error.flatten() },
    { status: 400 }
  )
}

// After this point, parsed.data is fully typed — TypeScript knows the shape
const { rawgId, title, coverUrl, status } = parsed.data
```

`safeParse` (vs `parse`) returns `{ success: true, data }` or
`{ success: false, error }` instead of throwing. This lets you return a clean
400 response instead of crashing the route handler.

---

## Authorisation vs Authentication

Both appear in every route — they're different things:

**Authentication** = "Who are you?"
```ts
const session = await auth()
if (!session?.user?.id) return Response.json({ error: "Unauthorised" }, { status: 401 })
```

**Authorisation** = "Are you allowed to do this?"
```ts
// In app/api/user-games/[id]/route.ts:
const existing = await db.userGame.findFirst({
  where: { id, userId: session.user.id }, // must belong to THIS user
})
if (!existing) return Response.json({ error: "Not found" }, { status: 404 })
```

Without the authorisation check, any signed-in user could delete another user's
games by guessing their ID. Authentication proves identity; authorisation checks
permission.

---

## Reading URL parameters

```ts
// URL: /api/user-games/clx123abc
// File: app/api/user-games/[id]/route.ts

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: RouteContext) {
  const { id } = await params  // "clx123abc"
}
```

Query parameters (e.g. `/api/games/search?q=elden`) are read differently:

```ts
// In app/api/games/search/route.ts:
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") ?? ""
}
```

`req.nextUrl.searchParams` is a `URLSearchParams` object. `.get("q")` returns
the value of `?q=...`, or `null` if it's not present. The `?? ""` is a
**nullish coalescing** operator — it returns `""` if the left side is null.

---

## HTTP status codes

The number in `{ status: 404 }` is the HTTP status code. Common ones:

| Code | Meaning | When to use |
|------|---------|-------------|
| 200 | OK | Default for successful GET/PATCH/DELETE |
| 201 | Created | Successful POST (something was created) |
| 400 | Bad Request | Invalid input (Zod validation failed) |
| 401 | Unauthorised | Not signed in |
| 404 | Not Found | Resource doesn't exist (or isn't yours) |
| 409 | Conflict | Duplicate (game already in backlog) |
| 500 | Internal Server Error | Something unexpected crashed |

---

## Try this

1. Open your browser DevTools (F12) → Network tab.
2. Navigate to your dashboard.
3. Click **+ Add game**, type a game name, and click **Search**.
4. In the Network tab, find the request to `/api/games/search?q=...`.
5. Click it — look at the Response tab to see the `{ data, error }` shape.
6. Also look at the Headers tab — notice the status code (200 if successful).

This is how you inspect API calls in a real app. You'll use this constantly when debugging.
