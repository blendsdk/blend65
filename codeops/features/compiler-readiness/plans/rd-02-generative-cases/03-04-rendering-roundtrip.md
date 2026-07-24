# Source Rendering and Independent Round Trip

> **Document**: 03-04-rendering-roundtrip.md
> **Parent**: [Index](00-index.md)

## Overview

The renderer emits deterministic Blend65 source from the independent IR. A separately authored
tokenizer and Pratt parser produce a projection tree for structural comparison (AR-P7).

## Renderer

- fixed LF newlines and two-space indentation;
- deterministic module/declaration order from IR;
- canonical decimal literals except explicit spelling-variant cases;
- parentheses derived from a renderer-owned precedence table;
- no comments, timestamps, host paths or nondeterministic object iteration;
- UTF-8 source byte limit checked before return.

## Independent inverse

The inverse accepts only the emitted subset. It owns its own tokenizer and precedence table and
does not import renderer helpers. Its output is `RoundTripModule`, a structure-only tree that
preserves module boundaries, declaration order, identifiers, types, literal values, selected
spelling class and operator grouping.

`projectForRoundTrip(ir)` is compared deeply with `parseRenderedSource(source)`. Normalization may
ignore whitespace, numeric-base surface spelling where the case does not select that spelling, and
redundant parentheses. It may not reorder, fold, rename or infer semantics.

A static module-graph gate forbids tokenizer/parser/normalizer production files from importing
renderer modules, renderer tables or formatting helpers. Only neutral IR types and token-kind
discriminators may cross the boundary. Frozen, spec-derived vectors cover every emitted token,
literal spelling, normalization rule, precedence level and associativity class.

## Mutation contract

The tests inject renderer operator-precedence and parenthesis-policy tables through test-only
factories. Every precedence level and associativity class has a discriminating IR example that
the independent inverse rejects after mutation.

## Real parser boundary

The production frontend is not imported. RD-04 later renders the source to the real compiler.
RD-02 may use a child process only for its own fresh-process replay proof, not compiler execution.

## Error handling

| Error | Result | AR Ref |
|---|---|---|
| Unsupported source token/construct | `roundtrip-unsupported` | AR-P7 |
| Structural mismatch | `roundtrip-mismatch` with bounded path | AR-P7 |
| Invalid UTF-8/oversize source | Input/budget diagnostic | AR-P11, AR-P12 |
