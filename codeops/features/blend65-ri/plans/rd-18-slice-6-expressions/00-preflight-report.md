# Preflight Report: RD-18 Slice 6 — Full Expressions & Mixed Width

> **Status**: ✅ PREFLIGHT PASSED — all 13 findings resolved (1 critical, 3 major, 6 minor, 3 observations; user accepted every recommendation, fixes applied 2026-07-11 16:26)
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/blend65-ri/plans/rd-18-slice-6-expressions/` (11 documents)
> **Codebase Grounded**: 20+ source files examined (lead + 3 explore agents), 60+ references verified
> **Ambiguity Register**: Found — 14 items resolved (AR-1…AR-14); all respected, none re-litigated
> **Last Updated**: 2026-07-11
> **CodeOps Skills Version**: 3.3.1

> ⚠️ **Same-model note**: the plan was authored earlier today (2026-07-11) by the same model
> family in a separate session. Not a same-session review, but same-model bias risk exists.
> Mitigations applied: all spec-conformance checks cite actual `spec/` text (not memory); a
> single independent challenger agent adversarially reviewed the whole CRITICAL/MAJOR batch
> before recommendations were recorded.

## Codebase Context Summary

**Repository:** blend65 (TypeScript ESM monorepo, Yarn v1 + Turbo, 10 `@blend65/*` packages)
**Tech Stack:** TS strict/NodeNext, Vitest, ESLint v9; ACME + VICE 3.10 for the local acceptance tier
**Architecture:** AOT 6502 compiler pipeline — Lexer → Parser → Analyzer (Pass 1/3/4) → SFA → IL lowering → IL→Instr translate → ACME serialize → PRG; R15 boundary (frontend/LSP never import codegen)
**Key Files Examined:** `frontend/semantics/type-check/expression-typing.ts`, `statement-typing.ts`, `frontend/semantics/const-eval.ts`, `core/semantics/type-utils.ts`, `core/sfa/function-info.ts`, `core/diagnostics/diagnostic-codes.ts`, `core/intrinsics/catalog.ts`, `frontend/sfa/model-adapter.ts`, `codegen/il/lower.ts`, `codegen/il/il-type.ts`, `codegen/il/instruction.ts`, `codegen/instr/translate.ts`, `frontend/parser/pratt.ts`, `frontend/lexer/lexer.ts`, `test-harness/src/*` (slice5b suites, golden.ts, fixture), `spec/01/02/04/grammar/12/14`, RD-18, the RD-04 deferred ledger

**Reference verification highlights (all VERIFIED unless noted):**
- Every line-level claim in `02-current-state.md` is exact: `ARITHMETIC_OPS` :53, silent-poison :145, default-arm :101–104, adaptation :149–155, `isAssignableTo` :164 / `commonType` :188, const-eval :134/151 lines, `BINARY_OP_TO_IL` :85, default ICE :667, comparison `IL_BYTE` stamp :902, `lowerAssign` :915, shift ICE :588, unsigned comparison :742, W10170/71 :832/:856 (one drift: `translateDivMod` is at :842, cited "~755 region").
- `pokew`/`peekw` exist end-to-end (catalog + `lower.ts:1058–1113`); boolean is fully supported (erases to `IL_BYTE`, `il-type.ts:75–77`); `true`/`false` literals lex/parse/type.
- `evaluateModuleConsts` **types initializers before folding** (`statement-typing.ts:205` → `:266`) — the AR-7 "lookup is populated" premise holds.
- Goldens at `packages/test-harness/test/golden/`; `UPDATE_GOLDEN=1` flow real (`golden.ts:19–23`); frame symbols `__frame_<fq dots→_>_<var>` (`lower.ts:1167–1169`); no `__init` FunctionInfo exists today (pseudo-entry is genuinely new); builders inline sources into a temp dir (example dirs are canonical copies).
- Spec: TS-1…TS-21 present; §5.2 permits signed relationals; §6 short-circuit is a stated language guarantee; §7.2 rule 4 confirmed; FR-40/`as` cast drift confirmed exactly as AR-14 recorded; E10087/E10088 free everywhere; AR-10's "taken" premises verified (E10083=`ShiftAmountOutOfRange`, E10154=`WidthNarrowingNoCast`, E10161=`MissingFieldInInit`, E10162=`ExtraFieldInInit`).
- Fixture arithmetic hand-recomputed: `$C000..$C008 = E7 04 DA 05 07 00 01 44 00` ✓; the 03-04 sext/neg/signed-shr instruction sequences trace correct.

## Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 1 (PF-009) | 🟡 |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 1 (PF-004) | 🟠 |
| 4 | Completeness Gaps | 2 (PF-006, PF-012) | 🟡 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 0 | — |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 1 (PF-005) | 🟡 |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 1 (PF-003) | 🟠 |
| 12 | Consistency | 4 (PF-007, PF-010, PF-011, PF-013) | 🟡 |
| 13 | Codebase Alignment | 3 (PF-001, PF-002, PF-008) | 🔴 |

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 1 | all resolved (fix applied) |
| 🟠 MAJOR | 3 | all resolved (fixes applied) |
| 🟡 MINOR | 6 | all resolved (fixes applied) |
| 🔵 OBSERVATION | 3 | all resolved (fixes applied) |

---

## Findings

### PF-001: DEF-1 word-compare fix misses 2 of 3 comparison-emission sites — the plan's own repro stays miscompiled 🔴 CRITICAL

**Dimension:** 13 — Codebase Alignment (Impact Blindness)
**Location:** `03-03-lowering.md` §3 ("Binary lowering changes (`lowerBinary`)"); `99-execution-plan.md` task 3.2.3; `02-current-state.md` Gap 1
**Codebase Evidence:** `packages/codegen/src/il/lower.ts:583` (`compareCounter`, the for-loop Pattern-A predicate — emits `le`/`ge` with hardcoded `type: IL_BYTE` while `counterType` is in scope) and `lower.ts:513–517` (`lowerSwitch` dispatch `eq`, hardcoded `type: IL_BYTE`). `typeFor` accepts any integer counter (`statement-typing.ts:606–627`) and `typeSwitch` accepts `word`/`sword` discriminants (`:383–402`), so both paths legally carry 16-bit operands today. While/do-while conditions route through `lowerExpr → lowerBinary` (`lower.ts:388,418`) and ARE covered.
**The Problem:** The comparison operand-type stamping (AR-9, "closes DEF-1/AR-5") is specified only for `lowerBinary` (`lower.ts:902`). The plan's motivating repro — "a `word` for-loop counter bound compiles silently wrong today" (02 Gap 1) — flows through `compareCounter`, not `lowerBinary`. After the slice as written, word for-loops and word/sword switch discriminants **still silently compare low bytes only**, while DEF-1 is recorded closed. No planned test catches it: the DEF-1 witness is hand-built IL at the translate tier, ST-23 maps naturally to a while-condition, and the acceptance fixture contains no for-loop or switch.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Extend 03-03 §3 + task 3.2.3 to stamp the operand type at all three sites (`counterType` at :583; the discriminant's IL type at :517), plus ST/impl coverage for a word for-loop and a word switch discriminant | Actually closes DEF-1; byte counters/discriminants keep `IL_BYTE` so all prior goldens stay byte-exact (plan-local AC-1 safe); ~2-line lowering change per site | Slightly larger ST surface in Phases 3–4 |
| B | Fix only `lowerBinary` in Slice 6; log the two remaining sites as a new tracked DEF row for a follow-up | Zero plan churn | Knowingly ships two silent miscompiles under a "DEF-1 closed" banner — contradicts the project's never-miscompile invariant and AR-5's intent |

**Recommendation:** Option A — the whole point of AR-5 was "never ship silently wrong"; the fix is mechanical and golden-safe (byte operands produce identical IL). An `sbyte` counter additionally flips from wrong-unsigned to correct-signed framing — also a fix, and no existing golden exercises it.
**Confidence:** High. **Hardening:** independent challenger reviewed with full code access — verdict UPHOLD at CRITICAL, endorses Option A, calls Option B "not acceptable".
**User Decision:** Resolved — User accepted recommendation; fix applied to the plan docs (2026-07-11 16:26)

---

### PF-002: AR-3 supersession task misses the core-package widening pins 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (Test Impact)
**Location:** `99-execution-plan.md` task 1.2.6 (file glob `packages/frontend/src/semantics/*.spec.test.ts`, "audit via grep for E10171/E10154 widening pins"); standing-constraints block (lines 48–55)
**Codebase Evidence:** `packages/core/src/semantics/type-utils.spec.test.ts:89` — `expect(isAssignableTo(primitive("byte"), primitive("word"))).toBe(false)` — and `:107` — `expect(commonType(primitive("byte"), primitive("word"))).toBeNull()` — are the **only** spec assertions pinning same-sign-widening rejection. The surviving frontend pins (statement-typing :72–83, return-completion :41, call-typing :70, intrinsic-validation :82/:107) are narrowing/cross-sign/mismatch cases that all remain valid post-AR-3.
**The Problem:** Task 1.2.2 changes `commonType`/`isAssignableTo` in core, flipping both core assertions red. Task 1.2.6's glob is frontend-only, and the assertions contain no E-codes for the grep to hit — so the Phase-1 verify gate goes red with spec-test failures the plan never accounts for, and the standing "nothing else in any prior spec test may change" rule gives an executor no explicit authorization trail for them.

**Single viable resolution** (considered and dropped: leaving it to executor judgment — that is exactly the ambush the supersession exception exists to prevent): broaden task 1.2.6 to explicitly include `packages/core/src/semantics/type-utils.spec.test.ts:89/:107` (or `packages/core/**/*.spec.test.ts` + a value-assertion grep for `toBe(false)`/`toBeNull()` on `isAssignableTo`/`commonType`), with the same per-assertion justification requirement.

**Recommendation:** Apply the broadened scope to task 1.2.6 (and mention it in 03-01 §Integration Points).
**Confidence:** High. **Hardening:** challenger verdict UPHOLD at MAJOR, with the amendment that this is an "unaccounted-for Phase-gate red", not a hard block (the AR-3 exception conceptually authorizes the fix) — amendment adopted above.
**User Decision:** Resolved — User accepted recommendation; fix applied to the plan docs (2026-07-11 16:26)

---

### PF-003: Phase-1 GREEN gate requires Phase-2 machinery (ST-17, ST-18's W10101 case) 🟠 MAJOR

**Dimension:** 11 — Ordering & Sequencing
**Location:** `99-execution-plan.md` tasks 1.1.2, 1.2.7, 1.2.8, 1.2.9 vs tasks 2.2.1–2.2.3; `07-testing-strategy.md` ST-17/ST-18
**Codebase Evidence:** the current evaluator cannot fold casts at all (`const-eval.ts:134` default `nonConst`; verified). ST-17's W10161 requires detecting that `<byte>(200) + <byte>(100)` wraps to 44 at byte width — that detection **is** the Phase-2 width fold (`toBits`/`fromBits` + cast folds, task 2.2.1; task 2.2.3 says the "W10161/W10101 hooks consume the width folds").
**The Problem:** ST-17 and ST-18's W10101 sub-case are authored in Phase 1 (1.1.2) and required green at 1.2.9 ("ST-1…ST-18 pass") before the Phase-1 full-verify gate — but they cannot pass until Phase 2 lands. A strict executor is blocked at 1.2.9. Secondary inconsistency: task 1.2.8 claims the "cast-truncation fold" for W10101 in Phase 1 while 2.2.3 assigns the fold consumption to Phase 2 — the plan is inconsistent about which phase owns it. (ST-16/W10160 and ST-18's W10174 half are genuinely Phase-1-able — no folds needed.)

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Move ST-17 + ST-18's W10101 sub-case into the Phase-2 spec file (`const-eval-widths.spec.test.ts`, task 2.1.1) and Phase-2 GREEN gate (2.2.4); trim 1.2.9 to ST-1…ST-16 + ST-18's W10174 case; align 1.2.8/2.2.3 wording | Clean phase gates; tests live next to the machinery they pin; minimal edits | ST numbering prose in 07 needs a small touch-up |
| B | Pull `toBits`/`fromBits` + cast folds forward into Phase 1 | Keeps ST set intact | Smears Phase 2's core deliverable across two phases; enlarges the already-largest phase (14 tasks) |

**Recommendation:** Option A — it matches the plan's own dependency diagram (Phase 1 → Phase 2) instead of fighting it.
**Confidence:** High. **Hardening:** challenger verdict UPHOLD at MAJOR; independently confirmed the W10174 half stays Phase-1-able and surfaced the 1.2.8/2.2.3 ownership inconsistency.
**User Decision:** Resolved — User accepted recommendation; fix applied to the plan docs (2026-07-11 16:26)

---

### PF-004: `hi()` lowering (word `shr` → `trunc`) contradicts 03-04's own word-fold ICE rule — ST-27 would go red 🟠 MAJOR

**Dimension:** 3 — Logical Contradictions (cross-document)
**Location:** `03-03-lowering.md` §9 vs `03-04-translate.md` §Error Handling row 1 ("Word unary/shift result not consumed by a store → existing word-fold ICE") and §4 (word shifts "through the store-fold home"); `07-testing-strategy.md` ST-27 ("no E10045, no ICE")
**Codebase Evidence:** `translate.ts:720–740` — `foldStoreHome` returns a home **only** when the immediately-following instruction is a `store` to a `Location`; the word ALU paths ICE otherwise (`:531–534`, `:565–567`). Additionally `sourceHome` (`:702–713`) yields a readable home only for locations/deferred-load temps — a word-ALU result temp has neither, so the follow-on `trunc` could not read the `shr` output even if the ICE were bypassed.
**The Problem:** 03-03 §9 lowers non-const `hi(x)` as a word `shr` by 8 consumed by a `trunc`. Per 03-04's stated rules and the actual fold machinery, that word `shr` hits the "not consumed by a store" ICE — directly contradicting ST-27's "no ICE" expectation. `lo(x)` is unaffected (its `trunc` reads the memory-resident operand directly).

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Respecify `hi(x)` as a **direct high-byte read**: translate the shape as a byte read of `symAt(home, 1)` of the memory-resident word operand (the high byte of a two's-complement word IS the sign-carrying high byte, so the signed-`shr` rationale is unnecessary); pin `hi(<computed word expr>)` as the existing loud ICE for this slice | Zero new fold machinery; 1 instruction (`LDA home+1`); disposes of the signed-shr complexity; ST-27 (ident args) fully covered | `hi()` of a *computed* word stays unsupported (loud ICE) until a later slice — must be documented |
| B | Keep the `shr`+`trunc` IL and extend translate: give a non-store-consumed word shift a scratch home (binder ZP pair) and teach `trunc` to read it | Fully general (`hi(a+b)` works) | New machinery in the exact area the plan says needs "no new architecture"; more emitted code per `hi()`; touches the deferred-load invariants |

**Recommendation:** Option A — cheaper, correct for signed and unsigned, and consistent with the slice's conservative never-miscompile posture; generalize in a later slice if `hi(computed)` is ever needed. Update 03-03 §9, 03-04 (drop the hi-shr rows), and ST-27's expected IL shape accordingly.
**Confidence:** High. **Hardening:** challenger verdict UPHOLD at MAJOR (not CRITICAL — fails loud, not silent); independently confirmed the `trunc`-source-homeless second blocker and prefers Option A.
**User Decision:** Resolved — User accepted recommendation; fix applied to the plan docs (2026-07-11 16:26)

---

### PF-005: Synthetic-slot guard is name-only — the "can never miscompile" claim is not strictly guaranteed 🟡 MINOR

**Dimension:** 9 — Edge Cases
**Location:** `03-03-lowering.md` §1 (Lowering contract: "the slot name must exist in ctx.frame … a counting bug can never miscompile"); `02-current-state.md` risk table row 1
**Codebase Evidence:** slots are size-heterogeneous — `&&`/`||` sites are 1-byte boolean, ternary sites can be 2-byte word (03-03 §1); `FrameVar` sizing flows from `type` (`core/sfa/function-info.ts:26–33`). A hypothetical same-count order swap between the adapter walk and the lowering claim order would pass the name-existence check while storing a word into a byte slot (neighbor clobber) — silent.
**The Problem:** The guard catches count drift loudly but cannot see a same-count order swap with mixed sizes, so the absolute "never miscompiles" claim is overstated. This is defense-in-depth against future drift (the specified identical preorder produces no divergence today), hence MINOR — but the claim is load-bearing language in a project whose top invariant is never-miscompile.

**Single viable resolution** (considered and dropped: proving walk identity by construction via a shared cross-package walker — heavier, and the frontend/codegen boundary makes it awkward): at claim time, additionally assert `byteSize(frame slot's type) === byteSize(site's result type)`; ICE on mismatch. One extra comparison per site; makes the guarantee real.

**Recommendation:** Add the size-parity assertion to 03-03 §1's lowering contract (and to the 3.3.1 impl-test list); soften the two "never miscompiles" sentences to cite both checks.
**Hardening:** challenger verdict DOWNGRADE (MAJOR → MINOR), endorsing exactly this assert — adopted.
**User Decision:** Resolved — User accepted recommendation; fix applied to the plan docs (2026-07-11 16:26)

---

### PF-006: Switch discriminants containing `&&`/`||`/ternary hit a guaranteed (loud) slot-miss ICE — undocumented 🟡 MINOR

**Dimension:** 4 — Completeness Gaps
**Location:** `03-03-lowering.md` §1 (collection counts each site once) vs `packages/codegen/src/il/lower.ts:507–517` (`lowerSwitch` re-lowers the discriminant fresh **per case value**)
**Codebase Evidence:** as cited — the re-lowering is deliberate (temps can't cross blocks). With Slice 6, a legal program like `switch (flag ? 1 : 2) { case 1: … case 2: … }` claims ≥2 slots for a site the adapter counted once; the claim counter overruns the allocated set and the name-miss ICE fires (verified arithmetic: overrun is guaranteed for ≥2 claims, so the failure is always loud, never silent).
**The Problem:** A legal spec shape compiles to a loud E90001 ICE and the plan never mentions it — an executor discovering it mid-Phase-3 has no guidance, and no negative test pins the behavior.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Document the shape as a known loud-ICE limitation in 03-03 §1 + add a negative/impl test witnessing the ICE; defer real support | Honest, cheap, never-miscompile-safe | The shape stays uncompilable this slice |
| B | Pre-materialize a slot-bearing discriminant once into its own synthetic slot before the dispatch chain | Shape actually works | New slot-accounting rules for switch; more design surface in an already-large slice |

**Recommendation:** Option A — the shape is obscure, the failure is loud, and Option B can ride a later slice if it ever matters.
**User Decision:** Resolved — User accepted recommendation; fix applied to the plan docs (2026-07-11 16:26)

---

### PF-007: `02-current-state.md` claims the new codes are "unassigned … against the registry AND all of `spec/`" — false for 5 of 8 🟡 MINOR

**Dimension:** 12 — Consistency (intra-plan contradiction)
**Location:** `02-current-state.md` §Diagnostics registry bullet
**Codebase Evidence:** `spec/02-type-system.md` §14 assigns **E10086** (boolean↔integer cast) and **W10101/W10160/W10161**; `spec/04-expressions-operators.md` §4/§11 assigns **W10174**. Only E10087/E10088 are free everywhere (verified). The registry side of the claim is correct (none of the seven are registered).
**The Problem:** The sentence contradicts AR-10a and 03-01's own "mint (spec-Ch-02-numbered)" rationale — the spec assigning those numbers is *why* they were chosen. A future reader auditing the mint against this sentence would conclude the plan's numbering is coincidental.

**Single viable resolution:** reword to "unregistered in the registry; E10086 + the four W-codes deliberately adopt the numbers `spec/` already assigns (AR-10); E10087/E10088 are free everywhere."

**Recommendation:** Apply the rewording.
**User Decision:** Resolved — User accepted recommendation; fix applied to the plan docs (2026-07-11 16:26)

---

### PF-008: Slot-collection snippet doesn't match `FrameVar`'s shape; poisoned-site slot type unspecified 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Stale Assumptions)
**Location:** `03-03-lowering.md` §1 Collection: `{ name: "0sc"+i, type: byteSize(model.typeOf(site)) }`
**Codebase Evidence:** `FrameVar` is `{ name: string; type: Type; byRef: boolean }` (`core/sfa/function-info.ts:26–33`) — `type` is a semantic `Type`, not a byte count; the planner sizes from `type` later. Also 03-03 says "Poisoned sites still get a slot", but a poisoned site's type is `ERROR_TYPE` → `byteSize` 0 → a zero-size frame slot.
**The Problem:** The snippet as written would not typecheck and misleads the executor about the adapter contract; the poisoned-site slot's type/size is unspecified (0-size slots are untested planner input).

**Single viable resolution:** correct the snippet to `{ name: "0sc"+i, type: model.typeOf(site), byRef: false }` and specify that a poisoned site's slot uses a 1-byte placeholder type (e.g. `primitive("byte")`) — the function is skipped by lowering anyway (`hasErrorNode`), so only the count/layout consistency matters.

**Recommendation:** Apply both corrections to 03-03 §1.
**User Decision:** Resolved — User accepted recommendation; fix applied to the plan docs (2026-07-11 16:26)

---

### PF-009: Context-type propagation through unary `~` is unspecified — observably different results 🟡 MINOR

**Dimension:** 1 — Ambiguities
**Location:** `03-01-typing-promotion.md` §3 (covers `-` via the negative-literal note; silent on `~`/`!`); `03-02-const-eval-widths.md` (the `~` fold is width-gated on the operand's type)
**Codebase Evidence:** today's literal adaptation comes only from the declared context or the *other* binary operand (`expression-typing.ts:114–119, 149–155`). Whether `typeUnary` passes `contextType` down decides `let x: word = ~1;`: operand-as-byte-default → `~1`@8 = 254 (then widened) vs operand-adapted-to-word → 65534. The const fold (03-02) and the lowering must agree with whichever rule is chosen.
**The Problem:** The plan specifies propagation for `-` (needed so `let x: sbyte = -42;` types) but says nothing for `~`, where the choice is observable in both folds and runtime results. Spec TS-9 ("expression type from operands, not the destination") argues for **no** propagation; the `-` case is then a special literal-shape rule, which should be stated as such.

**Single viable resolution:** state the rule in 03-01 §3 — `-`: a directly-nested numeric literal adapts to the context type (the TS-2 negative-literal shape); `~`: the operand types with **no** context (by-value default, per TS-9); `!`: n/a (boolean). Mirror one sentence in 03-02 so the fold uses the same operand type.

**Recommendation:** Apply — one paragraph, removes a silent divergence risk between const-eval and runtime (the plan's own risk-table row 5).
**User Decision:** Resolved — User accepted recommendation; fix applied to the plan docs (2026-07-11 16:26)

---

### PF-010: `lo`/`hi` boolean-argument diagnostic uses E10080 where the argument-mismatch family is E10171 🟡 MINOR

**Dimension:** 12 — Consistency
**Location:** `03-01-typing-promotion.md` §7 ("A `boolean` argument → E10080")
**Codebase Evidence:** every existing argument-type mismatch emits **E10171** `ArgTypeMismatch` — user calls (`expression-typing.ts:400–407`) and intrinsic literal-range checks (`intrinsic-validation.ts:167–176`). E10080 `InvalidOperandType` carries operator-shaped wording ("Operator 'X' cannot be applied…", `expression-typing.ts:179`), which reads oddly for a call argument.
**The Problem:** A minor diagnostic-surface inconsistency: the first intrinsic argument-type check would use a different code family than every other argument check, for no recorded reason (AR-10 doesn't cover this case).

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Use E10171 with the standard argument-mismatch wording | Consistent with both existing arg-check surfaces | None of note |
| B | Keep E10080 as planned | No plan edit | Message shape doesn't fit; splits the arg-mismatch family |

**Recommendation:** Option A.
**User Decision:** Resolved — User accepted recommendation; fix applied to the plan docs (2026-07-11 16:26)

---

### PF-011: Citation nits — TS-6 mischaracterized; "§5.1/§5.2" live in Ch 02, not Ch 04; one line-cite drift 🔵 OBSERVATION

**Dimension:** 12 — Consistency
**Location:** `03-01-typing-promotion.md` §2/§3 tables ("integers (TS-6)"); `00-index.md`/`01-requirements.md` ("full §5.1 matrix"); `02-current-state.md` ("translateDivMod … line ~755 region")
**Codebase Evidence:** TS-6 is titled "Boolean Is Not Numeric" (the prohibition, not the integer-operand rule — that's TS-3/Ch 04 §4); the §5.1/§5.2/§5.3 matrix lives in `spec/02-type-system.md` §5 (Ch 04 §5 is a flat "Comparison Operators" section); `translateDivMod` is at `translate.ts:842`.
**The Problem:** None functional — the cited *content* is real in every case; only the labels drift. Worth fixing while editing the docs for the findings above.
**Recommendation:** Fold the three corrections into whatever fix pass runs.
**User Decision:** Resolved — User accepted recommendation; fix applied to the plan docs (2026-07-11 16:26)

---

### PF-012: AR-9 changes the comparison `type` field's meaning; no task updates the doc comments that state the old meaning 🔵 OBSERVATION

**Dimension:** 4 — Completeness Gaps (doc hygiene)
**Location:** plan-wide (no owning task)
**Codebase Evidence:** `codegen/il/instruction.ts:27` ("Comparison opcodes — each produces an `IL_BYTE` 0/1 result") + `:98`; `codegen/il/lower.ts:104–105` (`COMPARISON_RESULT_OPS` comment). After AR-9, `type` on `eq/ne/lt/le/gt/ge` means the **operand** type.
**The Problem:** Task 4.2.4 refreshes translate's doc header but nothing owns these two files' comparison-shape comments; the doc standard requires comments to describe current behavior.
**Recommendation:** Fold a doc-comment touch into task 3.2.3's definition of done.
**User Decision:** Resolved — User accepted recommendation; fix applied to the plan docs (2026-07-11 16:26)

---

### PF-013: 03-04 claims "new ops use A + memory homes only," but its own §2/§4 use the X register 🔵 OBSERVATION

**Dimension:** 12 — Consistency (intra-document)
**Location:** `03-04-translate.md` §Integration Points vs §2 (`zext` non-store form: "load low into A, `LDX #$00`, bind pair") and §4 (variable-count shifts: "count byte into X … `DEX`/`BNE loop`")
**The Problem:** The integration sentence is internally inconsistent; harmless in itself, but the X-mirror bookkeeping (`regX`/`clearRegs` discipline) deserves one sentence so the executor doesn't skip it.
**Recommendation:** Reword to "A and X plus memory homes; X uses follow the existing mirror/clearRegs discipline; `register-binding.ts` itself unchanged."
**User Decision:** Resolved — User accepted recommendation; fix applied to the plan docs (2026-07-11 16:26)

---

## Adversarial self-check (same-agent bias)

- *Assumptions from creation unconsciously confirmed?* The fixture arithmetic and all 6502 sequences were re-derived by hand rather than trusted; the "identical preorder" slot premise was actively attacked (→ PF-005/PF-006).
- *External standards checked from text, not memory?* All spec-conformance claims cite `spec/` sections retrieved this session; AR-10's "taken number" premises were re-verified in the registry.
- *What would a disagreeing domain expert flag?* The strongest candidate — "the whole synthetic-slot design is overweight vs. branch-chaining" — is a settled register decision (AR-6/AR-8, single-viable-path + correctness-first) and was not re-litigated.

## Outcome

**✅ PREFLIGHT PASSED — all 13 findings resolved.** The user accepted every
recommendation and instructed the fixes be applied; all 13 were applied to the plan
documents on 2026-07-11 16:26 (`01-requirements.md`, `02-current-state.md`,
`03-01`…`03-04`, `07-testing-strategy.md`, `99-execution-plan.md`, `00-index.md`).
Fix highlights: comparison operand-type stamping now covers all three lowering
emission sites with ST-23 widened to match (PF-001); task 1.2.6 names the core
`type-utils.spec.test.ts` pins (PF-002); ST-17 + ST-18's W10101 case moved to the
Phase-2 spec set and gates (PF-003); `hi()` respecified as a direct high-byte read
with loud-ICE edges (PF-004); the slot guard gained the size-parity check and the
switch-discriminant limitation is documented with an ICE witness (PF-005/006);
wording/citation/doc-task corrections applied (PF-007…PF-013). Roadmap advanced to
**Plan Preflighted** per Step 8.
