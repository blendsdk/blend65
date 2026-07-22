# IRQ Warning (M-04): `W10182` shared-frame hazard

> **Document**: 03-04-irq-warning.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-01 R7; AR-7, AR-8; AC-10, AC-11

## Overview

A function reachable from **both** an interrupt handler and the mainline gets one static frame. An
interrupt arriving mid-call overwrites the caller's locals; on return the mainline continues with
corrupted state — zero diagnostics. The fix emits a **warning** (`W10182`) naming the hazard, once
per shared function, with a false-positive filter that does not fire on provably-safe shapes.

A warning, not an error (AR-7): a shared helper can be deliberate, and the developer may guarantee
non-reentrancy by construction; an error would break working programs.

## Architecture

### Current Architecture

`computeIrqClassification` (`model-adapter.ts:443-488`) computes `irqReachable` and `irqOnly` and
returns membership **sets only**. The full mainline closure and the identity of *which* handler and
*which* mainline root reach a shared function are computed at `:473-481` and **discarded**. The
adapter seam takes no `DiagnosticBag`. Handlers are installed only via `&` (`:450-457`).

### Proposed Changes

The **shared** set R7 needs is `irqReachable ∖ irqOnly` (RD M-04). To name a reacher (AR-8), the
warning needs provenance the current BFS throws away. Three coordinated additions:

1. **Provenance threading** — retain, for each shared function, one interrupt entry point and one
   mainline root that reach it (not just the membership bit). The interrupt witness is produced by
   the **taken-rooted closure itself**, never by filtering the every-handler classification witness
   (PF-031) — else a function reached by both a taken and a never-taken handler could be named
   against the handler that can never fire.
2. **Emission seam** — thread a `DiagnosticBag` to where the classification result is consumed. The
   only production caller is **`packages/compiler`** (`run-frontend.ts:185`, `modelToFunctionInfo`,
   currently bagless, `bag` in scope), so this is a `@blend65/compiler` edit as well as `sfa`
   (PF-030). R15 is unaffected — compiler is a public consumer. `W10182` emits once per shared
   function.
3. **False-positive filter (AR-8) — a *separate* address-taken predicate over the classification
   output**, NOT a narrowing of `computeIrqClassification`'s own BFS:
   - root the warning's interrupt set at **address-taken** handlers only (a handler whose address
     is never taken can never fire);
   - exclude functions with **no frame state** via the **computable proxy AR-P9** (PF-013): spill
     slots and `__rt_*` scratch are *codegen-time* facts invisible at this frontend/sfa seam
     (R15 blocks frontend→codegen), so the seam cannot literally count them. The proxy: warn unless
     the function has **no params, no locals, AND a syntactically spill-free body** (straight-line
     MMIO writes / a single simple statement — no compound expression that forces an ALU temp). This
     over-warns slightly (the safe direction for a hazard warning) rather than the false-negative a
     "no params ∧ no locals" test would give a spilling body. ST-35's negative fixture is shaped to
     this proxy.

> **Trap worth naming in bold (AR-8):** the address-taken filter applies to the **warning's** root
> set only. `computeIrqClassification`'s BFS roots at **every** handler and drives **frame
> placement** — pinned by the existing classification tests
> (`irq-interference.spec.test.ts:71-118` and `irq-classification.impl.test.ts` for
> never-address-taken handlers). Narrowing it at the
> classification seam would re-home frames — the exact defect class this RD kills. Leave the
> classification BFS untouched; add the predicate over its output.

## Implementation Details

### Diagnostic

- **Code:** `W10182` — verified free in both the registry and `spec/`; the W10180 band is the
  call-graph/frame family (RD AR-7). Registered in `packages/core/src/diagnostics/diagnostic-codes.ts`
  (a core edit) and **recorded as a compiler-minted code in `codeops/00-spec-errata.md`** (a real
  task, not implicit — PF-023).
- **Message (draft, AR-P6):** `` function `shared` is reachable from both interrupt handler
  `raster` and mainline `main`; an interrupt mid-call corrupts its frame `` — names one interrupt
  entry point and one mainline reacher (AR-8). Final wording follows registry phrasing; no
  `codeops`/RD id in the message.
- Emitted **once** per shared function.

### Integration points

- Lives in `frontend`/`sfa` **plus `packages/compiler`** (the emission-seam caller,
  `run-frontend.ts:185`) and `packages/core` (the `W10182` registration) — no codegen; R15
  unaffected (compiler is a public consumer).
- The new predicate reads the classification output + the address-taken set (`:450-457`); it does
  not modify the classification.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Function reachable from both an address-taken handler and the mainline, with frame state | `W10182` once, naming both reachers | RD AR-7/AR-8, AC-10 |
| Function reached by a **taken AND a never-taken** handler (mixed roots) | warns, naming the **taken** handler (witness from the taken-rooted closure) | AR-8, PF-031 |
| Callee of a **never-address-taken** handler | no warning (predicate excludes it) | RD AR-8, AC-11 |
| Shared function with **no frame state** per the AR-P9 proxy | no warning | RD AR-8, AR-P9, AC-11 |

> **Traceability:** warning-not-error and the code are RD AR-7; the address-taken-over-output
> filter (and the untouched-classification-BFS fence) are RD AR-8.

## Testing Requirements

- Spec (`[CI]`): the P0-core probe shape warns once with `W10182`, naming both reachers
  (AC-10, ST-33); a **mixed-roots** case (taken + never-taken handler both reaching the shared
  function) warns, naming the taken handler (PF-031, ST-33b).
- Spec (`[CI]`): two negatives — a never-address-taken handler's callee, and a shared function with
  **no frame state per the AR-P9 proxy** (no params/locals, syntactically spill-free body) — do
  **not** warn (AC-11, ST-34, ST-35).
- The SFA fixtures that deliberately construct the IRQ∩mainline shape are expected to fire
  `W10182` by design; R8's fixture audit (run **before** wiring, PF-004) enumerates them and asserts
  that expectation (AC-12 "clean = zero errors"), doubling as real-world AC-11 probes.
