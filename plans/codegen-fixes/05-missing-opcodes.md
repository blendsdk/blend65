# Missing IL Opcodes: Phase 2

> **Document**: 05-missing-opcodes.md
> **Parent**: [Index](00-index.md)
> **Phase**: 2 (After Value Tracking)
> **REQs**: REQ-04 (Missing Opcodes), REQ-07 (Short-Circuit), REQ-12 (Arrays)
> **Last Updated**: 2026-01-28 (Removed opcodes for features not in language)

## Overview

The code generator is missing handlers for **12 IL opcodes**. These opcodes fall through to `generatePlaceholder()` which emits a NOP and warning.

This phase implements ALL missing opcode handlers so every IL instruction is properly translated to 6502 assembly.

---

## ⚠️ AMENDMENT NOTE (2026-01-28)

The following opcodes have been **REMOVED** from this plan because the features they support are not in the current Blend65 language specification:

| Removed Opcode | Reason | Future? |
|----------------|--------|---------|
| `LOAD_FIELD` | General struct types not in language | Yes (future feature) |
| `STORE_FIELD` | General struct types not in language | Yes (future feature) |
| `CALL_INDIRECT` | Function pointers not in language | Yes (future feature) |

**Note:** `MAP_LOAD_FIELD` and `MAP_STORE_FIELD` are **KEPT** because @map struct-like layouts (`@map vic at $D000 layout { ... }`) ARE in the language specification.

---

## Missing Opcodes Summary

| Opcode | Category | Purpose | Priority |
|--------|----------|---------|----------|
| UNDEF | Initialization | Uninitialized variable marker | Medium |
| LOGICAL_AND | Logic | Short-circuit && | High |
| LOGICAL_OR | Logic | Short-circuit \|\| | High |
| ZERO_EXTEND | Conversion | byte → word | High |
| TRUNCATE | Conversion | word → byte | High |
| BOOL_TO_BYTE | Conversion | bool → byte | Medium |
| BYTE_TO_BOOL | Conversion | byte → bool | Medium |
| INTRINSIC_LENGTH | Intrinsic | Array/string length | Medium |
| MAP_LOAD_FIELD | @map | Hardware struct read | High |
| MAP_STORE_FIELD | @map | Hardware struct write | High |
| MAP_LOAD_RANGE | @map | Hardware indexed read | Medium |
| MAP_STORE_RANGE | @map | Hardware indexed write | Medium |

---

## Session 2.1: Type Conversion Opcodes

### ZERO_EXTEND (byte → word)

**Purpose:** Extends an 8-bit value to 16-bit by adding a zero high byte.

**Generated Code:**
```asm
; ZERO_EXTEND: v2 = zext(v1)
; Input: v1 (byte) in A
; Output: v2 (word) in A (low) / X (high)

        LDX #$00       ; High byte = 0
        ; A already contains low byte
```

**Implementation:**
```typescript
protected generateZeroExtend(instr: ILZeroExtendInstruction): void {
  const sourceId = instr.source?.toString() ?? '';
  const resultId = instr.result?.toString() ?? '';
  
  this.emitComment(`${resultId} = zext(${sourceId})`);
  
  // Load source byte to A if not already there
  if (!this.loadValueToA(sourceId)) {
    this.emitLdaImmediate(0, `STUB: Cannot load ${sourceId}`);
  }
  
  // Set high byte (X) to 0
  this.emitInstruction('LDX', '#$00', 'High byte = 0 (zero extend)', 2);
  
  // Track result as word value
  this.trackValue(resultId, {
    location: ValueLocation.ACCUMULATOR,
    isWord: true
  });
}
```

### TRUNCATE (word → byte)

**Purpose:** Extracts the low byte from a 16-bit value.

**Generated Code:**
```asm
; TRUNCATE: v2 = trunc(v1)
; Input: v1 (word) in A (low) / X (high)
; Output: v2 (byte) in A

        ; A already contains low byte
        ; Just discard X (high byte)
```

**Implementation:**
```typescript
protected generateTruncate(instr: ILTruncateInstruction): void {
  const sourceId = instr.source?.toString() ?? '';
  const resultId = instr.result?.toString() ?? '';
  
  this.emitComment(`${resultId} = trunc(${sourceId})`);
  
  // Load source - low byte goes to A
  if (!this.loadValueToA(sourceId)) {
    this.emitLdaImmediate(0, `STUB: Cannot load ${sourceId}`);
  }
  
  // A already has low byte, X is discarded
  // Track result as byte value
  this.trackValue(resultId, {
    location: ValueLocation.ACCUMULATOR,
    isWord: false
  });
}
```

### BOOL_TO_BYTE

**Purpose:** Converts boolean (0/1) to byte (0/non-zero).

**Generated Code:**
```asm
; BOOL_TO_BYTE: v2 = btob(v1)
; Input: v1 (bool) in A
; Output: v2 (byte) in A
; For Blend65, bool is already 0 or 1 - no conversion needed
```

**Implementation:**
```typescript
protected generateBoolToByte(instr: ILBoolToByteInstruction): void {
  const sourceId = instr.source?.toString() ?? '';
  const resultId = instr.result?.toString() ?? '';
  
  this.emitComment(`${resultId} = bool_to_byte(${sourceId})`);
  
  // In Blend65, bool is already 0 or 1 stored as byte
  // Just load the value
  if (!this.loadValueToA(sourceId)) {
    this.emitLdaImmediate(0, `STUB: Cannot load ${sourceId}`);
  }
  
  this.trackValue(resultId, { location: ValueLocation.ACCUMULATOR });
}
```

### BYTE_TO_BOOL

**Purpose:** Converts byte to boolean (0 = false, non-zero = true → 1).

**Generated Code:**
```asm
; BYTE_TO_BOOL: v2 = btob(v1)
; Input: v1 (byte) in A
; Output: v2 (bool: 0 or 1) in A

        CMP #$00       ; Compare with 0
        BEQ .is_false  ; If zero, result is 0
        LDA #$01       ; Non-zero becomes 1
        JMP .done
.is_false:
        LDA #$00       ; Zero stays 0
.done:
```

**Implementation:**
```typescript
protected generateByteToBool(instr: ILByteToBoolInstruction): void {
  const sourceId = instr.source?.toString() ?? '';
  const resultId = instr.result?.toString() ?? '';
  
  this.emitComment(`${resultId} = byte_to_bool(${sourceId})`);
  
  // Load source byte
  if (!this.loadValueToA(sourceId)) {
    this.emitLdaImmediate(0, `STUB: Cannot load ${sourceId}`);
  }
  
  // Convert: 0 → 0, non-zero → 1
  const falseLabel = this.getTempLabel('btob_false');
  const doneLabel = this.getTempLabel('btob_done');
  
  this.emitInstruction('CMP', '#$00', 'Compare with 0', 2);
  this.emitInstruction('BEQ', falseLabel, 'If zero, skip', 2);
  this.emitLdaImmediate(1, 'Non-zero becomes 1');
  this.emitJmp(doneLabel, 'Skip false case');
  this.emitLabel(falseLabel, 'temp');
  this.emitLdaImmediate(0, 'Zero stays 0');
  this.emitLabel(doneLabel, 'temp');
  
  this.trackValue(resultId, { location: ValueLocation.ACCUMULATOR });
}
```

---

## Session 2.2: UNDEF Opcode

> **Note:** LOAD_FIELD and STORE_FIELD have been **removed** - general struct types are not in the current Blend65 language specification. See Amendment Note above.

### UNDEF

**Purpose:** Marker for uninitialized variables. Typically optimized away, but may appear.

**Generated Code:**
```asm
; UNDEF: v1 = undef
; Load 0 as placeholder for uninitialized value
        LDA #$00       ; Undefined → 0
```

**Implementation:**
```typescript
protected generateUndef(instr: ILUndefInstruction): void {
  const resultId = instr.result?.toString() ?? '';
  
  this.emitComment(`${resultId} = undef (uninitialized)`);
  this.emitLdaImmediate(0, 'Undefined value = 0');
  
  this.trackValue(resultId, {
    location: ValueLocation.IMMEDIATE,
    value: 0
  });
}
```

---

## Session 2.3: @map Struct Opcodes

These handle memory-mapped hardware structs like VIC-II registers.

### MAP_LOAD_FIELD

**Purpose:** Reads a field from a memory-mapped hardware struct.

**Generated Code:**
```asm
; MAP_LOAD_FIELD: v1 = vic.borderColor (at $D020)
        LDA $D020      ; Direct absolute load from hardware address
```

**Implementation:**
```typescript
protected generateMapLoadField(instr: ILMapLoadFieldInstruction): void {
  const structName = instr.structName;
  const fieldName = instr.fieldName;
  const address = instr.address;  // Absolute hardware address
  const resultId = instr.result?.toString() ?? '';
  
  this.emitComment(`${resultId} = ${structName}.${fieldName}`);
  this.emitLdaAbsolute(address, `Load ${structName}.${fieldName} from ${this.formatHex(address)}`);
  
  this.trackValue(resultId, { location: ValueLocation.ACCUMULATOR });
}
```

### MAP_STORE_FIELD

**Purpose:** Writes a value to a memory-mapped hardware field.

**Generated Code:**
```asm
; MAP_STORE_FIELD: vic.borderColor = 5
        LDA #$05       ; Load value
        STA $D020      ; Store to hardware address
```

**Implementation:**
```typescript
protected generateMapStoreField(instr: ILMapStoreFieldInstruction): void {
  const structName = instr.structName;
  const fieldName = instr.fieldName;
  const address = instr.address;
  const valueId = instr.value?.toString() ?? '';
  
  this.emitComment(`${structName}.${fieldName} = ${valueId}`);
  
  // Load value to store
  if (!this.loadValueToA(valueId)) {
    this.emitLdaImmediate(0, `STUB: Cannot load ${valueId}`);
  }
  
  this.emitStaAbsolute(address, `Store to ${structName}.${fieldName} at ${this.formatHex(address)}`);
}
```

### MAP_LOAD_RANGE / MAP_STORE_RANGE

**Purpose:** Handles indexed access to memory-mapped arrays (e.g., sprite positions).

**Implementation:**
```typescript
protected generateMapLoadRange(instr: ILMapLoadRangeInstruction): void {
  const structName = instr.structName;
  const fieldName = instr.fieldName;
  const baseAddress = instr.baseAddress;
  const indexId = instr.index?.toString() ?? '';
  const resultId = instr.result?.toString() ?? '';
  
  this.emitComment(`${resultId} = ${structName}.${fieldName}[${indexId}]`);
  
  // Load index to Y
  if (!this.loadValueToY(indexId)) {
    this.emitInstruction('LDY', '#$00', `STUB: Cannot load index ${indexId}`, 2);
  }
  
  // Load from base + Y
  this.emitInstruction('LDA', `${this.formatHex(baseAddress)},Y`, `Load indexed`, 3);
  
  this.trackValue(resultId, { location: ValueLocation.ACCUMULATOR });
}

protected generateMapStoreRange(instr: ILMapStoreRangeInstruction): void {
  const structName = instr.structName;
  const fieldName = instr.fieldName;
  const baseAddress = instr.baseAddress;
  const indexId = instr.index?.toString() ?? '';
  const valueId = instr.value?.toString() ?? '';
  
  this.emitComment(`${structName}.${fieldName}[${indexId}] = ${valueId}`);
  
  // Load value first
  if (!this.loadValueToA(valueId)) {
    this.emitLdaImmediate(0, `STUB: Cannot load ${valueId}`);
  }
  
  // Save value
  this.emitInstruction('PHA', undefined, 'Save value', 1);
  
  // Load index to Y
  if (!this.loadValueToY(indexId)) {
    this.emitInstruction('LDY', '#$00', `STUB: Cannot load index ${indexId}`, 2);
  }
  
  // Restore value and store
  this.emitInstruction('PLA', undefined, 'Restore value', 1);
  this.emitInstruction('STA', `${this.formatHex(baseAddress)},Y`, `Store indexed`, 3);
}
```

---

## Session 2.4: Short-Circuit Opcodes

### LOGICAL_AND (&&)

**Purpose:** Short-circuit AND - if left is false, don't evaluate right.

**Generated Code:**
```asm
; LOGICAL_AND: v3 = v1 && v2
; If v1 is false (0), result is 0 without evaluating v2

        ; Load v1
        LDA v1
        BEQ .result_false   ; If v1 == 0, result = 0
        
        ; v1 was true, now evaluate v2
        LDA v2
        BEQ .result_false   ; If v2 == 0, result = 0
        
        ; Both true
        LDA #$01
        JMP .done
        
.result_false:
        LDA #$00
.done:
```

**Implementation:**
```typescript
protected generateLogicalAnd(instr: ILLogicalAndInstruction): void {
  const leftId = instr.left?.toString() ?? '';
  const rightId = instr.right?.toString() ?? '';
  const resultId = instr.result?.toString() ?? '';
  
  this.emitComment(`${resultId} = ${leftId} && ${rightId} (short-circuit)`);
  
  const falseLabel = this.getTempLabel('and_false');
  const doneLabel = this.getTempLabel('and_done');
  
  // Evaluate left
  if (!this.loadValueToA(leftId)) {
    this.emitLdaImmediate(0, `STUB: Cannot load ${leftId}`);
  }
  this.emitInstruction('BEQ', falseLabel, 'If left false, short-circuit', 2);
  
  // Left was true, evaluate right
  if (!this.loadValueToA(rightId)) {
    this.emitLdaImmediate(0, `STUB: Cannot load ${rightId}`);
  }
  this.emitInstruction('BEQ', falseLabel, 'If right false, result false', 2);
  
  // Both true
  this.emitLdaImmediate(1, 'Both true, result = 1');
  this.emitJmp(doneLabel, 'Skip false case');
  
  // False case
  this.emitLabel(falseLabel, 'temp');
  this.emitLdaImmediate(0, 'Short-circuit: result = 0');
  
  this.emitLabel(doneLabel, 'temp');
  this.trackValue(resultId, { location: ValueLocation.ACCUMULATOR });
}
```

### LOGICAL_OR (||)

**Purpose:** Short-circuit OR - if left is true, don't evaluate right.

**Generated Code:**
```asm
; LOGICAL_OR: v3 = v1 || v2
; If v1 is true (non-zero), result is 1 without evaluating v2

        ; Load v1
        LDA v1
        BNE .result_true    ; If v1 != 0, result = 1
        
        ; v1 was false, now evaluate v2
        LDA v2
        BNE .result_true    ; If v2 != 0, result = 1
        
        ; Both false
        LDA #$00
        JMP .done
        
.result_true:
        LDA #$01
.done:
```

**Implementation:**
```typescript
protected generateLogicalOr(instr: ILLogicalOrInstruction): void {
  const leftId = instr.left?.toString() ?? '';
  const rightId = instr.right?.toString() ?? '';
  const resultId = instr.result?.toString() ?? '';
  
  this.emitComment(`${resultId} = ${leftId} || ${rightId} (short-circuit)`);
  
  const trueLabel = this.getTempLabel('or_true');
  const doneLabel = this.getTempLabel('or_done');
  
  // Evaluate left
  if (!this.loadValueToA(leftId)) {
    this.emitLdaImmediate(0, `STUB: Cannot load ${leftId}`);
  }
  this.emitInstruction('BNE', trueLabel, 'If left true, short-circuit', 2);
  
  // Left was false, evaluate right
  if (!this.loadValueToA(rightId)) {
    this.emitLdaImmediate(0, `STUB: Cannot load ${rightId}`);
  }
  this.emitInstruction('BNE', trueLabel, 'If right true, result true', 2);
  
  // Both false
  this.emitLdaImmediate(0, 'Both false, result = 0');
  this.emitJmp(doneLabel, 'Skip true case');
  
  // True case
  this.emitLabel(trueLabel, 'temp');
  this.emitLdaImmediate(1, 'Short-circuit: result = 1');
  
  this.emitLabel(doneLabel, 'temp');
  this.trackValue(resultId, { location: ValueLocation.ACCUMULATOR });
}
```

---

## Session 2.5: INTRINSIC_LENGTH

> **Note:** CALL_INDIRECT has been **removed** - function pointers are not in the current Blend65 language specification. See Amendment Note above.

### INTRINSIC_LENGTH

**Purpose:** Returns the length of an array or string.

**Generated Code:**
```asm
; INTRINSIC_LENGTH: v2 = length(v1)
; For fixed-size arrays, this is a compile-time constant
; For strings, need to scan for null terminator

        LDA #arraySize  ; Constant for fixed arrays
```

**Implementation:**
```typescript
protected generateIntrinsicLength(instr: ILIntrinsicLengthInstruction): void {
  const sourceId = instr.source?.toString() ?? '';
  const resultId = instr.result?.toString() ?? '';
  const knownLength = instr.knownLength;  // Compile-time length if known
  
  this.emitComment(`${resultId} = length(${sourceId})`);
  
  if (knownLength !== undefined) {
    // Fixed-size array - length is constant
    this.emitLdaImmediate(knownLength, `Array length = ${knownLength}`);
  } else {
    // Dynamic length - need runtime scan
    this.emitComment('STUB: Dynamic length calculation');
    this.emitLdaImmediate(0, 'Unknown length');
  }
  
  this.trackValue(resultId, { location: ValueLocation.ACCUMULATOR });
}
```

---

## Task Breakdown

### Session 2.1: Type Conversions (3-4 hours)

| Task | Description |
|------|-------------|
| 2.1.1 | Implement ZERO_EXTEND |
| 2.1.2 | Implement TRUNCATE |
| 2.1.3 | Implement BOOL_TO_BYTE |
| 2.1.4 | Implement BYTE_TO_BOOL |
| 2.1.5 | Add tests for type conversions |

### Session 2.2: UNDEF Opcode (1 hour)

| Task | Description |
|------|-------------|
| 2.2.1 | Implement UNDEF |
| 2.2.2 | Add tests for UNDEF |

> **Removed:** LOAD_FIELD, STORE_FIELD (general structs not in language)

### Session 2.3: @map Structs (3-4 hours)

| Task | Description |
|------|-------------|
| 2.3.1 | Implement MAP_LOAD_FIELD |
| 2.3.2 | Implement MAP_STORE_FIELD |
| 2.3.3 | Implement MAP_LOAD_RANGE |
| 2.3.4 | Implement MAP_STORE_RANGE |
| 2.3.5 | Add tests for @map access |

### Session 2.4: Short-Circuit (3-4 hours)

| Task | Description |
|------|-------------|
| 2.4.1 | Implement LOGICAL_AND |
| 2.4.2 | Implement LOGICAL_OR |
| 2.4.3 | Test short-circuit behavior |
| 2.4.4 | Test side effects not evaluated |

### Session 2.5: INTRINSIC_LENGTH (1-2 hours)

| Task | Description |
|------|-------------|
| 2.5.1 | Implement INTRINSIC_LENGTH |
| 2.5.2 | Verify no opcodes fall through |
| 2.5.3 | Add tests for INTRINSIC_LENGTH |

> **Removed:** CALL_INDIRECT (function pointers not in language)

---

## Success Criteria

### Phase 2 is complete when:

1. ✅ All 12 missing opcodes have handlers
2. ✅ No opcodes fall through to placeholder
3. ✅ Type conversions work correctly
4. ✅ Short-circuit && and || work
5. ✅ @map struct access works
6. ✅ 30+ new tests pass

### Verification

```bash
./compiler-test codegen
./compiler-test e2e
```

---

## Related Documents

- [Current State](02-current-state.md) - Missing opcode list
- [Value Tracking](04-value-tracking.md) - Operand loading
- [Execution Plan](99-execution-plan.md) - Session details