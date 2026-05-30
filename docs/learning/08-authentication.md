# 8. Authentication

## What it is

Authentication answers "who are you?" — it's how your app knows which user is
making a request. This project uses **OAuth** via Google, managed by NextAuth v5.

---

## OAuth — signing in with Google

Instead of storing passwords, we delegate identity to Google. The flow:

```
1. User clicks "Continue with Google"
2. Browser redirects to Google's sign-in page
3. User signs in on Google's servers (we never see the password)
4. Google redirects back to: /api/auth/callback/google?code=xxx
5. NextAuth exchanges the code for user info (name, email, photo)
6. NextAuth creates/finds a User row in our database
7. NextAuth creates a session cookie in the browser
8. User is now signed in
```

Steps 4-7 happen automatically — that's what the callback route handles.

---

## In this project: `auth.ts`

```ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),    // store users in our PostgreSQL database
  providers: [Google],           // enable Google sign-in
  session: { strategy: "jwt" },  // store session in a cookie, not the DB
  ...
})
```

### The Prisma adapter
When a user signs in for the first time, the adapter automatically creates:
- A `User` row with their name, email, and profile photo
- An `Account` row linking their Google identity to our user

On subsequent sign-ins, it finds the existing rows instead of creating new ones.

### JWT session strategy
The session is stored in an **encrypted cookie** in the browser. When the user
makes a request, Next.js decodes the cookie to get the session — no database
query needed just to know who's logged in.

The alternative (database sessions) would store sessions in a `Session` table
and query it on every request. JWT is faster but the session can't be invalidated
server-side (until it expires). For this app, JWT is the right choice.

---

## The four exports from `auth.ts`

### `auth()` — get the current session (server-side)

```tsx
// In any Server Component or API route:
const session = await auth()

if (!session?.user?.id) redirect("/signin")  // not signed in
console.log(session.user.name)               // "Fernando Garcia"
console.log(session.user.id)                 // our database User.id
```

### `signIn()` — trigger the OAuth flow (server-side)

```tsx
// In app/signin/page.tsx — a Server Action:
<form action={async () => {
  "use server"
  await signIn("google", { redirectTo: "/dashboard" })
}}>
```

### `signOut()` — end the session (client-side in this project)

```tsx
// In components/SignOutButton.tsx:
import { signOut } from "next-auth/react"  // the CLIENT-side version

<button onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>
```

Note: there are two `signOut` functions. `import { signOut } from "@/auth"` is
for Server Actions. `import { signOut } from "next-auth/react"` is for Client
Components with `onClick`. Using the wrong one in the wrong context will error.

### `handlers` — the API route functions

```ts
// app/api/auth/[...nextauth]/route.ts:
import { handlers } from "@/auth"
export const { GET, POST } = handlers
```

These handle all the OAuth redirect URLs. You never call them directly — the
browser hits them during the sign-in flow.

---

## The callbacks — adding the user ID to the session

By default, `auth()` returns name, email, and image — but not the database `id`.
We need the `id` to make database queries ("get games for user clx123").

```ts
callbacks: {
  async jwt({ token, user }) {
    if (user) token.id = user.id  // on first sign-in, attach DB id to token
    return token
  },
  async session({ session, token }) {
    if (token.id) session.user.id = token.id as string  // expose it in session
    return session
  },
}
```

The flow:
1. User signs in → `jwt` callback fires, adds `id` to the JWT cookie
2. Any later request → `session` callback fires, copies `id` from token to session
3. `await auth()` returns session with `session.user.id` available

---

## Route protection

The pattern used on every protected page:

```tsx
export default async function ProtectedPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")
  // user is guaranteed to be signed in below this line
}
```

Why `session?.user?.id` instead of just `session`? NextAuth's TypeScript types
mark `session.user` as potentially undefined even when `session` is not null.
Checking `.user?.id` satisfies TypeScript and guarantees we have a real user ID
to use in database queries.

---

## How the cookie works

After sign-in, the browser stores an `authjs.session-token` cookie (you can see
it in DevTools → Application → Cookies). This cookie is:

- **Encrypted** — its contents can't be read without `AUTH_SECRET`
- **HTTP-only** — JavaScript can't access it (prevents XSS attacks from stealing it)
- **Sent automatically** — the browser includes it on every request to your domain

When `auth()` is called on the server, it reads this cookie and decrypts it using
`AUTH_SECRET`. This is why `AUTH_SECRET` must never be exposed — anyone with it
could forge sessions.

---

## Try this

1. Open DevTools → Application tab → Cookies → `http://localhost:3000`.
2. Find the `authjs.session-token` cookie.
3. Copy its value and paste it into [jwt.io](https://jwt.io) — you can see the
   token structure (header, payload, signature), but not the decrypted contents
   because it's encrypted with your `AUTH_SECRET`.
4. Sign out — notice the cookie disappears.
5. Sign back in — it reappears with a new value.

This shows exactly what "JWT session" means in practice.
