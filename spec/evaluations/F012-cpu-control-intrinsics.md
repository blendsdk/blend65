# F012 — CPU Control Intrinsics

> **Status**: ✅ Accepted  
> **Stability**: Stable  
> **Guard**: Pass (all 23 rules)

## Description

Blend65 exposes exactly five parameterless CPU-control intrinsics:

```text
asm_sei()
asm_cli()
asm_php()
asm_plp()
asm_nop()
```

Each name emits its one promised NMOS 6502/6510 instruction. The source surface does not include
inline assembly, external assembly functions, parameterized opcode calls, assembler labels,
addressing-mode selection, raw registers, or any other `asm_*` operation. The backend remains free
to use every legal instruction for the selected CPU.

## Design Rationale

Most 6502 instructions already express ordinary language work. Values, arithmetic, comparison,
branches, calls, and memory access belong to typed source operations and compiler instruction
selection. Exposing those opcodes would leak register allocation, flags, branch layout, and
assembler symbols into source without providing complete assembly control.

The five admitted operations are different. IRQ masking, status save/restore, and an exact
two-cycle timing instruction have stable meanings that do not depend on a compiler-selected data
register. `peek`/`poke` cover volatile memory at both constant and runtime addresses. `bcd_add` and
`bcd_sub` own packed-decimal arithmetic without exposing raw decimal or carry state.

## Syntax

```ebnf
cpu_intrinsic_call = cpu_intrinsic_name , "(" , ")" ;
cpu_intrinsic_name = "asm_sei" | "asm_cli" | "asm_php" | "asm_plp"
                   | "asm_nop" ;
```

The five names are globally reserved built-in identifiers, not keywords. They require no import.
E10212 rejects a declaration that reuses one. E10171 rejects arguments. A CPU-control call has type
`void` and is valid only as a statement inside a function.

## Exact Instruction and Machine Effects

| Source call | Bytes | Cycles | Exact effect |
|---|---:|---:|---|
| `asm_sei()` | `$78` | 2 | Sets I. Maskable IRQ recognition is disabled; NMI is unaffected. A, X, Y, S, N, V, D, Z, C, and memory are preserved. |
| `asm_cli()` | `$58` | 2 | Clears I. Maskable IRQ recognition is enabled according to the selected CPU's instruction-boundary rules; NMI is unaffected. A, X, Y, S, N, V, D, Z, C, and memory are preserved. |
| `asm_php()` | `$08` | 3 | Writes represented P with B and bit 5 set to page-one stack memory, then decrements S. Registers and live flags are preserved. |
| `asm_plp()` | `$28` | 4 | Increments S, reads the top status-save byte, and restores N, V, D, I, Z, and C. B is not a persistent processor flag. A, X, Y, and other memory are preserved. |
| `asm_nop()` | `$EA` | 2 | Advances PC and consumes exactly two CPU cycles without changing registers, flags, stack, or data memory. |

Each call contributes one ROM byte, no RAM, and no zero page. `asm_php()` additionally contributes
one hardware-stack byte until the matching `asm_plp()`. The normal build evidence reports these
costs with the rest of the reachable path.

## Rules

| ID | Rule |
|---|---|
| CC-1 | Every CPU-control intrinsic takes no arguments and returns `void`. |
| CC-2 | Each call emits its named instruction exactly once. It is never removed, duplicated, combined, or reordered. |
| CC-3 | The compiler preserves the exact machine effects above. It does not use a clobber-all approximation or allow calls to communicate through hidden A, X, Y, or flag state. |
| CC-4 | `asm_nop()` is an observable timing operation. Surrounding work cannot move across it. |
| CC-5 | `asm_php()` pushes one status-save kind and `asm_plp()` consumes only that kind. Each function and interrupt entry starts with an empty relative source stack state. |
| CC-6 | A pull below the function-entry state, unequal status-save depths at a reachable join or loop backedge, or a nonempty exit state is E10248. |
| CC-7 | Caller entries, return addresses, interrupt frames, and compiler-generated ABI saves are separately owned and cannot be consumed by source. |
| CC-8 | Selected-CPU timing at interrupt-mask transitions remains a target fact; the source operation promises the exact instruction, not a broader atomicity window. |

Static stack analysis adds no instructions or SFA storage. Whole-program stack accounting includes
each simultaneously live status save together with calls, interrupt entries, and generated saves.

## Rejected Source Forms

The following are deliberately absent:

- `asm_pha()` and `asm_pla()` because A is compiler-owned and would give the calls no stable typed
  value contract;
- `asm_clc()`, `asm_sec()`, and `asm_clv()` because every language operation owns the flags it
  consumes;
- `asm_cld()` and `asm_sed()` because ordinary arithmetic remains binary and the typed BCD
  operations own decimal mode internally;
- `asm_brk()` because the initial C64 source surface has no qualified generic BRK service;
- branch, load/store, ALU, register-transfer, stack-pointer, or addressing-mode calls; and
- inline assembly blocks and external assembly declarations.

A new opcode-shaped source operation is a future language change. It must first demonstrate a need
that ordinary Blend65 or a zero-cost platform operation cannot express and then define complete
typed, CPU, flag, stack, memory, bus, control-flow, optimizer, and cost behavior.

## Examples

### Preserve an Existing IRQ State

```blend65
function storeSharedWord(address: word, value: word): void {
    asm_php();
    asm_sei();
    pokew(address, value);
    asm_plp();
}
```

`asm_php()`/`asm_plp()` restore the prior status, so the function does not incorrectly enable IRQs
when its caller already had them disabled. `pokew(address, value)` accepts the runtime address and
performs its two ordered volatile writes.

### Exact Timing Padding

```blend65
interrupt function rasterBand(): void {
    poke($D020, 2);
    asm_nop();
    asm_nop();
    poke($D020, 0);
}
```

The two NOP calls emit `$EA $EA`, consume four CPU cycles, and remain between the two volatile
writes. Complete interrupt-entry and `poke` costs remain separate.

## Diagnostics

| Condition | Result |
|---|---|
| Wrong argument count | E10171 |
| Use as a value | Ordinary `void` type error |
| Use at module level | E10010 |
| Redeclaration of one of the five reserved names | E10212 |
| Invalid relative status-stack state | E10248 |
| Any other `asm_*` spelling without a declaration | E10239 |

E10255 and E10259 are retired with the removed raw-decimal and BRK source operations. W10120 and
W10121 remain retired. No replacement warning is needed because the rejected names have no v4
language operation.

## Language Guard Verdict

| Rule | Result |
|---|---|
| P1 Cross-platform compilable | Pass — all five instructions exist on the admitted NMOS baseline. |
| P2 Platform-meaningful | Pass — IRQ masking, status restoration, and exact NOP timing are real low-level needs. |
| P3 No platform assumptions | Pass — CPU effects are exact; wider interrupt and device behavior stays in profiles. |
| P4 Resource-scalable | Pass — every call has fixed ROM/cycle cost and status saves enter stack accounting. |
| H1 6502 implementable | Pass — every call is exactly one official instruction. |
| H2 Cost transparency | Pass — bytes, cycles, RAM, ZP, and hardware-stack use are explicit. |
| H3 SFA compatible | Pass — calls add no SFA storage; status depth is separate hardware-stack state. |
| H4 Memory footprint documented | Pass — one ROM byte per call and one live stack byte per unmatched `asm_php()`. |
| H5 Fully deterministic | Pass — exact selected-CPU effects and invalid stack states are specified. |
| L1 Unambiguous syntax | Pass — five fixed zero-argument calls. |
| L2 Consistent with existing | Pass — ordinary reserved built-in call syntax. |
| L3 Beginner-friendly | Pass — the `asm_` prefix marks an expert-only machine operation. |
| L4 Minimal feature | Pass — only five independently useful stable operations are exposed. |
| L5 No redundancy | Pass — values, memory, arithmetic, and control flow remain ordinary typed language work. |
| L6 Error messages defined | Pass — normal call/name/type errors plus E10248 cover every misuse. |
| L7 Compile-time failure preferred | Pass — arity, placement, redeclaration, and stack-state errors are static. |
| L8 Feature interaction documented | Pass — volatility, interrupts, BCD, ABI stack ownership, and timing are separated. |
| L9 Documentable with examples | Pass — critical-section and exact-timing examples cover the five operations. |
| C1 Lexer/parser implementable | Pass — no new token class; one closed five-name intrinsic production. |
| C2 Semantic analysis defined | Pass — exact effects and one status-stack depth are sufficient. |
| C3 Code generation strategy | Pass — a five-row opcode table emits one byte per call. |
| C4 Unit testable | Pass — bytes, cycles, effects, ordering, and stack errors have direct oracles. |
| C5 Runtime verifiable | Pass — selected-CPU tests can observe I, P, S, flags, timing, and bytes. |
| F1 Extensible | Pass — future additions require the same admission proof instead of a generic escape hatch. |
| F2 Platform-profile ready | Pass — selected CPU/profile owns legality and interrupt timing. |
| F3 Optimizer-friendly | Pass — exact effects preserve more facts while fixed ordering protects machine behavior. |
| F4 Stability classification | Pass — the closed set is stable for Specification 4. |

**Verdict**: ✅ **ACCEPTED** — all 23 Language Guard rules pass. The source surface is the exact
five-name set above; full instruction coverage remains a backend responsibility.
