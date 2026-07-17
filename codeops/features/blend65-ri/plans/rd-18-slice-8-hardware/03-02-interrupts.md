# Interrupt Functions: RD-18 Slice 8a

> **Document**: 03-02-interrupts.md
> **Parent**: [Index](00-index.md)
> **Governs**: interrupt declaration syntax completion, E10050, and the save/RTI codegen ABI.
> **Spec**: Ch 06 §7 (+ F007). **AR**: 12, 13, 14.

## Overview

Interrupt functions already parse, collect, and lower; translate already emits RTI for their
`ret`. This component completes the two missing pieces: the optional `: void` annotation
(AR-12) and the spec-verbatim register save/restore ABI (AR-14).

## Implementation Details

### Parser (`parse-decl.ts` `parseInterruptDecl`, :141-172)

After the mandatory `()`, accept an OPTIONAL `: <type>` annotation:

- Absent → unchanged (bare form stays canonical).
- Present and the type is `void` → consumed, node unchanged (no new AST field).
- Present and any other type → emit **E10050** `InterruptWrongSignature` (mint, additive; the
  Ch 06-designated number, verified free) on the annotation span, then continue parsing the
  block (error-tolerant recovery, matching the file's house style).

Parse-time emission follows the E10150 parser-owned precedent (3b AR-13). `export interrupt`
handling is UNTOUCHED — E10311 stays (AR-13, recorded Ch 06 deviation). Parameters remain
syntactically impossible, so E10050 has exactly one trigger.

### Analyzer

No new work: collection (`function-collection.ts:112,132`), name resolution, E10051 on direct
calls (`expression-typing.ts:1197`), and the intrinsic `checkDecimalMode` walk are shipped.
Re-pin E10051 in the negatives suite (03-06).

### Codegen ABI (`translate.ts`)

Per Ch 06 §7.4 (Generated Code Pattern; citation corrected per preflight PF-009), verbatim and
unconditional (Phase A — no clobber analysis, AR-14):

- **Prologue**: in `run()` (:200-231), immediately after the function label, when
  `this.fn.isInterrupt`: `PHA / TXA / PHA / TYA / PHA`.
- **Epilogue**: at every `ret` terminator (:497), when `isInterrupt`: `PLA / TAY / PLA / TAX /
  PLA / RTI` (replacing the current bare `RTI`). Multiple `ret` paths each get the full
  restore — correct and unoptimized by design.
- The CPU stacks P automatically and RTI restores it; no explicit P handling (Ch 06 §7.4).
- Frame/pair prologue interactions: interrupts have no parameters, so `emitPairPrologue`
  (FunctionDecl-only, `lower.ts:337`) is naturally skipped; locals use ordinary frame slots
  (placement governed by 03-03's always-live rule).

Cost note (spec-stated, for the resource delta): 35 cycles + body, 11 bytes per handler.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `interrupt function f(): word` | E10050 at parse, block still parsed | AR-12 |
| `export interrupt …` | existing E10311, decl still parsed | AR-13 |
| call to an interrupt function | existing E10051 | AR-14 |
| interrupt named `main` | existing collection rule (never `mainFunction`) + E10020 absence path — no new code | AR-14 |

## Integration Points

- 03-03 provides the frame/temp-pool correctness for handler bodies and their callees.
- 03-06's fixture installs handlers via `&` (03-01) at raw vectors (AR-16).

## Testing Requirements

ST-11..ST-16: both syntax forms parse; non-void annotation → E10050; prologue/epilogue byte
sequence around a handler body (golden-visible); early-return handler gets restore at each
exit; E10051 re-pin.
