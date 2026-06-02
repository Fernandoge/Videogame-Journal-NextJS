// playwright/fixtures/data.ts — seed real backlog data over the app's HTTP API.
//
// Data-dependent specs (dashboard counts, game-card, log-session, review,
// game-detail, profile) need pre-existing rows. We create them through the SAME
// endpoints the app uses (POST /api/user-games, /api/play-sessions, /api/reviews),
// authenticated by Playwright's `request` fixture, which carries the test user's
// session cookie from the project storageState. Seeding via HTTP means we never have
// to import the (ESM) Prisma client into the test process — see global-setup.ts.
//
// Isolation: the whole suite runs with `workers: 1` (playwright.config.ts), so data
// tests run one at a time and never see each other's board. The `backlog` fixture
// also wipes the board before AND after each test that uses it, so a leftover row can
// never leak into the empty-board specs. (The parallel alternative — one user per
// worker — is noted in docs/learning/10-playwright-testing.md as a future upgrade.)

import { test as base, expect, type APIRequestContext } from "@playwright/test";

type GameStatus = "PLAYING" | "BACKLOG" | "COMPLETED" | "DROPPED";

// What POST /api/user-games returns (the bits the specs use).
export type SeededGame = {
  id: string; // UserGame id — the handle for sessions/reviews/status/cleanup
  status: GameStatus;
  game: { id: string; rawgId: number; title: string };
};

export class BacklogSeeder {
  constructor(private readonly request: APIRequestContext) {}

  // Deterministic positive rawgId from a title, in a reserved range (900_000_000+) so
  // it never collides with a real RAWG id. Same title → same id → same Game row,
  // mirroring the app's own de-duplication.
  private rawgIdFor(title: string): number {
    let hash = 0;
    for (const ch of title) hash = (hash * 31 + ch.charCodeAt(0)) % 1_000_000;
    return 900_000_000 + hash;
  }

  async addGame(opts: {
    title: string;
    status?: GameStatus;
    genre?: string | null;
    releaseYear?: number | null;
  }): Promise<SeededGame> {
    const status = opts.status ?? "BACKLOG";
    // POST only accepts PLAYING/BACKLOG/COMPLETED; DROPPED is reached via a PATCH.
    const createStatus = status === "DROPPED" ? "BACKLOG" : status;

    const res = await this.request.post("/api/user-games", {
      data: {
        rawgId: this.rawgIdFor(opts.title),
        title: opts.title,
        coverUrl: null,
        genre: opts.genre ?? null,
        releaseYear: opts.releaseYear ?? null,
        status: createStatus,
      },
    });
    expect(res.ok(), `seed addGame failed: ${res.status()} ${await res.text()}`).toBeTruthy();

    const { data } = await res.json();
    if (status === "DROPPED") {
      await this.setStatus(data.id, "DROPPED");
      data.status = "DROPPED";
    }
    return data;
  }

  async setStatus(userGameId: string, status: GameStatus): Promise<void> {
    const res = await this.request.patch(`/api/user-games/${userGameId}`, { data: { status } });
    expect(res.ok(), `seed setStatus failed: ${res.status()}`).toBeTruthy();
  }

  async logSession(
    userGameId: string,
    opts: { hoursPlayed: number; notes?: string },
  ): Promise<{ id: string }> {
    const res = await this.request.post("/api/play-sessions", {
      data: { userGameId, hoursPlayed: opts.hoursPlayed, notes: opts.notes },
    });
    expect(res.ok(), `seed logSession failed: ${res.status()}`).toBeTruthy();
    return (await res.json()).data;
  }

  async addReview(
    userGameId: string,
    opts: { score: number; body: string },
  ): Promise<{ id: string }> {
    const res = await this.request.post("/api/reviews", {
      data: { userGameId, score: opts.score, body: opts.body },
    });
    expect(res.ok(), `seed addReview failed: ${res.status()}`).toBeTruthy();
    return (await res.json()).data;
  }

  // Remove every backlog entry for the test user. Deleting a UserGame cascades to its
  // sessions + review, so this fully resets the board.
  async cleanAll(): Promise<void> {
    const res = await this.request.get("/api/user-games");
    expect(res.ok(), `seed cleanAll list failed: ${res.status()}`).toBeTruthy();
    const { data } = await res.json();
    for (const userGame of data) {
      await this.request.delete(`/api/user-games/${userGame.id}`);
    }
  }
}

// A custom `test` that hands data specs a `backlog` seeder and guarantees a clean
// board before AND after each test that uses it. Playwright instantiates fixtures
// lazily, so tests that DON'T destructure `backlog` (e.g. the empty-board cases) pay
// nothing and stay untouched.
export const test = base.extend<{ backlog: BacklogSeeder }>({
  backlog: async ({ request }, use) => {
    const seeder = new BacklogSeeder(request);
    await seeder.cleanAll();
    await use(seeder);
    await seeder.cleanAll();
  },
});

export { expect };
