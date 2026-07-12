# Preflight Report: RD-18 Slice 7b — Pointer surface

> **Status**: ✅ PREFLIGHT PASSED — all 15 findings resolved (0 critical, 7 major, 5 minor, 3 observation; every recommendation accepted 2026-07-12, PF-002 explicitly as Option B narrowed). **Fixes APPLIED to the plan documents 2026-07-12** (same session, on the user's "apply"). One pin made during application, recorded as register row **AR-15** (PF-002 mechanics: element-list-only inference; **E10126 reused** for both non-inferable unsized forms — fill, and no-initializer — since the size-0 sentinel the old "error path" rode is deleted by the `number | null` reshape). ST-24b renumbered **ST-40** (Phase-4 lowering suite); the ST-40..44 gap filled by the preflight additions; task count 57 → **58** (new task 2.2.7 inference + 2.2.8 retired-row protocol, old 2.2.7 absorbed).
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/blend65-ri/plans/rd-18-slice-7b-pointers/` (12 documents, 7 phases / 57 tasks)
> **Codebase Grounded**: ~40 source files examined (3 parallel read-only verification agents + lead-context reads + 1 independent challenger with an empirical compile probe); ~70 references verified
> **Last Updated**: 2026-07-12
> **CodeOps Skills Version**: 3.3.1

> ⚠️ SAME-MODEL REVIEW: the artifact was authored earlier on 2026-07-12 by the same model in a
> **prior** session (fresh context for this review — the same-session risk does not apply, but
> same-model blind-spot risk does). Mitigations applied: every load-bearing claim re-verified at
> source by independent read-only agents; the frozen spec chapters cited directly (never from
> memory); one independent challenger audited the full MAJOR batch blind to the reviewer's picks
> and ran its own compile probe through the built `@blend65/compiler` facade.

## Codebase Context Summary

**Artifact Type:** Implementation plan (7 phases / 57 tasks + 6 design docs + testing strategy + 14-row ambiguity register, gate PASSED)
**Ambiguity Register:** Found — 14 items, all resolved; AR-2 was challenger-hardened at creation time
**Scope:** Full scan, all 13 dimensions

**Repository:** blend65 — TypeScript (ESM/NodeNext, strict), Yarn-classic + Turbo monorepo, 10 `@blend65/*` packages, Node 22, Vitest. No new dependencies proposed (verified: none needed).
**Architecture:** AOT compiler pipeline Lexer → Pratt parser → semantic passes → SFA → IL lowering (`lower.ts`) → 6502 translate (`translate.ts`) → ACME serialize. `spec/` is the frozen v3.0 baseline (D3). Working tree at `45e20c1` (the plan-creation commit; code identical to the register's grounding ref `9fb607e`).
**Key files examined:** `parse-decl.ts`, `parse-type.ts`, `keyword-map.ts`, `nodes.ts`, `node-kind.ts`, `symbol.ts`, `type.ts`, `type-utils.ts`, `semantic-model.ts`, `function-collection.ts`, `annotation-resolution.ts`, `type-resolution.ts`, `expression-typing.ts`, `statement-typing.ts`, `const-type-engine.ts`, `const-images.ts`, `analyze.ts`, `passes.ts`, `intrinsic-validation.ts`, `frame-computation.ts`, `zp-allocator.ts`, `model-adapter.ts`, `plan-allocation.ts`, `symbols.ts` (sfa), `function-info.ts`, `operand.ts` (il), `instruction.ts`, `lower.ts`, `translate.ts`, `register-binding.ts`, `addressing-mode.ts`, `cpu-table.ts`, `print-instr.ts`, `operand.ts` (instr-model), `platform-profile.ts` (both), `c64.ts`, `diagnostic-codes.ts`; spec chapters 02/05/06/07/08/11 + `grammar.ebnf.md`; RD-18; the rd-04 deferred-semantics ledger; `examples/slice7/`; the 7a test suites and goldens.

**Key observations:**
- The plan's recon is largely accurate and the "shipped-but-dark" inventory is real: `Symbol.byRef` + every hardcode site, the 2-byte `slotSize` rule, `computePeakPointers` + the `__zp_ptr_N` pool, the indirect IL ops with correct prescan liveness, `IndirectY` end-to-end, `#<sym+off` rendering, `Symbol.mutable` (already exists — no addition needed), and the `AnalyzeInput.targetProfile` seam all verified at the cited lines.
- The genuinely wrong claims cluster in three places: the **fixture's reliance on mechanisms that don't fire** (const-index folding bypasses the tier-2 formation path; unsized-const inference is half-shipped and dead), the **Phase-2 gate arithmetic** (four 7a pin-tests break exactly when the gate asserts green), and **two silent-miscompile defaults** the design docs don't specify (scalar compound-assign through a pair; byte-index scaling on multi-byte-element unsized params).
- Two 7a translate-discipline constraints are real and unstated: word arithmetic results are never register-resident (fused store-fold only, else ICE), and there are **zero** existing Y-touching emission sites (the plan's "audit existing Y emitters" premise is vacuous).

**Reference Verification:** ~70 file:line/spec references mapped — ~62 verified, 6 with line/attribution drift (PF-013), 2 substantively wrong mechanisms (PF-002 phantom inference, PF-008 finalizer claim).

## Summary by Dimension

| # | Dimension | Findings | Highest severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 1 (PF-011) | 🟡 |
| 2 | Implicit Assumptions | 0 (folded into PF-009) | — |
| 3 | Logical Contradictions | 1 (PF-005) | 🟠 |
| 4 | Completeness Gaps | 3 (PF-006, PF-011→D1, PF-012) | 🟠 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 1 (PF-009) | 🟡 |
| 7 | Testability | 1 (PF-014) | 🔵 |
| 8 | Security Blind Spots | 0 (no new attack surface; compiler-internal) | — |
| 9 | Edge Cases | 2 (PF-003, PF-007) | 🟠 |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 1 (PF-004) | 🟠 |
| 12 | Consistency | 1 (PF-013) | 🔵 |
| 13 | Codebase Alignment | 5 (PF-001, PF-002, PF-008, PF-010, PF-015) | 🟠 |

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 7 | all resolved — recommendations accepted (PF-002 = Option B narrowed) |
| 🟡 MINOR | 5 | all resolved — recommendations accepted |
| 🔵 OBSERVATION | 3 | all resolved — recommendations accepted |

---

## MAJOR findings

### PF-001: Acceptance fixture never exercises the tier-2 runtime pointer-formation path 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (test-impact / intent)
**Location:** `03-06-acceptance-fixtures.md` (fixture + byte contract $C003/$C004); `07-testing-strategy.md` ST-61
**Codebase Evidence:** `packages/codegen/src/il/lower.ts:1407-1409` — `lowerPlace` folds an immediate index into `constOffset`; `emitPlaceLoad`/`emitPlaceStore` (`:1456-1480`) then emit a plain absolute `load`/`store`. Offsets >255 are legal 16-bit absolute operands.
**The Problem:** `big[4]` and `big[260]` are both literal indexes — they compile to `STA/LDA __var_Main_big+N` absolute, exactly as in 7a. The scratch seed, the word add, and the `(zp),Y` access on the tier-2 array are never executed on VICE. The slice's headline machinery would ship with IL-level (ST-45) and constructed-IL (ST-48..58) coverage only — no end-to-end hardware proof, in a codebase whose history (7a DEF-1 Z-flag clobber; the Slice-6 word-compare miscompile) shows composition/register-state bugs are what the unit tiers miss and VICE catches. The 03-06 rationale ("if translate drops the index high byte, big[260] aliases big[4]") is factually false as written — translate never sees an index for a folded constant.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Route observable 4 through a runtime word index (`let idx: word = 260; big[idx] = 29; poke($C003, big[idx]);`), keep `big[4]` const-indexed on $C004 as the fold-coexistence/no-aliasing proof; add a formation landmark (`__zp_ptr_scratch` seed + word add) to ST-60's golden landmarks; fix the 03-06 rationale text | Formation path proven on hardware; six-observable AR-13 shape preserved; write AND read both formed | Slightly larger fixture/golden |
| B | Accept IL/translate-level coverage as sufficient | No fixture change | Headline machinery unproven end-to-end; violates the plan's own "suppression proof" discipline; 03-06 rationale still needs fixing |

**Recommendation:** Option A — the fixture is the slice's only real-hardware oracle, and the plan's own AR-13 note demands the high byte be load-bearing, which the const fold silently defeats.
`Confidence: High` · `Challenger: converged` (contributed the observable-4-rerouting refinement)

**User Decision:** Resolved — user accepted the recommendation (2026-07-12)

---

### PF-002: `export const TABLE: byte[] = [3, 5, 7];` cannot compile — the plan's "7a inference" is a phantom, and the mechanism is half-shipped 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (phantom mechanism / stale assumption)
**Location:** `03-06-acceptance-fixtures.md` (game.blend TABLE); `00-ambiguity-register.md` AR-5 resolution note; `03-02-param-semantics.md` §Symbols
**Codebase Evidence:** `type-resolution.ts:147` maps unsized `[]` to size 0; the module-const path goes to `const-images.ts` `writeArray` with the size-0 type → **E10152** "Array literal has 3 elements but the declared size is 0" (empirically probed through the built `compile()` facade); `let a: byte[] = [1,2,3]` likewise E10152. Yet the machinery is **half-shipped**: `typeArrayLit` infers `byte[3]` (`expression-typing.ts:1079-1082`) and `inferUnsizedArray` patches the symbol (`statement-typing.ts:825-829`, wired at `:142`/`:745`) — dead only because `checkAssignable` fires first and the const-image path bypasses typing. The form is ✅-blessed in TWO frozen chapters: `spec/02-type-system.md:74` ("Size inferred as 4") and `spec/08-arrays-strings.md:191,242`.
**The Problem:** The user-approved AR-13 fixture uses the exact failing line, and AR-5's invariant ("declaration inference (7a) fills a concrete size") was resolved on a false premise. Additionally, Option A's naive form ("keep the existing error path") is not free either: today's error is an *accidental* E10152 through the size-0 sentinel, which task 2.2.2's `size: number | null` reshape deletes — the non-param unsized behavior must be deliberately specified either way.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Fixture uses explicit `byte[3]`; correct AR-5/03-02 wording; explicitly rebuild a deliberate error for non-param unsized annotations after the `number\|null` reshape; ledger row for the deferred inference | Zero scope growth in a 57-task slice; 7b's load-bearing behavior (`byte[3] → const byte[]`, `length(TABLE)`) fully witnessed | Leaves two frozen-spec ✅ examples non-compiling; AR-5's recorded premise stays false until amended; fixture (a user decision) changes |
| B | Fix the latent inference defect narrowly in-slice — element-list literals only: infer-before-check (or a declaration-context assignability arm) + size the const-image path from the initializer; strings/fill unchanged; keep the fixture as approved | Frozen-spec conformance (two ✅ examples start compiling); AR-5's premise becomes true; user-approved fixture preserved; machinery is half-shipped so the delta is small; matches the repo's in-slice latent-defect precedent (7a DEF-1/AR-16, RD-15 DEF-1/AR-V23) | Genuine scope addition mid-slice (new tasks + ST rows); initializer semantics, not pointer surface |

**Recommendation:** Option B (narrowed as described) — the sentinel deletion means both options require deliberate new behavior, so B's real marginal cost is small, and it is the only option that honors the frozen spec's ✅ examples and makes AR-5's recorded premise true. Either choice amends AR-5 (resolved on a false premise), so this is a genuine user decision under the runtime-ambiguity protocol.
`Confidence: Med — the scope-discipline counter-argument is legitimate; the user's appetite decides` · `Hardening: challenger overturned the draft lean (A→B) with the sentinel-deletion and spec-✅ evidence` · `Challenger: diverged — reconciled to B-narrowed`

**User Decision:** Resolved — user chose **Option B (narrowed)**: fix the latent element-list inference defect in-slice; keep the approved fixture; amend AR-5 accordingly (2026-07-12)

---

### PF-003: A word value at pair offset 255 miscompiles — INY wraps Y to 0 🟠 MAJOR

**Dimension:** 9 — Edge Cases
**Location:** `03-04-lowering-indirect.md` §4 (fast-path predicate `constOffset ≤ 255`); `03-05-translate-indirect.md` (word arms)
**Codebase Evidence:** 6502 `(zp),Y` has no carry out of Y. The challenger probe compiled `struct S { pad: byte[254]; q: byte; v: word; }` (257 bytes, `v` at offset 255) clean under 7a today — the >256 gate caps array *types* only. Under the planned rules, by-ref `s.v` emits `LDY #255 / LDA (pair),Y / INY / LDA (pair),Y` — the high byte reads pointee+**0**.
**The Problem:** The fast-path predicate keys on the offset alone; a word (2-byte) value starting at 255 straddles the Y boundary. ST-47's invariant "no LDY >255 ever" doesn't even name this bug (`LDY #255` is legal; the wrap happens mid-value).

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Predicate becomes `constOffset + valueSize − 1 ≤ 255`; a word at 255 rides the already-planned AR-7 formation path; sharpen ST-47's invariant to "Y never wraps within one value access"; add an ST row | Closes the whole class with zero new machinery (formation is built in the same phase); spec-legal code stays legal | One more ST row |
| B | ICE loudly on word-at-offset-255 | Two-line guard | Rejects spec-legal code; contradicts the user's resolved AR-7 ("no cap"); the path it defers to ships in the same phase anyway |

**Recommendation:** Option A — same-phase machinery already handles it; B invents a cap AR-7 explicitly rejected.
`Confidence: High` · `Challenger: converged` (contributed the ST-47 invariant sharpening + the constructible-today proof)

**User Decision:** Resolved — user accepted the recommendation (2026-07-12)

---

### PF-004: Phase 2's "verify green" gate is unachievable as written — four 7a pin-tests break, and ST-24b needs Phase-4 behavior 🟠 MAJOR

**Dimension:** 11 — Ordering & Sequencing
**Location:** `99-execution-plan.md` tasks 2.2.7/2.3.2 vs 5.1.2; `07-testing-strategy.md` ST-24b placement + the file map row "param-typing.spec.test.ts | ST-6..24b"
**Codebase Evidence:** `packages/frontend/src/semantics/aggregate-typing.spec.test.ts:86` (ST-32: `byte[300]` → ICE expected) and `:193-204` (ST-44: aggregate params → ICE expected); `packages/test-harness/src/slice7-negatives.spec.test.ts:117` (params → E9\*) **and** `~:170` (`byte[300]` → E9\*). Tasks 2.2.3/2.2.4 retire both rejections, so all four rows go red exactly when task 2.2.7 asserts "7a suites … still green". Separately, ST-24b expects a *lowering* ICE with precise wording that lands at task 4.2.2 — at Phase 2, `emitIl` on `f(enemies[i])` falls into 7a's `lowerUserCall` with an aggregate-typed arg (undefined behavior, certainly not the specified wording).
**The Problem:** Under the immutable-oracle rule the executing agent may not touch failing spec tests ad-hoc; the plan invokes the retired-row protocol only at Phase 5 — three phases late — and the user's per-phase commit mode would sit on a red canonical verify at two phase boundaries.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Move ST-24b into the Phase-4 lowering suite (it is ST-63's shape; fix the 07 file map accordingly) and add an explicit Phase-2 task applying the documented retired-row protocol, enumerating the pins by **running the suites** (at least the four rows above) | Green gates stay honest; protocol-sanctioned retirement (exact 7a/RD-07b precedent); no oracle-rule violation | Small renumbering ripple in 07 |
| B | Keep ST-24b in Phase 2 marked expected-red until Phase 4; handle the pins ad-hoc when they fail | Doc locality preserved | Institutionalizes a red canonical verify across Phases 2–3; contradicts the plan's own standing constraints; ad-hoc pin handling invites oracle-rule violations |

**Recommendation:** Option A — the only shape compatible with the immutable-oracle rule and the per-phase commit+push mode.
`Confidence: High` · `Challenger: converged` (broadened the pin set from 3 to 4 rows and added the run-the-suites enumeration)

**User Decision:** Resolved — user accepted the recommendation (2026-07-12)

---

### PF-005: ST-47 contradicts 03-04 §6 — indexed compound-assign through a pair is both "scratch-add path" and "loud ICE" 🟠 MAJOR

**Dimension:** 3 — Logical Contradictions
**Location:** `07-testing-strategy.md` ST-47 ("word-index compound assign through pair → scratch-add path") vs `03-04-lowering-indirect.md` §6 ("indexed compound-assign through a pair → same loud ICE as 7a's direct case")
**Codebase Evidence:** The 7a deferral is real code: `lower.ts:~1319-1323` ICEs "compound assignment through a runtime index" when `place.index !== null`. Implementing the pair case while the strictly-easier direct case stays deferred would be backwards; RMW through a formed pointer needs the read and write to share one formed scratch pointer + Y state — genuinely new surface no AR row scoped.
**The Problem:** An executor reaches Phase 4 with a spec-test row and a design doc demanding opposite behaviors; the oracle rule forbids resolving it unilaterally. (The fixture is unaffected — `total += data[i]` has a scalar *target*.)

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Reword ST-47's compound clause to expect the loud ICE (same class as the 7a direct deferral); keep its offset>255 clause, amended per PF-003 | Consistent with AR-3's deferral posture and 7a precedent; zero scope change | `scores[i] += 1` through a pair ICEs until the deferral clears |
| B | Implement indexed compound-assign through pairs in 7b | Feature-complete for that shape | Scope growth via a testing-strategy row rather than an AR decision; asymmetric (direct case would remain deferred) |

**Recommendation:** Option A — a testing row cannot smuggle in scope against the design doc; loud-never-silent is preserved at zero cost.
`Confidence: High` · `Challenger: converged`

**User Decision:** Resolved — user accepted the recommendation (2026-07-12)

---

### PF-006: Scalar compound-assign through a pair base is unspecified — the 7a default silently corrupts the pointer 🟠 MAJOR

**Dimension:** 4 — Completeness Gaps
**Location:** `03-04-lowering-indirect.md` §4/§6 (covers indexed compound only; non-indexed compound through a pair unmentioned); `07-testing-strategy.md` (no ST row — ST-13/14 cover const params only)
**Codebase Evidence:** `lower.ts:1319-1327` — the 7a compound branch rewrites the place as `loc(place.symbol, elemIl, constOffset)`. With a pair base, `place`'s symbol is the **ZP pointer pair**, so `e.hp += 1` on a *mutable* by-ref param would read-modify-write the pointer's own bytes, not the pointee — silent corruption of ordinary code (the headline FN-3 use case).
**The Problem:** The `Place.base` reshape forces the implementer to touch this line, but the plan doesn't say what to do — a naive `place.base.symbol` substitution preserves the bug. This violates the plan's own loud-never-silent standing constraint.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Specify support: pair-base non-indexed compound lowers as `load_indirect` → ALU → `store_indirect` at the same const offset (no runtime index involved — all ops already planned); add an ST row | `e.hp += 1` — utterly ordinary by-ref code — works; zero new translate surface | A few lines of lowering + one ST row |
| B | Loud ICE for pair-base compound (defer with the indexed class) | Minimal scope | Makes the headline by-ref mutation surface feel broken for common code; the expanded form `e.hp = e.hp + 1` would work while `e.hp += 1` ICEs — surprising asymmetry |

**Recommendation:** Option A — the ops all exist in the same phase and the asymmetry of B is user-hostile for the slice's core use case.
`Confidence: High` · `Challenger: originated this finding; recommendation reconciled in-context`

**User Decision:** Resolved — user accepted the recommendation (2026-07-12)

---

### PF-007: Byte-index scaling silently overflows on unsized params with multi-byte elements 🟠 MAJOR

**Dimension:** 9 — Edge Cases
**Location:** `03-04-lowering-indirect.md` §4 ("pair, byte index … 7a `scaleIndex` reused"); `00-ambiguity-register.md` AR-5 (byte AND word indexes legal on all unsized params)
**Codebase Evidence:** 7a's `scaleIndex` (`lower.ts:1441`) is byte-domain (ASL / `__rt_mul8` — mod-256 arithmetic). It was safe in 7a only because the ≤256-byte total cap bounded scaled offsets to ≤254. Unsized params sever that bound: for `function f(d: word[])` bound to a `word[129]`+ array, the **in-bounds** byte index `i = 128` scales to `128*2 = 256 → 0` in 8 bits — silent aliasing of element 0.
**The Problem:** AR-5 legalizes byte indexes on all unsized params and 03-02's contextual hint actively steers users toward them; the planned lowering reuses the 8-bit scaler for exactly the case where its precondition no longer holds.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | The byte-index fast path through a pair is legal only when `elemSize === 1`; multi-byte elements route byte indexes through zext → the §5 word formation (existing Slice-6 ops); add an ST row (`word[]` param, byte index ≥128, correct element addressed) | Closes the silent-wrap class; no new ops; byte[] params (the common case, incl. the fixture) keep the fast path | Multi-byte-element unsized access costs the formation sequence |
| B | Restrict unsized params to byte elements in 7b (reject `word[]` etc.) | Simplest | Invents a restriction the spec doesn't state; AR-5 explicitly covered all element types |

**Recommendation:** Option A — width-aware routing with existing ops; B contradicts the resolved AR-5.
`Confidence: High` · `Challenger: originated this finding; recommendation reconciled in-context`

**User Decision:** Resolved — user accepted the recommendation (2026-07-12)

---

## MINOR findings

### PF-008: 03-02 asserts two frontend mechanisms that don't exist as described 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (stale assumptions)
**Location:** `03-02-param-semantics.md` §Symbols ("the 7a annotation-resolution.ts finalizer already patches param symbols in place") and §Intrinsic queries ("`length(sizedParam)` folds … through the existing engine folder")
**Codebase Evidence:** (a) `annotation-resolution.ts:149-150` — `finalizeSymbol` returns early for every kind except `variable`/`constant`; it never patches parameters. (b) `const-type-engine.ts:397-407` — `lengthOf` requires a var/const **declaration** with a sized array annotation; parameter symbols (whose declaration shape is `ParameterNode.paramType`) need a new arm.
**The Problem:** Both are small extensions, but the plan presents them as already-working, which misleads Phase-2 sizing and violates its own recon accuracy.
**Recommendation (single viable path):** correct 03-02 to name the two extensions explicitly (extend `finalizeSymbol`'s kind gate to parameters; add a parameter arm to `lengthOf`). Rejected alternative: leaving discovery to the executor — that is exactly the drift preflight exists to remove.

**User Decision:** Resolved — user accepted the recommendation (2026-07-12)

---

### PF-009: The word-op translate discipline constraining the §5 formation sequence is unstated 🟡 MINOR

**Dimension:** 6 — Feasibility Concerns
**Location:** `03-04-lowering-indirect.md` §5 ("Every op exists today")
**Codebase Evidence:** `translate.ts:575-590` — a word `add` result is never register-resident; it requires `foldStoreHome` (single-use dest + the **immediately following** instruction being the consuming `store` to a location) else the add ICEs "word arithmetic result not consumed by a store" (`:578`). Word operands must be locations/immediates, not free word-load temps.
**The Problem:** The claim is true only in the fused shape; a lowering implementation that interleaves any instruction between the add and the store, or reuses `t_eff`, ICEs at translate time with a confusing error.
**Recommendation (single viable path):** document the exact flat IL shape in §5 (add's operands as `loc`/`imm`; single-use `t_eff`; store immediately adjacent) as a stated invariant + an impl-test row. Rejected alternative: relaxing the translate discipline — out of scope and unnecessary.

**User Decision:** Resolved — user accepted the recommendation (2026-07-12)

---

### PF-010: The "existing Y-touching emitters" audit premise is false — there are none 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (stale assumption)
**Location:** `03-05-translate-indirect.md` §regY ("the existing emitters that use Y today (per-byte struct-copy unrolls, fill loops) must clear the mirror"); `99-execution-plan.md` task 5.2.1
**Codebase Evidence:** grep across `translate.ts`/`lower.ts`: **zero** LDY/INY/DEY/TAY/`,Y` emission sites (the only `,Y` is a comment at `translate.ts:374`). 7a struct copies and fills are per-byte Absolute load/store pairs (`lower.ts:1529-1541`). The binder's `y` register state exists but is only ever set to `null` (`register-binding.ts:137,222,228`); its `TYA` path (`:191`) is dead.
**The Problem:** The challenger-obligation text justifies the regY-invalidation audit with emitters that don't exist. The discipline itself remains necessary — but for the **new 7b sequences only**.
**Recommendation (single viable path):** correct the 03-05 text and re-scope task 5.2.1 to "establish the invalidation rule for every NEW Y-touching sequence 7b introduces (+ one confirming sweep that no pre-existing emitter touches Y)". Rejected alternative: dropping the audit — the confirming sweep is nearly free and future-proofs the rule.

**User Decision:** Resolved — user accepted the recommendation (2026-07-12)

---

### PF-011: W10143's denominator is ambiguous (two available RAM figures differ ~2×) and the absent-profile case is undefined 🟡 MINOR

**Dimension:** 1 — Ambiguities
**Location:** `03-02-param-semantics.md` (W10143 "≥ 25% of the platform RAM region"); `00-ambiguity-register.md` AR-11
**Codebase Evidence:** The seam exists and is already threaded: `AnalyzeInput.targetProfile?: PlatformProfile` from `@blend65/core/platform` (`analyze.ts:42,75`) carries `ramStart` (`:65`), `ramEnd` (`:67`), `maxRam` (`:79`). But on c64, `maxRam` = 26623 while `ramEnd−ramStart+1` = 51199 — the 25% thresholds differ by ~2× (6656 vs 12800 bytes). `targetProfile` is optional (availability checks skip when absent — `intrinsic-validation.ts:144`).
**The Problem:** ST-24a needs ONE number; the plan never names which figure, nor what W10143 does when no profile is supplied (the frontend-only `compile()`/LSP path).
**Recommendation (single viable path):** pin the denominator to `maxRam` (the profile's own usable-RAM budget figure — the same quantity the "consider total RAM budget" remedy refers to) and skip W10143 when `targetProfile` is absent (the established availability-check precedent). Rejected alternative: `ramEnd−ramStart+1` — a raw address span that overstates the usable budget.

**User Decision:** Resolved — user accepted the recommendation (2026-07-12)

---

### PF-012: Word-domain index scaling for word-element tier-2 arrays is hand-waved and untested 🟡 MINOR

**Dimension:** 4 — Completeness Gaps
**Location:** `03-04-lowering-indirect.md` §5 ("(7a `scaleIndex`, word-width here) already applied"); `07-testing-strategy.md` (ST-19 covers typing only)
**Codebase Evidence:** `scaleIndex` (`lower.ts:1441`) is byte-domain. A `word[129]`+ array (258+ bytes, tier-2, word index mandatory) needs the index scaled ×2 in the **word** domain before formation — Slice-6 word shifts suffice as ops, but no mechanism is specified and no ST row covers word-element tier-2 lowering.
**The Problem:** "already applied" overstates; the executor must invent the word-domain scaling shape mid-phase.
**Recommendation (single viable path):** make the word-domain scaling explicit in §5 (zext → word shl for pow-2 element sizes; state the non-pow-2 story or exclude it — element sizes are 1/2 today) + one ST row (`word[130]`, runtime word index, correct element). Rejected alternative: none viable — the case is legal per typing, so lowering must handle it.

**User Decision:** Resolved — user accepted the recommendation (2026-07-12)

---

## OBSERVATION findings

### PF-013: Citation-drift bundle (five small inaccuracies, none load-bearing) 🔵 OBSERVATION

**Dimension:** 12 — Consistency
**Location/Evidence:**
1. `00-ambiguity-register.md` grounding: `il/operand.ts:22-29` → actually `:22-30`.
2. AR-7 cites "Ch 07 §5.6's 16-bit-calculation note" → the note is the end of **§5.5** (`spec/07-structs.md:371`); §5.6 says offsets are compile-time.
3. `00-index.md` "slice map row 7 'pointer surface'" → RD-18's row 7 is titled "Aggregates"; the "pointer surface" label lives in 7a's AR-1.
4. `03-05` ST-52/addr-arm wording "`STA ZeroPage zpSlot(...)`" → `zpSlot` carries no offset (`instr-model/operand.ts:40`); the real mechanism for `+1` is `symbolRef` Absolute+offset (`translate.ts:1650-1662` `symAt`), as existing word stores do. ST-52's expected text should match that emission shape.
5. "All eight prior goldens" → a ninth (`gate.asm.golden`) lives in the same dir and must equally stay byte-exact (CI covers it regardless).

**Recommendation:** fix all five in place when applying fixes (pure text corrections).

**User Decision:** Resolved — user accepted the recommendation (2026-07-12)

---

### PF-014: ST numbering gap — ST-40..44 don't exist while the 07 file map says "ST-34..47" 🔵 OBSERVATION

**Dimension:** 7 — Testability (traceability)
**Location:** `07-testing-strategy.md` lowering table (jumps ST-39 → ST-45) and the file map row `lower-indirect.spec.test.ts | ST-34..47`
**The Problem:** Cosmetic, but the file map implies rows that don't exist; PF-004's ST-24b move and PF-006/PF-007/PF-012's new rows offer a natural renumbering moment.
**Recommendation:** close the gap (or annotate it as reserved) while applying the other 07 edits.

**User Decision:** Resolved — user accepted the recommendation (2026-07-12)

---

### PF-015: A dormant per-platform `warnArraySize` field overlaps the W10142/W10143 surface 🔵 OBSERVATION

**Dimension:** 13 — Codebase Alignment (dormant-capability awareness)
**Location:** `03-02-param-semantics.md` (W10142 keyed to the fixed 256-byte tier boundary; W10143 to 25% of RAM)
**Codebase Evidence:** `core/src/platform/platform-profile.ts:113` — `warnArraySize?: number` ("Array size (bytes) above which the compiler warns"), set to 256 on c64 (`c64.ts`). No consumer exists.
**The Problem:** Not a defect — W10142's trigger is semantically the tier boundary (fixed 256), and AR-11 already rejected firing W10143 per-tier-2-array. But shipping 7b leaves the field permanently dead unless a consumer or a removal decision is recorded.
**Recommendation:** note in 03-02 that W10142 deliberately keys on the tier boundary, and record `warnArraySize` as either the W10142 threshold source (platform-tunable, defaulting to 256) or a candidate for removal in a later cleanup — a one-line decision, no code required now.

**User Decision:** Resolved — user accepted the recommendation (2026-07-12)

---

## Adversarial-question checklist (same-model safeguard)

- *"What assumption from creation might I be unconsciously confirming?"* — The AR-2 calling convention (frame+pair+prologue) was re-derived from the spec quotes at source (FN-3 `:134`, Ch 11 §3.3/§4.2) rather than trusted; the recorded cost-drift counter-argument was independently re-verified (Ch 07 §5.3 `:334`, Ch 08 §11 `:663`). No new contradiction found beyond what AR-2 already records.
- *"What external standard might this violate?"* — The frozen spec was cited directly throughout; the two spec-✅ unsized-inference examples (PF-002) are the one place the plan contradicts spec text, now surfaced.
- *"What would a disagreeing domain expert flag?"* — A 6502 expert flags Y-wrap arithmetic (PF-003) and mod-256 scaling (PF-007) — both found; both challenger-corroborated.
