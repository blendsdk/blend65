# Bounded machine selection

> **Parent**: [Index](00-index.md)
> **Authority**: AR-P4; RD-08 R8.25–R8.32/R8.38–R8.47; frozen source/CPU/ABI contracts

## Integration

Consume 03-01 facts through `MachineLoweringInput`/`FunctionLoweringState` and
existing aggregate, call, comparison, unary, control and register-forwarding
owners. Add only `machine/fixed-loop-selection.ts` and
`machine/byte-value-availability.ts` where focused matching would otherwise
enlarge existing monoliths. Keep ordinary fallback and `none` behavior intact.
No ACME-string rewrite, new function-call kind or public platform API.

Selected facts/recipes are keyed by source operation/binding and context:

```ts
/** One source-compatible selection, with all storage and final obligations retained. */
selectFixedLoop(facts: FixedLoopFacts, input: MachineLoweringInput): readonly LoopSelection[];
/** Prove one bounded producer/use window or exact short-circuit edge. */
proveByteAvailability(input: ByteAvailabilityInput): ByteAvailabilityProof | null;
/** Derive exact returned A/Z agreement from every selected ordinary Boolean exit. */
deriveBooleanExitFacts(fn: MachineFunction): BooleanExitFacts | null;
```

`LoopSelection` names the source loop, representation, preserved exits, source
operation/iteration mapping and all SFA requests. `ByteAvailabilityInput` names
producer/use sites, operand identity, relevant effects and selected clobbers;
its proof lists the permitted interval/edge and owned flags. `BooleanExitFacts`
requires every reachable ordinary return to agree: canonical A=0/1 and
Z=(A==0), with no intervening PLP/flag clobber. These are internal certificates,
not a strengthened public ABI. They must be rechecked after machine shaping.

## Admitted rule packets

Each row is one current source consumer, exact match and counterexample. All
consume 03-01 facts and produce structured instructions/source ranges/storage
recipes; final validity and complete costs belong to 03-03. Missing proof keeps
the original sequence. Rule IDs below are internal stable evidence names, not a
registry or user switches.

| Rule | Match and semantic preconditions | Selected sequence / effects | Smallest counterexample | Oracles |
| --- | --- | --- | --- | --- |
| `fixed-object-address` | Unique direct-call actual root; same packed layout; complete bus/RAM/alias validity. | Symbolic absolute field or absolute-X/Y byte access with exact index identity; omit only unneeded marshalling/transfers whose evaluation, register/flag state and complete bus footprint are preserved. | Second object/callable entry or page-cross dummy address touching MMIO. | ST-4–ST-6; actual instructions and pointer-home accounting. |
| `direct-fixed-result` | Unique already-selected caller destination, no overlap/early-publication observer and exact source return effects. | Construct directly; no copied 11-byte object or hidden destination pointer when encoded by a fixed-address variant. | Handler reads destination before original return, or nested call shares it. | ST-7–ST-8; value/interrupt trace plus zero extra copy/destination homes. |
| `byte-window-reuse` | Stable byte producer and variable operands across one exact window/short-circuit edge, no register/flag/effect invalidation. | Keep A through `CMP; BEQ; AND`; remove only proven dead temporary stores/reloads. CMP owns equality/carry, not V. | EOR destroys the left operand, PLP changes Z, or another load clobbers A. | ST-9–ST-11; independent byte-domain answers and selected sequence. |
| `invariant-byte-complement` | Exact byte/complement dual value, definition unchanged across recognized fixed loops; no volatile/call/alias/interrupt observation. | Reuse the pure complement or retain original sample alongside its complement in already-closed homes; never duplicate a volatile read. | Loop writes the value or has an effectful zero-iteration producer. | ST-12; source memory/effect trace and complement/load counts. |
| `boolean-exit-flag` | Selected closed ordinary Boolean callee certifies every exit A/Z; source call and interrupt ABI preserve that state to the use. | Branch directly on returned Z; ordinary JSR/RTS remain. | Return path restores unrelated P or loses Z after loading A. | ST-11; all return paths, flags and charged caller retests. |
| `fixed-word-induction` | 03-01 exact finite loop, source word reconstructible and each selected register live/clobber obligation closed. | Original word, low-byte home, X/Y representation or exact-eight expansion; keep wider live-outs or rematerialize zero high byte exactly. | 256 boundary, visible/addressed counter, unsafe nested register overlap or continue bypassing update. | ST-13–ST-15; iteration/results/volatile trace and full loop/branch costs. |
| `precise-private-overlay` | Exact access-complete occupancy, including surviving definitions, member/marshal writes and deferred reads; no outstanding alias/async observer; same region/width/domain constraints. | Feed nonoverlap to existing SFA allocation; no literal eight-ZP arrangement in production. | Dead assignment overwrites a live overlaid value, last-use argument delivery is clobbered, or a live NMI link is reused. | ST-16; closed homes/stack and adversarial access/call/IRQ/NMI cases. |

All flags needed by later instructions are explicit. ADC/SBC and shifts retain
their C/D obligations. Stores never create N/Z ownership. A physical register
recipe is invalid across an unproved call, join, IRQ/NMI clobber or competing loop.
Only the one proved condition edge is retained; this is not a general CFG allocator.

## Source-to-sequence map

| Existing ordinary source component | Complete target route | Necessary certificates |
| --- | --- | --- |
| Whole caller | Fixed saved identity; unchanged scalar evaluation, raw inputs and output writes; saved input retains its exact load loop. | Object/call ABI, induction, no source raw footprint overlaps. |
| Acquisition | Complete initialized destination; PBON guard; exact eight PA/row operations; balanced sink/DDR restoration and final quality. | Direct result/publication, fixed-eight expansion, mask/flag/storage/vector proof. |
| Key query | Quality/ordinal/high guard; byte masks; one compatibility call; floating/grounded predicates; bounded matching-column loop; sole-source call. | Object address, byte windows, precise lives, counter/clobber and Boolean exits. |
| Joystick query | Full-domain port/control guards; byte shift; compatibility call; exact stable own/opposite sample; sole-source call. | Object stability, byte/complement availability, exits and sibling overlays. |
| Compatibility | Ground masks; exact outer/nested loops; nonempty/ground consistency; retained residual through the short condition; true/false returns. | Complement reuse, CMP/edge A ownership, both counters, local/call lives. |
| Sole-source | Zero and one-bit predicates across separate ports; ordinary Boolean return. | Byte arithmetic/window and all-exit flag proof. |
| Callback | Existing callback-only chain variant with status-before-A, PA-before-marker order and one immutable page-safe prior-link jump. | Existing selected route/domain, no private generated handler storage and exact closure. |

The analytical bytes live only in AR-P4. Every row above must have actual selected
assembly, closed resources and independent runtime evidence before sufficiency
is claimed. If any consumer needs a new unsupported family, reopen AR-P4 rather
than copying the expert body or inventing an input intrinsic.

The key query's byte `matchingColumns` is not its word induction variable. Keep
and charge its home, initialization, updates, reloads and comparisons unless an
already approved byte-availability recipe proves its complete register window.
Sharing a dead column/ordinal slot requires the corrected access-occupancy proof.
No new scalar-induction analysis is assumed to reproduce the expert sequence.

## SFA and debug recipes

Before lowering/binding closure, declare selected homes, eliminated symbolic
object-address items, registers, rematerialized high bytes, spills, staging and
helper scratch. Inventory and actual marshalling must consume the same recipe;
retained generic/address-taken entries keep generic parameter duties. No live
semantic value is erased because it lacks a store.

Use the existing required/preferred ZP allocator, precise lives and domain-aware
interference. No placement copied from the witness is a production rule. Held
installation links stay immutable/live for the entire route, not just the
install/remove operation. Mainline/callback overlap is not sibling overlay.

Populate existing version-1 availability: available memory/register pieces,
constant bytes, rematerializable rules or optimized-away/not-live states at exact
final instruction ranges. For a word represented by one byte, represent a
generated byte symbol and rematerialize the source word by zero extension; do not
claim a two-byte X/Y piece or fabricate a high-byte home. Static object parameters
can reference the real object symbol through an address-rematerialization rule.
Every generated symbol is evidence-only unless a real SFA demand is separately
declared. Unrepresentable new facts stop the producer; no schema extension here.
