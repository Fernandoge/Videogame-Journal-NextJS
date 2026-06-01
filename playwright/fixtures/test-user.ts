// playwright/fixtures/test-user.ts — the single identity every authed test shares.
//
// We define the logged-in user as plain CONSTANTS (not a DB row yet) so there is
// ONE source of truth for "who is logged in". Step 6 uses these fields to mint the
// session cookie; Step 9's data seeding will create the matching User row using
// this SAME `id`, so the cookie and the seeded data line up.

export const TEST_USER = {
  // A fixed id. The session cookie carries this as `user.id`; the dashboard and
  // profile pages query the DB by it (see app/dashboard/page.tsx). Any string works
  // for an explicitly-created row — Step 9 will seed a User with this exact id.
  id: "e2e-test-user",
  name: "E2E Test User",
  email: "e2e@videogame-journal.test",
} as const;

// Where the setup WRITES, and every authed test READS, the logged-in browser state
// (the session cookie). It lives under /playwright/.auth/ which is gitignored — it
// holds a real (test) session cookie, so it must never be committed.
export const STORAGE_STATE = "playwright/.auth/user.json";
