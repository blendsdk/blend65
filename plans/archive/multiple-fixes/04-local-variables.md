# Local Variables: Technical Specification

> **Document**: 04-local-variables.md
> **Parent**: [Index](00-index.md)

## Overview

Local variables declared inside functions currently produce `STUB: Unknown variable` comments instead of actual LDA/STA instructions. This is because the code generator only tracks global variables.

## Architecture

### Current Architecture

```
Function 'test' with local variable 'x':

generateLoadVar(LOAD_VAR 'x')
    ↓
lookupGlobalAddress('x')  → undefined (not global)
lookupGlobalLabel('x')    → undefined (not global)
    ↓
STUB: Unknown variable x
LDA #$00  ; Placeholder
```

### Proposed Architecture

```
Function 'test' with local variable 'x':

generateFunction(func)
    ↓
allocateLocalVariables(func)  → localAllocations['x'] = { zp: $10, size: 1 }
    ↓
generateBasicBlock(...)
    ↓
generateLoadVar(LOAD_VAR 'x')
    ↓
lookupLocalVariable('x')  → { address: $10, isZeroPage: true }
    ↓
LDA $10  ; Load x
```

## Implementation Details

### New Data Structures

Add to `instruction-generator.ts` or `base-generator.ts`:

```typescript
/**
 * Tracks local variable allocation within a function
 */
interface LocalVariableAllocation {
  /** Variable name */
  name: string;
  /** Allocated zero-page address */
  zpAddress: number;
  /** Size in bytes */
  size: number;
  /** Type kind for word handling */
  typeKind: string;
}

/**
 * Current function's local variable allocations
 * Reset when generating a new function
 */
protected localAllocations: Map<string, LocalVariableAllocation> = new Map();

/**
 * Next available zero-page address for locals
 * Starts after global ZP allocations
 */
protected nextLocalZpAddress: number = 0x50;  // Safe range for locals

/**
 * Base address for function-local zero-page allocation
 */
protected static readonly LOCAL_ZP_START = 0x50;
protected static readonly LOCAL_ZP_END = 0x80;  // 48 bytes for locals
```

### New Methods

```typescript
/**
 * Resets local variable tracking for a new function
 */
protected resetLocalAllocations(): void {
  this.localAllocations.clear();
  this.nextLocalZpAddress = InstructionGenerator.LOCAL_ZP_START;
}

/**
 * Allocates zero-page space for a local variable
 * 
 * @param name - Variable name
 * @param typeKind - Type kind (byte, word, bool)
 * @returns Allocated address or undefined if out of space
 */
protected allocateLocalVariable(name: string, typeKind: string): number | undefined {
  const size = typeKind === 'word' || typeKind === 'pointer' ? 2 : 1;
  
  if (this.nextLocalZpAddress + size > InstructionGenerator.LOCAL_ZP_END) {
    this.addWarning(`Local variable ZP overflow: cannot allocate '${name}'`);
    return undefined;
  }
  
  const address = this.nextLocalZpAddress;
  this.nextLocalZpAddress += size;
  
  this.localAllocations.set(name, {
    name,
    zpAddress: address,
    size,
    typeKind,
  });
  
  return address;
}

/**
 * Looks up a local variable's allocation
 */
protected lookupLocalVariable(name: string): LocalVariableAllocation | undefined {
  return this.localAllocations.get(name);
}
```

### Modifications to generateFunction

```typescript
protected generateFunction(func: ILFunction): void {
  // Reset local allocations for this function
  this.resetLocalAllocations();
  
  // Pre-allocate all local variables from IL function
  for (const local of func.getLocals()) {
    this.allocateLocalVariable(local.name, local.type.kind);
  }
  
  // ... rest of existing generateFunction code
}
```

### Modifications to generateLoadVar

```typescript
protected generateLoadVar(instr: ILLoadVarInstruction): void {
  // Check local variables FIRST
  const local = this.lookupLocalVariable(instr.variableName);
  if (local) {
    if (local.typeKind === 'word') {
      // Word load: low byte first, then high byte
      this.emitLdaZeroPage(local.zpAddress, `Load ${instr.variableName} (low)`);
      this.emitInstruction('LDX', this.formatZeroPage(local.zpAddress + 1), 
        `Load ${instr.variableName} (high)`, 2);
    } else {
      this.emitLdaZeroPage(local.zpAddress, `Load ${instr.variableName}`);
    }
    return;
  }

  // Then check global variables (existing code)
  const addrInfo = this.lookupGlobalAddress(instr.variableName);
  // ... rest of existing code
}
```

### Modifications to generateStoreVar

```typescript
protected generateStoreVar(instr: ILStoreVarInstruction): void {
  // Check local variables FIRST
  const local = this.lookupLocalVariable(instr.variableName);
  if (local) {
    if (local.typeKind === 'word') {
      // Word store: low byte from A, high byte from X
      this.emitStaZeroPage(local.zpAddress, `Store ${instr.variableName} (low)`);
      this.emitInstruction('STX', this.formatZeroPage(local.zpAddress + 1),
        `Store ${instr.variableName} (high)`, 2);
    } else {
      this.emitStaZeroPage(local.zpAddress, `Store ${instr.variableName}`);
    }
    return;
  }

  // Then check global variables (existing code)
  const addrInfo = this.lookupGlobalAddress(instr.variableName);
  // ... rest of existing code
}
```

## Code Examples

### Example 1: Simple Local Byte Variable

```js
// Input
function test(): byte {
  let x: byte = 10;
  return x;
}

// Expected Assembly
_test:
  LDA #$0A        ; v1 = 10
  STA $50         ; Store x
  LDA $50         ; Load x
  RTS             ; Return with value in A
```

### Example 2: Multiple Local Variables

```js
// Input
function add(): byte {
  let a: byte = 5;
  let b: byte = 3;
  return a + b;
}

// Expected Assembly (allocations: a=$50, b=$51)
_add:
  LDA #$05        ; v1 = 5
  STA $50         ; Store a
  LDA #$03        ; v2 = 3
  STA $51         ; Store b
  LDA $50         ; Load a
  CLC
  ADC $51         ; a + b
  RTS
```

### Example 3: Local Word Variable

```js
// Input
function getAddr(): word {
  let addr: word = $D020;
  return addr;
}

// Expected Assembly (allocation: addr=$50-$51)
_getAddr:
  LDA #$20        ; Low byte of $D020
  LDX #$D0        ; High byte of $D020
  STA $50         ; Store addr (low)
  STX $51         ; Store addr (high)
  LDA $50         ; Load addr (low)
  LDX $51         ; Load addr (high)
  RTS
```

## Error Handling

| Error Case | Handling Strategy |
|------------|-------------------|
| Too many locals (ZP overflow) | Emit warning, fallback to STUB |
| Nested scope shadowing | Each function resets allocations |
| Recursive function locals | Same allocation each call (expected) |

## Testing Requirements

1. **Unit test**: Local byte variable allocation
2. **Unit test**: Local word variable allocation
3. **Unit test**: Multiple local variables
4. **Unit test**: ZP overflow warning
5. **E2E test**: Enable `local variable should generate valid load/store`
6. **E2E test**: Enable `should generate valid STA for local variable init`
7. **E2E test**: Enable `should generate valid LDA for local variable read`

## Files to Modify

1. `packages/compiler/src/codegen/instruction-generator.ts` - Main implementation
2. `packages/compiler/src/__tests__/e2e/smoke.test.ts` - Enable test
3. `packages/compiler/src/__tests__/e2e/variables.test.ts` - Enable 2 tests

## Dependencies

- IL function must provide local variable information
- May need to verify `ILFunction.getLocals()` returns correct data

## Estimated Effort

- Implementation: 45-60 minutes
- Testing: 20-30 minutes
- Total: ~1.5 hours