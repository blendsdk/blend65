# Closed Program Semantics: Specification 4.0 and Expert Authority Freeze

> **Document**: 03-03-closed-program-semantics.md
> **Parent**: [Index](00-index.md)

## Overview

This component reconciles the features whose correctness depends on whole-program proof, effects,
resource limits, or target-aware flow state: function values and handlers, compile-time functions,
placement, loadable data, the finite low-level intrinsic surface, and optional checks. RD-01
R1.10–R1.14 own the behavior.

## Architecture

### Current Architecture

P3 contains portions of these rules across function, memory, intrinsic, data-inclusion, platform,
diagnostic, and evaluation documents. Some rules describe current lowering limits as source rules;
others omit the complete lifecycle, effect, budget, alias, or failure contract now approved for v4.

### Proposed Changes

Keep each feature closed over syntax, types, effects, storage, diagnostics, positive/boundary/invalid
examples, and Guard evidence. The specification defines obligations and finite resource contracts;
it does not prescribe a compiler architecture or add a runtime. See AR-P2 and RD-01 R1.10–R1.14.

## Implementation Details

### File and Section Ownership

| Semantic family | Primary normative owners | Derived/consistency owners |
|---|---|---|
| Function values and handler lifecycle | `spec/06-functions.md`; `spec/evaluations/F018-functions.md`; `F007-interrupt-functions.md` | Function-type/call productions and related diagnostics |
| Compile-time functions and budgets | `spec/04-expressions-operators.md`; `spec/06-functions.md`; new `spec/evaluations/F025-comptime-functions.md` | Function/modifier productions and E10269–E10271 registry entries |
| Placement constraints | `spec/11-memory-model.md`; `spec/evaluations/F005-memory-placement.md` | Declaration/call syntax and placement diagnostics |
| Loadable constants and flow facts | `spec/13-data-inclusion.md`; `spec/evaluations/F015-data-inclusion.md` | Memory effects, load-invalidation diagnostic, and C64 loader integration |
| Five `asm_*` operations | `spec/12-intrinsics.md`; `spec/evaluations/F012-cpu-control-intrinsics.md` | Intrinsic-call production and reserved-name diagnostics |
| Optional bounds/division safety | `spec/04-expressions-operators.md`; `spec/08-arrays-strings.md` | `F014`, `F017`, diagnostics, and selected-profile behavior link |

The grammar task edits only the productions named by this table. It cannot revisit Phase 2's loop,
scope, array, aggregate, or address productions. The diagnostic task owns only function-target,
handler-lifecycle, comptime-budget, placement/loadable, intrinsic-surface, and optional-safety
classes; Phase 4 performs final registry closure.

### Evaluation Additions

Create `F025-comptime-functions.md` because no current evaluation owns the complete comptime
function and production-budget contract. It applies all 23 Language Guard rules and links to the
existing expression/function clauses. This is one feature evaluation, not a new framework.

### Whole-Program Proof Boundary

Normative text states observable results, rejection boundaries, exact static/resource accounting,
and proof obligations. Implementation strategies remain non-normative and may vary if they preserve
those facts. No hidden descriptor, validity byte, dynamic dispatch runtime, trap system, heap, or
general evaluator runtime is introduced.

### Examples and Diagnostics

Each family includes a modern-developer example and a C64 game example. Every invalid class points
to exactly one registry code and correction. Budget examples use small test limits where permitted
so exact N/N+1 behavior is directly checkable without millions of operations.

## Integration Points

| Component | Contract |
|---|---|
| Core language | Reuses stable types, places, lifetime, arrays, aggregates, and evaluation order |
| C64 appendix | Supplies selected-profile legality and loader/interrupt endpoint facts only |
| Guard and diagnostics | Receives complete feature results and registry closure |
| Expert skill | Teaches lowering/proof options without narrowing the source language |
| Later compiler RDs | Must implement proof and resource obligations without post-SFA storage |

## Error Handling

| Error case | Handling strategy | AR Ref |
|---|---|---|
| Proof obligation is underspecified | Keep the ST case RED and reopen the plan ambiguity gate | AR-P1 |
| Feature implies a runtime or general framework | Reject the design expansion; use the approved finite contract | AR-P3 |
| New diagnostic conflicts with an existing code | Block the phase and reconcile the sole registry owner | AR-P2 |
| Platform fact leaks into core meaning | Move the fact to the C64 appendix and retain a target-neutral core rule | AR-P2 |

## Testing Requirements

- ST-13–ST-20 cover finite targets, handler ownership, comptime results/budgets, placement,
  load-state flow, intrinsic inventory, and safety modes.
- `tests/closed-program-semantics.spec.test.md` is the pre-edit oracle.
- `tests/closed-program-semantics.impl.test.md` records grammar, diagnostic, Guard, stale-claim,
  effect/resource, and example checks after implementation.
