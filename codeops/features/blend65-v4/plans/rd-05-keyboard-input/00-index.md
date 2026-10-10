# Keyboard and combined-input library

> **Status**: Plan Preflighted — five MINOR draft corrections verified; implementation not started
> **Created**: 2026-10-10
> **Implements**: blend65-v4/RD-05
> **CodeOps Artifact Schema**: 1
> **Review**: [Full-plan preflight](00-preflight-report.md), 2026-10-10

## Minimum-sufficient baseline

**Original goal:** give ordinary Blend65 programs named keyboard and both-port
joystick queries over one saved acquisition, with honest uncertainty and expert
6502 output. This is the remaining input slice, not RD-05 closeout.

**Smallest viable design:** extend the existing installed `c64.input` source
module. Separate pure saved-data queries from one bounded CIA1 transaction using
the existing scoped NMI installation. Correct the three demonstrated output
patterns in their existing compiler consumers before introducing library source.

**Excluded machinery:** automatic owner admission, input/state manager, cache,
retry, queue, scheduler, graph/search decoder, new optimizer pass, IR kind,
runtime, dependency or harness. No source casts or unrolling policy are imposed
to compensate for compiler output defects.

**Approved complexity:** [AR-P12](00-ambiguity-register.md#ar-p12--named-existing-consumer-correction-scope).
[AR-P1–AR-P11](00-ambiguity-register.md#ambiguity-register) own the accepted
contract and completed prerequisites. AR-P6 is the only old-test exception.

## Documents

| Document                                          | Owns                                                  |
| ------------------------------------------------- | ----------------------------------------------------- |
| [Decisions](00-ambiguity-register.md)             | Accepted scope and behavior; historical discovery     |
| [Requirements](01-requirements.md)                | Thin RD scope and completion boundary                 |
| [Current state](02-current-state.md)              | Actual producer/consumer seams and dependencies       |
| [Output corrections](03-01-output-corrections.md) | Three bounded lowering contracts                      |
| [Saved-data library](03-02-saved-input.md)        | Source declarations and query implementation design   |
| [Acquisition](03-03-acquisition.md)               | Scoped transaction, ownership and failure paths       |
| [Testing](07-testing-strategy.md)                 | Independent expected inputs/outputs and qualification |
| [Execution](99-execution-plan.md)                 | Sole mutable task progress                            |

Two phases: output corrections, then the complete ordinary-source library and
input qualification. Each is specification-first. The existing project rule is
directed tests during tasks, then install/build/typecheck/full tests at each
phase checkpoint; the user already approved that rule for RD-05. Native VICE
cases run sequentially. Green local commits are automatic; pushes are not.

Applicable lenses: compiler/language, asynchronous concurrency and source-module
compatibility (data/migration). Existing source masks, raw joystick operations,
module identity and package loading remain compatible. The version boundary is
one compiler distribution and its exact bundled-source hash per analysis/build;
source using the existing APIs and noncolliding user module contributions
recompiles unchanged. A contribution that duplicates a new library declaration
gets ordinary E10003; rename it or move it to the user's own module when upgrading.
The approved names and ordinary merged-module rules remain unchanged.
Existing input identity invalidates changed
library generations. There is no mixed-version link window, serialized snapshot
protocol or persistent migration. Rollback restores the complete coherent local
checkpoint and rebuilds, not partially mismatched compiler/library bytes. No
distributed runtime or new host security boundary is introduced.

Lineage: frozen expert **2.0.4**, content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; Specification 4.0 identity
`BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`.
NMOS 6510; four cooperative PRG profiles; ACME 0.97; VICE 3.10; Linux Node 22+;
optimization `none`, default safety off, with directed bounds-on guards.
Neither frozen authority changes. Runtime, complete output costs and physical
hardware remain unqualified by this plan.
