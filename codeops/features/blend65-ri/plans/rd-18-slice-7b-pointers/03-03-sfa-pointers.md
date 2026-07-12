# SFA: byRef threading, pair coloring, scratch reservation

> **Document**: 03-03-sfa-pointers.md
> **Parent**: [Index](00-index.md)

## Overview

SFA lights up the dormant pointer machinery: `byRef` flows from param symbols into
`FrameVar`s (2-byte frame slots appear via the SHIPPED `slotSize` rule — no change there),
each pair-accessed by-ref param gets a named, interference-colored ZP pair, and the tier-2
scratch pair reserves under the AR-4 hardened predicate. Golden safety is a hard requirement:
pointer-free programs must produce a byte-identical `AllocationPlan`.

## Architecture

### byRef threading

`model-adapter.ts collectFrameVars` (`:310-318`) stops hardcoding `byRef: false` — it copies
`sym.byRef`. Frame slots follow automatically (`frame-computation.ts slotSize`, shipped).
`computePeakPointers` (shipped) starts returning >0 — but only counting **pair-accessed**
params (below).

### Pair binding & coloring (AR-2)

Pairs are per-param SYMBOLS overlaid onto pool addresses — mirroring frame coloring:

- **Name**: `__zp_ptr_<Module_fn>_<param>` (sanitized like frame slots).
- **Pair-accessed set**: a by-ref param needs a pair iff the function body accesses THROUGH
  it (element/field read or write, or whole-copy source/target). Dead and pass-through-only
  params get NO pair and NO prologue copy (AR-2 refinement) — pass-through reads the frame
  slot (the canonical home). The access-set analysis is a small AST walk over the function
  body at model-adapter level (does any place chain root at this param?) — the SAME
  classification lowering uses ([03-04](03-04-lowering-indirect.md)), so a shared predicate
  in the semantic model (`Symbol`-keyed set on `SemanticModel`) keeps the two in lockstep;
  drift between them is a translate-time ICE, never a mis-address.
- **Coloring**: process functions in topological (call-graph) order; a function's pair-accessed
  params take consecutive addresses starting at
  `start(F) = max over already-colored interfering neighbours G of (start(G) + pairBytes(G))`,
  base `zpPointerBase` (the pool's first address). Interference = the SHIPPED graph
  (caller-chain + argument-window edges). Any simultaneously-live set of functions forms a
  clique along call chains, so chain-max assignment never overlaps and never exceeds the
  shipped `computePeakPointers` bound (which sums own + ALL neighbours ≥ any chain through F).
- `computePeakPointers` input switches from "all by-ref params" to "pair-accessed by-ref
  params" so pool sizing and coloring agree.

### Scratch pair (AR-4)

- **Predicate** (hardened): reserve ONE extra pair (`__zp_ptr_scratch`) iff
  (a) any reachable function has ≥1 pair-accessed by-ref param, OR
  (b) any declared storage **or const aggregate** transitively (struct fields, nested arrays)
  contains an array with total byte size > 256.
  Computable entirely from the semantic model's types — no expression inspection needed
  (conservative: a byte-indexed-only tier-2-free by-ref program still reserves; 2 bytes).
- **Placement**: within the pointer category, AFTER the colored param pairs (deterministic).
- **Backstop**: translate ICEs loudly if staging is demanded and the plan lacks the symbol
  ([03-05 §Backstop](03-05-translate-indirect.md)) — never a dangling-symbol emit.
- **Slice-8 note (recorded)**: interrupt-path code will need an `__zp_irq_ptr` scratch twin
  (Ch 06 §7.6 separate-IRQ-temps rule); out of 7b scope — interrupt functions don't exist yet.

### Golden safety (AR-4)

Pointer-free programs: no pair-accessed params → peak 0 → no pairs; predicate false → no
scratch; ZP layout `__zp_arg_0..3, __zp_tmp_0..3, __zp_irq_tmp_0..1` byte-identical; frames
unchanged (`slotSize` code path untouched); no preamble change. All nine prior committed
goldens (gate + eight slices) stay byte-exact — spec-tested (ST-31/ST-65), not assumed.

### Budget & reporting

- E10032 (ZP budget) fires naturally through the shipped `allocateZeroPage` guard as pairs
  now consume bytes; a dense by-ref program on the 142-byte c64 grant is the negative case.
- `ResourceReport` ZP figures pick the pairs up automatically (category `"pointer"`).

## Implementation Details

```ts
// plan-allocation.ts (shape)
const pairBinding = bindPointerPairs(fns, graph, pairAccessed); // name → colored index
const peak = computePeakPointers(fnsWithAccessedByRef, graph);  // pool size (≥ coloring max)
const zp = allocateZeroPage({ ...input, peakPointers: peak + (needsScratch ? 1 : 0) }, profile, bag);
// symbolDefinitions: one per param-pair NAME at its colored slot address + __zp_ptr_scratch
```

`zpAllocations` keeps pool-slot entries (category `"pointer"`); `symbolDefinitions` adds the
per-param alias names → addresses (two names may share an address — exactly like frames).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| ZP budget exceeded by pairs/scratch | E10032 (shipped guard, once) | AR-2/AR-4 |
| coloring exceeds the peak-sized pool | ICE — invariant violation (never truncate) | AR-2 |
| access-set drift between SFA and lowering | translate ICE backstop (pair symbol missing) | AR-4 |

## Testing Requirements

- Spec tests: pair symbols exist iff pair-accessed; sequential callees share addresses,
  nested chains don't (the Ch 11 §4.3 table as ST rows); scratch predicate truth table incl.
  the const-aggregate case; golden-safety (pointer-free plan byte-identical); E10032 negative
  (ST-25..ST-33).
- Impl tests: chain-max coloring ≤ peak on adversarial graphs; determinism (two runs identical).
