# Final Completion Amendment: 12 Tasks for True 100%

> **Document**: 21-final-completion-2026-01-28.md
> **Parent**: [Index](00-index.md)
> **Status**: Amendment for 100% Working Compiler
> **Created**: January 28, 2026
> **Total Tasks**: 12
> **Est. Hours**: 7-10

---

## Overview

This amendment identifies the **final 3 gaps** that would prevent the compiler from being truly 100% working after implementing the main plan and all previous amendments (17-20).

After extensive review against:
- Language specification (05-type-system.md, 06-expressions-statements.md, 13-6502-features.md)
- Existing codebase (CLI, BASIC stub generator, intrinsics)
- All amendment documents (17-20)

These 12 tasks represent the **minimum additional work** needed for a completely working compiler.

---

## Gap A: Complete ISR (Interrupt Service Routine) Flow Testing

**Current State:**
- ✅ Callback function RTI generation: Covered in Phase 7A
- ✅ Register preservation (PHA/TXA/PHA/TYA/PHA → PLA/TAY/PLA/TAX/PLA): Covered in Amendment 18
- ❌ **Missing**: End-to-end test that actually triggers an interrupt

**Why This Matters:**
Without testing the complete interrupt flow in VICE, we cannot verify that:
1. The handler installs correctly at $0314
2. When interrupt fires, the handler actually executes
3. The main program resumes correctly after RTI
4. Register preservation actually works under real conditions

### Tasks

| Task | Description | Est. Time |
|------|-------------|-----------|
| A.1 | Create VICE test fixture: IRQ handler that changes border color | 1 hour |
| A.2 | Install handler using `pokew($0314, @handler)` | 30 min |
| A.3 | Set raster interrupt to trigger handler (VIC $D012/$D01A) | 30 min |
| A.4 | Verify: border color changes after interrupt fires | 30 min |

**Test File**: `packages/compiler/fixtures/99-comprehensive/06-intrinsics/irq-handler.blend`

```js
module IRQ.Test;

@map vicControl at $D011: byte;
@map rasterLine at $D012: byte;
@map vicInterrupt at $D019: byte;
@map vicInterruptEnable at $D01A: byte;
@map borderColor at $D020: byte;

let irqCount: byte = 0;

callback function rasterIRQ(): void {
    // Acknowledge interrupt
    vicInterrupt = $FF;
    
    // Change border color to show handler ran
    borderColor = irqCount;
    irqCount += 1;
}

export function main(): void {
    // Disable interrupts during setup
    sei();
    
    // Set raster line for interrupt
    rasterLine = 100;
    
    // Enable raster interrupt
    vicInterruptEnable = $01;
    
    // Install handler
    pokew($0314, @rasterIRQ);
    
    // Enable interrupts
    cli();
    
    // Main loop - border should cycle colors
    while (true) {
        // Do nothing, interrupts drive changes
    }
}
```

**VICE Test Verification**:
```bash
# Run for 2 seconds, check if border color changed from initial
# Expected: borderColor != initial value (interrupt handler ran)
```

---

## Gap B: Compile-Time Array Bounds Checking

**Current State:**
- ✅ Array size tracking in type system
- ✅ Constant index array access codegen
- ❌ **Missing**: Semantic analyzer doesn't emit error for out-of-bounds constant indices

**Why This Matters:**
Without compile-time bounds checking, programmers can silently corrupt memory:
```js
let buffer: byte[10];
buffer[15] = 5;  // Should be compile error, currently compiles!
```

### Tasks

| Task | Description | Est. Time |
|------|-------------|-----------|
| B.1 | Implement bounds check in semantic analyzer for constant indices | 1 hour |
| B.2 | Test: `arr[10]` on `byte[10]` → ERROR (index 10 out of bounds 0-9) | 30 min |
| B.3 | Test: `arr[-1]` → ERROR (negative index) | 15 min |
| B.4 | Test: `arr[9]` on `byte[10]` → OK (valid last index) | 15 min |

**Implementation Location**: `packages/compiler/src/semantic/type-checker.ts`

**Error Message Format**:
```
Error: Array index 15 is out of bounds for array of size 10 (valid range: 0-9)
  --> src/main.blend:5:1
   |
 5 | buffer[15] = 5;
   | ^^^^^^^^^
```

**Test Cases**:
```js
// Should ERROR
let arr: byte[10];
arr[10] = 5;      // ERROR: index 10 out of bounds (0-9)
arr[100] = 5;     // ERROR: index 100 out of bounds (0-9)
arr[-1] = 5;      // ERROR: negative index

// Should OK
let arr2: byte[10];
arr2[0] = 5;      // OK: first element
arr2[9] = 5;      // OK: last element
arr2[5] = 5;      // OK: middle element
```

---

## Gap C: Word Return Values in Nested Expression Context

**Current State:**
- ✅ Word arithmetic with carry (Phase 6)
- ✅ Function return values in A/X (Phase 4)
- ✅ Nested function calls with spill (Amendment 18, Critical Gap 3)
- ❌ **Missing**: Specific test for word-returning functions in expression context

**Why This Matters:**
The combination of these features creates a complex scenario:
1. Call first word function → result in A (low) / X (high)
2. Must spill BOTH A and X before next call
3. Call second word function → new result in A/X
4. Must reload first result for 16-bit operation
5. Perform 16-bit addition/subtraction with carry

This specific pattern isn't explicitly tested anywhere.

### Tasks

| Task | Description | Est. Time |
|------|-------------|-----------|
| C.1 | Create test: `getWord1() + getWord2()` (two word returns, then add) | 30 min |
| C.2 | Verify first word result is spilled (2 bytes to ZP) | 30 min |
| C.3 | Verify 16-bit addition with carry is correct | 30 min |
| C.4 | VICE test: Verify mathematical correctness at runtime | 30 min |

**Test File**: `packages/compiler/fixtures/99-comprehensive/04-functions/word-return-expression.blend`

```js
module Word.ReturnExpression;

@map borderColor at $D020: byte;

function getBase(): word {
    return $0400;  // Screen RAM base
}

function getOffset(): word {
    return 40;  // One row offset
}

function multiply40(y: byte): word {
    return y * 40;
}

export function main(): void {
    // Test 1: Two word functions added
    let addr1: word = getBase() + getOffset();
    // Expected: $0400 + $0028 = $0428
    
    // Test 2: Chain of word operations
    let addr2: word = getBase() + getOffset() + getOffset();
    // Expected: $0400 + $0028 + $0028 = $0450
    
    // Test 3: Mixed word returns with arithmetic
    let row: byte = 5;
    let col: byte = 10;
    let screenPos: word = getBase() + multiply40(row) + col;
    // Expected: $0400 + $00C8 + $000A = $04D2
    
    // Verify by writing to calculated address
    poke(addr1, 65);      // Write 'A' to calculated position
    poke(addr2, 66);      // Write 'B' to calculated position
    poke(screenPos, 67);  // Write 'C' to calculated position
    
    // Visual confirmation: border green if all calculations correct
    // (manual verification in VICE needed)
    borderColor = 5;
}
```

**VICE Verification**:
```
Memory check:
- $0428 should contain $41 (65, 'A')
- $0450 should contain $42 (66, 'B')
- $04D2 should contain $43 (67, 'C')
```

---

## Task Checklist

### Gap A: ISR Flow Testing
- [ ] A.1 Create VICE test fixture: IRQ handler
- [ ] A.2 Install handler using pokew($0314, @handler)
- [ ] A.3 Set raster interrupt trigger
- [ ] A.4 Verify handler executes and main resumes

### Gap B: Bounds Checking
- [ ] B.1 Implement bounds check in semantic analyzer
- [ ] B.2 Test out-of-bounds constant index → ERROR
- [ ] B.3 Test negative index → ERROR
- [ ] B.4 Test valid indices → OK

### Gap C: Word Returns in Expressions
- [ ] C.1 Test two word returns with addition
- [ ] C.2 Verify 2-byte spill for word values
- [ ] C.3 Verify 16-bit addition with carry
- [ ] C.4 VICE test mathematical correctness

---

## Integration with Execution Plan

### Recommended Phase Placement

| Gap | Add to Phase | Rationale |
|-----|--------------|-----------|
| A (ISR) | Phase 7A (Callback Functions) | Natural extension of callback testing |
| B (Bounds) | Phase PRE or Phase 2F | Semantic check, affects array access |
| C (Word Expr) | Phase 6 (Word Operations) | Tests word tracking in complex scenario |

### Updated Session Protocol

After completing Phase 7A, add:
```markdown
#### Session 7A.3: ISR Complete Flow Test (1-2 hours)

**Tasks**:
| # | Task | File |
|---|------|------|
| 7A.3.1 | Create IRQ handler test fixture | `fixtures/99-comprehensive/` |
| 7A.3.2 | Install handler via pokew | test file |
| 7A.3.3 | Configure raster interrupt | test file |
| 7A.3.4 | VICE test: verify handler runs | VICE |

**Deliverables**:
- [ ] IRQ handler compiles and installs
- [ ] VICE shows interrupt handler executing
- [ ] Main program continues after RTI
```

---

## Success Criteria

**These 12 tasks are complete when:**

1. ✅ IRQ handler test runs in VICE, handler executes on raster line
2. ✅ Constant out-of-bounds array access produces compile error
3. ✅ Word-returning functions in expressions produce correct results
4. ✅ All tests pass
5. ✅ No STUB comments related to these features

---

## Final Statistics

### Updated Grand Total (Including This Amendment)

| Category | Tasks | Est. Hours |
|----------|-------|------------|
| Original Plan (Phases 0-9) | ~150 | 110-160 |
| Amendment 17-20 | ~175 | 89-132 |
| **Amendment 21 (This)** | **12** | **7-10** |
| **GRAND TOTAL** | **~337** | **206-302** |

### Final Completion Percentage

After implementing ALL amendments including this one:
- **Estimated Completion**: **100%** for all documented language features
- **Remaining**: Optimizer enhancements (out of scope)

---

## Conclusion

This amendment represents the **final identified gaps** between the current codegen-fixes plan and a truly 100% working compiler.

The 12 tasks (7-10 hours) address:
1. **ISR flow** - Complete interrupt handling verification
2. **Bounds checking** - Compile-time safety for arrays
3. **Word expressions** - Complex 16-bit operation sequences

With these additions, the Blend65 compiler will be able to compile **all valid programs** according to the language specification, with **correct runtime behavior** verified in VICE.