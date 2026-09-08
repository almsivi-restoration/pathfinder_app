# Game Master's Workbench

A comprehensive GM tool for managing Pathfinder scenes. Includes a GM dashboard for actor management, initiative tracking, a local PDF reference library, a name generator, and a separate player view that displays only permitted information.

## Features

### Phase 1 (Current)
- **Campaign Management:** Create/load campaigns with ruleset selection (1e/2e); only a campaign persists a ruleset — scenes and actors inherit it
- **Actor Management:** Add/remove/clone actors (PCs and NPCs) with ruleset-driven stat sheets (Pathfinder 1e and 2e); optional GM-assigned marker colors shown on the player view; read-only **View** card renders an actor's sheet grouped by section with empty fields omitted (works for scene actors and campaign templates)
- **Scenes:** Create/save/load scenes via the Scene Library, with full actor CRUD
- **Actor Templates:** Save/edit/delete/view actor templates and instantiate them into a scene; template marker colors are inherited by instantiated actors
- **Initiative Tracking:** Manual initiative entry, sort-by-roll, manual reorder, round tracking
- **Effect Countdown:** Effect durations decrement automatically at the end of each round
- **Reference Library:** Index user-supplied rulebook PDFs into a local SQLite FTS5 index and search them per-ruleset from the Encyclopedia page; scanned pages (no embedded text) are OCR'd with Tesseract when available
- **Reference Reader:** In-app PDF reading with page-number jump and fit-to-view zoom
- **Name Generator:** Per-race syllable-grammar generator for actors, plus multi-template engines for places, items, factions, and events; batches are deduplicated
- **Chronicle:** Campaign journal (GM Tools > Chronicle, Ctrl+J) styled as an open book — markdown-formatted entries with a formatting guide and live preview, persisted with the campaign
- **Bestiary:** Import a user-supplied `bestiary.csv` from the ruleset sources directory into a per-ruleset SQLite FTS5 index; search with CR/type filters, view full monster entries, and create NPC actors or campaign templates from them (1e)
- **Player View:** Pop-out window showing only player-visible information
  - Initiative order with current actor highlight
  - Health bars (PC: X/Y format, NPC: green→red gradient)
  - Status effects with duration
  - GM-assigned marker color (dot and accent border)
- **Persistence:** Save/load campaigns and scenes as JSON files
- **Packaged Desktop App:** Installable AppImage and deb builds with auto-update (AppImage) and an apt-managed deb

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
│   ├── gm-workbench-backend.spec  # PyInstaller spec for the packaged backend
│   ├── rules/
│   │   ├── __init__.py         # Ruleset registry
│   │   ├── common.py           # Shared sheet-definition helpers
│   │   ├── ruleset_1e.py       # Pathfinder 1e config
│   │   └── ruleset_2e.py       # Pathfinder 2e config
│   ├── tests/                  # pytest suite (StateManager + API)
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   ├── electron.js         # Electron main process
│   │   ├── preload.js          # Electron preload
│   │   └── icons/              # Generated icon set
│   ├── build-resources/        # Icon generation script
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.jsx
│   │   ├── store.js            # Zustand state store
│   │   ├── sheet.js            # Generic sheet helpers (ruleset-neutral)
│   │   ├── assets/fonts/       # Bundled Libertine fonts (OFL)
│   │   ├── components/
│   │   │   ├── GMDashboard.jsx
│   │   │   ├── ActorList.jsx / ActorRow.jsx / ActorForm.jsx
│   │   │   ├── ActorEditModal.jsx / ActorViewModal.jsx / ActorStatFields.jsx
│   │   │   ├── ActorTemplateLibrary.jsx
│   │   │   ├── InitiativeTracker.jsx
│   │   │   ├── NameGenerator.jsx
│   │   │   ├── Chronicle.jsx
│   │   │   ├── ReferenceReader.jsx
│   │   │   ├── SceneLibrary.jsx
│   │   │   ├── PlayerView.jsx / PlayerActorRow.jsx
│   │   │   └── *.test.js(x)    # Jest + React Testing Library tests
│   │   ├── pages/
│   │   │   ├── CampaignSelector.jsx
│   │   │   ├── Encyclopedia.jsx
│   │   │   └── Bestiary.jsx
│   │   └── styles/
│   │       ├── theme.css       # Morrowind-inspired theme tokens
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

### Bestiary
- `GET /api/bestiary/current/status` — CSV presence and index state for the active ruleset
- `POST /api/bestiary/current/import` — Parse and index the ruleset's `bestiary.csv`
- `GET /api/bestiary/current/search` — Text search with CR-range and type filters
- `GET /api/bestiary/current/entry/{entry_id}` — Full normalized monster record
- `GET /api/bestiary/current/entry/{entry_id}/actor` — Map an entry to a new NPC actor payload

### Name Generator
- `GET /api/names/categories` — List categories (+ races for the loaded campaign)
- `GET /api/names/generate?category&count&race&place_level` — Generate names

### Rolls
- `POST /api/roll` — Roll dice (d20 + modifiers)

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
  ruleset: "1e" | "2e"
  is_pc: boolean
  color: string (optional hex marker color, shown on the player view)
  sheet: {...}   // ruleset-defined; keys come from the active sheet definition
  effects: [{name, duration_rounds, description}]
  notes: string
}
```
Legacy flat fields (hp_current, ac, skills, saves, weapons, ...) are migrated into `sheet`
on load by the Actor model validator.

### Campaign
```
{
  name: string
  ruleset: "1e" | "2e"
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
  ruleset: "1e" | "2e"
  actors: [Actor]
  initiative_order: [actor_id]
  current_round: int
  current_turn_index: int
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
- Grid/token map visualization — deferred indefinitely; the GM uses a physical dry-erase grid
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

1. Edit ruleset config in `backend/rules/ruleset_1e.py` or `ruleset_2e.py` (shared helpers live in `backend/rules/common.py`)
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
