# 4. Next.js Routing

## What it is

Next.js creates URL routes automatically based on your folder structure inside
`app/`. You don't configure routes in a separate file — the file system *is*
the router.

```
app/
  page.tsx              → /
  signin/
    page.tsx            → /signin
  dashboard/
    page.tsx            → /dashboard
  profile/
    page.tsx            → /profile
  api/
    user-games/
      route.ts          → /api/user-games
      [id]/
        route.ts        → /api/user-games/abc123
```

---

## The three special file names

Inside any folder in `app/`, three file names have special meaning:

### `page.tsx` — the UI for a route
What renders when someone visits that URL. Must `export default` a component.

### `layout.tsx` — a persistent wrapper
Wraps all pages inside its folder (and subfolders). Doesn't re-render on
navigation — only its children change. Used for nav bars, shared headers, etc.

### `route.ts` — an API endpoint
Handles HTTP requests at that URL. Exports functions named after HTTP methods
(`GET`, `POST`, `PATCH`, `DELETE`). No UI — just data in, data out.

---

## In this project: `app/layout.tsx`

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  )
}
```

`children` is whatever `page.tsx` renders. The `<Navbar />` and `<main>` wrapper
render on every page, but only the `{children}` slot changes when you navigate.
This is why the nav bar never flickers on page transitions.

---

## Dynamic routes — `[id]`

Square brackets in a folder name create a dynamic segment. The value in the URL
becomes available as a parameter.

```
app/api/user-games/[id]/route.ts
```

This single file handles:
- `/api/user-games/clx123abc`
- `/api/user-games/clx456def`
- `/api/user-games/anything`

The value (`clx123abc`) is passed as `params.id`:

```ts
// In app/api/user-games/[id]/route.ts:
type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: RouteContext) {
  const { id } = await params  // id = "clx123abc"
  ...
}
```

---

## Catch-all routes — `[...param]`

The `...` syntax catches multiple URL segments at once.

```
app/api/auth/[...nextauth]/route.ts
```

This single file handles every URL starting with `/api/auth/`:
- `/api/auth/signin`
- `/api/auth/callback/google`
- `/api/auth/signout`
- `/api/auth/session`

Without catch-all, you'd need a separate file for each of those URLs.

---

## `Link` vs `<a>` for navigation

Always use `<Link>` from `next/link` for internal navigation — never `<a href>`.

```tsx
import Link from "next/link"

// ✓ correct — no full page reload, fast client-side navigation
<Link href="/dashboard">My Backlog</Link>

// ✗ wrong — causes a full page reload, loses all React state
<a href="/dashboard">My Backlog</a>
```

`<Link>` prefetches the destination page in the background when it enters the
viewport, making navigation feel instant.

---

## `redirect()` — sending users elsewhere from the server

```tsx
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")
  ...
}
```

`redirect()` is for Server Components. It throws a special signal that Next.js
catches and turns into an HTTP redirect — the user never sees the page content
if they're not authorised.

---

## Route groups — `(folder)`

Parentheses in a folder name group routes without affecting the URL. Not used in
this project yet, but worth knowing:

```
app/
  (marketing)/
    page.tsx    → /          (same URL, different layout)
  (app)/
    dashboard/
      page.tsx  → /dashboard (different layout)
```

This lets you have different layouts for different sections of the app.

---

## Try this

1. Create a new file: `app/test/page.tsx`
2. Add this content:
   ```tsx
   export default function TestPage() {
     return <h1 className="text-white text-2xl">Hello from /test</h1>
   }
   ```
3. Visit `http://localhost:3000/test` — your page is live with no configuration.
4. Delete the file when done. Notice the route disappears immediately.

This is the file-based router in action — no route config files, no imports to
update elsewhere.
