# 1. TypeScript Fundamentals

## What it is

TypeScript is JavaScript with a type system on top. It doesn't change how your
code runs — it only exists at development time to catch mistakes before they
become bugs.

The key idea: you tell TypeScript what *shape* your data has, and it warns you
if you ever treat data as the wrong shape.

```ts
// JavaScript — no complaints, crashes at runtime
const user = { name: "Fernando" }
console.log(user.email.toUpperCase()) // 💥 Cannot read properties of undefined

// TypeScript — catches it before you even run the code
const user: { name: string } = { name: "Fernando" }
console.log(user.email.toUpperCase()) // ❌ Property 'email' does not exist
```

---

## Basic type annotations

A type annotation is the `: SomeType` you write after a variable or parameter.

```ts
const title: string = "Elden Ring"
const year: number = 2022
const isCompleted: boolean = true
const tags: string[] = ["RPG", "Action"] // array of strings
```

In practice you rarely annotate simple variables — TypeScript infers them:

```ts
const title = "Elden Ring" // TypeScript already knows this is a string
```

You mainly write annotations on **function parameters and return types**, where
TypeScript can't infer the shape on its own.

---

## In this project: `lib/types.ts`

Open `lib/types.ts`. This file exists entirely to define shapes.

```ts
export type GameStatus = "PLAYING" | "BACKLOG" | "COMPLETED" | "DROPPED";
```

This is a **union type** — `GameStatus` can only ever be one of those four exact
strings. If anywhere in the code you accidentally write `"PLAYIN"`, TypeScript
catches it immediately.

```ts
export type Game = {
  id: string;
  rawgId: number;
  title: string;
  coverUrl: string | null;  // ← "string OR null" — the value can be missing
  genre: string | null;
  releaseYear: number | null;
};
```

`string | null` is another union type — it means "this value is either a string
or it doesn't exist." The `| null` forces every part of the codebase to handle
the case where a game has no cover art.

```ts
export type UserGameWithGame = {
  id: string;
  status: GameStatus;   // ← reusing the type we defined above
  addedAt: string;
  game: Game;           // ← nested type — a UserGame contains a Game
};
```

---

## The `?` operator — optional properties

```ts
type User = {
  name: string;
  bio?: string; // ← the ? means this property might not exist
}
```

In `lib/rawg.ts`:
```ts
export type RawgGame = {
  background_image: string | null; // exists but can be null
  released: string | null;         // exists but can be null
  genres: { id: number; name: string }[]; // array of objects
};
```

Notice `genres` is typed as an array of objects with a specific shape —
`{ id: number; name: string }[]`. TypeScript knows every item in that array
has exactly those two fields.

---

## `type` vs `interface`

You'll see both in TypeScript codebases. For this project, use `type` — they're
equivalent for object shapes and `type` is more flexible.

```ts
type Game = { title: string }      // ✓ what we use
interface Game { title: string }   // also valid, slightly different rules
```

---

## Generics — types with parameters

Generics let you write a type that works for *any* inner type, decided later.

```ts
// useState is generic — you tell it what type the state holds
const [games, setGames] = useState<UserGameWithGame[]>([])
//                                 ^^^^^^^^^^^^^^^^^^^
//                                 "this state holds an array of UserGameWithGame"
```

Without the generic, TypeScript would only know it's `never[]` (an empty array
of unknown type) and wouldn't let you push `UserGameWithGame` objects into it.

You'll see generics written as `<T>` in documentation — `T` is just a placeholder
name, like a variable for a type.

---

## The `as` keyword — type casting

Sometimes TypeScript can't figure out a type on its own. You can manually tell it:

```ts
// In components/GameCard.tsx:
onChange={(e) => handleStatusChange(e.target.value as GameStatus)}
```

`e.target.value` is just a `string` as far as TypeScript knows. We *know* it will
only ever be one of the GameStatus values (because the `<select>` only contains
those options), so we cast it with `as GameStatus`.

Use `as` sparingly — it overrides TypeScript's checks. If you're using it a lot,
it usually means the types need to be designed better.

---

## `unknown` vs `any`

`any` turns off TypeScript for that value — avoid it.
`unknown` means "I don't know the type yet, but I'll check before using it."

In `app/api/user-games/route.ts`:
```ts
} catch (err: unknown) {
  if (
    typeof err === "object" && err !== null && "code" in err &&
    (err as { code: string }).code === "P2002"
  ) {
```

We catch an error as `unknown` (safe), then narrow it step by step before using
it. This is safer than `catch (err: any)` which would let you access `.anything`
without checks.

---

## Try this

1. Open `lib/types.ts` and change `GameStatus` to remove `"DROPPED"`.
2. Save the file and look at the red underlines that appear elsewhere.
3. Notice which files complain — those are every place in the codebase that
   references `"DROPPED"`. TypeScript found them all instantly.
4. Undo the change.

This is the power of TypeScript: refactoring and catching mistakes across an
entire codebase in seconds.
