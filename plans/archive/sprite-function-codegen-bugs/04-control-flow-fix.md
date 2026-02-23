# Control Flow Fix: Bug #3 (For-Loop Byte Overflow at 255)

> **Document**: 04-control-flow-fix.md
> **Parent**: [Index](00-index.md)

## Overview

When a byte-typed for-loop has an upper bound of 255, the compiler generates
`CMP #(255+1)` = `CMP #256` which overflows an 8-bit immediate operand.
This produces invalid assembly or incorrect loop behavior.

**Location**: `generateForCondition()` in `packages/compiler/src/il/generator/control-flow.ts`

## Current Architecture

### Normal Ascending Loop (end < 255)

```
for (let i: byte = 0 to 10)
```

Generates:
```asm
loop_header:
    LDA i
    CMP #11        ; end + 1 = 11, fits in byte ✓
    BCS loop_exit  ; if i >= 11 (i.e., i > 10), exit
    ; ... loop body ...
    INC i
    JMP loop_header
loop_exit:
```

This is correct and efficient — `CMP #(end+1)` followed by `BCS` exits when `i > end`.

### Broken Case (end = 255)

```
for (let i: byte = 0 to 255)
```

Generates:
```asm
loop_header:
    LDA i
    CMP #256       ; 255 + 1 = 256 — OVERFLOWS 8-bit! ✗
    BCS loop_exit
    ; ... loop body ...
    INC i
    JMP loop_header
loop_exit:
```

`CMP #256` truncates to `CMP #$00`, causing the loop to exit immediately (since any
non-zero value >= 0 in unsigned comparison).

## Proposed Fix

### Strategy: Use Wrap-Around Pattern for end=255

When `constEnd === 255` for a byte counter, restructure the loop to use the 6502
wrap-around behavior: incrementing 255 wraps to 0, and we detect this with `BNE`.

**Target assembly for `for (let i: byte = 0 to 255)`**:
```asm
loop_header:
    ; ... loop body ...
    INC i          ; increment counter
    BNE loop_header ; if i != 0 (didn't wrap), continue
loop_exit:         ; i wrapped from 255→0, loop complete
```

Wait — this executes the body before checking, so it's a do-while structure. But the
for-loop should execute 256 iterations starting from 0. Let's think more carefully:

**Correct pattern**:
```asm
    LDA #0
    STA i          ; i = 0
loop_header:
    ; ... loop body (executes with i = 0, 1, 2, ..., 255) ...
    INC i          ; i++
    BNE loop_header ; if i didn't wrap to 0, loop again
loop_exit:         ; i wrapped 255→0, all 256 iterations done
```

This is a standard 6502 idiom for "loop 256 times with a byte counter".

### Implementation

In `generateForCondition()`, add a special case:

```typescript
if (isAscending) {
    if (isWord) {
        this.builder.cmpWordImm(constEnd + 1, `cmp word with end+1`);
        this.builder.jumpGe(exitLabel, 'exit if i > end');
    } else if (constEnd === 255) {
        // Special case: byte counter with end=255
        // Can't use CMP #256 (overflows). Instead, the loop structure
        // changes: increment first, then BNE back to header.
        // The exit condition is "counter wrapped to 0".
        // This is handled by restructuring the loop in generateForStatement().
        this.generateByteLoop255Exit(counterSlot, exitLabel);
    } else {
        this.builder.cmpImm(constEnd + 1, `cmp with end+1`);
        this.builder.jumpGe(exitLabel, 'exit if i > end');
    }
}
```

The `generateByteLoop255Exit()` method emits:
```typescript
protected generateByteLoop255Exit(counterSlot: Slot, exitLabel: string): void {
    // After incrementing the counter (done in the loop update),
    // check if it wrapped to 0
    // INC counter / BEQ exit (or: LDA counter / BEQ exit)
    this.builder.loadSlot(counterSlot, 'load counter for wrap check');
    this.builder.jumpEq(exitLabel, 'exit if counter wrapped to 0');
}
```

**Important**: The loop structure may need adjustment. Currently for-loops are structured as:

```
header:
    condition check → exit if done
    body
    update (increment)
    JMP header
exit:
```

For the end=255 case, the structure should be:

```
header:
    body
    update (increment)
    condition: if counter != 0, JMP header
exit:
```

This means the condition check moves AFTER the update. The `generateForStatement()`
method may need restructuring for this case.

### Alternative: Simpler Approach

A simpler fix that avoids restructuring: use a temporary flag or check differently.

**Option: Post-increment check**:
```asm
loop_header:
    ; ... body ...
    LDA i
    CMP #255       ; are we at the last iteration?
    BEQ loop_exit  ; if so, exit BEFORE incrementing
    INC i
    JMP loop_header
loop_exit:
```

This avoids the wrap-around issue entirely. The loop runs i = 0, 1, ..., 255 and
exits when i reaches 255 (before incrementing to 256/0).

**Tradeoff**: Adds a CMP+BEQ before the INC on every iteration. But it's simpler
to implement because it doesn't require restructuring the loop.

### Recommended Approach

Use the **post-increment check** (simpler approach) for the initial fix:

```typescript
if (constEnd === 255 && !isWord) {
    // Special case: byte loop ending at 255
    // Instead of CMP #256 (overflow), check CMP #255 before increment
    // and branch to exit. The increment is skipped on last iteration.
    this.builder.cmpImm(255, 'check if at last iteration (255)');
    this.builder.jumpEq(exitLabel, 'exit at 255 (avoid overflow)');
}
```

But this needs to be placed at the RIGHT point in the loop — after the body but
before the increment. The exact integration with `generateForStatement()` needs
careful analysis during implementation.

## Edge Cases

| Case | Expected Behavior | Risk |
|------|------------------|------|
| `for i = 0 to 254` | Normal: `CMP #255`, BCS | No change needed |
| `for i = 0 to 255` | Special: wrap-around or pre-exit check | **This fix** |
| `for i = 0 to 0` | Single iteration | Must still work |
| `for i = 100 to 255` | Same overflow issue | Must also be fixed |
| `for i: word = 0 to 255` | Word loop, no overflow | Unchanged (word CMP) |
| `for i: word = 0 to 65535` | Same issue but 16-bit | Out of scope for now |

## Testing Requirements

- Test `for (let i: byte = 0 to 255)` compiles and generates valid assembly
- Test `for (let i: byte = 100 to 255)` also works
- Test `for (let i: byte = 0 to 254)` unchanged (regression)
- Test `for (let i: byte = 0 to 0)` edge case
- Verify no ACME assembler errors with the generated code
- Verify the loop actually executes the correct number of iterations (if possible via analysis)
