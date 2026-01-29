# Missing Features: Gap Amendment

> **Document**: 14-missing-features.md
> **Parent**: [Index](00-index.md)
> **Type**: Gap Amendment
> **Addresses**: Gap #2 (Missing Intrinsics), Gap #3 (Enum Codegen), Gap #4 (Do-While)

## Overview

This amendment addresses **language features defined in the specification** that are not explicitly covered in the original plan:

1. **Optimization Intrinsics** - `barrier()`, `volatile_read()`, `volatile_write()`
2. **Enum Code Generation** - Verify enums compile correctly
3. **Do-While Loop** - Verify codegen for do-while construct

---

## Amendment 1: Optimization Intrinsics

### Problem

The language specification (13-6502-features.md) defines these intrinsics:

| Intrinsic | Parameters | Description |
|-----------|------------|-------------|
| `barrier()` | none | Optimization barrier - prevents instruction reordering |
| `volatile_read` | `(address: word)` | Read that cannot be optimized away |
| `volatile_write` | `(address: word, value: byte)` | Write that cannot be optimized away |

These are **NOT in Phase 2A** (Intrinsics Code Generation).

### Solution

Add to Phase 2A as Session 2A.5.

### Implementation

```typescript
// In instruction-generator.ts

/**
 * BARRIER intrinsic - prevents optimizer from reordering across this point.
 * Generates: Comment marker only (no runtime cost)
 */
protected generateBarrier(): void {
  this.emitComment('=== OPTIMIZATION BARRIER ===');
  // No actual code generated - this is a compiler directive
  // The optimizer must not move instructions across this point
}

/**
 * VOLATILE_READ intrinsic - read that cannot be cached or eliminated.
 * Generates: LDA absolute (always, even if "redundant")
 */
protected generateVolatileRead(instr: ILIntrinsicInstruction): void {
  const addressId = instr.args[0]?.toString() ?? '';
  const resultId = instr.result?.toString() ?? '';
  
  this.emitComment(`${resultId} = volatile_read(${addressId})`);
  
  // Get address - must support both immediate and variable addresses
  const addrLoc = this.getValueLocation(addressId);
  
  if (addrLoc?.location === ValueLocation.IMMEDIATE) {
    // Direct address
    this.emitLdaAbsolute(addrLoc.value ?? 0, 'Volatile read (cannot optimize away)');
  } else {
    // Variable address - use indirect
    this.loadWordToZPPointer(addressId);
    this.emitInstruction('LDA', '($FB),Y', 'Volatile indirect read', 2);
  }
  
  this.trackValue(resultId, { location: ValueLocation.ACCUMULATOR });
}

/**
 * VOLATILE_WRITE intrinsic - write that cannot be eliminated.
 * Generates: STA absolute (always, even if "dead store")
 */
protected generateVolatileWrite(instr: ILIntrinsicInstruction): void {
  const addressId = instr.args[0]?.toString() ?? '';
  const valueId = instr.args[1]?.toString() ?? '';
  
  this.emitComment(`volatile_write(${addressId}, ${valueId})`);
  
  // Load value
  if (!this.loadValueToA(valueId)) {
    this.emitLdaImmediate(0, `STUB: Cannot load ${valueId}`);
  }
  
  // Get address
  const addrLoc = this.getValueLocation(addressId);
  
  if (addrLoc?.location === ValueLocation.IMMEDIATE) {
    // Direct address
    this.emitStaAbsolute(addrLoc.value ?? 0, 'Volatile write (cannot optimize away)');
  } else {
    // Variable address - use indirect
    // Need to save value first
    this.emitInstruction('PHA', undefined, 'Save value', 1);
    this.loadWordToZPPointer(addressId);
    this.emitInstruction('PLA', undefined, 'Restore value', 1);
    this.emitInstruction('STA', '($FB),Y', 'Volatile indirect write', 2);
  }
}
```

### Task Breakdown

**Add to Session 2A.4:**

| Task | Description | File |
|------|-------------|------|
| 2A.4.4 | Implement `barrier()` intrinsic | `instruction-generator.ts` |
| 2A.4.5 | Implement `volatile_read()` intrinsic | `instruction-generator.ts` |
| 2A.4.6 | Implement `volatile_write()` intrinsic | `instruction-generator.ts` |
| 2A.4.7 | Add tests for optimization intrinsics | tests |

---

## Amendment 2: Enum Code Generation

### Problem

The language specification shows enums:

```js
enum GameState {
  MENU,
  PLAYING,
  GAME_OVER
}

switch (state) {
  case GameState.MENU:
    showMenu();
  // ...
}
```

**No explicit phase verifies enum codegen works correctly.**

### Expected Behavior

Enums should compile as simple integer constants:

```js
// Source
enum Direction { UP, DOWN, LEFT, RIGHT }
let dir: Direction = Direction.LEFT;

// Should generate
; Direction.UP = 0, Direction.DOWN = 1, Direction.LEFT = 2, Direction.RIGHT = 3
LDA #$02        ; Direction.LEFT = 2
STA dir_location
```

### Solution

Add Phase 2G: Enum Verification (lightweight - mostly testing).

### Task Breakdown

**New Session 2G.1: Enum Code Generation (1-2 hours)**

| Task | Description | File |
|------|-------------|------|
| 2G.1.1 | Verify enum values compile to constants | tests |
| 2G.1.2 | Verify enum member access (`Enum.MEMBER`) | tests |
| 2G.1.3 | Verify switch on enum values | tests |
| 2G.1.4 | Verify enum comparison (`==`, `!=`) | tests |
| 2G.1.5 | Test enum with explicit values | tests |

### Test Cases

```typescript
describe('Enum Code Generation', () => {
  it('should compile enum member to constant', () => {
    const asm = compileToAsm(`
      enum Color { RED, GREEN, BLUE }
      function test(): byte {
        return Color.GREEN;  // Should be 1
      }
    `);
    expectAsmSequence(asm, {
      instructions: [
        { mnemonic: 'LDA', operand: '#$01' }  // GREEN = 1
      ]
    });
  });
  
  it('should handle switch on enum', () => {
    const asm = compileToAsm(`
      enum State { IDLE, RUNNING, STOPPED }
      function test(s: State): byte {
        switch (s) {
          case State.IDLE: return 0;
          case State.RUNNING: return 1;
          case State.STOPPED: return 2;
        }
        return 255;
      }
    `);
    expectNoStubs(asm);
  });
  
  it('should handle enum with explicit values', () => {
    const asm = compileToAsm(`
      enum Key { 
        UP = 87,
        DOWN = 83,
        LEFT = 65,
        RIGHT = 68
      }
      function test(): byte {
        return Key.LEFT;  // Should be 65
      }
    `);
    expectAsmSequence(asm, {
      instructions: [
        { mnemonic: 'LDA', operand: '#$41' }  // 65 = $41
      ]
    });
  });
});
```

---

## Amendment 3: Do-While Loop Verification

### Problem

The language specification defines do-while:

```js
do {
    processInput();
    x += 1;
} while (x < 10);
```

**No explicit task verifies do-while codegen.**

### Expected Code Generation

```asm
; do { body } while (condition);
.loop_start:
        ; Body code here
        ; ...
        
        ; Condition check (at end, not beginning!)
        LDA x
        CMP #$0A        ; Compare with 10
        BCC .loop_start ; If x < 10, continue
        
        ; Exit loop
```

**Key difference from while loop:**
- Body executes **at least once**
- Condition check is at the **end**

### Solution

Add to Phase 2D as additional verification tasks.

### Task Breakdown

**Add to Session 2D.2:**

| Task | Description | File |
|------|-------------|------|
| 2D.2.5 | Test do-while basic loop | tests |
| 2D.2.6 | Verify body executes at least once | tests |
| 2D.2.7 | Test do-while with break | tests |
| 2D.2.8 | Test do-while with continue | tests |
| 2D.2.9 | Test nested do-while | tests |

### Test Cases

```typescript
describe('Do-While Loop', () => {
  it('should execute body at least once', async () => {
    const result = await compileAndRunInVice(`
      function main(): void {
        let count: byte = 0;
        let x: byte = 100;  // Already >= 10!
        
        do {
          count += 1;  // Should execute once
          x += 1;
        } while (x < 10);  // Immediately false
        
        poke($C000, count);
        brk();
      }
    `, { readMemory: [{ address: 0xC000, length: 1 }] });
    
    expect(result.memory![0]).toBe(1);  // Body ran exactly once
  });
  
  it('should loop correctly', async () => {
    const result = await compileAndRunInVice(`
      function main(): void {
        let i: byte = 0;
        let sum: byte = 0;
        
        do {
          sum += i;
          i += 1;
        } while (i < 5);
        
        poke($C000, sum);  // 0+1+2+3+4 = 10
        brk();
      }
    `, { readMemory: [{ address: 0xC000, length: 1 }] });
    
    expect(result.memory![0]).toBe(10);
  });
  
  it('should handle break in do-while', () => {
    const asm = compileToAsm(`
      function test(): void {
        let i: byte = 0;
        do {
          if (i == 3) { break; }
          i += 1;
        } while (true);
      }
    `);
    expectNoStubs(asm);
    expectAsmContains(asm, 'JMP');  // Break should generate jump
  });
});
```

---

## Summary: New Tasks Added

### Phase 2A Additions (Intrinsics)

| Task | Description |
|------|-------------|
| 2A.4.4 | Implement `barrier()` |
| 2A.4.5 | Implement `volatile_read()` |
| 2A.4.6 | Implement `volatile_write()` |
| 2A.4.7 | Tests for optimization intrinsics |

### New Phase 2G (Enums)

| Task | Description |
|------|-------------|
| 2G.1.1 | Test enum → constant |
| 2G.1.2 | Test enum member access |
| 2G.1.3 | Test switch on enums |
| 2G.1.4 | Test enum comparison |
| 2G.1.5 | Test explicit enum values |

### Phase 2D Additions (Do-While)

| Task | Description |
|------|-------------|
| 2D.2.5 | Test do-while basic |
| 2D.2.6 | Test executes at least once |
| 2D.2.7 | Test do-while + break |
| 2D.2.8 | Test do-while + continue |
| 2D.2.9 | Test nested do-while |

---

## Success Criteria

### This amendment is complete when:

1. ✅ `barrier()` intrinsic implemented
2. ✅ `volatile_read()` intrinsic implemented
3. ✅ `volatile_write()` intrinsic implemented
4. ✅ Enum member access compiles to constants
5. ✅ Switch on enum values works
6. ✅ Do-while body executes at least once
7. ✅ Do-while with break/continue works
8. ✅ All tests pass

---

## Related Documents

- [Missing Opcodes](05-missing-opcodes.md) - Phase 2 base
- [Language Spec: 6502 Features](../../docs/language-specification/13-6502-features.md) - Intrinsics reference
- [Language Spec: Expressions](../../docs/language-specification/06-expressions-statements.md) - Do-while reference