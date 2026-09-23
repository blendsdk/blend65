# Values and Memory: RD-04 Language Completion

> **Document**: 03-02-values-and-memory.md
> **Parent**: [Index](00-index.md)

## Overview

This component completes scalar, enum, control-flow, array, string, struct, address and aggregate
semantics. Its central rule is to preserve source meaning and effect order until an accountable
consumer can discharge the fact. It extends current typed expressions and semantic operations; it
does not create another IR (AR-P8).

## Architecture

### Current Architecture

The frontend already retains scalar width/signedness, place identity, explicit conversions,
ordered children, partial aggregate layout and effect summaries. Semantic lowering already emits
explicit blocks, symbolic places, loads/stores, arithmetic, direct calls, volatile memory access,
aggregates and merge values.

### Proposed Changes

- Complete semantic types with nominal enums and typed function values.
- Represent contextual outer-unsized array parameters without making `T[]` a storable value.
- Carry ordinal context, extents, strides and narrow barriers through address formation.
- Carry address provenance, physical range and must/may/not-alias facts through legal derivations.
- Add explicit switch, safety-stop and aggregate copy/return semantics to the existing CFG and
  operation union.
- Extend flow facts to correlated conditional effects and normal fixed-point joins.

## Implementation Details

### Type and Value Records

The existing `SemanticType` union gains only current Specification 4 consumers:

```ts
interface EnumType {
  readonly kind: "enum";
  readonly binding: BindingId;
}

interface FunctionType {
  readonly kind: "function";
  readonly handlerKind: "ordinary" | "interrupt";
  readonly parameters: readonly SignatureParameter[];
  readonly returnType: SemanticType;
}
```

An unsized array is a parameter-shape fact containing its fixed element type and carried word
length. It is not added as a general stored `SemanticType`. Loadable status and placement remain
declaration/storage facts rather than pretending to be new scalar types.

### Expression and Arithmetic Rules

- Constant contexts use exact mathematical integer evaluation followed by range checking.
- Runtime expressions use operand width, signed interpretation and deterministic wrap even when
  foldable.
- Places, operands and call arguments evaluate once from left to right.
- `&&`, `||` and `?:` use CFG edges; unselected effects do not execute.
- Assignment results reuse the exact converted value and never reload a volatile target.
- Every operator lowers from retained width/signedness, including signed comparisons/shifts,
  truncating division/remainder and saturated wide shifts.
- Optional bounds/division checks are independent default-off branches to the shared no-runtime
  terminal shape; they do not become a general safety runtime.

### Control Flow and Initialization

`cfg.ts` and `semantic/lower.ts` represent every branch, loop, switch, short-circuit, return,
fallthrough and stop edge explicitly. `flow.ts` retains declaration identity, initialized physical
ranges and predecessor facts. A strong update requires a proved captured range and must-alias;
may-alias updates receive no credit. Loops converge by the existing monotone data-flow pattern.

### Aggregates and Places

- Struct layout is declaration order with no implicit padding.
- Fixed arrays carry exact shape, full element size, row-major stride and extent.
- Aggregate construction evaluates members in source order.
- Assignment and returns are ordinary exact-shape values.
- Parameters carry base address; outer-unsized array parameters additionally carry a word count.
- Mutable/const borrows share the ABI; transitive write permission is semantic only.
- Address provenance follows copies, casts, selections, `lo`/`hi`, arithmetic and bitwise
  derivation, but not data loaded through an address.
- The first escape beyond a local's dynamic lifetime is diagnosed; legal borrows extend SFA
  liveness and alias interference.

### Strings, Character Maps, Placement and Loadable Values

The lexer supplies Unicode scalars. Semantic analysis resolves them through the selected immutable
encoding plus character-map identity and produces exact bytes or the canonical diagnostic. It emits
no normalization, runtime converter or VIC-state change.

`place(...)` remains a closed symbolic constraint passed to layout. `loadable const` remains known
packaged data with prohibited ordinary access until RD-07 supplies a selected transfer capability.
The resident RD-04 profile reports honest unavailability and emits no loader.

## Integration Points

| Producer | Consumer | Contract | AR Ref |
|---|---|---|---|
| Typed frontend | Semantic lowering | Width, signedness, nominal identity, place, order, provenance | AR-P8 |
| Semantic CFG | Whole-program/SFA | Exact effects, aliases, liveness, calls and stop edges | AR-P8 |
| Aggregate semantics | ABI/SFA | Shape, destination, borrow, copy and overlap obligations | AR-P2 |
| Profile facts | Literal conversion | Exact immutable encoding/map identity | AR-P1 |
| Placement/loadable analysis | Layout/capability diagnostics | Symbolic constraint or honest later-RD owner | AR-P1 |

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Illegal type/operator/conversion | Canonical semantic diagnostic; poison result | AR-P1 |
| Constant divide by zero or constant OOB | Canonical compile-time diagnostic | AR-P1 |
| Runtime checked failure | Branch before unsafe operation to the costed terminal block | AR-P4 |
| Local address escape | Diagnose the first retaining or longer-lived use | AR-P1 |
| Unavailable character map/scalar | Emit exact profile or scalar diagnostic; no replacement byte | AR-P1 |
| Reachable load request on resident profile | Emit unavailable-capability diagnostic; no placeholder | AR-P1 |

## Testing Requirements

- Complete scalar/operator/type matrices with independent mathematical expected values.
- CFG/effect traces for short circuit, conditional, loops, switch, assignment and initialization.
- Array shape/ordinal/bounds/address-wrap and string/map exhaustive fixtures.
- Struct layout, aggregate value, overlap, const-borrow and address-provenance cases.
- Transition probes proving each semantic fact remains present until its named consumer.
