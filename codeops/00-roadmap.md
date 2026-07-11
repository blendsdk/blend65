# Portfolio Roadmap: blend65.ri

> **Status**: Active
> **Last Updated**: 2026-07-11
> **Features**: 0 / 1 done
> **CodeOps Skills Version**: 3.0.0

## Legend

⬜ Backlog · 🔄 In progress · ✅ Done · ⛔ Blocked · ⏸️ Deferred · 📦 Archived

## Features

| Feature | Roadmap | Stage Summary | Progress | Status | Last Updated |
|---------|---------|---------------|----------|--------|--------------|
| blend65-ri | [→](features/blend65-ri/00-roadmap.md) | **RD-18 Slice 5b 🔄 Executing — Phase 1 ✅ (2026-07-11, module merging + qualified access, 12/42)** — ST-1…ST-11 red→green: name-keyed shared module scopes + new duplicate-FUNCTION E10003 guard (stale "existing guard" claim), E90001 dup-module ICE dropped + `importEdges` recorded, `resolveQualified` ladder (value-first, E10100/E10012, platform ids excluded), `typeFieldAccess`/shared `typeCall` ladder/`typeAssign` arms (fn-as-value → ICE, const write → E10191), SFA `userCalleeOf` FieldAccess arm + `modelToModuleVars` alias guard (ONE `__var_*` slot for imported vars). 9 impl tests; full verify green; `spec/` clean. Next: Phase 2 (initializers, consts, init order). Prior: **RD-18 Slice 5b 🔬 Plan Preflighted (2026-07-11, preflight)** — iteration 1: 1 crit / 3 major / 5 minor / 1 obs, **all 10 resolved & applied** (✅ PASSED; report `features/blend65-ri/plans/rd-18-slice-5b-module-system/00-preflight-report.md`; ~50 file:line refs verified against the codebase, 48 exact; 1 independent challenger converged on all four high-stakes findings). 🔴 **PF-001** the acceptance fixture was written with a nonexistent `fn` keyword (the language keyword is `function`) — fixed across fixture + ST scenario tables; 🟠 **PF-002** the AR-4 call-rejection walk covered only `CallExpr` — builtins are their own `IntrinsicCallExpr` node kind, so `peek`/`peekw` would have silently lowered into `__init`; rule amended (reject both kinds except `lo`/`hi`, recursing lo/hi args) + new **ST-15b**; 🟠 **PF-003** ST-3/ST-7/ST-10 pinned function-local (top-level lets are untyped until Phase 2; a module-level ST-3 would be the AR-4 ICE, never "typed byte"); 🟠 **PF-004** `modelToModuleVars` alias guard added (an imported module variable double-projects a phantom `__var_<Importer>_*` slot — latent since 5a) + the AR-5 declIdx rule pinned to the declaring scope (aliases skipped). Minors: typeAssign lives in expression-typing.ts (task 1.2.5 retargeted); SIX existing goldens not five; AR-4 allowed surface corrected (unary is neither typed nor lowered today); ST-23 re-cited to AR-8 + §5.4:197-199 (spec §5.3 prescribes fall-through — the shipped `JSR _main` shim is the pre-existing RD-07c deviation, ledger row queued); `hasInitCode` optional-with-default so the five `emitStartupShim` delegations stay valid; sanitize() doc-comment staleness noted. No gate decision changed; the register carries a preflight-corrections note. **Next: exec_plan.** Prior: **RD-18 Slice 5b 📋 Plan Created (2026-07-10, make_plan)** — module-system completion, **closes RD-18 AC-4 on completion**. `features/blend65-ri/plans/rd-18-slice-5b-module-system/` (5 phases / 42 tasks), Zero-Ambiguity Gate ✅ PASSED (AR-1…AR-13 + imported I-1…I-3; 3 recon agents + 1 independent challenger — converged on all five high-stakes picks, surfaced the `--startup bare` hole). Scope: module merging (R20, name-keyed shared scopes, cross-file dup → E10003, replaces the 5a dup-module ICE); **full qualified-access value surface** (`Math.fn()` + `Math.v` reads + writes, exported-only, value-first heads, E10100/E10012 reuse, call-graph/SFA parity rider, `Math.fn`-as-value → ICE until Slice 8 `&fn`); **call-free module-var initializers** (local-`let` parity typing; call → loud ICE) + ONE global per-variable init graph, spec-literal two-level order (import-edge Kahn then stable per-variable topo), ONE E10194 per cycle with path (Tarjan reuse); **scalar const completion** (const-eval + `constValues` + E10193 + use-site inlining — closes a VERIFIED latent hole: module-const refs mis-lower to an unallocated byte-defaulted `__frame_*` symbol); `ILProgram.initCode` realized as a synthetic `__init` stream + additive `PreambleOptions.hasInitCode` → conditional `JSR __init` (initializer-free programs byte-identical — all five prior goldens stay minted; bare startup documented user-owned). Fixture: 3 files (both math files `module Math`; Main discovered first, Math inits first — import-edge order load-bearing); VICE `$C000..$C006 = 05/08/07/02/01/03/01`. **Next: preflight → exec_plan.** Prior: **RD-18 Slice 5a ✅ COMPLETE (2026-07-10, exec_plan 46/46)** — user functions/params/calls/recursion/imports ship end-to-end; **3-part bar GREEN on real VICE 3.10**: two-module `examples/slice5a/` → `$C000==$11` add(10,7) / `$C001==$84`+`$C002==$03` triple(300)=$0384 / `$C003==$10` combo(5); byte-exact golden. **Phase 0 retired the 13-byte data ceiling** (`ramStart` `$0800`→`$2000` + mandatory plan-keyed post-ACME overlap check on the E10033 band; five goldens re-minted equate-only + VICE re-verified; closes 3b AR-1/SR-3). Frontend: param collection (E10003, FN-13→E10101), `typeCall` ladder (E10100→E10051→E10023→E10175; E10170/E10171 strict same-type + E10084), return completion (E10172 + assignment family with return wording), Pass-3 edges + iterative Tarjan → **ONE E10174 per cycle with the full path** + a NEW `hasErrors`→skip-`planAllocation` driver gate, `import-resolution.ts` (E10012, user-module-wins, same-Symbol aliasing, dup-module-name unsupported-ICE until 5b); registry E10175→`NotCallable` + E10051 minted. SFA: params-first frames, sorted callee FQNs, **argument-window interference** (`main → f(1, g())`, `g → h` compiles correctly — f/h frames disjoint). Codegen: `lowerCall` store-per-arg + bare `call` with the AR-3 residual ICE; translate `call` = `JSR Module_function` + A/A:X bind with the AR-4 remaining-use-ledger guard (`f()+g()` → "value live across a call" ICE; `f(g(1),2)` compiles). SR-2: 9 B data at `$2000` (2 B saved by frame sharing), ZP 10 B unchanged, `__rt_mul16` embedded. RD-04 ledger advanced (R58/R22/R66/R80/R81/R84–R87 + AC-07/AC-15; R10/R13/R65 partial) + deviations recorded once (E10175 rename incl. Ch 06 §10 vs Ch 14 inconsistency; FN-11 no-param-limit; E1017x chapter drift; JSR-startup scoped; AR-3/AR-4/AR-13 named deferrals). RD-18 AC-4 "5a partial ✅; closes at 5b". Full verify green; `spec/` clean. **Next: Slice 5b** (module merging + `Module.fn` qualified access + call-free initializers/E10194) needs `make_plan`. Prior: **RD-18 Slice 5a 🔬 Plan Preflighted (2026-07-10, preflight)** — iteration 1: 0 crit / 2 major / 4 minor / 1 obs, **all 7 resolved & applied** (iteration 2: 0 new findings; report `features/blend65-ri/plans/rd-18-slice-5a-functions-calls/00-preflight-report.md`; 3 recon agents + 1 independent challenger, converged on both MAJORs). Both MAJORs = stale existing-code claims at never-miscompile seams: **PF-001** AR-4 live-temp guard → NEW **separate** remaining-use map (the static prescan `useCount` provably cannot distinguish must-compile `f(g(1),2)` from must-ICE `f()+g()`; per-consumed-operand-occurrence decrement, never mutate `useCount`); **PF-002** the `hasErrors`→skip-`planAllocation` gate does NOT exist → new driver-level gate in `run-frontend` guarding the whole call expression (inline `modelToFunctionInfo` + its AR-3 `reach()` DFS included), all new reachability DFS walks visited-set-bounded. MINORs: PRG load-address read-back must be built, size = header-excluded `binarySize` (PF-003); E10175 rename divergence vs the canonical Ch 14 registry recorded (PF-004); duplicate module name across files → explicit unsupported ICE until 5b merging (PF-005); `lowerCall` unresolvable-callee ICE fallback (PF-006); phantom helper name fixed (PF-007). No gate decision changed; the register carries a preflight-amendment note. **Next: exec_plan.** Prior: **RD-18 Slice 5a 📋 Plan Created (2026-07-10, make_plan)** — user functions/params/calls; Slice 5 split 5a/5b at the gate (AR-1). `plans/rd-18-slice-5a-functions-calls/` (6 phases / 46 tasks), Zero-Ambiguity Gate ✅ PASSED (AR-1…AR-16; 3 recon agents + independent challenger). 5a = the calling-convention vertical: param collection, call typing (E10170/E10171 + **E10175 repurposed `NotCallable`** + new mint **E10051** interrupt-call + E10023), return completion (E10172 + assignment family), call graph + one **E10174** per cycle (Tarjan, pre-SFA poison), imported calls (E10012), SFA feed (params/callees + challenger-hardened **argument-window interference**, AR-3), `lowerCall` store-per-arg + translate `call` (JSR + A/A:X bind) with two never-miscompile ICE guards (same-callee-in-later-arg AR-3; live-temp-across-call AR-4). **Phase 0 retires the 13-byte data ceiling** (`$0800`→`$2000` + mandatory post-ACME overlap check; closes 3b AR-1). 5b (merging + `Module.fn` + call-free initializers/init order E10194) closes RD-18 AC-4. Fixture: two-module `examples/slice5a/` → VICE `$C000==$11`/`$C001==$84`/`$C002==$03`/`$C003==$10`. **Next: 5a plan preflight → exec_plan.** Prior: **RD-18 Slice 4b ✅ COMPLETE (2026-07-07, exec_plan 26/26)** — the `switch`/`case`/`default`/`fallthrough` sub-machine ships end-to-end, **closing RD-18 AC-3**. **3-part bar GREEN on real VICE 3.10**: `examples/slice4b/main.blend` (multi-value case + `fallthrough` + auto-break + `default`) → `$C000==$19` (25) / `$C001==$07` (7); byte-exact ASM golden; negatives reject via `compile()` (E10071/E10132/E10075). Semantics: `typeSwitch` (`statement-typing.ts`) — E10075 operand / E10071 non-const / E10084 range / E10077 bespoke type-match (wired, emission→Slice 7) / E10132 duplicate / E10074 fallthrough-position / E10073 no-effect warning; case-body locals collected flat; break/continue switch-transparent (AR-6). Codegen: `lowerSwitch` (`lower.ts`) — a `brcond` **compare-chain** over the 4a CFG keystone (multi-value shared body, `fallthrough`→`br(next body)`, auto-break→`br(join)`, default tail); **zero** new IL terminator / translate work (AR-1). Five codes registered additively (E10071/E10073/E10074/E10075 + new mint E10077); **E10076** duplicate-`default` deferred parser-owned (unreachable at semantics — parser silently overwrites, PF-001). RD-04 ledger R75/R79 advanced; R76 exhaustive-enum switch (E10133) stays deferred → Slice 7 (AR-2). Full workspace verify green; `spec/` clean. **Next: Slice 5** (functions/params/calls) needs `make_plan`. Prior: **RD-18 Slice 4b 🔬 Plan Preflighted (2026-07-07, preflight)** — iter 1: 0 crit / 3 major / 2 minor / 1 obs, **all 6 resolved & applied** (3 recon agents + 1 challenger; report `plans/rd-18-slice-4b-switch/00-preflight-report.md`). Contract changes: **E10076** duplicate-`default` **dropped** (unreachable at semantics — parser silently overwrites; deferred parser-owned, PF-001); **E10077** case-type-match kept registered+wired but emission **deferred to Slice 7**, precedence E10071→E10084→E10077 ("TS-4 auto-promotion" was fictional, PF-002); out-of-switch `fallthrough` ICE fixture **kept** (not repointed) + gap deferred (PF-003); mint corrected to **five** codes (PF-004) + spec cites fixed (PF-005). Next: exec_plan. Prior: **RD-18 Slice 4b 📋 Plan Created (2026-07-07, make_plan)** — the `switch`/`case`/`default`/`fallthrough` sub-machine (deferred from 4a, AR-1). `plans/rd-18-slice-4b-switch/` (4 phases / 26 tasks), Zero-Ambiguity Gate ✅ PASSED (AR-1…AR-14). Recon: switch is fully parsed — 4b is semantics + one `lowerSwitch` case (a `brcond` **compare-chain** over the 4a CFG keystone; no parser/translate/new-IL-terminator work). Gate decisions: compare-chain (jump-table→Phase B); integer-only, enums+E10133→Slice 7; fallthrough-in-default = E10073 warning (dissolves Parked-Q4); case-type-mismatch → new **E10077** (E10072 taken by parser `MissingDefaultClause`). Closes RD-18 AC-3. Prior: **RD-18 Slice 4a ✅ COMPLETE (2026-07-07, exec_plan 35/35 + DEF-1)** — conditionals + loops + the first **multi-block CFG codegen keystone** ship end-to-end (`if`/`else`/`while`/`do-while`/`for` `to`/`downto`/`step`). **3-part bar GREEN on real VICE 3.10**: `examples/slice4a/main.blend` (for-loop with `break`/`continue` + a while + a two-armed if/else) computes `21` — `$C000==$15`, `$C001==$01`; byte-exact golden (labels `Main_main_L0..L13`, Pattern-A `le`/`add`, break→L3/continue→L2); a non-void function missing a return → **E10102** via `compile()`. Phase 1 semantics (`function-collection.ts` flat body-local recursion; `statement-typing.ts` `loopDepth`+`typeCondition`+`typeFor`; `post-check.ts` all-paths `checkAllPathsReturn`), Phase 2 `lower.ts` loop-context CFG lowering, Phase 3 `translate.ts` multi-block loop (`prescanAll()`+per-block `resetBlockState()`, PF-001). New codes E10134/E10061/E10065/E10102 (additive, AR-11); break/continue E10130/E10131. **DEF-1/AR-16**: latent RD-07b `translateComparison` Z-flag clobber → `eq`/`ne` always 0; **fixed eq/ne only** (branch after `CMP`), goldens re-minted + regression added. Phase 5: RD-04 ledger R71–R74/R77/R78/R80/R11 + AC-12/AC-17 advanced; RD-18 AC-3 "4a partial ✅; closes at 4b (switch)". Full verify green; `spec/` clean. **Next: Slice 4b** (`switch`) needs `make_plan`. Prior: **RD-18 Slice 4a 🔬 Plan Preflighted (2026-07-07)** — preflight iter 1: 0 crit / 1 major / 3 minor / 0 obs, all 4 resolved (PF-001 keystone block-state fix; PF-002 new E10065). Prior: **RD-18 Slice 4a 📋 Plan Created (2026-07-06)**. Prior: **RD-18 Slice 3b ✅ COMPLETE (2026-07-06, exec_plan 45/45)** — scalar type/scope engine end-to-end, **3-part acceptance bar GREEN on real VICE**: Phase 1 scalar type engine (Pass 3 `type-check/*`, same-type `isAssignableTo`/`commonType`, Pass 4 `post-check.ts` main() E10020/E10021/E10022, + registered E10084/E10022, AR-11); Phase 2 module scalars (`module-variable-collection.ts` + `modelToModuleVars`); Phase 3 width-aware lowering (word literals `i16u`/`word*word`→`__rt_mul16`; module scalars→`__var_*`); Phase 4 acceptance — `examples/slice3b/main.blend` assembles clean (real ACME) to a loadable PRG, byte-exact golden (`__var_Main_accB=$0800`, `__rt_mul8/16`; footprint 10B ≤ 13B shadow, AR-1), **real VICE 3.10 `$C000==$11`/`$C001==$58`/`$C002==$02`**, mixed-sign E10081 negative via `compile()`, gate/slice3a goldens unchanged; Phase 5 bookkeeping (RD-04 AC-02/03/04/06/08/13/14 scalar-subset ticked, **PF-004** AC-05→E10081 correction, RD-18 AC-2 ✅, SR-2/SR-3). Full verify green (frontend 87, compiler 82, codegen 335, test-harness 78, R15 boundary); `spec/` clean. Runtime AR-12 + AR-13 resolved. **Next: Slice 4** (control flow) needs `make_plan`. Prior: 🔬 Plan Preflighted (2026-07-05) — `plans/rd-18-slice-3b-scalar-type-engine/`: 5 phases / 45 tasks, Zero-Ambiguity Gate ✅ PASSED (AR-1..AR-11); **preflight 2 crit / 3 major / 4 minor / 1 obs, all 10 resolved & applied (iter 2)** — root cause diagnostic-code drift (codes taken from stale frozen-spec §5.3 + false "all codes exist" claim), fixed by **AR-11 code-reconciliation** (register E10084 + E10022 per RD-18 AR-115; realign boolean-arith→E10080 / narrowing→E10154 / cross-sign→E10153 / boolean-assign→E10152; drop E10086); structural build verified sound; report `00-preflight-report.md`. The scalar **type engine**: real RD-04 Pass 3 (expression/literal typing → `typeMap`/`symbolMap`, real `isAssignableTo`/`commonType`, poison) + Pass 4 (`main()`) + minimal const-eval; module-level scalar allocation (`__var_*`); width-aware lowering (thread `typeMap` → `__rt_mul16`). Recon (3 agents): codegen already lowers the surface — the build is semantics + wiring. Gate: same-type only (AR-3), module-var initializers deferred (AR-2), `$0800` region within the 13-byte BASIC-stub shadow (`>13-byte` collision = documented deferred fix, AR-1). Next: exec_plan. Prior: Slice 3a ✅ COMPLETE (2026-07-05, 21/21) — `modelToFunctionInfo` seam closed, VICE `$D020==0xF5`. Earlier: RD-12 ✅ COMPLETE (44/44); RD-15 ✅ COMPLETE (50/50) | 18/20 | 🔄 | 2026-07-11 |

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
- 2026-07-06: **RD-18 Slice 4a 📋 Plan Created — conditionals + loops + the CFG codegen keystone**
  — `make_plan` produced `plans/rd-18-slice-4a-conditionals-loops/` (10 docs: gate + index + requirements +
  current-state + 4 component specs + testing + execution plan). Scope: `if`/`else`, `while`, `do-while`,
  `for` (`to`/`downto`/`step`), `break`/`continue` end-to-end (analyzer → SFA → IL → Instr → ACME → PRG →
  VICE), landing the **first-ever multi-block CFG codegen** (lower `br`/`brcond`; translate loops all
  blocks). 4-agent recon confirmed parser/AST are complete and the codegen scaffolding (br/brcond/ret/
  unreachable terminators + builder `openBlock`/`reserveLabel`) is ready — the work is semantics + CFG
  wiring, not a rebuild. Six gate decisions (AR-1…AR-6, user): **split** `switch`→Slice 4b; **core+safety**
  validators (boolean-condition E10134, break/continue E10130/E10131, all-paths-return E10102, for end-bound
  E10064, step E10061; defer E10060/E10062/E10101); **defer `until`** (parser-blocked); all-paths-return =
  **E10102** (Ch-05 number, free); for-counter shadowing **deferred** (Parked Q3); for-loop **Pattern A
  only** (full-range wrap deferred). 5 phases / 35 tasks; Zero-Ambiguity Gate ✅ PASSED (AR-1…AR-14). Next:
  exec_plan (optionally preflight first).
- 2026-07-06: **RD-18 Slice 3b ✅ COMPLETE (exec_plan 45/45) — scalar type/scope engine end-to-end**
  — Phase 5 closed the rollout bookkeeping. In the archived RD-04 deferred ledger, ticked AC-02/03/04/
  06/08/13/14 (scalar subset) + added a Slice-3b advancement banner over rows R7/R8, R14–R16/R61,
  R30–R36, R44–R49, R54, R63, R66, R80/R81, R114. **PF-004 correction applied:** RD-04 AC-05's
  "`byte + sbyte` → E10153" was wrong — mixed-sign **arithmetic operands** are **E10081** (R49); E10153
  is the *assignment* cross-sign case (R33) — corrected with an AR-11 note, not ticked as-worded. Ticked
  **RD-18 AC-2** (Slice 3b) with real-VICE evidence. Recorded SR-2 (module vars 3B + frame 7B = 10B var
  footprint; `__rt_mul8`+`__rt_mul16` embedded vs Slice 3a's none) + **SR-3** the AR-1 ceiling: the var
  region occupies the 13-byte dead-BASIC-stub shadow `$0800–$080C`, so a fixture whose vars exceed 13
  bytes would collide with `__startup` at `$080D` (general relocation fix deferred to a memory-layout
  slice). Full workspace verify green; `git status --porcelain spec/` empty. **Next: Slice 4 (control
  flow — `if`/`while`/`for`/`switch` + CFG + new gate diagnostic codes) needs `make_plan`.**
- 2026-07-06: **RD-18 Slice 3b 🔄 Executing — Phase 4 ✅ (acceptance; 3-part bar GREEN on real VICE, 41/45)**
  — exec_plan Phase 4 proved the whole slice end-to-end. `examples/slice3b/main.blend` (module `accB:byte`
  + `accW:word`; `main` computes `accB = a*b+c` = 17 = `$11` and `accW = x*y` = 600 = `$0258`, then
  `poke($C000,accB)`/`pokew($C001,accW)`) assembles clean through real ACME to a loadable c64 PRG; a
  byte-exact golden was minted (`__var_Main_accB=$0800`/`accW=$0801`, `__rt_mul8`, `__rt_mul16`; total var
  footprint `$0800–$0809` = 10 bytes ≤ the 13-byte dead-BASIC-stub shadow, AR-1 — `__startup` clears it).
  On **real VICE 3.10 (x64sc)** `$C000==$11`, `$C001==$58`, `$C002==$02` — the full type-engine → SFA →
  width-aware codegen → ACME → PRG → VICE path computes correctly. The mixed-sign negative (ST-19) rejects
  `byte + sbyte` with **E10081** via the frontend-only `compile()` facade (no binary, never throws). gate/
  slice3a goldens unchanged (ST-20 — width-threading left the byte-only fixtures byte-exact). test-harness
  78 green; full workspace verify green; `spec/` untouched. Next: Phase 5 (rollout bookkeeping — tick RD-04
  AC-02/03/06/08 + AC-14 scalar subset, correct RD-04 AC-05 `byte+sbyte`→E10081, RD-18 AC-2, SR-2/SR-3).
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
