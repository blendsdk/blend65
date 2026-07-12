# Current State: RD-18 Slice 7b — Pointer surface

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> Working tree at commit `9fb607e` (branch `v3`, Slice 7a complete, 64/64).

## Existing Implementation

### What Exists — the shipped-but-dark pointer machinery

The by-ref infrastructure is ~80% pre-built and entirely dormant:

- **`Symbol.byRef`** (`packages/core/src/semantics/symbol.ts:60`) and **`FrameVar.byRef`**
  (`packages/core/src/sfa/function-info.ts:32`) exist; hardcoded `false` at every creation
  site (`function-collection.ts:138,178,320`; `model-adapter.ts:104,314`;
  `module-variable-collection.ts:68`; `declaration-collection.ts:131`).
- **`slotSize()`** (`packages/frontend/src/sfa/frame-computation.ts:29-37`) ALREADY gives a
  parameter of struct/array type a 2-byte pointer frame slot — the Ch 11 §3.3 accounting is
  implemented and tested; it just never receives an aggregate-typed param symbol.
- **`computePeakPointers`** (`packages/frontend/src/sfa/zp-allocator.ts:98-122`) computes the
  conservative peak of simultaneously-live by-ref pointers (own + interfering neighbours);
  **`allocateZeroPage`** (`:152-223`) places `__zp_ptr_N` pairs (2 bytes, category `"pointer"`)
  between user ZP vars and `__zp_tmp_N`. Peak is always 0 today → zero pairs allocated.
- **IL ops** (`packages/codegen/src/il/instruction.ts:121-127`):
  `{ op: "load_indirect" | "store_indirect"; value; ptr; offset }` — modeled, in `IL_OPS`,
  printed by `--emit-il`. **Prescan liveness is already correct**: `destTempId` returns
  `value.id` for the load / `null` for the store (`translate.ts:1619-1641`); `readOperands`
  returns `[ptr, offset]` / `[ptr, offset, value]` (`:1665-1710`).
- **`IndirectY`** addressing ships end-to-end below IL: the mode
  (`core/src/instr-model/addressing-mode.ts:36`), CPU legality for LDA/STA
  (`codegen/src/instr/cpu-table.ts:38-39`), stream validation, and the ACME rendering
  `(${operand}),Y` (`codegen/src/instr/print-instr.ts:128-129`).
- **Instr operands** (`core/src/instr-model/operand.ts:30-40`): `symbolRef` carries
  `byteSelect: "low" | "high"` (renders `#<sym` / `#>sym`) and `zpSlot` names ZP allocations.
  ZP symbols are emitted as absolute `$00xx` addresses in the ACME header
  (`frontend/src/sfa/symbols.ts:81-85`).
- **c64 ZP grant**: `$02–$8F`, 142 bytes (`packages/platforms/src/c64.ts:50-51`). Today's
  fixed layout: `__zp_arg_0..3` ($02–$05), `__zp_tmp_0..3` ($06–$09), `__zp_irq_tmp_0..1`
  ($0A–$0B) — 10 bytes; the eight committed goldens pin these addresses.
- **Calling convention (5a)**: lowering stores each argument into
  `__frame_<Callee>_<param>` before a bare `JSR` (`lower.ts:825-848`, `call` op with
  `args: []` by design); results bind A / A:X (`translate.ts:403-426`); the never-miscompile
  guards (same-callee-in-later-arg at lowering `:804-823`; value-live-across-call at
  translate) are in force.
- **7a Place machinery** (`lower.ts:1367-1481`): `Place { symbol, constOffset, index }`,
  `lowerPlace`/`basePlace`/`scaleIndex`/`addByteOffsets`/`emitPlaceLoad`/`emitPlaceStore` —
  byte-offset index domain, direct bases only, `load_indexed`/`store_indexed` emission.
- **7a translate state discipline**: `regA`/`regX` mirrors, `protectA()` remaining-uses
  spill, `indexIntoX`, `foldStoreHome`, binder ZP spill over the `__zp_tmp_N` runs
  (`register-binding.ts:133-135,205-223`), per-block `resetBlockState`.

### The two rejections this plan retires

| Rejection | Location | Trigger |
| --------- | -------- | ------- |
| Aggregate params (E90001 ICE) | `frontend/src/semantics/annotation-resolution.ts:121-131` | any param whose annotation is an `ArrayType` node or resolves to a struct symbol (syntactic `annotationKind`) |
| >256-byte arrays (E90001 ICE) | `frontend/src/semantics/type-check/type-resolution.ts:72-81` | `byteSize(element) * size > 256` in full mode; returns `ERROR_TYPE` |

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `frontend/src/parser/parse-decl.ts:53-94` | param parsing | accept `[const]` before the type ([03-01](03-01-parser-params.md)) |
| `frontend/src/parser/parse-type.ts:82-101` | array-type suffix | none for `[]` (already `size: null`); param-context acceptance is semantic |
| `core/src/ast/nodes.ts` (`ParameterNode`) | param AST | `isConst` field (no new kind; AST stays 51) |
| `core/src/semantics/type.ts:30-35` | `ArrayType` | `size: number \| null` (AR-5) + ripples through `byteSize`/`type-utils` |
| `core/src/semantics/type-utils.ts` | assignability | `T[N] → T[]` param arm; unsized never a common type |
| `core/src/semantics/symbol.ts` | symbol model | `byRef` finally set true; const params `mutable: false` |
| `frontend/src/semantics/function-collection.ts:155-181,335-337` | param symbols | real aggregate param types; `byRef`; `isConst` → `mutable` |
| `frontend/src/semantics/annotation-resolution.ts` | boundary checks | retire the param ICE; keep E10120/E10093 returns |
| `frontend/src/semantics/type-check/type-resolution.ts:59-81` | type resolution | retire the >256 gate; unsized param context; W10142/W10143 hooks |
| `frontend/src/semantics/type-check/expression-typing.ts` | typing | tier branch (E10117/E10118), unsized index widths, E10122 arg checks, E10123 via `assignmentRootSymbol`, W10112, `length()` rules, `signatureOf` full types |
| `frontend/src/sfa/{model-adapter,zp-allocator,plan-allocation,symbols}.ts` | SFA | thread `byRef`; pair coloring + naming; scratch predicate; symbol emission |
| `codegen/src/il/operand.ts` | IL operands | new `addr` kind (AR-12) |
| `codegen/src/il/lower.ts` | lowering | Place base kinds (direct/pair), by-ref marshalling, prologue copies, tier-2 formation, arg-form ICEs, struct copy through pairs |
| `codegen/src/instr/translate.ts` | translation | `translateLoadIndirect`/`translateStoreIndirect`, regY mirror, scratch staging + backstop ICE, `addr` store arm |
| `core/src/diagnostics/diagnostic-codes.ts` | registry | +E10122/E10123/W10112/W10142/W10143 (AR-9) |
| `test-harness` (+`examples/slice7b/`) | acceptance | fixture, golden, VICE suite, negatives |

## Gaps Identified

### Gap 1: No IL address form
**Current:** `il/operand.ts:22-29` has immediate/temp/location only — lowering cannot express
"store the address of `__var_Main_boss` into a frame slot".
**Required:** the AR-12 `addr { symbol, offset }` operand, store-source-only, ICE elsewhere.

### Gap 2: No param→pair binding
**Current:** `__zp_ptr_N` is an anonymous pool; nothing maps a specific by-ref param to a pair.
**Required:** per-param pair symbols overlaid by interference coloring ([03-03](03-03-sfa-pointers.md)).

### Gap 3: Unsized type unrepresentable semantically
**Current:** `ArrayType.size: number` mandatory; AST `size: null` exists but semantic layer
infers or errors. `signatureOf` resolves param types in scalar mode → `ERROR_TYPE` for aggregates.
**Required:** `size: number | null` param-scoped; full-mode signature resolution.

### Gap 4: Translate has no Y-register discipline
**Current:** `regA`/`regX` mirrors only; nothing emits LDY.
**Required:** regY mirror + invalidation audit for every emitted Y-touching sequence
(challenger obligation, [03-05](03-05-translate-indirect.md)).

## Dependencies

### Internal
- 7a's const/type engine (struct layouts, const images, `__data_*` streams) — consumed as-is.
- 5a's calling convention + interference graph (incl. argument-window edges) — extended, not changed.
- Slice 6 word arithmetic + zext folds — reused for tier-2 pointer formation.

### External
- None new. VICE 3.10 + ACME local for the acceptance tier (AR-27 unchanged).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| ZP layout shift breaks prior goldens | Med | High | AR-4 conditional reservation; goldens re-run at every phase; predicate spec-tested (ST-29..ST-31, ST-65) |
| Scratch demanded but unreserved (predicate hole) | Low | High | challenger-hardened predicate incl. const aggregates + loud translate ICE backstop (never a dangling symbol) |
| Y-mirror staleness (the 7a X-mirror lesson) | Med | High | regY cleared before every LDY-affecting boundary; audit checklist in 03-05; golden + VICE proof |
| Pair clobber across calls | Low | High | pairs written only in own activation (AR-2); interference coloring bounds; never-miscompile ICE guards stay |
| `addr` operand leaking into untaught IL paths | Low | Med | union exhaustiveness + explicit ICE arms (AR-12) |
| slice3b VICE flake noise during acceptance | Med | Low | known flake — re-run in isolation before diagnosing (memory note) |
