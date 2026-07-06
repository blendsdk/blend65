# Portfolio Roadmap: blend65.ri

> **Status**: Active
> **Last Updated**: 2026-07-05
> **Features**: 0 / 1 done
> **CodeOps Skills Version**: 3.0.0

## Legend

⬜ Backlog · 🔄 In progress · ✅ Done · ⛔ Blocked · ⏸️ Deferred · 📦 Archived

## Features

| Feature | Roadmap | Stage Summary | Progress | Status | Last Updated |
|---------|---------|---------------|----------|--------|--------------|
| blend65-ri | [→](features/blend65-ri/00-roadmap.md) | RD-18 Slice 3b 🔄 Executing (2026-07-06) — **Phases 1–3 ✅ COMPLETE (33/45)**: Phase 1 scalar type engine (real RD-04 Pass 3 `type-check/*` → populated `typeMap`/`symbolMap`, same-type `isAssignableTo`/`commonType`; Pass 4 `post-check.ts` main() E10020/E10021/E10022; emits E10081/E10080/E10084/E10100/E10152/E10153/E10154/E10173/E10191 + registered E10084/E10022, AR-11); Phase 2 module-level scalars (`module-variable-collection.ts` + `modelToModuleVars`; `run-frontend` feeds real `moduleVars`); Phase 3 width-aware lowering (`lower.ts` reads `model.typeOf` → word literals `i16u`/`word*word`→`__rt_mul16`; module scalars → `__var_*` via `model.symbolOf`→module scope; byte path/goldens unchanged; poison→i8u fallback). Full verify green (frontend 87, compiler 82, codegen 335, gate/slice3a goldens unchanged, R15 boundary). Runtime AR-12 (ST-S21 superseded; Pass-4 gated on ≥1 function) + AR-13 (E10150 parser-owned) resolved. Next: Phase 4 (acceptance — fixture + assemble-clean + golden + local VICE). Prior: 🔬 Plan Preflighted (2026-07-05) — `plans/rd-18-slice-3b-scalar-type-engine/`: 5 phases / 45 tasks, Zero-Ambiguity Gate ✅ PASSED (AR-1..AR-11); **preflight 2 crit / 3 major / 4 minor / 1 obs, all 10 resolved & applied (iter 2)** — root cause diagnostic-code drift (codes taken from stale frozen-spec §5.3 + false "all codes exist" claim), fixed by **AR-11 code-reconciliation** (register E10084 + E10022 per RD-18 AR-115; realign boolean-arith→E10080 / narrowing→E10154 / cross-sign→E10153 / boolean-assign→E10152; drop E10086); structural build verified sound; report `00-preflight-report.md`. The scalar **type engine**: real RD-04 Pass 3 (expression/literal typing → `typeMap`/`symbolMap`, real `isAssignableTo`/`commonType`, poison) + Pass 4 (`main()`) + minimal const-eval; module-level scalar allocation (`__var_*`); width-aware lowering (thread `typeMap` → `__rt_mul16`). Recon (3 agents): codegen already lowers the surface — the build is semantics + wiring. Gate: same-type only (AR-3), module-var initializers deferred (AR-2), `$0800` region within the 13-byte BASIC-stub shadow (`>13-byte` collision = documented deferred fix, AR-1). Next: exec_plan. Prior: Slice 3a ✅ COMPLETE (2026-07-05, 21/21) — `modelToFunctionInfo` seam closed, VICE `$D020==0xF5`. Earlier: RD-12 ✅ COMPLETE (44/44); RD-15 ✅ COMPLETE (50/50) | 18/20 | 🔄 | 2026-07-06 |

## Archived

| Feature | Roadmap | Completed | Last Updated |
|---------|---------|-----------|--------------|
| — | — | — | — |

## Notes

- 2026-07-03: **RD-12 ✅ COMPLETE** — exec_plan 44/44 tasks, 4 phases. `@blend65/test-harness`
  ships the runtime-verification framework: abstract `EmulatorDriver` (+`advanceInstructions`,
  AR-H18) + the pure VICE binary-monitor codec (CI byte-exact) + `ViceDriver` on real VICE 3.10 +
  zero-dep PNG; the three timeout-guarded run strategies; register/memory assertions; the R7a
  registry; the `setupEmulator` fixture (+`hasVice`/`hasAcme`); and `assertGolden`. All 16 own ACs
  ticked with ST evidence, **RD-17 inherited AC-14 discharged on real silicon** (ST-30..33 `__rt_*`
  math on VICE), the MVP gate program pokes $D020 on real VICE (ST-29), DEF-2 closed as Phase 0
  (`--vicelabels` → populated `symbolMap`). Runtime finding AR-H19 ($D020 reads 0xF5, unused
  VIC-II nibble). Full workspace verify green (17/17 turbo, harness 71 tests); Local emulator
  suites `skipIf` in CI, run sequentially. Feature 18/20; next RD-13 (needs make_plan).
- 2026-07-03: **RD-12 📋 Plan Created** — `make_plan` produced
  `features/blend65-ri/plans/rd-12-test-harness/` (4 phases / 10 sessions / 44 tasks;
  Zero-Ambiguity Gate PASSED, 17 items AR-H1..H17). Full-RD scope. Locked: depend on
  `@blend65/compiler` + reuse `parseLabelFile`/`BuildResult`; prove emulator/RD-17 tests green
  locally on VICE 3.10 (skipIf keeps CI green); hand-rolled zero-dep PNG; bounded RD-17 AC-14
  vectors; relaunch VICE per binary. **Grounding surfaced a blocking latent RD-09 defect
  (DEF-2):** `invokeAcme` uses `-l` not `--vicelabels`, so every real build returns an empty
  `symbolMap` — fixed as Phase 0 with a regression oracle (verified live). Real gate symbols
  pinned (`_main=$0819`, `__startup=$080d`). Next: plan preflight → exec_plan.
- 2026-07-06: **RD-18 Slice 3b 🔄 Executing — Phase 3 ✅ (width-aware lowering, 33/45)** — exec_plan
  Phase 3 threaded real types into codegen. `lower.ts` now reads `ctx.model.typeOf(expr)` for
  `lowerNumericLit`/`lowerBinary` IL width (word literal → `i16u`, `word*word` result `i16u` →
  `__rt_mul16` in translate), reusing the existing `ilTypeOfType` (PF-007) — the model was already on
  `LowerCtx`/`LowerInput` (PF-008), so no new plumbing. Module scalars lower to `__var_*` via a new
  `moduleVarOf` (`model.symbolOf(ident)` → `scope.kind==="module"`) + `moduleVarSymbol` (exact `sanitize`
  match to SFA's emission) in `lowerIdent`/`lowerAssign`. Byte path unchanged (gate/slice3a goldens hold
  with the empty-model fixtures → `ilTypeOfType(ErrorType)`=IL_BYTE); a poisoned binary falls back to i8u
  without throwing. Spec-first via a real-frontend `lowerRealSource` helper (codegen depends on frontend):
  ST-13/14/15 red→green + 3 impl edge cases. Full workspace verify green (codegen 335, all packages, R15
  boundary). `spec/` untouched. Next: Phase 4 (acceptance — fixture assemble-clean + golden + local VICE
  asserting `$C000==$11`/`$C001==$58`/`$C002==$02`).
- 2026-07-06: **RD-18 Slice 3b 🔄 Executing — Phase 2 ✅ (module-level scalars, 25/45)** — exec_plan
  Phase 2 widened the surface to module-level scalars. New `module-variable-collection.ts` (Pass-1
  sibling) registers top-level `let`→`variable`/`const`→`constant` into the module scope
  `collectFunctions` built (E10003 on duplicate), wired into `analyze.ts` before typing so a function
  body reference resolves innermost-first (body→module→global). `modelToModuleVars` (`sfa/model-adapter.ts`,
  barrel-exported) projects module scalars → `ModuleVarInput[]` (`kind:"variable"` only, per-scalar
  `byteSize`); `run-frontend.ts` now feeds it (`moduleVars: []`→real) so SFA lays out `__var_*`. The
  module-`const` E10191 assign path is now reachable (impl-tested). Full workspace verify green (frontend
  semantics+adapter 87, compiler 82, golden-gate/slice3a unchanged, R15 boundary). `spec/` untouched.
  Next: Phase 3 (width-aware lowering — thread `typeMap` so word literals/results reach `__rt_mul16`).
- 2026-07-06: **RD-18 Slice 3b 🔄 Executing — Phase 1 ✅ (scalar type engine, 16/45)** — exec_plan
  Phase 1 landed the real RD-04 Pass 3 + Pass 4 type engine over the model seam Slice 3a proved.
  New frontend `semantics/type-check/` (context, name-resolution, type-resolution, expression-typing,
  statement-typing) + `const-eval.ts` + `post-check.ts`; core `type-utils.ts` gains the real same-type
  `isAssignableTo`/`commonType` (stubs replaced); `passes.ts postCheck` + `analyze.ts` wired so
  `typeOf`/`symbolOf` read populated maps. Diagnostics: E10081/E10080/E10084/E10100/E10152/E10153/
  E10154/E10173/E10191 (+ additive registrations E10084 `ValueOutOfRange` / E10022 `InvalidMainSignature`
  per AR-11). Spec-first: 4 spec files red→green (core type-utils 3, frontend 12) + 2 impl files (14).
  Full workspace verify green (build/typecheck/lint + core 240 / frontend semantics 64 / test-harness 74 /
  root R15 boundary; golden-gate & golden-slice3a unchanged). Two runtime ambiguities resolved & recorded:
  **AR-12** (the Slice-3a empty-`typeMap`/`symbolMap` assertion ST-S21 is superseded by 3b population;
  Pass-4 `main`-existence gated on ≥1 collected function so junk/empty/function-free inputs stay silent)
  and **AR-13** (E10150 is unreachable from source — missing type annotation is parser-owned E10313/E10303;
  ST-7 reframed, no dead analyzer check). `spec/` untouched (D3). Next: Phase 2 (module-level scalars).
- 2026-07-05: **RD-18 Slice 3b 🔬 Plan Preflighted** — codebase-grounded audit (4 recon agents + 1
  refutation challenger): 2 critical / 3 major / 4 minor / 1 observation, **all 10 resolved & applied
  (iter 2)**. Root cause: diagnostic-code drift — the plan transcribed codes from the **stale frozen
  spec Ch 02 §5.3** (E10082/E10080/E10086) that collide with the authoritative `diagnostic-codes.ts`
  registry, and falsely claimed all codes exist. Resolved by **AR-11 code-reconciliation**: register
  E10084 + E10022 additively (per RD-18 AR-115, Language-Guard); realign boolean-arith→E10080,
  narrowing→E10154, cross-sign→E10153, boolean-assign→E10152; drop E10086 (casts are Slice 6). The
  structural build (type engine, module-var SFA feed, width-aware lowering, VICE fixture) was verified
  sound — every `file:line` cite true, both `__var_*`/`__frame_*` symbol formats exact. Task count
  44→45. Report `plans/rd-18-slice-3b-scalar-type-engine/00-preflight-report.md`. Next: exec_plan.
- 2026-07-05: **RD-18 Slice 3b 📋 Plan Created** — `make_plan` produced `plans/rd-18-slice-3b-scalar-type-engine/`
  (5 phases / 44 tasks), Zero-Ambiguity Gate ✅ PASSED (AR-1..AR-10). Slice 3b is the RD-18 tent-pole:
  the scalar **type engine** — real RD-04 Pass 3 (expression/literal typing → populate `typeMap`/`symbolMap`,
  real `isAssignableTo`/`commonType`, poison propagation) + Pass 4 (`main()` validity) + minimal const-eval;
  module-level scalar declaration/allocation (`__var_*`, the existing SFA infra now fed); width-aware
  lowering (thread the model `typeMap` into codegen so word literals reach `IL_WORD`/`__rt_mul16`). Three
  parallel codebase-recon agents established the surface already lowers/translates end-to-end (let/`=`/return/
  same-type `+ - * / %`/peek/poke(w)) — the build is **semantics + wiring**, not a codegen rebuild. Four
  interactive gate decisions: (AR-1) keep the SFA `$0800` variable region within the 13-byte dead-BASIC-stub
  shadow, deferring the general `>13-byte` variable/code collision fix; (AR-2) defer module-var initializers
  (declare + assign in body, spec VAR-2); (AR-3) same-type only (widening/casts/promotion → Slice 6, which
  needs `zext`/`sext` that translate ICEs on); (AR-4) byte+word fixture poked to plain RAM for exact VICE
  assertions + an E10081 mixed-sign negative. No new diagnostic codes; `spec/` frozen. Next: preflight the
  plan → exec_plan.
- 2026-07-05: **RD-18 Slice 3a ✅ COMPLETE** — exec_plan 21/21 tasks across 3 phases (`--auto-commit`),
  full workspace verify green. The `modelToFunctionInfo` seam is closed: new `function-collection.ts`
  populates a minimal real `SemanticModel` (per-module `Scope` + function symbols declared in it +
  ordered locals in body scopes + `mainFunction`); `analyze()` invokes it alongside
  `collectDeclarations` (`passes.ts` untouched, PF-002); `modelToFunctionInfo` projects real
  `FunctionInfo[]` (`name="Main.main"` with the FQN module read from `fn.scope.node.name`, AR-13). The
  3-part acceptance bar passes: CI assemble-clean + CI golden (`__frame_Main_main_x = $0800`) + local
  VICE `$D020==0xF5` on real 3.10 (plus gate ST-8 non-regression). Parent ACs ticked (RD-05 AC-22
  superseded — empty model still `[]`; RD-04 deferred-ledger R7/R8 real scope construction begun;
  RD-18 AC-1 ✅); gate golden re-minted +1 line (AR-8, VICE re-verified); SR-2 delta recorded
  (+6 code / +1 frame RAM / 0 ZP). `spec/` clean. Next: Slice 3b (scalar type engine) needs `make_plan`.
- 2026-07-05: **RD-18 Slice 3a 🔬 Plan Preflighted** — plan preflight: 0 critical / 1 major /
  2 minor / 3 observation, all 6 resolved & applied (iteration 2). MAJOR (AR-13): the adapter could
  not recover a function's module for the FQN from a `SemanticModel` → closed by building a per-module
  `Scope` and reading `fn.scope.node.name` (model-only, no `@blend65/core` change, honors AR-4,
  reusable by 3b; hardened by an independent refutation challenger). Also PF-002 (`analyze()`
  orchestrates both Pass-1 collectors), PF-003 (red-vs-green-guard spec tests), + 3 doc-clarity
  observations. Report `plans/rd-18-slice-3a-model-seam/00-preflight-report.md`. Next: exec_plan.
- 2026-07-05: **RD-18 Slice 3a 📋 Plan Created** — `make_plan` produced
  `plans/rd-18-slice-3a-model-seam/`: 3 phases / 21 tasks, Zero-Ambiguity Gate PASSED (AR-1..13).
  Scope = the keystone model-seam proof only: populate a minimal real `SemanticModel` (`main` + one
  local `byte`), implement `modelToFunctionInfo`, 3-part acceptance (CI assemble-clean + CI golden +
  local VICE `$D020==0xF5`). Two-agent codebase recon confirmed the entire downstream
  (SFA→symbols→ACME→PRG→VICE) is already wired — the sole stub is `modelToFunctionInfo`
  (`model-adapter.ts:34`) + the empty-model `analyze()`; IL lowering is name-and-frame-keyed
  (`lower.ts:206,268`), so the local-byte fixture lowers with no new codegen. Locked: 3a only;
  use-the-local fixture; adapter reads the populated model not the AST; population = reusable RD-04
  Pass-1 slice in new `function-collection.ts` (3b extends); `FunctionInfo.name="Main.main"`; gate
  golden intentionally re-minted + VICE re-verified. Next: preflight the plan → exec_plan.
- 2026-07-04: **RD-18 🔎 RD-Preflighted** — requirements preflight: 0 critical / 2 major / 4 minor,
  all 6 resolved & applied. Both majors were diagnostic-code mis-citations (RD-18 pulled control-
  flow/function codes from the stale `00-feature-index.md`/F0xx numbering, not the canonical
  `spec/14-diagnostics.md` the compiler implements): recursion → unified `E10174`; three code-less
  Slice-4 checks (non-boolean-condition, all-paths-return, `fallthrough`) routed to the slice gate
  as new `diagnostic-codes.ts` entries with `spec/` frozen (AR-115, Option A). One independent
  challenger confirmed the batch. Next: `make_plan` for Slice 3a.
- 2026-07-03: **RD-12 🔎 RD-Preflighted** — requirements preflight iteration 1: 0 critical /
  0 major / 6 minor / 2 observations, all applied to the RD-12 doc. Both initially-MAJOR
  findings were knocked down by an independent blind challenger (the interim in-process 6502
  interpreter self-declares "RD-12 supersedes this" and is ACME-gated — not an AR-27
  emulator-tier violation; RD-12 has its own AC-14 distinct from RD-17's inherited one). The
  doc now cross-references the interim interpreter, discharges RD-17's AC-14 (§5), binds
  R27/R28 to RD-15's `BuildResult`, pins R19 symbol keys to `parseLabelFile`, and adds a
  harness-internal platform→emulator registry (R7a). Ready for `make_plan`.
- 2026-07-03: **RD-15 ✅ COMPLETE** — exec_plan 50/50 tasks, 4 phases. `@blend65/compiler`
  ships the `compile`/`emitIl`/`emitAsm`/`build` facade (+ `CompilerHost`/`DiskCompilerHost`,
  driver codes E10250/E10251, the PF-001 codegen seam, PF-002 `EmitBinaryResult` rename);
  `@blend65/cli` ships the full `blendc` command (yargs@17, zero-dep color, R50 exit codes,
  emit/report flags). AC-18 no-print enforced (ESLint + ST-39); CI installs ACME so the ST-40
  real-ACME E2E runs live. Discharged the deferred RD-11 items (AC-16/AC-10/AC-21). Surfaced &
  fixed a latent RD-09 defect (DEF-1/AR-V23 — headerless PRG via `-o`; now `!to,cbm`-driven).
  Full workspace verify + CI green. Feature 17/20; next RD-12 (emulator tier) needs make_plan.
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
