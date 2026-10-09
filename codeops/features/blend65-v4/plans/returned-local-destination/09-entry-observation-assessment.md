# T-16 assessment: incoming display and private storage

> **Date**: 2026-10-10
> **Status**: Verified partial — bounded assessment complete; plan ruling pending
> **Owner**: RD-05 T-16 / [AR-6](00-ambiguity-register.md#ar-6-runtime--incoming-bitmap-display-invalidates-hardware-disjointness)
> **CodeOps Artifact Schema**: 1

## Authority and result

The user's “i approve” authorizes the separately offered startup/layout assessment
only. It does not authorize implementation, existing-test changes, frozen-authority
changes or a protected cost-baseline rebase. T-14 remains blocked at 17/19.

**Best option:** obtain a narrow plan clarification before adding startup or
placement support. Preserve observations required by source and selected platform
contracts. Do not promise identical incidental pixels from compiler-selected,
unpublished private storage. Retain every existing observer guard. This is a
proposed interpretation of the frozen compiler latitude, not an undefined-behavior
exception, an implemented guard change or a qualification waiver.

The earlier blocker combined two different claims. Possible physical overlap is
established. A semantic failure caused by that overlap is not established. The
plan's broader physical-observer wording nevertheless needs an explicit ruling;
this assessment does not silently narrow it.

## Required observation

| Evidence                                                                                                                                                          | Boundary                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [FN-4](../../../../../spec/06-functions.md) permits caller construction and copy elision.                                                                         | Values, aliasing and observable effect order must remain correct.                                          |
| [Memory model](../../../../../spec/11-memory-model.md) permits differing layouts and nonoverlapping SFA home reuse.                                               | It does not prescribe the bytes or addresses of every private implementation home.                         |
| [Memory intrinsics](../../../../../spec/12-intrinsics.md) permit address/storage optimization while retaining volatile rules.                                     | Raw addresses, widths, values and access count/order remain binding; unknown observations retain fallback. |
| [A3](../../../../../spec/00-introduction.md) forbids undefined behavior.                                                                                          | Compiler latitude is not authority to discard a source effect or invent an unspecified-result exception.   |
| [C64 startup](../../../../../spec/appendix-c64.md#51-resident-prg-profiles) loads compiler-selected code/data at $0801 and restores captured owned machine state. | It does not establish a bit-identical pre-entry bitmap image or private-layout pixel trace.                |

The semantic conclusion is an **Inference** from these explicit permissions, not
a newly added specification rule. Source-identified objects, published hardware
data, escaped addresses, raw memory access and selected timing/interrupt obligations
remain distinct from incidental display of unnamed private bytes. Treating every
such pixel as invariant would also constrain code layout, private spills, zero-page
scratch and stack traffic. Moving the returned object alone would not meet that
broader promise.

## Hardware facts and candidate costs

[Startup](../../../../../packages/compiler/src/layout/startup.ts) selects VIC bank
zero, writes D018=$14 and disables sprites. It leaves D011 unchanged. Bitmap mode
and display enable may therefore be set at entry; no bitmap-off entry rule is
approved. The ordinary caller result at $0AE8–$0AF2 can be fetched as bitmap RAM.
CPU interrupt masking does not stop those fetches. No alternate-entry pixel or
elapsed-timing execution was performed in this assessment.

| Candidate                               | Assessment and complete relevant cost boundary                                                                                                                                                                                                                                                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Save D011, clear bitmap mode, restore   | Incorrect for arbitrary incoming raster-compare state: bit 7 reads the current raster position but writes the hidden compare bit. The minimal straightforward sequence adds 17 code bytes, 22 nominal cycles and one saved-state byte before any interrupt repair. It consumes the ordinary 17-byte payload gain without proving restoration.              |
| Change D018 or VIC bank                 | D018 $14→$1C also changes the text character source. Another bank needs preserved CIA2 latch/pin ownership proof. A constant substitution's zero instruction delta is not equivalence proof.                                                                                                                                                               |
| Intersect existing automatic RAM ranges | Existing [shared-storage](../../../../../packages/compiler/src/services/shared-storage.ts) already derives free ranges, closes SFA, rebinds and checks final layout. No new allocator is necessary. Placement can protect ordinary RAM homes, but does not protect zero page, stack or code from incidental bitmap reads. No relocated artifact was built. |

For the retained ordinary artifact, moving its twelve automatic RAM bytes from
$0AE8–$0AF3 to $1000–$100B gives the following **conditional arithmetic**, not new
compiler measurements:

| Quantity                                                         |         Current | Conditional placement |
| ---------------------------------------------------------------- | --------------: | --------------------: |
| Payload / PRG container                                          | 694 / 696 bytes |             Unchanged |
| Occupied general RAM / reported resident including ZP            | 755 / 757 bytes |             Unchanged |
| Shared address span from $0801                                   |       755 bytes |           2,059 bytes |
| New unoccupied hole below the moved homes                        |         0 bytes |           1,304 bytes |
| Added serialized padding, storage demand, ZP, stack, saved state |               — |               0 bytes |
| Eligible trailing RAM under $1000–$1FFF ∪ $4000–$CFFF policy     |    50,456 bytes |          40,960 bytes |

The policy withholds 9,496 bytes of allocation capacity; these are not occupied
bytes or serialized padding. The eleven-byte ordinary construction crosses no
page in either position, so its nominal instruction costs need not change.
Actual encoding, collision handling, other witnesses and elapsed timing remain
Unknown. Existing [evidence accounting](../../../../../packages/compiler/src/services/evidence.ts)
sums occupied intervals; that total must not conceal capacity or address-span costs.
No baseline rebase, hidden padding or new source restriction is approved.

## Proposed ruling and remaining work

The proposed clarification of [eligibility item 6](03-01-destination.md#whole-function-eligibility)
is: “Relevant observers are those required by source and selected platform
contracts. This proof does not guarantee an unchanged incidental bitmap trace of
unpublished compiler-private storage across permitted allocation and copy-elision
choices.” This does not claim that physical overlap is absent.

Keep all current raw-address, escape, call, asynchronous-effect and persistent
source-publication guards, including executable initializers. Do not edit startup,
layout, a specification oracle, frozen specification/expert authority or a cost
baseline. After a named ruling, independently review its exact interpretation,
resume fresh behavior/output and full project qualification, and dispose TP-001
against that contract. A genuine missed source/platform observer remains a defect.

The viable alternative is to retain the literal physical-fetch requirement and
decline the optional certificate until a separately authorized placement proof
exists. It leaves T-14 unfinished; it is not a source-language restriction.

Confidence: **Med** — an explicit inherited private-display promise or a missed
source/platform observer would change the direction. Strongest counterargument:
the existing plan's broad observer promise cannot be narrowed silently.
Hardening: the assessment changed the next direction from startup/layout repair
to a precise observer-contract ruling. Challenger: **converged**, conditional on
named approval and unchanged observer guards.

## Evidence limits and lineage

Independent semantics and platform reviewers assessed distinct boundaries. The
platform reviewer inspected retained source, assembly, sidecars and ordinary PRG
startup bytes. The challenger used supplied excerpts, not independent local file
inspection. Its preliminary recommendation preceded accidental exposure to the
semantics verdict; that verdict was excluded from decisive evidence. The semantics
reviewer likewise excluded accidentally exposed historical routing smoke summaries.
Neither exposure counts as an additional independent proof.

This assessment changes documents only. It runs no compiler behavior/output
qualification, builds or VICE cases and adds no new runtime/cost endpoint.
Documentation validation passes forced formatting, local links/anchors,
immutable-path/oracle-hash and whitespace checks. The plan-required
`yarn vitest run test/foundation.spec.test.ts` passes **12/12**, no skips,
5.17 seconds. Raw log: `t16-document-foundation.log` under the retained
[execution evidence root](08-closeout.md#retained-evidence-and-lineage).
That foundation result validates this documentation checkpoint, not T-14.
Independent correctness review reports **no findings** for document consistency,
permission/oracle integrity and evidence scope; it clears no compiler review gate.
T-14's last complete root verification remains
interrupted, not a PASS. Acquisition/NMI runtime qualification and physical hardware
remain Unknown. No RD closeout or deferral retirement follows from this assessment.

Context: Linux, NMOS 6510, cooperative PAL/NTSC × SID 6581/8580 PRG profiles,
optimization `none`, safety off, ACME 0.97, VICE 3.10. Lineage: expert **2.0.4**,
immutable content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`, frozen
`BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`.
Selected normative headings: `blend65-semantics.md#semantic-preservation-checklist`,
`il-and-optimization.md#memory-effects-and-volatility`,
`evidence-parity-and-recovery.md#transformation-proof`,
`c64-memory-and-runtime.md#vic-view-and-placement` / `#startup-contracts`,
`c64-hardware.md#control-bases-raster-and-interrupts`; governing keys
CSG-6567-318014, CBM-C64-PRG-1982, VIC-BAUER-2024 and MOS-PGM-1976.
Primary hardware support: [manufacturer 6567 scan](https://myoldcomputer.nl/Files/mos_6567_vic_ii_preliminary.pdf)
and [Commodore PRG, page 105](https://www.devili.iki.fi/Computers/Commodore/C64/Programmers_Reference/Chapter_3/page_105.html).
These establish hardware bounds, not a new private-layout preservation rule.
