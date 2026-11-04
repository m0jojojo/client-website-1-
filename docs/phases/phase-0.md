# Phase 0: Setup

## Built

Project scaffold, tooling, hooks, CI, docs skeleton, placeholder home page.

## Run

`npm install && npm run dev`

## Manual test checklist

1. `npm run dev`, open http://localhost:3000: heading "The Block Bagru" shows.
2. `npm run lint`, `npm run typecheck`, `npm run format:check` all pass.
3. `npm test`: 1 unit test passes. `npm run test:e2e`: 2 e2e tests pass (desktop, mobile).
4. Try a bad commit message (after git identity is set): hook rejects it.

## Known gaps

No design, data or features yet (by design). `npm audit` reports moderate dev-dependency advisories to review in Phase 11.
