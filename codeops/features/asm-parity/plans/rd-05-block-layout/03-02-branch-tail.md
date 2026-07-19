# 03-02 — The Branch Tail: Fall-Through Elision + Branch Inversion

> Complexity: **M** · Seam B — translation time, the only place block adjacency exists. Extracted
> into its own module rather than grown inside the 2250-line `translate.ts` (AR #33).
>
> **This module lands in two parts** (AR #42). `invertBranch` and the polarity table are
> implemented in **Phase 1**, because relaxation consumes them and Phase 1 wires relaxation into
> production; their oracle (ST-B20, ST-B21) is authored in Phase 1 too, red before the
> implementation. `TailPlan` and `planBranchTail` follow in **Phase 3**, unwired, and Phase 4
> consults them from the block loop.

## One decision, not two transforms

Given a conditional branch to `T` followed by `JMP F`, with `N` the label of the next emitted
block:

| Condition | Emitted |
|---|---|
| `F === N` | `B<c> T` — the jump is dropped |
| `T === N` | `B<!c> F` — the branch inverts and the jump is dropped |
| neither | `B<c> T` · `JMP F` — unchanged |
| no next block (last) | unchanged |

An unconditional `br T` is the degenerate case: emitted iff `T !== N`.

`T === N` and `F === N` cannot both hold unless `T === F`, which this change deliberately does
not special-case (AR #37); the table is evaluated in the order above so the degenerate input is
total rather than undefined.

## `packages/codegen/src/instr/branch-tail.ts`

Two exports, both pure — no translator state, no emission:

```ts
/** What a block tail should emit, given the label that follows it. */
export type TailPlan =
  | { readonly kind: "both" }
  | { readonly kind: "elide" }                              // drop the trailing jump
  | { readonly kind: "invert"; readonly opcode: Opcode };   // inverted branch to the false edge

export function planBranchTail(
  branch: Opcode,
  trueTarget: string,
  falseTarget: string,
  nextLabel: string | undefined,
): TailPlan;

/** The polarity partner of a 6502 conditional branch. */
export function invertBranch(opcode: Opcode): Opcode | undefined;
```

**Polarity table** — total over the eight NMOS conditional branches, and *only* those:

| | | | |
|---|---|---|---|
| `BEQ` ↔ `BNE` | `BCC` ↔ `BCS` | `BMI` ↔ `BPL` | `BVC` ↔ `BVS` |

`invertBranch` returns `undefined` for anything else. `BRA` exists in the opcode union and the
65C02 table (`instr/cpu-table.ts:131`) but nothing emits it; an `undefined` reaching the caller
raises an internal compiler error rather than silently emitting the un-inverted pair — a missed
inversion is invisible in output, and invisible is the failure mode this whole change exists to
eliminate.

## Wiring into the block loop (Phase 4)

`translate.ts:264-284` gains the next block's **IL** label:

```ts
this.fn.blocks.forEach((block, i) => {
  this.nextBlockLabel = this.fn.blocks[i + 1]?.label;
  …
});
```

Comparing IL labels — not emitted names — is deliberate. `blocks[0]` is always the entry block
(`il/cfg.ts:88`), so the next block is never the entry, and the entry's two-scheme naming
(`sanitize(fn.name)` at `:247` versus `blockLabel()` at `:381-383`) never enters the comparison.
The alternative, comparing rendered labels, is where a `_main` / `Main_main_L0` mismatch would
produce either a dangling-label assembler error or a silently missed elision.

Four call sites consult the plan (see [02-current-state § the four sites](02-current-state.md)):

| Site | Change |
|---|---|
| `br`, `:602-603` | emit the `JMP` only when the target is not the next block |
| `brcond`, `:605-608` | plan over `BNE` / true / false |
| `emitCmpTail` branch arm, `:1141-1149` | plan over the framing's `branch` opcode — covers four of the five framings |
| `wordUnsignedOrdered` branch arm, `:1250-1256` | plan over the **final** `BCC`/`BCS` of `wordUnsignedDecision` and its trailing `JMP falseL` — via the descriptor mechanism below |

The 16-bit unsigned case needs care and is called out because it is the one that reads
differently: `wordUnsignedDecision` (`:1279-1300`) emits *three* branches, two of which target
block labels mid-framing. Only the last one pairs with the trailing jump; the two early
decisions are framing-internal and must not be inverted. Concretely, only the `BCC`/`BCS` at
`:1299` participates.

**The mechanism, stated explicitly** (AR #49), because the site that owns the decision is not the
site that emits the branch. `wordUnsignedOrdered`'s branch arm owns only the trailing `JMP` at
`:1254`; the branch to be inverted is emitted *inside* `wordUnsignedDecision` at `:1299`, and that
helper is shared with the value-tail path at `:1262`, where inversion must never fire. The arm
therefore computes the `TailPlan` once and passes an **optional final-branch descriptor** into the
helper, defaulted so the value-tail call site is textually unchanged and provably unaffected. The
arm still decides its own trailing `JMP`.

Two consequences to carry out with it. The helper's docstring — "Falls through only when the answer
is 'no' — the caller says where that goes" — becomes false under an inverted final branch and is
rewritten in the same edit; leaving it invites a future reader to "fix" the polarity back. And
ST-B24's wording ("the two decisions inside `wordUnsignedDecision` are untouched") describes the
same boundary this mechanism draws, so the two must be read together.

The alternative — hoisting the `:1299` emission out of the helper into both call sites — was
rejected: it duplicates the `wantLess ? "BCC" : "BCS"` mapping across two sites, which is exactly
the polarity-drift surface this framing can least afford.

The same rule guards the other framings: `wordEquality`'s low-byte early-out (`:1211-1219`) also
branches straight to a block edge, and `byteSignedOrdered` / `wordSignedOrdered` branch over an
`EOR` correction to a minted label. None of these is a block tail.

## Range-blindness is intentional

The decision is taken before any instruction address exists, so inversion can hand relaxation a
branch that is out of reach. That is correct and by design: relaxation is the **sole** range
authority (AR #26), and it reconstitutes the branch-over-jump form at the same two offsets the
pre-change output used — byte- and cycle-identical to what was emitted before. The only cost is
a forgone improvement over the short inverted branch that could not be encoded, never a
regression.

## `unreachable` needs no handling

An `unreachable`-terminated block emits nothing (`translate.ts:610-611`). It physically falls
into whatever follows, harmlessly, because control provably cannot arrive.

## What elision does to labels

Eliding a jump can leave a block label as the *only* thing between two instruction runs. Those
labels stay: budget windows and emulator landmarks resolve through the symbol map, and
`budgets.spec.test.ts:170-174` throws `label '<x>' is not in the symbol map` if one disappears.
Removing a now-unreferenced label is not an optimization this change makes (AC-4).

One consequence to keep in view: after elision `_main` and the first surviving block label sit at
the **same address**. Any reverse address→name lookup becomes ambiguous — which is precisely why
`label-arrivals.spec.test.ts` stops doing one (AR #35).
