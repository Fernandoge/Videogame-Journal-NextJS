# 2. React Fundamentals

## What it is

React is a library for building UIs out of **components** — reusable pieces of
UI that each manage their own content. A component is just a TypeScript function
that returns HTML-like syntax called JSX.

```tsx
function Greeting() {
  return <h1>Hello!</h1>
}
```

That's it. That's a React component.

---

## JSX — HTML inside TypeScript

JSX looks like HTML but it's actually TypeScript. A few key differences:

```tsx
// HTML uses class=""      JSX uses className=""
<div className="text-white">

// HTML uses onclick=""    JSX uses onClick={}  (camelCase, curly braces)
<button onClick={() => console.log("clicked")}>

// Curly braces {} let you put any JavaScript expression inside JSX
const name = "Fernando"
<h1>Hello, {name}!</h1>          // → Hello, Fernando!
<h1>Score: {10 * 2}</h1>         // → Score: 20
<h1>Year: {new Date().getFullYear()}</h1>
```

---

## In this project: `components/GameCard.tsx`

Open `components/GameCard.tsx`. It's a good example of a real component.

```tsx
export default function GameCard({ userGame, onStatusChange, onRemove }: Props) {
  // ...
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
      ...
    </div>
  )
}
```

The function receives data, and returns JSX. That's all a component is.

---

## Props — passing data into components

Props are the inputs to a component — like function parameters.

```tsx
// Defining what props a component accepts (TypeScript type):
type Props = {
  userGame: UserGameWithGame;
  onStatusChange: (id: string, status: GameStatus) => void;
  onRemove: (id: string) => void;
};

// Receiving them (destructured from the first argument):
function GameCard({ userGame, onStatusChange, onRemove }: Props) {
```

`onStatusChange: (id: string, status: GameStatus) => void` means "a function that
takes an id and a status, and returns nothing." Props can be any type — strings,
numbers, objects, or even other functions.

Using the component and passing props:
```tsx
// In BacklogBoard.tsx:
<GameCard
  userGame={userGame}
  onStatusChange={handleStatusChange}
  onRemove={handleRemove}
/>
```

---

## Conditional rendering — showing things based on conditions

```tsx
// In GameCard.tsx — only show the image if there's a URL
{game.coverUrl ? (
  <Image src={game.coverUrl} alt={game.title} fill />
) : (
  <div>🎮</div>
)}
```

The `condition ? <IfTrue /> : <IfFalse />` pattern is called a ternary. You can
also use `&&` for "only show if true":

```tsx
// Only render the genre line if genre exists
{game.genre && (
  <p className="text-xs text-zinc-400">{game.genre}</p>
)}
```

---

## Lists — rendering arrays with `.map()`

When you have an array of data and want to render a component for each item:

```tsx
// In BacklogBoard.tsx:
{columnGames.map((userGame) => (
  <li key={userGame.id}>
    <GameCard userGame={userGame} ... />
  </li>
))}
```

The `key` prop is required on list items — React uses it to track which item is
which when the list changes. Always use a unique, stable ID (like a database ID),
never the array index.

---

## In this project: `app/page.tsx`

The landing page uses `.map()` to render the feature cards from a plain array:

```tsx
{[
  { icon: "📋", title: "Backlog board", desc: "..." },
  { icon: "⏱️", title: "Session logger", desc: "..." },
  { icon: "⭐", title: "Reviews", desc: "..." },
].map((f) => (
  <div key={f.title}>
    <div>{f.icon}</div>
    <h3>{f.title}</h3>
    <p>{f.desc}</p>
  </div>
))}
```

Defining the data as an array and mapping over it is much cleaner than writing
three separate `<div>` blocks by hand — especially if the content changes.

---

## `export default` vs named exports

```tsx
export default function GameCard() { ... }  // only one per file
export function helper() { ... }            // named export, many allowed
export type { GameStatus }                  // exporting a type
```

Most components use `export default`. Named exports are for utilities and types.

---

## Try this

1. Open `app/page.tsx`.
2. Add a fourth feature card to the array:
   ```ts
   { icon: "🏆", title: "Achievements", desc: "Track your gaming milestones." }
   ```
3. Save and look at `http://localhost:3000` — the new card appears automatically
   because the JSX is generated from the array.
4. Notice you didn't have to write any new HTML — the `.map()` handles it.
