# SFA & IL Lowering: RD-18 Slice 7a

> **Document**: 03-05-sfa-lowering.md
> **Parent**: [Index](00-index.md)

## Overview

Feeds SFA typed aggregate slots (mostly already working), lowers aggregate access to the
existing offset-`location` + the newly-emitted `load_indexed`/`store_indexed` ops with
lowering-owned scaling (AR-15), realises literal initialisation, and populates the dormant
`constData` channel for const aggregates.

## Implementation Details

### 1. SFA (small — the allocator is ready)
- Locals/params: `FrameVar.type` now carries real aggregate types; `slotSize`
  (`frame-computation.ts:29-37`) already sizes locals by `byteSize` (arrays/structs get N
  contiguous bytes, no padding — RD-05 R3). `byRef` stays `false` in 7a (params rejected).
- Module `let` aggregates: `modelToModuleVars` already sizes by `byteSize` → `__var_*` at
  `dataBase` unchanged.
- **Const aggregates own NO `dataBase` allocation** — they live in-image under a data label
  `__data_<Module>_<name>` (the 5b "module const owns no storage symbol" invariant, aggregate
  exception per 03-03 §5). The adapter excludes them from module-var projection; lowering maps
  reads to the label.
- Scaling temps are ordinary block-local IL temps (straight-line code, no CFG diamonds — no
  new synthetic-slot kinds; the Slice-6 `0sc` machinery is untouched).

### 2. Address shape: `lowerPlace`
One helper lowers any l-value/read chain to `{ baseSymbol, constOffset, indexTemp | null }`:
- `Ident` → frame/`__var_`/`__data_` symbol, offset 0
- `.field` → `constOffset += offsetof` (compile-time, from the engine)
- `[constIdx]` → `constOffset += idx × elemSize` (zero runtime cost — direct absolute)
- `[runtimeIdx]` → scaling per AR-15: `idxTemp = idx` (byte) or `idx × elemSize` via the
  existing `mul` path (const-scale folds; the shipped `translateMul` ladder then emits an ASL
  sequence + **W10172** for power-of-two element sizes — the canonical 2-byte `Point` case,
  matching spec 08 §10.2's own codegen shape — and `JSR __rt_mul8` + **W10170** only for
  non-power-of-two sizes; attribution corrected at preflight, PF-003; Phase B
  strength-reduces further); multiple runtime indexes in one chain fold into one running byte-offset
  temp via `add`. Index arithmetic is byte-domain in 7a (tier-1 arrays are ≤256 B; offsets fit
  a byte — the tier-1 guarantee 03-02 §4 enforces at declaration).
Reads/writes then emit:
- no `indexTemp` → existing `load`/`store` on `loc(baseSymbol, ilType, constOffset)` (the
  `hi()`-proven path)
- `indexTemp` → **`load_indexed`/`store_indexed`** with `base = loc(baseSymbol, ilType,
  constOffset)`, `index = indexTemp` (index = BYTE offset per AR-15; translate stays
  arithmetic-free)
- word elements: IL_WORD indexed ops (translate handles the two-byte framing, 03-06)

### 3. Aggregate statements/expressions
- **Whole-struct copy** `p = q` (R37): unrolled per-byte `load`/`store` pairs over `byteSize`
  (correctness-first; both sides resolved via `lowerPlace`, offsets `+0..+N-1`)
- **StructLit / ArrayLit initialisation**: local `let` → inline per-field/element stores
  (runtime element exprs legal per AR-11, evaluated left-to-right, declaration order = layout
  order per AR-9 keeps emission trivially sequential); module `let` → same stores into the
  `__init` stream (5b seam); fill → stores of the fill value for remaining slots (bounded by
  the declared size — unrolled; tier-1 ≤256 iterations)
- **Const aggregates** → `ILProgram.constData` entry `{ symbol: "__data_<Module>_<name>",
  data: image.bytes, type: "array" | "struct" }` from the 03-03 image (`ConstDataEntry.type`
  has a third member `"embed"` — `cfg.ts:64-71` — that 7a never constructs; exhaustive
  switches over the field must still handle it, PF-012); use-site reads resolve
  to the label (never inlined as immediates — arrays/structs are memory)
- **Enum ops**: already-byte semantics — members fold to byte consts (03-03), casts are
  zero-cost re-types (`zext` fold for enum→word per Slice-6 machinery)
- **`length`/`sizeof`/`offsetof`**: fold path exists (`foldIntrinsic`) — switch lookups to
  FQN-keyed tables (03-02 §1) and route through the engine, including `sizeOfType`'s
  independent literal-only array-size read (`lower.ts:1346-1363` re-reads `NumericLitExpr`
  today — it must consume engine-computed sizes instead; PF-006)
- **Aggregate params**: the lowering-side loud guard (braces to 03-04's belt)

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Aggregate param reaches lowering | loud ICE "unsupported until 7b" (never miscompile) | AR-1 |
| >256 B array reaches lowering | unreachable (03-02 rejects); assert-ICE backstop | AR-1 |
| constData symbol collision | impossible by construction (FQN naming); assert-ICE | AR-7 |

## Testing Requirements
- Spec: ST-49..ST-52 (IL shapes via `emitIl`). Impl: `lowerPlace` unit matrix (const/runtime ×
  field/index nesting), image→constData byte equality, `__init` ordering with aggregates.
