# RD-17: Commercial-Game Toolchain Capability Integration

> **Status**: Approved
> **Created**: 2026-07-24
> **Project**: Commercial-Game Optimizer and Code Generator
> **Depends On**: RD-01, RD-15
> **Complexity**: L
> **CodeOps Artifact Schema**: 1

## Feature Overview

Define the capabilities outside optimization/codegen that a complete commercial-game toolchain
still needs. The feature must publish honest dependency/blocker status so performance success can
never conceal an inexpressible, unloadable, inaudible or unpackageable game.

This RD has two delivery slices. Its minimal `TargetMachineContract` foundation and current-profile
migration land in Phase A before RD-02 consumers. Its external capability graph and per-target
commercial certification complete here after RD-15.

## Functional Requirements

### Must Have

- [ ] Consume explicit versioned capability status for language conformance/computed memory,
  indirect calls/platform ABI, platform libraries, asset pipeline, fixed-point math, sound/tracker,
  disk/fast loader, streamed data, overlays/linking, debugging/profiling and release packaging.
  (AR-24)
- [ ] Define required evidence contracts for each capability rather than infer availability from
  files, issues or optimizer output.
- [ ] Map every RD-15 workload and feasibility-matrix game row to all required capabilities.
- [ ] Treat missing/unassured capability as a named blocker, never skip/pass/degraded fidelity.
- [ ] Keep ownership in the responsible feature; this feature consumes status and does not copy
  implementation logic.
- [ ] Require zero-cost modern platform-library APIs for hardware operations represented in
  game-shaped workloads. (AR-20)
- [ ] Validate cross-feature revisions/claims and reject stale/mismatched provider evidence.
- [ ] Produce an ordered unlock report based on grounded game impact and dependency prerequisites.
- [ ] Trigger feasibility-matrix refresh only through its manual maintenance workflow after a
  capability is genuinely shipped.
- [ ] Keep generic optimizer and code-generator contracts target-profile-driven; target costs,
  instruction sets/addressing modes, ABI, memory regions, effects and timing facts come from a
  versioned provider rather than C64 constants in shared analysis. (AR-25)
- [ ] Consolidate the current interim semantics profile and canonical platform profile into one
  versioned `TargetMachineContract` before effects, placement, allocation, selection or proof
  implementations consume target facts.
- [ ] Gate every target's commercial-quality claim independently. C64/NMOS 6502 evidence cannot
  certify C64 Ultimate, Commander X16, Atari 800XL or Atari 7800 output.

### Should Have

- [ ] Maintain original integration fixtures spanning optimizer plus two or more external
  capabilities.
- [ ] Report which blocker is first on each dependency chain.

### Won't Have

- Reimplementing storage, sound, asset, math, linker or debugger systems here.
- Marking games feasible by removing characteristic fidelity.
- Automatically editing the capability matrix from partial optimizer progress.

## Technical Requirements

Capability records have stable ID, provider feature/target, semantic revision, status, evidence
links, target/platform, dependencies and fidelity claims. Only `shipped` plus passing evidence
satisfies a dependency.

`TargetMachineContract` minimally owns CPU legality/addressing, exact opcode costs, ABI/clobbers,
memory/banking/regions, volatile and bus effects, interrupt/timing semantics, reserved resources,
output/link constraints and its content revision. The early foundation exposes no speculative
cross-target operation: every field is justified by an existing C64 consumer or current platform
contract.

## Integration Points

| Capability | Required provider |
|---|---|
| Correctness/expressiveness | `blend65-conformance` |
| Semantic campaigns | `compiler-readiness` |
| Expert parity | `asm-parity` |
| Indirect call/platform ABI | compiler/conformance follow-on |
| Platform APIs | `@blend65/platforms` follow-on |
| Asset pipeline | asset-tooling follow-on |
| Math | platform/math library follow-on |
| SID/tracker | sound library/ABI follow-on |
| Disk/streaming | storage/loader follow-on |
| Overlays/relocation | linker follow-on |
| Debug/profiling | CLI/VS Code/tooling follow-on |
| Packaging/hardware proof | release tooling/harness follow-on |

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Completeness | Explicit external capability graph | AR-3, AR-24 |
| Fidelity | No demake substitution | AR-2 |
| Ownership | Consume, never copy | AR-4, AR-24 |
| Target portability | Shared mechanisms, independently assured target profiles | AR-25 |

## Security Considerations

Capability records are closed local data with repository-relative validated evidence links. No
network publication, credentials or external issue mutation is authorized by this RD.

## Acceptance Criteria

1. [ ] Every external capability named above has one stable provider/status record and evidence
   contract.
2. [ ] Every game-shaped workload and tracked game row resolves to a complete dependency set or a
   named blocker path.
3. [ ] Commando-class scrolling remains optimizer-bound while The Last Ninja-class multiload
   remains streamed-data-bound until both provider claims actually ship.
4. [ ] A stale/mismatched provider revision blocks integration and names the expected/actual
   revision.
5. [ ] Removing scrolling, sound, streaming, sprites or another characteristic requirement cannot
   turn a blocked faithful row into passing.
6. [ ] No provider implementation logic or copied semantic/cost authority exists in this feature.
7. [ ] Zero-cost platform wrappers match expert instruction/cycle/byte evidence.
8. [ ] The unlock report is dependency ordered and does not rank work that cannot start before an
   unmet prerequisite.
9. [ ] The feasibility matrix changes only through the manual `update_capability` workflow after
   confirmed shipped evidence.
10. [ ] A shared optimizer test runs against a synthetic target profile without importing C64
    register addresses, memory regions, ABI constants or opcode tables.
11. [ ] Replacing any target-profile revision invalidates that target's cost/proof evidence without
    invalidating byte-identical evidence for unrelated targets.
12. [ ] No target is labeled commercial-game-class until its own semantic, expert-parity,
    hardware-execution and game-shaped corpus gates pass.
13. [ ] Semantic analysis and allocation consume the selected canonical plugin contract, never the
    interim default profile; one profile revision owns each target fact.
14. [ ] The optimizer-quality gate reports external blockers without treating them as failures of
    generated-code quality; only the portfolio toolchain-ready gate requires them all shipped.
