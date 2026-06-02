# 11. Playwright — Deep Dive

## What this is and how it differs from doc 10

[Doc 10](./10-playwright-testing.md) taught you **how to write good tests** for this
project: the Page/Component Object Model, the locator ladder, web-first assertions,
the anti-pattern checklist. It's the *style guide*.

This doc is the *engine manual*. It answers the questions doc 10 deliberately left
out:

- **How does Playwright actually work underneath?** What happens between
  `await button.click()` and a pixel changing on screen.
- **What are the fundamentals as a reference?** The `test` / `expect` / fixtures /
  projects API surface — framed against the suite you already built.
- **What are the best features?** The trace viewer, UI mode, codegen, the VS Code
  extension, API testing, visual/accessibility testing, sharding.
- **How do I practise?** Guided experiments on *your* real tests.

Every example below points at a file that exists in `playwright/`. Nothing here is a
toy demo. Two depths are interleaved: the main text is practical and tied to your
code; the `> 🔬 Under the hood` asides go deeper into the mechanics for when you
want them. Skip the asides on a first read; come back when "but *why*?" itches.

---

# PART A — How Playwright works underneath

## A.1 The one idea that explains everything: out-of-process control

Most testing tools fall into two camps. Selenium-era tools send one HTTP command per
action to a browser driver. Cypress runs your test code **inside** the browser's own
JavaScript event loop, on the page itself.

Playwright does **neither**. Your test runs in a **Node.js process**. The browser
runs as a **separate process**. They talk over a persistent **WebSocket-style duplex
connection**, using the same kind of remote-control protocol the browser's own
DevTools panel uses. Playwright drives the browser *from the outside*, the way a
puppeteer drives a marionette — hence Puppeteer, its ancestor.

```
┌────────────────────────┐      duplex connection       ┌──────────────────────────┐
│  YOUR TEST (Node.js)    │ ──── (Playwright protocol) ─▶│  Browser process         │
│  log-session.spec.ts    │                              │  (Chromium)              │
│  expect(...).toBe...     │ ◀── events: console,        │   ├─ Context             │
│  page.click(...)         │     network, DOM changes    │   │    (cookies/storage)  │
└────────────────────────┘                              │   └─ Page (the tab)      │
└──────────────────────────┘
```

Why this matters to you, concretely:

- **It can wait intelligently.** Because Playwright sees browser-internal events
  (network finished, DOM mutated, navigation committed), it knows *when* the page is
  ready instead of guessing with sleeps. This is the foundation of auto-waiting
  (§A.4) — and the reason doc 10 can ban `waitForTimeout`.
- **It controls the network at the browser level.** `page.route()` in
  `fixtures/rawg.ts` intercepts `/api/games/search` *before the request leaves the
  browser*, not via a proxy. That's only possible from outside the page.
- **It can run many isolated tabs cheaply** (next section) — the basis of your test
  isolation and parallelism.

> 🔬 **Under the hood.** The "duplex connection" is concrete. Playwright ships a
> **driver** (a Node process bundling the browser-control logic). Your test is the
> *client*; it speaks Playwright's own JSON protocol to that driver over a pipe. The
> driver then speaks each browser's **native** automation protocol:
> - **Chromium** → the Chrome DevTools Protocol (**CDP**) over a WebSocket. This is
>   the literal protocol DevTools uses; `Page.navigate`, `Runtime.evaluate`,
>   `Network.enable`, `DOM.*` are real CDP methods.
> - **Firefox** → a patched protocol called **Juggler**.
> - **WebKit** → a patched WebKit remote-inspector protocol.
>
> Playwright maintains *patched* builds of Firefox/WebKit (that's why
> `npx playwright install` downloads its own browser binaries rather than using your
> system Chrome) so all three expose the same capabilities. That uniform surface is
> why one `getByRole(...).click()` behaves identically on all three engines.

## A.2 Browser → Context → Page — the isolation primitive

This three-level hierarchy is the single most important mechanism behind your
suite's isolation, and it's invisible in the test code, so it's worth making
explicit.

| Level | What it is | Lifetime in your suite |
|---|---|---|
| **Browser** | One launched browser *process* (Chromium here). Heavy. | One per worker process, reused across tests. |
| **BrowserContext** | An isolated profile *inside* that process — its own cookies, localStorage, cache, permissions. Like an incognito window. **Cheap.** | A **fresh one per test**. |
| **Page** | A single tab inside a context. | Usually one per test (the `page` fixture). |

The key insight: **a BrowserContext is the isolation boundary, and it's nearly free
to create.** Spinning up a browser process takes ~hundreds of ms; opening a new
context takes ~milliseconds because it reuses the process. So Playwright gives every
test a brand-new context — fresh cookies, fresh storage, no leakage — without the
cost of a new browser each time.

You're already relying on this in two places:

1. **`storageState`** (in `playwright.config.ts`) is loaded **into the per-test
   context** at creation. That's how every test starts logged in: the context is born
   already holding the session cookie that `auth.setup.ts` minted. No login step, no
   shared mutable state between tests.

2. **`warmup.setup.ts`** explicitly creates a *second* context to exercise the
   logged-out paths:

   ```ts
   // warmup.setup.ts — a separate context with EMPTY storage = a logged-out browser
   const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
   const anonPage = await anon.newPage();
   // ...visit the public routes...
   await anon.close();
   ```

   Same browser process, completely separate cookie jar. That's contexts doing their
   job.

> 🔬 **Under the hood.** When a spec destructures `{ page }`, Playwright's built-in
> `context` fixture has *already* run `browser.newContext({ storageState, ...use })`
> for that test, and the `page` fixture did `context.newPage()`. At test end both are
> torn down. This is why you never write `browser.newContext()` yourself in a normal
> test — the fixture system (Part B) does it, applying your project's `storageState`
> and device settings automatically. You only reach for `browser.newContext()`
> manually when you need a *second*, differently-configured context mid-test — exactly
> what `warmup.setup.ts` does for the logged-out pass.

## A.3 Locators are lazy descriptions, not element references

This is the concept that makes doc 10's "expose locators, assert in tests" rule
actually work, so understand it precisely.

A **Locator** is **not** a found element. It's a *recipe for finding an element*,
stored as a selector. It holds no DOM reference. Look at any constructor in your COMs:

```ts
// components/LogSessionModal.ts
this.hoursInput = page.getByLabel("Hours");   // nothing is queried HERE
```

At construction time, **nothing happens in the browser.** No element is located.
`this.hoursInput` is just the description "the element labelled Hours." The DOM is
queried **fresh, at the moment of every action or assertion**:

```ts
await modal.hoursInput.fill("5");             // queried NOW
await expect(modal.hoursInput).toHaveValue(""); // re-queried NOW, possibly many times
```

Because the locator re-resolves every time, it's immune to re-renders. The React
component can unmount and remount the input between two lines; the locator doesn't
care, because it never held the old element — it just runs its query again.

Contrast the **legacy** `ElementHandle` API (`page.$()`, `page.$$()`), which doc 10
bans. An ElementHandle *is* a reference to one specific DOM node, captured once. After
a re-render that node is detached and stale, and your test throws or reads garbage.
That staleness is the entire reason the modern Locator API exists.

> 🔬 **Under the hood.** `getByRole`, `getByLabel`, `getByText` etc. compile to
> Playwright's internal selector engine, which runs **inside the page** as injected
> JavaScript. `getByRole("button", { name: "Save session" })` doesn't grep the
> HTML — it computes each element's **ARIA role** and **accessible name** using the
> same algorithm a screen reader uses, then matches. That's why doc 10 calls
> role-locators "accessibility-checking for free": if `getByRole` can't find your
> button, a screen reader probably can't announce it either. `filter({ hasText })`
> (used in `BacklogColumn.card()` and `GameDetailPage.session()`) adds a sub-query:
> "of the matched listitems, keep the one containing this text." Chaining
> (`root.getByRole(...)` in your components) just prepends the parent's selector, so a
> `GameCard`'s locators only ever search inside that one card's `<li>`.

## A.4 Auto-waiting: the actionability checklist

Doc 10 says "Playwright actions already wait." Here's *what* they wait for — the
actual checklist Playwright runs before, say, `click()`:

1. **Attached** — the element exists in the DOM.
2. **Visible** — it has a non-empty bounding box and isn't `display:none` /
   `visibility:hidden`.
3. **Stable** — it's not mid-animation: its bounding box is identical across two
   consecutive animation frames.
4. **Receives events** — a hit-test at the click point lands on *this* element, not on
   something covering it (an overlay, a modal backdrop, a tooltip).
5. **Enabled** — not `disabled`.

Playwright **polls this whole list until every item passes or the timeout hits**,
then performs the action. `fill()` adds a sixth check: **editable** (not readonly).

You benefit from this in places you never wrote a wait for:

- In `log-session.spec.ts`, `modal.save({ hours: 2, minutes: 30 })` clicks "Save
  session". If the modal is still fading in (animating), check #3 makes the click wait
  until it settles. You didn't write that.
- In `add-game-modal.spec.ts`, clicking a result's "Add" button waits until that
  button is actually hittable, not obscured by a spinner.

> 🔬 **Under the hood — and where it ISN'T enough.** Auto-waiting handles *visual /
> DOM* readiness. It does **not** know about *React event-handler attachment*
> (hydration). A server-rendered button is "attached, visible, stable, hittable,
> enabled" — all five checks pass — a beat **before** React has run
> `addEventListener` for its `onClick`. Click in that window and Playwright reports a
> perfectly successful click that does *nothing*, because there's no handler yet.
>
> This is the exact flake that bit Step 8, and the fix lives in your code:
>
> ```ts
> // DashboardPage.openAddGame() — retry the click until the modal really opens
> await expect(async () => {
>   await this.addGameButton.click();
>   await expect(modal.heading).toBeVisible({ timeout: 1_000 });
> }).toPass({ timeout: 15_000 });
> ```
>
> `expect(async () => {...}).toPass()` re-runs the whole block until it stops
> throwing. So it clicks, checks if the modal appeared within 1s; if not (handler
> wasn't attached yet), it loops and clicks again. The button's handler only ever sets
> `isOpen = true`, so re-clicking is safe. This is the one category of wait
> auto-waiting can't cover for you — and `warmup.setup.ts` exists to shrink the
> window by pre-compiling routes so hydration isn't also racing a cold `next dev`
> compile.

## A.5 Web-first assertions: the retry loop

`expect(locator).toBeVisible()` is a fundamentally different thing from
`expect(value).toBe(true)`, and the difference is a loop.

- **Retrying matchers** — `expect(locator).<matcher>()`. These **re-evaluate the
  locator on a poll** until the condition holds or the *expect timeout* (default
  **5000ms**) elapses. `toBeVisible`, `toHaveText`, `toHaveValue`, `toHaveCount`,
  `toBeHidden`, `toBeEnabled`, `toContainText`, `toHaveScreenshot`…
- **Non-retrying matchers** — `expect(value).<matcher>()` on a plain value. One shot,
  no polling: `toBe`, `toEqual`, `toBeTruthy`, `toBeGreaterThan`…

This is why doc 10's litmus test — "if you write `expect(await ...)`, stop" — is
correct mechanically: the moment you `await` a value *out* of the locator and hand the
plain value to `expect`, you've dropped out of the retrying world into the one-shot
world, and you've reintroduced the flake.

Your `log-session.spec.ts` shows the payoff precisely:

```ts
test("closes itself after a successful save", async ({ page, backlog }) => {
  const modal = await openLogModal(page, backlog, "Auto Close Game");
  await modal.save({ hours: 1, minutes: 0 });

  await expect(modal.success).toBeVisible();   // polls until "Session logged! ✓" shows
  await expect(modal.heading).toBeHidden();    // polls until the modal auto-closes (~1.2s)
});
```

The modal closes itself ~1200ms after success via a `setTimeout` in the component.
The test never mentions 1200. `toBeHidden()` just keeps re-checking until the heading
is gone. If the app changes that delay to 800ms tomorrow, this test is unaffected.
*That's* a retry loop doing the waiting you'd otherwise hand-code wrong.

> 🔬 **Under the hood — the three timeouts.** Don't conflate them:
> | Timeout | Default | Set in | Governs |
> |---|---|---|---|
> | **Test** | 30 000ms | `timeout` / `test.setTimeout` | the whole test function |
> | **Expect** | 5 000ms | `expect.timeout` / per-assert `{ timeout }` | one retrying assertion |
> | **Action / navigation** | 0 (= unbounded, capped by test) | `use.actionTimeout` | one `click`/`fill`/`goto` |
>
> `warmup.setTimeout(180_000)` raises the *test* timeout for the warmup project
> because compiling every cold route legitimately takes minutes. The per-assert
> `{ timeout: 1_000 }` inside `openAddGame` shortens the *expect* timeout so each
> retry of the click gives up quickly and loops, rather than waiting the full 5s once.

## A.6 storageState: how "log in once" is just a JSON file

`storageState` is the mechanism behind §A.2's reuse, and your `auth.setup.ts` builds
one by hand, so you already know more about it than most users. To name it plainly:

**A storage state is a JSON snapshot of a context's cookies and per-origin
localStorage.** That's it. Loading it into a new context replays those cookies and
storage entries, reproducing a logged-in browser.

Normally you'd capture one by doing `await context.storageState({ path })` *after*
clicking through a real login. You can't, because Google's OAuth screen is
unautomatable. So `auth.setup.ts` **constructs the file directly** — it mints the
session cookie and writes the storageState shape itself:

```ts
// auth.setup.ts (abridged) — the file Playwright will load into every context
const storageState = {
  cookies: [{ name: "authjs.session-token", value: token, domain: "localhost",
              path: "/", httpOnly: true, secure: false, sameSite: "Lax", expires }],
  origins: [],   // no localStorage needed; the session lives entirely in the cookie
};
writeFileSync(STORAGE_STATE, JSON.stringify(storageState, null, 2));
```

The `setup` project writes it; the `chromium` project's `use: { storageState }`
loads it into every test's context (§A.2). One mint, reused everywhere.

> 🔬 **Under the hood — why the cookie value is opaque gibberish.** Your session
> isn't a plain-readable JWT (header.payload.signature). Auth.js v5 uses a **JWE** —
> an *encrypted* JWT. The encryption key is derived from `AUTH_SECRET` **plus the
> cookie name as a salt** (`authjs.session-token` on http) via HKDF. That's why
> `auth.setup.ts` must pass the exact cookie name as `salt` to `encode()`: get the
> salt wrong and you produce a token the app can't decrypt, and every authed test
> silently redirects to `/signin`. The setup's belt-and-suspenders `decode()` check
> exists to catch that failure *in setup* with a clear message instead of as a
> baffling downstream redirect. And `playwright.config.ts` injects the same
> `AUTH_SECRET` into the booted app via `webServer.env` so both sides derive the
> identical key. This is real cryptography, not a mock — the app genuinely can't tell
> your minted cookie from a Google-issued one.

---

# PART B — Fundamentals reference

A lookup-oriented tour of the API surface, every entry tied to where you already use
it.

## B.1 `test` — defining and grouping

```ts
import { test, expect } from "@playwright/test";

test("a single test", async ({ page }) => { /* ... */ });

test.describe("a group", () => {            // groups tests; scopes hooks/config
  test.beforeEach(async ({ page }) => {});  // runs before each test in the group
  test.afterEach(async ({ page }) => {});
  test.beforeAll(async () => {});           // once before the group
  test.afterAll(async () => {});
});
```

| Modifier | Meaning | In your suite |
|---|---|---|
| `test.only` | run *only* this (dev aid) | `forbidOnly: !!CI` in config bans it from CI |
| `test.skip` | never run | — |
| `test.fixme` | declared but skipped (the "TODO") | Steps 4–9 used it to stub every spec |
| `test.fail` | assert this test is *expected* to fail | — |
| `test.slow` | triple this test's timeout | — |
| `test.describe.configure({ mode, retries })` | per-group parallelism/retries | — |

`log-session.spec.ts` uses `test.describe("Log session modal", …)` purely to group
the six related cases and read as a unit in the report. Note it imports `test` from
**`../fixtures/data`**, not from `@playwright/test` — that's the custom `test` (B.3).

> Playwright has **no `test.todo`** — that's a Jest/Vitest API. `test.fixme(title, body)`
> is the equivalent and is what Steps 4–9 used to lock structure before filling bodies.

## B.2 Fixtures — the dependency-injection system

The `{ page }`, `{ backlog }`, `{ request }` you destructure are **fixtures**:
named resources Playwright sets up on demand and tears down after. Two rules explain
their entire behaviour:

1. **Lazy.** A fixture is only created if the test (or a fixture it depends on) asks
   for it by name. A test that destructures nothing pays for nothing.
2. **Scoped + auto-torn-down.** `test`-scoped fixtures are rebuilt per test;
   `worker`-scoped ones once per worker. Teardown runs automatically.

Built-in fixtures you use:

| Fixture | Type | What it is |
|---|---|---|
| `page` | `Page` | a fresh tab in a fresh context (loaded with your `storageState`) |
| `context` | `BrowserContext` | the per-test isolated profile (§A.2) |
| `browser` | `Browser` | the shared process; used in `warmup.setup.ts` for a 2nd context |
| `request` | `APIRequestContext` | an HTTP client **carrying the same cookies** as the context |
| `browserName` | `string` | `"chromium"` here |

That `request` fixture is the quiet hero of your seeding. Because it shares the
context's `storageState`, every `this.request.post("/api/user-games", …)` in
`fixtures/data.ts` is **authenticated as the test user** — no manual cookie juggling.
That's why seeding-over-HTTP works at all.

## B.3 Custom fixtures — how `backlog` is built

`fixtures/data.ts` extends the base `test` to add your own fixture. This is the most
important pattern to internalise, because it's how you'd add any new shared resource:

```ts
// fixtures/data.ts
import { test as base, expect } from "@playwright/test";

export const test = base.extend<{ backlog: BacklogSeeder }>({
  //              fixture name ──┘            ┌── the resource value handed to the test
  backlog: async ({ request }, use) => {
    const seeder = new BacklogSeeder(request);  // 1. SETUP (runs before the test body)
    await seeder.cleanAll();                     //    wipe the board
    await use(seeder);                           // 2. hand `seeder` to the test; pause here
    await seeder.cleanAll();                     // 3. TEARDOWN (runs after the test body)
  },
});
export { expect };
```

Read the `use(value)` call as the seam between setup and teardown. **Everything before
`await use(...)` is setup; `use` hands the value to the test and suspends; everything
after runs as teardown.** So `backlog` guarantees a clean board *before and after* —
the whole isolation story of your data specs, in nine lines.

Because it depends on `{ request }`, asking for `backlog` transitively pulls in
`request`, which pulls in the context's cookies. Fixtures composing fixtures.

And because it's lazy (B.2 rule 1), the empty-board tests in `dashboard.spec.ts` that
*don't* destructure `backlog` never run `cleanAll` and never touch the DB — they get
the genuinely empty board they assert on, for free.

> **The mental shift:** a fixture is not a helper function you call. It's a *resource
> you declare a dependency on*, and Playwright wires up its lifecycle. `beforeEach` +
> `afterEach` can do the same job, but fixtures compose (one can depend on another),
> are lazy, and are reusable across files — which is why `backlog` is a fixture and
> not a pair of hooks.

## B.4 Projects — pipelines, dependencies, and per-project config

A **project** is a named test configuration. `playwright.config.ts` defines three,
and the `dependencies` field chains them into a pipeline:

```
setup ──▶ warmup ──▶ chromium
(mint    (compile   (the real
 cookie)  routes)    specs)
```

```ts
projects: [
  { name: "setup",  testMatch: /auth\.setup\.ts/ },               // runs first
  { name: "warmup", testMatch: /warmup\.setup\.ts/,
    dependencies: ["setup"],  use: { storageState: STORAGE_STATE } },
  { name: "chromium", dependencies: ["warmup"],
    use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE } },
],
```

Three things projects give you here:

- **Ordering** — `dependencies` guarantees `setup` (mint the cookie) completes before
  anything that needs it. A failed dependency skips the dependents.
- **`testMatch` vs `testDir`** — setup/warmup are matched by filename so they *don't*
  get picked up as ordinary specs in `playwright/tests`.
- **Per-project `use`** — `storageState` and the device profile are applied to every
  test the project runs. This is the layer at which "all chromium tests start logged
  in" is configured.

The same machinery scales to cross-browser: add `{ name: "firefox", use: { ...devices["Desktop Firefox"] } }`
and your specs run on both engines with no test changes. You run one engine today by
choice, not limitation.

## B.5 The `expect` library — matcher reference

Retrying (locator) matchers — the ones you should reach for:

| Matcher | Asserts |
|---|---|
| `toBeVisible()` / `toBeHidden()` | element is / isn't visible |
| `toHaveText(s)` / `toContainText(s)` | exact / substring text |
| `toHaveValue(s)` | input value |
| `toHaveCount(n)` | number of matched elements |
| `toBeEnabled()` / `toBeDisabled()` | form control state |
| `toBeChecked()` | checkbox/radio |
| `toHaveAttribute(name, val)` | attribute |
| `toHaveScreenshot(name)` | visual match (§C.6) |

Non-retrying (value) matchers — for the rare genuine value (doc 10's exception):
`toBe`, `toEqual`, `toBeTruthy`, `toBeGreaterThan`, `toMatch`…

Two real uses of the value form in your suite, both legitimate:

```ts
// fixtures/data.ts — asserting on an API RESPONSE object, not a DOM locator
expect(res.ok(), `seed addGame failed: ${res.status()} ${await res.text()}`).toBeTruthy();
```

The second argument is a **custom message** shown on failure — invaluable in seeders,
where a bare "expected true" would tell you nothing about *which* seed call broke.

```ts
// game-detail.spec.ts (Slice 6) — the 404 case asserts a numeric status, not a locator
expect(response.status()).toBe(404);
```

That's the rare "you genuinely need a value" exception doc 10 carves out (a navigation
*response code* isn't a DOM thing). Note: still no `expect(await locator.x())`.

`expect.soft(...)` (collect multiple failures instead of stopping at the first) and
`expect.poll(fn)` (retry an arbitrary function) exist too — reach for them rarely.

---

# PART C — The feature tour

The tools that make Playwright a pleasure rather than a chore. You have
`@playwright/test@1.60` and these scripts already wired in `package.json`:

```json
"test": "playwright test",
"test:ui": "playwright test --ui"
```

## C.1 UI mode — `npm run test:ui` ⭐ start here

The single best way to learn what your suite does. It opens a watch-mode app where
you can:

- See every test as a tree; click one to run just it.
- **Time-travel**: a timeline of every action with a DOM snapshot at each step. Hover
  an action, see the page exactly as it was then.
- **Pick locator**: hover any element in the snapshot and it shows you the locator
  Playwright would use — the fastest way to discover that, say, your ⏱ button is best
  reached by `getByTitle("Log a play session")` (which is exactly what `GameCard.ts`
  does).
- Watch mode: edits re-run affected tests automatically.

Run `npm run test:ui`, open `log-session.spec.ts`, and step through "closes itself
after a successful save". You'll *see* the success message appear, then the modal
vanish — the observable outcomes your assertions wait on.

## C.2 The trace viewer — post-mortem time travel

A **trace** is a recording: DOM snapshots before/after every action, the network log,
console, the call log, and source. Your config captures one automatically the moment
a test flakes:

```ts
// playwright.config.ts
use: { trace: "on-first-retry" }   // zero overhead on green runs; full trace on a retry
```

When a test retries in CI, open the recording:

```sh
npx playwright show-trace playwright-report/.../trace.zip   # or via the HTML report
```

Trace modes: `off` | `on` | `retain-on-failure` | `on-first-retry` (your choice — the
sweet spot) | `on-all-retries`. This is how you debug a CI flake you can't reproduce
locally: you get the *exact* DOM and network state at the moment it broke.

## C.3 Codegen — record actions into a script

```sh
npx playwright codegen localhost:3000
```

Click around the app; Playwright writes the equivalent `getByRole(...).click()` code,
preferring the same role/label/title locators your COMs use. **Always refactor the
output into your page/component objects** — raw codegen is the selector-everywhere
style doc 10 warns against. It's a first-draft generator and a locator-discovery tool,
not a final-test generator.

## C.4 The debugger — `--debug` / the Inspector

```sh
npx playwright test log-session --debug      # opens the Inspector, steps through
```

Or set a breakpoint in code with `await page.pause()` — execution stops, the Inspector
opens, and you can step actions, edit/try locators live, and resume. The "Pick
locator" button there is the same locator-discovery tool as UI mode.

## C.5 API testing — you're already doing it

The `request` fixture (`APIRequestContext`) is a full HTTP client. Your **seeding is
API testing infrastructure**: `fixtures/data.ts` does `post`/`patch`/`delete`/`get`
against your own routes, asserts `res.ok()`, and reads `res.json()`. You could write
*pure* API tests the same way — e.g. assert `POST /api/play-sessions` rejects
`hoursPlayed > 24` — with no browser at all. That's the natural home for the
RAWG-mapping logic your UI tests deliberately *don't* cover (doc 10's "mock the
boundary" trade-off).

## C.6 Visual regression — screenshot assertions

```ts
await expect(page).toHaveScreenshot("dashboard.png");      // whole page
await expect(card.root).toHaveScreenshot("game-card.png"); // one component
```

First run records a baseline PNG; later runs diff against it and fail on a pixel delta
beyond a threshold. Update baselines deliberately with
`npx playwright test --update-snapshots`.

> **Caveat before you adopt it:** screenshots are sensitive to OS/font rendering, so a
> baseline taken on your Windows machine may "fail" in a Linux CI runner over
> anti-aliasing. The standard fix is to generate and compare baselines in a single
> consistent environment (a container, or CI-only). For this project, your
> behavioural assertions are higher-value; add visual tests only for genuinely
> visual concerns (a chart, a layout) where "does it look right" is the actual spec.

## C.7 Accessibility testing

Two layers, and you already get the first for free:

1. **Role-first locators are a passive a11y check.** Every `getByRole`/`getByLabel`
   in your COMs only works if the element exposes a correct role/accessible name. The
   `aria-label="Hours"`/`"Minutes"` you added in Slice 4, and the
   `role="region"` columns in Slice 2, are real a11y fixes that *also* made the DOM
   testable — doc 10's "fix accessibility, don't add a test crutch" rule in action.
2. **Active scanning** with `@axe-core/playwright`:
   ```ts
   import AxeBuilder from "@axe-core/playwright";
   const results = await new AxeBuilder({ page }).analyze();
   expect(results.violations).toEqual([]);
   ```
   This audits a page for WCAG violations (contrast, missing labels, bad ARIA). A
   natural addition for a learning project that already cares about semantics.

## C.8 Devices & mobile emulation

`devices["Desktop Chrome"]` in your config is one entry in a big catalogue. Each
device preset bundles viewport, user-agent, device-scale-factor, and touch
capability. Add a project to test a phone layout:

```ts
{ name: "mobile", use: { ...devices["iPhone 13"] }, dependencies: ["warmup"] }
```

Same specs, narrow touch viewport — useful once the board has a responsive layout
worth verifying.

## C.9 Parallelism, sharding & reporters (scaling up)

- **Workers** — `fullyParallel: true` runs spec *files* across worker processes. You
  set `workers: 1` **on purpose** (config comment): all data specs share one test user
  and the dashboard/profile pages *aggregate* that user's data, so two data tests at
  once would clobber each other's board. Serial is the simplest correct isolation. The
  documented upgrade — one user per worker via `parallelIndex` + a per-worker minted
  cookie — buys back full parallelism at the cost of more fixture machinery.
- **Sharding** — `--shard=1/3` splits the suite across *machines* in CI; merge the
  per-shard `blob` reports into one HTML report afterward.
- **Reporters** — yours is `[["list"], ["html", { open: "never" }]]`: live terminal
  progress **and** a rich browsable report, with `open: "never"` so it doesn't try to
  launch a browser tab in a non-interactive run. Others: `line`, `dot`, `json`,
  `junit` (for CI dashboards), `blob` (for shard-merging).

## C.10 The VS Code extension (worth installing)

"Playwright Test for VSCode" adds: a green ▶ in the gutter of every test, one-click
debug with breakpoints, a "Record new" button (codegen inside the editor), and a "Pick
locator" command. For a learning project it tightens the write → run → see loop more
than any CLI flag.

## C.11 Component testing (know it exists; not for here)

Playwright has an **experimental** component-testing mode (`@playwright/experimental-ct-react`)
that mounts a single React component in a real browser, no server. It's a different
setup from E2E and overlaps with what you'd do in Vitest + Testing Library. For *this*
app — where the value is in real user flows across auth, DB, and routing — full E2E
(what you built) is the right call. File this under "aware of, not adopting."

---

# PART D — Try this (hands-on, on YOUR suite)

Doc 10's exercises built locator instincts without running anything. These need the
suite running and build *operational* instinct. Do them in order.

1. **Watch a test think.** `npm run test:ui`, open
   `dashboard.spec.ts` → run one empty-board test. Step through the timeline and watch
   the three "No games here yet" placeholders resolve. Now open `log-session.spec.ts`
   → "closes itself after a successful save" and watch the success message appear, then
   the modal disappear. Confirm with your own eyes that no step says "wait 1200ms" —
   the assertion just polls until the modal is hidden (§A.5).

2. **Break a layer, watch the report point at it.** Temporarily rename the locator in
   `components/LogSessionModal.ts` from `getByLabel("Hours")` to
   `getByLabel("Hrs")`. Run `npm test`. Note that **every** log-session test fails with
   the *same* "locator not found: Hours" — and they all point at the one line in the
   COM, not at the specs. That's the three-layer payoff (doc 10 §"three layers") made
   tangible: one break, one fix site. Revert.

3. **Reach an element with the Pick-locator tool.** In UI mode, open the
   `/games/[id]` detail page snapshot and hover the status `<select>`. Confirm the tool
   suggests `getByRole("combobox")` — exactly what `GameDetailPage.ts` uses. Then hover
   a session row's 🗑 and see it suggest `getByTitle("Delete session")`. You're
   reverse-engineering the locator ladder from the live DOM.

4. **Feel a fixture's setup/teardown seam.** In `fixtures/data.ts`, add a
   `console.log("SETUP")` before `await use(seeder)` and `console.log("TEARDOWN")`
   after. Run a single data test. Watch the order: SETUP → (your test's logs) →
   TEARDOWN. You've just observed §B.3's `use()` seam directly. Remove the logs.

5. **Capture a trace on demand.** Run
   `npx playwright test log-session --trace on`, then
   `npx playwright show-trace` on the produced zip (path printed in the output).
   Click through the action snapshots and the network tab. This is the exact view
   you'd get from a CI flake under `trace: "on-first-retry"` — practise reading it now,
   when nothing's broken.

6. **Prove the API layer stands alone.** Write a throwaway test that uses **only**
   `request` (no `page`): `POST /api/play-sessions` with `hoursPlayed: 25` and assert
   the response is a 4xx. You've written a browserless API test using the same fixture
   your seeder uses (§C.5) — and tested the validation rule your UI tests *mock past*.

7. **(Stretch) Add an accessibility assertion.** `npm i -D @axe-core/playwright`, then
   in a new spec scan `/dashboard` with `AxeBuilder` (§C.7) and assert zero violations.
   If it flags something, you've found a real a11y bug — fix it the doc-10 way (a real
   `aria-*`/role fix), not by suppressing the rule.

---

## The one-paragraph summary

Playwright drives a browser **from a separate process** over a DevTools-style
protocol (§A.1); that vantage point lets it give every test a **fresh, cheap,
isolated context** (§A.2), describe elements as **lazy, re-queried locators** rather
than stale references (§A.3), and **wait intelligently** on actionability (§A.4) and
**retrying assertions** (§A.5) instead of sleeping. The `test`/`expect`/**fixtures**/
**projects** API (Part B) is the surface you compose — and your `backlog` fixture,
`request`-based seeding, and `setup → warmup → chromium` pipeline are textbook uses of
it. The trace viewer, UI mode, codegen, and the VS Code extension (Part C) are how you
*see* what tests do instead of trusting them. You've already built a suite that uses
all of this correctly; this doc just named the machinery so the next test you write is
deliberate, not cargo-culted.
