// app/layout.tsx — the root layout.
//
// This file wraps EVERY page in the app. It renders once and persists across
// navigation — the shell never re-renders, only the {children} slot changes.
// Think of it as the frame; each page.tsx is the picture inside the frame.

import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Videogame Journal",
  description: "Track your gaming backlog and log your play sessions.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">
        {/* Navbar renders on every page. Because it's a Server Component,
            it can call auth() directly — no prop drilling needed. */}
        <Navbar />

        {/* Each page.tsx renders into this slot */}
        <main className="mx-auto max-w-6xl px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
