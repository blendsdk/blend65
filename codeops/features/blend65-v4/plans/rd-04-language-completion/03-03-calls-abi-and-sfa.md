# Calls, ABI and SFA: RD-04 Language Completion

> **Document**: 03-03-calls-abi-and-sfa.md
> **Parent**: [Index](00-index.md)

## Overview

This component completes ordinary and indirect calls, aggregate results, recursion rejection,
interrupt execution domains, deterministic compile-time functions and final Static Frame
Allocation. The ABI is explicit shared data. No source-visible destination parameters, dynamic
frames, software stack, registry or runtime is introduced.

## Architecture

### Current Architecture

The compiler already builds direct-call edges, closes a reachable graph, rejects direct/mutual
cycles, derives value lifetimes, inventories function storage, computes interference, allocates
homes and iterates helper/resource binding to a closure certificate.

### Proposed Changes

- Extend direct calls to all parameter/result shapes and nested staging.
- Add typed finite function target sets and structured indirect-call operations.
- Add caller-owned aggregate result destinations and alias-safe snapshots.
- Add mainline/IRQ/NMI/startup/callback domains and sink-selected entry variants.
- Add exact CPU/status-stack ownership and finite hardware-stack accounting.
- Add a bounded deterministic compile-time evaluator which reuses typed semantics but emits no
  target operations.
- Return every new pointer, spill, variant and helper scratch demand to the existing closure loop.

## Implementation Details

### Call and Callable Records

Call operations distinguish direct and finite indirect targets. A finite target set retains exact
source function identities plus signature and handler kind. Set joins are deterministic and
monotonic. An imprecise but closed value widens to every address-taken source function with the
exact signature; an erased raw word never becomes callable.

Singleton sets lower as direct calls. Larger sets use one predefined finite dispatch form whose
selector, pointer pair and scratch are explicit SFA demands. This is per-call lowering, not a
runtime registry (AR-P8).

### ABI Family

| Boundary | ABI |
|---|---|
| Scalar/enum parameter | Value copied into the callee's SFA home after left-to-right caller staging |
| Exact array/struct parameter | Two-byte base address |
| Outer-unsized array parameter | Two-byte base address plus two-byte element count |
| Byte/sbyte/boolean/enum result | A |
| Word/sword result | A low, X high |
| Fixed aggregate result | Caller-owned destination selected before the call |
| Ordinary direct/indirect call | `JSR`/`RTS` with explicit clobbers and stack cost |
| Interrupt entry | Profile-selected raw/firmware variant with its terminal owner |

Nested calls stage earlier values outside homes an inner invocation can overwrite. Aggregate
results construct directly into final storage when proof permits; otherwise an overlap-safe
SFA-owned snapshot/copy is recorded and costed.

### Whole-Program and Recursion

Roots include startup, initializers, `main`, finite indirect targets, address-taken/exported
functions, recognized callbacks/interrupts and selected helpers. SCC detection runs before
allocation. Direct, mutual and finite-indirect recursion report complete paths; repeated sequential
and nested argument calls remain legal.

### Interrupt Domains

The selected profile supplies recognized sinks, source kind, entry variant, domain, vector and
preemption facts. Whole-program analysis emits only reachable variants. SFA assigns disjoint homes
to feasible overlapping activations and shares storage-free code only when its callees remain
identical. Shared globals/MMIO remain genuinely shared and receive lost-update/tearing analysis.

The compiler statically tracks per-sink install/restore ownership, balanced nesting, join agreement,
predecessor-word demand and raw-vector invalidation. It adds no runtime token, flag or scheduler.

### Compile-Time Execution

`comptime` functions use resolved typed bodies and a dedicated evaluator at the semantic boundary.
The evaluator owns:

- deterministic root order and direct acyclic calls;
- exact Blend65 integer/aggregate semantics;
- the frozen step, live logical byte and active-call meters;
- validated embedded data only;
- explicit rejection of runtime, MMIO, CPU controls, indirect calls and host nondeterminism; and
- all-or-nothing results with no target code/storage on failure.

Production limits are constants, not configuration. Tests use an internal reduced-limit entry to
prove N/N+1 behavior without executing millions of fixture operations.

### SFA Closure

`StorageRequest` gains only facts required by current ABI consumers: activation/domain identity,
aggregate destination/snapshot class, pointer-pair constraints, entry variant and helper owner.
The existing monotonic loop remains authoritative:

1. inventory typed execution homes;
2. legalize/select required helpers and pointer forms;
3. bind resources and discover spills/scratch;
4. merge new requests and recompute interference/allocation;
5. stop only at an identical bounded inventory fingerprint;
6. freeze a certificate which downstream validators enforce.

Global data, assets and loader buffers remain outside SFA.

## Integration Points

| Producer | Consumer | Contract | AR Ref |
|---|---|---|---|
| Frontend signatures | Call lowering | Exact types, const access and handler kind | AR-P8 |
| Whole-program graph | SFA | Complete roots, targets, domains, effects and recursion result | AR-P2 |
| ABI | Machine lowering | Homes, registers, flags, stack, scratch and entry/exit ownership | AR-P4 |
| Legalization/binding | SFA closure | Every newly required execution byte returns before emission | AR-P8 |
| Compile-time evaluator | Semantic program | Exact constant value or terminal diagnostic; no partial output | AR-P3 |

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| No finite compatible call target set | Canonical function-value diagnostic before allocation | AR-P1 |
| Recursive SCC | Report the complete deterministic cycle before allocation | AR-P1 |
| Unbounded interrupt reentry | Diagnose unsupported finite storage proof; add no runtime | AR-P1 |
| Stack/ZP/RAM/interference failure | Report path, demand, availability and source remedy | AR-P1 |
| Compile-time budget N+1 | Fail before mutation; poison the root and publish nothing | AR-P3 |
| Post-closure storage demand | Reject or return the pipeline to closure; never allocate in emission | AR-P8 |

## Testing Requirements

- Nested call staging, aggregate parameter/result and alias-overlap matrices.
- Precise/widened finite function sets, singleton/multi-target dispatch and recursion SCC cases.
- Mainline/IRQ/NMI overlap, sink variant, save/restore, stack and shared-state cases.
- Compile-time evaluator semantic, forbidden-effect, exact-meter and deterministic-order cases.
- SFA inventory/interference/allocation/closure cases for every home class and resource failure.
