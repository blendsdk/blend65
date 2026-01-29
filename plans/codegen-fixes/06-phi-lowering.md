# PHI Node Lowering: Phase 3

> **Document**: 06-phi-lowering.md
> **Parent**: [Index](00-index.md)
> **Phase**: 3 (After Missing Opcodes)
> **REQ**: REQ-02 (PHI Node Lowering)

## Overview

PHI nodes in SSA form represent merge points where values from different control flow paths combine. Currently, PHI lowering **always loads 0** because source values are untracked.

---

## The Problem

**Current code (handlePhiMovesForSuccessors):**
```typescript
if (!this.loadValueToA(contributedValueId)) {
  this.emitComment(`WARNING: Cannot load ${contributedValueId} for PHI`);
  this.emitLdaImmediate(0, `STUB: ${contributedValueId}`);  // ALWAYS 0!
}
```

**Why it fails:** PHI sources like `v4:cursorY.0` are SSA-versioned values that were computed earlier but their locations weren't preserved in `valueLocations`.

---

## Solution Design

### 1. Track SSA-Versioned Values

Extend value tracking to handle SSA naming:

```typescript
// When tracking a value, also track its SSA name
protected trackValue(ilValueId: string, location: TrackedValue): void {
  const normalizedId = this.normalizeValueId(ilValueId);
  this.valueLocations.set(normalizedId, { ...location, ilValueId: normalizedId });
  
  // Also track by base name for PHI lookup
  const baseName = this.extractBaseName(ilValueId);
  if (baseName !== normalizedId) {
    this.ssaToBaseMap.set(normalizedId, baseName);
  }
}

protected extractBaseName(ilValueId: string): string {
  // v5:i.2 → i, v3:x.0 → x
  const match = ilValueId.match(/v\d+:(\w+)\.\d+/);
  return match ? match[1] : ilValueId;
}
```

### 2. Ensure PHI Sources Are Spilled

Before a terminator, any value that's a PHI source must be in a stable location (not just in A):

```typescript
protected handlePhiMovesForSuccessors(func: ILFunction, block: BasicBlock): void {
  const successors = block.getSuccessors();
  
  for (const successor of successors) {
    for (const phiInstr of successor.getPhiInstructions()) {
      const phi = phiInstr as ILPhiInstruction;
      const contributedValue = phi.getValueForBlock(block.id);
      
      if (contributedValue) {
        const valueId = contributedValue.toString();
        const mergeAddr = this.allocatePhiMergeVariable(phi.result?.toString() ?? '');
        
        // FIXED: Try multiple strategies to load the value
        if (!this.loadPhiSourceValue(valueId)) {
          this.emitLdaImmediate(0, `STUB: Cannot load ${valueId}`);
        }
        
        this.emitStaZeroPage(mergeAddr, `PHI merge for ${phi.result}`);
      }
    }
  }
}

protected loadPhiSourceValue(valueId: string): boolean {
  // Try direct load
  if (this.loadValueToA(valueId)) return true;
  
  // Try lookup by base name
  const baseName = this.extractBaseName(valueId);
  const baseLocations = this.findValueByBaseName(baseName);
  if (baseLocations.length > 0) {
    return this.loadValueToA(baseLocations[0]);
  }
  
  // Try spill slot
  if (this.reloadValueFromZP(valueId)) return true;
  
  return false;
}
```

### 3. Pre-Scan for PHI Requirements

Before generating a function, identify all PHI nodes and ensure their sources are properly tracked:

```typescript
protected preAnalyzePhiNodes(func: ILFunction): void {
  for (const block of func.getBlocks()) {
    for (const instr of block.getInstructions()) {
      if (instr.opcode === ILOpcode.PHI) {
        const phi = instr as ILPhiInstruction;
        for (const source of phi.sources) {
          // Mark this value as "needed for PHI" - must be spilled
          this.phiSourceValues.add(source.value.toString());
        }
      }
    }
  }
}
```

---

## Task Breakdown

### Session 3.1: SSA Value Tracking (2-3 hours)

| Task | Description |
|------|-------------|
| 3.1.1 | Add `ssaToBaseMap: Map<string, string>` |
| 3.1.2 | Implement `extractBaseName()` |
| 3.1.3 | Update `trackValue()` to map SSA names |
| 3.1.4 | Add `findValueByBaseName()` lookup |

### Session 3.2: PHI Source Loading (3-4 hours)

| Task | Description |
|------|-------------|
| 3.2.1 | Implement `loadPhiSourceValue()` |
| 3.2.2 | Fix `handlePhiMovesForSuccessors()` |
| 3.2.3 | Add pre-analysis `preAnalyzePhiNodes()` |
| 3.2.4 | Ensure PHI sources spilled before jumps |

### Session 3.3: Control Flow Tests (2-3 hours)

| Task | Description |
|------|-------------|
| 3.3.1 | Test if/else PHI merging |
| 3.3.2 | Test while loop iteration variables |
| 3.3.3 | Test for loop counters |
| 3.3.4 | Test nested control flow |

---

## Expected Results

**Before:**
```asm
; PHI prep: v8:cursorY.1 <- v4:cursorY.0
; WARNING: Cannot load v4:cursorY.0 for PHI
LDA #$00                ; STUB - ALWAYS 0!
STA $40
```

**After:**
```asm
; PHI prep: v8:cursorY.1 <- v4:cursorY.0  
LDA $60                 ; Reload from spill slot
STA $40                 ; Store to PHI merge
```

---

## Success Criteria

1. ✅ SSA-versioned values tracked properly
2. ✅ PHI sources load actual values, not 0
3. ✅ "WARNING: Cannot load" messages eliminated
4. ✅ if/else value merging works
5. ✅ Loop iteration variables work
6. ✅ 25+ PHI tests pass

---

## Related Documents

- [Value Tracking](04-value-tracking.md) - Foundation for PHI loading
- [Current State](02-current-state.md) - PHI problem analysis