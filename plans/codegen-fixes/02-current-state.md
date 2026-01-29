# Current State: Code Generator

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Architecture Overview

### Inheritance Chain

The code generator uses a layered inheritance architecture:

```
BaseCodeGenerator
    ↓
GlobalsGenerator
    ↓
InstructionGenerator
    ↓
CodeGenerator (concrete)
```

Each layer adds specific functionality:

| Layer | File | Responsibility | Lines |
|-------|------|----------------|-------|
| BaseCodeGenerator | `base-generator.ts` | Value tracking, ASM-IL builder, helpers | ~600 |
| GlobalsGenerator | `globals-generator.ts` | Global variables, arrays, strings | ~400 |
| InstructionGenerator | `instruction-generator.ts` | IL → 6502 translation | ~1300 |
| CodeGenerator | `code-generator.ts` | Entry point, orchestration | ~200 |

### Key Files

```
packages/compiler/src/codegen/
├── base-generator.ts      # Value tracking infrastructure
├── globals-generator.ts   # Global variable handling
├── instruction-generator.ts # Main instruction translation
├── code-generator.ts      # Entry point
├── label-generator.ts     # Label management
├── source-mapper.ts       # Debug source mapping
└── types.ts               # Type definitions
```

---

## Current Value Tracking

### Implementation in base-generator.ts

```typescript
// Value tracking map
protected valueLocations: Map<string, TrackedValue> = new Map();

// TrackedValue interface (from types.ts)
interface TrackedValue {
  location: ValueLocation;  // ACCUMULATOR, IMMEDIATE, ZERO_PAGE, etc.
  value?: number;           // For immediates
  address?: number;         // For ZP/absolute
  label?: string;           // For labeled locations
  isWord?: boolean;         // For 16-bit values
  ilValueId?: string;       // Original IL value ID
}
```

### ValueLocation Enum

```typescript
enum ValueLocation {
  ACCUMULATOR = 'accumulator',
  X_REGISTER = 'x_register',
  Y_REGISTER = 'y_register',
  IMMEDIATE = 'immediate',
  ZERO_PAGE = 'zero_page',
  ABSOLUTE = 'absolute',
  LABEL = 'label',
  STACK = 'stack'
}
```

### Current Methods

| Method | Purpose | Status |
|--------|---------|--------|
| `trackValue()` | Record where an IL value is stored | ✅ Works |
| `getValueLocation()` | Look up IL value location | ✅ Works |
| `loadValueToA()` | Emit code to load value to A | ⚠️ Partial |
| `loadValueToX()` | Emit code to load value to X | ⚠️ Partial |
| `loadValueToY()` | Emit code to load value to Y | ⚠️ Partial |
| `formatOperand()` | Format value as instruction operand | ⚠️ Partial |
| `invalidateAccumulator()` | Mark A as clobbered | ⚠️ Unused |
| `invalidateRegisters()` | Mark all registers clobbered | ⚠️ Unused |

### **CRITICAL GAP: No Spill/Reload**

The current implementation has **NO mechanism** to:

1. ❌ Save a value before A is overwritten
2. ❌ Allocate temporary ZP storage for spilled values
3. ❌ Reload values from spill locations
4. ❌ Track what value is currently in A/X/Y

**Evidence from base-generator.ts:**
```typescript
// The invalidateAccumulator() method exists but is NEVER CALLED
// Values are tracked but never spilled before being overwritten
protected invalidateAccumulator(): void {
  // This deletes entries but doesn't SAVE them first!
  for (const [key, value] of this.valueLocations.entries()) {
    if (value.location === ValueLocation.ACCUMULATOR) {
      this.valueLocations.delete(key);
    }
  }
}
```

---

## Current Local Variable Allocation

### Implementation in instruction-generator.ts

```typescript
// Local allocation tracking
protected localAllocations: Map<string, LocalVariableAllocation> = new Map();
protected nextLocalZpAddress: number = 0x50;

// ZP ranges
static readonly LOCAL_ZP_START = 0x50;  // $50
static readonly LOCAL_ZP_END = 0x80;    // $7F (48 bytes)
```

### Allocation Method

```typescript
protected allocateLocalVariable(name: string, typeKind: string): number | undefined {
  // Check if already allocated
  const existing = this.localAllocations.get(name);
  if (existing) return existing.zpAddress;

  const size = typeKind === 'word' || typeKind === 'pointer' ? 2 : 1;

  if (this.nextLocalZpAddress + size > LOCAL_ZP_END) {
    this.addWarning(`Local variable ZP overflow`);
    return undefined;
  }

  const address = this.nextLocalZpAddress;
  this.nextLocalZpAddress += size;
  this.localAllocations.set(name, { name, zpAddress: address, size, typeKind });
  return address;
}
```

### **GAP: No Spill Slot Allocation**

The local variable allocator is separate from value tracking spills:

- ✅ Allocates ZP space for declared local variables
- ❌ Does NOT allocate space for temporary spills
- ❌ Does NOT integrate with value tracking

---

## Current PHI Node Handling

### PHI Merge Variables

```typescript
// PHI merge allocation
protected phiMergeLocations: Map<string, number> = new Map();
protected nextPhiZpAddress: number = 0x40;

// ZP range for PHI merges
static readonly PHI_ZP_START = 0x40;  // $40
static readonly PHI_ZP_END = 0x50;    // $4F (16 bytes)
```

### PHI Processing Flow

1. **handlePhiMovesForSuccessors()** - Called before terminators
   - Finds PHI instructions in successor blocks
   - For each PHI, finds this block's contributed value
   - Allocates merge variable if needed
   - **BUG**: Calls `loadValueToA()` which often fails → emits 0

2. **generatePhiNode()** - Called when processing PHI instruction
   - Loads from merge variable (which was set by predecessor)
   - Tracks result in accumulator
   - **BUG**: Depends on predecessor having successfully stored

### **CRITICAL GAP: PHI Sources Cannot Be Loaded**

```typescript
// From handlePhiMovesForSuccessors():
if (!this.loadValueToA(contributedValueId)) {
  // This happens ~60+ times per compilation!
  this.emitComment(`WARNING: Cannot load ${contributedValueId} for PHI`);
  this.emitLdaImmediate(0, `STUB: ${contributedValueId}`);  // ALWAYS 0!
}
```

**Why loadValueToA() fails:**
- PHI sources reference SSA-versioned values like `v4:cursorY.0`
- These values were computed earlier but their locations weren't tracked
- By the time we need them for PHI, they're "unknown"

---

## Current Binary Operations

### Implementation Pattern

```typescript
protected generateBinaryOp(instr: ILBinaryInstruction): void {
  const rightOperand = this.formatOperand(rightId);
  
  switch (instr.opcode) {
    case ILOpcode.ADD:
      this.emitInstruction('CLC', undefined, 'Clear carry', 1);
      this.emitInstruction('ADC', rightOperand, `Add ${rightId}`, instrSize);
      this.trackValue(resultId, { location: ValueLocation.ACCUMULATOR });
      break;
    // ... similar for SUB, AND, OR, XOR, comparisons
  }
}
```

### **CRITICAL GAP: Left Operand Not Loaded**

The code **assumes** the left operand is already in A, but:

1. ❌ Never calls `loadValueToA(leftId)` first
2. ❌ Doesn't save A before loading right operand
3. ❌ Right operand load overwrites whatever was in A

**Example failure:**
```
; IL: v3 = v1 + v2
; Expected: LDA v1, STA temp, LDA v2, CLC, ADC temp
; Actual:
LDA #$00  ; STUB - v1 unknown
CLC
ADC #$00  ; STUB - v2 formatted but v1 is gone
```

---

## Current Function Calling

### Implementation

```typescript
protected generateCall(instr: ILCallInstruction): void {
  // STUB: No parameter passing!
  if (instr.args.length > 0) {
    this.emitComment(`STUB: Call with ${instr.args.length} args (ABI not implemented)`);
  }
  this.emitJsr(label, `Call ${instr.functionName}`);
}
```

### **CRITICAL GAP: No ABI**

- ❌ No parameter slots defined
- ❌ No code to load arguments before JSR
- ❌ No handling of return values
- ❌ No caller-save/callee-save convention

---

## Current IL Opcode Coverage

### Implemented Opcodes

| Category | Opcodes | Status |
|----------|---------|--------|
| Constants | CONST | ✅ Full |
| Hardware | HARDWARE_READ, HARDWARE_WRITE | ✅ Full |
| Control | JUMP, BRANCH, RETURN, RETURN_VOID | ✅ Full |
| Variables | LOAD_VAR, STORE_VAR | ✅ Basic |
| Binary | ADD, SUB, AND, OR, XOR | ⚠️ No operand setup |
| Compare | CMP_EQ/NE/LT/LE/GT/GE | ⚠️ No operand setup |
| Arithmetic | MUL, DIV, MOD | ⚠️ Algorithm OK, operands broken |
| Shift | SHL, SHR | ⚠️ Algorithm OK, operands broken |
| Unary | NEG, NOT, LOGICAL_NOT | ⚠️ Partial |
| Array | LOAD_ARRAY, STORE_ARRAY | ⚠️ Partial |
| Memory | PEEK, POKE, PEEKW, POKEW | ⚠️ Partial |
| Address | LOAD_ADDRESS, LO, HI | ⚠️ Partial |
| Volatile | VOLATILE_READ, VOLATILE_WRITE | ⚠️ Partial |
| CPU | SEI, CLI, NOP, BRK, PHA, PLA, PHP, PLP | ✅ Full |
| SSA | PHI | ❌ Broken |
| Calls | CALL, CALL_VOID | ❌ No ABI |

### Missing Opcode Handlers (Fall Through to Placeholder)

| Opcode | Purpose | Impact |
|--------|---------|--------|
| UNDEF | Uninitialized value | Variables may be undefined |
| LOAD_FIELD | Struct field read | Struct access broken |
| STORE_FIELD | Struct field write | Struct access broken |
| LOGICAL_AND | Short-circuit && | Both sides always evaluated |
| LOGICAL_OR | Short-circuit \|\| | Both sides always evaluated |
| ZERO_EXTEND | byte → word | Type conversions broken |
| TRUNCATE | word → byte | Type conversions broken |
| BOOL_TO_BYTE | bool → byte | Type conversions broken |
| BYTE_TO_BOOL | byte → bool | Type conversions broken |
| CALL_INDIRECT | Function pointers | Callbacks broken |
| INTRINSIC_LENGTH | Array/string length | `length()` broken |
| MAP_LOAD_FIELD | @map struct read | Hardware struct access broken |
| MAP_STORE_FIELD | @map struct write | Hardware struct access broken |
| MAP_LOAD_RANGE | @map indexed read | Hardware array access broken |
| MAP_STORE_RANGE | @map indexed write | Hardware array access broken |

---

## Current String Literal Handling

### In IL Generator (expressions.ts)

```typescript
protected generateStringLiteral(_value: string, expr: LiteralExpression): VirtualRegister | null {
  // TODO: Implement proper string literal handling
  this.addWarning('String literal support not fully implemented', ...);
  // Return placeholder 0!
  return this.builder?.emitConstByte(0) ?? null;
}
```

### **CRITICAL GAP: Strings Return 0**

- ❌ No data section allocation for string bytes
- ❌ No null terminator handling
- ❌ Returns address 0 instead of actual address
- ❌ String content is completely lost

---

## Current 16-bit (Word) Handling

### In CONST Instruction

```typescript
if (value > 255) {
  const lowByte = value & 0xFF;
  const highByte = (value >> 8) & 0xFF;
  this.emitLdaImmediate(lowByte, `${resultId} = ${value} (low byte)`);
  this.emitInstruction('LDX', `#${highHex}`, `${resultId} high byte`, 2);
  this.trackValue(resultId, { location: ValueLocation.IMMEDIATE, value, isWord: true });
}
```

### **GAP: Word Tracking Not Preserved**

- ✅ Constants split into A (low) / X (high)
- ❌ Subsequent operations don't track both bytes
- ❌ Word additions don't handle carry
- ❌ Word comparisons only check low byte

---

## ZP Memory Map (Current)

```
$00-$01    Program counter (not used)
$02-$3F    System/unused

$40-$4F    PHI merge variables (16 bytes)
$50-$7F    Local variables (48 bytes)
$80-$FA    Unused (could be spill area)

$FB-$FC    Indirect pointer (ZP_PTR)
$FD-$FE    Unused
$FF        Stack pointer
```

### Proposed Changes

```
$00-$01    Program counter
$02-$3F    System/unused

$40-$4F    PHI merge variables (16 bytes)
$50-$5F    Function parameters (16 bytes) ← NEW
$60-$7F    Spill area (32 bytes) ← NEW
$80-$DF    Local variables (expanded)
$E0-$FA    Reserved for future use

$FB-$FC    Indirect pointer (ZP_PTR)
$FD-$FE    Unused
$FF        Stack pointer
```

---

## Warning Analysis

### Sample Compilation Warnings (~60+)

```
Unknown value location: v1
Unknown value location: v2
Unknown value location: v3
formatOperand: Unknown value v4
WARNING: Cannot load v5:i.0 for PHI
WARNING: Cannot load v6:i.1 for PHI
Unknown value location: v7:cursorY.0
...
```

### Warning Categories

| Category | Count | Root Cause |
|----------|-------|------------|
| "Unknown value location" | ~40 | Values not tracked |
| "Cannot load for PHI" | ~15 | PHI sources not tracked |
| "formatOperand: Unknown" | ~5 | Operand lookup fails |

---

## Summary: What Must Change

### Phase 1: Value Tracking

- Add spill slot allocation ($60-$7F)
- Implement `spillValueToZP()` method
- Implement `reloadValueFromZP()` method
- Call `loadValueToA(leftId)` before binary ops
- Save left operand before loading right

### Phase 2: Missing Opcodes

- Implement 15 missing opcode handlers
- Remove default placeholder fallthrough

### Phase 3: PHI Lowering

- Track SSA-versioned value locations
- Ensure PHI sources are spilled before jumps
- Load actual values, not 0

### Phase 4: Calling Convention

- Define ABI (params at $50-$5F)
- Implement parameter passing in caller
- Implement parameter access in callee

### Phase 5: String Literals

- Allocate strings in data section
- Return actual string address

### Phase 6: Word Operations

- Track A/X pair as single word value
- Implement 16-bit add with carry
- Implement 16-bit comparisons

### Phase 7: Register Allocation

- Track A, X, Y contents
- Use X/Y for temporaries
- Implement smart register selection

---

## Related Documents

- [Requirements](01-requirements.md) - Formal requirements
- [Value Tracking](04-value-tracking.md) - Detailed fix plan
- [Execution Plan](99-execution-plan.md) - Implementation tasks