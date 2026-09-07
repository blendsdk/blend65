# F007 — Interrupt functions

> **Status**: ✅ Accepted  
> **Stability**: Stable  
> **Guard**: Pass (all 23 rules)

## Description

The `interrupt` keyword marks one source-level function as a callback-only interrupt handler. The
compiler materializes the entry/exit variant required by the compiler-recognized platform sink. A
raw CPU-vector variant saves registers and ends in `RTI`; a firmware-mediated variant honors the
firmware frame already on the stack and uses its declared chain or restore tail. Interrupt
functions are a **core language feature** because interrupts are a 6502-family CPU capability
shared by all target platforms.

## Syntax

```blend65
interrupt function <name>(): void {
    // handler body
}
```

**EBNF:**
```ebnf
interrupt_function = [ "export" ] , "interrupt" , "function" , identifier
                   , "(" , ")" , ":" , "void" , block ;
```

## Rules

| Rule | Decision |
|------|----------|
| Signature | Must be `(): void` — no parameters, no return value |
| Wrong signature | **E10050**: compile error |
| Can it be called as a normal function? | **No** — **E10051**: compile error |
| Can you take its address? | **Yes** — `&myHandler` returns `word` (code address) |
| Can it access module variables? | **Yes** — including `zeropage` variables |
| Can it call other functions? | **Yes** — ordinary helpers keep their `JSR`/`RTS` ABI; the compiler accounts for their interrupt execution domain |
| Can it be exported? | **Yes** — `export interrupt function ...` |
| Can it be in a `zeropage` block? | **No** — `zeropage` is for variables only |
| How many per module? | No limit — a module can define multiple interrupt handlers |

## Generated Entry Variants

For a raw CPU interrupt vector, the compiler generates the following 6502 code:

```asm
; interrupt function onRasterIRQ(): void
onRasterIRQ:
    PHA             ; Save accumulator          (3 cycles)
    TXA             ;                            (2 cycles)
    PHA             ; Save X register            (3 cycles)
    TYA             ;                            (2 cycles)
    PHA             ; Save Y register            (3 cycles)
    CLD             ; Blend65 handler body begins in binary mode (2 cycles)
    
    ; ... compiled function body ...
    
    PLA             ; Restore Y register         (4 cycles)
    TAY             ;                            (2 cycles)
    PLA             ; Restore X register         (4 cycles)
    TAX             ;                            (2 cycles)
    PLA             ; Restore accumulator        (4 cycles)
    RTI             ; Return from interrupt       (6 cycles)
```

**Generated overhead**: 37 cycles and 12 bytes + function body.

The NMOS CPU does not clear decimal mode on interrupt entry. The compiler establishes `D=0` before
the Blend65 body or any ordinary helper call. `RTI` restores the interrupted P, so the raw path does
not need another status save.

A firmware-mediated path is different. In the C64 901227-03 KERNAL path, PULS/PULS1 has already
saved A/X/Y before it jumps through CINV at `$0314/$0315`. The corresponding generated handler
variant does not save those registers again. Its tail either jumps indirectly through a dedicated
two-byte saved-previous-CINV link (`setIRQ`) or jumps to the profile-declared KERNAL restore/`RTI`
tail (`setIRQExclusive`). The chained form wraps the body with `PHP; CLD` and `PLP`, preserving the
prior handler's entry flags; its link may not begin at `$xxFF` on NMOS. Exclusive and raw forms use
`CLD` and rely on their eventual `RTI` to restore the interrupted status. A raw-vector sink selects
the save/restore/`RTI` variant instead. Only
reachable variants are emitted; every duplicate body, link word, stack effect, byte, and cycle path
is reported. There is no generic dispatcher or runtime selector.

The source handler explicitly acknowledges the interrupt source it owns. The compiler cannot infer
whether VIC, CIA, or another device asserted IRQ and does not inject an acknowledgement.

## Execution domains and Static Frame Allocation

An interrupt may pre-empt mainline code at any instruction. Blend65 therefore treats entry ABI and
execution domain as separate facts:

- an `interrupt function` is callback-only. Its raw entry returns with `RTI`; a profile-selected
  firmware entry uses the declared firmware chain or restore tail;
- an ordinary helper called by that entry still uses `JSR`/`RTS` and may also be called from
  mainline code;
- parameters, return homes, locals, temporaries, spills, staging values, and compiler scratch are
  invocation-private. If mainline, IRQ, NMI, or a statically bounded nested interrupt can overlap,
  the compiler gives those activations disjoint SFA homes and emits only the code variants needed
  to address them;
- storage-free reentrant code may remain shared;
- if a storage-bearing path can overlap itself without a static bound, compilation fails. The
  compiler never adds a runtime frame selector, frame copy, dynamic stack, or hidden lock.

The compiler applies this rule to the complete helper closure, including zero-page scratch created
late in lowering. It reports the resulting ROM, RAM, and zero-page cost in the build report.

### Shared program state remains shared

Module globals, assets, and MMIO registers are not invocation-private and are never silently
duplicated. An interrupt can therefore change state that mainline code also uses, exactly as a C64
developer expects. A byte load or store is indivisible with respect to CPU interrupt entry, but a
read-modify-write sequence can lose an update and a multi-byte access can tear. The compiler warns
when either unprotected hazard is statically visible; it does not silently mask interrupts.

## Installation (Platform-Specific)

Getting the address of an interrupt handler is **core language** (`&`). Installing it at the correct hardware vector is **platform-specific** and belongs in platform libraries:

```blend65
import { setIRQ, setIRQExclusive } from c64.system;

setIRQ(&onRasterIRQ);             // default KERNAL CINV path; chain previous
setIRQExclusive(&onRasterIRQ);    // advanced CINV takeover; KERNAL restore tail

// Available only in a profile with a proven writable and active raw vector.
import { setRawIRQ } from c64.system;
setRawIRQ(&onRasterIRQ);          // advanced raw save/restore/RTI path

// E10252 in the default C64 profile: CINV is entered after KERNAL saved A/X/Y.
pokew($0314, &onRasterIRQ);
```

A compiler-recognized interrupt-handler sink accepts only an `interrupt function`; passing an
ordinary `RTS` function is E10244. The selected platform profile names every recognized sink, its
accepted source kind, materialized entry variant, execution domain, and interrupt source.
Provenance survives direct scalar declaration, assignment, copy, identity cast, and conditional
selection while every possible source remains known and the storage does not escape. A recognized
sink rejects erased or unknown provenance with E10247 and may install the specialized variant
rather than the raw numeric `word`. Arithmetic, bitwise transformation, non-identity casts,
address escape, aggregates/arrays, and unknown external boundaries erase the proof. A direct raw
write to an exactly recognized incompatible firmware vector is E10252; a genuinely opaque raw
memory boundary keeps the function reachable but cannot validate the caller or return convention.

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
    setIRQ(&onRasterIRQ);
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
    setIRQ(&onIRQ);
    setNMI(&onNMI);
}
```

## Ambiguities Resolved

| # | ID | Ambiguity | Resolution |
|---|-----|-----------|------------|
| 1 | INT-1 | Can interrupt handlers call other functions? | Yes. Ordinary helpers retain `JSR`/`RTS`; overlapping invocation-private storage gets execution-domain-specific SFA homes. |
| 2 | INT-2 | Installing a non-interrupt function as an interrupt handler | Compiler-recognized interrupt-handler sinks reject it. An exactly known incompatible firmware-vector write is also rejected; only genuinely opaque raw boundaries escape proof. |
| 3 | INT-3 | Interrupt handler frame and scratch storage | All invocation-private storage, including late helper scratch, is separated across overlapping execution domains. |
| 4 | INT-4 | Shared globals, assets, and MMIO | They remain shared. Statically visible lost-update and torn multi-byte hazards receive warnings. |
| 5 | INT-5 | Unbounded storage-bearing self-overlap | Compile error; Blend65 does not add dynamic frames or a runtime selector. |

## Errors

| Code | Rationale condition | Public presentation |
|------|-----------|---------|
| E10050 | Wrong interrupt function signature | [Chapter 14](../14-diagnostics.md) |
| E10051 | Calling interrupt function directly | [Chapter 14](../14-diagnostics.md) |
| E10244 | Ordinary `RTS` function reaches a compiler-recognized interrupt-handler sink | [Chapter 14](../14-diagnostics.md) |
| E10245 | Invocation-private overlap cannot be statically bounded | [Chapter 14](../14-diagnostics.md) |
| E10247 | Recognized sink receives erased or unknown handler provenance | [Chapter 14](../14-diagnostics.md) |
| E10252 | Raw interrupt entry is written directly to an incompatible recognized firmware vector | [Chapter 14](../14-diagnostics.md) |

## Warnings

| Code | Rationale condition | Public presentation |
|------|-----------|---------|
| W10211 | Statically visible cross-domain read-modify-write can lose an update | [Chapter 14](../14-diagnostics.md) |
| W10212 | Statically visible cross-domain multi-byte access can tear | [Chapter 14](../14-diagnostics.md) |

## Language Guard Verdict

- **P1 Cross-platform** ✅ — The 6502 CPU has IRQ and NMI on all target platforms. Interrupt handling is a CPU feature, not platform-specific.
- **P2 Platform-meaningful** ✅ — Every target platform uses interrupts for raster effects, VBI, keyboard, timers, etc.
- **P3 No platform assumptions** ✅ — The source-level handler is platform-neutral. The selected profile owns the raw or firmware-mediated entry/exit variant.
- **H1 6502 implementable** ✅ — Raw entry uses the standard save/restore/`RTI` sequence; firmware variants are emitted only from an exact profile contract.
- **H2 Cost transparency** ✅ — Raw 37-cycle/12-byte overhead and every firmware normalization, tail, duplicated body, link word, stack byte, and full path cost are reported.
- **H3 SFA compatible** ✅ — Every statically bounded overlapping activation receives disjoint invocation-private homes; shared program state keeps its intended identity.
- **H4 Memory footprint** ✅ — Only reachable variants are emitted; raw overhead is 12 bytes, while every profile-specific entry and page-safe saved link is explicit and charged.
- **H5 Deterministic** ✅ — Register save/restore and bounded execution-domain specialization are automatic. Unbounded invocation-private overlap is rejected instead of causing silent corruption.
- **L1 Unambiguous** ✅ — `interrupt function` is clear, no parsing ambiguity.
- **L2 Consistent** ✅ — Follows the `modifier function name(params): type` pattern.
- **L3 Beginner-friendly** ✅ — `interrupt function` reads naturally. Any developer understands its purpose.
- **L4 Minimal** ✅ — One keyword modifier, one constraint (signature must be `(): void`), automatic codegen.
- **L6 Error messages** ✅ — Wrong signature and direct call both produce specific, actionable errors.
- **C1 Lexer/parser** ✅ — `KW_INTERRUPT`, `KW_FUNCTION`, then standard function parsing.
- **C3 Code generation** ✅ — Entry lowering preserves source-handler identity until the selected sink can choose the exact raw or firmware ABI.
- **F1 Extensible** ✅ — ABI identity and execution-domain analysis remain available while a genuinely opaque raw address preserves low-level access outside recognized interrupt-vector sinks.
