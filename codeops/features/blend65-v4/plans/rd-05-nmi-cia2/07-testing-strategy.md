# Testing strategy: cooperative NMI qualification

## Existing scalar-constant prerequisite (AR-P20)

The independent ordinary-program `local-scalar-constants.spec.test.ts` must prove
the already frozen Chapter 03 §4.2 zero-storage contract before the CFG producer
correction. Cover byte, sbyte, word, sword, boolean and enum constants on the four existing profiles,
native constant values/output, lexical identity and mutable-initialization
preservation. Reuse the public fixture; no NMI admission bypass, new harness or
old oracle change. Native byte/cost expectations derive from useful immediate
loads, absolute stores and ordinary return semantics. Public NMI constant/helper
expectations remain unchanged and must become GREEN at the later complete gate.

AR-P21 approves only four owner-ID lookup arguments. AR-P22 separately requests
ordinary measured helpers called by `main` and focused mutable value observations
with the existing sequential VICE fixture. The user approves that exact exception
on 2026-10-05; independent corrected RED precedes lowering. Every original measured
statement, native/cost and storage/order assertion stays binding. Value checks
must not mandate a particular home address or store/reload form.

> **Parent**: [Index](00-index.md)
> **Authority**: AR-P3/AR-P11/AR-P12

## Independent oracles

Write new specification tests from these cases and frozen/public contracts only,
without reading implementation. AR-P11/AR-P14 are the exact exceptions for the
named old fixtures and one message assertion. Behavior and assembly/cost expectations are separate. Differential
execution is supporting evidence, never the sole oracle. Real compiler services,
ACME bytes and native VICE are used; no mocks or new runtime/test framework.

## Specification Test Cases

All profile cases use the four existing cooperative PAL/NTSC × 6581/8580 profiles,
`optimization: none`, pinned stock KERNAL entry and visible I/O/KERNAL.

| Case  | Input / scenario                                                                                                                                                                       | Independent expected result                                                                                                                                                                                                    | Source                                                                 |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| ST-1  | `module Game; function main(): void {}`; build all four profiles without a hook                                                                                                        | Memory evidence is unproven, with one main-site machineState record carrying the exact compound class and three obligations in the evidence contract. Existing uniqueness and static reconciliation remain valid.              | Ch 06 §5.5; AR-P7; 03-stack-evidence §Direct change                    |
| ST-2  | Main performs ten balanced PHP/PLP pairs; no generated hook                                                                                                                            | Reserve is capacity only; no reserve-as-use row or unrestricted qualified-capacity row. Numeric cost equals maximum scoped finite peak, not peak plus 20. All records satisfy existing arithmetic/schema validators.           | R5.9; AR-P12; 03-stack-evidence §Numeric accounting                    |
| ST-3  | Existing source with 188 balanced PHP/PLP pairs and a finite selected IRQ route                                                                                                        | Canonical W10180 text/numeric decomposition remains unchanged; evidence marks external uncertainty and preserves the exact finite main/IRQ simultaneous route.                                                                 | Ch 14 W10180; AR-P7; 03-stack-evidence                                 |
| ST-4  | Existing bounded capacity boundary sources at 236 and 237 live bytes                                                                                                                   | First remains within usable capacity; actual overflowing bounded component reports E10238. External uncertainty never removes the existing component limit.                                                                    | Ch 06 §5.5; R5.9; AR-P3                                                |
| ST-5  | Balanced empty chained handler: `setNMI(&handler); restoreNMI();`                                                                                                                      | Public check/build success only after full route/storage proof; emitted vector writes target high byte only; no output implies a finite external peak.                                                                         | AR-P7/AR-P10/AR-P11; R5.17                                             |
| ST-6  | Balanced empty `setNMIExclusive` source                                                                                                                                                | Existing E10245 failure and no generation/out directory; no CIA2 ownership promise.                                                                                                                                            | AR-P11; AR-P2 bounded boundary                                         |
| ST-7  | Balanced chained handler retains five byte reads from `$0400..$0404` across later stores to `$0410..$0414`                                                                             | One canonical E10245 record at `setNMI(&handler)`; existing shape/message/related array unchanged; no generation.                                                                                                              | Ch 06 §7.5; AR-P11                                                     |
| ST-8  | NMI calls ordinary void helper that writes one constant byte; handler also uses a local `const` byte                                                                                   | Success if final selected path has no private RAM/ZP homes; ordinary JSR/RTS, correct effect order and exact finite call-frame cost. No syntactic local/helper ban.                                                            | Ch 06 §7.5; AR-P7; 03-nmi-route                                        |
| ST-9  | A helper retains five samples across further reads/stores, reached from the NMI handler                                                                                                | E10245 before emission even though the handler source has no local declarations; selected helper scratch/staging is included.                                                                                                  | Ch 06 §7.5; R5.17                                                      |
| ST-10 | Main installs B, then C, restores C then B; both handlers are storage-free                                                                                                             | Exact predecessor chain and restoration; finite separate immutable links where observers require them; only reachable entries emitted.                                                                                         | R5.16; AR-P10/AR-P12                                                   |
| ST-11 | A mainline helper performs balanced install/pop on both arms of a conditional and on each iteration of a finite loop                                                                   | Accepted with correct exact predecessor/ownership joins; no rejection solely for CFG cycles, helper scope or syntactic nesting.                                                                                                | R5.16; AR-P12                                                          |
| ST-12 | Main installs B; B temporarily installs chained C then restores; C is empty                                                                                                            | E10245 from the growing generated continuation/link demand; no generation. A second arrival followed by C→B creates a new predecessor context, not just external stack uncertainty.                                            | Ch 06 §7.5; AR-P12 B/C witness                                         |
| ST-13 | (a) A masked finite IRQ installs/restores NMI C while main retains NMI B; (b) direct and helper NMI-origin setIRQ/restoreIRQ capture IRQ A, then B into the same live word on re-entry | (a) Check/build succeed with disjoint bindings and exact finite IRQ proof; restore B. (b) Canonical E10245 in check/build, concrete changed-capture witness and no generation; ordinary IRQ-only behavior remains unchanged.   | R5.16/R5.17; AR-P12; 03-nmi-route observer invariant                   |
| ST-14 | Raw byte/word writes overlap `$0318/$0319` before restore; opaque computed-address write may overlap the live vector                                                                   | E10278/no generation; raw write remains available in programs without high-level proof. Word wrap and every written byte are covered.                                                                                          | R5.16; AR-P10; 03-nmi-route §Publication and link proof                |
| ST-15 | Variable-address poke derives a disjoint address from a known global/constant through ordinary value flow while NMI is installed                                                       | Preserved volatile access and accepted route when disjointness is proved; no blanket variable-address ban.                                                                                                                     | Ch 12 memory intrinsics; AR-P7/AR-P10                                  |
| ST-16 | One complete handler placed `at($2000)` or `align(256)`; balanced chained install                                                                                                      | Source placement is preserved on the complete wrapper; published entry is low `$47` via a three-byte JMP if necessary. Full final object/noCross/overlap constraints still apply.                                              | Ch 03 placement; Ch 06 §7.4; AR-P12                                    |
| ST-17 | Default placement with sufficient space for a complete low-$47 wrapper; countercase reserves that range                                                                                | Direct wrapper when it fits; otherwise lawful three-byte entry adaptation or genuine placement failure. Count every actually loaded fill byte; never silently move a fixed object.                                             | Ch 03; AR-P10/AR-P12                                                   |
| ST-18 | Empty, A-only constant-write, and complete A/X/Y-clobber bodies                                                                                                                        | Independent wrapper expectations: respectively 3 B/5 cycles, 8 B/21 cycles, 16 B/43 cycles; stack CPU-inclusive 3/5/7 bytes. Add body, CPU/stub, helper and pad costs separately.                                              | MOS-PGM-1976; Ch 06 preservation; 03-nmi-route §Errors and exact costs |
| ST-19 | Generated handler's constant shared-byte write, both initial D states and seeded A/X/Y/N/V/I/Z/C                                                                                       | Body enters binary mode; predecessor observes exact entry registers/architectural status; stock RTI restores interrupted CPU state. Global byte changes only as source specifies.                                              | Ch 06 §7.4; pinned NMINV ABI; AR-P7                                    |
| ST-20 | Genuine RESTORE at each capture/publication/removal instruction boundary in an assembled generated fixture                                                                             | Only complete old/new vectors observed; full captured predecessor persists through every live observer. No low-byte generated store and no unowned generated CIA2 ICR read.                                                    | AR-P10/AR-P12; MOS-PGM-1976; CBM-C64-KERNAL-03                         |
| ST-21 | Two real RESTORE edges, second while generated wrapper/body is live, then arrivals cease                                                                                               | The generated finite immutable route survives this bounded overlap and chains correctly; do not infer arbitrary stack/ROM safety from two entries.                                                                             | Ch 06 §7.5 exception; AR-P7/AR-P12                                     |
| ST-22 | Stock CIA2 pending-source path and RESTORE+STOP control during installed generated chain                                                                                               | Generated route never consumes ICR; stock read/count/terminal ownership remains. Genuine STOP is not suppressed or forced to return. Full firmware completion remains unproved.                                                | R5.17/R5.20; pinned rs232nmi; AR-P2/AR-P7                              |
| ST-23 | Retained expressiveness ledger with split balanced chained/exclusive probes                                                                                                            | Author probes first and keep chained JSON deferred until ST-19–ST-22 qualify. Then retire only chained and verify the ledger GREEN; exclusive remains deferred with RD-05 reason/owner. Preserve all unrelated rows/negatives. | AR-P11; deferral-expiry rule                                           |
| ST-24 | Failed route/layout proof after an earlier valid generation, plus invalid handler provenance and source calls to a handler                                                             | No partial/new generation is published; existing generation and all callback/provenance guard behavior remain unchanged.                                                                                                       | R5.15–R5.17; existing service publication contract; AR-P3              |

### ST-25 — Masked selected entry and independent source identity

Within a balanced generated NMI lifetime, save source P, mask IRQ with SEI/NOP,
install/restore a chained IRQ handler, then restore P and NMI. IRQ never becomes
eligible while that selected handler is installed. Cover both an empty handler
and a handler calling an ordinary helper whose body performs a balanced NMI
install/restore and a constant screen write. Both public check and real build
succeed on all four profiles; the installed canonical IRQ label resolves in the
actual artifact. No unreachable helper call, screen write or handler-local NMI
transaction is emitted as executable work, and no corresponding private homes
are invented. Source identity and placement remain owned by the real handler.

Also keep a separately materialized raw address of a simple constant-writing IRQ
handler live while its selected CINV variant stays masked. The real raw ABI/body
must not be replaced by the inactive selected variant or deleted. Use actual
assembled bytes and existing debug/function source correlation; do not infer raw
external ABI certification. No raw vector is installed and no raw takeover is
added. Source dependency follows Ch 06 §§7.4–7.5/§8 and approved AR-P15.

The reference-only label's exact normal-ABI construction is recorded and qualified
before a byte expectation is authored. Existing observed IRQ wrappers and all
immutable oracles retain their own expectations. Native execution later verifies
that genuine IRQ eligibility still invokes a real body, never a reference-only
entry, and that the masked fixture's source body does not execute.

### ST-26 — Reached operation and successor projection

Retain the existing direct and all-nonreturning finite-target success fixtures in
`nmi-route-nonreturning-paths.spec.test.ts`. Publication must succeed, not merely
check. Add an ordinary conditional returning path control where a terminal arm
cannot erase the other arm's reachable side effects or ownership transitions.
Inspect actual public debug/byte evidence: unreachable later calls/writes have no
executable instruction range; a reachable returning alternative retains its
source effects, count and order. Keep the existing opaque reachable-writer
negatives and no-generation guarantees. Tests derive from Ch 06 §4.3/§7.8,
ordinary conditional execution and approved AR-P15, not internal map spelling.

### AR-P17 approved regression endpoints

Before correcting the three retained consumer defects, independent new cases
must cover a raw-only Q calling an actually observed balanced H with a byte
parameter, plus an aggregate-return companion whose hidden destination follows
the selected callee ABI. Derive behavior from ordinary call/return semantics;
inspect actual output code and source-owned data homes, not internal identity
spelling. Caller staging remains caller-owned.

Also cover retained Q choosing H/K through an ordinary finite-target function
value, where H/K install C and Q's later helper restores it. The emitted call
must select the same variant/word as the continuation. Retain a compatible
canonical no-variant control so the correction cannot become a blanket thunk ban.

A retained helper which calls a proved nonreturning function before an install/
restore must preserve its real preceding code and independent raw addresses but
emit no executable suffix or successor. Returning, mixed-target and unknown
alternatives must retain reachable work. These are existing call/path/ownership
contracts, not a new source rule or evaluator. Use the current four profiles and
public artifacts; freeze fresh behavior/byte oracles and record RED first.
The user approves this bounded ruling on 2026-10-04. New files are
`nmi-route-retained-call-abi.spec.test.ts`,
`nmi-route-retained-indirect.spec.test.ts` and
`nmi-route-retained-nonreturning.spec.test.ts`, below 300 lines each.
Existing frozen oracle files remain unchanged. Guarded producer/consumer probes
supplement these public RED cases until the later public-admission GREEN gate.

### AR-P18 approved caller-lifetime regressions

The confirmed overlap needs one new independent concern,
`nmi-route-retained-call-lifetimes.spec.test.ts`, before any interference fix.
Prove that a caller byte live across a reused helper remains intact when the
helper has its own simultaneously live parameter/local bytes. Add a transitive
helper and finite-target companion to prevent selecting every call from the
original request root. Use existing public source/debug/byte endpoints and the
current four profiles, not hard-coded allocator addresses or private map names.
Keep compatible canonical-call and reachable/dead-path controls unchanged.
Independent behavior and allocation expectations must distinguish necessary
live-home separation from unnecessary separation of variants not selected by
that call. No new runtime, emulator harness, evaluator or blanket frame rule.
The single new file remains below 300 lines; no existing oracle is edited.
The user approves this exact bounded scope on 2026-10-04. Authoring and RED
precede selector extraction and interference correction; later public GREEN
and final storage/output/runtime gates remain mandatory.

### AR-P19 approved exact fixture exception and IRQ regression

Bounded review finds that the AR-P18 test assumes lexical debug names and
equates code-entry count with canonical home reuse; the earlier retained
call-ABI oracle has the same name lookup assumption. These are not approved
contract expectations. The [exact approved ruling](00-ambiguity-register.md#ar-p19--small-irq-applicability-fix-and-exact-fixture-corrections)
names the two files and permitted mechanics only. The user approves on 2026-10-04.
Retain all existing program fixtures, behavior, widths, native accesses,
marshalling, caller-owned returns, live separation and canonical home reuse.
Corrected lookups must identify source declarations unambiguously. Selected
direct and finite targets must still prove their expected homes; arbitrary
compiler-produced targets are not an independent expectation.

Under that exact approval, one new independent
`test/rd05/irq-call-lifetimes.spec.test.ts` proves the legal IRQ-only main → H → G
case with a caller byte live across G's local write. Author from frozen
call/lifetime contracts and public origin/scope/kind/artifact interfaces only;
implementation and supporting probes remain forbidden. Keep the file below
300 lines and reuse current four-profile fixtures. Expected RED is successful
public compilation followed by failed live-home separation, not the NMI guard.
Record before-fix RED, then correct only NMI proof applicability in the existing
interference owner. Do not invent a new debug API, harness or analysis layer.

## File and phase ownership

| New specification file                       | Cases                                                            |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `test/rd05/nmi-stack-evidence.spec.test.ts`  | ST-1–ST-4                                                        |
| `test/rd05/nmi-route-admission.spec.test.ts` | ST-5–ST-15, ST-24                                                |
| `test/rd05/nmi-route-output.spec.test.ts`    | ST-16–ST-19; assembled bytes/resources, not text-only assertions |

Admission files assert public success/failure and publication safety. The output
author also covers ST-8/ST-10/ST-13(a)/ST-15's helper calls, finite costs, actual
predecessor/link bytes and volatile order. Use existing artifact records and
assembled bytes, not a new public projection. AR-P13 specifies the minimal
existing diagnostic spans for ST-13(b). Public word cases cover second-byte
NMINV overlap and computed fixed-width wrap into NMINV; actual second-byte
address wrap has its internal endpoint in 2.3.1.

ST-13(a)'s exact source keeps one mainline `asm_php()` live, masks IRQ before
installing empty B and the cooperative IRQ handler, enables IRQ with
`asm_cli(); asm_nop();`, masks it with `asm_sei(); asm_nop();`, then restores IRQ
and B before `asm_plp()`. The IRQ handler performs `setNMI(&C); restoreNMI();`
with empty C. Each vector transaction retains two temporary PHP/PHA bytes until
PLA/PLP. The independent simultaneous peak is 10 = program 1 + system 9
(CPU 3 + firmware 3 + chained IRQ status 1 + transaction 2). Separate startup
and NMI per-entry maxima are not added to that proof.

ST-15's constant-copy and known-global-plus-one sources have independent runtime
expectations of one write of 7 to `$0400` and one write of 9 to `$0401`.
Task 2.1.2 asserts the actual source-correlated store count/order without requiring
an early direct-store optimization. Task 2.3.3 uses the existing native VICE
memory checkpoints to prove target/count/order, including the combined source's
`$0400`-before-`$0401` order. An indirect operand alone does not prove its target;
no symbolic executor or new harness is introduced.

ST-17's exact collision countercase fixes an empty complete handler at `$2047`
and reachable three-byte constant data at `$2047`; it requires E10273 and no
partial publication. A pad cannot cure that collision or silently move either
complete object. The default empty fixture independently requires a direct
three-byte low-$47 wrapper; ST-16 owns successful source-constrained adaptation.

AR-P11's old three files plus ledger JSON carry ST-5–ST-7/ST-23 as the register
specifies; no other old spec-test file may change. Test files stay under 300 lines
by concern, split a new file when needed without weakening cases. Direct internal
tests use `*.impl.test.ts` and are authored only after implementation.

The new `nmi-route-boundaries.spec.test.ts` concern covers necessary review
counterexamples before their implementation: interrupt-modified global addresses
versus unaffected globals/evaluated values, a genuinely nonreturning self-install,
and NMI exposure/capture during IRQ low/high publication or removal. Require
source-attributed canonical failures for unproved intermediate IRQ transitions,
and success for masked/nonobserving NMI, vector changes outside its lifetime and
exactly equal exclusive-entry reinstallation. These refine existing writer,
return and publication obligations, not new source restrictions or APIs.
An external process timeout may capture synchronous compiler nontermination in
RED; no execution budget is added to production analysis or the test harness.

`nmi-route-helper-writers.spec.test.ts` independently verifies ST-14's actual
raw-writer attribution through direct, transitive and parameterized ordinary
helpers. Both services retain canonical E10278 at the writer expression, with
error severity, a related-location array and no output. Paired programs without
high-level NMI ownership retain ordinary raw-helper check/build support. Existing
oracle files remain frozen; author RED precedes span-preservation implementation.

`nmi-route-helper-lifetimes.spec.test.ts` independently compares inline, direct
helper and transitive helper final pops followed by a fresh proved-disjoint
address assignment/write and later balanced NMI installation. These sources
remain legal under interprocedural ownership. A partial nested pop still leaves
NMI live and must retain E10278 at an interrupt-mutable raw address writer.
This is lifetime precision within the same proof, not a new address evaluator.

`nmi-route-nonreturning-paths.spec.test.ts` independently requires ownership
checking to end after a closed call whose targets are all nonreturning, including
later CFG blocks. Paired returning and mixed-target controls retain the reachable
opaque-writer failure at its actual source span. These refine execution-path
ownership only; existing oracles and declaration/type checks remain unchanged.

AR-P14 adds only the obsolete E10245 message regex correction in the named
diagnostic file; all other fields, assertions and negative cases stay unchanged.

ST-18's full A/X/Y selected-save construction can use the existing internal
selected-instruction fixture seam in task 2.3.2. Public output cases require real
legal private-home-free source; never invent source-visible register opcodes to
manufacture that cost case. Empty and constant-write public fixtures remain
mandatory. Record each cost observation's actual endpoint separately.

ST-23's deferred row can temporarily disagree with successful directed builds
before runtime qualification. Do not include that ledger suite in the earlier
2.2.10 GREEN gate or commit this intermediate state. Retire the chained row and
run the ledger suite only after native qualification in 2.3.3, before the full
Phase 2 checkpoint. This preserves both spec-first probes and honest retirement.

ST-20–ST-22 are native runtime qualification, with expectations written here
before implementation. Reuse T-04/T-05's exact owned GDB/VICE RESTORE mechanism,
existing profile fixture/build/monitor support and pinned emulator/source identities.
The binary monitor has no RESTORE-input method: do not invent one or substitute
a patched CPU frame/direct handler call for a genuine source. Use bounded temporary
native debugger commands as in the completed proof; no shipped harness. Record
four profile settings, symbols/bytes, breakpoint addresses, actual source events,
read/write counts and captures in the phase review. Run one emulator at a time.

The stock pending-source control is a diagnostic input, not positive CIA2 API
ownership. Record its exact enabled source and stock state before observing it;
do not guess unreadable mask/latch state or conflate RESTORE with an ICR source bit.
If a source/terminal observation cannot run, qualification is incomplete, not a pass.

Coverage targets: 90% core proof paths, 80% evidence/layout support, 60% glue;
directed cases and counterexamples are mandatory regardless of percentage.
Security tests preserve typed/provenance/path validation and all-or-nothing artifact
publication. Web auth/rate-limiting/encryption tests are not applicable: no web or
credential boundary is introduced.

## Verification

Directed service tests first. Red evidence records exactly which new assertions
fail and why; already-passing cases have explicit justification. No broken RED
checkpoint is committed. Green must cover the same immutable cases.

At each phase checkpoint: `yarn install --frozen-lockfile`, `yarn build`,
`yarn typecheck`, `yarn test`; targeted touched-file Prettier and freeze/oracle
checks. Emulator suites run sequentially under the existing project policy.
Final independent review checks correctness, semantics, concurrency, boundaries,
actual code/cost, test integrity and simplicity. Physical status remains
`VICE-verified / hardware-unverified`; host/hardware release QA remains RD-10.
