# Execution Plan: RD-18 Slice 7b — Pointer surface

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-12 04:09 (exec: Phase 2 COMPLETE — 12/12, full verify green)
> **Progress**: 18/58 tasks (31%)
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

- [ ] 3.1.1 Write ST-25..ST-33 spec tests — `packages/frontend/src/sfa/pointer-pairs.spec.test.ts`
- [ ] 3.1.2 Verify red (ST-31/ST-33 may pre-pass — `slotSize` ships; document)

### Step 3.2: Implement (green)
- [ ] 3.2.1 Thread `byRef` through `model-adapter.ts`; pair-accessed predicate on the semantic model (shared with lowering) — (03-03 §byRef/§Pair binding)
- [ ] 3.2.2 Pair coloring (chain-max, topological) + `__zp_ptr_<fq>_<param>` symbol emission over the pool — `zp-allocator.ts`, `plan-allocation.ts`, `symbols.ts`
- [ ] 3.2.3 Scratch predicate (hardened, AR-4) + `__zp_ptr_scratch` reservation + peak wiring
- [ ] 3.2.4 Verify green (ST-25..ST-33) incl. golden-safety row ST-31

### Step 3.3: Impl tests & verify
- [ ] 3.3.1 Impl tests (adversarial graphs, determinism) — `pointer-pairs.impl.test.ts`
- [ ] 3.3.2 Full verify + prior goldens byte-exact

**Verify**: (canonical)

---

## Phase 4: Lowering — addr, marshalling, prologue, indirect places

### Step 4.1: Spec tests (red)
**Reference**: [03-04](03-04-lowering-indirect.md) · [07 §Lowering](07-testing-strategy.md) · AR-2/3/4/7/12

- [ ] 4.1.1 Write ST-34..ST-47 spec tests (ST-40 = the moved ST-24b arg-ICE row; ST-41..44 = the preflight additions: word-domain scaling, elemSize gate, pair-base scalar compound, offset-255 straddle) — `packages/codegen/src/il/lower-indirect.spec.test.ts`
- [ ] 4.1.2 Verify red

### Step 4.2: Implement (green)
- [ ] 4.2.1 `addr` operand kind + constructor + IL printer + exhaustiveness ICE arms — `codegen/src/il/operand.ts` (+consumers) (03-04 §1, AR-12)
- [ ] 4.2.2 Call marshalling: static-place addr stores, pass-through word copy, the two loud AR-3 ICEs — `lower.ts` `lowerUserCall` (03-04 §2/§6)
- [ ] 4.2.3 Prologue copies (two byte moves, access-set-gated) — `lower.ts` entry-block emission (03-04 §3)
- [ ] 4.2.4 Place base kinds (direct/pair) + indirect emission under the straddle-aware fast-path predicate (`constOffset + valueSize − 1 ≤ 255` — PF-003) + the elemSize==1 gate on the pair byte-index path (PF-007) + pair-base scalar compound as indirect RMW (PF-006 — the 7a direct-loc compound rewrite must never see a pair base) + whole-struct copy through pairs — `lower.ts` Place machinery (03-04 §4)
- [ ] 4.2.5 Tier-2/big-offset formation through scratch (the §5 sequence; word-domain scaling `zext`+`shl`/`__rt_mul16` — PF-012) respecting the PF-009 fused word-store invariant (add operands loc/imm; single-use dest; adjacent consuming store) — `lower.ts` (03-04 §5)
- [ ] 4.2.6 Verify green (ST-34..ST-47)

### Step 4.3: Impl tests & verify
- [ ] 4.3.1 Impl tests (classification tables, determinism) — `lower-indirect.impl.test.ts`
- [ ] 4.3.2 Full verify + prior goldens byte-exact

**Verify**: (canonical)

---

## Phase 5: Translate — (zp),Y framings, regY, backstop

### Step 5.1: Spec tests (red)
**Reference**: [03-05](03-05-translate-indirect.md) · [07 §Translate](07-testing-strategy.md) · AR-2/4/12

- [ ] 5.1.1 Write ST-48..ST-58 spec tests (constructed-IL style, 7a precedent) — `packages/codegen/src/instr/translate-indirect.spec.test.ts`
- [ ] 5.1.2 Verify red (the indirect pair currently ICEs — the RD-07b retired-row protocol from 7a applies if any old row pins the ICE)

### Step 5.2: Implement (green)
- [ ] 5.2.1 regY mirror + `offsetIntoY` + `clearRegs` extension + the invalidation rule for every NEW Y-touching sequence 7b introduces (+ one confirming sweep that no pre-existing emitter touches Y — PF-010: zero exist today) — `translate.ts` (03-05 §regY)
- [ ] 5.2.2 `translateLoadIndirect` (byte + word arms, homing ladder; word arms ICE-guard `offset > 254` — PF-003 backstop) — `translate.ts` (03-05)
- [ ] 5.2.3 `translateStoreIndirect` (fast path, imm/memory word arms, loud register-resident ICE, the same word-offset guard) — `translate.ts` (03-05)
- [ ] 5.2.4 `addr` store arm via `symbolRef` Absolute+offset (`symAt` pattern — zpSlot carries no offset, PF-013) (+`protectA` extension) + scratch backstop ICE — `translate.ts` (03-05 §addr/§Backstop)
- [ ] 5.2.5 Verify green (ST-48..ST-58) incl. ST-58 prior-IL-corpora emission identity

### Step 5.3: Impl tests & verify
- [ ] 5.3.1 Impl tests (mirror state machine, protectA/offsetIntoY interplay) — `translate-indirect.impl.test.ts`
- [ ] 5.3.2 Full verify + prior goldens byte-exact

**Verify**: (canonical)

---

## Phase 6: Acceptance — fixture, VICE, golden, negatives

### Step 6.1: Fixture + assemble-clean
**Reference**: [03-06](03-06-acceptance-fixtures.md) · [07 §Acceptance](07-testing-strategy.md) · AR-13

- [ ] 6.1.1 Write `examples/slice7b/{game,main}.blend` + harness builder — `packages/test-harness/src/testing/slice7b.ts` (03-06; re-derive the byte contract from source and fix the 03-06 table if drifted — plan-doc fix, never a test fix)
- [ ] 6.1.2 ST-59 assemble-clean spec test — `test-harness/src/slice7b.spec.test.ts`
- [ ] 6.1.3 ST-61 VICE suite (full byte contract) — same file; run on real VICE 3.10

### Step 6.2: Golden + negatives
- [ ] 6.2.1 Mint `slice7b.asm.golden` AFTER VICE green (`UPDATE_GOLDEN=1`; inspect the diff) + ST-60 landmarks incl. the §5 formation sequence (PF-001) — `golden-slice7b.spec.test.ts`
- [ ] 6.2.2 ST-62/ST-63 negatives via `compile()`/`emitIl` — `slice7b-negatives.spec.test.ts`
- [ ] 6.2.3 ST-64 advisories (W10112/W10142/W10143 compile-with-warning)
- [ ] 6.2.4 ST-65 prior-goldens assertion + ST-66 7a-negative-suite re-run (both already CI-covered — witness green)

### Step 6.3: Full bar
- [ ] 6.3.1 Full verify green (all packages, boundary tier, all goldens)
- [ ] 6.3.2 Record the ResourceReport delta (pointer ZP bytes, frame/binary growth) in the plan folder (RD-18 Should-Have)

**Verify**: (canonical)

---

## Phase 7: Rollout — reconciliation

- [ ] 7.1.1 Tick RD-18 acceptance item 6 (Slice 7 CLOSED: 7a+7b) + slice-map annotation — `codeops/features/blend65-ri/requirements/RD-18-…md`
- [ ] 7.1.2 Ledger reconciliation: R70 → ✅ 7b; R57/R101/R104 tier-2 halves closed; CP/param rows — `codeops/_archive/rd-04-semantic-analysis/08-deferred-semantics-ledger.md`
- [ ] 7.1.3 Roadmaps: feature row → ✅ (plan complete), cascade to portfolio — `codeops/features/blend65-ri/00-roadmap.md`, `codeops/00-roadmap.md`
- [ ] 7.1.4 CLAUDE.md Slice-7b paragraph + memory update

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
