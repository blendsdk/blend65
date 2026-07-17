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
- **mainlineReachable** = BFS closure from `main`, `__init`, and escaped **non-interrupt**
  functions. Interrupt-kind escapees are EXCLUDED — installing a handler
  (`pokew($FFFE, &onIRQ)`) is precisely what marks it escaped, and E10051/E10311 make handlers
  uncallable/unexportable from mainline, so counting them here would empty `irqOnly` in every
  real program, including the fixture (preflight PF-001). Exports are NOT roots in a program
  build — an exported helper participates only through real mainline call edges, so a
  handler-only exported helper stays irq-only (Ch 06 §7.5 lists irq-dedicated helpers as a
  SAFE pattern). If a library build mode lands later, exports become roots there.
- **irqOnly** = irqReachable ∖ mainlineReachable.
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
  hazard (Ch 06 §7.5, FUT-004) — no diagnostic in v3.

The existing argument-window machinery is untouched (it keys off call sites; interrupts have
none).

### Consumer 2 — spill-temp pool (`register-binding.ts` + `translate.ts`)

- `createRegisterBinder` gains a pool selector: functions with `isIrqOnly` draw spill slots
  from the `"irq-temp"` category (`__zp_irq_tmp_N`); all others keep `"temp"`. The flag is
  threaded through `translateFunction` (the binder itself has no function identity).
- Both-path functions use the MAIN pool — folded into the same documented hazard (a both-path
  function is hazardous per spec regardless of pool choice).
- **Pool sizing**: `irqTempBytes` STAYS a fixed profile constant (default 2) — the same
  mechanism as the main pool (`mainTempBytes` is also a constant; spill demand only
  materializes inside translate, after the plan is frozen, and R15 bars a feedback path, so no
  demand sizing is possible or attempted — preflight PF-003). Overflow splits into two distinct
  loud failures: ZP-window FIT overflow at allocation → the existing E10032; spill demand
  exceeding a pool at translate → the binder's existing exhaustion ICE, extended to name WHICH
  pool ran dry. Raising `irqTempBytes` is a pure profile change if real handlers overflow.

### Consumer 3 — the formation scratch twin (`plan-allocation.ts` / `zp-allocator.ts`)

- Reserve **`__zp_irq_ptr_scratch`** — one extra ZP pair, alias emitted next to
  `__zp_ptr_scratch` (:172-178) — CONDITIONALLY: only when some irq-ONLY function needs
  runtime pointer formation or indirect staging (predicate mirrors `modelNeedsPointerScratch`,
  `model-adapter.ts:344-356`, restricted to the irq-ONLY set — the SAME key as Consumer 2,
  preflight PF-002).
- Lowering/translate select the irq twin for formation inside irq-ONLY functions; both-path
  and mainline functions keep `__zp_ptr_scratch` (a both-path function forming in irq context
  falls under the same Ch 06 §7.5 documented hazard as its frame and spills — one umbrella,
  no new mainline-context corruption window); the
  `indirectPair` validation (`translate.ts:1627-1641`) accepts it as a plan-reserved pair. The
  7b backstop ICE ("indirect staging demanded but no pair reserved") remains the loud guard.
- The pair pool itself needs no split: pairs are colored off `graph.edges` (Consumer 1).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| ZP-window fit overflow (always-live growth, user vars, pools) | existing E10032 (once) + W10030 advisory | AR-15 |
| spill demand exceeds its pool (main or irq) at translate | binder exhaustion ICE, extended to name the dry pool — never E10032, never silent (PF-003) | AR-15 |
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
