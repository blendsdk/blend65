# Function-frame callable-proof repair (#164, bounded unit)

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: T-34 / #164
> **Progress**: 6/6 tasks (100%)
> **Status**: Complete — gate run once, single unrelated emulator failure disclosed
> **Baseline**: `1f608f3c`, clean `feature/v4-rebuild`
> **Phase baseline tree**: `9678b110b7d546869846fb6b3e9b0d2a1ba561b0`
> **Last Updated**: 2026-11-20 01:30
> **Scope**: strict; binding-backed function-frame storage in the already-shipped final proof
> **Reasoning**: high — frame homes are shared between values and summarized across calls
> **Created**: 2026-11-19

## Objective and authority

Stop the compiler accepting a program that overwrites the bytes of a callable held in a function
frame and then calls the stale target. The defect is confirmed in all four optimization modes, for
a scalar local and for a callable inside a local struct, by the
[diagnosis](../local-callable-placement-check/99-execution-plan.md), and the same acceptance was
then reproduced for a **function-typed parameter**, whose home is a separate storage class.

This closes the storage owner the completed global repair deliberately left out. It does not close
issue #164, which keeps handler interference and relocation, and it does not touch release
qualification.

**Smallest viable design:** project the frame homes of binding-backed storage into the same
address-to-root map the shipped proof already consumes, and widen the two call-summary filters so a
write performed inside a callee still reaches the caller's own frame storage. Add no second
analysis, no allocation change, no runtime check and no new error code.

## Requirements and boundaries

1. A callable held in frame storage whose bytes are overwritten before it is read must not keep an
   unsupported target. Governing rules are unchanged from the global unit:
   [function representation](../../../../../spec/02-type-system.md#23-function-types),
   [finite targets](../../../../../spec/06-functions.md#43-finite-target-proof) and
   [ordered memory effects](../../../../../spec/12-intrinsics.md#31-memory-access).
2. Use the homes of the **same closed representation** being judged — the re-closed storage that
   accompanies the layout under test, never the provisional closure and never another tuple.
3. Cover both storage classes that can hold a source-declared callable: locals and parameters.
   A callable packed inside a local struct or fixed array is covered through the existing
   root-relative leaf analysis.
4. A write performed inside a callee must still invalidate the caller's frame storage it covers.
   This does not follow from the projection alone and is called out in the design below.
5. Preserve everything the global unit preserves: source order, definite typed restoration, target
   capture before argument evaluation, initializer order, and the existing disjoint controls.
6. An invalid representation must not publish. Keep the canonical `E10277` with the call as its
   primary site and the storage and the covering write as related sites. Add no new code.
7. Keep valid alternatives available: an optional construction that fails must withdraw and leave a
   sound canonical construction to publish, exactly as the global unit does.
8. Accepted programs keep their bytes, costs and storage demands. This unit adds no code, no home
   and no zero-page byte.
9. Keep `checkProject` pre-layout and editors frontend-only, unchanged from the global unit.
10. Named exclusions, to be recorded in the code rather than left to inference:
    - a binding whose home does not hold the value itself. A struct or array parameter is borrowed,
      so its home holds a two-byte address rather than the object, and an unsized one holds a
      four-byte descriptor. Projecting leaf offsets onto such a home would compute addresses that
      are not the callable's bytes at all;
    - a binding whose requests resolve to more than one home, which happens when a function is
      specialized across execution domains or activation roots;
    - machine-created storage — temporaries, spills, call staging — which can hold a copy of a
      callable word but has no source binding to name it;
    - locals with no home at all, such as NMI-elided or stack-retained ones. Their absence from the
      map is normal and safe, because a value with no home has no bytes a write could cover, and it
      must not be reported as a producer disagreement. The converse is deliberate conservatism: a
      local that does have a home is invalidated when that home is covered, even if the call in
      question happens to read the value from a register copy.
11. Still unqualified afterwards and explicitly not claimed, each with the behaviour an author will
    actually observe:
    - a raw write whose address is only known at run time. The compiler cannot know what such a
      write reaches, and a program that computes a poke address is ordinary, correct 6502 work, so
      it **builds**. The module-variable rule refuses the same program today; measured against the
      prime directive that rule is the defect, and copying it to frame storage was tried, broke the
      valid program in `test/rd04/function-values.spec.test.ts`, and was withdrawn. Relaxing the
      module-variable side, and teaching a definite typed store to restore an unknown-write kill,
      belong to their own unit;
    - interference between an interrupt handler and the main program over callable bytes;
    - relocating storage instead of rejecting;
    - a callable in a helper shared between the main program and a handler, which receives one home
      per execution domain. A purely mainline write over such a home is ordinary #164 and is
      **accepted without any diagnosis**;
    - a write covering machine-created staging, spill or temporary bytes holding a copy of a
      callable word, which is likewise **accepted without any diagnosis**.

Existing `*.spec.test.ts` files, shared helpers, `spec/`, the frozen expert authority and release
records stay unchanged. The new specification file becomes immutable once its RED is recorded.

## Grounded design

### Where the home addresses come from

A storage request already carries its source binding and its purpose
([`storage-types.ts:45–67`](../../../../../packages/compiler/src/storage/storage-types.ts)), and a
home carries the chosen address and width for one request id
([`storage-types.ts:270–280`](../../../../../packages/compiler/src/storage/storage-types.ts)).
Joining them needs no string parsing: take requests whose `storageClass` is `local` or `parameter`
and whose `binding` is not null, then look their `id` up among the homes.

Exclude a struct or array parameter outright, because a borrowed home holds the caller object's
address rather than the object. A width comparison alone is not enough: an aggregate that packs
into the same two bytes an address needs would pass it. The width guard still carries the scalar
case, where a borrowed aggregate parameter reserves two bytes for an address and an unsized one
reserves four
([`inventory.ts:28–35, :500`](../../../../../packages/compiler/src/storage/inventory.ts)), so
neither matches its type size, while a scalar callable local or parameter matches at two bytes.

The homes must come from the re-closed storage that belongs to the representation under test.
`closeSharedStorage` re-closes function storage against the trailing-RAM profile and re-binds the
machine program before the final layout
([`shared-storage.ts:203–279`](../../../../../packages/compiler/src/services/shared-storage.ts)),
and its result is already in scope at both existing proof call sites. The provisional closure held
on the pipeline is **not** the right source.

Layout intervals are not usable as the address source either: overlapping homes are merged into one
`sfa.overlay:` interval
([`c64-layout-objects.ts:101–122`](../../../../../packages/compiler/src/layout/c64-layout-objects.ts)).
A home that overlaps another loses its identity there, and the caller cannot tell beforehand which
homes those are, so the intervals are not a reliable per-request address source.

### Why a shared home does not cause a wrong rejection

The diagnosis raised this as the open question. It is answered without new machinery.

The proof never claims "these bytes always belong to this value". It claims "a write covering these
bytes leaves this root unproved until a store replaces them". A definite typed store already
removes exactly the bytes it writes
([`raw-write-kills.ts:415–435`](../../../../../packages/compiler/src/semantic/raw-write-kills.ts)).
If two values share a home they do not interfere, so at the write point the other value is dead,
and any later read of it must be preceded by its own store — which restores the bytes. That store
is the live-range qualifier, supplied by the existing dataflow rather than by a liveness join.

The residue is over-rejection, never unsafe acceptance: a store through a runtime index has no
exact range, and a restore that does not dominate the read survives the join. That is the posture
the shipped global unit already has. A test covers this case either way.

One limit of that argument has to be checked rather than assumed. The restoring store clears a kill
only when it is in the reading body's own dataflow; a restore performed by a callee is translated
back to the caller for global and borrowed-parameter roots only
([`interprocedural-kills.ts:664–697`](../../../../../packages/compiler/src/semantic/interprocedural-kills.ts)).
Two ordinary shapes put the restore inside a callee — a caller-owned destination filled by a called
function, and a by-reference fill. T-34.2 must determine whether the semantic form of those shapes
already presents a caller-visible store; if it does not, this unit narrows rather than rejects
them. The oracle carries both as accepted controls so the answer cannot be assumed.

### The hole a projection alone would leave

Call summaries are filtered before they reach a caller. `observables` keeps only global roots,
parameter roots and the opaque marker
([`interprocedural-kills.ts:472–484`](../../../../../packages/compiler/src/semantic/interprocedural-kills.ts)),
and the outgoing translation passes globals through and otherwise handles only borrowed parameters
([`interprocedural-kills.ts:565–589`](../../../../../packages/compiler/src/semantic/interprocedural-kills.ts)).
A kill on a caller's **local** root, produced inside a callee by a constant write, is therefore
discarded. Without widening these two filters, moving the write one line into a helper that runs
while the local is live keeps the program accepted — the same defect, one frame deeper.

Retain roots that are present in the supplied address map and pass them through untranslated. The
change is inert before layout, because the pre-layout map holds only explicitly placed globals,
which these filters already keep.

The reverse direction needs no change. A kill landing on a callee's own frame before entry cannot
corrupt a value that frame later reads, and propagating it would falsely poison parameter homes
that the call's own marshalling rewrites.

### One descriptor list instead of three global loops

Inside the shipped proof, three places iterate module variables: the callable filter and the
covering-write scan need the root and its type, and the declaration notes need the root and its
span (`packages/compiler/src/semantic/final-placement-proof.ts`). One descriptor carrying root,
type and declaration span serves all three. Generalize them to one list
so frame storage gets the same callable filtering, the same "declared here" note and the same
covering-write note, rather than duplicating the logic.

The cost finding from the global unit carries over: only storage whose type can hold a callable
enters the map, so it stays small and the analysis keeps the sparsity it was tuned for.

### Design challenge

Independent challenge `ses_e0b894886ffeueYFSpsr1wHL1v` recommended this shape over tying kills to
owning live ranges, and over covering only unshared homes. Tying to live ranges collapses into the
same behaviour for same-function cases, because semantic local lifetimes are already whole-function;
the narrowing that creates real sharing is a machine-level fact available in some optimization modes
only, so that option buys mode-unstable precision for new machinery. Covering only unshared homes
makes protection allocation-incidental, degrading as programs grow.

The challenge also supplied the parameter gap, the summary-filter hole and the multi-home
exclusion, each verified in the code above before being accepted here. It judged the work to stay
inside the shipped seam, so no material-complexity approval applies. Confidence: high on the seam;
the behaviour of each case after the change is unproved until T-34.2 runs.

## Specification-first evidence

Assign `test/rd04/frame-callable-placement.spec.test.ts` to an independent author working from the
approved behaviour above, the normative rules and the public build interfaces only — not from this
plan's design section and not from compiler source.

| Case | Expectation |
| --- | --- |
| Scalar local | Read the home from the build under judgment, assert the write intersects it, then require `E10277`. A home that moved fails the case as no longer covering rather than passing |
| Function-typed parameter | Same, for the separately confirmed parameter case |
| Callable inside a local struct and a local fixed array | The enclosing root's offset decides; a disjoint sibling write stays accepted |
| Callable inside a struct passed as a parameter | The borrowed home holds an address, not the object, so this case must behave as it does today rather than compute offsets into that home |
| Byte boundaries | Low byte, high byte, a word crossing into the first byte; a word ending exactly at the home stays accepted |
| Source order | Write before the assignment, write after the last call, and a complete typed reassignment all keep the proof |
| Reaching branches | A write on only one arm of a branch must still reject at a later call, because the kill survives the join |
| Loop back edge | A write after the call must reject when a back edge reaches that call again, and stay accepted when a complete store precedes the back edge |
| Target capture | A target read before an argument that overwrites **the named binding's own home** stays valid for that call; a later call does not. A write covering machine-created staging is outside this unit's claim and must not be asserted as accepted here |
| Write inside a helper | A constant write performed by a callee while the caller's local is live must reject, both one and two frames deep |
| Ordered initializers | An initializer body's constant write is treated like any other reaching write |
| Shared home, same body | A write while another value owns the bytes, with an ordinary store before the read, must stay accepted |
| Shared home, across functions | A constant write in a function whose activation cannot overlap the callable's live range must stay accepted, in all four modes. Use exactly coincident homes, since partially overlapping ones are merged in the published evidence |
| Restore performed by a callee | A caller-owned destination filled by a called function, and a by-reference fill, must stay accepted |
| Parameter before marshalling | A write to a parameter home before the call that marshals it must stay accepted |
| Address-taken storage and a runtime-address write | Assert the chosen outcome; if it rejects, a cause must still be named even though the address is not constant |
| All modes | `none`, `balanced`, `speed`, `size`; an optional construction that fails must not take a sound one down with it |
| Publication | Canonical `E10277` with the call as primary site, a note naming the storage declaration, and a note naming the covering write with the chosen `$xxxx–$xxxx` bytes — including when the write is inside a helper. A refused build leaves the previous generation and the output directory untouched |
| Controls | The disjoint case and the already-protected module-variable case keep their current behaviour and bytes |

RED must be an assertion that exposes the unsafe acceptance, not a missing import or a setup
failure. Freeze the file's hash once RED is recorded. Implementation tests then cover the
request-to-home join, the single-home admission rule, the summary widening, leaf offsets, and the
producer disagreements.

## Small execution chunks

Run one numbered chunk per invocation and report its real state.

- [x] T-34.1 Author the assigned specification tests independently, run meaningful RED, freeze the oracle hash and capture accepted-control baselines. No production code. ✅ (completed: 2026-11-19 21:21)
- [x] T-34.2 Project binding-backed frame homes into the shipped proof, generalize the three descriptor sites, widen the two call-summary filters, and make the oracle green without editing it. ✅ (completed: 2026-11-19 21:29)
- [x] T-34.3 Add implementation tests for the join, the single-home rule, the summary widening, leaf offsets and producer disagreements, plus the excluded dual-domain helper whose unsafe acceptance may not be asserted in the immutable oracle; confirm accepted programs keep their bytes, costs and storage demands. ✅ (completed: 2026-11-19 21:33)
- [x] T-34.4 Run the related suites only: the new oracle, the existing callable and raw-write suites, the compiler semantic and service tests, and the serialized emulator callable case. Record the exact coverage. ✅ (completed: 2026-11-19 21:43)
- [x] T-34.5 Obtain the independent reviews below; repair or refute every finding and record the dispositions for the user's ruling. ✅ (completed: 2026-11-20 00:28)
- [x] T-34.6 Run the complete checkpoint once, close the unit with its residual owners, sync the roadmap and commit locally. Never push automatically. ✅ (completed: 2026-11-20 01:30)

Do not commit the intentional RED stage or a partially green implementation.

## T-34.1 evidence

The oracle was authored by an independent agent that did not read compiler source. Its imports are
the public package entry and the shared profile fixture only, and it carries no reference to any
planning artifact. `test/rd04/frame-callable-placement.spec.test.ts`, 758 lines, frozen at blob
`2f3624c556d5d7ba7369b9b4f06b8fff3374b3e3`. It is immutable from here: a later failure means the
compiler is wrong.

RED, reproduced independently of the author: **19 failed, 22 passed, 41 total**, exit 1. Eighteen
failures are the same behavioural assertion — `expected 'published' to be 'refused'` — covering the
scalar local in all four modes, both single-byte boundaries and the crossing word, the
function-typed parameter, both packed aggregate leaves, the one-armed branch, direct and transitive
helper writes, an initializer-body write, a loop back edge, and a later call after the argument
corrupted the home. The nineteenth is a diagnostic-quality failure: an address-taken local written
through a runtime address is already refused today, but with no related note at all
(`expected 0 to be greater than 0`). Nothing failed on a missing import, a type error or a project
that would not build, and the 22 accepted controls pass today, including the module-variable
control that exercises the complete publication path.

Accepted-control baselines, so a later claim that accepted programs keep their bytes can be
checked rather than asserted. Identical across all four optimization modes:

| Control | Payload SHA-256 (16) | Bytes | Program bytes | Resident RAM |
| --- | --- | --- | --- | --- |
| Callable local, disjoint write | `8e03e1ffb40717e2` | 659 | 657 | 711 |
| Function-typed parameter, disjoint write | `ba29dbf334e9fa91` | 657 | 655 | 708 |
| Module variable, disjoint write | `a4364e5135963aeb` | 659 | 657 | 711 |

The module-variable payload matches the reference the completed global unit recorded, so that
control is demonstrably unchanged at this baseline.

### What the oracle could not express

- **Physically shared homes inside one body.** The allocator never coalesces two locals of the same
  function; sequential locals, block-scoped siblings, mutually exclusive branch arms and heavy frame
  pressure all received distinct slots. The case is encoded instead as one home carrying two values
  in sequence. The cross-function shared-home case is unaffected and is covered in all four modes.
- **An optional construction failing in isolation**, which has no source-level trigger. It is
  covered only by the two four-mode sweeps.
- **The untouched-output assertion for the address-taken case**, whose fixture has no earlier
  successful generation. Every other refusal case asserts it.

### A separate defect found while authoring, not owned by this unit

An indirect call with more than one possible target **inside a loop body** fails to build:

```text
multi-target, call inside loop           COMPILER_INCOMPLETE: The machine storage binding stage is not complete for this program
multi-target, call+write inside loop     COMPILER_INCOMPLETE: The machine storage binding stage is not complete for this program
single-target, call+write inside loop    built
```

Verified directly rather than taken from the report, which placed the trigger on the loop alone; a
multi-target call *outside* a loop in the same function builds normally. The loop rows of the
oracle therefore use singleton targets. This is unrelated to stale callable targets and needs its
own issue.

## T-34.2 evidence

The frozen oracle is green at **41 passed, 41 total**, with its blob still
`2f3624c556d5d7ba7369b9b4f06b8fff3374b3e3`. Nothing in it was edited.

Accepted programs keep exactly what they had, with the scope of that claim stated honestly.
Rebuilt after the change, all three controls match the T-34.1 baseline byte for byte, in all four
modes, including costs and storage totals: `8e03e1ffb40717e2`, `ba29dbf334e9fa91` and
`a4364e5135963aeb`.

The claim that evidence supports is this: **a program with no raw write covering frame-callable
bytes keeps its bytes.** A program that does have one may be refused, and in size selection it may
instead publish a different representation, because a candidate that loses the proof withdraws and
another wins the cost comparison. That was already true for module variables; frame storage widens
the set of programs it can reach. Every example project in the repository is outside that set —
none declares callable-typed storage at all, so the proof returns valid before it examines
anything.

### The two probes, now answered by evidence rather than argument

**U-1 — does a restore performed by a callee reach the caller?** Yes, and no narrowing was needed.
Both shapes build and publish: a called function returning the complete value, and a called
function filling the destination by reference. The concern that only globals and borrowed
parameters are translated back does not reach these shapes, because the caller's own assignment of
the returned value is the definite typed store that clears the kill.

**U-2 — were address-taken locals already refused before this unit?** Yes. The address-taken
runtime-address case is refused by `checkProject`, before any layout exists, so it is inherited
conservative posture and not new exposure. What was missing was the explanation, below.

### A sixth file, outside the expected edit set

The plan expected edits in the projection, the proof and the two call-summary filters. One oracle
row could not be satisfied there. A call through an aggregate field — `held.callback()` — carried
no declaration at all, so a refusal named nothing: the frontend resolves the whole callee text as a
name, and a dotted path is not a name. The leading identifier of the path is now resolved for that
note, so a lost target proof always points at the storage it was protecting.

This is a related-note improvement on the existing canonical error. It adds no diagnostic code, no
public export, no specification change and no storage domain, so it stays inside the unit's stated
stop list, but it is a deviation from the expected file set and is recorded here for the ruling at
T-34.5.

## T-34.3 evidence

`packages/compiler/src/services/final-callable-proof.impl.test.ts` grew by 287 lines and runs
**20 passed, 20 total**. The added cases exercise the internals the oracle cannot see:

| Case | What it pins |
| --- | --- |
| Request-to-home join | A callable local receives exactly the home its own representation chose, found through the request's binding and type rather than by parsing a name |
| Borrowed aggregate parameter | Home of 2 bytes against a declared size of 4, so the binding is left out — the exclusion is observed, not assumed |
| More than one home | A second home for the same binding removes it from the result, while the same certificate without it admits the binding |
| Wrong home width | A home widened to three bytes is no longer the value's own bytes and is left out |
| Only declared storage | Every admitted root belongs to a local or parameter request with a source binding, and the descriptor list matches the range map exactly |
| No home at all | Removing the home neither throws nor reports a disagreement |
| Frame rejection and withdrawal | A write covering the local's home gives the canonical error with both notes, and an optional representation withdraws as a semantics rejection instead of failing the build |
| Dual-domain helper | A helper reached from the main program and an interrupt owns more than one home at different addresses and is therefore unprotected — asserted here precisely because asserting an unsafe acceptance in the immutable oracle would freeze it |

Accepted programs keep their bytes, costs and storage demands: the three controls rebuilt after the
change are identical to the T-34.1 baseline in all four modes, recorded above.

## T-34.4 evidence

Every related suite was run on the final build, after the callee-path guard described below. The
frozen oracle's blob is still `2f3624c556d5d7ba7369b9b4f06b8fff3374b3e3`.

| Coverage | Result |
| --- | --- |
| `test/rd04` integration directory, which contains the new oracle and the existing callable and raw-write suites | 62 files, **749 passed**, 0 failures |
| `src/frontend src/semantic src/services src/storage` in the compiler package | 110 files, **2137 passed**, 2 skipped, 0 failures |
| Serialized emulator case `callable-field-helper-vice.spec.test.ts` | **4 passed** |

The unit total rose from 2127 to 2137, which is the ten new implementation cases being collected.
The whole integration directory was run rather than the four callable files, because widening the
two call-summary filters reaches every consumer of the raw-write analysis; nothing in it moved.

The callee-path note was tightened after a self-review of the first attempt. Resolving the leading
identifier of a callee path could, in principle, resolve a name that denotes a function rather than
storage, which would attach a note pointing at the wrong thing. A resolved source function always
carries an entry mode, and a profile-supplied one always carries an operation effect, so either of
those now disqualifies the name from supplying the note.

## T-34.5 review record

Five independent reviews ran against the implemented unit, then one re-review of the repair diff.
Every disposition is listed in [the findings ledger](05-findings.md); this section records only
what the reviews changed about the unit itself.

| Severity | Raised | Outcome |
| --- | --- | --- |
| Critical | 1 | Repaired and confirmed by probe |
| Major | 6 reports covering 4 distinct defects | 3 repaired, 1 withdrawn after measurement |
| Minor and observations | 15 | 9 repaired, 4 accepted, 1 deferred to its own unit, 1 dismissed as pre-existing |

Nothing was waived, and every finding acted on was first reproduced by building a program rather
than accepted from the report. Two reports were only credible because the probe agreed; the same
discipline withdrew a repair the probes had wrongly encouraged.

The three defects worth recording beyond the ledger:

1. **A constant write inside a body that also aliases memory opaquely never reached the caller's
   frame home.** The write's address was known, yet the analysis replaced that exact fact with the
   weaker unknown one. Both facts are now kept. This was the unit's own stated requirement that a
   write performed inside a callee must still invalidate the caller's storage, and the first
   implementation failed it.
2. **An aggregate parameter that happens to occupy exactly two bytes defeated the width guard.** A
   borrowed home holds an address, and an address is two bytes, so comparing widths cannot
   distinguish them. Admission now tests the storage property directly: a struct or array parameter
   is borrowed whatever its size. Three reviewers found this independently.
3. **The byte-identity claim exceeded its evidence.** It is now scoped, and the committed
   `boing-ball.prg` artifact — reproduced byte-for-byte by a current build — is the realistic
   evidence the three small controls could not supply.

## T-34.6 complete checkpoint

`yarn install --frozen-lockfile`, `yarn build` and `yarn typecheck` all succeeded, then `yarn
test:full` ran once on the final build. Total wall time was about 100 minutes, dominated by the
serialized emulator tier.

| Tier | Result |
| --- | --- |
| `@blend65/compiler` | 259 files, **4,332 passed**, 2 skipped |
| `@blend65/cli` | 10 files, **70 passed** |
| `@blend65/language-server` | 5 files, **21 passed** |
| Root integration tier | 253 files, **5,331 passed** |
| Root emulator tier | 135 files, **2,402 passed**, 4 skipped, **1 failed** |

**The gate is not green, and the single failure is disclosed rather than absorbed.** It is
`test/rd05/vic-collision-vice.spec.test.ts`, which asserts VIC sprite-collision latch behaviour in
the pinned emulator and has no relationship to callable storage. It was already known as an
intermittent failure, but this run corrected its characterisation:

| Observation | Result |
| --- | --- |
| Under full-gate load | failed, profile `…-8580` |
| Alone on an idle machine | failed, profile `…-8580` |
| Filtered to that case alone, four runs | **4/4 passed** |
| Whole file, idle, first run | failed, profile `…-6581` |
| Whole file, idle, second run | **16/16 passed** |

So it is not load-dependent as previously recorded. It reproduces on an idle machine in roughly
half of all whole-file runs, the affected machine profile moves between runs, and it passes
whenever the earlier cases in the file are skipped. That points at a sampling race inside the test
against state the preceding cases leave behind, rather than at compiled output: a changed program
would fail the same case every time.

## Residual owners

What this unit closes: a callable held in a local or a parameter whose bytes a constant-address raw
write covers — in the same body, inside a callee one or two frames deep, or inside an initializer —
no longer keeps an unsupported target, in any of the four optimization modes.

What remains open, each with the behaviour an author actually observes:

| Residual | Observed behaviour | Owner |
| --- | --- | --- |
| Interference between an interrupt handler and the main program over callable bytes | Accepted, no diagnosis | Issue #164 |
| Relocating storage instead of refusing the program | Refusal, never relocation | Issue #164 |
| A helper shared between the main program and a handler, which owns one home per execution domain | Accepted, no diagnosis | Issue #164 |
| Machine-created staging, spill or temporary bytes holding a copy of a callable word | Accepted, no diagnosis | Issue #164 |
| The two borrowed-address bytes of an aggregate parameter | Published; the frozen oracle pins this | Issue #164 |
| A raw write whose address is only known at run time does not invalidate frame storage | Builds, which is what an expert expects | Own unit, below |
| The same write **does** invalidate a module variable, and no later typed store restores it | Refused with no source workaround. This is the defect, not the standard to copy | **Own unit**: let a definite typed store clear an unresolved-write kill, which repairs the module-variable case instead of making frame storage equally strict |
| `analyzeDirectCall` encodes the whole source text three times per call site | Host build cost only | Own unit, recorded as PE-004 |
| A multi-target callable local with the call inside a loop reports `COMPILER_INCOMPLETE` | The build fails with a compiler-stage message | Needs its own issue; found while authoring the oracle and unrelated to this repair |
| `test/rd05/vic-collision-vice.spec.test.ts` intermittent failure | About half of whole-file runs | Issue #169, characterisation corrected above |

## Verification

**Task verify:** T-34.1–3 run
`yarn vitest run --config vitest.integration.config.ts test/rd04/frame-callable-placement.spec.test.ts`,
with `yarn workspace @blend65/compiler build` first whenever production code changed, plus
`yarn typecheck` and the touched files' formatting. T-34.1 expects RED.

T-34.4 runs only the related suites:

- `yarn vitest run --config vitest.integration.config.ts test/rd04` — the whole directory, not only
  the callable files. Widening the two call-summary filters touches every raw-write consumer, so
  the broad check belongs here rather than only at the final gate.
- `yarn vitest run --config vitest.vice.config.ts test/rd04/callable-field-helper-vice.spec.test.ts`
- `yarn workspace @blend65/compiler exec vitest run src/semantic src/services src/storage`

Determinism is part of the result: map construction order is fixed by the existing sorted requests
and homes, so repeated builds of an accepted program must stay byte-identical.

**Verify:** `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, then `yarn test:full`
once at T-34.6. Budget 75–90 minutes for it; it is not an inner loop. Run logs and scratch stay
under `CODEOPS_TMPDIR` and are removed before reporting.

## Specialist Agents

| Role | Bounded responsibility at review |
| --- | --- |
| correctness-reviewer | Scope, maintainability, oracle authority, evidence honesty |
| semantics-reviewer | Finite-target contract, ordering, restoration, diagnostic quality, over-rejection |
| sfa-abi-auditor | Home ownership, the single-home rule, the summary widening, no new demand or call edge after closure |
| machine-code-auditor | Accepted output keeps its bytes and costs |
| performance-auditor | Added host analysis cost and the skip conditions |

Specialist check: **None new** — these existing roles already own this boundary, and the unit
reuses machinery they reviewed for the module-variable case.

## Scope of later implementation

Expected production edits: the shipped projection and proof modules, and the two call-summary
filters named above. Owned tests: the new specification file and new or affected `*.impl.test.ts`.
Existing specification tests and shared test infrastructure are read-only.

No CLI flag, public export, specification change, allocation-policy change or new diagnostic code
is authorized. Stop and ask if the smallest repair appears to need one of those, another storage
domain, or a material support surface.
