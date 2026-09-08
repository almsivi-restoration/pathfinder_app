# Game Master's Workbench

A local desktop scene manager for a single GM. Campaigns select a ruleset; the selected
ruleset defines actor sheets, combat summaries, initiative behavior, and the local reference
sources available through the Encyclopedia.

The initial rulesets are Pathfinder 1e and Pathfinder 2e. The application core is intentionally
ruleset-neutral so additional systems can be added without changing campaign, scene, actor,
initiative, or persistence ownership.

## Features

- Create, load, save, and delete campaigns and their saved scenes.
- Create and save scenes with PC and NPC actors.
- Clone any scene actor in one click, and assign marker colors that appear on the player view.
- Save reusable actor templates on a campaign.
- Enter physical initiative results, order actors manually, and advance turns and rounds.
- Display a separate player-facing initiative window.
- Render actor sheets from the active ruleset definition, including scalar fields, notes, and
	repeatable records such as weapons, skills, armor, gear, and spells. NPCs created from the
	bestiary use a ruleset-defined monster sheet that shares the tracker's summary contract.
- Search user-supplied local rulebook PDFs through **GM Tools > Encyclopedia**.
- Search a user-supplied bestiary CSV through **GM Tools > Bestiary** (Ctrl+B), view full
	monster entries, and create NPC actors or campaign templates directly from them.

## Architecture

`Campaign.ruleset` is the sole ruleset authority. Scenes, actors, and templates do not store
their own competing ruleset values.

The shared `Actor` model contains identity, scene state, effects, notes, and a generic
`sheet` document. Each ruleset supplies a declarative sheet definition containing fields,
defaults, sections, summaries, player-visible resources, and initiative metadata. The React UI
uses that definition instead of system-specific actor properties.

Rulesets are registered in `backend/rules/`. To add one, register its identifier and definition,
including an `actor_sheet` and `reference_directory`; the campaign selector reads the backend
registry dynamically.

## Requirements

- Python 3.12 or compatible Python 3 release
- Node.js and npm
- Linux desktop session for Electron

## Setup

Install backend dependencies into the project virtual environment:

```bash
python3 -m venv backend/venv
backend/venv/bin/python3 -m pip install -r backend/requirements.txt
backend/venv/bin/python3 -m pip install -r backend/requirements-dev.txt
```

Install the frontend dependencies:

```bash
npm --prefix frontend install
```

Start the backend in one terminal:

```bash
cd backend && venv/bin/python3 main.py
```

Start React and Electron in another:

```bash
npm --prefix frontend start
```

The backend runs at `http://127.0.0.1:8000`; the React development server runs at
`http://localhost:3000` and Electron launches automatically.

## Packaging An Installable Application

Release builds ship the React bundle, a PyInstaller-frozen backend binary, and the bundled
Linux Libertine fonts as an AppImage and a `.deb`. No Python or Node installation is required
to run the packaged app.

Build the backend binary:

```bash
cd backend && venv/bin/pyinstaller gm-workbench-backend.spec
```

Build the installers:

```bash
cd frontend && npm run build
```

Artifacts land in `frontend/dist/`. At runtime the Electron main process spawns the backend
binary and points it at the per-user data directory (`~/.config/GM Workbench/data/` on
Linux): campaigns persist under `data/campaigns/`, and reference PDFs belong under
`data/reference_library/sources/<ruleset>/`. Reference PDFs are user-supplied and never ship
with the application; the packaged app indexes whatever the user places there, exactly as the
development layout does under `artifacts/local/`.

The application icon is generated procedurally (no game assets) and can be regenerated with:

```bash
backend/venv/bin/python frontend/build-resources/generate_icon.py
```

## Campaign Workflow

1. Create or load a campaign and choose its ruleset.
2. Create a new scene or load a saved scene from the campaign scene library; each inherits the campaign's ruleset.
3. Add actors directly or instantiate campaign templates.
4. Enter the GM's physical initiative results, arrange the order, and start the scene.
5. Open the player view for a second monitor when needed.
6. Use **Save All** to persist the campaign and current scene. The dashboard indicates unsaved campaign or scene changes and reports save failures without discarding edits.

Campaign deletion is available from the campaign selector. It removes that campaign and its
persisted scenes after confirmation; it cannot be undone.

## Local References And Encyclopedia

Rulebooks and other published reference PDFs remain local and are never committed or shipped.
In development, store them in the directory named by their ruleset's `reference_directory`
configuration. For Pathfinder 1e:

```text
artifacts/local/reference_library/sources/pathfinder_1e/
├── pathfinder_1e_core_rulebook.pdf
└── pathfinder_1e_character_sheet.pdf
```

Load a campaign, choose **GM Tools > Encyclopedia**, then select **Index** for a local PDF.
Indexing extracts page text with `pypdf`, creates a local SQLite FTS5 index, and records source
metadata under `artifacts/local/reference_library/`. Results are limited to the active campaign's
ruleset and include the source PDF and page number. Reindex a source after replacing its PDF.

PDFs without embedded text require OCR support, which is not currently included.

## Bestiary

The bestiary is user-supplied game content and follows the same rules as reference PDFs: never
committed, never shipped. Drop a file named exactly `bestiary.csv` into the ruleset's source
directory (the same folder the Encyclopedia reads PDFs from), load a campaign, then choose
**GM Tools > Bestiary** and click **Import**. The importer parses the stat-block export
(including its Python-repr structured cells), indexes the monsters into a per-ruleset SQLite
FTS5 database, and reports any rows with malformed data as warnings.

Searching supports free text plus CR-range and creature-type filters. From an entry you can
view the full stat block, create an NPC actor in the current scene, or save the monster as a
campaign template. Monster actors use the ruleset's monster sheet definition, which shares the
summary keys the initiative tracker and player view rely on.

## Testing

Run backend tests:

```bash
source backend/venv/bin/activate && cd backend && python3 -m pytest -v
```

Run frontend tests:

```bash
cd frontend && CI=true npm run react-test -- --watchAll=false
```

Compile the React application:

```bash
cd frontend && npm run react-build
```

## Versioning And Releases

Releases use the `vX.Y.Z` format:

- **Major (`X`)**: increment for breaking changes or a revision that is not compatible
	with the previous release. Reset `Y` and `Z` to `0`.
- **Minor (`Y`)**: increment for backward-compatible features or substantial enhancements.
	Reset `Z` to `0`.
- **Patch (`Z`)**: increment for backward-compatible bug fixes, documentation, tests, or
	small internal improvements that do not add a feature or break compatibility.

When cutting a release, determine the next number from the changes being committed and use
the highest applicable increment if a release contains multiple kinds of changes. Before
choosing the number, inspect the latest existing tag and the complete set of commits since
that tag; do not assume every release is a patch release or choose a number from the commit
count alone.

The release sequence is:

1. Determine the next `vX.Y.Z` using the rules above.
2. Update any user-facing version references required by the release.
3. Run the relevant backend and frontend tests and builds.
4. Create an annotated tag with the selected version and push the branch and tag.
5. Create the corresponding GitHub release using the same tag and summarize the changes.

The authoritative, step-by-step release runbook — including the exact build
commands, the artifact-verification gates, and the required `latest-linux.yml`
asset for auto-update — lives in [.github/copilot-instructions.md](.github/copilot-instructions.md).

## API Overview

### Campaigns

- `POST /api/campaign/new`
- `GET /api/campaign/list`
- `POST /api/campaign/load`
- `GET /api/campaign/current`
- `POST /api/campaign/save`
- `DELETE /api/campaign/{campaign_name}`

### Scenes, Actors, And Initiative

- `POST /api/scene/new`, `GET /api/scene/current`, `POST /api/scene/load`, and
	`POST /api/scene/save`
- `POST /api/actor/add`, `GET /api/actor/{actor_id}`, `PUT /api/actor/{actor_id}`, and
	`DELETE /api/actor/{actor_id}`
- `POST /api/initiative/set`, `POST /api/initiative/roll`, `POST /api/initiative/next`, and
	`GET /api/initiative/state`

### Rules And References

- `GET /api/rulesets` lists supported rulesets.
- `GET /api/rules/current` returns the active campaign's sheet definition.
- `GET /api/references/current` lists local PDFs and indexed documents for the active ruleset.
- `POST /api/references/current/import` indexes a selected local PDF.
- `GET /api/references/current/search` searches the active ruleset's local index.

## Native Menu

- **File > Restart App** relaunches Electron.
- **File > Exit** closes the application.
- **View > Open Player View** opens the player-facing window.
- **GM Tools > Encyclopedia** opens the active ruleset's local reference search.

## License

See [LICENSE](LICENSE).