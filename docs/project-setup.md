# Videogame Journal — Project Setup

Infrastructure setup reference. For UI features see `docs/features.md`.
Run `npm run dev` and open http://localhost:3000 to start the app locally.

---

## Table of contents
1. [Next.js 14 project](#1-nextjs-14-project)
2. [Prisma + PostgreSQL](#2-prisma--postgresql)
3. [NextAuth.js v5](#3-nextauthjs-v5)
4. [RAWG API wrapper](#4-rawg-api-wrapper)
5. [Before the app will fully work](#5-before-the-app-will-fully-work)

---

## 1. Next.js 14 project

Scaffolded with `create-next-app` — TypeScript, Tailwind CSS, App Router.

### The App Router (`app/` directory)
Next.js has two routing systems. The older one lives in `pages/`. The newer one
(App Router) lives in `app/`. This project uses App Router because it is the
current standard and unlocks Server Components, layouts, and streaming.

**The rule:** any folder inside `app/` that has a `page.tsx` becomes a URL route.

| File | URL |
|------|-----|
| `app/page.tsx` | `/` |
| `app/games/page.tsx` | `/games` |
| `app/games/[id]/page.tsx` | `/games/anything` |

### `app/layout.tsx` — the root layout
Wraps every page in the app — the persistent `<html>` shell that never re-renders
on navigation. Global fonts, CSS, and the nav bar belong here.

### Why TypeScript strict mode?
A typo in a DB field name fails loudly at build time instead of silently returning
`undefined` in production.

### Why Tailwind CSS?
Utility classes go directly on JSX elements (`className="flex gap-4 text-lg"`).
No separate CSS files, no naming things.

### Config files
| File | Purpose |
|------|---------|
| `next.config.mjs` | Next.js behaviour |
| `tailwind.config.ts` | Which files Tailwind scans |
| `postcss.config.mjs` | CSS processing pipeline |
| `tsconfig.json` | TypeScript compiler settings |

---

## 2. Prisma + PostgreSQL

### What Prisma is
An ORM that sits between TypeScript and PostgreSQL. Describe your tables in
`prisma/schema.prisma`; Prisma generates a typed client so you query without
writing raw SQL.

```ts
// Instead of: SELECT * FROM users WHERE id = '123'
const user = await db.user.findUnique({ where: { id: '123' } })
// `user` is automatically typed as User | null
```

### Schema decorators (the `@` things)
| Decorator | Meaning |
|-----------|---------|
| `@id` | Primary key |
| `@default(cuid())` | Auto-generate a unique ID on insert |
| `@unique` | Enforce uniqueness in the DB |
| `@@unique([a, b])` | Composite uniqueness — the *combination* must be unique |
| `onDelete: Cascade` | Delete child rows when the parent is deleted |

The `?` suffix on a field means it is optional (nullable in the DB).
Relation fields (`games UserGame[]`) don't create a DB column — they let Prisma
fetch related rows in queries.

### Models
| Model | Purpose |
|-------|---------|
| `User` | A registered user |
| `Account` | One OAuth connection per provider (created by NextAuth on sign-in) |
| `VerificationToken` | One-time tokens for magic-link email auth (required by NextAuth adapter) |
| `Game` | A game cached from RAWG (shared across all users) |
| `UserGame` | One game on one user's backlog — the join between User and Game |
| `PlaySession` | A logged play session (hours + notes) for a UserGame |
| `Review` | A written review + score for a UserGame (max 1 per UserGame) |

### The client singleton (`lib/db.ts`)
Import `db` from here anywhere you need the database. Never call `new PrismaClient()`
elsewhere. The singleton stashes one instance on `globalThis` so Next.js hot-reloads
don't open a new connection pool on every save.

```ts
import { db } from '@/lib/db'
const user = await db.user.findUnique({ where: { id: '123' } })
```

### Environment variables
`DATABASE_URL` lives in `.env` (gitignored). `.env.example` is the safe committed
reference showing what variables are needed without real values.

---

## 3. NextAuth.js v5

### Files
| File | Purpose |
|------|---------|
| `auth.ts` (root) | Central config — exports `auth`, `signIn`, `signOut`, `handlers` |
| `app/api/auth/[...nextauth]/route.ts` | Catch-all route that handles all `/api/auth/*` URLs |

### Why JWT sessions (not database sessions)?
NextAuth's Prisma adapter expects a model named `Session`. Our schema already uses
that name for play-session logs. JWT sessions store auth state in an encrypted
cookie instead of a DB table — no conflict, and the play session model stays named
`PlaySession`.

### What `auth.ts` exports
| Export | Where you use it |
|--------|-----------------|
| `auth()` | Any Server Component — returns the current user's session |
| `signIn()` | Server Actions — triggers sign-in redirect |
| `signOut()` | Server Actions — signs the user out |
| `handlers` | The API route — raw HTTP GET/POST functions |

### The catch-all route
`[...nextauth]` is Next.js catch-all syntax. One file handles every URL under
`/api/auth/*` (signin, Google callback, signout, session check, etc.).

### The `callbacks` in `auth.ts`
By default `auth()` returns name/email/image but not the DB `id`. The `jwt` and
`session` callbacks pass the DB id through the cookie so every Server Component
can identify the logged-in user without an extra DB query.

```ts
const session = await auth()
console.log(session?.user?.id) // our database User.id

if (!session?.user?.id) redirect("/signin") // safe auth guard pattern
```

---

## 4. RAWG API wrapper

**`lib/rawg.ts`** exports two functions:
- `searchGames(query, pageSize?)` — search by title, returns up to 10 results
- `getGame(rawgId)` — fetch full details for one game

### Server-side only
All functions read `process.env.RAWG_API_KEY`, which doesn't exist in the browser.
The API key never touches the client. Call these only from Server Components,
API route handlers, or Server Actions.

### Safe query string building
```ts
// WRONG — breaks on spaces and special characters:
const url = `${BASE}/games?key=${key}&search=${query}`

// RIGHT — URLSearchParams handles encoding automatically:
const params = new URLSearchParams({ key, search: query })
const url = `${BASE}/games?${params}`
```

### Next.js fetch caching
```ts
fetch(url, { next: { revalidate: 3600 } }) // cache for 1 hour
```
Next.js extends the native `fetch` to cache responses on the server. The same
search won't hit RAWG again until the cache expires.

---

## 5. Connecting everything — full walkthrough

Do these steps in order. All four must be complete before the app works end-to-end.

### Quick checklist
```
DATABASE_URL="postgresql://..."   ← Step A
AUTH_SECRET="..."                 ← Step B (run once, already done if you ran npx auth secret)
AUTH_GOOGLE_ID="..."              ← Step C
AUTH_GOOGLE_SECRET="..."          ← Step C
RAWG_API_KEY="..."                ← Step D
```

---

### Step A — Get a free PostgreSQL database (Neon)

Neon is the easiest option: free tier, no credit card, connection string in 2 minutes.

1. Go to [neon.tech](https://neon.tech) and sign up (GitHub login works)
2. Click **New project**, name it `videogame-journal`, pick any region
3. Once created, click **Connection string** and copy it — looks like:
   ```
   postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Paste it into `.env`:
   ```
   DATABASE_URL="postgresql://username:password@ep-xxx..."
   ```
5. Run the migration to create all your tables:
   ```
   npx prisma migrate dev --name init
   ```
   You should see output ending in `✔ Generated Prisma Client`. Your tables now exist.

**What the migration does:**
Prisma reads `prisma/schema.prisma`, generates the SQL (`CREATE TABLE ...`), runs it
against your database, and saves a record of it in `prisma/migrations/` so future
schema changes can be applied incrementally.

---

### Step B — Auth secret

If you haven't already:
```
npx auth secret
```
This generates a random secret and writes `AUTH_SECRET` to your `.env`.

**Important:** the variable must be named exactly `AUTH_SECRET`.
`BETTER_AUTH_SECRET` and `NEXTAUTH_SECRET` are different libraries and won't work.

---

### Step C — Google OAuth credentials

One-time setup. Takes about 5 minutes.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **New Project**
   - Name: `videogame-journal` → **Create**
3. Left sidebar → **APIs & Services → OAuth consent screen**
   - User Type: **External** → **Create**
   - App name: `Videogame Journal`
   - User support email + Developer contact email: your email
   - Click **Save and Continue** through the rest (skip Scopes and Test Users)
4. Left sidebar → **APIs & Services → Credentials**
   - Click **+ Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `videogame-journal-local`
   - Under **Authorised redirect URIs** click **+ Add URI**:
     ```
     http://localhost:3000/api/auth/callback/google
     ```
   - Click **Create**
5. A popup shows your **Client ID** and **Client Secret** — copy both into `.env`:
   ```
   AUTH_GOOGLE_ID="your-client-id.apps.googleusercontent.com"
   AUTH_GOOGLE_SECRET="GOCSPX-your-secret"
   ```

**When you deploy to production later**, you'll need to add your production URL as a
second authorised redirect URI:
```
https://your-domain.com/api/auth/callback/google
```

---

### Step D — RAWG API key

1. Go to [rawg.io/apidocs](https://rawg.io/apidocs)
2. Click **Get API key** and sign up (free, instant)
3. Your key is shown on the page immediately
4. Add to `.env`:
   ```
   RAWG_API_KEY="your-key-here"
   ```

---

### Step E — Run and test

```
npm run dev
```

Visit **http://localhost:3000**. Expected flow:
1. Landing page → click **Get started**
2. Sign-in page → click **Continue with Google** → Google auth → redirects to `/dashboard`
3. Dashboard → click **+ Add game** → search for a game → click **Add**
4. Card appears in the Backlog column → change status, click ⏱ to log a session
5. Visit `/profile` → see hours and session stats
