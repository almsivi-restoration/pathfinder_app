---
description: "Blueprint: how a UI theme / skin is produced for Game Master's Workbench — deriving a look from reference screenshots, generating textures with an image API, wiring CSS without the cover-crop and origin traps, and verifying against real rendered pixels. Load when building or editing a theme, generating UI textures, or tuning a skin."
name: "bp-ui-theme-generation"
version: "1.2.0"
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
