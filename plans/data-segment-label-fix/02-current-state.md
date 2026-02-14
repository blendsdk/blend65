# Current State: @data Const Array Addressing

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The `@data const` pipeline has three stages that all work correctly in isolation, but the addressing link between code and data is broken:

1. **Global Allocator** (`global-allocator.ts`) — Correctly collects `@data` globals and assigns relative offsets starting at 0.
2. **Data Segment Builder** (`data-segment.ts`) — Correctly evaluates constant initializers, packs bytes, and produces `DataSegmentResult`.
3. **Codegen Phase** (`codegen-phase.ts`) — Correctly appends data bytes as `!byte` directives in a `data` section.

### The Broken Link

The code generator uses `slot.address` (which is 0) as the numeric operand for `LDA`/`STA`. The address was supposed to be rebased to an absolute address, but this never happens.

```
Global Allocator → slot.address = 0 (relative offset)
                        ↓
IL Generator → SlotOperand { slot: { address: 0 } }
                        ↓
Code Generator → LDA $0000,Y  ← BUG: address 0 is wrong
```

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|---------------|
| `frame/types-global.ts` | GlobalSlot interface | Add `dataLabel?: string` field |
| `frame/allocator/global-allocator.ts` | Assigns addresses to @data globals | Generate label names |
| `frame/types.ts` | FrameSlot used by code gen | Add `dataLabel?: string` field |
| `il/il-builder.ts` | Creates SlotOperand for IL | Propagate `dataLabel` to FrameSlot |
| `codegen/generator/memory.ts` | Emits LDA/STA instructions | Use `labelOperand` for @data slots |
| `pipeline/codegen-phase.ts` | Appends data section | Emit labels before `!byte` data |

## Gaps Identified

### Gap 1: No Label on Data Entries

**Current Behavior:** Data section has `!byte` directives with only a comment showing the variable name.
**Required Behavior:** Each `@data` entry must have an ACME label before its bytes.
**Fix Required:** `appendDataSegment()` must emit `asm.label()` before each entry.

### Gap 2: No Label Propagation to Code Generator

**Current Behavior:** `@data` globals have `slot.address = 0` (relative offset, never rebased).
**Required Behavior:** The code generator must know the ACME label name to use instead of address 0.
**Fix Required:** Add `dataLabel` field to `GlobalSlot` and `FrameSlot`, propagate through IL to codegen.

### Gap 3: Code Generator Uses Numeric Address

**Current Behavior:** `genLoadByte()` always uses `slot.slot.address` as numeric operand.
**Required Behavior:** For `@data` slots, use `labelOperand` instead of numeric `operand`.
**Fix Required:** Conditional logic in `genLoadByte()`/`genStoreByte()` checking for `dataLabel`.

## Key Insight

The AsmIL infrastructure **already supports** `labelOperand` on instructions. The emitter already handles label operands for absolute and absoluteY addressing modes. No changes needed at the AsmIL layer — only the code generator needs to USE the existing label support.
