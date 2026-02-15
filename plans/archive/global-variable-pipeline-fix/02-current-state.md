# Current State: Global Variable Pipeline Fix

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### Pipeline Flow

```
Source → Lexer → Parser → Semantic → FramePhase → ILGenerator → Codegen → Assembly
                                     ↑                ↑
                              GlobalAllocator    Uses global slots
                              + FrameAllocator   for variable resolution
```

### What Exists

1. **GlobalAllocator** (`frame/allocator/global-allocator.ts`):
   - Collects ALL module-level VariableDecls (including const)
   - Categorizes by storage class (@zp, @ram, @data, default)
   - @zp globals allocated through ZpPool ✅
   - @ram/default globals assigned RELATIVE offsets starting from 0 ⚠️
   - Comment says "will be rebased during codegen" — **rebasing never happens** ❌

2. **FramePhase** (`pipeline/frame-phase.ts`):
   - Runs GlobalAllocator first, passes zpPool to FrameAllocator ✅
   - ZpPool sharing mechanism is correctly wired ✅
   - But default globals bypass ZpPool entirely ⚠️

3. **ILGenerator Expressions** (`il/generator/expressions.ts`):
   - `generateIdentifier()` inlines constants via `tryResolveConstantAddress()` ✅
   - `generateBinary()` checks for literal & slot right operands
   - **Missing**: Does NOT check if identifier right operand is a const ❌
   - Binary path uses `tryResolveVariable()` → gets slot with relative address → emits slot load

4. **Variable Resolution** (`il/generator/base.ts`):
   - `convertAndCacheGlobalSlot()` maps default globals to `SlotLocation.FrameRegion`
   - Address is the raw relative offset from GlobalAllocator (0, 2, 4, 5, 6, 7, 8...)
   - These low addresses land in ZP space and conflict with SFA locals

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `il/generator/expressions.ts` | Binary expression generation | Add const-inline check for identifier right operands |
| `frame/allocator/global-allocator.ts` | Global variable allocation | Skip const globals, route default globals through ZpPool |
| `il/generator/base.ts` | Variable resolution | May need minor adjustments for const-skipped globals |
| `frame/allocator/zp-pool.ts` | ZP address allocation | Already supports allocation — no changes needed |
| `pipeline/frame-phase.ts` | Pipeline orchestration | No changes needed |

## Gaps Identified

### Gap 1: Constants Not Inlined in Binary Expressions

**Current Behavior:** `y * SCREEN_WIDTH` resolves SCREEN_WIDTH to a slot (address $06) and emits `MUL_BYTE` with slot operand → codegen produces `LDA $06`.

**Required Behavior:** Recognize SCREEN_WIDTH as a compile-time constant (value=40) and emit `MUL_IMM` with immediate 40 → codegen produces `LDA #$28`.

**Root Cause:** `generateBinary()` in expressions.ts checks `isLiteralExpression(right)` but does NOT check if the identifier is a resolvable constant. Only `generateIdentifier()` has const-inline logic.

### Gap 2: Default Globals at Relative Offset 0 Overlap with SFA Locals

**Current Behavior:** `allocateRamGlobals()` assigns offsets 0, 1, 2... which are used as literal addresses. starX gets address 8, which overlaps with SFA locals allocated at $08+.

**Required Behavior:** Default globals should be allocated through ZpPool so they get real ZP addresses that don't conflict with SFA locals. OR const globals should be skipped entirely (no address needed).

**Root Cause:** `allocateRamGlobals()` was designed as a stub with "will be rebased during codegen" — but rebasing was never implemented. For ZP-eligible globals, routing through ZpPool is the correct fix.

### Gap 3: Const Globals Waste Memory

**Current Behavior:** `const SCREEN_WIDTH: byte = 40` gets allocated a global slot with an address, even though its value is always known at compile time.

**Required Behavior:** Const globals with literal initializers should not be allocated any runtime memory. They should be purely compile-time values.

**Root Cause:** `collectGlobals()` collects ALL VariableDecls without distinguishing const-with-literal-initializer from mutable variables.
