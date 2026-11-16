# Bounded sprite-publication proof

> **Status**: Complete — bounded proof/poll checkpoint green; whole-program #168 remains open
> **Created**: 2026-11-16 14:17
> **Implements**: blend65-v4/RD-08
> **CodeOps Artifact Schema**: 1

## Minimum-Sufficient Baseline

**Original goal:** deliver #168's seven-byte raster poll without dropping source-selected display
data, raw-address observations or other source/platform effects. The parent task owns whole-program
parity and all existing benchmark evidence.

**Smallest viable design:** a focused source-identity proof that the enabled sprites fetch only
the immutable resident asset, using a finite bounded-counter property and asset-relative offsets.
Integrate that proof only into anonymous adjacent byte-comparison forwarding before retention.
Reuse existing CFG, value, footprint, domain, layout and storage-closure contracts.

**Excluded machinery:** general interval/loop/hardware-state engines, interprocedural analysis,
new IR/pass/runtime/framework, optional `none` candidate search, source annotations and blanket
private-memory exemptions. Unknown cases keep ordinary lowering.

**Approved complexity:** [AR-1](00-ambiguity-register.md). Scope approval is not proof or a preflight
pass. The precise design and feasibility argument are in [the component](03-publication-proof.md).

## Documents

| Document                                   | Owns                                                  |
| ------------------------------------------ | ----------------------------------------------------- |
| [Register](00-ambiguity-register.md)       | Scope and decision authority                          |
| [Requirements](01-requirements.md)         | Plan-local requirements                               |
| [Current state](02-current-state.md)       | Verified producer/consumer seams                      |
| [Proof component](03-publication-proof.md) | Algorithms, signatures and enabling/fallback contract |
| [Testing](07-testing-strategy.md)          | Independent expected cases                            |
| [Execution](99-execution-plan.md)          | Sole task-progress checklist                          |

## Specialist Agents

**New specialist check: None.** Existing roles cover every affected contract
(`codeops/agent-routing.md:52–59`). No recurring capability gap or new independent authority is
identified. Dynamic bounded packets are sufficient.

| Existing role           | Responsibility                                                          |
| ----------------------- | ----------------------------------------------------------------------- |
| correctness-reviewer    | Correctness, standards, maintainability and exact oracle authority      |
| semantics-reviewer      | Values/effects, preserved source behavior and modern-source ergonomics  |
| sfa-abi-auditor         | Anonymous versus named storage, domain and final closure                |
| target-platform-auditor | Sprite fetch visibility, selector mirrors, startup/firmware assumptions |
| machine-code-auditor    | Actual poll bytes/cycles and complete cost attribution                  |
| performance-auditor     | Finite convergence, indexing, allocation and scaling                    |

The primary owns implementation. Independent specification authors and reviewers remain separate.
Four total active agents maximum; VICE is always serialized. Expert `2.0.4`, immutable content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; selected normative references and source keys remain
those in the parent [evidence](../boing-ball-parity/08-evidence.md). No authority is edited.
