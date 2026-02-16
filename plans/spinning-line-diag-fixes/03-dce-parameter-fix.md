# DCE Parameter Store Fix: Bug #1

> **Document**: 03-dce-parameter-fix.md
> **Parent**: [Index](00-index.md)
> **Bug**: #1 — Critical (REG)

## Overview

The DCE pass removes stores to parameter slots before function calls because the liveness analysis doesn't see inter-procedural data flow. The fix ensures CALL instructions declare parameter slots as uses in their `defUse` metadata.

## Architecture

### Current Architecture

```
IL Generator → STORE_BYTE(paramSlot) → CALL(funcName)
                  ↑ defUse.defs=[paramSlot]    ↑ defUse.uses=[] ← BUG: no param uses!
                  
computeLiveRanges: paramSlot NOT in CALL.uses → NOT in STORE.liveOut → isDeadStore=true
```

### Proposed Fix

```
IL Generator → STORE_BYTE(paramSlot) → CALL(funcName)
                  ↑ defUse.defs=[paramSlot]    ↑ defUse.uses=[paramSlot,...] ← FIX: params as uses
                  
computeLiveRanges: paramSlot IN CALL.uses → IN STORE.liveOut → isDeadStore=false ✅
```

## Implementation Details

### Where CALL Instructions Are Generated

The fix needs to happen where the IL generator creates CALL instructions. The CALL instruction's `defUse.uses` must include all parameter slot names that the callee reads. This information is available from the callee's frame (parameter slots).

**Investigation step:** Find where `ILOpcode.CALL` instructions are created in the IL generator. The CALL's `defUse` must be updated to include all parameter slot names from the callee function's frame.

### What to Change

1. **Find the CALL instruction generation code** — likely in `packages/compiler/src/il/` or the IL generator
2. **Look up the callee's parameter slots** from the function's frame/declaration
3. **Add parameter slot names to `defUse.uses`** on the CALL instruction

### Pseudocode

```typescript
// When generating a CALL instruction:
const callInstr: ILInstruction = {
  opcode: ILOpcode.CALL,
  operands: [{ kind: 'function', name: calleeName }],
  defUse: {
    defs: [],  // CALL may also clobber return value slots
    uses: [...parameterSlotNames],  // FIX: include all param slots
  },
};
```

### Alternative Fix: Modify isDeadStore()

If modifying the IL generator is too invasive, an alternative is to make `isDeadStore()` aware of CALL instructions:

```typescript
export function isDeadStore(instr: ILInstruction): boolean {
  // ... existing checks ...
  
  // Check if this is a store to a parameter slot
  const slot = (operand as SlotOperand).slot;
  if (slot.kind === SlotKind.Parameter) {
    // Parameter stores before CALL instructions are NEVER dead —
    // the callee reads them even though we can't see the use
    return false;
  }
  
  return !instr.liveOut.has(varName);
}
```

**Trade-off:** This approach is simpler but more conservative — it prevents DCE from removing ANY parameter slot store, even truly dead ones. The `defUse.uses` approach is more precise.

### Recommended Approach

**Use the `defUse.uses` approach** (modify CALL generation) because:
1. It's precise — only marks parameter slots as used at the specific CALL point
2. It works correctly with the existing liveness analysis infrastructure
3. It allows DCE to still remove parameter stores that ARE truly dead (e.g., if a function is called but the parameter is unused in the callee)

## Error Handling

| Error Case | Handling Strategy |
|------------|-------------------|
| Callee function not found during CALL generation | This shouldn't happen — semantic analysis already verified the call. Log a warning if it does. |
| Parameter slot count mismatch | This would be a pre-existing bug. Verify slot count matches callee parameter count. |

## Testing Requirements

- Unit tests: Verify CALL instructions have correct `defUse.uses` for parameter slots
- Regression test: Compile `spinning-line` at O1/Os/Oz and verify `STA $02` is preserved
- Integration test: Full pipeline test with function calls and parameter passing at all opt levels
