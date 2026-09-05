# Game Master's Workbench

A local desktop encounter manager for a single GM. Campaigns select a ruleset; the selected
ruleset defines actor sheets, combat summaries, initiative behavior, and the local reference
sources available through the Encyclopedia.

The initial rulesets are Pathfinder 1e and Pathfinder 2e. The application core is intentionally
ruleset-neutral so additional systems can be added without changing campaign, encounter, actor,
initiative, or persistence ownership.

## Features

- Create, load, save, and delete campaigns.
- Create and save encounters with PC and NPC actors.
- Save reusable actor templates on a campaign.
- Enter physical initiative results, order actors manually, and advance turns and rounds.
- Display a separate player-facing initiative window.
- Render actor sheets from the active ruleset definition, including scalar fields, notes, and
	repeatable records such as weapons, skills, armor, gear, and spells.
- Search user-supplied local rulebook PDFs through **GM Tools > Encyclopedia**.

## Architecture

`Campaign.ruleset` is the sole ruleset authority. Encounters, actors, and templates do not store
their own competing ruleset values.

The shared `Actor` model contains identity, encounter state, effects, notes, and a generic
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

## Campaign Workflow

1. Create or load a campaign and choose its ruleset.
2. Create an encounter; it inherits the campaign's ruleset.
3. Add actors directly or instantiate campaign templates.
4. Enter the GM's physical initiative results, arrange the order, and start the encounter.
5. Open the player view for a second monitor when needed.
6. Use **Save All** to persist the campaign and current encounter.

Campaign deletion is available from the campaign selector. It removes that campaign and its
persisted encounters after confirmation; it cannot be undone.

## Local References And Encyclopedia

Rulebooks and other published reference PDFs remain local and are never committed. Store them in
the directory named by their ruleset's `reference_directory` configuration. For Pathfinder 1e:

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

## API Overview

### Campaigns

- `POST /api/campaign/new`
- `GET /api/campaign/list`
- `POST /api/campaign/load`
- `GET /api/campaign/current`
- `POST /api/campaign/save`
- `DELETE /api/campaign/{campaign_name}`

### Encounters, Actors, And Initiative

- `POST /api/encounter/new`, `GET /api/encounter/current`, `POST /api/encounter/load`, and
	`POST /api/encounter/save`
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