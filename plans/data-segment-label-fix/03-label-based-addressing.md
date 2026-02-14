# Label-Based Addressing: Technical Specification

> **Document**: 03-label-based-addressing.md
> **Parent**: [Index](00-index.md)

## Overview

Replace the broken numeric-address approach for `@data const` globals with ACME assembler label references. The ACME assembler resolves labels to absolute addresses automatically, eliminating the need for address rebasing in the compiler.

## Architecture

### Data Flow (After Fix)

```
Global Allocator
  → slot.dataLabel = "__data_BalloonSprite_balloonData"
  → slot.address = 0 (relative, but no longer used for code gen)
       ↓
IL Generator (il-builder.ts)
  → FrameSlot { address: 0, dataLabel: "__data_BalloonSprite_balloonData" }
  → SlotOperand { slot: FrameSlot, indexedByY: true }
       ↓
Code Generator (memory.ts)
  → Detects slot.dataLabel exists
  → Emits: LDA (labelOperand="__data_BalloonSprite_balloonData", mode=absoluteY)
       ↓
Data Section (codegen-phase.ts)
  → Emits label: __data_BalloonSprite_balloonData:
  → Emits bytes: !byte $00, $3C, $00, ...
       ↓
ACME Assembler
  → Resolves label to absolute address ✅
```

## Implementation Details

### 1. GlobalSlot Type (`frame/types-global.ts`)

Add optional `dataLabel` field:

```typescript
export interface GlobalSlot {
  // ... existing fields ...

  /** ACME assembly label for @data globals (used instead of numeric address) */
  dataLabel?: string;
}
```

### 2. Label Generation (`frame/allocator/global-allocator.ts`)

In `allocateDataGlobals()`, generate a sanitized label name:

```typescript
// Generate ACME-compatible label: __data_<module>_<name>
// Replace dots with underscores for ACME compatibility
const sanitizedModule = global.moduleName.replace(/\./g, '_');
slot.dataLabel = `__data_${sanitizedModule}_${global.name}`;
```

### 3. FrameSlot Propagation (`frame/types.ts`)

Add optional `dataLabel` to `FrameSlot`:

```typescript
export interface FrameSlot {
  // ... existing fields ...

  /** ACME label for @data const globals */
  dataLabel?: string;
}
```

### 4. IL Builder Propagation

When the IL builder creates a `SlotOperand` for a global variable, it needs to propagate the `dataLabel` from the `GlobalSlot` to the `FrameSlot`. Find where globals are looked up and `FrameSlot` objects are created — ensure `dataLabel` is copied through.

### 5. Code Generator (`codegen/generator/memory.ts`)

In `genLoadByte()` — when `slot.dataLabel` exists, use label-based addressing:

```typescript
// In genLoadByte(), before existing indexedByY check:
if (slot.indexedByY && slot.slot.dataLabel) {
  // @data const array: use ACME label for correct addressing
  this.asm.instruction('LDA', 'absoluteY', undefined, slot.slot.dataLabel);
  this.invalidateA();
  return;
}
```

The AsmILBuilder may need a small helper or the existing `instruction()` method signature must accept `labelOperand`. Check if `asm.lda()` supports label operands — if not, use the lower-level `instruction()` method or add label support to `lda()`.

### 6. Data Section Labels (`pipeline/codegen-phase.ts`)

In `appendDataSegment()`, emit a label before each entry's bytes:

```typescript
for (const entry of result.entries) {
  // Find the GlobalSlot to get the label name
  const slot = /* lookup from globalAllocation.globals */;
  
  if (slot?.dataLabel) {
    // Emit ACME label
    dataSection.elements.push(createLabelElement(slot.dataLabel));
  }
  
  // Emit !byte directives (existing code)
  // ...
}
```

## Label Naming Convention

| Module | Variable | Label |
|--------|----------|-------|
| `BalloonSprite` | `balloonData` | `__data_BalloonSprite_balloonData` |
| `Game.Types` | `lookupTable` | `__data_Game_Types_lookupTable` |
| `Main` | `spriteData` | `__data_Main_spriteData` |

Rules:
- Prefix: `__data_`
- Module dots replaced with underscores
- Variable name appended as-is
- Double underscore prefix prevents collision with user labels

## Error Handling

| Error Case | Handling |
|------------|----------|
| @data slot without dataLabel | Fall back to numeric address (existing behavior) |
| Duplicate label names | Should not happen — qualified names are unique per module |
| Non-array @data scalars | Same label mechanism works (though scalar reads aren't Y-indexed) |

## Compatibility

- **AsmIL layer**: No changes needed — `labelOperand` already supported
- **AsmIL emitter**: Already handles labels in absolute/absoluteY modes
- **AsmIL optimizer**: Already handles `labelOperand` in analysis passes
- **ACME assembler**: Labels are a core feature — fully supported
