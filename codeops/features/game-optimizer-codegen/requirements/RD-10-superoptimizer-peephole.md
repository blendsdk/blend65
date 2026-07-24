# RD-10: Verified Superoptimizer and Peephole Catalog

> **Status**: Approved
> **Created**: 2026-07-24
> **Project**: Commercial-Game Optimizer and Code Generator
> **Depends On**: RD-03, RD-09
> **Complexity**: XL
> **CodeOps Artifact Schema**: 1

## Feature Overview

Discover and publish locally optimal NMOS 6502 rewrites through bounded offline search and
independent equivalence validation. Production compilation uses only a deterministic, reviewed,
content-addressed catalog; it never performs unbounded or stochastic search.

## Functional Requirements

### Must Have

- [ ] Define a closed machine-state model covering selected registers, status flags, memory
  regions/effects, termination and cycle/page-cross conditions. (AR-12)
- [ ] Mechanically close that model against the target's legal opcode/addressing surface. Each rule
  either models A/X/Y/SP, relevant PC/control successor, all status semantics, stack/ordinary/MMIO
  effects, cycles and interrupt observability, or is rejected by an enforced restricted-subset
  declaration.
- [ ] Enumerate candidate instruction sequences within explicit byte/instruction/cycle/state
  bounds and CPU legality.
- [ ] Validate candidate equivalence for every modeled entry state, preserving required exit state,
  effects, volatile order and control flow.
- [ ] Reject a candidate if any state is unmodeled, times out or yields a counterexample; unknown is
  never equivalent.
- [ ] Minimize valid candidates by the active cost vector and retain bounded Pareto alternatives.
- [ ] Publish stable rule IDs, preconditions, replacement, proof/evidence digest, CPU compatibility
  and exact cost delta in a closed catalog.
- [ ] Publish a search-domain completeness certificate containing enumerator revision, bounds,
  candidate cardinality, explored/rejected counts and the canonical equivalence-class/Pareto digest.
- [ ] Apply rules across instruction windows without crossing labels, directives, volatile/effect
  barriers or unresolved branch targets.
- [ ] Reach a deterministic production fixed point with cycle detection and an application budget.
- [ ] Revalidate output CPU legality, labels, directives, relocations and program structure.
- [ ] Seed wrong replacement, flag, alias and barrier mutations and require the proof suite to kill
  all mandatory semantic mutants.
- [ ] Preserve the existing v1 empty-catalog/omitted-options `optimizeInstr` contract; production
  assured rules are selected only through the additive versioned RD-03 seam.

### Should Have

- [ ] Support equality-saturation search for bounded pure regions when it remains deterministic.
- [ ] Produce human-readable counterexamples and rule derivations for review.

### Won't Have

- Online random/stochastic production rewriting.
- Rules accepted solely because they pass the current golden corpus.
- Cross-label rewrites without an explicit CFG-level contract.

## Technical Requirements

The validator is implementation-independent from the production matcher/replacer. Exhaustive
validation partitions state by rule-declared live inputs/outputs; memory rules use finite modeled
regions and explicit alias/effect preconditions.

The first release may restrict superoptimization to straight-line, non-stack, non-control,
decimal-disabled, interrupt-atomic windows, but the restriction must be mechanically enforced.
Unmodeled legal instructions never enter a production window. Counterexamples include decimal
ADC/SBC, PHP/PLP, stack wrap, TSX/TXS, JSR/RTS, BRK/RTI, alias/page boundaries and interrupt-state
changes.

## Integration Points

- RD-09 supplies selected instruction candidates.
- RD-03 publishes the catalog/pass revision.
- RD-14 runs independent source/VICE validation in addition to local proof.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Search | Offline bounded exhaustive/equality search | AR-12 |
| Production | Reviewed proven catalog only | AR-12, AR-17 |
| Unknown proof | Reject/coverage gap | AR-5, AR-17 |

## Security Considerations

Search spaces, solver/executor work, outputs and proof logs are bounded. Catalog parsing is closed
and content-addressed. No candidate instruction or rule controls host code execution, paths or
commands.

## Acceptance Criteria

1. [ ] A known equivalent two/three-instruction sequence validates for every declared entry state
   and publishes a stable rule.
2. [ ] One altered opcode, carry precondition, flag output or memory alias produces a concrete
   counterexample and no published rule.
3. [ ] A timeout/unmodeled state is reported `proof-incomplete`, never pass.
4. [ ] Labels/directives/volatile accesses split production windows and remain byte-identical.
5. [ ] Rule application cannot introduce an illegal NMOS opcode/mode or dangling target.
6. [ ] Two fresh catalog generations from the same inputs are byte-identical.
7. [ ] Cyclic rules are rejected at publication or stopped deterministically before production
   output can claim assurance.
8. [ ] The mandatory semantic mutation catalog has a 100% kill rate.
9. [ ] Every applied rule contributes exact hit count and linked bytes/cycles delta to RD-16.
10. [ ] A coverage manifest proves that every legal opcode/mode is either modeled or mechanically
    excluded; deleting one exclusion or state dimension fails validation.
11. [ ] A second small-domain enumerator reproduces the certified frontier, and skipping a cheaper
    candidate prevents publication.
12. [ ] Existing v1 peephole specification tests remain byte-identical and retain their empty
    catalog while versioned production catalogs are independently exercised.
