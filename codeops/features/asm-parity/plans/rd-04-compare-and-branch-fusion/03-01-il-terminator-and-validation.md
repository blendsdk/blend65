# IL Terminator & Validation: RD-04 Compare-and-Branch Fusion

> **Document**: 03-01-il-terminator-and-validation.md
> **Parent**: [Index](00-index.md)

## Overview

The `brcmp` terminator (plan-AR #4, req-AR #23) plus everything that must understand a new
terminator kind: the printer, a shared successor-enumeration helper, the termination analysis,
and the new translation-time dangling-target ICE (plan-AR #2). Nothing in this component emits
`brcmp` — lowering starts emitting it in 03-03.

## Architecture

### Current
`ILTerminator` is a four-kind union (`instruction.ts:159-168`); successors are hand-enumerated
inside `functionCanReturn` (`termination.ts:43-51`); dangling targets are silently skipped
(`termination.ts:56`); the printer renders `brcond cond, trueL, falseL` (`print-il.ts:182-183`).

### Proposed
One new union member, one new shared helper, and the pre-pass tripwire in the translator.

## Implementation Details

### New type — `instruction.ts`

Beside `brcond`, mirroring the comparison instruction's convention (`type` = the promoted
OPERAND type — the framing selector, `instruction.ts:102-109`):

```ts
| {
    readonly kind: "brcmp";
    readonly op: (typeof COMPARISON_OPS)[number];
    readonly left: ILOperand;
    readonly right: ILOperand;
    readonly type: ILType; // promoted OPERAND type — selects the framing
    readonly trueTarget: string;
    readonly falseTarget: string;
  }
```

Doc comment states the contract: branch to `trueTarget` when `left <op> right` holds, else
`falseTarget`; no 0/1 value exists anywhere. `brcond` stays for branching on boolean *values*
(RD Must-Have "Boolean reads … do not regress"). `instruction.ts` remains pure data — the
helper below goes in `cfg.ts`.

### Shared successor helper — `cfg.ts`

```ts
/** The branch-target labels of a terminator, in declaration order (empty for ret/unreachable). */
export function terminatorTargets(t: ILTerminator): readonly string[]
```

`br` → `[target]`; `brcond`/`brcmp` → `[trueTarget, falseTarget]`; `ret`/`unreachable` → `[]`.
An exhaustive `switch` closed by the repo's never-guard idiom —
`default: { const _exhaustive: never = t; return _exhaustive; }`, the pattern at
`print-instr.ts:130-134` / `translate.ts:427-433` — so a forgotten terminator kind is a
compile error that names the missing kind (robust even if the signature ever gains
`| undefined`); this is the single source of truth consumers enumerate from (plan-AR #2).
Placed in `cfg.ts` because it is a block/CFG-level concern and `instruction.ts` declares
itself behavior-free; `cfg.ts`'s own "pure data, no behavior" module header is amended in
the same task (records + this one pure successor helper).

### Termination analysis — `termination.ts`

- The successor walk consumes `terminatorTargets` instead of its private `br`/`brcond`
  enumeration, keeping ONE special case in place: a `brcond` whose `cond` is an immediate
  follows only its taken edge (the existing constant-awareness rule; behavior preserved).
- `brcmp` contributes **both** targets unconditionally. Computed-constant conditions are out of
  scope (req-AR #21), and both-edges is the safe direction: it can only over-approximate
  reachability, which errs toward the terminating shim — a few wasted bytes, never the
  wild-stack crash (`termination.ts:6-11`). After 03-03's literal fold, `while (true)` lowers
  as plain `br`, so it no longer depends on the `brcond` constant rule at all.
- The defensive dangling-label `continue` (:56) stays — the analysis remains total — with its
  comment updated to note the invariant is now enforced at translation.

### Printer — `print-il.ts`

Render beside `brcond`, reusing the comparison instruction's operand/type rendering:

```
brcmp lt i8u %0, 251, _L1, _L2
```

(`brcmp <op> <typeTag> <left>, <right>, <trueTarget>, <falseTarget>` — op, then the prefix
type tag, then the rendered operands, exactly as the comparison instruction renders
(`print-il.ts:82-90`; temps as `%<id>` per `renderOperand`, `print-il.ts:44-49`), with the
target list appended as in `brcond`. Exact text pinned by the printer spec tests, ST-9.)

### Dangling-target ICE — `translate.ts` pre-pass

A `validateTerminatorTargets()` private method called from `run()` beside `prescanAll()`
(`translate.ts:284` precedent): build the block-label `Set` once, then for every block check
each label from `terminatorTargets(block.terminator)`; a miss records

```
IL→Instr: terminator target '<label>' resolves to no block (function '<fnName>', block '<blockLabel>', <kind>)
```

through the record-and-continue diagnostic-bag convention (`bag.addICE(IceCode.Unexpected, null,
msg)`, never throw — the established translator pattern) via a sibling `iceDanglingTarget()`
helper beside `iceUnsupported`; the latter is NOT reused, because it wraps its argument in an
"unsupported op … deferred to RD-07c" sentence that misattributes this case (plan-AR #9).
One uniform pass covers `br`, `brcond`, and
`brcmp` — including the branch-context recursion in 03-03, the code most able to mint a
dangling label (RD Technical Requirements; plan-AR #2).

## Integration Points

- 03-02 consumes the type (translator `brcmp` case) and the pre-pass (runs before it).
- 03-03 emits the terminator; the ICE is its tripwire.
- The optimizer passthrough (`il/optimizer/`) touches no terminator kinds — no change.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Terminator target resolves to no block | Translation-time ICE via the pre-pass (message above) | plan-AR #2 |
| Malformed `brcmp` shape | Unrepresentable — discriminated union (RD Security Considerations) | req-AR #23 |
| New terminator kind forgotten by a consumer | Never-guarded exhaustive `switch` in `terminatorTargets` = compile error naming the kind | plan-AR #2 |

## Testing Requirements

- Spec: ST-9 (printer text, `brcmp` successor enumeration, both-edges termination rule,
  dangling-target ICE), ST-13 (`while (true)` shim selection unchanged post-fold). See 07.
- Impl: helper edge cases (`ret`/`unreachable` empty; declaration order stable).
