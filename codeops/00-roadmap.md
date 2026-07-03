# Portfolio Roadmap: blend65.ri

> **Status**: Active
> **Last Updated**: 2026-07-03
> **Features**: 0 / 1 done
> **CodeOps Skills Version**: 3.0.0

## Legend

⬜ Backlog · 🔄 In progress · ✅ Done · ⛔ Blocked · ⏸️ Deferred · 📦 Archived

## Features

| Feature | Roadmap | Stage Summary | Progress | Status | Last Updated |
|---------|---------|---------------|----------|--------|--------------|
| blend65-ri | [→](features/blend65-ri/00-roadmap.md) | RD-15 executing 🔄 (2026-07-03, Phase 1/4 complete — host abstraction, driver codes, PF-002 rename; 11/50 tasks) | 16/20 | 🔄 | 2026-07-03 |

## Archived

| Feature | Roadmap | Completed | Last Updated |
|---------|---------|-----------|--------------|
| — | — | — | — |

## Notes

- 2026-07-02: migrated from the flat layout via setup_codeops.
- 2026-07-02: update_roadmap synced the blend65-ri feature from disk — 13/20 items done (codegen
  complete through RD-09), next up RD-17 (intrinsics & runtime ABI); repointed all internal plan
  paths to the nested layout.
- 2026-07-02: RD-17 requirements preflight ✅ PASSED (13 findings resolved, fixes applied to
  RD-17/RD-10/ambiguity register, runtime AR-97..AR-101 logged); RD-17 advanced to
  "RD preflighted", next step make_plan.
- 2026-07-02: RD-17 ✅ COMPLETE — plan executed 47/47 (6 phases): registry+catalog, semantic
  validation, T1/T2 lowering, T3 runtime routines (math functionally verified via the AR-P17
  in-process 6502 interpreter harness), marshalling+embedding, T4 platform mechanism, AC-19
  E2E golden + AC-17 audit PASS. AC-14 emulator tier deferred to RD-12 (AR-P4). Next: RD-16.
- 2026-07-02: RD-16 implementation plan created at
  `features/blend65-ri/plans/rd-16-compiler-configuration/` — Zero-Ambiguity Gate passed
  (8 AR-P items, challenger-hardened), 36 tasks / 4 phases; next step: plan preflight.
- 2026-07-02: RD-16 plan preflight ✅ PASSED — 8 findings PF-015..PF-022 (1 major: Phase-2
  parse spec tests asserted loader-level behavior; 6 minor incl. UTF-16→byte offset
  conversion, LineMap reuse, synthetic-span dedup scheme, hasErrors emission tracking;
  1 observation → AR-P9 post-error values), all resolved & fixes applied across the plan
  docs; RD-16 advanced to "Plan preflighted", next step exec_plan.
- 2026-07-02: RD-16 ✅ COMPLETE — plan executed 36/36 (4 phases): config diagnostic band
  E10240–E10246/W10240–41, `jsonc-parser@3.3.1` (first external runtime dep, AR-P1),
  discovery/parse/validate/merge/loadConfig modules (AR-P6), synthetic-span dedup scheme
  (AR-P2/PF-019), PF-020 hasErrors tracking; AC-01..AC-14 ticked, AC-13 data-only audit
  PASS, full workspace verify green. Runtime AR-P10 (BOM strip) provisionally resolved —
  flagged for user review. Next: RD-15.
- 2026-07-03: RD-15 requirements preflight ✅ PASSED — 10 findings (1 major PF-001, 7 minor,
  2 observations), all recommendations accepted, fixes applied to RD-15 (deps header, R47–R51,
  AC-18/19/20, §4 refresh), RD-09 (`EmitBinaryResult` rename note), both roadmaps, and
  `requirements/README.md`. PF-001: RD-15 consumes six unimplemented RD-11-remainder
  deliverables → **RD-11b reordered ahead of RD-15**; new pending order
  RD-11b → RD-15 → RD-12 → RD-13 → RD-14. Next: RD-11b preflight → make_plan.
- 2026-07-03: RD-11 requirements preflight ✅ PASSED — 14 findings (3 major: `--report=json`
  file-vs-stdout deferred to RD-15; `ResourceReport` rebuilt on shipped `SfaResourceData`
  (+ `PeepholeStats` core-resident); Ch 11 §6 build-summary layout made normative with
  render-as-zero staging → runtime AR-102; 7 minor incl. `createSeverityPolicy` adapter,
  `SourceMap.getLineMap` ownership, ANSI-in-core, unresolvable-span fallback R51, excerpt
  sanitization R52; 4 observations), all fixes applied to RD-11, RD-15 §4.4, and the
  register. RD-11b advanced to "RD preflighted", next step make_plan.
- 2026-07-03: RD-11b implementation plan created via make_plan at
  `features/blend65-ri/plans/rd-11b-diagnostics-reporting/` (4 phases / 12 sessions /
  39 tasks). Zero-Ambiguity Gate PASSED — 16 items; one independent challenger run on
  the ResourceReport cluster (converged ×3, diverged ×1 → adopted + user-ratified).
  Plan-gate amendments back-propagated into RD-11 as runtime AR-103 (ResourceReport
  completion + core aggregator + checkBinaryBudget), AR-104 (SourceMap semantics +
  has()), AR-105 (renderer presentation contract). Next: RD-11b plan preflight.
- 2026-07-03: RD-11b plan preflight ✅ PASSED WITH NOTES — 6 findings (0 critical/major;
  4 minor, all resolved per recommendation: ST-12 caret-span vs Ch 14 §1 golden mismatch,
  export-surface bookkeeping incl. missing `BuildResourceReportInputs`, RD R51
  degraded-path wording amendment (notes/help render — AR-105 addendum), gutter-width
  pinning (per-excerpt width + fixed 3-space degraded indent); 2 observations left
  open-optional: `-->` path sanitization, `checkBinaryBudget` cap/dedup JSDoc). All 31
  codebase references verified — zero phantom/stale. Report:
  `features/blend65-ri/plans/rd-11b-diagnostics-reporting/00-preflight-report.md`.
  RD-11b advanced to "Plan preflighted"; the four resolved fixes applied same day
  (plan docs + RD-11 R51 amendment + AR-105 addendum in the register). Next: exec_plan.
- 2026-07-03: RD-11b executed to ✅ COMPLETE via exec_plan — 39/39 tasks, 4 phases,
  spec-first throughout (every phase red-run recorded, goldens pass unmodified).
  `@blend65/core` gains `diagnostics/source-map.ts` (SourceMap registry, AR-104),
  `severity-policy.ts` (R50 precedence, PF-014 cap exemption), `render-terminal.ts` +
  `render-json.ts` (Ch 14 §1 caret format, R52 sanitize-then-caret security tier,
  AR-Q9 hand-rolled ANSI; verbatim-span JSON) and the new `report/` module
  (`ResourceReport` per AR-103, `buildResourceReport` by-reference embedding,
  post-ACME `checkBinaryBudget` E10034, Ch 11 §6 build-summary terminal golden with
  AR-102 zero-staging, PF-012 sorted-entries JSON). RD-11 §6: AC-11..13/15/18/19/20
  ST-evidenced; AC-08/09/14/17 audit-closed (AR-Q12); AC-16 flag half → RD-15.
  Full workspace verify green (core 237 tests). Next: RD-15 make_plan.
- 2026-07-03: RD-15 implementation plan created via make_plan at
  `features/blend65-ri/plans/rd-15-programmatic-cli-api/` (4 phases / 13 sessions /
  50 tasks). Zero-Ambiguity Gate PASSED — 19 items (V1–V19); one independent
  challenger run on the high-stakes cluster (deps, color, E10034 wiring, testing
  strategy) — converged on 4/5, supplied the decisive yargs-typing evidence on the
  fifth; user-ratified. Notables: yargs@17 + tinyglobby as the only new runtime deps
  (**chalk rejected — AR-V2 runtime-amends requirements AR-17 to zero-dep color**,
  back-propagation is task 1.1.1); E10250/E10251 driver band; injectable BuildDeps +
  skipIf real-ACME E2E + ACME added to CI (AC-07 CI-verified); E10034 via core
  checkBinaryBudget; PF-002 EmitBinaryResult rename. Next: RD-15 plan preflight.
- 2026-07-03: RD-15 plan preflight ✅ PASSED — iteration 1: 13 findings (0 critical,
  3 major, 7 minor, 3 observation), every one resolved on the recommended option
  (user "apply all as recommended") and applied to the plan docs same day. ~60 codebase
  references verified by four parallel recon agents; one independent challenger
  stress-tested the majors (converged; recalibrated the ST-40 finding major→minor).
  Majors: PF-001 — `--startup`/`--out-name` were inert (the emitted `.asm`'s `!to`
  always said `main.prg`); wired the additive `assembleProgram` override seam the
  codegen `FR-3` comment reserved + one-place `outName` derivation in `runFrontend`.
  PF-002 — added `cwd?` to `CompilerOptions` (AR-V20), the base dir the CLI temp-dir
  tests and RD-14 discovery need (`CliIo.cwd` was a dead seam). PF-003 — exit-3 rule
  rested on a non-existent ACME ICE code; re-keyed on the `isIceCode` band, with
  ACME-not-found (E10035) → exit 1 (AR-V21). Register grew to 22 items (V20/V21/V22).
  Report: `features/blend65-ri/plans/rd-15-programmatic-cli-api/00-preflight-report.md`.
  Next: RD-15 exec_plan.
