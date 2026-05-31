"use client";

// ReviewModal — form to write or edit a personal review for one game.
// Opened from a button on GameCard.
//
// The same modal handles both "create" and "edit" — if an existingReview
// is passed in, the form pre-fills with that data and shows a delete button.

import { useState } from "react";
import type { Review } from "@/lib/types";

type Props = {
  userGameId: string;
  gameTitle: string;
  existingReview: Review | null | undefined;
  onReviewSaved:   (review: Review) => void;
  onReviewDeleted: () => void;
};

export default function ReviewModal({
  userGameId,
  gameTitle,
  existingReview,
  onReviewSaved,
  onReviewDeleted,
}: Props) {
  const [isOpen, setIsOpen]           = useState(false);
  // Pre-fill with existing values when editing, otherwise start empty.
  const [score, setScore]             = useState<number>(existingReview?.score ?? 0);
  const [body, setBody]               = useState(existingReview?.body ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState(false);

  function handleOpen() {
    // Reset form to current existing values (in case user edited then re-opened).
    setScore(existingReview?.score ?? 0);
    setBody(existingReview?.body ?? "");
    setError(null);
    setSuccess(false);
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (score === 0) {
      setError("Please select a score.");
      return;
    }

    setIsSubmitting(true);

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userGameId, score, body }),
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Failed to save review.");
    } else {
      setSuccess(true);
      // Notify GameCard with the saved review so it can update its state.
      onReviewSaved({
        ...json.data,
        createdAt: json.data.createdAt,
      });
      setTimeout(handleClose, 1000);
    }

    setIsSubmitting(false);
  }

  async function handleDelete() {
    if (!existingReview) return;
    setIsDeleting(true);

    const res = await fetch(`/api/reviews/${existingReview.id}`, { method: "DELETE" });

    if (res.ok) {
      onReviewDeleted();
      handleClose();
    } else {
      setError("Failed to delete review.");
    }

    setIsDeleting(false);
  }

  // Use != null to guard against both null and undefined (undefined arrives
  // when a freshly added game's API response omits the review field).
  const hasReview = existingReview != null;

  return (
    <>
      {/* Trigger button — shows the current score if a review exists */}
      <button
        onClick={handleOpen}
        title={hasReview ? `Your review: ${existingReview.score}/10` : "Write a review"}
        className={`rounded p-1 text-xs transition-colors hover:bg-zinc-700 ${
          hasReview
            ? "font-semibold text-violet-400"
            : "text-zinc-500 hover:text-violet-400"
        }`}
      >
        {hasReview ? `★${existingReview.score}` : "✍"}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
              <div>
                <h2 className="font-semibold text-white">
                  {hasReview ? "Edit review" : "Write a review"}
                </h2>
                <p className="max-w-[260px] truncate text-xs text-zinc-400">{gameTitle}</p>
              </div>
              <button onClick={handleClose} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 p-4">

              {/* Score picker — 10 buttons, one per score value */}
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-400">
                  Score <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-1">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setScore(n)}
                      // Highlight the selected score in violet; dim the rest.
                      className={`flex-1 rounded py-1.5 text-xs font-semibold transition-colors ${
                        score === n
                          ? "bg-violet-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {/* Descriptive label for the selected score */}
                {score > 0 && (
                  <p className="mt-1 text-right text-xs text-zinc-500">
                    {SCORE_LABELS[score]}
                  </p>
                )}
              </div>

              {/* Review body */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Your review <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={5}
                  placeholder="What did you think? Any standout moments?"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={2000}
                  required
                  className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
                <p className="mt-0.5 text-right text-xs text-zinc-600">{body.length}/2000</p>
              </div>

              {error   && <p className="text-sm text-red-400">{error}</p>}
              {success && <p className="text-sm text-green-400">Review saved! ✓</p>}

              <div className="flex gap-2">
                {/* Delete button — only shown when editing an existing review */}
                {hasReview && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting || isSubmitting}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition-colors hover:border-red-500 hover:text-red-400 disabled:opacity-50"
                  >
                    {isDeleting ? "Deleting…" : "Delete"}
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || isDeleting}
                  className="flex-1 rounded-lg bg-violet-600 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                >
                  {isSubmitting ? "Saving…" : hasReview ? "Update review" : "Save review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// Short label shown below the score picker to give context to the number.
const SCORE_LABELS: Record<number, string> = {
  1:  "Terrible",
  2:  "Bad",
  3:  "Poor",
  4:  "Below average",
  5:  "Average",
  6:  "Decent",
  7:  "Good",
  8:  "Great",
  9:  "Excellent",
  10: "Masterpiece",
};
