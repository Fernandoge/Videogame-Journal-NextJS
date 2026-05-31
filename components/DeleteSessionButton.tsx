"use client";

// DeleteSessionButton — a small trash button that deletes one play session.
// Used on both the game detail page and the profile page.
//
// Two-step confirmation: first click arms the button (turns red + shows "Sure?"),
// second click within 3 seconds confirms the delete. This prevents accidental taps
// without needing a full modal.

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { sessionId: string };

export default function DeleteSessionButton({ sessionId }: Props) {
  const router = useRouter();
  const [armed, setArmed]       = useState(false); // first click — waiting for confirm
  const [deleting, setDeleting] = useState(false);
  const [armTimer, setArmTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  function handleFirstClick() {
    setArmed(true);
    // Auto-disarm after 3 s so a stray click doesn't linger in the armed state.
    const t = setTimeout(() => setArmed(false), 3000);
    setArmTimer(t);
  }

  async function handleConfirm() {
    if (armTimer) clearTimeout(armTimer);
    setDeleting(true);

    const res = await fetch(`/api/play-sessions/${sessionId}`, { method: "DELETE" });

    if (res.ok) {
      // Refresh the Server Component so the sessions list updates.
      router.refresh();
    } else {
      setArmed(false);
      setDeleting(false);
    }
  }

  if (deleting) {
    return <span className="text-xs text-zinc-500">Deleting…</span>;
  }

  if (armed) {
    return (
      <button
        onClick={handleConfirm}
        className="rounded px-2 py-0.5 text-xs font-medium text-red-400 ring-1 ring-red-500 transition-colors hover:bg-red-500 hover:text-white"
      >
        Sure?
      </button>
    );
  }

  return (
    <button
      onClick={handleFirstClick}
      title="Delete session"
      className="rounded p-1 text-zinc-600 transition-colors hover:text-red-400"
    >
      🗑
    </button>
  );
}
