# Captured startup mapping — execution evidence

> **Status**: complete checkpoint GREEN; 7/7 verified. Previous failures and restart-cleared raw evidence remain documented; runtime test unchanged, original timeout cause Unknown.
> **Progress authority**: [execution plan](99-execution-plan.md), currently 7/7 verified.
> **Production lineage**: `27ebf448` plus the declared uncommitted parent selector phase.

## Execution-entry and authority checks

The five independent preflight clusters passed after one rendering-only correction, independently
rechecked. The plan's active preflight binding is
`93510c66335284cc6f339811f860745a9987ab1c6135019e1e6a7ea56e3078c5`.
The user approved bounded captured-value startup repair and the compiler-versus-firmware ownership
ruling. Exact existing-oracle exceptions remain unapproved; T-168.23 stops before implementation.

No clean or green baseline is invented. The Git baseline `27ebf448` has tree
`f76728aeef90f81e5fad917d2c9e28c4140c2c09`. Startup/status/layout still match that baseline
byte-for-byte. The parent's declared selector/caller edits remain uncommitted, and its original
complete gate remains failed despite the subsequently corrected, reviewed and re-frozen sampler.

## Allowlisted starting production bytes

Primary computed these SHA-256 identities before any startup correction. They bind this unit's
review boundary without copying unrelated work or reading the new author's files mid-edit.

| File                                                            | Starting SHA-256                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/compiler/src/layout/startup.ts`                       | `b11a8ed32b9f2adcfd5db260654ff0a39175416cfce04adcfcb28667460412d5` |
| `packages/compiler/src/layout/startup-status.ts`                | `98c7c2505b47b16f9aaecbe28ef2448a0f81d03ff40fcf34cc7620f8b8e28018` |
| `packages/compiler/src/layout/c64-layout.ts`                    | `87c525d85bc3987f83d4844524a64aa52aaac22363305f884c54416199f1822b` |
| Parent `packages/compiler/src/machine/lower-function.ts`        | `39074f70f66a1ec076e7ab318e86d5f9d11549d133178e931bf408bf963b2ece` |
| Parent `packages/compiler/src/machine/byte-write-forwarding.ts` | `3d058d431e5013da4fd24676066d08bb5eb2c64238e841ce709d5fa473f05f23` |

Only `startup.ts` is the planned production modification set. The other rows distinguish unchanged
dependencies and the parent's already-owned work; they are not new implementation permissions.

## Independent author handoff

The author owns only the two new assigned specification files. It may use approved requirements,
pure types and supplied constructor/build/monitor signatures, not startup/status bodies, generated
artifacts, implementation tests or existing oracle bodies. The first handoff response reports no
files written, no execution and no forbidden exposure; its sole missing interface was the public
memory array path.

Primary supplied the minimum schema: `artifacts.memory.intervals` is the top-level array. Select
CPU16 records explicitly; interval ends are exclusive and `size=end-start`. The known state and
entry IDs and unchanged captured-field offsets are fixture-interface constraints, not future
implementation-derived expectations. Authoring has resumed; the primary owns all formatting,
commands, meaningful RED validation and eventual freeze.

No new specification execution, cost improvement, runtime/physical qualification, full checkpoint,
commit or push is claimed here. Parent diagnostic/probe logs remain retained under its named owned
temporary directory until the combined coherent green checkpoint; no new emulator run is active.

The author subsequently delivered exactly the two assigned files: 48 parameterized constructor
cases and three real VICE cases. It reports no execution, missing interfaces or forbidden input
exposure. Expected RED concerns duplicate live reads, the required mapping core and saved-versus-
live port/DDR values. The primary must distinguish meaningful failures from observation-adapter
errors before freezing; all existing-oracle authority stops remain unchanged.

## Actual RED and pre-freeze adapter validation

| Executed command / boundary                                                                                                           | Actual result against unchanged startup                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn workspace @blend65/compiler test src/layout/startup-captured-port.spec.test.ts --reporter=dot`                                  | 32 intended failures / 16 passing controls across four cooperative profiles, returning/omitted restore and call/inline initializers. Failures observe duplicate CPU-port reads and the live-load rather than required transfer-based core.                                                                                                                       |
| Initial three-case VICE run                                                                                                           | The port case observes `$06` versus required `$A6`; the DDR case `$F7` versus `$FF`. All three also expose an invalid new fixture assumption of two held main-call stack bytes. That SP mismatch is not counted as compiler RED.                                                                                                                                 |
| Author's pre-freeze clarification                                                                                                     | Cooperative startup tail-enters this nonreturning main; the existing SYS return link is already live, and no extra main-call frame is owned. The author changes only the new main-SP expectation to exact `caller.sp`, plus a durable comment. All other expectations and all 48 constructor cases are unchanged; no forbidden implementation exposure reported. |
| `yarn vitest run --config vitest.vice.config.ts test/rd05/startup-captured-port-vice.spec.test.ts --reporter=dot` after clarification | Three semantic failures only: compiler write `$06` versus saved-derived `$A6` in both port cases, and `$F7` versus `$FF` in the DDR case. Exact execute points, captured bytes, vectors, D/I, caller registers and corrected stack checks complete without other failures. 13.012 s test time; no collection/setup failure is counted as RED.                    |

The host-unchanged runtime case is not guaranteed to pass the broken compiler: stock firmware may
change the live port after the host's unchanged-value injection. Its second-run port failure is
the same valid saved-versus-live counterexample, not an adapter error or reason to retry until
green. In the first run it reached the main-SP check without a port failure. No claim that an
old-runtime control always passes is made; constructor controls pass 16/16.

No startup production edit occurred between these runs. Runtime is PAL/6581, VICE 3.10 only;
physical hardware and unrestricted external interrupt behavior remain unverified. Logs are
`captured-startup-constructor-red.log`, `captured-startup-vice-red.log` and
`captured-startup-vice-red-validated.log` in the parent's already-owned temporary directory.

## Active new specification freeze

| File                                                              | SHA-256                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/compiler/src/layout/startup-captured-port.spec.test.ts` | `17a5a7b7436915fa06956511f9778a70c9455be24f7bb15b34858da358522852` |
| `test/rd05/startup-captured-port-vice.spec.test.ts`               | `79e7cdaefaaedba7e15d040e60c37a2f58b0dbe0f199fd5c1f22de8c8c241e5e` |

Both files were frozen **before** startup implementation. The constructor's original hash was
`7e8d8b3bfacd325206893b3c208fdb35d83c3057deaf47f4f16ba1e1c4cbaa53`; its active hash above
includes only the later exact user-approved RV-001 array erratum. The VICE file is unchanged.
No further expectation or adapter change is authorized. Formatting expanded them to 323/280 lines, still focused on one constructor
and one runtime provenance concern. No helper/framework or shared test infrastructure was added.

## Exact existing-oracle exception proposal

**Ruling: approved on 2026-11-17.** The user explicitly selected the exact two edits below, with no
broader oracle permission. Primary preserved both original frozen files before changing them.
Application, exact-diff validation and re-freeze precede startup implementation.

| Existing file / original SHA-256                                                                                    | Exact proposed exception                                                                                                                                               | Independent justification                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/rd05/boing-ball-startup.spec.test.ts` / `7662d056defb2ec251b38fb03a9e30df08ab658813a52df774b78125773a6d49`    | Seed CPU-port data `$B7` instead of `$A7` at the existing `$FF` DDR setup; expect exactly `$B6` instead of `$A6`; change only the adjacent sentinel-rationale comment. | High cassette-sense/motor-off keeps the broad canary stable under admitted stock IRQ service. The exact-byte assertion and all other behavior assertions remain. The **new frozen `$A7` regressions** still distinguish saved from live values, so this no longer hides TP-002. No IRQ masking, source restriction or production waiver. |
| `test/rd05/byte-write-forwarding.spec.test.ts` / `b5a9560acb4433dbcb8282dc5e4fa140dd7e3c3d52a17cf37806790b553399e1` | Only `code.startup.entry`'s exact extent pin `328→326`.                                                                                                                | The independent approved capture forms retain the same widths, while two one-byte transfers replace two two-byte live loads. The exact two-byte reduction follows the expert assembly contract, not an observed implementation. All other cost/resource/poll/source assertions remain frozen.                                            |

No actual startup repair cost is claimed yet. If implementation does not meet the independently
required form/extent, fix it or stop; do not revise the pin to match output. The resulting complete
artifact bytes/padding/RAM/timing still require fresh measurement. Existing implementation-test
pins may later be reconciled against actual qualified costs; they are not oracle amendments.
Both newly frozen specification files and every other frozen oracle remain outside this proposed
exception; the distinguishing `$A7` coverage is retained.

## Exact approved exception application and active freezes

Primary preserved both original files under the owned temporary directory and reconstructed each
current file from only the approved replacements. Exact byte equality with that reconstruction
passes; all other lines/assertions are unchanged. Targeted formatting passes. Both newly frozen
specification files retain their exact hashes. This closes T-168.23 before startup code changes.

| Existing oracle                                | Active SHA-256 after exact user-approved exception                 |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `test/rd05/boing-ball-startup.spec.test.ts`    | `12e5a7229e2d73b1e2ef54947c6ee110fd59c55c4b9821796e43e8e4a3ebb8c8` |
| `test/rd05/byte-write-forwarding.spec.test.ts` | `649dfa89f18ad4cef991c550be387aa94aa6f13b3dab497117e0bb3de39fcae2` |

No further expectation, input, comment or adapter edit is authorized in either file. The only
earlier sampler exception remains TP-001; no frozen specification/expert bytes changed. These
are authority/identity checks, not a passing repaired compiler or complete checkpoint.

## First post-implementation constructor run — not GREEN

Only `packages/compiler/src/layout/startup.ts` changes production behavior for this dependency.
Its private capture helper defaults to A; full capture uses X for DDR and Y for the port, with
the same snapshot stores. Mapping consumes the held readbacks. Other accesses retain their
baseline chronology; compact/takeover/status/layout files are unchanged.

`captured-startup-unit-green.log` records the first actual post-edit constructor run: **32 pass,
16 fail** out of 48, 0.915 s total. All mapping-core/caller-state groups pass. The remaining 16
fail `startup-captured-port.spec.test.ts:127–128`, which expects the filtered device reads
`[0,1,$DD02,$D018,$D015]`; actual is `[0,1,$D018,$D015,$DD02]`.

The original duplicate-read failure occurred earlier in that same test and concealed this later
order assertion during RED. No conclusion that the frozen assertion is erroneous follows merely
from the implementation mismatch. Independent bounded review must distinguish an authority-backed
ordering requirement from an accidental oracle assumption. No frozen test edit or unrelated device
reordering is authorized to obtain GREEN. Active test hashes remain unchanged.

The verification command stopped at the failed constructor step. Its later compiler build,
public integration and serialized VICE commands **did not run**. Published compiler output still
predates this startup correction. T-168.24 stays unverified at 2/7; the parent complete gate remains
failed. No fresh artifact cost, gap reduction, full checkpoint, local commit or push is claimed.

Independent correctness diagnosis now confirms RV-001: the frozen assertion introduces an
unapproved CIA2-before-VIC order. The primary separately checked exact `27ebf448` startup source;
the original VIC snapshots precede the later CIA2 capture, unchanged by this repair. The approved
contract does not require the asserted alternative. See [findings](05-findings.md) for the exact
single-array proposal and authority gate. No edit follows reviewer agreement alone.

The user subsequently approved that exact one-array correction. The original blind author applied
it without other changes or forbidden implementation exposure; primary's exact byte reconstruction
against the preserved frozen original passes. Independent correctness fix-review reports RV-001
resolved. The active constructor hash above is re-frozen. All read counts, ordered equality,
snapshots, volatility, mapping core and other assertions remain; the VICE oracle is untouched.
These checks establish exact-authority compliance, not runtime GREEN.

## Directed GREEN after exact RV-001 correction

The primary ran the stopped verification chain afresh, using the newly built compiler for public
and runtime checks. All steps pass; no compiler/test change entered that chain after it started.

| Actual command / owned log                                                                  | Result                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Targeted formatting / `rv001-format.log`                                                    | Production file and both new specification files pass unchanged formatting.                                                                                                     |
| Constructor specification / `rv001-startup-unit.log`                                        | 48/48 pass. Exact read counts/chronology, captures, X/Y lifetime, 12-byte/16-cycle mapping core, snapshot/caller/initializer/status controls pass.                              |
| `yarn workspace @blend65/compiler build` / `captured-startup-build.log`                     | Pass; published declarations/output now include this startup correction.                                                                                                        |
| Public byte-write specifications / `captured-startup-public-green.log`                      | 22/22 pass, including the independently justified 326-byte entry expectation.                                                                                                   |
| Serialized new provenance and old broad startup oracles / `captured-startup-vice-green.log` | Five cases across two files pass. Saved-port `$A7`/live `$07` and saved-DDR `$FF`/live `$F7` cases pass, with the unchanged live-input control and both broad startup fixtures. |

The helper documentation explains register ownership, snapshot survival and ordered read/store;
the full-constructor comment explains the A-only window. No ephemeral planning reference is added
to code comments. T-168.24 is verified, but no complete artifact-cost measurement, all-constructor
regression proof, final six-lens execution review or fresh complete checkpoint follows from these
directed results. Runtime status is VICE-verified / hardware-unverified, PAL/6581 only.

## Fresh resource measurement and implementation pins

`captured-startup-costs.log` records a real `none` public build in an owned temporary copy of the
unchanged boing source/assets/manifest and real ACME assembly of the unchanged equivalent twin.
The probe checks program-component/payload sums and exclusive CPU interval extents, then cleans
its temporary project. The returning constructor is measured separately from the nonreturning
boing entry. No runtime total is invented from nominal instruction costs.

| Boundary                   | Actual measurement                                                                                                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full returning constructor | 607 code bytes = entry326 + restore280 + RTS1; held platform stack0 / transient1. Entry instruction sum439 nominal cycles; unchanged restore379 + RTS6. These are constructor instruction sums, not wall-clock deadlines or whole-frame timing. |
| Boing code                 | 1,241 bytes, down two from the parent pre-repair1,243; entry326 matches the independent assembly expectation.                                                                                                                                   |
| Program accounting         | code1,241 + asset1,024 + padding4,890 + BASIC stub12 = payload7,167. Two fewer code bytes become two more placement-padding bytes; no payload win.                                                                                              |
| Storage/resources          | SFA45, platform snapshot49, zero-page0, scratch0, resident RAM7,261 unchanged. Reported hardware-stack finite component1 is not an unrestricted external IRQ/NMI/firmware peak.                                                                 |
| Equivalent twin            | code442 / payload7,167; remaining code gap799. Whole-frame timing remains unproved.                                                                                                                                                             |
| PRG identity               | compiled `a078f81092528beff9388204690ff67a207a6082a3b3c84f791385a5cd41ec58`; twin `1623eaa9fa6b717623c02d371fe3cfb3adbeb7ff50558c0c691f7b85c00587f2`.                                                                                           |

Only current-output implementation pins are reconciled: full returning constructor609→607 and
boing code1,243→1,241. No specification expectation follows these measurements. Wider directed
regression verification remains pending; the parent complete gate is still failed.

## Broader directed regressions

| Actual tier / owned log                                     | Passing result                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Compiler layout / `captured-startup-layout-regression.log`  | 139/139, including current full607 and unchanged compact69, stored86/no-Y80 pins, dead-restoration and layout/binding controls.                                                                                                                                                      |
| Root integration / `captured-startup-host-regression.log`   | Six files / 67 tests; startup/display/CIA2/public byte-write and exact current boing/twin cost pin.                                                                                                                                                                                  |
| Serialized VICE / `captured-startup-runtime-regression.log` | Seven files / 89 tests, 323.05 s. CIA2 low-latch/direction combinations and exact return across four profiles, borrowed whole-object state, profile startup/return, raw takeover, both boing source-contract cases, frame comparison and the corrected 257-state/write sampler pass. |

These runs contain no skips or oracle amendments. Combined with the earlier new/broad startup
five-case run, they cover the affected directed runtime boundaries without claiming the full VICE
corpus. Compiler build is fresh before these checks. No production/test change entered this chain.
T-168.25 is verified; implementation controls, six independent reviews and an actual fresh complete
checkpoint remain. The prior complete run remains a failure until that later gate passes.

## Implementation controls and pending changed+host

Seven additive internal cases in `startup-captured-port.impl.test.ts` cover the final borrowed-byte
rebinding path with/without restoration, preserved X/Y holds through added snapshots, unchanged
function-storage identities, four compact forms and the separate takeover vector/mapping path.
`captured-startup-controls.log` passes all seven plus eleven existing startup controls (18/18).
The helper/window documentation and test comments remain self-contained; no new production,
frozen-oracle, public API or test-infrastructure edit accompanies these controls.

The actual `yarn test:changed --host` completed with exit one. Its log is
`captured-startup-changed-host.log`. Earlier selected tiers pass: fast45files/1,282 tests;
layout11/146; machine81/1,033; changed integration2/23; changed serialized VICE3/6. Final complete
host reports **9 failed / 239 passed files; 18 failed / 5,165 passed tests**, 633.61 s. T-168.26
remains unverified. This failure is not replaced by the earlier directed results.

| Failing surface                                       | Observed mismatch / authority boundary                                                                                                                                                                                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seven RD-04 `*-cost.impl.test.ts` files (16 cases)    | Each reported code/program/file size is two smaller; zero-page/scratch expectations are unchanged. Scope permits measured implementation-pin reconciliation, but exact attribution must be checked first.                                                            |
| `rd08/optimizer-exact-output.impl.test.ts` (one case) | Canonical saved `none` payload2,159 versus2,161; subsequent exact hash assertion was not reached. Optimized size/balanced/speed/acquisition checks pass. A fresh identity measurement is needed before updating this implementation pin.                             |
| `m1/pipeline.spec.test.ts:134` (one case)             | Asset start/end/alignment still `$2000/$2200/64`; only expected padding2,936 versus actual2,938 differs. This is a frozen specification oracle, not an implementation pin. No edit approved; first-case assertions after this failure have not executed in this run. |

No test is skipped, relaxed or changed in response yet. Independent bounded artifact-impact
classification must distinguish an expected complete-accounting consequence from a compiler
regression. The M1 oracle needs exact separate user authority if a correction is justified.
No full retry, green closeout or implementation commit follows this failed host gate.

### Independent classification and fresh identity/accounting probe

The emitted-code auditor reports no machine-code regression finding: full capture/store sizes
are unchanged10B/14cycles, while mapping14B/18cycles becomes the independently required12B/16cycles.
The17 implementation-output failures agree with that two-byte saving. Exact historical body-byte
identity is not established, and is not claimed; existing snapshots need not stay byte-identical
across an intentional code-generation correction. The auditor confirms current-output pin
maintenance is justified without a compiler fork/new harness. Required behavior/full gates remain.

`captured-startup-host-impact.log` records fresh existing-API public builds, with no repository
or test change. The private temporary project is cleaned.

| Actual artifact            | Measurement                                                                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saved-input canonical none | payload2,159; PRG SHA-256 `f40c0fa82e77b7ab74fc932d8267d84934724851be65170c71282f757271f6e6`; full entry371.                                                                                                  |
| Same saved-input size      | payload701 and SHA-256 `0dcf3b28e8c7733734358c463ac9cffa7583a0c3164ad023da53dfc19deca8ec` unchanged; compact entry37.                                                                                         |
| M1 program accounting      | code3,153 + asset512 + initialized data24 + padding2,954 + BASIC stub12 = payload6,655. PRG SHA-256 `d78aba55dbc61860bca1f9502291ede5b88741c36deb51acedfdccda0b4df158`.                                       |
| M1 asset                   | One512-byte sprite object at `$2000–$2200`, alignment64, unchanged SHA-256 `c590c49d0e0aae8a20b39e2f6246c530bb7f52fe8b4c21131ec09a442509f68a`; preceding padding2,938 = original2,936 + two saved code bytes. |
| M1 resources               | zero-page4/resident RAM6,790/scratch0/reported finite stack6; program cycles unknown. No external aggregate interrupt/firmware bound or payload-saving claim.                                                 |

The sole proposed new specification exception is the M1 padding scalar2936→2938; original SHA
`c2a738a96f6cfe9670c66e8142ad819d7a3f203c446d96ea93bed4691b947321`. Approval is still pending;
that file is unchanged. See [findings](05-findings.md) for the exact gate and preserved obligations.

The user subsequently approved exactly that M1 scalar on 2026-11-17. Primary preserved original
bytes, applied the single change and verified exact reconstruction; independent application check
reports no findings. Active M1 freeze is
`dc11c7f1ca1dc782089e699b31fa0441742f3492d263320c13cdfee978cea04d`. No other assertion or
expert-baseline byte changed. Seven RD-04 implementation files reduce48 size fields by two;
the RD-08 implementation file changes only saved-none payload2,161→2,159 and its fresh measured
hash. Whole-file reconstruction against all eight preserved originals passes; resources, sources
and unaffected optimized pins remain byte-identical. No further production change occurred.
Affected-file and changed+host reruns must actually pass before T-168.26 can be verified.

The actual affected-file rerun passes **nine files / 22 tests**, including the complete M1 first
case after the former padding assertion and all unchanged expert-floor/digest checks. Targeted
formatting passes. Logs are `captured-startup-impact-format.log` and
`captured-startup-impact-green.log`. No test is skipped or relaxed.

A fresh `yarn test:changed --host` now runs with output in
`captured-startup-changed-host-reconciled.log`; no source/test changes enter it and no competing
emulator is launched. Await its notification; do not poll/restart. T-168.26 remains unverified.
Read-only six-lens execution review can inspect this fixed delta independently, but cannot waive
the pending host or complete gate. The shared bounded packet is [review context](07-review-context.md).

That fresh changed+host command now exits zero: fast45files/1,282tests; layout11/146;
machine81/1,033; changed integration11/45; changed serialized VICE3/6; complete host248/5,183.
Total491.58s, complete-host tier351.17s. No source/test change entered the run. T-168.26 is verified;
the earlier failed host log remains historical failure evidence, not erased by this new run.
Complete workspace/serialized VICE qualification still requires the scheduled fresh full gate.

Five execution lenses report no findings. Emitted-code source/IR review is clear but actual-byte
inspection remains incomplete after denied external-log access. No denial is retried or bypassed;
the primary will generate a bounded actual assembly/byte/symbol evidence handoff under its existing
verification ownership. That is not a new harness or an extra emulator journey.

The primary generated that fresh public handoff and checked its durable raw excerpts exactly
against the two new artifact identities in [actual-byte evidence](06-actual-byte-evidence.md).
Boing identity matches the earlier measured PRG; the separate returning witness includes a real
281-byte restore interval. A temporary assembly-text regex initially missed ACME's `+1` suffix;
only that private adapter changed, with no production/oracle change or emulator rerun.

The emitted-code reviewer directly inspects the bounded assembly/hex and reports no findings,
closing actual encoding and final placement. All six execution lenses are now clear; T-168.27
is verified. Denied external log reads remain denied and are not retried or relayed. Final full
checkpoint, whole-frame timing, unrestricted external interrupt/firmware guarantees and physical
silicon remain separate. No green implementation commit is yet claimed.

## Final prechecks and actual complete checkpoint

Targeted owned Markdown formatting and source/test formatting pass. Active oracle hashes, parent
production starting hashes, unchanged status/layout, frozen specification/expert/dependency files,
owned links, new-code documentation references and diff whitespace guards pass. Fresh
`yarn install --frozen-lockfile`, `yarn build` and `yarn typecheck` pass; install is already current,
build four tasks and typecheck seven tasks succeed. Their owned logs use the
`captured-startup-{doc-format,code-format,install,global-build,typecheck}.log` names.

The one actual `yarn test:full` is now running as shell job
`sh_1e9a14802001MGvhpltD4YSYZ4`. It includes complete workspace tests and root host before the
serialized VICE tier; there is no duplicate outer host checkpoint. Linux/non-foundation selection
is explicitly guarded. `captured-startup-full-inputs.json` captures the28 allowlisted source/test/
boundary/dependency hashes before execution, and the wrapper rechecks them at completion.
Its output is `captured-startup-full-checkpoint.log` under the already-owned evidence directory.

Await the completion notification: do not poll, sleep, restart, run another emulator or introduce
production/test changes. No full GREEN, final closeout or local implementation commit is claimed.
Earlier failed complete/host logs remain preserved. Only an actual new complete pass can close
the dependency's last task and resume the parent's final green commit boundary.

## Task-scoped deferral-expiry assessment

Preliminary answer: this startup correction does not expire a retained deferral's stated reason.
It uses existing free registers in a platform-capture window; it does not introduce a new calling
convention, source reordering/purity proof, volatile API, IRQ/NMI route, target or host qualification.
The relevant frozen FUT-016 stack-free, FUT-017 barrier and FUT-018 separate-volatile reasons and
reconsideration criteria remain unchanged (`spec/future-considerations.md:311–418`). No RD is
being closed by this task, and no promised later slice is orphaned. This is not a global re-audit
or a claim that unrelated historical deferrals are resolved.

Parent #168 still owns the799-byte equivalent-code gap and whole-frame timing. External aggregate
interrupt stack, retained-firmware completion/reentrancy and physical hardware remain unproved;
the existing pinned returning-register contract does not remove those proof requirements.
Reconfirm these bounded residuals after the complete result before closeout. Retain the owned
diagnostic/probe/oracle-copy logs until that coherent checkpoint, then clean only this task's
temporary artifacts; temporary build projects/emulators from completed directed runs are cleaned.

## Actual complete result — failed, two distinct cases

`captured-startup-full-checkpoint.log` records exit one from the completed actual full run.
No source/test input-change warning is emitted; the captured28 allowlisted identities remain
unchanged. There was no concurrent emulator or source/test edit during the run.

| Complete tier          | Actual result                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| Workspace compiler     | 250files/4,166tests pass, two existing skipped tests;360.23s.                                                  |
| Other owned workspaces | CLI70, language-server21, VS Code18 pass; seven Turbo tasks successful.                                        |
| Complete root host     | 248files/5,183tests pass;299.35s.                                                                              |
| Serialized VICE        | 130files/2,381tests pass; two failed files/cases; existing one skipped file/four skipped tests. Tier5,599.03s. |

The failures are not conflated:

1. `test/rd04/stack-startup-visibility.impl.test.ts`, safe-return case: existing helper's checkpoint
   wait times out. That case took119.853s including build/runtime; the original error does not say
   whether startup entry or SYS continuation was missing. Its two other cases pass. Treat compiler
   correctness versus observation/host timing as unclassified until direct phase evidence.
2. `test/rd05/canonical-fixed-object-abi-fallback.spec.test.ts:531`: frozen saved-none artifact
   expects2,161, observes2,159. The following old hash assertion is not reached. This is the same
   source whose implementation snapshot was separately reconciled, but that does **not** authorize
   editing this specification file. Its current SHA is
   `de1900b7b209bbf1d76c5ba64b9ff19b60ec2c31698c253855a860dd03c712fc`.

All20 other cases in the generic-fallback file pass. No complete retry, isolated-pass substitution,
timeout increase, frozen oracle edit or green commit is authorized by these observations. Retain
the failed complete log and diagnose the two boundaries separately before proposing remedies.

Independent correctness diagnosis now classifies the frozen identity pin as RV-002 and requests
only the exact two-value exception in [findings](05-findings.md). The smaller output is justified
by the separately mandated saved-readback repair, not merely by compiler output or a neighbouring
test. User approval remains pending; the specification file is unchanged.

The primary runs one separate safe-return phase probe using the unchanged187-push/38,000-NOP
source and existing public build/VICE APIs. It records artifact geometry and individual startup/
SYS-continuation wall times. Its bounded60-second observation window distinguishes late arrival
from missing execution; it does not change the existing test's20-second wait, source, CPU flags,
machine configuration or100M-cycle limit, and cannot qualify the failed complete gate. No emulator
competes with it. The original failing checkpoint phase remains unknown until direct evidence.

That one probe completes successfully, without modifying or executing the existing test as an
oracle. Public build69.617s, payload38,470; selected compact-stored/no-Y entry51/restore29/state6,
all restore/state below `$A000`. Startup arrival14,621.374ms; SYS continuation72.859ms; original
SP+2/P&`$CF` state assertions pass. PRG identity/source identity and the exact ranges are recorded
in [DG-001](05-findings.md#dg-001--safe-return-timeout-original-cause-remains-unknown).
The diagnostic log is `stack-startup-phase-diagnostic.log`; its temporary project/emulator are
cleaned. No repeat or competing launch occurred.

The updated independent platform conclusion keeps original cause Unknown, with no concrete
compiled banking/return/stack fault supported for this measured artifact. Its earlier pre-probe
analysis is not a request for another launch. Keep the old runtime test unchanged and require a
fresh complete gate after the separately authorized identity correction; this is not an original-
failure explanation or an isolated-pass waiver. Any recurrence blocks for diagnosis rather than
automatic retries. No timeout/source/helper/constructor edit is supported here.

## Exact RV-002 correction and affected actual checks

The user explicitly approved only the saved-none payload/hash replacements. Primary preserved
the original file, verifies exact two-value reconstruction and re-freezes active SHA-256
`414f14a0ae4d7051633cd0ee105b259a47cb33efce8305e29bce08cdf3051296`. Independent correctness
fix-review reports RV-002 resolved/no findings. Exact size/hash assertions and every other source/
profile/mode/accounting/ABI/layout/resource/behavior assertion remain. No production edit occurs.

`rv002-format.log` passes targeted formatting. `rv002-affected-vice.log` passes **two files /24
tests**,183.31s: all21 generic-fallback cases and all three stack-startup visibility controls,
including the original safe-return test's20-second helper waits. Safe-return test hash remains
`e3b1eac2ea0f433a902217924762fb81eb25e07c11960868eb32ea2db41fc00c`; fixture helper and monitor
are unchanged. No diagnostic window is substituted into the test.

The original complete failure and Unknown timeout cause remain recorded. The directed actual
pass is not complete qualification. After fresh prechecks, schedule one new required complete
run at this justified exact correction; no automatic retry follows another timeout or other failure.

## New complete checkpoint after exact RV-002 correction — running

Fresh owned Markdown formatting, frozen install, global build and typecheck pass again, logged as
`rv002-{doc-format,install,build,typecheck}.log`. All28 original checkpoint input hashes remain
unchanged; the only added existing-oracle change is the exactly approved RV-002 size/hash pair.
Its active freeze, unchanged safe-return test, unchanged helper/monitor/runtime, frozen expert/
specification/dependencies and owned links/whitespace guards pass.

One actual new `yarn test:full` is running as `sh_1ea2cbd95001Y0xqCtU7bgMUZe`. Its log is
`rv002-full-checkpoint.log`; `rv002-full-inputs.json` records33 allowlisted source/test/boundary/
dependency identities, now including the approved oracle and unchanged runtime test/helper/
monitor/launcher. The wrapper rechecks them at completion and requires the complete serialized
VICE marker. Linux/non-foundation selection is guarded. It includes workspace and host checks
before VICE; no duplicate outer host gate, new emulator or source/test change enters this run.

Await the completion notification without polling, sleeps or restart. This is the required new
checkpoint after a separately justified exact correction, not retry-until-green. The original
timeout's cause remains Unknown, its runtime assertions/budgets stay unchanged, and any recurrence
or other failure stops qualification for bounded diagnosis before another complete invocation.
No full GREEN, dependency closeout or local implementation commit is claimed while it runs.

## Machine-restart recovery — 2026-11-17

The harness reports `sh_1ea2cbd95001Y0xqCtU7bgMUZe` cancelled because the server restarted.
The user explicitly requested continuation after restarting the machine. The named old temporary
directory no longer contains `rv002-full-checkpoint.log` or `rv002-full-inputs.json`. Earlier
retained logs, probes and pre-edit copies are also unavailable at that directory. Historical
results and exact-authority checks above remain durable reported evidence, but their original
temporary raw files cannot now be re-inspected or reconstructed as original observations.
No result, failing test or completion phase can be recovered for the cancelled run; it does not
qualify the checkpoint and is not classified as a new test failure.

Branch `feature/v4-rebuild` remains at `27ebf448` with the declared uncommitted parent/dependency
work. Recorded active selector/fixture, constructor, runtime, public-entry and broad-canary
freezes match current bytes. Frozen `spec/` has no changes. No `x64sc` process is active.
No compiler, source, oracle, helper or timeout edit is made during recovery. The prior unknown
safe-return timeout is not explained or waived.

Resume with fresh formatting/authority checks, frozen install, build, typecheck and one actual
complete workspace/host/serialized VICE command. Capture fresh inputs and results under the current
`$CODEOPS_TMPDIR`; do not recreate the lost historical manifest or pretend the interrupted run
passed. Any test failure stops qualification for bounded diagnosis before another invocation.

## Actual post-restart complete checkpoint — GREEN

Job `sh_1ea5288ac001jZT0Yph4wjFmAL` exits zero. The primary rechecks the result manifest,
serialized VICE marker and all40 guarded input hashes after notification; all match. The temporary
root is `/tmp/opencode/codeops/runtime-008dc7dd-b8e9-44f8-b007-488e536fa932/issue168-restart-9yqc7p0q/`.

| Actual step | Result |
| --- | --- |
| Targeted Markdown/source/test formatting | Pass;1.881s. |
| `yarn install --frozen-lockfile` | Pass;0.423s, dependencies unchanged. |
| `yarn build` / `yarn typecheck` | Pass;0.449s/0.378s, normal Turbo cache used. |
| `yarn test:full` workspace tier | Seven successful Turbo tasks, cache replay. Compiler250files/4,166passed/2existing skipped; CLI70, language-server21, VS Code18 passed. These package results were not freshly re-executed after reboot. |
| Complete root host | Fresh248files/5,183tests pass,642.84s. |
| Serialized VICE | Fresh132files/2,383tests pass; existing1file/4test skips,4,139.52s. No competing emulator. |
| Complete command duration |4,784.128s; entire precheck/checkpoint chain4,787.266s. |

The original safe-return file passes all three cases with its original20-second helper waits.
The generic-fallback file passes21/21; saved-readback provenance3/3 and byte-write257-sample
oracle1/1 also pass. The full command, not isolated reruns, is the qualifying result. Normal
content-addressed workspace cache use is disclosed rather than presented as fresh execution.
No source/test/helper/timeout edit entered the chain.

Evidence identities before cleanup:

| Artifact | SHA-256 |
| --- | --- |
| Fresh40-input manifest `inputs.json` | `ee6e8348a6298ce6ba33344cc536b29fbe5e17a61420a2c7e5742c1f2fa9b9fa` |
| Complete log `full-checkpoint.log` | `ef5ad4d88889fa34b1498c58c3602b4fbb720476bfdf733f807e3c9fc692df95` |

All active frozen oracles and the unchanged helper/monitor/runtime are included in the checked
boundary. `spec/` remains untouched. Six independent execution reviews and the exact prior
exception/fix reviews remain applicable: no production or oracle change followed them.
Documentation self-check and scoped deferral-expiry assessment are reconfirmed. This deliverable
expires no broader observer, interrupt, storage, platform or host deferral.

T-168.28 closes at7/7. The parent may now close its bounded handoff and commit both units coherently.
Current costs remain code1,241/entry326/SFA45/snapshot49/resident7,261/payload7,167; the startup's
two saved code bytes become padding, not a payload win. #168 retains the799-byte code gap to the
equivalent442-byte twin, repeated arithmetic/reload/allocation opportunities and whole-frame timing.
Physical hardware, unrestricted external interrupt/firmware bounds and historical whole-program
body-byte identity remain unproved. Status: VICE-verified / hardware-unverified.

This GREEN qualifies the current checkpoint only. It does not explain the old safe-return timeout
or recover raw evidence lost at reboot. No push or issue closure is authorized by this closeout.
