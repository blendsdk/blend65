# Preflight Report: RD-18 Slice 5a — User Functions, Parameters & Calls

> **Status**: ✅ PREFLIGHT PASSED — all 7 findings resolved (0 critical, 2 major, 4 minor, 1 observation — all fixes applied 2026-07-10; iteration 2 verified, 0 new findings)
> **Iteration**: 2 (first scan + fix-verification re-scan)
> **Artifact**: Implementation Plan at `codeops/features/blend65-ri/plans/rd-18-slice-5a-functions-calls/` (9 documents)
> **Codebase Grounded**: 40+ source files examined; ~60 `file:line` references mapped — 3 stale, rest verified
> **Last Updated**: 2026-07-10
> **CodeOps Skills Version**: 3.3.1

> ⚠️ SAME-MODEL REVIEW NOTE: the artifact was created earlier today by the same model family
> (fresh session/context for this review; the make_plan gate already used 3 recon agents + 1
> independent challenger). This scan re-derived the load-bearing claims from primary sources
> (code + frozen spec text) rather than trusting the gate's citations, and used its own
> independent challenger for the MAJOR batch.

## Codebase Context Summary

**Repository:** blend65 — TypeScript (ESM/NodeNext) Turborepo monorepo, 10 `@blend65/*` packages
**Tech Stack:** Node 22, Yarn v1 workspaces, Vitest, ESLint 9 + Prettier; ACME + VICE 3.10 for the local acceptance tier
**Architecture:** AOT compiler pipeline Lexer → Parser → Analyzer (passes) → SFA → IL/lower → Instr/translate → ACME serializer → PRG; static frame allocation calling model
**Files Examined (key):** `frontend/src/semantics/{function-collection,analyze,post-check,intrinsic-validation,module-variable-collection}.ts`, `frontend/src/semantics/type-check/{expression-typing,statement-typing,type-resolution,context}.ts`, `frontend/src/sfa/{model-adapter,interference,coloring,frame-computation,plan-allocation,budgets,zp-allocator,symbols,stack-analysis}.ts`, `core/src/{diagnostics/diagnostic-codes.ts,semantics/{symbol,call-graph,platform-profile}.ts,sfa/{function-info,frame,allocation-plan}.ts,ast/nodes.ts,tokens/token-kind.ts,intrinsics/catalog.ts,report/build-resource-report.ts}`, `codegen/src/il/{instruction,lower,print-il,cfg}.ts`, `codegen/src/instr/{translate,instr-program,serialize-acme}.ts`, `codegen/src/runtime/embed.ts`, `platforms/src/{shared-hooks,c64,a800xl}.ts`, `compiler/src/api/{run-frontend,build}.ts`, `test-harness/src/testing/slice4b.ts`, `examples/{slice3b,slice4a}/main.blend`, `spec/06-functions.md`, `spec/10-modules.md`, `spec/14-*.md`, `RD-18-codegen-language-completion.md`, archive RD-04 ledger.

**Key observations:**
- The plan's central recon claims are accurate: params never collected; user `CallExpr` silently poisons (`expression-typing.ts:89-92`); `callGraph.edges` empty + stub `findCycles` (`analyze.ts:123-127`); adapter hardcodes `parameters:[]`/`callees:[]` (`model-adapter.ts:50,55`); `lowerCall` ICEs at `lower.ts:602`; translate has no `case "call"` (default ICE `translate.ts:303-304`); `ret` ABI + `translateStore` word path + `sanitize`/`_main` labels all as described.
- `poke`/`pokew` are core T2 reserved built-ins — **no import required** (E10046 applies only to T4 platform intrinsics, `intrinsic-validation.ts:239`); the 03-04 fixture is valid as written. Multi-file compilation works today end-to-end (`options.sourceFiles: string[]` → per-file parse loop → `analyze({programs})`).
- Registry state verified: E10012/E10023/E10033/E10034/E10100/E10101/E10152-54/E10170-E10175 registered; E10051 absent (mint is correct); E10175 has **zero emit sites** (repurpose is compatibility-safe).
- Spec cross-check: FN-6/7/10/11/12/13, Ch 06 §4.2/§5.4/§6.1/§7.3, Ch 10 §4/§5/§6 all support the plan's semantics; the Ch 06 §10 chapter-table drift the plan records is real — and runs deeper than recorded (see PF-004).

**Reference Verification:** ~60 references mapped — 3 stale (PF-001/002/003), 1 phantom helper name (PF-007), rest verified.

## Summary by Dimension

| # | Dimension | Findings | Highest severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 0 (size semantics folded into PF-003) | — |
| 2 | Implicit Assumptions | contributes to PF-002/003 | 🟠 |
| 3 | Logical Contradictions | 1 (PF-004 — spec-internal, deviation-record gap) | 🟡 |
| 4 | Completeness Gaps | 2 (PF-005, PF-006) | 🟡 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | co-owner of PF-001 | 🟠 |
| 7 | Testability | 0 (ST cases concrete; one impl-test gap noted in PF-002) | — |
| 8 | Security Blind Spots | 0 (DFS boundedness folded into PF-002) | — |
| 9 | Edge Cases | co-owner of PF-005 | 🟡 |
| 10 | Scope Creep Indicators | 0 (46 tasks, inside the AR-1 ~50 trim threshold; deferrals named) | — |
| 11 | Ordering & Sequencing | 0 (Phase 0 freeze → 1 → 2 → 3 → 4 sound; 2.2.2/2.2.3 hang note in PF-002) | — |
| 12 | Consistency | 1 (PF-007) | 🔵 |
| 13 | Codebase Alignment | 3 (PF-001, PF-002, PF-003 — stale assumptions) | 🟠 |

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 2 | all resolved & applied |
| 🟡 MINOR | 4 | all resolved & applied |
| 🔵 OBSERVATION | 1 | resolved & applied |

---

### PF-001: AR-4 live-temp guard relies on a "remaining uses" signal that doesn't exist 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (Stale Assumptions) / 6 — Feasibility
**Location:** `03-03-call-codegen.md` §3.1; `99-execution-plan.md` task 3.2.2
**Codebase Evidence:** `packages/codegen/src/instr/translate.ts:208-224` (`prescanAll` — `useCount` incremented once, never decremented), `:407`/`:650` (only consumers: single-use fold checks `<= 1`), `:595` (mirror deliberately retains a temp binding after its consuming store); `packages/codegen/src/instr/register-binding.ts:216-218` (`__zp_tmp` homes are bump-allocated, never released)
**The Problem:** 03-03 §3.1 specifies the never-miscompile AR-4 guard as: ICE "if any temp with remaining uses (prescan use counts, which already include terminator reads)" is register-/`__zp_tmp`-resident at a user-call `JSR`. But `useCount` is a **static per-temp total** — it cannot answer "remaining uses *at this point*". The claim of sufficiency is provably false: under (static count, residency) the state at the JSR is **identical** for ST-30 `f(g(1), 2)` (g-result temp: resident, total 1, **0 remaining** — must compile) and ST-29 `f() + g()` (f-result temp: resident, total 1, **1 remaining** — must ICE). Any guard built only on the plan's stated inputs over-fires (fails ST-30) or under-fires (silent miscompile — the exact hazard AR-4 exists to prevent; ST-29/ST-30 pin only two shapes, so a weak heuristic could pass both and still miscompile e.g. a multi-use temp partially consumed before the JSR). The mechanism needs new bookkeeping the plan doesn't specify.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Amend 03-03 §3.1 + task 3.2.2 to specify the mechanism: a **separate** per-temp remaining-use map, initialized from `prescanAll` totals, decremented **once per consumed operand occurrence** during translation; at a user-call JSR, ICE iff any temp with remaining > 0 is register-/`__zp_tmp`-resident (frame/module-var-homed operands exempt). Separate map is load-bearing: decrementing `useCount` in place would flip the `:407`/`:650` fold decisions mid-stream and change codegen for non-call code. Per-occurrence granularity is load-bearing: a word temp is read via two byte loads but is one operand occurrence. | Sound by construction; executor implements the invariant, not a guess; keeps ST-29/30 as-is | Small plan edit now |
| B | Leave the text; let ST-29 (RED first) + ST-30 force the design during execution | Zero plan work | The plan affirmatively misstates the mechanism at a never-miscompile seam; under-fire modes exist outside the two pinned shapes; invites a heuristic that passes both STs and still miscompiles |

**Recommendation:** Option A — a plan that misstates a correctness-guard mechanism is worse than one silent about it; the fix is one paragraph.
**Confidence:** High — grounded in verified translate/binder internals.
**Hardening:** challenger converged on A and contributed the separate-map and per-occurrence-decrement requirements (both now in Option A). `Challenger: converged`.

**User Decision:** Resolved — User accepted recommendation ("apply all fixes per your recommendations"); fix applied 2026-07-10, verified in iteration 2.

---

### PF-002: The "existing" hasErrors→skip-planAllocation gate does not exist — and the hazard sits in the inline adapter argument 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (Stale Assumptions) / 8 — Security (bounded passes) / 11 — Ordering
**Location:** `03-01-call-semantics.md` §5 "Pre-SFA poison" bullet ("verify the existing gate"); `03-02-sfa-wiring.md` Error Handling table row 2; `99-execution-plan.md` tasks 2.2.3 and 2.3.1
**Codebase Evidence:** `packages/compiler/src/api/run-frontend.ts:165-174` — `planAllocation({ functions: modelToFunctionInfo(semanticModel), …, upstreamErrors: bag.hasErrors() }, …)` is called **unconditionally**; `upstreamErrors` only suppresses budget diagnostics (`frontend/src/sfa/budgets.ts:58`); the still-assembles-under-upstreamErrors behavior is **pinned by an existing immutable spec test** (`plan-allocation.spec.test.ts:93-104`); `FrontendRun.allocationPlan?:` is already optional (`run-frontend.ts:61`) and both consumers guard undefined (`build.ts:58`, `emit.ts:91`)
**The Problem:** The plan calls the pre-SFA poison ordering "load-bearing" (AR-7) but instructs the executor to "verify the existing gate" — no gate exists. Worse, in 5a the cycle hazard is not only inside `planAllocation`: the **inline argument** `modelToFunctionInfo(semanticModel)` will run the new AR-3 `reach()` DFS over `callGraph.edges`. On a recursive program the edges are cyclic (E10174 is emitted but the model still carries the edges), and a naive DFS **hangs** — the planned impl tests (task 2.3.1) exercise `reach()` only on diamonds, which terminate without a visited set. Task ordering compounds it: `reach()` lands at 2.2.2, the gate at 2.2.3, so ST-24 RED can manifest as a test-suite hang rather than a clean failure. Finally, "verify the existing gate" invites either a false verified tick or a gate misplaced inside `planAllocation` — which cannot skip argument evaluation (JS evaluates arguments first) and would collide with the pinned spec-test oracle.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Amend 03-01 §5 + 03-02's error table + task 2.2.3: the gate does NOT exist and is **new work at the run-frontend driver level**, guarding the whole `planAllocation(…)` call expression (which also skips the inline `modelToFunctionInfo` evaluation); the existing plan-allocation-level "still assembles" spec test stays untouched (different layer); additionally require **visited-set-bounded** DFS for all new reachability walks (adapter `reach()`, AR-3 lowering guard) and add a cycle-input case to task 2.3.1's impl tests (not just diamonds) | Closes both the false claim and the hang vector; no oracle conflict; downstream undefined-guards already exist | Slightly more plan text |
| B | Early-return inside `planAllocation` when `upstreamErrors` is true | One central gate | Cannot skip the inline adapter DFS (arguments evaluate first) — leaves the 5a hang vector open; contradicts the pinned immutable spec test, forcing an oracle supersede |

**Recommendation:** Option A — the driver-level gate is the only placement that protects the code path 5a actually adds; the visited-set bound also discharges RD-18's bounded-passes security requirement for the new walks.
**Confidence:** High.
**Hardening:** challenger converged on A and contributed the argument-evaluation/hang analysis and the cycle-input impl-test addition. `Challenger: converged`.

**User Decision:** Resolved — User accepted recommendation ("apply all fixes per your recommendations"); fix applied 2026-07-10, verified in iteration 2.

---

### PF-003: `build()` does not read back the PRG load address — the overlap check's stated inputs don't all exist yet 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Stale Assumptions) / 1 — Ambiguity (size semantics)
**Location:** `03-02-sfa-wiring.md` §4.2 ("given the binary's load address + size (both already read back post-ACME in `build()`)"); `99-execution-plan.md` task 0.1.3
**Codebase Evidence:** `packages/compiler/src/api/build.ts:92-93` reads the raw PRG bytes (`deps.readBinary`); `invoke-acme.ts:173-175` computes `binarySize = statSync(...).size − 2` (**header-excluded**); no load-address extraction exists anywhere; `AllocationPlan` exposes `frameRegionBase` but no `dataBase` field (`core/src/sfa/allocation-plan.ts:154-183`); `ResourceReport` carries no base addresses
**The Problem:** Half of the check's inputs must be built, not "read back": the load address needs deriving (PRG header = first two bytes, little-endian — the raw bytes are already in hand at `build.ts:92-93`), and the plan's `dataBase` exposure off `AllocationPlan` is genuinely new (task 0.1.3 does say "expose"). The check's contract should also state the size semantics explicitly: `binarySize` excludes the 2-byte header, so `loadAddress + binarySize <= dataBase` is the correct arithmetic (ST-02/ST-03's numbers are consistent with this — but only if the executor knows which size they're getting).

**Options:** Single viable resolution — amend 03-02 §4.2 + task 0.1.3 to state: derive `loadAddress` from the PRG's first two bytes (or return it from `invoke-acme`/`emitBinary`), `size` = the existing header-excluded `binarySize`, `dataBase` = the new `AllocationPlan` field. (Considered and dropped: leaving it — the executor would hunt for a value that doesn't exist in a mandatory Phase-0 task.)

**Recommendation:** Apply the amendment.
**Confidence:** High — trivial, fully grounded.

**User Decision:** Resolved — User accepted recommendation ("apply all fixes per your recommendations"); fix applied 2026-07-10, verified in iteration 2.

---

### PF-004: The E10175 deviation record misses that the spec's own canonical registry (Ch 14) contradicts the repurpose 🟡 MINOR

**Dimension:** 3 — Logical Contradictions / 12 — Consistency
**Location:** `00-ambiguity-register.md` AR-9 rationale; `03-01-call-semantics.md` §1; `99-execution-plan.md` task 5.1.2
**Codebase Evidence:** `spec/06-functions.md` §10 ("The canonical registry is in → Ch 14") lists E10175 = "Cannot call non-function"; `spec/14-*.md:113` (the canonical registry) lists E10175 = "Too many parameters — maximum is 8"; `spec/06-functions.md` FN-11 ("No Language Limit on Parameter Count") refutes Ch 14's own row
**The Problem:** AR-9's rationale rests on "the frozen spec table (which users consult) says E10175 means exactly this error" — that is the **non-canonical** Ch 06 chapter table. The canonical Ch 14 registry still says E10175 = TooManyParameters (matching the current code registry), so repurposing creates drift against the canonical table too. The decision itself is not re-litigated (zero emit sites verified; FN-11 makes Ch 14's row self-contradictory and dead; the user chose repurpose after an explicit challenger divergence). But the deviation record planned at task 5.1.2 names only the E1017x chapter-table drift — a future spec-errata pass working from Ch 14 alone would miss it.

**Options:** Single viable resolution — extend task 5.1.2's deviation note: record that the spec is internally inconsistent on E10175 (Ch 06 §10 = NotCallable vs canonical Ch 14 = TooManyParameters), that FN-11 refutes the Ch 14 row, and that the code registry now follows Ch 06 §10 / diverges from Ch 14 until a spec-errata pass reconciles them. (Considered and dropped: re-opening AR-9 — no new information changes the balance; the register already documents the divergence-resolution.)

**Recommendation:** Apply the ledger-note extension.
**Confidence:** High — cited from the frozen spec text directly.

**User Decision:** Resolved — User accepted recommendation ("apply all fixes per your recommendations"); fix applied 2026-07-10, verified in iteration 2.

---

### PF-005: Two files declaring the same module name — behavior in 5a is undefined 🟡 MINOR

**Dimension:** 4 — Completeness Gaps / 9 — Edge Cases
**Location:** `03-01-call-semantics.md` §6 (userModules map construction)
**Codebase Evidence:** `spec/10-modules.md` §6.1 — "Two files with the same module name contribute to the same module" (spec-legal; merging is 5b/R20); `function-collection.ts:72-74` — fresh module scope per program today
**The Problem:** 03-01 §6 builds `userModules: Map<string, Scope>` from each program's module name and notes "the fixture uses distinct names" — but says nothing about what happens when two files legally declare the same module. A plain `Map.set` silently last-wins, so an import could resolve against only one file's scope and produce a **wrong diagnostic** (E10012 "not exported") for spec-legal source — worse than an explicit refusal. The plan's own doctrine for not-yet-supported-but-legal shapes (AR-3/AR-4) is an explicit ICE, never wrong output.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Detect the collision while building `userModules` and route it to the explicit unsupported-in-this-slice ICE path (same doctrine as AR-3/AR-4); removed at 5b when merging (R20) lands | Never a wrong diagnostic/binary for legal source; consistent with the plan's own guard doctrine; trivial to remove at 5b | An ICE for spec-legal source (but that is 5a's standing contract for unsupported shapes) |
| B | Document deterministic first-wins in 03-01 §6 and accept the possible misleading E10012 until 5b | No ICE on legal source | Silently wrong diagnostics violate the never-mislead principle; harder to notice than an ICE |

**Recommendation:** Option A — explicit refusal beats silent misresolution, and 5b removes it weeks later.
**Confidence:** Med — the shape is unlikely before 5b (single-user project, fixtures use distinct names); would change if the user prefers zero ICE surface for legal source.
**Hardening:** in-context layers only (MINOR — below the challenger threshold).

**User Decision:** Resolved — User accepted recommendation ("apply all fixes per your recommendations"); fix applied 2026-07-10, verified in iteration 2.

---

### PF-006: `lowerCall`'s new user branch must keep an explicit ICE fallback for unresolvable callees 🟡 MINOR

**Dimension:** 4 — Completeness Gaps
**Location:** `03-03-call-codegen.md` §2 step 1; `99-execution-plan.md` task 3.2.1
**Codebase Evidence:** `expression-typing.ts:89-92` — a `FieldAccessExpr`-callee call (e.g. `Math.add(1,2)`, spec-legal qualified access, 5b scope) poisons **silently with no diagnostic**, so `hasErrors` stays false and the full pipeline runs; the current catch-all `iceUnsupported` at `lower.ts:602` is exactly what task 3.2.1 replaces
**The Problem:** 03-03 §2 step 1 resolves the callee via `ctx.model.symbolOf(expr.callee)` and proceeds — it never states what happens when resolution fails (non-`IdentExpr` callee, or no symbol recorded). Since the silent-poison path keeps `hasErrors` false, such calls **will** reach the new branch; without an explicit fallback the executor could deref undefined (a crash instead of the diagnostics-not-crashes/ICE-band contract). The Error Handling table's "defensive" row gestures at this but ties it to the AR-4 guard, which lives in translate — too late.

**Options:** Single viable resolution — add one sentence to 03-03 §2 step 1 (and task 3.2.1): "callee not an `IdentExpr`, or `symbolOf` returns no function symbol → `iceUnsupported` (preserving the current `:602` contract for still-unsupported call shapes)." (Considered and dropped: emitting a frontend diagnostic for qualified calls in 5a — that's 5b's surface (AR-15) and the register already blessed silent-poison for it.)

**Recommendation:** Apply the one-sentence amendment.
**Confidence:** High.

**User Decision:** Resolved — User accepted recommendation ("apply all fixes per your recommendations"); fix applied 2026-07-10, verified in iteration 2.

---

### PF-007: Phantom helper name `lowerExprStatement` 🔵 OBSERVATION

**Dimension:** 12 — Consistency (13 — phantom reference, behavior verified correct)
**Location:** `03-03-call-codegen.md` §2 item 5
**Codebase Evidence:** No function named `lowerExprStatement` exists; expression-statements are lowered inline in `lowerStmt`, `case "ExpressionStmt"` (`lower.ts:208-211`), and the value IS discarded exactly as the plan claims
**The Problem:** Name-only inaccuracy; the behavioral claim is correct. An executor grepping the name finds nothing.

**Options:** Single viable resolution — reword to "the `ExpressionStmt` arm of `lowerStmt` (`lower.ts:208-211`)".

**Recommendation:** Apply the reword.
**Confidence:** High.

**User Decision:** Resolved — User accepted recommendation ("apply all fixes per your recommendations"); fix applied 2026-07-10, verified in iteration 2.

---

## Iteration 2 — fix verification & re-scan (2026-07-10)

> **Previous Iteration**: 7 findings — all resolved (user: "apply all fixes per your recommendations")
> **This Iteration**: 0 new findings
> **Carried Forward**: none

**Fix verification (all 7 applied and confirmed in place):**

- PF-001 → `03-03` §3.1 now specifies the separate remaining-use map (copy of prescan totals, never mutating `useCount`, decremented once per consumed operand occurrence); task 3.2.2 amended; a translate-call impl-test row covers the map internals.
- PF-002 → `03-01` §5 states the gate does not exist and is new driver-level work guarding the whole `planAllocation(…)` call expression (inline `modelToFunctionInfo` included); `03-02` error-table row updated; tasks 2.2.3 ("ADD the … driver gate") and 2.3.1 (cyclic reach() input) amended; visited-set boundedness required for both new DFS walks (`03-02` §3, `03-03` §2 step 2).
- PF-003 → `03-02` §4.2 "Input reality" paragraph (header-excluded `binarySize`; load address derived from the PRG's first two bytes); task 0.1.3 amended.
- PF-004 → `03-01` §1 notes the Ch 14 canonical-registry divergence; task 5.1.2's deviation note extended.
- PF-005 → `03-01` §6 collision guard (explicit unsupported-in-this-slice ICE, removed at 5b) + error-table row; tasks 1.2.6/1.3.1 and the import impl-test row amended; deviation recorded in task 5.1.2.
- PF-006 → `03-03` §2 step 1 fallback paragraph (unresolvable/non-`IdentExpr` callee → `iceUnsupported`); task 3.2.1 amended.
- PF-007 → `03-03` §2 item 5 reworded to the `ExpressionStmt` arm of `lowerStmt` (`lower.ts:208-211`).

The Ambiguity Register carries a "Preflight amendments" note (AR-4/AR-7 mechanism refinements; no gate decision changed).

**Regression check:** mechanical sweep confirms no stale phrases remain ("verify the existing gate", "lowerExprStatement", "both already read back" — zero hits outside this report and the register's intentional quote); task count unchanged at 46; ST-01..ST-34 unchanged and consistent with the amendments (ST-02/ST-03's arithmetic matches the header-excluded size semantics); the PF-005 ICE-band diagnostic honors the "emit diagnostics, never throw" analyzer contract; 2.2.3/03-01 §5/03-02 table now agree on gate placement.

**Fresh 13-dimension pass over the amended text:** no new ambiguities (each amendment specifies a concrete mechanism with verified `file:line` anchors), no new contradictions, no new gaps. **0 new findings.**

**Outcome: ✅ PREFLIGHT PASSED — all 7 findings resolved.** Next step: `exec_plan`.

---

## What was checked and found sound (no findings invented)

- **AR-3 store-per-arg + argument-window interference**: stress-tested against `f(g(), h())` (h→f), `f(1, g(k()))`, first-arg-reaches-callee, module-var mutation orderings — the design holds; first-arg exemption is sound (nothing stored yet); subtree walk covers nested-in-nested calls.
- **Fixture arithmetic and validity**: `$C000=$11`/`$C001=$84`/`$C002=$03`/`$C003=$10` re-derived independently; no intrinsic imports needed (core T2 built-ins); no AR-3/AR-4 shape present; FN-7 witnessed; multi-file facade + `analyze({programs})` already handle two files.
- **Registry/repurpose safety**: E10051 absent (mint correct); E10175 zero emit sites; E10101/E10152-54/E10170-74 all registered as claimed.
- **Phase ordering**: Phase 0 address freeze → semantics → SFA → codegen → acceptance is dependency-correct; task count (46) verified; scope inside the AR-1 trim threshold.
- **Spec conformance**: call sequence (§5.4/§6.1 interleaved stores), return ABI (§6.2 A/A:X), E10051 (§7.3), E10012/E10003/E10023 (Ch 10), FN-13→E10101 — all cited from the frozen text.
