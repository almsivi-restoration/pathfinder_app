# Game Master's Workbench

A comprehensive GM tool for managing Pathfinder scenes. Includes a GM dashboard for actor management, initiative tracking, a local PDF reference library, a name generator, and a separate player view that displays only permitted information.

## Features

### Phase 1 (Current)
- **Campaign Management:** Create/load/rename/save/delete campaigns with ruleset selection (1e/2e/Numenera); only a campaign persists a ruleset — scenes and actors inherit it. Rename from the selector with Save/Enter or Cancel/Escape; scenes, templates, Chronicle entries, and unsaved edits are preserved, and invalid or duplicate names are rejected. Export a campaign (with its saved scenes, templates, Chronicle, and venues) to one portable `.gmw-campaign.json` file and import it back as a new campaign — imports never overwrite
- **Actor Management:** Add/remove/clone actors (PCs and NPCs) with ruleset-driven stat sheets (Pathfinder 1e and 2e, Numenera); optional GM-assigned marker colors and marker symbols (twelve hand-drawable marks from `markerSymbols.js`, picked beside the color swatch) shown on the player view, the initiative order, and the actor card; read-only **View** card renders an actor's sheet grouped by section with empty fields omitted (works for scene actors and campaign templates)
- **Scenes:** Create/save/load scenes via the Scene Library, with full actor CRUD
- **Actor Templates:** Save/edit/delete/view actor templates and instantiate them into a scene; template marker colors and symbols are inherited by instantiated actors
- **Initiative Tracking:** Manual initiative entry, sort-by-roll, manual reorder, round tracking; an actor's marker color rings its position number
- **Quick Roll:** GM Tools > Quick Roll (Ctrl+D) rolls a scene actor's skill/save/ability check using the modifier from their sheet, or a custom die and modifier, with a session roll history
- **Effect Countdown:** Effect durations decrement automatically at the end of each round
- **Reference Library:** Index user-supplied rulebook PDFs into a local SQLite FTS5 index and search them per-ruleset from the Encyclopedia page; scanned pages (no embedded text) are OCR'd with Tesseract when available
- **Reference Reader:** In-app PDF reading with page-number jump and fit-to-view zoom
- **Name Generator:** Per-race syllable-grammar generator for actors, plus multi-template engines for places, items, factions, and events; batches are deduplicated
- **Chronicle:** Campaign journal (GM Tools > Chronicle, Ctrl+J) styled as an open book — markdown-formatted entries with a formatting guide and live preview, persisted with the campaign; Dissidia 012 uses a silver-blue page texture instead of Morrowind parchment, and the Pokémon theme renders it as a Game Boy DMG screen
- **Venues:** Square-grid map builder (GM Tools > Venues, Ctrl+M) with usable-grid presets excluding the mat's border (46×32, 32×46, 32×23, 24×24, 12×12, or custom up to 100×100); existing saved venues retain their dimensions; one-key tools for rooms, terrain paint, erase, walls, doors, secret doors, stamps, and select/move/rotate; undo/redo and explicit save; a player preview. Catalog terrain, edges, and stamps live in `venueCatalog.jsx`; each venue persists to its own JSON file in the campaign folder and travels in the campaign export
  - **Venue Screen:** Pop-out second-monitor window (View > Open Venue Screen) showing the venue the GM chose to show players; the backend strips GM notes and GM-only stamps and draws secret doors as walls before the window receives it
  - **Mat Guide:** Translates a venue into numbered drawing steps with grid coordinates (e.g. H14) and a four-marker color key (black, red, green, blue) for the physical one-inch mat (32×46 usable squares by default, adjustable); best-fit/portrait/landscape orientation, whole-mat or close-up view, sections for venues larger than the mat, and print
- **Bestiary:** Import a user-supplied `bestiary.csv` from the ruleset sources directory into a per-ruleset SQLite FTS5 index; search with CR/type filters, view full monster entries, and create NPC actors or campaign templates from them (1e)
- **The Harrowing:** Chat with a user-supplied local language model (GM Tools > The Harrowing, Ctrl+P) through any OpenAI-compatible endpoint (Ollama, LM Studio, …); status probe (reachable / model present / loaded), optional grounding in the indexed reference library, and a Sleep button that unloads the model from RAM (Ollama `keep_alive=0`). No model ships with the app; settings persist to `harrowing-settings.json` under the data dir
- **Character Sheet Import:** OCR a scanned Pathfinder 1e sheet PDF (GM Tools > Import Character Sheet, Ctrl+I) into a reviewable actor draft — abilities, HP, initiative, AC (touch and flat-footed), speed, BAB/CMB/CMD, saves, printed skill rows, name — for GM confirmation before saving. No scene is required: with only a campaign loaded the actor is saved as a campaign template. Handwriting OCR uses PaddleOCR, kept out of the backend environment entirely: extraction runs as a subprocess from a dedicated user-created venv (`backend/requirements-ocr.txt`), and the import dialog shows the exact install commands when it is missing
- **Player View:** Pop-out window showing only player-visible information
  - The header banner shows the current scene name (long names truncate with an ellipsis)
  - Initiative order rotates as turns advance so the active actor always leads the list
    (position badges keep their true initiative numbers), with the current actor highlighted
    by an accent outline, tint, and a Current Turn tag (the GM actor table and initiative list
    mark the same actor with an accent bar and a marker)
  - Health bars for everyone: PCs show exact current/max values centered inside the bar,
    NPCs show a three-band bar without numbers (band colors are the `--mw-hp-high/mid/low`
    theme tokens, selected by the `hp-high/hp-mid/hp-low` class — Morrowind moss/ochre/red,
    Dissidia brave-blue/amber/rose, Pokémon green/yellow/red)
  - Health bars play impact effects when a poll sees HP move: big hits (≥20% of max) shake
    the bar, any loss flashes and drains a damage ghost of the lost chunk, heals glow —
    ghost tint is the `--mw-hp-ghost` theme token
  - Larger player-facing type, status effects with duration
  - GM-assigned marker color as a thick accent bar on each row
- **Zoom:** Ctrl+scroll wheel or View > Zoom In / Zoom Out / Reset Zoom (Ctrl+Plus / Ctrl+- /
  Ctrl+0) scale either window independently; zoom is per-window and resets on relaunch
- **Themes:** View > Theme switches between the built-in Morrowind (base), Dissidia 012, and Pokémon (Gen I–III) skins and any local theme folder; the Pokémon theme styles the player view as a GBA battle screen and the Chronicle as a Game Boy DMG screen
- **Persistence:** Save/load campaigns, scenes, and venues as JSON files
- **Packaged Desktop App:** Installable AppImage and deb builds with auto-update (AppImage) and an apt-managed deb
- **About:** Help > About opens on the GM window in a themed dialog bounded to the viewport, with independently scrollable details, a fixed Close button, Escape dismissal, and keyboard focus containment/restoration. Version comes from Electron's `app.getVersion()`
- **How to Use:** Help > How to Use (F1) shares the About dialog's viewport-bounded layout and keyboard behavior. The full guide uses topic headings, short paragraphs, and shortcut lists, and scrolls independently of the title and Close button, including on small screens; it always opens on the GM window.

## Project Structure

```
pathfinder_app/
├── backend/
│   ├── main.py                 # FastAPI application
│   ├── models.py               # Pydantic data models
│   ├── state.py                # State management & persistence
│   ├── reference_library.py    # PDF indexing & page-aware search (SQLite FTS5, OCR fallback)
│   ├── bestiary.py             # Bestiary CSV parsing, indexing & search (SQLite FTS5)
│   ├── name_generator.py       # Per-race syllable grammars + multi-template name engines
│   ├── sheet_importer.py       # Scanned 1e character-sheet OCR (PaddleOCR, section det+rec) + OCR subprocess wrapper
│   ├── ocr_runner.py           # Standalone OCR entry point run as a subprocess by the dedicated OCR venv
│   ├── harrowing.py            # The Harrowing: local-LLM chat proxy (config, status, grounding, unload)
│   ├── gm-workbench-backend.spec  # PyInstaller spec for the packaged backend
│   ├── rules/
│   │   ├── __init__.py         # Ruleset registry
│   │   ├── common.py           # Shared sheet-definition helpers
│   │   ├── ruleset_1e.py       # Pathfinder 1e config
│   │   ├── ruleset_2e.py       # Pathfinder 2e config
│   │   └── ruleset_numenera.py # Numenera config
│   ├── tests/                  # pytest suite (StateManager + API)
│   ├── requirements.txt
│   └── requirements-ocr.txt    # Dedicated OCR venv pins (matched paddle trio; NOT for the backend venv)
│
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   ├── electron.js         # Electron main process
│   │   ├── preload.js          # Electron preload
│   │   ├── icons/              # Generated icon set
│   │   └── themes/             # Vendored built-in themes (dissidia, pokemon: css, fonts OFL, textures)
│   ├── build-resources/        # Icon generation script
│   ├── scripts/                # Playwright harnesses (theme-capture.js: every screen under a theme)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.jsx
│   │   ├── store.js            # Zustand state store
│   │   ├── sheet.js            # Generic sheet helpers (ruleset-neutral)
│   │   ├── theme.js            # Theme bridge (applies built-in extra and local theme skins)
│   │   ├── markerSymbols.js    # Marker symbol catalog (append-only ids, hand-drawable marks) and base discs
│   │   ├── venueCatalog.jsx    # Venue terrain/edge/stamp catalog: art, mat translation, mat colors
│   │   ├── venueGeometry.js    # Venue grid math (cell labels, derived walls, edges, paint, stamps)
│   │   ├── matGuide.js         # Mat Guide planner (fit, orientation, sections, placement, color key)
│   │   ├── themeSelectorContract.test.js  # Skins own every contract selector; Mat Guide print rules outrank skins
│   │   ├── assets/fonts/       # Bundled Libertine fonts (OFL)
│   │   ├── assets/textures/    # Generated Morrowind textures (ash backdrop, banner, parchment, carved 9-slice frame)
│   │   ├── components/
│   │   │   ├── GMDashboard.jsx
│   │   │   ├── AboutDialog.jsx   # Shared scrollable layout for About and How to Use
│   │   │   ├── ActorList.jsx / ActorRow.jsx / ActorForm.jsx
│   │   │   ├── ActorEditModal.jsx / ActorViewModal.jsx / ActorStatFields.jsx
│   │   │   ├── ActorTemplateLibrary.jsx
│   │   │   ├── ColorSwatch.jsx / SymbolPicker.jsx / MarkerSymbol.jsx
│   │   │   ├── InitiativeTracker.jsx
│   │   │   ├── NameGenerator.jsx
│   │   │   ├── Chronicle.jsx
│   │   │   ├── QuickRoll.jsx
│   │   │   ├── SheetImporter.jsx
│   │   ├── Harrowing.jsx
│   │   │   ├── ReferenceReader.jsx
│   │   │   ├── SceneLibrary.jsx
│   │   │   ├── PlayerView.jsx / PlayerActorRow.jsx
│   │   │   ├── VenueLibrary.jsx / VenueEditor.jsx / VenueMap.jsx
│   │   │   ├── VenueScreen.jsx     # Venue Screen window (polls the player-safe shown venue)
│   │   │   ├── MatGuide.jsx / MatSheet.jsx
│   │   │   └── *.test.js(x)    # Jest + React Testing Library tests
│   │   ├── pages/
│   │   │   ├── CampaignSelector.jsx
│   │   │   ├── CampaignSelector.test.jsx
│   │   │   ├── Encyclopedia.jsx
│   │   │   ├── Bestiary.jsx
│   │   │   └── Venues.jsx
│   │   └── styles/
│   │       ├── theme.css       # Morrowind theme tokens (built-in default; local themes
│   │       │                   # override these --mw-* variables)
│   │       ├── AboutDialog.css # Viewport-bounded About / How to Use layout
│   │       └── *.css           # Per-component styles
│   └── package.json
│
├── artifacts/local/            # Local-only data (gitignored): reference PDFs,
│                               # FTS5 index, manifests, session-state capsule
└── README.md
```

## Setup & Installation

### Backend

1. **Create Python virtual environment:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the API server:**
   ```bash
   venv/bin/python main.py
   ```
   The API will be available at `http://localhost:8000`

   System `python3` does NOT have uvicorn installed — always run through the project venv (`backend/venv/bin/python`).

### Frontend

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development (with Electron):**
   ```bash
   npm start
   ```

   Or run React only (browser):
   ```bash
   npm run react-start
   ```

## Usage

### GM Workflow

1. **Launch Application:** Start the Electron app (`npm start` in frontend)
2. **Load/Create Campaign:** Select an existing campaign or create a new one with ruleset
3. **Create Scene:** Name your scene (ruleset inherits from campaign)
4. **Add Actors:** Click "Add Actor" and fill in character details, or instantiate an actor template from the library
5. **Roll Initiative:** Enter each actor's initiative roll, then sort by roll (initiative is manual entry by design — the GM rolls physical dice)
6. **Run Combat:** Click "Next Turn" to advance through rounds — effect durations count down automatically at the end of each round
7. **Track Stats:** Click on HP values to edit, manage effects and status
8. **Reference Lookup:** Use `GM Tools > Encyclopedia` to index and search local rulebook PDFs, and open them in the Reference Reader
9. **Venues:** Use `GM Tools > Venues` to build a map, **Show players** to put it on the Venue Screen (View > Open Venue Screen), and **Mat Guide** to copy it onto the table mat

### Player Workflow

1. **GM Opens Player View:** Click "Open Player View" in GM dashboard (or Ctrl+Shift+P)
2. **Players See:**
   - Initiative order with current actor highlighted (orange)
   - Health: PC actors show "X/Y", NPC actors show color gradient
   - Status effects with remaining rounds
   - Nothing else (no stats, skills, resistances, etc.)

## API Endpoints

### Campaign
- `POST /api/campaign/new` — Create campaign
- `GET /api/campaign/list` — List saved campaigns
- `POST /api/campaign/load` — Load campaign by name
- `GET /api/campaign/current` — Get active campaign
- `POST /api/campaign/save` — Save current campaign
- `POST /api/campaign/rename` — Rename a saved campaign (`name` and `new_name` query parameters)
- `GET /api/campaign/export` — Export a saved campaign with its saved scenes and venues as one JSON bundle (`name` query parameter; bundle `version` 2, version 1 bundles still import)
- `POST /api/campaign/import` — Import an exported bundle (JSON body) as a new campaign; a taken name gets an ` (imported)` suffix
- `DELETE /api/campaign/{campaign_name}` — Delete a saved campaign

### Scene
- `POST /api/scene/new` — Create scene
- `GET /api/scenes` — List scenes in the active campaign
- `GET /api/scene/current` — Get active scene
- `POST /api/scene/load` — Load scene by ID
- `POST /api/scene/close` — Close the active scene
- `DELETE /api/scene/{scene_id}` — Delete a scene
- `POST /api/scene/save` — Save scene

### Actors
- `POST /api/actor/add` — Add actor to scene
- `GET /api/actor/{actor_id}` — Get actor details
- `PUT /api/actor/{actor_id}` — Update actor
- `DELETE /api/actor/{actor_id}` — Remove actor

### Actor Templates
- `POST /api/campaign/actor-template/add` — Save an actor template to the campaign
- `GET /api/campaign/actor-templates` — List the campaign's templates
- `PUT /api/campaign/actor-template/{template_id}` — Edit a template
- `DELETE /api/campaign/actor-template/{template_id}` — Delete a template
- `POST /api/scene/actor/from-template/{template_id}` — Instantiate a template into the active scene

### Initiative
- `POST /api/initiative/set` — Persist manually entered initiative order
- `POST /api/initiative/roll` — Roll initiative for all actors
- `POST /api/initiative/next` — Advance to next turn (ticks effect durations each round)
- `GET /api/initiative/state` — Get current initiative state

### Reference Library
- `GET /api/references/current` — Get reference index state for the active ruleset (includes `ocr_available`)
- `POST /api/references/current/import` — Import/index a selected local PDF (OCR fallback for scanned pages)
- `GET /api/references/current/search` — Page-aware search of indexed content
- `GET /api/references/current/files/{filename}` — Serve an indexed PDF (Reference Reader)

### Chronicle
- `POST /api/campaign/chronicle/add` — Append a journal entry to the active campaign
- `GET /api/campaign/chronicle` — List the campaign's chronicle entries
- `PUT /api/campaign/chronicle/{entry_id}` — Update a chronicle entry
- `DELETE /api/campaign/chronicle/{entry_id}` — Delete a chronicle entry

### Venues
- `GET /api/venues` — List the active campaign's venues
- `POST /api/venue/new` — Create a venue (`name`, `width`, `height` JSON body)
- `GET /api/venue/{venue_id}` — Get a venue
- `PUT /api/venue/{venue_id}` — Save a venue
- `DELETE /api/venue/{venue_id}` — Delete a venue (hides it first if shown)
- `POST /api/venue/show` — Show a venue on the Venue Screen (`venue_id` query parameter)
- `POST /api/venue/hide` — Clear the Venue Screen
- `GET /api/venue/shown` — The shown venue's player-safe copy as `{"venue": ...}` (`null` when none)

### Bestiary
- `GET /api/bestiary/current/status` — CSV presence and index state for the active ruleset
- `POST /api/bestiary/current/import` — Parse and index the ruleset's `bestiary.csv`
- `GET /api/bestiary/current/search` — Text search with CR-range and type filters; paginated
  via `limit` (default 50, max 200) and `offset`, returns `{results, total}`
- `GET /api/bestiary/current/entry/{entry_id}` — Full normalized monster record
- `GET /api/bestiary/current/entry/{entry_id}/actor` — Map an entry to a new NPC actor payload

### Name Generator
- `GET /api/names/categories` — List categories (+ races for the loaded campaign)
- `GET /api/names/generate?category&count&race&place_level` — Generate names

### The Harrowing
- `GET /api/harrowing/config` / `PUT /api/harrowing/config` — Read/update the local-model endpoint settings
- `GET /api/harrowing/status` — Probe the endpoint (reachable / model present / currently loaded)
- `POST /api/harrowing/chat` — Proxy a chat request, optionally grounded in the indexed rulebooks
- `POST /api/harrowing/unload` — Unload the model from memory (Ollama `keep_alive=0`)

### Rolls
- `POST /api/roll` — Roll dice (d20 + modifiers)

### Sheet Import
- `POST /api/import/sheet` — OCR a scanned Pathfinder 1e sheet PDF (multipart `file`) into a reviewable draft of fields + warnings; draft-only, 1e campaigns, 503 when the OCR engine is not installed

### Rules
- `GET /api/rulesets` — List registered rulesets (drives campaign creation)
- `GET /api/rules/current` — Get the active campaign's sheet contract

Exact request/response shapes are defined in `backend/main.py` and `backend/models.py` — this list is an orientation map, not a contract; if it disagrees with the code, the code wins.

## Data Model

### Actor
```
{
  id: string
  name: string
  player_name: string (optional)
  is_pc: boolean
  color: string (optional hex marker color, shown on the player view)
  symbol: string (optional marker symbol id from markerSymbols.js, max 32 chars)
  sheet: {...}   // ruleset-defined; keys come from the active sheet definition
  initiative_roll: int (optional)
  effects: [{name, duration_rounds, description}]
  created_at: datetime
  notes: string
}
```
Legacy flat fields (hp_current, ac, skills, saves, weapons, ...) are migrated into `sheet`
on load by the Actor model validator.

### Campaign
```
{
  name: string
  ruleset: "1e" | "2e" | "numenera"
  created_at: datetime
  scenes: [scene_id]
  actor_templates: [Actor]
  chronicle: [ChronicleEntry]
  notes: string
}
```

### Scene
```
{
  id: string
  name: string
  actors: [Actor]
  initiative_order: [actor_id]
  current_round: int
  current_turn_index: int
  created_at: datetime
}
```

### ChronicleEntry
```
{
  id: string
  title: string
  body: string          // markdown source
  created_at: datetime
  updated_at: datetime
}
```

### Venue
Stored one per file at `campaigns/<name>/venues/<venue_id>.json` — the folder is the index, so
venues are not listed in `campaign.json`.
```
{
  id: string
  name: string
  notes: string         // GM-only; never sent to the Venue Screen
  grid: "square"
  width: int            // 1..100 cells
  height: int           // 1..100 cells
  cells: {"x,y": terrain_id}   // sparse; absent cells are empty space
  edges: [{x, y, side: "n" | "w", kind}]   // explicit walls/doors/secret doors on grid lines
  features: [{id, kind, x, y, rotation: 0|90|180|270, label, gm_only}]
  created_at: datetime
  updated_at: datetime
}
```
Walls between a filled cell and empty space are derived when drawing and are not stored.

## Roadmap — Future Phases

Statuses reconciled against shipped releases (through v0.7.0, 2026-09-05).

### Phase 2
- ~~Effect duration auto-countdown~~ — **shipped**: durations decrement at the end of each round (`_tick_effects` in `backend/state.py`)
- ~~Actor templates library~~ — **shipped**: save/edit/delete/instantiate via `ActorTemplateLibrary.jsx`
- WebSocket real-time sync between GM and player views — open; player view currently polls every 2s
- Quick-roll system with skill/save modifiers — open; backend `POST /api/roll` exists but has no frontend UI
- SQLite persistence (optional) — open; campaign/scene data is still JSON (only the reference index is SQLite)

### Phase 3
- Full Pathfinder mechanics (feats, conditions, skills DC) — open; derived totals (AC, saves, CMB/CMD, etc.) are manual entry today
- ~~Grid map visualization~~ — **shipped** as Venues: square-grid maps built in the app, shown to players on the Venue Screen, and translated by the Mat Guide for the physical dry-erase grid. Tokens/actor positions on a venue remain open — the physical mat is still where minis move
- Spell/ability tracking — partial: spells are editable sheet data with per-day fields; no slot usage tracking or reset
- ~~Campaign history/logging~~ — **shipped** (v0.10.0): the Chronicle is the campaign journal (markdown entries, persisted with the campaign)
- Import from D&D Beyond / Pathfinder tools — open

## Development

### Adding a New Component

1. Create component file in `frontend/src/components/`
2. Create corresponding CSS in `frontend/src/styles/`
3. Import into parent component
4. Use Zustand store for state: `const { state } = useStore()`

### Adding a New API Endpoint

1. Add route in `backend/main.py`
2. Add corresponding action in `frontend/src/store.js`
3. Call from component via `useStore((state) => state.actionName)`

### Modifying Rules

1. Edit ruleset config in `backend/rules/ruleset_1e.py`, `ruleset_2e.py`, or `ruleset_numenera.py` (shared helpers live in `backend/rules/common.py`)
2. Rules are automatically loaded from the registry and served via `/api/rules/current` (and `/api/rules/{ruleset}`)

### Running Tests

```bash
cd backend && venv/bin/python -m pytest -q                                  # backend tests
cd ../frontend && CI=true npm run react-test -- --watchAll=false            # frontend tests
```

Backend dev dependencies (pytest, httpx) are in `backend/requirements-dev.txt`.

### Building the Packaged App

```bash
cd backend && venv/bin/pyinstaller --noconfirm gm-workbench-backend.spec
cd ../frontend && cp public/electron.js public/preload.js build/
cd frontend && rm -rf dist && npm run build
```

Produces AppImage + deb artifacts and `latest-linux.yml` under `frontend/dist/`. The full release process (versioning, verification gates, artifact checks, GitHub release) is in `.github/copilot-instructions.md` — follow it exactly.

## Configuration

### Backend
- API runs on `http://localhost:8000` (port configurable in `main.py`)
- Campaigns saved to `./campaigns/` directory
- Each campaign is a folder with `campaign.json` + `scenes/` subdirectory

### Frontend
- React dev server: `http://localhost:3000`
- API URL: `http://localhost:8000/api` (configurable via `REACT_APP_API_URL`)
- Electron stores window preferences and player window state

## Troubleshooting

**"Connection refused" error**
- Ensure the backend is running through the project venv: `backend/venv/bin/python backend/main.py`
- Check backend is listening on port 8000

**Player view not updating**
- Real-time sync not yet implemented (Phase 2)
- The player view polls the backend every 2 seconds; if it looks stuck, verify the backend is reachable

**Packaged app fails to start with a version error**
- Deliberate: the backend binary must match the frontend version. Refreeze the backend with PyInstaller and rebuild (see "Building the Packaged App")

**Campaign not saving**
- Check `./campaigns/` directory exists and is writable (dev) or the packaged data dir `~/.config/Game Masters Workbench/data/`
- Verify `./campaigns/CampaignName/` directory was created

**Encyclopedia returns no results**
- Reference PDFs are user-supplied and never shipped: place them under `artifacts/local/reference_library/sources/<ruleset>/` (or the packaged reference dir), then index them from `GM Tools > Encyclopedia`

**Actors not showing**
- Ensure scene is created first
- Check "Add Actor" form for missing required fields

## License

See [LICENSE](LICENSE). Reference rulebook PDFs are user-supplied at runtime and are never committed or shipped with the app; bundled fonts are under the SIL Open Font License (see `frontend/src/assets/fonts/OFL-LICENSE.txt`).
