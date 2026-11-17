# Anonymous byte-write forwarding — verification

> **Production baseline**: `4e116829`; plan checkpoint `27ebf448`.
> **Status**: 6/6 verified; TP-002 dependency7/7. Complete checkpoint GREEN; bounded unit complete, #168 parity/timing remains open.

The sections below are chronological. Freeze and initial RED remain historical evidence; current
runtime/cost/review/checkpoint sections own the latest bounded status.

## Independent author and pre-freeze validation

The implementation-blind author consumed only approved requirements, allowed pure types and
signature/fixture excerpts. It reports no forbidden exposure. The primary validated the supplied
IRQ, initializer, address-escape, raw-window and routing-write source adapters through real
frontend/semantic/closure stages; all six complete. These checks establish legal fixtures, not
selection expectations.

The initial selector specification expanded to 509 lines after formatting. Before freeze, the
author partitioned all **58 cases unchanged** into **31 positive/shape** and **27 usage/observer**
cases, 203 and 213 lines. Primary mechanically extracted the author's real fixture and typed
mutations. The author confirmed a setup correction: retain the original candidate ID while a
negative mutation removes adjacency or changes the operator, rather than rediscovering that ID
from the intentionally invalid shape. No expected selection or assertion changed. The independent
fit recheck clears the small local fixture, not a shared test framework. Both root files retain
their original hashes.

## Frozen specifications and local fixture

| File                                                                        | SHA-256                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/compiler/src/machine/byte-write-forwarding.spec.test.ts`          | `52064aa4e6c81b0140e86bffce7e3026a5e49cb56a4ea94f1496fa5a18465954` |
| `packages/compiler/src/machine/byte-write-forwarding-barriers.spec.test.ts` | `7efcfc79e099b4ab1965c5a15dd550d79de7f2f355848fbcbe238e1b7fdd6319` |
| `packages/compiler/src/machine/byte-write-forwarding-test-support.ts`       | `008b344cd48de3ce46e96e25b9530183fa4bbfaafe5d157b8454be3a7c739e43` |
| `test/rd05/byte-write-forwarding.spec.test.ts`                              | `649dfa89f18ad4cef991c550be387aa94aa6f13b3dab497117e0bb3de39fcae2` |
| `test/rd05/byte-write-forwarding-vice.spec.test.ts`                         | `0e9b9c91e0838aec509f3e7538db1b0d841b1b0c4ead8689d32a9af9c9a8c2a8` |

The VICE file's original freeze was
`7b71bff50e5da06dc54747e1ee99bf2f02cac17b3da46938d26c25872ba26873`; only the exact user-approved
TP-001 adapter correction changes it to the active hash above. All original assertions remain.
No further oracle or fixture edit is authorized. The separate teardown's three exact exceptions
do not grant authority over these files.

The public assembly/cost file's original freeze was
`b5a9560acb4433dbcb8282dc5e4fa140dd7e3c3d52a17cf37806790b553399e1`. Under the separate startup
dependency, the user explicitly approved only its `code.startup.entry` extent `328→326` on
2026-11-17; the active hash above binds that exact change. The dependency records the separate
old startup-canary exception and unchanged new `$A7` regression freezes. Neither approval weakens
source semantics or grants any further oracle edit. Parent baseline costs below remain historical
until freshly remeasured after startup implementation.

## Actual meaningful RED and independent behavior baseline

| Executed command                                                                                                    | Result before production implementation                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn vitest run --config vitest.integration.config.ts test/rd05/byte-write-forwarding.spec.test.ts --reporter=dot` | Seven meaningful assembly failures, 15 accepted-source controls pass. Existing public builds succeed; failures observe the real anonymous `STA H; LDA H` pair rather than direct CLC/ADC/STA. Not setup/import RED.    |
| `yarn vitest run --config vitest.vice.config.ts test/rd05/byte-write-forwarding-vice.spec.test.ts --reporter=dot`   | One case passes all 257 ordered byte values, A, N/V/D/Z/C, SP and interrupt-mask checks. Exact post-store PC sampler works on the existing code. 1.895 s test time; PAL/6581, VICE-verified / hardware-unverified.     |
| Compiler selector specifications                                                                                    | 58 frozen cases await the new module. Its absence is a collection failure and is not counted as meaningful RED. The actual public output failures above establish the missing lowering behavior before implementation. |
| Targeted formatting                                                                                                 | Four specifications and the local fixture pass.                                                                                                                                                                        |

Owned logs:
`/tmp/opencode/codeops/runtime-91b62a9d-8e6b-4802-bbb4-e3736b245244/issue168-byte-write-g0j9wbwv/`.
Retain until persistent results and this unit's checkpoint, then remove only this run's files.
No future byte/storage saving, full new checkpoint, whole-frame timing or parity is claimed.

## Initial implementation GREEN and fresh costs

Both frozen selector files pass **58/58**; the public assembly/cost specification passes **22/22**.
Compiler reference build passes. The subsequent serialized VICE command runs the new independent
257-write byte/flags case and all five unchanged startup/source-trace/frame comparisons:
**4 files / 6 passed tests**, 66.62 s. This is bounded PAL/6581 runtime proof, not four-profile
runtime or physical qualification.

| Complete measured component                    | Before     | Current   |
| ---------------------------------------------- | ---------- | --------- |
| Code                                           | 1,309      | 1,243     |
| Immutable asset / BASIC stub                   | 1,024 / 12 | Unchanged |
| Padding                                        | 4,822      | 4,888     |
| Loaded payload                                 | 7,167      | 7,167     |
| Distinct CPU16 SFA bytes                       | 55         | 45        |
| Resident RAM                                   | 7,271      | 7,261     |
| Entry / snapshot bytes                         | 328 / 49   | Unchanged |
| ZP / bounded reported hardware stack / scratch | 0 / 1 / 0  | Unchanged |

Current CPU16 SFA union is `[9265,9310)`; resident 7,261 equals payload 7,167 + snapshot 49 +
SFA 45. This is not an external firmware/NMI aggregate stack or reentrancy bound.

Primary compared retained baseline generation `8695ce70-b928-48d4-a161-cbfa3e6b3cfe` (1,309)
with current `dc64589c-bbc3-49bd-8c8b-faaea8ecae3a` (1,243). Ten direct cores cover the four
vertical offsets and six pointer additions of 1/2/3, all in the same approved class. Assembly
counts decrease by ten absolute LDA, ten absolute STA and two absolute JMP; total conditional
branch count is unchanged and long-branch pairs shrink seven→five. Thus 60 bytes come from
the intended anonymous pairs and six from existing branch repair. The repaired 442-byte twin
leaves an **801-byte** code gap. Local pair removal saves eight nominal cycles when executed;
no frequency-based or whole-frame cycle saving is inferred.

The existing implementation cost pin alone now changes 1,309→1,243. All 72 directed public,
unchanged poll/publication/teardown and measured-cost checks pass. Nine directed compiler files
pass 151/151, including 58 frozen selector cases and seven new implementation controls: original
identity, malformed graphs, a 6,000-block chain, 256 candidates and pre-closure demand absence.
These tests do not instrument certificate-call count or prove global host scaling; static review
owns that cost model. Independent phase reviews and a new full checkpoint remain. The earlier
pre-implementation checks remain historical; no frozen test or local fixture changed.

## Integrity and current checkpoint preparation

Primary raw comparison against the five frozen hashes reports MATCH for every specification and
the local fixture. The tracked existing-specification diff against `27ebf448` is empty. Existing
production diff is exactly the selector import/forwarding-set union; existing implementation pin
diff is only 1,309→1,243. The new selector, fixture, four specifications and implementation-control
file are declared additive paths, not omitted from phase review.

The install/global-build/typecheck/changed+host chain exited zero at every step. Changed+host
passes **248 root files / 5,183 tests**, 639.58 s; install is up to date, build has four successful
tasks and typecheck seven. All six independent phase lenses are clear; see [findings](05-findings.md).
The actual `yarn test:full` has exited one. It includes complete workspace tests and root host
checks before serialized VICE; no duplicate outer `yarn test` was launched. Compiler passes
**248 files / 4,111 tests**, with two existing skipped tests; root host passes **248 / 5,183**.
Serialized VICE reports **130 passed files / 2,379 passed tests**, one failed file/test and existing
one-file/four-test skips. The VICE tier ran 4,420.23 s. This is a failed complete gate regardless
of earlier directed passes; no implementation commit or bounded closeout is authorized by it.

The sole failure is `byte-write-forwarding-vice.spec.test.ts:98`: at ordinal 252 the monitor stop
PC is 65,352 (`$FF48`), not the asserted 2,403 (`$0963`, store + 3). This assertion runs before
that sample's value/flags/SP/I checks, so those observations are absent for the failing sample.
Subsequent direct probes and independent review classify TP-001 below as an observation defect;
they do not prove the compiler globally correct or reconstruct the missing original sample state.
All frozen assertions remain unchanged. Retain `full-checkpoint.log`; an isolated passing rerun
cannot replace a green complete checkpoint. The read-only helper still counts 5/6 verified; its
nonzero exit is the documented mini-plan index limitation, separate from this real test failure.

## Current assembled excerpt endpoint

Primary rebuilt canonical PAL/6581 `none` in an owned temporary project and read the exact PRG
returned by the service, not a guessed filename. Scans were bounded to public CPU16 code
intervals; all ten expected cores and the sole poll were found. The fixture was removed after
extraction. Independent machine review decoded these supplied raw bytes, not an independently
executed build or all 1,243 code bytes.

| Actual core starts | Actual nine-byte sequence    |
| ------------------ | ---------------------------- |
| `$0A12`, `$0B85`   | `AD 55 24 18 69 15 8D 05 D0` |
| `$0A1B`, `$0B8E`   | `AD 55 24 18 69 15 8D 07 D0` |
| `$0A76`, `$0C60`   | `AD 5D 24 18 69 01 8D F9 07` |
| `$0A7F`, `$0C69`   | `AD 5D 24 18 69 02 8D FA 07` |
| `$0A88`, `$0C72`   | `AD 5D 24 18 69 03 8D FB 07` |

Each is `LDA absolute; CLC; ADC immediate; STA absolute`, nine bytes / twelve nominal cycles,
meeting the equivalent expert local idiom with identical A/flags/effects. Poll `$0A96` is
`AD 12 D0 49 FB D0 F9`, same-page back edge: seven bytes, nine nominal taken/eight exiting cycles.
Fresh PRG payload and resource vector reproduce 7,167 and resident 7,261. The previously named
generation paths were unavailable to machine review; primary later encountered a missing baseline
build sidecar too. The earlier captured histogram/cost comparison remains primary historical
evidence, not an independently inspected baseline PRG.
No payload win, whole-frame deadline or whole-program parity follows.

## Scoped deferral-expiry assessment — pending full checkpoint

**Did this unit's deliverables expire any deferral's stated rationale?** The bounded arithmetic
producer/raw-write handoff and its anonymous retention gap are implemented and independently
reviewed. The missing-handoff rationale may close only when the current full checkpoint passes.
No broader observer theorem or accepted program class has been introduced.

| Register / boundary examined             | Assessment and continuing owner                                                                                                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| This mini-plan and preflight             | No open ambiguity or finding and no oracle exception. Pre-freeze fixture/split clarifications add no deferred behavior or future landing place.                                                                                      |
| Publication-proof AR-1–AR-10 / AR-P11–12 | The same exact-source, private, main-only, firmware-routing and immutable-publication premises remain mandatory. Wider observer/interval/interprocedural analysis stays outside approval, not silently deferred into this unit.      |
| RD-08 “Won't Have”; AR-045               | No new optional `none` search, mode, public rule/analysis API, framework, runtime, language syntax or gameplay policy. The policy boundary has not expired.                                                                          |
| AR-011 incremental compilation           | No new measured rebuild-latency premise or need for persistent infrastructure. The fixed extra proof query is reviewed as an explicit cost, not a cache requirement.                                                                 |
| Frozen FUT-006/007/011/012/015/016       | No label/range syntax, object-link ABI, copy recognition, native image conversion or stack-free calling change. Removing anonymous demands is ordinary SFA closure, not a new storage model.                                         |
| FUT-017/018                              | No cross-statement scheduling or relaxed PEEK/POKE volatility. The removed stores/reloads are compiler-private, never source intrinsics; no new volatile API is justified.                                                           |
| Parent #168                              | The 801-byte code gap, repeated arithmetic/reload and live-entry/allocation opportunities, and equivalent whole-frame timing remain due under #168. Local expert-idiom parity is not whole-program success or an untracked deferral. |

No frozen requirement/specification, expressiveness ledger or unrelated backlog owner is changed.
The final task stays unverified until the actual complete result; no next-slice plan, tests or
implementation enter this checkpoint. A future need for wider observations or material support
must return through its own authority and preflight gates.

## TP-001 — controlled observation-boundary diagnosis

The completed full log remains `full-checkpoint.log`. The original oracle is still byte-identical
to its frozen hash. No production or shared-monitor changes were made. Temporary probes import
only existing fixture/runtime APIs and use the same private-counter source, PAL/6581, `none`.

| Direct probe                                                  | Actual outcome / evidence limit                                                                                                                                                                                                                 |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Natural stopping-watch probe                                  | 4,096 ordinary stops match; this does not refute an allowed phase-sensitive failure.                                                                                                                                                            |
| CIA1 one-shot aligned at pre-store execute stop               | Reproduces `$FF48` with A/device 21, SP 243 versus mainline 246, P `$04`; stack `[32,99,9]` encodes saved P `$20` and PC `$0963`. After stock RTI, execute stop `$0963` has A/device 21, SP 246, P `$20`, matching the independent flags and I. |
| Initial candidate with immediate per-sample trace expectation | Diagnostic fails: post-store execute stop arrives before that store's pending trace notification. This was a temporary probe assertion, never a frozen-test change.                                                                             |
| Candidate with final drain, natural timer phase               | 257 exact mainline state samples and 257 trace-counted writes pass. The final pre-next-store drain contributes one pending notification without a 258th write.                                                                                  |
| Same candidate, deliberately aligned CIA1 one-shot IRQ        | The same 257 state samples / 257 writes pass, including the reproduced interrupt phase. Timer manipulation belongs only to this diagnostic, not the proposed frozen fixture edit.                                                               |

The controlled timer probe uses existing side-effectful emulated I/O writes while the CPU is
stopped: stop/load Timer A (`$DC0E=$10`), mask CIA1 sources (`$DC0D=$7F`), write latch 1, enable
Timer A (`$DC0D=$81`), start one-shot (`$DC0E=$19`). It does not disable CPU IRQ, patch generated
code/registers or change source. One early temporary diagnostic had an invalid empty stack-read
range; the temp script was corrected before the successful frame capture. This is not compiler
or oracle verification evidence.

Identity-bound candidate output, from `post-store-execute-identity-probe.log`:

| Mode              | PRG SHA-256                                                        | Samples / writes / final drained events |
| ----------------- | ------------------------------------------------------------------ | --------------------------------------- |
| Natural           | `7b449b2ca97126517712710a8cd1badaf03d0ed471b7eca8e2d5de2906056293` | 257 / 257 / 1                           |
| Aligned stock IRQ | Same exact PRG                                                     | 257 / 257 / 1                           |

Both runs require exact PC `$0963`, device byte/A, independent N/V/D/Z/C, SP and I. Candidate
script SHA-256 is `b93ce1ca748aedd93945365f2f371bbb3ff8e79961da472b09e2455704fdb811`.
The existing-API probe scripts and logs remain in the already-owned temporary directory to
support the pending exact-authority decision; generated probe projects/emulators are cleaned.
This evidence does not constitute an isolated spec pass or a green complete checkpoint.

Independent platform review confirms TP-001 MAJOR and the probe-validated minimum remedy in
[findings](05-findings.md). No additional sampler defect was identified. Its evidence endpoint is
static repository/upstream VICE source plus supplied runtime observations, not independent
execution. The user subsequently approved exactly the named adapter remedy on 2026-11-17.
Only that exception is executable; correction/review, re-freeze and a fresh full gate remain.

## TP-001 corrected specification and distinct directed failure

Primary preserved the exact pre-edit file, and the independent original author applied only the
approved adapter correction. Raw before/after checks preserve every old assertion line and all
source/arithmetic-prefix bytes; the 257 loop remains and exact write count is added. Four other
frozen spec/fixture hashes still match. Correctness and platform fix reviews both report no
findings. The active VICE hash is re-frozen above; no production/shared-helper change occurred.

`tp001-directed-vice.log` records the actual four-file serialized command: **three files pass,
one file fails; five tests pass, one fails**, 67.95 s. The corrected byte-write case passes all
257 states and exact write count, and the old two source-contract/frame cases pass. The compiled
case in unchanged `boing-ball-startup.spec.test.ts:167` fails (`$0001=$06`, expected `$A6`); twin
startup passes. No full retry has started. TP-001 permission does not authorize editing that
startup test or production startup. Diagnose the distinct failure before further verification.

### Distinct startup failure — controlled port evidence

The unchanged startup test hash is
`7662d056defb2ec251b38fb03a9e30df08ab658813a52df774b78125773a6d49`.
A direct probe builds the same public `none` boing source and applies only the test's existing
four-byte SED/JMP bootstrap in verified padding. Bootstrapped PRG SHA-256 is
`a04a22156453f39ef1ec1284132def46adaca5c4933a6624bcf7b0b36d71a8a6`.
The probe changes no repository file and cleans its project/emulator after each run.

| Probe state                                 | Observed transition                                                                                                                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original fixture, natural IRQ phase         | Injected `$0000/$0001=$FF/$A7`; startup write at PC `$0928` has `A5 01 29 F8 09 06 85 01` immediately before it and leaves `$A6`; main `$0955` observes `$A6`.                                                                              |
| Original fixture, aligned CIA1 one-shot 100 | Initial port still `$A7`; captured snapshot has `$A7`. A ROM-region port watch stop at `$EA7B` has A/port `$07`, SP `$F0`, preceding bytes `D0 06 A5 01 29 1F 85 01`. The unchanged startup mask/remap then writes `$06`, observed at main. |
| Candidate input port `$B7`, natural phase   | Startup writes `$B6` and main observes `$B6`; D clears and I remains zero.                                                                                                                                                                  |
| Same candidate, aligned CIA1 IRQ            | ROM-region stop retains A/port `$B7`, then startup writes `$B6`; main observes `$B6`. Nearby ROM bytes alone do not prove which branch executed.                                                                                            |

Both candidate runs additionally check unchanged DDR `$FF`, CIA2 DDRA `$A4`, pull-up bank-zero
pins, D018 `$14`, sprites disabled, binary mode, incoming I retained and IRQ/NMI vectors unchanged.
This is a temporary fixture experiment, not authorization to change the existing startup oracle
or its `$A6` expectation. The original failing run's intermediate register trace is absent.
Independent classification and minimum-remedy review remain pending.

Logs are `startup-port-probe-2.log` and `startup-released-sense-probe.log` in the owned directory.
The latter two-mode candidate script hash is
`6139bd1a15eb57b202247e2f340d9c779176720f853da858338a91d7d87359b4`.
An initial temporary label-parser mismatch was corrected only in that diagnostic before these
runs; it does not represent an oracle or compiler failure. No fresh full run has started.

### Independent challenge disposition

The initial platform proposal was a stable canary only. Independent challenge rejects that as
sufficient: `spec/appendix-c64.md:219–225` explicitly requires captured port/DDR formulas, whereas
`startup.ts:345–377` re-reads hardware. The controlled saved `$A7` / live `$07` witness distinguishes
the required `$A6` compiler write from the emitted `$06`; `$B7` would not distinguish the two.
That confirms TP-002 MAJOR independently of the separate “throughout” interpretation. The DDR
mismatch is statically identified, not runtime-proven by this port-only probe.

Current selector scope expressly excludes startup changes. AR-P1 and the exact separate repair
scope require a user ruling before planning/implementation. All old startup-oracle/specification
bytes remain unchanged; TP-001's specific adapter approval does not extend to them. There is no
new full run, green closeout, implementation commit or automatic push. Retained probe scripts/logs
support this blocked decision; generated projects and emulator processes are cleaned.

On 2026-11-17 the user explicitly approved AR-P1 and a separate bounded specification-first
startup repair. Compiler mapping writes must use captured readbacks; independent stock-firmware
upper-bit changes remain admitted with cooperative IRQ service. `$A7` stays legal. This approval
does not permit frozen specification changes, existing-oracle edits or IRQ redesign. The separate
[startup plan](../startup-captured-port-mapping/99-execution-plan.md) owns that work (0/7,
all five preflight clusters passed after one rendering-only fix), including a prior-to-implementation
gate for exact existing-oracle exceptions. No startup test or implementation has yet been written.
The parent checkpoint remains blocked on that dependency, not on a missing ownership ruling.

## Dependency continuation — current bounded state

The startup dependency is4/7. Independent saved-readback specifications and the bounded repair
pass constructor48, public22 and startup VICE5; wider layout139/integration67/runtime89 and
internal controls18 pass. Exact oracle exceptions are separately approved, reconstructed and
re-frozen, including the one-array constructor erratum and M1 padding consequence. The new runtime
`$A7` oracle is unchanged. Fresh measured boing code1,241/entry326/SFA45/resident7,261/payload7,167
leaves gap799 to the equivalent442-byte twin. Whole-frame timing remains unknown.

The dependency's first changed+host failed18 artifact expectations, preserved as a failed run.
Independent diagnosis finds no code regression; measured implementation snapshots and the exact
user-approved M1 padding scalar now pass all9 affected files/22cases. Its fresh changed+host is
running, with six read-only execution reviews in progress. No new full checkpoint or commit is
claimed. Detailed dependency chronology and active oracle hashes live in its own execution evidence.

Subsequently the dependency reaches6/7: fresh host248/5,183, all six execution reviews including
actual bytes, formatting/authority guards and fresh install/global build/typecheck pass. The one
actual combined full checkpoint now runs as `sh_1e9a14802001MGvhpltD4YSYZ4`, logged in
`captured-startup-full-checkpoint.log` with allowlisted input hashes captured/rechecked. Await its
notification without polling, restart, source/test edits or another emulator. No complete pass or
implementation commit follows until the actual result is green. Nothing is pushed; #168 stays open.

The combined run subsequently exits one: compiler250/4,166pass+2skips and host248/5,183 pass;
serialized VICE130/2,381 pass, two failures and existing skips. Unchanged stack-startup safe-return
times out; a separate frozen generic-fallback spec still pins the old saved-none size/hash. The
dependency owns bounded separate diagnosis and any exact authority request. No oracle/test edit,
retry-until-pass, complete closeout or local implementation commit follows this failed gate.

After separate exact user approval, RV-002's size/hash pair is reconstructed, independently
fix-reviewed and re-frozen. Affected24/24 pass, including the unchanged runtime20-second waits;
original timeout cause remains Unknown and its failure log is retained. Fresh prechecks pass.
One new complete job `sh_1ea2cbd95001Y0xqCtU7bgMUZe` now runs with33 guarded inputs and the
unchanged runtime test/helper/monitor/launcher. Await its notification without polling, restart,
source/test changes or another emulator. Any recurrence stops for diagnosis, never automatic
retry. No actual complete GREEN or local implementation commit yet; #168 remains open.

### Machine-restart recovery — 2026-11-17

The harness reports the latest complete job cancelled by server restart. Its named temporary log
and33-input manifest are absent after reboot; earlier retained temporary evidence is unavailable
too. The dependency's [recovery record](../startup-captured-port-mapping/08-verification.md#machine-restart-recovery--2026-11-17)
preserves this limitation. Historical outcomes remain documented, not recovered raw observations.
There is no recoverable pass or new test failure from the interrupted run.

The user requested continuation. Recorded active freezes match and no emulator is running.
Resume fresh prechecks and one actual complete checkpoint without compiler/source/oracle/helper/
timeout edits. A new failure stops for diagnosis; no retry-until-green or isolated-pass substitute.
Parent5/6 and dependency6/7 remain unchanged. No local implementation commit, push or issue closure.

## Bounded closeout — complete checkpoint GREEN

The dependency's [actual post-restart gate](../startup-captured-port-mapping/08-verification.md#actual-post-restart-complete-checkpoint--green)
now passes. Actual `yarn test:full` exits zero in4,784.128s: normal workspace cache replays
compiler250files/4,166passed/2existing skips and CLI70/server21/editor18; fresh complete host
248files/5,183tests and serialized VICE132files/2,383tests pass, with existing1file/4test VICE
skips. Workspace results are not represented as fresh post-reboot test execution. All40 captured
source/test/boundary/dependency identities remain unchanged and the serialized VICE marker is
present. Fresh formatting/frozen-install/build/typecheck also pass. No compiler, source, helper,
oracle or timeout edit followed the independent execution/fix reviews.

Both the original safe-return test (unchanged20-second waits) and exactly corrected generic-
fallback oracle pass within that complete run. Prior failed gates remain documented and the old
timeout's cause remains Unknown; the cancelled run has no recoverable result. Reboot-cleared
historical temporary files are not claimed to remain available.

| Complete measured component | Qualified current value |
| --- | --- |
| Code / equivalent twin / remaining gap |1,241 /442 /799 bytes |
| Code saving from this unit's1,309 baseline |68 bytes: parent66 plus startup correction2 |
| CPU16 SFA / resident RAM |45 /7,261 bytes; parent baseline55 /7,271 |
| Entry / platform snapshot / ZP / scratch |326 /49 /0 /0 bytes |
| Payload accounting |1,241 code +1,024 assets +4,890 padding +12 BASIC stub =7,167 bytes |
| Compiled PRG SHA-256 | `a078f81092528beff9388204690ff67a207a6082a3b3c84f791385a5cd41ec58` |

The scoped deferral-expiry assessment is reconfirmed: this bounded missing arithmetic-to-write
handoff and TP-002 dependency are delivered, so their missing-implementation rationale ends here.
The original exact-source, observer, main-only, firmware-routing and immutable-publication guards
remain; no wider observer theorem or accepted source class is introduced. RD-08 policy and frozen
FUT-006/007/011/012/015/016/017/018 reasons remain unchanged. No future slice is orphaned.
The earlier801-byte residual is superseded by799, not silently closed.

T-168.21 closes at6/6 and startup at7/7. All six independent reviews for each bounded production
unit are clear; exact exception/fix reviews remain applicable. Final diff/authority/format/link
checks precede their coherent green local commit. No architecture/API change requires a new
techdocs surface; these existing plan/evidence documents record the bounded seam.

This is not #168 completion: repeated arithmetic/reload and allocation opportunities, the799-byte
equal-contract code gap and whole-frame timing remain owned by that issue. Local expert-idiom
parity is not a whole-program win. Physical hardware, unrestricted external IRQ/NMI/firmware
stack/completion and historical whole-program body-binary identity remain unproved.
Status: VICE-verified / hardware-unverified; expert2.0.4/content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`, same governing source keys as the reviews.
No push or issue closure.
