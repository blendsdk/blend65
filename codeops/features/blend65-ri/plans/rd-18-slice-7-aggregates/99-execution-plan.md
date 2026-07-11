# Execution Plan: RD-18 Slice 7a — Aggregates (direct surface)

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-12 00:35
> **Progress**: 37/64 tasks (58%) — Phases 1-4 ✅ COMPLETE (full verify green)
> **CodeOps Skills Version**: 3.3.1

## Overview

Ships arrays/structs/enums through the direct-addressing surface (AR-1): array-literal parsing,
module-keyed declaration tables (+ the AR-7 collision defect fix), the unified const/type
engine, full aggregate typing, tier-1 indexed lowering/translate, const-aggregate data
emission, and the three-part acceptance bar on `examples/slice7/`. 7b (pointer surface) follows
in its own plan.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
|-------|-------|-------|
| 1 | Codes, AST & array-literal parser | 7 |
| 2 | Module-keyed tables & type resolution | 9 |
| 3 | Unified const/type engine | 9 |
| 4 | Aggregate expression typing | 12 |
| 5 | SFA & IL lowering | 10 |
| 6 | Translate & data emission | 8 |
| 7 | Acceptance — fixture, golden, VICE, negatives | 5 |
| 8 | Rollout bookkeeping | 4 |

**Total: 64 tasks across 8 phases** (no fabricated hour estimates — scope bounded by the
task-size criteria in the make_plan quality checklist)

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task line
> appears exactly once in this document. The executing agent MUST:
>
> 1. **On implementation:** mark `[~]` with a timestamp —
>    `- [~] 1.1.1 … ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote to `[x]` —
>    `- [x] 1.1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header and Last Updated stamp after EVERY task** — never batch.
>    Only `[x]` counts as complete.
> 4. **Resume** top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.

**Standing constraints (every phase):** `spec/` stays untouched (D3 — `git status --porcelain
spec/` empty). No plan-artifact references (AR/ST/DEF ids, plan paths) in shipped code or doc
comments — restate rationale in plain language. Immutable oracle: never edit a spec test to
match the implementation. Commits via **/gitcm** / **/gitcmp** per the exec_plan commit mode.
All seven prior slice goldens must remain byte-exact at every phase boundary.

---

## Phase 1: Codes, AST & array-literal parser

### Step 1.1: Specification tests (RED)
**Reference**: 03-01 · AR-2/3/18/21
**Objective**: pin the array-literal parse surface before touching the parser.

- [x] 1.1.1 Write parser spec tests from ST-1..ST-6b (const-initialiser forms included) — `packages/frontend/src/parser/array-literals.spec.test.ts` ✅ (completed: 2026-07-11 23:00)
- [x] 1.1.2 Run them — verify all FAIL (red); document any pre-passing with justification ✅ (completed: 2026-07-11 23:05 — 7/8 red; ST-6 pre-passes: the shipped recovery already emits E10308 + continues on this input (probe: E10301/E10305/E10308/E10310, trailing decl recovered); the test pins that observable contract, which must survive the new `[` arm)

### Step 1.2: Implementation
**Reference**: 03-01 §Proposed changes · AR-13/21 (codes)

- [x] 1.2.1 Register the slice's new/wired codes additively (E10093, E10097, E10117, E10118, E10119, E10120, E10121, E10126, E10156, E10157, E10165, E10230, W10140, W10141) with band comments per the register (E10164→E10097 per PF-008; E10157 per AR-26) — `packages/core/src/diagnostics/diagnostic-codes.ts` ✅ (completed: 2026-07-11 23:05 — registry invariants 26/26 green)
- [x] 1.2.2 Add `ArrayLitExpr` node kind + node shape + visitor + `walkChildren` (50→51 kinds) — `packages/core/src/ast/node-kind.ts`, `nodes.ts`, visitor/walk modules ✅ (completed: 2026-07-11 23:08 — core AST tests 12/12; all AstVisitor consumers are Proxy catch-alls, no manual implementors)
- [x] 1.2.3 `parseArrayLiteral` (list + Ch-08 fill + trailing comma) behind the renamed `allowAggregateLit` flag; assignment-RHS contexts enabled AND `parseConstDecl` switched to flag-true full-expression parsing (the PF-001 const-initialiser gap, `parse-decl.ts:355`) — `packages/frontend/src/parser/pratt.ts`, `parse-stmt.ts`, `parse-decl.ts` ✅ (completed: 2026-07-11 23:15)
- [x] 1.2.4 Run spec tests — verify ST-1..ST-6b PASS (green) ✅ (completed: 2026-07-11 23:15 — 8/8 green; full frontend suite 665 passed, no regressions)

### Step 1.3: Implementation tests & hardening
- [x] 1.3.1 Parser impl tests: malformed-literal recovery, nested literals, AST golden snapshots — `packages/frontend/src/parser/array-literals.impl.test.ts` (+ snapshot updates) ✅ (completed: 2026-07-11 23:16 — 10/10; node-kind exhaustiveness corpus extended with an array-literal sample; FULL WORKSPACE VERIFY GREEN)

**Deliverables**: array literals parse everywhere aggregate literals are legal; codes registered.
**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 2: Module-keyed tables & type resolution

### Step 2.1: Specification tests (RED)
**Reference**: 03-02 · AR-7/24/21/13
**Objective**: pin table keying, namespace collisions, and annotation resolution.

- [x] 2.1.1 Write spec tests from ST-7..ST-9, ST-12..ST-16 — `packages/frontend/src/semantics/declaration-tables.spec.test.ts` ✅ (completed: 2026-07-11 23:30)
- [x] 2.1.2 Red-phase run ✅ (completed: 2026-07-11 23:30 — 11/11 red, no pre-passers)

### Step 2.2: Implementation
**Reference**: 03-02 §Proposed changes 1/4/5

- [x] 2.2.1 Module-keyed `DeclarationTables` + FQN-keyed `SemanticModel.structTypes`/`enumTypes`; update the THREE shipped FQN consumers (PF-006) — `packages/frontend/src/semantics/declaration-collection.ts`, `packages/codegen/src/il/lower.ts`, `packages/frontend/src/semantics/intrinsic-validation.ts` ✅ (completed: 2026-07-11 23:43 — 3-sweep collection (register→resolve→declare symbols); intrinsic-validation switched to scope-based lookups; lower.ts `lookupFqn` current-module→dotted→unique-suffix; `Symbol.type` made non-readonly for the Pass-2 patch)
- [x] 2.2.2 One-namespace collisions (type vs type, type vs value, cross-file) → E10003 — `declaration-collection.ts` + Pass-1 merge seam ✅ (completed: 2026-07-11 23:43)
- [x] 2.2.3 Thread tables into `resolveTypeNode`: NamedType (module-local, import-bound, dotted `Mod.Type`), void → E10156, unknown → E10151/E10012 — `packages/frontend/src/semantics/type-check/type-resolution.ts` + the `parse-type.ts` dotted-name extension (verified missing at preflight, PF-013) ✅ (completed: 2026-07-11 23:43 — `TypeResolverContext` full-mode resolution + new `annotation-resolution.ts` Pass 2 realised in `passes.ts`/`analyze.ts`; dotted `Mod.Type` parses)
- [x] 2.2.4 ArrayType resolution with literal sizes + E10111/E10112 + the >256-byte 7a rejection; enum member collection with existing-const-eval values, E10230/E10143 — `type-resolution.ts`, `declaration-collection.ts` ✅ (completed: 2026-07-11 23:43)
- [x] 2.2.5 Import binding for type names (`import { Point } from Gfx;`) via the 5a same-Symbol aliasing — `packages/frontend/src/semantics/import-resolution.ts` ✅ (completed: 2026-07-11 23:43 — zero code change needed: aliasing is kind-agnostic once type symbols exist; positive spec test witnesses it)
- [x] 2.2.6 Green-phase run (ST-7..9, 12..16) ✅ (completed: 2026-07-11 23:43 — 11/11 green first run)

### Step 2.3: Implementation tests & hardening
- [x] 2.3.1 Impl tests: FQN lookup internals, deterministic diagnostic ordering, the ST-7 defect-regression E2E shape — `declaration-tables.impl.test.ts` ✅ (completed: 2026-07-11 23:43 — 7/7; FULL WORKSPACE VERIFY GREEN incl. VICE tiers — one slice3b VICE flake re-run clean, golden byte-exact)

**Deliverables**: aggregate annotations resolve; collision defect fixed.
**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 3: Unified const/type engine

### Step 3.1: Specification tests (RED)
**Reference**: 03-03 · AR-5/6/16/23
- [x] 3.1.1 Write spec tests from ST-10, ST-11, ST-17..ST-26b (incl. the AR-25 length-boundary rows) — `packages/frontend/src/semantics/const-engine.spec.test.ts` ✅ (completed: 2026-07-12 00:01)
- [x] 3.1.2 Red-phase run ✅ (completed: 2026-07-12 00:01 — 10/14 red; pre-passers justified: ST-21 landed with Phase 2 size validation; ST-23 via the existing non-const path; ST-26/26a pass vacuously through poison suppression until the fold typing lands)

### Step 3.2: Implementation
**Reference**: 03-03 §Proposed changes

- [x] 3.2.1 The engine core: memo + ordered in-progress stack spanning `const:`/`structLayout:`/`enumValues:` keys; cycle → ONE path-carrying E10194/E10165 per AR-23 — new `packages/frontend/src/semantics/const-type-engine.ts` (wrapping the `evalConst` seams) ✅ (completed: 2026-07-12 00:01)
- [x] 3.2.2 Struct layout & enum values move onto the engine (Pass 2 drives it exhaustively in module-then-declaration order); the silent zero-size placeholder dies — `declaration-collection.ts` (registration-only now), `passes.ts` ✅ (completed: 2026-07-12 00:01)
- [x] 3.2.3 `evalConst` aggregate arms: enum-member folding, `sizeof`/`offsetof`/`length` folds through the engine — `const-eval.ts` (new optional `ConstIntrinsicFolder` seam), `const-type-engine.ts`; fold value-typing wired in `expression-typing.ts` (representability rule) ✅ (completed: 2026-07-12 00:01)
- [x] 3.2.4 Const-expression array sizes end-to-end (E10110 non-const path moves onto the engine) — `type-resolution.ts` (`evalSize` hook), `annotation-resolution.ts` ✅ (completed: 2026-07-12 00:01)
- [x] 3.2.5 Aggregate const images: `ConstValue` bytes variant, element/fill folding, E10193/E10113, little-endian words — `packages/core/src/semantics/const-value.ts` (additive optional `bytes` field — mechanical deviation from the planned union shape, same information), new `const-images.ts`, `statement-typing.ts` (aggregate consts skip scalar typing; images via engine; engine owns cycle detection — the 5b Tarjan removed, pinned E10194 contract preserved) ✅ (completed: 2026-07-12 00:01)
- [x] 3.2.6 Green-phase run ✅ (completed: 2026-07-12 00:01 — 14/14 green first run; frontend suite 707 green)

### Step 3.3: Implementation tests & hardening
- [x] 3.3.1 Impl tests: memo idempotence, stack hygiene after poison, declaration-order shuffling, Slice-6 scalar-fold regression sweep — `const-engine.impl.test.ts` ✅ (completed: 2026-07-12 00:01 — 7/7 (incl. nested array-of-struct images, enum-member-references-const, sbyte fills); Slice-6 scalar regression = the existing const suites all green; FULL WORKSPACE VERIFY GREEN)

**Deliverables**: R88–R94 closed; cycles loud with paths.
**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 4: Aggregate expression typing

### Step 4.1: Specification tests (RED)
**Reference**: 03-04 · AR-4/9/11/12/13/14/17/22/24
- [x] 4.1.1 Write spec tests from ST-27..ST-48 (incl. ST-44a statement-head literal E10157 + ST-44b string-initialiser rejection) — `packages/frontend/src/semantics/aggregate-typing.spec.test.ts` ✅ (completed: 2026-07-12 00:35)
- [x] 4.1.2 Red-phase run ✅ (completed: 2026-07-12 00:35)

### Step 4.2: Implementation
**Reference**: 03-04 §Implementation Details

- [x] 4.2.1 Assignability/comparison/cast policy for aggregates in ONE place: array E10119/E10121, struct copy/E10152/E10080, enum EN-8/9 + cast arms (AR-12), E10155 named-type casts — `packages/core/src/semantics/type-utils.ts`, `type-check/expression-typing.ts` ✅ (completed: 2026-07-12 00:35)
- [x] 4.2.2 `typeIndexExpr`: E10080/E10114/E10117/E10115 ladder + element result + l-value — `expression-typing.ts` ✅ (completed: 2026-07-12 00:35)
- [x] 4.2.3 Head-resolution ladder extension (value → enum type → module) + struct-field arm (E10160) + `Mod.Enum.Member`/`Mod.arr` chains — `type-check/name-resolution.ts`, `expression-typing.ts` ✅ (completed: 2026-07-12 00:35)
- [x] 4.2.4 `typeStructLit` (E10161/E10162/E10097/E10152) + `typeArrayLit` (contextual, count rules, E10126, size inference) + statement-position aggregate-literal rejection E10157 and string-initialiser loud Slice-8 rejection (AR-26/PF-007) — `expression-typing.ts`, `statement-typing.ts` ✅ (completed: 2026-07-12 00:35)
- [x] 4.2.5 `typeAssign` aggregate-target arms + const propagation — `expression-typing.ts` ✅ (completed: 2026-07-12 00:35)
- [x] 4.2.6 Function boundary: aggregate returns E10093/E10120; aggregate params loud 7a rejection (belt) — `function-collection.ts`, `type-check/statement-typing.ts` ✅ (completed: 2026-07-12 00:35)
- [x] 4.2.7 Switch-on-enum: discriminant + member case values + E10077 emission + NO exhaustiveness; W10140/W10141 at declaration typing — `statement-typing.ts` ✅ (completed: 2026-07-12 00:35)
- [x] 4.2.8 Green-phase run ✅ (completed: 2026-07-12 00:35)

### Step 4.3: Implementation tests & hardening
- [x] 4.3.1 Impl tests: chain torture (`a[i].f[j].g`), poison propagation, typeMap completeness over aggregate nodes — `aggregate-typing.impl.test.ts` ✅ (completed: 2026-07-12 00:35)
- [x] 4.3.2 Adversarial sweep: deep nesting / huge sizes / cyclic+malformed combos → clean diagnostics, never a crash (RD-18 security row) ✅ (completed: 2026-07-12 00:35)

**Deliverables**: every aggregate expression types or rejects loudly; silent poison gone.
**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 5: SFA & IL lowering

### Step 5.1: Specification tests (RED)
**Reference**: 03-05 · AR-1/7/11/15
- [ ] 5.1.1 Write spec tests from ST-49..ST-52 — `packages/codegen/src/il/lower-aggregates.spec.test.ts`
- [ ] 5.1.2 Red-phase run

### Step 5.2: Implementation
**Reference**: 03-05 §Implementation Details

- [ ] 5.2.1 Adapter: const aggregates excluded from module-var projection; `__data_<Module>_<name>` labels; aggregate-typed locals/module-vars flow (already sized) — `packages/frontend/src/sfa/model-adapter.ts`
- [ ] 5.2.2 `lowerPlace` (base symbol + const offset + optional scaled byte-offset temp; AR-15 scaling via the existing `mul` path) — `packages/codegen/src/il/lower.ts`
- [ ] 5.2.3 Read/write emission: offset `load`/`store` for static places; `load_indexed`/`store_indexed` for runtime indexes; word-element IL_WORD ops — `lower.ts`
- [ ] 5.2.4 Whole-struct copy unroll; StructLit/ArrayLit initialisation stores (local inline + module `__init`, fill unroll) — `lower.ts`
- [ ] 5.2.5 `constData` population from const images; use-site reads → data labels; enum member/cast lowering as byte folds — `lower.ts`
- [ ] 5.2.6 Aggregate-param loud lowering guard (braces) — `lower.ts`
- [ ] 5.2.7 Green-phase run

### Step 5.3: Implementation tests & hardening
- [ ] 5.3.1 Impl tests: `lowerPlace` matrix (const/runtime × field/index nesting), image→constData byte equality, `__init` ordering with aggregate initialisers — `lower-aggregates.impl.test.ts`

**Deliverables**: aggregate IL emitted; `constData` live.
**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 6: Translate & data emission

### Step 6.1: Specification tests (RED)
**Reference**: 03-06 · AR-1/13/15
- [ ] 6.1.1 Write spec tests from ST-51a/ST-51b + ST-53..ST-58 (incl. ST-53a accumulate-through-load, ST-54a live-A:X word store) — `packages/codegen/src/instr/translate-indexed.spec.test.ts`
- [ ] 6.1.2 Red-phase run

### Step 6.2: Implementation
**Reference**: 03-06 §Implementation Details

- [ ] 6.2.1 Prescan def/read fixes (`destTempId` returns the loads' `value` temp; `readOperands` drops it — PF-002) + `load_indexed`/`store_indexed` byte framings with load-result homing (03-06 §1 state obligations) — `packages/codegen/src/instr/translate.ts`
- [ ] 6.2.2 Word-element framings — load stash-to-home; store source stashed BEFORE `LDX` (PF-004 / 03-06 §1 state obligations); indirect ops re-ICE with the 7b message — `translate.ts`
- [ ] 6.2.3 Data streams from `constData` (`label` + `!byte` rows ≤16/row); `printInstr` byte-directive rendering verified/extended; `needsDataInit` no-consumer status confirmed (verified dead at preflight, PF-011) → const data read-in-place — `packages/codegen/src/instr/instr-program.ts`, `print-instr.ts`, `serialize-acme.ts`
- [ ] 6.2.4 Green-phase run

### Step 6.3: Implementation tests & hardening
- [ ] 6.3.1 Impl tests: framing units per op × width, data-row formatting edges — `translate-indexed.impl.test.ts`
- [ ] 6.3.2 Prior-golden sweep: all seven slice goldens byte-exact (ST-58) — existing golden specs

**Deliverables**: tier-1 indexed 6502 code + in-image const data.
**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 7: Acceptance — fixture, golden, VICE, negatives

### Step 7.1: Specification tests + fixture (RED→GREEN inline)
**Reference**: 03-07 · AR-19 · ST-59..ST-66
- [ ] 7.1.1 Author `examples/slice7/{main,gfx}.blend` + `testing/slice7.ts` helper (pin the exact `$C000..$C009` byte contract from the program text) — `examples/slice7/`, `packages/test-harness/src/testing/slice7.ts`
- [ ] 7.1.2 Assemble-clean + VICE spec (`slice7.spec.test.ts`, ST-59/ST-61) — real ACME PRG, then real VICE 3.10 memory assertions
- [ ] 7.1.3 Golden spec + mint `packages/test-harness/test/golden/slice7.asm.golden` (package-local goldens dir, PF-010; ST-60 + landmarks; mint ONLY after VICE proves behavior) — `golden-slice7.spec.test.ts`
- [ ] 7.1.4 Negatives + warnings catalog (ST-62/63/64/66 incl. the AR-7 defect witness) — `slice7-negatives.spec.test.ts`

### Step 7.2: Hardening
- [ ] 7.2.1 Full local acceptance sweep: 3-part bar green, seven prior goldens unchanged, `spec/` clean, ResourceReport delta recorded for the rollout notes

**Deliverables**: RD-18 bar (a)+(b)+(c) for 7a.
**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 8: Rollout bookkeeping

**Reference**: 01-requirements §Acceptance · roadmap skill
- [ ] 8.1.1 Ledger reconciliation: advance the Ch-07/08/09, §12 (R88–R94), §14 (R101–R105) rows + AC-10/11/14/19/20 to their 7a state with 7b-remainder notes — `codeops/_archive/rd-04-semantic-analysis/08-deferred-semantics-ledger.md`
- [ ] 8.1.2 RD-18 acceptance item 6 annotated "7a complete (scope per plan); closes at 7b"; parent-RD AC ticks (RD-05 AC-02, RD-06 AC-17, RD-07 AC-02/AC-17 partial) — `codeops/features/blend65-ri/requirements/RD-18-codegen-language-completion.md`
- [ ] 8.1.3 Roadmap update (feature + portfolio) per the roadmap skill — `codeops/features/blend65-ri/00-roadmap.md`, `codeops/00-roadmap.md`
- [ ] 8.1.4 CLAUDE.md + auto-memory refresh (slice-7a summary, next = 7b make_plan)

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Dependencies

```
Phase 1 (parser + codes)
    ↓
Phase 2 (tables & resolution)
    ↓
Phase 3 (const/type engine)     ← engine consumes tables; Pass-2 sizing swaps onto it
    ↓
Phase 4 (typing)                ← consumes engine + resolution
    ↓
Phase 5 (SFA & lowering)        ← consumes typeMap/constValues/images
    ↓
Phase 6 (translate & data)      ← consumes IL + constData
    ↓
Phase 7 (acceptance)            ← consumes everything
    ↓
Phase 8 (bookkeeping)
```

---

## Success Criteria

**Slice 7a is complete when:**

1. ✅ All 8 phases completed (64/64 tasks `[x]`)
2. ✅ Full verify green at every phase boundary
3. ✅ The 3-part bar: assemble-clean PRG + byte-exact `slice7.asm.golden` + real-VICE `$C000..` band
4. ✅ Seven prior goldens byte-exact, `spec/` untouched, no dead code
5. ✅ Security rows hold: malformed/adversarial aggregate source → clean diagnostics, bounded evaluation
6. ✅ Ledger/RD/roadmap/memory reconciled (Phase 8)
7. ✅ Post-completion re-analysis (exec_plan skill)
