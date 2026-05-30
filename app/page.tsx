// app/page.tsx — the home page (route: /).
//
// Shows a landing page for visitors. If the user is already signed in,
// redirects them straight to the dashboard so they don't see the marketing page.

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth();

  // Signed-in users have no reason to see the landing page.
  if (session) redirect("/dashboard");

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-6 text-6xl">🎮</div>

      <h1 className="mb-4 text-5xl font-bold tracking-tight text-white">
        Your gaming backlog,{" "}
        <span className="text-violet-400">organised.</span>
      </h1>

      <p className="mb-10 max-w-lg text-lg text-zinc-400">
        Track every game you&apos;re playing, want to play, or have finished.
        Log your sessions, write reviews, and actually make a dent in that backlog.
      </p>

      <Link
        href="/signin"
        className="rounded-lg bg-violet-600 px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-violet-500"
      >
        Get started — it&apos;s free
      </Link>

      {/* Feature grid */}
      <div className="mt-20 grid gap-6 sm:grid-cols-3">
        {[
          { icon: "📋", title: "Backlog board", desc: "Organise games into Playing, Backlog, and Completed." },
          { icon: "⏱️", title: "Session logger", desc: "Log hours and notes every time you sit down to play." },
          { icon: "⭐", title: "Reviews", desc: "Rate and review games once you finish them." },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-left"
          >
            <div className="mb-3 text-3xl">{f.icon}</div>
            <h3 className="mb-1 font-semibold text-white">{f.title}</h3>
            <p className="text-sm text-zinc-400">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
