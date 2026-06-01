// log-session.spec.ts — the play-session logger (LogSessionModal).
//
// Step 4 skeleton (test.fixme = planned). The validation rules mirror the app:
// time must be > 0 and <= 24 hours (see app/api/play-sessions/route.ts and the
// modal's own checks).

import { test } from "@playwright/test";

test.describe("Log session modal", () => {
  test.fixme("shows an error when no time is entered", () => {});
  test.fixme("shows an error when the time exceeds 24 hours", () => {});
  test.fixme("logs a session with valid time and shows a success message", () => {});
  test.fixme("closes itself after a successful save", () => {});
  test.fixme("treats notes as optional", () => {});
  test.fixme("resets the form when reopened", () => {});
});
