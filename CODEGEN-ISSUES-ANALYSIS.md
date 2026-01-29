# Blend65 Code Generation Pipeline - Critical Issues Analysis

> **Date**: 2026-01-28
> **Status**: CRITICAL - Project-blocking issues identified
> **Scope**: Complete pipeline analysis (IL Generator → Code Generator → ASM-IL)

---

## Executive Summary

The Blend65 compiler has **fundamental code generation issues** that cause:
1. **ACME assembly failures** - Generated code doesn't assemble
2. **Runtime errors** - Code assembles but produces wrong results  
3. **60+ warnings per compilation** - Indicating incomplete implementations

**Root Cause**: The code generator's value tracking system is fundamentally incomplete. Values are loaded into the 6502's A register but are then immediately overwritten without being saved, causing subsequent instructions to reference non-existent values.

---

## Table of Contents

1. [Critical Issue #1: Value Tracking Broken](#critical-issue-1-value-tracking-broken)
2. [Critical Issue #2: PHI Node Lowering Incomplete](#critical-issue-2-phi-node-lowering-incomplete)
3. [Critical Issue #3: Binary Operations Don't Preserve Operands](#critical-issue-3-binary-operations-dont-preserve-operands)
4. [Critical Issue #4: Function Calling Convention Missing](#critical-issue-4-function-calling-convention-missing)
5. [Critical Issue #5: No Register Allocation](#critical-issue-5-no-register-allocation)
6. [Issue #6: E2E Tests Don't Verify Correctness](#issue-6-e2e-tests-dont-verify-correctness)
7. [Architecture Analysis](#architecture-analysis)
8. [Recommended Fix Plan](#recommended-fix-plan)

---

## Critical Issue #1: Value Tracking Broken

### Problem

The code generator tracks IL value locations via `valueLocations: Map<string, TrackedValue>` but this tracking is **incomplete and incorrect**.

When generating code like:
```typescript
let result = cursorY * SCREEN_WIDTH;
```

The IL generates:
```
v1 = LOAD_VAR cursorY
v2 = LOAD_VAR SCREEN_WIDTH
v3 = MUL v1, v2
```

But the code generator emits:
```asm
LDA $0B         ; Load cursorY into A (v1)
LDA _SCREEN_WIDTH  ; Load SCREEN_WIDTH into A - OVERWRITES v1!
; v3 = v1 * v2
LDA #$00        ; STUB: Cannot load v1  <- v1 is GONE!
```

### Root Cause

In `instruction-generator.ts`, the `generateLoadVar()` method loads a value into A but doesn't:
1. Check if A already contains a needed value
2. Save the current A value before overwriting
3. Track the new location properly

### Evidence from Generated Code

From `build/print-demo.asm`:
```asm
; function getScreenAddr(): word
_getScreenAddr:
        LDA $0B                 ; Load cursorY
        LDA _SCREEN_WIDTH  ; Load SCREEN_WIDTH  <- DESTROYS cursorY!
; v3 = v1 * v2
        LDA #$00                ; STUB: Cannot load v1
        STA $FB  ; Save multiplicand
        LDA #$00                ; STUB: Cannot load v2
```

### Impact

- **Every binary operation fails** when both operands aren't constants
- **~60+ warnings** emitted about "Unknown value location"
- **Generated code is incorrect** even when it assembles

---

## Critical Issue #2: PHI Node Lowering Incomplete

### Problem

PHI nodes in SSA form require proper lowering to explicit moves. The current implementation allocates merge variables but **cannot load the actual source values**.

### Evidence

```asm
; PHI prep: v8:cursorY.1 <- v4:cursorY.0 (from block entry)
; WARNING: Cannot load v4:cursorY.0 for PHI
LDA #$00                ; STUB: v4:cursorY.0   <- ALWAYS LOADS 0!
STA $40                 ; Store to PHI merge var for v8:cursorY.1
```

### Root Cause

In `handlePhiMovesForSuccessors()`:
```typescript
if (!this.loadValueToA(contributedValueId)) {
  // If we couldn't load it (untracked), emit a placeholder
  this.emitComment(`WARNING: Cannot load ${contributedValueId} for PHI`);
  this.emitLdaImmediate(0, `STUB: ${contributedValueId}`);  // ALWAYS 0!
}
```

The PHI sources reference values like `v4:cursorY.0` but these SSA-versioned values are never tracked in `valueLocations`.

### Impact

- **All control flow constructs produce wrong values**
- if/else, while, for loops all have broken PHI lowering
- Values that should flow through branches always become 0

---

## Critical Issue #3: Binary Operations Don't Preserve Operands

### Problem

The 6502 has only one accumulator (A). For binary operations like `ADD v1, v2`, both operands must be accessible, but the current code generator:
1. Loads v1 to A
2. Immediately loads v2 to A (destroying v1!)
3. Tries to perform ADD but can't find v1

### Current Code Flow

From `generateBinaryOp()`:
```typescript
// The left operand should already be in the accumulator (A).
// The right operand is looked up via value tracking...
const rightOperand = this.formatOperand(rightId);
```

But there's **no code to ensure the left operand is in A** or to **save it before loading the right operand**.

### Required Fix

For binary operations with two non-constant operands:
```asm
; v3 = v1 + v2 (where v1 and v2 are variables)
LDA v1_location      ; Load v1
STA $temp            ; Save to temp location
LDA v2_location      ; Load v2
STA $temp+1          ; Save v2 (or use X/Y if possible)
LDA $temp            ; Reload v1
CLC
ADC $temp+1          ; Add v2
```

### Impact

- **All arithmetic with non-constant operands fails**
- Multiply, divide, modulo routines receive wrong inputs
- Comparison results are incorrect

---

## Critical Issue #4: Function Calling Convention Missing

### Problem

The code generator emits `STUB: Call with N args (ABI not implemented)` for every function call with arguments.

```asm
; STUB: Call with 1 args (ABI not implemented)
JSR _printChar          ; Call printChar
```

### Missing Implementation

There's no calling convention for:
1. Passing parameters to functions
2. Returning values from functions
3. Preserving registers across calls

### Current State

From `generateCall()`:
```typescript
protected generateCall(instr: ILCallInstruction): void {
  // STUB: No parameter passing ABI yet
  if (instr.args.length > 0) {
    this.emitComment(`STUB: Call with ${instr.args.length} args (ABI not implemented)`);
  }
  // ...just emits JSR without setting up parameters
}
```

### Required Convention

Common 6502 calling conventions:
1. **Zero-page based**: First arg in $50, second in $51, etc.
2. **Stack based**: Push args to stack, function pops them
3. **Register based**: A=first arg, X=second, Y=third (limited)

### Impact

- **All function calls with parameters fail**
- Parameters are not passed to callees
- Return values may be lost

---

## Critical Issue #5: No Register Allocation

### Problem

The code generator has **no register allocation strategy**. It assumes:
- Values magically appear in the A register when needed
- Multiple values can exist in the A register simultaneously

### Current Reality

The 6502 has:
- **A register**: 8-bit accumulator (main working register)
- **X register**: 8-bit index register
- **Y register**: 8-bit index register
- **Zero Page**: 256 bytes of fast-access memory

Currently, the code generator:
1. Loads everything to A
2. Immediately overwrites A with the next load
3. Has no spilling to ZP or stack
4. Has no allocation strategy for X and Y

### Required Implementation

A proper register allocator would:
1. Track which values are in which register
2. Spill values to ZP when registers are full
3. Reload values from ZP when needed
4. Use X and Y for specific purposes (indexing, temp storage)

### Evidence

From `generateMul()`:
```asm
LDA #$00                ; STUB: Cannot load v1  <- Should have actual value
STA $FB  ; Save multiplicand
LDA #$00                ; STUB: Cannot load v2  <- Should have actual value
TAX  ; Multiplier in X
```

---

## Issue #6: E2E Tests Don't Verify Correctness

### Problem

The E2E tests only verify:
1. Compilation succeeds (`result.success === true`)
2. Certain instructions exist (`expectAsmContains(asm, 'CMP')`)
3. No STUB comments appear (but this check is incomplete)

They do **NOT verify**:
1. Generated code is semantically correct
2. Values flow correctly through the program
3. Output matches expected behavior

### Example Test (from smoke.test.ts)

```typescript
it('local variable should generate valid load/store', () => {
  const asm = compileToAsm(`
    function test(): byte {
      let x: byte = 10;
      return x;
    }
  `);
  // Should have actual LDA/STA instructions, not STUB comments
  expectAsmNotContains(asm, 'STUB:');
  expectAsmNotContains(asm, 'Unknown variable');
});
```

This test passes even though:
- The code might return wrong values
- Value tracking might be broken for more complex cases
- The function might not actually return 10

### Required Test Strategy

Tests should verify:
1. **Value correctness**: Expected memory contents after execution
2. **Control flow correctness**: Branch targets are correct
3. **Function behavior**: Return values match expectations
4. **End-to-end simulation**: Run in 6502 emulator and verify results

---

## Architecture Analysis

### Current Pipeline

```
Blend65 Source
     ↓
[Lexer] → Tokens
     ↓
[Parser] → AST
     ↓
[Semantic Analyzer] → Annotated AST
     ↓
[IL Generator] → IL Module (SSA form)
     ↓
[Optimizer] → Optimized IL (optional)
     ↓
[Code Generator] → ASM-IL Module   ← PROBLEMS HERE
     ↓
[ASM-IL Emitter] → ACME Assembly Text
     ↓
[ACME] → PRG Binary                ← FAILS HERE
```

### Where Problems Originate

| Component | Status | Issues |
|-----------|--------|--------|
| Lexer | ✅ Working | None found |
| Parser | ✅ Working | None found |
| Semantic | ✅ Working | None found |
| IL Generator | ✅ Working | Generates correct SSA |
| **Code Generator** | ❌ **BROKEN** | Value tracking, PHI lowering, calling convention |
| ASM-IL Emitter | ✅ Working | Correctly emits what it receives |
| ACME | ✅ Working | Correctly rejects invalid assembly |

### Key Files

**Must Fix**:
- `packages/compiler/src/codegen/instruction-generator.ts` - Main instruction translation
- `packages/compiler/src/codegen/base-generator.ts` - Value tracking infrastructure

**May Need Updates**:
- `packages/compiler/src/codegen/globals-generator.ts` - Global variable handling
- `packages/compiler/src/codegen/code-generator.ts` - Main entry point

---

## Recommended Fix Plan

### Phase 1: Fix Value Tracking (Critical)

**Objective**: Ensure values are never lost

1. **Track value locations precisely**
   - After LOAD_VAR: track value is in A
   - Before overwriting A: spill current value to ZP
   - Map each IL value to its current location

2. **Implement register spilling**
   - Reserve ZP range for spilled values (e.g., $60-$7F)
   - Create `spillValueToZP(valueId)` method
   - Create `reloadValueFromZP(valueId)` method

3. **Update binary operations**
   - Check if left operand needs to be loaded
   - Save left operand before loading right
   - Use proper operand locations in instructions

### Phase 2: Fix PHI Node Lowering (Critical)

**Objective**: SSA values flow correctly through control flow

1. **Track SSA-versioned values**
   - Handle names like `v4:cursorY.0` and `v7:cursorY.2`
   - Map both versioned and base names

2. **Pre-compute PHI sources**
   - Before generating a function, identify all PHI nodes
   - Pre-allocate merge variables
   - Ensure source values are saved before jumps

3. **Emit correct loads for PHI sources**
   - In predecessor blocks, load actual value (not 0!)
   - Store to merge variable
   - In merge block, load from merge variable

### Phase 3: Implement Calling Convention (High Priority)

**Objective**: Function parameters and return values work correctly

1. **Define ABI**
   - First 3 byte params: A, X, Y (or ZP $50, $51, $52)
   - Additional params: ZP $53+
   - Return value: A (byte) or A/X (word)

2. **Implement parameter passing**
   - In caller: load args to correct locations before JSR
   - In callee: parameters are pre-loaded

3. **Implement return value handling**
   - In callee: result in A before RTS
   - In caller: A contains return value after JSR

### Phase 4: Implement Proper Register Allocation (Medium Priority)

**Objective**: Efficient use of 6502 registers

1. **Simple allocation strategy**
   - A: primary working register
   - X: secondary, used for indexing and temp
   - Y: indexing, especially for arrays
   - ZP: spill area

2. **Track register contents**
   - Know what value is in each register
   - Avoid redundant loads
   - Use appropriate addressing modes

### Phase 5: Add Correctness Tests (High Priority)

**Objective**: Prevent regressions and verify behavior

1. **Value flow tests**
   - Test that values survive operations
   - Test that PHI nodes merge correctly

2. **Simulation tests**
   - Run generated code in 6502 emulator
   - Verify memory/register contents

3. **Golden output tests**
   - Compare generated ASM to known-good output
   - Detect any changes to code generation

---

## Critical Issue #7: Extreme Testing Required

### Problem

The code generator **lacks comprehensive test coverage** for actual code correctness. Current tests verify:
- ✅ "Compilation succeeded" 
- ✅ "Certain instructions exist"
- ❌ **NOT: "Generated code is correct"**
- ❌ **NOT: "Values are properly preserved"**
- ❌ **NOT: "Control flow behaves correctly"**
- ❌ **NOT: "Functions receive correct parameters"**

### Required Test Categories

#### 1. Value Preservation Tests
```typescript
describe('Value Preservation', () => {
  it('should preserve first operand in binary add', () => {
    // v1 = 10, v2 = 20, v3 = v1 + v2 should = 30, not 0
    expectAsmSequence([
      'LDA #$0A',        // Load 10
      { save: 'temp' },   // Must save before loading second operand
      'LDA #$14',        // Load 20
      'CLC',
      'ADC temp',        // Add saved value
    ]);
  });
  
  it('should preserve value across multiple operations', () => {
    // let x = 5; let y = x + 1; let z = x + 2;
    // x must still be 5 when computing z
  });
});
```

#### 2. PHI Node Correctness Tests
```typescript
describe('PHI Node Lowering', () => {
  it('should merge values correctly in if-else', () => {
    // if (cond) { x = 10 } else { x = 20 }
    // After merge, x must be 10 or 20, NOT 0
  });
  
  it('should track loop iteration variables', () => {
    // for (i = 0 to 9) - i must increment correctly
  });
});
```

#### 3. Function Calling Tests
```typescript
describe('Function Calling Convention', () => {
  it('should pass single parameter correctly', () => {
    // function f(a: byte) { return a + 1 }
    // f(10) must return 11
  });
  
  it('should pass multiple parameters correctly', () => {
    // function add(a: byte, b: byte) { return a + b }
    // add(3, 4) must return 7
  });
  
  it('should preserve caller values across call', () => {
    // let x = 5; call(); x must still be 5
  });
});
```

#### 4. End-to-End Correctness Tests
```typescript
describe('E2E Correctness', () => {
  it('should compute factorial correctly', () => {
    // function factorial(n: byte): word
    // factorial(5) must return 120
  });
  
  it('should iterate array correctly', () => {
    // for (i = 0 to 9) { poke(addr + i, data[i]) }
    // All 10 bytes must be written correctly
  });
});
```

#### 5. Simulation-Based Tests
```typescript
describe('6502 Simulation Tests', () => {
  it('should produce correct memory state', () => {
    const asm = compile('poke($D020, 5);');
    const sim = new Simulator6502();
    sim.loadAndRun(asm);
    expect(sim.memory[0xD020]).toBe(5);
  });
});
```

### Test Coverage Matrix

| Feature | Unit Test | Integration | E2E | Simulation |
|---------|-----------|-------------|-----|------------|
| CONST instruction | ✅ | ❌ | ❌ | ❌ |
| LOAD_VAR | ❓ | ❌ | ❌ | ❌ |
| STORE_VAR | ❓ | ❌ | ❌ | ❌ |
| Binary ADD | ✅ | ❌ | ❌ | ❌ |
| Binary MUL | ❌ | ❌ | ❌ | ❌ |
| If/Else | ✅ | ❌ | ❌ | ❌ |
| While loop | ✅ | ❌ | ❌ | ❌ |
| For loop | ✅ | ❌ | ❌ | ❌ |
| Function call | ❓ | ❌ | ❌ | ❌ |
| Array access | ❓ | ❌ | ❌ | ❌ |
| PHI lowering | ❌ | ❌ | ❌ | ❌ |
| Value preservation | ❌ | ❌ | ❌ | ❌ |

**Legend**: ✅ Has tests | ❓ Incomplete tests | ❌ No tests

### Test Infrastructure Needed

1. **ASM Sequence Validator** - Verify specific instruction sequences
2. **Value Flow Analyzer** - Track values through generated code
3. **6502 Simulator Integration** - Run code and verify results
4. **Golden Output Tests** - Compare against known-good output
5. **Regression Test Suite** - Prevent fixed issues from recurring

### Recommended Test Count

Based on the complexity of code generation:

| Component | Recommended Tests |
|-----------|-------------------|
| Value Tracking | 50+ |
| Binary Operations | 30+ per operator |
| PHI Lowering | 40+ |
| Calling Convention | 50+ |
| Register Allocation | 40+ |
| Control Flow | 60+ |
| Arrays | 30+ |
| **TOTAL** | **300+ new tests** |

---

---

## Critical Issue #8: 15+ IL Opcodes Not Implemented in Code Generator

### Problem

The code generator's `generateInstruction()` switch statement is **missing handlers for 15+ IL opcodes**. These opcodes fall through to `generatePlaceholder()` which emits a NOP and warning.

### Missing Opcodes

| IL Opcode | Purpose | Impact |
|-----------|---------|--------|
| `UNDEF` | Uninitialized variable | Variables may have undefined initial values |
| `LOAD_FIELD` | Load struct field | Struct access broken |
| `STORE_FIELD` | Store struct field | Struct access broken |
| `LOGICAL_AND` | Short-circuit AND | `a && b` won't short-circuit |
| `LOGICAL_OR` | Short-circuit OR | `a \|\| b` won't short-circuit |
| `ZERO_EXTEND` | byte → word | Type conversions broken |
| `TRUNCATE` | word → byte | Type conversions broken |
| `BOOL_TO_BYTE` | bool → byte | Type conversions broken |
| `BYTE_TO_BOOL` | byte → bool | Type conversions broken |
| `CALL_INDIRECT` | Function pointers | Callbacks via function pointers broken |
| `INTRINSIC_LENGTH` | Array/string length | `length()` intrinsic broken |
| `MAP_LOAD_FIELD` | @map struct field read | Hardware struct access broken |
| `MAP_STORE_FIELD` | @map struct field write | Hardware struct access broken |
| `MAP_LOAD_RANGE` | @map indexed range read | Hardware array access broken |
| `MAP_STORE_RANGE` | @map indexed range write | Hardware array access broken |

### Evidence from instruction-generator.ts

The switch statement handles specific opcodes but falls through to:
```typescript
default:
  this.generatePlaceholder(instr);
  break;
```

Which emits:
```asm
; STUB: [instruction description]
NOP                     ; Placeholder
```

### Impact

- **Type conversions don't work** - mixing byte/word types will fail
- **Struct access doesn't work** - any struct field access fails
- **Short-circuit evaluation doesn't work** - `a && b` evaluates both sides
- **Function pointers don't work** - can't pass callbacks
- **@map struct patterns fail** - VIC/SID register struct access broken

---

## Critical Issue #9: String Literals Not Implemented

### Problem

String literals are **not fully implemented** in either IL generation or code generation.

### Evidence from expressions.ts

```typescript
protected generateStringLiteral(
  _value: string,
  expr: LiteralExpression,
): VirtualRegister | null {
  // TODO: Implement proper string literal handling with _value
  // For now, emit a placeholder address
  this.addWarning(
    'String literal support not fully implemented',
    expr.getLocation(),
    'W_STRING_NOT_IMPLEMENTED',
  );

  // Return a placeholder byte (0) for now
  return this.builder?.emitConstByte(0) ?? null;
}
```

### What's Missing

1. **String storage** - No data section allocation for string bytes
2. **Null termination** - No automatic null terminator
3. **String address** - Returns 0 instead of actual address
4. **Character access** - Can't index into strings

### Impact

- **Any use of string literals produces wrong code**
- **Print functions won't work** - strings resolve to address 0
- **String comparisons fail** - comparing addresses, not content

---

## Critical Issue #10: 16-bit (Word) Operations Partially Broken

### Problem

Word (16-bit) operations have **incomplete handling** in the code generator. While constants and some basic operations work, complex 16-bit arithmetic has issues.

### Issues Found

1. **Word arithmetic** - ADD/SUB work but carry between bytes may be incorrect
2. **Word comparisons** - Only compares low byte in some cases
3. **Word storage** - A/X register pair used but not consistently tracked
4. **Word loads** - LOAD_VAR for words needs both bytes loaded correctly

### Evidence from instruction-generator.ts

```typescript
// For word values (> 255), we need to load both bytes
// A = low byte, X = high byte (for use by hi()/lo())
if (value > 255) {
  const lowByte = value & 0xFF;
  const highByte = (value >> 8) & 0xFF;
  // Load low byte into A
  this.emitLdaImmediate(lowByte, `${resultId} = ${value} (low byte)`);
  // Load high byte into X
  this.emitInstruction('LDX', `#${highHex}`, `${resultId} high byte`, 2);
```

But this A/X tracking is **not preserved through subsequent operations**.

### Impact

- **16-bit math may produce wrong results** when multiple word values are involved
- **Word comparisons may be incorrect** for values where low bytes match but high bytes differ
- **Word returns from functions** may only return low byte

---

## Critical Issue #11: Short-Circuit Evaluation Not Implemented

### Problem

Logical AND (`&&`) and OR (`||`) operators require **short-circuit evaluation**, but this is not implemented.

### What Short-Circuit Means

```typescript
// If a is false, b should NOT be evaluated
if (a && b) { ... }

// If a is true, b should NOT be evaluated  
if (a || b) { ... }
```

### Current Behavior

The IL generator emits `LOGICAL_AND` and `LOGICAL_OR` opcodes, but the code generator doesn't handle them - they fall through to placeholder.

Even if handled, proper short-circuit requires:
1. Evaluate left operand
2. Branch based on result
3. Only evaluate right operand if needed
4. Jump to merge

### Impact

- **Side effects in conditions** - `if (ptr && peek(ptr))` will crash if ptr is null
- **Performance** - Unnecessary evaluation of expensive expressions
- **Correctness** - Any code relying on short-circuit behavior breaks

---

## Critical Issue #12: Module/Import System Gaps

### Problem

Multi-file compilation and the import/export system may have **linker-level issues** that weren't fully tested.

### Potential Issues

1. **Cross-module function calls** - Do imported functions get correct labels?
2. **Cross-module variables** - Do imported globals resolve correctly?
3. **Export visibility** - Are exported symbols visible to linker?
4. **Name mangling** - Do module-qualified names work?

### Not Tested

The E2E tests don't include multi-file compilation scenarios:
- No tests for `import { func } from './module.blend'`
- No tests for `export function ...`
- No tests for cross-module variable access

### Impact

- **Any program with multiple files** may have unresolved symbols
- **Standard library imports** may not work correctly
- **Modular code organization** is untested

---

## Critical Issue #13: Array Initialization Incomplete

### Problem

Array initialization with literals works for simple cases but has **edge cases that fail**.

### Known Working

```blend
let data: byte[3] = [1, 2, 3];  // Works - generates !byte $01, $02, $03
```

### Potentially Broken

1. **Word arrays** - `let addrs: word[3] = [$1000, $2000, $3000]`
2. **Large arrays** - Arrays > 256 elements
3. **Computed initializers** - `let data: byte[3] = [x, y, z]` (non-constant)
4. **Empty initialization** - `let data: byte[10]` (uninitialized)

### Impact

- **Word arrays** may have incorrect byte ordering
- **Large arrays** may overflow addressing modes
- **Runtime-computed arrays** won't initialize correctly

---

## Critical Issue #14: Complex Expression Nesting

### Problem

Deeply nested expressions may **exhaust available registers** or lose intermediate values.

### Example

```blend
let result = (a + b) * (c - d) + (e / f) - (g % h);
```

This requires:
1. Compute a + b, save result
2. Compute c - d, save result  
3. Multiply saved results, save result
4. Compute e / f, save result
5. Compute g % h, save result
6. Add/subtract all intermediate results

### Current Problem

The code generator has **no strategy for managing intermediate values**. Each sub-expression loads/computes into A, but there's no tracking of where to save temporaries.

### Impact

- **Complex expressions produce wrong results** due to lost intermediate values
- **Expression nesting beyond 2 levels** is unreliable

---

## Updated Recommended Fix Plan

### Phase 0: Build Test Infrastructure (BEFORE any fixes)

**Objective**: Ensure we can verify fixes are correct

1. **ASM Sequence Validator** - Verify exact instruction sequences
2. **Value Flow Analyzer** - Track values through generated code
3. **6502 Simulator Integration** - Run code and verify results
4. **Golden Output Tests** - Compare against known-good output

### Phase 1: Fix Value Tracking (Critical - Foundation)

**Objective**: Ensure values are never lost

(Same as before)

### Phase 2: Implement Missing IL Opcodes (Critical)

**Objective**: Handle all 47 IL opcodes

1. **Type conversions**: ZERO_EXTEND, TRUNCATE, BOOL_TO_BYTE, BYTE_TO_BOOL
2. **Struct access**: LOAD_FIELD, STORE_FIELD
3. **Map access**: MAP_LOAD_FIELD, MAP_STORE_FIELD, MAP_LOAD_RANGE, MAP_STORE_RANGE
4. **Short-circuit**: LOGICAL_AND, LOGICAL_OR
5. **Other**: UNDEF, CALL_INDIRECT, INTRINSIC_LENGTH

### Phase 3: Fix PHI Node Lowering (Critical)

(Same as before)

### Phase 4: Implement Calling Convention (High Priority)

(Same as before)

### Phase 5: Implement String Literals (High Priority)

**Objective**: String literals work correctly

1. **String storage** - Allocate in data section with null terminator
2. **String addressing** - Return actual address, not 0
3. **String access** - Support indexing

### Phase 6: Fix 16-bit Operations (High Priority)

**Objective**: Word arithmetic and comparisons work correctly

1. **Proper A/X tracking** for word values
2. **Multi-byte arithmetic** with carry handling
3. **Word comparisons** checking both bytes
4. **Word return values** from functions

### Phase 7: Implement Proper Register Allocation (Medium Priority)

(Same as before)

### Phase 8: Test Module System (Medium Priority)

**Objective**: Multi-file compilation works

1. **Import/export tests** - Verify cross-module calls
2. **Standard library tests** - Verify library imports work
3. **Name resolution tests** - Verify qualified names

### Phase 9: Add Comprehensive Correctness Tests (High Priority)

(Same as before, but expanded to 300+ tests)

---

## Conclusion

The Blend65 compiler has **critical code generation issues** that make it impossible to compile real programs correctly. The issues are well-defined and fixable:

1. **Value Tracking**: Values are lost because the code generator doesn't manage the single accumulator properly
2. **PHI Lowering**: Control flow doesn't work because PHI sources always resolve to 0
3. **Calling Convention**: Functions can't receive parameters
4. **Register Allocation**: No strategy for using the limited 6502 registers
5. **Missing IL Opcodes**: 15+ opcodes not implemented (type conversions, structs, @map)
6. **String Literals**: Completely unimplemented (returns 0)
7. **16-bit Operations**: Partially broken (word tracking, comparisons)
8. **Short-Circuit Evaluation**: Not implemented
9. **Module System**: Untested for multi-file compilation
10. **Testing Gap**: Current tests verify compilation, NOT correctness

**Estimated Fix Effort**: 80-120 hours of focused development + 30-40 hours for comprehensive test suite

**Priority**: CRITICAL - These issues block all non-trivial programs

**Recommendation**: 
1. **Build test infrastructure FIRST** (Phase 0)
2. Fix Value Tracking (Phase 1) as foundation
3. Implement missing IL opcodes (Phase 2) for language feature coverage
4. Continue with remaining phases in order