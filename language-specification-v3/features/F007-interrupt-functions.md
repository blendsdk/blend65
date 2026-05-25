# F007 — Interrupt functions

> **Status**: ✅ Accepted  
> **Stability**: Stable  
> **Guard**: Pass (all 23 rules)

## Description

The `interrupt` keyword marks a function as a hardware interrupt handler. The compiler generates the correct prologue (register save) and epilogue (register restore + `RTI`) instead of the normal function calling convention (`RTS`). Interrupt functions are a **core language feature** because interrupts are a 6502 CPU capability shared by all target platforms.

## Syntax

```blend65
interrupt function <name>(): void {
    // handler body
}
```

**EBNF:**
```ebnf
interrupt_function = "interrupt" , "function" , identifier , "(" , ")" , ":" , "void" , block ;
```

## Rules

| Rule | Decision |
|------|----------|
| Signature | Must be `(): void` — no parameters, no return value |
| Wrong signature | **E10050**: compile error |
| Can it be called as a normal function? | **No** — **E10051**: compile error |
| Can you take its address? | **Yes** — `&myHandler` returns `word` (code address) |
| Can it access module variables? | **Yes** — including `zeropage` variables |
| Can it call other functions? | **Yes, but with documented reentrancy hazard** (see below) |
| Can it be exported? | **Yes** — `export interrupt function ...` |
| Can it be in a `zeropage` block? | **No** — `zeropage` is for variables only |
| How many per module? | No limit — a module can define multiple interrupt handlers |

## Generated Code Pattern

The compiler generates the following 6502 code for an `interrupt` function:

```asm
; interrupt function onRasterIRQ(): void
onRasterIRQ:
    PHA             ; Save accumulator          (3 cycles)
    TXA             ;                            (2 cycles)
    PHA             ; Save X register            (3 cycles)
    TYA             ;                            (2 cycles)
    PHA             ; Save Y register            (3 cycles)
    
    ; ... compiled function body ...
    
    PLA             ; Restore Y register         (4 cycles)
    TAY             ;                            (2 cycles)
    PLA             ; Restore X register         (4 cycles)
    TAX             ;                            (2 cycles)
    PLA             ; Restore accumulator        (4 cycles)
    RTI             ; Return from interrupt       (6 cycles)
```

**Overhead**: 35 cycles + function body. This is the standard interrupt handler pattern on 6502.

Note: The CPU automatically pushes the processor status register (P) onto the stack when an interrupt fires, and `RTI` automatically restores it. The compiler does not need to save/restore P.

## Interrupt Handler ZP Temp Space

The compiler uses zero-page bytes as temporary workspace for expression evaluation. If an interrupt fires while the main code is using those temps, and the handler also uses ZP temps, the main code's temps would be corrupted.

**Rule**: The compiler must allocate **separate ZP temp space** for interrupt handlers and for the main code path. This is a compiler implementation requirement, not a language syntax issue.

## SFA Reentrancy Hazard

In Static Frame Allocation, every function has exactly one static frame. If `main()` → `updateScore()` is executing, and an interrupt fires, and the interrupt handler also calls `updateScore()`, the static frame for `updateScore()` is corrupted.

**v3 Rule**: This hazard is **documented but not compiler-enforced**:

> ⚠️ **Reentrancy warning**: Interrupt handlers must not call functions that are also reachable from the main code path. Because Blend65 uses Static Frame Allocation, each function has exactly one frame — if an interrupt handler calls a function whose frame is currently in use by the interrupted code, the frame contents are corrupted. This causes undefined program behavior.

A future compiler version may add call-graph analysis to detect this at compile time (see `future-considerations.md`, FUT-004).

## Installation (Platform-Specific)

Getting the address of an interrupt handler is **core language** (`&`). Installing it at the correct hardware vector is **platform-specific** and belongs in platform libraries:

```blend65
// C64 — install raster IRQ
pokew(0x0314, &onRasterIRQ);          // KERNAL IRQ vector

// Atari 800XL — install vertical blank interrupt
pokew(0x0222, &onVBlank);             // VVBLKI vector

// Or via platform libraries (preferred):
import { setIRQ } from c64.system;
setIRQ(&onRasterIRQ);
```

## Examples

**Basic interrupt handler:**
```blend65
module Game;

zeropage {
    export rasterLine: byte = 0;
}

interrupt function onRasterIRQ(): void {
    rasterLine = rasterLine + 1;
    // Acknowledge interrupt (platform-specific)
}

function main(): void {
    // Install the handler
    pokew(0x0314, &onRasterIRQ);
    // ... game loop ...
}
```

**Multiple interrupt handlers:**
```blend65
module Interrupts;

interrupt function onIRQ(): void {
    // Handle maskable interrupt
}

interrupt function onNMI(): void {
    // Handle non-maskable interrupt
}

export function installHandlers(): void {
    pokew(0x0314, &onIRQ);    // Platform-specific vector
    pokew(0x0318, &onNMI);    // Platform-specific vector
}
```

## Ambiguities Resolved

| # | ID | Ambiguity | Resolution |
|---|-----|-----------|------------|
| 1 | INT-1 | Can interrupt handlers call other functions? | Yes, but documented reentrancy hazard. No compiler enforcement in v3 (FUT-004). |
| 2 | INT-2 | Installing non-interrupt function as handler | Documented rule. No type enforcement in v3 (FUT-003, FUT-005). |
| 3 | INT-3 | Interrupt handler ZP temp space | Compiler must allocate separate ZP temps for interrupt path vs. main path. |

## Errors

| Code | Condition | Message |
|------|-----------|---------|
| E10050 | Wrong interrupt function signature | `Interrupt function '<name>' must have signature '(): void' — found '<actual>'` |
| E10051 | Calling interrupt function directly | `Cannot call interrupt function '<name>' directly — interrupt functions are invoked by hardware. Use '&<name>' to get its address for installation` |

## Language Guard Verdict

- **P1 Cross-platform** ✅ — The 6502 CPU has IRQ and NMI on all target platforms. Interrupt handling is a CPU feature, not platform-specific.
- **P2 Platform-meaningful** ✅ — Every target platform uses interrupts for raster effects, VBI, keyboard, timers, etc.
- **P3 No platform assumptions** ✅ — The `interrupt` keyword generates standard 6502 interrupt prologue/epilogue. Which vector to install at is left to platform libraries.
- **H1 6502 implementable** ✅ — Standard PHA/TXA/PHA/TYA/PHA + RTI pattern. Every 6502 system uses this.
- **H2 Cost transparency** ✅ — 35-cycle overhead documented. Function body cost is additive.
- **H3 SFA compatible** ✅ — Interrupt functions have static frames like any other function. Separate ZP temp space prevents corruption.
- **H4 Memory footprint** ✅ — 11 bytes overhead (prologue + epilogue) per interrupt function.
- **H5 Deterministic** ✅ — Register save/restore is automatic. No undefined register state after RTI.
- **L1 Unambiguous** ✅ — `interrupt function` is clear, no parsing ambiguity.
- **L2 Consistent** ✅ — Follows the `modifier function name(params): type` pattern.
- **L3 Beginner-friendly** ✅ — `interrupt function` reads naturally. Any developer understands its purpose.
- **L4 Minimal** ✅ — One keyword modifier, one constraint (signature must be `(): void`), automatic codegen.
- **L6 Error messages** ✅ — Wrong signature and direct call both produce specific, actionable errors.
- **C1 Lexer/parser** ✅ — `KW_INTERRUPT`, `KW_FUNCTION`, then standard function parsing.
- **C3 Code generation** ✅ — Well-known 6502 pattern. Documented in this entry.
- **F1 Extensible** ✅ — Future versions can add typed function pointers (FUT-003), call-graph analysis (FUT-004).

