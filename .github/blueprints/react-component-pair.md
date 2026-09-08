---
description: "Blueprint: how a React component is shaped in Game Master's Workbench — file pairing, store access, styling via theme tokens, and the IPC dialog pattern. Load when adding or editing frontend components."
name: "bp-react-component-pair"
version: "1.0.0"
applyTo: "frontend/src/**"
---

# Blueprint: React Component + Style Pair

## Purpose

Components are plain function components, one per file, each paired with
a sibling stylesheet. All server interaction flows through the zustand
store; all color and texture flow through theme tokens.

## Holotype

[ActorRow.jsx](../../frontend/src/components/ActorRow.jsx): imports the
store and its own stylesheet, subscribes to only the store slices it
needs, and reads sheet data through the shared helpers:

```jsx
import { useStore } from '../store';
import { getSheetValue, setSheetValue } from '../sheet';
import '../styles/ActorRow.css';

function ActorRow({ actor, summaryFields }) {
  const removeActor = useStore((state) => state.removeActor);
  // ...
}
```

## Contract

- **One component per file**, named after the component
  (`ActorRow.jsx`). Small co-located helper components (e.g.
  `ColorSwatch`) may share the file when they exist only for it.
- **Placement:** reusable UI in `src/components/`; routed/top-level
  screens in `src/pages/`.
- **Styles:** one CSS file per component in `src/styles/`, imported by
  the component. Use `--mw-*` tokens from `theme.css`; never hardcode
  palette colors. Respect the pinned conventions (button variant classes,
  `min-width: 0` on grid/flex inputs, ColorSwatch proxy for color
  inputs).
- **State:** components subscribe to the zustand store with narrow
  selectors and call store actions — never axios directly. Sheet data is
  read/written through `getSheetValue`/`setSheetValue` from `sheet.js`,
  never by hand-assembling dotted paths.
- **Sheet-driven rendering:** components render from the ruleset's sheet
  definition (`rulesetConfig`) — fields, summary, player_resource — not
  from hardcoded edition properties.
- **Dialogs/tools:** the GM Tools menu triggers an IPC event
  (`open-<tool>`), which the dialog component listens for. Keyboard
  shortcut (Ctrl+letter) fires the same event. See NameGenerator for the
  pattern.

## When this doesn't fit

A genuinely shared widget used by many components (a modal shell, a form
field kit) graduates to its own component — that is normal composition,
not a blueprint violation. The violation is bypassing the store or the
token system for convenience.
