// lib/format.ts — shared display-formatting helpers.

// Converts a float hours value (as stored in the DB) to a "Xh Ym" string.
// Examples: 2.5 → "2h 30m" · 0.5 → "30m" · 3 → "3h" · 23.8333 → "23h 50m"
export function formatPlayTime(hoursFloat: number): string {
  const h = Math.floor(hoursFloat);
  // Round minutes to avoid floating-point noise (e.g. 0.9999... → 60).
  const m = Math.round((hoursFloat - h) * 60);

  // Edge case: rounding pushes minutes to 60.
  if (m === 60) return `${h + 1}h`;
  if (h === 0)  return `${m}m`;
  if (m === 0)  return `${h}h`;
  return `${h}h ${m}m`;
}
