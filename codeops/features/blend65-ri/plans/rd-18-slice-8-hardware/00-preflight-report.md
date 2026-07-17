# Preflight Report: RD-18 Slice 8a — Hardware (`rd-18-slice-8-hardware`)

> **Status**: ✅ PREFLIGHT PASSED — all 17 findings resolved (15 iteration-1 + 2 iteration-2 corollaries; PF-014 resolved as no-action-for-8a)
> **Iteration**: 2 (fixes applied and verified)
> **Artifact**: implementation plan at `codeops/features/blend65-ri/plans/rd-18-slice-8-hardware/` (12 documents)
> **Codebase Grounded**: 34 source/spec files examined; ~45 `file:line` references mapped — 40 verified exact, 0 phantom, 5 findings arose from mismatches
> **Hardening**: one independent challenger reviewed the full CRITICAL/MAJOR batch — all five affirmed (PF-001 affirmed with a load-bearing amendment)
> **Last Updated**: 2026-07-17

> Same-agent note: the plan was authored earlier today by the same model family (different
> session — fresh context for this review). External-standard caveat: C64 hardware behavior
> claims (CIA/VIC/banking) in AR-16 were checked from domain knowledge and the AR's own
> hardware-verification note, not a citable datasheet.

## Codebase Context Summary

**Tech Stack:** TypeScript ESM monorepo (Yarn v1 + Turbo), 10 `@blend65/*` packages, Vitest; frozen `spec/` v3.0 (D3).
**Architecture:** pipeline Lexer → Parser → Analyzer (frontend) → SFA planner (frontend, produces a frozen `AllocationPlan`) → IL lowering → translate → ACME emit (codegen). R15: frontend/language-server never import codegen.
**Key Files Examined:** `sfa/{model-adapter,interference,zp-allocator,plan-allocation,pointer-pairs,coloring}.ts`, `instr/{translate,register-binding,instr-program}.ts`, `il/{lower,operand,cfg}.ts`, `semantics/{module-variable-collection,function-collection,init-order}.ts`, `type-check/{expression-typing,statement-typing}.ts`, `parser/{parse-decl,pratt}.ts`, `api/{run-frontend,emit}.ts`, `diagnostic-codes.ts`, `platform-profile.ts`, `platforms/shared-hooks.ts`, `core/intrinsics/catalog.ts`, `test-harness/src/run/strategies.ts`, ten goldens; spec Ch03/04/06/10, `grammar.ebnf.md`, F004/F005/F006/F007, FUT-001/002/004, RD-18.
**Key Observations:**
- The plan's dormant-asset map is accurate and unusually well grounded: silent-poison `&` (`expression-typing.ts:499-501`), lowering ICE (`lower.ts:1304-1307`), `zpUserVars: []` (`run-frontend.ts:174`), SEAM-commented hardcoded shim (`instr-program.ts:205-213`), consumer-less `__zp_irq_tmp` pool (`register-binding.ts:133-135`), user-ZP priority-1 category (`zp-allocator.ts:193-198`) — all verified exact.
- Both AR-15 miscompile holes are real and challenger-confirmed; the Ch06 §7.7 `$0314` spec defect is real (KERNAL pushes A/X/Y before `JMP ($0314)`; a spec-RTI handler crashes).
- `isEscaped` already feeds the Step-2 always-live set (`interference.ts:104-112`) — flipping it has immediate layout consequences the plan only half-acknowledges.

### Summary by Dimension

| # | Dimension | Findings | Highest |
|---|-----------|----------|---------|
| 1 | Ambiguities | 1 | 🔵 |
| 3 | Logical Contradictions | 2 | 🔴 |
| 4 | Completeness Gaps | 1 | 🟡 |
| 6 | Feasibility Concerns | 1 | 🟠 |
| 7 | Testability | 2 | 🟡 |
| 9 | Edge Cases | 2 | 🟡 |
| 12 | Consistency | 2 | 🟡 |
| 13 | Codebase Alignment | 4 | 🟠 |
| 2/5/8/10/11 | Assumptions / Dependencies / Security / Scope / Ordering | 0 | — |

Dimensions 2, 5, 8, 10, 11 scanned clean: dependencies (7b formation, 5b init stream, 4a CFG, 5a call graph, RD-12 harness) all verified present; phase ordering matches the real dependency graph; scope is disciplined (AR-4..9 deferrals honored; AR-29 pull-in sits on genuinely shared machinery); no new security surface in 8a (embed traversal correctly deferred to 8b with AR-23).

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 1 | ✅ resolved (fix applied + verified) |
| 🟠 MAJOR | 4 | ✅ all resolved (fixes applied + verified) |
| 🟡 MINOR | 7 + 2 (iter. 2) | ✅ all resolved (fixes applied + verified) |
| 🔵 OBSERVATION | 3 | ✅ resolved (PF-013/015 applied; PF-014 no-action) |

---

## Critical

### PF-001: The mainline root set nullifies the irq-only classification — `irqOnly = ∅` in every real program 🔴 CRITICAL

**Dimension:** 3 — Logical Contradictions (codebase-grounded)
**Location:** `03-03-sfa-interrupt-path.md` §The classification; echoed in AR-15's "mainline = complement-of-irq-only" gloss
**Codebase Evidence:** `interference.ts:104-112` (Step-2 always-live uses `isEscaped`), `register-binding.ts:133-135` (spills draw from `"temp"` only), `expression-typing.ts:1195-1199` (E10051), `parse-decl.ts:455-487` (E10311), name-resolution E10012 (cross-module calls require export), `model-adapter.ts:69` (`isReachable` unconditionally true)
**Related:** AR-15 — this amends 03-03's *concretization* of the rule, not the AR-15 decision itself (the AR row never enumerates roots).

**The Problem:** 03-03 defines mainlineReachable as "everything reachable from `main`, `__init`, exports, and escaped functions". Two leaks:

1. **Escaped handlers (challenger-surfaced, load-bearing):** installing a handler *is* taking its address — `pokew($FFFE, &onIRQ)` marks `onIRQ` address-taken, so per 03-01 it projects `isEscaped: true`, which makes the handler a **mainline root**. Its whole call subtree becomes mainlineReachable, so `irqOnly = ∅` in every program that actually installs a handler — **including the plan's own fixture** (`bump()` would classify both-path → MAIN spill pool → the Gap-1(ii) corruption survives). Consumers 2 and 3 become dead code end-to-end; ST-20..22 would only pass on synthetic inputs that skip escape marking.
2. **Exports:** any cross-module helper a handler calls must be exported (5b), so it lands in mainlineReachable even when its only caller is the handler → both-path → MAIN pool → same silent corruption. Ch06 §7.5 explicitly lists "functions dedicated exclusively to the interrupt path" as a SAFE pattern, so the documented-hazard umbrella does not cover this; §7.6's separation rule is mandatory.

The single-module fixture cannot catch either leak.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | mainlineReachable = BFS from `main`, `__init`, and escaped **non-interrupt** functions; exports contribute only via real mainline call edges (program builds); record a library-build caveat for the future. Also replace the circular "complement of irq-only" gloss with this enumeration. | Fixes both leaks; excluding interrupt-kind escapees is sound (E10051/E10311 make handlers uncallable/unexportable from mainline); minimal change | Library builds (future) will need exports re-added as roots |
| B | Keep exports as roots but subtract export-only functions with no mainline call edge; special-case escaped handlers | Same outcome | Strictly more bookkeeping than A for the same result |
| C | Keep as written; extend the documented-hazard umbrella | No design change | Silently reopens the miscompile this plan exists to fix; contradicts Ch06 §7.5/§7.6 — not viable |

**Recommendation:** Option A — it is the only formulation under which the classification ever engages in a real program; C is listed for completeness and is not genuinely viable.
**Confidence:** High · **Hardening:** challenger AFFIRMED-WITH-AMENDMENTS (the escaped-handler leak is the challenger's amendment; verified against 03-01's address-taken table and task 1.2.3).

**User Decision:** Resolved — accepted recommendation; fix applied 2026-07-17 (iteration 2 verified)

---

## Major

### PF-002: Consumer 3 keys the scratch twin on "irq-reachable" while Consumer 2 keys pools on "irq-only" 🟠 MAJOR

**Dimension:** 3 — Logical Contradictions
**Location:** `03-03-sfa-interrupt-path.md` §Consumer 3 (+ reservation predicate); `07-testing-strategy.md` ST-22
**Codebase Evidence:** `model-adapter.ts:344-356` (`modelNeedsPointerScratch` — the predicate being mirrored), `plan-allocation.ts:172-178` (scratch alias emission)
**Related:** AR-15 decided both-path → MAIN pool; option C below would re-litigate it.

**The Problem:** Consumer 3 selects `__zp_irq_ptr_scratch` "for formation inside irq-reachable functions" — which includes both-path functions. A both-path function running in *mainline* context would then form pointers through the irq twin; an IRQ whose irq-only code also forms clobbers the twin mid-formation → wrong pointer during pure mainline execution. This corruption channel needs no re-entry of the shared function (an unrelated irq-only helper does the clobbering), so it is *not* the Ch06 §7.5 documented hazard — it is a new window the classification itself creates, and it is inconsistent with Consumer 2's decided key.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Key Consumer 3 on `isIrqOnly` (mirror Consumer 2); reservation predicate = "some irq-**only** function needs formation"; reword ST-22 (irq-only formation → twin; both-path/mainline formation → `__zp_ptr_scratch`) | Confines corruption to exactly the §7.5 documented case; consistent keys | Both-path formation in irq context stays hazardous (already the decided AR-15 posture) |
| B | Keep "irq-reachable" and document the extra mainline-context window | No change | Accepts a silent-corruption window §7.6 exists to prevent |
| C | Key BOTH consumers on irq-reachable | Consistent | Re-litigates AR-15's decided both-path→MAIN choice; same window as B for spills |

**Recommendation:** Option A. Note the dependency: until PF-001 is fixed, `isIrqOnly` is empty in real programs and this key never fires — resolve PF-001 first.
**Confidence:** High · **Hardening:** challenger AFFIRMED, option A.

**User Decision:** Resolved — accepted recommendation; fix applied 2026-07-17 (iteration 2 verified)

### PF-003: Irq temp-pool "peak spill demand" sizing is unimplementable where tasked; overflow oracle names the wrong mechanism 🟠 MAJOR

**Dimension:** 6 — Feasibility Concerns
**Location:** `03-03-sfa-interrupt-path.md` §Consumer 2 + §Error Handling row 1; `02-current-state.md` risk table; `99-execution-plan.md` task 4.2.4
**Codebase Evidence:** `platform-profile.ts:82-84` (`mainTempBytes: 4`, `irqTempBytes: 2` — fixed constants), `plan-allocation.ts:141-142` (fed verbatim), `zp-allocator.ts:205-216` (fixed-count placement), `register-binding.ts:205-215` (pool exhaustion = E90001 ICE, not E10032)

**The Problem:** The main pool is **not** sized by demand — it is the fixed profile constant `mainTempBytes`. Spill demand only materializes inside translate (codegen), after the plan is frozen; frontend cannot import codegen (R15). So "size it like the main pool — the peak spill demand across irq-only functions" is self-contradictory and unimplementable at `zp-allocator.ts` as task 4.2.4 directs. Separately, pool *exhaustion* raises the binder's loud E90001 ICE; E10032 covers ZP-window *fit* — the error-handling row conflates the two, mis-aiming the test oracle.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Keep `irqTempBytes` a profile constant (optionally raise the default 2 → 4 to match `mainTempBytes`); extend the binder's exhaustion ICE to name the irq pool; rewrite the sizing sentence, error row, and task 4.2.4 | Matches the real main-pool mechanism; spec §7.6 mandates separation, not a sizing method; loud on overflow | A constant can be too small for a heavy handler (loud ICE, user raises the profile value) |
| B | Build a frontend-side spill-demand estimator | True demand sizing | New speculative machinery; wrong on either side of the estimate; nothing designed or tasked |
| C | Two-pass compile with translate→allocator feedback | Exact | Breaks the frozen-plan architecture for a slice-scale need |

**Recommendation:** Option A; whether to raise the default from 2 is a user call (the risk table itself flags 2 as possibly small).
**Confidence:** High · **Hardening:** challenger AFFIRMED, option A.

**User Decision:** Resolved — accepted recommendation; fix applied 2026-07-17 (iteration 2 verified)

### PF-004: "Const-only" mischaracterizes the shipped 5b initializer discipline; ST-33b's non-const arm pins a rejection that does not exist 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (Stale Assumptions)
**Location:** `03-04-zeropage.md` §Typing & initializers; AR-18 row text; `07-testing-strategy.md` ST-33b; task 5.2.2
**Codebase Evidence:** `statement-typing.ts:108-134` (call-bearing initializers rejected loudly — via `IceCode.Unexpected`/E90001; no const-only check for `let`), `init-order.ts` (dependency-orders initializers that READ other module vars), `lower.ts:245-299` (runtime `__init` lowering), spec `10-modules.md:208` (`let derived: word = base + 50;` is the normative example)
**Related:** AR-18 — its "(const-only, call-free)" parenthetical contradicts its own stated basis ("5b parity"); amending it requires back-propagation into the AR row.

**The Problem:** The shipped 5b discipline is **call-free only**. `let` initializers may read other module variables and are runtime-initialized in dependency order. "Const-only … EXACTLY the 5b discipline (same rejection set, same E10193-family behavior)" is factually wrong (E10193 is const-decl-only), and ST-33b's "non-const ZP initializer → the existing 5b rejection set" pins a rejection that does not exist — under true parity such a program compiles. An executor could build a new const-only restriction that contradicts both parity and Ch10 §5.4.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | True parity: call-free only; var-reading ZP initializers join `initOrder` and the `__init` stream (executor note: the init-order walk and `moduleVarLocOfSymbol` must cover ZP-storage symbols); reword 03-04/AR-18; split ST-33b — call-bearing → the existing loud rejection (E90001-class, message "call-bearing module initializers are not supported yet"), var-reading → positive dependency-ordered case | Matches shipped behavior + Ch10 §5.4; no new checks | AR-18 row text needs amending (back-propagation) |
| B | Restrict ZP initializers to compile-time consts (new ZP-specific check) | Simpler startup story for ZP | Invents a divergence contradicting the decided parity basis and the spec's own example |

**Recommendation:** Option A.
**Confidence:** High · **Hardening:** challenger AFFIRMED, option A.

**User Decision:** Resolved — accepted recommendation; fix applied 2026-07-17 (iteration 2 verified)

### PF-005: Aggregate ZP initializers are parser-blocked, contradicting the decided "full surface" — no task or test either way 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment
**Location:** `03-04-zeropage.md` §Overview + §Typing & initializers; Phase 5 tasks (no parser task); ST-31/32 (addressing only)
**Codebase Evidence:** `parse-decl.ts:413` (`parsePrimaryExpr`) vs `:322,364` (`parseExpression(state, 0, true)`); `pratt.ts:214-216` (the shim passes `allowAggregateLit: false`), `pratt.ts:268,348` (the flag gates array AND struct literals); `lower.ts:281-295` (`lowerAggregateInit` — symbol-agnostic, reusable)
**Related:** AR-18 decided "full surface"; option B would narrow it (back-propagation required).

**The Problem:** `zeropage { pos: byte[4] = [1,2,3,4]; }` is a parse error today — zeropage field initializers parse with aggregate literals disabled while `let`/`const` allow them. The plan's "full surface (scalars + aggregates)" + initializer parity is therefore unbuildable for aggregate initializers, and Phase 5 has no parser task and no ST case in either direction. Failure mode is loud (parse error), which is the one mitigating factor.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Flip the field-initializer context to `parseExpression(state, 0, true)`; add an ST case; ride `lowerAggregateInit` with the ZP symbol as direct base (ST-33's string-init pin is unaffected — string literals aren't gated by this flag) | Honors the decided surface at trivial cost | Slightly grows Phase 5 |
| B | Pin aggregate ZP initializers OUT of 8a: negative boundary test + recorded deviation | Smaller Phase 5 | Narrows a decided surface for no real savings |

**Recommendation:** Option A.
**Confidence:** High · **Hardening:** challenger AFFIRMED, option A (severity nuance noted: loud failure mode makes MINOR-plus-task defensible; kept MAJOR because a decided surface is unimplementable as planned).

**User Decision:** Resolved — accepted recommendation; fix applied 2026-07-17 (iteration 2 verified)

---

## Minor

### PF-006: "No interference change follows for plain functions" contradicts the code and AR-1 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Stale Assumption)
**Location:** `03-01-address-of.md` §Typing, Notes bullet 3
**Codebase Evidence:** `interference.ts:104-112` — Step 2 already includes `f.isEscaped` in the always-live set; AR-1 itself says "8a's `isEscaped` flip perturbs SFA layout/goldens".
**The Problem:** Flipping `isEscaped` for any `&fn` target makes that function always-live (frames AND pairs, via `graph.edges`) — a real layout consequence, spec-aligned (Ch06 §8 requires the frame allocated) but the sentence tells the executor the opposite. **Recommendation (sole viable fix):** reword to "the escape flag flows through the *existing* Step-2 always-live handling — layout perturbs only for programs using `&fn`; none of the ten prior fixtures do." (Considered and dropped: decoupling escape from always-live — contradicts Ch06 §8 and the vector-install reality.)
**User Decision:** Resolved — accepted recommendation; fix applied 2026-07-17 (iteration 2 verified)

### PF-007: W10030 threshold stated as 75%; shipped is 80% 🟡 MINOR

**Dimension:** 13 — Codebase Alignment
**Location:** `03-04-zeropage.md` §Projection & wiring; `07-testing-strategy.md` ST-30
**Codebase Evidence:** `platform-profile.ts` `zpWarnThreshold: 0.8`; `budgets.ts:80-86`.
**The Problem:** A spec test authored to "W10030 at ≥75%" mis-pins — a 76%-usage program gets no warning until 80%. **Recommendation (sole viable fix):** say "≥ `zpWarnThreshold` (80% default)".
**User Decision:** Resolved — accepted recommendation; fix applied 2026-07-17 (iteration 2 verified)

### PF-008: F005's remaining zeropage negative surface is unaddressed (ZP-5 export; E10031; E10033) 🟡 MINOR

**Dimension:** 4 — Completeness Gaps
**Location:** `03-04-zeropage.md` (silent on all three); 01-requirements deviations row
**Codebase Evidence:** F005 ZP-5 ("per-variable `export` inside the block"), F005 error table E10031/E10033; `parse-decl.ts:396-431` (no export/keyword slot — all three fail as generic parse errors); `diagnostic-codes.ts:45` (E10033 already spent on `RamBudgetExceeded`).
**The Problem:** The plan records the F005 one-block deviation (AR-17) but not these three F005 rows: per-variable export (unsupported in 8a), `const`-in-block (spec: E10031, unminted), keyword-in-block (spec: E10033 — a number now double-booked by the shipped registry). **Recommendation:** record all three as deviations (generic loud parse errors suffice for 8a; ZP vars unexportable; E10031 stays unminted; E10033 conflict noted per the AR-115 precedent) + 1-2 negative parse tests. (Considered and dropped: minting E10031 now — no consumer demand in 8a.)
**User Decision:** Resolved — accepted recommendation; fix applied 2026-07-17 (iteration 2 verified)

### PF-009: Interrupt-ABI spec citations point at §7.3; the ABI lives in §7.4 🟡 MINOR

**Dimension:** 12 — Consistency
**Location:** `03-02-interrupts.md` §Codegen ABI ("Per Ch 06 §7.3"), AR-14, ST-14's Source column; AR-15 cites "§7.4/§7.5" for the hazard (it is §7.5; §7.4 is the code pattern)
**Codebase Evidence:** spec `06-functions.md:546` (§7.3 = Rules), `:558` (§7.4 = Generated Code Pattern — the PHA/TXA… sequence + the 35-cycle/11-byte cost + the P-register note), `:585` (§7.5 = hazard).
**The Problem:** These citations feed the immutable-oracle authoring rule — they must point at the right normative text. **Recommendation (sole viable fix):** correct the section numbers.
**User Decision:** Resolved — accepted recommendation; fix applied 2026-07-17 (iteration 2 verified)

### PF-010: ST-34/35 cite F004 as their source, but F004/Ch10 mandate fall-through entry — the long-shipped JSR/JMP-shim deviation is unrecorded 🟡 MINOR

**Dimension:** 7 — Testability (oracle sourcing)
**Location:** `07-testing-strategy.md` ST-34/ST-35 Source column; 01-requirements recorded-deviations row
**Codebase Evidence:** F004 ("falls through directly into `main()`'s body — no JSR, no JMP"), `10-modules.md:186,191` (same); shipped shim `shared-hooks.ts:105` (`JSR _main`) / `:111` (`JMP _main`) — embodied in all ten goldens. Also Ch03 §5.1 orders ZP inits before RAM inits, while shipped `__init` is dependency-topological (Ch10 §5.4) — golden-visible only.
**The Problem:** A test author following the cited source would pin fall-through and fail shipped reality. The deviation is long-standing and pre-dates this plan, but this plan is where the shim variant becomes load-bearing. **Recommendation:** add the startup-entry deviation (and the Ch03 §5.1 ordering note) to the deviations row; source ST-34/35 from AR-25 + the shipped shim contract. (Considered and dropped: changing the shim to fall-through — out of 8a scope, would re-mint all goldens.)
**User Decision:** Resolved — accepted recommendation; fix applied 2026-07-17 (iteration 2 verified)

### PF-011: The fixture's border assertion has a mod-16 collision window 🟡 MINOR

**Dimension:** 9 — Edge Cases
**Location:** `03-06-acceptance.md` fixture (handler `poke($D020, peek($D020) + 1)` unconditionally) + §VICE assertions (`$D020 & $0F` ≠ boot border)
**Codebase Evidence:** the counter saturates (`frameCount < 100`) but the border increments on **every** IRQ forever; final border = (boot + totalIRQs) mod 16, and totalIRQs varies with `runFrames(N)` timing — if ≡ 0 (mod 16), the secondary assertion fails spuriously (~1/16 of timing perturbations, resurfacing at every re-mint or harness change).
**The Problem:** The AR-16 hardening removed the equality-poll trap from the counter but left a modular-arithmetic trap in the border. **Recommendation (sole viable fix):** gate the border flip under the same saturation guard (e.g. move it into `bump()`'s `if`), making the final border (boot + 100) mod 16 — deterministic and ≠ boot for boot=14. (Considered and dropped: deleting the secondary assertion — it is the RD item-7 observable.)
**User Decision:** Resolved — accepted recommendation; fix applied 2026-07-17 (iteration 2 verified)

### PF-012: `lo(&fn)` / `hi(&fn)` — the spec's own install idiom — has no ST case 🟡 MINOR

**Dimension:** 7 — Testability
**Location:** `07-testing-strategy.md` (ST-1..10b); `03-01-address-of.md` §Lowering
**Codebase Evidence:** Ch04 §8.4's canonical example is `poke(IRQ_VECTOR_LO, lo(&onVSync))`; `lo`/`hi` are T2 inline emitters (`lower.ts:2094+`), and `&fn` is not compile-time foldable, so this rides the plan's case-2 homing fallback — legal per the placement discipline but exercised nowhere.
**The Problem:** If the executor implements case-1/case-2 selection slightly narrowly, the spec's own idiom ICEs, and no test notices. **Recommendation (sole viable fix):** add one ST case (`lo(&fn)`/`hi(&fn)` → homed word temp, or the smarter `#<sym`/`#>sym` immediate if the executor special-cases it).
**User Decision:** Resolved — accepted recommendation; fix applied 2026-07-17 (iteration 2 verified)

---

## Observations

### PF-013: ST-44 "no re-mint" vs AC-5's justified-re-mint escape hatch 🔵 OBSERVATION

**Dimension:** 12 — Consistency. **Location:** 01-requirements AC-5 vs ST-44.
AC-5 allows individually-justified re-mints; ST-44 says "byte-exact, no re-mint". Not a real contradiction (a justified re-mint updates goldens via `UPDATE_GOLDEN`, not test logic), but worth one clarifying sentence so the immutable-oracle rule isn't misread. **User Decision:** Resolved — accepted recommendation; fix applied 2026-07-17 (iteration 2 verified)

### PF-014: `__zp_<Module>_<name>` can collide with reserved `__zp_*` names for adversarial module names 🔵 OBSERVATION

**Dimension:** 9 — Edge Cases. **Codebase Evidence:** `plan-allocation.ts:167` builds `__zp_ptr_<fn>_<param>` from sanitized user names; a module literally named `ptr` with a var `scratch` yields `__zp_ptr_scratch`. Failure is **loud** (duplicate ACME equate at assemble-clean), and the same pre-existing hazard class covers `__var_*`/`__frame_*`. No action needed for 8a; a reserved-prefix guard is a future cleanup candidate. **User Decision:** Resolved — accepted recommendation (no plan change needed for 8a; noted as future cleanup)

### PF-015: "The platform ZP range" actually means the semantics `DEFAULT_PROFILE` today 🔵 OBSERVATION

**Dimension:** 1 — Ambiguities. **Codebase Evidence:** `run-frontend.ts:160-178` — SFA planning consumes the interim `DEFAULT_PROFILE` (zp $02–$2F, 46 bytes), not `plugin.profile`; per-platform semantics profiles land later.
AC-2/ST-25's "inside the platform ZP range" should be read as this profile so the executor doesn't wire `plugin.profile` plumbing out of scope. One clarifying parenthetical suffices. **User Decision:** Resolved — accepted recommendation; fix applied 2026-07-17 (iteration 2 verified)

---

## Iteration 2 — fixes applied and re-scanned (2026-07-17)

> **Previous iteration**: 15 findings — all resolved (user accepted all recommendations, blanket)
> **This iteration**: 2 new findings (both MINOR corollaries of accepted fixes, resolved under
> the same "apply the fixes" authorization)
> **Carried forward**: none

**Fix application** (all per the accepted recommendations): 03-03 rewritten (root-set
enumeration excl. interrupt-kind escapees + exports-via-call-edges-only, PF-001; irq-only twin
key + predicate, PF-002; profile-constant pool + per-pool binder ICE + split error rows,
PF-003); 03-01 escape/always-live wording + integration line (PF-006/PF-016); 03-02 §7.4
citations (PF-009); 03-04 call-free parity + executor notes (PF-004), aggregate-initializer
parser fix (PF-005), 80% threshold + DEFAULT_PROFILE note (PF-007/PF-015), F005 deviations
(PF-008), reworked error table; 03-05 startup-entry deviation note (PF-010); 03-06 border flip
gated under saturation + assertion note (PF-011), keyword-negatives matrix row (PF-008),
re-mint clarification (PF-013); 07-testing ST-9b/ST-28b/ST-31b/ST-33c added, ST-22/25/30/33b
reworded, ST-14/15/34/35 sources corrected (PF-002/004/005/007/008/009/010/012/015); 99-exec
tasks 1.3.1/4.2.1/4.2.4/4.2.5 reworded, Phase 5 gains the parser task (5.2.1, renumbered
5.2.x), totals 59 → 60; 01-requirements deviations/AC-2/SFA-policy rows; 00-ambiguity-register
gains the governing Preflight-amendments block (AR-15/18/14/16/25 back-propagation).

**Re-scan verification**: stale-text sweep clean (no remaining "const-only" / "peak spill
demand" / "complement of irq-only" / "§7.3-as-ABI" / "75%" outside the preserved AR row text
and this report); checkbox count = 60 matching all headers; new ST cases wired through 03-04 /
03-06 / 07 / 99 consistently; fixture (03-06) and index example consistent; 03-03's new
enumeration cross-checked against `model.callGraph` capabilities (symbol-based, cross-module —
implementable as specified).

### PF-016: 03-01 integration line stale after PF-001 🟡 MINOR (iteration 2)

**Dimension:** 12 — Consistency. **Location:** `03-01-address-of.md` §Integration Points.
"03-03 consumes nothing from here" became false once PF-001 made escaped non-interrupt
functions mainline roots — 03-03 now consumes the address-taken set. Caught during fix
application; line rewritten. **User Decision:** Resolved — corollary of accepted PF-001, fixed
during application.

### PF-017: zp-allocator cross-references stale after PF-003 🟡 MINOR (iteration 2)

**Dimension:** 12 — Consistency. **Location:** `99-execution-plan.md` §Dependencies;
`03-04-zeropage.md` §Integration Points. Both still said Phase 4 / 03-03 "touch
zp-allocator.ts" — after PF-003 (pool stays a profile constant; task 4.2.4 moved to
`register-binding.ts`) and with the twin living in `plan-allocation.ts`, `zp-allocator.ts`
needs no change from either component. Caught by the iteration-2 sweep; both references
rewritten. **User Decision:** Resolved — corollary of accepted PF-003, fixed during re-scan.

---

## Verification ledger (what checked out)

Beyond the findings above, the plan's grounding is exceptionally accurate — verified exact, among others: `model-adapter.ts:68` (`isEscaped` seam + comment), `lower.ts:337/904-908/1304-1307/1779-1786`, `translate.ts:497/1627-1641/1960-1963` + the three addr-position backstops (`:557/:780/:837`), `emit.ts:38-51` (`minimal`→`non-terminating`, `auto`→undefined), `instr-program.ts:205-213` SEAM, `shared-hooks.ts:88-114`, E10047/48/49/50 free + E10042 reserved + E10040/41/43/44/45/46 spent, the 13-T1-+`asm_wai` catalog (`catalog.ts:198-221`), ten goldens on disk, the Ch06 §7.7 `$0314` defect, F005 ZP-2/ZP-3/ZP-4, FN-A9/FUT-001/002/004, RD-18 Slice-8 row + acceptance items 7–9, and the 59-task count (11/6/9/11/9/6/7). The module-level `&` initializer path (ST-1's sample) was investigated and **dissolved** — `let` initializers lower through `lowerExpr` into `__init`, where an `addr` operand is a legal store source.
