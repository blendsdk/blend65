# Address-Expr Store-Gap Pattern

> **Document**: 03-address-expr-store-gap.md
> **Parent**: [Index](00-index.md)

## Overview

Add a new "store-gap" pattern variant to `matchAddressExprPattern` that handles the IL shape produced when `loadStoreElimination` removes a `LOAD_WORD` but leaves behind a dead `STORE_WORD` between `LOAD_ADDRESS` and `SHR_WORD`.

## The Problem

After `loadStoreElimination` (peephole step 3), the IL becomes:

```
LOAD_ADDRESS slot       [i+0]  ← address load
STORE_WORD slotX        [i+1]  ← dead param store (LOAD_WORD was removed)
SHR_WORD N              [i+2]  ← shift
LO                      [i+3]  ← narrow
```

Neither existing pattern matches:
- **Direct** (3 instrs): expects SHR_WORD at `[i+1]` → finds STORE_WORD → FAILS
- **Gap** (5 instrs): expects LOAD_WORD at `[i+2]` → finds SHR_WORD → FAILS

## The Fix

### New Pattern: "store-gap" (4 → 1)

```
[i+0]: LOAD_ADDRESS slot     (with dataLabel)
[i+1]: STORE_WORD slotX      (dead param store)
[i+2]: SHR_WORD N             (constant immediate)
[i+3]: LO                     (narrow to byte)
```

**Replacement:** `LOAD_ADDRESS_EXPR slot, N` (1 instruction)

**Codegen result:** `LDA #(label >> N)` — 2 bytes, 2 cycles.

### Safety: Forward-Scan for Dead STORE_WORD

Before replacing, verify the STORE_WORD's target slot (`slotX`) has **no subsequent readers**:

1. Scan forward from `[i+4]` to end of function (or bounded distance)
2. If any `LOAD_WORD slotX` is found → slot is NOT dead → skip optimization
3. If no `LOAD_WORD slotX` found → slot is dead → safe to remove

```typescript
/**
 * Check if a word slot has no subsequent LOAD_WORD readers after a given index.
 * Used to verify a STORE_WORD is dead before removing it in addressExprFolding.
 */
protected isWordSlotDeadAfter(
  slotName: string,
  startIndex: number,
  instructions: ILInstruction[]
): boolean {
  for (let j = startIndex; j < instructions.length; j++) {
    if (instructions[j].opcode === ILOpcode.LOAD_WORD) {
      const loadSlot = this.getSlotName(instructions[j]);
      if (loadSlot === slotName) return false; // Slot is read later
    }
  }
  return true; // No readers found — slot is dead
}
```

### Integration into matchAddressExprPattern

Add as a third pattern variant, checked between "direct" and "gap":

```typescript
// Try store-gap pattern: LOAD_ADDRESS, STORE_WORD(dead), SHR_WORD, LO
if (i + 3 < instrs.length) {
  const storeInstr = instrs[i + 1];
  if (storeInstr.opcode === ILOpcode.STORE_WORD) {
    const storeSlot = this.getSlotName(storeInstr);
    const shrLoMatch = this.matchShrWordLo(instrs, i + 2);
    if (storeSlot && shrLoMatch !== null) {
      // Verify the STORE_WORD target is dead (no subsequent LOAD_WORD)
      if (this.isWordSlotDeadAfter(storeSlot, i + 4, instrs)) {
        return {
          slotName,
          shiftCount: shrLoMatch,
          patternLength: 4,
          patternType: 'with-dead-store-gap',
        };
      }
    }
  }
}
```

### AddressExprMatch Update

Add `'with-dead-store-gap'` to the `patternType` union:

```typescript
interface AddressExprMatch {
  slotName: string;
  shiftCount: number;
  patternLength: number;
  patternType: 'direct' | 'with-store-reload-gap' | 'with-dead-store-gap';
}
```

## Error Handling

| Error Case | Handling Strategy |
|------------|-------------------|
| STORE_WORD target is still referenced | Forward-scan returns false → skip optimization |
| STORE_WORD has non-slot operand | `getSlotName()` returns null → skip |
| SHR_WORD has non-immediate operand | `matchShrWordLo()` returns null → skip |

## Expected Impact

- **O3 spinning-line**: 449 B → 385 B (matches pre-regression)
- **Other levels**: No change (pattern only appears after inlining + loadStoreElimination)
