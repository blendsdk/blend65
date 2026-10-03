# Testing strategy: cooperative NMI qualification

> **Parent**: [Index](00-index.md)
> **Authority**: AR-P3/AR-P11/AR-P12

## Independent oracles

Write new specification tests from these cases and frozen/public contracts only,
without reading implementation. AR-P11 is the sole exception for the named old
fixtures. Behavior and assembly/cost expectations are separate. Differential
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

## File and phase ownership

| New specification file                       | Cases                                                            |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `test/rd05/nmi-stack-evidence.spec.test.ts`  | ST-1–ST-4                                                        |
| `test/rd05/nmi-route-admission.spec.test.ts` | ST-5–ST-15, ST-24                                                |
| `test/rd05/nmi-route-output.spec.test.ts`    | ST-16–ST-19; assembled bytes/resources, not text-only assertions |

AR-P11's old three files plus ledger JSON carry ST-5–ST-7/ST-23 as the register
specifies; no other old spec-test file may change. Test files stay under 300 lines
by concern, split a new file when needed without weakening cases. Direct internal
tests use `*.impl.test.ts` and are authored only after implementation.

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
