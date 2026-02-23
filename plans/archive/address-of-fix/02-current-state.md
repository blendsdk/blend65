# Current State: Address-Of Operator Fix

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The `@` address-of operator was added in commit `e93d63f` with these components:

1. **IL Enum** (`il/enums.ts`): `LOAD_ADDRESS` opcode defined
2. **IL Builder** (`il/builder/memory.ts`): `loadAddress(slot, comment)` method
3. **IL Builder Base** (`il/builder/base.ts`): Cost entry in `BASE_COST_TABLE`
4. **IL Generator** (`il/generator/expressions.ts`): `generateAddressOf()` method
5. **Codegen** (`codegen/generator/memory.ts`): `genLoadAddress()` + dispatch case

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `il/generator/expressions.ts` | `generateAddressOf()` — emits LOAD_ADDRESS | Likely fix here — tryResolveVariable may fail |
| `il/generator/base.ts` | `tryResolveVariable()` — variable resolution | May need fix for @sprite const lookup |
| `codegen/generator/memory.ts` | `genLoadAddress()` — produces LDA #<label | Verified correct — no changes needed |
| `optimizer/passes/cse/cse.ts` | CSE pass — `modifiesAccumulator` | Must add LOAD_ADDRESS |
| `optimizer/passes/constant-prop.ts` | Constant propagation | Must handle LOAD_ADDRESS |
| `optimizer/passes/copy-prop.ts` | Copy propagation | Must handle LOAD_ADDRESS |
| `optimizer/passes/dce.ts` | Dead code elimination | Must handle LOAD_ADDRESS |
| `optimizer/passes/dead-global-elim.ts` | Dead global elimination | Must handle LOAD_ADDRESS |
| `optimizer/passes/constant-fold.ts` | Constant folding | Must handle LOAD_ADDRESS |
| `optimizer/passes/il-peephole.ts` | IL peephole optimizer | Must handle LOAD_ADDRESS |
| `optimizer/passes/licm/invariance.ts` | LICM invariance | Must handle LOAD_ADDRESS |
| `optimizer/passes/function-inlining.ts` | Function inlining | Review for LOAD_ADDRESS |

## Code Analysis

### The Broken Code Path

```
Expression: hi(@balloonData) * 4

1. generateCall('hi', [UnaryExpr(@, Ident('balloonData'))])
2. → generateIntrinsic('hi', args)
3. → generateExpression(args[0])  // args[0] = UnaryExpr(AT, Ident)
4. → generateUnary(expr)
5. → op === TokenType.AT → generateAddressOf(expr)
6. → tryResolveVariable('balloonData') → ??? (may return undefined)
7. → If undefined: NOP emitted (address-of fails silently!)
```

### Generated Assembly (BROKEN)

```asm
; load balloonData                        ← comment from generateIdentifier, NOT generateAddressOf!
  LDA __data_BalloonSprite_balloonData    ← LOAD_BYTE, not LOAD_ADDRESS
; hi(value)
  TXA                                     ← X never set → garbage
```

### Expected Assembly (CORRECT)

```asm
; @balloonData                            ← comment from generateAddressOf
  LDA #<__data_BalloonSprite_balloonData  ← low byte of address (immediate)
  LDX #>__data_BalloonSprite_balloonData  ← high byte of address (immediate)
; hi(value)
  TXA                                     ← correctly gets high byte from X
```

## Gaps Identified

### Gap 1: LOAD_ADDRESS Not Emitted

**Current Behavior:** `generateAddressOf()` silently falls back to NOP when `tryResolveVariable()` returns undefined for `@sprite const` data variables.
**Required Behavior:** `LOAD_ADDRESS` IL opcode must be emitted with the variable's FrameSlot.
**Fix Required:** Debug why `tryResolveVariable('balloonData')` fails in the address-of context, then fix the resolution.

### Gap 2: Optimizer Has Zero LOAD_ADDRESS Awareness

**Current Behavior:** All optimizer passes have zero references to `LOAD_ADDRESS`. The opcode is completely unknown to the optimizer.
**Required Behavior:** Optimizer passes must recognize `LOAD_ADDRESS` as:
- Modifying accumulator (A and X registers)
- Not eligible for constant propagation replacement
- Not eligible for copy propagation
- Recognized by DCE as having side effects (register writes)
**Fix Required:** Add `LOAD_ADDRESS` to relevant opcode lists in each optimizer pass.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| tryResolveVariable is the root cause | High | High | IL dump script will confirm |
| Optimizer corrupts LOAD_ADDRESS | Medium | High | Add explicit awareness to all passes |
| Fix breaks existing tests | Low | Medium | Run full test suite after each change |
| ACME !align produces wrong alignment | Low | Low | Already verified correct syntax |
