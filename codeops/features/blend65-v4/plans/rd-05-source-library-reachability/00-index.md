# Source-library reachability prerequisite

> **Feature**: Approved cold-library correction
> **Status**: Complete — 10/10 verified; RD-05 and keyboard qualification remain open
> **Created**: 2026-10-08
> **Implements**: blend65-v4/RD-05
> **CodeOps Artifact Schema**: 1

## Minimum-sufficient baseline

Original goal: implement RD-05's accepted ordinary-source input library without charging old
callers for unused acquisition. This plan implements only the prerequisite approved in
[keyboard AR-P7](../rd-05-keyboard-input/00-ambiguity-register.md#ar-p7--selected-library-reachability-discovery).
Smallest viable design: correct entry classification and filter proved cold private data in
existing semantic closure before its storage consumers. Excluded machinery: package-special
semantics, a library-build mode, new resolver/optimizer, runtime or input manager. Approved
complexity: imported AR-1; technical contract is owned by the component specification.

| Document                                  | Purpose                                 |
| ----------------------------------------- | --------------------------------------- |
| [Decisions](00-ambiguity-register.md)     | Authority and closed questions          |
| [Requirements delta](01-requirements.md)  | Exact prerequisite boundary             |
| [Current state](02-current-state.md)      | Producer/consumer evidence              |
| [Closure contract](03-01-reachability.md) | One focused component                   |
| [Test strategy](07-testing-strategy.md)   | Independent behavior/output cases       |
| [Execution](99-execution-plan.md)         | One phase, specification-first progress |
| [Closeout](08-closeout.md)                | Qualified boundary and open ownership   |
| [Phase review](09-phase-review.md)        | Findings, fixes and one re-review round |

No public API or source syntax is added. For example, importing a constant does not make an
unrelated exported function an executable entry. This benefit applies equally to user and
installed source. Keyboard acquisition/decoder planning remains with its existing owner.

Approved AR-8 extends only fixed-address selection in `machine/lower-memory.ts`, physical
zero-page reporting in `services/memory-evidence-records.ts` and focused internal tests. These
common defects were exposed by the unchanged new output/resource oracles; no support layer is added.
