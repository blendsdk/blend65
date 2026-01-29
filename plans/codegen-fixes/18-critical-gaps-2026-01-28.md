# Critical Gaps Amendment: 2026-01-28

> **Document**: 18-critical-gaps-2026-01-28.md
> **Parent**: [Index](00-index.md)
> **Date**: 2026-01-28
> **Purpose**: Address CRITICAL gaps identified during comprehensive plan review
> **Severity**: ALL GAPS ARE CRITICAL

---

## 🚨 CRITICAL: These Gaps MUST Be Addressed

During a comprehensive review of the codegen-fixes plan against the Blend65 language specification, the following gaps were identified. **ALL of these are classified as CRITICAL** - failure to address ANY of them will result in a non-working compiler.

---

## Critical Gap 1: Callback Function Register Preservation

**Location**: Phase 7A (Callback Functions)

### Problem

The plan mentions `RTI` for callback/interrupt handlers but does NOT address register preservation. For interrupt handlers, ALL registers MUST be saved on entry and restored on exit.

### Current Plan (INCOMPLETE)

```js
callback function myIRQ(): void {
  // handler code
}
// Generates RTI instead of RTS
```

### What's MISSING

```asm
_myIRQ:
    ; MISSING: Save all registers
    PHA             ; Save A
    TXA
    PHA             ; Save X  
    TYA
    PHA             ; Save Y
    
    ; ... interrupt handler code ...
    
    ; MISSING: Restore all registers
    PLA
    TAY             ; Restore Y
    PLA
    TAX             ; Restore X
    PLA             ; Restore A
    RTI
```

### Impact

Without register preservation, interrupt handlers will **corrupt the main program's registers**, causing:
- Random crashes
- Incorrect calculations
- Memory corruption
- Unpredictable behavior

### Solution

**Add to Phase 7A:**

| Task | Description | File |
|------|-------------|------|
| 7A.1.3 | Add PHA/TXA/PHA/TYA/PHA at callback entry | `code-generator.ts` |
| 7A.1.4 | Add PLA/TAY/PLA/TAX/PLA before RTI | `code-generator.ts` |
| 7A.1.5 | Test: Verify registers preserved in IRQ | tests |
| 7A.1.6 | Test: Main program state unchanged after IRQ | tests (VICE) |

### Implementation

```typescript
protected generateCallbackFunctionPrologue(): void {
  // Save all registers to stack
  this.emitInstruction('PHA', undefined, 'Save A', 1);
  this.emitInstruction('TXA', undefined, 'Transfer X to A', 1);
  this.emitInstruction('PHA', undefined, 'Save X', 1);
  this.emitInstruction('TYA', undefined, 'Transfer Y to A', 1);
  this.emitInstruction('PHA', undefined, 'Save Y', 1);
}

protected generateCallbackFunctionEpilogue(): void {
  // Restore all registers from stack (reverse order)
  this.emitInstruction('PLA', undefined, 'Restore Y', 1);
  this.emitInstruction('TAY', undefined, 'Transfer A to Y', 1);
  this.emitInstruction('PLA', undefined, 'Restore X', 1);
  this.emitInstruction('TAX', undefined, 'Transfer A to X', 1);
  this.emitInstruction('PLA', undefined, 'Restore A', 1);
  this.emitInstruction('RTI', undefined, 'Return from interrupt', 1);
}
```

---

## Critical Gap 2: Large Array Indexing (>256 Elements)

**Location**: Phase 2F (Array Operations)

### Problem

The 6502's Y register is 8-bit (0-255). For arrays with >256 elements, or word arrays (2 bytes per element), indexed addressing mode cannot reach all elements.

### Current Plan (INCOMPLETE)

Phase 2F covers basic array indexing but doesn't handle:
- Arrays with >256 elements
- Word arrays where element 128+ requires index >255 (128 * 2 = 256)

### What Fails

```js
let bigBuffer: byte[1000];
bigBuffer[500] = 42;  // Index 500 > 255, Y register can't hold it!

let wordArray: word[200];
wordArray[150] = $1234;  // Index 150 * 2 = 300 > 255!
```

### Impact

- Any array access beyond element 255 will silently wrap and access wrong memory
- Word arrays can only safely access first 127 elements
- Screen memory (1000 bytes), large buffers, etc. will be inaccessible

### Solution

**Add to Phase 2F:**

| Task | Description | File |
|------|-------------|------|
| 2F.3.1 | Detect array accesses requiring >8-bit index | `instruction-generator.ts` |
| 2F.3.2 | Implement 16-bit index calculation to ZP pointer | `instruction-generator.ts` |
| 2F.3.3 | Use indirect indexed addressing `(ZP),Y` for large arrays | `instruction-generator.ts` |
| 2F.3.4 | Test: Access element 500 of byte[1000] | tests |
| 2F.3.5 | Test: Access element 150 of word[200] | tests |
| 2F.3.6 | VICE test: Verify large array read/write | tests (VICE) |

### Implementation Pattern

For `bigBuffer[500]`:

```asm
; Calculate address: base + 500
LDA #<bigBuffer
CLC
ADC #<500           ; Low byte of offset
STA $FB             ; ZP pointer low
LDA #>bigBuffer
ADC #>500           ; High byte of offset + carry
STA $FC             ; ZP pointer high

; Access via indirect indexed
LDY #$00
LDA #$2A            ; Value 42
STA ($FB),Y         ; Store via indirect addressing
```

---

## Critical Gap 3: Nested Function Calls in Expressions

**Location**: Phase 1 (Value Tracking) or Phase 4 (Calling Convention)

### Problem

The plan addresses complex expressions and function calls separately, but doesn't explicitly handle nested function calls where return values must be preserved.

### What Fails

```js
let result = add(multiply(a, b), divide(c, d));
```

Execution flow:
1. Call `multiply(a, b)` → result in A
2. **Need to save A before next call!**
3. Call `divide(c, d)` → result in A (overwrites multiply result!)
4. Call `add(saved_multiply_result, divide_result)` → **multiply result is LOST**

### Impact

- Any expression with 2+ function calls will produce incorrect results
- Very common pattern: `func1(func2(...), func3(...))` 
- Silent data corruption

### Solution

**Add to Phase 1 (Value Tracking):**

| Task | Description | File |
|------|-------------|------|
| 1.5.1 | Track function call results in expression context | `instruction-generator.ts` |
| 1.5.2 | Spill return values before subsequent calls | `instruction-generator.ts` |
| 1.5.3 | Reload spilled values for outer call | `instruction-generator.ts` |
| 1.5.4 | Test: `add(mul(a,b), div(c,d))` produces correct result | tests |
| 1.5.5 | Test: 3-level nested calls | tests |
| 1.5.6 | VICE test: Verify mathematical correctness | tests (VICE) |

### Implementation Pattern

For `add(multiply(a, b), divide(c, d))`:

```asm
; 1. Evaluate multiply(a, b)
; ... setup args ...
JSR _multiply
; Result in A

; 2. SPILL result before next call
STA $60             ; Spill multiply result

; 3. Evaluate divide(c, d)
; ... setup args ...
JSR _divide
; Result in A

; 4. Setup outer call with both results
STA $52             ; Second arg = divide result
LDA $60             ; Reload multiply result
STA $50             ; First arg = multiply result
JSR _add
```

---

## Critical Gap 4: Word Parameter ABI Alignment

**Location**: Phase 4 (Calling Convention)

### Problem

The ABI defines `$50-$5F` for parameters, but doesn't specify behavior for mixed byte/word parameters.

### What's Ambiguous

```js
function foo(a: byte, b: word, c: byte): void
```

**Option A (packed):**
- `a` at $50 (1 byte)
- `b` at $51-$52 (2 bytes)
- `c` at $53 (1 byte)

**Option B (aligned):**
- `a` at $50 (1 byte, $51 unused)
- `b` at $52-$53 (2 bytes, word-aligned)
- `c` at $54 (1 byte)

### Impact

- Caller and callee may disagree on parameter locations
- Passing wrong values to functions
- Hard-to-debug incorrect behavior

### Solution

**Add to Phase 4:**

| Task | Description | File |
|------|-------------|------|
| 4.1.5 | Document ABI: packed layout (Option A) | `base-generator.ts` |
| 4.1.6 | Implement packed parameter allocation | `code-generator.ts` |
| 4.2.5 | Test: `func(byte, word, byte)` parameter passing | tests |
| 4.2.6 | Test: `func(word, byte, word)` parameter passing | tests |
| 4.2.7 | VICE test: Verify parameter values received correctly | tests (VICE) |

### Chosen ABI (Document This)

**Packed layout (no padding):**

```
function foo(a: byte, b: word, c: byte):
  a (byte): $50
  b (word): $51-$52 (low at $51, high at $52)
  c (byte): $53

function bar(x: word, y: byte, z: word):
  x (word): $50-$51
  y (byte): $52
  z (word): $53-$54
```

---

## Critical Gap 5: Const Enforcement Verification

**Location**: Semantic Analyzer (verify) or Phase PRE

### Problem

The language spec shows `@data const` for read-only data, but it's unclear if const enforcement is implemented.

### What Must Be Enforced

```js
@data const lookup: byte[256] = [...];

function bad(): void {
  lookup[0] = 42;  // MUST be a compile error!
}
```

### Impact

- Programs could corrupt lookup tables
- Programs could write to ROM addresses
- Subtle data corruption bugs

### Solution

**Add to Phase PRE or verify in Semantic Analyzer:**

| Task | Description | File |
|------|-------------|------|
| PRE.6.1 | Verify semantic analyzer rejects const writes | tests |
| PRE.6.2 | Test: Write to `const` variable → compile error | tests |
| PRE.6.3 | Test: Write to `@data const` array → compile error | tests |
| PRE.6.4 | Test: Compound assignment to const → compile error | tests |

If not implemented in semantic analyzer:

| Task | Description | File |
|------|-------------|------|
| SEM.1.1 | Add const tracking to symbol table | `semantic/symbol-table.ts` |
| SEM.1.2 | Check const on assignment target | `semantic/analyzer.ts` |
| SEM.1.3 | Emit error for const modification | `semantic/analyzer.ts` |

---

## Critical Gap 6: Global Variable Initialization Order

**Location**: Phase 8 (Module System)

### Problem

Multiple modules may have global variable initializers with dependencies. The initialization order isn't specified.

### What's Problematic

```js
// module A
let baseAddr: word = $0400;

// module B
import { baseAddr } from A;
let screenEnd: word = baseAddr + 1000;  // Depends on A's baseAddr!
```

### Impact

- Variables may be read before they're initialized
- Incorrect initial values
- Hard-to-debug startup issues

### Solution

**Add to Phase 8:**

| Task | Description | File |
|------|-------------|------|
| 8.3.1 | Document global initialization order (main module first, then imports in order) | docs |
| 8.3.2 | Verify codegen processes modules in dependency order | `code-generator.ts` |
| 8.3.3 | Test: Cross-module dependency initialization | tests |
| 8.3.4 | Test: Circular import handling (should error) | tests |

### Documented Initialization Order

1. **Constant expressions**: Evaluated at compile time (no runtime code)
2. **Simple literals**: Embedded in data section
3. **Runtime expressions**: Generated as initialization code, called before `main()`
4. **Order**: Main module first, then imported modules in import order

---

## Critical Gap 7: Error Recovery in Codegen

**Location**: General (all codegen phases)

### Problem

If codegen encounters an unexpected condition, there's no documented error handling strategy.

### What Can Go Wrong

- Unknown IL opcode (should never happen, but...)
- Value not tracked (the whole point of Phase 1, but edge cases...)
- Stack overflow in recursion
- Internal assertion failures

### Impact

- Partial/corrupted output
- Hard to debug
- User confusion

### Solution

**Add to all phases:**

| Task | Description | File |
|------|-------------|------|
| GEN.1.1 | Add try/catch around main codegen loop | `code-generator.ts` |
| GEN.1.2 | Emit diagnostic comment on error | `code-generator.ts` |
| GEN.1.3 | Collect all errors, don't stop on first | `code-generator.ts` |
| GEN.1.4 | Include source location in error messages | `code-generator.ts` |
| GEN.1.5 | Test: Graceful handling of edge cases | tests |

### Error Handling Pattern

```typescript
protected generateInstruction(instr: ILInstruction): void {
  try {
    // ... existing switch statement ...
  } catch (error) {
    this.emitComment(`ERROR: Failed to generate ${instr.opcode}: ${error.message}`);
    this.diagnostics.push({
      severity: DiagnosticSeverity.Error,
      message: `Code generation failed for ${instr.opcode}`,
      location: instr.location,
      code: 'CODEGEN_ERROR'
    });
    // Continue with next instruction (don't crash)
  }
}
```

---

## Critical Gap 8: Deep Call Chain Stack Overflow

**Location**: Phase 4 (Calling Convention)

### Problem

Amendment 15 covers recursion warnings, but deep non-recursive call chains can also overflow the 256-byte 6502 stack.

### What's Dangerous

```js
function a(): void { b(); }
function b(): void { c(); }
function c(): void { d(); }
// ... 50+ levels of calls ...
```

Each `JSR` uses 2 bytes of stack. With 256 bytes, maximum call depth is ~128 levels (less with local variables using stack).

### Impact

- Deep call chains crash with stack overflow
- No warning to programmer
- Hard to diagnose

### Solution

**Add to Phase 4:**

| Task | Description | File |
|------|-------------|------|
| 4.6.1 | Build call graph during semantic analysis | `semantic/call-graph.ts` |
| 4.6.2 | Calculate maximum call depth | `semantic/call-graph.ts` |
| 4.6.3 | Warn if call depth > 50 | `semantic/analyzer.ts` |
| 4.6.4 | Error if call depth > 100 (configurable) | `semantic/analyzer.ts` |
| 4.6.5 | Test: Deep call chain warning | tests |

### Warning Message

```
Warning: Maximum call depth is 67 levels (functions: main → gameLoop → 
updatePlayer → checkCollision → ... → deepHelper). The 6502 stack is 
limited to 256 bytes (~128 JSR calls). Consider refactoring if stack 
overflow occurs.
```

---

## Critical Gap 9: Type Alias Resolution in Codegen

**Location**: Semantic Analyzer → Codegen Interface

### Problem

The Blend65 language specification defines **user-defined type aliases**:

```js
type SpriteId = byte;
type Address = word;
type ScreenBuffer = byte[1000];
```

Codegen must correctly resolve these aliases to their underlying types for:
- Size calculations (`sizeof(SpriteId)` = 1)
- Parameter allocation
- Array stride computation
- Return value handling

### What Must Work

```js
// Type alias declarations
type SpriteId = byte;
type Position = word;
type Buffer = byte[256];

// Variables with alias types
let sprite: SpriteId = 5;           // Must allocate 1 byte
let pos: Position = $0400;          // Must allocate 2 bytes
let data: Buffer;                   // Must allocate 256 bytes

// Functions with alias parameters
function setSprite(id: SpriteId): void {
  // id must be at $50 (1 byte)
}

function getPosition(): Position {
  return $1000;  // Must return in A/X (word)
}

// Arrays of aliased types
let sprites: SpriteId[10];          // Must allocate 10 bytes
let positions: Position[5];         // Must allocate 10 bytes (5 × 2)
```

### Impact

- Incorrect size calculations → memory corruption
- Wrong parameter locations → function calls fail
- Wrong array strides → array access reads wrong data
- Return value size wrong → data truncation

### Solution

**Verify in Semantic Analyzer (likely already done):**

| Task | Description | File |
|------|-------------|------|
| 8.1.1 | Verify semantic analyzer resolves type aliases to underlying types | `semantic/analyzer.ts` |
| 8.1.2 | Verify IL receives resolved types, not alias names | `il/generator/` |
| 8.1.3 | Verify codegen never sees alias names directly | `codegen/` |

**Tests to add:**

| Task | Description | File |
|------|-------------|------|
| 8.2.1 | Test: `type X = byte; let v: X = 5;` compiles correctly | tests |
| 8.2.2 | Test: `type Y = word; let w: Y = $1000;` compiles correctly | tests |
| 8.2.3 | Test: `type A = byte[10]; let arr: A;` allocates 10 bytes | tests |
| 8.2.4 | Test: `function foo(x: SpriteId): SpriteId` works | tests |
| 8.2.5 | Test: `let arr: SpriteId[5]` allocates 5 bytes | tests |
| 8.2.6 | VICE test: Verify type alias values correct at runtime | tests (VICE) |

### Verification Approach

Most likely, type alias resolution is already handled in the semantic analyzer (type aliases are resolved during type checking). The gap here is:

1. **Verify** this actually works
2. **Test** it doesn't break in codegen
3. **Document** that aliases are transparent

---

## Critical Gap 10: Semantic Analyzer Completeness Verification

**Location**: Phase PRE

### Problem

The entire codegen-fixes plan assumes the semantic analyzer produces correct IL. If there are semantic analyzer gaps, codegen will produce wrong code even if codegen is bug-free.

### What Must Be Verified

- All type checking works
- All symbol resolution works
- All IL opcodes are generated correctly
- All language constructs are handled

### Impact

- Garbage-in, garbage-out
- Hard to diagnose whether bug is in semantic or codegen
- False confidence in codegen fixes

### Solution

**Add to Phase PRE:**

| Task | Description | File |
|------|-------------|------|
| PRE.0.1 | Run ALL semantic analyzer tests | tests |
| PRE.0.2 | Verify 100% semantic test pass rate | tests |
| PRE.0.3 | Check IL output for all language constructs | tests |
| PRE.0.4 | Document any semantic gaps found | docs |
| PRE.0.5 | Fix semantic gaps BEFORE starting codegen fixes | semantic/ |

### Semantic Completeness Checklist

- [ ] Variable declarations (all storage classes)
- [ ] Function declarations (all parameter combinations)
- [ ] Function calls (all argument combinations)
- [ ] All binary operators
- [ ] All unary operators
- [ ] All control flow constructs
- [ ] All intrinsics
- [ ] @map all 4 forms
- [ ] Type checking enforcement
- [ ] Const enforcement
- [ ] Export/import resolution

---

## Summary: All Critical Gaps

| Gap # | Description | Phase to Update | Est. Hours |
|-------|-------------|-----------------|------------|
| 1 | Callback register preservation | 7A | 2-3 |
| 2 | Large array indexing (>256) | 2F | 4-6 |
| 3 | Nested function calls in expressions | 1 | 3-4 |
| 4 | Word parameter ABI alignment | 4 | 2-3 |
| 5 | Const enforcement verification | PRE/SEM | 2-3 |
| 6 | Global initialization order | 8 | 2-3 |
| 7 | Error recovery in codegen | General | 2-3 |
| 8 | Deep call chain stack overflow | 4 | 3-4 |
| 9 | Type alias resolution in codegen | PRE/SEM | 2-3 |
| 10 | Semantic analyzer completeness | PRE | 4-6 |

**Total Additional Effort: 28-40 hours (~10-14 sessions)**

---

## Updated Task Checklist

### Phase PRE Additions (Semantic Verification)

- [ ] PRE.0.1 Run ALL semantic analyzer tests
- [ ] PRE.0.2 Verify 100% semantic test pass rate
- [ ] PRE.0.3 Check IL output for all language constructs
- [ ] PRE.0.4 Document any semantic gaps found
- [ ] PRE.0.5 Fix semantic gaps BEFORE starting codegen fixes
- [ ] PRE.6.1 Verify semantic analyzer rejects const writes
- [ ] PRE.6.2 Test: Write to `const` variable → compile error
- [ ] PRE.6.3 Test: Write to `@data const` array → compile error
- [ ] PRE.6.4 Test: Compound assignment to const → compile error

### Phase 1 Additions (Nested Function Calls)

- [ ] 1.5.1 Track function call results in expression context
- [ ] 1.5.2 Spill return values before subsequent calls
- [ ] 1.5.3 Reload spilled values for outer call
- [ ] 1.5.4 Test: `add(mul(a,b), div(c,d))` produces correct result
- [ ] 1.5.5 Test: 3-level nested calls
- [ ] 1.5.6 VICE test: Verify mathematical correctness

### Phase 2F Additions (Large Arrays)

- [ ] 2F.3.1 Detect array accesses requiring >8-bit index
- [ ] 2F.3.2 Implement 16-bit index calculation to ZP pointer
- [ ] 2F.3.3 Use indirect indexed addressing for large arrays
- [ ] 2F.3.4 Test: Access element 500 of byte[1000]
- [ ] 2F.3.5 Test: Access element 150 of word[200]
- [ ] 2F.3.6 VICE test: Verify large array read/write

### Phase 4 Additions (ABI + Call Depth)

- [ ] 4.1.5 Document ABI: packed layout
- [ ] 4.1.6 Implement packed parameter allocation
- [ ] 4.2.5 Test: `func(byte, word, byte)` parameter passing
- [ ] 4.2.6 Test: `func(word, byte, word)` parameter passing
- [ ] 4.2.7 VICE test: Verify parameter values received correctly
- [ ] 4.6.1 Build call graph during semantic analysis
- [ ] 4.6.2 Calculate maximum call depth
- [ ] 4.6.3 Warn if call depth > 50
- [ ] 4.6.4 Error if call depth > 100
- [ ] 4.6.5 Test: Deep call chain warning

### Phase 7A Additions (Callback Preservation)

- [ ] 7A.1.3 Add PHA/TXA/PHA/TYA/PHA at callback entry
- [ ] 7A.1.4 Add PLA/TAY/PLA/TAX/PLA before RTI
- [ ] 7A.1.5 Test: Verify registers preserved in IRQ
- [ ] 7A.1.6 VICE test: Main program state unchanged after IRQ

### Phase 8 Additions (Initialization Order)

- [ ] 8.3.1 Document global initialization order
- [ ] 8.3.2 Verify codegen processes modules in dependency order
- [ ] 8.3.3 Test: Cross-module dependency initialization
- [ ] 8.3.4 Test: Circular import handling

### General Additions (Error Recovery)

- [ ] GEN.1.1 Add try/catch around main codegen loop
- [ ] GEN.1.2 Emit diagnostic comment on error
- [ ] GEN.1.3 Collect all errors, don't stop on first
- [ ] GEN.1.4 Include source location in error messages
- [ ] GEN.1.5 Test: Graceful handling of edge cases

### Phase PRE/SEM Additions (Type Alias Resolution)

- [ ] 9.1.1 Verify semantic analyzer resolves type aliases to underlying types
- [ ] 9.1.2 Verify IL receives resolved types, not alias names
- [ ] 9.1.3 Verify codegen never sees alias names directly
- [ ] 9.2.1 Test: `type X = byte; let v: X = 5;` compiles correctly
- [ ] 9.2.2 Test: `type Y = word; let w: Y = $1000;` compiles correctly
- [ ] 9.2.3 Test: `type A = byte[10]; let arr: A;` allocates 10 bytes
- [ ] 9.2.4 Test: `function foo(x: SpriteId): SpriteId` works
- [ ] 9.2.5 Test: `let arr: SpriteId[5]` allocates 5 bytes
- [ ] 9.2.6 VICE test: Verify type alias values correct at runtime

---

## Success Criteria

**After implementing ALL gaps in this document, plus the original plan:**

1. ✅ Callback functions preserve all registers (A, X, Y)
2. ✅ Arrays >256 elements accessible correctly
3. ✅ Nested function calls in expressions work
4. ✅ Mixed byte/word parameters passed correctly
5. ✅ Const variables cannot be modified
6. ✅ Global initialization order is deterministic
7. ✅ Codegen errors are handled gracefully
8. ✅ Deep call chains produce warnings
9. ✅ Type aliases resolve correctly in codegen
10. ✅ Semantic analyzer is verified complete

**Only then can we claim "100% working compiler".**

---

## Related Documents

- [Index](00-index.md) - Main plan index
- [Execution Plan](99-execution-plan.md) - Session schedule
- [Calling Convention](07-calling-convention.md) - ABI details
- [Value Tracking](04-value-tracking.md) - Spill/reload system
- [Runtime Safety](15-runtime-safety.md) - Related safety concerns