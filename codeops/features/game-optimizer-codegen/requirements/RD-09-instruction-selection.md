# RD-09: Costed NMOS 6502 Instruction Selection

> **Status**: Approved
> **Created**: 2026-07-24
> **Project**: Commercial-Game Optimizer and Code Generator
> **Depends On**: RD-01–RD-08
> **Complexity**: XL
> **CodeOps Artifact Schema**: 1

## Feature Overview

Select expert-quality NMOS 6502 instruction sequences from optimized IL and allocation alternatives.
Selection compares multi-instruction patterns, addressing modes, register/flag states, symbolic
constants and runtime helper calls under exact cost/budget objectives.

## Functional Requirements

### Must Have

- [ ] Use deterministic dynamic programming or an equivalent optimal bounded search over typed
  selection patterns. (AR-11)
- [ ] Carry incoming/outgoing A/X/Y values, status-flag facts, clobbers and memory effects as
  selection state.
- [ ] Choose among immediate, ZP, absolute, indexed, indirect and relocatable-symbolic addressing
  forms using resolved/proven geometry where required.
- [ ] Fuse compare/test/branch and reuse flags when no intervening instruction invalidates them.
- [ ] Select shifts, masks, increments/decrements, carry chains and byte-select idioms over general
  runtime arithmetic when exact.
- [ ] Compare inline versus runtime-helper sequences using linked helper cost and call frequency.
- [ ] Materialize constants/addresses in the cheapest legal form; linker-known expressions remain
  assembler expressions.
- [ ] Respect CPU compatibility and never emit 65C02-only instructions for NMOS 6502.
- [ ] Preserve volatile/effect order and every required label/directive/relocation.
- [ ] Produce multiple Pareto candidates when later layout/allocation can change the winner.
- [ ] Publish a machine-checkable selection-domain certificate for every bounded-optimality claim:
  pattern/enumerator revision, state and cost bounds, legal candidate cardinality, explored and
  rejected counts, equivalence-class/Pareto digest and complete-classification result.

### Should Have

- [ ] Use target-generated pattern tables with exhaustive coverage/ambiguity validation.
- [ ] Re-select small regions after final allocation/layout facts become available.

### Won't Have

- Ordered first-match templates as the quality authority.
- Depending on peephole optimization to repair systematically poor selection.

## Technical Requirements

Pattern contracts name input IL/effects, required entry state, produced instructions, exit state,
clobbers, relocations, CPU variants and exact symbolic cost. Pattern generation rejects ambiguous
equal-priority candidates unless deterministic cost/tie rules distinguish them.

## Integration Points

- RD-08 supplies allocation alternatives.
- RD-10 verifies/improves bounded local sequences.
- RD-11 resolves layout-dependent candidates and relaxation.
- RD-14 validates semantic equivalence and target legality.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Selector | Costed DP/bounded optimal search | AR-11 |
| State | Registers + flags + effects + relocations | AR-11, AR-14 |
| Runtime choice | Linked whole-program cost | AR-15 |

## Security Considerations

Pattern tables are closed generated data validated before use. Search states/candidates are
bounded and deduplicated by canonical keys. No pattern executes code or selects host resources.

## Acceptance Criteria

1. [ ] Every legal IL opcode/type/effect class has at least one NMOS 6502 selection or a deliberate
   runtime/diagnostic fallback.
2. [ ] A comparison consumed immediately by a branch emits no Boolean materialization when flags
   are sufficient.
3. [ ] A flag-clobber between comparison and branch prevents unsafe flag reuse.
4. [ ] `lo`/`hi` of a link-time symbol emits one immediate symbolic operand and no runtime helper.
5. [ ] Multiply/divide/shift constant cases select the least-cost verified inline/helper candidate
   under size and speed objectives.
6. [ ] A ZP candidate uses the shorter/faster addressing form and its cost exactly reflects the
   resolved allocation.
7. [ ] No NMOS campaign output contains a WDC65C02-only opcode/addressing mode.
8. [ ] Volatile writes remain in source-required order across fused patterns.
9. [ ] Each parity-critical selected sequence is instruction-for-instruction equal to or cheaper
   than its expert twin; meet-only output creates a tracked improvement issue.
10. [ ] Equal-cost candidates resolve deterministically and report the tie rule.
11. [ ] An independent small-domain enumerator reproduces each certified frontier, and a seeded
    omitted-cheaper-candidate mutation fails the certificate.
12. [ ] Any result outside a completely certified domain is labeled `best-found`, never `optimal`.
