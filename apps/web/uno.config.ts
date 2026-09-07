import { defineConfig, presetWind3, transformerVariantGroup } from 'unocss'

/**
 * No `theme.colors` block. Every colour a class needs is reached with `$name`
 * (Uno's own shorthand for `var(--name)`) pointed straight at app.css's
 * custom properties - `bg-$panel`, `text-$muted`, `b-$border`. A theme entry
 * would be a second place defining the same colour a class could already
 * reach directly; this way there is exactly one. An alpha variant of one of
 * those colours (a hover tint, a glow) is a `rgb(var(--x-rgb)/N%)` bracket
 * pointed at the same custom property's channel-triple form, never a new
 * hex/rgba literal - see the comment above `--accent-rgb` in app.css.
 *
 * `theme.fontSize` / `theme.letterSpacing` below is the one place this file
 * *does* hold a scale, because unlike colour there is no existing app.css
 * value a `text-[0.7rem]` could instead point at - the scale has to be named
 * somewhere, and this is that. See docs/design-system.md for the full tier
 * rule this project uses to decide "token, global shortcut, or
 * component-local", which is also what `pnpm check:styles` enforces.
 *
 * `fontSize`'s keys are Tailwind's own scale names (xs/sm/md/lg/xl), not a
 * bespoke vocabulary - deliberately, so this project's values simply replace
 * wind3's defaults for those five names rather than living alongside them
 * under different words. The trade-off: `text-xs` no longer means "whatever
 * Tailwind ships", it means this project's 0.65rem, everywhere - two call
 * sites (play.vue's settings aside, debug.vue's nav) used the built-in
 * 0.75rem before this rename and silently picked up 0.65rem after it. Not a
 * bug: it is what overriding the scale means, and it is the same thing that
 * already happened to `letterSpacing`'s `tight`/`wide`/`wider` (Tailwind
 * defaults too) when that scale was first named.
 */
export default defineConfig({
  presets: [presetWind3()],
  /**
   * Lets a repeated variant prefix be grouped instead of restated per class -
   * `hover:(c-$accent bg-transparent)` instead of `hover:c-$accent
   * hover:bg-transparent`. A parse-time transform only; the CSS it produces
   * is identical to writing the prefix out on every class.
   */
  transformers: [transformerVariantGroup()],

  theme: {
    fontSize: {
      xs: '0.65rem',
      sm: '0.7rem',
      md: '0.8rem',
      lg: '0.9rem',
      xl: '1.15rem',
      display: 'clamp(3rem, 12vw, 6rem)',
    },
    letterSpacing: {
      tight: '0.06em',
      wide: '0.1em',
      wider: '0.14em',
      caps: '0.2em',
      title: '0.28em',
      hero: '0.42em',
    },
  },

  shortcuts: {
    'f-col': 'flex flex-col',
    panel: 'bg-$panel b b-$border rounded-xl [backdrop-filter:blur(8px)]',
    /**
     * Vue's <transition name="fade"> contract fixes these four class names -
     * it applies them itself, so they can never be written inline on an
     * element. A shortcut is the only way to keep their declaration in Uno
     * rather than in hand-written CSS.
     *
     * `transition-opacity` and `duration-140` are real utilities - no bracket
     * needed for either. Only the easing needs one, and only because there is
     * no utility for the bare CSS keyword `ease`: `transition-opacity` alone
     * carries Tailwind's own default curve (cubic-bezier(0.4,0,0.2,1)), which
     * is close enough to look right and different enough to not be the same
     * conversion as the original `transition: opacity 140ms ease`. `ease-*`
     * only ships named curves (linear/in/out/in-out) - `ease-[ease]` plugs
     * the literal keyword into that utility's arbitrary-value slot, which is
     * the smallest bracket that gets the exact original value.
     */
    'fade-enter-active': 'transition-opacity duration-140 ease-[ease]',
    'fade-leave-active': 'transition-opacity duration-140 ease-[ease]',
    'fade-enter-from': 'op-0',
    'fade-leave-to': 'op-0',
  },

  /**
   * Without this, none of the four fade-* rules above are ever generated.
   * Uno only emits CSS for classes it finds as literal text somewhere it
   * scans - and these four are never written in any template; Vue's
   * <transition> injects them into the DOM at runtime. A shortcut declares
   * what the class expands to, but declaring it is not the same as telling
   * Uno the class exists - safelist is that second, separate step.
   */
  safelist: ['fade-enter-active', 'fade-leave-active', 'fade-enter-from', 'fade-leave-to'],
})
