# 03-03 — Multi-Block Translation (`translate.ts`)

> IL→Instr: iterate all CFG blocks, emit block labels, translate `br`/`brcond`/`unreachable`.
> Traces: FR-9, AR-11. **CodeOps Skills Version**: 3.2.0

## 1. All-blocks loop (FR-9)

Today `run()` (`translate.ts:169-188`) translates only `this.fn.blocks[0]`. Change it to iterate
**every** block in order:

```
run():
  emit function-entry label: label(sanitize(this.fn.name))     # unchanged (:171)
  prescanAll()                                                  # §1a — cover ALL blocks, not blocks[0]
  for (const block of this.fn.blocks):
     resetBlockState()                                          # §1a — MANDATORY per-block reset
     if block.label !== "_entry":  this.out.push(label(blockLabel(block.label)))
     for (const ins of block.instructions): translateInstruction(ins)
     translateTerminator(block.terminator)
```

- `_entry` keeps using the function-entry label (no separate `_entry:` label emitted — preserves the
  straight-line golden). Non-entry blocks (`_L0`,`_L1`,…) emit their own label.
- `blockLabel(raw)`: map the IL block label to an ASM-safe, function-unique label, e.g.
  `` `${sanitize(this.fn.name)}${raw}` `` → `Module_fn_L0` (avoids cross-function collisions since two
  functions may both mint `_L0`). Rendering already handled by `print-instr.ts:197-198`.

## 1a. Per-block translator-state reset — 🚨 MANDATORY (correctness, not optimization)

The single-block translator threads **peephole/fold state** across instructions that is valid only
**within one basic block**. A block label is a **branch target**: at runtime control may arrive from a
block *other* than the one emitted just before it in list order, so **nothing may carry across a block
boundary**. The pre-4a `run()` never had to reset because it translated one block; the multi-block
keystone MUST. Concretely, two of these are wrong-code paths (not lost optimizations):

- **`prescan` scope (`translate.ts:193-205`).** Today `prescan` scans `blocks[0]`'s instructions plus
  that block's `ret` terminator value (`:201-204`), populating `useCount` (`:197`,`:203`), which gates
  the single-use load fold (`:338`, `<=1`) and the store-home fold (`:581`, `>1`). A temp read **twice**
  inside a non-entry block would under-count to 0 → its load is folded into the first consumer and the
  second consumer reads nothing. **Fix:** `prescanAll()` — run the prescan over **every** block
  (`useCount` is a function-global map: temp ids are function-unique), and count **each block's
  terminator read operands** too — `brcond.cond` and `ret.value` — not just `blocks[0]`'s `ret`, so a
  condition temp consumed by a `brcond` is not itself under-counted.
- **`skipIndex` (`:155`/`:177`/`:592`).** This is an instruction **index**, not a temp id — block
  locality gives it no protection. A word-ALU store-fold in block A leaves `skipIndex ≥ 0`; block B's
  instruction loop restarts at index 0, so `if (i === this.skipIndex) return` (`:177`) **silently drops
  a live instruction** in B. **Fix:** reset `skipIndex = -1` at each block boundary.
- **`regA`/`regX` residency + `loadSource` + `leadSpan`.** `leftIntoA` suppresses `LDA` when
  `regA === op.id` (`:462`). Temps are block-local in this lowering, so a false id-match across a join
  is unlikely today — but resetting is cheap insurance and keeps the fold model sound as later slices
  add cross-block values. **Fix:** call `clearRegs()` (`:823`) and clear `loadSource`/`leadSpan` at each
  block boundary.

`resetBlockState()` = `clearRegs()` + `skipIndex = -1` + `leadSpan = undefined` + clear `loadSource`,
called once per block before its instructions. Impl-test coverage is added in §Phase 3 (P3): a
non-entry block that reads one temp twice, and a word-ALU immediately followed by a branch.

## 2. Terminator translation (FR-9)

Replace `translateTerminator` (`:304-314`, currently `ret`-only) with a full switch:

- **`ret`** — unchanged (existing value-return + `RTS`).
- **`br`** — `emit("JMP", "Absolute", labelRef(blockLabel(term.target)))`. (Unconditional jump; 3-byte
  absolute is always in range, unlike relative branches.)
- **`brcond`** — the condition operand is a **materialized boolean byte (0/1)**, not live CPU flags.
  In 3b/4a `term.cond` is the operand from `lowerExpr(condition)`; a comparison condition is lowered by
  `translateComparison` (`:600-630`), which does **not** leave the compare's flags live — it emits
  `CMP` then materializes a 0/1 into A via `LDA #1 / <branch> / LDA #0` + a `_cmp` join label and binds
  the result temp. So there are **no live flags** at the `brcond`; translate it by loading the boolean
  and branching:
  - Shape: `LDA <cond>; BNE <trueTarget>; JMP <falseTarget>`. When `cond` is already the temp resident
    in A (the just-materialized comparison result), `leftIntoA` suppresses the redundant `LDA`
    **within this same block** (the residency mirror is valid intra-block; see §1a).
  - `trueTarget`/`falseTarget` use `blockLabel(...)`. Emit the `BNE` to the true target (relative;
    when out of range ACME reports it — acceptable for 4a fixtures) and a `JMP` to the false target.
  - Fusing the compare **into** the branch (dropping the 0/1 materialization to branch on live flags)
    would require a non-materializing comparison lowering that does **not** exist yet — it is an RD-08
    peephole, explicitly out of scope. Do **not** wire `brcond` to phantom-live flags.
- **`unreachable`** — emit nothing (or a defensive `RTS`); records no ICE. It only appears where
  lowering proved control cannot reach (rare in 4a).

> **Correctness-first, not cycle-optimal.** The `LDA cond; BNE true; JMP false` shape is deliberately
> simple and always correct. Fusing the compare+branch (dropping the boolean materialization) is a
> peephole/RD-08 concern, explicitly out of scope (the "unoptimized first" strategy).

## 3. Condition materialization contract

`lower.ts` produces `brcond(cond, …)` where `cond` is the operand from `lowerExpr(condition)`. For 4a
the condition is a comparison (`==`,`!=`,`<`,`<=`,`>`,`>=`) or a `boolean` variable/literal — all
already lowered to a boolean-valued IL operand in 3b. `translate` reads that operand the same way the
existing comparison/boolean paths do. No new IL op is required — `brcond` consumes an existing operand.

## 4. Per-function label counter / uniqueness

Block labels derive from the builder's `_L<n>` (function-local, reset per function) prefixed by the
sanitized function name in `blockLabel`, so `Module_fn_L0` is globally unique. The existing
`cmpCounter` (`:157`) for `_cmp` labels is untouched and continues to serve comparison lowering; the
two label families do not collide.

## 5. Non-regression (AR-13)

A single-`_entry`-block function (all of gate/slice3a/slice3b) has no non-entry blocks and only a
`ret` terminator → the new loop degenerates to exactly today's behavior. Goldens unchanged.
