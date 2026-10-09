# Test strategy: source-library reachability

> **Parent**: [Index](00-index.md)

## 🚨 Specification Test Cases

Independent specification author receives this contract and public interfaces only. Expectations
are immutable; current lowering/closure/allocator implementation is forbidden input. Each row
traces to frozen semantics and the approved prerequisite, not current output. Public fixture and
VICE helpers may be reused without reading compiler internals.

| #     | Concrete input                                                                                                                                                                                                           | Expected behavior/output                                                                                                                                                                                                                          | Source                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| ST-1  | Ordinary main imports a byte constant from a selected module which also exports an unused function with private locals.                                                                                                  | Result equals the constant; no unused function/body/home/startup effect; actual PRG and resource totals match the minimal constant-only control.                                                                                                  | Chapter 10 §4–5; AR-2/5                                     |
| ST-2  | The same module/function is called directly from main, then reached through a normal helper.                                                                                                                             | Correct return/effect each time, both call paths retained; no source-origin/name special case.                                                                                                                                                    | Chapter 10; AR-2/4                                          |
| ST-3  | Main assigns a private global fn(): byte callback to &chosen, then directly calls exported invoke(), which calls that global callback; chosen returns 37. Also materialize an ordinary function address in cold source.  | Build succeeds and the reached call produces 37; caller assignment is not erased merely because invoke is exported. Addressed functions remain callable dependencies, including the cold-owner address. Preserve unassigned-route negative cases. | Frozen function-address semantics; AR-2/4; preflight PF-002 |
| ST-4  | Private explicit initializers invoke helpers and emit byte writes of 17 then 34 to `$D020`.                                                                                                                              | Both calls/writes remain in initializer order before main; no initializer eliminated by lack of later binding use.                                                                                                                                | Chapter 3 §5; Chapter 12; AR-4                              |
| ST-5  | A typed generated IRQ handler with a private byte dependency is installed and restored by main.                                                                                                                          | Handler, dependency, exact selected variant/link duties remain; normal existing route checks unchanged.                                                                                                                                           | Frozen interrupt contracts; AR-2/4                          |
| ST-6  | Add a private uninitialized byte used only by the unused exported function in ST-1.                                                                                                                                      | Zero additional emitted data/RAM/ZP/SFA/stack/link/startup effect; actual PRG/resource totals match minimal control.                                                                                                                              | Approved keyboard AR-P7; AR-3/5                             |
| ST-7  | Main writes private byte 42 then reads it to an observable output; a helper reads another private byte after main writes 19.                                                                                             | Values 42 and 19 and both global dependencies retained.                                                                                                                                                                                           | Chapters 3/12; AR-3/4                                       |
| ST-8  | A reached function directly constructs an aggregate-return result into a private global array/struct.                                                                                                                    | Destination exists and every returned byte is correct; no missing-data label or overlap.                                                                                                                                                          | Frozen aggregate-return contract; AR-3/4                    |
| ST-9  | Unused exported data, private `let = 0`, explicitly placed private data, explicitly requested zeropage data.                                                                                                             | All remain under this deliberately narrow correction; explicit initialization/placement/visibility costs unchanged.                                                                                                                               | Chapter 3; AR-3/4                                           |
| ST-10 | Take a private global's address, including in a cold function, or use its addressed data through a reached helper.                                                                                                       | Storage/address dependency retained; reached value/alias effect correct.                                                                                                                                                                          | Frozen address/alias semantics; AR-3/4                      |
| ST-11 | Reached `peek`/`poke` has an unknown word address or a known address inside selected RAM/ZP windows.                                                                                                                     | Cold candidates remain conservatively; the volatile access is not removed, duplicated or reordered.                                                                                                                                               | Chapter 12; AR-3                                            |
| ST-12 | Reached byte/word accesses have proved disjoint literal or converted addresses at CIA ports/device registers.                                                                                                            | Cold private storage is absent; exact raw access width/order/count retained.                                                                                                                                                                      | Chapter 12; AR-3/5                                          |
| ST-13 | Raw word address wraps at `$FFFF`, and boundary accesses hit just inside/outside selected windows.                                                                                                                       | Both accessed bytes are classified modulo 65536; any overlapping footprint retains candidates. No invented numeric address for unknown input.                                                                                                     | Chapter 12; AR-3                                            |
| ST-14 | Existing raw joystick reads on both ports coexist with selected-module cold function/flag declarations.                                                                                                                  | No added keyboard code/state/link/startup effect; exactly the original one volatile port read and unchanged raw byte.                                                                                                                             | RD-05 R5.24; keyboard AR-P7; AR-4/5                         |
| ST-15 | Two different source modules use the same private variable/function spelling; main uses only one.                                                                                                                        | Full identity selects only the real reached dependency. Merged contributions and installed/user sources follow normal visibility.                                                                                                                 | Chapter 10; AR-3/4                                          |
| ST-16 | An explicitly placed byte[1] is loaded/stored using an unknown word ordinal from a CIA timer counter; also exercise nested places and aggregate/call destinations. Contrast a proved fixed in-object constant selection. | Cold candidates remain for unproved complete indexed footprints, without a new bounds-check requirement; proved in-object constant access does not force unrelated cold retention.                                                                | Chapter8 AR-8; AR-3; preflight PF-001                       |

## Files and verification

New root specs: `test/rd05/source-library-reachability.spec.test.ts` (ST-1–5).
New data specs: `test/rd05/source-library-observability.spec.test.ts` (ST-6–13,15–16).
New compatibility specs: `test/rd05/source-library-output.spec.test.ts` (ST-14 and complete-cost
controls). Split files further only to honor normal test-size limits; no custom harness.
Use all four existing cooperative profile identities for applicable public build/output cases.
Runtime witnesses for calls, initialization, aliasing and callbacks use existing sequential VICE
helpers and independently stated values/effects. Differential control output alone does not prove
behavior. ACME-built artifacts, public memory/cost/debug evidence and source-derived absence
bounds provide the independent cost oracle.

Implementation tests after green cover unknown synthetic visibility metadata, conservative
address classification, conversion/cycle boundaries, direct/indirect aggregate destination
retention and host scaling. Existing `whole-program.impl.test.ts` may correct its export-only
internal assumption while preserving its address-taken case. No old specification test changes.
Approved AR-8 adds focused internal checks for byte/word addressing at `$00FF/$0100/$FFFF`,
register-held byte writes and complete physical zero-page classification without SFA reownership.
Core coverage target 90%, support 80%; directed edge coverage and full existing suite required.

Checkpoint: `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, `yarn test`;
targeted touched-file formatting and unchanged spec/expert checks. Security applicability:
no new input parser/path/process/auth/network boundary; existing validation and negative tests
remain. Artifact compatibility uses fresh builds with no cache/schema migration. No Windows,
macOS or physical-hardware closeout is claimed. Independent roles: correctness, semantics/DX,
SFA/ABI, selected-platform observability, emitted-code/resource parity and host performance
(AR-6 and AR-12).

Review regression ST-17 (AR-12): numeric sprite pointer/enable and raw pointer-table,
VIC control/selector/enable or CIA2 bank-selection writes → retain cold candidates unless
their complete hardware fetch footprint is proved disjoint. Cover real register mirrors and
a word crossing into an enabling register on all four profiles. Unsafe bank/control probes
are artifact-only. A separately checked seeded transparent sprite block yields no collision
in the bounded runtime fixture; its initialized image must be independently shown outside
that block. Disjoint color and isolated sprite-position controls remain omission prepasses.
New implementation-blind cases precede the helper correction; old spec expectations stay fixed.

AR-11 internal regression: complete closure of 120 globals and 24 cold exported wrappers →
only main retained, no global-prefix cross-product. Count actual native prefix checks without
replacing method behavior or imposing a clock deadline. A global aggregate callback assigned
in main then read by an exported ordinary callee remains a finite target.
