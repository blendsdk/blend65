# RD-01: Optimization Authority, Cost Model and Commercial Acceptance

> **Status**: Approved
> **Created**: 2026-07-24
> **Project**: Commercial-Game Optimizer and Code Generator
> **Depends On**: —
> **Complexity**: XL
> **CodeOps Artifact Schema**: 1

## Feature Overview

Define the non-circular authorities and exact multi-resource cost model used by every later
optimizer decision. A transform is correct only when independent semantic evidence agrees; it is
valuable only when linked output improves the declared commercial-game objective.

## Functional Requirements

### Must Have

- [ ] Separate semantic correctness, generated-code quality and product-capability status into
  independent result dimensions. (AR-3, AR-5)
- [ ] Measure exact linked program bytes, per-routine bytes, path-sensitive NMOS 6502 cycles,
  zero-page bytes, static frame/RAM, maximum stack depth, data padding, referenced runtime-helper
  bytes/cycles and frame/IRQ worst-case budgets. (AR-15)
- [ ] Compute costs from post-layout/post-relaxation output and the linked memory map; pre-link
  estimates may guide search but cannot satisfy acceptance.
- [ ] Represent cost as a vector with named objectives and hard budgets, never one undocumented
  weighted scalar. (AR-16)
- [ ] Reject any candidate that worsens both bytes and cycles for the same semantic unit.
- [ ] Require every one-axis regression to name the active objective/budget and demonstrate a
  measured whole-program benefit.
- [ ] Link every affected expert twin/corpus row and file a durable issue for any routine that only
  meets rather than beats the expert where a future improvement path exists.
- [ ] Keep performance outside the `C64 v3.0 Ready` semantic claim while making it mandatory for
  the separate commercial optimizer/codegen gate.

### Should Have

- [ ] Retain Pareto-front alternatives for hot regions so later layout/allocation decisions can
  choose without repeating earlier search.
- [ ] Report confidence when a path cost is estimated rather than measured.

### Won't Have

- Copyrighted game source, binaries or assets as acceptance fixtures.
- Instruction count as a substitute for bytes or cycles.
- A reduced-scope demake counting as faithful commercial acceptance.

## Technical Requirements

### Cost vector

```text
Cost = {
  linkedBytes,
  routineBytes,
  pathCycles,
  worstFrameCycles,
  worstIrqLatency,
  zeroPageBytes,
  staticRamBytes,
  maxStackBytes,
  paddingBytes,
  runtimeHelperBytes,
  runtimeHelperCycles
}
```

Cycle accounting uses the target CPU's exact opcode/addressing-mode costs, including taken versus
not-taken branches and page-cross penalties where the resolved layout determines them. Unknown
paths are explicit `unbounded`/`unmeasured` results and cannot satisfy a hard budget.

## Integration Points

- `compiler-readiness` supplies semantic outcomes, never cost truth.
- `asm-parity` owns expert twins, corpus measurements and parity debt.
- RD-09–RD-13 supply candidate and final linked programs.
- The capability matrix consumes shipped capability status only after this feature closes.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Product bar | Commercial-game-class output | AR-1, AR-2 |
| Cost representation | Exact named vector + budgets | AR-15 |
| Trade policy | Pareto non-regression and measured exceptions | AR-16 |
| Semantic/performance relationship | Independent mandatory gates | AR-5 |

## Security Considerations

Inputs are repository-owned program artifacts and generated measurements. Parsers use closed
schemas, finite integers and bounded collections. Reports contain no host paths, environment
values, secrets or arbitrary subprocess output.

## Acceptance Criteria

1. [ ] The same linked fixture measured twice produces byte-identical cost JSON, including all
   eleven fields above.
2. [ ] A branch fixture records distinct taken/not-taken costs and includes the page-cross penalty
   only when its resolved target crosses a page.
3. [ ] A candidate with `bytes +1` and `cycles +1` is rejected under every objective.
4. [ ] A candidate with `bytes +1`, `hotPathCycles -8` is rejected without an explicit speed
   objective/budget and accepted only when the linked whole-program speed budget improves.
5. [ ] Alignment padding appears in `paddingBytes` and linked bytes; it cannot be hidden by a
   smaller code section.
6. [ ] Introducing a runtime helper charges each linked helper once in bytes and every reachable
   call on the relevant path in cycles.
7. [ ] Altering any cost or twin ratio cannot change a semantic readiness result.
8. [ ] Every meet-only expert result emitted by closeout links a filed issue containing measured
   delta and a concrete future optimizer/codegen mechanism.
9. [ ] No acceptance artifact contains copyrighted program bytes or assets from the exemplar games.
