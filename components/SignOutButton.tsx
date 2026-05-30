"use client";
// ^^^ This directive makes this a Client Component.
// We need it here because the button uses onClick, which is browser interactivity.
// Server Components can't attach event handlers — they render HTML on the server
// and send it to the browser, so there's no runtime to listen for clicks.
//
// Rule of thumb: add "use client" only when you need:
//   - Event handlers (onClick, onChange, onSubmit…)
//   - Browser APIs (localStorage, window, etc.)
//   - React hooks (useState, useEffect, etc.)
// Everything else should stay a Server Component.

import { signOut } from "next-auth/react";
// Note: we import signOut from "next-auth/react" (the client-side package),
// NOT from "@/auth". The "@/auth" signOut is for Server Actions only.

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      // callbackUrl: "/" sends the user back to the home page after signing out.
      className="text-sm text-zinc-400 hover:text-white transition-colors"
    >
      Sign out
    </button>
  );
}
