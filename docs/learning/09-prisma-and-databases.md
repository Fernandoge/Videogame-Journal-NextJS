# 9. Prisma and Databases

## What an ORM is

An ORM (Object-Relational Mapper) lets you talk to a database using your
programming language instead of raw SQL. Prisma is the ORM in this project.

```ts
// Without Prisma — raw SQL
const result = await client.query(
  "SELECT * FROM user_games WHERE user_id = $1 AND status = $2",
  [userId, "PLAYING"]
)

// With Prisma — typed TypeScript
const result = await db.userGame.findMany({
  where: { userId, status: "PLAYING" }
})
// result is automatically typed as UserGame[]
```

The Prisma version is not only shorter — TypeScript knows the exact shape of
`result`, so you get autocomplete and type errors on every field.

---

## The schema — `prisma/schema.prisma`

The schema is the single source of truth for your database structure. Every
model becomes a table; every field becomes a column.

```prisma
model UserGame {
  id      String     @id @default(cuid())
  userId  String
  gameId  String
  status  GameStatus @default(BACKLOG)
  addedAt DateTime   @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  game Game @relation(fields: [gameId], references: [id], onDelete: Cascade)

  @@unique([userId, gameId])
}
```

### Field types
`String`, `Int`, `Float`, `Boolean`, `DateTime` map to database column types.

### Decorators
- `@id` — primary key
- `@default(cuid())` — auto-generate a unique ID when a row is created
- `@default(now())` — auto-set to current timestamp
- `@unique` — no two rows can have the same value in this column
- `@@unique([a, b])` — the *combination* of a+b must be unique

### Relations
```prisma
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
```
This says: `userId` in this table is a foreign key pointing to `id` in the
`User` table. `onDelete: Cascade` means when a User is deleted, all their
UserGame rows delete automatically.

---

## The client singleton — `lib/db.ts`

```ts
import { PrismaClient } from "@/app/generated/prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const db = globalForPrisma.prisma ?? new PrismaClient({ log: ["query"] })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db
}
```

You import `db` everywhere. You never call `new PrismaClient()` again.

The `log: ["query"]` line prints every SQL query to your terminal in development.
This is useful for seeing exactly what SQL Prisma generates — open your terminal
while using the app and watch the queries appear.

---

## CRUD operations

CRUD stands for Create, Read, Update, Delete — the four basic database operations.

### Create
```ts
// Create one row
const session = await db.playSession.create({
  data: { userGameId, hoursPlayed, notes, date }
})

// Create or update — create if not found, skip update if found
const game = await db.game.upsert({
  where:  { rawgId },
  update: {},
  create: { rawgId, title, coverUrl, genre, releaseYear },
})
```

### Read
```ts
// Find one row (returns null if not found)
const user = await db.user.findUnique({ where: { id: "clx123" } })

// Find one row matching conditions (returns null if not found)
const userGame = await db.userGame.findFirst({
  where: { id, userId: session.user.id }
})

// Find all matching rows
const games = await db.userGame.findMany({
  where:   { userId },
  orderBy: { addedAt: "desc" },
  take:    5,       // LIMIT 5
})
```

### Update
```ts
const updated = await db.userGame.update({
  where: { id },
  data:  { status: "COMPLETED" },
})
```

### Delete
```ts
await db.userGame.delete({ where: { id } })
```

---

## Relations — `include` and nested `where`

### `include` — fetch related rows in the same query
```ts
const games = await db.userGame.findMany({
  where:   { userId },
  include: { game: true },
  //         ^^^^^^^^^^^
  //         fetch the related Game row for each UserGame
})
// Each result has: { id, status, addedAt, game: { id, title, coverUrl, ... } }
```

Without `include`, `game` would be `undefined`. Prisma doesn't automatically
fetch relations — you opt-in with `include`.

### Nested `where` — filter through relations
```ts
// Find play sessions belonging to a specific user
// PlaySession → UserGame → User
db.playSession.findMany({
  where: {
    userGame: {        // traverse the relation
      userId: "clx123" // filter on the related table's field
    }
  }
})
```

This generates a SQL JOIN automatically. No manual join needed.

---

## Aggregations

```ts
// Sum all hours played
const result = await db.playSession.aggregate({
  where: { userGame: { userId } },
  _sum:  { hoursPlayed: true },
})
const totalHours = result._sum.hoursPlayed ?? 0
```

```ts
// Count rows
const count = await db.playSession.count({
  where: { userGame: { userId } }
})
```

```ts
// Group by status and count each group
const statusCounts = await db.userGame.groupBy({
  by:    ["status"],
  where: { userId },
  _count: { _all: true },
})
// → [{ status: "PLAYING", _count: { _all: 2 } }, ...]
```

---

## Migrations

A migration is a recorded change to your database schema. When you change
`schema.prisma`, you create a migration to apply that change to the real database.

```bash
npx prisma migrate dev --name add-review-table
```

This:
1. Compares your schema to the current database state
2. Generates a SQL file (stored in `prisma/migrations/`)
3. Runs that SQL against your database
4. Regenerates the TypeScript client

The migration files are committed to git. They're the history of every schema
change — important for production deployments and teamwork.

---

## Try this

1. Run `npm run dev` and open your terminal.
2. Navigate to `/dashboard` in the browser.
3. In the terminal, watch the SQL queries that Prisma logs — you'll see the
   `SELECT` statements it runs to fetch your games.
4. Add a game — watch the `INSERT` statements appear.
5. Change a game's status — watch the `UPDATE` statement.

Seeing the raw SQL helps you understand what Prisma is actually doing under the
hood, and is invaluable when debugging slow queries.
