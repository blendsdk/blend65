# Machine and Artifacts: RD-04 Language Completion

> **Document**: 03-04-machine-and-artifacts.md
> **Parent**: [Index](00-index.md)

## Overview

This component completes deterministic `optimization: none` lowering, resource binding, C64
layout, ACME serialization, packaging and evidence. It selects one predefined correct legal form
for each closed semantic case. It performs no optional candidate search, peephole catalog or expert
ranking inside the compiler (AR-P4).

## Architecture

### Current Architecture

Structured `MachineInstruction` and terminator records carry operands, state effects and costs.
Machine lowering requests storage, resource binding feeds demands back to SFA, validation enforces
the selected NMOS target, block layout repairs branches, C64 layout places code/data/storage/assets,
ACME emits and assembles the program, and artifact validators reconcile sidecars before atomic
publication.

### Proposed Changes

- Add structured machine forms only where existing forms cannot express a current semantic case.
- Complete scalar, aggregate, control, address, call, safety-stop and interrupt lowering.
- Keep every helper's parameters, results, clobbers, scratch, reentrancy and costs explicit.
- Validate documented NMOS 6502 operations/addressing modes and selected 6510 memory-port facts.
- Complete final layout, debug, memory, SFA, stack, cost and hash evidence for all language paths.
- Keep the service pipeline and coherent publication protocol unchanged.

## Implementation Details

### Direct `none` Selection

For each typed semantic case, lowering chooses one deterministic direct sequence or required helper.
Selection may depend on semantic width/signedness, known constant, bound storage/address form,
profile capability and mandatory legality. It may not enumerate alternatives or compare B/R/T
scores. Required constant evaluation, unreachable exclusion, instruction selection, SFA closure,
layout and branch repair remain enabled because they are correctness stages.

### Operation Families

| Family | Machine obligations |
|---|---|
| Scalars | Exact conversions, arithmetic, Boolean, comparison, shifts, multiply, divide/remainder and BCD |
| Control | Explicit branches, short circuit, switch, loops, returns, safety stops and long-branch repair |
| Memory | Symbolic/direct/indirect addresses, little-endian words, volatile order and modulo-65536 continuation |
| Aggregates | Field/index addresses, construction, direct destination, overlap-safe copy and borrows |
| Calls | Direct/finite indirect dispatch, parameter homes, register/aggregate results and stack cost |
| Interrupts | Sink-selected prologue/tail, D-state, save ownership, vectors and terminal instruction |
| CPU controls | Exact five public operations with status-stack and interrupt effects |

Every instruction sequence retains source association, exact flag/register effects and attributable
bytes/cycles. A helper is linked only when reachable.

### Legality and Resource Binding

`validate.ts` rejects undocumented or CMOS-only opcodes, illegal addressing, unknown flag
preconditions, bad branch ranges, unbound operands and storage outside the closure certificate.
Pointer pairs cannot start at `$FF`. Explicit user zero page, compiler homes, stack, helpers and
reserved profile ranges remain separate resource classes.

### Layout, ACME and Publication

Layout places code, globals, constants, user ZP, SFA, admitted resident assets and required helper
data without overlap. It honors symbolic placement, alignment, no-cross, region, banking and
visibility constraints. ACME remains `--cpu 6502`; serialization never becomes a textual semantic
IR and source content cannot inject directives or arguments.

After ACME, evidence reconciles actual labels, report ranges and bytes before publication. Any
failure removes owned staging or reports recovery-required; stale artifacts never appear current.

### Evidence Completion

Existing schema versions remain fixed. RD-04 populates their currently missing records:

- exact source type, symbol, function, call context and generated origin;
- SFA request/home, interference, domain and closure identity;
- code/data/BSS/assets/helper/ZP/stack/scratch/padding/reservation costs;
- CPU/physical/VIC memory views and occupied/free compatible holes;
- selected checks, helpers, entry variants and path cycles; and
- frozen spec, expert, compiler, profile, ACME and VICE identities where applicable.

No dashboard or new evidence product is added (AR-P6).

## Integration Points

| Producer | Consumer | Contract | AR Ref |
|---|---|---|---|
| Semantic program | Machine lowering | No guessed source semantics; all required facts explicit | AR-P8 |
| Machine lowering/binding | SFA | New execution storage returns to closure | AR-P8 |
| Closure certificate | Validator/emitter | Every function-lifetime address is frozen | AR-P8 |
| Layout/ACME | Evidence | Final report/symbol/byte reconciliation | AR-P3 |
| Qualification | Compiler release | Independent expert floor; no in-compiler selection | AR-P4 |

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Semantic case lacks legal lowering | Terminal compiler failure; never emit plausible output | AR-P3 |
| Machine operation violates selected CPU | Validator failure before serialization | AR-P3 |
| Resource/layout conflict | Canonical diagnostic with demand, blockers, holes and remedies | AR-P1 |
| ACME mismatch or failure | Assembler failure and no publication | AR-P3 |
| Evidence mismatch | Packaging failure and owned staging cleanup | AR-P3 |
| Expert result is worse | Block phase completion and fix lowering | AR-P4 |

## Testing Requirements

- Independent value/state cases and exact assembled bytes for every machine operation family.
- Flag, register, stack, scratch, helper, branch-range, address-wrap and MMIO-order cases.
- Layout conflicts, boundary fits, placement, banking and resource reconciliation cases.
- Artifact schema, ACME report/symbol/byte and atomic-publication failure cases.
- Structural assertions that `none` emits no optional decision/search evidence.
