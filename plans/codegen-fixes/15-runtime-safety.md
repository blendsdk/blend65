# Runtime Safety: Gap Amendment

> **Document**: 15-runtime-safety.md
> **Parent**: [Index](00-index.md)
> **Type**: Gap Amendment
> **Addresses**: Gap #5 (Runtime Library), Gap #6 (Spill Overflow), Gap #7 (Recursion)

## Overview

This amendment addresses **runtime safety concerns** that could cause silent failures:

1. **Spill Area Expansion** - Increase from 32 to 64 bytes with overflow detection
2. **Recursion Handling** - Allow with warning, detect safe patterns
3. **Runtime Library Verification** - Ensure mul/div/mod routines exist

---

## Amendment 1: Spill Area Expansion

### Problem

Current plan allocates 32 bytes ($60-$7F) for spilling intermediate values.

**Risk**: Complex expressions can exceed this:
```js
let result = (a + b) * (c - d) + (e / f) - (g % h);
// Needs 6+ spill slots, nested calls need more
```

32 bytes may overflow silently, corrupting other ZP variables.

### Solution

1. **Expand spill area** to 64 bytes ($60-$9F)
2. **Track spill usage** per function
3. **Emit error** if exceeded
4. **Emit warning** at 75%+ usage

### Updated Memory Map

```
Zero Page Memory Map:
$00-$3F  System/BASIC reserved
$40-$4F  PHI merge variables (16 bytes)
$50-$5F  Function parameters (16 bytes)
$60-$9F  ← SPILL AREA (64 bytes) - EXPANDED
$A0-$FF  Local variables / available (96 bytes)
```

### Implementation

```typescript
// In base-generator.ts

/**
 * Spill area configuration.
 */
protected static readonly SPILL_AREA_START = 0x60;
protected static readonly SPILL_AREA_END = 0x9F;  // Expanded from $7F
protected static readonly SPILL_AREA_SIZE = 64;   // Expanded from 32
protected static readonly SPILL_WARNING_THRESHOLD = 0.75; // 75%

/**
 * Current spill slot allocation.
 */
protected spillSlotUsage: number = 0;
protected maxSpillSlotUsage: number = 0;

/**
 * Allocate a spill slot.
 * @param size - Number of bytes (1 for byte, 2 for word)
 * @returns ZP address for the spill slot
 * @throws Error if spill area exceeded
 */
protected allocateSpillSlot(size: 1 | 2 = 1): number {
  const newUsage = this.spillSlotUsage + size;
  
  // Check for overflow
  if (newUsage > BaseGenerator.SPILL_AREA_SIZE) {
    throw new CompilerError(
      `Spill area overflow: Function '${this.currentFunctionName}' requires ` +
      `${newUsage} bytes of spill space (max ${BaseGenerator.SPILL_AREA_SIZE}). ` +
      `Consider simplifying expressions or breaking into smaller functions.`,
      this.currentLocation
    );
  }
  
  const address = BaseGenerator.SPILL_AREA_START + this.spillSlotUsage;
  this.spillSlotUsage = newUsage;
  
  // Track maximum for warnings
  if (this.spillSlotUsage > this.maxSpillSlotUsage) {
    this.maxSpillSlotUsage = this.spillSlotUsage;
  }
  
  return address;
}

/**
 * Free a spill slot (simple stack-based allocation).
 */
protected freeSpillSlot(size: 1 | 2 = 1): void {
  this.spillSlotUsage = Math.max(0, this.spillSlotUsage - size);
}

/**
 * Check and emit warning if spill usage is high.
 * Called at end of function generation.
 */
protected checkSpillUsageWarning(): void {
  const usagePercent = this.maxSpillSlotUsage / BaseGenerator.SPILL_AREA_SIZE;
  
  if (usagePercent >= BaseGenerator.SPILL_WARNING_THRESHOLD) {
    this.addWarning(
      `Function '${this.currentFunctionName}' uses ${this.maxSpillSlotUsage}/` +
      `${BaseGenerator.SPILL_AREA_SIZE} spill bytes (${Math.round(usagePercent * 100)}%). ` +
      `Consider simplifying to avoid potential overflow.`,
      this.currentLocation,
      'W_HIGH_SPILL_USAGE'
    );
  }
}

/**
 * Reset spill tracking for new function.
 */
protected resetSpillTracking(): void {
  this.spillSlotUsage = 0;
  this.maxSpillSlotUsage = 0;
}
```

### Task Breakdown

**Add to Phase 1 (Value Tracking):**

| Task | Description | File |
|------|-------------|------|
| 1.1.5 | Update SPILL_AREA_END to $9F | `base-generator.ts` |
| 1.1.6 | Add spillSlotUsage tracking | `base-generator.ts` |
| 1.1.7 | Implement overflow detection | `base-generator.ts` |
| 1.1.8 | Implement 75% usage warning | `base-generator.ts` |
| 1.1.9 | Test spill overflow error | tests |
| 1.1.10 | Test spill warning at 75% | tests |

---

## Amendment 2: Recursion Handling

### Problem

The 6502 has a 256-byte hardware stack. Recursive functions can easily overflow:

```js
function factorial(n: byte): word {
  if (n <= 1) { return 1; }
  return n * factorial(n - 1);  // Recursive!
}
// factorial(50) would overflow the stack
```

### Solution

1. **Allow recursion** (don't block it)
2. **Emit warning** for recursive functions
3. **Detect safe patterns** and skip warning:
   - Tail recursion (last statement is recursive call)
   - Known bounded depth (loop unrolling candidate)

### Implementation

```typescript
// In code-generator.ts or semantic analyzer

/**
 * Detect if a function is recursive.
 */
protected isRecursiveFunction(funcName: string, funcBody: ILFunction): boolean {
  // Check if function calls itself
  for (const block of funcBody.blocks) {
    for (const instr of block.instructions) {
      if (instr.opcode === ILOpcode.CALL || instr.opcode === ILOpcode.CALL_VOID) {
        const callInstr = instr as ILCallInstruction;
        if (callInstr.functionName === funcName) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Detect if recursion is "safe" (tail recursion).
 */
protected isTailRecursive(funcName: string, funcBody: ILFunction): boolean {
  // Simplified: check if last instruction before RET is the recursive call
  // Full tail-call optimization would require more analysis
  for (const block of funcBody.blocks) {
    const instrs = block.instructions;
    for (let i = 0; i < instrs.length; i++) {
      const instr = instrs[i];
      if (instr.opcode === ILOpcode.CALL || instr.opcode === ILOpcode.CALL_VOID) {
        const callInstr = instr as ILCallInstruction;
        if (callInstr.functionName === funcName) {
          // Check if next instruction is RET
          const next = instrs[i + 1];
          if (next?.opcode === ILOpcode.RET) {
            return true; // Tail recursive
          }
        }
      }
    }
  }
  return false;
}

/**
 * Generate recursion warning if needed.
 */
protected checkRecursionWarning(funcName: string, funcBody: ILFunction): void {
  if (!this.isRecursiveFunction(funcName, funcBody)) {
    return; // Not recursive, no warning
  }
  
  if (this.isTailRecursive(funcName, funcBody)) {
    // Tail recursion is safer, but still warn
    this.addWarning(
      `Function '${funcName}' uses tail recursion. ` +
      `Stack usage is minimized but deep recursion can still overflow the 256-byte 6502 stack.`,
      funcBody.location,
      'W_TAIL_RECURSION'
    );
  } else {
    // General recursion is dangerous
    this.addWarning(
      `Function '${funcName}' is recursive. ` +
      `The 6502 has only a 256-byte stack. Deep recursion WILL cause stack overflow. ` +
      `Consider using iteration instead.`,
      funcBody.location,
      'W_RECURSION_UNSAFE'
    );
  }
}
```

### Generated Comment

```asm
; function factorial(n: byte): word
; WARNING: This function is recursive. Stack overflow risk!
_factorial:
        ; ... function body ...
        JSR _factorial  ; Recursive call
        ; ...
        RTS
```

### Task Breakdown

**Add to Phase 4 (Calling Convention):**

| Task | Description | File |
|------|-------------|------|
| 4.5.1 | Add isRecursiveFunction() detection | `code-generator.ts` |
| 4.5.2 | Add isTailRecursive() detection | `code-generator.ts` |
| 4.5.3 | Emit recursion warning | `code-generator.ts` |
| 4.5.4 | Add ASM comment for recursive functions | `code-generator.ts` |
| 4.5.5 | Test recursion detection | tests |
| 4.5.6 | Test tail recursion detection | tests |

---

## Amendment 3: Runtime Library Verification

### Problem

The 6502 has no MUL/DIV instructions. Operations like `a * b` require **runtime library routines**.

Current plan mentions these exist but doesn't verify they work correctly.

### Runtime Library Routines Needed

| Operation | Routine | Input | Output |
|-----------|---------|-------|--------|
| Multiply | `_multiply` | $FB=multiplicand, X=multiplier | A=result (byte) |
| Divide | `_divide` | $FB=dividend, X=divisor | A=quotient |
| Modulo | `_modulo` | $FB=dividend, X=divisor | A=remainder |
| Multiply Word | `_multiply_word` | $FB-$FC=a, $FD-$FE=b | $FB-$FC=result |
| Divide Word | `_divide_word` | $FB-$FC=dividend, $FD-$FE=divisor | $FB-$FC=quotient |

### Solution

Add Phase 1.5 to verify runtime library exists and works.

### Task Breakdown

**New Session 1.5: Runtime Library Verification (2-3 hours)**

| Task | Description | File |
|------|-------------|------|
| 1.5.1 | Verify _multiply routine exists | tests |
| 1.5.2 | Test byte multiplication correctness | tests (VICE) |
| 1.5.3 | Verify _divide routine exists | tests |
| 1.5.4 | Test byte division correctness | tests (VICE) |
| 1.5.5 | Verify _modulo routine exists | tests |
| 1.5.6 | Test byte modulo correctness | tests (VICE) |
| 1.5.7 | Test edge cases (0, 255, overflow) | tests (VICE) |

### Test Cases

```typescript
describe('Runtime Library', () => {
  it('should multiply bytes correctly', async () => {
    const result = await compileAndRunInVice(`
      function main(): void {
        let a: byte = 7;
        let b: byte = 6;
        let result: byte = a * b;
        poke($C000, result);
        brk();
      }
    `, { readMemory: [{ address: 0xC000, length: 1 }] });
    
    expect(result.memory![0]).toBe(42);
  });
  
  it('should divide bytes correctly', async () => {
    const result = await compileAndRunInVice(`
      function main(): void {
        let a: byte = 100;
        let b: byte = 7;
        let result: byte = a / b;
        poke($C000, result);
        brk();
      }
    `, { readMemory: [{ address: 0xC000, length: 1 }] });
    
    expect(result.memory![0]).toBe(14);  // 100 / 7 = 14 (integer)
  });
  
  it('should modulo bytes correctly', async () => {
    const result = await compileAndRunInVice(`
      function main(): void {
        let a: byte = 100;
        let b: byte = 7;
        let result: byte = a % b;
        poke($C000, result);
        brk();
      }
    `, { readMemory: [{ address: 0xC000, length: 1 }] });
    
    expect(result.memory![0]).toBe(2);  // 100 % 7 = 2
  });
  
  it('should handle multiply overflow', async () => {
    const result = await compileAndRunInVice(`
      function main(): void {
        let a: byte = 20;
        let b: byte = 20;
        let result: byte = a * b;  // 400, but byte wraps to 144
        poke($C000, result);
        brk();
      }
    `, { readMemory: [{ address: 0xC000, length: 1 }] });
    
    expect(result.memory![0]).toBe(144);  // 400 & 0xFF = 144
  });
  
  it('should handle divide by zero', async () => {
    // Behavior: should return 0 or 255, not crash
    const result = await compileAndRunInVice(`
      function main(): void {
        let a: byte = 100;
        let b: byte = 0;
        let result: byte = a / b;  // Divide by zero!
        poke($C000, result);
        brk();
      }
    `, { readMemory: [{ address: 0xC000, length: 1 }] });
    
    // Document the behavior - either 0 or 255 is acceptable
    expect([0, 255]).toContain(result.memory![0]);
  });
});
```

---

## Summary: New Tasks Added

### Phase 1 Additions (Spill Area)

| Task | Description |
|------|-------------|
| 1.1.5 | Update SPILL_AREA_END to $9F |
| 1.1.6 | Add spillSlotUsage tracking |
| 1.1.7 | Implement overflow detection |
| 1.1.8 | Implement 75% usage warning |
| 1.1.9 | Test spill overflow error |
| 1.1.10 | Test spill warning at 75% |

### New Phase 1.5 (Runtime Library)

| Task | Description |
|------|-------------|
| 1.5.1 | Verify _multiply routine exists |
| 1.5.2 | Test byte multiplication |
| 1.5.3 | Verify _divide routine exists |
| 1.5.4 | Test byte division |
| 1.5.5 | Verify _modulo routine exists |
| 1.5.6 | Test byte modulo |
| 1.5.7 | Test edge cases |

### Phase 4 Additions (Recursion)

| Task | Description |
|------|-------------|
| 4.5.1 | Add recursion detection |
| 4.5.2 | Add tail recursion detection |
| 4.5.3 | Emit recursion warning |
| 4.5.4 | Add ASM comment for recursive |
| 4.5.5 | Test recursion detection |
| 4.5.6 | Test tail recursion detection |

---

## Success Criteria

### This amendment is complete when:

1. ✅ Spill area expanded to 64 bytes
2. ✅ Spill overflow emits error
3. ✅ 75%+ spill usage emits warning
4. ✅ Recursive functions emit warning
5. ✅ Tail recursion detected and noted
6. ✅ Multiply routine works correctly
7. ✅ Divide routine works correctly
8. ✅ Modulo routine works correctly
9. ✅ Edge cases documented/handled

---

## Related Documents

- [Value Tracking](04-value-tracking.md) - Phase 1 spill implementation
- [Calling Convention](07-calling-convention.md) - Phase 4 recursion handling
- [VICE Test Rig](13-vice-test-rig.md) - Runtime verification tests