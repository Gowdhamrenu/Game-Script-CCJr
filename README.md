# GameScript (version3) — HTML/CSS-first Block Game Engine

This project is a small browser game “engine” designed for teaching.
Students can build worlds by editing **HTML + CSS** only.

- **Worlds** live in `index.html`
- **Styling** lives in `style.css`
- **Blocks (configs)** live in `blocks.js`
- **Engine runtime** lives in `engine.js`
- **World logic + input** lives in `main.js`

## Run

Open `index.html` in a browser.

Tip: if your browser blocks ES modules when opened as a file, use a simple local server.

## Pick a world (HTML-only)

In `index.html`, change the active world here:

```html
<div id="game" data-active-world="world-runner">
```

Options:

- `world-runner`
- `world-platformer`
- `world-dodger`
- `world-shooter`

Only the selected world is shown (handled in `style.css`).

## Controls

Common:

- **Start / Jump**: `Space` (or `ArrowUp`)
- **Pause**: `P` or `Esc`

Platformer / Dodger / Shooter:

- **Move**: `ArrowLeft` / `ArrowRight`

Shooter:

- **Shoot**: hold `X`

## How the “block” system works (mental model)

Each `.entity` is a `div` with CSS classes like:

```html
<div class="entity player gravity jump health" data-x="60" data-y="0"></div>
```

- The **CSS classes** on the entity act like “blocks”.
- `engine.js` loops over entities every frame.
- For each class, the engine runs a behavior with the same name (if it exists).
- Block **configuration** (numbers/strings) comes from `blocks.js` via the `BLOCKS` registry.

Example:

- `gravity` behavior reads `{ force: 0.4 }`
- `spawnRain` behavior reads spawn rate + template
- `shooter` behavior reads cooldown + bullet template

## Build a new world (recommended student workflow)

1. **Copy an existing world container** in `index.html`:

   - Example: duplicate `<div id="world-dodger" class="game-world"> ... </div>`

2. **Give it a new id**:

   - Example: `id="world-mynewworld"`

3. **Add entities** using `.entity` + block classes:

   - Player entity (usually class `player`)
   - Spawner entity (class `spawner` + a spawn block)
   - Any obstacles / goal objects

4. **Style it** in `style.css`:

   - Add rules for `#world-mynewworld`, plus `.player`, `.obstacle`, etc.

5. **Select it** by setting:

   - `data-active-world="world-mynewworld"` on `#game`

## Add new blocks/behaviors (teacher workflow)

If students are ready for a little JavaScript, you can expand the library:

- **New block config**: add to `blocks.js`
  - `defineBlock("myBlock", { ... })`
- **New engine behavior**:
  - Add a built-in behavior in `engine.js` (global feature), or
  - Register a world-specific behavior in `main.js` via:
    - `game.registerBehavior("myBlock", (entity, cfg, game) => { ... })`

## World summaries

- **World 1 — Runner** (`world-runner`)
  - Jump over obstacles, score increases over time.

- **World 2 — Platformer** (`world-platformer`)
  - Move + jump across platforms, touch the goal to win, falling off ends the run.

- **World 3 — Dodger** (`world-dodger`)
  - Move left/right and avoid falling objects; survive ~10 seconds to win.

- **World 4 — Shooter** (`world-shooter`)
  - Move left/right and shoot enemies; clear all enemies to win.

