# Value Tracking: Phase 1

> **Document**: 04-value-tracking.md
> **Parent**: [Index](00-index.md)
> **Phase**: 1 (Foundation - After Phase 0)
> **REQs**: REQ-01 (Value Tracking), REQ-09 (Complex Expressions)

## Overview

**Value tracking is the FOUNDATION for all other fixes.** Without proper value tracking, binary operations, PHI nodes, and function calls cannot work correctly.

**The Core Problem:**
The 6502 has only ONE accumulator (A). When we need to use two values in an operation (like `a + b`), loading the second value DESTROYS the first.

**The Solution:**
Implement spill/reload - save values to zero-page before they're overwritten, then reload them when needed.

---

## Current State Analysis

### What Exists

```typescript
// In base-generator.ts
protected valueLocations: Map<string, TrackedValue> = new Map();

// TrackedValue tracks WHERE a value is stored
interface TrackedValue {
  location: ValueLocation;  // ACCUMULATOR, ZERO_PAGE, etc.
  value?: number;           // For immediates
  address?: number;         // For ZP/absolute
}

// Methods exist but are incomplete
protected trackValue(ilValueId: string, location: TrackedValue): void;
protected getValueLocation(ilValueId: string): TrackedValue | undefined;
protected loadValueToA(ilValueId: string): boolean;  // Often returns false!
```

### What's Broken

1. **No Spill Infrastructure**
   - No ZP range reserved for spills
   - No `spillValueToZP()` method
   - No `reloadValueFromZP()` method

2. **Values Overwritten**
   - `generateBinaryOp()` doesn't load left operand first
   - Loading right operand destroys whatever was in A
   - No saving before overwrite

3. **SSA Values Untracked**
   - Values like `v5:i.2` are produced but not tracked
   - By the time PHI needs them, they're "unknown"

---

## Design: Spill Infrastructure

### ZP Memory Layout

```
$40-$4F    PHI merge variables (16 bytes) - EXISTING
$50-$5F    Function parameters (16 bytes) - NEW for Phase 4
$60-$7F    Spill area (32 bytes) - NEW
$80-$DF    Local variables (96 bytes) - EXPANDED
```

### Spill Slot Allocation

```typescript
// In base-generator.ts

/**
 * Spill slot allocation tracking.
 * Maps slot index (0-31) to the IL value ID stored there.
 */
protected spillSlots: Map<number, string> = new Map();

/**
 * Next available spill slot index.
 */
protected nextSpillSlot: number = 0;

/**
 * Maximum spill slots available (32 bytes).
 */
protected static readonly SPILL_SLOT_COUNT = 32;

/**
 * Base address for spill slots ($60).
 */
protected static readonly SPILL_BASE_ADDRESS = 0x60;
```

### Spill/Reload Methods

```typescript
/**
 * Allocates a spill slot for an IL value.
 * 
 * @param ilValueId - Value to allocate for
 * @returns ZP address of the allocated slot
 * @throws If no slots available
 */
protected allocateSpillSlot(ilValueId: string): number {
  // Check if value already has a spill slot
  for (const [slot, valueId] of this.spillSlots.entries()) {
    if (valueId === ilValueId) {
      return BaseCodeGenerator.SPILL_BASE_ADDRESS + slot;
    }
  }
  
  // Allocate new slot
  if (this.nextSpillSlot >= BaseCodeGenerator.SPILL_SLOT_COUNT) {
    this.addWarning(`Spill slot overflow: cannot allocate for '${ilValueId}'`);
    // Reuse slot 0 as fallback (may cause incorrect code)
    return BaseCodeGenerator.SPILL_BASE_ADDRESS;
  }
  
  const slot = this.nextSpillSlot++;
  this.spillSlots.set(slot, ilValueId);
  return BaseCodeGenerator.SPILL_BASE_ADDRESS + slot;
}

/**
 * Gets the spill slot address for a value, if it has one.
 */
protected getSpillSlot(ilValueId: string): number | undefined {
  for (const [slot, valueId] of this.spillSlots.entries()) {
    if (valueId === ilValueId) {
      return BaseCodeGenerator.SPILL_BASE_ADDRESS + slot;
    }
  }
  return undefined;
}

/**
 * Frees a spill slot when its value is no longer needed.
 */
protected freeSpillSlot(ilValueId: string): void {
  for (const [slot, valueId] of this.spillSlots.entries()) {
    if (valueId === ilValueId) {
      this.spillSlots.delete(slot);
      return;
    }
  }
}

/**
 * Resets spill slots for a new function.
 */
protected resetSpillSlots(): void {
  this.spillSlots.clear();
  this.nextSpillSlot = 0;
}
```

### Spill Value to ZP

```typescript
/**
 * Spills a value from a register to zero-page.
 * 
 * This MUST be called before loading a new value into A when
 * the current A value is still needed.
 * 
 * @param ilValueId - The IL value currently in A
 * @returns The ZP address where the value was spilled
 */
protected spillValueToZP(ilValueId: string): number {
  const zpAddr = this.allocateSpillSlot(ilValueId);
  
  this.emitComment(`Spill ${ilValueId} to $${zpAddr.toString(16).toUpperCase()}`);
  this.emitStaZeroPage(zpAddr, `Save ${ilValueId}`);
  
  // Update value tracking - value is now in ZP, not A
  this.trackValue(ilValueId, {
    location: ValueLocation.ZERO_PAGE,
    address: zpAddr
  });
  
  return zpAddr;
}

/**
 * Reloads a value from zero-page to the accumulator.
 * 
 * @param ilValueId - The IL value to reload
 * @returns true if successful, false if value wasn't spilled
 */
protected reloadValueFromZP(ilValueId: string): boolean {
  const zpAddr = this.getSpillSlot(ilValueId);
  
  if (zpAddr === undefined) {
    // Value wasn't spilled - maybe it's still tracked elsewhere?
    return false;
  }
  
  this.emitComment(`Reload ${ilValueId} from $${zpAddr.toString(16).toUpperCase()}`);
  this.emitLdaZeroPage(zpAddr, `Load ${ilValueId}`);
  
  // Update value tracking - value is now in A
  this.trackValue(ilValueId, {
    location: ValueLocation.ACCUMULATOR
  });
  
  return true;
}
```

---

## Design: Enhanced loadValueToA

The current `loadValueToA` handles tracked values but needs enhancement:

```typescript
/**
 * Enhanced loadValueToA with spill support.
 * 
 * Tries multiple strategies:
 * 1. If value is already in A, do nothing
 * 2. If value has known location (immediate, ZP, etc.), load it
 * 3. If value was spilled, reload from spill slot
 * 4. If value is unknown, emit warning and return false
 */
protected loadValueToA(ilValueId: string): boolean {
  const normalizedId = this.normalizeValueId(ilValueId);
  const loc = this.getValueLocation(normalizedId);
  
  // Strategy 1: Already in A
  if (loc?.location === ValueLocation.ACCUMULATOR) {
    this.emitComment(`${ilValueId} already in A`);
    return true;
  }
  
  // Strategy 2: Known location
  if (loc) {
    switch (loc.location) {
      case ValueLocation.IMMEDIATE:
        this.emitLdaImmediate(loc.value ?? 0, `Load ${ilValueId}`);
        return true;
        
      case ValueLocation.ZERO_PAGE:
        this.emitLdaZeroPage(loc.address ?? 0, `Load ${ilValueId}`);
        return true;
        
      case ValueLocation.ABSOLUTE:
        this.emitLdaAbsolute(loc.address ?? 0, `Load ${ilValueId}`);
        return true;
        
      case ValueLocation.LABEL:
        this.emitInstruction('LDA', loc.label ?? '_unknown', `Load ${ilValueId}`, 3);
        return true;
        
      case ValueLocation.X_REGISTER:
        this.emitInstruction('TXA', undefined, `Transfer ${ilValueId} from X`, 1);
        return true;
        
      case ValueLocation.Y_REGISTER:
        this.emitInstruction('TYA', undefined, `Transfer ${ilValueId} from Y`, 1);
        return true;
    }
  }
  
  // Strategy 3: Check spill slots
  const spillAddr = this.getSpillSlot(normalizedId);
  if (spillAddr !== undefined) {
    this.emitLdaZeroPage(spillAddr, `Reload ${ilValueId} from spill`);
    this.trackValue(normalizedId, { location: ValueLocation.ACCUMULATOR });
    return true;
  }
  
  // Strategy 4: Unknown value
  this.addWarning(`Unknown value location: ${ilValueId}`);
  return false;
}
```

---

## Design: Fixed Binary Operations

### The Problem

Current code assumes left operand is in A:

```typescript
// BROKEN: Doesn't load left operand!
protected generateBinaryOp(instr: ILBinaryInstruction): void {
  const rightOperand = this.formatOperand(rightId);
  // ... emits CLC + ADC but left operand was never loaded
}
```

### The Fix

```typescript
/**
 * Fixed generateBinaryOp with proper operand handling.
 * 
 * For binary operations: result = left OP right
 * We need:
 * 1. Load left operand to A
 * 2. Save left operand (if right isn't immediate)
 * 3. Load right operand (or use immediate)
 * 4. Perform operation with saved left
 */
protected generateBinaryOp(instr: ILBinaryInstruction): void {
  const op = this.getOperatorSymbol(instr.opcode);
  const leftId = instr.left?.toString() ?? '';
  const rightId = instr.right?.toString() ?? '';
  const resultId = instr.result?.toString() ?? '';
  
  this.emitComment(`${resultId} = ${leftId} ${op} ${rightId}`);
  
  // Check if right operand is immediate (common case - no save needed)
  const rightLoc = this.getValueLocation(rightId);
  const rightIsImmediate = rightLoc?.location === ValueLocation.IMMEDIATE;
  
  // Step 1: Load left operand to A
  if (!this.loadValueToA(leftId)) {
    this.emitLdaImmediate(0, `STUB: Cannot load ${leftId}`);
  }
  
  // Step 2: If right isn't immediate, we need to save left first
  let rightOperand: string;
  if (rightIsImmediate) {
    // Right is immediate - just use it directly
    rightOperand = this.formatImmediate(rightLoc.value ?? 0);
  } else {
    // Right is not immediate - must save left before loading right
    const spillAddr = this.spillValueToZP(leftId);
    
    // Now load right operand
    if (!this.loadValueToA(rightId)) {
      this.emitLdaImmediate(0, `STUB: Cannot load ${rightId}`);
    }
    
    // The operation will use left from spill location
    rightOperand = this.formatZeroPage(spillAddr);
    
    // IMPORTANT: For ADD/SUB, we need left in A and right as operand
    // So reload left and use right's current location as operand
    // Actually, this depends on commutativity...
    
    // For commutative ops (ADD, AND, OR, XOR): A=right, operand=left (spilled)
    // For non-commutative ops (SUB): A=left, operand=right (need different approach)
  }
  
  // Step 3: Emit the operation
  this.emitOperation(instr.opcode, rightOperand, resultId);
}

/**
 * Emits the actual binary operation instruction.
 */
protected emitOperation(opcode: ILOpcode, operand: string, resultId: string): void {
  const instrSize = operand.startsWith('#') ? 2 : 
                    operand.startsWith('$') && operand.length <= 3 ? 2 : 3;
  
  switch (opcode) {
    case ILOpcode.ADD:
      this.emitInstruction('CLC', undefined, 'Clear carry for add', 1);
      this.emitInstruction('ADC', operand, `Add`, instrSize);
      break;
      
    case ILOpcode.SUB:
      this.emitInstruction('SEC', undefined, 'Set carry for subtract', 1);
      this.emitInstruction('SBC', operand, `Subtract`, instrSize);
      break;
      
    case ILOpcode.AND:
      this.emitInstruction('AND', operand, `AND`, instrSize);
      break;
      
    case ILOpcode.OR:
      this.emitInstruction('ORA', operand, `OR`, instrSize);
      break;
      
    case ILOpcode.XOR:
      this.emitInstruction('EOR', operand, `XOR`, instrSize);
      break;
      
    // Comparisons...
  }
  
  // Track result in accumulator
  this.trackValue(resultId, { location: ValueLocation.ACCUMULATOR });
}
```

### Handling Non-Commutative Operations

For subtraction (`a - b`), we need A=a and operand=b:

```typescript
/**
 * Handles non-commutative binary operations (SUB, DIV, MOD).
 * 
 * For a - b:
 * 1. Load right (b) to A
 * 2. Spill right to temp
 * 3. Load left (a) to A  
 * 4. Subtract from temp location
 */
protected generateNonCommutativeBinaryOp(instr: ILBinaryInstruction): void {
  const leftId = instr.left?.toString() ?? '';
  const rightId = instr.right?.toString() ?? '';
  const resultId = instr.result?.toString() ?? '';
  
  // Check if right is immediate
  const rightLoc = this.getValueLocation(rightId);
  if (rightLoc?.location === ValueLocation.IMMEDIATE) {
    // Simple case: load left, subtract immediate
    if (!this.loadValueToA(leftId)) {
      this.emitLdaImmediate(0, `STUB: Cannot load ${leftId}`);
    }
    this.emitInstruction('SEC', undefined, 'Set carry', 1);
    this.emitInstruction('SBC', this.formatImmediate(rightLoc.value ?? 0), 'Subtract', 2);
  } else {
    // Complex case: need to save right, load left, subtract
    if (!this.loadValueToA(rightId)) {
      this.emitLdaImmediate(0, `STUB: Cannot load ${rightId}`);
    }
    const rightSpill = this.spillValueToZP(rightId);
    
    if (!this.loadValueToA(leftId)) {
      this.emitLdaImmediate(0, `STUB: Cannot load ${leftId}`);
    }
    
    this.emitInstruction('SEC', undefined, 'Set carry', 1);
    this.emitInstruction('SBC', this.formatZeroPage(rightSpill), 'Subtract', 2);
  }
  
  this.trackValue(resultId, { location: ValueLocation.ACCUMULATOR });
}
```

---

## Design: Value Tracking After CONST

Ensure CONST instructions properly track values:

```typescript
protected generateConst(instr: ILConstInstruction): void {
  const value = instr.value;
  const resultId = instr.result?.toString() ?? '';
  
  if (value > 255) {
    // Word value
    const lowByte = value & 0xFF;
    const highByte = (value >> 8) & 0xFF;
    this.emitLdaImmediate(lowByte, `${resultId} = ${value} (low)`);
    this.emitInstruction('LDX', this.formatImmediate(highByte), `${resultId} (high)`, 2);
    
    // Track as word - but also track that we KNOW the value
    this.trackValue(resultId, {
      location: ValueLocation.IMMEDIATE,  // We know the exact value
      value: value,
      isWord: true
    });
  } else {
    // Byte value
    this.emitLdaImmediate(value, `${resultId} = ${value}`);
    
    // Track as immediate constant AND accumulator
    this.trackValue(resultId, {
      location: ValueLocation.IMMEDIATE,
      value: value
    });
  }
}
```

---

## Task Breakdown

### Session 1.1: Spill Infrastructure (2-3 hours)

| Task | Description | File |
|------|-------------|------|
| 1.1.1 | Add spill constants (SPILL_BASE_ADDRESS, etc.) | `base-generator.ts` |
| 1.1.2 | Add `spillSlots` map and `nextSpillSlot` counter | `base-generator.ts` |
| 1.1.3 | Implement `allocateSpillSlot()` | `base-generator.ts` |
| 1.1.4 | Implement `getSpillSlot()` | `base-generator.ts` |
| 1.1.5 | Implement `freeSpillSlot()` | `base-generator.ts` |
| 1.1.6 | Implement `resetSpillSlots()` | `base-generator.ts` |
| 1.1.7 | Call `resetSpillSlots()` in `resetState()` | `base-generator.ts` |

**Deliverable:** Spill slot allocation working

### Session 1.2: Spill/Reload Methods (2-3 hours)

| Task | Description | File |
|------|-------------|------|
| 1.2.1 | Implement `spillValueToZP()` | `base-generator.ts` |
| 1.2.2 | Implement `reloadValueFromZP()` | `base-generator.ts` |
| 1.2.3 | Enhance `loadValueToA()` to check spill slots | `base-generator.ts` |
| 1.2.4 | Add tests for spill/reload | tests |

**Deliverable:** Values can be spilled and reloaded

### Session 1.3: Fix Binary Operations (3-4 hours)

| Task | Description | File |
|------|-------------|------|
| 1.3.1 | Refactor `generateBinaryOp()` to load left operand | `instruction-generator.ts` |
| 1.3.2 | Add save-before-overwrite logic | `instruction-generator.ts` |
| 1.3.3 | Handle commutative vs non-commutative ops | `instruction-generator.ts` |
| 1.3.4 | Test: `a + b` where both are variables | tests |
| 1.3.5 | Test: `a - b` where both are variables | tests |

**Deliverable:** Binary operations with variables work

### Session 1.4: Value Tracking Tests (2-3 hours)

| Task | Description | File |
|------|-------------|------|
| 1.4.1 | Create value preservation test suite | `value-tracking.test.ts` |
| 1.4.2 | Test: value survives multiple uses | tests |
| 1.4.3 | Test: nested binary operations | tests |
| 1.4.4 | Test: no STUB comments | tests |
| 1.4.5 | Run full test suite, fix issues | all |

**Deliverable:** 20+ value tracking tests pass

---

## Expected Generated Code

### Before Fix

```asm
; IL: v1 = 5, v2 = 3, v3 = v1 + v2
LDA #$05         ; v1 = 5
LDA #$03         ; v2 = 3 (DESTROYS v1!)
CLC
ADC #$00         ; STUB: Cannot load v1 ← WRONG!
```

### After Fix

```asm
; IL: v1 = 5, v2 = 3, v3 = v1 + v2
LDA #$05         ; v1 = 5
STA $60          ; Spill v1 to $60
LDA #$03         ; v2 = 3
STA $61          ; Spill v2 to $61
LDA $60          ; Reload v1
CLC
ADC $61          ; Add v2 from spill location
; v3 now in A    ; ← CORRECT!
```

### Optimized (with immediate detection)

```asm
; IL: v1 = 5, v2 = 3, v3 = v1 + v2
; Both operands are immediate constants - no spill needed
LDA #$05         ; v1 = 5
CLC
ADC #$03         ; Add immediate 3
; v3 now in A    ; ← OPTIMAL!
```

---

## Success Criteria

### Phase 1 is complete when:

1. ✅ Spill slot allocation works ($60-$7F)
2. ✅ `spillValueToZP()` saves values correctly
3. ✅ `reloadValueFromZP()` restores values correctly
4. ✅ `loadValueToA()` finds spilled values
5. ✅ Binary operations load left operand first
6. ✅ Binary operations save before overwriting
7. ✅ "Unknown value location" warnings reduced by 50%+
8. ✅ No STUB comments for basic binary ops
9. ✅ 20+ new tests pass

### Verification

```bash
./compiler-test codegen
./compiler-test e2e
```

---

## Related Documents

- [Current State](02-current-state.md) - Analysis of current implementation
- [PHI Lowering](06-phi-lowering.md) - Uses value tracking infrastructure
- [Register Allocation](10-register-allocation.md) - Builds on value tracking
- [Execution Plan](99-execution-plan.md) - Session details