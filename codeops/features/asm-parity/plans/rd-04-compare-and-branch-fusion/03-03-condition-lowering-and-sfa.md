# Condition Lowering & SFA: RD-04 Compare-and-Branch Fusion

> **Document**: 03-03-condition-lowering-and-sfa.md
> **Parent**: [Index](00-index.md)

## Overview

The branch-context recursion `lowerCondition` (in `lower.ts`, plan-AR #3), the statement-lowerer
rewiring, the boolean-literal fold (req-AR #21), and the position-dependent SFA slot predicate
that must change in step (req-AR #22). This is the flip: once it lands, every condition in every
program lowers through the fused path — which is why it shares one phase with the corpus
supersession (plan-AR #1; 03-04).

## Architecture

### Current
Statement lowerers call `lowerExpr` then terminate with `brcond` (`lowerIf` :496, `lowerWhile`
:525, `lowerDoWhile` :549, `lowerFor`'s continue predicate :714, `lowerSwitch` :642).
Condition-position `&&`/`||` run through `lowerShortCircuit` (:1261) claiming a `0sc<N>` slot
(`claimResultSlot` :1230 — loud name/size ICE on drift); `!` becomes an `eq src, 0` instruction
(`lowerUnary`). The SFA adapter's `isSlotSite` (`model-adapter.ts:133-139`) is
position-independent by design.

### Proposed
One new recursion; every condition statement routes through it; `lowerShortCircuit` /
`claimResultSlot` stay untouched for value-position sites. The adapter's predicate becomes
position-dependent using the RD's structural definition, with **no `@blend65/codegen` import**
(R15) — the two packages stay coupled only by the shared structural definition.

## Implementation Details

### `lowerCondition` — the branch-context recursion

```ts
/** Lower `expr` in condition position: terminate the current block (possibly
 *  through short-circuit sub-blocks) branching to trueL/falseL. Claims no
 *  synthetic slot for `&&`/`||` — their short-circuit becomes CFG edges. */
function lowerCondition(expr: ExprNode, trueL: string, falseL: string, ctx: LowerCtx): void
```

Case analysis (RD "Condition-position lowering"; req-AR #21/#22):

| Node | Lowering |
| ---- | -------- |
| `BoolLitExpr` | `br` to `value ? trueL : falseL` — the literal fold; zero condition code |
| `UnaryExpr` `!` | `lowerCondition(operand, falseL, trueL, ctx)` — target swap, zero extra code |
| `BinaryExpr` comparison (`==`/`!=`/`<`/`<=`/`>`/`>=`) | lower both operands via the SAME operand-lowering + promotion path the value form uses (factor a shared helper out of the existing comparison case in `lowerExpr` so the promoted `type` can never diverge between forms), then `terminate({kind: "brcmp", op, left, right, type, trueTarget: trueL, falseTarget: falseL})` |
| `BinaryExpr` `&&` | `mid = reserveLabel()`; `lowerCondition(left, mid, falseL)`; `openBlock(mid)`; `lowerCondition(right, trueL, falseL)` |
| `BinaryExpr` `\|\|` | `mid = reserveLabel()`; `lowerCondition(left, trueL, mid)`; `openBlock(mid)`; `lowerCondition(right, trueL, falseL)` |
| anything else (identifier read, call, `?:`, …) | `cond = materialise(lowerExpr(expr, ctx), ctx)`; `terminate({kind: "brcond", cond, trueTarget: trueL, falseTarget: falseL})` — the fallback; `if (b)` stays load + one branch (RD AC-4 baseline) |

Short-circuit remains a language guarantee by CFG construction: the right clause's block is
reachable only via the left clause's non-deciding edge — a `peek` in the right clause executes
only then (RD AC-7, MMIO).

**Slot semantics (the exact position rule):** the `&&`/`||` cases above claim NO slot. Every
other route into `&&`/`||` — value position via `lowerExpr`, including nested inside a
condition-position `?:`'s arms or a call argument like `if (f(a && b))` — still runs
`lowerShortCircuit` and claims through the shared `ctx.scCounter`. `?:` and `&` sites claim in
every position, unchanged. This is the mirror image of the adapter predicate below; both are
restatements of the RD's structural definition.

### Statement rewiring

- `lowerIf`: reserve `thenL`/`elseL`(or `endL`); `lowerCondition(cond, thenL, elseL)` replaces
  the `lowerExpr` + `brcond` pair; arm/join plumbing unchanged.
- `lowerWhile` / `lowerDoWhile`: inside the `cond` block, `lowerCondition(cond, bodyL, endL)`.
  `while (true)`'s cond block becomes a single `br body` (RD AC-2); the back-edge shape the
  termination analysis sees is plain `br` (03-01).
- `lowerFor`: the Pattern-A continue predicate emits `brcmp` (`le`/`ge`, counter vs bound)
  directly instead of predicate + `brcond`. For-bounds are numeric — no `&&`/`||` can occur
  (RD structural definition); the full-range Pattern-B ICE guard stays.
- `lowerSwitch`: each dispatch test block terminates with
  `brcmp {op: "eq", left: disc, right: value, type: discType, trueTarget: bodyL[i], falseTarget: nextTest}`
  — the `eq` instruction + `brcond` pair collapses. The discriminant stays value-position
  (lowered fresh per test block, slot rules unchanged; RD Must-Have).

### SFA adapter — position-dependent predicate (`model-adapter.ts:107-139`)

`collectSyntheticSlots`' walk gains condition-position awareness implementing the RD's
structural definition: a node is condition-position iff it is the condition child of
`if`/`while`/`do-while`, or an operand of a condition-position `!`/`&&`/`||`. Concretely: the
kind-blind Proxy walk is replaced by a recursion threading an `inCondition` flag — set when
descending into the three statements' condition child, propagated through `!`/`&&`/`||`
operands, reset for every other child edge (so `?:` arms, call arguments, and comparison
operands inside a condition are value-position again). `isSlotSite` becomes
`isSlotSite(node, inCondition)`: `&&`/`||` claim iff NOT in condition position; `?:` and `&`
claim as today. Preorder, `0sc<N>` naming, and the poisoned-site placeholder rule are
unchanged.

Drift protection is unchanged and load-bearing: `claimResultSlot`'s name/size verification
(`lower.ts:1230-1248`) remains the loud ICE — the adapter and lowering are edited in the same
phase, and the req-AR #22 claim-and-discard fallback is NOT used (plan-AR #1).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Adapter/lowering preorder drift | Existing frame-miss/size-mismatch ICE at `claimResultSlot` | req-AR #22 |
| Recursion mints a label with no block | 03-01 translation-time pre-pass ICE | plan-AR #2 |
| `?:` in condition position | Deliberate fallback (materialize + `brcond`) — RD Won't-Have | req-AR #22 |

## Testing Requirements

- Spec: ST-8 (IL shapes: fused terminators per statement kind, target swap, short-circuit
  edges, zero `0sc` claims in condition position, literal fold), ST-14 (nested value-position
  `&&` inside a condition still claims its slot — both sides of the position rule), frontend
  adapter spec cases mirroring the structural definition. See 07.
- Impl: `!` chains (`!!b`), `&&` under `||` and vice versa, `else if` chains, `for`
  `downto`, dispatch chains with multi-value cases, poisoned-type conditions.
