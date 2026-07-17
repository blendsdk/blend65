# SFA Interrupt Path: RD-18 Slice 8a

> **Document**: 03-03-sfa-interrupt-path.md
> **Parent**: [Index](00-index.md)
> **Governs**: the irq-reachability classification and its three consumers — always-live
> frames/pairs, spill-temp pool selection, and the `__zp_irq_ptr_scratch` twin.
> **Spec**: Ch 06 §7.4–§7.6; Ch 11 §4. **AR**: 15 (challenger-amended).

## Overview

Two confirmed miscompile holes: (i) an irq-only helper's frame carries no interference edge to
mainline frames and can be overlapped (`interference.ts:97-112` makes only the handler itself
always-live); (ii) the register binder spills exclusively into the `"temp"` category
(`register-binding.ts:133-135`) while the allocated `__zp_irq_tmp_N` pool has zero consumers —
an IRQ mid-block corrupts live mainline spills (violates Ch 06 §7.6). One classification fixes
both, plus the 7b-deferred formation twin.

## Implementation Details

### The classification (computed ONCE)

In the SFA projection layer (`model-adapter.ts`), from the existing call graph:

- **Roots**: every `kind: "interrupt"` function.
- **irqReachable** = BFS closure over call edges from those roots.
- **irqOnly** = irqReachable ∖ mainlineReachable, where **mainline is the complement of
  irq-only** — i.e. everything reachable from `main`, `__init`, exports, and escaped functions
  (the complement formulation closes the `__init` root for free).
- Projected per function (e.g. `FunctionInfo.isIrqReachable` / `.isIrqOnly`) and threaded to
  the plan so translate can read it. ONE computation, THREE consumers — never re-derived.

### Consumer 1 — interference (`interference.ts` Step 2, :104-112)

Every `isIrqReachable` function joins the always-live set (edge to every node), exactly as
`isInterrupt` does today. Consequences:

- irq-only helpers stop overlapping mainline frames (the confirmed hole);
- two interrupt roots' subtrees are mutually always-live — NMI-preempting-IRQ nesting is safe
  (the `interrupt` keyword does not distinguish vectors; the install site decides);
- `colorFrames` (`coloring.ts:95`) and `bindPointerPairs` (`pointer-pairs.ts:65`) both consume
  `graph.edges`, so frames AND ZP pointer pairs inherit the rule with **no second mechanism**;
- both-path functions are irqReachable → always-live for placement; their residual
  self-reentrancy (one frame home used from both contexts) is the spec's documented-unenforced
  hazard (Ch 06 §7.4/§7.5, FUT-004) — no diagnostic in v3.

The existing argument-window machinery is untouched (it keys off call sites; interrupts have
none).

### Consumer 2 — spill-temp pool (`register-binding.ts` + `translate.ts`)

- `createRegisterBinder` gains a pool selector: functions with `isIrqOnly` draw spill slots
  from the `"irq-temp"` category (`__zp_irq_tmp_N`); all others keep `"temp"`. The flag is
  threaded through `translateFunction` (the binder itself has no function identity).
- Both-path functions use the MAIN pool — folded into the same documented hazard (a both-path
  function is hazardous per spec regardless of pool choice).
- **Pool sizing**: today `irqTempBytes` is a fixed profile constant (2). Size it like the main
  temp pool — the peak spill demand across irq-only functions — floored at the profile default;
  overflow fails loud through the existing E10032 budget path (never silent truncation).

### Consumer 3 — the formation scratch twin (`plan-allocation.ts` / `zp-allocator.ts`)

- Reserve **`__zp_irq_ptr_scratch`** — one extra ZP pair, alias emitted next to
  `__zp_ptr_scratch` (:172-178) — CONDITIONALLY: only when some irq-reachable function needs
  runtime pointer formation or indirect staging (predicate mirrors `modelNeedsPointerScratch`,
  `model-adapter.ts:344-356`, restricted to the irq-reachable set).
- Lowering/translate select the irq twin for formation inside irq-reachable functions; the
  `indirectPair` validation (`translate.ts:1627-1641`) accepts it as a plan-reserved pair. The
  7b backstop ICE ("indirect staging demanded but no pair reserved") remains the loud guard.
- The pair pool itself needs no split: pairs are colored off `graph.edges` (Consumer 1).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| ZP exhaustion from always-live growth / irq pool sizing | existing E10032 (once) + W10030 advisory | AR-15 |
| irq-path formation without the twin reserved | existing loud translate backstop ICE (`translate.ts:1636`) | AR-15 |
| both-path function | compiles; documented hazard; NO diagnostic (FUT-004) | AR-15 |

## Integration Points

- 03-02 provides the roots (`kind: "interrupt"`); 03-01/AR-29 formation code paths honor the
  twin selection; 03-06's fixture includes an irq-only helper as the living witness.
- Prior-slice programs have empty irq sets — classification degenerates to today's behavior;
  all ten prior goldens must stay byte-exact (01-req AC-5).

## Testing Requirements

ST-17..ST-24: interference edges for irq-only helpers; both-path single home; pool selection
(irq-only spills → `__zp_irq_tmp`); twin reservation predicate (present/absent); pair
non-sharing across contexts; empty-irq-set degeneracy (prior goldens).
