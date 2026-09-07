# SQUISHY WELL — tetris on Nuxt 4 + TresJS v5 + WebGPU/TSL

A guideline tetris: SRS with wall kicks, lock delay with a reset cap, 7-bag with a
seeded RNG, DAS/ARR owned by the simulation, replays — rendered through a WebGPU
pipeline with compute-shader debris, and a WebGL2 + CPU fallback that is a real
path rather than a promise.

```
packages/tetris-core   pure TypeScript engine — no Vue, no Three, no DOM, no clock
apps/web               Nuxt 4 app: TresJS scene, TSL effects, HUD, 2D debug renderer
```

> The numbers in this README are claims about the repository, and claims that
> nothing checks go stale in silence. `pnpm check:docs` checks them - the test
> count, the fixture's shape, the routes, the pinned versions. See
> [`docs/evidence-layer.md`](docs/evidence-layer.md) for that and the five other
> commands around it.

## Quick start

```bash
pnpm install
pnpm test          # engine unit + replay regression tests (vitest)
pnpm dev           # http://localhost:3000
pnpm build
pnpm typecheck
pnpm lint

pnpm check:docs    # are this README's claims still true?
pnpm fingerprint   # did engine behaviour change?
pnpm check:all     # and does anything actually run these?
```

### Version pinning

`three`, `@types/three`, `@tresjs/core` and `@tresjs/nuxt` are pinned to exact
versions on purpose — the TSL and WebGPU renderer APIs move between releases,
and an unattended minor bump here breaks materials in ways that are hard to
read. Everything else uses caret ranges.

If your pnpm enforces `minimumReleaseAge` (a supply-chain guard that refuses
packages published in the last N days), caret ranges resolve down to an allowed
version by themselves; only exact pins can hard-fail. Should one of the four
pinned packages ever trip it, either wait, or allow just that package:

```bash
pnpm config set minimumReleaseAgeExclude three
```

Routes:

| route         | what it is                                             |
|---------------|--------------------------------------------------------|
| `/`           | landing page, prerendered, no Three in the bundle      |
| `/play`       | the game (`ssr: false`)                                |
| `/play?bot=1` | the heuristic bot plays — attract mode and e2e harness |
| `/debug`      | the 2D reference renderer, step/pause/replay tools     |

Keys: `← →` move · `↓` soft drop · `space` hard drop · `Z`/`X` rotate · `A` 180 ·
`C`/`shift` hold · `P` pause · `R` restart. Everything is remappable; gamepad and
touch swipes are supported.

## Architecture

Three layers, three clocks, one direction of travel.

```
core/    fixed 1/60 s logical step, deterministic, zero framework imports
  │  events + raw snapshots, one way only
bridge/  Vue composables, input buffer, HUD          (rAF)
  │  imperative calls
view/    TresJS scene, TSL materials, RenderPipeline (GPU)
```

The boundary is enforced by `eslint.config.js`, not by convention: importing
`vue`, `three`, `pinia` or touching `window`/`performance` inside
`packages/tetris-core/src` is a lint error.

### Why the engine looks the way it does

- **`Uint8Array` board, 10 × 40.** One allocation, `.set()` copies, trivially
  hashable for replay tests, no GC pressure. Twenty buffer rows above the well
  are part of the guideline: pieces spawn there and a lock entirely inside them
  is a top-out.
- **`tick(dt, commands)` and nothing else.** The engine never reads a clock,
  never schedules anything, never calls back. That is what makes replays exact
  and tests fast.
- **DAS/ARR live in the tick**, not in `keydown` repeat. OS key repeat differs
  per machine and would make the same inputs produce different games.
- **A `CLEARING` phase.** The pause for the line-clear animation is a *rule*,
  not an animation detail, so the picture and the state cannot drift apart. The
  cleared rows stay on the board during the pause — the renderer needs them —
  and are removed when the phase ends (`ROWS_REMOVED`).
- **Seeded `mulberry32` + 7-bag.** Reproducible bugs, replay fixtures, daily
  challenges on a shared seed, and server-verifiable scores later.

### Reactivity policy

| data                        | storage                      | why                                                   |
|-----------------------------|------------------------------|-------------------------------------------------------|
| board (`Uint8Array`)        | raw + `boardVersion` counter | 200 cells through a deep proxy at 60 Hz is pure waste |
| active piece                | raw, read every frame        | the renderer interpolates it itself                   |
| score / level / next / hold | `reactive` HUD object        | changes rarely, goes to the DOM                       |
| settings, high scores       | Pinia + localStorage         | ordinary app state, which is what Pinia is for        |

The HUD is DOM on top of the canvas, not 3D text: cheaper, selectable, and it
reaches a screen reader (`aria-live` on score, `role="status"` on level).

### Styling

UnoCSS (`presetWind3`, config in `uno.config.ts`), utility classes only — no
scoped `<style>` blocks anywhere in `apps/web`. Colours are reached with Uno's
`$name` shorthand (`b-$border`, `bg-$panel`) straight into the custom
properties `app.css` already defines, so there is exactly one place a colour
is named, not a `theme.colors` table duplicating it. Interactive chrome
(`GameButton.vue`) is a real component rather than a global `button {}` rule:
Tailwind's preflight reset (`nuxt.config.ts`'s `unocss.preflight`) resets bare
element selectors at the same specificity it would take to style them, so a
global rule and the reset silently race on load order. A class on a component
always wins regardless of that order.

## Rendering notes

- `TresCanvas` takes a **synchronous** renderer factory. TresJS calls
  `renderer.init()` itself and starts its loop afterwards — returning a promise
  from the factory hands it something that is not a renderer.
- Backend detection watches `renderer.isInitialized`, not the `onReady` hook:
  the hook can fire before a child component mounts and does not replay.
  `navigator.gpu` says nothing about which backend you actually got.
- With post-processing on, the **pipeline** renders, not TresJS:
  `useLoop().render()` replaces the render function. `three.RenderPipeline` is
  the current class (`PostProcessing` is a deprecated alias in r185).
- Camera, key light and every instanced mesh are built imperatively and mounted
  through `<primitive>`. Writing to a reactive Tres proxy 60 times a second ends
  in "maximum recursive updates".
- The stack is one `InstancedMesh` resynced on `boardVersion`, never per frame.
  Scratch `Matrix4`/`Vector3` objects live at module scope.
- Screen shake is a camera offset, not a post effect.
- **Block material** (`blockMaterial()` in `lib/three.ts`) is glass/jelly, not a
  flat cube: cheap subsurface scattering lets light that entered the far side
  of a block transmit through, so the neon tubes light blocks dynamically from
  behind rather than the material just reflecting an ambient colour.
- **Neon tube lighting**: the same `NEON_TUBES` definitions in `lib/three.ts`
  drive both the visible fixtures and the real lights, so they can't disagree.
  Their colour is a "slowly walking" animated gradient rather than a static
  wash, and the wall pair's gradient runs edge-to-edge. The top tube is a
  directional "monitor" light kept deliberately out of view — no visible
  fixture, only the wash it throws down the well — and the ghost piece is
  kept alongside it rather than replaced, since the shadow alone read as too
  subtle a landing cue on its own.
- **Contact-squash timing** (`ActivePiece.vue`): the wobble on landing keys
  off the frame the *rendered* piece reaches its resting depth
  (`CONTACT_EPSILON`), not the engine's `LOCK` event. The engine holds a
  grounded piece for the full lock-delay window (up to ~466 ms) before `LOCK`
  fires, so hanging the animation on that event reads as a stuck delay before
  the wobble kicks in. Hard drops squash on `LOCK` instead, in `BoardBlocks.vue`
  — a hard drop locks in the same call that moves the piece, so it never
  renders in a grounded-but-not-locked state for the contact check to catch.
- Line-clear debris (`useShatterVFX.ts`) is weighted to fall rather than
  scatter outward and up — the blocks read as liquid containers, so a clear
  should look like spilled liquid, not shattered debris.

### Particles

| tier    | condition                                | debris                                       |
|---------|------------------------------------------|----------------------------------------------|
| high    | WebGPU backend                           | GPU pool, 256 per cell, ring-buffer emission |
| medium  | WebGPU on a slow frame budget, or WebGL2 | smaller pool / CPU pool                      |
| low     | adaptive downgrade                       | CPU pool, 24 per cell                        |
| minimal | `prefers-reduced-motion` or user choice  | no particles, short row flash                |

The GPU path allocates its buffers once and emits with a ring cursor — spawning
a particle system per line clear is how you get a frame hitch exactly when the
game is at its most dramatic. The WebGL2 backend renders the same TSL materials
but has **no compute shaders at all**, so the simulation moves to typed arrays.
Components never learn which path they got; the branch lives in
`useShatterVFX.ts`.

## Accessibility

Not cosmetic here — bloom plus flashes plus shake is exactly the risky
combination.

- Flashes are rate-limited to one per 340 ms (WCAG 2.3.1, three per second).
- `prefers-reduced-motion` disables shake, aberration and hitstop and drops the
  particle tier; there is also a manual toggle for people whose OS setting lies.
- A high-contrast palette separates pieces by **luminance**, not hue, for
  deuteranopia.
- Full key remapping, gamepad support, pause on blur.

## Testing

```bash
pnpm test                                  # 71 tests: SRS, bag, lock delay, scoring, fuzz, replay
pnpm --filter @tetris/core fixtures        # regenerate replay fixtures (only when a rule change is intended)
pnpm --filter @tetris/web test:e2e         # playwright smoke, both backends
```

- **SRS** is checked structurally as well as by value: every reverse transition
  must be the exact negation of its forward table, which is the property that
  catches a flipped Y sign — the worst possible bug in this project, because the
  game still *almost* works.
- **Replay fixtures** are the main regression tool. `bot-game.replay.json` is a
  30 000-tick heuristic-bot game: 474 pieces, 178 lines, level 18, ending in a
  20G top-out. If any rule changes by accident, its fingerprint moves.
- **Fuzz**: 50 seeded games × 2000 random inputs assert the board never holds a
  stale full row outside `CLEARING`, the active piece never overlaps the stack,
  and the score never goes backwards.
- **No visual snapshots of the 3D scene** — they are unstable across drivers and
  three releases. The 2D debug renderer is the deterministic reference instead.

## Milestone status

|    |                                                                                     |                                              |
|----|-------------------------------------------------------------------------------------|----------------------------------------------|
| M0 | engine + tests + 2D reference renderer                                              | done                                         |
| M1 | Nuxt 4 + TresJS 5 + WebGPU renderer, backend detection, resize fit                  | done                                         |
| M2 | 3D board, active piece, ghost, DOM HUD                                              | done                                         |
| M3 | DAS/ARR, hold, next queue, hitstop, squash, procedural audio, `feel.ts` + Tweakpane | done                                         |
| M4 | RenderPipeline, bloom, ACES, chromatic aberration, FXAA, vignette-free neon         | done                                         |
| M5 | TSL compute particle pool + CPU fallback, quality tiers                             | done                                         |
| M6 | menus, settings, a11y toggles, pause, game over, local high scores                  | mostly done — key remapping UI still missing |
| M7 | adaptive quality, replays, mobile swipes                                            | done except a Nitro leaderboard and deploy   |

## Verified how

- `pnpm test` — 71/71 green; `pnpm typecheck` clean in both packages; `pnpm build`
  succeeds (2.25 MB total, three is split into the `/play` chunk only).
- Both pages were driven in a headless Chromium: the bot played 27 lines to
  level 3 in the 3D scene with **zero console errors**, particles, collapse,
  shake and the post pipeline all running.
- That browser forced the **WebGL2 fallback** path, so the fallback is tested
  end to end. The WebGPU compute path could not run there: that Chromium ships
  an older Dawn than three 0.185 expects (`GPUTextureViewDescriptor.swizzle`),
  which is an environment mismatch, not a code path in this repo. Run
  `pnpm --filter @tetris/web test:e2e` on a current Chrome to exercise it.

## Known gaps / next

- Key remapping UI (the input layer already supports it fully).
- Particle collision with the settled stack — deliberately deferred; it needs the
  board as a storage buffer and is barely visible behind bloom.
- Nitro leaderboard with server-side replay validation (the replay format and the
  deterministic engine are already in place for it).
