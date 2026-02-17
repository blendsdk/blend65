# ASM-IL Optimizer Enhancements: Items G, H, I

> **Document**: 06-asm-il-optimizer.md
> **Parent**: [Index](00-index.md)
> **Scope**: Three new optimizer pass enhancements for ASM-level code quality
> **Files**: `packages/compiler/src/optimizer/passes/il-peephole.ts`, new files in `packages/compiler/src/optimizer/passes/`

## Overview

Items G, H, and I address code quality — the compiler produces **correct** code but with unnecessary instructions, wasted cycles, and suboptimal patterns. These are optimizer enhancements that improve output size and performance without changing semantics.

All three items operate at the ASM-IL or IL peephole level and should be implemented as new optimizer pass rules or extensions to existing passes.

---

## Item G: Peephole Optimizer Rule Enhancements

### Patterns to Detect and Eliminate

#### G.1: Store-Reload Elimination

**Pattern**: Store a value to memory, then immediately reload it into the same register without any intervening instruction that modifies the memory or register.

```asm
; BEFORE (redundant):
  STA $07       ; store to slot
  LDA $07       ; reload same slot — A still has the value!

; AFTER (optimized):
  STA $07       ; store to slot (LDA eliminated)
```

**Safety conditions**:
- No instruction between STA and LDA that writes to $07
- No instruction between STA and LDA that reads from $07 through a different path
- The LDA doesn't set flags needed by a subsequent instruction (STA doesn't set flags, but LDA does — if the next instruction checks Z/N flags, we need to preserve the LDA for its flag-setting side effect)

**Implementation**: Add a peephole rule that scans for `STA addr` followed by `LDA addr` with no intervening writes to `addr` or modifications of A.

#### G.2: Dead Jump Elimination

**Pattern**: A `JMP` instruction whose target is the very next instruction.

```asm
; BEFORE (redundant):
  JMP .label
.label:

; AFTER (optimized):
.label:           ; JMP eliminated — control falls through naturally
```

**Safety conditions**:
- The JMP target label must be the immediately next emitted instruction
- No other instruction jumps to a label between the JMP and the target (i.e., the JMP isn't used as a landing pad)

**Implementation**: After all code emission, scan for `JMP label` where `label:` is the next line. Remove the JMP.

#### G.3: PHA/PLA Pair Elimination

**Pattern**: Consecutive `PHA` followed by `PLA` with no intervening stack operations.

```asm
; BEFORE (redundant):
  PHA           ; push A to stack
  PLA           ; immediately pop back — A unchanged!

; AFTER (optimized):
  ; (both removed — A was never modified between push/pop)
```

**Safety conditions**:
- No instruction between PHA and PLA that uses the stack (JSR, RTS, PHA, PLA, PHP, PLP)
- No instruction between PHA and PLA that modifies A (the PLA would restore the original value, which is what PHA pushed — but if A was modified, the PLA restores the pre-modification value, which is intentional)
- **IMPORTANT**: Only eliminate when the PHA/PLA are truly redundant (no other stack or A modifications between them)

**Implementation**: Scan for `PHA` followed by `PLA` with only register-neutral instructions between them.

#### G.4: Redundant Register Load Elimination

**Pattern**: Loading a value into A when A already contains that value.

```asm
; BEFORE (redundant):
  LDA #$00       ; Load 0 into A
  STA $06        ; Store it
  LDA #$00       ; A already contains 0!

; AFTER (optimized):
  LDA #$00
  STA $06        ; Second LDA eliminated
```

**Safety conditions**:
- No instruction between first LDA and second LDA that modifies A
- Both LDA instructions load the exact same value (same immediate or same address)
- STA does NOT modify A (it doesn't on 6502)

**Implementation**: Track the "last loaded value" in A. When a subsequent LDA loads the same value and A hasn't been modified, eliminate the second LDA.

### Architecture

These rules should be added to the existing `il-peephole.ts` pass or as a new ASM-level peephole pass that runs after codegen:

```
IL → IL Optimizer (existing) → Codegen → ASM Peephole (NEW) → ACME Emission
```

**If implementing at IL level**: Rules G.1-G.4 map to IL opcodes (STORE_SLOT/LOAD_SLOT, JUMP, PUSH_A/POP_A, LOAD_IMM). The existing `il-peephole.ts` can be extended.

**If implementing at ASM level**: A new pass that operates on the emitted assembly text or ASM-IL intermediate representation.

**Recommendation**: Implement at IL level first (extend `il-peephole.ts`), since IL-level patterns are easier to match and the optimizer already has infrastructure for this.

### Files Changed

| File | Change |
|------|--------|
| `optimizer/passes/il-peephole.ts` | Add rules for store-reload, dead jump, PHA/PLA pair, redundant load |
| OR `optimizer/passes/asm-peephole.ts` | **NEW** — ASM-level peephole pass (if IL-level is insufficient) |

---

## Item H: Loop Canonicalization

### Problem

Delay loops (e.g., `while (barrier()) { counter += 1; if (counter == limit) break; }`) use generic loop codegen:

```asm
; Current: generic loop structure (10+ bytes per loop)
.loop:
  LDA $05        ; load counter
  CMP #$FF       ; compare
  BCS .exit      ; exit if done
  INC $05        ; increment
  JMP .loop      ; loop back
.exit:
```

The canonical 6502 delay loop is:

```asm
; Canonical: 2-4 bytes per loop level
  LDX #count
.loop:
  DEX
  BNE .loop
```

### Detection Criteria

A loop is a candidate for canonicalization when:
1. The loop body contains **only** `barrier()` calls (optimization barriers)
2. The loop has a simple counted pattern (increment + compare + exit)
3. The iteration count fits in a byte (0-255)
4. No side effects other than the barrier

### Implementation

**Phase 1: Detection** — Analyze IL loop structure to identify delay loop pattern
**Phase 2: Replacement** — Replace the entire loop body with canonical DEX/BNE or DEY/BNE

```typescript
// Pseudo-code for delay loop detection:
function isDelayLoop(loop: ILLoop): boolean {
  const body = getLoopBody(loop);
  // Body should contain: BARRIER, counter increment, compare, conditional jump
  // No POKE, PEEK, CALL, STORE (other than counter)
  return body.every(instr => 
    instr.opcode === ILOpcode.BARRIER ||
    instr.opcode === ILOpcode.INC_BYTE ||
    instr.opcode === ILOpcode.CMP_IMM ||
    instr.opcode === ILOpcode.JUMP_GE ||
    instr.opcode === ILOpcode.LOAD_BYTE
  );
}
```

### Files Changed

| File | Change |
|------|--------|
| `optimizer/passes/loop-canonicalize.ts` | **NEW** — Delay loop detection and DEX/BNE rewrite |
| `optimizer/pass-manager.ts` | Register new pass |
| `optimizer/options.ts` | Add pass to appropriate optimization levels |

### Regression Risk

**Low.** This is a new optimization that only fires for a very specific pattern (delay loops with only barriers). If detection is wrong, the loop remains unchanged (no correctness impact).

---

## Item I: ASM-Level Constant Folding

### Problem

Compile-time constant arithmetic survives to ASM level as runtime instructions:

```asm
; BEFORE: runtime computation of 12 - 1 = 11
  LDA #$0C       ; HELLO_LENGTH = 12
  SEC
  SBC #$01       ; subtract 1
  ; Result: A = 11

; AFTER: compile-time fold
  LDA #$0B       ; HELLO_LENGTH - 1 = 11 (folded at compile time)
```

### Patterns to Fold

| IL Pattern | Folded Result |
|-----------|---------------|
| `LOAD_IMM A / ADD_IMM B` | `LOAD_IMM (A+B)` |
| `LOAD_IMM A / SUB_IMM B` | `LOAD_IMM (A-B)` |
| `LOAD_IMM A / AND_IMM B` | `LOAD_IMM (A&B)` |
| `LOAD_IMM A / OR_IMM B` | `LOAD_IMM (A\|B)` |
| `LOAD_IMM A / XOR_IMM B` | `LOAD_IMM (A^B)` |
| `LOAD_IMM A / SHL N` | `LOAD_IMM (A<<N)` |
| `LOAD_IMM A / SHR N` | `LOAD_IMM (A>>N)` |
| `LOAD_IMM A / CMP_IMM B` | Fold to constant boolean (for dead branch elimination) |

### Implementation

This can be implemented at either IL level or ASM level:

**IL Level** (Preferred): The existing `constant-fold.ts` pass can be extended to detect `LOAD_IMM` followed by an arithmetic immediate instruction and fold them.

```typescript
// In constant-fold.ts or il-peephole.ts:
// Pattern: LOAD_IMM val1, ADD_IMM val2 → LOAD_IMM (val1 + val2)
if (current.opcode === ILOpcode.LOAD_IMM && next.opcode === ILOpcode.ADD_IMM) {
  const val1 = getImmediateValue(current);
  const val2 = getImmediateValue(next);
  replaceWithSingle(ILOpcode.LOAD_IMM, (val1 + val2) & 0xFF);
}
```

**ASM Level**: Scan emitted assembly for `LDA #N / CLC / ADC #M` and replace with `LDA #(N+M)`.

### Interaction with Existing Constant Folding

The existing `constant-fold.ts` pass operates at the expression level during IL generation. Item I's folding is for cases where constants survive past expression-level folding — typically because they come from separate IL instructions (e.g., a constant loaded from a const variable, then operated on with another constant from a different source).

### Files Changed

| File | Change |
|------|--------|
| `optimizer/passes/il-peephole.ts` | Add constant folding rules for LOAD_IMM + arithmetic_IMM sequences |
| OR `optimizer/passes/constant-fold.ts` | Extend existing constant folder with IL instruction-level folding |

### Regression Risk

**Low.** Constant folding is purely semantic-preserving: `(A op B)` replaced by the precomputed result. The only risk is overflow handling — ensure byte folding masks to 0xFF and word folding masks to 0xFFFF.

---

## Implementation Order

1. **Item G** — Peephole rules (immediate impact on code quality at all optimization levels)
2. **Item I** — Constant folding (simple to implement, high impact on code size)
3. **Item H** — Loop canonicalization (more complex detection, narrower applicability)

## Optimization Level Assignment

| Pass | Minimum Level |
|------|--------------|
| G: Store-reload elimination | O1 |
| G: Dead jump elimination | O1 |
| G: PHA/PLA pair elimination | O1 |
| G: Redundant register load | O2 |
| H: Loop canonicalization | Os (size-focused) |
| I: Constant folding (IL-level) | O1 |

## Testing Strategy

See [09-testing-strategy.md](09-testing-strategy.md). Key tests:

| Item | Test | Description |
|------|------|-------------|
| G.1 | STA/LDA same address → LDA removed | Before/after IL comparison |
| G.2 | JMP to next instruction → JMP removed | Before/after ASM comparison |
| G.3 | PHA immediately followed by PLA → both removed | IL output verification |
| G.4 | LDA #N ... LDA #N (A unchanged) → second removed | Register tracking test |
| H | Delay loop → DEX/BNE | Full pattern match + replacement verification |
| I | LDA #12 / SEC / SBC #1 → LDA #11 | Constant fold verification |
| All | No regression at O0 | O0 output unchanged (optimizer doesn't run) |
