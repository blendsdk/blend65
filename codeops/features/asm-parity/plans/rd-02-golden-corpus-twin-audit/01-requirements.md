# Requirements: RD-02 Golden-Corpus Twin Audit + Scoreboard

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-02](../../requirements/RD-02-golden-corpus-twin-audit.md) — the OWNING requirements doc

## Scope of this plan (delta view)

### In this plan

- RD-02 **F1** — 13 twins beside the goldens (authored in four batches, Phase 3)
- RD-02 **F2** — permanent twin tier + shared observable sets, incl. the newly authored
  rasterpoll/balloon sets and their fixture-side VICE cases (Phases 1–2)
- RD-02 **F3** — pair manifest completion + the inlined-source sync test (Phases 1, 3)
- RD-02 **F4** — committed `SCOREBOARD.md` via `gen-parity-scoreboard.mjs` (Phases 4–5)
- RD-02 **F5** — CI freshness gate (Phase 5 — the step lands only after `SCOREBOARD.md` exists)
- RD-02 **F6** — routed divergence inventory, generator-enforced (Phases 4–5)
- RD-02 **F7** — balloon twin measured window + exact-equality assertions both sides (Phase 2)
- RD-02 **F8** — source-forced annotations (Phase 5, balloon unrolled-pokes case)

### Deferred / out of this plan

- Everything under RD-02 **Won't Have** (divergence fixes, the re-sweep execution, twin budgets,
  X16 twins, new harness capabilities beyond the generator).

## Plan-local decisions

Decisions NOT already in the RD — each owned by the plan register:

| Decision | Chosen | AR Ref |
| -------- | ------ | ------ |
| Balloon source↔twin behavioral divergence (found in planning) | Fix the twin to ±2 / `>=`-`<=` semantics | plan-AR #1 |
| Shared assertion shape (RD deferred) | Data-first `OBSERVABLES` tables + `assertObservables` runner + `runUntilLabelArrivals` | plan-AR #2 |
| Shared-set address boundary | Source-mandated addresses only | plan-AR #3 |
| Slice8 border check | Strengthened to exact `$D020 == 0xF2` | plan-AR #4 |
| rasterpoll/balloon observable sets | 2nd-arrival stopped-machine landmarks + check lists as recorded | plan-AR #5 |
| `twins.json` schema (RD deferred) | `measured` + `routing` blocks, five-category keys, `CATEGORIES` single-sourced | plan-AR #6 |
| Stale routing entries | Error before output | plan-AR #7 |
| Script/TS code sharing | `scripts/lib/twin-corpus.mjs` + off-barrel `twin-manifest.ts` | plan-AR #8 |
| Audit workflow | User-confirmed routing batch before commit/GitHub writes | plan-AR #9 |
| Sync-test coverage | Every inlined `.blend` module (multi-module fixtures included) | plan-AR #10 |
| New surface names | Batch as recorded | plan-AR #11 |
| Verify command | Project verify per CLAUDE.md | plan-AR #12 |
| Generator temp-input surface (plan preflight) | `--manifest` / `--budgets` flags, committed defaults, repo-inside enforced | plan-AR #11 addendum (plan-PF-002) |
| `CATEGORIES` home (plan preflight) | Defined in `scripts/lib/twin-corpus.mjs`, re-exported from `twin-diff.mjs`; TS loader keeps a local frozen copy | plan-AR #6 addendum (plan-PF-006) |
| `runUntilLabelArrivals` visibility (plan preflight) | Off the package barrel; ST-27 untouched | plan-AR #11 addendum (plan-PF-007) |
| Inlined-source drift direction (plan preflight) | `examples/` is the oracle; `SLICE3B_SRC` updated to the example's text in Phase 1 | plan-AR #10 addendum (plan-PF-003) |

## Acceptance Criteria

The RD owns AC-1…AC-10. Plan-local additions:

1. [ ] The balloon twin's movement/bounce semantics match `main.blend` exactly before its pair
   enters the twin tier (plan-AR #1); its header comment stays truthful.
2. [ ] `runUntilLabelArrivals` Nth-arrival semantics are proven by a live VICE probe spec before
   any suite relies on 2nd-arrival landmarks (plan-AR #2).
3. [ ] The routing table is presented to and confirmed by the user before `twins.json` routing is
   committed and before any GitHub issue write (plan-AR #9).
