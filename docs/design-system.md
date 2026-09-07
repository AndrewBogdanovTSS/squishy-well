# Styling: where a value goes

Three tiers. Each has an admission test, so "should this be a shortcut" has an
answer that doesn't depend on taste. Config lives in
[`apps/web/uno.config.ts`](../apps/web/uno.config.ts); colors live in
[`apps/web/app/assets/app.css`](../apps/web/app/assets/app.css). Checked by
`pnpm check:styles` - see that script for exactly what it can and cannot see.

## Tier 1 - theme tokens

Font sizes and letter-spacing are a scale, not a pile of independent numbers -
`text-[0.68rem]` next to `text-[0.7rem]` next to `text-[0.72rem]` is the same
design decision typed three slightly different ways. `theme.fontSize` and
`theme.letterSpacing` in `uno.config.ts` name the scale once; every class
reaches it by name (`text-label`, `tracking-wide`), same as reaching for a
built-in like `text-sm`.

Current scale:

| fontSize | value | typical use |
|---|---|---|
| `micro` | 0.65rem | badges, dl labels, fine print |
| `label` | 0.7rem | section headings, nav, button labels |
| `body` | 0.8rem | buttons, secondary paragraphs |
| `lead` | 0.9rem | modal headings, intro text |
| `stat` | 1.15rem | score/level/lines readouts |
| `display` | clamp(3rem,12vw,6rem) | the one hero heading |

(`text-base` = 1rem is wind3's own built-in - reach for that directly rather
than adding a token that duplicates it.)

| letterSpacing | value |
|---|---|
| `tight` | 0.06em |
| `wide` | 0.1em |
| `wider` | 0.14em |
| `caps` | 0.2em |
| `title` | 0.28em |
| `hero` | 0.42em |

Colors are **not** a theme token here - see the project comment at the top of
`uno.config.ts`. A color reaches app.css's `:root` custom properties directly
(`bg-$panel`, `c-$muted`). For an alpha variant of a color that already has a
custom property, use the channel-triple form the same file defines
(`rgb(var(--accent-rgb)/8%)`) rather than a new literal - see the block
comment above `--accent-rgb` in app.css. `check:styles` flags a hex or
`rgba(<literal>)` written directly into a class bracket for exactly this
reason: the color has a source already, and the bracket is a second one.

Radius, similarly, usually isn't a new token - `rounded-xl` is 0.75rem, and
`rounded-full` clamps to a pill on any box smaller than the radius. Check the
built-in scale before reaching for a bracket.

**Adding a new step to the scale**: it earns its place the same way a Tier 2
shortcut does (below) - used more than once, or a real, load-bearing design
decision (the hero size is used exactly once and still gets a name, because
"the one clamp() the whole page has" is worth being able to find by grep).
One arbitrary bracket that doesn't fit the scale is a sign the scale is
missing a step, not license to bracket around it silently.

## Tier 2 - global shortcuts (`uno.config.ts` `shortcuts`)

A global shortcut is a **name for a design-system concept**, reachable from
any component. That reach is exactly what makes it expensive: every shortcut
here is a thing every future contributor has to learn exists before their
"just write utilities" instinct produces the same CSS by accident. Admission
requires all three:

1. **Used in two or more files** (repetition inside one file is Tier 3 -
   see 3a below - not a reason to go global), or forced global by a
   framework contract that never appears as literal text in a template (Vue's
   `<transition name="fade">` injects `fade-enter-active` etc. itself - there
   is no other way to give those four classes a declaration).
2. **Names a concept, not a location.** `panel` is a real thing this design
   has (the frosted card chrome used for HUD boxes, the debug sidebar, modal
   cards). `hud-hold-box` is not a concept, it's where one particular panel
   happens to sit - that belongs on the element in the component that owns
   it, not in a file every component loads.
3. **The declaration is pure utilities** - if it needs a raw CSS block, it
   almost always means a rule or a component prop was the right tool, not a
   shortcut.

The full list, and why each one is here:

| shortcut | why global |
|---|---|
| `f-col` | used everywhere a column flex is needed; no narrower home makes sense |
| `panel` | the frosted-card chrome, reused by the HUD, the debug sidebar and modal cards |
| `panel-pad` | `panel`'s default content padding, split out so a modal card can override it with a plain `p-6` instead of re-declaring four of `panel`'s five properties by hand to change one |
| `fade-enter-active` / `fade-leave-active` / `fade-enter-from` / `fade-leave-to` | Vue's `<transition name="fade">` contract - the classes are never written in a template, Vue applies them itself, so a shortcut is the only place their declaration can live |

That's the whole list, on purpose. If you're reaching for a new one, run the
"used in two files" test literally - `grep` for the exact class combination
first. Most repeated-looking clusters turn out to be Tier 1 tokens not yet
extracted (fix the scale) or the same handful of utilities that only look
identical until you check (not actually a duplicate).

## Tier 3 - component-local (the default answer)

Most repetition should never reach a global name. In order of preference:

**3a. Delete it with data, not a name.** A run of near-identical
`<dt>`/`<dd>` pairs, badges, or list rows is one shape repeated, which means
it's a `v-for` over a small local array, not five copies of the same markup.
See `GameHud.vue`'s stat lists or `debug.vue`'s state panel for the pattern:
the shape lives once in the template, the content lives in a `computed`.

**3b. A component prop.** When the repeated thing is "this component, but
slightly different" - a smaller size, a muted variant, rendered as a link
instead of a button - that's what component props are for. See
`GameButton.vue`'s `size` and `variant` props: they replaced both a
copy-pasted class list on every debug-panel button and a hand-copied
approximation of the button's own look on two page-exit links. A prop keeps
the look defined in exactly one file and typed, which a global shortcut
string is not.

**3c. A local class constant.** Last resort, for a class cluster that's
neither loopable data nor a sensible component variant: a `const` in
`<script setup>`, bound with `:class`. Prefer 3a or 3b first - a local
constant doesn't stop the next person from copy-pasting the literal string
instead of reusing the constant, the way a `v-for` or a prop structurally
does.

**Rejected: scoped `<style>` + `@apply`.** This codebase has zero `<style>`
blocks as of this writing. Reintroducing one gives styling two homes (Uno
classes and hand-written CSS) and a second transform
(`transformerDirectives`) to reach for - not worth it for what Tier 3 above
already covers with plain Vue.

## Why this split, not "shortcuts for everything" or "tokens for everything"

Tokens alone don't stop duplication - `text-label tracking-wider self-center
c-$muted` repeated six times is still six times, just with shorter words.
Shortcuts for everything is the opposite failure: a global name for
`hud-hold-box` is a name nobody outside `GameHud.vue` needed, sitting in a
file everybody loads. The tiers exist so each duplicate gets the cheapest fix
that actually removes it - a token if it's a scale value, a shortcut only if
it is genuinely cross-file and genuinely a concept, and component structure
(data or props) for everything else. That last bucket is deliberately where
most repetition should land.
