# IL Data Model: RD-06 IL & IL Optimizer

> **Document**: 03-01-il-data-model.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-06 R1–R28, R64–R67, §4.1–§4.5 · AR-45/AR-46/AR-47/AR-48/AR-52

## Overview

The IL data model is the **low-churn substrate** the optimizer (RD-06/RD-08) and codegen
(RD-07) both depend on, so it is built **completely and up front** (register D1). It is a
flat three-address code (TAC) over mutable, explicitly typed virtual temps, organized into
basic-block CFGs — **no SSA, no φ-nodes** (AR-45/AR-48). All records are `readonly`
(immutability is a contract: the optimizer reads, codegen reads — R67).

This document fixes the TypeScript shapes verbatim from RD-06 §4.1–§4.5. No behavior lives
here beyond trivial type-guards and constructor helpers.

## Architecture

### Files (`packages/codegen/src/il/`)

| File | Exports |
| ---- | ------- |
| `il-type.ts` | `ILType`, `IL_BYTE`/`IL_SBYTE`/`IL_WORD`/`IL_SWORD`, `ilTypeOfType(t: Type): ILType`, `ilTypeEquals` |
| `operand.ts` | `ILOperand` union + `imm()`/`temp()`/`loc()` constructor helpers + type-guards |
| `instruction.ts` | `ILInstruction` union, `ILTerminator` union, opcode string-literal tuples |
| `cfg.ts` | `BasicBlock`, `ILFunction`, `ILProgram`, `ConstDataEntry` |
| `index.ts` | barrel for the above (+ lowering/printer from 03-02/03-03) |

## Implementation Details

### IL types (`il-type.ts`) — R3/R5/R6/§4.1

```typescript
export interface ILType {
  readonly width: 8 | 16;
  readonly signed: boolean;
}

export const IL_BYTE:  ILType = { width: 8,  signed: false }; // byte, boolean, enum
export const IL_SBYTE: ILType = { width: 8,  signed: true  }; // sbyte
export const IL_WORD:  ILType = { width: 16, signed: false }; // word, struct/array by-ref ptr
export const IL_SWORD: ILType = { width: 16, signed: true  }; // sword

export function ilTypeEquals(a: ILType, b: ILType): boolean;

/**
 * Map a Blend65 `Type` (RD-04) to its IL type (R3, §4.1 table).
 * boolean/enum → IL_BYTE; struct/array (by-ref) → IL_WORD.
 * `ErrorType` → IL_BYTE (functions carrying ErrorType are skipped before lowering, R68,
 * so this is a safe-but-unreached default; documented, never undefined).
 */
export function ilTypeOfType(t: Type): ILType;
```

> **Note (R5/R6):** there is no distinct boolean/enum IL type — boolean is `IL_BYTE` with
> values 0/1, enum identity is erased to `IL_BYTE`. This is fixed by the §4.1 mapping table.

### IL operands (`operand.ts`) — R7–R11/§4.2

```typescript
export type ILOperand =
  | { readonly kind: "immediate"; readonly value: number; readonly type: ILType }
  | { readonly kind: "temp";      readonly id: number;    readonly type: ILType }
  | { readonly kind: "location";  readonly symbol: string; readonly offset?: number; readonly type: ILType };

export function imm(value: number, type: ILType): ILOperand;             // R8
export function temp(id: number, type: ILType): ILOperand;              // R9
export function loc(symbol: string, type: ILType, offset?: number): ILOperand; // R10/R11

export function isImmediate(o: ILOperand): o is Extract<ILOperand, { kind: "immediate" }>;
export function isTemp(o: ILOperand): o is Extract<ILOperand, { kind: "temp" }>;
export function isLocation(o: ILOperand): o is Extract<ILOperand, { kind: "location" }>;
```

- `Location.symbol` references an `AllocationPlan` symbol name (`__frame_*`/`__var_*`/
  `__zp_*`) or a function/code label; addresses stay symbolic through IL (AR-52, R10/R11).
- `&functionName` / `&variable` lower to `Immediate`/`Location` carrying the label (R11/R51)
  — *the lowering of `&` is deferred per slice; the operand shape supports it now.*

### IL instructions (`instruction.ts`) — R17–R28/§4.3

The full union is defined now (built completely, D1). Opcode names live in a runtime tuple
(mirroring `NODE_KINDS`) so the printer and any future pass can enumerate them and the union
cannot drift from the string set.

```typescript
export type ILInstruction =
  // Arithmetic (R18)
  | { readonly op: "add" | "sub" | "mul" | "div" | "mod";
      readonly dest: ILOperand; readonly left: ILOperand; readonly right: ILOperand; readonly type: ILType }
  | { readonly op: "neg"; readonly dest: ILOperand; readonly src: ILOperand; readonly type: ILType }
  // Bitwise (R19)
  | { readonly op: "and" | "or" | "xor" | "shl" | "shr";
      readonly dest: ILOperand; readonly left: ILOperand; readonly right: ILOperand; readonly type: ILType }
  | { readonly op: "not"; readonly dest: ILOperand; readonly src: ILOperand; readonly type: ILType }
  // Comparison — result is IL_BYTE (R20)
  | { readonly op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
      readonly dest: ILOperand; readonly left: ILOperand; readonly right: ILOperand; readonly type: ILType }
  // Conversion (R21)
  | { readonly op: "zext" | "sext" | "trunc"; readonly dest: ILOperand; readonly src: ILOperand }
  // Memory (R22–R24)
  | { readonly op: "load" | "store"; readonly a: ILOperand; readonly b: ILOperand }
  | { readonly op: "load_indexed" | "store_indexed";
      readonly value: ILOperand; readonly base: ILOperand; readonly index: ILOperand }
  | { readonly op: "load_indirect" | "store_indirect";
      readonly value: ILOperand; readonly ptr: ILOperand; readonly offset: ILOperand }
  // Copy / const (R27/R28)
  | { readonly op: "copy" | "const"; readonly dest: ILOperand; readonly src: ILOperand }
  // Call (R25/R26)
  | { readonly op: "call"; readonly dest?: ILOperand; readonly target: string; readonly args: readonly ILOperand[] }
  | { readonly op: "intrinsic"; readonly dest?: ILOperand; readonly name: string;
      readonly args: readonly ILOperand[]; readonly descriptor: IntrinsicDescriptor }
  // Debug span (carried for diagnostics; AR-54 analog)
  | { readonly op: "source_span"; readonly span: SourceSpan };

export type ILTerminator =
  | { readonly kind: "br"; readonly target: string }                                            // R13
  | { readonly kind: "brcond"; readonly cond: ILOperand; readonly trueTarget: string; readonly falseTarget: string }
  | { readonly kind: "ret"; readonly value?: ILOperand }
  | { readonly kind: "unreachable" };
```

> **`load`/`store` operand naming.** RD-06 §4.3 writes `load { dest, src }` and
> `store { src, dest }` — the *semantic* roles differ but both are "one value operand + one
> memory operand." To avoid a footgun where `dest`/`src` swap meaning between `load` and
> `store`, this plan uses neutral `a`/`b` positions with a documented convention:
> **`load`: `a`=destination temp, `b`=source location; `store`: `a`=source value, `b`=
> destination location.** The printer renders them in the §4.6 order (`load %t, sym` /
> `store %t, sym`). *(This is a naming refinement of §4.3, not a semantic change — recorded
> for traceability; if the user prefers literal `dest`/`src` fields per op, that is a
> one-line change. Surfaced as a watch-item, not a new AR, because it does not alter
> behavior or the printed form.)*

> **`IntrinsicDescriptor`** (R26) is owned by RD-17. It does not exist yet. For v1 the
> `intrinsic` instruction references it by a **structural placeholder type** (`name` +
> `args`); the `descriptor` field is typed as `IntrinsicDescriptor` imported from a local
> `il/intrinsic-descriptor.ts` **minimal interface** (name, tier?, clobber?) that RD-17 will
> supersede additively. v1 lowering emits **no** `intrinsic` instructions (poke/peek are
> `load`/`store`, R46) — the shape exists for the model to be complete.

### CFG records (`cfg.ts`) — R12/R15/R16/R64–R67/§4.4–§4.5

```typescript
export interface BasicBlock {
  readonly label: string;                       // unique within the function ("_entry", "_L0", ...)
  readonly instructions: readonly ILInstruction[];
  readonly terminator: ILTerminator;
}

export interface ILFunction {
  readonly name: string;                        // fully qualified "Module.function"
  readonly params: readonly ILOperand[];        // Location operands from the AllocationPlan
  readonly returnType: ILType | "void";
  readonly blocks: readonly BasicBlock[];       // blocks[0] is always the entry block (R16)
  readonly tempCount: number;                   // total virtual temps used
  readonly isInterrupt: boolean;
}

export interface ConstDataEntry {
  readonly symbol: string;                      // ACME label
  readonly data: Uint8Array;
  readonly type: "array" | "struct" | "embed";
}

export interface ILProgram {
  readonly functions: readonly ILFunction[];
  readonly initCode: readonly BasicBlock[];     // module-level init (startup); empty in v1
  readonly constData: readonly ConstDataEntry[];// empty in v1
  readonly allocationPlan: AllocationPlan;       // carried for codegen (R66)
}
```

- **Labels** are unique per function, generated deterministically `_L0`, `_L1`, … by the
  builder (R15); entry is `_entry` and is always `blocks[0]` (R16).
- **`initCode`/`constData`** are present in the shape (R64) but **empty** in v1 (module-var
  init ordering AR-91 and const/embed data arrive with their slices).

## Integration Points

- `ilTypeOfType` consumes RD-04 `Type`; `Location.symbol` consumes RD-05 symbol names;
  `ILProgram.allocationPlan` carries the RD-05 plan to RD-07.
- The whole model is re-exported from `packages/codegen/src/index.ts` so RD-07 can import it.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `ilTypeOfType(ErrorType)` reached | return `IL_BYTE` (documented safe default; error functions are skipped before lowering, R68) | D5 |
| operand/instruction constructed with mismatched widths | not validated at model level (lowering is responsible; a future verifier may add asserts) | R3 |

> **Traceability:** every shape above is RD-06 §4.1–§4.5 verbatim except the `load`/`store`
> `a`/`b` naming refinement and the minimal `IntrinsicDescriptor` placeholder, both recorded
> above and neither altering behavior.

## Testing Requirements

- Spec tests (ST-M*, see `07-testing-strategy.md`): type-mapping table (every Blend65 type →
  correct `ILType`), operand constructors/guards, instruction/terminator construction,
  `ILProgram` carries the plan, immutability (frozen).
- Impl tests: `ilTypeEquals` edge cases; `ilTypeOfType` for each `Type` variant incl. the
  `ErrorType` default.
