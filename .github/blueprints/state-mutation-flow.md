---
description: "Blueprint: how state changes flow from UI to disk in Game Master's Workbench — store action, API route, StateManager, persisted JSON. Load when adding any feature that reads or writes persistent state."
name: "bp-state-mutation-flow"
version: "1.0.0"
applyTo: "**"
---

# Blueprint: State Mutation Flow

## Purpose

Persistent state moves along one path in each direction. Keeping the path
singular is what lets the Electron shell, the web dev server, and the
test suite all drive the same backend unchanged.

## The path

```
React component
  → zustand store action (store.js)        # axios call lives HERE
    → FastAPI route (main.py)              # validate, delegate
      → StateManager / domain library      # business logic + persistence
        → JSON on disk (campaigns/<name>/campaign.json, scenes)
```

Read path is the reverse: component subscribes to the store; the store
fetches via axios and `set()`s the slice.

## Contract

- **Components never call axios.** All HTTP lives in store actions.
  Components call actions and subscribe to slices.
- **Store actions own error surfacing:** catch, `console.error`, and set
  `operationError` via `getErrorMessage`. Return `null`/`false` on
  failure so callers can branch.
- **Routes never do file I/O.** Persistence is the StateManager's job.
- **The StateManager is the only writer** of campaign/scene JSON. Domain
  libraries (bestiary, reference) own their own indexes and never touch
  campaign files.
- **Frontend-only operations need no route.** Precedent: actor clone is
  pure frontend — copy the payload, blank the id, clear ephemeral state,
  call the existing `addActor` action. Don't add a backend route for
  what the store can already express.
- **Save is explicit, not implicit.** Mutations update in-memory state
  and mark dirty (`isCampaignDirty`/`isSceneDirty`); persistence happens
  through the save routes. Don't sneak writes into read routes.

## When this doesn't fit

A feature needing server-side computation the StateManager shouldn't own
(e.g. PDF indexing) gets its own domain library — constructed once at
startup, called from routes. That extends the path; it doesn't fork it.
The forbidden move is a second, parallel write path to the same state.
