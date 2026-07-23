# RD-03: Independent Semantic, Diagnostic and Metamorphic Oracles

> **Document**: RD-03-independent-oracles.md
> **Status**: Approved
> **Created**: 2026-07-23
> **Project**: Compiler Readiness
> **Depends On**: RD-01
> **CodeOps Artifact Schema**: 1

## Feature Overview

Determine expected results without treating compiler output as truth. A deliberately bounded
reference interpreter covers concrete values and state; independent metamorphic relations test
semantic equivalence beyond that first subset.

## Functional Requirements

### Must Have

- [ ] Implement a pure reference evaluator over the independent generator IR. It must not import
  compiler lexer, parser, semantic, constant-folding, IL or codegen implementation. (AR-5)
- [ ] Declare the evaluator's supported rule subset explicitly; unsupported evaluation never
  becomes a pass or silent skip.
- [ ] Model exact v3.0 evaluation order, integer width/sign, overflow, control flow, calls, state
  and bounded memory effects for included rules.
- [ ] Define diagnostic oracles from inventory rule contracts and stable diagnostic codes.
- [ ] Define semantics-preserving transformations including identifier renaming, literal-to-local,
  local-to-parameter where equivalent, algebraic identities, independent-declaration reordering
  and bounded loop unrolling where valid.
- [ ] Require transformed programs to produce identical diagnostics or observable state according
  to each relation's contract.
- [ ] Mutation-test interpreter operations, diagnostic expectations and metamorphic relations.

### Won't Have

- A second full Blend65 compiler.
- Use of emitted assembly, current goldens or current diagnostics as expected-value generators.
- Metamorphic transformations whose preconditions are not machine-checkable.

## Technical Requirements

Reference state is finite: typed scalar values, bounded arrays, module/local bindings, call frames
and a bounded abstract memory map sufficient for generated observables. Each operation cites its
specification rule ID. Execution stops with a classified oracle-budget failure rather than
guessing when the configured step bound is exceeded.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Absolute oracle | Bounded pure interpreter | AR-5 |
| Supplemental oracle | Metamorphic relations | AR-5 |
| Semantic authority | Frozen specification | AR-1 |

## Security Considerations

The evaluator executes only its closed IR, never JavaScript/source text. Arithmetic and collection
sizes are bounded. No dynamic module loading, `eval`, shell calls, network, credentials, PII,
authentication or encryption surface exists.

## Acceptance Criteria

1. [ ] A dependency-boundary test rejects imports from `core`, `frontend`, `codegen` and
   `compiler` implementation packages in oracle code.
2. [ ] Reference tests cover zero, minimum, maximum and overflow boundaries for byte, sbyte, word
   and sword operations included in the first subset.
3. [ ] A case outside the interpreter subset is reported `oracle-unmodeled`, never pass.
4. [ ] Each metamorphic transformation proves its precondition before application and records the
   source and transformed case IDs.
5. [ ] Injected wrong arithmetic, evaluation order and diagnostic-code mutations each make at
   least one oracle specification test fail.
6. [ ] Exceeding the evaluator step bound produces a distinct oracle-budget failure and cannot
   count toward compiler readiness.
