"use client";

// LogSessionModal — form to log a play session for one game.
// Opened from a button on GameCard and GameDetailActions.
//
// Time is entered as hours + minutes rather than a decimal so users never
// have to think about fractions. Internally we convert to a float before
// sending to the API (e.g. 2h 30m → 2.5).

import { useState } from "react";

type Props = {
  userGameId: string;
  gameTitle: string;
  onSessionLogged?: () => void;
};


export default function LogSessionModal({ userGameId, gameTitle, onSessionLogged }: Props) {
  const [isOpen, setIsOpen]             = useState(false);
  const [hours, setHours]               = useState("");
  const [minutes, setMinutes]           = useState("0");
  const [notes, setNotes]               = useState("");
  const [date, setDate]                 = useState(() => new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [success, setSuccess]           = useState(false);

  function handleClose() {
    setIsOpen(false);
    setHours("");
    setMinutes("0");
    setNotes("");
    setDate(new Date().toISOString().split("T")[0]);
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const h = parseInt(hours || "0", 10);
    const m = parseInt(minutes, 10);

    // Convert hours + minutes to a single float for the API.
    // Round to 4 decimal places to avoid floating-point noise (e.g. 0.08333...).
    const hoursPlayed = Math.round((h + m / 60) * 10000) / 10000;

    if (hoursPlayed <= 0) {
      setError("Please enter at least 1 minute.");
      return;
    }
    if (hoursPlayed > 24) {
      setError("A single session can't exceed 24 hours.");
      return;
    }

    setIsSubmitting(true);

    const isoDate = new Date(date + "T12:00:00Z").toISOString();

    const res = await fetch("/api/play-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userGameId, hoursPlayed, notes: notes || undefined, date: isoDate }),
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Failed to log session.");
    } else {
      setSuccess(true);
      onSessionLogged?.();
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
                <p className="max-w-[220px] truncate text-xs text-zinc-400">{gameTitle}</p>
              </div>
              <button onClick={handleClose} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 p-4">

              {/* Hours + minutes on one row */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Time played <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="flex flex-1 items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="24"
                      step="1"
                      placeholder="0"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                    />
                    <span className="shrink-0 text-xs text-zinc-400">hrs</span>
                  </div>

                  <div className="flex flex-1 items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      step="1"
                      placeholder="0"
                      value={minutes}
                      onChange={(e) => setMinutes(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                    />
                    <span className="shrink-0 text-xs text-zinc-400">min</span>
                  </div>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
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

              {error   && <p className="text-sm text-red-400">{error}</p>}
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
