# 03-01 — IL Passes: Jump Threading + Unreachable-Block Removal

> Complexity: **M** · Phase 2 (built unwired) → Phase 4 (registered)
> Seam A — `optimizeIL`, which already runs unconditionally. Placement per AR #26; two passes
> rather than one per AR #29.

## Why two passes, not one

Removal must be **independently schedulable**: the const-fold pass split from #58 orphans blocks
the same way and re-runs removal after folding. One implementation, two clients. Threading has
no such second client but is trivially separable, and separating them makes each testable as
`ILProgram → ILProgram` in isolation.

## `thread-jumps.ts`

```ts
export const threadJumps: ILPass = { name: "thread-jumps", run(program, bag) { … } };
```

**Trampoline predicate.** A block is a trampoline when its `instructions` list is empty and its
terminator is `{ kind: "br" }`. "Empty" is exact today: the only zero-effect IL instruction is
`source_span` (`il/instruction.ts:146`) and no producer for it exists in the codegen package.
Should one appear, the predicate must treat a provenance-only body as empty **and** re-attach or
drop the span — never silently under-fire. That obligation is carried as a comment in plain
language at the predicate.

**Resolution.** For each terminator target `T`, follow the trampoline chain to its final
destination, carrying a per-resolution `visited` set of labels. On revisiting a label the chain
is cyclic (`L: JMP L` and longer rings are legal programs — `while (true) {}` lowers to one), and
**resolution abandons the rewrite: `T` is left exactly as it was** (AR #44). Every target of every
terminator kind is rewritten through the same enumeration (`terminatorTargets`,
`il/cfg.ts:55-72`) so a terminator kind cannot be forgotten.

The same abandonment applies when the chain runs off into a label **no block defines** (AR #62,
ST-B47). Following it would copy one broken edge onto every branch that reached the chain, and
removal would then drop the block that actually carried the mistake — moving the eventual
translator error off the block that caused it. The malformed function stays the translator's to
reject; the pass only has to avoid making it harder to describe. This is distinct from ST-B46's
*direct* dangling target, which the walk refuses on its first step.

The cyclic rule is stated as "leave it unchanged" rather than "return the label where the cycle was
detected" because the latter has more than one reading — the revisited label, or the label under
examination when the revisit happened — and two conforming implementations would then emit
different bytes under a byte-exact golden regime. Leaving the target alone is deterministic,
needs no tie-break, and matches what ST-B5 already observes for the one-block ring.

**What is *not* rewritten.** The pass never removes a block, never reorders `blocks`, and never
touches `blocks[0]`'s position. A trampoline that is itself the entry block stays — it is a
root, and its own jump is what elision suppresses later.

**Convergence.** One pass suffices: threading only rewrites terminator targets, so it cannot
create a new trampoline (a block's `instructions` list is never emptied by it), and
chain-following already resolves multi-hop chains within the single pass.

**Idempotence.** Running the pass twice yields the same program — asserted, because the const-
fold pass will eventually schedule these passes more than once.

**Module-init.** `ILProgram.initCode` is a bare block list, not a function (`il/cfg.ts:114-125`).
Threading applies to it identically.

## `remove-unreachable-blocks.ts`

```ts
export const removeUnreachableBlocks: ILPass = { name: "remove-unreachable-blocks", run(…) };
```

**Roots**, stated once: each function's own `blocks[0]`, plus `initCode[0]` for the module
initializer.

**Both roots can be absent, and neither may crash.** A function with no blocks is a tolerated shape
— `assembleProgram` explicitly skips functions with no IL (`instr-program.ts:110-114`, error
tolerance and never-lowered functions) — and an empty `initCode` is the *normal* case (`cfg.ts:125`
: it is empty when no module variable has an initializer). Once these passes are registered they
iterate every function and the init list on every compile, so a bare `blocks[0].label` root read
would be a compiler crash on every error-tolerant compile. Both passes are the identity on both
shapes, pinned by ST-B41 and ST-B42 (AR #52). The factored walk inherits `termination.ts:32`'s
`entry === undefined` guard, but the spec suite is the oracle, not the inherited code.

**Walk.** Breadth/depth-first over `terminatorTargets`, exactly the walk
`il/termination.ts:30-66` already performs for startup-shim selection (its `seen` set *is* the
reachable set). The shared successor walk is factored out so the two cannot drift.

**Deliberately not inherited:** that function's constant-`brcond` edge refinement
(`termination.ts:49-52`, which follows only the taken edge of a literal condition). Folding
constant conditions belongs to the const-fold pass; a conservative walk here keeps the two from
disagreeing about what is reachable. This is a decision, not an oversight — it is why the pass
cannot simply call `functionCanReturn`'s internals verbatim.

**Order preservation.** Surviving blocks keep their relative order. This matters: elision reads
adjacency off that order, and reordering is explicitly out of scope (AR #27).

**Dangling targets.** A target naming no block is skipped rather than crashing, mirroring
`termination.ts:57-60`; the translator's `validateTerminatorTargets`
(`instr/translate.ts:305-314`) remains the authority that raises the internal compiler error.

**Carve-out.** A self-referential jump-only block is *reachable* and semantically load-bearing;
it survives. Removal is reachability-driven so this falls out for free — the carve-out is
asserted rather than special-cased.

## Registration (Phase 4)

`packages/compiler/src/api/emit.ts:108` becomes:

```ts
return optimizeIL(il, [threadJumps, removeUnreachableBlocks], run.bag);
```

Threading before removal, because threading is what orphans the trampolines removal then drops.
Whichever of this change and the const-fold pass lands second inserts `constFold` **ahead** of
these two; this plan takes no dependency on that pass and the dependency runs the other way
(AR #33).

**Three doc comments become false at this line and are updated in the same task** (AR #53):
`il/optimizer/pass.ts` ("v1 ships **no** passes… no v1 pass exists to violate them"),
`optimize-il.ts` ("**v1 callers pass `[]`** — the loop body never runs and the original program
reference is returned unchanged"), and the inline comment at `emit.ts:107` ("v1 ships no passes →
identity"). The `emit.ts` one sits on the line being rewritten and would likely be caught anyway;
the two module-level docs would not be, and JSDoc accuracy on exported contracts is a required
convention here.

Because `emitIl` and `emitAsm` share `lowerProgram()`, `--emit-il` shows exactly the blocks and
edges that reach the emitter — AC-11 is satisfied by construction, and is asserted rather than
assumed.

## Layout is unconditional

`optimizeIL` is not gated on `--optimize` (contrast `optimizeInstr` at `emit.ts:139-141`).
Registering here is therefore all that is needed for AC-7's "gating is uniform" — nothing in
this document reads the config (AR #30).
