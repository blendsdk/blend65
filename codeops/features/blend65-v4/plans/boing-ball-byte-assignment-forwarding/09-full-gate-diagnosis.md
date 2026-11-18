# Complete gate: NMI stacked-PC diagnosis

> **Status**: Closed — approved amendment qualified/reviewed/frozen and actual complete gate GREEN
> **Owner**: byte-assignment forwarding / #168 verification dependency
> **Failed job**: `sh_1f004276f001RhNIj0UrSIh2jh`
> **Progress**:6/6 tasks; full gate GREEN, local commit `9bbc9ead` and owned cleanup complete

Chronological evidence record: the final approved-amendment and complete-GREEN sections
supersede earlier pending states. Local commit and owned cleanup are complete.

## Observed facts

- Final formatting/frozen install/build/typecheck pass.
- Actual `yarn test:full` exits1 in5,000.427s; final chain5,004.419s.
- Workspace logs replay the prior fresh4,298 compiler/CLI70/server21/editor18 results.
- Root host runs fresh:251files/5,230pass.
- Serialized VICE:2files fail,132pass,1existing skipped;2tests fail,2,401pass,4existing skipped.
- Safe-return3/3, canonical-fallback21/21 and new assignment16/16 pass inside the complete gate.
- All42 guarded inputs and current oracle hashes remain unchanged.

| Unchanged failing file | Exact observation | SHA-256, equal to `ec8a696e` |
| --- | --- | --- |
| `test/rd08/nmi-boolean-mask-materialization-vice.spec.test.ts:243` | Mask-three case stackedPC59,953(`$EA31`) is not below main end2,504 | `194633b90b78c375dfb4ae9003ecddf29a30a1def743f8ae178fbb842f4a20ab` |
| `test/rd08/nmi-bounded-retention-vice.spec.test.ts:266` | Retained-five-samples case stackedPC63,133(`$F69D`) is not below main end2,532 | `8222e4336695f7c3a9bc4f204b160abd1da7bc12ba6d286bffc29fa94a685c1a` |

Failed complete-log SHA-256:
`6ff2564af74f89fec861abe3360d960ac0421d7d8f5f298e8a10cbf0221f936c`.
No isolated pass, review agreement or prior GREEN erases this failed gate.

## Bounded next probes

Trace the exact source-programmed CIA2 Timer A acceptance, entry/status/stack and preserved stock
IRQ route. Determine whether this unit selects any values in these source/handler bodies.
Do not infer cause merely from firmware-looking addresses or an isolated subsequent pass.
Independent platform diagnosis `ses_e0fae6294ffe2HBRLUg8OMS5f9` is read-only and runs no emulator.
The primary owns sequential observation and captures raw values without changing the oracles.

No general IRQ redesign, test weakening, helper/timeout change or widened oracle authority is
authorized. AR-P2 owns any eventual user decision in the execution plan. Evidence remains
VICE-bounded and physical-hardware-unverified.

## Baseline/current emitted-program comparison — verified complete

The primary builds the isolated `ec8a696e` compiler from 557 regular source/configuration/library
files, then builds each unchanged `Game` fixture through both public compilers using identical
`optimization: "none"` options. All three complete PRGs compare byte-for-byte equal.

| Fixture | PRG bytes | Shared baseline/current SHA-256 |
| --- | --- | --- |
| Mask three | 881 | `4deb2398a9900757a67372bfe39e7c262794eb5890041e5d8d95005364b8420b` |
| Five-sample retention | 956 | `6d9165c13fd3d16508954068964707c4888b17a17087ec75d5385f59e277d50d` |
| Mask-eight inverse | 883 | `9660ba4e76ad1c6151451af5b388ea033c834f31a901260e47d99451d9f1076f` |

**Fact:** this unit introduces no emitted-program difference for those fixtures.
This is not proof that their pre-existing programs or tests are correct. The failed gate did not
retain its exact generated images, so these are fresh reconstructions, not recovered failed-run
artifacts.

A separate current selector probe, with the module normalized to `Main` for an existing overlay
project, reports two reachable functions and empty default/opt-in selections in both main and
handler for all three cases. The exact-`Game` assembled comparisons above are the stronger direct
output evidence; the normalized overlay is supporting impact evidence only.

## Fixed observations — verified partial

The first nine observations finish in 12.247s. One fixed additional batch of 36 observations
finishes in 45.679s. Both use unchanged fixture source, the existing compiled monitor and
20-second waits. Extra route checkpoints and diagnostic tracing mean these are observations,
not executions of the frozen specification tests.

| Additional batch fixture | Saved immediate return PCs | Observed handler result |
| --- | --- | --- |
| Mask three, 12 runs | `$09C5` nine times; `$0999` three times | Global `[1]` |
| Retention, 12 runs | `$09E1` ten times; `$09B5` twice | Flags `[1,0]`; samples `$11,$22,$33,$44,$55` |
| Mask-eight inverse, 12 runs | `$09C5` ten times; `$0999` twice | Global `[1]` |

Across all 45 observations:

- Main entry has I=0. The NMI-pushed status is `$22`, with the prior I bit clear.
- Observed route is `$FE43` then generated handler `$0A47`. No `$FF48`/`$EA31` IRQ ingress or
  firmware saved PC is captured.
- A/X/Y, exact post-RTI SP and all non-representation status bits restore at the saved PC.
- Exactly one handler ICR read is observed; published values and retention samples are correct.
- Final BASIC handback restores expected SP and I/D; the probe also records vectors and ports.
- All 42 checkpoint inputs, seven current oracle/fixture hashes and two unchanged NMI test
  hashes remain unchanged after the observations.

**Unknown:** these samples do not reproduce or establish the route/stack mechanism of the
original `$EA31`/`$F69D` failures. They do not prove nested-IRQ restoration, every frozen
device/vector/control assertion, external aggregate stack, firmware completion or a deadline.
Do not continue sampling until a desired outcome appears.

## Stock IRQ premise — finding remains open

Independent platform diagnosis identifies **TP-001 (major)**: the two main-range assertions lack
an IRQ-exclusion premise. The fixtures preserve enabled stock IRQ service. NMI may legally
interrupt its execution, and its immediate CPU frame then identifies that context rather than
main. This source-level premise gap is established; applying that explanation to the two
particular failures remains an inference, not an observed route.

The attested pinned ROM bytes recorded by the probe are consistent with that inference:

| Address | Recorded leading bytes | Meaning at that address |
| --- | --- | --- |
| `$EA31` | `20 EA FF` | `JSR $FFEA`, stock service |
| `$F69D` | `E6 A2` | `INC $A2`, jiffy-clock update |
| `$FE43` | `78 6C 18 03` | `SEI; JMP ($0318)` NMI stub |
| `$FF48` | `48 8A 48 98 48 BA` | IRQ register-save prefix |

Firmware-looking addresses and ROM decoding alone do not authenticate the failed runs' stack.
The platform reviewer receives the raw observations and comparison records before any exact
oracle recommendation. No compiler change, IRQ masking, source change, timeout change, blanket
ROM allowance or full-gate retry is authorized.

## Raw evidence and lineage

Owned root:
`/tmp/opencode/codeops/runtime-008dc7dd-b8e9-44f8-b007-488e536fa932/issue168-arithmetic-5jvUID/`.

| Record under that root | SHA-256 |
| --- | --- |
| `nmi-baseline-byte-comparison.json` | `0a2655105fce7b6f99c891558030de7bc295186023d4ba0fc2b964375198617b` |
| `nmi-selector-impact.json` | `b2e28497c2c406d1bb925635755549dbcaaba313e99b4faf6a198b7ce3975da1` |
| `nmi-probe-observations.json` | `226c465a03bc1edd948cf2dffba4da296d703320c6f94f2d2df241e63b7e3591` |
| `nmi-probe-observations-36.json` | `22f05c17ea8b8ae4ee43fe57e38e4a7e587d0a089e2747dd2dcae8f69b27ad38` |
| `nmi-probe-36.log` | `38af1248cc3aaa51e2e77e3a609970c87ea334c8e35e124e9ca53ee0a9ea5d18` |

Retain this owned tree while AR-P2 is open: it contains the failed complete log, original freezes,
raw observations and isolated baseline needed for the pending decision. It is not a completed
task's abandoned scratch. Eventual cleanup must not follow the baseline `node_modules` symlink
into repository dependencies.

Context: NMOS 6510, PAL/VIC 6569, SID 6581, cooperative KERNAL PRG, KERNAL 901227-03,
ACME 0.97 / VICE 3.10; original sources and canonical `none` unchanged.
Knowledge: `skillVersion=2.0.4`, active qualified/frozen,
content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`;
`sfa-and-abi.md#interrupt-route-completion-gate`,
`c64-memory-and-runtime.md#interrupt-entry-and-exit-contracts`,
`c64-hardware.md#cia-register-effects-and-ownership`.
Source keys: `BLEND65-SPEC-4-038b70e9`, `MOS-PGM-1976`, `CBM-C64-KERNAL-03`,
`CBM-C64-PRG-1982`, `MOS-6526-1981`.
Status of the original failure mechanism: **Unknown**.
Observed runtime endpoint: **VICE-verified / hardware-unverified**.

## Independent follow-up and reserved decision

The existing platform reviewer attempts direct reads of six allowlisted raw records, but native
`external_directory` permission denies them. It does not retry through another tool or agent.
Its follow-up therefore assesses the primary-supplied summary, not independently authenticated
raw records. The earlier direct repository inspection supports TP-001; follow-up agreement does
not add independent raw-runtime proof. No additional raw access is sought to bypass the denial.

The reviewer retains TP-001 and recommends stopping passive sampling. Its recommended amendment
is justified by the missing IRQ-exclusion premise, not a claim that the original failures have
been explained. No new finding or oracle-edit authority follows.

**Recommended user-owned AR-P2 scope, not yet approved:**

| Scope | Required boundary |
| --- | --- |
| Two existing NMI test files only | Replace the immediate-main-only premise with observed entry and validated actual continuation. No compiler, original source fixture, shared monitor/helper, IRQ-mask or wait change. |
| Main continuation | Require a valid instruction boundary in actual main bytes. |
| IRQ continuation | Require a positively observed stock IRQ activation, exact associated CPU frame and any live JSR links on the pinned ROM path. ROM-range membership or a plausible deeper main address alone is insufficient. |
| NMI completion | Stop at captured continuation after actual RTI; require exact A/X/Y, SP+3 modulo 256 and restored non-representation P bits, including I/D. |
| Outer IRQ completion | Trace the same activation through restoration and its captured main continuation; validate outer frame/register/status/stack restoration. |
| Existing oracles | Retain all values/samples, MMIO order/count, one consuming handler ICR read, vectors, timer controls, ports, BASIC return and original 20-second waits. Bound the complete observation sequence; do not renew waits without a total bound. |
| Separate temporary qualification witness | Explicitly authorize controlled CIA interrupt timing only in an isolated diagnostic witness to exercise nested IRQ/NMI completion and reject mismatched frame/route/return cases. Never change the production fixtures' interrupt behavior. |

An unexercised permissive IRQ branch is not qualified. The temporary deterministic witness and
its controlled interrupt timing are a separate approval item within this proposed scope, not
implied by earlier observational authority. Do not implement the amendment, run that witness,
or repeat the complete gate before the user decides. After any approval, finalize the bounded
observer design and independent oracle/negative-case verification before implementation;
stop again for a material scope change.

Confidence is high in the source-level premise gap. The original failure mechanism and nested
runtime route remain Unknown. AR-P1 stays limited to the accounting expression.

## AR-P2 approval and execution entry

The user says “ok, let's go” after the exact observer/witness proposal and status recommendation.
Both proposed parts above are now approved, with all stated exclusions unchanged. The earlier
unapproved statements remain chronological records, not current authority. Approval does not
make TP-001 resolved or the failed full gate green.

Independent design challenge `ses_e0f8b1452ffe9B8njg7isj5PzY` checks the smallest observer on the
existing monitor interface before edits. The next evidence must be an exercised exact nested
continuation and rejection controls, not more passive samples. Independent amended-oracle
authoring/review remains separate from compiler implementation. No new shared decoder, harness,
test file, source fixture, dependency or production interrupt control is authorized.

### Controlled overlap witness — meaningful counterexample before amendment

The approved isolated witness runs once per unchanged fixture PRG, with controlled CIA timing
only in that temporary execution. All three runs complete in 3.407s and observe
`$FF48→$EA31→$F69B`, then genuine NMI `$FE43→$0A47`. Each NMI saved PC is `$F69F`.
The old main-only assertion would reject these valid runs before any permanent oracle edit.

| Boundary | Direct observation in all three runs |
| --- | --- |
| IRQ acceptance | SP `$F3`, saved P `$22`, continuation in main `$0999` or `$09B5` |
| Stock dispatch / call | CINV SP=IRQ-SP−3; UDTIM entry SP=IRQ-SP−5 |
| NMI acceptance | SP `$EB`, saved P `$A4`, continuation `$F69F` |
| Stack beneath NMI frame | Live JSR link `[33,EA]`, saved `[Y=$37,X=$2F,A=$00]`, unchanged outer IRQ frame |
| NMI RTI | Actual continuation reached with exact A/X/Y, SP+3 and restored P excluding representation bits |
| IRQ RTI | Actual `$EA86` endpoint reached with registers/SP and CPU frame equal to captured IRQ entry |
| Main / BASIC | Captured main continuation restores A/X/Y/SP/P; flags/samples correct; BASIC SP and I/D correct |

This proves the controlled counterexample and nested completion, not the exact original
`$EA31`/`$F69D` failure mechanism or the future amended observer. Negative challenges must
exercise that actual observer rather than only the witness assertions.
Raw `nmi-overlap-witness.json` SHA-256:
`c3d3dbe6a28d7c3644be7235aece4db96d60675c37e2367e77345c85fe106fd1`.
All original guarded inputs and both NMI test hashes still match.

The first independent acceptance author `ses_e0f881d2fffe5DUHmU0xHcW3JY` reports incidental
historical-case exposure during its mandatory routing read. It makes no edits; its matrix is not
decisive independent evidence. A fresh context must restrict that read to the normative routing
range before authoring the approved amendment.

### Partial-save witnesses and bounded design

Two further fixed isolated timing witnesses interrupt IRQ during its partial register save
and partial restore, respectively:

| Timing point | Observed NMI saved PC | Result |
| --- | --- | --- |
| IRQ prologue | `$FF4A`, with only saved A live | Both RTIs restore exact inner/outer state; correct result and BASIC handback, 1.272s |
| IRQ restore tail | `$EA82`, after saved Y has been popped | Both RTIs restore exact inner/outer state; correct result and BASIC handback, 1.278s |

These runs establish why a simple active-IRQ Boolean or fixed full-save offset is insufficient.
They remain independent diagnostic observations, not qualification of an amended observer.

The independent design challenger concludes the complete reachable pinned stock-ROM stack
surface is small: four JSR sites, four RTS sites, IRQ and keyboard PHA/PLA sites, and the outer
RTI. A fixed instruction-boundary/stack-event table with pending before/after transitions can
cover it without a general decoder or walker. Live hardware/CINV/keyboard-dispatch vectors must
be attested; initialization history alone is insufficient. No partial-prefix-only completion is
accepted.

Fresh author `ses_e0f7b74b5ffegNJ9q08j2XjiqB` independently derives acceptance/negative cases
without forbidden exposure and now owns only the two exact approved oracle amendments.
Its input is the machine contract, allowed existing oracle/interface bodies and pinned ROM
bytes, not compiler implementation. The primary retains execution and controlled/negative
witness ownership; reviewers remain separate.

### Original oracle condition — actual controlled RED

The primary runs temporary copies of the original `ec8a696e` NMI test bodies with only isolated
CIA-timing controls inserted. All three existing cases actually fail at the original main-range
assertion with saved PC 63,135 (`$F69F`), in 9.420s. This executes the original assertion rather
than merely labeling a counterfactual. Original production files/source/compiler/helpers are
unchanged by this command.

An earlier temporary-config attempt fails module resolution before test discovery; it is setup
failure, not meaningful RED. Adding the explicit public `@blend65/compiler/frontend` alias to
the temporary config fixes that adapter issue; no repository configuration changes.

The fresh author also encounters native denial reading external workflow standards. No external
read is retried. The parent supplies already-read non-secret standards as conversation guidance,
as permitted by the dispatch contract; this is parent-authenticated policy, not an independent
filesystem read. Native access limits remain unchanged.

### Dispatch-boundary witness

A fixed isolated dispatch-timing witness saves NMI PC `$EA31`, one of the addresses seen in
the original failed gate, with the exact full-save/no-JSR stack layout. Both RTIs, main result
and BASIC handback restore correctly in 1.235s. This directly demonstrates a valid interruption
at that address; it does not recover the original failed run's raw frame.

A separately fixed zero-latch clock-entry witness still saves `$F69F` and completes correctly
in 1.223s. It does not reproduce `$F69D`; no further timing search is scheduled.

| Owned evidence | SHA-256 |
| --- | --- |
| `controlled-old-oracle-red-after-alias-setup.log` | `e9db0dc3b22b7452afabb4d1dc3f9a994407c3bc24b195407c41f2593e2fa5e7` |
| `nmi-overlap-witness-prologue.json` | `b7344e12734ab310b9b6a101bfc4f3582c2662f688e3b534c6f017a2165cb315` |
| `nmi-overlap-witness-tail.json` | `d778bf93fc7935f1ed3805e0064ce86c1bbe545b5125866caa4b53e1665b69d4` |
| `nmi-overlap-witness-dispatch.json` | `7487d9fa953f92dd1f43a64f436cf9ac971a2d1f23c1da78509aa54edf04a012` |
| `nmi-overlap-witness-call-early.json` | `80e18c4f5bc6900499a2c584c679ea1826f8c455a08ac3dfbd22dc9b2c3e1947` |

### Amended observer — authored, pre-freeze verification

The fresh independent author adds the same local fixed-ROM observer to both approved files,
with no compiler/helper/source edits. Files remain 659/695 lines. The actual per-test timeout
is 120 seconds in both original files and remains unchanged; 180 seconds is only the root
runner default, not an authorized increase. The observer bounds its added stops/IRQ activations
and total elapsed observation while retaining each 20-second wait.

Pre-freeze setup checks catch two transcription omissions before semantic/runtime acceptance:
official LDA-immediate `$A9` is missing from the narrow width adapter, and one fixed branch
entry is mistyped. The author adds `$A9` with width two, and replaces the erroneous
`$EA4B→$EA5E` pair with the attested `$EA49: B0 11 → $EA5C` branch. Byte attestation,
all branch-closure checks and every semantic obligation remain intact. These are adapter fixes,
not permission to alter a frozen behavioral expectation.

Root strict typing and formatting pass. An additional exact-optional root typing attempt hits
the previously documented unchanged `vice-runtime.ts:335` optional-field diagnostic; it does
not authorize a shared-helper edit. Compiler package strict/exact-optional checks stay required.
The normal and controlled positive/negative runs remain pending, as do the three independent
amendment reviews. No full retry or successful amended-oracle claim follows the setup checks.

## Qualified amendment and one fix re-review

After the author fixes the transcription and same-activation defects, current normal cases pass
3/3 in10.900s; root strict and formatting pass. No compiler or shared-helper edit is made.
The actual observer code is copied verbatim into temporary witnesses, with only import relocation
and a separate runtime-control wrapper. Its four controlled timing modes each pass all three
original cases:12 real-runtime passes in37.400s total.

| Deliberate witness fault | Applied location | Expected result |
| --- | --- | --- |
| NMI PC changed to an operand byte `$F6A0` | NMI entry frame |3 rejections |
| JSR link changed from `[33,EA]` to `[34,EA]` | Live nested stack |3 rejections |
| CINV changed to `$EA32` | Before stock dispatch |3 rejections |
| NMI return status byte changed | Before inner RTI |3 rejections |
| Outer IRQ frame continuation changed | Before outer RTI |3 rejections |
| Observed restored A changed | Actual inner continuation |3 rejections |

All18 fault injections are positively logged and rejected in54.741s total. None substitutes a
timeout, hidden-stop exhaustion, unhandled error or failed setup for the intended rejection.
These subprocess exits1 are expected fault-witness results, not failures of normal source tests.

The focused external-monitor protocol replay compares actual pre/post-fix observer bodies:
before SF-001 repair, one intended already-observed `$FF48` case fails while five controls pass;
after repair all six pass. Cases cover already-observed entry, unobserved candidate entry and
post-outer-RTI/pre-main entry, plus corrupted A/SP/D variants. The first draft replay omits an
armed `$EA61` return-site checkpoint; correcting that temporary queue yields the clean
one-failure/five-control discrimination. No actual oracle condition is weakened.
Replay proves bookkeeping only; selected-CPU/VICE reachability of the precise pre-PHA event
remains Unknown.

Correctness, platform and SFA/ABI each perform their single fix re-review and return no findings.
Both original files are reconstructed byte-for-byte by reversing only the approved added observer,
constructor, three wait adaptations, return-PC expression and close call. Thus the exception
contains no unrelated old source/assertion/wait change. Both common observer blocks are identical.

| Qualified identity | SHA-256 |
| --- | --- |
| Boolean-mask test,663 lines | `2c6bec49b6d18bb6c549bf2eb1bfecad3f0efb1d8551d974330543079adc3018` |
| Retention test,699 lines | `3a8a9704fb04c5e3a7bd903898e5c562967dbef83fd80866fbd5f7ed310151a9` |
| Identical observer block | `1f2b7406e2517ac65f4b6e83ea811663cf9e59f461e8ec28ce79fee01fbcf63e` |
| Controlled qualification record | `12db077edc56ef126503ecfaf8afd01a32755782a5d9c084175e78f8556c8b40` |
| Pre-fix protocol replay log | `9751b64dd680f3e705032ceac4db5f2dc6c7362459b876719d398996c1c187b5` |
| Post-fix protocol replay log | `fd22cdb2f80d5b6cf13a747e552a6c5d36c674860b23f014cbdfbf5e56426e60` |
| Nine-file oracle freeze after AR-P2 | `8d2ebd09eac06cffdc9ae3fdb148873ba55f9ed40e22bd6b8a751a69921be450` |
|44-input complete checkpoint manifest | `632ef3ca367fb51b158907204ffec236083a2a0c0fbaab4ba7ebf754c6d8dbc5` |

The original42 inputs and seven original consumed frozen files remain unchanged. The two
approved observers are now frozen. Original freezes and the failed full log remain historical
evidence. No source or oracle edits follow qualification. One complete invocation is now
authorized by the resolved correction, with final prechecks first and no automatic retry.

## Complete gate after correction — GREEN

The actual complete checkpoint `sh_1f0ca5405001VwYtT4PvOtS3t5` completes 2026-11-19:
`yarn test:full` exits0 in4,428.818s. Fresh host5,230 and serialized VICE2,403 pass, with the
same four existing VICE skips. Workspace tasks replay previously verified results. Final
prechecks pass and all44 guarded inputs remain unchanged. No timeout/helper/source change or
further oracle edit follows qualification.

| Final evidence | SHA-256 |
| --- | --- |
| `complete-after-ar-p2.log` | `cc44d2615abfec1ff21f456009319534527034b58f0cb31129076b7197b6347e` |
| `complete-after-ar-p2-results.json` | `f2b3452df463e17f32e4031cf02ece7730541eed330c3e000eca718a9d3c9f37` |

TP-001's invalid main-only premise is corrected under exact user authority. The branch-table
transcription and SF-001 bookkeeping defects are fixed and re-reviewed, not waived. The whole
checkpoint now qualifies the bounded compiler unit. The original `$F69D` failed run is not
reconstructed and no blanket ROM, external stack/deadline or physical-hardware claim is made.

GREEN implementation is committed locally as `9bbc9ead`. After rechecking all44 inputs and
the clean worktree, the owned temporary tree was removed; its baseline `node_modules` symlink
was unlinked without following it. Repository dependencies and other runtime files were
untouched. The raw failed/GREEN logs, manifests and witnesses no longer exist; the committed
summaries and hashes above are the durable historical record.
#168 remains open; this6/6 closeout does not establish whole-program parity or whole-frame timing.
