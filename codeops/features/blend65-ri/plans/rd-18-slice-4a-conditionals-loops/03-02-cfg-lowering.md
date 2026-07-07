# 03-02 — CFG Lowering (`lower.ts`)

> The multi-block CFG keystone: lower `if`/`else`, `while`, `do-while`, `for`, `break`, `continue`
> into a multi-block `ILFunction` with `br`/`brcond` terminators. Traces: FR-7/FR-8, AR-6/AR-11/AR-12.
> **CodeOps Skills Version**: 3.2.0

## 0. Building blocks (already present — `02-current-state.md` §4)

`IlFunctionBuilder`: `reserveLabel()` → `_L0`,`_L1`,… (`builder.ts:77`); `openBlock(label)` (`:112`);
`terminate(term)` (`:97`); `isTerminated()` (`:102`). Terminators typed in `instruction.ts:156-165`:
`{kind:"br",target}`, `{kind:"brcond",cond,trueTarget,falseTarget}`, `{kind:"ret",value?}`,
`{kind:"unreachable"}`. Expressions (conditions, bounds) lower via the existing `lowerExpr` (3b) —
comparison/boolean operators already produce a boolean-typed operand.

## 1. Lowering-context extension (AR-12)

Add a **loop-context stack** to `LowerCtx`: `loopStack: Array<{ breakTarget: string;
continueTarget: string }>`. Push on entering a loop's lowering, pop on exit. `break`/`continue` read
the top. (On clean input the semantic pass guarantees non-empty at a `break`/`continue`; an empty
stack → defensive ICE, never reached — AR-12.)

`lowerFunction` (`lower.ts:146`) keeps building `_entry` first; new blocks come from `reserveLabel`.
The trailing fallback `ret` (`:170`) stays for straight-line functions and for a final open block that
falls through.

## 2. Statement lowering shapes

Add cases to `lowerStmt` (`lower.ts:181`). Each helper assumes the builder's current block is open and
leaves a **terminated** predecessor + an **open** successor where the next statement continues.

### 2.1 `if` / `else` (FR-7)

```
lowerIf(stmt):
  cond = lowerExpr(stmt.condition)
  thenL = reserveLabel(); endL = reserveLabel()
  elseL = stmt.elseClause ? reserveLabel() : endL
  terminate(brcond(cond, thenL, elseL))
  openBlock(thenL); lowerBlock(stmt.thenBlock); if !isTerminated(): terminate(br(endL))
  if stmt.elseClause:
     openBlock(elseL)
     if elseClause is Block: lowerBlock(elseClause)
     else (IfStmt): lowerIf(elseClause)         # else-if chain, nested
     if !isTerminated(): terminate(br(endL))
  openBlock(endL)                                 # successor continues here
```

A `then`/`else` body that itself definitely returns leaves its block terminated by `ret`; the guard
`if !isTerminated()` avoids a double terminator. `endL` may be an empty join block (fine — translate
emits its label + the fallthrough).

### 2.2 `while` (FR-7)

```
lowerWhile(stmt):
  condL = reserveLabel(); bodyL = reserveLabel(); endL = reserveLabel()
  terminate(br(condL))
  openBlock(condL); cond = lowerExpr(stmt.condition); terminate(brcond(cond, bodyL, endL))
  push loopStack { breakTarget: endL, continueTarget: condL }
  openBlock(bodyL); lowerBlock(stmt.body); if !isTerminated(): terminate(br(condL))
  pop loopStack
  openBlock(endL)
```

### 2.3 `do-while` (FR-7)

```
lowerDoWhile(stmt):
  bodyL = reserveLabel(); condL = reserveLabel(); endL = reserveLabel()
  terminate(br(bodyL))
  push loopStack { breakTarget: endL, continueTarget: condL }
  openBlock(bodyL); lowerBlock(stmt.body); if !isTerminated(): terminate(br(condL))
  pop loopStack
  openBlock(condL); cond = lowerExpr(stmt.condition); terminate(brcond(cond, bodyL, endL))
  openBlock(endL)
```

`continue` targets `condL` (re-evaluate the condition) — correct for do-while.

### 2.4 `for` (`to`/`downto`/`step`, Pattern A — FR-7, AR-6)

The counter is a frame local (allocated via §B of `03-01`). Lower to an explicit
init/compare/body/increment CFG:

```
lowerFor(stmt):
  # init: counter = init
  store(counterSym, lowerExpr(stmt.init))
  condL = reserveLabel(); bodyL = reserveLabel(); incrL = reserveLabel(); endL = reserveLabel()
  terminate(br(condL))
  openBlock(condL):
     # Pattern A: compare counter against the loop's continue predicate.
     #   to     : continue while counter <= bound     → cmp = (counter <= bound)
     #   downto : continue while counter >= bound      → cmp = (counter >= bound)
     cmp = compareCounter(counterSym, stmt.direction, lowerExpr(stmt.bound))
     terminate(brcond(cmp, bodyL, endL))
  push loopStack { breakTarget: endL, continueTarget: incrL }
  openBlock(bodyL); lowerBlock(stmt.body); if !isTerminated(): terminate(br(incrL))
  pop loopStack
  openBlock(incrL):
     step = stmt.step ? constStep(stmt.step) : 1
     counter = (direction == "to") ? counter + step : counter - step
     terminate(br(condL))
  openBlock(endL)
```

`compareCounter` emits an IL comparison (`le` for `to`, `ge` for `downto`) producing a boolean operand
— the same comparison ops 3b already lowers/translates. The increment is an `add`/`sub` by the const
step into the counter slot. **Full-range guard (AR-6):** if `evalConst(bound)` equals `type_max` of
the counter for a `to` loop (the Pattern-B wrap case), record `iceUnsupported` ("for-loop full-range
`to <type-max>` — Pattern B deferred") rather than emit an incorrect compare; 4a fixtures avoid it.

### 2.5 `break` / `continue` (FR-8, AR-12)

```
lowerBreak(stmt):    terminate(br(loopStack.top.breakTarget))
lowerContinue(stmt): terminate(br(loopStack.top.continueTarget))
```

After a `break`/`continue` terminates the current block, any following statements in the same body are
unreachable; the next `openBlock` (from the enclosing construct) resumes normal lowering. (A stray
statement after `break` in the same block would lower into the just-terminated block; guard by
skipping lowering once `isTerminated()` in `lowerBlock`'s statement loop — a small, safe addition.)

## 3. `lowerBlock` guard

`lowerBlock` iterates `block.statements` calling `lowerStmt`. Add: **stop emitting once the current
block is terminated** (`if (builder.isTerminated()) break;`) so unreachable tail statements after a
`return`/`break`/`continue` don't append to a terminated block. This keeps blocks single-terminator.

## 4. Non-regression (AR-13)

Straight-line functions (no control flow) still lower to a single `_entry` block + `ret` — the new
code only triggers on the new statement kinds. gate/slice3a/slice3b goldens must be unchanged.
