# RD-07c Codegen Platform Preamble Implementation Plan

> **Feature**: Wire the RD-10 `PlatformPlugin` into the codegen `InstrProgram.preamble` so
>   the compiler produces an assemblable c64 program (origin, `!to`, BASIC stub + startup
>   shim) with a `_main` entry label — "Half A" of the RD-07 codegen remainder.
> **Status**: Planning Complete
> **Created**: 2026-06-10
> **CodeOps Version**: (unstamped — consistent with RD-01..RD-07b/RD-10/RD-11a)

## Overview

RD-07b shipped `generateInstr(ilProgram, cpuVariant, bag)`, which translates the RD-06 live
op set into validated per-function `InstrStream`s but emits an **empty**
`InstrProgram.preamble`. Without a preamble there is no program origin (`* = $0801`), no
output directive (`!to "main.prg", cbm`), and no startup shim — so the output is not yet an
assemblable program. RD-10 then shipped the `PlatformPlugin` contract with the
`emitPreamble`/`emitStartupShim`/`getOutputDirective`/`getMainTerminationPolicy` hooks and the
c64 plugin that implements them.

RD-07c ("Half A") connects the two: an additive `assembleProgram(ilProgram, plugin, bag)`
wrapper calls `generateInstr` and then fills `InstrProgram.preamble` from the plugin's
`emitPreamble` hook, and codegen labels the unique entry function `_main` (sanitizing all
other function labels) so the shim's `JSR _main` resolves. The result is a complete,
deterministic, serialisable c64 program for the AR-43 gate (`poke(0xD020, 5)` with a
terminating `main`).

The genuinely-blocked remainder of RD-07 ("Half B": the IL ops no live lowering emits,
multi-block CFG, calling convention, interrupt prologue/epilogue, for-loop Pattern A/B, and
the `JSR _main` fall-through optimization) stays deferred until RD-06 widens its lowering —
the same AR-38 walking-skeleton discipline used throughout this project.

## Document Index

| #   | Document                                                              | Description                                              |
| --- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)                       | Zero-Ambiguity Gate decisions D1–D8 (audit trail)        |
| 00  | [Index](00-index.md)                                                 | This document — overview and navigation                  |
| 01  | [Requirements](01-requirements.md)                                   | Feature requirements and scope (Half A)                  |
| 02  | [Current State](02-current-state.md)                                 | As-built RD-07b/RD-10 surfaces RD-07c builds on          |
| 03-01 | [Platform Preamble & `assembleProgram`](03-01-platform-preamble-and-assemble.md) | The wrapper, entry-label `_main`, sanitize, PreambleOptions |
| 07  | [Testing Strategy](07-testing-strategy.md)                           | Spec/impl test cases incl. golden ACME-text snapshots    |
| 99  | [Execution Plan](99-execution-plan.md)                               | Phases, sessions, and task checklist                     |

## Quick Reference

### Usage Example

```typescript
// @blend65/codegen — new additive entry point
import { assembleProgram } from "@blend65/codegen";
import { c64Plugin } from "@blend65/platforms";

const program = assembleProgram(ilProgram, c64Plugin, bag);
// program.preamble now holds: !to "main.prg", cbm / * = $0801 / BASIC stub /
//   __startup: ... JSR _main ... RTS
// program.streams[0] is labelled `_main` (entry); others sanitized `Module_fn`.
```

### Key Decisions

| Decision     | Outcome   |
| ------------ | --------- |
| Scope (D1)   | Half A only — preamble wiring; defer Half B to an RD-06-widening slice |
| Plugin→codegen (D2) | Additive `assembleProgram(ilProgram, plugin, bag)` wrapper; `generateInstr` untouched |
| Shim selection (D3) | Simple rule: single-block entry ending in `ret` ⇒ `terminating`; bss/data flags from plan (both false for gate) |
| Entry label (D4) | Entry function → `_main`; all other function labels sanitized `.`→`_` |
| Encoding hooks (D5) | Deferred — no live string/char consumer |
| Fall-through (D8) | Deferred to Half B; wire shim as the plugin emits it; document the seam |

## Related Files

- `packages/codegen/src/instr/instr-program.ts` — add `assembleProgram` wrapper (R55/R46–R49)
- `packages/codegen/src/instr/translate.ts` — entry-label `_main` + real `sanitize()` (R47/D4)
- `packages/codegen/src/instr/assemble.spec.test.ts` — NEW spec tests (ST-A*)
- `packages/codegen/src/instr/assemble.golden.spec.test.ts` — NEW end-to-end golden (ST-AG*)
- `packages/codegen/src/instr/assemble.impl.test.ts` — NEW impl/edge tests
- `packages/codegen/src/index.ts` — export `assembleProgram`
