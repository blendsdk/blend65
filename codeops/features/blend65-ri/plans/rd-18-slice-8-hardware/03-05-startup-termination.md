# Startup Termination Analysis: RD-18 Slice 8a

> **Document**: 03-05-startup-termination.md
> **Parent**: [Index](00-index.md)
> **Governs**: the `startup: "auto"` termination analysis and shim-variant selection.
> **Spec**: Ch 10 §5 (+ F004); platform appendices (termination policy). **AR**: 25.

## Overview

The `"non-terminating"` shim (`JMP _main`, `shared-hooks.ts:110-112`) is shipped and manually
reachable (`startup: "minimal"` → `toShimVariant`, `emit.ts:38-51`). This component replaces the
hardcoded `"terminating"` fallback under `auto` (`instr-program.ts:205-213` — the SEAM comment
explicitly deferred this until CFG lowering existed) with a conservative reachability analysis.

> **Recorded pre-existing deviation (preflight PF-010):** F004 and Ch 10 §5.3 mandate
> fall-through entry into `main` ("no JSR, no JMP"); the shipped shims use `JSR _main` /
> `JMP _main` (`shared-hooks.ts:105,111`), embodied in all ten prior goldens. ST-34/35 pin the
> SHIPPED shim contract (AR-25), not F004's entry mechanism. (Similarly, Ch 03 §5.1's
> ZP-before-RAM init order is superseded by the shipped dependency-topological `__init` order,
> Ch 10 §5.4 — golden-visible only.)

## Implementation Details

### The analysis (IL layer)

After lowering, analyze `_main`'s IL CFG:

- **Question**: is any `ret` terminator reachable from the entry block?
- **Walk**: BFS over block successors with ONE const-awareness rule — a `brcond` whose
  condition operand is a literal constant follows ONLY the taken edge (this is what makes
  `while (true)` loops — lowered as a CFG back-edge with a constant condition — analyze as
  non-returning). Every other terminator contributes all its successors.
- **Result**: `mainCanReturn: boolean`, carried on the IL program to `assembleProgram`.

**Conservative bias (AR-25, load-bearing):** misclassifying a returning `main` as
non-terminating emits `JMP _main` and the final `RTS` underflows the stack — a crash.
Misclassifying a non-returning `main` as terminating wastes 5 dead shim bytes. Therefore the
analysis claims non-terminating ONLY when NO `ret` is reachable under the rule above; any
uncertainty (non-literal conditions, unusual terminators) resolves toward `terminating`.

### Selection (`derivePreambleOptions`, `instr-program.ts:205-213`)

Precedence, replacing the hardcoded value:

1. An explicit override (`overrides.shimVariant`, from config/CLI `terminating`/`minimal`/
   `bare`) wins unchanged.
2. Platform policy: `getMainTerminationPolicy().canReturn === false` (a7800) →
   `"non-terminating"` regardless of analysis (there is nowhere to return to; the platform
   shim owns the halt).
3. Otherwise: `mainCanReturn ? "terminating" : "non-terminating"`.

Programs without `main` (`--library`, direct `emitAsm` paths) skip the analysis and keep
today's behavior — guard, don't crash.

### What is deliberately NOT done

- No diagnostic for a non-returning `main` (void `main` falling off or looping is fully
  conformant, Ch 05/Ch 06 — E10102 is for non-void functions only).
- No dead-code elimination of `_main`'s own unreachable trailing `RTS` (1 byte, Phase A).
- No spec `loop {}` construct exists — `while (true)` is the idiom; nothing to add.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| analysis uncertainty | resolve toward `terminating` (safe direction) | AR-25 |
| no `main` in the compilation | skip analysis; existing behavior | AR-25 |

## Integration Points

- 03-06's fixture relies on rule 3 selecting `"non-terminating"` under default config; the
  golden shows `JMP _main` and NO restore/RTS tail. Existing terminating-fixture goldens
  (slices 3a..7b — every prior `main` returns) must be BYTE-EXACT: their `ret` is reachable,
  so rule 3 keeps `"terminating"`.

## Testing Requirements

ST-34..ST-38: `while(true)` main → non-terminating shim; returning main → terminating;
explicit `--startup terminating` beats the analysis; branch-condition-not-literal →
terminating (conservative); prior goldens unchanged.
