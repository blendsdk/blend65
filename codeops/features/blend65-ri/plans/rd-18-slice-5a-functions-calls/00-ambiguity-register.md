# Ambiguity Register: RD-18 Slice 5a — User Functions, Parameters & Calls

> **Status**: ✅ GATE PASSED — all 16 items resolved (2026-07-10; final register confirmation below); preflight amendments applied (iteration 1, PF-001..PF-007 — see note at the end)
> **Last Updated**: 2026-07-10 (preflight amendments)
> **Plan**: `rd-18-slice-5a-functions-calls` (Slice 5 split per AR-1; 5b = module-system completion, planned separately)
> **Hardening**: three recon agents (frontend semantics / SFA / codegen) + one independent
> challenger over the high-stakes batch (AR-1..AR-4, AR-9..AR-12). Challenger verdicts:
> converged on AR-1/AR-2/AR-11/AR-12; improved AR-3 (argument-window interference edges);
> surfaced AR-4 (call-crossing temps) as a new hazard; diverged on AR-9 (E10175 repurpose
> vs E10177 mint — user chose the challenger's option).

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Scope | Slice 5 is too large for one plan (60+ tasks est.): split? | (A) split 5a (calling-convention vertical: params, call typing, call graph + E10174, SFA wiring, lowerCall/translateCall, minimal cross-module imported calls E10012) / 5b (module merging, qualified access, initializers + init order E10194); (B) one plan | **A — split 5a/5b** (recommended; challenger converged). Pre-agreed trim: if 5a exceeds ~50 tasks at planning, imports/E10012 move to 5b. RD-18 AC-4 closes at 5b (4a/4b precedent). | ✅ Resolved |
| 2 | Technical | 13-byte data ceiling: module vars + frames at `$0800` overlay the dead BASIC stub; live code starts `$080D`; no diagnostic guards the overlap (RAM budget checks $A000−$0800). Multi-function programs exceed 13 B → silent code clobber. Closes the 3b AR-1 deferral. | (A) move `DEFAULT_PROFILE.ramStart` `$0800`→`$2000` + MANDATORY post-ACME overlap check (`loadAddress+size ≤ plan's data base`, keyed off the plan not a constant) as **Phase 0** (single golden re-mint + VICE re-verify); (B) guard-only at $0800; (C) code-size-aware placement | **A** (recommended; challenger converged + hardened: check mandatory, keyed off the plan's actual data base so it survives the future per-platform profile switch — `c64Profile.ramStart` `$0801` would reintroduce the overlap). | ✅ Resolved |
| 3 | Technical | Argument marshalling design. Hazard: a later argument whose evaluation calls a function can clobber already-stored callee arg slots — via the same callee AND via sibling-frame coloring aliasing (interference is ancestor-descendant only; `f(1, g())` with `g→h` sibling of `f` can alias `f`/`h` frames). | (A+) lowering stores each arg into the callee's param-slot symbol immediately after evaluating it left-to-right (spec Ch 06 §5.4/§6.1 shape); translate `call` = bare `JSR` + bind result A/A:X; soundness via (1) new interference edges — callee interferes with every function reachable from calls inside its argument list, (2) residual same-callee case → explicit unsupported-in-this-slice ICE; (C) caller-frame spill slots for all args; translate-marshalling filtered out (needs nonexistent spill machinery) | **A+** (recommended; challenger diverged→improved — the arg-window interference edges are its find; the original reachability-only guard was unsound). Residual deferral: *later arg transitively reaching the callee itself* → ICE; owner: user; revisit: caller-frame scratch-slot slice. | ✅ Resolved |
| 4 | Edge case | (Challenger find H1) A value live ACROSS a user call in one expression — `f() + g()` — miscompiles: temps spill to the global `__zp_tmp` pool, which the callee's own expression code reuses (unlike `__rt_*` routines, which only touch `__zp_arg`). | (i) translate detects a live temp at a user-call `JSR` (prescan use counts) → explicit unsupported-in-this-slice ICE; general fix (caller-frame scratch slots) designed as a seam, lands later; fixture avoids the shape; (ii) build caller-frame scratch slots now | **(i) detect + defer** (recommended). Named deferral: caller-frame scratch slots; owner: user; revisit: the slice that needs `f()+g()` shapes (6 or a cleanup slice). | ✅ Resolved |
| 5 | Behavioral | Argument type policy (spec Ch 06 §4.2 auto-promotion vs the Slice-3b strict same-type lock; promotion engine = Slice 6). Registry: E10170 `WrongArgCount` / E10171 `ArgTypeMismatch` (chapter-table E10171/E10172 is stale drift). | (a) strict same-type via `checkAssignable` logic; count → E10170; every argument-position type failure → single code E10171; promotion arrives with Slice 6; record the E1017x chapter-table drift once in the ledger; (b) implement promotion now | **(a) strict same-type** (recommended). | ✅ Resolved |
| 6 | Behavioral | Return-statement completion: `return;` in non-void, and `return expr` type mismatch (registry: E10172 `MissingReturnValue`; no dedicated mismatch code — ledger R80 routes to the assignment family). | (a) `return;` in non-void → E10172; mismatch → reuse `checkAssignable` family E10152/E10153/E10154 with return-context message wording ("return type of 'f'"); (b) mint a dedicated return-mismatch code | **(a) E10172 + assignment family** (recommended). | ✅ Resolved |
| 7 | Behavioral | Recursion diagnostic granularity: RD-04 R86 "on every function in the cycle" vs the spec Ch 06 FN-6 example rendering ONE error with the full cycle path. | (a) one E10174 per cycle (SCC — Tarjan; self-loop or size>1), message carries full path (`ping → pong → ping`), canonical anchor (first-declared member) for byte-stable goldens; cycle rejection poisons BEFORE `planAllocation` consumes `callees` (challenger H4 — coloring on a cyclic graph is meaningless); (b) one diagnostic per participating function | **(a) one per cycle + path** (recommended). | ✅ Resolved |
| 8 | Behavioral | Parameter rules bundle: params are never collected today; which checks land with them in 5a? RD-04 R65 "max 8 params (E10175)" conflicts with frozen FN-11 "no limit" — spec authoritative. | (a) collect params as `parameter` symbols (types via `resolveTypeNode`); duplicate param name → E10003; FN-13 param-vs-module-level shadowing → E10101; NO param-count limit — RD-04 R65 recorded as spec-refuted deviation; (b) same minus FN-13 | **(a) full bundle** (recommended). | ✅ Resolved |
| 9 | Naming | "Cannot call a non-function" (`x()` on a variable) has no canonical code. Frozen spec table: E10175 = exactly this; registry E10175 = `TooManyParameters`, unwired and permanently dead per FN-11/AR-8. | (a) REPURPOSE: rename registry E10175 → `NotCallable` (spec-table alignment; zero emit sites → no compatibility surface; challenger's pick); (b) mint new E10177 `NotCallable` (strict additive precedent; permanent spec-table drift) | **(a) repurpose E10175 → NotCallable** (recommended after challenger divergence; user chose it). One ledger entry covers this + the FN-11 no-param-limit deviation. | ✅ Resolved |
| 10 | Behavioral | Calling an `interrupt function` directly: spec E10051, NOT in the registry. Miscompile guard — interrupt bodies end in RTI; a user `JSR` corrupts the stack (pushes 2, RTI pops 3) and jumps wild. Interrupt decls already parse + collect. | (a) mint + wire E10051 `CallToInterruptFunction` in 5a (spec-numbered free slot; trivial check off the `interrupt` symbol kind); (b) defer to Slice 8 | **(a) mint + wire in 5a** (recommended; challenger converged emphatically). | ✅ Resolved |
| 11 | Behavioral | E10023 `CallingMainDirectly` (registered, unwired, in-code deferral note "until call sites exist") and W10181 unused-function (unregistered). | (a) wire E10023 in 5a; W10181 stays unregistered as a named deferral (needs export/address-taken liveness); (b) defer both | **(a) wire E10023; defer W10181** (recommended). W10181 deferral: owner: user; revisit: Slice 8 (address-of/liveness) or the cleanup slice. | ✅ Resolved |
| 12 | Scope | Startup shim: frozen Ch 10 §5.3 fall-through vs the current `JSR _main` + bank-restore (`terminating` variant the VICE harness needs). | (a) keep `JSR _main` for `terminating` — SCOPED deviation (spec's fall-through rationale targets a never-returning main); fall-through = the NON-terminating variant's mechanism in Slice 8; (b) implement fall-through now | **(a) keep JSR; fall-through at Slice 8** (recommended; challenger converged — per-variant correctness, not a blanket deviation). | ✅ Resolved |
| 13 | Scope | Import aliasing `import { X as Y }`: in the frozen spec (Ch 10 §4.2) but `as` is not a lexer keyword — lexer + parser + AST + resolution work; no planned fixture needs it. | (a) named deferral — imports without aliasing; collisions → E10003, rename-in-source workaround; (b) implement in 5b | **(a) named deferral** (recommended). Owner: user; revisit: when a fixture/user program needs a cross-module rename (natural home: the cleanup slice that also owns general shadowing). | ✅ Resolved |
| 14 | Integration | Import-path resolution precedence: dotted paths; user modules and platform-intrinsic modules (`c64`, `c64.system`) share one namespace; T4 boundary consumes imports today. | (a) exact user-module-name match wins; otherwise the platform-intrinsic registry (current T4 behavior unchanged); a user module literally named `c64` shadows the platform id (documented); (b) reserve platform ids (new error the spec doesn't state) | **(a) user module wins** (recommended). | ✅ Resolved |
| 15 | Scope | 5b content (contingent on AR-1): merging, qualified access, initializers + init order. Frozen Ch 10 §5.4 = PER-VARIABLE dependency order (not RD-04 R23's import-graph granularity). | (a) full 5b: module merging (R20, cross-file duplicate → E10003), qualified access `Module.fn` (R17), CALL-FREE module-var initializers + per-variable topo order + E10194, lowered through the existing `ILProgram.initCode` seam, run before `main`, VICE-verified; call-bearing initializers → named deferral (the spec's dependency rule is defined over variable reads; calls hide reads); (b) 5b without initializers (third deferral; AC-4 partial) | **(a) full 5b incl. call-free initializers** (recommended; challenger converged; E10194-detection-only rejected as validators-without-codegen). | ✅ Resolved |
| 16 | Integration | Verify command + 5a acceptance fixture shape. | (a) verify = `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` (inherited, unchanged); fixture = `examples/slice5a/` with TWO files (`main.blend` module Main + `math.blend` module Math): exported byte-param/byte-return + word-return functions, cross-module imported calls, same-module call to a later-declared function (FN-7), results poked to `$C000..` and VICE-asserted; negatives (compile-only): direct + indirect recursion → E10174, wrong arg count → E10170, arg type mismatch → E10171, non-exported import → E10012, `main()` call → E10023, interrupt call → E10051; exact values fixed in 07-testing-strategy ST cases; fixture honors AR-4 (no value live across a call in one expression); (b) different shape | **(a) confirm both** (recommended). | ✅ Resolved |

### Resolution Notes

**AR-1:** Precedent: Slices 3 and 4 each split at planning time (3a/3b, 4a/4b) with plans of
21–45 tasks; a 60+-task single plan exceeds every proven envelope. The 5a/5b seam cuts on the
risk axis: 5a holds every novel mechanism (calling convention end-to-end), 5b is
semantic/plumbing completion on a proven convention. Minimal imports stay in 5a so the
cross-module `Module_function` label path is witnessed early.

**AR-2:** Evidence: `platform-profile.ts:72` (`ramStart: 0x0800`), gate golden `__startup` at
`$080D`, roadmap 3b AR-1/SR-3 (deferred fix), `plan-allocation.ts:134`/`budgets.ts:63` (budget
checks $A000, not $080D). $2000 leaves ~6.1 KB code room; in-repo precedent `a800xl.ts
ramStart: 0x2000`. The challenger's load-bearing half: the post-ACME check must key off the
plan's actual data base — the canonical `c64Profile.ramStart` is `$0801` (== code start), so
the overlap returns when per-platform semantic profiles land unless the check travels.
Sequencing (challenger H5): the base move + single golden re-mint is **Phase 0**, before any
feature work, freezing addresses for the slice.

**AR-3:** Evidence: `interference.ts:45-111` (ancestor-descendant only), `coloring.ts:77-112`
(sibling frames may alias), spec Ch 06 §5.4/§6.1 (interleaved store shape). The first argument
may freely contain calls (nothing stored yet); the guard/edges apply to arguments after the
first store. Translate keeps a trivial `call` case (JSR + bind), reusing `translateStore`'s
existing word path for two-byte params.

**AR-4:** Evidence: `zp-allocator.ts:205-213` (one global `__zp_tmp` pool shared by all
non-interrupt functions); `clearRegs()` after JSR (challenger-verified). Today's `__rt_*`
calls don't touch `__zp_tmp` (they use `__zp_arg`), which is why `(a*b)+(c*d)` compiles
correctly — the hazard is specific to USER calls whose bodies reuse the pool.

**AR-7:** The pass-ordering requirement is load-bearing: E10174 detection (Pass 4) must run
and poison the model before `run-frontend` invokes `planAllocation` with populated `callees`.

**AR-9:** Challenger divergence resolved by the user in favor of repurposing. Rationale
recorded: a never-emitted registry constant has no compatibility surface; the frozen spec
table (which users consult) says E10175 means exactly this error; prior slices already
preferred spec-numbered free slots (E10071/73/74/75).

**AR-12:** The `--startup` shimVariant seam shipped by RD-15 (`instr-program.ts:112-167`) is
where the Slice-8 fall-through variant lands; nothing in 5a touches it.

**AR-15:** 5b's own Zero-Ambiguity Gate still runs at 5b's make_plan; this row fixes 5b's
*scope envelope* only (so 5a's deferrals have a named landing zone).

### Preflight amendments (2026-07-10, iteration 1 — see `00-preflight-report.md`)

Plan preflight resolved 7 findings (PF-001..PF-007), all applied. No gate decision is
changed; two findings refine register mechanisms:

- **AR-4 refined (PF-001):** the live-temp guard cannot be built on the existing prescan
  `useCount` (a static total); it needs a NEW **separate** remaining-use map (copy of the
  prescan totals — never decrement `useCount` in place, the fold decisions read it),
  decremented once per consumed operand occurrence. The row's "(prescan use counts)"
  phrasing under-specified this.
- **AR-7 refined (PF-002):** the `hasErrors`→skip-`planAllocation` gate does NOT exist
  today and is new driver-level work in `run-frontend` guarding the whole call expression
  (the inline `modelToFunctionInfo` argument — and its `reach()` DFS — included); the
  existing plan-allocation-level "still assembles under upstreamErrors" spec test is a
  different layer and stays untouched; all new reachability DFS walks are
  visited-set-bounded as defense.
- Also recorded: PRG load-address read-back must be built, size = header-excluded
  `binarySize` (PF-003); the E10175 rename diverges from the canonical Ch 14 spec
  registry — deviation note extended (PF-004); duplicate module names across files get an
  explicit unsupported ICE until 5b merging (PF-005); `lowerCall` keeps an ICE fallback
  for unresolvable callees (PF-006); phantom `lowerExprStatement` name corrected (PF-007).
