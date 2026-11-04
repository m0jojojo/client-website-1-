# Contributing

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), enforced by commitlint on `commit-msg`.
Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
Format: `type(scope): imperative summary` (max ~72 chars), body explains why.
One logical change per commit. Example: `feat(cart): add quantity stepper to cart drawer`.

## Branches

`main` is always releasable. Work happens on short-lived branches (e.g. `phase-3-home-page`)
unless the owner chooses otherwise.

## Quality gates

Pre-commit runs lint-staged (ESLint + Prettier). CI runs lint, typecheck, format check,
unit tests and Playwright e2e. A change is not done with failing tests.

## Tests

Every feature ships with tests: unit/component in `tests/unit/` (Vitest + Testing Library),
end-to-end in `tests/e2e/` (Playwright, desktop and mobile projects).

## Docs

Update `CHANGELOG.md` and the phase file in `docs/phases/` with every phase.
Secrets never go in git; add new variables to `.env.example`.
