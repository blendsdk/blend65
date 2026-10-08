# Task T-09: CIA2 startup-state preservation

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Progress**: 4/4 tasks (100%)
> **Last Updated**: 2026-10-08
> **Status**: Done — bounded repair verified and independently reviewed
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

**Approved repair direction:** For the current four
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
`/tmp/blend65-t09-assessment.fnxWsa`. At assessment time the production startup blob was
`bf9ab47c6a4e976e9aa115e51cb5d2d763641a26`, and active authority was expert
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
| `test/rd05/cia-basic-return-vice.spec.test.ts`, lines 266–274         | AR-P1's separately approved exception: replace only the expected normal-return write inventory `[0xdd00, 0xdd02]` with `[0xdd02]` and its adjacent two-line comment. All source fixtures, tracepoints, profiles and CPU/state/timer/keyboard assertions stay unchanged.                                                                                                                                                                                                              |

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

## Ambiguity Register

### AR-P1 (runtime) — CIA1 normal-return write inventory

**Status: Resolved — approved on 2026-10-08.** The user's “i approve” answers
the exact additional test-exception request. The failed full checkpoint passes all package
tests and 3,294 root cases, but all four profile cases in
[`cia-basic-return-vice.spec.test.ts`](../../../../../test/rd05/cia-basic-return-vice.spec.test.ts)
stop at line 274. Their unchanged old inventory requires `[0xdd00, 0xdd02]`;
the approved DDRA-only startup repair correctly emits only `[0xdd02]`.
The earlier exact exceptions do not include this additional specification file.

**Best option:** change only that expected array to `[0xdd02]` and the adjacent
two-line latch-before-direction comment to describe DDRA-only restoration. Keep
every source fixture, tracepoint, profile, CPU/state/timer/keyboard assertion and
all other tests unchanged. The complete CIA2/SID write inventory remains active:
a PRA write or any additional unrelated write still fails. This is a necessary
contract synchronization, not permission to weaken behavior checks or change
compiler output. This exact exception is now executable; no other old-oracle
change is authorized.

## Tasks

### T-09.1 execution evidence — verified

The supplemental hardware/product oracle was frozen before replacement guidance:
SHA-256 `b9b3e411519a217add549bfb7ec7330340d25e831f4eb3f6f8d18b35cd89becf`.
Independent source review supports the mechanism only at documentary scope.
Its incorrect `T1NMI` locator was corrected to the actual `NNMI20` Timer-A path.
Candidate 2.0.4 was staged outside the working tree in
`/tmp/blend65-startup-authority.ZzAkLD/candidate` before qualification. Its exact
qualified bytes were first migrated inactive while public metadata selected 2.0.3;
the later verified activation is recorded below.

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
caches are used only by the normal project commands. The green inactive content
checkpoint is `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`. Exact activation binding
is implemented; its independent review and fresh checkpoint are pending. All
qualified content except release bookkeeping remains byte-identical. Active full
tree SHA-256 is `21b1727a4715eed322a4fd9a75d41a7e593226e05aa9e2fe7fe94e31df808e58`;
release SHA-256 is `016ed75458a38c4b588d22766724d1e65c680517d31429b97a5e79637a94d81a`.
No compiler/native repair qualification is claimed.

Independent actual binding review is clear: all 21 other expert files, all 45
specification files, historical release body and 18 receipts remain exact.
Directed foundation is 12/12. The first fresh activation full run passed all
workspace tests and 3,202/3,203 root tests; one unchanged CIA1 return case stopped
at its IRQ handler before the expected pre-release checkpoint. Startup and that
test are unchanged. Its original failure log is retained; an unchanged directed
four-profile recheck passes 4/4. The fresh complete rerun passes install/build/
typecheck and all 5,106 tests, zero failures, two existing compiler skips; root
3,203/3,203. The original failure is retained alongside the unchanged directed
and complete rerun results; no assertion was suppressed or rewritten. Exact
activation binding is verified. Expert 2.0.4 is the sole active authority, bound
to immutable qualified content `0e2a6280`; no compiler repair is claimed yet.

The source review also distinguishes an adjacent capture/setup sequence: 17 bytes
and 22 nominal cycles where observable ordering permits, versus the separated
20-byte/26-cycle projection below. Actual emitter/expert parity remains unproved.

The bounded independent ordering review selects adjacent DDRA capture/setup in
the existing bank-publication slot **after** CPU-port mapping. Each owned value
is captured before its own mutation; Appendix C64 §5.1 does not require an atomic
global snapshot. Returning stock IRQ/NMI preserves A and has no DDRA write; the
sole pinned firmware DDRA writer is reset/non-returning IOINIT. No arbitrary
resident-owner ban or reset-derived vector assumption follows. Early fusion was
rejected without implementation: it moves VIC bank publication across 41 snapshot
pairs and may change firmware PRA readback effects. Other pre-existing capture-order
questions are not repaired or qualified by this placement decision. Public-artifact
and native regressions will independently enforce the selected ordering and
17-byte/22-nominal-cycle ceiling before implementation.

- [x] T-09.1 Qualify and bind the approved expert correction. Freeze discriminating
      expectations before changing candidate guidance; review sources/oracle
      independently and evaluate changed/dependent cases. Reuse the existing
      staged content and binding checkpoints. Inventory all relevant writers and
      dependent decisions, including source/firmware input-versus-output mode
      behavior; stop if the proposed narrow contract does not close.
      **Verify:** Qualified patch identity, inheritance closure, source keys,
      byte guards and independent authority/binding review; unchanged spec bytes;
      directed foundation tests and full checkpoint at activation.
- [x] T-09.2 Add independent startup behavior and emitted-code/cost regressions;
      record RED against the unchanged implementation. Cover all four profiles,
      hidden-latch disagreement, all low-DDR/latch combinations and non-bank-0
      entry. Keep debugger-initialized state probes separate from genuine
      STOP/RESTORE/SYS replay. Use semantics-derived bank/return expectations,
      not generated assembly as the behavior oracle.
      **Verify:** Expected old-code failures; immutable new oracles, exact approved
      old-test exceptions and discriminating M1 comparison negatives.
- [x] T-09.3 Apply the straight-line DDRA-only change in the existing emitter;
      delete the unused platform byte and adjust existing offsets. Update only
      relevant logic-tier ordering tests; preserve 6510 latch-before-DDR order,
      CPU/status/stack/vector obligations, initializer order and no-copy behavior.
      **Verify:** Directed GREEN, zero startup PRA accesses, exact DDRA operations,
      no added function storage, independent assembled costs/resources and all
      four-profile normal returns.
- [x] T-09.4 Complete sequential native replay, M1 and full verification;
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

### T-09.2 execution evidence — verified RED

The implementation-blind author supplied three focused files, copied byte-exact
after the green local activation checkpoint `29c40257`. Their SHA-256 identities:

| New file                            | SHA-256                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| `cia2-startup-output.spec.test.ts`  | `d9b905fb0e5111634b14db88ffdfb74b5d4ed6032d9ecde333fe7bc707514ac8` |
| `cia2-startup-vice.spec.test.ts`    | `a99d448c81566a94afba6c2f29c3702c22278550e7be258eec48ca574b25fbfb` |
| `cia2-startup-display.spec.test.ts` | `81562b7078d2fcf0c00997d611fbe53a3cfa60420fc3420426b1b9badac7a562` |

Four output checks and 64 synthetic low-state plus four deliberate source-write
VICE cases judge semantics independently. Twenty-three display comparison cases
cover the narrow normalization helper, not mocked whole-game behaviour. The new
helper is absent; its initial RED must be reported as interface/module absence,
not executed behavioural evidence. Actual every-frame placement, unchanged expert
side, traffic and final-return paths require independent diff/native review.

Before any RED, primary packet mistakes were corrected from supplied public/CPU
contracts: public memory interval ends are exclusive, startup BSS owner is compiler
with its exact state ID, and observed BASIC-return SP is entry SP plus the two RTS
pulls. The cold-boot cycle ceiling is instrumentation, not a routine timing bound.
The author reports no forbidden source, old test or qualification-history reads.
The author completed RED before any startup producer change: 72 executed tests
failed on contract assertions in 197.18 seconds. All four output cases observed
50 saved bytes rather than 49; later opcode/cost assertions were not reached.
All 64 low-state cases observed forbidden PRA traffic and output-mode low DDRA;
seven states per profile additionally lost latent low-latch values. The four raw
source cases independently detected wrong bank pins and restoration of the old
readback rather than the deliberate source value. Exact restored DDRA and caller
A/X/Y/P/SP checks passed. There were no timeout, unavailable-runtime, checkpoint
or CPU-state failures. The display helper was honestly missing: zero collected,
23 authored cases not executed, not 23 behavioural failures.

The RED log is `/tmp/blend65-startup-spec.uFrCNI/independent-red.log`, SHA-256
`79df7fa10324f3274b61b1491cc16fef578b5a9d733dd812efcd15a3c7e25ac7`.
The primary independently confirmed the unchanged startup blob
`bf9ab47c6a4e976e9aa115e51cb5d2d763641a26`, exact three author-file digests and
clean protected specification after the run. The only two approved old positive
inventories were then updated to DDRA plus explicit zero-PRA guards. Their old-code
RED runs produced one expected layout failure and four expected profile failures;
the other seven cases passed. Logs are `old-layout-authorized-red.log` and
`old-profile-authorized-red.log` in the same directory. No unrelated old oracle was
changed. Deliberate RED work is not a green commit checkpoint.

## Cost and proof gates

### T-09.3 execution evidence — directed GREEN

The existing emitter now captures DDRA once at the reviewed post-CPU-mapping bank
publication slot, saves it, masks A with `$FC` and writes DDRA. The return path
restores that saved byte without PRA access. Startup platform state is 49 bytes;
all later offsets move by one, and the unchanged VIC/sprite restore inventory
starts after the two CPU-port entries. No function home, helper, ZP, stack byte,
dependency or source restriction was introduced.

Fresh build and all 105 directed root cases pass: four public assembled-output,
68 native synthetic/source-write, 23 display-helper and ten existing pipeline
tests. All 18 layout specification/implementation cases pass. The old CPU
latch-before-direction assertions remain. Targeted formatting and whitespace
checks pass. Author expectations are unchanged: each formatted new test is
byte-exactly Prettier's output from its archived pre-RED author file; no semantic
edit was made. The first attempted token-comparison helper was unavailable in the
installed TypeScript API and is not evidence. The successful formatter-only
comparison independently closes that mechanical edit boundary.

Logs are `startup-build.log`, `directed-green.log`, `layout-spec-green.log` and
`layout-all-green.log` in `/tmp/blend65-startup-spec.uFrCNI`. CIA2 transactions
assemble to 17 bytes/22 nominal cycles with one saved platform byte. Genuine
re-entry, full M1, complete verification, exact artifacts and independent reviews
remain T-09.4 obligations; no whole-program or physical qualification is inferred.

The first full checkpoint found one stale implementation-only expectation in
`machine/call-retention.impl.test.ts`: the unrelated packed-struct fixture still
expected 50 startup BSS bytes. Only that count changes to 49; its source, call,
binding and global-data assertions remain exact. This is not an old specification
oracle exception. T-09.3 is temporarily unverified until its directed recheck;
the failed full log is retained as `final-test.log`, and no broken commit is made.
The exact correction now passes all 25 layout/call implementation and specification
cases, plus all 27 independent output/display cases (`layout-and-call-green.log`
and `output-display-recheck.log`). T-09.3 is verified again; the full checkpoint is
being repeated without removing any test.

### T-09.4 execution evidence — native and full checkpoint

The unchanged fixed 441-input M1 journey passes in 21.84 seconds. Its frozen expert
source/captures, ordered game MMIO traffic, source behavior, pixel comparisons and
final CPU/profile-state return checks remain unchanged. Only generated low-DDRA
representation is normalized, after checking generated pins/directions for every
frame before transition-frame exclusions.

Four sequential genuine-input replays reuse the original STOP/SYS pilot and exact
source (SHA-256 `e3631ddc2de953823c6500a4a7f71b77bff489adc150db6b6b7628e960b3f636`).
Twenty actual entries include sixteen keyboard/BASIC SYS re-entries, twelve normal
returns, eight terminal stock STOP/RESTORE warm-starts and eight returning generated
NMIs. All internal PRA/PRB/DDRA/DDRB bytes and caller A/X/Y/P/SP/CPU-port state
survive normal returns. Startup reads DDRA once and writes it once at entry/once on
return, with zero CPU PRA traffic in the returning segments. The original `$D7`
hidden-latch witness now returns `$D7`, not `$97`.

An external-input companion uses pinned VICE `iecbus_device_write(8, 0/255)` to
change peripheral bus inputs, not CIA latches or CPU/frame state. Physical upper
port pins change while the hidden latch remains `$D7`; bank pins remain three in
input mode. Every run observes its resources: PAL standard 1/VIC model 0,
later NTSC standard 2/VIC model 3, SID 0/1, CIA1/CIA2 model 0 and KERNAL revision 3.
These are the actual current models, not the earlier slice's MOS8562 model 4.
No PC/stack, vector, CIA latch, ROM or generated instruction was patched. The
CPU-pushed frames, real RESTORE pulses, actual ROM terminal traces and BASIC return
addresses distinguish non-returning firmware boundaries from normal restoration.

Raw replays/checkers are in `/tmp/blend65-startup-native.9NyQ6v`, final prefix
`replay4-<profile>`. Initial preparation failed on retired generation paths;
byte-identical retained rebuilds provide the original artifacts instead. Attempts
1–3 retain their instrumentation failures (quoted command handling, GDB control
flow and an unintended keyboard-buffer command); they are not qualification.
Original failing pilot/source/oracles remain unmodified.

`resources.jsonl` independently reconciles all four actual old/new artifact
families: startup code 632→609 bytes, all code 897→874, padding 487→504, PRG file
1386→1380 and resident RAM 1438→1431. Startup state is 50→49; both existing two-byte
NMI link homes, zero ZP/scratch and the reported four-byte stack resource are
unchanged. The 17 added padding bytes absorb part of the 23-code-byte reduction.
Whole-program path cycles remain explicitly Unknown. Bank publication follows the
reviewed instruction order; nominal costs exclude VIC stalls and interrupt delay,
and no raster deadline or universal silicon promise is made.

The fresh repeated install/build/typecheck steps pass. The complete test run
records 5,197 passes, four failures and two existing compiler skips; the root tier
has 3,294 passes/four failures across 165 passing files and one failing file.
All 95 new startup cases and M1 pass. The four failures share the exact old
CIA1-return write-inventory assertion documented in AR-P1; no compiler or VICE
failure is inferred from it. Evidence is `final-install-recheck.log`,
`final-build-recheck.log`, `final-typecheck-recheck.log` and
`final-test-recheck.log` in `/tmp/blend65-startup-spec.uFrCNI`. Keep this failed
full run and the working repair unchanged while awaiting the exact exception.
T-09.4's complete green checkpoint and five required specialist reviews are
still pending. No broken implementation commit or RD-05 closeout is made.

AR-P1's exact array/comment change is implemented and its four directed native
CIA1 return cases pass (`cia1-exception-green.log`, 6.97 seconds). The actual diff
contains only the approved lines. The new startup producer and all three independent
formatted author files retain their recorded hashes. The fresh full checkpoint is
running under the distinct `final-*-ar1.log` names; install/build/typecheck pass.
The previous failed full logs remain unchanged.

The fresh AR-P1 checkpoint completes GREEN at 2026-10-08 08:14 CEST:
install/build/typecheck and all 5,201 tests pass, with two existing compiler skips.
The root suite passes 3,298/3,298 across all 166 files in 869.44 seconds; all 68
startup native cases and the unchanged 441-input M1 journey pass. Logs are
`final-install-ar1.log`, `final-build-ar1.log`, `final-typecheck-ar1.log` and
`final-test-ar1.log`. T-09.4 remains unverified until its required independent
review and bounded closeout obligations complete. No test was removed or skipped
to obtain this checkpoint.

| CIA2-only startup and return portion       | Before repair | Qualified repair |
| ------------------------------------------ | ------------: | ---------------: |
| Code bytes                                 |            40 |               17 |
| Nominal instruction cycles                 |            52 |               22 |
| Platform saved bytes                       |             2 |                1 |
| Added function homes / ZP / hardware stack |     0 / 0 / 0 |        0 / 0 / 0 |

The old sequence contains two absolute saves, two setup sequences and two restores;
the repair uses one adjacent save/setup and one restore. Independent source review
established the ordering; subsequent assembled/public-artifact checks and native
observations close the bounded output/runtime endpoint above. Nominal cycles exclude
VIC stalls and interrupt interference. The actual whole-PRG/padding/RAM reconciliation
is recorded above; expert whole-program parity and full path timing remain Unknown.
The defective old sequence is not an equivalent expert baseline. Do not claim a
production-grade or expert whole-program win from this comparison.

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

### Independent phase review and local-meet ownership

All five required reviewers independently inspected the original phase baseline
against snapshot tree `70fd609bfd5d5afbc315150d4a6a54e976627e9d`. The bounded
compiler patch SHA-256 is
`9f30c1c347045b45c04796becd36b1b4e2eecc5bdb4a7696d8e9cf713554cf09`.
Fresh contexts received approved scope, normative authority and raw artifacts,
not other reviewers' verdicts or authority qualification answers. Runtime agent
capacity required staggered waves; all five native specialist roles completed,
with no generic fallback or waived responsibility.

| Responsibility                   | Result and boundary                                                                                                                                                                                                                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Correctness and oracle integrity | No findings. Exact five old-oracle exceptions, unchanged negative protection, all compacted state offsets and independent regression provenance checked. Pre-RED files are formatter-equivalent to final files; author blindness and historical primary observations remain attestations, not instrumented historical proof. |
| SFA / ABI                        | No findings. The 49-byte save area remains platform storage; the two lifetime-owned NMI links remain separate and correctly rebound after layout. Caller state, returning entry variants and original final-closure/interference guards remain intact. No new function homes, ZP, helper scratch or stack use.               |
| Selected platform                | No findings. All four actual artifacts and raw replay4 observation/monitor records checked against pinned CIA, wiring and firmware sources. DDRA follows `$3F → $3C → $3F`; changed IEC pins leave hidden PRA `$D7` intact. Normal return and terminal firmware warm-start remain distinct.                                  |
| Emitted code and complete costs  | No findings in the repair. Actual bytes equal the equivalent general returning expert idiom: 17 bytes/22 nominal cycles/one platform byte. Complete code, padding, PRG, resident RAM and bounded stack accounts reconcile. Whole-program expert superiority is not claimed.                                                  |
| Semantics and modern-source DX   | No findings on either axis. Approved input-mode startup introduces no bank-zero entry restriction or new source admission rule. Deliberate PRA writes remain legal source effects. Every-frame M1 bank/direction checks precede existing transition exclusions.                                                              |

All domain reviews use sole active expert 2.0.4, qualified content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`, and the unchanged frozen specification.
Decisive source keys are BLEND65-SPEC-4, BLEND65-STARTUP-BANK0-20261008,
MOS-6526-1981, MOS-PGM-1976, CBM-C64-SVC-1985, CBM-C64-KERNAL-03,
ACME-097-R266 and VICE-310-SOURCE. Authority-content and binding reviews are the
separately completed T-09.1 lane, not hidden compiler-review evidence.

Two orientation boundaries are disclosed: the SFA reviewer read manifest title
metadata at lines 1–32 in addition to the permitted source definitions; the
semantics reviewer saw routing's historical role-configuration summaries.
Neither contained T-09 evaluator/oracle answers, and neither was used as decisive
proof. No reviewer opened expert qualification answers or launched tests/VICE.
Host-performance and security audits are not selected: this diff changes no host
hot path, input/path/process boundary or active security profile.

The mandatory local-meet follow-up is filed as
[#101](https://github.com/blendsdk/blend65/issues/101), owned by RD-08. The current
startup seam receives only the main label, not proof that normal return is absent.
Reusing that seam could omit DDRA retention for proved non-returning programs:
analytical CIA2 target 17→8 bytes, one fewer platform byte and executed setup
14→10 nominal cycles. The removed 6-byte/8-cycle return pair is already unreachable,
not an executed saving. The target is unassembled/unqualified; final padding and
resident savings require actual artifacts. Unknown or returning paths retain the
exact current restoration. No optimizer or new mechanism is added here.
Existing #96/#98 layout/reload snapshots and their ownership remain unchanged.

### Bounded closeout and deferral-expiry check

**Did this RD's deliverables expire any deferral's stated rationale?** This is
T-09's bounded check inside the still-open RD-05, not an RD closeout. Yes: the
observed startup-caused PRA corruption behind TP-003/CIA2 AR-P9/T-09 is repaired
at the specified four-profile endpoint. Original failures and failed observer
attempts remain retained; the former defect is not rewritten as successful proof.

| Remaining boundary                               | Disposition                                                                                                                                                                                                                                                                      |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RD-05 R5.4 overall startup                       | Only this CIA2 transaction closes. Other pre-existing capture-order and whole-program writer questions are not qualified by this repair.                                                                                                                                         |
| Keyboard / combined input                        | Resume the existing R5.25/AC-20 and R5.24/AC-19 discovery owner. Keyboard AR-P2/AR-P3 remain open; no accepted API is inferred. Completed shared NMI work is not re-deferred merely because umbrella DEF-7 remains open.                                                         |
| DEF-7, takeover, platform/workload qualification | Remain RD-05-owned; no broader interrupt, profile or workload completion is claimed.                                                                                                                                                                                             |
| Measured optimization debt                       | #101 remains RD-08-owned alongside #96/#98/#99/#100. None is a permanent output or expressiveness waiver.                                                                                                                                                                        |
| RD-05 Won't Have boundaries                      | Assets stay RD-06, delivery RD-07, general optimization RD-08, developer tooling RD-09 and user-host/physical QA RD-10. No engine or gameplay-policy support is introduced.                                                                                                      |
| FUT-011/012/015/016/017/018                      | External linking, copy surface, modern-image conversion, stack-free calls, general barriers and separate volatile APIs retain their independent reconsideration criteria. This straight-line repair does not satisfy them. T-07 retains separate specification-copy maintenance. |

Status is **VICE-verified / hardware-unverified**. Physical bank transitions and
board/CIA revision coverage, unrestricted external aggregate stack, retained-ROM
completion and complete elapsed path/deadline costs remain Unknown. M1's existing
transition-frame display/pixel exclusions remain exclusions; the every-frame
low-direction/pin guard does not silently certify excluded pixel equivalence.
No frozen specification change, new API/runtime/dependency, broader source
restriction or whole-program production-grade claim is made.

Raw proof has byte-exact private durable copies under
`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/startup-preservation-qualification.5cSMac/startup-runtime-final/`.
Historical absolute paths above identify the original capture locations. The
following mappings preserve those files without modifying their recorded content:

| Original temporary root                 | Durable relative directory          |
| --------------------------------------- | ----------------------------------- |
| `/tmp/blend65-startup-native.9NyQ6v`    | `native/`                           |
| `/tmp/blend65-startup-spec.uFrCNI`      | `spec-and-gates/`                   |
| `/tmp/blend65-cia2-native.GjRTpE`       | `cia2-original-and-artifacts/`      |
| `/tmp/blend65-cia2-rti-fix.Muxd4B`      | `original-byte-identical-rebuilds/` |
| `/tmp/blend65-startup-authority.ZzAkLD` | `authority-final/`                  |
| `/tmp/blend65-t09-assessment.fnxWsa`    | `assessment/`                       |

The final full checkpoint's logs remain distinct from the failed earlier runs.
Build/typecheck commands legitimately reuse valid Turbo caches; this is a fresh
command checkpoint, not a claim of an uncached rebuild. Code/test hashes stayed
unchanged throughout final review. Only this closeout evidence, roadmap status
and the existing public note are updated after the complete green checkpoint.
Feature progress remains 4/10; RD-05 and DEF-7 remain open. Portfolio synchronization
waits for integration. The coherent green checkpoint is committed locally, never
pushed automatically.
