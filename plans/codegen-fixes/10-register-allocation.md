# Register Allocation: Phase 7

> **Document**: 10-register-allocation.md
> **Parent**: [Index](00-index.md)
> **Phase**: 7 (After Word Operations)
> **REQ**: REQ-08 (Register Allocation)

## Overview

The 6502 has only 3 registers (A, X, Y). Currently we use A for everything and spill constantly. Better register allocation reduces code size and improves performance.

---

## Register Usage Strategy

| Register | Primary Use | Secondary Use |
|----------|-------------|---------------|
| A | Operations, return values | General purpose |
| X | Loop counters, array indexing | Word high byte |
| Y | Array indexing | Indirect addressing offset |

---

## Register State Tracking

```typescript
interface RegisterState {
  /** What IL value is in A, or undefined if unknown/clobbered */
  aContains: string | undefined;
  /** What IL value is in X */
  xContains: string | undefined;
  /** What IL value is in Y */
  yContains: string | undefined;
}

protected registerState: RegisterState = {
  aContains: undefined,
  xContains: undefined,
  yContains: undefined
};
```

---

## Smart Register Selection

```typescript
/**
 * Selects the best register for loading a value.
 * 
 * Priorities:
 * 1. If value already in a register, use that register
 * 2. If A is free, use A (most flexible)
 * 3. If X is free, use X
 * 4. If Y is free, use Y
 * 5. Spill least recently used register
 */
protected selectRegister(valueId: string): 'A' | 'X' | 'Y' {
  // Check if already in a register
  if (this.registerState.aContains === valueId) return 'A';
  if (this.registerState.xContains === valueId) return 'X';
  if (this.registerState.yContains === valueId) return 'Y';
  
  // Find free register
  if (this.registerState.aContains === undefined) return 'A';
  if (this.registerState.xContains === undefined) return 'X';
  if (this.registerState.yContains === undefined) return 'Y';
  
  // All registers used - prefer A (most operations work with A)
  return 'A';
}

/**
 * Marks a register as containing a value.
 */
protected markRegister(reg: 'A' | 'X' | 'Y', valueId: string): void {
  switch (reg) {
    case 'A': this.registerState.aContains = valueId; break;
    case 'X': this.registerState.xContains = valueId; break;
    case 'Y': this.registerState.yContains = valueId; break;
  }
}

/**
 * Marks a register as clobbered (contents unknown).
 */
protected clobberRegister(reg: 'A' | 'X' | 'Y'): void {
  switch (reg) {
    case 'A': this.registerState.aContains = undefined; break;
    case 'X': this.registerState.xContains = undefined; break;
    case 'Y': this.registerState.yContains = undefined; break;
  }
}

/**
 * Clobbers all registers (after JSR, for example).
 */
protected clobberAllRegisters(): void {
  this.registerState.aContains = undefined;
  this.registerState.xContains = undefined;
  this.registerState.yContains = undefined;
}
```

---

## Loop Counter Optimization

Use X or Y for loop counters to avoid spilling:

```asm
; for (let i = 0; i < 10; i++)
        LDX #$00       ; i in X register
.loop:
        ; ... loop body ...
        INX            ; i++
        CPX #$0A       ; Compare with 10
        BNE .loop
```

```typescript
protected generateForLoop(init: ILInstruction, cond: ILInstruction, update: ILInstruction, body: BasicBlock[]): void {
  // Analyze if loop counter fits in X or Y
  const counterVar = this.extractLoopCounter(init, update);
  
  if (counterVar && this.canUseXForCounter(counterVar)) {
    this.useXForLoopCounter(counterVar);
    // Generate loop using X register
  } else {
    // Fall back to ZP-based counter
  }
}
```

---

## Task Breakdown

### Session 7.1: Register State Tracking (2-3 hours)

| Task | Description |
|------|-------------|
| 7.1.1 | Add `RegisterState` interface |
| 7.1.2 | Add `registerState` field |
| 7.1.3 | Implement `markRegister()` |
| 7.1.4 | Implement `clobberRegister()` |

### Session 7.2: Smart Selection (3-4 hours)

| Task | Description |
|------|-------------|
| 7.2.1 | Implement `selectRegister()` |
| 7.2.2 | Update `loadValueToA()` to use selection |
| 7.2.3 | Add `loadValueToX()` smart selection |
| 7.2.4 | Add `loadValueToY()` smart selection |

### Session 7.3: Loop Optimization (2-3 hours)

| Task | Description |
|------|-------------|
| 7.3.1 | Detect loop counters |
| 7.3.2 | Prefer X/Y for counters |
| 7.3.3 | Test loop optimization |

### Session 7.4: Register Tests (2-3 hours)

| Task | Description |
|------|-------------|
| 7.4.1 | Test value reuse in registers |
| 7.4.2 | Test clobber tracking |
| 7.4.3 | Test loop counter optimization |

---

## Success Criteria

1. ✅ Register contents tracked
2. ✅ Values reused from registers when possible
3. ✅ Loop counters use X/Y
4. ✅ Fewer spills generated
5. ✅ 20+ register allocation tests pass