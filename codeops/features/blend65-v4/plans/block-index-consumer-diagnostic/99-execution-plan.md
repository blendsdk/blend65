# Consumer-aware block-index alignment diagnostic (#158)

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: T-38 / #158
> **Progress**: 2/5 tasks (40%) — the approval path is fully resolved; implementation is not
> available under the current freeze
> **Status**: **Not deliverable under the current freeze**, proved by attempt. The requirement is
> recorded as errata E-10; relabelling the issue as deferred is proposed
> **Last Updated**: 2026-11-21
> **Baseline**: analysis performed at `717af1d2`, clean `feature/v4-rebuild`
> **Scope**: strict; a diagnostic for an unsatisfiable block-index alignment reaching a proved
> hardware consumer
> **Created**: 2026-11-21

## What the issue asks for

When a module object's address is used as a hardware block index — a sprite pointer, a pointer
table — the effective address has to start on a block boundary. The alignment pass already infers
that demand and strengthens **automatic** placement. Two shapes are left alone and emit nothing:
an explicit `place(at:)` that lands off the boundary, and an automatic field offset that root
alignment cannot express.

Reproduced at this baseline. The issue's own witness builds with no diagnostic at all:

```
module Game;
place(at: $0B50) let buffer: byte[64];
function main(): void {
  c64.vic.setSpritePointer(0, lo(&buffer / 64));
  while (true) { }
}
```

`$0B50 / 64` is block 45, which begins at `$0B40` — sixteen bytes before the buffer. The sprite
reads the wrong bytes and the compiler says nothing. The only diagnostic emitted is an unrelated
uninitialized-array warning.

The counter-case also behaves correctly today and must keep doing so: the same expression written
to an ordinary address, `poke($C000, lo(&buffer / 64))`, is accepted and must stay accepted,
because that is ordinary address arithmetic rather than a hardware block selector.

## The analysis is finished — here is everything the implementation needs

### Where the two undiagnosed shapes live

Both are explicit, deliberate skips in `packages/compiler/src/semantic/block-index-alignment.ts`,
and the facts a diagnostic needs are already computed beside them:

| Skip | Location | What is already known there |
| --- | --- | --- |
| An explicit or zero-page placement is the author's contract | `:325-327` — `if (placement?.at !== null && placement?.at !== undefined) return global;` | The demanded `align`, the static `offset`, and the explicit address |
| Root alignment cannot express a demand whose offset is not a multiple of it | `:331-333` — `if (demand.offset % demand.align !== 0) continue;` | Same, but the final address is not yet chosen |

The pass records demands as `{ align, offset }` per object (`:14-20`), so the **effective address**
is `at + offset` and satisfiability is `(at + offset) % align === 0`. For the witness that is
`($0B50 + 0) % 64 = 16`, which is non-zero, so it is provably unsatisfiable.

### The proved-hardware-consumer test exists

`c64.vic.setSpritePointer` is a platform **capability** operation
(`packages/compiler/src/frontend/profile.ts:347`, lowered at
`packages/compiler/src/machine/lower-c64.ts:727-731`). So "a proved hardware consumer receives the
value" is decidable on the semantic operations: the demanded value flows into a `platform`
operation whose capability is a known block-pointer consumer. No new analysis is required, and
this is what keeps `poke($C000, …)` accepted — a raw memory write is not such a consumer.

This matters because the pass as written records a demand from the **expression shape alone**, with
no consumer test. A diagnostic must add that test; without it, ordinary arithmetic would be
reported.

### Only the first shape is diagnosable, and the issue already says so

The second skip has no address to judge at that point — placement is automatic and not yet chosen.
The issue's own acceptance asks for that case to be **considered** rather than reported: *"a field
at offset 1 can be aligned by a root placement other than `align: 64`"*. So the deliverable is the
explicit-placement case, plus leaving the automatic case to a stronger placement solver.

## The decision that blocks implementation

**A warning is forced, an error is impossible, and no warning code exists.** Each step is
evidence-backed.

### An error is impossible

`test/rd04/block-index-alignment.spec.test.ts:170-185` is a **frozen specification oracle** that
pins the witness as accepted, with this comment:

> An explicit address is the user's contract. A misaligned one is preserved unchanged; this pass
> does not invent a new rejection for ordinary math.

It asserts `built.kind === "success"` and that the buffer stays at `$0B50`. A frozen oracle may
never be edited, and a failure means the implementation is wrong. So any error-severity diagnostic
is ruled out by a contract already in force — including the otherwise perfectly worded `E10143`
*"Alignment conflict — '<data>' requires <align>-byte alignment but placement failed"*
(`spec/14-diagnostics.md:160`).

Checked, and worth recording because it is what makes a warning viable at all: that oracle asserts
only the build **kind** and the address. It does not assert the absence of warnings, so adding a
warning keeps it green.

### No existing warning code fits

All 31 active warning codes in `spec/14-diagnostics.md:273-301` were reviewed. They cover usage
budgets, overflow and narrowing, struct and array advisories, unreachable code, multiply and divide
costs, stack use, initialization, unused declarations, literals, and cross-domain sharing. **None
concerns hardware alignment or whether a placement can satisfy a derived requirement.** The nearest
neighbour, `W10151`, is about several declarations sharing one embedded address, not about
alignment. This confirms the issue's own statement that the registry has no warning code for a
hardware alignment advisory.

### And the registry cannot be edited — two independent locks, one of them absolute

`codeops/00-spec-errata.md` records the governing decision verbatim:

> **Status**: Recording only — `spec/` is the FROZEN spec-v3.0 baseline and stays untouched under
> decision **D3**. Nothing here is applied; this is the queue for a future errata pass.
> … Never edit `spec/` to fix one. D3 holds for the duration of compiler implementation.

**The second lock was found by trying it, after option A was authorized, and it is the one that
settles the matter.** `test/foundation.spec.test.ts:385-401` is itself a frozen oracle. It builds an
approved baseline from the `spec/` tree at a **hardcoded commit** (`:353`) and asserts that both the
**on-disk** tree (`:373`) and the **HEAD** tree (`:376`) are byte-identical to it, file by file.

Measured rather than reasoned: adding the one authorized line to `spec/14-diagnostics.md` fails that
oracle with `14-diagnostics.md: expected false to be true`, and separately fails six cases in
`test/rd04/normative-coverage.impl.test.ts`. Reverting restores all 19 to green.

An earlier reading of this plan concluded the opposite — that the oracle only hashed history,
because `committedBytes` defaults to a pinned release commit. That was wrong: the same test also
reads disk and HEAD and compares them to the approved baseline. The error was mine, and it is
recorded here because it is the reason option A looked available when it was not.

So registering a warning code requires **editing a frozen specification oracle** to re-point the
approved baseline at a new commit. That is categorically larger than adding a registry line: that
oracle is the repository's integrity anchor, binding release lineage, specification identity and the
qualified expert baseline together. It is precisely what a frozen oracle exists to prevent, and it
is not what was authorized.

### Therefore

| Fact | Consequence |
| --- | --- |
| A frozen oracle pins the witness as accepted | An error-severity diagnostic is impossible |
| No warning code covers hardware alignment | A warning has nothing to emit |
| A frozen oracle pins the `spec/` tree byte-for-byte on disk and at HEAD | Registering one cannot be done without re-pointing that anchor |

**#158 as written is not deliverable under the current freeze.** That is the finding, and it is the
issue's own question answered: the approval path it reserved runs through a specification-baseline
amendment, which is a v3.1 activity rather than a compiler change.

## Options

| Option | What it means | Cost |
| --- | --- | --- |
| **A — authorize one scoped `spec/` amendment** (recommended) | Add a single warning code to `spec/14-diagnostics.md` for an unsatisfiable hardware block alignment, naming the required alignment, the effective address and the consumer. Implement against it | Overrides D3 for one line. D3 exists to stop the spec drifting under the implementation, and a strictly additive warning code does not change any existing rule — but it is still an exception, and once made it is a precedent that needs a stated boundary |
| B — reuse an existing warning code | No spec change | Puts a second, unrelated meaning on a published number. The errata log already records this as an active problem: *"Behaviour is present; the numbers lie. Breaks `--suppress-warning` and any tooling keyed on published codes."* Repeating it knowingly is worse than the silence it replaces |
| C — defer to the v3.1 spec pass | Record the requirement as an errata row and close nothing | Honest and cheap, and the errata log is explicitly the agenda for that pass. The defect stays silent in the meantime: a program that cannot work still compiles without a word |
| D — detect without reporting | Compute satisfiability and expose it in build evidence only | No author ever sees it. Fails the issue's own acceptance, which requires the diagnostic to name the alignment, the address and the consumer |

**Recommendation after the attempt: C.** Option A was authorized and attempted; it is blocked by a
frozen oracle that pins the `spec/` tree on disk and at HEAD, so taking it would mean editing the
repository's integrity anchor. That is a different and much larger decision than the one authorized,
and it is not one to make quietly.

So the requirement is recorded as errata row **E-10**, which is what that log is for — it is
explicitly the agenda for the v3.1 pass — and this issue is proposed for relabelling as deferred so
it stops reading as actionable compiler work. Option B stays rejected: knowingly putting a second
meaning on a published number repeats a problem the errata log already records as live.

If the integrity anchor *is* to be re-pointed, that belongs in its own unit with its own review, not
inside a diagnostic slice.

## What is delivered, and what is left

Delivered: the contract, the seam, the severity proof, the code survey, and the approval path —
everything the issue says it owns — plus errata row **E-10** so the requirement survives into the
v3.1 agenda rather than living only in an issue.

Left, and needing a decision that is **not** the one already given: whether to re-point the frozen
specification baseline. Until then the remaining tasks stay blocked, and they are fully specified so
the work is short once that decision exists.

## Tasks

- [x] T-38.1 Establish the contract and the approval path, which is what the issue owns: reproduce
      both shapes, locate the seam and the available facts, prove which severity is admissible, and
      settle whether a code already exists ✅ (all four done; evidence above)
- [x] T-38.2 Obtain the registry decision and attempt it ✅ (authorized, attempted, and **blocked by
      a second frozen oracle** that pins the `spec/` tree on disk and at HEAD; measured, then
      reverted, and recorded as errata row E-10)
- [ ] T-38.3 Author the specification oracle from the issue's acceptance: the proved consumer with
      an unsatisfiable effective address reports the code; the ordinary `poke` stays silent; a field
      aligned by its explicit root address stays silent; an automatic field offset is considered
      rather than reported. Freeze at reproduced RED
- [ ] T-38.4 Implement the consumer test and the satisfiability check beside the existing skip, and
      prove every currently-green oracle stays green — in particular the four cases in
      `test/rd04/block-index-alignment.spec.test.ts` that pin these shapes as accepted
- [ ] T-38.5 Independent review and closeout

## Out of scope

| Item | Why |
| --- | --- |
| The automatic unalignable field offset | The issue asks for it to be *considered*, which is a stronger placement solver rather than a diagnostic. `test/rd04/block-index-alignment.spec.test.ts:204-215` pins it as accepted today |
| Rejecting any program | Forbidden by the frozen oracle quoted above |
| Changing an existing diagnostic's meaning | Option B, rejected above with the errata log's own reasoning |
| The runtime block selector's cost | Owned by #160 |

## Design decisions

| # | Decision | Status |
| --- | --- | --- |
| D-1 | The diagnostic is a **warning**, never an error | Forced by a frozen oracle that asserts the witness builds. Not a preference |
| D-2 | The consumer test gates the diagnostic, not the expression shape | Required by the issue, and it is what keeps ordinary `poke` arithmetic accepted. The pass currently records demands from shape alone |
| D-3 | Only the explicit-placement shape is diagnosed | The automatic shape has no address to judge at that point, and the issue asks for it to be considered rather than reported |
| D-4 | The registry question is the user's | Reserved by the issue itself, and it overrides a recorded project-wide decision |
