# RD-06: Intermediate Language (IL) & IL Optimizer

> **Status**: 🟢 Implemented (walking-skeleton slice scope — see Implementation Note)
> **MVP Phase**: A
> **Depends On**: RD-05
> **Implements**: `spec-v3.0` Ch 02–06, Ch 08–09, Ch 11–13 (all language constructs
>   that must be lowered to IL); Ch 14 (W10130 unreachable-code via DCE on IL CFG)
> **Owning package(s)**: `@blend65/codegen` (IL representation, AST→IL lowering,
>   IL optimizer passes)
> **Created**: 2026-05-31
> **Last Updated**: 2026-06-05

---

> **Implementation Note (2026-06-05, plan `plans/rd-06-il-optimizer/`):** RD-06 was
> implemented under the **walking-skeleton slice scope** (plan register D1). The **full IL
> data model**, the **deterministic textual printer** (`printIL`), and the **passthrough
> optimizer pipeline** (`optimizeIL`) are complete; **AST→IL lowering** is implemented for
> the **gate + slice-2 surface** (`let`/assign/return/`poke`/`peek`/same-width binary/ident/
> literals) behind an extensible visitor whose default raises an `E90001` ICE (D6/R69) — every
> other AST node kind is a documented, tested slice boundary, not a silent gap. Lowering is
> **fixture-tested** today (D5); the only deferred piece is the live compiler-façade wiring
> (`analyze()`→`planAllocation()`→`lowerToIL()`), which lights up unchanged when RD-04b
> populates the `SemanticModel`. Two runtime decisions refined the textual surface: **D8** —
> function-header params render verbatim from their `AllocationPlan` frame-slot `Location`
> symbols (`__frame_Math_add_a: i8u`); **D9** — the `poke`/`peek` address lowers to a symbolic
> `location` (`$D020`), keeping addresses symbolic through the IL (AR-52). See the plan's
> `00-ambiguity-register.md` (D1–D9). **Node-kind count:** RD-03 ships **50** node kinds
> (AR-1 removed `AsmBlock`); references to "51 kinds" below predate that and should read 50.

---


## 1. Purpose

This document specifies the **Intermediate Language (IL)** of the Blend65 compiler —
the target-independent representation between the validated AST+SemanticModel (from
RD-04) and 6502 code generation (RD-07). The IL is a **flat three-address code (TAC)**
over mutable typed virtual temps, organized into basic-block control-flow graphs (CFGs).
SSA was explicitly rejected after the v2 experience — φ-node/dominance costs invert on
a 3-register 8-bit target (AR-45).

The IL serves three purposes:
1. **Desugar** high-level AST constructs (if/else, while, for, switch, ternary, short-circuit, compound assignment) into a flat, explicit control-flow representation
2. **Materialize** type promotions, casts, and struct/array access patterns that the AST leaves implicit
3. **Provide an optimization substrate** for target-independent passes (constant folding, dead-code elimination, strength reduction) before platform-specific codegen

The IL optimizer (Optimizer 1) is a **passthrough in v1** — it exists as an architectural
seam so optimization passes can be added incrementally without restructuring the pipeline.
The walking-skeleton methodology (AR-38) builds this seam from slice 1; actual passes
come online as the language surface grows.

Per AR-50, there are exactly **two lowering levels**: IL (this document) and `Instr`
(RD-07). There is no third "ASM-IL" tier — the v2 trap of a spec'd assembly
intermediate is explicitly avoided.

---

## 2. Scope

**In scope:**

- IL instruction set: complete opcode catalog for all Blend65 language constructs
- IL typing model: every temp and operation carries `{width: 8|16, signed: boolean}` (AR-46)
- IL operand model: immediate / virtual temp / symbolic location (AR-52)
- Basic-block CFG: `br`/`brcond`/`jmp` + labels, no φ-nodes (AR-48)
- AST→IL lowering: translation rules for every AST node kind (51 kinds from RD-03)
- Intrinsics in IL: compile-time folding, `load`/`store` for peek/poke, `call` for T1/T3/T4 (AR-49)
- Type-promotion materialization: explicit `zext`/`sext`/`trunc` ops (AR-46)
- IL textual form: stable pretty-print for golden-snapshot testing and `--emit-il` (AR-51)
- IL optimizer architecture: pass pipeline with v1 passthrough
- IL optimizer passes (planned): constant folding, dead-code elimination, strength reduction
- `ILProgram` output record: consumed by RD-07 codegen

**Out of scope (and where it lives instead):**

- Semantic analysis, type checking, call-graph construction → RD-04
- SFA frame addresses, ZP allocation → RD-05 (consumed by IL lowering via `AllocationPlan`)
- 6502 instruction selection (IL→`Instr`) → RD-07
- Peephole optimization on `Instr` list → RD-08
- ACME emission → RD-09
- Register allocation (A/X/Y + ZP-scratch binding) → RD-07 (AR-47)

> **Traceability rule:** Every decision below must cite the Ambiguity Register entry
> (`AR-NN`, in `00-ambiguity-register.md`) that resolved it, or the frozen spec section
> it implements. No decision may be invented here — discovery is closed.

---

## 3. Decisions & Requirements

### 3.1 IL Shape & Typing

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R1 | IL is flat three-address code (TAC) | Every IL instruction has at most one destination temp and at most two source operands. No tree nesting, no expression DAGs | AR-45 |
| R2 | SSA is not used | No φ-nodes, no dominance frontiers, no SSA construction/destruction. Temps are mutable — the same temp can be assigned multiple times | AR-45 |
| R3 | Every temp and operation is explicitly typed | Each temp carries `ILType = { width: 8 | 16, signed: boolean }`. Operations specify their operand and result types. Codegen never re-derives types from context | AR-46 |
| R4 | Type promotions are explicit IL ops | The AST→IL lowering inserts explicit `zext` (zero-extend byte→word), `sext` (sign-extend sbyte→sword), and `trunc` (word→byte) instructions wherever the Ch 02 promotion rules require widening or where an explicit `as` cast narrows | AR-46, Ch 02 TS-4/TS-9 |
| R5 | Boolean is represented as 8-bit unsigned | `boolean` is `{ width: 8, signed: false }` with values 0 (false) and 1 (true). No separate boolean IL type — boolean-specific semantics are handled at AST level | Ch 02 TS-6 |
| R6 | Enum values are represented as 8-bit unsigned | Enum types are lowered to `{ width: 8, signed: false }` in IL — the enum identity is erased | Ch 09 |

### 3.2 IL Operand Model

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R7 | IL operands are a discriminated union | Every operand is exactly one of: `Immediate(value, type)`, `Temp(id, type)`, `Location(symbol, offset?, type)` | AR-52 |
| R8 | `Immediate` holds a compile-time constant | Integer literal value (number) with its `ILType`. Used for numeric literals, const-folded expressions, compile-time intrinsic results | AR-52 |
| R9 | `Temp` is a virtual temporary | Identified by a unique integer ID. Unlimited count — binding to A/X/Y and ZP-scratch is deferred to RD-07 codegen | AR-47, AR-52 |
| R10 | `Location` is a symbolic memory reference | References a named memory location from the `AllocationPlan`: frame slot (`__frame_Mod_fn_var`), module variable (`__var_Mod_name`), or ZP variable (`__zp_Mod_name`). Optional `offset` for struct field access. No hard addresses — ACME resolves via labels | AR-52, AR-66 |
| R11 | Function addresses use `Location` with a code label | `&functionName` becomes a `Location` referencing the function's code label (resolved by ACME at assembly time) | AR-52, Ch 04 §8 |

### 3.3 Control-Flow Representation

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R12 | IL is organized into basic blocks within a CFG | Each function is lowered to a `CFG` of `BasicBlock` nodes. Each block has a label, a sequence of non-branching instructions, and a terminator | AR-48 |
| R13 | Terminators are `br`, `brcond`, `jmp`, `ret` | `br(label)` = unconditional branch; `brcond(cond, trueLabel, falseLabel)` = conditional branch; `jmp(label)` = jump (same as `br` but used for switch); `ret(value?)` = function return | AR-48 |
| R14 | No φ-nodes | Since the IL is non-SSA, there are no φ-nodes. Values flow through memory (locations) or through temp re-assignment at merge points | AR-45, AR-48 |
| R15 | Labels are unique per function | Each label is a string unique within the function's CFG. Labels are generated deterministically (`_L0`, `_L1`, ...) | AR-48 |
| R16 | The entry block is always the first block | The function's entry point is block 0 (label `_entry`). Parameters are available as `Location` operands from the `AllocationPlan` | AR-48 |

### 3.4 IL Instruction Set

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R17 | The IL has a fixed instruction set covering all language constructs | Every AST node kind that produces runtime behavior has a corresponding IL lowering. Compile-time-only constructs (type annotations, const declarations, struct/enum definitions) produce no IL | All spec chapters |
| R18 | Arithmetic instructions: `add`, `sub`, `mul`, `div`, `mod`, `neg` | Binary ops take two operands + destination temp. `neg` is unary. All carry their `ILType` for signed/unsigned dispatch | Ch 04 §3 |
| R19 | Bitwise instructions: `and`, `or`, `xor`, `not`, `shl`, `shr` | `shr` on signed types is arithmetic shift (sign-extending); on unsigned it is logical shift (zero-fill) | Ch 04 §4, Ch 02 TS-19 |
| R20 | Comparison instructions: `eq`, `ne`, `lt`, `le`, `gt`, `ge` | Binary ops producing an 8-bit boolean temp. Signed/unsigned comparison selected by operand type | Ch 04 §5 |
| R21 | Type conversion instructions: `zext`, `sext`, `trunc` | `zext`: 8→16 unsigned; `sext`: 8→16 signed; `trunc`: 16→8 (keeps low byte) | AR-46, Ch 02 TS-4/TS-9 |
| R22 | Memory instructions: `load`, `store` | `load(location) → temp`: read from a symbolic location; `store(operand, location)`: write to a symbolic location. Used for variable access, peek/poke, struct field, array element | AR-49, AR-52 |
| R23 | Indexed memory: `load_indexed`, `store_indexed` | Array element access with base location + index operand. The index may be a temp or immediate | Ch 08 |
| R24 | Indirect memory: `load_indirect`, `store_indirect` | Struct/array by-ref parameter access via ZP pointer. Base pointer loaded to ZP, offset in Y register. Maps to 6502 `(ptr),Y` addressing | Ch 06 FN-3, Ch 07, Ch 08 |
| R25 | Call instructions: `call`, `call_void` | `call(target, args[]) → temp`: call function, result in temp; `call_void(target, args[])`: call void function. Target is a function label. Args map to callee frame slots via `AllocationPlan` | Ch 06 §5 |
| R26 | Intrinsic call: `intrinsic_call` | `intrinsic_call(descriptor, args[]) → temp?`: calls an intrinsic by its AR-29 descriptor. The descriptor carries tier, ABI, clobber info. Codegen dispatches on tier at `Instr` generation | AR-49, AR-29 |
| R27 | Copy instruction: `copy` | `copy(src, dest)`: copies one operand to another. Used for parameter passing (store arg to callee frame), assignment, etc. | Design |
| R28 | Constant materialization: `const` | `const(value, type) → temp`: loads a constant into a temp. May be optimized away by constant propagation | Design |

### 3.5 AST→IL Lowering Rules

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R29 | Variable declaration with initializer → `store` | `let x: byte = expr;` lowers to: evaluate `expr` → temp; `store(temp, location_of_x)` | Ch 03 |
| R30 | Variable declaration without initializer → no IL | The frame slot exists but no initialization code is emitted (use-before-init is a warning, W10190) | Ch 03 |
| R31 | Assignment → evaluate RHS + `store` | `x = expr;` lowers to: evaluate `expr` → temp; `store(temp, location_of_x)` | Ch 03 |
| R32 | Compound assignment → `load` + op + `store` | `x += expr;` lowers to: `load(x) → t1`; evaluate `expr` → `t2`; `add(t1, t2) → t3`; `store(t3, x)` | Ch 04 §3.4 |
| R33 | Binary expression → evaluate both sides + binary op | Left operand evaluated first (guaranteed, Ch 06 FN-10), then right, then op. Promotion inserts `zext`/`sext` as needed | Ch 04, Ch 02 TS-4 |
| R34 | Short-circuit `&&` / `||` → conditional branches | `a && b` lowers to: eval `a`; `brcond(a, evalB, shortFalse)`; eval `b` in `evalB` block; merge. Short-circuit is a language guarantee, not optimization | Ch 04 §6 |
| R35 | Conditional `?:` → conditional branch + merge | `cond ? a : b` lowers to: eval `cond`; `brcond`; eval `a` in true block → store to merge temp; `br` to merge; eval `b` in false block → store to merge temp; merge block: `load` merge temp | Ch 04 §7 |
| R36 | `if`/`else` → conditional branch | `if (cond) { body } else { alt }` → eval `cond`; `brcond(cond, thenLabel, elseLabel)`; then block; `br(endLabel)`; else block; end block | Ch 05 §4 |
| R37 | `while` → loop header + conditional back-edge | `while (cond) { body }` → `br(headerLabel)`; header: eval `cond`; `brcond(cond, bodyLabel, exitLabel)`; body; `br(headerLabel)`; exit | Ch 05 §5 |
| R38 | `do-while` → body-first + conditional back-edge | `do { body } while (cond);` → body block; eval `cond`; `brcond(cond, bodyLabel, exitLabel)` | Ch 05 §6 |
| R39 | `for` loop → counter init + header + body + increment + back-edge | `for (let i = start to end) { body }` → store `start` to counter location; header: load counter; compare to bound; `brcond`; body; increment counter; `br(header)`; exit. Pattern A vs Pattern B selection (Ch 05 §7.7) is a codegen concern (RD-07), not IL | Ch 05 §7 |
| R40 | `switch` → cascading `brcond` chain | Each case generates a comparison + `brcond` to the case body label. Default is the fallthrough. `fallthrough` keyword → `br` to next case body | Ch 05 §8 |
| R41 | Function call → store args to callee frame + `call` | For each argument: evaluate → store to callee's parameter slot. Then `call(label)`. Return value (if any) is in a result temp | Ch 06 §5.4 |
| R42 | `return` → `ret(value?)` | `return expr;` → eval `expr` → temp; `ret(temp)`. `return;` → `ret()` | Ch 06 FN-5 |
| R43 | Struct field access → `load` with offset | `s.field` where `s` is a local struct: `load(location_of_s + offsetof(field))`. For by-ref struct parameters: `load_indirect(zp_ptr, offset)` | Ch 07 |
| R44 | Array element access → `load_indexed` / `store_indexed` | `arr[i]` where `arr` is local: `load_indexed(location_of_arr, index_temp)`. For by-ref array parameters: `load_indirect(zp_ptr, index_temp)` | Ch 08 |
| R45 | Struct literal → series of `store` ops | `{ x: 1, y: 2 }` → `store(1, location + 0)`; `store(2, location + 1)` | Ch 07 |
| R46 | `peek`/`poke` → IL `load`/`store` with absolute address | `peek(addr)` → `load(addr_operand) → temp`; `poke(addr, val)` → `store(val_operand, addr_operand)`. Constant addresses become `Location(immediate_addr)` | AR-49 |
| R47 | `peekw`/`pokew` → two `load`/`store` pairs | `peekw(addr)` → load lo byte + load hi byte → combine into 16-bit temp; `pokew` → split + store lo + store hi | AR-49 |
| R48 | Compile-time intrinsics (`sizeof`, `offsetof`, `length`) → `Immediate` | These are folded to constants before IL emission. They produce `Immediate` operands, not IL instructions | AR-49 |
| R49 | `lo()`/`hi()` → `trunc` or constant fold | `lo(word_val)` → `trunc` (extract low byte); `hi(word_val)` → shift right 8 + `trunc`. If operand is constant, fold at compile time | AR-49, Ch 04 §9.2 |
| R50 | CPU control intrinsics (`asm_sei`, etc.) → `intrinsic_call` | Each `asm_*()` becomes an `intrinsic_call` with the appropriate descriptor. These are opaque barriers — no IL reordering across them (CC-5) | AR-49, Ch 12 CC-5 |
| R51 | `&functionName` / `&variable` → `Immediate` or `Location` | Address-of a function → `Immediate` with the function's code label (resolved by ACME). Address-of a variable → `Immediate` with the variable's symbolic address | Ch 04 §8, AR-52 |
| R52 | Explicit cast (`as`) → `zext`/`sext`/`trunc`/no-op | `byte(x)` where x is word → `trunc`; `word(x)` where x is byte → `zext`; `sword(x)` where x is sbyte → `sext`. Same-width signed↔unsigned cast is a no-op (reinterpret) | Ch 02 TS-9 |

### 3.6 IL Textual Form

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R53 | The IL has a stable, deterministic textual representation | Used for `--emit-il` CLI output and golden-snapshot testing. Same input → same text output, character-for-character | AR-51, H5 |
| R54 | The textual form is human-readable | Each instruction on one line; temps as `%0`, `%1`, ...; types annotated; labels as `_L0:`, `_L1:`; symbolic locations by name | AR-51 |
| R55 | The textual form is the golden-snapshot surface | Unit tests and golden tests assert against the IL text. IL changes that alter the text require golden updates — this is intentional (catch regressions) | AR-51, AR-22 |

### 3.7 IL Optimizer

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R56 | The IL optimizer is a pass pipeline | A configurable sequence of passes runs over the `ILProgram`. Each pass transforms the IL in-place or produces a new `ILProgram` | Design, AR-38 |
| R57 | v1 is a passthrough | The initial implementation applies no transformations — the IL passes through unchanged. This establishes the architectural seam | AR-38 |
| R58 | Planned passes: constant folding | Evaluate operations on `Immediate` operands at compile time, replacing the instruction with a `const` | Standard optimization |
| R59 | Planned passes: dead-code elimination (DCE) | Remove instructions whose results are never used; remove unreachable basic blocks. Unreachable blocks feed W10130 (unreachable code warning) | Ch 05 W10130, AR-48 |
| R60 | Planned passes: strength reduction | Replace expensive operations with cheaper equivalents (e.g., multiply by power-of-2 → shift). Interacts with the Ch 04 §3.2 three-tier multiply strategy | Ch 04 §3.2 |
| R61 | Passes must not break determinism | Same input → same output after any combination of passes. No hash-dependent ordering, no random seeds | H5 |
| R62 | Passes must preserve correctness | Every pass must maintain the semantics of the original program. A pass that alters observable behavior is a compiler bug | H5, L7 |
| R63 | Intrinsic calls are optimization barriers | `intrinsic_call` instructions for CPU control intrinsics (CC-5) must not be reordered, removed, or merged by any optimization pass | Ch 12 CC-5 |

### 3.8 ILProgram Output

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R64 | The lowering produces an `ILProgram` record | Contains the IL CFG for every function, plus module-level initialization code, const data declarations, and embed data references | Design |
| R65 | The `ILProgram` is consumed by RD-07 codegen | Codegen iterates over each function's CFG and translates IL instructions to `Instr` sequences | AR-50 |
| R66 | The `ILProgram` carries the `AllocationPlan` reference | Codegen needs frame addresses, ZP allocations, and symbol definitions from the plan | RD-05 |
| R67 | The `ILProgram` is immutable after optimization | Once the optimizer pass pipeline completes, the IL is frozen. Codegen reads but does not modify it | Design |

### 3.9 Error Tolerance

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R68 | IL lowering skips functions with semantic errors | If a function has unresolved types or error nodes in its AST, the lowering skips it (no IL is generated for that function). Diagnostics from earlier phases cover the root cause | AR-15, AR-74 |
| R69 | IL lowering never emits new user-facing diagnostics | All user errors are caught by the lexer, parser, or semantic analyzer. The IL lowering may emit `E9xxxx` internal-compiler-errors if it encounters an AST shape it cannot handle (this indicates a semantic-analysis bug) | AR-70 |
| R70 | The optimizer may surface warnings from DCE | When DCE detects unreachable basic blocks, it contributes to the W10130 warning. The warning is emitted via the `DiagnosticBag`, with source spans from the original AST | Ch 05 W10130 |

---

## 4. Design Detail

### 4.1 IL Type System

```typescript
interface ILType {
  width: 8 | 16;
  signed: boolean;
}

// Convenience constants
const IL_BYTE:  ILType = { width: 8,  signed: false };  // byte, boolean, enum
const IL_SBYTE: ILType = { width: 8,  signed: true  };  // sbyte
const IL_WORD:  ILType = { width: 16, signed: false };   // word
const IL_SWORD: ILType = { width: 16, signed: true  };   // sword
```

**Blend65 type → IL type mapping:**

| Blend65 Type | IL Type | Notes |
|-------------|---------|-------|
| `byte` | `IL_BYTE` | |
| `sbyte` | `IL_SBYTE` | |
| `word` | `IL_WORD` | |
| `sword` | `IL_SWORD` | |
| `boolean` | `IL_BYTE` | 0/1 values only |
| enum | `IL_BYTE` | Enum identity erased |
| struct (by-ref ptr) | `IL_WORD` | 16-bit base address |
| array (by-ref ptr) | `IL_WORD` | 16-bit base address |

### 4.2 Operand Types

```typescript
type ILOperand =
  | { kind: 'immediate'; value: number; type: ILType }
  | { kind: 'temp';      id: number;    type: ILType }
  | { kind: 'location';  symbol: string; offset?: number; type: ILType };
```

**Examples:**
- `Immediate(42, IL_BYTE)` — the literal value 42 as a byte
- `Temp(0, IL_WORD)` — virtual temp `%0` of type word
- `Location("__frame_Game_update_dx", 0, IL_SBYTE)` — the `dx` local in `update()`
- `Location("__var_Game_score", 0, IL_WORD)` — the module variable `score`
- `Location("__zp_Irq_rasterLine", 0, IL_BYTE)` — a ZP variable

### 4.3 IL Instructions

```typescript
type ILInstruction =
  // Arithmetic
  | { op: 'add';   dest: ILOperand; left: ILOperand; right: ILOperand; type: ILType }
  | { op: 'sub';   dest: ILOperand; left: ILOperand; right: ILOperand; type: ILType }
  | { op: 'mul';   dest: ILOperand; left: ILOperand; right: ILOperand; type: ILType }
  | { op: 'div';   dest: ILOperand; left: ILOperand; right: ILOperand; type: ILType }
  | { op: 'mod';   dest: ILOperand; left: ILOperand; right: ILOperand; type: ILType }
  | { op: 'neg';   dest: ILOperand; src: ILOperand; type: ILType }

  // Bitwise
  | { op: 'and';   dest: ILOperand; left: ILOperand; right: ILOperand; type: ILType }
  | { op: 'or';    dest: ILOperand; left: ILOperand; right: ILOperand; type: ILType }
  | { op: 'xor';   dest: ILOperand; left: ILOperand; right: ILOperand; type: ILType }
  | { op: 'not';   dest: ILOperand; src: ILOperand; type: ILType }
  | { op: 'shl';   dest: ILOperand; left: ILOperand; right: ILOperand; type: ILType }
  | { op: 'shr';   dest: ILOperand; left: ILOperand; right: ILOperand; type: ILType }

  // Comparison (result always IL_BYTE / boolean)
  | { op: 'eq';    dest: ILOperand; left: ILOperand; right: ILOperand; type: ILType }
  | { op: 'ne';    dest: ILOperand; left: ILOperand; right: ILOperand; type: ILType }
  | { op: 'lt';    dest: ILOperand; left: ILOperand; right: ILOperand; type: ILType }
  | { op: 'le';    dest: ILOperand; left: ILOperand; right: ILOperand; type: ILType }
  | { op: 'gt';    dest: ILOperand; left: ILOperand; right: ILOperand; type: ILType }
  | { op: 'ge';    dest: ILOperand; left: ILOperand; right: ILOperand; type: ILType }

  // Type conversion
  | { op: 'zext';  dest: ILOperand; src: ILOperand }  // 8→16 unsigned
  | { op: 'sext';  dest: ILOperand; src: ILOperand }  // 8→16 signed
  | { op: 'trunc'; dest: ILOperand; src: ILOperand }  // 16→8

  // Memory
  | { op: 'load';           dest: ILOperand; src: ILOperand }
  | { op: 'store';          src: ILOperand;  dest: ILOperand }
  | { op: 'load_indexed';   dest: ILOperand; base: ILOperand; index: ILOperand }
  | { op: 'store_indexed';  src: ILOperand;  base: ILOperand; index: ILOperand }
  | { op: 'load_indirect';  dest: ILOperand; ptr: ILOperand;  offset: ILOperand }
  | { op: 'store_indirect'; src: ILOperand;  ptr: ILOperand;  offset: ILOperand }

  // Copy
  | { op: 'copy'; dest: ILOperand; src: ILOperand }

  // Call
  | { op: 'call';      dest?: ILOperand; target: string; args: ILOperand[] }
  | { op: 'intrinsic'; dest?: ILOperand; name: string;   args: ILOperand[];
      descriptor: IntrinsicDescriptor }

  // Source span (debug)
  | { op: 'source_span'; span: SourceSpan };

type ILTerminator =
  | { kind: 'br';     target: string }
  | { kind: 'brcond'; cond: ILOperand; trueTarget: string; falseTarget: string }
  | { kind: 'ret';    value?: ILOperand }
  | { kind: 'unreachable' };
```

### 4.4 Basic Block & CFG

```typescript
interface BasicBlock {
  label: string;                     // unique within function ("_entry", "_L0", "_L1", ...)
  instructions: ILInstruction[];     // non-branching instructions
  terminator: ILTerminator;          // exactly one; controls flow to successors
}

interface ILFunction {
  name: string;                      // fully qualified: "Module.function"
  params: ILOperand[];               // parameter locations from AllocationPlan
  returnType: ILType | 'void';
  blocks: BasicBlock[];              // blocks[0] is always the entry block
  tempCount: number;                 // total virtual temps used (for codegen allocation)
  isInterrupt: boolean;
}
```

### 4.5 ILProgram

```typescript
interface ILProgram {
  functions: ILFunction[];           // all functions (regular + interrupt)
  initCode: BasicBlock[];            // module-level variable initialization (startup)
  constData: ConstDataEntry[];       // const arrays, const structs, embed() data
  allocationPlan: AllocationPlan;    // from RD-05 (carried through for codegen)
}

interface ConstDataEntry {
  symbol: string;                    // ACME label name
  data: Uint8Array;                  // raw bytes
  type: 'array' | 'struct' | 'embed';
}
```

### 4.6 IL Textual Form

The textual form follows a simple assembly-like syntax:

```
function Game.main(): void {
_entry:
  %0 = const i8u 5
  store %0, __var_Game_borderColor
  call_void Game.init ()
  br _L0

_L0:
  %1 = load i8u __var_Game_running
  brcond %1, _L1, _L2

_L1:
  call_void Game.update ()
  call_void Game.render ()
  br _L0

_L2:
  ret
}
```

**Format rules:**

| Element | Format | Example |
|---------|--------|---------|
| Function header | `function <name>(<params>): <ret> {` | `function Game.update(): void {` |
| Block label | `<label>:` (indented 0) | `_entry:` |
| Instruction | `  <dest> = <op> <type> <operands>` | `  %0 = add i16u %1, %2` |
| Terminator | `  <kind> <args>` | `  brcond %3, _L1, _L2` |
| Type annotation | `i8u`/`i8s`/`i16u`/`i16s` | `i8u` = byte, `i16s` = sword |
| Temp | `%N` | `%0`, `%1` |
| Immediate | bare number | `42`, `$D020` |
| Location | symbol name | `__frame_Game_update_dx` |

### 4.7 Lowering Example: Simple Function

**Source:**
```blend65
function add(a: byte, b: byte): byte {
    return a + b;
}
```

**IL:**
```
function Math.add(a: i8u, b: i8u): i8u {
_entry:
  %0 = load i8u __frame_Math_add_a
  %1 = load i8u __frame_Math_add_b
  %2 = add i8u %0, %1
  ret %2
}
```

### 4.8 Lowering Example: If/Else

**Source:**
```blend65
function clamp(value: byte, lo: byte, hi: byte): byte {
    if (value < lo) { return lo; }
    if (value > hi) { return hi; }
    return value;
}
```

**IL:**
```
function Math.clamp(value: i8u, lo: i8u, hi: i8u): i8u {
_entry:
  %0 = load i8u __frame_Math_clamp_value
  %1 = load i8u __frame_Math_clamp_lo
  %2 = lt i8u %0, %1
  brcond %2, _L0, _L1

_L0:
  %3 = load i8u __frame_Math_clamp_lo
  ret %3

_L1:
  %4 = load i8u __frame_Math_clamp_value
  %5 = load i8u __frame_Math_clamp_hi
  %6 = gt i8u %4, %5
  brcond %6, _L2, _L3

_L2:
  %7 = load i8u __frame_Math_clamp_hi
  ret %7

_L3:
  %8 = load i8u __frame_Math_clamp_value
  ret %8
}
```

### 4.9 Lowering Example: For Loop

**Source:**
```blend65
for (let i: byte = 0 until 10) {
    poke($0400 + word(i), 1);
}
```

**IL:**
```
_L0:  ; loop init
  %0 = const i8u 0
  store %0, __frame_Main_main_i

_L1:  ; loop header
  %1 = load i8u __frame_Main_main_i
  %2 = const i8u 10
  %3 = lt i8u %1, %2
  brcond %3, _L2, _L3

_L2:  ; loop body
  %4 = load i8u __frame_Main_main_i
  %5 = zext %4                        ; byte → word
  %6 = const i16u $0400
  %7 = add i16u %6, %5               ; $0400 + i
  %8 = const i8u 1
  store %8, %7                        ; poke($0400 + i, 1)
  ; increment
  %9 = load i8u __frame_Main_main_i
  %10 = const i8u 1
  %11 = add i8u %9, %10
  store %11, __frame_Main_main_i
  br _L1

_L3:  ; loop exit
```

### 4.10 Lowering Example: Short-Circuit &&

**Source:**
```blend65
if (x > 0 && y < 100) { doSomething(); }
```

**IL:**
```
_entry:
  %0 = load i8u __var_Game_x
  %1 = const i8u 0
  %2 = gt i8u %0, %1
  brcond %2, _L0, _L2          ; short-circuit: if x <= 0, skip y check

_L0:  ; evaluate second operand
  %3 = load i8u __var_Game_y
  %4 = const i8u 100
  %5 = lt i8u %3, %4
  brcond %5, _L1, _L2

_L1:  ; both true
  call_void Game.doSomething ()
  br _L2

_L2:  ; join / false path
```

### 4.11 IL Optimizer Pass Interface

```typescript
interface ILPass {
  name: string;
  run(program: ILProgram, bag: DiagnosticBag): ILProgram;
}

/**
 * Run the IL optimizer pipeline.
 * v1: passthrough (no passes). Future: [constFold, dce, strengthReduce].
 */
function optimizeIL(
  program: ILProgram,
  passes: ILPass[],
  bag: DiagnosticBag
): ILProgram;
```

### 4.12 Public API

```typescript
/**
 * Lower the validated AST + SemanticModel + AllocationPlan to IL.
 *
 * @param model   The semantic model from RD-04
 * @param plan    The allocation plan from RD-05
 * @param bag     DiagnosticBag (for ICE errors only — user errors already caught)
 * @returns       The IL program
 */
function lowerToIL(
  model: SemanticModel,
  plan: AllocationPlan,
  bag: DiagnosticBag
): ILProgram;

/**
 * Render the IL program to its textual form (for --emit-il and golden testing).
 */
function printIL(program: ILProgram): string;
```

Both functions live in `@blend65/codegen` — this is the first back-end package in the
pipeline, on the far side of the AR-20 frontend/backend boundary. The language server
does NOT depend on this package.

---

## 5. Interactions With Other RDs

| RD | Relationship |
|----|--------------|
| RD-01 | Package structure: IL lives in `@blend65/codegen` (backend, not accessible to LSP) |
| RD-03 | **Input**: consumes AST node types from `@blend65/core`. The 51 AST node kinds are the input to the lowering |
| RD-04 | **Input**: consumes `SemanticModel` (types, symbols, const values, call graph). The model provides type information needed for IL typing and promotion insertion |
| RD-05 | **Input**: consumes `AllocationPlan` (frame addresses, ZP allocations, module-variable addresses). IL operands use symbolic location names from the plan |
| RD-07 | **Primary consumer**: 6502 codegen reads the `ILProgram` and translates each IL instruction to one or more `Instr` records. Register binding (A/X/Y + ZP-scratch) happens here |
| RD-09 | **Indirect**: `--emit-il` output is serialized by `printIL()` in this package; the ACME emitter does not consume IL directly |
| RD-10 | **Indirect**: intrinsic descriptors (AR-29) from platform plugins are carried in `intrinsic_call` instructions and dispatched at codegen (RD-07) |
| RD-11 | **No direct interaction**: IL does not contribute resource-report data; all resource numbers come from RD-05 (pre-ACME) and RD-09 (post-ACME) |
| RD-17 | **Input**: intrinsic descriptors define how each intrinsic is lowered to IL (fold/load-store/call) per AR-49 |

---

## 6. Acceptance Criteria

- [ ] AC-01: `lowerToIL()` accepts a `SemanticModel` + `AllocationPlan` and returns an `ILProgram`
- [ ] AC-02: Every AST node kind that produces runtime behavior has a defined IL lowering (no "not implemented" gaps for supported language features) *(RD-18 Slice 7a closed the aggregate gaps: Index/StructLit/ArrayLit/field chains lower; the indirect pointer tier remains the documented boundary until 7b)*
- [ ] AC-03: All IL instructions carry explicit `ILType` annotations (width + signedness)
- [ ] AC-04: Type promotions (byte→word, sbyte→sword) produce explicit `zext`/`sext` instructions
- [ ] AC-05: Explicit casts produce the correct conversion instruction (`zext`/`sext`/`trunc`/no-op)
- [ ] AC-06: Short-circuit evaluation of `&&` and `||` produces conditional branches (not eager evaluation)
- [ ] AC-07: The conditional operator `?:` produces a conditional branch with only the selected arm evaluated
- [ ] AC-08: `for` loops produce correct counter init → header → body → increment → back-edge structure
- [ ] AC-09: `switch` statements produce a cascading comparison chain with correct case/default/fallthrough flow
- [ ] AC-10: Compile-time intrinsics (`sizeof`, `offsetof`, `length`) are folded to `Immediate` operands
- [ ] AC-11: `peek`/`poke`/`peekw`/`pokew` are lowered to IL `load`/`store` instructions
- [ ] AC-12: CPU control intrinsics become `intrinsic_call` instructions that are optimization barriers
- [ ] AC-13: `printIL()` produces deterministic textual output: same input → same text
- [ ] AC-14: The IL optimizer pipeline accepts passes and runs them in sequence (v1 = passthrough)
- [ ] AC-15: Functions with semantic errors are skipped during lowering (error tolerance)
- [ ] AC-16: The `ILProgram` carries the `AllocationPlan` reference for downstream codegen
- [ ] AC-17: Unit tests cover IL lowering for each major AST construct (arithmetic, control flow, function calls, struct/array access, intrinsics) *(struct/array access covered by RD-18 Slice 7a — indexed reads/writes, member chains, literal initialisation, const-data images; the remaining constructs were covered by earlier slices)*
- [ ] AC-18: Golden-snapshot tests assert IL textual output for representative programs (AR-22 tier 2)
- [ ] AC-19: All decisions trace to an `AR-NN` or a frozen spec section

---

## 7. Open Questions

> Discovery is **closed** (Zero-Ambiguity Gate PASSED). This section must normally be
> **empty**. If authoring surfaces a *new* ambiguity, STOP, add it to
> `00-ambiguity-register.md` as the next `AR-NN` (tagged `(runtime)`), resolve it with the
> user, then resume — per the Surface-During-Authoring rule. Do not fill gaps by guessing.

1. **Multiply/divide lowering granularity**: R18 includes `mul`/`div`/`mod` as IL
   instructions. The three-tier codegen strategy for multiply (Ch 04 §3.2: constant-fold
   → shift-and-add → software subroutine) and the software subroutine for divide could
   be modeled as IL-level expansion (strength reduction pass) or deferred to codegen
   (RD-07). The current design keeps them as single IL ops and lets codegen select the
   strategy — this matches the passthrough-v1 principle. If a future strength-reduction
   pass is added, it would lower `mul` IL ops to shift/add IL sequences.

2. **Module initialization ordering**: R64 notes that `ILProgram.initCode` holds
   module-level variable initialization. The order must match AR-91 (topological sort
   by import graph). This is computed by RD-04 and consumed here without modification.

3. **Indirect memory access patterns**: R24 defines `load_indirect`/`store_indirect` for
   by-ref struct/array access. The exact ZP pointer setup (loading the base address to
   the ZP pointer slot) will be detailed further when RD-07 codegen specifies the
   `(ptr),Y` instruction generation. At the IL level, the indirection is represented
   abstractly.
