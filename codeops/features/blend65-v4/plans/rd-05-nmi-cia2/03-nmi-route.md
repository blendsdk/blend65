# Generated stock-chained NMI route

> **Parent**: [Index](00-index.md)
> **Authority**: AR-P2/AR-P7/AR-P10–AR-P12; RD-05 R5.15–R5.18; Ch 06 §7.5

## Admission and ownership

For the four existing cooperative profiles, replace the immediate blanket
`setNMI` rejection with a candidate route whose semantic/context and complete
selected-storage proof must close before public check success. Build additionally
proves final placement/encoding before emission or publication; check does not
claim final placement. The stock-entry condition is a
qualified machine precondition, not a runtime check. No-hook programs gain no
new entry condition. Empty exclusive fixtures and CIA2 state-changing/consuming
operations retain their current guards; no positive handoff is claimed here.

Keep callback-only identity and provenance, LIFO joins/back edges, ordinary
recursion diagnostics, shared-state warnings and selected banking contracts.
Evaluate reachable conditional targets and initializer/helper effects, not just
main's direct calls. Existing unknown call/handler guards remain active.

### Publication and link proof

Every exposed NMINV entry has low byte `$47`. The entire immutable entry and exact
two-byte predecessor link exist before its high byte is published. Capture both
predecessor bytes coherently, then write only `$0319`; restore only `$0319` from
the captured high. At every instruction boundary an arrival sees the complete
old or new target. `SEI` excludes IRQ during the transaction but never proves
NMI atomicity. Returning stock NMI preserves NMINV; stock RESTOR's high-then-low
copy preserves `$47`. RESTORE+STOP may abandon the program, not return to it.

For every physical link write, enumerate all installed entries, saved references,
suspended restores and pending chain continuations that may still observe it.
Do not kill an observer at logical pop. A word can be reused only after the last
observer ends, or when every overlapping capture is exactly equal and selects
an equivalent body/continuation binding. Retain separate logical LIFO owners.
Site/root/depth names alone are not a proof.

This invariant covers both IRQ and NMI saved words written from an NMI-origin
context, including through ordinary helpers. Re-entry that captures IRQ A in a
live word and then overwrites it with IRQ B is a concrete E10245 witness, even
with otherwise storage-free bodies. It is not a ban on NMI-side installation.

Mainline-only mutation closes because interrupt entry suspends that CPU's
mainline. Its next pop/reuse cannot execute while its route is suspended.
IRQ-owned mutation uses its already-proved finite activation/overlap facts and
distinct links where needed. NMI-owned mutation requires the exact current-vector
and chain closure. The B/C witness grows continuation identities rather than
merely repeating one immutable route: reject the generated resource growth, not
all graph cycles, source nesting or external repeated entries.

Extend the existing finite context worklist: carry selected vector/predecessor
identities with the installer context; propagate source CFG/call/install/pop and
chain transitions; close repeated equal states. An active recurrence that changes
or extends its predecessor continuation has unbounded generated demand and fails.
Keep live observer sets until exit/last continuation. Equal captures may share
only with explicit equality/observer proof. Conditional joins union target
possibilities without merging different predecessor relations. No execution-count
limit, depth budget, source-form ban, new runtime selector or generalized analysis
framework. Use a concrete route/source witness when closure cannot be proved.

Every reachable writer must preserve the chosen invariant. Reuse typed place,
literal/value and selected memory-effect facts to prove disjoint writes. A known
raw vector write invalidates high-level ownership as before. An opaque write
which may touch NMINV while the proof is live is unproved, not silently disjoint.
Ordinary variable-address `poke` remains available when its actual provenance
proves disjointness; do not add a syntax ban or general range-analysis subsystem.
Raw writes after the final observer/high-level operation remain deliberate raw
management, not an extension of this qualified scheme.

## Existing compiler seams and internal facts

Keep `interruptExecutionContexts` as the context owner. Extend its result-bearing
facts with finite NMI predecessor bindings and diagnostics, and store that one
proved result on `WholeProgram` for inventory/lowering consumption. Do not repeat
the expensive closure independently in each stage. An NMI binding contains the
installer context, selected entry identity, physical link request ID and exact
predecessor choices/observer justification. It is compiler-only, never a source
token or public API. Preserve ordinary IRQ-only context/slot behavior; NMI-origin
IRQ writes must satisfy the same live-observer proof before using that path.

Inventory allocates one two-byte, page-safe persistent word per proved physical
binding. The machine installer, wrapper tail and restore all consume that same
binding. Extend the current optional context slot support rather than create a
second link registry. Final selected storage proof checks every reachable NMI
body/helper's parameter, result, local, staging, temporary, pointer, spill and
helper-scratch requests. A live invocation-private RAM/ZP request rejects with
canonical E10245 at the owning installation; only a separately proved installation
link is exempt. `persistent` or an ID prefix alone cannot exempt a private home.
Registers/ordinary hardware call frames can qualify; selected helper storage
cannot hide behind source-level absence of locals. No emission stage adds homes.

Use the existing closure/binder instruction-site/helper records. Preserve exact
bounded main/IRQ overlap even when NMI is present, and measure each finite
generated NMI route separately. Do not use the current independent-maxima mixed
fallback as a simultaneous proof. A closed chain uses one CPU frame; each wrapper
removes its own saves before jumping to the next entry. Source calls/explicit
pushes and compiler-controlled growing-stack cycles remain charged and checked.
The external total remains unproved under the existing qualified exception.

## ABI and placement

The current selected NMINV chain wrapper saves entry P and A/X/Y, establishes
binary mode before the body, restores those registers/P before the saved-vector
jump, and retains the CPU frame for the eventual stock RTI. Preserve architectural
N/V/D/I/Z/C; PHP's B/reserved bits are not extra hardware flags. Source status
operations stay balanced. The generated wrapper performs no CIA2 ICR read or
acknowledge. Stock source-dependent acknowledgement/terminal behavior remains
with firmware. No hidden event filter, new acknowledgement or warm-start return.

For the new qualified NMI entries, derive actual clobbers from the complete
selected body and transitive known machine callees. Emit only necessary register
saves; saving X/Y through A also requires preserving A. Keep P whenever body or
normalization changes flags. A genuinely empty body needs only the saved-vector
jump: no body observes D and no generated operation changes A/X/Y/P. Nonempty
bodies retain binary entry unless the complete contract independently permits
elision. If a clobber fact is unknown, preserve conservatively, but do not call
output qualified until equivalent expert parity is measured. This is direct
entry construction using existing instruction effects, not a general optimizer.
Existing IRQ wrappers and their immutable oracles remain unchanged. Pass actual
selected entry stack bytes through the existing binder's resource facts before
closure; profile baseline saves are not measured selected usage.

Propagate the semantic function's placement onto the complete selected wrapper
before entry adaptation; current `lowerFunction` does not carry it automatically.
Mark only the qualified NMINV wrappers as requiring a publication-compatible
entry. Add a target-internal optional `nmiPublicationEntry` flag on existing
`MachineFunction`; do not extend source `PlacementConstraints` or the grammar.
Final layout first tries the complete wrapper at low `$47`, honoring all source
and machine constraints and final branch repair. If that cannot fit but the
wrapper otherwise can, reuse the existing ordinary JMP adaptation pattern:
place the complete source-constrained wrapper normally, and a three-byte immutable
low-$47 `JMP wrapper` entry. Keep the published label stable; a separate internal
body label identifies the complete wrapper. Resolve labels through existing layout
and serialization, including debug/source ranges. No writable-code bridge.

Charge every pad and actual fill; pack ordinary objects into available gaps using
existing first-fit placement. Recheck final complete size, `at`/`align`/`noCross`,
bank visibility, indirect-link page safety and all overlap reservations. A pad
has no homes, extra stack or state effects. It cannot solve multiple non-equivalent
complete variants claiming one explicit `at`; retain the exact placement proof
and report a real collision without claiming broad multi-entry support or banning
source placement. No second emitted object is secretly exempted from constraints.

## Errors and exact costs

| Failure                                                          | Existing response                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| Private-home overlap, unclosed generated continuation/reentrancy | E10245; no generation; preserve canonical path record              |
| Invalid LIFO/raw/unproved live vector writer                     | E10278; no generation                                              |
| Wrong/erased callback provenance                                 | Existing E10244/E10247/E10252                                      |
| CIA2 ownership not proved                                        | Existing ownership guard; empty exclusive E10245 remains unchanged |
| Real bounded stack/storage overflow                              | E10238; no generation                                              |
| Actual final source-placement collision                          | Existing E10273 placement path; no partial artifact                |

No new diagnostic codes or canonical-message changes (AR-P11).
Keep full source/error attribution in both public services.

With absolute link homes, the full A/X/Y/P chained wrapper costs 16 bytes and
43 nominal cycles including its final indirect jump, excluding the body, CPU
entry and stock stub. Four explicit saves plus the CPU frame give 7 per-entry
stack bytes. An A-only/P wrapper is 8 bytes/21 cycles and 5 stack bytes including
the CPU frame. An empty body's indirect jump is 3 bytes/5 cycles and 3 CPU-frame
stack bytes. A placement-required JMP adds 3 bytes/3 nominal cycles. CPU entry
adds 7 cycles/3 bytes; stock SEI/JMP dispatch adds 7 cycles, existing ROM not
output bytes. These are independent analytical expectations, not runtime totals.
Removing the current low publication pair saves 5 bytes/6 cycles per install;
removing the low restore pair saves 6 bytes/8 cycles with absolute links (ZP has
its separately recomputed cost). Keep coherent two-byte predecessor capture.

Final bytes/cycles, paths, physical links, SFA/ZP, wrappers, pads, fill and retained
ROM are measured separately against equivalent expert work. No finite external
total/deadline and no hidden padding. Local parity meets create the mandated
path-to-win GitHub debt; pushes remain explicitly user-owned. No early optimizer.

Lineage: expert 2.0.3/content `22cc5f00`; SFA interrupt-route completion, pinned
C64 NMI contracts, official NMOS grid and lowering entry/cost rules; MOS-PGM-1976,
MOS-6526-1981, CBM-C64-KERNAL-03. ST-5–ST-24 own independent expectations.
