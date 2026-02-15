# Blend65 Compiler Bug Catalog — Spinning Line Analysis

> **Date**: 2025-02-15
> **Source**: `examples/spinning-line/main.blend`
> **Method**: Compiled at O0, O1, O2, O3, Os, Oz — each ASM file manually analyzed
> **Files**: `build/spinning-line-O{0,1,2,3,s,z}.asm`

---

## Summary

| Level | Lines | Status |
|-------|-------|--------|
| O0    | 207   | Compiles, 3 core bugs → broken runtime |
| O1    | 243   | Compiles, 3 core bugs + inlining leaves dead code |
| O2    | 347   | Compiles, 3 core bugs + corrupted loop unrolling + ghost instructions |
| O3    | 626   | Compiles, 3 core bugs + catastrophic unrolling + duplicate labels (won't assemble!) |
| Os    | 206   | Same as O0 (no size optimizations applied) |
| Oz    | 206   | Same as O0 |

**Total unique bugs found: 12**

---

## Category 1: Core Codegen Bugs (ALL optimization levels)

### Bug C1: Missing multi-argument passing

**Severity**: 🔴 CRITICAL
**Present in**: O0, O1, O2, O3, Os, Oz (ALL)

`generateCallArguments()` in `il/generator/expressions.ts` only handles `args[0]`.
Second and subsequent arguments are completely ignored — never stored to their
parameter slots before the function call.

**Example**: `getSpriteFrame(@lineFrames, frame)` — the second arg `frame` is never passed.

**ASM evidence** (all levels):
```asm
; Only A:X loaded with first arg (spriteAddr), no code for frameIndex:
  LDA #<__data_SpinningLine_lineFrames
  LDX #>__data_SpinningLine_lineFrames
  JSR getSpriteFrame
```

**Expected**: Before the JSR, the second argument should be stored to frameIndex's slot.

**Root cause**: `generateCallArguments()` method at line ~590 of `expressions.ts`:
```typescript
protected generateCallArguments(funcName: string, args: Expression[]): void {
    if (args.length === 0) return;
    this.generateExpression(args[0]);
    // ... promotion logic for first param only
    // MISSING: args[1], args[2], etc. are never processed!
}
```

---

### Bug C2: Constant identifier not resolved in if-condition comparison

**Severity**: 🔴 CRITICAL
**Present in**: O0, O1, O2, O3, Os, Oz (ALL)

When `if (frame == NUM_FRAMES)` is compiled, the condition handler
(`generateConditionWithBranch()` in `control-flow.ts`) resolves the right-hand
identifier `NUM_FRAMES` via `tryResolveVariable()` which returns a slot with
address `$FFFF` instead of recognizing it as a compile-time constant with value 4.

**ASM evidence** (all levels):
```asm
; compare
  CMP $FFFF       ; ← WRONG! Should be CMP #$04
; skip if not equal
  BNE .else7
```

`CMP $FFFF` reads from memory address $FFFF (ROM area on C64) instead of
comparing with the immediate value 4. Frame never equals whatever is at $FFFF,
so the reset `frame = 0` never executes — frame wraps 0→255 endlessly.

**Expected**: `CMP #$04` (immediate comparison with const value)

**Root cause**: `generateConditionWithBranch()` checks for literal right operands
and slot right operands, but NEVER checks for constant identifiers (like
`tryResolveConstantIdentifier()` does in `generateBinary()`). The constant
resolution path is missing from the condition handler.

---

### Bug C3: Function reads wrong ZP address for second parameter

**Severity**: 🔴 CRITICAL (consequence of C1)
**Present in**: O0, O1, O2, O3, Os, Oz (ALL)

Inside `getSpriteFrame()`, the `lo()` result is added via `ADC $02` — reading
from zero-page address $02 which is the C64 processor I/O direction register,
NOT the `frameIndex` parameter.

**ASM evidence**:
```asm
; lo(value)
  CLC
  ADC $02        ; ← Reads from ZP $02 (processor port!) not frameIndex
; return value
  RTS
```

The frame allocator assigned `frameIndex` to slot address $02, but since
the caller never stores the argument there (Bug C1), $02 contains whatever
the C64 boot sequence left there (typically $37 or $FF).

**Impact**: `getSpriteFrame()` always returns the same value regardless of
which frame is requested. The sprite never visually changes.

---

## Category 2: Inlining Bugs (O1, O2, O3)

### Bug I1: Inlined functions still emitted as dead code

**Severity**: 🟡 MEDIUM
**Present in**: O1, O2, O3

When a function is inlined at all call sites, the original function body is
still emitted in the assembly output. On a memory-constrained C64 (64KB total),
this wastes precious bytes.

**ASM evidence** (O1 — delay inlined but original still present):
```asm
; In main: [inlined from delay] ... (correct, inlined code)
; ...
; ALSO emitted:
delay:                  ; ← Dead code! Never called.
  LDA #$00
  STA $04
  ...
  RTS
```

**Expected**: When a function is fully inlined at all call sites, the original
function body should be eliminated (dead function elimination).

---

### Bug I2: Redundant JMP to next instruction after inline return

**Severity**: 🟢 LOW (wastes 3 bytes per inline site)
**Present in**: O1, O2, O3

Inlined `return` statements generate a `JMP ._inline_XXX_cont` immediately
before the continuation label, which is the very next instruction.

**ASM evidence**:
```asm
; [inlined return → jump to continuation]
  JMP ._inline_delay_0_cont      ; ← 3-byte JMP to next line
._inline_delay_0_cont             ; ← literally the next instruction
```

**Expected**: The JMP should be elided when the continuation label immediately
follows (peephole: `JMP label` where label is next instruction → NOP).

---

### Bug I3: Ghost instructions after getSpriteFrame inline

**Severity**: 🟠 HIGH (corrupts accumulator)
**Present in**: O2, O3

After the first `getSpriteFrame` inline (the initial setup before the while
loop), there are orphan `CLC; ADC $02` instructions that appear between the
`STA $06` (let frame = 0) and the `.while5` label.

**ASM evidence** (O2, O3):
```asm
; let frame
  STA $06
  CLC                ; ← Ghost instruction! From where?
  ADC $02            ; ← Ghost instruction! Corrupts A
.while5
```

These instructions execute but their result is overwritten by the next
load — so they're "harmless" in this case but indicate a serious inlining
bug that could corrupt results in other programs.

**Root cause**: Likely a second-argument generation that fires too late
(after the inline has already completed), or duplicate IL instructions
from the inline expansion.

---

### Bug I4: Missing CLC in second getSpriteFrame inline

**Severity**: 🟠 HIGH (wrong arithmetic result)
**Present in**: O2, O3

The second inline of `getSpriteFrame` (inside the while loop) drops the `CLC`
instruction before the `ADC` in the `lo()` intrinsic. The comment is present
but the instruction is optimized away.

**ASM evidence** (O2):
```asm
; [inlined from getSpriteFrame] lo(value)
; ← MISSING: CLC should be here!
; [inlined return] ...
  JMP ._inline_getSpriteFrame_1_cont
```

Without `CLC`, the `ADC` may add with carry from a previous operation,
producing an off-by-one (or more) error in the sprite pointer.

**Root cause**: An optimizer pass is removing the CLC, probably because it
doesn't understand that the carry flag is significant before ADC.

---

## Category 3: Loop Optimization Bugs (O2, O3)

### Bug L1: Corrupted loop unrolling — triple increment per iteration

**Severity**: 🔴 CRITICAL
**Present in**: O2 (delay function body), O3 (delay function body)

The inner loop `for (_j = 0 to 255)` is partially unrolled but produces
3 increments per logical iteration instead of 1:

**ASM evidence** (O2 delay function):
```asm
._inline_delay_2_for2             ; or .for2 in dead code
; barrier()
.for_cont4
; barrier()                        ; ← duplicate barrier
.for_cont4                         ; ← duplicate label
; check _j before increment
  LDA $05
  CMP #$FF
; _j++
  INC $05                          ; ← increment 1
; _j++
  INC $05                          ; ← increment 2 (WRONG!)
; check _j before increment
; exit threshold (256 - step)
  CMP #$FF                         ; ← stale flags (from OLD CMP)
  BCS .endfor3
; _j++
  INC $05                          ; ← increment 3 (WRONG!)
  JMP .for2
```

**Impact**: Loop counter jumps by 3 each iteration (0, 3, 6, 9...) instead
of by 1. Only ~85 iterations instead of 256. Delay is ~3x shorter than intended.

The `BCS` check also uses stale flags — the CMP #$FF result is from the first
check, but `INC $05` (which modifies N/Z flags) executes between the CMP and BCS.

---

### Bug L2: Duplicate labels from outer loop unrolling

**Severity**: 🔴 CRITICAL (assembly won't assemble!)
**Present in**: O3

The outer for loop (i=0 to 5) is unrolled 6 times in O3. Each unrolled
copy reuses the same labels (`.for2`, `.for_cont4`, `.endfor3`).

**ASM evidence** (O3 delay function — labels appear 6+ times):
```asm
.for2         ; ← first occurrence
; ...
.for2         ; ← DUPLICATE! ACME will error
; ...
.for2         ; ← TRIPLE! 
```

**Impact**: The ACME assembler will refuse to assemble this code (duplicate
label error), OR silently use the last definition, causing all `JMP .for2`
instructions to jump to the wrong location (last copy only).

---

### Bug L3: Outer loop unrolled without exit conditions

**Severity**: 🟠 HIGH
**Present in**: O3

The outer loop `for (_i = 0 to 5)` is unrolled into 6 sequential copies,
but the exit conditions (`CMP #$06; BCS .endfor1`) are removed. The `CMP #$06`
appears but has no following branch — the result is ignored.

**ASM evidence** (O3):
```asm
; load _i (propagated constant)
  LDA #$00
; cmp with end+1
  CMP #$06          ; ← result ignored! No BCS follows
; _j = start
  STA $05           ; ← falls straight through into inner loop
```

**Impact**: In this specific case, the 6 unrolled copies are exactly the right
number of iterations, so the behavior is accidentally correct. But the missing
exit branch means the unroller isn't correctly preserving loop semantics.

---

## Category 4: Optimizer Correctness Issues (O2, O3)

### Bug O1: barrier() intrinsic not respected by loop unroller

**Severity**: 🔴 CRITICAL
**Present in**: O2, O3

The `barrier()` intrinsic is documented to prevent optimization across its
boundary. However, the loop unroller ignores `barrier()` and merges multiple
iterations containing it.

**ASM evidence** (O2 — barriers duplicated/merged):
```asm
; barrier()
.for_cont4
; barrier()            ; ← second barrier merged into same unrolled block
.for_cont4
```

**Expected**: `barrier()` should prevent the unroller from combining loop
iterations. The loop body is `{ barrier(); }` — the optimizer should leave
this loop completely alone.

---

### Bug O2: INC clobbers CPU flags used by subsequent BCS

**Severity**: 🔴 CRITICAL
**Present in**: O2, O3

In the unrolled loop, `INC $05` executes between `CMP #$FF` and `BCS .endfor3`.
The `INC` instruction modifies the N and Z flags, overwriting the flags set by
CMP. The `BCS` then checks the carry flag from CMP (which INC doesn't affect
on 6502), so BCS still works correctly — BUT the intervening code suggests the
optimizer doesn't understand 6502 flag semantics and is reordering dangerously.

**ASM evidence**:
```asm
  CMP #$FF                ; sets C, N, Z flags
; _j++
  INC $05                  ; modifies N, Z (not C)
; _j++
  INC $05                  ; modifies N, Z (not C) 
; exit threshold
  CMP #$FF                 ; ← this CMP uses CURRENT A, not the value after INC!
  BCS .endfor3             ; uses flags from second CMP, not first
```

The second `CMP #$FF` compares the OLD value of A (loaded before the INCs)
against $FF. But `_j` has already been incremented twice, so the check is
testing a stale value. The exit condition is wrong.

---

## Cross-Level Bug Matrix

| Bug ID | Description | O0 | O1 | O2 | O3 | Os | Oz |
|--------|-------------|:--:|:--:|:--:|:--:|:--:|:--:|
| **C1** | Missing multi-arg passing | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **C2** | Const not resolved in if-condition | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **C3** | ADC reads wrong ZP (consequence of C1) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **I1** | Inlined functions not removed | — | ✗ | ✗ | ✗ | — | — |
| **I2** | Redundant JMP to next instruction | — | ✗ | ✗ | ✗ | — | — |
| **I3** | Ghost instructions after inline | — | — | ✗ | ✗ | — | — |
| **I4** | Missing CLC in inlined code | — | — | ✗ | ✗ | — | — |
| **L1** | Triple increment (corrupted unroll) | — | — | ✗ | ✗ | — | — |
| **L2** | Duplicate labels from unrolling | — | — | — | ✗ | — | — |
| **L3** | Outer loop unrolled without exits | — | — | — | ✗ | — | — |
| **O1** | barrier() not respected by unroller | — | — | ✗ | ✗ | — | — |
| **O2** | Stale CMP in reordered code | — | — | ✗ | ✗ | — | — |

**Legend**: ✗ = bug present, — = not applicable

---

## Priority Order for Fixes

### P0 — Core (fix first, affects ALL levels)
1. **C1**: Multi-argument passing
2. **C2**: Constant resolution in conditions
3. **C3**: Resolves automatically when C1 is fixed

### P1 — Optimizer Correctness (fix second, O2/O3 produce wrong code)
4. **O1**: barrier() must block loop unrolling
5. **L1**: Loop unrolling logic is fundamentally broken
6. **O2**: Flag-aware instruction reordering

### P2 — Inlining Correctness (fix third)
7. **I3**: Ghost instructions from inlining
8. **I4**: CLC dropped by optimizer
9. **I1**: Dead function elimination after inlining

### P3 — Code Quality (fix last)
10. **I2**: Redundant JMP elimination
11. **L2**: Unique label generation for unrolled loops
12. **L3**: Exit condition preservation in unrolling
