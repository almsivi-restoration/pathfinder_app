---
description: "Blueprint: how a UI theme / skin is produced for Game Master's Workbench — deriving a look from reference screenshots, generating textures with an image API, wiring CSS without the cover-crop and origin traps, and verifying against real rendered pixels. Load when building or editing a theme, generating UI textures, or tuning a skin."
name: "bp-ui-theme-generation"
version: "2.0.0"
applyTo: "frontend/src/**,frontend/public/themes/**,artifacts/local/**_ui/**"
---

# Blueprint: UI Theme Generation

## Purpose

A theme here is a skin over the shared component DOM: a set of `--mw-*`
token overrides plus selector overrides for geometry, optionally backed
by generated textures and bundled fonts. Themes are *configuration*, not
new markup. This blueprint codifies how a theme is derived from reference
material, how its textures are generated, and — above all — how it is
*verified*, because the recurring failure mode in this space is an agent
that trusts its own narration over the rendered pixel.

## Holotype

The built-in `dissidia` theme
([frontend/public/themes/dissidia/theme.css](../../frontend/public/themes/dissidia/theme.css)):
token overrides in `:root`, geometry overrides on the baked component
selectors (`.mw-banner`, `.gm-header`, panels), `@font-face` with relative
font URLs, and three generated textures referenced relative to the CSS
file (`banner-strip.jpg`, `panel-sheen.jpg`, `waves.png`). Its generation
scripts live beside the working copies in
`artifacts/local/dissidia_ui/` (`gen_banner.sh`).

The built-in `pokemon` theme
([frontend/public/themes/pokemon/theme.css](../../frontend/public/themes/pokemon/theme.css))
is the second exemplar and the one to copy for a *pixel-era* skin: no image
model at all — its tiles are hand-placed 16px pixel art upscaled with
NEAREST (`artifacts/local/pokemon_ui/gen_assets.py`), and it shows a
per-screen metaphor (player view as the battle screen, Chronicle as a DMG
LCD) layered on the shared panel contract. It was built in one pass from a
single prompt by following the procedure below, which is why the procedure
is written down.

## Procedure — building a new shipped theme

This is the order that worked. Each step's output is the next step's
input; skipping one is how a theme ends up as a palette swap, a font that
can't render digits, or a frame on a page nobody looked at.

1. **Survey the mechanism, not the mood.** Read `frontend/src/theme.js`
   (how a skin loads), `electron.js` `BUILT_IN_EXTRA_THEMES` (how a
   built-in registers), one existing built-in sheet end to end, and the
   base `frontend/src/styles/theme.css`. Then build the **selector
   inventory**: grep every `frontend/src/styles/*.css` and `App.css` for
   rule selectors and every `background`/`border`/`font` the component
   sheets *bake* (the panels, header bars, rows, badges, inputs, the HP
   bar). The inventory is the list of things the skin must redeclare; a
   skin written from memory misses the ones the base backdrop was
   quietly carrying.
2. **Write the design brief before any CSS.** One paragraph at the top of
   `theme.css`: the reference era, the *structure* (light or dark
   surfaces, where ornament lives, the selection idiom, the accent), and
   a **per-screen metaphor** — what the player view *is* in this world,
   what the Chronicle *is*, what a header bar *is*. The player view is the
   screen players stare at for four hours; it deserves the strongest idea.
   Decide what the accent slot (`--mw-gold`) means here and what
   `--mw-turn-accent` means; they need not be the same color.
3. **Choose and verify fonts** (OFL, bundled with the license file). Render
   `0123456789`, `fi`, and a real stat string at the component sizes with
   every candidate before committing to one — see the digit-legibility
   rule below. Display face and body face are separate decisions.
4. **Make or generate textures.** Match the instrument to the era: a
   pixel-era skin gets hand-placed tiles from a PIL script (deterministic,
   seamless, no model); a painterly skin gets the image API with prompts
   written for the *container* (see the texture section). Every asset
   gets a generator script or a prompt file beside the working copies
   under `artifacts/local/<theme>_ui/`, and is measured, cropped to the
   element's aspect, and sized before it is referenced.
5. **Remove inline-color traps as you find them.** If a component paints
   a palette value inline, move it to a `--mw-*` token selected by a
   class in the same change (the HP bands are the precedent); the base
   renders identically and every skin gains the hook. Update the tests.
6. **Write `theme.json` + `theme.css` as overrides on the base**,
   redeclaring every selector in the **panel list** and **header list**
   below with a full `border` / `background` shorthand. Parse the sheet
   (postcss) before building on it.
7. **Register and document in the same change:** `BUILT_IN_EXTRA_THEMES`
   in `electron.js`, the Help and About strings (single-quoted — `node
   --check` after editing), `cp public/electron.js public/preload.js
   build/`, README (feature bullet + Themes section), PROJECT_SETUP
   (feature list + tree), the lexicon's Local Theme row, and this
   blueprint's holotype list if the theme teaches something.
8. **Capture every screen of every built-in** with
   `frontend/scripts/theme-capture.js` (prereqs in its header) and *look at
   the pixels*: zoom crops of digits, frame corners, hovered text. Fix,
   re-capture, repeat. The capture set is the review artifact; a theme
   whose screens were not all captured is not done.
9. **Revise the base from captures, not from recollection.** A pass over
   an existing skin starts by capturing it; the defects in the captures
   are the scope.

### The selector contract

A skin that wants its own silhouette must redeclare **`border`** (full
shorthand — it resets any base `border-image`) and **`background`** on
every selector in these lists. Missing one is how a Morrowind stone frame
ended up on Dissidia's Encyclopedia.

- **Panels:** `.mw-panel`, `.scene-creator`, `.left-panel`,
  `.right-panel`, `.load-section`, `.new-section`, `.actor-form`,
  `.actor-edit-modal`, `.actor-view-modal`, `.reference-sources`,
  `.reference-search`, `.bestiary-picker`, `.player-actor-row`.
- **Header bars:** `.gm-header`, `.player-header`, `.actor-header`,
  `.mw-banner`.
- **Bare-on-backdrop surfaces** (no panel in the base; plate them if the
  skin's backdrop is light or busy): `.encyclopedia-header`,
  `.bestiary-header`, `.reference-reader-header`, `.bestiary-source`,
  `.bestiary-search-panel`, `.bestiary-detail`.
- **Rows/wells:** `.template-row`, `.scene-library-row`,
  `.initiative-item`, `.edit-list-row`, `.bestiary-result-row`,
  `.reference-result`, `.round-info`, `.campaign-button`, `.actor-list`,
  `.initiative-order`; and `input[type='search']` alongside the text,
  number, select, and textarea rules.

When a selector is added to the base panel or header rules, add it here
and to every shipped skin in the same commit.

## Contract

### Deriving a look from reference screenshots

- **Read the reference before writing a token.** Extract the actual
  palette (dominant surface, text, accent, selection) and the *structure*
  (which surfaces are light vs dark, where ornament lives, what the
  heading face is). Do not produce a "palette swap" of the existing theme
  and call it the new one — the first dissidia attempt failed exactly this
  way and the user read it as "halfhearted." If the reference's menus are
  light with dark text and a saturated selection bar, that is a different
  *structure*, not a different hue.
- **The font is load-bearing.** A mismatched typeface reads as "the same
  theme" even when every color is right. Bundle the face under a
  redistributable license (OFL) with `@font-face` and the license file
  riding alongside; family names must match what you actually ship.
- **Verify a body face's digits at the rendered pixel before wiring it.**
  This is a GM tool: HP, AC, and rolls are the content. The first pokemon
  body face (Pixelify Sans) looked right in the specimen and rendered
  `30/45` as `30/4S` and `Ironfist` as `IronAst` in the app capture. Render
  `0123456789`, `fi`, and a real stat string with every candidate at the
  sizes the components actually use (PIL is enough), and reject any face
  whose 5/S, 3/8/9, or ligatures blur — before the theme is written around
  it.
- **Pixel faces run small for their nominal size.** A face drawn on a
  20px grid (Jersey 20) at the component sheets' 14px is a 10px read.
  Step body copy up in the theme (`body`, rows, inputs) rather than
  shrinking the design to the font.
- **Find the surfaces the base backdrop was carrying.** Some components
  have no panel of their own and only read because the Morrowind backdrop
  is dark (Bestiary's search/detail columns, its source row, the page-level
  `h2`s). A light or busy backdrop exposes every one of them; walk every
  screen in the capture harness, not just the ones you styled.
- **Inline colors defeat tokens.** A component that paints a palette value
  inline (the player HP bar's green/yellow/red once did) cannot be skinned
  without `!important`. Move the value to a `--mw-*` token and select it
  with a class (`hp-high/mid/low`) in the same change — the base theme
  renders identically and every skin inherits the hook.
- **A local theme is userData-only; a built-in is vendored.** Local themes
  live under the app's `userData/themes/<id>/`. A built-in ships in-repo
  under `frontend/public/themes/<id>/` and is registered in
  `electron.js`'s `BUILT_IN_EXTRA_THEMES` with `extraResources` copying it
  to `resources/themes/`. Built-in CSS is written as overrides layered on
  the base (morrowind) stylesheet — same contract as a local theme.

### Using ripped/extracted game assets (a font of real failure)

- **Verify the pixels before composing — never trust a filename.** A glob for
  `win_*` returned a FONT/GLYPH atlas that was composed into a dialog window;
  every derived element (border, streak, "filigree corner") was pareidolia on
  letterforms. A name is a hypothesis; the pixels are the fact.
- **A doc's own "VERIFIED" label is not evidence.** The same theme's asset
  table called `cmn_win_help_*` "the real dialog window" and, separately,
  `panel-weave.png`'s source "verified: menu crosshatch" — both wrong, neither
  ever actually pixel-checked; the labels just repeated an earlier guess with
  more confidence. Re-derive from raw pixels whenever a prior claim is
  load-bearing for new work, even (especially) your own project's claim.
- **A repeating tile with baked-in variable content can still yield a reusable
  overlay.** If several instances of a tile share an identical frame/border
  but differ in the middle (per-character portraits, per-class cards), diff
  3+ instances (`diff_extract.py` in
  `dwemer_puzzle_box/.github/skills/asset-library-inventory/scripts/` — keep
  pixels identical across all samples, transparent elsewhere) instead of
  discarding the whole family as "has content baked in, unusable."
- **`border-image` is the direct win for a rectangular frame ring — no manual
  9-slice composition needed.** Crop the extracted ring to its tight alpha
  bounding box, measure the solid border thickness per side straight from the
  alpha channel (do not guess), and wire
  `border-image: url(...) <top> <right> <bottom> <left> / <width> / 0 stretch`
  with no `fill` keyword — the discarded middle slice is exactly where a
  per-instance icon/text would have bled through. This shipped clean at both
  dialog scale and full-panel scale from the same source asset.
- **Some 9-slice kits genuinely need manual piece composition instead.**
  PSP-era dialogs sometimes ship as 16x16 pieces (corners, edges, fill) with
  no single tile containing the whole ring. Compose them into the element's
  aspect ratio at native piece scale — do NOT stretch a whole atlas with
  `100% 100%` (a portrait atlas in a landscape element squashes ~5:1 and warps
  every ornament). Match asset aspect to element aspect, or build the asset AT
  the element's aspect from the kit.

### Generating a texture with an image API

- **A generated 9-slice frame is a one-shot win if the prompt pins the
  geometry.** Ask for a square ring whose outer edge *is* the image edge,
  a uniform thin band (state the percentage), a dead-straight inner edge,
  and a solid pure-black interior — then *measure* the band from the pixels
  (scan to the first black pixel on each side), mirror one quadrant across
  both axes so the four corners are identical and every edge slice is
  symmetric (a symmetric slice joins to itself seamlessly under `round`),
  make the interior transparent, and wire
  `border-image: url() <slice> / <width> round` with no `fill`. Morrowind's
  `frame-stone.png` (`artifacts/local/theme_pass/prompts/mw-frame.txt`)
  shipped from the first generation this way.
- **The `border` shorthand resets `border-image`.** That is the insulating
  mechanism — and the leak path. A frame applied in the base sheet reaches
  every panel selector a skin does *not* redeclare `border` on. Dissidia's
  panel list was missing `.reference-sources`, `.reference-search`, and
  `.bestiary-picker`, and the Encyclopedia grew a Morrowind stone frame
  (the user spotted it mid-capture; the agent's dashboard-only review
  missed it). When a frame lands in the base, diff the base selector list
  against each skin's panel list and review every page capture.
- **Crop a hover/selection texture below its sheen.** A glossy bar's
  brightest band is where white hover text goes to die; crop the strip from
  the saturated zone and add a light scrim plus a text shadow.

- **Design the prompt for the container, not for the picture.** An image
  model asked for "a nameplate" returns a *complete ornate object*
  floating in a margin; a menu bar is a *texture to be sampled*. State the
  final aspect ratio in the prompt ("a thin nameplate ribbon, ~13 times
  wider than tall"), demand **full-bleed** ("the image IS the strip, no
  background, no margin"), and place the detail where the element will
  actually show it (e.g. "filigree along the top and bottom long edges, a
  calm center band for overlaid text").
- **Diffusion models favor a bordered object in a void.** Even a good
  prompt can return one. *Measure the result* (see verification) before
  wiring it in — do not trust the thumbnail.
- **Keep the API key out of the repo.** Read it from a gitignored file at
  runtime; never inline it. A missing key requires the user, not a
  workaround.

### CSS asset-fit traps (each one burned real time)

- **`cover` + `center` crops, silently.** On a short wide element
  (a ~13:1 banner) fed a squarer source, `cover` keeps only a thin
  vertical slice of the image, centered. If the source's detail lives at
  its edges, the detail is cropped away *before a pixel renders* — no
  overlay/opacity tuning reveals it. Fix at the **source**: pre-crop the
  image to roughly the element's aspect so `cover` loses nothing, or
  generate it full-bleed at that aspect.
- **A flat crop is not a CSS bug.** If the exact pixels the browser would
  show are flat (low luminance variance), no stylesheet change creates
  detail. Crop the real element-sized region and profile it; if it's flat,
  find the detail band in the source or accept a gradient.
- **Overlay scrims are for legibility, not rescue.** To keep title text
  readable over a textured band, use a *banded* scrim — near-transparent
  over the ornament, opaque behind the text line — not a uniform wash that
  dims the whole asset.
- **Electron caches `file://` stylesheets by URL.** "Reload Themes" with
  an unchanged `theme.css` URL serves the stale copy. Cache-bust the href
  (`?v=<timestamp>`) or fully relaunch. The bridge already does this for
  the live theme; harnesses that inject their own link must do it too.

### Verification — the non-negotiable part

- **Verify against the rendered pixel, not the narration.** The only
  trustworthy evidence is a real (non-offscreen-simulated) Electron
  `capturePage()` of the element, luminance/variance-profiled. A Python
  composite "simulation" and a `view_image` glance are not evidence.
- **`view_image` can return blank for a valid PNG.** A blank read is not
  "no content." Verify the file programmatically (`PIL`, ASCII render,
  pixel-fraction stats) before concluding anything.
- **Two harness traps produce false "it's broken" captures:** (1) driving
  the theme `<link>` from a `data:`-URL page — Electron blocks the
  `file://` stylesheet cross-origin and it silently no-ops, while the real
  app loads it from a `file://` origin and works; (2) capturing before the
  background image finishes loading — a flat render that resolves on its
  own. Probe the image (`new Image().onload` reporting natural size)
  before trusting any capture.
- **A base-sheet change is a change to every theme — capture all of them.**
  The base (Morrowind) component sheets are the floor the vendored skins
  stand on. When a base surface changes (the HP gauge, a badge), run the
  harness against every built-in (`node frontend/scripts/theme-capture.js
  <id>`) before committing: the 2026-11-03 pass fixed the
  Morrowind round badge and silently turned Dissidia's blue one into a dark
  nameplate until the capture showed it.
- **Revise by capture, not by memory.** A revision pass on an existing skin
  starts with a fresh capture of every screen; the defects it finds are
  the scope. The same pass found four Dissidia contrast failures (navy
  arrows on navy tiles, blue header labels on navy, the dirty indicator,
  white HP numerals on a white channel) that had shipped in three releases.
- **Two-strike rule.** After two "still doesn't look right" reports on the
  same asset, stop tuning numbers by intuition and go measure the pixels,
  or fall back to a plain CSS solution.

## When this doesn't fit

A one-off inline style for a single component's local state (a hover, a
transient highlight) is not a theme concern and needs no texture pipeline.
This blueprint governs *skins* — looks meant to be switched, shipped, or
reused. If a texture genuinely can't carry the design (a flat gradient
reads better), prefer the gradient and say so; a generated image is a
means, not a requirement.

## Revision notes

- 1.3.0 — added the `pokemon` built-in as a second holotype (pixel art
  generated programmatically, no image model), and four lessons from it:
  digit-legibility verification for body faces, pixel-face sizing, surfaces
  the base backdrop was carrying, and inline colors vs. tokens.
- 1.4.0 — revision pass over Morrowind and Dissidia: base-sheet changes
  must be captured under every built-in; revision scope comes from a fresh
  capture, not recollection.
- 1.5.0 — generated-asset pass over Morrowind (carved 9-slice frame via
  `border-image`) and Dissidia (header light-streak band, glossy selection
  bar); records the frame-generation recipe and the `border`-shorthand
  insulation mechanism. Generator: `artifacts/local/theme_pass/gen_image.sh`.
- 2.0.0 — added the Procedure (the nine-step order that produced the
  pokemon theme in one pass) and the selector contract (panel, header,
  bare-on-backdrop, row lists every skin must redeclare); the capture
  harness moved into the repo at `frontend/scripts/theme-capture.js`.
