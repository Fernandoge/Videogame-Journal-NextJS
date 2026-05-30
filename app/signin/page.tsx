// app/signin/page.tsx — custom sign-in page.
//
// NextAuth would show its own plain sign-in page by default. We override it
// in auth.ts with `pages: { signIn: "/signin" }` so we control the design.
//
// This is a Server Component. The actual sign-in action is a Server Action
// (the async function with "use server") defined inline below.

import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function SignInPage() {
  // If the user is already signed in, send them straight to the dashboard.
  // No point showing a sign-in page to someone who's already authenticated.
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">

        <div className="mb-8 text-center">
          <div className="mb-3 text-4xl">🎮</div>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Sign in to track your backlog and log your sessions.
          </p>
        </div>

        {/* Server Action — the form submits to this function on the server.
            Server Actions let you handle form submissions without writing an
            API route. The "use server" directive tells Next.js this function
            runs on the server, never in the browser. */}
        <form
          action={async () => {
            "use server";
            // signIn() from "@/auth" triggers the OAuth redirect flow.
            // After Google authenticates the user, NextAuth redirects to /dashboard.
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            {/* Google "G" SVG logo */}
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}
