# Task 10.6b: SMC Code Examples and Patterns

> **Session**: 5.6b
> **Phase**: 10-smc (Self-Modifying Code)
> **Estimated Time**: 2 hours
> **Tests**: N/A (documentation)
> **Prerequisites**: 10-06a-smc-usage-docs.md

---

## Overview

This document provides **complete code examples** demonstrating SMC patterns in Blend65.

---

## Loop Unrolling Examples

### Screen Clear

```js
// Blend65 source
@smc(prefer)
function clearScreen(): void {
    for (let i: word = 0; i < 1000; i++) {
        poke($0400 + i, 32);
    }
}

// SMC-optimized assembly output:
/*
clearScreen:
    LDA #39             ; Initialize counter (low byte of 999)
    STA clear_loop+1    ; Store in operand
    LDA #$03            ; High byte
    STA clear_loop+2
    
clear_loop:
    LDA #32             ; Space character
    STA $07E7           ; Address modified (starts at end)
    
    ; Decrement 16-bit address
    LDA clear_loop+1
    BNE +
    DEC clear_loop+2
+   DEC clear_loop+1
    
    LDA clear_loop+2
    CMP #$03            ; Check if done
    BCS clear_loop
    LDA clear_loop+1
    CMP #$FF
    BCS clear_loop
    RTS
*/
```

### Sprite Update

```js
// Fast sprite position update
@smc(prefer)
function updateAllSprites(): void {
    for (let i: byte = 0; i < 8; i++) {
        pokeVIC($D000 + i * 2, spriteX[i]);
        pokeVIC($D001 + i * 2, spriteY[i]);
    }
}

// Fully unrolled (8 sprites = small, full unroll beneficial):
/*
updateAllSprites:
    LDA spriteX+0
    STA $D000
    LDA spriteY+0
    STA $D001
    LDA spriteX+1
    STA $D002
    LDA spriteY+1
    STA $D003
    ; ... repeat for all 8 sprites
    RTS
*/
```

---

## Jump Table Examples

### Command Dispatch

```js
// Game command handler
@smc(prefer)
function handleCommand(cmd: byte): void {
    switch (cmd) {
        case 0: moveUp(); break;
        case 1: moveDown(); break;
        case 2: moveLeft(); break;
        case 3: moveRight(); break;
        case 4: fire(); break;
        case 5: jump(); break;
        case 6: duck(); break;
        case 7: interact(); break;
    }
}

// SMC jump table:
/*
cmd_table:
    .word moveUp, moveDown, moveLeft, moveRight
    .word fire, jump, duck, interact

handleCommand:
    LDA cmd
    CMP #8              ; Bounds check
    BCS invalid_cmd
    ASL A               ; *2 for word table
    TAX
    LDA cmd_table,X
    STA jmp_target+1
    LDA cmd_table+1,X
    STA jmp_target+2
jmp_target:
    JMP $0000           ; SMC: target modified
invalid_cmd:
    RTS
*/
```

### State Machine

```js
// Game state machine
let gameState: byte = 0;
const stateHandlers: array<word, 5> = [
    &stateTitle,
    &statePlay,
    &statePause,
    &stateGameOver,
    &stateHighScore
];

@smc(prefer)
function updateGame(): void {
    stateHandlers[gameState]();
}
```

---

## Dynamic Address Examples

### Buffer Processing

```js
// Process buffer at runtime address
@smc(parameterized)
function processBuffer(ptr: word, len: byte): void {
    for (let i: byte = 0; i < len; i++) {
        let value = peek(ptr + i);
        poke(ptr + i, transform(value));
    }
}

// SMC with parameterized address:
/*
processBuffer:
    ; Setup - copy ptr to SMC operands
    LDA ptr
    STA load_addr+1
    STA store_addr+1
    LDA ptr+1
    STA load_addr+2
    STA store_addr+2
    
    LDX len
    BEQ done
    DEX
    
loop:
load_addr:
    LDA $0000,X         ; Base modified by setup
    JSR transform
store_addr:
    STA $0000,X         ; Base modified by setup
    DEX
    BPL loop
done:
    RTS
*/
```

### Multi-Dimensional Array

```js
// 2D array access: screen[row][col]
@smc(prefer)
function plotChar(row: byte, col: byte, ch: byte): void {
    let addr: word = $0400 + row * 40 + col;
    poke(addr, ch);
}

// SMC row calculation:
/*
plotChar:
    ; Calculate row base = $0400 + row * 40
    LDA row
    ASL A           ; *2
    ASL A           ; *4
    ASL A           ; *8
    STA temp
    LDA row
    ASL A           ; *2
    ASL A           ; *4
    ASL A           ; *8
    ASL A           ; *16
    ASL A           ; *32
    CLC
    ADC temp        ; 32 + 8 = 40
    ADC col
    STA plot_addr+1
    LDA #$04
    ADC #0
    STA plot_addr+2
    
    LDA ch
plot_addr:
    STA $0400       ; Address modified above
    RTS
*/
```

---

## Performance Comparison

| Pattern | Original Cycles | SMC Cycles | Savings |
|---------|----------------|------------|---------|
| 8-element loop | 72 | 32 | 56% |
| 8-case switch | 28 avg | 20 | 29% |
| Indirect access | 5/access | 4/access | 20% |
| Screen clear | 9000 | 7000 | 22% |

---

## Best Practices

1. **Profile first** - Only apply SMC to hot paths
2. **Keep it simple** - Complex SMC is hard to debug
3. **Document heavily** - SMC is not obvious to readers
4. **Test thoroughly** - SMC bugs are hard to find
5. **Consider interrupts** - Multi-byte mods need protection

---

## Task Checklist

- [ ] Write loop unrolling examples
- [ ] Write jump table examples
- [ ] Write dynamic address examples
- [ ] Add performance comparison
- [ ] Document best practices

---

## Phase 10 Complete

**All 14 Phase 10-smc documents created.**

Next: Phase 11-testing (15 documents)