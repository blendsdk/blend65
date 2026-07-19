# 03-03 — Branch Relaxation (closes #65)

> Complexity: **M** · Phase 1 — built **and wired** first, because it is a provable corpus no-op
> A new unconditional stage. Not a peephole rule (AR #26, #28).

## Why this ships first

No fixture in the repo has ever carried a branch beyond the 6502's −128..+127 relative reach.
Registering relaxation therefore changes **zero** goldens — and that is the point: it makes the
existing byte-exact corpus a free, corpus-wide proof that the stage is the identity on in-range
code. If a golden moves a byte in Phase 1, relaxation is wrong and it is caught before anything
else is in flight. It also puts the sole range authority in place before inversion can create an
out-of-reach branch (AR #34).

## Why not a peephole rule

Two independent reasons, in order of weight:

1. The peephole is gated on `--optimize` (`emit.ts:139-141`, default `true` at
   `config/src/defaults.ts:38`). Relaxation is **correctness**: a program that assembles under
   `--optimize` and fails under `--no-optimize` is a trap.
2. Expressing it there would require redesigning the rule contract
   (`instr/peephole.ts:47-60`) that RD-06 is about to build on — its window is consecutive
   *instruction* entries and labels pass through verbatim, so a rule cannot insert one.

## Signature and placement

```ts
export function relaxBranches(
  program: InstrProgram,
  _cpu: CpuVariant,
  bag: DiagnosticBag,
): InstrProgram;
```

**The CPU parameter is unused today and carries the `_` prefix** (AR #50). Nothing in the algorithm
below consumes it: `instrByteSize` is CPU-independent, `invertBranch` is CPU-independent, and `BRA`
is never emitted. `eslint.config.mjs` sets `@typescript-eslint/no-unused-vars` to *error* with
`argsIgnorePattern: "^_"`, and lint is inside the verify command — so an unprefixed `cpu` would
mean Phase 1 could not end green. The prefix is the repo's canonical marker for a parameter that
documents a future API, with the precedent one file away in `optimizeInstr(program, _cpuVariant,
bag)`. The seam is real rather than decorative: Commander X16 is a 65C02 target, and an
out-of-range `BRA` there relaxes to a single `JMP` rather than the three-entry shape, so the
variant genuinely belongs in this signature once that case exists.

`emit.ts` `assembleAsmText` (`:125-149`) becomes:

```
assembleProgram → optimizeInstr (gated) → relaxBranches (always) → collectReferencedRoutines
                                                                 → serializeToAcme
```

The returned program becomes **both** the serialized text and `AssembledAsm.program`, so
`build.ts:92`'s cost summary counts relaxed branches instead of under-reporting them. `preamble`,
`allocationPlan` and `preambleOptions` pass through unchanged — `build.ts:93` reads the last of
those. When nothing is relaxed the **input reference is returned**, mirroring `optimizeInstr`'s
passthrough discipline.

Running after the peephole is deliberate: relaxation must measure post-peephole sizes, which is
what "the geometry actually emitted" means.

## The emitted form

`B<inv> _rlxN` · `JMP far` · `_rlxN:` — a minted synthetic local label, because
`InstrOperand` has no PC-relative variant (`core/src/instr-model/operand.ts:30-39`) and
`Relative` mode renders bare operand text (`print-instr.ts:111-116`), so `B<inv> *+5` is simply
not representable. Minting keeps `@blend65/core` out of scope.

Label uniqueness follows the counter pattern already established for `_cmpN`
(`translate.ts:91-97`). Relaxation runs once over the whole `InstrProgram`, so a single
stage-local counter covers every stream; no threading through `TranslateOptions` is needed.
Names are checked against the label set the stage can actually see — every stream's label entries
plus the preamble — so a hand-written source symbol can never be shadowed.

**What that check cannot see** (AR #45): the runtime section is pre-composed text appended at
`emit.ts:147-148` from hand-written `.asm` modules, so its labels are outside `InstrProgram.streams`
and outside the scan. This is scoped honestly rather than papered over — a collision there would be
an ACME duplicate-symbol error, which is loud, and the namespaces are disjoint in practice (runtime
symbols are `__rt_`-prefixed, user symbols `__`-prefixed, block labels carry a `Module_fn` stem).
ST-B33 is worded to promise only what the mechanism checks.

The polarity partner is `invertBranch` from [03-02](03-02-branch-tail.md) — one table, one
place, shared by inversion and relaxation.

## Algorithm

Per stream, iterate to a fixpoint:

1. Walk `entries` accumulating byte offsets via `instrByteSize` (`print-instr.ts:239-252`),
   recording each label's offset.
2. For every `Relative`-mode instruction with a `labelRef` operand: displacement =
   `targetOffset − (branchOffset + 2)`. Out of range when `< −128` or `> 127`.
3. Rewrite each out-of-range branch into the three-entry form.
4. Repeat until a pass relaxes nothing.

**Termination** is monotone: a relaxed branch is never un-relaxed, and each iteration relaxes at
least one branch from a finite set. Relaxing inserts three bytes and so can push another branch
out of range — which is exactly why this iterates rather than running once.

**Scope of the distance computation.** Branch targets are always intra-stream: every `Relative`
emission comes from `translate.ts` and names a block label or a translator-minted `_cmpN`/`_shN`
label, all of which live in the same stream. A `Relative` branch whose `labelRef` target is not
found in its own stream raises an internal compiler error (`E90001`) rather than being skipped —
skipping would be the silent truncation this change exists to prevent.

Because displacements are intra-stream label *differences*, the stream's own base address never
enters the arithmetic — so the preamble, the inter-stream comment lines, the const-data streams and
the appended runtime section all cancel out. Excluding them is correct, not an omission.

**The walk's standing assumption, enforced rather than assumed** (AR #51). `instrByteSize` returns
0 for an `origin` directive and a codepoint-naive length for `text`, so a directive inside a code
stream would silently corrupt the offsets. Today that cannot happen — the translator pushes only
labels and instructions, and directives live exclusively in the preamble and const-data streams
(verified across the package) — but the invariant is load-bearing and unowned. The stage therefore
raises an internal compiler error if it meets a directive inside a code-segment stream, so that
later work rewriting streams trips a gate instead of miscomputing a displacement.

`BRA` is in the opcode union and the 65C02 table but is never emitted; it would arrive at
`invertBranch` as `undefined` and hit the same loud path.

## Range fixtures (AC-6)

Two source programs, at the unit tier — no new corpus fixture and no hand-written twin, because
a 130-byte filler loop carries no idiom to compare against (AR #32):

- a `do…while` whose body exceeds the relative reach;
- a `switch` whose dispatch-to-body distance exceeds it.

**Where the sources live** (AR #48): inlined `*_SRC` constants in
`packages/test-harness/src/testing/range-branches.ts`, following the harness's existing shape — but
with **no `examples/` counterparts**, and deliberately **not** added to `examples-sync`'s
`INLINED_MODULES` list. That suite exists to keep published example programs and inlined fixture
sources in step; these two are unit-tier range probes with nothing published to stay in step with,
and adding them to the list without `examples/` files would fail it.

Both **assemble under ACME** in a `skipIf(!hasAcme())` spec test that runs in CI, and both
**execute correctly** in a local VICE case. The suite also asserts the negative: in-range
branches are untouched, so no blanket branch-over-jump appears.

## The assumption this proves

The RD records — honestly — that #65's current failure is *believed* to be a loud ACME range
error rather than a silent miscompile, but that no fixture has ever exercised it, so the claim
is an untested prediction. These fixtures are what establish it. **Before** the fix is wired,
the plan compiles one of them and records ACME's actual behavior. If it turns out to truncate
silently rather than error, that raises #65's severity and is reported, not absorbed.

**Measured, before any code changed** (Phase 1 task 1.1, on `b06b09d`). Both probe shapes were
compiled through `blendc build --platform c64`:

| Probe | ACME | Compiler | Artifact |
|---|---|---|---|
| `do…while`, 40-poke body — back-edge `BCC Main_main_L0` | `Target out of range (-219; 91 too far)` | `E90001`, exit 3 | `.asm` and `.lbl` written, **no `.prg`** |
| `switch`, two 40-poke arms — dispatch `BEQ Main_main_L2` / `BEQ Main_main_L3` | `Target out of range (219; 92 too far)` *and* `(412; 285 too far)` | same | same |

So the prediction holds: the failure is **loud**, at assembly time, and no binary is produced.
#65's severity stands as recorded — it is a compile-time refusal, not a silent miscompile, and
nothing about it is escalated. Two incidental confirmations came with it: the forward (switch)
and backward (`do…while`) directions both occur, and the switch probe emits *two* out-of-range
branches from one program, so the fixpoint's multi-branch path is exercised by a real fixture
rather than only by a synthetic one.
