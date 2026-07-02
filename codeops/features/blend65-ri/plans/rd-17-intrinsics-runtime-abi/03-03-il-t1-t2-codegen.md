# IL & T1/T2 Codegen: RD-17

> **Document**: 03-03-il-t1-t2-codegen.md
> **Parent**: [Index](00-index.md)

## Overview

Descriptor-driven lowering: retire the name-switch in `lower.ts`, cover the full T2
surface (folds + inline load/store) and T1 opcodes, and replace the non-constant
address ICE with E10045.

## Architecture

### Current
- `codegen/src/il/lower.ts:270-300`: `lowerIntrinsic` switches on `expr.name` — `poke`→`store`, `peek`→`load`, else ICE; `addressLocation` ICEs on non-literal.
- `codegen/src/il/intrinsic-descriptor.ts`: local placeholder; the IL `intrinsic` op is never emitted.
- `codegen/src/instr/translate.ts`: no T1/T2 intrinsic handling (only mul/div/mod ops).

### Proposed
- `intrinsic-descriptor.ts` becomes a re-export of the core type (03-01); the IL
  `intrinsic` op's `descriptor` field carries the real descriptor.
- `lowerIntrinsic` dispatches on `descriptor.loweringStrategy` (R17, AR-49):

| Strategy | Lowering |
|----------|----------|
| `'fold'` | Evaluate at lower time → `Immediate` operand (`lo`/`hi` of constants; `sizeof`/`offsetof`/`length` from the AR-P13 type table carried on the `SemanticModel`) |
| `'inline'` | `peek`/`poke` → `load`/`store` (unchanged); `peekw`/`pokew` → two-byte `load`/`store` pairs (little-endian, `addr`/`addr+1` per Ch 12 §3.1); non-constant `lo`/`hi` → existing IL arithmetic (`AND #$FF` / shift pattern per RD-17 §4.3) |
| `'opcode'` | Emit IL `intrinsic` op carrying the descriptor (translate emits the opcode) |
| `'call'` | (T3/T4 — 03-04/03-05 handle translate-side; IL `intrinsic` op with descriptor) |

- `translate.ts` gains an `intrinsic` case: `'opcode'` strategy → exactly one `Instr`
  (mnemonic from a descriptor→`Opcode` map; Implied mode; AC-07); `'call'` → JSR +
  marshalling (03-04).
- `addressLocation` → on non-literal address: `bag.addError(DiagCode.NonConstantIntrinsicAddress, span, AR-P11 message)` and poison the statement (skip emission), NOT an ICE (AR-P5, R39).

## Implementation Details

### New/changed functions
- `lowerIntrinsic(expr, descriptor, ctx)` — strategy dispatch; the analyzer has already validated arity/availability (03-02), so lowering asserts-with-ICE only on genuinely impossible states (AC-17: no name-based special cases; `peek/poke` keying is by descriptor identity from the registry, not string switches — the descriptor's name is used only to select the *inline pattern function* from a `Map<string, InlineEmitter>` keyed at catalog-build time).
- `foldIntrinsic(expr, typeTable)` — pure; returns `number`; errors already caught by V7.
- `translateIntrinsic(instr, ctx)` — `'opcode'` path; one `instr(op, Implied)` entry.

### Fold semantics (Ch 12 §3.3, PF-005)
- `sizeof(type)` → byte size from the type table (primitives fixed; structs `byteSize`).
- `offsetof(type, field)` → field offset.
- `length(array)` → element count; result type `byte` if ≤255 else `word`.
- Folds produce **no runtime code** (AC-09) — pure `Immediate` operands.

## Integration Points
- Consumes: registry/descriptors (03-01), type table on `SemanticModel` (03-02).
- Produces: IL consumed by translate; `intrinsic` ops consumed by 03-04's call path.
- `generateInstr`/`assembleProgram` signatures unchanged (plugin injection stays the RD-07c seam).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Non-constant T2 address | E10045, poison statement, continue | AR-P5, R39 |
| Fold on unresolvable type (analyzer missed) | ICE `E90001` — V7 should have caught it | AC-17 |
| T1 opcode missing from CPU set at translate time | ICE — availability (V4) should have caught it | R24 |

## Testing Requirements
- Spec: each T1 name → exactly its opcode (AC-07); `peek/poke/peekw/pokew` inline shapes (AC-08); fold cases incl. struct/array (AC-09); E10045 case.
- Impl: little-endian pair ordering, poison-statement recovery, descriptor-map completeness sweep (every catalog entry has an emitter or fold).
