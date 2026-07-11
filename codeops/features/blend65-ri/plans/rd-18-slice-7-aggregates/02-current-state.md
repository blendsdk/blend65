# Current State: RD-18 Slice 7a — Aggregates

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

Recon at commit `e1e1bdd` (branch `v3`, post-Slice-6). Headline: the aggregate **vocabulary is
already built end-to-end** — AST nodes, semantic `Type`s, IL ops, addressing modes, intrinsic
descriptors, diagnostic codes, frame sizing, and a dormant const-data channel all exist. Slices
3a–6 built the scalar data-flow; the aggregate arms are **silent poison** (typing), **ICE E90001**
(lowering/translate), or **no-op seams** (Pass 2). Slice 7a is mostly wiring across well-marked
seams, plus ONE genuinely new parser surface (array literals) and ONE new engine (unified
const/type evaluation).

## Existing Implementation

### What exists (reusable as-is)

| Area | Evidence |
|------|----------|
| Parser: struct/enum decls, `byte[N]`/`byte[]` types, `a[i]`, `s.f`, `Point { x: 1 }` (`let`-initialiser-only — `parseConstDecl` parses flag-false, PF-001), `sizeof(T)`/`offsetof(T,f)`/`length(e)` calls | `parse-decl.ts:169-297,316,355`, `parse-type.ts:41-88`, `pratt.ts:335` (struct-literal gate), `:438` (`parseStructLiteral`), `:491-548` (`parsePostfix` — `a[i]`/`s.f`), `:387-435` (`parseIntrinsicCall`) |
| Semantic types `ArrayType`/`StructType`/`EnumType` + `byteSize` totals | `packages/core/src/semantics/type.ts:30-55`, `type-utils.ts:90-111` |
| Pass-1 struct/enum collection with C-style offsets + enum backing values | `packages/frontend/src/semantics/declaration-collection.ts:48-139` |
| Lazy memoised `inProgress` type resolution (cycle mechanism already present) | `declaration-collection.ts:65,96-98` |
| SFA multi-byte slots (N-byte locals lay out today; module vars sized by `byteSize`) | `frame-computation.ts:29-76`, `model-adapter.ts:256-277` |
| IL ops `load_indexed`/`store_indexed`/`load_indirect`/`store_indirect` (typed, never emitted) | `packages/codegen/src/il/instruction.ts:114-127` |
| `ILOperand.location` with byte `offset` (proven end-to-end by `hi()`) | `operand.ts:25-30`, `lower.ts:1508` |
| All 14 addressing modes incl. `AbsoluteX/Y`, `IndirectY` | `packages/core/src/instr-model/addressing-mode.ts:24-39` |
| Const-data channel: `ILProgram.constData`, `segment:"data"` streams, `!byte`/`!fill` directives, serializer data section | `cfg.ts:64-91`, `stream.ts:37-76`, `serialize-acme.ts:118-125` |
| Intrinsic descriptors + fold lowering + validation for `sizeof`/`offsetof`/`length` | `catalog.ts:165-194`, `lower.ts:1325-1381`, `intrinsic-validation.ts:179-215` |
| Diagnostic codes registered-unwired: E10110–15, E10160–63, E10140–43, E10133, E10151, E10077 | `diagnostic-codes.ts:69-87,117,156,158-162` |
| Const-eval scalar engine with `ConstRefResolver` + `ConstTypeLookup` seams, `toBits`/`fromBits` | `const-eval.ts:64-67` (ConstRefResolver), `:69-74` (ConstTypeLookup), `:89-106` (toBits/fromBits), `:143` (evalConst) |
| 5b qualified-access ladder + import machinery (`import { a } from Mod;`) | `name-resolution.ts`, `nodes.ts:79-85` |
| 3-part acceptance harness pattern (fixture helper, assemble+VICE spec, golden spec, negatives spec) | `packages/test-harness/src/testing/slice6.ts`, `slice6*.spec.test.ts` |

## Gaps Identified

### Gap 1: Array literals do not parse (AR-2)
**Current:** `[1,2,3]` → `ExpectedExpression` (`pratt.ts:305`); no ArrayLit node in the closed
50-kind AST (`node-kind.ts:20-77`). Additionally (PF-001): `parseConstDecl` (`parse-decl.ts:355`)
parses its initialiser flag-false, so `const` initialisers cannot take ANY aggregate literal.
**Required:** `ArrayLitExpr` (elements + optional Ch-08 fill), initialiser (`let` + `const`) +
assignment-RHS contexts (AR-3/AR-18).
**Fix:** 03-01.

### Gap 2: Declaration tables are bare-name-keyed across ALL programs (defect, AR-7)
**Current:** `collectDeclarationTables` is invoked once over every program (`passes.ts:35`) and
keys by bare name (`declaration-collection.ts:51-61`) — two modules declaring `struct Point`
silently last-write-wins. Recursive structs are swallowed into a silent zero-size placeholder
(`:96-98`). Array sizes read only `NumericLitExpr` (`:84`).
**Required:** module-keyed tables; loud path-carrying cycle diagnostics; const-expression sizes.
**Fix:** 03-02 + 03-03.

### Gap 3: Type resolution rejects every non-primitive annotation
**Current:** `resolveTypeNode` returns `ERROR_TYPE` for `NamedType`/`ArrayType`
(`type-check/type-resolution.ts:23-25`) — it has no access to the declaration tables.
**Required:** thread the tables; resolve named/array types incl. `Mod.Type` (AR-7).
**Fix:** 03-02.

### Gap 4: Aggregate expression typing is silent poison
**Current:** `IndexExpr`/`StructLitExpr` → `ERROR_TYPE` no diagnostic
(`expression-typing.ts:140-143`); `s.f` struct arm silently poisons (`:693-697`);
`sizeof`/`offsetof`/`length` value-typing returns `ERROR_TYPE` (`:958`);
`isAssignableTo`/`commonType` are primitive-only (`type-utils.ts:164,197`).
**Required:** full aggregate typing arms + assignability/cast/comparison policy (AR-11..14,
AR-22, AR-24).
**Fix:** 03-04.

### Gap 5: Lowering/translate ICE on aggregate ops
**Current:** `lowerExpr` default arm ICEs on Index/StructLit (`lower.ts:722`); struct field
access ICEs (`:927`); array-element assign targets ICE (`:1228`; `:1241` is the qualified-target
arm); translate's default arm ICEs on
all four indexed/indirect ops (`translate.ts:366-367`); `constData` is frozen-empty
(`lower.ts:214`).
**Required:** scaled index lowering (AR-15), offset-location member access, literal
initialisation stores, const-data population, `load_indexed`/`store_indexed` translate arms
(tier-1 `abs,X` framings), `!byte` data streams.
**Fix:** 03-05 + 03-06.

## Dependencies

- **Internal:** Slice 6 expression engine (promotion, casts, const folds), 5b module
  merging/qualified access/init order, 5a call machinery (for `__rt_mul` scaling calls), 4a CFG
  keystone, RD-12 harness, RD-17 runtime routines. All shipped.
- **External:** ACME + VICE 3.10 locally for the acceptance tier (CI skips VICE per AR-27).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Unified const/type engine destabilises shipped scalar const-eval | Med | High | Engine wraps the existing `evalConst` seams (`ConstRefResolver`/`ConstTypeLookup`); scalar spec tests are the immutable oracle; ST regression rows |
| Golden churn from serializer/data-section changes | Med | Med | Data streams append AFTER code; initializer-free programs must stay byte-identical (Slice-5b `__init` precedent); all seven prior goldens re-verified NO re-mint |
| `needsDataInit` flag (`instr-program.ts:189`) trips when `constData` is non-empty and may drive an unwanted startup path | Low | Low | Resolved at preflight (PF-011): the flag has NO consumers — declared at `platform-plugin.ts:40`, read by nothing (contrast `hasInitCode` → `shared-hooks.ts:100-101`); it flips true harmlessly; 03-06's audit is confirmatory; goldens catch drift |
| Word-element indexed access clashes with the A:X word-value convention (X is the index register); the store direction can silently emit the index as data via a stale X mirror | Med | High | 03-06 §1's per-arm state-obligations block (PF-002/PF-004): prescan def/read fixes, load results stashed to home, the word-store source read from MEMORY before `LDX` (never via the X mirror after it), truthful `regA`/`regX` at arm exit; ST-53a/ST-54a + golden + VICE witness both directions |
| Module-keying the tables breaks 3b–6 single-module assumptions in hidden consumers | Low | High | `foldIntrinsic`/`sizeOfType` lookups updated in the same phase; full suite + all goldens as regression net |
| Aggregate params reachable through un-guarded paths (silent miscompile) | Low | High | Loud rejections at function-collection AND lowering (belt+braces, 5a two-guard precedent) |
