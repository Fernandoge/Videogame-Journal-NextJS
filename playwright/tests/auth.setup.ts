// auth.setup.ts — Step 6: mint a logged-in session ONCE, reuse it everywhere.
//
// Why a "setup project" instead of logging in inside every test (or a beforeEach)?
//   Logging in is slow and identical for every authed test. Playwright lets one
//   project run FIRST and save the browser's storage (cookies) to a file; every
//   other test then starts already-authenticated by loading that file. This runs
//   once per `npx playwright test`, not once per test. It's wired up in
//   playwright.config.ts (the `setup` project + the chromium `storageState`).
//
// Why mint the cookie by hand instead of clicking "Continue with Google"?
//   Google's login screen is a third-party page with bot protection — you can't
//   (and shouldn't) automate it. Our session is a stateless, ENCRYPTED JWT held in
//   a cookie (auth.ts sets `session: { strategy: "jwt" }`). So "log in" really
//   means: build that exact cookie ourselves using the same AUTH_SECRET the app
//   uses, and hand it to the browser. The app can't tell the difference — on each
//   request it just decrypts the cookie like any other.
//
// Note: this setup does NOT need a browser, so it never touches the `page` fixture.
// It also doesn't write to the database yet — the matching User row is created in
// Step 9 (data seeding). The redirect tests this unblocks don't need that row:
// `/` and `/signin` only check `if (session)`, and `/dashboard` querying an unknown
// userId simply returns no games.

import { test as setup, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { TEST_USER, STORAGE_STATE } from "../fixtures/test-user";

// The session cookie name Auth.js uses on plain HTTP (http://localhost): no prefix.
// On HTTPS it becomes "__Secure-authjs.session-token". This exact string is ALSO
// the cryptographic salt Auth.js derives the encryption key from, so the setup and
// the app must agree on it — they do, because it's the library default for http.
const SESSION_COOKIE = "authjs.session-token";

// NextAuth's default session lifetime (30 days). Matching it keeps the cookie's
// `expires` and the JWT's `exp` in sync.
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

setup("authenticate", async () => {
  const secret = process.env.AUTH_SECRET;
  // Fail loudly if the secret is missing. Otherwise we'd mint a cookie the app
  // can't decrypt, and every authed test would mysteriously redirect to /signin.
  if (!secret) {
    throw new Error("AUTH_SECRET is not set — did playwright.config.ts load .env.test?");
  }

  // `next-auth/jwt` ships as an ES Module, but Playwright runs this spec as
  // CommonJS — a static `import`/`require` of it fails. A dynamic `import()` works
  // from CJS and loads the ESM module at runtime.
  const { encode, decode } = await import("next-auth/jwt");

  // 1. Build the JWT payload. These are exactly the fields the app reads:
  //      auth.ts's `session` callback copies token.id → session.user.id,
  //      and the default session surfaces name/email/picture on session.user.
  //    `encode` adds iat/exp/jti itself and encrypts with the derived key.
  const token = await encode({
    salt: SESSION_COOKIE,
    secret,
    maxAge: MAX_AGE_SECONDS,
    token: {
      id: TEST_USER.id,
      sub: TEST_USER.id,
      name: TEST_USER.name,
      email: TEST_USER.email,
      picture: null,
    },
  });

  // 2. Sanity-check before we trust it: decrypt the token back with the same
  //    secret + salt. If AUTH_SECRET were wrong this fails HERE, in setup, with a
  //    clear message — not later as a baffling redirect in some downstream test.
  const decoded = await decode({ salt: SESSION_COOKIE, secret, token });
  expect(decoded?.id).toBe(TEST_USER.id);

  // 3. Write the cookie in Playwright's storageState shape. The chromium project
  //    (see playwright.config.ts) loads this file, so every test starts logged in.
  const storageState = {
    cookies: [
      {
        name: SESSION_COOKIE,
        value: token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
        // storageState wants a Unix timestamp in SECONDS, not milliseconds.
        expires: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
      },
    ],
    origins: [],
  };

  mkdirSync(dirname(STORAGE_STATE), { recursive: true });
  writeFileSync(STORAGE_STATE, JSON.stringify(storageState, null, 2));
});
