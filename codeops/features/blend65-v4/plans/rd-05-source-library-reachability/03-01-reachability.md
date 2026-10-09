# Closure contract

> **Parent**: [Index](00-index.md)

## Executable roots (AR-2/4)

Keep current main, explicit initializer, ordinary function-address and selected interrupt/callback
closure. Source `export` controls visibility, not a current executable ABI entry. Remove the
export-only callable-root contribution and the matching independent assignment-entry seed in
finite-target analysis. Preserve address-taken ordinary functions even when an otherwise cold
source owner contains their address. Do not narrow callback or raw-handler address rules.
Frontend typechecking/diagnostics and module selection are unchanged. No new public mode/option.

## Private data (AR-3/4)

Add documented optional `exported?: boolean` provenance to SemanticGlobal. Populate it from
the real binding in every producer branch. Missing metadata means unknown, never private.

A removal candidate must have all of: mutable module storage, `exported === false`, null
initializer entry/initialBytes/runtimeInitialBytes, no placement constraint, and no explicit
zeropage request. Constants, public globals, unknown metadata and every explicit initializer
remain. An initializer's target and ordered execution are never eliminated by this correction.

Retain candidates used by reached function blocks and explicit initializer blocks. Include
load/store/place-address roots, fixed aggregate construction destinations, direct/indirect call
aggregate destinations and other actual source-place references. Preserve a candidate whose
address appears anywhere in source semantic bodies; address escape is not proved absent merely
because that owner is cold. Compare full BindingId identity, not name, module prefix or file path.

## Raw observability (AR-3/5)

Reached volatile memory reads and writes can observe unnamed storage. Unknown addresses or
missing allocation-window facts retain candidates. Exact constant/conversion addresses may be
proved disjoint from selected RAM/ZP windows; byte/word footprints wrap modulo 65536. A word at
`$FFFF` includes `$0000`. Calls/loads/arithmetic/merge values not proved by this bounded constant
rule stay unknown. Do not add interprocedural alias solving or a new fixed-point engine.

The same fallback covers reached memory-consuming indexed places, including load/store,
aggregate construction and call destinations rooted in globals, locals or borrowed parameters.
Unchecked indexing can leave its named object: a retained byte[1] with an unknown word index
can access every 16-bit address. Retain candidates unless the entire accessed footprint is proved
within the object or disjoint from candidate windows. Include nested field/index offsets,
element stride, access width and 16-bit wrap. Missing root type/extent/index facts stay unknown;
a declared extent alone is not an index proof. Late optional machine bounds guards do not count
as an earlier proof. Direct constant/conversion indices may prove each selection in bounds;
no range/alias solver or new analysis interface is added (preflight PF-001, AR-3).

Use maps/sets over existing operations. A small memoized constant/conversion evaluator over
body-local definitions, with cycle/unknown protection, is sufficient. No semantic value is moved,
removed or reordered. Known selected platform operations consume only their scalar/handler
arguments and declared device/vector effects; callback bodies are already reached. Any opaque
or newly arbitrary-memory platform effect must remain conservative, not gain a default exemption.

CPU write-address disjointness alone does not prove a VIC observer disjoint (AR-12). Numeric
sprite-pointer/enable operations and raw pointer-table, VIC control/selector/enable or CIA2
bank-selection writes may expose RAM to hardware fetches. Retain candidates when that complete
fetch footprint is unproved, including actual register mirrors and wrapped word-write bytes.
Ordinary disjoint color operations and the isolated sprite-position access keep their existing
proof. No DMA/range solver is introduced.

## Producer-to-consumer placement (AR-3/5)

Select the retained SemanticProgram globals in whole-program closure before source-ZP reservation,
SFA and final layout. Keep functions/identities available to analyses; selection is represented by
the existing reachable-function list. Every storage, machine, debug and resource consumer must
see the same retained globals. Reuse existing helpers; extract one focused internal module if
whole-program.ts would exceed its current size limit. No emitter-only pruning or late storage.

## Failure and cost (AR-4/6)

Unknown observability retains storage, without a new error or source restriction. A real existing
independent export ABI or protected old-oracle conflict reopens its precise owner before edits.
No new startup, MMIO, links, function homes, stack or runtime helper. Complete cold artifacts and
resource totals must match an independently specified minimal control, not only text or a
function count. Selected calls, initializers and callbacks still need their observable behavior.
Unrelated selected-function code quality is not waived; existing tracked output debt is not
permission to introduce a new regression. New host work is bounded by scanned operations/uses,
not globals times operations. Existing sequential VICE helpers suffice for runtime cases.

## Exact output/evidence correction (approved AR-8)

For a known raw byte address, select the direct zero-page instruction when that byte lies in
`$0000–$00FF`, otherwise absolute. Select each word byte independently after 16-bit wrap;
preserve the exact volatile address, low-first order and one access per byte. No pointer or
function storage is added. Published physical memory intervals are classified as zero page
only when the complete inclusive interval lies in that range, regardless of source/SFA owner.
Source globals remain source globals; this reporting correction does not assign them to SFA.
