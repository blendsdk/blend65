# Preflight Report: RD-18 Slice 7a — Aggregates (direct surface)

> **Status**: ✅ PREFLIGHT PASSED — all 13 findings resolved (0 critical, 5 major, 5 minor, 3 observation; every recommendation accepted 2026-07-11). **Fixes APPLIED to the plan documents 2026-07-11** (at exec_plan start, per the roadmap's "apply fixes → exec_plan" sequence). Two pins made during application, both recorded as register rows: AR-25 (PF-005 drift row) and AR-26 (PF-007 code pin — E10157 ExpressionStatementNotACall, free + band-adjacent; string initialisers → loud Slice-8 ICE mechanism).
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/blend65-ri/plans/rd-18-slice-7-aggregates/` (11 documents)
> **Codebase Grounded**: ~35 source files examined (3 parallel verification passes + lead-context registry/spec reads); ~55 references verified
> **Last Updated**: 2026-07-11
> **CodeOps Skills Version**: 3.3.1

> ⚠️ SAME-MODEL REVIEW: the artifact was authored earlier on 2026-07-11 by the same model in a
> **prior** session (fresh context for this review — the same-session risk does not apply, but
> same-model blind-spot risk does). Mitigations applied: every load-bearing claim re-verified at
> source by independent read-only agents; the frozen spec chapters were cited directly (never from
> memory); one independent challenger audited the full MAJOR batch blind to the reviewer's picks.

## Codebase Context Summary

**Artifact Type:** Implementation plan (8 phases / 64 tasks + 6 design docs + testing strategy + 24-row ambiguity register)
**Ambiguity Register:** Found — 24 items (23 marked resolved; AR-10 row inconsistency → PF-009)
**Scope:** Full scan, all 13 dimensions

**Repository:** blend65 — TypeScript (ESM/NodeNext, strict), Yarn-classic + Turbo monorepo, 10 `@blend65/*` packages, Node 22, Vitest. No new dependencies proposed (verified: plan needs none).
**Architecture:** AOT compiler pipeline Lexer → Pratt parser → semantic passes (`passes.ts`) → SFA → IL lowering (`lower.ts`) → 6502 translate (`translate.ts`) → ACME serialize. `spec/` is the frozen v3.0 baseline (D3).
**Key files examined:** `node-kind.ts`, `nodes.ts`, `pratt.ts`, `parse-decl.ts`, `parse-stmt.ts`, `parse-type.ts`, `declaration-collection.ts`, `passes.ts`, `type-resolution.ts`, `expression-typing.ts`, `statement-typing.ts`, `name-resolution.ts`, `import-resolution.ts`, `function-collection.ts`, `init-order.ts`, `intrinsic-validation.ts`, `const-eval.ts`, `const-value.ts`, `type.ts`, `type-utils.ts`, `symbol.ts`, `semantic-model.ts`, `model-adapter.ts`, `frame-computation.ts`, `instruction.ts`, `lower.ts`, `translate.ts`, `cfg.ts`, `operand.ts`, `stream.ts`, `serialize-acme.ts`, `instr-program.ts`, `print-instr.ts`, `addressing-mode.ts`, `catalog.ts`, `diagnostic-codes.ts`; spec chapters 02/05/07/08/09/12/14 + `grammar.ebnf.md`; the rd-04 deferred-semantics ledger.

**Key observations:**
- The plan's recon is largely accurate: the aggregate vocabulary (AST decls, semantic types, IL ops, addressing modes, const-data channel, intrinsic descriptors) exists exactly as described; all 13 new diagnostic codes are free; every reuse target exists; fixture arithmetic and enum values are correct; the slice6 harness pattern is real.
- The genuinely wrong claims cluster in two places: the **parser flag story for `const`** (PF-001) and the **translate state discipline** (prescan visibility, result homing, X-mirror truthfulness — PF-002/PF-004), plus one **warning-code misattribution** (PF-003) and one **frozen-spec self-contradiction** transcribed unresolved (PF-005).

**Reference verification:** ~55 file:line references mapped — ~46 verified, 7 with line/attribution drift (PF-010), 2 substantively wrong (PF-001, PF-002).

## Summary by Dimension

| # | Dimension | Findings | Highest severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 1 | 🔵 |
| 3 | Logical Contradictions | 0 | — |
| 4 | Completeness Gaps | 1 | 🟡 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 0 (folded into PF-003) | — |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 1 | 🟠 |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 2 | 🟡 |
| 13 | Codebase Alignment | 8 | 🟠 |

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 5 | all resolved — recommendations accepted |
| 🟡 MINOR | 5 | all resolved — recommendations accepted |
| 🔵 OBSERVATION | 3 | all resolved — recommendations accepted |

---

## MAJOR findings

> Hardening: the whole MAJOR batch was audited by ONE independent challenger (blind to the
> reviewer's picks, own source verification). **Challenger: converged on all five** — every
> verdict REAL at MAJOR, every recommendation matching, with extensions folded into PF-002 and
> PF-004 below. The advisor consult was unavailable this session (disclosed; challenger ran).

### PF-001: Const initialisers cannot parse aggregate literals — the plan claims they can 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (Stale Assumption)
**Location:** `03-01-parser-array-literals.md` §Architecture/Current + task 1.2.3 (`99-execution-plan.md`); AR-18 row (`00-ambiguity-register.md`)
**Codebase Evidence:** `parse-decl.ts:316` (`parseLetDecl` → `parseExpression(state, 0, true)`) vs `parse-decl.ts:355` (`parseConstDecl` → `parsePrimaryExpr` = flag **false**, `pratt.ts:209-210`)
**The Problem:** The plan states the aggregate-literal flag is "set `true` only at `parse-decl.ts:316` (let/const initialisers)". In reality only **`let`** passes true; `const` initialisers parse flag-false, so const struct literals are dead today and the plan's new `[` arm (gated on the same flag) would leave `const TABLE: byte[DIM + sizeof(Point)] = [10, 20, 30; 5];` — the fixture centerpiece, AC-2, and ST-22/23/24/25 — unparseable. No task among the 64 touches `parseConstDecl`, and Phase 1's parser ST rows (ST-1..6) are all `let` forms, so the gap surfaces only in Phase 3 as an unplanned red under the immutable-oracle regime. The frozen grammar mandates the fix (`grammar.ebnf.md:365` — `const_expression = expression`, whose primary includes aggregate literals).

**Resolution — single viable path** (letting Phase 3 discover it was considered and rejected: the plan text actively asserts the opposite of reality, and the runtime-ambiguity protocol turns a mid-phase surprise into a stop-the-line event): amend 03-01 (correct the current-state claim; add "enable the flag in `parseConstDecl`" to Proposed changes), widen task 1.2.3 to include `parse-decl.ts:355`, add const-form parser ST rows (const array literal + const struct literal), and annotate the AR-18 row's factual claim.

**Recommendation:** Apply the amendment. Confidence: High. Challenger: converged (very high confidence; grammar-mandated).
**User Decision:** Resolved — User accepted recommendation (2026-07-11, bulk: "all per recommendation")

### PF-002: Translate prescan is NOT ready for the load variants, and the byte-load framing leaves its result un-homed 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (Stale Assumption + Impact Blindness)
**Location:** `03-06-translate-data.md` §1 ("The prescan plumbing already enumerates these ops"; the byte `load_indexed` framing "bind A as the dest temp")
**Codebase Evidence:** `instruction.ts:114-120` (`load_indexed` carries `value`, not `dest`); `translate.ts:1438-1453` (`destTempId` cases only the **store** variants; loads fall to `"dest" in ins` → `null`); `translate.ts:1508-1510` (`readOperands` returns `[base, index, value]` — counting the load's destination as a read); `lower.ts:958-992` (binary ops are pure temp dataflow — no intermediate stores)
**The Problem:** Two halves. (a) The plan directs the executor away from prescan work, but `destTempId` does not recognize the loads' destination (def invisible to the prescan — a `load_indexed` result live across a `JSR` escapes the curated call guard at `translate.ts:389-400`) and `readOperands` permanently inflates the dest's `useCount`, silently disabling single-use folds. (b) Challenger extension: the byte framing ends with "bind A" and no memory home; the natural accumulation `sum = sum + a[i]` — literally the fixture's `$C000` row — then has `leftIntoA(sum)` clobber A (the result's only copy) and dies in the binder's E90001 backstop (`register-binding.ts:160-178`). Loud, not silent — but it breaks the plan's own acceptance program at Phase 7, after ST-53/54 were authored against the incomplete framing.

**Resolution — single viable path** (trusting the executor to notice was rejected: the plan affirmatively says the opposite): amend the Phase-6 task set to (1) fix `destTempId` — return `value`'s temp id for `load_indexed`/`load_indirect`; (2) fix `readOperands` — `[base, index]` for the loads; (3) pin the load-result homing rule (stash-to-home, mirroring the word framing) with a test row for `sum = sum + a[i]`.

**Recommendation:** Apply the amendment (see the shared "state obligations" note under PF-004). Confidence: High. Challenger: converged and extended (added the homing gap).
**User Decision:** Resolved — User accepted recommendation (2026-07-11, bulk: "all per recommendation")

### PF-003: Wrong warning-code claim for index scaling — prospective spec-test-oracle poisoning 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (Stale Assumption), touching 7 — Testability
**Location:** `03-05-sfa-lowering.md` §2; AR-15/AR-17 register notes; ST-51 wording (`07-testing-strategy.md`)
**Codebase Evidence:** `translate.ts:1218-1251` (`translateMul`): const power-of-two × byte width → ASL sequence + **W10172** `ShiftAndAddMultiply` (:1235-1239); only the non-pow-2 fallback JSRs `__rt_mul8/16` + **W10170** `RuntimeMultiply` (:1244-1251). Spec `08-arrays-strings.md` §10.2's own word-array codegen is the ASL shape.
**The Problem:** The plan and register say scaling fires "W10170 naturally" via `__rt_mul`. For the canonical 7a case — 2-byte elements (`Point`, the fixture's `$C002` row) — scaling is `i × 2`: power of two → ASL + W10172, no JSR, no W10170. AR-17's justification for dropping W10111 ("subsumed by shipped W10170") rests on the same misattribution. ST-51 as tabled is IL-tier (asserts the `mul` IL op — still correct), so the oracle is not yet poisoned; the vector is the prose/register, which the testing strategy's authoring rule designates as oracle sources for the Phase 6/7 ASM-tier and warning assertions.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Correct 03-05 §2 + AR-15/AR-17 notes to the real ladder (pow-2 byte scale → ASL + W10172; non-pow-2 → `__rt_mul8` + W10170); clarify ST-51's wording (stays IL-tier); add an ASM-tier row pinning ASL + W10172 for a 2-byte element (optionally a 3-byte-struct row → W10170) | Fixes the oracle source; matches spec 08 §10.2's own codegen; keeps warning coverage | Slightly more test surface |
| B | Reword ST-51/plan to be warning-agnostic (assert only the `load_indexed` framing) | Less brittle vs future Phase-B strength reduction | Leaves wrong claims in the register — the actual oracle source; loses warning coverage |

**Recommendation:** Option A — in this repo a wrong register sentence *is* oracle input; B treats the symptom. Confidence: High (severity Med-High — MAJOR on the oracle rule; the poisoning is prospective). Challenger: converged (verdict MAJOR-borderline, same option, same adjustment).
**User Decision:** Resolved — User chose Option A (2026-07-11, bulk: "all per recommendation")

### PF-004: New `LDX <index>` sites vs the binder's X-residency mirror — the word-store framing can silently store the index as data 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment, touching 9 — Edge Cases
**Location:** `03-06-translate-data.md` §1 (the "LDX first: loading X clobbers no A-bound value" rationale; the word store framing); `02-current-state.md` risk row (load-only mitigation); missing ST row (ST-53..58)
**Codebase Evidence:** `translate.ts:166-167` (`regX` = temp id whose word HIGH byte is resident in X); `wordLeftByteIntoA` :771-773 (`regX === op.id` → `TXA`); `bringValueIntoRegisters` :787 (`LDA lo` / `LDX hi`); shipped clobber discipline — `bindA` nulls `regX` (:1383-1385), `marshalAndCall` → `clearRegs()` after every JSR (:1344, :1357, :1369)
**The Problem:** The plan's safety sentence reasons only about A. X mirrors live word high bytes. The **word store** framing is `LDX <idx>` → `LDA <src-lo>` → … `LDA <src-hi>`: for an A:X-resident source with no memory home (canonical: `warr[i] = f();` — word calls bind A:X at :404-408), the `LDX` physically destroys the high byte before it is read. If the executor reads it via `wordLeftByteIntoA`, the stale mirror emits `TXA` and **silently stores the index as the high byte**; via `operandFor` it ICEs loudly — which branch happens is an unpinned executor choice. No ST row and no fixture row exercises a live word across an indexed access, so golden+VICE would pass while the hazard ships. (Mitigating: the byte arms end in `bindA`, which nulls `regX` as a side effect — accidentally safe.)

**Resolution — single viable path** (relying on the blanket "shipped translate discipline" sentence was rejected: the plan hands the executor provably incomplete reasoning and an LDX-first sequence with no safe helper pinned): amend 03-06 §1 to (1) state the mirror-invalidation rule per arm (`bindA(dest)` for byte loads; explicit `clearRegs()`/mirror update after both word framings); (2) fix the word-store framing — stash/read the source **before** `LDX`, or pin the fail-loud helper; (3) add the missing test row (`warr[i] = f();` — correct code or loud reject, never X-as-data). **Shared remedy note (challenger):** PF-002 and PF-004 are two faces of one gap — 03-06 §1 specifies instruction *sequences* but not the *state obligations* (def visible to prescan; result homed; regA/regX truthful at arm exit). One short "state obligations per arm" block covers both.

**Recommendation:** Apply the sharpened amendment with the shared state-obligations block. Confidence: High (mechanism certain; Med on which failure branch a naive executor hits — both are live). Challenger: converged and sharpened.
**User Decision:** Resolved — User accepted recommendation (2026-07-11, bulk: "all per recommendation")

### PF-005: `length()` result-type boundary unrepresentable at exactly 256 — frozen-spec self-contradiction transcribed unresolved 🟠 MAJOR

**Dimension:** 9 — Edge Cases (spec-conformance boundary)
**Location:** `03-03-const-engine.md` §3 ("≤256 (`length`) → `byte`"); AR-16 row
**Codebase Evidence:** `spec/08-arrays-strings.md:513` ("byte for arrays ≤256 elements") vs `spec/02-type-system.md:470-472` (TS-21: `sizeof` ≤**255** → byte — representability-shaped). `byte[256]` is legal 7a input (tier-1 = ≤256 **bytes**; the plan rejects only >256, ST-32 uses 300).
**The Problem:** `length(buf)` on `buf: byte[256]` is 256 — unrepresentable in `byte`. The engine's own machinery would either wrap 256→0 (silent wrong constant) or emit a spurious E10084 on a legal program. The plan transcribed the chapter's "≤256" verbatim without resolving it; no boundary ST row exists (ST-26 uses 10 elements). The spec is frozen, so the drift must be resolved plan-side.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Representability rule: length ≤255 → `byte`, ≥256 → `word`; record as an accepted spec-drift register row (AR-3 grammar-drift precedent); add `byte[255]`/`byte[256]` boundary ST rows | Only value-preserving outcome; aligns with TS-21's own shape; `let n: byte = length(buf256)` then correctly demands a cast | Deviates from the literal chapter sentence (drift row required) |
| B | Keep the chapter literal; reject `length(byte[256])` with a diagnostic | Never contradicts the sentence | Rejects a program the frozen spec legalizes twice over (tier-1 ≤256 B; `length` valid on any fixed array) — worse fidelity |
| C | Keep "≤256 → byte" and let 256 wrap to 0, documented | No drift row | Silent wrong constant — categorically out under never-miscompile |

**Recommendation:** Option A. The frozen spec is self-contradictory in shape here; A is the smallest observable deviation and uses the drift mechanism the register already employs. Confidence: High. Challenger: converged (very high).
**User Decision:** Resolved — User chose Option A: representability rule (≤255 → byte, ≥256 → word) + drift register row + boundary ST rows (2026-07-11, bulk: "all per recommendation")

---

## MINOR findings

### PF-006: A third bare-name-table consumer the migration list misses 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Impact Blindness)
**Location:** `03-02-declarations-pass2.md` §1 ("the two shipped consumers … switch to FQN lookups in the same change")
**Codebase Evidence:** `intrinsic-validation.ts:188-189, 209` consumes the struct/enum tables via the Pass-1 `ctx.tables` (bare-name); additionally `lower.ts:1357` (`sizeOfType`) independently duplicates the literal-only (`NumericLitExpr`) array-size limitation.
**The Problem:** The FQN migration list names two consumers; there are three (plus the duplicated size-reading in codegen, which 03-05's "route through the engine" covers only implicitly). Impact is contained — re-keying the table **type** makes TypeScript flag every consumer — so this is doc-completeness, not silent risk.
**Recommendation (single viable):** add `intrinsic-validation.ts` to 03-02 §1's consumer list / task 2.2.1, and make 03-05's engine-routing sentence explicitly name `sizeOfType`'s literal-only size read.
**User Decision:** Resolved — User accepted recommendation (2026-07-11, bulk: "all per recommendation")

### PF-007: Two AR-promised loud rejections are untasked and untested 🟡 MINOR

**Dimension:** 4 — Completeness Gaps
**Location:** AR-2 resolution ("string-initialiser forms loud-rejected to Slice 8"); AR-18 resolution ("rejected at semantics as non-lvalue/call"); absent from 03-04 and the ST catalog
**Codebase Evidence:** `statement-typing.ts:317` — `ExpressionStmt` is typed via bare `typeOfExpr` with **no** callable/lvalue-statement restriction; `expression-typing.ts` has no `StringLitExpr` arm (string literals currently fall to silent poison).
**The Problem:** Both rejections the register promises have no owning task and no ST row. Consequence of the AR-18 gap: post-parse, `Point { x: 1 };` as a statement types fine and reaches lowering with no statement-context arm → user-reachable E90001. Consequence of the AR-2 gap: `let a: byte[10] = "HELLO";` (legal per frozen Ch 08, deferred to Slice 8) degrades to poison-mismatch rather than a loud "unsupported until Slice 8".
**Recommendation (single viable):** add both checks to 03-04 (+ Phase 4 task) with two ST rows: statement-head aggregate literal → the promised semantic rejection; string array-initialiser → loud Slice-8-unsupported rejection.
**User Decision:** Resolved — User accepted recommendation (2026-07-11, bulk: "all per recommendation")

### PF-008: E10164 mint contradicts the plan's own "reuse free chapter numbers" policy — Ch 07's E10097 is free and means exactly this 🟡 MINOR

**Dimension:** 12 — Consistency
**Location:** AR-9 / AR-13 (register); `03-04-aggregate-typing.md` §4
**Codebase Evidence:** `spec/07-structs.md:226, 451` — E10097 "Wrong field order in literal" with a message template; E10097 absent from `diagnostic-codes.ts` (free) and from Ch 14. The same table's other free-chapter-number cases (E10093 struct return, E10230 enum member, E10117/E10118 tiers) all reuse the chapter's number "to reduce drift".
**The Problem:** E10164 is the one outlier: a fresh mint where a free spec-designated number exists, creating permanent user-facing drift from the frozen chapter's published code for that rule. AR-9 named the chapter code in its ambiguity column but recorded no rationale for not reusing it (band adjacency to E10160-163 is the only plausible one). New information (the policy inconsistency across the accepted AR-13 table), not re-litigation.
**Options:** A — switch the mint to E10097 (chapter-number reuse, consistent with E10093/E10230/E10117/E10118; zero user drift). B — keep E10164 (struct-band adjacency; AR-9 as recorded).
**Recommendation:** Option A, unless band adjacency was the deliberate reason — then record that rationale in AR-9 and keep B.
**User Decision:** Resolved — User chose Option A: retire the E10164 mint, wire Ch 07's own free E10097 (StructInitFieldOrder) instead; AR-9/AR-13 rows, 03-04, 03-07, ST-35, and task 1.2.1's code list update accordingly when fixes are applied (2026-07-11, bulk: "all per recommendation")

### PF-009: Register integrity — AR-10 row marked "❌ Open" while the gate header claims all 24 resolved 🟡 MINOR

**Dimension:** 12 — Consistency
**Location:** `00-ambiguity-register.md` row 10 (`User Decision: —`, `Status: ❌ Open`) vs header ("✅ GATE PASSED — all 24 items resolved") and `00-index.md` ("24-item gate ✅")
**The Problem:** AR-4's decision text substantively resolves AR-10 ("…all three contradictions: … E10142 duplicate enum values LEGAL (EN-5) … (resolves AR-10 too)"), but row 10 was never updated — the gate-passed claim is contradicted by its own table. Pure hygiene; the substantive decision exists.
**Recommendation (single viable):** mark row 10 `✅ Resolved — by AR-4 (chapters-beat-registry): duplicates legal, E10142 stays registered-unwired`.
**User Decision:** Resolved — User accepted recommendation (2026-07-11, bulk: "all per recommendation")

### PF-010: Citation drift — golden path + six line-attribution errors 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Phantom References, low-stakes)
**Location / Evidence:**
- Golden files live at `packages/test-harness/test/golden/` — NOT repo-root `test/golden/` as written in 00-index, 03-07, and task 7.1.3 (`test/golden/slice7.asm.golden`).
- `pratt.ts:335` is the struct-literal **gate**; the `parseStructLiteral` body is at :438. The plan's "IndexExpr/FieldAccess at 438-548, 387-435" ranges actually point at `parseStructLiteral` and `parseIntrinsicCall`; the real postfix producer is `parsePostfix` :491-548.
- `ExpectedExpression` emits at `pratt.ts:305` (cited :304).
- `ConstRefResolver` is at `const-eval.ts:64-67`, `ConstTypeLookup` :69-74 (cited :74 / :89-106 — the latter is `toBits`/`fromBits`).
- Array-element assignment targets ICE at `lower.ts:1228`; :1241 is the qualified-target arm.
**The Problem:** None load-bearing individually, but the golden-path error would misdirect Phase 7's minting task, and the plan is the executor's map.
**Recommendation (single viable):** fix the golden path in the three documents; correct the five line attributions opportunistically in the same edit.
**User Decision:** Resolved — User accepted recommendation (2026-07-11, bulk: "all per recommendation")

---

## OBSERVATIONS

### PF-011: `needsDataInit` is verified dead — the plan's conditional audit can be pre-resolved 🔵 OBSERVATION

**Dimension:** 13 — Codebase Alignment (recon resolution)
**Codebase Evidence:** `instr-program.ts:189` computes it; `platform-plugin.ts:40` declares it; a workspace-wide search finds **no consumer** — no preamble/shim/plugin reads it (contrast `hasInitCode` → `shared-hooks.ts:100-101` `JSR __init`). The 02-current-state risk row ("may drive an unwanted startup path") and 03-06's "audit consumers → neutralize" resolve to: nothing to neutralize; the flag flips true harmlessly.
**Recommendation:** note the resolution in 03-06 §2 so task 6.2.3's audit is a confirmation, not an investigation.
**User Decision:** Resolved — User accepted recommendation (2026-07-11, bulk: "all per recommendation")

### PF-012: `ConstDataEntry.type` has a third member `"embed"` the plan's shape omits 🔵 OBSERVATION

**Dimension:** 13 — Codebase Alignment
**Codebase Evidence:** `cfg.ts:64-71` — `type: "array" | "struct" | "embed"`; the plan (03-05 §3) writes `type: "array" | "struct"`.
**Recommendation:** no plan change strictly needed (7a only constructs array/struct entries); executors writing exhaustive switches over the field must handle `"embed"`.
**User Decision:** Resolved — User accepted recommendation (2026-07-11, bulk: "all per recommendation")

### PF-013: Two implementation-time conditionals resolved by recon 🔵 OBSERVATION

**Dimension:** 2 — Implicit Assumptions (favorably resolved)
**Codebase Evidence:** (a) `parse-type.ts:51-54` consumes exactly one identifier — dotted `Mod.X` type annotations definitively do **not** parse; the plan's conditional `parse-type.ts` extension (03-02 §4 parser note, task 2.2.3) is certainly needed, and `NamedTypeNode.name: string` (nodes.ts:486-489) accommodates the planned same-shape dotted string. (b) `SymbolKind` already includes `"struct" | "enum" | "enumMember"` (`symbol.ts:21-30`) — declared-but-unconstructed, so 03-02 §5's "populated" wording is exactly right (no type change needed).
**Recommendation:** drop the "if recon shows it missing" hedge from task 2.2.3 — it is missing.
**User Decision:** Resolved — User accepted recommendation (2026-07-11, bulk: "all per recommendation")

---

## Verdict

✅ **PREFLIGHT PASSED — all 13 findings resolved** (user accepted every recommendation, 2026-07-11).
No critical findings; the plan's architecture, scope boundary (7a/7b), diagnostic-code table,
spec-conformance claims, and phase ordering all verified sound. The five majors are all plan-text
amendments (no design rework): one parser-task addition (PF-001), two translate-discipline
amendments sharing a per-arm state-obligations remedy (PF-002/PF-004), one warning-code correction
(PF-003), one boundary pin with a spec-drift register row (PF-005). PF-008 additionally retires the
E10164 mint in favour of Ch 07's own free E10097.

> **Application status:** the accepted fixes were applied to the plan documents on 2026-07-11,
> immediately before execution began (exec_plan). New register rows AR-25 (spec-drift,
> PF-005) and AR-26 (code pin E10157 + string-initialiser mechanism, PF-007) record the two
> details the accepted recommendations left unpinned. A follow-up iteration-2 re-scan, if
> requested, starts at PF-014.
