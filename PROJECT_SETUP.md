# Game Master's Workbench

A comprehensive GM tool for managing Pathfinder/D&D encounters. Includes a GM dashboard for actor management, initiative tracking, and a separate player view that displays only permitted information.

## Features

### Phase 1 (Current)
- **Campaign Management:** Create/load campaigns with ruleset selection (1e/2e)
- **Actor Management:** Add/remove actors (PCs and NPCs) with full stat tracking
- **Initiative Tracking:** Roll initiative, advance turns, track rounds
- **Player View:** Pop-out window showing only player-visible information
  - Initiative order with current actor highlight
  - Health bars (PC: X/Y format, NPC: green→red gradient)
  - Status effects with duration
- **Persistence:** Save/load campaigns and encounters as JSON files

## Project Structure

```
pathfinder_app/
├── backend/
│   ├── main.py                 # FastAPI application
│   ├── models.py               # Pydantic data models
│   ├── state.py                # State management & persistence
│   ├── rules/
│   │   ├── __init__.py
│   │   ├── ruleset_1e.py       # Pathfinder 1e config
│   │   └── ruleset_2e.py       # Pathfinder 2e config
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   ├── electron.js         # Electron main process
│   │   └── preload.js          # Electron preload
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.jsx
│   │   ├── store.js            # Zustand state store
│   │   ├── components/
│   │   │   ├── GMDashboard.jsx
│   │   │   ├── ActorList.jsx
│   │   │   ├── ActorRow.jsx
│   │   │   ├── ActorForm.jsx
│   │   │   ├── InitiativeTracker.jsx
│   │   │   ├── PlayerView.jsx
│   │   │   └── PlayerActorRow.jsx
│   │   ├── pages/
│   │   │   └── CampaignSelector.jsx
│   │   └── styles/
│   │       ├── CampaignSelector.css
│   │       ├── GMDashboard.css
│   │       ├── ActorList.css
│   │       ├── ActorRow.css
│   │       ├── ActorForm.css
│   │       ├── InitiativeTracker.css
│   │       ├── PlayerView.css
│   │       └── PlayerActorRow.css
│   └── package.json
│
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
   python main.py
   ```
   The API will be available at `http://localhost:8000`

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
3. **Create Encounter:** Name your encounter (ruleset inherits from campaign)
4. **Add Actors:** Click "Add Actor" and fill in character details
   - Set name, player name (if PC), HP, AC, initiative bonus
   - Enter ability scores (STR, DEX, CON, INT, WIS, CHA)
5. **Roll Initiative:** Click "Roll Initiative" to sort actors
6. **Run Combat:** Click "Next Turn" to advance through rounds
7. **Track Stats:** Click on HP values to edit, manage effects and status

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

### Encounter
- `POST /api/encounter/new` — Create encounter
- `GET /api/encounter/current` — Get active encounter
- `POST /api/encounter/load` — Load encounter by ID
- `POST /api/encounter/save` — Save encounter

### Actors
- `POST /api/actor/add` — Add actor to encounter
- `GET /api/actor/{id}` — Get actor details
- `PUT /api/actor/{id}` — Update actor
- `DELETE /api/actor/{id}` — Remove actor

### Initiative
- `POST /api/initiative/roll` — Roll initiative for all actors
- `POST /api/initiative/next` — Advance to next turn
- `GET /api/initiative/state` — Get current initiative state

### Rolls
- `POST /api/roll` — Roll dice (d20 + modifiers)

### Rules
- `GET /api/rules/{ruleset}` — Get ruleset config (skills, saves, abilities)

## Data Model

### Actor
```
{
  id: string
  name: string
  player_name: string (optional)
  ruleset: "1e" | "2e"
  is_pc: boolean
  hp_current: int
  hp_max: int
  ac: int
  initiative_bonus: int
  speed: int
  abilities: {str, dex, con, int, wis, cha: int}
  skills: {skill_name: modifier}
  saves: {fort, ref, will: modifier}
  resistances: {type: value}
  weapons: [{name, damage_dice, damage_type, modifier}]
  effects: [{name, duration_rounds, description}]
  notes: string
}
```

### Campaign
```
{
  name: string
  ruleset: "1e" | "2e"
  encounters: [encounter_id]
  actor_templates: [Actor]
  notes: string
}
```

### Encounter
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

## Roadmap — Future Phases

### Phase 2
- WebSocket real-time sync between GM and player views
- Quick-roll system with skill/save modifiers
- Effect duration auto-countdown
- Actor templates library
- SQLite persistence (optional)

### Phase 3
- Full Pathfinder mechanics (feats, conditions, skills DC)
- Grid/token map visualization
- Spell/ability tracking
- Campaign history/logging
- Import from D&D Beyond / Pathfinder tools

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

1. Edit ruleset config in `backend/rules/ruleset_1e.py` or `ruleset_2e.py`
2. Rules are automatically loaded and served via `/api/rules/{ruleset}`

## Configuration

### Backend
- API runs on `http://localhost:8000` (port configurable in `main.py`)
- Campaigns saved to `./campaigns/` directory
- Each campaign is a folder with `campaign.json` + `encounters/` subdirectory

### Frontend
- React dev server: `http://localhost:3000`
- API URL: `http://localhost:8000/api` (configurable via `REACT_APP_API_URL`)
- Electron stores window preferences and player window state

## Troubleshooting

**"Connection refused" error**
- Ensure backend is running: `python backend/main.py`
- Check backend is listening on port 8000

**Player view not updating**
- Real-time sync not yet implemented (Phase 2)
- Refresh player view manually to see latest state

**Campaign not saving**
- Check `./campaigns/` directory exists and is writable
- Verify `./campaigns/CampaignName/` directory was created

**Actors not showing**
- Ensure encounter is created first
- Check "Add Actor" form for missing required fields

## License

Specify your license here.
