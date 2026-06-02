// playwright/pages/ProfilePage.ts — the profile dashboard at /profile
// (app/profile/page.tsx, a pure Server Component).
//
// Everything here is derived data: four overview stat cards, a status breakdown, and
// three lists (recent sessions, recently completed, reviews). The name/email come from
// the session JWT, the rest from DB queries — so the data specs seed rows first.
//
// Two locator problems this page forces us to solve cleanly (both without CSS classes):
//   1. The stat cards and breakdown cells are <div><p>value</p><p>label</p></div> with
//      no role tying value→label. We locate the card by its (unique) LABEL text and let
//      the spec assert the value the card CONTAINS — scoping kills the "bare number
//      matches ten elements" problem.
//   2. There are THREE separate <ul>s, so a bare getByRole("listitem") is ambiguous.
//      We scope each list to its <section> (a real semantic element) via the section's
//      <h2> heading.

import { type Page, type Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

export class ProfilePage extends BasePage {
  readonly path = "/profile";

  // The user's name is the page's only <h1>.
  readonly name: Locator;

  // The three lists, each scoped to its own section so their <li>s never mix.
  readonly recentSessions: Locator;
  readonly recentlyCompleted: Locator;
  readonly reviews: Locator;

  // Each list's empty-state placeholder.
  readonly recentSessionsEmpty: Locator;
  readonly recentlyCompletedEmpty: Locator;
  readonly reviewsEmpty: Locator;

  constructor(page: Page) {
    super(page);
    this.name = page.getByRole("heading", { level: 1 });

    this.recentSessions = this.section("Recent sessions").getByRole("listitem");
    this.recentlyCompleted = this.section("Recently completed").getByRole("listitem");
    this.reviews = this.section("My Reviews").getByRole("listitem");

    this.recentSessionsEmpty = this.section("Recent sessions").getByText("No sessions logged yet.");
    this.recentlyCompletedEmpty = this.section("Recently completed").getByText("No completed games yet.");
    this.reviewsEmpty = this.section("My Reviews").getByText("No reviews written yet.");
  }

  // A <section> located by its heading text. <section> is a semantic element (not a
  // styling class), so this stays stable across restyles; exact:true keeps
  // "Recent sessions" from also matching "Recently completed".
  private section(heading: string): Locator {
    return this.page.locator("section").filter({
      has: this.page.getByRole("heading", { name: heading, exact: true }),
    });
  }

  // The user's email — a plain <p>, so found by its text (the spec passes the value).
  email(value: string): Locator {
    return this.page.getByText(value);
  }

  // An Overview stat card, located by its LABEL ("Total games" | "Hours played" |
  // "Sessions logged" | "Completed"). Returns the card (the label <p>'s parent <div>);
  // the spec asserts the value it contains, e.g. expect(stat("Total games")).toContainText("5").
  // The card's only text is value+label and labels have no digits, so toContainText on
  // the value is unambiguous within the card.
  stat(label: string): Locator {
    return this.page.getByText(label, { exact: true }).locator("..");
  }

  // A status-breakdown cell, located by its lowercase label ("playing" | "backlog" |
  // "completed" | "dropped"). Same value+label structure as a stat card. exact:true (and
  // the lowercase text) keeps it distinct from the Overview "Completed" card.
  breakdown(status: "playing" | "backlog" | "completed" | "dropped"): Locator {
    return this.page.getByText(status, { exact: true }).locator("..");
  }

  // One recent-session row by its (unique) notes text.
  recentSession(notes: string): Locator {
    return this.recentSessions.filter({ hasText: notes });
  }

  // One recently-completed row by its game title.
  completedGame(title: string): Locator {
    return this.recentlyCompleted.filter({ hasText: title });
  }

  // One review row by its game title.
  review(title: string): Locator {
    return this.reviews.filter({ hasText: title });
  }
}
