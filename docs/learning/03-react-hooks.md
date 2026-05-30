# 3. React Hooks

## What they are

Hooks are special functions that let components "hook into" React features like
state and side effects. They always start with `use`.

The rule: hooks can only be called at the top level of a component or another
hook — never inside an `if`, a loop, or a nested function.

---

## `useState` — memory inside a component

A component's variables reset on every render. `useState` is how you give a
component memory that persists between renders.

```tsx
const [count, setCount] = useState(0)
//     ^^^^^  ^^^^^^^^^  ^^^^^^^^^
//     value  updater    initial value
```

When you call `setCount(1)`, React re-renders the component with `count === 1`.
Without `useState`, setting `count = 1` would do nothing visible.

---

## In this project: `components/BacklogBoard.tsx`

```tsx
const [games, setGames] = useState<UserGameWithGame[]>(initialGames)
const [droppedOpen, setDroppedOpen] = useState(false)
```

`games` is the source of truth for everything on the board. When you add a game:
```tsx
function handleGameAdded(newGame: UserGameWithGame) {
  setGames((prev) => [newGame, ...prev])
  //        ^^^^
  //        "prev" is the current array — we return a new array with the new game prepended
}
```

Notice we never mutate the array directly (`prev.push(newGame)` would be wrong).
React requires you to return a **new** array — it compares old vs new to know
what to re-render. This is why state updates always use spread (`...prev`) or
`.filter()` or `.map()` to produce a new value.

---

## In this project: `components/GameCard.tsx`

```tsx
const [isUpdating, setIsUpdating] = useState(false)
```

This single boolean controls the loading state of the whole card. When an API
call is in flight, `isUpdating` is `true`, the card dims (via `opacity-50`), and
the buttons are disabled. When the call finishes, it resets to `false`.

```tsx
<div className={`... ${isUpdating ? "opacity-50" : ""}`}>
```

This is the standard pattern for async loading states in React: a boolean that
toggles before and after the `await`.

---

## `useEffect` — running code in response to changes

`useEffect` runs code **after** a component renders, whenever its dependencies change.

```tsx
useEffect(() => {
  // This runs after every render where `query` changed
  console.log("query changed to:", query)
}, [query]) // ← dependency array
```

The dependency array controls when the effect runs:
- `[]` — runs once, after the first render only
- `[query]` — runs after first render, and whenever `query` changes
- no array — runs after every single render (almost never what you want)

---

## In this project: `components/AddGameModal.tsx`

```tsx
useEffect(() => {
  if (isOpen) {
    setTimeout(() => inputRef.current?.focus(), 50)
  } else {
    setQuery("")
    setResults([])
    setError(null)
    setHasSearched(false)
  }
}, [isOpen])
```

This effect watches `isOpen`. When it becomes `true` (modal opens), it focuses
the input. When it becomes `false` (modal closes), it resets all the form state
back to empty. Without this cleanup, the old search results would still be
visible the next time you open the modal.

---

## `useEffect` cleanup function

When an effect returns a function, React calls it before running the effect again
(or when the component unmounts). This is for cancelling things.

The previous debounce code (before we replaced it with a button) used this:
```tsx
useEffect(() => {
  const timer = setTimeout(() => { /* search */ }, 400)
  return () => clearTimeout(timer) // ← cleanup: cancel the timer
}, [query])
```

If `query` changes before 400ms, React runs the cleanup (cancels the timer) then
runs the effect again with the new query. This prevents stale requests.

---

## `useRef` — a value that doesn't trigger re-renders

`useRef` stores a value like `useState`, but changing it does **not** cause a
re-render. The most common use is to get a direct reference to a DOM element.

```tsx
const inputRef = useRef<HTMLInputElement>(null)

// Later, in an effect:
inputRef.current?.focus() // directly call .focus() on the real DOM element
```

```tsx
// Attach the ref to a JSX element:
<input ref={inputRef} ... />
```

Without `useRef`, there's no way to call `.focus()` on a specific input from
inside JavaScript — you'd have to use `document.querySelector`, which is fragile.

---

## The rules of hooks

1. **Only call hooks at the top level** — not inside conditions or loops.
2. **Only call hooks inside React components or other hooks** — not in plain functions.

```tsx
// ✓ correct
function MyComponent() {
  const [value, setValue] = useState("")
  ...
}

// ✗ wrong — hook inside a condition
function MyComponent() {
  if (someCondition) {
    const [value, setValue] = useState("") // React will error
  }
}
```

The reason: React tracks hooks by the order they're called. If a hook is inside
an `if`, it might be called in a different order on different renders, breaking
React's tracking.

---

## Try this

1. Open `components/LogSessionModal.tsx`.
2. Find the `useState` calls at the top.
3. Count how many pieces of state the modal manages (hours, notes, date,
   isSubmitting, error, success, isOpen) — 7 separate states.
4. Trace what happens when you click "Save session": which states change, in what
   order, and what re-renders does that cause?

This mental exercise of tracing state changes is the core skill for debugging
React components.
