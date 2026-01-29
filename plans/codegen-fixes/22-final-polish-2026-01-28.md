# Final Polish Amendment: 5 Tasks for True 100%

> **Document**: 22-final-polish-2026-01-28.md
> **Parent**: [Index](00-index.md)
> **Status**: Amendment for 100% Working Compiler
> **Created**: January 28, 2026
> **Total Tasks**: 13
> **Est. Hours**: 3-4

---

## Overview

This amendment identifies **5 final gaps** discovered during a strict cross-reference review of the codegen-fixes plan against the Blend65 language specification.

These gaps are **edge cases and polish items**, not fundamental issues. After implementing all previous amendments (17-21), the compiler will be ~95% working. These 13 tasks close the final 5% gap.

---

## Gap A: Word Array Stride Calculation

**Risk Level**: MEDIUM-HIGH

### Problem

Word arrays have 2-byte elements. When using variable indices, the index must be multiplied by 2 to get the correct memory offset.

```js
let positions: word[10];
positions[i] = $1000;  // Must access: base + (i * 2)
```

**Current Concern**: The plan addresses large array indexing (>256 elements) but doesn't explicitly verify stride calculation for word arrays vs byte arrays.

### What Can Go Wrong

```js
let bytes: byte[10];
let words: word[10];

bytes[5] = 42;   // Access: base + 5  ✅
words[5] = 42;   // Access: base + 10 (5 * 2) ← Must verify this works!
```

If stride isn't applied:
- `words[1]` would access byte 1 instead of byte 2
- Entire array access would be corrupted

### Implementation Tasks

| Task | Description | Est. Time |
|------|-------------|-----------|
| A.1 | Verify codegen multiplies index by element size for word arrays | 30 min |
| A.2 | Test: `wordArray[i]` where i=5 accesses correct address (base+10) | 30 min |
| A.3 | Test: Compare byte array access vs word array access | 15 min |
| A.4 | VICE test: Verify word array read/write correctness | 30 min |

**File to verify**: `codegen/instruction-generator.ts` - array index calculation

**Test Cases**:
```js
// Test file: word-array-stride.blend
let byteArr: byte[10];
let wordArr: word[10];

// Write distinct values
for (i = 0 to 4) {
  byteArr[i] = i;           // Offsets: 0, 1, 2, 3, 4
  wordArr[i] = i * 100;     // Offsets: 0, 2, 4, 6, 8
}

// Verify by reading back
// wordArr[2] should be 200, not garbage from wrong offset
```

---

## Gap B: Ternary Operator Code Generation

**Risk Level**: MEDIUM

### Problem

The language specification includes the ternary operator `?:`:

```js
let result = condition ? valueIfTrue : valueIfFalse;
```

The plan covers short-circuit evaluation for `&&` and `||`, but ternary operator code generation isn't explicitly addressed.

### What's Required

Ternary requires control flow branching:

```asm
; condition ? trueVal : falseVal
    LDA condition
    BEQ else_branch
    
    ; Then branch
    LDA trueVal
    JMP end_ternary
    
else_branch:
    ; Else branch
    LDA falseVal
    
end_ternary:
    ; Result in A
```

### Implementation Tasks

| Task | Description | Est. Time |
|------|-------------|-----------|
| B.1 | Verify IL generator emits correct IL for ternary expressions | 15 min |
| B.2 | Verify codegen handles ternary control flow | 15 min |
| B.3 | Test: Basic ternary `x > 5 ? 10 : 20` | 15 min |
| B.4 | Test: Ternary with function calls `cond ? func1() : func2()` | 15 min |
| B.5 | Test: Nested ternary `a ? b ? 1 : 2 : 3` | 15 min |

**Test Cases**:
```js
// Basic ternary
let x: byte = 10;
let result1 = x > 5 ? 100 : 0;  // Should be 100

// Ternary with side effects - only one branch should execute
let counter: byte = 0;

function incAndReturn(): byte {
  counter += 1;
  return counter;
}

let y: byte = true ? incAndReturn() : incAndReturn();
// counter should be 1, not 2 (short-circuit)
```

---

## Gap C: @map Compound Assignment

**Risk Level**: LOW-MEDIUM

### Problem

Compound assignments to memory-mapped variables require read-modify-write sequences:

```js
@map vicBorderColor at $D020: byte;
vicBorderColor += 1;  // Must: read, modify, write
```

### What's Required

Correct sequence:
```asm
; vicBorderColor += 1
LDA $D020       ; 1. READ from hardware register
CLC
ADC #$01        ; 2. MODIFY
STA $D020       ; 3. WRITE back
```

**Hardware Concern**: Some hardware registers have read side-effects. The plan addresses @map access but not compound assignment specifically.

### Implementation Tasks

| Task | Description | Est. Time |
|------|-------------|-----------|
| C.1 | Test: Simple @map compound assignment `borderColor += 1` | 15 min |
| C.2 | Test: @map compound with bitwise `status &= mask` | 15 min |
| C.3 | Test: Struct @map field compound `vic.borderColor += 1` | 15 min |

**Test Cases**:
```js
@map borderColor at $D020: byte;

// Compound assignments
borderColor += 1;     // Increment
borderColor &= $0F;   // Mask lower nibble
borderColor |= $80;   // Set high bit
borderColor ^= $FF;   // Invert

// With struct
@map vic at $D000 layout {
  borderColor: at $D020: byte
}

vic.borderColor += 5;
```

---

## Gap D: Sequential Struct @map Field Offsets

**Risk Level**: LOW

### Problem

Sequential struct @map forms require compile-time offset calculation from base address:

```js
@map sidVoice1 at $D400 type {
  frequencyLo: byte,   // Offset 0 → $D400
  frequencyHi: byte,   // Offset 1 → $D401
  pulseLo: byte,       // Offset 2 → $D402
  pulseHi: byte,       // Offset 3 → $D403
  waveform: byte       // Offset 4 → $D404
}
```

Amendment 19 covers simple/range @map verification, but sequential struct field offset calculation isn't explicitly tested.

### Implementation Tasks

| Task | Description | Est. Time |
|------|-------------|-----------|
| D.1 | Test: Sequential struct first field at base address | 15 min |
| D.2 | Test: Sequential struct later fields at computed offsets | 15 min |
| D.3 | Test: Sequential struct with word fields (2-byte offset) | 15 min |

**Test Cases**:
```js
@map test at $C000 type {
  field0: byte,   // $C000
  field1: byte,   // $C001
  field2: word,   // $C002-$C003
  field3: byte    // $C004
}

// Verify each field accesses correct address
test.field0 = 1;   // STA $C000
test.field1 = 2;   // STA $C001
test.field2 = $1234; // STA $C002 / STX $C003
test.field3 = 4;   // STA $C004
```

---

## Gap E: BASIC Stub for PRG Auto-Run

**Risk Level**: LOW

### Problem

For C64 PRG programs to auto-run with `RUN`, a BASIC stub is required:

```asm
* = $0801
; BASIC line: 10 SYS 2061
!byte $0c, $08          ; Next line pointer
!byte $0a, $00          ; Line number 10
!byte $9e               ; SYS token
!text "2061"            ; Address to call
!byte $00               ; End of line
!byte $00, $00          ; End of program
```

Amendment 20 mentions PRG output format but doesn't explicitly verify BASIC stub generation.

### Verification Tasks

| Task | Description | Est. Time |
|------|-------------|-----------|
| E.1 | Verify CLI generates BASIC stub in PRG output | 15 min |
| E.2 | Test: Compiled PRG runs with `LOAD"FILE",8,1` then `RUN` | 15 min |

**Verification**:
```bash
# Compile a simple program
blend65 compile examples/simple/main.blend -o test.prg

# Check PRG starts with BASIC stub
hexdump -C test.prg | head -5
# Should show: 01 08 0c 08 0a 00 9e 32 30 36 31 00 00 00

# Load in VICE and verify RUN works
```

---

## Task Checklist

### Gap A: Word Array Stride
- [ ] A.1 Verify codegen multiplies index by element size
- [ ] A.2 Test: `wordArray[i]` accesses correct address
- [ ] A.3 Test: Compare byte vs word array access
- [ ] A.4 VICE test: Word array correctness

### Gap B: Ternary Operator
- [ ] B.1 Verify IL generator for ternary
- [ ] B.2 Verify codegen ternary control flow
- [ ] B.3 Test: Basic ternary expression
- [ ] B.4 Test: Ternary with function calls
- [ ] B.5 Test: Nested ternary

### Gap C: @map Compound Assignment
- [ ] C.1 Test: Simple @map compound
- [ ] C.2 Test: @map bitwise compound
- [ ] C.3 Test: Struct field compound

### Gap D: Sequential Struct Offsets
- [ ] D.1 Test: First field at base
- [ ] D.2 Test: Later fields at offsets
- [ ] D.3 Test: Word field offsets

### Gap E: BASIC Stub
- [ ] E.1 Verify CLI generates BASIC stub
- [ ] E.2 VICE test: PRG runs with RUN command

---

## Summary

| Gap | Description | Tasks | Est. Hours |
|-----|-------------|-------|------------|
| A | Word Array Stride | 4 | 1.75 |
| B | Ternary Operator | 5 | 1.25 |
| C | @map Compound Assignment | 3 | 0.75 |
| D | Sequential Struct Offsets | 3 | 0.75 |
| E | BASIC Stub | 2 | 0.5 |
| **TOTAL** | | **17** | **5** |

---

## Integration with Execution Plan

### Recommended Phase Placement

| Gap | Add to Phase | Rationale |
|-----|--------------|-----------|
| A (Stride) | Phase 2F (Arrays) or Phase 6 (Word) | Array access, word handling |
| B (Ternary) | Phase 2 (Missing Opcodes) | Expression handling |
| C (Compound) | Phase 2E (@map) | Memory-mapped access |
| D (Struct Offsets) | Phase 2E (@map) | Memory-mapped access |
| E (BASIC Stub) | Phase PRE or Final | CLI/output format |

---

## Success Criteria

**These 17 tasks are complete when:**

1. ✅ Word arrays with variable indices access correct addresses
2. ✅ Ternary operator generates correct control flow
3. ✅ @map compound assignments work correctly
4. ✅ Sequential struct fields have correct offsets
5. ✅ PRG output runs in VICE with RUN command
6. ✅ All tests pass

---

## Updated Grand Total

### Complete Plan Statistics

| Category | Tasks | Est. Hours |
|----------|-------|------------|
| Original Plan (Phases 0-9) | ~150 | 110-160 |
| Amendments 17-21 | ~175 | 89-132 |
| **Amendment 22 (This)** | **17** | **5** |
| **GRAND TOTAL** | **~342** | **204-297** |

---

## Conclusion

This amendment represents the **absolute final polish** for a 100% working Blend65 compiler.

The 17 tasks (5 hours) address edge cases that complete testing would catch:
1. **Word array stride** - Correct element size multiplication
2. **Ternary operator** - Control flow expression handling
3. **@map compound** - Read-modify-write sequences
4. **Sequential struct** - Field offset calculation
5. **BASIC stub** - Auto-run PRG support

After implementing this amendment plus all previous phases and amendments, the Blend65 compiler will be **truly complete** and able to compile **any valid program** according to the language specification.

---

## Appendix: Additional Testing Edge Cases

**Status**: Optional testing items for Phase 9 (Correctness Tests)

These edge cases were identified during a final comprehensive review. They represent **very minor** testing opportunities rather than plan gaps. Include as test cases during Phase 9.

### Edge Case 1: Unary Minus on Variables/Expressions

**Scenario**: Unary minus applied to variables and expressions, not just literals.

```js
let x: byte = 10;
let y: byte = -x;           // Unary minus on variable
let z: byte = -(a + b);     // Unary minus on expression
let w: byte = --x;          // Double unary minus
```

**Test**: Verify codegen produces correct NEG/complement operation.

---

### Edge Case 2: Chained Member + Index Access

**Scenario**: Complex access chains mixing struct fields and array indices.

```js
// Mix of struct field and range index
vic.sprites[i] = x;

// Deeply nested access (if supported)
enemy[0].position.x = 10;
```

**Test**: Verify correct address calculation for each access type.

---

### Edge Case 3: Break/Continue in Nested Loops

**Scenario**: Ensure break/continue target the correct (innermost) loop.

```js
for (i = 0 to 10) {
    for (j = 0 to 10) {
        if (found) {
            break;     // Must only exit inner loop
        }
    }
    // Execution continues here after break
}

while (outer) {
    while (inner) {
        continue;      // Must only skip inner iteration
    }
}
```

**Test**: Verify branch targets are correct in generated assembly.

---

### Edge Case 4: Compound Assignment on Index Expressions

**Scenario**: Compound operators applied to indexed locations.

```js
buffer[i] += 5;              // Increment indexed byte
vic.sprites[i] += 1;         // Increment @map range element
positions[j] *= 2;           // Multiply indexed element
```

**Test**: Verify read-modify-write sequence on indexed locations.

---

### Edge Case 5: Unsigned Arithmetic Wrap-Around

**Scenario**: Subtraction that would be negative in signed arithmetic.

```js
let x: byte = 5;
let y: byte = 10;
let result: byte = x - y;    // 5 - 10 = 251 (unsigned wrap)

let a: word = 100;
let b: word = 200;
let c: word = a - b;         // 100 - 200 = 65436 (unsigned wrap)
```

**Test**: Verify wrap-around produces correct unsigned result.

---

### Edge Case Checklist (Optional)

These items should be verified during Phase 9 testing:

- [ ] EC.1 Unary minus on variable: `-x` generates correct code
- [ ] EC.2 Unary minus on expression: `-(a + b)` generates correct code
- [ ] EC.3 Chained access: `vic.sprites[i]` generates correct address
- [ ] EC.4 Break in nested loop: exits only inner loop
- [ ] EC.5 Continue in nested loop: skips only inner iteration
- [ ] EC.6 Compound on indexed: `buffer[i] += 5` read-modify-write
- [ ] EC.7 Compound on @map indexed: `sprites[i] += 1` read-modify-write
- [ ] EC.8 Unsigned wrap byte: `5 - 10 = 251`
- [ ] EC.9 Unsigned wrap word: `100 - 200 = 65436`

**Note**: These are testing edge cases, not implementation gaps. They should naturally be covered by comprehensive Phase 9 testing.

---

## Related Documents

- [Index](00-index.md) - Main plan index
- [Final Completion](21-final-completion-2026-01-28.md) - Previous amendment
- [Execution Plan](99-execution-plan.md) - Session schedule
- [Language Specification](../../docs/language-specification/) - Source of truth