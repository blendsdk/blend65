# Program Entry and Exit

> **Document**: 06-entry-exit.md
> **Parent**: [Index](00-index.md)

## Overview

This document defines how programs start and end. The design follows standard C64/6502 conventions.

## Entry Point

### BASIC Stub

Every program starts with a BASIC stub that allows `RUN` from the BASIC prompt.

```asm
*=$0801                 ; BASIC program start

; BASIC line: 10 SYS 2061
!byte $0C, $08          ; Pointer to next line ($080C)
!byte $0A, $00          ; Line number 10
!byte $9E               ; SYS token
!byte $20               ; Space
!byte $32, $30, $36, $31 ; "2061" (ASCII)
!byte $00               ; End of line
!byte $00, $00          ; End of program

*=$080D                 ; Code starts at 2061 ($080D)
    JMP main            ; Jump to main function
```

### Why JMP to main?

The BASIC SYS command does a `JSR` to the specified address. By jumping to `main`, we ensure:
1. Clean stack (no extra return address)
2. Direct entry to user code
3. Standard function calling convention

## Program Structure

```asm
*=$0801
; BASIC stub (13 bytes)

*=$080D
    JMP main            ; Entry point

; Global initialization (if needed)
__init_globals:
    ; Initialize global variables
    RTS

; User functions
main:
    JSR __init_globals  ; Initialize globals (optional)
    ; ... user code ...
    RTS                 ; Return to BASIC

helper:
    ; ... helper function ...
    RTS

; Runtime routines (if needed)
__mul8:
    ; ... multiply routine ...
    RTS

__div8:
    ; ... divide routine ...
    RTS
```

## Exit Behavior

### Default Exit: RTS

Every function ends with `RTS`, including `main()`. This returns to the caller:

1. `main()` returns to the BASIC stub entry point
2. BASIC stub returns to BASIC interpreter
3. User sees `READY.` prompt

```asm
main:
    ; ... user code ...
    RTS                 ; Returns to BASIC
```

### Infinite Loop Pattern

For games/programs that shouldn't exit:

```js
// Blend code
function main(): void {
  while (true) {
    updateGame();
    render();
  }
}
```

```asm
main:
    ; ... setup ...
.loop:
    JSR updateGame
    JSR render
    JMP .loop          ; Never reaches RTS
    RTS                ; (dead code, but still generated)
```

### Clean Exit (stdlib)

For programs that modify hardware and need clean BASIC return:

```js
// stdlib/c64/system.blend
export function exitToBasic(): void {
  asm_lda_imm($37);    // Enable ROMs
  asm_sta_zp($01);
  asm_jsr($FF8A);      // RESTOR
  asm_jsr($FF81);      // SCINIT
  asm_jsr($FF84);      // IOINIT
  asm_rts();
}
```

## Global Initialization

If there are global variables with initializers:

```js
// Blend code
let counter: byte = 10;
let screenAddr: word = $0400;
```

```asm
__init_globals:
    LDA #10
    STA counter
    LDA #$00
    STA screenAddr
    LDA #$04
    STA screenAddr+1
    RTS

main:
    JSR __init_globals  ; First thing main does
    ; ... rest of main ...
    RTS
```

## Memory Map

| Address | Content |
|---------|---------|
| $0801-$080C | BASIC stub |
| $080D | `JMP main` |
| $0810+ | Program code |
| ... | Functions |
| ... | Runtime routines |
| ... | Global variable area |