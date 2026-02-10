# Current State: Confirmed Bugs & Root Cause Analysis

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Bug 1: False "unused variable 'i'" Warning

**Trigger:** `poke(SPRITE_DATA_ADDR + i, spriteData[i])` inside for-loop in sprite-test.blend
**Error:** `warning: Variable 'i' is declared but never used`

**Root Cause:** The `UsageWalker` class in `advanced-analyzer.ts` only changes `currentScope`
when entering `visitFunctionDecl`. It does NOT enter child scopes for any of these 7 constructs:

| Construct | Type-Checker enters scope? | UsageWalker enters scope? | Status |
|-----------|---------------------------|--------------------------|--------|
| Function decl | ✅ `enterScope('function:name')` | ✅ `visitFunctionDecl` | OK |
| For loop | ✅ `enterChildScopeForNode` | ❌ Never enters | **BUG** |
| While loop | ✅ `enterChildScopeForNode` | ❌ Never enters | **BUG** |
| Do-while loop | ✅ `enterChildScopeForNode` | ❌ Never enters | **BUG** |
| If-then branch | ✅ `enterChildScopeByNodeIndex(0)` | ❌ Never enters | **BUG** |
| If-else branch | ✅ `enterChildScopeByNodeIndex(1)` | ❌ Never enters | **BUG** |
| Switch/match | ✅ `enterChildScopeForNode` | ❌ Never enters | **BUG** |
| Block statement | ✅ `enterChildScopeForNode` | ❌ Never enters | **BUG** |

**Impact:** `lookupInChain` only walks UP parent chain, never into child scopes. So any variable
declared in a nested scope (for/while/if/block) will never have `recordRead` called → false "unused".

**Files:**
- `packages/compiler/src/semantic/analysis/advanced-analyzer.ts` (UsageWalker class)
- `packages/compiler/src/semantic/scope.ts` (lookupInChain function)

---

## Bug 2: "Expected address operand at index 0, got undefined"

**Trigger:** `poke(SPRITE_DATA_ADDR + i, spriteData[i])` — dynamic address in poke
**Error:** `Internal compiler error: Expected address operand at index 0, got undefined`

**Root Cause:** Two-part failure:

1. **IL Generator** (`expressions.ts:985-1000`): `tryResolveConstantAddress` returns `undefined`
   for `SPRITE_DATA_ADDR + i` (not a compile-time constant). Falls into dynamic path which
   emits `POKE` with empty operands `[]`.

2. **Codegen** (`intrinsics.ts:genPoke`): ALWAYS calls `getAddressOperand(instr.operands)`
   expecting an address operand at index 0. No fallback for dynamic-address POKE.

**Files:**
- `packages/compiler/src/il/generator/expressions.ts` (generatePokeIntrinsic)
- `packages/compiler/src/codegen/generator/intrinsics.ts` (genPoke, genPeek, genPokew, genPeekw)
- `packages/compiler/src/codegen/generator/base.ts` (getAddressOperand)

---

## Bug 3: Inlined Function Not Removed

**Trigger:** `delay()` inlined into `main()` at -O3 but standalone `delay:` still in output
**Error:** Dead code (inlined function body) remains in assembly output

**Root Cause:** Pass ordering in `options.ts`:
```
O3: ['dead-function-elim', 'dead-global-elim', 'function-inline']
```
1. DFE runs FIRST → removes `speedy()`, keeps `delay()` (still called)
2. Inlining runs AFTER → inlines `delay()` into `main()`, but `delay()` now has 0 call sites
3. No second DFE run → `delay()` body stays forever

The inlining pass documents this assumption on line 24 and line 252:
`"Dead function elimination will clean up fully-inlined functions"` but DFE already ran.

**Files:**
- `packages/compiler/src/optimizer/passes/function-inlining.ts`
- `packages/compiler/src/optimizer/options.ts`

---

## Bug 4: `color += 1` Missing From Assembly

**Trigger:** `color += 1;` in border-cycle main while-loop
**Error:** No INC or ADC instruction in assembly output for compound assignment

**Root Cause:** Needs investigation. Either:
- Codegen not generating compound assignment correctly
- Optimizer (DCE or constant-prop) removing the increment
- Inlining disrupting the instruction sequence

**Assembly evidence:** Between the inlined delay's `._inline_delay_0_cont` label and the
`CMP #$0F` comparison, there should be `INC $02` or `LDA $02; CLC; ADC #$01; STA $02`.
Neither appears.

---

## Bug 5: `color = 0` Stores Wrong Value

**Trigger:** `if (color > 15) { color = 0; }` in border-cycle
**Error:** `STA $02` without preceding `LDA #$00` — stores whatever A contains, not 0

**Root Cause:** Needs investigation. The codegen should emit `LDA #$00; STA $02` for
`color = 0`. Either:
- Codegen assumes A already contains 0 (wrong)
- Optimizer removed the `LDA #$00` as "dead" (wrong — it's needed)
- Accumulator state tracking is incorrect after the inlined delay code

---

## Bug 6: Inlined Loop Counters Don't Re-Initialize

**Trigger:** `delay()` inlined into `main()`'s while(true) loop
**Error:** `_outer = start` does `STA $03` using stale A value instead of loading 0 first

**Root Cause:** The inlining pass clones the delay function body and inserts it into the
while loop. But the initialization `LDA #$00` for the outer loop counter appears ONCE at
the top of `main()` (before the while loop), not inside the while loop where it needs to
execute on every iteration. The optimizer may have hoisted the constant load out of the loop.

**Assembly evidence:**
```asm
main:
  LDA #$00         ; initialization (runs once)
  STA $02          ; color = 0
  LDA #$00         ; inlined delay init (runs once, should be inside loop)
  LDA #$01         ; ??? 
  LDA #$00         ; ???
.while0
  LDA $02          ; load color
  STA $D020        ; poke border
  STA $03          ; _outer = A (BUG: A = color, not 0!)
```
