# Timing Table: `@blend65/core` `timing/`

> **Document**: 03-01-timing-table.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-01 F1 (AC-2) · req-AR #6 · preflight PF-002/PF-006 · plan-AR #7, #11

## Overview

Pure data + lookup for documented NMOS 6502 instruction cost: byte size, base cycles,
page-cross penalty, branch penalties. One table for every consumer (budget tier, scripts,
report, platforms). No I/O, no platform imports — R15-safe by construction (req-AR #6).

## Architecture

### Current
No timing data exists in the repo; codegen's `cpu-table.ts` is legality-only (02 §Gap 2).

### Proposed
New module `packages/core/src/timing/`, surfaced via the **`@blend65/core/platform` subpath**
(the entry point that already carries `Opcode`/`AddressingMode` — the types the table is keyed
by; the root barrel does not export the instr-model, per preflight PF-016):

```
timing/
├── index.ts            # barrel: getTiming, InstrTiming, NmosOpcode
├── nmos-table.ts       # the data: one record per legal (opcode, mode) pair
└── nmos-table.spec.test.ts / .impl.test.ts
```

## Implementation Details

### Types

```ts
/** Cost record for one legal NMOS (opcode, addressing-mode) pair. */
export interface InstrTiming {
  readonly bytes: 1 | 2 | 3;
  readonly baseCycles: number;
  /** +1 when the effective address crosses a page (0 where access time is fixed, e.g. STA abs,X). For branches: the additional +1 when a TAKEN branch crosses a page. */
  readonly pageCrossPenalty: 0 | 1;
  /** +1 when a branch is taken (0 for non-branches). */
  readonly branchTakenPenalty: 0 | 1;
}

/** The NMOS subset of core's Opcode — the table's key domain. */
export type NmosOpcode = (typeof NMOS_OPCODES)[number]; // derived from instr-model's existing NMOS_OPCODES tuple (opcode.ts:25-33) — no re-enumeration (PF-018)

export function getTiming(opcode: NmosOpcode, mode: AddressingMode): InstrTiming;
```

- Keys are the existing `instr-model` types; the opcode key is the narrowed `NmosOpcode` union
  so an out-of-table opcode (e.g. a 65C02 mnemonic) **fails at compile time**, never a silent 0
  (RD F1, AC-2; preflight PF-002/PF-006).
- Branch semantics per RD AC-2: base 2, `branchTakenPenalty` +1, `pageCrossPenalty` +1 more
  when taken across a page — total +2 taken-across-page.
- `getTiming` throws (never returns undefined) on an illegal (opcode, mode) *mode* combination —
  the mode axis cannot be narrowed by type alone; runtime lookup failure is a loud error naming
  both keys.
- Data provenance: documented NMOS 6502 timings (WDC/MOS datasheets, VICE source) per RD
  §Technical Requirements; coverage is mechanically cross-checked against codegen's legality
  table (ST-5 — the spec test lives in codegen, which may import core, preserving R15).

### Integration Points
- Budget tier static estimates (03-03), scripts (03-04, via built package per plan-AR #5),
  codegen/platform cost summaries (03-05, per plan-AR #6).

## Code Example

```ts
// AddressingMode literals are PascalCase — the instr-model union values (PF-011):
getTiming("LDA", "AbsoluteX"); // { bytes: 3, baseCycles: 4, pageCrossPenalty: 1, branchTakenPenalty: 0 }
getTiming("STA", "AbsoluteX"); // { bytes: 3, baseCycles: 5, pageCrossPenalty: 0, branchTakenPenalty: 0 }
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Opcode outside the NMOS subset | Compile-time type error (`NmosOpcode` narrowing) | RD F1 / PF-002 |
| Legal opcode, illegal mode for it | `getTiming` throws naming opcode + mode | RD AC-2 ("never a silent 0") |

## Testing Requirements
- Spec: ST-1…ST-5 (07 §Timing Table) — reference values pinned by RD AC-2 + coverage
  cross-check + type-level error.
- Impl: internal table invariants (every record's bytes matches instr-model's size data where
  available; penalties only where documented).
