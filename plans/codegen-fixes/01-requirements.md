# Requirements: Code Generator Fixes

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: CODEGEN-ISSUES-ANALYSIS.md

## Overview

This document formalizes ALL 14 critical issues from the analysis as requirements. Each requirement maps directly to an issue and specifies acceptance criteria.

---

## Requirement Categories

### CRITICAL Requirements (Must Fix First)

These issues completely prevent correct code generation.

---

### REQ-01: Value Tracking System

**Issue**: #1 - Value Tracking Broken, #3 - Binary Ops Don't Preserve Operands

**Problem Statement**:
The code generator's `valueLocations: Map<string, TrackedValue>` loses track of values when loading new values into the A register.

**Current Behavior**:
```asm
LDA $0B         ; Load cursorY into A (v1)
LDA _SCREEN_WIDTH  ; OVERWRITES v1!
LDA #$00        ; STUB: Cannot load v1 ← v1 is GONE!
```

**Required Behavior**:
```asm
LDA $0B         ; Load cursorY into A (v1)
STA $60         ; SPILL v1 to ZP before overwriting
LDA _SCREEN_WIDTH  ; Load v2
STA $61         ; Save v2 
LDA $60         ; RELOAD v1 for operation
```

**Acceptance Criteria**:
- [ ] Values are spilled to ZP before A is overwritten
- [ ] Values can be reloaded from ZP when needed
- [ ] Binary operations work with two variable operands
- [ ] No "Unknown value location" warnings
- [ ] No "STUB: Cannot load" comments in output

**Files to Modify**:
- `codegen/base-generator.ts` - Value tracking infrastructure
- `codegen/instruction-generator.ts` - Load/store operations

---

### REQ-02: PHI Node Lowering

**Issue**: #2 - PHI Node Lowering Incomplete

**Problem Statement**:
PHI nodes in SSA form always resolve to 0 because SSA-versioned values (e.g., `v4:cursorY.0`) are not tracked.

**Current Behavior**:
```asm
; WARNING: Cannot load v4:cursorY.0 for PHI
LDA #$00        ; STUB: v4:cursorY.0 ← ALWAYS 0!
```

**Required Behavior**:
```asm
; PHI prep: Load actual value from source
LDA $60         ; Load v4:cursorY.0 from its actual location
STA $40         ; Store to PHI merge variable
```

**Acceptance Criteria**:
- [ ] SSA-versioned values are tracked (v4:cursorY.0, v7:cursorY.2)
- [ ] PHI sources load actual values, not 0
- [ ] if/else branches merge correctly
- [ ] while/for loops maintain iteration variables
- [ ] No "WARNING: Cannot load" for PHI nodes

**Files to Modify**:
- `codegen/base-generator.ts` - SSA value tracking
- `codegen/instruction-generator.ts` - PHI lowering

---

### REQ-03: Function Calling Convention

**Issue**: #4 - Function Calling Convention Missing

**Problem Statement**:
Functions cannot receive parameters. The code generator emits `STUB: Call with N args (ABI not implemented)`.

**Current Behavior**:
```asm
; STUB: Call with 1 args (ABI not implemented)
JSR _printChar  ; Call without passing parameters!
```

**Required Behavior**:
```asm
LDA $60         ; Load first argument from its location
STA $50         ; Store to parameter ZP location
JSR _printChar  ; Call with parameter in $50
```

**Acceptance Criteria**:
- [ ] ABI defined: First 3 params in ZP $50-$52, rest in $53+
- [ ] Caller sets up parameters before JSR
- [ ] Callee expects parameters in known locations
- [ ] Return value in A (byte) or A/X (word)
- [ ] No "STUB: Call with N args" comments

**Files to Modify**:
- `codegen/instruction-generator.ts` - generateCall, generateCallVoid
- `codegen/code-generator.ts` - Function prologue/epilogue

---

### REQ-04: Missing IL Opcodes

**Issue**: #8 - 15+ IL Opcodes Not Implemented

**Problem Statement**:
15+ IL opcodes fall through to `generatePlaceholder()` which emits NOP.

**Missing Opcodes**:

| Opcode | Purpose | Priority |
|--------|---------|----------|
| UNDEF | Uninitialized variable | HIGH |
| LOAD_FIELD | Struct field read | HIGH |
| STORE_FIELD | Struct field write | HIGH |
| LOGICAL_AND | Short-circuit AND | HIGH |
| LOGICAL_OR | Short-circuit OR | HIGH |
| ZERO_EXTEND | byte → word | HIGH |
| TRUNCATE | word → byte | HIGH |
| BOOL_TO_BYTE | bool → byte | MEDIUM |
| BYTE_TO_BOOL | byte → bool | MEDIUM |
| CALL_INDIRECT | Function pointers | LOW |
| INTRINSIC_LENGTH | Array length | HIGH |
| MAP_LOAD_FIELD | @map struct read | HIGH |
| MAP_STORE_FIELD | @map struct write | HIGH |
| MAP_LOAD_RANGE | @map range read | HIGH |
| MAP_STORE_RANGE | @map range write | HIGH |

**Acceptance Criteria**:
- [ ] All 15 opcodes have handlers in switch statement
- [ ] No opcodes fall through to placeholder
- [ ] Type conversions produce correct values
- [ ] @map struct/range access works
- [ ] Short-circuit evaluation works correctly

**Files to Modify**:
- `codegen/instruction-generator.ts` - Add cases to switch

---

### REQ-05: String Literals

**Issue**: #9 - String Literals Not Implemented

**Problem Statement**:
String literals return address 0 instead of actual string address.

**Current Behavior**:
```typescript
// Returns 0 for any string literal
return this.builder?.emitConstByte(0) ?? null;
```

**Required Behavior**:
```asm
; Data section
_str_0: !text "Hello", 0  ; Null-terminated string

; Code section
LDA #<_str_0  ; Low byte of string address
LDX #>_str_0  ; High byte of string address
```

**Acceptance Criteria**:
- [ ] String literals allocated in data section
- [ ] Strings are null-terminated
- [ ] String address returned (not 0)
- [ ] String can be passed to functions
- [ ] No "String literal support not fully implemented" warning

**Files to Modify**:
- `il/generator/expressions.ts` - generateStringLiteral
- `codegen/globals-generator.ts` - String storage
- `codegen/instruction-generator.ts` - String address loading

---

### REQ-06: 16-bit Word Operations

**Issue**: #10 - 16-bit Operations Partially Broken

**Problem Statement**:
Word operations don't consistently track both bytes (A=low, X=high).

**Current Behavior**:
- A/X pair loaded but not preserved through operations
- Word comparisons may only check low byte
- Word returns may lose high byte

**Required Behavior**:
- Word values use A/X pair consistently
- Word arithmetic handles carry between bytes
- Word comparisons check both bytes
- Word returns preserve both bytes

**Acceptance Criteria**:
- [ ] Word addition with carry works
- [ ] Word subtraction with borrow works
- [ ] Word comparisons are correct
- [ ] Word function returns preserve both bytes
- [ ] A/X tracking maintained through operations

**Files to Modify**:
- `codegen/instruction-generator.ts` - Word operations
- `codegen/base-generator.ts` - A/X tracking

---

### REQ-07: Short-Circuit Evaluation

**Issue**: #11 - Short-Circuit Evaluation Not Implemented

**Problem Statement**:
`&&` and `||` don't short-circuit; both operands are always evaluated.

**Current Behavior**:
```
LOGICAL_AND falls through to placeholder → NOP
```

**Required Behavior**:
```asm
; if (a && b)
LDA a_location    ; Evaluate a
BEQ skip_b        ; If false, skip b
LDA b_location    ; Evaluate b (only if a was true)
skip_b:
```

**Acceptance Criteria**:
- [ ] LOGICAL_AND short-circuits (skips right if left is false)
- [ ] LOGICAL_OR short-circuits (skips right if left is true)
- [ ] Side effects in skipped expressions don't occur
- [ ] Result is correct boolean (0 or 1)

**Files to Modify**:
- `codegen/instruction-generator.ts` - generateLogicalAnd, generateLogicalOr

---

## HIGH Priority Requirements

These significantly impact functionality.

---

### REQ-08: Register Allocation Strategy

**Issue**: #5 - No Register Allocation

**Problem Statement**:
No strategy for using A, X, Y registers and ZP for temporaries.

**Required Implementation**:
- A: Primary working register
- X: Secondary, indexing, temp storage
- Y: Array indexing
- ZP $60-$7F: Spill area for temporaries

**Acceptance Criteria**:
- [ ] Value locations tracked per register
- [ ] Spilling to ZP when registers full
- [ ] Reloading from ZP when needed
- [ ] X/Y used for indexing operations
- [ ] Complex expressions work (3+ operands)

**Files to Modify**:
- `codegen/base-generator.ts` - Register tracking
- `codegen/instruction-generator.ts` - Register selection

---

### REQ-09: Complex Expression Nesting

**Issue**: #14 - Complex Expression Nesting

**Problem Statement**:
Nested expressions like `(a + b) * (c - d)` lose intermediate values.

**Acceptance Criteria**:
- [ ] Intermediate results saved to ZP
- [ ] 3+ level nesting works correctly
- [ ] No lost intermediate values
- [ ] Result is mathematically correct

**Files to Modify**:
- `codegen/instruction-generator.ts` - Binary operations
- `codegen/base-generator.ts` - Temp allocation

---

### REQ-10: Test Infrastructure

**Issue**: #6 - E2E Tests Don't Verify Correctness, #7 - Extreme Testing Required

**Problem Statement**:
Tests verify "compilation succeeded" but not "code is correct".

**Required Test Types**:
1. ASM Sequence Validator - Verify exact instruction sequences
2. Value Flow Analyzer - Track values through code
3. 6502 Simulator Integration - Run and verify results
4. Golden Output Tests - Compare against known-good output

**Acceptance Criteria**:
- [ ] Test infrastructure can verify code correctness
- [ ] Can check exact instruction sequences
- [ ] Can verify memory state after execution
- [ ] 300+ new tests created
- [ ] All tests pass

**Files to Create/Modify**:
- `__tests__/e2e/helpers/` - Test infrastructure
- `__tests__/e2e/correctness/` - New correctness tests

---

## MEDIUM Priority Requirements

---

### REQ-11: Module System Testing

**Issue**: #12 - Module/Import System Gaps

**Problem Statement**:
Multi-file compilation with import/export is untested.

**Acceptance Criteria**:
- [ ] `import { func } from './module.blend'` works
- [ ] `export function ...` exports correctly
- [ ] Cross-module function calls resolve
- [ ] Cross-module variables resolve
- [ ] Standard library imports work

**Files to Create/Modify**:
- `__tests__/e2e/modules/` - Module tests
- Multi-file test fixtures

---

### REQ-12: Array Initialization Edge Cases

**Issue**: #13 - Array Initialization Incomplete

**Problem Statement**:
Edge cases in array initialization may fail.

**Edge Cases**:
- Word arrays: `let addrs: word[3] = [$1000, $2000, $3000]`
- Large arrays: > 256 elements
- Computed initializers: `let data: byte[3] = [x, y, z]`
- Uninitialized: `let data: byte[10]`

**Acceptance Criteria**:
- [ ] Word arrays initialized with correct byte order
- [ ] Large arrays work (Y indexing for > 256)
- [ ] Runtime-computed initializers work
- [ ] Uninitialized arrays zero-filled

**Files to Modify**:
- `codegen/globals-generator.ts` - Array initialization
- `codegen/instruction-generator.ts` - Array store

---

## Summary

| REQ | Issue(s) | Priority | Phase |
|-----|----------|----------|-------|
| REQ-01 | 1, 3 | CRITICAL | 1 |
| REQ-02 | 2 | CRITICAL | 3 |
| REQ-03 | 4 | CRITICAL | 4 |
| REQ-04 | 8 | CRITICAL | 2 |
| REQ-05 | 9 | CRITICAL | 5 |
| REQ-06 | 10 | HIGH | 6 |
| REQ-07 | 11 | HIGH | 2 |
| REQ-08 | 5 | HIGH | 7 |
| REQ-09 | 14 | HIGH | 1, 7 |
| REQ-10 | 6, 7 | HIGH | 0, 9 |
| REQ-11 | 12 | MEDIUM | 8 |
| REQ-12 | 13 | MEDIUM | 2 |

**Total: 12 formal requirements covering 14 issues**