// playwright/global-setup.ts — runs ONCE before the whole suite (wired via
// `globalSetup` in playwright.config.ts).
//
// Step 9 tests seed real database rows (games, sessions, reviews) for the test user.
// Two prerequisites can't go through the app's own API:
//   1. The test user needs an actual User row — POST /api/user-games creates a
//      UserGame with a foreign key to User, so the row must exist first. (Real users
//      are normally created by Google sign-in, which we can't automate.)
//   2. A clean slate — wipe any rows a previous (possibly crashed) run left behind,
//      so the board starts empty.
//
// We do both with `prisma db execute`, which runs raw SQL through the Prisma CLI. We
// deliberately do NOT import the generated Prisma client here: it's an ES module that
// uses import.meta, which fails under Playwright's CommonJS transform (the same reason
// auth.setup.ts mints the session cookie by hand). The CLI runs in its own process,
// sidestepping that entirely.

import { execSync } from "node:child_process";
import { TEST_USER } from "./fixtures/test-user";

function runSql(sql: string): void {
  // --stdin reads the SQL from stdin; the CLI connects using DATABASE_URL (loaded by
  // Prisma's own config). stdio pipes our SQL in and surfaces any error output.
  execSync("npx prisma db execute --stdin --schema prisma/schema.prisma", {
    input: sql,
    stdio: ["pipe", "inherit", "inherit"],
  });
}

export default function globalSetup(): void {
  // 1. Ensure the test user exists (idempotent). Values are fixed constants, so the
  //    string interpolation here is safe (no untrusted input).
  runSql(
    `INSERT INTO "User" (id, email, name, "createdAt")
     VALUES ('${TEST_USER.id}', '${TEST_USER.email}', '${TEST_USER.name}', NOW())
     ON CONFLICT (id) DO NOTHING;`,
  );

  // 2. Clean slate. Deleting UserGames cascades to their PlaySessions and Review
  //    (schema onDelete: Cascade), so this fully resets the test user's board.
  runSql(`DELETE FROM "UserGame" WHERE "userId" = '${TEST_USER.id}';`);
}
