# Peephole Passthrough: Technical Specification

> **Document**: 03-01-peephole-passthrough.md
> **Parent**: [Index](00-index.md)

## Overview

This document specifies the v1 peephole module: the `PeepholeRule`/`PeepholeOptions` type
contract, the `optimizeInstr` entry point, and the `validateProgramStructure` helper. v1 is a
thin passthrough — no scanner, no rules applied.

## Architecture

### File layout

```
packages/codegen/src/instr/
├── peephole.ts                # NEW — types + optimizeInstr + validateProgramStructure + V1_RULES
├── peephole.spec.test.ts      # NEW — specification tests (ST-*)
├── peephole.impl.test.ts      # NEW — implementation/edge-case tests
└── index.ts                   # MODIFIED — re-export the peephole surface
```

Estimated size of `peephole.ts`: ~120–160 lines including JSDoc — a single focused module,
well under the 500-line split threshold (`code.md` Rule 21).

## Implementation Details

### Imports

```typescript
import type { CpuVariant, DiagnosticBag, StreamEntry } from "@blend65/core";
import { isInstr, isLabel, isDirective, IceCode } from "@blend65/core";
import type { InstrProgram } from "./instr-program.js";
```

> `InstrProgram` is intra-package (relative `.js` import). `CpuVariant`, `DiagnosticBag`,
> `StreamEntry`, the guards, and `IceCode` are cross-package from `@blend65/core` by package
> name (verified exported via `core/src/index.ts` → `diagnostics` + the instr-model barrel).

### Type Definitions

```typescript
/** A convenience alias for an Instr-type StreamEntry (the only rewrite candidate). */
export type InstrEntry = Extract<StreamEntry, { type: "instr" }>;

/**
 * A single peephole optimization rule (the forward contract; no rules ship in v1).
 *
 * A rule examines `windowSize` consecutive instruction entries and, when `match()`
 * returns true, produces a `replace()` sequence of length ≤ `windowSize` (the hard
 * size invariant, RD R10). Rules are pure functions of their window (RD R9).
 */
export interface PeepholeRule {
  /** Human-readable rule name for diagnostics/reporting (RD R8). */
  readonly name: string;
  /** Number of consecutive Instr entries this rule examines (RD R8). */
  readonly windowSize: number;
  /** Priority (lower = higher priority; applied first) (RD R12). */
  readonly priority: number;
  /** CPU variants this rule is valid for (RD R13). */
  readonly cpuCompat: readonly CpuVariant[];
  /** Test whether the window matches this rule's pattern. */
  match(window: readonly InstrEntry[]): boolean;
  /** Produce the replacement sequence (length ≤ windowSize). Called only after match(). */
  replace(window: readonly InstrEntry[]): InstrEntry[];
}

/** Optimizer configuration (the `--optimize` / `--no-optimize` surface, RD R26/R27). */
export interface PeepholeOptions {
  /** Whether optimization is enabled. Default: enabled (omitted ⇒ enabled). */
  readonly enabled?: boolean;
}

/**
 * v1 rule set — intentionally empty (RD §4.4, PF-001). The peephole stage is a
 * passthrough until concrete rules land at the rules milestone.
 */
const V1_RULES: readonly PeepholeRule[] = [];
```

> **Note on `V1_RULES`:** it is referenced in the module-level JSDoc and exists to anchor the
> forward contract, but in v1 the passthrough does not iterate it (no scanner). To avoid a
> dead-symbol lint failure (`code.md` Rule 4 / `noUnusedLocals`), it is consumed harmlessly —
> e.g. via a `void V1_RULES;` documented guard OR by exporting it for the rules milestone.
> **Decision:** export `V1_RULES` from the module (it is part of the stage's forward surface
> and is asserted by a spec test, ST-6), which both satisfies the linter and documents intent.

### `validateProgramStructure` (the concrete R6 contract — PF-006)

```typescript
/**
 * Assert that an InstrProgram is structurally well-formed (RD R6, PF-006).
 *
 * Checks (NOT opcode legality — that is validateStream's job, RD R22):
 *  1. `program.streams` is a present, non-null array.
 *  2. Every StreamEntry is a valid discriminated union (exactly one of
 *     isInstr/isLabel/isDirective holds).
 *  3. No null/undefined entries.
 * Any violation is an ICE (E90001) — never a user-band diagnostic (RD R30).
 *
 * @param program The program to validate.
 * @param bag Diagnostic sink for ICEs.
 */
export function validateProgramStructure(
  program: InstrProgram,
  bag: DiagnosticBag,
): void {
  if (!Array.isArray(program.streams)) {
    bag.addICE(IceCode.Unexpected, undefined, "peephole: program.streams is not an array");
    return;
  }
  for (const stream of program.streams) {
    for (const entry of stream.entries) {
      // Exactly one guard must hold for a valid discriminated union.
      const matched =
        (isInstr(entry) ? 1 : 0) + (isLabel(entry) ? 1 : 0) + (isDirective(entry) ? 1 : 0);
      if (matched !== 1) {
        bag.addICE(
          IceCode.Unexpected,
          undefined,
          `peephole: malformed StreamEntry in stream '${stream.symbol}'`,
        );
      }
    }
  }
}
```

> The `null`/`undefined` entry case (predicate 3) is caught by predicate 2: a `null` entry
> matches none of the guards (`matched === 0`), triggering the ICE. The implementation will
> guard `entry == null` explicitly first for a clearer message.

### `optimizeInstr` (the entry point — authoritative signature)

```typescript
/**
 * Apply peephole optimization to an InstrProgram. v1 = thin passthrough (no rules).
 *
 * The second parameter is the bare CpuVariant primitive (PF-003), mirroring
 * generateInstr/validateStream — a driver holding a plugin passes plugin.profile.cpu.
 * v1 validates structure (R6) and returns the input program unchanged: preamble,
 * streams, and allocationPlan all pass through verbatim (PF-004, RD R25). When
 * options.enabled === false the optimizer is a guaranteed passthrough (RD R27).
 *
 * @param program The InstrProgram from generateInstr() (RD-07).
 * @param cpuVariant The target CPU primitive (reserved for rule filtering; unused in v1).
 * @param bag Diagnostic sink for structural-violation ICEs (E90001).
 * @param options Optimizer configuration; omitted ⇒ enabled.
 * @returns The (unchanged in v1) InstrProgram.
 */
export function optimizeInstr(
  program: InstrProgram,
  cpuVariant: CpuVariant,
  bag: DiagnosticBag,
  options?: PeepholeOptions,
): InstrProgram {
  // --no-optimize surface: guaranteed passthrough, skip even validation (RD R27).
  if (options?.enabled === false) {
    return program;
  }
  // v1: validate structure, then return verbatim. No scanner, no rules (PF-005/009).
  validateProgramStructure(program, bag);
  return program;
}
```

> **`cpuVariant` unused in v1:** the parameter is part of the stable signature (it filters
> rules by `cpuCompat` once rules exist, RD R13). To satisfy `noUnusedParameters` without
> breaking the contract, name it `_cpuVariant` OR reference it in a `void` guard. **Decision:**
> prefix with `_` per the project's TS convention (`code.md` Rule 4 exception table:
> "parameters required by … signatures"). The JSDoc documents why it is reserved.

### Integration Points

- **Barrel** (`packages/codegen/src/instr/index.ts`): add
  ```typescript
  // Peephole optimizer (RD-08, passthrough v1)
  export type { PeepholeRule, PeepholeOptions, InstrEntry } from "./peephole.js";
  export { optimizeInstr, validateProgramStructure, V1_RULES } from "./peephole.js";
  ```
  This flows out through `packages/codegen/src/index.ts` (`export * from "./instr/index.js"`).
- **RD-09 (future consumer):** the ACME emitter driver calls `optimizeInstr(program, cpu, bag)`
  between `generateInstr`/`assembleProgram` and serialization.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `program.streams` not an array | ICE `E90001` via `bag.addICE`, return early | PF-006 / RD R30 |
| Malformed / null `StreamEntry` | ICE `E90001` per offending entry | PF-006 / RD R30 |
| `options.enabled === false` | Return input reference, no validation | RD R27 |
| Any user-band error/warning | Never emitted by this stage | RD R30 |

## Testing Requirements

- Unit (spec) tests: signature/return contract, byte-identical passthrough, disabled-flag
  passthrough, `PeepholeRule` shape, structural-ICE on malformed input, determinism,
  preamble/allocationPlan verbatim. See [07-testing-strategy.md](07-testing-strategy.md).
- Implementation tests: empty program, multi-stream program, program with labels/directives,
  null-entry edge case, `enabled: true` explicit path.
