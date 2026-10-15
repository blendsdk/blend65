# Final closure, startup and size mode

> **Parent**: [Index](00-index.md)
> **Authority**: AR-P2–AR-P4; RD-08 R8.3–R8.6/R8.9/R8.10/R8.12/R8.39/R8.51/R8.52/R8.58

## Interfaces and ownership

Keep orchestration in the existing service path; extract focused
`services/size-selection.ts` and `services/size-observers.ts` rather than adding
an optimizer layer. The selected storage descriptor belongs to
`storage/selection.ts`, consumed by inventory, machine lowering and closure.
Use the existing layout and binder; no new allocator or anonymous workspace.

Planned internal contracts:

```ts
/** Enumerate only qualified finite rule alternatives and their dependent compositions. */
sizeSelectionPlans(input: SizeSelectionInput): Iterable<SizeSelectionPlan>;
/** Validate actual final baseline/candidate homes and all outstanding observer obligations. */
validateSizeObservers(input: FinalObserverInput): ObserverValidation;
/** Compare closed vectors; unknown decisive terms are not a tie or a win. */
compareSizeCosts(left: ClosedCandidateCost, right: ClosedCandidateCost): SizeComparison;
```

`SizeSelectionPlan` has a stable source-derived ID, immutable per-site choices,
the fixed construction recipe below, selected storage/loop/byte recipes, startup
variant and pending proof obligations. Choices are derived, not independently
enumerated for every source site.
`CanonicalReferenceOutcome` is either a feasible reference with its complete
layout/certificates/vector, or a resource-rejected reference with exact reasons
and explicitly available partial facts. It has no fabricated empty layout/vector.
`FinalObserverInput` has that reference outcome, a complete candidate layout/
certificate, source footprints, domains/banking, operations and obligations.
`ObserverValidation` is proved or rejected with source-associated reasons.
`ClosedCandidateCost` uses the RD-03 `CostVectorRecord` shape plus the internal
source-path/proof mapping; `SizeComparison` is less/equal/greater/undetermined.
No extra schema fields or new public optimizer API are implied.

## Finite alternatives and termination

PF-003's approved early frontier consists of **whole-program construction
recipes**, not all possible mixtures of independently qualified substitutions.
Use the existing owners and the following fixed choices; no recipe registry,
policy language, regional summary engine or additional support module is needed.

| Axis | Admitted choices | Construction |
| --- | --- | --- |
| Non-loop bundle | Direct; Closed | Direct retains canonical object/byte/lifetime choices. Closed applies all currently proved non-loop packets in 03-02 at eligible ordinary sites; missing applicability keeps that site's ordinary representation. Caller/callee recipes must agree. |
| Loop policy | Original; LowByte; XFirst; YFirst; FlatEightXFirst; FlatEightYFirst | Original keeps word homes. LowByte uses only proved narrow homes/reconstruction. XFirst/YFirst assign opposite registers to the next lexical nesting level. Flat policies expand only the admitted exact-eight body, then use their named register policy for remaining eligible loops. |
| Startup | Full; CompactUnrolled; CompactLooped | Existing full startup or the two fully proved held-P alternatives with actual borrowed-byte capture/restore. |

There are `2 × 6 × 3 = 36` construction recipes and one canonical reference
attempt: **at most 37 outer closure attempts**, regardless of the number of
eligible sites. This is a frontier definition established before construction,
not a search cutoff. Exhaust every admitted tuple, or record its exact proof/
resource rejection; do not stop at the first ceiling or local byte win. An
identical direct/original/full recipe may reuse the reference closure. Equivalent
recipes may share a stable key only when their complete selected representation
and obligations are identical, not from a guessed local cost.

An axis with no applicable source pattern has only its ordinary choice: no
recognized loops means Original only; a proved display-dependent program has
Full only. Normalize such inactive axes before forming tuples. Thus a fixture
with two genuinely different bundles, no loops and Full-only startup has exactly
two construction recipes and at most three outer attempts, not 36 empty variants.

Each site retains its original source/context identity, or that identity plus
iteration 0..7 for expansion. Reset nesting depth per function. Register choices
require a joint proof for the entire affected loop nest: initializer, zero-trip,
body/descendant/callee clobbers, backedges, joins, visible exits and reconstruction.
Lexical alternation is not itself a proof. If a generic descendant or other use
clobbers an assigned register and the existing recipe cannot preserve it, that
nest keeps the original representation. Do not search register preferences or
invent a spill after closure. Unrelated proven nests still follow the same policy.

Flat-eight admission requires an exact straight-line body without early exits
or nested loops; every raw memory operation has a proved loop-invariant address.
Ordinal-dependent addresses are confined to typed fixed-array places. This
includes the acquisition's fixed-address scan, but excludes the saved caller's
dynamic raw `peek(base + ordinal)` load loop. The latter remains looped under
every recipe. No file, input name or magic address selects admission. All original
values, checks, effects and debug source/iteration mappings remain binding.

Construct each tuple once from the unchanged semantic program. Eligibility and
ordinary fallback are deterministic parts of construction, not new choices in
the frontier. A final observer failure rejects that complete tuple; do not retry
arbitrary site subsets. Close helper reachability, actual access occupancy,
SFA/ZP, spills, startup, padding and branch repair for every admitted tuple before
complete B/R/T comparison. A rejected canonical reference does not remove tuples.
Never erase a generic ABI entry reachable through a callable route.

Source facts use monotone finite binding/position/root sets. SFA closes only the
predeclared finite request universe; existing branch repair widens monotonically.
An expansion cannot be expanded again. Count these internal iterations separately
from the 37 outer attempts; finite analysis termination and observational host
time/RSS still need their existing checks. No wall-clock gate certifies correctness.
Keep one current candidate plus bounded comparison summaries, not 36 cloned trees.

The all-Closed/FlatEight register recipes include the analytical acquisition route,
and Closed/non-flat register recipes include saved decoding. Both compact startup
variants remain available for the real padding/cycle tie. Charge any retained
matchingColumns home or additional instruction; the analytical 955/675 totals are
not assumed. ST-25–ST-27 retain the exact outcome limits. If this declared frontier
cannot meet them, the prerequisite remains RED: identify the smallest missing
candidate or reopen the named complexity gate, never weaken an oracle.

Arbitrary per-site mixtures and general independent-region composition are not
qualified by this early slice. Full RD-08 owns them, with a revisit trigger when
an independently measured winning candidate or a required production workload
needs one. Existing per-site recipe identities remain in SizeSelectionPlan, so
wider future admission does not require replacing proof/lowering/closure seams.

## Final observers and closure order

1. Run the existing common source/type/effect/route checks and retain the checked
   semantic program. Source errors, incomplete mandatory lowering and invalid
   internal state remain terminal in every mode; optimization cannot rescue them.
   `none` keeps its existing direct path and public behavior.
2. Attempt the canonical resource/layout reference. A specifically identified
   allocation, finite capacity or layout resource rejection becomes a typed
   resource-rejected reference, not the selected build's terminal failure.
   Retain exact reasons/deficits and genuinely available facts. Do not reinterpret
   every compiler failure or an unsupported source capability as resource pressure.
3. Derive 03-01 facts from the checked program, independently of successful
   canonical allocation. Build each admitted candidate with every actual
   storage recipe and finite possible scratch/spill request already declared.
4. Re-close interference, SFA, helper/link reachability, startup state, layout and
   branch repair through the existing binder/shared-storage owners.
5. With a feasible reference, validate against **both** final reference and
   candidate intervals. With a rejected reference, retain every actually known
   interval/obligation and prove affected unavailable homes unobservable from
   the closed source/effect/borrow contract, or disjoint over their complete
   permitted placement envelope. An unavailable interval is unknown, not empty.
   If neither proof closes, reject that tuple. Removing a home or resource failure
   cannot make an observer disappear. Include source addresses/borrows,
   raw widths and wrap, indirect/dummy accesses, retained device/firmware effects,
   code/global/asset/stack/ZP overlap and every relevant interrupt context.
6. Compare only fully validated feasible candidates. If none survives, report
   their exact failures and publish no generation; a feasible reference remains
   an eligible direct result. Freeze selected resources before serialization.

Unknown raw footprint or opaque mutation blocks the affected rewrite. Never
substitute provisional addresses for step 5, or select a new scratch home after
it. `none` still uses the existing conservative observer/selection path. Invalid
internal certificates, unresolved decisive costs or nonconvergence fail through
the existing source-associated compiler failure route and publish no artifact.
Ordinary unsupported optimization patterns remain valid generic source programs.

## Safe compact startup

Only the proved display-independent program may use the AR-P4 held-P variant.
Retain the existing fall-through entry/normal restore ownership; any additional
main jump or terminal branch is charged after layout, not assumed free.
Preserve incoming P/SP, CPU port/DDR readbacks, CIA2 DDRA, source D/I rules and
every actually borrowed BASIC byte. Keep `PHP; SEI; CLD`, exact captures/mapping,
the copied original-P main-entry sequence, and `SEI` before restoration. The held
P byte is platform state, not a stack local/parameter/frame. Feed its one-byte
demand into existing stack analysis **before** SFA/route closure.

Derive borrowed bytes from actual final allocation, never the witness's literal
addresses. A contiguous proved normal-RAM range may use two fixed inline indexed
capture/restore loops. Noncontiguous/unsafe footprints retain unrolled saves or
full startup. Account for changed capture order, zero-page wrap, indexed dummy
reads, capture-buffer page crossing, X/Y clobbers and NMI; SEI is not an NMI mask.
No byte is omitted using presumed BASIC liveness. All source stack controls remain
relative-balanced and cannot consume held platform state.

Callback-only identity, selected chain variants, full P/D restoration, page-safe
immutable saved links, vector publication/removal and PA-before-marker order
remain the existing platform contract. No CIA2 ICR/PRA read or ownership transfer
is introduced. Generated bounded-component stack, reserve/capacity and unbounded
external firmware/NMI aggregate remain separate. VICE does not certify silicon.

## Public mode and complete comparison

Extend compiler `BuildOptions`/CLI selections and validation only to explicit
`none | size`; `check` still accepts no build options. Keep manifest parsing and
defaults unchanged. No claim that the partial slice implements `balanced`/`speed`
follows from those already-accepted manifest values. Only explicit effective
`size` enters this candidate path; it cannot silently fall back on an internal
failure. `none` never enumerates or compares candidates.

After hard feasibility, apply RD-08 R8.9's B, ordered R, then comparable T rule.
R counts unique physical ownership: analytical general RAM plus ZP is the combined
resident term, not general RAM alone or duplicated frame aliases. Preserve the
common bounded generated stack scope and separate all external Unknowns.
Use source/semantic path classes, exact/bounded/formula costs and final page PCs,
not optimized block names or guessed frequency. An unknown term need not decide
a unique higher-priority comparison, but a decisive unknown cannot become zero,
an equal term or a stable-ID tie. Compare unchanged opaque terms only with proof
of an identical common contract. Exact ties alone use stable ID.

The masked unrolled/looped startup variants demonstrate why byte savings must be
closed with padding: use the AR-P4 ledger, not a summed local estimate. Charge
every spill/retest/long branch or retain an alternative; no witness budget is
subtracted into a guessed subsystem budget.

## Evidence, publication and files

Populate existing version-1 `.costs.json.decisions` and `.debug.json.optimizations`
plus final availability/ranges. Use exact RD-03 candidate/rejection/vector/tie
records. `.build.json` records effective mode and hashes the selected cost/debug
sidecars through its existing artifact array; it gains no optimizer root/package
field. That closed generation identifies the decision without schema evolution.
Do not use generic `EvidenceRecord` typing to invent undeclared keys.

Under the explicitly approved PF-002 paragraph correction, baselineCandidateId
resolves to its existing feasible or rejected record; selectedCandidateId still
resolves to a feasible record. Rejected references have exact hard reasons, no
invented before-vector or zero-valued delta. The existing costs validator uses
the feasible baseline's component names, or the selected vector's names when
the baseline is rejected. Common source-path/profile validation, exact ties,
unique/resolved IDs, selected totals and every other v1 guard remain unchanged.

Existing none and feasible-baseline v1 records remain valid and unchanged. The
updated reader accepts both old records and the newly allowed rejected-baseline
record. An older reader may reject that new record; it must not be described as
mixed-version forward-compatible. Compiler identity and generation validation
remain explicit. No persisted migration, format-version change, upgrade service
or artifact-rewrite step is added; locking and last-good rollback stay unchanged.

Reproducibility compares the frozen portable build fields and exact assembly,
PRG, maps, costs and debug bytes. UUID publication ownership and host provenance
remain outside portable comparison as RD-03 specifies. Recompute final ACME
bytes and cross-artifact hashes; a mismatch fails rather than publishing an
earlier attempted candidate. Existing locking, cancellation, last-good publication
and cleanup rules remain; run ACME only for the final selected generation.

Affected owners: services/types/services/evidence/evidence-records/debug-storage-
locations, machine input/state/lower and the 03-02 consumers, storage inventory/
interference/types/selection, shared-storage and size observers, the existing
artifacts/costs-evidence-validator, layout startup/c64-layout, CLI args/render;
focused new modules named above. Existing test
amendments are only AR-P4. New tests and implementation splits remain bounded
per task; no new dependency, host tool or persistent cache.
