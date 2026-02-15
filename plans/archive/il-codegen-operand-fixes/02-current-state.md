# Current State: IL Generator ↔ Codegen Operand Mismatch

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### Architecture Overview

The binary expression compilation pipeline has 3 layers:

```
Source Code → IL Generator (expressions.ts) → IL Instructions → Codegen (arithmetic.ts/bitwise.ts)
```

The IL generator dispatches binary expressions through a 3-tier priority system:

1. **Immediate path** (`generateBinaryImmediate`) — right operand is a literal number
2. **Slot path** (`generateBinarySlot`) — right operand is a simple variable
3. **Complex path** (`generateBinaryComplex` → `generateBinaryComplexOp`) — right is a sub-expression

### What Works

| Operator | Immediate | Slot | Complex |
|---|---|---|---|
| `+` | ✅ `addImm` | ✅ `addSlot` | ❌ CRASH |
| `-` | ✅ `subImm` | ✅ `subSlot` | ❌ CRASH |
| `*` | ✅ `mulImm` | ✅ `mulSlot` | ❌ CRASH |
| `/` | ❌ CRASH | ✅ `divSlot` | ❌ CRASH |
| `%` | ❌ CRASH | ✅ `modSlot` | ❌ CRASH |
| `&` | ✅ `andImm` | ✅ `andSlot` | ❌ CRASH |
| `\|` | ✅ `orImm` | ✅ `orSlot` | ❌ CRASH |
| `^` | ✅ `xorImm` | ✅ `xorSlot` | ❌ CRASH |
| `<<` | ❌ WRONG | ❌ WRONG | ❌ WRONG |
| `>>` | ❌ WRONG | ❌ WRONG | ❌ WRONG |
| comparisons | ✅ `cmpImm` | ✅ `cmpSlot` | ❌ CRASH |

### Relevant Files

| File | Purpose | Changes Needed |
|---|---|---|
| `il/generator/expressions.ts` | IL generation for all expressions | Add missing cases in 3 switch statements |
| `il/enums.ts` | IL opcode definitions | Add `DIV_IMM`, `MOD_IMM` |
| `il/builder/arithmetic.ts` | IL builder convenience methods | Add `divImm()`, `modImm()` |
| `codegen/generator/arithmetic.ts` | Codegen for arithmetic opcodes | Add `genDivImm()`, `genModImm()` handlers |
| `codegen/generator/bitwise.ts` | Codegen for shift opcodes | Already has `genShlByte`, `genShrByte` ✅ |

## Gaps Identified

### Gap 1: Missing DIV/MOD Immediate Path

**Current Behavior:** `i / 3` and `i % 3` fall through `generateBinaryImmediate()`'s `default` case,
which pushes A, loads the immediate, and calls `generateBinaryComplexOp()` — emitting `DIV_BYTE`/`MOD_BYTE`
with empty operands `[]`.

**Required Behavior:** Should emit `DIV_IMM`/`MOD_IMM` with an immediate operand, matching the
existing `MUL_IMM` pattern.

**Fix Required:**
1. Add `DIV_IMM` and `MOD_IMM` to IL enums
2. Add `divImm()` and `modImm()` to IL builder
3. Add cases in `generateBinaryImmediate()` for `DIVIDE` and `MODULO`
4. Add `genDivImm()` and `genModImm()` codegen handlers

### Gap 2: Complex Binary Path Emits Empty Operands

**Current Behavior:** `generateBinaryComplexOp()` emits `_BYTE` opcodes (ADD_BYTE, SUB_BYTE, etc.)
with empty operands `[]`. The codegen for ALL these opcodes calls `getSlotOperand(instr.operands)`
which throws "Expected slot operand at index 0, got undefined".

**Required Behavior:** The complex path should save the right operand value to a ZP temp location,
then emit the `_BYTE` opcode with a slot operand pointing to that temp.

**Fix Required:**
- Rewrite `generateBinaryComplexOp()` to use ZP temp slot pattern
- Create a synthetic FrameSlot for the ZP temp ($FE) to pass as operand

### Gap 3: Shift Operators Never Emit Shift IL

**Current Behavior:** `LEFT_SHIFT` and `RIGHT_SHIFT` have no case in any of the 3 dispatch methods
(`generateBinaryImmediate`, `generateBinarySlot`, `generateBinaryComplexOp`). They fall to default
and produce a no-op (just `POP_A`).

**Required Behavior:** Should call `builder.shl(count)` / `builder.shr(count)` for immediate shifts,
and emit shift loops for variable counts.

**Fix Required:**
- Add `LEFT_SHIFT` / `RIGHT_SHIFT` cases in `generateBinaryImmediate()`
- Add `LEFT_SHIFT` / `RIGHT_SHIFT` cases in `generateBinarySlot()`

### Gap 4: Compound Assignment Operations Are No-Ops

**Current Behavior:** `generateCompoundOperation()` just does `POP_A` for all operators.
`*=`, `/=`, `%=`, `<<=`, `>>=` produce wrong code (store original value back).

**Required Behavior:** Should actually perform the arithmetic/shift operation before storing.

**Fix Required:**
- Add missing compound operation cases in `generateCompoundAssignment()` literal path
- Fix `generateCompoundOperation()` to perform actual operations

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| ZP temp conflicts in nested expressions | Low | Medium | $FE/$FF already used by MUL_IMM codegen — same pattern |
| Regression in working operators | Very Low | High | All changes are additive switch cases; full test suite run |
| Shift with variable count generates too many ASLs | Low | Low | Cap at 7 shifts for byte values |
