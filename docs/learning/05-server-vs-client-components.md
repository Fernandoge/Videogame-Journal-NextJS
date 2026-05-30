# 5. Server vs Client Components

## The most important Next.js 14 concept

Before Next.js 13, all React components ran in the browser. Next.js 14 splits
them into two types. Understanding when to use each is the central skill of
modern Next.js development.

---

## Server Components — the default

A component with no `"use client"` directive at the top is a Server Component.

- Runs **only on the server**. The browser receives finished HTML.
- Can be `async` — you can `await` database calls directly inside the component.
- Has access to server-only things: environment variables, `process.env`, databases.
- Cannot use: `onClick`, `onChange`, `useState`, `useEffect`, or any browser API.
- **Zero JavaScript** sent to the browser for them — faster load times.

```tsx
// app/dashboard/page.tsx — Server Component
export default async function DashboardPage() {
  const session = await auth()            // ✓ server-only call
  const games = await db.userGame.findMany({ ... }) // ✓ database call
  return <BacklogBoard initialGames={games} />
}
```

---

## Client Components — opt-in

A file with `"use client"` at the very top is a Client Component.

- Runs on the server first (to generate initial HTML), then **hydrates** in the browser.
- Can use: `onClick`, `onChange`, `useState`, `useEffect`, browser APIs.
- Its JavaScript is included in the bundle sent to the browser.
- **Cannot** directly access databases or secret environment variables.

```tsx
"use client"

// components/BacklogBoard.tsx — Client Component
export default function BacklogBoard({ initialGames }: Props) {
  const [games, setGames] = useState(initialGames)  // ✓ useState works here
  ...
}
```

---

## In this project — the full picture

```
app/layout.tsx                 Server Component (calls auth())
  └── components/Navbar.tsx    Server Component (calls auth(), shows session data)
        └── components/SignOutButton.tsx  ← "use client" (needs onClick)

app/dashboard/page.tsx         Server Component (queries database)
  └── components/BacklogBoard.tsx  ← "use client" (manages game list state)
        └── components/GameCard.tsx       ← "use client" (status change button)
              └── components/LogSessionModal.tsx  ← "use client" (form state)
        └── components/AddGameModal.tsx   ← "use client" (search + form state)

app/profile/page.tsx           Server Component (5 parallel DB queries)

app/signin/page.tsx            Server Component (Server Action for sign-in)
```

Notice the pattern: Server Components at the top fetch data and pass it down as
props. Client Components receive that data and handle interactivity.

---

## Why does this split exist?

**Performance.** JavaScript is expensive to download, parse, and run in the
browser. If a component doesn't need browser interactivity (it just displays
data), there's no reason to ship its JavaScript to the user.

On the profile page, five database queries run and the results are turned into
HTML — all on the server. The browser downloads finished HTML with real data,
no JavaScript needed to "fill in" the content after load.

---

## The one rule

> Use `"use client"` only when you need `useState`, `useEffect`, event handlers,
> or browser APIs. Otherwise, leave it as a Server Component.

In practice, most of your "leaf" components (buttons, forms, interactive cards)
are Client Components. Most of your "page" and "layout" components are Server
Components.

---

## You can nest Client inside Server (not the other way)

```tsx
// Navbar.tsx — Server Component
export default async function Navbar() {
  const session = await auth()  // server-only
  return (
    <nav>
      <span>{session?.user?.name}</span>
      <SignOutButton />  {/* ← Client Component nested inside Server Component ✓ */}
    </nav>
  )
}
```

This is the standard pattern. The server renders the outer shell with real data;
the client component handles only the interactive piece.

You **cannot** go the other direction — a Client Component cannot import and use
a Server Component inside it (because Client Components run in the browser where
server-only code can't execute).

---

## The `"use client"` boundary

When you mark a file `"use client"`, every component imported by that file also
becomes a Client Component — the directive "spreads" downward through imports.

This is why we place `"use client"` as low in the tree as possible, on the
smallest component that actually needs it.

---

## Try this

1. Open `components/Navbar.tsx` (a Server Component).
2. Try adding `const [count, setCount] = useState(0)` inside the function.
3. Save — TypeScript and Next.js will immediately error: hooks can't be used in
   Server Components.
4. Undo the change.

Then:

1. Open `components/SignOutButton.tsx` (a Client Component).
2. Remove the `"use client"` directive from the top.
3. Save — it will error because `onClick` and `signOut` from `next-auth/react`
   require a browser environment.
4. Undo the change.

These two experiments show exactly where the boundary is.
