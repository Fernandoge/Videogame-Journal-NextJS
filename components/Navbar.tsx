// Navbar.tsx — the top navigation bar rendered on every page.
//
// This is a Server Component (no "use client" directive).
// It calls auth() to read the session on the server, then decides what to render.
// Server Components can be async — we can await database/session calls directly.

import { auth } from "@/auth";
import Image from "next/image";
import Link from "next/link";
import SignOutButton from "./SignOutButton";

export default async function Navbar() {
  // auth() reads the JWT cookie and returns the session, or null if not signed in.
  // Because this runs on the server, there's no loading state — by the time the
  // HTML reaches the browser, the session is already resolved.
  const session = await auth();

  return (
    <nav className="border-b border-zinc-800 bg-zinc-950">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">

        {/* Logo / app name */}
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-white hover:text-violet-400 transition-colors"
        >
          🎮 VG Journal
        </Link>

        {/* Right side: show user info if signed in, or a sign-in link if not */}
        <div className="flex items-center gap-4">
          {session ? (
            // Signed-in state
            <>
              <Link
                href="/dashboard"
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                My Backlog
              </Link>

              <Link
                href="/profile"
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Profile
              </Link>

              {/* User avatar — next/image is preferred over <img> because it
                  auto-optimises images (resizing, WebP conversion, lazy loading). */}
              {session.user?.image && (
                <Image
                  src={session.user.image}
                  alt={session.user?.name ?? "User avatar"}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              )}

              <span className="text-sm text-zinc-300">{session.user?.name}</span>

              {/* SignOutButton is a Client Component nested inside this Server Component.
                  This is fine — you can mix them. The server renders the outer shell;
                  the client component hydrates only the interactive button part. */}
              <SignOutButton />
            </>
          ) : (
            // Signed-out state
            <Link
              href="/signin"
              className="rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-500 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
