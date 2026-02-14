# Array Operations Fix (Read + Write)

> **Document**: 04-array-store.md
> **Parent**: [Index](00-index.md)
> **Updated**: 2025-02-14 (expanded to include array READ codegen fix)

## Overview

Fix BOTH array read AND array write operations. Three separate sub-bugs:

1. **Array READ codegen** — `genLoadByte()` ignores `indexedByY` flag → `LDA $08` instead of `LDA $08,Y`
2. **Array WRITE builder** — No `storeIndexedImm()` or `storeIndexedY()` methods exist
3. **Array WRITE IL gen** — `generateAssignment()` has TODO for IndexExpression targets

## Part 1: Fix Array READ (Codegen)

**File**: `packages/compiler/src/codegen/generator/memory.ts`

The IL builder already emits correct IL (`LOAD_BYTE` with `indexedByY` flag), but codegen ignores it.

### Fix `genLoadByte()`:

```typescript
protected genLoadByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;

    // Check for Y-indexed array access (set by IL builder's loadIndexedY)
    if ((instr.operands[0] as any)?.indexedByY) {
      const mode = address <= 0xFF ? 'zeroPageY' : 'absoluteY';
      this.asm.lda(address, mode);
      this.invalidateA(); // Y-indexed loads produce variable results
      return;
    }

    if (this.aHasSlot(address)) {
      return;
    }
    const mode = this.getLoadMode(slot.slot);
    this.asm.lda(address, mode);
    this.setAFromSlot(address);
}
```

### Fix `genStoreByte()`:

```typescript
protected genStoreByte(instr: ILInstruction): void {
    this.emitComment(instr);
    const slot = this.getSlotOperand(instr.operands);
    const address = slot.slot.address;

    // Check for Y-indexed array access
    if ((instr.operands[0] as any)?.indexedByY) {
      const mode = address <= 0xFF ? 'zeroPageY' : 'absoluteY';
      this.asm.sta(address, mode);
      this.invalidateA();
      return;
    }

    const mode = this.getStoreMode(slot.slot);
    this.asm.sta(address, mode);
    this.setAFromSlot(address);
}
```

## Part 2: Add Array WRITE to Builder

**File**: `packages/compiler/src/il/builder/memory.ts`

Add two methods mirroring existing `loadIndexedImm()` and `loadIndexedY()`:

```typescript
storeIndexedImm(arraySlot: FrameSlot, offset: number, comment?: string): void {
  const elementSlot: FrameSlot = {
    ...arraySlot,
    name: `${arraySlot.name}[${offset}]`,
    address: (arraySlot.address ?? 0) + offset,
    isArrayElement: true,
  };
  this.emit(ILOpcode.STORE_BYTE, [createSlotOperand(elementSlot)], comment);
}

storeIndexedY(arraySlot: FrameSlot, comment?: string): void {
  const indexedSlot: FrameSlot = {
    ...arraySlot,
    name: `${arraySlot.name}[Y]`,
    isArrayElement: true,
  };
  const operand = createSlotOperand(indexedSlot);
  (operand as any).indexedByY = true;
  this.emit(ILOpcode.STORE_BYTE, [operand], comment);
}
```

## Part 3: Handle IndexExpression in generateAssignment()

**File**: `packages/compiler/src/il/generator/expressions.ts`

Replace the TODO block with actual array store logic. For dynamic index, need careful register management: generate value first → push → generate index → TAY → pop value → STA base,Y.

See detailed code in section 2 of original 04-array-store.md (still valid).

## Key Insight

Part 1 (codegen fix) is the **most critical** — it fixes ALL existing array reads. Parts 2-3 (store) are needed for array writes but depend on Part 1 working for the STA,Y path.
