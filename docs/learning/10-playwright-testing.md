# 10. Testing with Playwright

## What this is

So far every doc has explained code that already exists. This one is different:
it's the **plan** for how we'll add end-to-end (E2E) tests, plus the reasoning
behind every decision — so when we write the actual tests, you already understand
*why* they're shaped the way they are.

End-to-end testing means driving a real browser the way a user would: click the
"+ Add game" button, type a search, add a game, watch it appear in the Backlog
column. If that flow works in a real browser, it works for your users. That's the
promise E2E gives you that unit tests can't.

We're using **Playwright** — Microsoft's browser automation framework. It runs
Chromium, Firefox, and WebKit, auto-waits for elements, and ships with a great
debugger (the trace viewer).

---

## The mental model: three layers

We deliberately keep **three** things separate. Mixing them is the root cause of
most unmaintainable test suites.

```
┌─────────────────────────────────────────────────────────┐
│  TESTS            what to verify  (the assertions live here) │
│  *.spec.ts        "after adding a game, it shows in Backlog" │
├─────────────────────────────────────────────────────────┤
│  PAGES + COMPONENTS   how to interact  (the "how" lives here) │
│  *.page.ts            clickAddGame(), selectScore(9)         │
│  *.component.ts                                              │
├─────────────────────────────────────────────────────────┤
│  LOCATORS         where things are  (selectors live here)    │
│  getByRole(...)   owned by the page/component classes        │
└─────────────────────────────────────────────────────────┘
```

The whole point: **when the UI changes, you fix one layer.** Renamed a button?
Update one locator. Reworked a flow? Update one method. The dozens of tests that
use them don't change at all.

---

## Page Object Model (POM) + Component Object Model (COM)

### Page Objects — one class per route

Each page in the app (`/dashboard`, `/profile`, `/games/[id]`) gets a class that
knows how to navigate to it and where its top-level elements are.

### Component Objects — one class per reusable UI piece

Here's the key insight for *this* project. Look at the component tree from
[doc 05](./05-server-vs-client-components.md): `LogSessionModal`, `ReviewModal`,
and `AddGameModal` appear on **both** the dashboard and the game detail page.

If we used pure POM (one class per page), the `DashboardPage` and
`GameDetailPage` classes would each duplicate the same modal selectors. The day
we change a modal, we'd hunt through multiple page classes. That's the exact
problem POM is supposed to *prevent*.

So we mirror the **component architecture** instead. The test code's structure
looks like the app's structure:

```
playwright/
  pages/
    BasePage.ts            shared navigation helpers
    LandingPage.ts         /
    SignInPage.ts          /signin
    DashboardPage.ts       /dashboard
    GameDetailPage.ts      /games/[id]
    ProfilePage.ts         /profile
  components/
    BacklogColumn.ts       one status column on the board
    GameCard.ts            one game card
    AddGameModal.ts        the RAWG search modal
    LogSessionModal.ts     the ⏱ log-session modal
    ReviewModal.ts         the ✍ review modal
    DeleteConfirmModal.ts  the "delete everything?" confirmation
  tests/
    auth.spec.ts
    dashboard.spec.ts
    ... (one spec per feature)
  fixtures/
    auth.ts                logged-in session, set up once and reused
```

**Pages take a `Page`. Components take a `Locator`.** That single difference is
what makes components reusable: a `GameCard` is scoped to *one* card's DOM
subtree, so the same class works whether there are 1 or 50 cards on screen.

Composition reads like a user's actual flow:

```ts
await dashboard.column("BACKLOG")   // → BacklogColumn
  .card("Elden Ring")               // → GameCard
  .openLogSession()                 // → LogSessionModal
  .then(modal => modal.logSession({ hours: 2, minutes: 30 }))
```

A method that *opens* a modal returns that modal's component object. The test
never writes "wait for the modal to appear" boilerplate — the next method call
auto-waits.

---

## THE golden rule: expose locators, assert in tests

This is the single most important habit, and it's the one most beginners (and a
lot of AI-generated tests) get wrong. It's worth its own section.

A page/component object should expose **locators** and **actions**, but it should
**not** return resolved values like strings, numbers, or booleans for the test to
assert on.

### Why returning values is a trap

```ts
// ❌ BAD — a getter that resolves a value
class GameCard {
  async getReviewScore(): Promise<string | null> {
    return this.root.locator(".review-btn").textContent()  // resolves ONCE
  }
}

// in the test:
expect(await card.getReviewScore()).toBe("★9")
```

The problem: `textContent()` reads the DOM **at one instant**. If the review just
saved and the button hasn't re-rendered yet, you read the old value and the test
fails — *intermittently*. To "fix" it people add `waitForTimeout(500)`, and now
the suite is both slow and still flaky.

### The fix: web-first assertions

Playwright's `expect(locator)` assertions **auto-retry** until the condition is
true or a timeout is hit (default 5s). No sleeps, no flake.

```ts
// ✅ GOOD — component exposes the locator
class GameCard {
  readonly reviewButton: Locator
  constructor(root: Locator) {
    this.reviewButton = root.getByTestId("review-button")
  }
}

// in the test — this polls until the button shows ★9
await expect(card.reviewButton).toHaveText("★9")
```

| Need to check… | ❌ Don't | ✅ Do |
|---|---|---|
| Text | `expect(await x.textContent()).toBe()` | `await expect(loc).toHaveText()` |
| Visibility | `expect(await x.isVisible()).toBe(true)` | `await expect(loc).toBeVisible()` |
| Count | `expect(await x.count()).toBe(3)` | `await expect(loc).toHaveCount(3)` |
| Input value | `expect(await x.inputValue())...` | `await expect(loc).toHaveValue()` |
| Enabled | `expect(await x.isEnabled())...` | `await expect(loc).toBeEnabled()` |

> **The litmus test:** if you ever write `expect(await something)`, stop. You've
> turned an auto-retrying assertion into a one-shot one. The `await` belongs
> *inside* `expect(...)`'s argument as a locator, not wrapped around a value.

This is why our revised component classes have almost no `getX(): string` methods.
They expose `readonly someThing: Locator` properties, and the **test** decides
what to assert.

(Rare exception: occasionally you genuinely need a *value* — e.g. capturing a
generated ID from the URL to navigate later. That's fine. It's assertions that
must stay as web-first `expect(locator)` calls.)

---

## Locators: the priority ladder

How you *find* elements determines how brittle your tests are. Prefer locators
that resemble how a **user** perceives the page, not how it's built.

Use, in this order of preference:

1. `getByRole("button", { name: "Search" })` — role + accessible name. Best:
   survives restyling and checks accessibility at the same time.
2. `getByLabel("Notes")` — for form fields with a real `<label>`.
3. `getByPlaceholder("Search for a game…")` — when there's no label.
4. `getByText("No games found.")` — for non-interactive content.
5. `getByTestId("game-card")` — explicit hook when nothing above fits.

**Never** select on Tailwind classes or DOM structure:

```ts
// ❌ brittle — breaks the instant someone restyles
page.locator(".rounded-lg.border.border-zinc-700.bg-zinc-800")
page.locator("div > div:nth-child(2) > button")

// ✅ stable — describes intent, not implementation
page.getByRole("button", { name: "Save session" })
```

### Test the app as it is — don't hook everything first

There's a tempting idea that you should sprinkle `data-testid` over the whole app
before writing a single test. Resist it. Two reasons:

1. **It's the wrong default.** `getByTestId` is the *last* rung of the ladder
   above for a reason. A testid describes nothing a user perceives — it's a
   convenience hook. An app covered in them isn't the gold standard; it's often a
   smell that the tests gave up on user-facing locators.
2. **It's not how real work goes.** You'll spend most of your career testing apps
   you *can't* freely edit — another team owns the code, PRs have friction,
   changing markup risks changing behaviour. The durable skill is writing
   resilient locators against an **imperfect** DOM. Hooking everything up first
   robs you of exactly that practice.

So the rule is: **test against the semantics that already exist**, and only add a
hook when the DOM genuinely fights back. Auditing our own components, almost
everything is already reachable:

| Element | Existing handle | Locator |
|---|---|---|
| Add / Search / Save buttons | real text | `getByRole("button", { name: "Save session" })` |
| ⏱ / 🗑 icon buttons | `title="…"` | `getByTitle("Log a play session")` |
| Score buttons 1–10 | text `1`..`10` | `getByRole("button", { name: "9", exact: true })` ← `exact` so "1" ≠ "10" |
| Status select | native `<select>` (one per card) | `card.getByRole("combobox")` |
| Game card | title `<Link>` + cover `alt` | `page.getByRole("listitem").filter({ hasText: "Hades" })` |
| Notes field | placeholder | `getByPlaceholder("What did you do?…")` |
| Modals | `<h2>` heading | scope by heading, or just target the single open modal's fields |

Scoping a card by its title and finding a modal by its heading (instead of
`role="dialog"`) are *slightly* more work — and that's the point. Those are the
techniques you'll use constantly on real codebases.

### When a hook *is* justified — the one ambiguous spot

There is exactly one place the current DOM is genuinely ambiguous. In
`LogSessionModal`, the hours and minutes inputs share `placeholder="0"` and have
no associated `<label>`:

```tsx
<input type="number" placeholder="0" ... />  {/* hours   */}
<input type="number" placeholder="0" ... />  {/* minutes */}
```

`getByPlaceholder("0")` matches **both**. Options, in order of preference:

1. Anchor off the visible `hrs` / `min` text beside each input.
2. Positional: `.first()` / `.nth(1)` — works, but fragile if the layout changes.
3. Add `aria-label="hours"` / `aria-label="minutes"` to *these two inputs only*.

Note that option 3 isn't a test crutch — a screen-reader user can't tell those
boxes apart either, so it's a real **accessibility** fix that happens to help
tests too. That's the distinction that decides whether to touch app code:

> Add `data-testid` for pure test convenience → **don't**; learn the workaround.
> Add `aria-label` / `role` / label association that fixes a genuine
> accessibility gap → **fine**, and sparingly. It helps real users too.

A good learning exercise: write the hrs/min test with `.nth()` first, feel how
fragile it reads, *then* add the `aria-label`s and watch it get cleaner. That
before/after teaches the trade-off better than any rule.

---

## Auto-waiting: never sleep

Playwright actions (`click`, `fill`) already wait for the element to be visible,
enabled, and stable before acting. Web-first assertions retry. Between those two,
you almost never need an explicit wait.

This project has a perfect example of the trap. After a successful save, the
modals do this:

```ts
// LogSessionModal.tsx
setSuccess(true)
setTimeout(handleClose, 1200)   // modal auto-closes after 1.2s
```

The wrong instinct is to mirror that in the test:

```ts
// ❌ couples the test to an implementation detail; wastes 1.2s every run
await page.waitForTimeout(1200)
expect(await modal.isVisible()).toBe(false)
```

The right way asserts on the **observable outcome** and lets Playwright poll:

```ts
// ✅ passes the instant the success message shows / the dialog goes away
await expect(modal.successMessage).toBeVisible()   // "Session logged! ✓"
await expect(modal.root).toBeHidden()              // auto-retries up to timeout
```

If the timing changes from 1200ms to 800ms tomorrow, this test doesn't care.

> **Rule:** `page.waitForTimeout()` has no place in a committed test. If you
> think you need it, you actually need a better assertion on the thing you're
> really waiting for.

---

## Test isolation: every test starts clean

Each test must pass **on its own, in any order, in parallel**. A test that only
passes because another test ran first is worse than no test — it gives false
confidence and fails mysteriously.

Concretely:

- No shared mutable variables carrying state between tests.
- Each test sets up the data it needs and doesn't depend on leftovers.
- Use `test.beforeEach` for common setup (e.g. navigating to a logged-in
  dashboard), not to smuggle in ordering dependencies.

Because this app has a **real PostgreSQL database** (see
[doc 09](./09-prisma-and-databases.md)), test data is the tricky part. Options,
roughly in order of how much we'd reach for them:

1. **Seed via the API / a seed script, namespace per test.** Create games with
   unique titles (e.g. `"Elden Ring [test-${id}]"`) so parallel tests don't
   collide, and clean them in `afterEach`.
2. **A dedicated test database** wiped in global setup, so dev data is never
   touched. (We point `DATABASE_URL` at it when running tests.)
3. **Transaction rollback per test** — elegant but hard across a separate
   server process, so not our first choice for E2E.

We'll start with a test database + per-test seeding. The golden rule: a test
creates what it needs and leaves the world as it found it.

---

## Authentication: log in once, reuse everywhere

The app uses Google OAuth with **JWT-in-cookie** sessions (see `auth.ts` and
[doc 08](./08-authentication.md)). Two consequences for testing:

1. **You can't click through Google's login screen** in an automated test — it's
   a third-party page with bot protection. Trying is a dead end.
2. **You shouldn't log in through the UI on every test anyway** — it's slow and
   couples every test to the auth flow.

The standard Playwright pattern is **`storageState`**: authenticate **once** in a
setup step, save the resulting cookies/storage to a file, then have every test
load that file so it starts already logged in.

Because our session is a signed JWT cookie, "authenticate once" means: mint a
valid session cookie for a test user (using the same `AUTH_SECRET` the app uses)
and write it into the storage state. Conceptually:

```ts
// playwright/fixtures/auth.ts  (we'll build this for real later)
// 1. Ensure a test user exists in the DB.
// 2. Generate the NextAuth session JWT for that user.
// 3. Save it as a cookie in storageState.
// Every test that needs auth loads this state and skips the login screen.
```

In `playwright.config.ts` this is wired as a **setup project** that other
projects `depend on`, so the login work happens once per run, not once per test.

Our `auth.spec.ts` is the exception — it tests the *unauthenticated* behaviour
(redirects to `/signin`), so it deliberately runs **without** the saved state.

---

## Network mocking: fast, deterministic, offline

The "Add game" search hits RAWG through our own endpoint, `/api/games/search`
(RAWG calls stay server-side — see the API conventions in `CLAUDE.md`).

In tests we **intercept that endpoint in the browser** and return fixed results:

```ts
await page.route("**/api/games/search**", route =>
  route.fulfill({
    json: { data: [{ id: 1, name: "Hades", genres: [{ name: "Indie" }], released: "2020-09-17", background_image: null }], error: null },
  })
)
```

Why mock it:

- **Speed** — no real network round-trip.
- **Determinism** — RAWG's results change over time; "search Hades" might return
  different games next month and break an assertion that has nothing to do with
  your code.
- **No flakiness from rate limits or RAWG being down.**
- **No API key needed** in CI.

The trade-off to understand: mocking `/api/games/search` means we're **not**
testing the real route handler's RAWG-mapping logic. That's fine — that belongs
in a separate API/integration test. Here we're testing the **search-results UI**:
does typing → searching → clicking "Add" put a card in the Backlog column? Mock
the boundary, test the behaviour you actually care about.

---

## Speed: why this design is also the fast one

The maintainable choices are, conveniently, the fast ones too.

- **Parallel by default.** Playwright runs spec files in parallel across worker
  processes. This only works if tests are isolated (see above) — another reason
  isolation matters.
- **Reused auth** (`storageState`) skips the login flow on every test.
- **Mocked network** removes the slowest, least reliable part of each test.
- **No `waitForTimeout`** means tests finish the instant the condition is met,
  not after an arbitrary sleep.
- **Run against a production build** in CI (`next build && next start`), not
  `next dev`. Dev mode recompiles on the fly and is slower and flakier; the
  `webServer` config can start the right one automatically.
- **Retries on CI only.** `retries: process.env.CI ? 2 : 0` papers over genuine
  infra blips in CI while keeping local runs honest (a flake locally is a bug to
  fix, not retry away).

---

## AI-driven development with Playwright

You asked specifically how this interacts with AI-assisted work. The short
version: **good structure makes AI more reliable, not less.**

- **Stable locators are AI-legible.** When elements are found by role/label/
  testid, an AI (or codegen) produces selectors that survive. When tests select
  on Tailwind soup, AI guesses and the tests rot.
- **POM/COM is a single source of truth.** Ask AI to "add a test for editing a
  review" and it composes existing component methods instead of re-deriving
  selectors in each spec. One place to fix, one place to extend.
- **`npx playwright codegen`** records your clicks into a script. Great for a
  first draft — but **always refactor the output into the page/component
  objects**; raw codegen output is the brittle, selector-everywhere style we're
  avoiding.
- **The trace viewer** (`npx playwright test --trace on`, then
  `npx playwright show-trace`) and **UI mode** (`--ui`) give a time-travel
  debugger. This is how you verify what an AI-written test *actually did*, step
  by step, instead of trusting it blindly.
- **Playwright MCP** lets an AI agent drive a real browser to explore the app and
  draft tests. Useful — but the output still gets reviewed against the
  anti-pattern checklist below before it's committed.
- **Review AI output for the usual sins:** hard-coded `waitForTimeout`, CSS/XPath
  selectors, `expect(await ...)` value assertions, tests that depend on each
  other. AI reaches for these constantly. Knowing the rules in this doc is what
  lets you catch them.

The takeaway: AI is great at *filling in* a well-designed structure and terrible
at *inventing* one. You provide the architecture (this doc); AI provides the
volume.

---

## What to avoid — the anti-pattern checklist

These apply to **every** Playwright project, not just this one. Pin this list.

| ❌ Anti-pattern | Why it hurts | ✅ Instead |
|---|---|---|
| `page.waitForTimeout(ms)` | Flaky + slow; couples test to timing | Web-first assertions auto-wait |
| `expect(await loc.textContent())` | One-shot, no retry → flaky | `await expect(loc).toHaveText()` |
| CSS/XPath on classes or structure | Breaks on any restyle/refactor | `getByRole` / `getByLabel` / `getByTestId` |
| Selecting on Tailwind classes | Styling ≠ behaviour | Roles, labels, test ids |
| Tests that depend on run order | False confidence, mystery failures | Full isolation; independent data |
| Logging in through the UI each test | Slow; couples everything to auth | `storageState`, authenticate once |
| Hitting real third-party APIs (RAWG) | Slow, flaky, rate-limited, non-deterministic | `page.route()` mocks |
| Assertions buried in page objects | Failures point at the helper, not the test | Assert in the spec; POM exposes locators |
| `if`/`else`/`try` logic in tests | Non-deterministic; hides real failures | One clear path per test |
| `page.$` / `page.$$` (ElementHandle) | Legacy API, no auto-waiting | Always use `Locator` |
| Sleeping to "fix" a flake | Hides the bug; it'll come back | Find the real condition and assert it |
| One giant test for a whole flow | Slow to debug; unclear what broke | Small, focused tests, one concern each |
| Snapshotting/asserting on huge blobs | Brittle; breaks on trivial change | Assert the specific thing that matters |
| Over-abstraction (a class per `<div>`) | More indirection than the app has | Model real pages & reusable components only |
| Testing framework internals | Re-tests Next.js/Prisma, not your code | Test *your* behaviour and user flows |

---

## Recommended config essentials

When we add `playwright.config.ts`, these are the settings that matter:

```ts
export default defineConfig({
  testDir: "./playwright/tests",
  fullyParallel: true,                       // parallel across files
  forbidOnly: !!process.env.CI,              // no stray .only() in CI
  retries: process.env.CI ? 2 : 0,           // retry flakes in CI only
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",        // so tests use page.goto("/dashboard")
    trace: "on-first-retry",                  // capture a trace when a test retries
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },              // mint the session
    { name: "chromium", dependencies: ["setup"],                  // reuse it everywhere
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" } },
  ],
  webServer: {                                // auto-start the app for the test run
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
})
```

`baseURL` lets every navigation be a relative path. `trace: "on-first-retry"` is
the sweet spot — no overhead on green runs, a full debuggable trace the moment
something flakes. `webServer` means `npm test` boots the app itself; you don't
babysit a dev server.

---

## The test cases we'll write (overview)

One spec file per feature, each a focused set of cases:

| Spec | Covers |
|---|---|
| `auth.spec.ts` | Unauthenticated `/dashboard`, `/profile`, `/games/*` → redirect to `/signin`; signed-in user on `/` or `/signin` → `/dashboard` |
| `landing-page.spec.ts` | Hero + CTA, the three feature cards, "Get started" links to `/signin` |
| `dashboard.spec.ts` | Three columns render, empty-state placeholder, column count badges, dropped-archive toggle, active-game footer count |
| `add-game-modal.spec.ts` | Opens, search disabled while empty, Enter triggers search, results render, "No games found", Add → card appears in Backlog, closes on ✕/backdrop |
| `game-card.spec.ts` | Title links to detail page, status select moves card between columns, delete-confirm modal appears/cancels/deletes |
| `log-session.spec.ts` | 0 time → error, >24h → error, valid → success then auto-close, notes optional, form resets on reopen |
| `review.spec.ts` | Score picker highlights + labels, submit without score → error, save updates the ★N button, edit prefills, delete removes |
| `game-detail.spec.ts` | Back link, hero info, status select, stats row, sessions list + empty state, delete session, review section + empty state, 404 on bad id |
| `profile.spec.ts` | Name/email, four stat cards, status breakdown, recent sessions, recently completed, reviews, empty states |

We'll stub these with `test.fixme(title, body)` first — they show up in the report
as planned (skipped) work and lock in the structure, then we fill in bodies one at
a time. (Playwright has **no** `test.todo` — that's a Jest/Vitest API. `test.fixme`
is the equivalent: it declares the test and skips its body.)

---

## Build order — the implementation plan

> **Guiding principle:** build the cheapest, most foundational thing that can fail
> *first*; defer the heaviest infrastructure (auth, then data) until everything
> upstream is proven green. This is the "walking skeleton" approach — get one
> trivial test passing end-to-end before anything complex, so each new layer is
> debugged in isolation instead of "is it the install, config, auth, or selector?"

The order follows this dependency chain:

```
install → config → smoke test ──┐
                                 ├─→ unauthenticated specs (need nothing else)
                                 └─→ auth fixture → POM/COM → mocks → data specs
```

Progress is tracked with the checkboxes below — tick them as each step lands.

- [x] **Step 1 — Install Playwright.** ✅ Done — `@playwright/test@1.60.0` + Chromium 148.
  - *What:* `@playwright/test` dev dependency + Chromium binary; `test` / `test:ui`
    scripts in `package.json`; gitignore `test-results`, `playwright-report`,
    `playwright/.auth`.
  - *Why:* the runner + a real browser are the bedrock; dev-only, never ships to Vercel.
  - *Order:* everything imports `@playwright/test`; nothing can precede it.

- [x] **Step 2 — Minimal `playwright.config.ts`.** ✅ Done.
  - *What:* `testDir`, `baseURL`, `webServer`, one chromium project, `trace:
    "on-first-retry"`, CI-only retries. **No auth project yet.**
  - *Why:* enables relative `page.goto("/")` and auto-boots the app for the run.
  - *Order:* config is read before any test; the smoke test needs it. Minimal = fewer
    parts to debug on the first run.

- [x] **Step 3 — One smoke test (the walking skeleton).** ✅ Done — 2 tests passing.
  - *What:* landing page `/` — hero heading visible, "Get started" links to `/signin`.
  - *Why:* proves install → config → webServer → browser → assertion with the least logic.
  - *Order:* a public page isolates *infra* problems from *test* problems. Fail fast,
    cheaply. **← we pause here to confirm the pipeline goes green.**

- [x] **Step 4 — `test.fixme()` skeletons for every spec.** ✅ Done — 50 planned tests.
  - *What:* create all spec files from the table above, bodies as `test.fixme(title, () => {})`.
    (Playwright has no `test.todo`; `test.fixme` declares the test and skips its body.)
  - *Why:* locks structure/naming; the report shows the whole plan as planned work.
  - *Order:* free once the runner is green; gives a map for everything after.

- [x] **Step 5 — Unauthenticated specs (`auth.spec.ts`).** ✅ Done — 3 redirect tests passing.
  - *What:* logged-out `/dashboard`, `/profile`, `/games/*` → redirect to `/signin`.
  - *Why:* highest value-to-cost; needs zero infrastructure (no login, no data).
  - *Order:* deliberately *before* the auth fixture — they test the logged-**out**
    state. Bank the cheap, real tests first.

- [x] **Step 6 — Auth fixture (the `storageState` setup project).** ✅ Done — mint the
      Auth.js JWT cookie with `next-auth/jwt` `encode()`; logged-in `auth.spec` tests green.
  - *What:* `auth.setup.ts` + `.env.test`; define the test-user IDENTITY (a shared
    constant in `playwright/fixtures/test-user.ts`), mint the NextAuth session JWT
    cookie for it, save to `playwright/.auth/user.json`; wire the `setup` project +
    `storageState` into config. The matching **DB row is deferred to Step 9** — the
    cookie alone is enough for the redirect tests this unblocks (`/` and `/signin`
    only check `if (session)`; `/dashboard` queries an unknown id → no rows).
  - *Key mechanic:* the session is a stateless **encrypted** JWT (auth.ts uses
    `strategy: "jwt"`). We sign the cookie with the **same `AUTH_SECRET`** the app
    uses and the right salt (`authjs.session-token`, the cookie name on http), so the
    app decrypts it like any real request. `.env.test`'s `AUTH_SECRET` is injected
    into the booted app via `webServer.env`, guaranteeing both sides match.
  - *Why:* Google's screen can't be automated; log in once, reuse everywhere (speed).
  - *Order:* the gate to all authed tests and the most error-prone piece — done only
    after the pipeline is proven (3) and the no-auth tests are banked (5).

- [x] **Step 7 — POM foundation.** ✅ Done — `BasePage` + `DashboardPage`; the three
      data-free dashboard tests (columns render, empty-state placeholder, Dropped
      archive hidden) green against the real empty board.
  - *What:* `BasePage` (holds `page`, knows its `path`, `goto()`) → page classes →
    component classes, built incrementally as the first spec needs each (not all
    speculatively up front). Pages take a `Page`; components take a `Locator`.
  - *Note:* the COMPONENT objects (`GameCard`, `BacklogColumn`) are deferred to
    Step 9 on purpose — an empty board has no cards/columns-with-content to scope, so
    building them now would be abstractions for tests that don't exist yet. The
    dashboard's data-free cases land here; its data-hungry cases stay `fixme` for 9.
  - *Why:* the reusable "how to interact" layer the feature specs compose.
  - *Order:* meaningful only once login works (6); just-in-time avoids inventing
    abstractions for tests that don't exist yet.

- [ ] **Step 8 — RAWG network-mock helper.**
  - *What:* a fixture doing `page.route("**/api/games/search**", …)` with fixed results.
  - *Why:* a fast, offline, deterministic add-game flow.
  - *Order:* only the add-game spec needs it; build it right before that spec.

- [ ] **Step 9 — Data seeding + the data-dependent specs.**
  - *What:* test-DB seeding (namespaced titles + cleanup), then `add-game` first, then
    `dashboard`, `game-card`, `log-session`, `review`, `game-detail`, `profile`.
  - *Why:* the richest tests — they need auth + POM + mocks + real DB rows; seeding is
    the heaviest infrastructure in the project.
  - *Order:* last (most dependencies). `add-game` leads the group because it creates its
    own data through the UI, bridging to the specs that need pre-existing data.

---

## Try this

You don't need Playwright installed to do these — they build the right instincts.

1. **Spot the anti-pattern.** Open any component, e.g. `LogSessionModal.tsx`.
   Find the success flow (`setSuccess(true)` → `setTimeout(handleClose, 1200)`).
   Write down, in plain English, *what a user observes* — not the timing. That
   sentence ("the success message appears, then the dialog closes") is your
   assertion. Notice it never mentions 1200ms.

2. **Reach it as-is.** Open `GameCard.tsx` and list every element a test would
   need to click: the title link, the status `<select>`, the ⏱, ✍, and 🗑
   buttons. For each, find a locator using *only what's there today* — the link
   text, the `title` attributes (`getByTitle`), the native `combobox` role. You'll
   find every one is reachable without touching the app. *Then* open
   `LogSessionModal.tsx` and try to target the hours input specifically — that's
   the one spot where the DOM is genuinely ambiguous (`placeholder="0"` twice),
   and the only place a minimal `aria-label` is justified.

3. **Rewrite a getter.** Take this bad method and rewrite it the right way:
   ```ts
   // bad
   async function columnIsEmpty(col: Locator): Promise<boolean> {
     return (await col.locator("li").count()) === 0
   }
   ```
   (Answer: expose the cards as a locator and assert
   `await expect(col.getByRole("listitem")).toHaveCount(0)` in the test — no
   boolean, no one-shot `count()`.)

These three habits — assert on outcomes not timing, find by role not by class,
expose locators not values — are 80% of what separates a maintainable Playwright
suite from a flaky one.
