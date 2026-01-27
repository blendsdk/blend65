# Blend65 Compiler Gap Report

> **Generated**: 2026-01-26
> **E2E Test Suite**: 441 tests
> **Passed**: 250 (57%)
> **Failed**: 183 (41%)
> **Skipped**: 8 (2% - known bugs)

## Executive Summary

The E2E testing revealed a **critical gap**: intrinsic functions are defined in the IL generator but not recognized by the semantic analyzer. This causes all intrinsic-related tests to fail with "Undefined identifier" errors.

### Test Results by Category

| Category | Passed | Failed | Skipped | Pass Rate |
|----------|--------|--------|---------|-----------|
| Smoke Tests | 28 | 0 | 2 | 100% |
| Type Acceptance | ~35 | ~10 | 1 | ~78% |
| Intrinsic Signatures | 0 | ~60 | 0 | 0% |
| Literals | ~15 | ~5 | 2 | ~75% |
| Variables | ~20 | ~10 | 2 | ~67% |
| Expressions | ~40 | ~10 | 0 | ~80% |
| Control Flow | ~30 | ~20 | 0 | ~60% |
| Functions | ~45 | ~15 | 0 | ~75% |
| Intrinsics CodeGen | 0 | ~53 | 0 | 0% |

---

## Critical Issues

### 🔴 CRITICAL: Intrinsics Not Recognized by Semantic Analyzer

**Impact**: ALL intrinsic functions fail to compile

**Error**: `Undefined identifier 'peek/poke/sei/cli/nop/brk/pha/pla/php/plp/lo/hi/peekw/pokew/sizeof/length/barrier/volatile_read/volatile_write'`

**Affected Intrinsics (18 total)**:

| Category | Intrinsics | Status |
|----------|------------|--------|
| Memory | `peek`, `poke`, `peekw`, `pokew` | ❌ Not recognized |
| Byte Extraction | `lo`, `hi` | ❌ Not recognized |
| CPU Control | `sei`, `cli`, `nop`, `brk` | ❌ Not recognized |
| Stack Operations | `pha`, `pla`, `php`, `plp` | ❌ Not recognized |
| Optimization | `barrier`, `volatile_read`, `volatile_write` | ❌ Not recognized |
| Compile-Time | `sizeof`, `length` | ❌ Not recognized |

**Root Cause**: 
- Intrinsics are defined in `packages/compiler/src/il/intrinsics/registry.ts`
- But the semantic analyzer (`GlobalSymbolTable`) doesn't know about them
- The IL generator recognizes them, but compilation fails before reaching IL

**Fix Required**: Register intrinsic functions in the semantic analyzer so they're recognized as valid identifiers with known signatures.

---

## High Priority Issues

### 🟠 Array Initializers Generate Wrong Values

**Impact**: Arrays initialized with values produce `$00` instead of actual values

**Example**:
```js
let data: byte[3] = [1, 2, 3];
```

**Expected**: `!byte $01, $02, $03`
**Actual**: `!byte $00, $00, $00`

**Status**: Documented in `smoke.test.ts` as skipped test

---

### 🟠 Local Variables Generate STUB Comments

**Impact**: Local variables within functions don't generate proper code

**Example**:
```js
function test(): byte {
  let x: byte = 10;
  return x;
}
```

**Expected**: Proper LDA/STA instructions for stack or zero-page allocation
**Actual**: `; STUB: Unknown variable 'x'`

**Status**: Documented in `smoke.test.ts` and `variables.test.ts` as skipped tests

---

### 🟠 Export Modifier on @map Variables

**Impact**: `export @map` declarations fail

**Example**:
```js
export @map screen at $0400: byte[1000];
```

**Error**: Compilation fails

**Status**: Test `type-acceptance.test.ts` > `accepts exported @map variable` fails

---

### 🟠 Array Data Section Generation

**Impact**: Byte arrays don't generate proper `!fill` directives

**Example**:
```js
let buffer: byte[10];
```

**Expected**: `!fill 10, $00`
**Actual**: Different format or missing

---

## Medium Priority Issues

### 🟡 length() with String Literal

**Impact**: `length("string")` fails type checking

**Example**:
```js
function test(): word {
  return length("hello");
}
```

**Error**: Type mismatch - length expects `byte[]`, not `string`

**Status**: Documented in `type-acceptance.test.ts` as skipped test

---

### 🟡 Control Flow with Intrinsics

**Impact**: All control flow tests using intrinsics fail (due to intrinsics issue)

Affected tests:
- If statements with `poke()` in body
- While loops with `peek()` in condition
- For loops with intrinsic calls

---

### 🟡 Variable Declaration Pattern Check

**Impact**: `let x = 10;` (without type annotation) behavior is inconsistent

Some tests expect this to fail, but behavior depends on type inference implementation.

---

## Working Features (250 passing tests)

### ✅ Type Acceptance
- Primitive types: `byte`, `word`, `boolean`
- Array types: `byte[N]`, `word[N]`
- Hex literals: `$FF`, `0xFF`
- Binary literals: `%11110000`, `0b11110000`
- @map declarations (non-exported)

### ✅ Variable Declarations
- Global byte/word/boolean with initializers
- Word data section generation (`!word`)
- Initialized byte values

### ✅ Expressions
- Arithmetic: `+`, `-` with ADC/SBC
- Bitwise: `&`, `|`, `^` with AND/ORA/EOR
- Comparisons: `==`, `!=`, `<`, `>` with CMP
- Logical: `&&`, `||`, `!`

### ✅ Functions
- Void function declarations with RTS
- Return values (byte, word, boolean)
- Function parameters
- Function calls with JSR
- Multiple functions
- Exported functions

### ✅ Control Flow
- If/else statements with branches
- While loops with JMP
- For loops
- Break/continue

---

## Fix Prioritization

### Phase 1: Critical (Blocks 183 tests)
1. **Register intrinsics in semantic analyzer**
   - Add intrinsic signatures to `GlobalSymbolTable`
   - Make `peek`, `poke`, etc. recognized as built-in functions
   - Define parameter types and return types

### Phase 2: High (Blocks ~15 tests)
2. **Fix array initializer code generation**
   - Generate actual values instead of zeros

3. **Fix local variable code generation**
   - Implement proper stack/ZP allocation for locals

4. **Fix export modifier on @map**
   - Handle `export @map` syntax

### Phase 3: Medium (Improves quality)
5. **Add string support to length()**
6. **Standardize array fill directive**

---

## Recommendations

### Immediate Action Required
The intrinsics issue is **blocking** - fixing it would likely move pass rate from 57% to ~90%+.

**Suggested Fix**:
1. In semantic analyzer initialization, register all intrinsics from `IntrinsicRegistry`
2. Each intrinsic needs:
   - Name
   - Parameter types
   - Return type
   - Mark as built-in (no body expected)

### Testing Improvements
- Continue running `./compiler-test e2e` after fixes
- As intrinsics are fixed, tests will automatically pass
- Skipped tests document known bugs - enable them after fixes

---

## Test Files Reference

| File | Tests | Purpose |
|------|-------|---------|
| `smoke.test.ts` | 28 | Infrastructure validation |
| `type-acceptance.test.ts` | 45 | Type system acceptance |
| `intrinsic-signatures.test.ts` | 60 | Intrinsic parameter validation |
| `literals.test.ts` | 30 | Literal code generation |
| `variables.test.ts` | 50 | Variable code generation |
| `expressions.test.ts` | 60 | Expression code generation |
| `control-flow.test.ts` | 60 | Control flow code generation |
| `functions.test.ts` | 55 | Function code generation |
| `intrinsics-codegen.test.ts` | 53 | Intrinsic code generation |

**Total**: 441 tests (250 pass, 183 fail, 8 skip)

---

## Conclusion

The Blend65 compiler has a solid foundation for types, expressions, functions, and control flow. The **critical blocker** is intrinsic recognition in the semantic analyzer. Fixing this single issue would enable the majority of C64-specific functionality (hardware access, CPU control, etc.) that makes Blend65 useful for real Commodore 64 development.

**Recommended Next Steps**:
1. Fix intrinsic registration in semantic analyzer
2. Re-run E2E tests
3. Address remaining failures (array init, local vars)
4. Enable skipped tests as bugs are fixed