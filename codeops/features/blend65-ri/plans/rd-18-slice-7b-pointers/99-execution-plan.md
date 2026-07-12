# Execution Plan: RD-18 Slice 7b — Pointer surface

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-12 10:17 (exec: PLAN COMPLETE — all 7 phases; SLICE 7 CLOSED, RD-18 item 6 ticked)
> **Progress**: 58/58 tasks (100%)
> **CodeOps Skills Version**: 3.3.1

## Overview

By-ref struct/array parameters (+ const params), unsized array params, and tier-2 (>256-byte)
arrays via `(zp),Y` — retiring both 7a E90001 rejections and closing RD-18 acceptance item 6.
Design owned by the 03-docs; decisions by [00-ambiguity-register.md](00-ambiguity-register.md);
expected behavior by [07-testing-strategy.md](07-testing-strategy.md) (ST-1..ST-66).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Parser & AST — const + unsized params | 6 |
| 2 | Param semantics — types, const rules, tiers, advisories, unsized inference | 12 |
| 3 | SFA — pairs, coloring, scratch | 8 |
| 4 | Lowering — addr, marshalling, prologue, indirect places | 10 |
| 5 | Translate — (zp),Y framings, regY, backstop | 9 |
| 6 | Acceptance — fixture, VICE, golden, negatives | 9 |
| 7 | Rollout — RD-18/ledger/roadmaps reconciliation | 4 |

**Total: 58 tasks across 7 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task line
> appears exactly once. The executing agent MUST:
>
> 1. **On implementation:** mark the task `[~]` with a timestamp —
>    `- [~] 1.1.1 … ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote to `[x]` — `… ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header and Last Updated stamp after EVERY task** — never batch.
> 4. **Resume** top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps from `date '+%Y-%m-%d %H:%M'` — never invented.

> **Standing constraints (every phase):** spec-first ordering (spec tests → red → implement →
> green → impl tests → full verify); `spec/` untouched; no plan-artifact references in shipped
> code/doc comments (test-NAME ST ids are repo convention); prior-slice goldens byte-exact at
> EVERY phase boundary (AR-4); loud-never-silent for all deferred forms (AR-1/AR-3).

---

## Phase 1: Parser & AST — const + unsized params

### Step 1.1: Spec tests (red)
**Reference**: [03-01](03-01-parser-params.md) · [07 §Parser](07-testing-strategy.md) · AR-5/AR-6

- [x] 1.1.1 Write ST-1..ST-5 spec tests — `packages/frontend/src/parser/param-const-unsized.spec.test.ts` ✅ (completed: 2026-07-12 03:35)
- [x] 1.1.2 Verify red (5/5 red; ST-3's unsized `size: null` parse pre-passes as predicted — its failure is the missing `isConst` field only) ✅ (completed: 2026-07-12 03:35)

### Step 1.2: Implement (green)
- [x] 1.2.1 `ParameterNode.isConst` + construction sites + AST printer rendering — `packages/core/src/ast/…`, `packages/frontend/src/parser/parse-decl.ts` (03-01 §AST/§Parser; 2nd construction site: codegen `il/test-fixtures.ts`; AST snapshot regenerated — diff = two additive `isConst: false` lines, inspected) ✅ (completed: 2026-07-12 03:38)
- [x] 1.2.2 `parseParameter` consumes `[const]` after the colon — `parse-decl.ts:53-73` ✅ (completed: 2026-07-12 03:38)
- [x] 1.2.3 Verify green (ST-1..ST-5) + node-kind corpus updated (count stays 51) — parser tier 117/117 ✅ (completed: 2026-07-12 03:38)

### Step 1.3: Impl tests & verify
- [x] 1.3.1 Impl tests (recovery/EOF edges) + full verify — `param-const-unsized.impl.test.ts` (5/5; full canonical verify green 46.8s) ✅ (completed: 2026-07-12 03:41)

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 2: Param semantics — types, const rules, tiers, advisories

### Step 2.1: Spec tests (red)
**Reference**: [03-02](03-02-param-semantics.md) · [07 §Param typing](07-testing-strategy.md) · AR-1/5/6/8/9/10/11

- [x] 2.1.1 Write ST-6..ST-24a spec tests (incl. the AR-15 inference rows ST-21a/21b/21c; ST-24b moved to ST-40 in Phase 4 — PF-004) — `packages/frontend/src/semantics/param-typing.spec.test.ts` ✅ (completed: 2026-07-12 03:52)
- [x] 2.1.2 Verify red — 24/24 red incl. ST-6/ST-7 (E90001 pins hold today) and ST-21a/21b (no inference yet) ✅ (completed: 2026-07-12 03:52)

### Step 2.2: Implement (green)
- [x] 2.2.1 Register E10122/E10123/W10112/W10142/W10143 additively — `packages/core/src/diagnostics/diagnostic-codes.ts` (AR-9) ✅ (completed: 2026-07-12 04:05)
- [x] 2.2.2 `ArrayType.size: number | null` + `byteSize`/`type-utils`/`typeName` ripples + `T[N]→T[]` arm — `packages/core/src/semantics/…` (03-02 §Type model; +2 loud null-guards in codegen `lower.ts` fill-unroll/`lengthOfArray`, both typing-gated) ✅ (completed: 2026-07-12 04:05)
- [x] 2.2.3 Param collection: real aggregate types, `byRef`, `mutable: !isConst`; retire the annotation-resolution param ICE (keep E10120/E10093); **extend `finalizeSymbol`'s kind gate to parameter symbols** (`finalizeParameter` — resolves annotation full-mode, patches `byRef`; `Symbol.byRef` made mutable like `type`) ✅ (completed: 2026-07-12 04:05)
- [x] 2.2.4 Retire the >256-byte gate; unsized survives resolution (legality by declaration site); W10142 (fixed 256 boundary) + W10143 (`targetProfile.maxRam` ≥25%, skip when absent) at declared types — `type-resolution.ts`, `annotation-resolution.ts` (targetProfile threaded via `passes.ts resolveTypes`) ✅ (completed: 2026-07-12 04:05)
- [x] 2.2.5 Call typing: full-mode `signatureOf` (throwaway bag — finalize owns diagnostics; FnSignature params gain byRef/mutable), E10122 arg checks, W10112 once-per-call; write protection: E10123 via the extended root predicate ✅ (completed: 2026-07-12 04:05)
- [x] 2.2.6 Index tiers (tier-matched contextual hint; E10117/E10118 branch; unsized both-widths; bounds only when sized) + `length`/`sizeof` E10080 rules + `lengthOf` parameter & inference arms ✅ (completed: 2026-07-12 04:05)
- [x] 2.2.7 Narrowed unsized inference: null-sentinel `typeArrayLit`/`inferUnsizedArray`; const images sized from the initializer (`evaluateModuleConsts` infers before `buildConstImage`); E10126 for fill + no-initializer (bespoke message) ✅ (completed: 2026-07-12 04:05)
- [x] 2.2.8 Retired-row protocol applied: `aggregate-typing.spec.test.ts` ST-32 (>256 → W10142) + ST-44 param sub-row (compiles by-ref); `slice7-negatives.spec.test.ts` param + >256 sub-rows — all rewritten to the superseding spec behavior with supersession comments; full workspace test green (frontend 781, all 10 packages) ✅ (completed: 2026-07-12 04:05)

### Step 2.3: Impl tests & verify
- [x] 2.3.1 Impl tests (root-walk, signature edges, unsized containment) — `param-typing.impl.test.ts` (6/6) ✅ (completed: 2026-07-12 04:09)
- [x] 2.3.2 Full verify + prior goldens byte-exact — canonical verify green 43.3s; harness golden tier green ✅ (completed: 2026-07-12 04:09)

**Verify**: (canonical, as Phase 1)

---

## Phase 3: SFA — pairs, coloring, scratch

### Step 3.1: Spec tests (red)
**Reference**: [03-03](03-03-sfa-pointers.md) · [07 §SFA](07-testing-strategy.md) · AR-2/AR-4

- [x] 3.1.1 Write ST-25..ST-33 spec tests — `packages/frontend/src/sfa/pointer-pairs.spec.test.ts` ✅ (completed: 2026-07-12 04:18)
- [x] 3.1.2 Verify red — 8/9 red; ST-32 pre-passes (E10032 emitter + peak formula shipped in RD-11's allocator — the fixture path exercises them directly; 7b only re-points the peak input) ✅ (completed: 2026-07-12 04:18)

### Step 3.2: Implement (green)
- [x] 3.2.1 `SemanticModel.pairAccessedParams` (new `semantics/pair-access.ts` — chain roots, whole-copy endpoints, let-init source; pass-through/dead excluded) + adapter `byRef = sym.byRef && pairAccessed` (FrameVar.byRef re-documented as pair-bound) ✅ (completed: 2026-07-12 04:19)
- [x] 3.2.2 Pair coloring — new `sfa/pointer-pairs.ts` `bindPointerPairs` (chain-max over interference, topo caller-first, deterministic) + `__zp_ptr_<fq>_<param>` aliases appended to symbolDefinitions + pool-overrun ICE (never truncate) ✅ (completed: 2026-07-12 04:19)
- [x] 3.2.3 Scratch predicate `modelNeedsPointerScratch` (pair-accessed params OR transitive >256-byte array in declared storage/const aggregates) + `PlanInput.needsPointerScratch` + `__zp_ptr_scratch` after the colored pairs + run-frontend threading ✅ (completed: 2026-07-12 04:19)
- [x] 3.2.4 Verify green (ST-25..ST-33) incl. golden-safety row ST-31 — 9/9 first run ✅ (completed: 2026-07-12 04:19)

### Step 3.3: Impl tests & verify
- [x] 3.3.1 Impl tests (adversarial graphs, determinism) — `pointer-pairs.impl.test.ts` (5/5) ✅ (completed: 2026-07-12 04:21)
- [x] 3.3.2 Full verify + prior goldens byte-exact — canonical verify green 46.2s ✅ (completed: 2026-07-12 04:21)

**Verify**: (canonical)

---

## Phase 4: Lowering — addr, marshalling, prologue, indirect places

### Step 4.1: Spec tests (red)
**Reference**: [03-04](03-04-lowering-indirect.md) · [07 §Lowering](07-testing-strategy.md) · AR-2/3/4/7/12

- [x] 4.1.1 Write ST-34..ST-47 spec tests (ST-40 = the moved ST-24b arg-ICE row; ST-41..44 = the preflight additions: word-domain scaling, elemSize gate, pair-base scalar compound, offset-255 straddle) — `packages/codegen/src/il/lower-indirect.spec.test.ts` ✅ (completed: 2026-07-12 04:38)
- [x] 4.1.2 Verify red — 14/14 red ✅ (completed: 2026-07-12 04:39)

### Step 4.2: Implement (green)
- [x] 4.2.1 `addr` operand kind (word-typed; legal as store source + ALU right operand per AR-16) + `addrOf`/`isAddr` + IL printer `&sym+off` — `codegen/src/il/operand.ts`, `print-il.ts` ✅ (completed: 2026-07-12 04:47)
- [x] 4.2.2 Call marshalling: static-place addr stores, pass-through word copy (frame home, no pair), the loud AR-3 ICEs (runtime-indexed + pair-relative args) — `lower.ts` `lowerUserCall` ✅ (completed: 2026-07-12 04:47)
- [x] 4.2.3 Prologue copies (`emitPairPrologue` — two byte moves, `pairAccessedParams`-gated; dead/pass-through skip) — `lower.ts` ✅ (completed: 2026-07-12 04:47)
- [x] 4.2.4 Place base kinds (`baseKind` + `wordIndex`/`wordScale`) + straddle-aware fast path + pair elemSize==1 byte gate (direct bases keep the 7a scaler) + pair scalar compound as indirect RMW (shared `RmwTarget` core) + whole-struct copy through pairs ✅ (completed: 2026-07-12 04:47)
- [x] 4.2.5 Formation through scratch (`resolveIndirectAccess`: word-domain scale homed in scratch → add with pair-load/`addr` right operand per AR-16 → homed sum → indirect at +0/residual; scratch-reservation ICE backstop) ✅ (completed: 2026-07-12 04:47)
- [x] 4.2.6 Verify green (ST-34..ST-47) — 14/14 + whole il tier 182/182, zero 7a regressions ✅ (completed: 2026-07-12 04:47)

### Step 4.3: Impl tests & verify
- [x] 4.3.1 Impl tests (fused formation shape, domain classification, determinism, scratch backstop) — `lower-indirect.impl.test.ts` (5/5) ✅ (completed: 2026-07-12 09:50)
- [x] 4.3.2 Full verify + prior goldens byte-exact — canonical verify green 48.7s ✅ (completed: 2026-07-12 09:50)

**Verify**: (canonical)

---

## Phase 5: Translate — (zp),Y framings, regY, backstop

### Step 5.1: Spec tests (red)
**Reference**: [03-05](03-05-translate-indirect.md) · [07 §Translate](07-testing-strategy.md) · AR-2/4/12

- [x] 5.1.1 Write ST-48..ST-58 spec tests (end-to-end ASM rows + constructed-IL contract guards) — `packages/codegen/src/instr/translate-indirect.spec.test.ts` ✅ (completed: 2026-07-12 09:54)
- [x] 5.1.2 Verify red — 9/11 red; ST-57 pre-passes via the deferred-ICE seam, ST-58 pins absence (trivially green); no old row pins the ICE (grep: zero suites reference the seam wording) ✅ (completed: 2026-07-12 09:54)

### Step 5.2: Implement (green)
- [x] 5.2.1 regY mirror (imm|temp identity) + `offsetIntoY` (imm skip / TAY / home / ZP) + `clearRegs` clears Y + INY/JSR/block invalidation; confirming sweep: zero pre-existing Y emitters (grep LDY/INY/DEY/TAY over emit sites) ✅ (completed: 2026-07-12 09:59)
- [x] 5.2.2 `translateLoadIndirect` (byte fast path + homing ladder; word lo/INY/hi with the >254 offset ICE backstop) ✅ (completed: 2026-07-12 09:59)
- [x] 5.2.3 `translateStoreIndirect` (value-in-A fast path, imm/memory word arms, loud register-resident ICE, same word-offset guard) ✅ (completed: 2026-07-12 09:59)
- [x] 5.2.4 `addr` store arm (protectA + #<sym/#>sym via symbolRef byteSelect, symHome +1 target) + AR-16 ALU right-operand arm in `rightSource` + loud addr guards in leftIntoA/wordLeftByteIntoA/bringValueIntoRegisters/indexIntoX + `indirectPair` plan backstop ✅ (completed: 2026-07-12 09:59)
- [x] 5.2.5 Verify green (ST-48..ST-58) — 11/11; whole codegen tier 976 green (prior goldens byte-exact = emission identity) ✅ (completed: 2026-07-12 09:59)

### Step 5.3: Impl tests & verify
- [x] 5.3.1 Impl tests (mirror across block labels, fast-path ordering, INY invalidation) — `translate-indirect.impl.test.ts` (3/3) ✅ (completed: 2026-07-12 10:00)
- [x] 5.3.2 Full verify + prior goldens byte-exact — canonical verify green 37.4s ✅ (completed: 2026-07-12 10:00)

**Verify**: (canonical)

---

## Phase 6: Acceptance — fixture, VICE, golden, negatives

### Step 6.1: Fixture + assemble-clean
**Reference**: [03-06](03-06-acceptance-fixtures.md) · [07 §Acceptance](07-testing-strategy.md) · AR-13

- [x] 6.1.1 `examples/slice7b/{game,main}.blend` + harness builder — `testing/slice7b.ts`; byte contract re-derived from source: matches 03-06 exactly (00/2A/0F/1D/11/0B/16) ✅ (completed: 2026-07-12 10:06)
- [x] 6.1.2 ST-59 assemble-clean spec test — loadable PRG, all `__zp_ptr_*` resolve (mechanical correction discovered: ACME sizes symbols by equate digit count and rejects 16-bit-hinted symbols in `(zp),Y` — PF-013's '$00xx resolves' claim was wrong; fixed additively via `SymbolDefinition.zeroPage` → 2-digit equates for pair aliases only, prior goldens untouched) ✅ (completed: 2026-07-12 10:06)
- [x] 6.1.3 ST-61 VICE suite — FULL byte contract GREEN on real VICE 3.10 FIRST RUN ($C000..$C006 = 00/2A/0F/1D/11/0B/16; the formation path executed on hardware) ✅ (completed: 2026-07-12 10:06)

### Step 6.2: Golden + negatives
- [x] 6.2.1 `slice7b.asm.golden` minted AFTER VICE green (212 lines; formation sequence inspected — idx→scratch, fused per-byte add with #</#> address selects, (scratch),Y) + ST-60 landmarks ✅ (completed: 2026-07-12 10:07)
- [x] 6.2.2 ST-62/ST-63 negatives via `compile()`/`emitIl` — E10122 both shapes, E10123 direct/nested/compound, E10117/E10118, E10080, E10171, E10126 both forms, both AR-3 ICEs ✅ (completed: 2026-07-12 10:09)
- [x] 6.2.3 ST-64 advisories — W10112/W10142/W10143 compile-with-warning (W10143 through the real c64 plugin profile) ✅ (completed: 2026-07-12 10:09)
- [x] 6.2.4 ST-65 + ST-66 witnessed — full harness tier 146/146 (nine prior goldens byte-exact; 7a suites green post-retirement) ✅ (completed: 2026-07-12 10:10)

### Step 6.3: Full bar
- [x] 6.3.1 Full verify green (all packages, boundary tier, all goldens) — 59.2s ✅ (completed: 2026-07-12 10:12)
- [x] 6.3.2 ResourceReport delta recorded — `08-resource-report.md` (ZP 20/46 incl. 10 pointer bytes, 3 callees sharing $06; frames 7 B; binary 367 B) ✅ (completed: 2026-07-12 10:12)

**Verify**: (canonical)

---

## Phase 7: Rollout — reconciliation

- [x] 7.1.1 RD-18 acceptance item 6 TICKED (Slice 7 CLOSED: 7a+7b) + slice-map row 7 annotated ✅ (completed: 2026-07-12 10:15)
- [x] 7.1.2 Ledger reconciliation — R70 ✅ 7b (FN-3 end-to-end + CP rows); R57/R101/R104 tier-2 halves closed (7a+7b complete) ✅ (completed: 2026-07-12 10:15)
- [x] 7.1.3 Roadmaps: feature narrative + RD-18 row → Slice 7b ✅ COMPLETE; cascaded to the portfolio headline ✅ (completed: 2026-07-12 10:16)
- [x] 7.1.4 CLAUDE.md Slice-7b paragraph (+ Next → Slice 8) + memory file/index updated ✅ (completed: 2026-07-12 10:16)

**Verify**: (canonical; `git status --porcelain spec/` empty)

---

## Dependencies

```
Phase 1 (parser) → Phase 2 (semantics) → Phase 3 (SFA) → Phase 4 (lowering) → Phase 5 (translate) → Phase 6 (acceptance) → Phase 7 (rollout)
```

Strictly sequential — each stage consumes the previous stage's outputs (the vertical-slice
pattern of all prior RD-18 plans).

---

## Success Criteria

**Feature is complete when:**

1. ✅ All 58 tasks `[x]`
2. ✅ The 3-part bar: assemble-clean (ST-59) + golden (ST-60) + real VICE (ST-61)
3. ✅ All negatives/advisories proven (ST-62..ST-64); both 7a E90001s retired loud-never-silent
4. ✅ All nine prior committed goldens byte-exact (ST-65); 7a suites green — the four retired-pin rows handled by protocol at Phase 2, nothing else touched (ST-66)
5. ✅ Full verify green; `spec/` untouched; no dead code; no plan-artifact refs in shipped code
6. ✅ RD-18 item 6 ticked; ledger/roadmaps/CLAUDE.md/memory reconciled
