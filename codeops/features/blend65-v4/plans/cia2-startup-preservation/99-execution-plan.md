# Task T-09: CIA2 startup-state preservation

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Progress**: 0/4 tasks (0%)
> **Last Updated**: 2026-10-08
> **Status**: Executing — T-09.1 inactive qualified content review and verification
> **Phase baseline commit**: 24c88f62e646f6661a2d23286ee6b1e1d305c358
> **Phase baseline tree**: 6ef6cf1f8b62f6faa83af86485df8b3566ba33b4
> **Scope mode**: strict

## Objective

Repair the existing RD-05 R5.4 startup defect owned by
[CIA2 AR-P9](../rd-05-cia2-ownership/00-ambiguity-register.md#ar-p9--separate-operation-proof-from-the-real-existing-startup-gap).
This is mandatory startup preservation, not an additional CIA2 API or an optional
feature. On 2026-10-08 the user said “i approve”, answering the single bounded
T-09.1–T-09.4 approval request. This explicitly authorizes the input-mode startup
contract, exact expert/binding/test updates below and xhigh for the named batch
without repeated effort pauses. Scope stays strict; no push or specification
edit is authorized.

**Approved repair direction — documentary qualification complete; implementation pending:** For the current four
fixed-bank-0 cooperative profiles, save CIA2 DDRA, write `saved_ddra & $FC` to
DDRA, and restore saved DDRA on normal return. Do not read, save or write PRA.
Input pull-ups would establish high bank-select pins without changing the hidden
PRA latch. Remove the unused PRA save byte from existing platform startup state;
this is not function storage. Reuse the existing straight-line startup emitter,
qualification tools and authority-maintenance procedure. Add no shadow, runtime
owner, entry restriction, dependency or general bank-switching framework.

## Assessment and evidence

| Evidence                                                                                                                                                                                                                                                                                                   | Conclusion and limit                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Startup producer](../../../../../packages/compiler/src/layout/startup.ts), preserved devices and entry/return CIA2 operations                                                                                                                                                                             | A physical PRA read is saved and written back; entry also unconditionally writes `readback \| $03`. Reading pins is not reading the hidden output latch. The defect predates the CIA2 ownership slice.                                                     |
| Retained genuine STOP/RESTORE then SYS replay, `/tmp/blend65-cia2-native.GjRTpE/boundary-pilot-stop.log`, lines 167, 408–409 and 1873–1874                                                                                                                                                                 | Internal PRA changes `$D7 → $97`, with DDRA `$3F`. CPU execution performs both writes. The observer measures internal state without repairing it. CIA2 timer/NMI operations do not write PRA or either DDR.                                                |
| Original four-profile STOP logs in that directory                                                                                                                                                                                                                                                          | Each records 66 SYS entries. Observed PRA values are `$C7/$D7/$97`, DDRA `$3F`; all happen to select bank 0. This does not prove a universal entry condition. Original failing checks remain unchanged.                                                    |
| [MOS 6526 data sheet](https://myoldcomputer.nl/Files/mos_6526_cia.pdf), printed pp.3–5                                                                                                                                                                                                                     | DDR zero selects input; port reads reflect pins, including output-configured bits. Inputs have pull-ups. Reset clears latches while input port readback is high. A port read cannot reconstruct a latent latch.                                            |
| Original Commodore schematic 251138: [CIA2 sheet](https://www.zimmers.net/anonftp/pub/cbm/schematics/computers/c64/251138-2of2-left.gif), [bank routing](https://www.zimmers.net/anonftp/pub/cbm/schematics/computers/c64/251138-1of2-right.gif)                                                           | Visually inspected PA0/PA1-to-VA14/VA15 wiring supports the bank-0 candidate on this board. This is not physical qualification of every C64 revision or proof of transition timing.                                                                        |
| Pinned VICE 3.10 source: [CIA core](https://github.com/VICE-Team/svn-mirror/blob/4d283a2e7dd59b7e378524878e81ecc7826b700c/vice/src/core/ciacore.c), lines 802–809; [C64 CIA2](https://github.com/VICE-Team/svn-mirror/blob/4d283a2e7dd59b7e378524878e81ecc7826b700c/vice/src/c64/c64cia2.c), lines 137–165 | The effective output is PRA or inverted DDRA. CIA2 bank selection uses the inverted low two effective bits. A DDR change updates bank selection without a PRA write. This source check is not a new native runtime result.                                 |
| [Frozen Appendix C64](../../../../../spec/appendix-c64.md), §§5.1 and 9.3; [RD-05](../../requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md), R5.4                                                                                                                             | Startup owns the bank and must restore its changes. The specification says direction must be established, not that bank-0 pins must be outputs. The explicit 6510 readback exception is not a CIA2 hidden-latch waiver. No specification edit is proposed. |
| [Current profile](../../../../../packages/compiler/src/target/c64-kernal.ts), lines 9–12                                                                                                                                                                                                                   | All four implemented profiles select VIC bank 0. Takeover and general bank switching remain separate RD-05 work.                                                                                                                                           |

Primary material downloaded for this assessment is in
`/tmp/blend65-t09-assessment.fnxWsa`. The production startup blob is
`bf9ab47c6a4e976e9aa115e51cb5d2d763641a26`. Active authority remains expert
2.0.3/content `22cc5f00f381c82d347cf342be4fcff16bc291c6`; frozen specification
identity remains
`BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`.
No candidate startup, native qualification or new hardware result was produced
during assessment.

### Recommendation hardening

**Confidence: Medium.** Primary CIA semantics, selected board wiring and pinned
emulator source support the direction; native transition/return proof is pending.
**Hardening: Changed.** Independent challenge replaced the proposed bank-0 entry
restriction with this smaller DDRA-only candidate. The configured design
challenger read primary MOS evidence and supplied exact local excerpts. Its
read-only role lacked a permitted local-file reader; it did not independently
inspect repository files, execute VICE or qualify hardware. This is recommendation
hardening, not completed implementation review.

Conditional PRA writes only avoid corruption when no bank change is needed; they
do not prove preservation for general admitted entry. A shadow initialized from
pin readback does not recover hidden latch state. A bank-0-only entry restriction
would narrow developer freedom and is unnecessary if this candidate qualifies.
An observable-only preservation waiver would weaken the requirement before
exhausting a direct repair. Neither fallback is authorized if qualification fails.

The candidate preserves PRA against **startup's** writes by issuing none. Before
closeout, inventory reachable compiler, source and firmware PRA/DDRA writers and
their ownership. Deliberate raw writes remain source effects, not evidence that
startup recovers an unreadable earlier latch. Do not silently ban raw POKE, assume
firmware cannot run or claim whole-program preservation from an empty program.
An unresolved ownership conflict requires a separate bounded ruling.

**Strongest objection:** Input mode is observable, not merely an equivalent
display representation. For example, a raw PRA write with low bits two selects
bank 1 when those bits are outputs, but leaves bank 0 selected when they are
inputs. The proposed startup therefore changes an execution-mode assumption of
raw bank-register code. Approval must explicitly cover that input-mode contract;
it is not an automatic preservation of every old raw program's behavior. Raw
register access remains legal and follows CIA semantics. A future typed bank
operation must establish the required direction itself, not make modern users
learn the hardware convention. Do not use a comparison mask to conceal this
distinction or expand this repair into that future banking API.

## Approved execution boundary

**User-approved option:** Apply the explicit input-mode startup contract, bounded
expert correction and matching oracle exceptions below, then qualify the candidate
before compiler implementation. This changes startup's low-DDRA operating mode,
not language syntax or raw POKE semantics. No bank-0 entry restriction is proposed.

| Proposed change                                                       | Exact boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Expert VIC-bank guidance                                              | Replace the unconditional output-direction mandate in `references/c64-memory-and-runtime.md`, lines 126–130, with a qualified fixed-bank-0 input/pull-up exception. Explicitly distinguish input-mode startup from output-mode PRA bank writes. Keep general bank-write, latent-latch, shared-device and banking safety rules. Stage and qualify a patch successor through the existing oracle-first process before activation; preserve one active baseline and historical records. |
| Authority binding                                                     | Synchronize only expert version/content fields in `packages/compiler/src/build-info.ts` and the successor version/content/hash/activation checks in `test/foundation.spec.test.ts`. Preserve specification identity, historical checkpoints, every negative fixture and complete raw-byte guards. No bypass or release framework.                                                                                                                                                    |
| `packages/compiler/src/layout/c64-layout.spec.test.ts`, lines 107–122 | Replace only `$DD00` with `$DD02` in the positive volatile read/write inventory and add an explicit absence check for startup PRA accesses. Preserve all other addresses and CPU/status/control assertions.                                                                                                                                                                                                                                                                          |
| `test/rd05/profile-pipeline.spec.test.ts`, lines 233–246              | The same exact address replacement, plus explicit absence of PRA loads/stores in the empty-program startup/return. Preserve all four profiles, PRG stub, CPU/status, SID-absence and equality/cost assertions.                                                                                                                                                                                                                                                                       |
| `test/m1/vice-driver.ts`, display comparison at lines 692–710         | Permit only the bank-equivalent low-DDRA representation difference: independently require generated low DDRA zero and physical low PRA three, retain exact upper DDR/PRA fields, then compare bank-equivalent display state. Preserve rendered pixels, VIC fields, source behavior, CPU/return proof, ordered game MMIO traffic and the separately frozen expert run/captures. No global masking or stale-golden replacement.                                                        |

The M1 helper currently compares literal CIA2 direction bytes with the expert
twin, although its game MMIO trace starts after startup and stops before the
epilogue. Bank-equivalent comparison therefore needs this explicit narrow
exception; removing the comparison would weaken the oracle. New negative
qualification must still detect wrong bank pins, wrong upper direction bits,
wrong generated low direction bits, altered pixels and incorrect return state.
Any additional old-oracle change needs its own exact exception.

Assessment writes were only this mini-plan and the feature roadmap.
Approved execution also touches the existing expert qualification/source records,
binding fields/checks above, startup implementation and its logic-tier tests, new
independent startup regressions/native fixtures and this task's evidence. These
are authorized by the exact user ruling above. `spec/`, sibling feature semantics, APIs, product scope,
dependencies, CI and portfolio updates remain excluded. No push is authorized.

## Tasks

### T-09.1 execution evidence — in progress

The supplemental hardware/product oracle was frozen before replacement guidance:
SHA-256 `b9b3e411519a217add549bfb7ec7330340d25e831f4eb3f6f8d18b35cd89becf`.
Independent source review supports the mechanism only at documentary scope.
Its incorrect `T1NMI` locator was corrected to the actual `NNMI20` Timer-A path.
Candidate 2.0.4 was staged outside the working tree in
`/tmp/blend65-startup-authority.ZzAkLD/candidate` before qualification. Its exact
qualified bytes are now migrated inactive; public metadata still selects 2.0.3.

The independent content/dependency review cleared the exact final candidate and
the new `bank-controls-final` envelope. Two minor lineage/source-location defects
were corrected before evaluation. One major packet-extraction defect invalidated
an already-started initial run; that original packet/log is retained and cannot
count as qualification. The corrected final packet physically excludes historical
oracle/grading fields and requires all seven permitted source-definition headings.
The fresh closure is Q-P10 plus Q-P01/Q-P03/Q-P12. The other 109 cases may inherit
only their independently reviewed unchanged decisive fields. Only Q-P10's oracle
was strengthened; its original fields and all other 112 oracle hashes are exact.

| Reachable writer family                          | Ownership and preservation boundary                                                                                                                                                 |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing startup                                 | Only named production consumer of CIA2 PRA/DDRA; its own writes are the defect being repaired.                                                                                      |
| Typed CIA2 timer/NMI operations                  | Their owned registers exclude ports and DDRs; they create no PRA/DDRA preservation claim.                                                                                           |
| Raw POKE / imported assembly                     | Legal source effects; inspect actual addresses, visibility, directions and admitted effects. No new ban or readback shadow.                                                         |
| Stock IRQ keyboard and no-source RESTORE         | Route-specific firmware effects remain independently bounded; background serial transmission must not be assumed absent from reset history alone.                                   |
| KERNAL IOINIT                                    | Writes PRA `$07` and DDRA `$3F`; STOP/warm-start is a non-returning firmware boundary, not startup's normal return.                                                                 |
| KERNAL serial4.0, open::CLN232, rs232nmi::NNMI20 | Actual PRA read/modify/write paths; pin readback can overwrite hidden latch bits. They require their own source/firmware ownership and do not become a whole-program latch promise. |

All 32 files in the pinned recovered KERNAL source directory were inventoried for
the named port/DDR symbols and direct register addresses. Compiler and firmware
inventory is audit evidence, not expert authority. Documentary grading is complete;
native writer/return observations, immutable binding and compiler repair remain pending.

The final isolated evaluator and separate grade pass Q-P01/Q-P03/Q-P12. Q-P10's
initial exact source-citation failure remains in the captured evidence; a fresh
source-only completion and separate joint grade close only precise source locations.
RV-001, the joint grader's “four” versus five absolute-operation prose typo, is
retained with an independent primary-grid arithmetic disposition. The original
independent cost PASS remains decisive: adjacent 17 bytes/22 nominal cycles,
separated 20/26. No oracle, answer or old failure was rewritten. All actual packet,
control, completed-turn, exit and final-answer identities pass independent review.
Full/evaluated runtime identities are separately recorded; 109 unchanged decisive
case fields inherit only their reviewed prior evidence.

All 22 live expert files match the qualified candidate byte-exact. Inactive full
tree SHA-256 is `da89eb6d587dee7a3c85dfa97695b029285794688a06962a107b4afc4c384d8a`;
release record is `5937b41e913c8642ec57364a25f7e360891df7007c9493397d5444257f40d482`.
The old unchanged foundation guard correctly rejects migration: 11 pass/one exact
SKILL-byte failure. The authorized successor guard preserves every historical
checkpoint/negative and pins the entire new raw tree. Independent inactive-content
review is clear. Fresh install/build/typecheck/full test commands pass: 5,106 tests,
two existing compiler skips, zero failures; root suite 3,203/3,203. Existing build
caches are used only by the normal project commands. Coherent local content
checkpoint is now warranted; immutable binding remains pending. This is not
activation or a compiler/native repair qualification claim.

The source review also distinguishes an adjacent capture/setup sequence: 17 bytes
and 22 nominal cycles where observable ordering permits, versus the separated
20-byte/26-cycle projection below. Actual emitter/expert parity remains unproved.

- [ ] T-09.1 Qualify and bind the approved expert correction. Freeze discriminating
      expectations before changing candidate guidance; review sources/oracle
      independently and evaluate changed/dependent cases. Reuse the existing
      staged content and binding checkpoints. Inventory all relevant writers and
      dependent decisions, including source/firmware input-versus-output mode
      behavior; stop if the proposed narrow contract does not close.
      **Verify:** Qualified patch identity, inheritance closure, source keys,
      byte guards and independent authority/binding review; unchanged spec bytes;
      directed foundation tests and full checkpoint at activation.
- [ ] T-09.2 Add independent startup behavior and emitted-code/cost regressions;
      record RED against the unchanged implementation. Cover all four profiles,
      hidden-latch disagreement, all low-DDR/latch combinations and non-bank-0
      entry. Keep debugger-initialized state probes separate from genuine
      STOP/RESTORE/SYS replay. Use semantics-derived bank/return expectations,
      not generated assembly as the behavior oracle.
      **Verify:** Expected old-code failures; immutable new oracles, exact approved
      old-test exceptions and discriminating M1 comparison negatives.
- [ ] T-09.3 Apply the straight-line DDRA-only change in the existing emitter;
      delete the unused platform byte and adjust existing offsets. Update only
      relevant logic-tier ordering tests; preserve 6510 latch-before-DDR order,
      CPU/status/stack/vector obligations, initializer order and no-copy behavior.
      **Verify:** Directed GREEN, zero startup PRA accesses, exact DDRA operations,
      no added function storage, independent assembled costs/resources and all
      four-profile normal returns.
- [ ] T-09.4 Complete sequential native replay, M1 and full verification;
      perform required independent correctness, SFA/ABI, platform, output and
      semantics/DX review. Resolve findings, bind final artifacts/resources,
      reconcile deferrals and update T-09 only. RD-05/DEF-7 remain open for their
      other obligations.
      **Verify:** Fresh install/build/typecheck/full tests, protected paths,
      exact approved changes, independent review closure and normal/genuine
      STOP/SYS restoration. Report VICE-verified/hardware-unverified only.

**Verify:** During assessment use targeted Markdown formatting, local links,
source/anchor identity, roadmap arithmetic and protected-path checks. During
execution use directed tests; before each phase/authority checkpoint run
`yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, and `yarn test`.
Run VICE cases sequentially. Use the git-commit skill for coherent green local
checkpoints; never push automatically.

The supplied read-only full-plan parser counts this checklist as four unstarted
tasks, but does not recognize the mini-plan format: it reports missing
`00-index.md` and a spurious Ready lifecycle. Those outputs are not readiness
evidence. The lightweight skill requires this single file, so validate its task
count/status directly; do not add a multi-document set or alter the parser.

## Cost and proof gates

| CIA2-only startup and return portion       |   Current | Candidate projection |
| ------------------------------------------ | --------: | -------------------: |
| Code bytes                                 |        40 |                   20 |
| Nominal instruction cycles                 |        52 |                   26 |
| Platform saved bytes                       |         2 |                    1 |
| Added function homes / ZP / hardware stack | 0 / 0 / 0 |            0 / 0 / 0 |

The projection counts two current absolute saves, two setup sequences and two
restores against one save/setup/restore. It is not assembled or measured output.
Nominal cycles exclude VIC stalls and interrupt interference. Whole-PRG bytes,
alignment/padding, resident capacity and expert whole-program parity are Unknown
until final assembly/layout. Do not claim a production-grade win from this table.

Native proof must show effective bank 0 before any source bank change, exact internal
PRA and saved-DDRA return, unchanged unrelated pins/directions and relevant CPU,
MMIO, ABI and interrupt state. Include changed external IEC inputs, reachable
firmware activity, repeated genuine STOP/SYS and ordinary return. Internal-latch
observations supplement public pin readback; neither emulator mutation nor
synthetic PC/stack injection is genuine keyboard/RESTORE evidence. Bank-transition
timing must be bounded separately. Prove raw bank writes follow the explicitly
approved direction contract and do not claim unchanged output-mode behavior.
This task supplies no raster-stability promise
or general bank-1–3 operation. Physical CIA edge/revision QA remains RD-10.
