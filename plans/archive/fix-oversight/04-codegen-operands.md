# CodeGen Operands: Value Tracking and Binary Operations

> **Document**: 04-codegen-operands.md
> **Parent**: [Index](00-index.md)

## Overview

Fix the code generator to use actual operand values instead of `#$00` placeholders. This requires implementing a value tracking system to know where IL values are stored (registers, zero page, memory).

## Architecture

### Current Architecture (Broken)

```typescript
// instruction-generator.ts - CURRENT
protected generateBinaryOp(instr: ILBinaryInstruction): void {
  case ILOpcode.ADD:
    this.emitInstruction('CLC', undefined, 'Clear carry', 1);
    this.emitInstruction('ADC', '#$00', 'STUB: placeholder', 2);  // ❌ WRONG
}
```

### Proposed Architecture

```typescript
// base-generator.ts - NEW: Value Location Tracking
enum ValueLocation {
  ACCUMULATOR,    // Value is in A register
  X_REGISTER,     // Value is in X register
  Y_REGISTER,     // Value is in Y register
  ZERO_PAGE,      // Value is at a ZP address
  ABSOLUTE,       // Value is at an absolute address
  IMMEDIATE,      // Value is a known constant
  STACK,          // Value is on the stack
}

interface TrackedValue {
  location: ValueLocation;
  address?: number;        // For ZP/Absolute
  value?: number;          // For Immediate
  isWord?: boolean;        // 16-bit value
}

// Track where each IL value is stored
protected valueLocations: Map<string, TrackedValue> = new Map();
```

## Implementation Details

### Step 1: Add Value Tracking Infrastructure

```typescript
// base-generator.ts

/**
 * Track where a value is located after an instruction.
 */
protected trackValue(ilValue: string, location: TrackedValue): void {
  this.valueLocations.set(ilValue, location);
}

/**
 * Get the location of an IL value.
 */
protected getValueLocation(ilValue: string): TrackedValue | undefined {
  return this.valueLocations.get(ilValue);
}

/**
 * Emit code to load a value into the accumulator.
 */
protected loadValueToA(ilValue: string): void {
  const loc = this.getValueLocation(ilValue);
  if (!loc) {
    this.addWarning(`Unknown value location: ${ilValue}`);
    this.emitLdaImmediate(0, `STUB: ${ilValue} not tracked`);
    return;
  }
  
  switch (loc.location) {
    case ValueLocation.ACCUMULATOR:
      // Already in A, nothing to do
      break;
    case ValueLocation.IMMEDIATE:
      this.emitLdaImmediate(loc.value!, `Load ${ilValue}`);
      break;
    case ValueLocation.ZERO_PAGE:
      this.emitLdaZeroPage(loc.address!, `Load ${ilValue}`);
      break;
    case ValueLocation.ABSOLUTE:
      this.emitLdaAbsolute(loc.address!, `Load ${ilValue}`);
      break;
    case ValueLocation.X_REGISTER:
      this.emitInstruction('TXA', undefined, `Transfer ${ilValue} from X`, 1);
      break;
    case ValueLocation.Y_REGISTER:
      this.emitInstruction('TYA', undefined, `Transfer ${ilValue} from Y`, 1);
      break;
  }
}
```

### Step 2: Track Values in CONST Instructions

```typescript
// instruction-generator.ts

protected generateConst(instr: ILConstInstruction): void {
  const value = instr.value;
  
  if (value > 255) {
    // Word value - track both bytes
    this.emitLdaImmediate(value & 0xFF, `${instr.result} = ${value} (low)`);
    this.emitInstruction('LDX', `#$${((value >> 8) & 0xFF).toString(16).toUpperCase()}`, 'high byte', 2);
    this.trackValue(instr.result.toString(), {
      location: ValueLocation.ACCUMULATOR,
      value: value,
      isWord: true,
    });
  } else {
    this.emitLdaImmediate(value, `${instr.result} = ${value}`);
    this.trackValue(instr.result.toString(), {
      location: ValueLocation.ACCUMULATOR,
      value: value,
    });
  }
}
```

### Step 3: Fix Binary Operations

```typescript
// instruction-generator.ts

protected generateBinaryOp(instr: ILBinaryInstruction): void {
  const leftLoc = this.getValueLocation(instr.left.toString());
  const rightLoc = this.getValueLocation(instr.right.toString());
  
  // Ensure left operand is in A
  this.loadValueToA(instr.left.toString());
  
  // Get operand for right value
  const operand = this.formatOperand(rightLoc);
  
  switch (instr.opcode) {
    case ILOpcode.ADD:
      this.emitInstruction('CLC', undefined, 'Clear carry for add', 1);
      this.emitInstruction('ADC', operand, `Add ${instr.right}`, 2);
      break;
      
    case ILOpcode.SUB:
      this.emitInstruction('SEC', undefined, 'Set carry for subtract', 1);
      this.emitInstruction('SBC', operand, `Subtract ${instr.right}`, 2);
      break;
      
    case ILOpcode.AND:
      this.emitInstruction('AND', operand, `AND ${instr.right}`, 2);
      break;
      
    case ILOpcode.OR:
      this.emitInstruction('ORA', operand, `OR ${instr.right}`, 2);
      break;
      
    case ILOpcode.XOR:
      this.emitInstruction('EOR', operand, `XOR ${instr.right}`, 2);
      break;
      
    // Comparisons
    case ILOpcode.CMP_EQ:
    case ILOpcode.CMP_NE:
    case ILOpcode.CMP_LT:
    case ILOpcode.CMP_LE:
    case ILOpcode.CMP_GT:
    case ILOpcode.CMP_GE:
      this.emitInstruction('CMP', operand, `Compare with ${instr.right}`, 2);
      this.lastComparisonOpcode = instr.opcode;
      break;
  }
  
  // Track result location
  this.trackValue(instr.result.toString(), { location: ValueLocation.ACCUMULATOR });
}

/**
 * Format operand based on value location.
 */
protected formatOperand(loc: TrackedValue | undefined): string {
  if (!loc) return '#$00';  // Fallback
  
  switch (loc.location) {
    case ValueLocation.IMMEDIATE:
      return `#${this.formatHex(loc.value!)}`;
    case ValueLocation.ZERO_PAGE:
      return this.formatZeroPage(loc.address!);
    case ValueLocation.ABSOLUTE:
      return this.formatHex(loc.address!, 4);
    default:
      // Value in register - need to save first
      return '#$00';  // TODO: Handle register-to-register ops
  }
}
```

### Step 4: Track Values in STORE_VAR

```typescript
protected generateStoreVar(instr: ILStoreVarInstruction): void {
  const zpAddr = this.allocateLocalVariable(instr.variableName, 'byte');
  if (zpAddr !== undefined) {
    this.emitStaZeroPage(zpAddr, `Store ${instr.variableName}`);
    // Track that this value is now at this ZP address
    this.trackValue(instr.value.toString(), {
      location: ValueLocation.ZERO_PAGE,
      address: zpAddr,
    });
  }
}
```

## Code Examples

### Example: Before Fix

```asm
; let result = a + b;
LDA $50              ; Load a ✅
; v3 = v1 + v2
CLC                  ; ✅
ADC #$00             ; ❌ Should be $51 (b's address)
STA $52              ; Store result
```

### Example: After Fix

```asm
; let result = a + b;
LDA $50              ; Load a ✅
; v3 = v1 + v2  
CLC                  ; ✅
ADC $51              ; ✅ Actually loads from b's address
STA $52              ; Store result ✅
```

## Testing Requirements

- Unit tests for value tracking (CONST → tracked)
- Unit tests for ADD with tracked operands
- Unit tests for SUB with tracked operands
- Unit tests for all comparison operators
- Integration tests for expressions like `a + b + c`

## Files to Modify

| File | Changes |
|------|---------|
| `codegen/base-generator.ts` | Add ValueLocation enum, tracking methods |
| `codegen/instruction-generator.ts` | Fix generateBinaryOp, add tracking |
| `codegen/types.ts` | Add TrackedValue interface |