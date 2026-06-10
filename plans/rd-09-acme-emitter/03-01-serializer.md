# Whole-Program Serializer: `serializeToAcme`

> **Document**: 03-01-serializer.md
> **Parent**: [Index](00-index.md)
> **Package**: `@blend65/codegen` · **File**: `packages/codegen/src/instr/serialize-acme.ts`

## Overview

`serializeToAcme(program: InstrProgram): string` is the single canonical whole-program
serializer (R3/R4). It orchestrates the existing per-stream `printInstr` to render symbol
definitions, the platform preamble, and the code/const-data segments into one deterministic
`.asm` string. It is **pure** — no I/O, no process spawning — so it is fully golden-testable
without ACME.

## Architecture

### Reuse, don't re-implement

Per D4/AR-60 there is exactly one serializer path. `printInstr(stream)` already renders every
`StreamEntry` (instr/label/directive) with correct ACME syntax (R6–R9, R22–R27) and all 13
addressing modes. `serializeToAcme` **calls** `printInstr` for each stream and for the
preamble; it only adds the whole-program structure: the `!to` hoist, the symbol-definition
header, and the section-separator comments.

### Segment & symbol mapping (AR-94)

- **Symbols (1A):** emit each `program.allocationPlan.symbolDefinitions` entry verbatim as
  `name = $XXXX` (4-digit uppercase hex), in array order, under one
  `; --- symbol definitions ---` header. No re-grouping, no name re-derivation.
- **Segments (2A):** emit `segment === "code"` streams, then `segment === "data"` streams.
  `segment === "zp"` streams are skipped (already realized as header symbol defs). No `bss`
  emission. If `symbolDefinitions` is empty, the header is still emitted (stable shape) with
  no entries beneath it.

## Implementation Details

### Signature

```typescript
/**
 * Serialize an InstrProgram to ACME assembler source text — the single canonical
 * serializer (R3/R4, AR-60/D4). `--emit-asm` writes this text and stops; a full build
 * writes the same text and feeds it to ACME, so the two can never drift.
 *
 * Pure and deterministic (R5): identical input → byte-identical output. Reuses
 * `printInstr` for all per-entry rendering. Symbol defs and segment order follow AR-94
 * (1A verbatim `symbolDefinitions`; 2A `code → data`, `zp` skipped, no `bss`).
 *
 * @param program The InstrProgram from codegen/peephole (RD-07/08).
 * @returns        The complete `.asm` file content (newline-terminated).
 */
export function serializeToAcme(program: InstrProgram): string;
```

### Algorithm (AR-94-corrected from RD §4.2)

```
serializeToAcme(program):
  lines: string[] = []

  // 1. !to output directive — hoisted to the very top from the preamble.
  for entry in program.preamble:
    if entry is directive && entry.directive.kind === "outputFile":
      lines.push(printInstr({ symbol:"_pre", segment:"code", entries:[entry] }))

  // 2. Symbol definitions header + verbatim entries (AR-94/1A).
  lines.push("; --- symbol definitions ---")
  for sym in program.allocationPlan.symbolDefinitions:
    lines.push(`${sym.name} = ${hex16(sym.value)}`)

  // 3. Remaining preamble (origin, BASIC stub, startup shim) — everything except !to.
  preambleRest = program.preamble.filter(e => not (e is directive && kind==="outputFile"))
  if preambleRest non-empty:
    lines.push(printInstr({ symbol:"_pre", segment:"code", entries: preambleRest }))

  // 4. Code-segment streams (deterministic order — already stable from generateInstr).
  for stream in program.streams where stream.segment === "code":
    lines.push(`; --- function: ${stream.symbol} ---`)
    lines.push(printInstr(stream))

  // 5. Const-data streams.
  for stream in program.streams where stream.segment === "data":
    lines.push(`; --- const data: ${stream.symbol} ---`)
    lines.push(printInstr(stream))

  // (zp streams skipped; no bss — AR-94/2A)

  return lines.join("\n") + "\n"
```

`hex16` mirrors `print-instr.ts`'s 4-digit uppercase format (`$0801`). To keep one hex
implementation, the plan **exports `hex16` from `print-instr.ts`** (or a shared
`hex.ts`) and imports it here — no duplication (code.md DRY).

### Integration points

- **Input:** `InstrProgram` (`instr-program.ts`) — `preamble`, `streams`, `allocationPlan`.
- **Calls:** `printInstr` (`print-instr.ts`).
- **Consumed by:** `@blend65/compiler` `emit-binary.ts` (Phase 2+), and exported from the
  codegen barrel for `--emit-asm`.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Empty `symbolDefinitions` | Emit header with no entries (stable shape) | AR-94 |
| `preamble` empty (raw `generateInstr` output, no plugin) | Skip `!to` + preamble-rest; emit only symbol header + code | AR-94 / design |
| Unknown segment value | Impossible — `segment` is the closed union `"code"\|"data"\|"zp"`; `zp` skipped, others exhaustive | H5 |

> The serializer never produces a diagnostic — it is pure text generation over already-valid
> data (every `Instr` was CPU-validated upstream, AR-58). Invalid output is a compiler bug
> surfaced by ACME as an ICE (R35, handled in the process layer).

## Testing Requirements

- Spec tests (golden): symbol header, `!to` hoist, segment ordering, empty-symbol case,
  raw-vs-preamble program, full gate-program `.asm` (see `07-testing-strategy.md` ST-S1..ST-S8).
- The full gate golden must equal the existing ST-AG1 text (`assemble.golden.spec.test.ts`)
  to prove `serializeToAcme` and the hand-composition agree.
