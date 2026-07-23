# AGENTS.md notes — asm-parity (fold on integration)

Hand-written prose only; derived facts (scripts, structure, CI steps) re-scan when
`/analyze_project` runs on the integration branch.

## Special rules

- **Parity scoreboard is generated — never hand-edit.**
  `packages/test-harness/test/golden/SCOREBOARD.md` is produced by `yarn gen:scoreboard` from
  committed state only (`twins.json` + `budgets.json` + the goldens/twins). After touching any
  golden, twin, budget, or manifest value, regenerate and commit the diff — the CI "Scoreboard
  freshness" step fails otherwise. The generator refuses to render unrouted or stale divergence
  groups, so every new divergence must first get a routing entry in `twins.json`.
- **Twin corpus convention:** every committed golden has a hand-written twin beside it
  (`<fixture>.twin.asm` in `test/golden/`), registered in `twins.json` and on the twin tier
  (`twins.spec.test.ts`). Twins are test ASSETS judged by the Prime Directive — written as a
  commercial-game developer would, equivalence contract = the fixture's shared `OBSERVABLES`
  table, nothing more. Adding a golden without a twin fails the twin-diff spec (unpaired is
  pinned empty) and the tier's corpus-coverage case.
- **Measured references are measurements, not budgets.** The balloon twin's manifest
  `measured.cycles` and `budgets.json`'s `measuredMaxCycles` are asserted with exact equality
  on live VICE — if either side's code changes, re-measure (quiesced, two fresh VICE
  processes) and record the new figure; never nudge the number to green.
- Twin `.asm` data rows stay ≤8 bytes per `!byte` line — ACME's `--report` truncates longer
  rows and the report parser rejects the ellipsis.
