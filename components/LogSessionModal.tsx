"use client";

// LogSessionModal — form to log a play session for one game.
// Opened from a button on GameCard.

import { useState } from "react";

type Props = {
  userGameId: string;
  gameTitle: string;
  // Called after a session is successfully saved so the parent can react if needed.
  onSessionLogged?: () => void;
};

export default function LogSessionModal({ userGameId, gameTitle, onSessionLogged }: Props) {
  const [isOpen, setIsOpen]           = useState(false);
  const [hours, setHours]             = useState("");
  const [notes, setNotes]             = useState("");
  // Default the date input to today in YYYY-MM-DD format (what <input type="date"> expects).
  const [date, setDate]               = useState(() => new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState(false);

  function handleClose() {
    setIsOpen(false);
    setHours("");
    setNotes("");
    setDate(new Date().toISOString().split("T")[0]);
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    // Prevent the default form submit which would navigate the page.
    e.preventDefault();
    setError(null);

    const hoursNum = parseFloat(hours);
    if (isNaN(hoursNum) || hoursNum <= 0) {
      setError("Please enter a valid number of hours.");
      return;
    }

    setIsSubmitting(true);

    // Convert the YYYY-MM-DD date string into a full ISO datetime string.
    // The API expects z.string().datetime(), so we need the time component.
    const isoDate = new Date(date + "T12:00:00Z").toISOString();

    const res = await fetch("/api/play-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userGameId, hoursPlayed: hoursNum, notes: notes || undefined, date: isoDate }),
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Failed to log session.");
    } else {
      setSuccess(true);
      onSessionLogged?.();
      // Auto-close after a brief success flash.
      setTimeout(handleClose, 1200);
    }

    setIsSubmitting(false);
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        title="Log a play session"
        className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-violet-400"
      >
        ⏱
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
              <div>
                <h2 className="font-semibold text-white">Log session</h2>
                <p className="text-xs text-zinc-400 truncate max-w-[220px]">{gameTitle}</p>
              </div>
              <button onClick={handleClose} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 p-4">

              {/* Hours played */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Hours played <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="0.1"
                  max="24"
                  step="0.5"
                  placeholder="e.g. 2.5"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  required
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
              </div>

              {/* Date */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  // Style the date picker to match the dark theme.
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Notes <span className="text-zinc-600">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="What did you do? Any thoughts?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}
              {success && <p className="text-sm text-green-400">Session logged! ✓</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-violet-600 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
              >
                {isSubmitting ? "Saving…" : "Save session"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
