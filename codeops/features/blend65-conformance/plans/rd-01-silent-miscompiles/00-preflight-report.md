# Preflight Report: RD-01 Silent Miscompiles (plan)

> **Status**: ❌ BLOCKED — 1 critical + 13 major unresolved (+ 17 minor)
> **Iteration**: 1 (first plan scan)
> **Artifact**: implementation plan at `codeops/features/blend65-conformance/plans/rd-01-silent-miscompiles/`
> **Codebase Grounded**: ~20 source files examined; all 13 plan code-claims re-verified; CRITICAL + 2 new majors lead-verified firsthand
> **Last Updated**: 2026-07-22
> **Scan**: 5 Fable auditor clusters (independent of the Opus author) + lead synthesis
> ⚠️ **SAME-SESSION**: plan authored this session by Opus; auditors on Fable for independence.

### Codebase Context Summary

**Tech Stack:** TS ESM monorepo (Yarn v1, Turbo, Vitest); 6502 AOT compiler. **Architecture:** Lexer→Parser→Analyzer→SFA→IL/lower→**instr/translate**→Emitter. R15: frontend/language-server ⊄ codegen.
**Key files examined:** `codegen/src/instr/translate.ts` (foldStoreHome:1129-1149, translateAddSub:738-773, bindA), `codegen/src/il/lower.ts` (lowerFor, incrementCounter:864-883, slotIlType:2822 + 6 call sites incl :701), `core/src/semantics/semantic-model.ts`, `frontend/src/semantics/function-collection.ts:326`, `sfa/frame-computation.ts:52-66`, `sfa/model-adapter.ts:429-488`, `semantics/const-eval.ts:185-191`, `type-check/statement-typing.ts:798,810-825`, `intrinsic-validation.ts:178-188`, `compiler/src/api/emit.ts:94-104` + `run-frontend.ts:185`, `expressiveness-ledger.json`, `00-spec-errata.md`.

### Convergence (independent clusters agreeing raises confidence)
- **CRITICAL PF-001** found by **2 clusters** (② grounding, ④ risk), both grounded in the same `translate.ts` mechanics; **lead-verified**.
- **PF-004 (R8 ordering)** found by **3 clusters** (①⑤③). **PF-002, PF-005, PF-006, PF-011, PF-012, PF-013** each by **2**.

### Summary by Severity
| Severity | Count | Status |
|---|---|---|
| 🔴 CRITICAL | 1 | pending |
| 🟠 MAJOR | 13 | pending |
| 🟡 MINOR | 17 | pending |

---

## 🔴 CRITICAL

### PF-001: AR-P3's "reuse the live temps, no scratch" wrap `brcmp` cannot translate — word axis ICEs, byte axis loses the pre-step value, and the natural workaround silently disables the guard
**Dimension:** Feasibility / Codebase Alignment (Stale Assumption) · **Found by ②+④, lead-verified**
**Location:** `00-ambiguity-register.md` AR-P3; `03-01-loop-exit.md` §Proposed-Changes-2, "Changed functions" ("No new load"); `99-execution-plan.md` task 1.2.3 (touches only `lower.ts`)
**Codebase Evidence (verified firsthand):**
- `translate.ts:1134` — `foldStoreHome` returns `null` when `useCount(dest) > 1`. Adding the wrap `brcmp` reading `next` makes `next` 2-use.
- `translate.ts:758-762` — 16-bit `add` REQUIRES `foldStoreHome`; on null → `iceUnsupported("word arithmetic result not consumed by a store")`. **Word/sword loops ICE (M-01e is a headline defect).**
- `translate.ts:749-755` — byte `add` does `leftIntoA(left)` then `bindA(next)` with **no spill of `left`**; `current`'s only copy dies at the `ADC`. At the `brcmp`, `rightSource(current)` finds no ZP home → binder ICE.
- Reloading `current` from its slot is not an escape — the slot holds `next` after the store (RD AR-1's named "rematerialisation hazard"); a reload compares `next` vs `next` → **guard never fires**, ST-13/ST-14 stay green, only `[local]` VICE (CI-skipped, AR-27) sees the hang. **A silent miscompile reintroduced inside the fix for silent miscompiles.**
**The Problem:** the plan's single grounded M-01 mechanism is grounded only at the IL level; at the instruction seam it ICEs on ≥2 of 5 axes and no Phase-1 task schedules translator work. This is the RD's own defect species one layer deeper — AR-1 explicitly offered two shapes that WORK (scratch copy; reconstruct `next ∓ step`); AR-P3 rejected both for the one that can't translate. Cost accounting also wrong (AR-P3 "no cost"; RD "+1 load+compare").

**Options:**
| Option | Description | Pros | Cons |
|---|---|---|---|
| A ✅ | **Reconstruction, immediate form** (RD option C refined): after the store, compare the post-step counter against an immediate derived from step + type-extreme — ascending wrap ⟺ `next < step`; descending ⟺ `next > typeMax − step`. Reload `next` (single-use → deferred-load folds into the compare). | Translatable **today, zero `translate.ts` changes**, both widths; costs exactly the RD-budgeted +1 load+compare; no reliance on cross-op temp liveness | Slightly less "obvious" than comparing next vs current; needs the per-type immediate |
| B | **Explicit scratch copy** (RD option A): spill `current` to a scratch slot before the add; `brcmp next` vs scratch | Matches the RD wording literally | Extra store per guarded iteration (worse on the meet-or-beat bar); a new scratch slot |
| C | **Schedule real translator work**: protect-live-left in `translateAddSub`, allow multi-use word add results | Enables the original next-vs-current shape | Materially larger, unpriced, touches the register binder — highest risk in an RD about miscompiles |
**Recommendation:** **Option A.** It is the only shape that (i) translates with zero binder risk today, (ii) hits exactly the already-owned +1 cost, and (iii) admits a CI-observable oracle (assert the wrap compare's memory operand is **not** the counter slot — catches the stale-reload trap PF-007 also flags). Reopen AR-P3 (a lead-decided, user-delegated row) and add an explicit `translate.ts`-seam verification task even though A needs no translator change.
**User Decision:** Pending

---

## 🟠 MAJOR

### PF-002: M-03 widest-slot sizing is scoped to a seam where the collision no longer exists; Step 3.2 internal order is inverted
**②+③** · **Location:** `03-03-frame-slot.md` Part B, `02-current-state.md` §M-03, `99` 3.2.2 (before 3.2.3)
**Evidence:** name-collapse happens upstream at `function-collection.ts:326` (`bodyScope.symbols.set` — last-wins Map); `model-adapter.ts:429-441` projects `scope.symbols.values()` → one FrameVar per name; `frame-computation.ts:52-66` has no collision logic and never sees >1 declaration per name. 3.2.1/3.2.2 both depend on 3.2.3's retention.
**Problem:** 3.2.2 ("size to widest at `frame-computation.ts:52-64`") is not implementable there; widest-sizing needs per-declaration retention first, and the tempting in-place widen of the surviving `Symbol.type` re-types the narrow sibling's reads — manufacturing the defect class this RD kills.
**Recommendation:** reorder Step 3.2 → retention (3.2.3) → diagnostics (3.2.1) → sizing (3.2.2, re-scoped to `collectFrameVars`/`model-adapter` width projection; `frame-computation` takes the max). **Decision:** Pending

### PF-003: Core-package impact blindness — the model stamp, per-declaration retention, and E10062/W10182 all touch `@blend65/core`, which no file list names; "for-loop model node" is phantom
**②** · **Location:** `03-01` §New/changed model state, `00-index` Related Files, `02` Relevant Files, `03-03` Part C
**Evidence:** `core/src/semantics/semantic-model.ts:27-76` — `SemanticModel` has only whole-program maps, no per-statement node to "gain fields"; `createEmptyModel:88-108` must mirror any new field; `Symbol` is core (`symbol.ts:40`); `diagnostic-codes.ts` (E10062/W10182 registration) is core. Every plan file list names only frontend/codegen/sfa.
**Problem:** the api-surface lens is active and the one package all 10 depend on is invisible in the inventory; "ForModel gains" implies a structure that doesn't exist.
**Recommendation:** add `packages/core` (semantic-model.ts, symbol.ts, diagnostic-codes.ts) to the inventory; reword to "a new node-keyed map on `SemanticModel`" + `createEmptyModel` mirror. **Decision:** Pending

### PF-004: R8 fixture audit is scheduled AFTER the diagnostics are wired; the RD mandates BEFORE
**①+⑤+③ (3 clusters)** · **Location:** `99` tasks 2.3.1, 3.3.2, 4.3.1 (post-implementation hardening) · **Evidence:** RD R8:169 "audited … **before the diagnostics are wired**"; SFA fixtures deliberately build the IRQ∩mainline shape (`irq-interference.spec.test.ts:89-103`).
**Problem:** exposed fixtures surface as surprise reds at the green/phase-close verify, where the plan's "fix the implementation, never the test" rule misdiagnoses them (an exposed fixture must be edited).
**Recommendation:** move each audit into the phase's Step N.1 (with spec authoring). **Decision:** Pending

### PF-005: ST-1…ST-12 assign termination/visit-count to the `[CI]` tier, which cannot observe it; AC-2's headline counts (256, 10) are pinned nowhere
**①+⑤ (2 clusters)** · **Location:** `07` M-01 table + Test-Categories mapping to `control-flow-lowering.spec.test.ts` `[CI]` · **Evidence:** RD AC-1 `[CI]` oracle = "a shape check, not a termination proof"; no in-process interpreter; VICE is `[local]`/CI-skipped (AR-27). ST-16C's five cells produce none of 256 or the visit-of-0 count.
**Problem:** verbatim-excerpted rows instruct a `[CI]` codegen test to assert termination/counts → the project's signature "green for the wrong reason" oracle; the headline counts of the headline defects are measured nowhere.
**Recommendation:** reword ST-1…ST-12 `[CI]` expectations to guard-shape/gating; move all termination/count language into `[local]` ST-16L/ST-16C and add `0 to 255`=256 and `9 downto 0`=10 (word accumulator). **Decision:** Pending

### PF-006: ST-20A's "single store only" oracle is unsatisfiable — a frontend error aborts ALL asm emission
**⑤+③ (2 clusters)** · **Location:** `07` ST-20A; `03-02` §Impl ("blocks codegen of the call"); `99` 2.2.1 ("block the second store") · **Evidence:** `compiler/src/api/emit.ts:94-104` — `emitAsm().text` is `undefined` when `run.bag.hasErrors()`. Post-fix the wide poke IS an error → no text; "single store" fails forever, "no `STX $D020+1`" passes vacuously. Three inconsistent stories (second store / the call / whole program).
**Recommendation:** respecify ST-20A as "E10154 present AND `emitAsm` text absent (emission blocked)"; move any store-count assertion onto an accepted control program; align 2.2.1/03-02 wording. **Decision:** Pending

### PF-007: ST-14's asm oracle is undefined, and ST-13(IL)+ST-14 both pass on a compiler with inverted branch polarity that still hangs
**⑤** · **Location:** `07` ST-14; `03-01:123-124` · **Evidence:** RD AC-4 forbids a bare shape pin (inversion/relaxation always-on) but neither RD nor plan says what the `[CI]` asm assertion checks; a below-IL polarity inversion (wrap edge → `cond` not `end`) passes ST-13 and any presence-flavored ST-14 and hangs — only `[local]` ST-16L catches it.
**Recommendation:** specify an inversion/relaxation-tolerant assertion (locate the increment seq; assert a post-step-vs-pre-step compare whose taken path resolves to the exit label) and state asm polarity is finally discharged only by `[local]` ST-16L. Ties to PF-001's stale-reload oracle. **Decision:** Pending

### PF-008: AC-1's `[CI]` axis matrix is under-enumerated — `sword` has zero `[CI]` rows (~7 of 16 boundary cells covered)
**⑤** · **Location:** `07` ST-1…ST-16 vs `03-01:125` ("shape-match across the axis matrix") · **Evidence:** AC-1 demands each of to/downto × byte/word × unsigned/signed × {step1, non-dividing} = 16 boundary cells; ST rows cover ~7; ST-7/ST-8 are the *interior-escape* (non-boundary) cells, not boundary cells.
**Recommendation:** enumerate the missing boundary cells OR, if `brcmp` type-dispatch makes one shape test per {width,sign} sufficient, record that narrowed AC-1 reading in the register — not silently. **Decision:** Pending

### PF-009: A literal `step ≥ 2^width` truncates to effective step 0 — both exits defeated, a silent hang that survives every RD-01 deliverable
**④, lead-verified** · **Location:** `03-01` (guard design), `07` (no cell), RD class table (step axis = "1, >1") · **Evidence:** `statement-typing.ts:810-825` checks only `step ≥ 1`, never types/ranges the step vs the counter; `lower.ts:879` folds the raw value; `translate.ts:1048-1050` masks the immediate to width. `for (i: byte = 0 to 10 step 256)` → `ADC #$00` → `next == current` → both the bound compare and the wrap `brcmp` are false forever.
**Recommendation:** add a frontend range-check of the folded step against the counter type (extend the E10061 site — `range` is in scope) + one ST case. **Decision:** Pending

### PF-010: The wrap-safe stamp reuses a resolver-less `evalConst`, so every named-const interior bound gets the guard — an invisible meet-or-beat regression with no red test
**④, lead-verified** · **Location:** `99` 1.2.1, `03-01:31-39`, `02:38-40` · **Evidence:** `statement-typing.ts:798` calls `evalConst(stmt.bound)` with no `resolveRef`; `const-eval.ts:187` returns `nonConst` for any `IdentExpr`/`FieldAccessExpr`. So `const N: byte = 10; for (i = 0 to N)` → wrapSafe=false → guard on a provably-interior loop. The scope-aware `ctx.engine.evalExpr` (used at `expression-typing.ts:1601`) is the right tool. No corpus loop uses a named-const bound → AC-12 passes; ST-9 uses a literal → no red test.
**Recommendation:** pin in 03-01 that the stamp uses the resolver-backed const engine; add an ST: named-const interior bound emits NO guard. Directly implicates the new beat-first directive. **Decision:** Pending

### PF-011: "Offsets of all other slots are unchanged" is a false invariant — implemented literally it preserves the pop-2 overrun
**②+④ (2 clusters)** · **Location:** `03-03` Part B; `99` 3.2.2, 3.3.1 ("neighbour-offset stability") · **Evidence:** `frame-computation.ts:53,59,63-65` — offset is a running sum; widening the shared slot 1→2 keeps `after` at `t+1`, inside the widened slot → the word store still destroys it. Correct outcome = positional *recompute*, shifting later slots by the delta.
**Recommendation:** reword to "the *algorithm* stays positional (AR-3); the collapsed slot becomes widest and later offsets shift by the delta — that shift IS the fix"; reword 3.3.1 to order-stability + no-overlap. **Decision:** Pending

### PF-012: The per-declaration width fix misses `lower.ts:701` — after widest-sizing, sibling for-counters at differing widths become a NEW silent miscompile in the R6-protected population
**②+④ (2 clusters)** · **Location:** `02:48-50`, `03-03` Part C (names only `:1184`) · **Evidence:** `slotIlType` has 6 call sites; `:701` is `lowerFor`'s counter-type resolution (name-keyed). Sequential loops reusing a counter name are spec-legal siblings (E10062 nested-only). After widest-sizing, `for (let i: byte …){} for (let i: word …){}` gives the byte loop a word `counterType` → uninitialised high-byte compare/ICE.
**Recommendation:** extend Part C to every local-width consumer — `:701` (counter) and `:525` (let-store) with `:1184`/`:1634`; add an ST: sibling byte-then-word counters, no diagnostic. **Decision:** Pending

### PF-013: AR-8's "frame state counts spill slots" is not computable at the frontend/sfa seam where the warning lives
**②+④ (2 clusters)** · **Location:** `03-04:39-41,65`, `99` 4.2.2 · **Evidence:** spill slots are created by the codegen translator at register pressure (`translate.ts:1787-1797`, `register-binding.ts:211-229`); `__rt_*` staging is lowering-time; R15 blocks frontend→codegen. The classification seam sees only params+locals+synthetic `0sc*`.
**Problem:** implemented as "no params ∧ no locals" it silently excludes a spilling shared function (false negative in the exact class M-04 names); implemented faithfully it makes ST-35 near-unsatisfiable.
**Recommendation:** decide the conservative proxy explicitly (e.g. no params/locals AND a syntactically spill-free body) and shape ST-35 to it — record as a new AR-P, not an executor improvisation. **Decision:** Pending

### PF-014: ST-7's "body never runs at 254" contradicts R1 — the step lands on 254, so the body must run there once
**②** · **Location:** `07` ST-7 · **Evidence:** `0 to 254 step 2`: 254 = 0 + 127·2 is in the visit set; RD R1 "the bound is visited exactly once when the step lands on it." The overshoot to avoid is the *wrapped* value 0, not 254.
**Problem:** as an immutable, verbatim-excerpted oracle, "body never runs at 254" forces a correct implementation to fail.
**Recommendation:** reword to "body runs at 254 exactly once; never runs at the wrapped value 0 (no overshoot)." **Decision:** Pending

---

## 🟡 MINOR (recommended fixes; batch-acceptable)

- **PF-015** `02` cites "ST-17/18/19" for the IRQ classification pins — collides with §07's new poke ST-17…19. → cite files, not bare IDs. [①]
- **PF-016** `00-index` says "six AR-P#"/"six touch-points"; register has 8; "closeout discharges ledger" is stale (P1 does). → fix counts/wording. [①]
- **PF-017** `03-01` Error-Handling row 1 ships placeholder "AC-...". → "R3 (AC-1/AC-3)". [①]
- **PF-018** ST-1…ST-12 loop headers omit grammar-mandatory `let` → verbatim = parse error. → add `let`. [①]
- **PF-019** ST-16C "word counter" is ambiguous (visit tally vs loop counter; the signed cell can't be word). → "visit tally held in a word". [①]
- **PF-020** task 5.2 "re-derive/refresh the scoreboard in this commit" duplicates 1.2.5 and blurs AR-P8 "P5 discharge-only". → reword to verify-only ("assert identical to P1-b; any diff is a phase-attribution failure"). [①+③]
- **PF-021** two-commit P1: the red Step-1.1 spec tests would make P1-a full-verify-red. → state the Step-1.1 test files ride the P1-b commit; P1-a = stamp + model-shape impl-tests only. [③]
- **PF-022** E10062/W10182 registration site `packages/core/src/diagnostics/diagnostic-codes.ts` is named nowhere. → name it in 3.2.1/4.2.2 (subsumed by PF-003). [③]
- **PF-023** W10182 errata entry missing (AR-7) AND `00-spec-errata.md:27` E-08 still prescribes the REJECTED carry mechanism. → add the W10182 errata task; refresh E-08 to the `brcmp` form (1.2.x). [⑤+③+②]
- **PF-024** AC-15 regenerated goldens (slice8b ST-36, byte-identity ST-38) can't be red-first. → name the goldens in 1.3.3 with the mutate-one-byte→observe-fail→restore recipe. [③]
- **PF-025** ST-31 in the frontend tier can't observe the emitted store extent (R15). → keep the layout assertion frontend; add the store-extent/neighbour check to the ST-32 test-harness case. [③]
- **PF-026** P2–P4 red-phase "verify FAIL" tasks lack Phase-1's "document any that pass" clause for negative controls (ST-21…24/30/34/35 green by construction). → copy 1.1.4's clause into 2.1.4/3.1.4/4.1.3. [⑤]
- **PF-027** AR-5's boolean-reject is untested and E10154 (a *width* code) is wrong for a same-width boolean. → add a kind-check (E10152 mismatch family) + one ST row, or drop the boolean claim. [⑤+④]
- **PF-028** `03-02` "seam option 1" (intrinsic-validation) is not viable — it runs before typing (`analyze.ts:170` vs `:179`), no type access. → strike option 1 or annotate "requires plumbing". [②]
- **PF-029** re-golden target mislocated — the golden is `packages/test-harness/test/golden/slice8b.asm.golden`, not `examples/slice8b/` (source-frozen, R8). → fix the pointer in 00-index/02 (RD AR-10 already cites the right file). [②]
- **PF-030** M-04's emission seam caller is the compiler package (`run-frontend.ts:185` `modelToFunctionInfo`, bagless) — not "entirely frontend/sfa". → add `@blend65/compiler` to the file list (R15 unaffected — public consumer). [②]
- **PF-031** the interrupt witness (every-handler BFS) can disagree with the taken-rooted warning set → could name a never-firing handler or suppress a real hazard. → produce the witness from the taken-rooted closure; add a mixed-roots (taken + never-taken) test. [④+②]

---

## Verdict

❌ **BLOCKED.** The mechanism half of M-01 (AR-P3) is infeasible as specified and, worse, its natural workaround silently reintroduces the exact defect class RD-01 exists to kill — caught, as in the RD's own iterations, one layer further out (translator vs IL). Twelve further majors span M-03's mis-scoped sizing seam, core-package impact blindness, two independently-real new silent-miscompile axes (step-overflow; sibling for-counters), and a cluster of testing-strategy oracles that would pass on a broken compiler. The defects are known and mostly have dominant fixes; the plan needs one revision iteration, then re-preflight.

**Next:** resolve PF-001's fix shape (the one genuinely high-stakes fork), then apply the revision across all findings and re-run preflight iteration 2.
