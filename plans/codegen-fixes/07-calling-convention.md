# Calling Convention: Phase 4

> **Document**: 07-calling-convention.md
> **Parent**: [Index](00-index.md)
> **Phase**: 4 (After PHI Lowering)
> **REQ**: REQ-03 (Function Calling Convention)

## Overview

Currently: `STUB: Call with N args (ABI not implemented)` - functions receive no parameters.

---

## ABI Design

### Parameter Slots (ZP $50-$5F)

| Slot | Address | Purpose |
|------|---------|---------|
| Param 0 | $50-$51 | First parameter (byte or word) |
| Param 1 | $52-$53 | Second parameter |
| Param 2 | $54-$55 | Third parameter |
| ... | ... | Up to 8 parameters |

### Return Values

- **Byte**: Return in A register
- **Word**: Return in A (low) / X (high)

### Caller/Callee Responsibilities

**Caller:**
1. Load arguments to parameter slots
2. JSR to function
3. Result in A (or A/X)

**Callee:**
1. Parameters pre-loaded at $50+
2. Place result in A before RTS

---

## Implementation

### Caller Side (generateCall)

```typescript
protected generateCall(instr: ILCallInstruction): void {
  this.emitComment(`Call ${instr.functionName}(${instr.args.length} args)`);
  
  // Load arguments to parameter slots
  for (let i = 0; i < instr.args.length; i++) {
    const argId = instr.args[i].toString();
    const paramAddr = 0x50 + (i * 2);  // $50, $52, $54...
    
    if (!this.loadValueToA(argId)) {
      this.emitLdaImmediate(0, `STUB: Cannot load arg ${i}`);
    }
    this.emitStaZeroPage(paramAddr, `Arg ${i} to param slot`);
  }
  
  // Call function
  this.emitJsr(this.getFunctionLabel(instr.functionName));
  
  // Track return value in A
  if (instr.result) {
    this.trackValue(instr.result.toString(), { location: ValueLocation.ACCUMULATOR });
  }
}
```

### Callee Side (Function Prologue)

```typescript
protected generateFunction(func: ILFunction): void {
  // ... setup ...
  
  // Map parameters to their ZP slots
  for (let i = 0; i < func.parameters.length; i++) {
    const param = func.parameters[i];
    const paramAddr = 0x50 + (i * 2);
    
    // Track parameter location
    this.trackValue(param.name, {
      location: ValueLocation.ZERO_PAGE,
      address: paramAddr
    });
    
    // Also register as local allocation
    this.localAllocations.set(param.name, {
      name: param.name,
      zpAddress: paramAddr,
      size: param.type.kind === 'word' ? 2 : 1,
      typeKind: param.type.kind
    });
  }
}
```

---

## Task Breakdown

### Session 4.1: Define ABI (1-2 hours)

| Task | Description |
|------|-------------|
| 4.1.1 | Add PARAM_BASE = 0x50 constant |
| 4.1.2 | Document ABI in code comments |
| 4.1.3 | Add parameter slot allocation |

### Session 4.2: Caller Implementation (2-3 hours)

| Task | Description |
|------|-------------|
| 4.2.1 | Update `generateCall()` |
| 4.2.2 | Update `generateCallVoid()` |
| 4.2.3 | Handle word parameters |

### Session 4.3: Callee Implementation (2-3 hours)

| Task | Description |
|------|-------------|
| 4.3.1 | Update `generateFunction()` prologue |
| 4.3.2 | Map parameters to slots |
| 4.3.3 | Handle return values |

### Session 4.4: Calling Tests (2-3 hours)

| Task | Description |
|------|-------------|
| 4.4.1 | Test single byte parameter |
| 4.4.2 | Test multiple parameters |
| 4.4.3 | Test word parameters |
| 4.4.4 | Test return values |

---

## Success Criteria

1. ✅ Parameters passed via ZP slots
2. ✅ No more "ABI not implemented" stubs
3. ✅ Functions receive correct values
4. ✅ Return values work
5. ✅ 20+ calling convention tests pass

---

## Related Documents

- [Value Tracking](04-value-tracking.md) - Argument loading
- [Word Operations](09-word-operations.md) - Word parameter passing