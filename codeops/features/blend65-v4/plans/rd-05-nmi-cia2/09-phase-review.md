# Execution evidence: cooperative NMI qualification

> **Parent**: [Execution plan](99-execution-plan.md)
> **Status**: Phase 1 complete; Phase 2 executing after the approved AR-P19 correction; public NMI admission and runtime qualification remain pending
> **CodeOps Artifact Schema**: 1

## Phase 1 baseline and scope

Baseline tree `b198a184fb38209f3519989a9d3f4ea15c842d52`, commit `5e8f624e`.
Strict scope: correct only cooperative finite-component evidence using the
existing schema, validators and public service. No selected assembly, storage
allocation, CPU/profile/API, firmware ownership or admission change.
Phase target paths are recorded in the execution-plan header. Unrelated changes
are excluded; local green commits only, never automatic push.

Expert 2.0.3/content `22cc5f00f381c82d347cf342be4fcff16bc291c6`; frozen Specification
4.0. The evidence concerns finite generated/mainline/IRQ components separately
from unproved external NMI stack, retained-firmware completion and deadlines.

## Specification-first RED

Independent `spec-test-author` owns the new
`test/rd05/nmi-stack-evidence.spec.test.ts`. It read only the contract, allowed
public types and existing public test fixture; no implementation or old oracle.
The generic evidence types required concrete record projections in its packet.
The existing schema-1 fields/full-main-declaration site were clarified in
`03-stack-evidence.md` before verification; no interface or scope was added.
Pre-RED self-review removed an unsupported program-row numeric guess. The exact
combined peak and warning decomposition remain independent expectations.

Frozen new-oracle SHA256:
`8fd5feb8869ab6fa37acd30413414ec87e8b5f54da5d5bfb52603eef8760494d`.
Only formatting/comments were completed around the initial RED invocation;
no expectation changed after implementation observations.

Command: `yarn vitest run test/rd05/nmi-stack-evidence.spec.test.ts --maxWorkers=1 --minWorkers=1`.
Log: `/tmp/blend65-nmi-phase1.kptptV/spec-red.log`.
Result: expected RED, 16 failures/four passes, 20 cases across all four cooperative
PAL/NTSC × 6581/8580 profiles; 10.70 seconds. Every failure reproduces a planned
reporting correction, not an input, tool or fixture failure.

| Case                    | New-contract result on every profile                                       | Already-passing boundary and reason                                                  |
| ----------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| ST-1 empty/no hook      | RED: status says proved; main-site compound effect absent                  | Static ACME/SFA reconciliation already exists and must stay valid                    |
| ST-2 ten live saves     | RED: reserve-as-use rows; maximum 30 rather than 10                        | Balanced explicit stack behavior is already implemented                              |
| ST-3 188 saves plus IRQ | RED: reserve-as-use rows; maximum 215 rather than 195                      | Canonical 195-byte warning, calls 0/entries 7/pushes 188 already passes              |
| ST-4 236 live saves     | RED evidence: maximum 256 rather than 236 and missing external uncertainty | Legal bounded build already succeeds                                                 |
| ST-4 237 live saves     | PASS, four regressions                                                     | Existing E10238/no generation/no output directory correctly enforces finite capacity |

The 237 boundary is intentionally not new capability. No expected-RED checkpoint
is committed; only a complete green phase can form a coherent local commit.

## Phase 1 implementation and directed GREEN

Only the existing `prepareEvidence` reporting path changes: one source-attributed
external-effect class, unproven external guarantees and bounded-component capacity
minus reserve. Numeric hardware-stack use no longer includes reserve. The closure
certificate, diagnostic/warning producers, validators and generated code stay
unchanged. The old service implementation test changes only its obsolete
reserve/capacity rows; publication/identity/debug assertions remain intact.

| Check                                               | Result                            | Capture                                                  |
| --------------------------------------------------- | --------------------------------- | -------------------------------------------------------- |
| Fresh package builds                                | PASS, four owned packages         | `/tmp/blend65-nmi-phase1.kptptV/directed-build.log`      |
| Immutable new specification cases                   | PASS 20/20; unchanged oracle hash | `/tmp/blend65-nmi-phase1.kptptV/spec-green.log`          |
| New cases plus retained resource boundaries         | PASS 33/33                        | `/tmp/blend65-nmi-phase1.kptptV/retained-root.log`       |
| Existing evidence specification/internal validators | PASS 10/10                        | `/tmp/blend65-nmi-phase1.kptptV/retained-validators.log` |
| New internal cases and retained service hardening   | PASS 11/11                        | `/tmp/blend65-nmi-phase1.kptptV/impl-tests.log`          |

Internal regressions exercise the exact UTF-8 exported main declaration with declarations
on either side, one unique compound record, canonical stack-row order, retained
source-route tail, nested call/status use (12 bytes) and zero headroom at 236.
The unchanged validators accept the actual published bytes, not a mocked record.

## Phase 1 full checkpoint and review

Frozen-lockfile install, build and typecheck pass. The first complete test run
exited 1 with exactly one failure. Its existing `test/rd05/runtime-switch-vice.spec.test.ts` case
timed out at its unchanged 30-second limit (32.466 seconds observed). At 01:30 the
host reported load 18.64/16.79/15.59 on eight CPUs. This supports host contention
as a possibility, not a proved cause. No assertion, timeout or emulator helper is
changed. The unchanged directed retry passed in 25.919 seconds (29.49 seconds
including collection). At 01:37 the load fell to 10.67/12.00/14.01. Timing sensitivity
is supported, but the failed attempt remains a failure. Its root results were
1,681 pass/one fail; workspaces 1,763 pass/two existing skips. The complete unchanged
`yarn test` repeat in `full-test-retry.log` then hit the existing foundation
dependency-rebuild test's default five-second limit. This second attempt was
cancelled after that known failure by signalling only the positively identified
owned Vitest process, before any VICE process was active. Exit 130 is not a pass;
no user process was stopped.

The final complete run passed with `yarn test --testTimeout=60000 --bail=1`, captured in
`full-test-bounded.log`. This raises only Vitest's default wall-clock allowance
without any file or assertion edit. Explicit per-test limits, including the VICE
case's 30 seconds, remain unchanged. Fail-fast saves time on another failed run;
a successful run still executes every test. No retry flag, skip or CI selection
is used. Retry capture: `runtime-switch-retry.log`, under the same temporary
evidence directory. VICE runs remained sequential.

| Final checkpoint                                                       | Result                                                                          | Capture under `/tmp/blend65-nmi-phase1.kptptV/` |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------- |
| Frozen-lockfile install                                                | PASS                                                                            | `full-install.log`                              |
| Build                                                                  | PASS, four package tasks                                                        | `full-build.log`                                |
| Typecheck                                                              | PASS, six fresh-declaration tasks                                               | `full-typecheck.log`                            |
| Complete Linux tests                                                   | PASS, 3,445 tests and two existing skips; root 114 files/1,682 tests            | `full-test-bounded.log`                         |
| Fresh final compiler suite after the minor internal-fixture correction | PASS, 113 files/1,674 tests and the same two skips; exported-main test included | `compiler-final.log`                            |
| Four touched code/test files                                           | PASS, targeted formatting                                                       | `code-format-final.log`                         |

The unchanged root/other-package results and fresh compiler-suite result cover
the final source and tests. Only the internal exported-main fixture and contract
wording changed during root verification; no production or root oracle changed.
No skip was added. Complete root duration was 1,095.52 seconds; final compiler
suite duration 142.45 seconds. The VICE case passed at 20.195 seconds with its
explicit limit unchanged. Earlier failed/cancelled attempts remain failures.

Independent code reviews and final correctness evidence confirmation are complete:
no remaining finding. The follow-up accepts the captured complete root/other
workspace results plus fresh final compiler suite, exact unchanged oracle and
minor correction boundary. Final bookkeeping, formatting, local links, task
counts and frozen/oracle guards pass. The coherent green checkpoint is local
only; no push is authorized. RD-05/DEF-7 remain open, with 21 Phase 2 tasks pending.
Source/oracle/frozen checks use the recorded phase baseline; physical/generated
NMI qualification remains outside Phase 1.

### Independent review progress

The complete production/test diff is reviewed in parallel with the final full
checkpoint. A review does not clear pending verification. Each packet includes
the actual baseline, strict smallest-design scope, immutable oracle/RED evidence,
failure captures and final bookkeeping still pending.

| Owner                 | Result and boundary                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Correctness           | No findings; correctness/maintainability/standards/scope and oracle integrity pass. Final verification recorded above.                                   |
| Semantics / modern DX | No implementation or DX findings; one minor contract wording correction resolved below. Final verification recorded above.                               |
| Target platform       | No findings; finite/external scope, reserve accounting and all four selected profiles verified at reporting endpoint. Final verification recorded above. |

The native platform role remains unavailable from the earlier setup check. A
fresh generic dispatch was refused by the session thread limit, so an idle
independent generic agent is reused with the complete current platform charter.
Its earlier release-summary exposure is disclosed and that earlier S1–S7 blind
attempt remains excluded from setup qualification. This is ordinary implementation
review, not a fresh blind skill check or evidence of native role activation.

No SFA/ABI, output-cost, host-performance or security specialist is selected:
this reporting-only diff changes no allocation/closure, ABI, selected/emitted
code, layout, optimizer, host hot path or security-input boundary. Dedicated
semantics/platform lenses supersede those portions of base review. No reviewer
runs verification or an emulator, edits files, creates issues, commits or pushes.

All three independently inspected the complete bounded phase diff. Knowledge
lineage is expert 2.0.3/content `22cc5f00f381c82d347cf342be4fcff16bc291c6`, normative
SFA hardware-stack duties/final closure, C64 stack-budget/NMI/resource headings
and evidence boundary rules. Governing keys include Specification 4 identity,
`MOS-PGM-1976`, `MOS-HW-1976`, `CBM-C64-KERNAL-03` and `MOS-6526-1981` where applicable.
The seven-byte selected CINV contribution remains CPU frame 3 + firmware saves
3 + chain status save 1. This is not a new generated NMI cost or external bound.

### SM-001: complete declaration provenance

MINOR, documentary contract consistency: the execution clarification said the
complete main declaration starts at its `function` token, overlooking legal
export/placement modifiers. The original requirement uses the actual complete
declaration and the existing binding/debug source projection. Frozen Chapter 06
§2.1 includes modifiers in the declaration; Chapter 10 §5.2 permits exported
main. Production already preserves that complete span, so it has no semantic
defect and needs no source-reading helper or projection change.

Disposition: necessary plan-owned correction under AGENTS.md workflow Prime
Directive §4, not a new user approval or expanded scope. Clarify that the complete
declaration includes its modifiers; change only the internal provenance fixture
to exported main. Unmodified main remains covered by the immutable public cases.
No specification oracle, schema, accepted source or production code changes.
The affected internal fixture passes in the fresh full compiler suite above;
the root final run and production source are unchanged. The correction is
verified. No major-fix re-review is required.

## Phase 2 baseline and independent oracles

Baseline commit `4b19dd76`, tree `e1a813c88003478d678c256f1b109090a30f1172`.
The same bounded stock-chained scope and strict modification set apply. Phase 2
does not close RD-05/DEF-7 or prove external aggregate stack/firmware completion.
Compiler implementation has not started before these independent oracles.

Task 2.1.1 partitions the already-approved source cases into three focused new
files below 300 lines, using only the existing public fixture. AR-P13 assigns
actual helper/link/effect output to 2.1.2 and pins the existing source-record cycle
witness and public/internal wrap endpoints. AR-P14's exact obsolete-message
assertion correction was requested and explicitly approved before old-oracle edits.
No public field, source rule, harness or framework is added by these clarifications.

| New oracle                                   | Lines | Final pre-RED SHA256                                               |
| -------------------------------------------- | ----- | ------------------------------------------------------------------ |
| `test/rd05/nmi-route-admission.spec.test.ts` | 202   | `168e8e8911520f1fbb5d5ca31a02c1529752a75cfc14252b28671935d077a536` |
| `test/rd05/nmi-route-lifetime.spec.test.ts`  | 172   | `f3225c0b2f14f7e552115e1278939688305b2c7882d58d3277ee5a31cd0cfa7e` |
| `test/rd05/nmi-route-writers.spec.test.ts`   | 118   | `b2d73485d4f95e2076665952a3ff975a2818c76e93256320c4d0d64a2dfa2cbc` |

The implementation-blind author disclosed mandatory routing smoke summaries and
unrelated foundation roadmap counts during orientation. These are not behavioral
oracle inputs and were excluded from derivation; no compiler implementation,
pre-existing test or qualification/grader/history file was read. Safe current
release extraction emitted only the five identity rows. This is requirements-derived
test authoring, not blind qualification of the specialist instructions.

The author alone ran directed verification, one worker and no emulator. Primary
inspection confirms the pre-RED hashes above, unchanged after verification.
Command: `yarn vitest run test/rd05/nmi-route-admission.spec.test.ts test/rd05/nmi-route-lifetime.spec.test.ts test/rd05/nmi-route-writers.spec.test.ts --maxWorkers=1 --minWorkers=1 --testTimeout=60000`.
Capture: `/tmp/blend65-nmi-phase2.zRVGjp/admission-red.log`; expected RED, exit 1,
92 failures/20 passes out of 112 cases, 6.17 seconds. All four profiles have the
same dispositions. No syntax/tool failure occurred. Both public services execute
before assertions; no implementation or expectation changed. Formatting passes.

| Case boundary                                             | Initial result on each profile                  | Meaning / remaining endpoint                                                                                                      |
| --------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| ST-5/ST-8 empty and constant/helper chains                | RED: check/build still reject                   | New admission must close complete selected proof; output belongs to 2.1.2                                                         |
| ST-6/ST-7/ST-9 exclusive/private homes                    | RED: old noncanonical E10245 text               | Rejection already exists, but not the canonical scoped proof. AR-P14 reconciles the one old assertion; new oracle stays unchanged |
| ST-10/ST-11/ST-13(a) finite nesting/helper/IRQ routes     | RED: service success assertions fail            | Exact bindings and finite costs remain independent output endpoints                                                               |
| ST-12/ST-13(b) growth/direct/helper changed capture       | RED: old blanket E10245 before concrete witness | Complete ordered changed-capture cycle and selected closure must still qualify                                                    |
| ST-14 eight overlapping/opaque writer forms               | RED: E10245 rather than E10278                  | Includes word second-byte overlap, computed wrap and opaque helper flow                                                           |
| ST-15 disjoint local/global flow and post-pop raw control | RED: blanket guard rejects                      | Ordinary variable-address and completed high-level lifetime remain expressible                                                    |
| ST-24 earlier-publication preservation                    | RED: old E10245 wording blocks later assertions | Exact publication bytes/list still need GREEN; no intermediate commit                                                             |
| ST-24 three existing callback/provenance guards           | PASS: 12 cases                                  | Existing ordinary-function, erased-address and direct-call guards remain active                                                   |
| Existing IRQ-only finite control                          | PASS: four cases                                | Previous finite IRQ behavior remains required                                                                                     |
| No-hook raw vector-write control                          | PASS: four cases                                | Existing explicit raw boundary remains legal; no fresh entry precondition                                                         |

RED is the verified outcome of oracle authoring, not completed compiler work.
No expected-RED checkpoint is committed. Runtime/assembly qualification remains
pending until the separate implementation and native-source gates.

### Independent output-oracle freeze

Task 2.1.2 finalized the three concern-split files before observing compiler
output. Primary source/documentation inspection confirms the exact analytical
entry/save/call costs, coherent full capture and high-only publication/removal,
separately decoded IRQ/NMI links, whole-wrapper placement and complete loaded-byte
accounting. AR-P13 pins the simultaneous 10 = 1 + 9 mixed peak and ST-15's bounded
static/runtime endpoint split; it adds no optimizer, executor or harness.

| New oracle                                   | Lines | Final pre-RED SHA256                                               |
| -------------------------------------------- | ----- | ------------------------------------------------------------------ |
| `test/rd05/nmi-route-output.spec.test.ts`    | 240   | `fde6a8e0e440d68e05beeb49e2bb9a557a15a52a60812f9797d21ba5cfd4397a` |
| `test/rd05/nmi-route-links.spec.test.ts`     | 290   | `157ae0e9108cd07aa1eb397eddfb8d57fdfa4209b58e1ea83ab9bdcf33e02cd7` |
| `test/rd05/nmi-route-placement.spec.test.ts` | 179   | `1d763d0cfdc2be957837f5cffe963304d1a06f71ee7e23af85f6e332e3873859` |

Before RED, the author corrected one overly broad CIA2-read scan to cover the
complete function-owned NMI/source route, excluding unrelated generated startup.
No actual compiler output had been observed; the earlier tentative link-file hash
is not the oracle identity. The global no-generated-low-vector-store check is
unchanged. Formatting/reference checks and primary hash confirmation pass.
The author disclosed a filename-only listing of frozen chapters/evaluation paths
while correcting a chapter path. No evaluation contents were read or used.
No implementation, earlier oracle or qualification-answer contents were read.
Directed RED is verified: `yarn vitest run test/rd05/nmi-route-output.spec.test.ts
test/rd05/nmi-route-links.spec.test.ts test/rd05/nmi-route-placement.spec.test.ts
--maxWorkers=1 --minWorkers=1 --testTimeout=60000`, exit 1; 60 failures, no prepasses,
4.00 seconds. Capture: `/tmp/blend65-nmi-phase2.zRVGjp/output-red.log`.
Every profile has the same disposition. The 44 success/byte/link/flow/adaptation
cases stop at the existing E10245 blanket guard before their output endpoints.
The 16 layout/publication-negative cases receive E10245 rather than E10273.
Each publication case first builds a valid no-hook generation through real ACME;
its later preservation assertion waits behind the wrong diagnostic. No syntax,
tool or emulator failure occurred. Primary confirms all hashes unchanged after
RED. These verified oracle-authoring results are not positive compiler output
or runtime qualification.

### Exact old-oracle correction

Task 2.1.3 applies only the explicitly approved AR-P11/AR-P14 exception. Primary
inverse-diff inspection confirms the profile file's balanced empty chained source
is byte-identical and only moves to public check/build success; its exclusive
negative, three IRQ fixtures and timeouts remain unchanged. The diagnostic file
changes only the balanced five-live-byte fixture and one E10245 regex. Code,
severity, error count, pointer, owning-install span, empty related array and
no-generation assertions remain unchanged, as do all unrelated cases/helpers.

| Existing oracle                                          | Frozen pre-RED SHA256                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------ |
| `test/rd05/profile-interrupts.spec.test.ts`              | `eabeb96885bdd1125647c1102149abaf597911362f434c596deea8220d990bfb` |
| `test/rd04/diagnostics-alternate-placement.spec.test.ts` | `7211ad396706d5db3c84acdc0cd128bcbef9754b279dbd445d9c6ca3f63dcdd8` |

Directed two-file verification with one worker and 60-second default allowance
is expected RED: exit 1; five failures/28 passes out of 33, 3.92 seconds.
Capture: `/tmp/blend65-nmi-phase2.zRVGjp/old-fixtures-red.log`. Four chained
positives still encounter blanket E10245; both services execute, but the first
failed assertion prevents the later success assertion. The genuine private
fixture fails only its canonical message; all retained fields match, including
primary bytes 358–374. The 12 IRQ positives, four exclusive/no-output negatives
and 12 unrelated diagnostic cases pass. No syntax/tool/emulator failure occurred.
Final hashes remain unchanged; formatting, reference ban, whitespace and frozen
paths pass. The author read only the two explicitly allowed old tests, approved
helper/interface/normative material and workflow metadata; no forbidden file.

### Deferred-ledger split

Task 2.1.4 keeps `v4-nmi-installation` for exclusive installation and adds
`v4-nmi-chained-installation` for the existing balanced chained source. Both remain
deferred, E10245, with owner `RD-05 R5.15–R5.17`. No qualification or retirement
is claimed. The original source bytes, unrelated rows, gate and all negative
mutations are unchanged. Primary inspection confirms the exact split diff.

| Oracle                                         | Frozen pre-verification SHA256                                     |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `test/rd04/expressiveness-ledger.spec.test.ts` | `2bfa4ee3e9d8528b04fb469dbe951c773136720fb70233d4d8baac54579207c7` |
| `test/rd04/expressiveness-ledger.json`         | `37d7d92fc9ff1a4ea9a003390c41505f6caee47346a7a5ba76d1e552e3cd0610` |

Directed baseline verification passes all 11 cases in 3.29 seconds; capture
`/tmp/blend65-nmi-phase2.zRVGjp/ledger-split-baseline.log`. Both deferred probes
still reject; both retired IRQ/stack probes build. Unmatched restoration retains
E10278 and all five mutation/accounting guards pass. This verifies reconciliation,
not generated/native NMI behavior. Hashes remain unchanged after verification.
JSON parsing, formatting, reference bans, diff checks and frozen-path checks pass.
The author reports no forbidden reads, missing input or post-verification edits.

| Preserved material              | SHA256                                                             |
| ------------------------------- | ------------------------------------------------------------------ |
| Chained source bytes            | `ea8fb1cbe4594cc861735a5f7efe7ac9fa905759f3ae9604289d5217067ec98d` |
| Exclusive source bytes          | `772a682af9905b831ac45f9153daeca575accf3a14c66b2183e408f98755c805` |
| IRQ source block                | `7bbfdca1e7e8f0933e9ecc0d781510c77292298ecc20bf1ccbc889e0c752e47e` |
| Stack source block              | `143afc3642d172a516baa104ca57bf446b1de29eb22888e1cea42eba13db3c35` |
| Gate and all negative mutations | `d50e30d60171f7f29d358671b548b1dd80a07a76843be574f2164b2c2bf8f3b2` |
| Unrelated IRQ row               | `551ee1fba9ad002a2d8be9b9228be156e5f523bf2676f268038648d50ab6eb80` |
| Unrelated stack row             | `dbe531ce9aee683a863638eb94c42b6b7230bef6320a179f072033afc15c85ba` |

### Combined pre-implementation boundary

Task 2.1.5 verifies all nine named specification files together, one worker,
without changing their frozen hashes. The separate results predict 216 cases:
157 expected capability failures and 59 retained/baseline passes. The six new
files, three explicitly approved old files and deferred ledger JSON above are
the exact authoring boundary. Compiler implementation is still unchanged.

Native predictions remain independent of compiler output: ST-19 preserves seeded
A/X/Y and architectural status through stock RTI, with binary-mode body entry;
ST-20 observes only complete old/new vectors at every capture/publication/removal
boundary; ST-21 exercises two genuine RESTORE edges with a live generated route;
ST-22 retains stock CIA2 consuming-read and STOP terminal ownership. These are
not passes until the four-profile native gate runs. ST-15 predicts exactly one
7-write at `$0400`, one 9-write at `$0401`, in that order for the combined source.
The analytical wrapper/call/adapter costs and mixed simultaneous 10 = 1 + 9 peak
remain the separate immutable assembly/resource oracle. External total stack,
firmware completion and physical silicon behavior remain unproved.

Combined baseline confirms the prediction: exit 1; 157 expected failures and
59 passes, 216 cases in nine files, 14.35 seconds. Capture:
`/tmp/blend65-nmi-phase2.zRVGjp/all-phase2-red.log`. Failure reasons match the
tables above; no tool/syntax/emulator failure occurs. All ten frozen test/JSON
hashes match. Touched-document formatting, local link targets, ledger JSON,
governing source keys, whitespace and untouched frozen/production paths pass.
The authoring boundary is verified; compiler capability remains RED.

### Candidate discovery checkpoint

Task 2.2.1 allows only the existing cooperative stock-chained sink to materialize
reachable candidates before ownership checks. Exclusive/unqualified sinks retain
their guard with canonical E10245 wording. A final fail-closed semantic guard
still blocks positive NMI admission until the following proof/storage tasks;
there is no feature switch or publication bypass. This is an uncommitted
implementation intermediate, not a capability checkpoint.

Build passes. Three retained IRQ/CIA root files pass all 102 cases; three compiler
internal context/ownership/whole-program files pass all 28 cases. Logs:
`candidate-build.log`, `candidate-retained.log`, `candidate-internal-owned.log`
under `/tmp/blend65-nmi-phase2.zRVGjp`. The first internal invocation selected
the package config from the root and found no tests; it is not counted as a pass.
The corrected invocation runs from the compiler workspace. Four affected public
files remain expected RED, 52 failures/73 passes out of 125 in 7.03 seconds,
`candidate-red.log`. Canonical-message and known-overlap cases now progress;
positive routes, opaque/computed writer proof and recurrence witness remain
pending. No oracle, frozen authority or external state changes.

### Exact address and written-byte facts

Before task 2.2.2, the actual necessary edits exceeded its small-unit target.
The work is split into four producer/consumer units: address facts, selected
windows/route extraction, shared contexts and observer closure. Total is now
31 tasks; the feature scope and 24 independent case boundaries are unchanged.
The address helper replaces literal-only code, and the unchanged route selector
will be extracted before further whole-program facts cross the file-size ceiling.
Neither creates a framework, schema, new pass or source restriction.

Task 2.2.2.1 intersects exact scalar facts at joins/backedges, applies source
integer wrapping, follows ordinary load/store flow, and accounts for both word
bytes. Opaque writes carry a symbolic NMI vector effect through ordinary helpers
only while the high-level proof is live; no-hook raw control remains legal.
Mutable facts are invalidated across aliasing effects. Existing selected memory
windows are an optional internal input, connected by the next unit, not guessed
from numeric hardware addresses. Positive admission remains fail-closed.

Build and formatting pass. All 32 writer negatives and four no-hook controls
pass; the 12 pending positive cases are explicitly filtered only for this bounded
unit, not claimed GREEN (`address-green.log`, 36 pass/12 filtered, 2.77 seconds).
The unfiltered four-file run records 138 passes/12 expected positive failures
out of 150 (`address-directed.log`, 10.14 seconds), including all 102 retained
IRQ/CIA cases. Final compiler internal verification passes all 28 retained cases
(`address-internal.log`). Logs are under `/tmp/blend65-nmi-phase2.zRVGjp`.
All specification files and frozen authority remain unchanged. No intermediate
RED state is committed.

Task 2.2.2.2 connects the already-selected RAM/ZP windows to address proof and
mechanically extracts route selection without changing its behavior. Whole-program
and route owners are now 636 and 104 lines. Build, typecheck, formatting and
whitespace checks pass. Twelve unfiltered directed files record 214 passes and
104 expected capability failures out of 318 in 19.90 seconds
(`windows-directed.log`); all ten frozen oracle hashes still match. The affected
compiler internals pass all 28 cases (`windows-internal.log`). A temporary normal
project with the exact combined ST-15 flow reaches the remaining E10245 admission
guard rather than an E10278 alias failure (`windows-flow-probe.log`). This proves
the ownership endpoint, not final NMI admission, emitted targets or runtime writes.
No new test framework is used; the probe invokes the existing public service.
All logs/probe files are under `/tmp/blend65-nmi-phase2.zRVGjp`.

### Shared structural contexts

Task 2.2.2.3 retains the one finite structural context result on `WholeProgram`;
inventory/lowering's existing entry point returns that shared result. It extends
the existing optional root-local slot support to NMI and separates the incoming
vector from a handler's local install depth. IRQ-only context identities retain
their original shape. These structural bindings are not a live-observer proof:
the existing guard still prevents positive NMI admission until task 2.2.2.4 and
complete selected storage close that independent obligation.

Build, typecheck, all touched-code formatting and whitespace checks pass.
Four actual internal files pass all 36 cases (`contexts-internal.log`; the
invocation's nonexistent storage-domain filter selects no extra file and is not
counted). Five retained root IRQ/CIA files pass all 121 cases in 11.02 seconds
(`contexts-retained.log`), including assembled entry/link/output expectations.
No oracle or frozen authority changed and no positive NMI qualification is claimed.

The complete compiler-workspace suite also passes: 113 files, 1,674 passes and
the same two existing skips, 70.97 seconds (`contexts-compiler-suite.log`).
Command: `yarn test --maxWorkers=1 --minWorkers=1 --testTimeout=60000` from
`packages/compiler`. This is a package regression checkpoint, not the full
project checkpoint or positive NMI qualification. The independent observer-design
scrutiny remains pending; observer implementation has not started.

### Observer design scrutiny and small-unit split

The reused semantics reviewer independently compared relative ownership summaries
with the ordered vector/link relation. It recommends the latter inside the
existing context owner: the former cancels balanced installs and loses both CFG
succession and suspended readers. No user-owned ambiguity or new support surface
was identified. This is ordinary read-only design scrutiny, not fresh blind
qualification or implementation verification. Returning paths must be actual;
nonreturning source calls and handlers do not gain invented successor/tail edges.

The observer unit is split before execution into return facts/structural extraction,
capture/reader facts, ordered source transitions, interrupt/chain closure and
whole-program connection. There are now 35 tasks. The existing structural walker
moves unchanged to `interrupt-context-walk.ts` so the context owner can hold the
focused relation without exceeding the file-size ceiling. This replaces the
flat scan only for the qualified NMI proof; no general value interpreter, device
model, runtime selector, new registry, dependency or public interface is added.
The positive admission guard remains until the complete downstream proof closes.

Task 2.2.2.4.1 stops an ownership path after a call whose closed targets cannot
return, retains that body's reachable prefix peak and exports actual return facts.
The structural walker extraction is mechanical. Build, typecheck and whitespace
pass; 23 context/whole-program/machine internals plus nine CIA ownership internals
pass. The initial internal filter named a nonexistent interrupt-ownership file;
only the three selected files/23 actual cases are counted. The corrected
ownership invocation selects its actual nine-case file. Five retained root
files pass 132 cases in 9.59 seconds (`return-facts-retained-final.log`). An earlier
root filter named two nonexistent files; it selected only the actual ten-case
output file and is not an additional coverage claim. Logs are under the existing
Phase 2 directory. NMI admission remains guarded; no intermediate commit.

Task 2.2.2.4.2 defines the focused vector/capture/reader relation, retains
inherited readers separately and compares complete selected entry identities.
Build, typecheck, formatting and whitespace pass. A temporary Node assertion
probe uses a real frontend-lowered/selected route and verifies equal versus
different capture, expired versus inherited readers and trace-independent state
equality (`observer-facts-probe.log`). The immutable IRQ-only lifetime controls
pass all four profiles (four passes/24 deliberately filtered pending cases,
`observer-facts-control.log`). These are fact-helper checks, not ordered closure
or positive admission; their helpers are consumed by the following units before
any commit. No public export, new test runner or harness is added.

The actual ordered-source unit exceeded its intended small-unit size during
implementation. It is split into invocation/initializer and CFG/effect units
before verification; both are recorded implemented but unverified, not promoted.
This split happened later than the execution rule requires and is recorded as a
workflow miss. No scope or oracle changed. Before adding interrupt transitions,
the focused proof body moves to `interrupt-context-proof.ts`; the existing
context module remains its entry point. Sizes are 117/422/184 lines for context,
proof and mechanical walker. There are now 36 tasks. The extraction prevents the
next necessary addition exceeding the file-size ceiling; it adds no general
analysis layer or second binding registry.

Tasks 2.2.2.4.3.1–2 pass build/typecheck, formatting and whitespace. A real
temporary source project verifies ordered initializer ownership reaching main,
separate helper entry depths 1/2 across branches and balanced-loop convergence
(`ordered-context-probe.log`). It invokes the existing frontend/semantic/target
seams directly; it does not bypass a public admission gate or create a runner.
Five actual compiler files pass 42 cases (`ordered-context-internal.log`).
The current proof only covers source transitions; independent NMI arrivals,
wrapper chains and downstream consumption remain pending. No positive claim.

### Shared-result verification and necessary review corrections

The shared-result plumbing was implemented at 04:51, but is not verified complete.
Build/typecheck/formatting pass. The public lifetime subset passes 16 cases with
12 explicitly filtered pending positives; the full 12-file directed run records
222 passes and 96 expected capability/output failures out of 318 in 18.58 seconds.
The complete compiler workspace passes 1,674 cases with two existing skips in
113 files, 72.35 seconds (`shared-proof-compiler-suite.log`). These package and
negative-boundary results do not establish positive NMI admission.

The reused independent semantics reviewer found three necessary MAJOR corrections
before admission. Its read-only review covered the complete intermediate proof,
address facts, context/ownership integration and actual vector-lowering seam.
It ran no tests or emulator and made no blind-qualification claim.

| Finding | Concrete defect                                                                                                                            | Authorized technical ruling and smallest correction                                                                                                                   | State                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| SM-002  | A later mainline global store restores an exact address fact even though a selected interrupt can change that global before its load.      | Fix in the existing exact-address owner: invalidate affected mutable places through selected bodies/helpers, retaining already-evaluated values and disjoint globals. | Bounded producer fix independently clear; downstream qualification pending |
| SM-003  | A proved nonreturning self-installing handler continually extends an incoming-tail identity which it never observes.                       | Canonicalize that entry without its unused tail; retain actual local restore observers. No self-install ban or analysis-count budget.                                 | Bounded producer fix independently clear; downstream qualification pending |
| SM-004  | The abstract IRQ update is atomic, but existing machine code writes CINV low then high. NMI can expose or capture the intermediate vector. | Track only this bounded publication/removal phase; reject unproved IRQ exposure/capture while preserving genuinely equal published-entry transitions.                 | Bounded producer fix independently clear; downstream qualification pending |

Rulings are compiler-owned necessary corrections under AGENTS.md workflow
Prime Directive §4, not fabricated user acceptances or scope approvals. They
introduce no new API, runtime, profile, schema, harness, general evaluator or
blanket source restriction. Their independent new oracles precede implementation.
The existing integration task is split into five small units before corrections;
there are now 40 tasks, still the same two phases and capability boundary.
Existing vector/capture/reader facts move mechanically to a focused internal
file before further proof additions exceed the size ceiling. The context owner
and one shared result remain unchanged. Earlier bounded verification captures
remain recorded; the new findings gate the integration and admission checkpoint.
One independent fix review is required after correction. The positive guard
remains, and no RED intermediate is committed or pushed.

The independent new boundary file is 237 lines/60 cases: 15 source families on
all four profiles. Frozen SHA256:
`207c16b30ccd2b90ef3892e42d9729d70fb16587505eec2a19d5f0770fd1553b`.
The author read contracts, frozen knowledge/public interfaces and the existing
fixture only; no forbidden implementation. Before RED it separated the capture
fixture's unrelated changed-chain failure by selecting exactly the already-live
exclusive A variant and a paired no-transition control. No post-RED edits.
Prettier's parser/format check passed. An optional TypeScript API probe failed
before parsing because that import exposed no `ScriptTarget`; neither that probe
nor an unrun typecheck is represented as a pass.

| Baseline family                      | Actual result before correction                                                                       | Capture                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Two stale-address families           | 8 RED: guard E10245 rather than E10278 at the actual poke                                             | `boundaries-red.log`                                                   |
| Four changing-CINV families          | 16 RED: guard or inner capture failure instead of the main changing transition and required witnesses | `boundaries-red.log`                                                   |
| Seven safe controls                  | 28 RED: temporary admission guard still rejects                                                       | `boundaries-red.log`                                                   |
| Returning NMI with nonreturning main | 4 RED: temporary admission guard; checking itself terminates                                          | `boundaries-main-nonreturn-red.log`                                    |
| Self-installing nonreturning NMI     | Each of four isolated profiles exits 124 under a 15-second external process timeout                   | `boundaries-nonreturn-red.log` and its three profile-suffixed captures |

The non-hanging run is 52 failures/eight intentionally excluded nonreturning
cases, 2.74 seconds. The returning-handler run is four failures/56 intentionally
excluded cases, 1.83 seconds. All 60 distinct cases are accounted for. Timeout
terminates only the owned test process group; no compiler iteration limit,
production timeout, new runner, emulator or user-process termination is added.
Logs are under `/tmp/blend65-nmi-phase2.zRVGjp`. The original ten hashes and
frozen-authority paths remain unchanged. Acceptance expectations remain strict;
positive admission, bytes, runtime and hardware are still pending.

Task 2.2.2.4.5.2 replaces blanket startup suppression with selected per-domain
global clobber sets, following already-closed effects and helper targets. Existing
placement/windows classify raw aliases. The exact-address worklist retains source
install/pop lifetime depths only to invalidate mutable facts; it does not validate
ownership, bound interrupts or create a general state evaluator. Opaque callees
remain conservative. Mainline copies evaluated before installation survive; a
later store cannot reestablish a shared place while its modifying route is active.
Unrelated globals and evaluated values are retained. The helper is 324 lines;
the proof owner is 679, so its planned mechanical extraction precedes further work.

The first retry correctly detected the stale value but failed all eight new
assertions because the old ownership summary attributed the error to the later
restore. That failed attempt remains `global-clobbers-green.log`, not a pass.
The implementation now reports the live NMI raw-writer failure at the writer;
IRQ-only attribution is unchanged. Final directed stale cases pass 8/8 on all
profiles (`global-clobbers-green-final.log`, 1.96 seconds). The unfiltered retained
run is 168 passes/12 expected admission-guard failures in six files/180 cases,
11.93 seconds (`global-clobbers-retained.log`); all five retained IRQ/CIA files
and 36 writer negative/no-hook controls pass.

A temporary inline Node probe uses a real loaded project, frontend/semantic
lowering, closed handler/call targets and the actual address helper. It verifies
`$D020` for unaffected-global and evaluated-local cases, and unknown for the
interrupt-modified global (`global-clobbers-probe.log`). This is exact-fact seam
evidence, not public admission, emitted targets or runtime proof. No new runner.
Build/typecheck/format/whitespace pass, and five actual compiler files pass 42
retained cases in 4.60 seconds (`global-clobbers-internal.log`). The independent
combined fix review remains pending; SM-003/SM-004 still gate integration and
positive admission. No oracle changes or intermediate commit.

Task 2.2.2.4.5.3 mechanically moves the existing vector/capture/reader definitions
and helpers to `interrupt-context-facts.ts`; a normalized inverse comparison
confirms only type export visibility and formatting changed. The context owner
and shared result stay the same. Fact/proof sizes are 157/552 lines. Only the
entry-identity predicate changes behavior: a proved nonreturning body does not
include its never-read incoming tail. Actual local restore observers remain.

All eight nonreturning public cases now finish normally in 2.34 seconds, including
the four previously timed-out self-installs (`nonreturn-identity-directed.log`).
They still correctly fail their unchanged success expectations at the temporary
admission guard; this proves analysis termination, not positive qualification.
Build/typecheck/format pass, and the five retained compiler files pass 42 cases
in 4.57 seconds (`nonreturn-identity-internal.log`). Combined independent fix
review and IRQ intermediate-state proof remain pending; no commit or push.

Task 2.2.2.4.5.4 adds only the suspended IRQ low/high publication/removal
phase to the existing vector relation. NMI source IRQ capture/restore or an
eligible IRQ during that phase produces canonical E10245 at the responsible
parent update, with the owning NMI and actual observing-operation witnesses.
An exactly equal selected entry leaves both bytes unchanged. Restore retains
its saved-word owner until the publication completes. Vector-operation and
return preludes include their actual instruction boundary after CLI/PLP;
ordinary source control still uses the selected NMOS old-I sampling rule.
There is no new instruction interpreter or source-syntax restriction.

The first build failed on a readonly-array assignment and is retained as
`irq-transition-build.log`. The corrected build and typecheck pass
(`irq-transition-build-final.log`, `irq-transition-typecheck.log`). All 24
immutable rejection cases pass across four profiles in 2.42 seconds
(`irq-transition-negative-green.log`); the other 36 are deliberately filtered
in that negative-only run. The unfiltered 60-case run completes in 2.66 seconds:
24 pass, and all 36 positive cases fail only at the unchanged temporary
admission guard (`irq-transition-directed.log`). This is not a positive
check/build or runtime qualification. All 42 retained compiler cases pass in
4.66 seconds (`irq-transition-internal.log`). The five unchanged IRQ/CIA
public files also pass all 132 cases in 10.89 seconds
(`irq-transition-retained.log`). The independent fix
review is running; integration cannot be promoted before that review clears.
All eleven frozen oracle hashes remain unchanged. No commit or push.

The complete compiler package suite remains GREEN: 113 files, 1,674 passed,
two existing skips, 79.66 seconds (`irq-transition-compiler-suite.log`). This
does not promote public positive NMI admission. During the combined review,
the reviewer identified one remaining diagnostic attribution defect: symbolic
raw-writer effects omit their source span, so a helper write fails at the
ordinary call rather than at the actual writer. The existing integration unit
is split into independent spec, span preservation and final integration units
before correction; 42 tasks still describe the same two-phase capability.
The technical ruling is to retain the original writer span in the existing
effect, not add a new diagnostic or analysis mechanism. Independent RED comes
first. The review's emitter-order scrutiny continues, and no finding is yet
declared independently cleared.

Task 2.2.2.4.5.5.1 supplies an implementation-blind, frozen 105-line helper
writer oracle: three negative families and three paired raw-management controls
on four profiles (24 cases). Direct, two-helper and opaque-address writers all
require the actual helper poke span in both public services. SHA256:
`207aa1e85dabbe75a83ab0599b1f6f4300c7bf033041d1b32fc3ec4098dc87fb`.
The author reads contracts/public declarations/the existing fixture only, runs
targeted Prettier parsing/formatting but no tests/build/emulator, and edits no
existing file. Parent-owned RED precedes correction: 12 attribution failures
and 12 already-GREEN legal controls, 3.05 seconds (`helper-writer-red.log`).
Failures have E10278 but identify the ordinary call, not the actual poke. The
raw controls reach genuine publication without claiming runtime qualification.

Task 2.2.2.4.4 closes independent arrivals and actual chain transfers with inherited
readers kept separate. Equal states return through monotonically discovered source
exits; no activation/iteration budget is used. A new chain fails only when its
continuation extends an active equivalent source entry, not merely because another
finite incoming binding exists. Capture-before-publication also permits NMI entry
while IRQ is masked. Nonreturning bodies have no invented chain exit.

Eight real-source semantic probes pass (`observer-close-probe.log`): empty NMI,
finite main nesting, same-handler finite main nesting, direct/helper changed IRQ
capture, B/C growth, finite IRQ-owned NMI and equal exclusive-IRQ captures. The
changed IRQ failures retain their exact primary source and repeated capture spans.
The proof step measures 0.8–2.9 ms on these small inputs; no scaling claim follows.
Build/typecheck and all 42 selected compiler internals pass
(`observer-close-build.log`, `observer-close-typecheck.log`,
`observer-close-internal.log`). These direct seams are not a public admission or
runtime pass; the guard remains. Shared-result/raw-reader plumbing is next.

### Helper corrections and interrupted verification recovery

SM-005's original helper-writer span now survives the existing symbolic raw
effect. All 24 helper-writer cases and 24 boundary negatives pass in 4.30 seconds
(`helper-writer-green.log`); 36 positive boundary cases are deliberately filtered.
Build/typecheck and the 42 retained compiler cases pass in the corresponding
`helper-writer-*` captures. The independent bounded review clears this attribution
fix, not final admission or runtime qualification.

SM-006 adds no new ownership pass: address recovery consumes the existing memoized
returning depth effects; context proof uses the same stored ownership result.
The independent 100-line, 16-case helper-lifetime oracle has SHA256
`9d3e0c7b422adf38efb5d54e3c292d12cb709a28d7339b26979bd17fe8c0f41c`.
Parent-owned RED is 12 failures/four passes in 2.16 seconds
(`helper-lifetime-red.log`): eight helper cases have false E10278, four inline
positives hit the admission guard, and four partial-pop negatives already pass.
After the correction, build/typecheck pass; the 100-case combined run has 52
passes and 48 positive failures only at the unchanged guard in 5.24 seconds
(`helper-lifetime-directed.log`). This is not public positive qualification.
The independent review clears SM-006's bounded lifetime transfer, including
unknown/mixed alternatives and surviving nested ownership.

The reviewer then finds MAJOR SM-007: address recovery continues after all closed
call targets are proved nonreturning, eagerly summarizing an unreachable later
helper and producing false E10278. The compiler-owned correction is to stop just
that path and its successors. Unknown or returning alternatives remain live.
The two prerequisite units are added before execution: an independent frozen
oracle and the narrow existing-owner fix. Total 46 tasks still cover the same
two phases and capability boundary; no new API, pass, runtime or source ban.
SM-007 and the final integration remain pending independent fix review.

The root filesystem became full during verification around 04:34–04:41 UTC.
Zero-byte `helper-lifetime-internal*` and `helper-lifetime-probe*` captures are
not passes, even when shell output or exit status was lost. A direct stdout-only
four-case lifetime probe completed, but it is supporting seam evidence, not a
durable public/runtime qualification. No user files or processes were removed.
On resume at 06:57:56 UTC, root has 16 GB free. The exact zero-byte Vite config
scratch from the failed run is removed after validation; interrupted checks
must be rerun with nonempty captures. No RED intermediate commit or push.

The resumed retained compiler run has a nonempty capture and passes all five
files/42 tests in 7.13 seconds (`recovery-internal.log`). The new implementation-
blind nonreturning-path oracle is 121 lines/16 cases, SHA256
`21a37f1dc72cb907bc00b0fe3b63ebffafcb7606e12ccda5b8487843890f220c`.
Its eight success cases cover direct terminal calls and finite all-nonreturning
indirect calls before a successor block. Eight returning/mixed-target controls
use a genuinely opaque address and retain the actual helper writer's E10278.
Parent-owned RED is eight false-E10278 failures/eight passing controls in 3.03
seconds (`nonreturning-paths-red.log`). No oracle was changed after RED. The
author's broad declaration discovery listed internal filenames only; no forbidden
implementation contents were read. The nine-line correction stops the existing
block path and successors only when a nonempty closed target set is entirely
proved nonreturning. Independent bounded fix review and verification are pending.

SM-007 is now independently clear: no surviving finding in the nine-line fix.
Explicit nonreturning results alone suppress a path; mixed, unknown and empty
sets stay conservative, and the block-local flag cannot erase another reachable
predecessor. The correction adds no generated instructions or resource cost.
This clears the bounded helper/address/shared-proof integration, not admission,
private storage, same-entry machine labels, final layout or runtime qualification.

Fresh corrected captures are nonempty:

| Check                                  | Result                                                                                      | Capture                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Build / typecheck                      | PASS, four build tasks / six typecheck tasks                                                | `nonreturning-paths-build.log`, `nonreturning-paths-typecheck.log` |
| Four new boundary concerns             | 60 PASS; 56 positives fail only at unchanged E10245 admission guard, 10.30 seconds          | `nonreturning-paths-directed.log`                                  |
| Retained IRQ/CIA public cases          | PASS, five files/132 cases, 15.02 seconds                                                   | `nonreturning-paths-retained.log`                                  |
| Complete compiler package              | PASS, 113 files/1,674 cases; two existing skips, 86.62 seconds                              | `nonreturning-paths-compiler-suite.log`                            |
| Actual ownership/address lifetime seam | PASS, inline/direct/transitive final-pop `$d020`; nested partial-pop remains unknown/E10278 | `recovery-lifetime-probe.log`                                      |

All 14 frozen oracle hashes match; frozen specification/expert paths and
`git diff --check` are clean. Targeted new-code/oracle Prettier passes. The three
pending producer/integration tasks are promoted only to their recorded bounded
verification endpoint. All positive publication, storage, machine, cost, VICE
and final full-root checkpoint owners remain open. No commit or push.

### Shared link inventory

The existing binding-consumer unit is split before execution into five small
units: physical inventory, canonical entry identity, platform binding, helper
specialization and wrapper binding. The identified existing specialization/state
modules are named before edits; this remains the same approved compiler seam,
not a new support surface. Total 50 tasks, same two phases and product scope.

Inventory uses the shared proof's actual request IDs instead of independent
mainline maxima for mixed routes. Handler source ownership is recovered directly
from the existing source/context map, not by parsing identities or adding a
registry. Each proved link is two bytes, page-safe and reserved while old readers
may observe it. Mainline versus IRQ/NMI ownership and root identity are retained;
ordinary IRQ-only inventory remains unchanged. Invocation-private closure and
the final link exemption proof remain task 2.2.4, not implied by `persistent`.

Twelve real-source proof/inventory probes pass across four profiles
(`link-inventory-probe.log`): one main link, two nested main links and the
main-NMI/IRQ-owned-NMI case have exactly one/two/three disjoint words (2/4/6
bytes), correct source/domain ownership and all required interference pairs.
These inspect real semantic, ownership, context and storage objects but do not
bypass the public admission guard or claim assembled output qualification.
Build/typecheck pass (`link-inventory-build.log`, `link-inventory-typecheck.log`);
all eight storage files/56 tests pass in 8.39 seconds
(`link-inventory-storage.log`). Targeted formatting and whitespace checks pass.
No new immutable oracle or existing test changed. No commit or push.

At the user's housekeeping request, 80 confirmed stale Blend65 temporary items
from completed work (about 3 GB) are moved to recoverable Trash. Exact top-level
targets are validated against repo records or test factories, owner/type/age and
the absence of open files. Current Phase 1/2 evidence stays in place; unattributed
names and all unrelated `/tmp` contents are untouched. Repeat bounded cleanup
before each new plan task, without deleting evidence still needed by its review.

Canonical entry selection moves unchanged to the existing semantic facts owner,
returning the same identity and observed tail for proof and lowering. Machine
labels have an internal proved-selection mode: unread-tail entries are independent
of depth, while read-tail entries identify the actual word. Ordinary IRQ-only
spelling is unchanged. Twelve real-source identity/inventory probes pass
(`entry-identity-probe.log`); build/typecheck and six retained compiler files/44
tests pass in 5.53 seconds (`entry-identity-*` captures). This is a label-selection
seam, not final emitted-label qualification; the wrapper consumer remains open.
Before the next task, the five zero-byte disk-full captures named above are also
moved to recoverable Trash. Their failure history remains recorded; nonempty
successful reruns and current evidence are retained. Total cleanup: 85 items.

Platform binding carries the existing complete context type through function
lowering instead of duplicating optional local-depth fields. Install/restore use
the shared predecessor-word selector for both sinks, require its proved binding
and select only a captured canonical entry. Missing proof is an internal lowering
failure; no new source restriction or diagnostic template is introduced.
The first build catches an explicit-undefined optional property and fails
(`platform-binding-build.log`). Omitting that property fixes the type error;
build/typecheck/formatting then pass (`platform-binding-build-final.log` and
`platform-binding-typecheck.log`). Twelve real-source direct-body lowering probes
pass across four profiles, with every 2/4/6-site fixture using its exact proved
word and canonical label and no new private scratch (`platform-binding-probe.log`).
All five retained IRQ/CIA public files/132 tests pass in 10.81 seconds
(`platform-binding-retained.log`). Wrappers, selected saves, final publication,
placement and full public positive qualification remain their later owners.
The pre-task cleanup check finds no new named items or further confirmed stale
captures. No commit or push.

Helper specialization now retains the selected root and both local sink depths
for mixed routes, while ordinary IRQ-only labels keep their old spelling.
Build/typecheck pass; four retained compiler files/27 tests pass in 4.39 seconds
(`helper-binding-internal.log`). Sixteen real-source helper/machine probes pass
across four profiles (`helper-binding-probe-final.log`), including three distinct
entries of the same ordinary helper from mainline and IRQ contexts. All call
targets select the corresponding entry and the four-word mixed fixture adds no
private scratch. The first supporting probe failed because it inspected two
nonexistent diagnostic fields; correcting the probe to use the existing binder
and machine IDs fixes that harness error without changing a compiler or oracle.
Wrapper, publication, placement and public positive qualification remain open.
The repeated cleanup check confirms all 85 recorded stale items are absent from
their old paths; active evidence and unattributed names remain untouched.

The wrapper consumer now uses the shared canonical entry and physical tail word,
leaving IRQ-only construction unchanged. Build/typecheck pass
(`wrapper-binding-build.log`, `wrapper-binding-typecheck.log`); the same four
retained compiler files/27 tests pass in 4.16 seconds
(`wrapper-binding-internal.log`). Sixteen real-source machine probes pass
(`wrapper-binding-probe.log`), checking unique labels and the exact indirect
tail word for each observed entry. This is not the task's complete endpoint.

A further edge probe fails: a selected IRQ entry that remains masked throughout
its installation has a captured canonical identity but no observable invocation
context, so its installer refers to an absent wrapper
(`wrapper-binding-edges.log`). Do not invent an IRQ arrival merely to produce
code. The existing nonreturning-path oracle also requires dead suffix/successor
handling at emission, not merely suppression of ownership diagnostics. An
independent bounded semantics assessment is in progress before choosing an
additional producer/materialization seam. No new facts, source restriction,
dead-entry policy, optimizer, oracle change, commit or push is authorized by
this supporting probe. The task is not promoted and positive admission stays
guarded.

The independent review confirms MAJOR SM-008/SM-009 at these intermediate
producer/consumer seams. It rejects fabricated arrivals, fallback resurrection
and unqualified reference-only aliases. AR-P15 records the smallest bounded
correction direction and its unresolved entry-materialization contract. The unit
is blocked at that runtime gate, with 36/50 verified tasks. No new oracle,
producer fact, CFG projection or dead-entry policy has been implemented.

### Approved execution-selection correction

The user approves AR-P15 on 2026-10-04. Five small existing-owner units replace
the blocked wrapper unit; the derived count is 36/54. Independent specification
authoring precedes any producer/consumer correction. Selected addresses and
actual arrivals remain different facts; raw source dependencies retain their
real bodies. The exact reference-only construction is assessed independently
before its immutable byte expectation is authored. No general optimizer,
evaluator, new API or source restriction is added.

On resumption, both previously recorded Phase 1/2 `/tmp` evidence roots are
absent, and no Blend65 top-level `/tmp` item remains. Their earlier recorded
results are history, not newly inspected raw evidence. Fresh verification is
captured under `/tmp/blend65-nmi-ar15.cZhloG`; the current source changes remain
intact. Baseline build passes. No additional temporary item is deleted.

The primary's earlier release-metadata read accidentally included qualification
summary rows. Those rows are not passed to independent authors/reviewers or
used as decisive blind-check evidence. This is an implementation correction,
not expert-skill qualification; the frozen authority remains unchanged.

AR-P15's fresh independent behavior file is frozen at `f0e1f18d` (28 cases);
RED has 24 positive failures at the unchanged admission guard and four safety
passes. The separate independently derived reference-byte file is frozen at
`dba949e4` (16 cases), all RED at that guard before construction. The authors
received an explicit implementation-blind forbidden-file list and attest that
no forbidden implementation, generated evidence or grader was read. Existing
14 immutable hashes remain unchanged.

The guarded producer/fact, projection and consumer endpoints pass build,
typecheck, 92 retained tests and 28 fresh actual-source seam builds through
storage, layout, serialization and native ACME. They are not public admission
or runtime qualification. The first consumer build fails from a local context
type inference; explicit existing type annotations correct it. Two supporting
probe attempts fail from nonexistent diagnostic property names; correct schema
fields fix the probe, without compiler/oracle changes. All attempts are retained.

Bounded correctness review of `e6a9ac81` → `61f23d50` identifies MAJOR RV-001:
the raw dependency closure follows calls but fails to rescan retained raw bodies
for materialized addresses. A raw Q exposing `word(&R)` can omit R while still
emitting its symbol. The SFA reviewer independently identifies the same witness;
merge by that invariant. Disposition: direct necessary correction to AR-P15's
already approved transitive source-dependency contract; no new product/scope or
user-owned design choice under the workflow prime directive. Author a fresh
independent address-dependency oracle, capture RED, correct the existing walk,
and perform one fix-only review. Task 2.2.3.5.3 returns to verification pending;
no positive admission or commit occurs with the finding open.

The raw transitive-address oracle is independently frozen at `4e147722`
(eight cases), with all expected RED failures captured in
`raw-dependencies-red.log` before the walk correction. The existing exclusive
CINV reference shell has a separate semantics assessment and independent oracle
`f0d5b8e6` (eight cases); `exclusive-reference-red.log` precedes its direct
firmware-tail construction. Neither construction adds an API or source rule.
The SFA review also requests a real producer probe of an ordinary helper that
is both raw-retained and actually called under a nonzero NMI depth. That
candidate is not yet verified; complete the probe before final disposition.

`context-witness-probe.log` now confirms MAJOR RV-002: main really calls
H under NMI depth one, but raw Q→H retention replaces H's base-label context
with raw0. Lowering then fails its capture-identity invariant. Disposition:
preserve the actual observed base-label context; use default raw materialization
only in its absence. This is the already approved observed-context/dependency
contract, not an external raw-caller guarantee. Independent oracle authoring
precedes correction. Task 2.2.3.5.4 returns to pending; no admission or commit.

Extended native probing also exposes RV-001's consumer half: the final raw-entry
loop collected operand labels before emitting Q, so R referenced only by Q
remained omitted after correct producer retention. The same closed dependency
set now drives that loop, without an extra registry or arrival. Two supporting
extended probe attempts are retained as failures: first a wrong expected capture
count (equal real captures coalesce), then the actual R omission. Only the
temporary probe's structural count is corrected; immutable oracles stay fixed.

The RV-002 helper oracle is independently frozen at `2fd5cfe5` (four profiles);
`raw-helper-context-red.log` captures all expected failures before the correction.
At 12:00 the existing lowering loop keeps actual contexts and adds raw0 only
when no observed mainline context already owns the ordinary source label. The
retained body uses that actual label's real capture choice; no proof/context
map is mutated and no raw external safety is certified. Reverification pending.

Final bounded production tree `e2b68d20` passes build/typecheck, 12 retained
files/92 tests, 48 extended actual-source/native ACME cases and four observed
helper-context cases. Exact chain/exclusive shell bytes, fixed `$2000` placement,
observed nonreturning entry precedence and transitive raw addresses are covered
by actual native artifacts. Correctness/SFA fix-only review clears RV-001 and
RV-002; semantics fix-only review clears the corresponding SM-001. All five
new independent oracle hashes match; 60 expected positive failures/four safety
passes at the unchanged public guard are recorded, not reported as GREEN.
No compiler capability/public runtime qualification or green commit is claimed.

AR-P16 records the remaining raw-only typed-installer contract. The fresh
`raw-unobserved-install-probe.log` confirms a machine binding failure when raw
Q→H is retained but H never really executes and installs/restores empty NMI C.
It cannot be repaired by treating main's real B capture as H's imaginary
capture. Semantics/SFA identify this as an unresolved materialization-versus-proof
boundary, not authority for a new source prohibition. Independent challenge
assesses the smallest existing-owner contract; implementation/admission pauses
on that edge under the mandatory runtime-ambiguity gate. Counts derive as 40/54;
the entry-materialization unit is blocked rather than marked verified. No push.

Independent challenger recommends conditional materialization qualification
through the same existing owners. The installer/site/ABI/physical word and local
balanced effect must remain separate from unknown incoming predecessor and
actual capture evidence. In particular, null already denotes stock and cannot
be reused to mean unknown. Complete NMI body/ABI, placement, coherent capture,
publication, live-link safety and storage closure remain mandatory. The challenge
does not prove those obligations or grant a new source condition. Confidence is
Medium; proof first, independent oracles second, implementation only if qualified.
AR-P16 remains open for the bounded approval; no additional compiler edit follows.

### AR-P16 qualification and independent RED — 2026-10-04

The user approves qualification first and correction only after the narrow
contract passes. Independent SFA and semantics assessments qualify noncertifying
raw-source retention, not external execution. Both report no findings against
the separated contract; exact physical closure/bytes/runtime remain Unknown.
Actual contexts/captures/reached points and the public E10245 guard stay intact.

The independent specification author writes only the new raw-installer output
oracle, from frozen contracts and public record signatures. It attests no
forbidden implementation, old oracle or generated-evidence reads. Eight cases
(empty/store C across all four profiles) are RED at the existing guard before
correction. SHA-256 `453aa62378bb0fb2bd54129a9efaca775eeb24cf83b1cd99619a7e7dcbc63ee3`.
The main runs `raw-installer-spec-red.log`; no byte endpoint is reached. The
oracle requires complete raw Q/H code, one coherent separate retained word,
matching restore/C-tail and demand-save expert output, not actual raw execution.

The SFA design follow-up identifies two necessary safeguards (SF-001/SF-002):
net-changing observed helpers cannot be reused without preserving word identity,
and nested installed-entry traversal cannot grow an infinite namespace or erase
tail correlation. Existing ownership summaries and the structural walk own these
corrections; no new runtime, registry, evaluator or source restriction. Additional
independent cross-call output cases precede that consumer correction. This is
required completion of the approved retention contract, not an optional feature.

Final documentary validation passes: targeted source/oracle/document formatting,
94 local file links across six touched documents, clean diff whitespace and the
plan engine's 40 verified/one blocked/13 not-started tally with no structural
problems. All 14 earlier locked oracle hashes remain exact; `spec/` and the active
expert directory remain untouched. The roadmap's blocked overlay records the
AR-P16 wait under DEF-7. Its 4/10 count is confirmed by the roadmap engine;
portfolio drift predates this unit and its cascade remains deferred on
`feature/v4-rebuild`, per the branch rule. No unrelated roadmap is rewritten.
Only the current `/tmp/blend65-nmi-ar15.cZhloG` evidence root remains; its logs
and artifacts are still required, so no further scratch deletion is warranted.

### AR-P16 implementation review — AR-P17 stop 2026-10-04 13:36

AR-P16's separated retention contract qualifies; its implementation does not yet
pass independent review. Baseline tree
`85c7b561ecb7b1bce9471d780343fd780088ffff` → candidate
`d9d7a76a6ac03f63631bc325fecfa5bc9f1e857f` isolates this correction from
the earlier dirty Phase 2 work. Three native roles review that bounded diff:
correctness, SFA/ABI and semantics/DX. The reviewers report no unavailable-role
fallback. They do not run costly compiler/emulator checks concurrently.

The additional independent owner-continuation oracle is frozen before correction:
`test/rd05/nmi-route-raw-owner-continuation.spec.test.ts`, SHA-256
`8b27f4372c658bc080fdf1c727c68541fd250e8fe8df6606ef570d45d53ac83a`.
`raw-owner-continuation-spec-red.log` records eight expected failures at the
unchanged public E10245 guard. Together with `453aa623`, these are 16 RED
public output cases, not qualified bytes or runtime. Both full hashes stay exact.

Existing ownership/walk/facts, inventory and lowering now distinguish actual
execution proof from noncertifying retained ABI/body/word demands. Compatible
balanced observed helpers are reused; retained selected body namespaces are
finite by source/ABI while wrapper identities retain their exact tail word.
SF-001/SF-002's design safeguards survive the supplied guarded cycle/net-effect
cases. This does not clear every downstream call/storage/path consumer.

| Review finding           | Severity | Evidence and disposition                                                                                                                                                                                                                                                                             |
| ------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RV-001                   | MINOR    | The new installer/continuation oracle files are 311/331 lines; the approved testing strategy requires below 300. Report-only; no frozen oracle is silently split or edited. A later mechanical split requires its exact authority, or an explicit size exception. No new abstraction is proposed.    |
| RV-002 = SF-003 / SM-001 | MAJOR    | Caller-context storage rewriting conflicts with the selected observed callee ABI. The byte-parameter witness fails final shared storage binding. The same selection obligation covers aggregate hidden-return homes and memory effects. Open; AR-P17 ruling required.                                |
| RV-003 = SF-004          | MAJOR    | Retained traversal/lowering uses an unreachable suffix after a proved nonreturning call. Its restore has no valid static link. Open; reuse existing return summaries, preserve raw dependencies and all returning/unknown alternatives.                                                              |
| RV-004 = SM-002          | MAJOR    | Indirect-thunk eligibility counts actual execution variants, not retained emission variants. The real H/K function-pointer witness emits a canonical-address JMP although a different retained installer-word variant is selected. Open; use existing emission selection and finite-target dispatch. |

Correctness review finds no other bounded correctness/maintainability defect and
confirms the new oracle hashes and no old/frozen-file edits in this correction
diff. SFA and semantics review identify the three MAJORs above; the repeated
argument mismatch is merged once. Their narrower contract/design assessment
does not qualify the implementation. Semantics/DX fails at these guarded seams,
not because of a required source limitation.

Main independently reproduces all three using real source and actual producer/
consumer objects in the supporting `selection-probe.mjs`; it does not remove
the admission guard, fabricate contexts/arrivals/captures or mutate actual proof
facts. These probes stop at their first PAL/6581 failure, before a final native
artifact. They do not establish four-profile failure or runtime behavior.

| Endpoint                         | Actual result / log in `/tmp/blend65-nmi-ar15.cZhloG`                                                                                                                                                                                                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Final build and typecheck        | PASS: `raw-materialization-build-3.log`, `raw-materialization-typecheck-final.log`. The earlier build-2 TypeScript failure is retained and corrected, not counted as a pass.                                                                                                                                                                                 |
| Retained directed package cases  | PASS: 12 files / 92 tests, `raw-materialization-retained-tests.log`.                                                                                                                                                                                                                                                                                         |
| Guarded native ACME seams        | PASS: 48 general + 16 retained-contract + four raw-only installer + four observed-context cases = 72; `raw-materialization-retained-native-final.log`, `raw-retained-contract-native-final.log`, `raw-unobserved-install-native.log`, `raw-observed-context-native.log`. Actual-proof hashes remain unchanged; these do not cover the new failing witnesses. |
| Parameter/context witness        | FAIL: `raw-review-param-witness-2.log`; `machine-storage-binding`. Actual main H(7), raw Q→H(9), balanced H installer/write/restore; wrong callee home survives until the binding consumer.                                                                                                                                                                  |
| Nonreturning suffix witness      | FAIL: `raw-review-dead-witness.log`; “Interrupt restore has no active static link”. H calls an infinite-loop terminal function before its unreachable install/restore.                                                                                                                                                                                       |
| Function-pointer variant witness | FAIL: `raw-review-indirect-witness.log`; the consumer detects an indirect source-address JMP despite distinct retained H/K word variants. No actual main H/K call is added to mask the bug by disabling that thunk.                                                                                                                                          |

These supporting passes are not a public GREEN, complete storage/output/cost
qualification, VICE run, full phase checkpoint or hardware proof. Other failed
supporting attempts remain recorded. No new old-oracle exception, API, runtime,
source restriction, evaluator or second registry is proposed. Expert lineage is
2.0.3/content `22cc5f00`, frozen Specification 4.0; normative CPU/CIA/KERNAL
keys remain `MOS-PGM-1976`, `MOS-HW-1976`, `MOS-6526-1981`,
`CBM-C64-KERNAL-03`.

AR-P17 records the single bounded correction recommendation. The execution
skill's normal-mode MAJOR-finding rule pauses correction pending the user's
ruling. Task 2.2.3.5.5 is `[!]`; progress remains 40/54, with 13 later tasks
not started. No source fix follows this review gate, no unit is promoted and no
RED commit/push is made. Remaining output/platform reviews belong after the
correction verifies; they have not been reported as complete.

Stop-record validation passes: formatting, clean diff whitespace, 94 local links
across the six touched documents, the seven latest frozen-oracle hashes and
unchanged `spec/` / active expert paths. The plan engine reports 40 verified,
one blocked, 13 not started and no structural problems. Roadmap arithmetic
confirms the feature's 4/10; the portfolio still holds its earlier 1/10 summary
and now lacks this blocked overlay. Its reconciliation is deferred on this
non-integration branch, not silently written across worktrees. No compiler or
test source was changed after candidate `d9d7a76a` during this stop-record work.

## AR-P17 approved correction and fresh RED — 2026-10-04 14:22

The user's “I approve” resolves AR-P17 for the three bounded corrections,
not for verification or public admission. Pre-implementation baseline tree is
`98162b0b461d0479d5570e8d1afa96bde59d4e9d`; production/test source still
matches the reviewed `d9d7a76a` candidate. The existing unit is subdivided into
test authoring, call-ABI selection, retained no-return projection and final
fix verification. This adds no capability or support surface.

| Fresh independent oracle                       | Cases / lines | Frozen SHA-256                                                     |
| ---------------------------------------------- | ------------- | ------------------------------------------------------------------ |
| `nmi-route-retained-call-abi.spec.test.ts`     | 8 / 218       | `b8fd9750b628fb660a53b3c86f3ecd01eed6af1dbc2f184e7f3da9ba1e27a7b3` |
| `nmi-route-retained-indirect.spec.test.ts`     | 8 / 178       | `fbe25bd1ad737c2ddab42cc5f9fea5f4952b0b9fbcce8c7b90a75ab0c82e4587` |
| `nmi-route-retained-nonreturning.spec.test.ts` | 16 / 206      | `5f314147227631b889b1a18faf1d19943e98038e746bd2e07d3046138379d342` |

The implementation-blind author reads only the assigned frozen contracts,
public signatures and profile fixture. Public artifact field names and the
normative `pokew` spelling are clarified before freeze, not derived expectations.
The earlier allowed testing-strategy read included its remainder; that exposure
is disclosed, with no implementation, old NMI oracle or qualification-answer read.
All three files pass targeted formatting and prohibited-reference checks.
`ar17-spec-red.log` records 32 expected failures at the unchanged public
admission guard and no prepasses. No case reaches its final-artifact assertions.
Task 2.2.3.5.5.1 is verified as specification authoring/RED, not compiler GREEN.

Fresh guarded probes also reproduce the parameter and aggregate hidden-return
storage-binding failures (`ar17-param-before.log`, `ar17-aggregate-before.log`),
the indirect-variant failure (`ar17-indirect-before.log`) and direct/all-target
no-return suffix failures (`ar17-dead-before.log`, `ar17-finite-before.log`).
The mixed returning path and compatible canonical thunk pass four-profile
native seams (`ar17-mixed-before.log`, `ar17-canonical-before-2.log`). The first
canonical probe attempt failed in temporary diagnostic formatting of a BigInt,
not compilation; the corrected temporary message leaves its expectation exact.
The conditional no-return path also reproduces the suffix failure. All failed
attempt logs remain. No production fix precedes fresh RED, no frozen oracle is
changed, and no commit/push is made at this intermediate boundary.

### Call-ABI and indirect selection correction — 2026-10-04 14:29

Only `machine/interrupt-specialize.ts` and `machine/lower-indirect.ts` change.
Labels and target-owned parameter/hidden-return homes now select the same
existing ABI descriptor. Caller staging and final aggregate destinations keep
their caller descriptor. Per-body call-span memoization avoids rescanning the
source graph for every argument byte/effect; it is not a new analysis stage.
Indirect thunk eligibility compares the selected emitted target with the stable
source address using the existing actual-plus-retained emission catalogue. A
different ABI uses the existing finite comparison dispatch; a compatible
canonical target keeps its thunk. No extra body, runtime, source rule or public
schema is added.

Build/typecheck pass (`ar17-call-build-final.log`, `ar17-call-typecheck.log`).
The directed package set passes 12 files/92 tests
(`ar17-call-retained-tests-2.log`). Parameter, aggregate, retained indirect and
canonical-control native probes pass all four profiles: 16 guarded seams
(`ar17-param-final.log`, `ar17-aggregate-final-2.log`,
`ar17-indirect-final.log`, `ar17-canonical-final.log`). The parameter probes
check the call write against the selected callee read and source value 7/9.
Aggregate probes check both incoming destination bytes and caller ownership of
the final result home. Actual proof hashes remain exact through consumers.

Earlier build failed on a removed-use import, then passes after removing it.
An initial directed command used the root-only test configuration and found no
package tests; its corrected package command is the 92-case result above.
A temporary aggregate assertion initially recognized only direct storage,
not the same pointer's typed indirect operand; the corrected seam expectation
still requires the exact incoming pointer and both bytes. All failed logs remain.
The frozen public oracles are unchanged and still stop at admission; this is
not public byte/runtime qualification. Fix-only independent review remains due.

### Retained no-return projection correction — 2026-10-04 14:34

The facts owner reuses its existing CFG projection for retained executable
bodies. Existing return summaries remove a call's continuation only when every
closed target is proved nonreturning. The retained walk, physical installation
demands, inventory and lowering consume that same projection. Independent raw
address/dependency collection remains separate and unchanged; no actual arrival,
capture, reached point or safety proof is invented.

Build/typecheck pass (`ar17-projection-build.log`,
`ar17-projection-typecheck.log`). Fresh directed package verification passes
12 files/92 cases (`ar17-final-retained-tests.log`). Native probes pass 108
four-profile seams: the prior 72 (`ar17-general-native.log`,
`ar17-contract-native.log`, `ar17-unobserved-native.log`,
`ar17-context-native.log`), 16 call-selection cases (`ar17-*-composed.log`),
and 20 direct/all-target/returning/mixed/conditional cases
(`ar17-dead-after.log`, `ar17-finite-after.log`, `ar17-returning-after.log`,
`ar17-mixed-after.log`, `ar17-conditional-after.log`). Dead installations and
their physical demands are absent; the preceding terminal calls remain. Mixed
and returning paths keep their installations; the conditional other path keeps
its writes. Real successor and merge edges remain closed. Actual-proof hashes
stay unchanged through downstream consumers.

All ten recently frozen oracle hashes still match, with `spec/` and the active
expert untouched. These are guarded producer→binding→native-ACME endpoints,
not public GREEN, VICE/runtime, complete artifact costs or silicon proof. The
three MAJORs are corrected for these witnesses, but remain review-pending until
fresh fix-only independent reviews clear the bounded candidate.

## AR-P17 fix review and AR-P18 stop — 2026-10-04 14:56

Review baseline is `98162b0b461d0479d5570e8d1afa96bde59d4e9d`, candidate
`bb11b0e6dc09b6c41e3e10ee73e8a9e91a9e0fe3`. Tree-to-tree diffs include the
three new oracle files and six production owners, excluding earlier dirty Phase
2 work. Native correctness and SFA roles start; the first new semantics dispatch
hits the runtime thread limit. The existing independent xhigh reviewer resumes
under the complete semantics charter as the bounded generic fallback. All three
reviews remain read-only; main alone owns verification.

| Lens                    | Result / boundary                                                                                                                                                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Correctness / standards | No new surviving findings. Exact three new oracle hashes, implementation-blind authority and 32-case RED are checked; no existing test/spec/expert changes in this diff. Prior 311/331-line MINOR remains report-only.                                      |
| Semantics / DX          | No surviving SM finding in call-home identity, stable function values/compatible thunks or every-target no-return projection. No new source/API/runtime rule. Public admission remains RED/unreached.                                                       |
| SFA / ABI               | **RV-005 = SF-001 — MAJOR:** caller-live homes do not interfere with reused canonical callee homes across different activation roots. The stronger native witness below confirms overlap. Earlier home-selection fixes do not settle the complete lifetime. |

Evidence-hygiene disclosures are retained. Correctness's metadata read extends
past the permitted release heading into qualification-summary material; it
excludes that material from decisive evidence and makes no blind domain
qualification verdict. Semantics's last broad keyword lookup returns historical
identity/inventory rows as well as the selected normative headings; no grader,
evaluation-case file or manifest audit map is opened or used as authority. These
reviews are not new expert-baseline qualification.

The main-owned first counter-check preserves a caller byte around parameterized
H and passes all four profiles (`ar17-live-witness.log`). It is not decisive
against a general interference defect: consumed caller staging happens to share
H's parameter while sparing the live byte. The strengthened source gives H an
additional local `inside = peek($c024)` live alongside x; Q keeps
`saved = peek($c020)` across H(9), then writes saved to `$c022`.

`ar17-live-local-witness.log` fails after native ACME on the first PAL/6581 case.
The actual final certificate puts Q.saved and H.inside at `$0bbd`, H.x at
`$0bbe`. In `c64-pal-prg-kernal-6581-raw-review-live.asm`, lines 277–280
store Q.saved, line 283 calls H, H lines 231–234 overwrite the same address,
then Q lines 284–285 read/write the overwritten byte. This ordinary call has
overlapping private lifetimes even without external preemption. The profile
failure, compiler-produced artifact and proof defect are verified; no VICE or
silicon runtime claim is made. Actual context/capture/reached hashes remain exact.

The new `storage/interference.ts:150–153` consumer is outside AR-P17's approved
six-file owner set. Under the execution skill's MAJOR/runtime scope gate,
AR-P18 is logged and further correction pauses for the exact owner extension.
No production/test edits follow candidate `bb11b0e6`; only temporary supporting
witnesses and durable gate documents change. No task promotion or RED commit.

One fresh native `design-challenger` reviews only the relayed source facts and
selected normative call/SFA contracts, without Bash or filesystem mutation.
An earlier generic reuse attempt is interrupted when the fresh native slot
becomes available; it is not counted as a decisive second challenger. The fresh
verdict converges on sharing the existing pure callee descriptor for precise
call-overlap, propagating the selected context through transitive calls. The
conservative all-root alternative is viable but may add unnecessary RAM/ZP
conflicts. A canonical-main exception duplicates selection once made sound.
The strongest risk is guessed call context or a second selector; no new analysis
framework is justified. Implementation/final-cost confidence remains conditional.

Progress is 43/57, one current approval-blocked verification unit, 13 later units
not started. Output/platform/performance review and public/runtime qualification
remain pending after the necessary correction; they are not reported complete.
The feature roadmap carries the blocked overlay. Portfolio reconciliation stays
at integration, not across this feature worktree. RD-05/DEF-7 remain open,
public NMI admission guarded, all frozen authorities/oracles exact, no push.

Stop-record validation: 94 local linked paths and 18 unique AR table rows pass;
the plan engine reports 43 verified / one blocked / 13 not started, with no
structural problems. Source formatting and diff whitespace pass. Markdown is
intentionally excluded by the repository formatter; its structure/links/counts
are checked directly, not reported as a skipped formatter pass. All ten latest
frozen oracle hashes remain exact; `spec/` and active expert status stay clean.

## AR-P18 exact correction approved — 2026-10-04

The user replies “I approve” to the sole pending owner-extension recommendation.
The register records the exact three production paths and one new independent
regression file. Baseline tree `da051a2bc2fce5c7b9f4aeef22316a41034bfb3f`
includes the previous reviewed source and stop evidence. Three prerequisites
subdivide the correction without new product scope: fresh spec/RED, mechanical
selector sharing, then selected-call interference. Progress is 43/60 before
execution; approval promotes no implementation. The feature returns to Executing;
portfolio reconciliation remains deferred to integration.

A fresh native spec-test-author receives frozen call/storage contracts and
allowed public schemas only. Its single new caller-lifetime concern is below
300 lines; existing tests, supporting probes, implementation and qualification
answer material are forbidden. Main waits for authoring before implementation
and marks the task implemented before the expected-RED run. The named RD-05
effort waiver remains active. `/tmp` has only the still-needed owned directory
`/tmp/blend65-nmi-ar15.cZhloG`; no unrelated or current evidence is removed.
No new evaluator, storage registry, runtime, source rule, frozen-authority edit,
RED commit, automatic push or NMI admission claim is authorized.

## AR-P18 bounded candidate review and AR-P19 stop — 2026-10-04 15:58

Baseline `da051a2bc2fce5c7b9f4aeef22316a41034bfb3f` → candidate
`9a6e3f3804ae37dd588a7e96f991d3fc5d309293`. This is the first review of
the newly approved interference owner, not a third full AR-P17 review.
Implementation stays inline. Native independent correctness and SFA reviewers
are read-only; the independent specification author does not review its own
oracle. No new specification-test exception is approved.

### Implemented and verified endpoints

The existing pure `functionEntryContext` body is moved unchanged from machine
specialization into semantic context facts and directly imported. This mechanical
task passes build/typecheck, 12 retained files/92 tests, four native argument-home
controls, formatting and documentation checks. It alone remains newly verified.

The existing interference owner now follows selected storage descriptors through
direct/transitive/finite calls. Final build/typecheck, the same 92 retained tests
and touched-source formatting pass (`ar18-final-build.log`,
`ar18-final-typecheck.log`, `ar18-final-retained-tests.log`,
`ar18-final-format-check.log`). Sixteen new guarded native ACME seam cases pass:
four direct, four transitive, four finite-target and four inactive-root precision
controls. Actual context/capture/reached proof hashes stay exact. Logs:
`ar18-live-native-final.log`, `ar18-live-transitive-native.log`,
`ar18-live-finite-native-final.log`, `ar18-live-variants-native.log`.
The earlier composed 108 native cases are not rerun in this correction turn;
their historical pass is not relabeled as a fresh 124-case pass.

The strengthened direct final homes are Q.saved `$0bc0`, H.inside `$0bbd`,
H.x `$0bbe`. Before/after code remains 251 instruction bytes and the PRG
901 bytes. Only absolute home operands change; there are no added instructions
in this witness. Complete physical RAM occupancy, whole-program improvement,
runtime and silicon endpoints are not established by this comparison.

Failed supporting attempts remain failures. `ar18-live-native.log` used nonexistent
temporary-probe machine fields and found no homes; correcting the probe to use
actual selected operands fixes that supporting check, not a product assertion.
`ar18-live-finite-native.log`/`ar18-live-finite-diagnostic.log` fail a temporary
single-code-entry assumption: finite H has canonical and depth entries but one
canonical home instance. The corrected nonfrozen probe checks the actual shared
home contract; the frozen public oracle is not silently changed.

The blind author freezes the new 286-line oracle at SHA-256
`4f1759ab1e5052010c26591b4dfce786cbefb15dabc277e22620c5271783550c`.
All 12 public cases RED at unchanged E10245 (`ar18-spec-red.log`), with
zero prepasses and zero artifact/allocation assertions exercised. That guard RED
does not validate the test's later artifact lookup assumptions. Main's authoring
packet did not close those interface assumptions precisely enough; this is an
oracle-authoring error, not a language restriction or evidence that the frozen
specification should change.

### Surviving findings and public counter-check

| Durable finding             | Severity | Evidence and smallest correction                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RV-006 = correctness RV-001 | MAJOR    | New lifetime `byteHome`, line 172, and earlier call-ABI `memoryHomes`, lines 80–95, compare debug names with lexical spellings. Public symbols use stable declaration identities (`services/evidence-records.ts:622`), while their schema promises text. Match expected source origin/scope/kind unambiguously under an exact exception; preserve all native storage/ABI assertions. |
| RV-007 = correctness RV-002 | MAJOR    | Lifetime line 244 equates code-entry cardinality with storage reuse. Native finite evidence has two legitimate code entries and one canonical private-home instance. Replace only unsupported cardinality/entry-index mechanics with independent required-target/shared-home checks for every selected finite alternative.                                                           |
| RV-008 = SFA SF-001         | MAJOR    | `storage/interference.ts:120` uses an empty IRQ-only NMI reached proof to prune H's body. G then disappears from main's live-through-call conflicts. Apply the actual NMI-route applicability condition already used by inventory/lowering; independently freeze an IRQ-only transitive caller-live case first.                                                                      |

The correctness reviewer finds no other production correctness/maintainability/
standards issue within its assigned interfaces; the SFA reviewer owns the
storage proof. Refutation of RV-008 finds no compensating same-owner, persistent
link or cross-domain edge for two different owners in the same main root.
Final binding checks the supplied graph and cannot detect an omitted conflict.

Main confirms RV-006 through a normal successful public build, without a guard
bypass. H.x publishes name `src/game.blend:24:30`, H.inside
`src/game.blend:38:66`, and main.saved `src/game.blend:123:150`, with source
origins/scopes/kinds (`ar18-public-debug-probe.log`). The earlier call-ABI helper
uses the same false spelling assumption. These are exact fixture-mechanics
exceptions; changing compiler naming/code variants to satisfy them is not needed.

Main also confirms RV-008 through the public compiler with no NMI in the source:
A installs/restores B from IRQ; main installs A, saves a byte, calls H → G,
then writes the saved byte and restores IRQ. G independently reads/writes its
local byte. Successful generation puts both main.saved and G.inside at `$0b4f`,
so the independent live-home inequality fails (`ar18-public-irq-live-before.log`).
The generation is `ar18-public-debug-z8nXIK/out/8a4011b0-ae9a-4445-97cd-e6edfbb28f19`
under `/tmp/blend65-nmi-ar15.cZhloG`. This final public home counterexample
settles the reviewer's previously Unknown addresses; it does not claim emulator
or physical execution. The proof producer's IRQ-only branch has an empty reached
map (`interrupt-context-proof.ts:66–72`); inventory lines 335–336 and lowering
lines 200–201 correctly consume that map only for actual NMI routes.

### Exact approval gate and hardening

AR-P19 names one same-owner applicability fix, two exact frozen-test mechanics
exceptions, and one separate independently authored IRQ regression file below
300 lines. A separate small concern avoids expanding the already 286-line oracle
or adding a harness. Program fixtures and behavior, widths, canonical homes,
caller-live separation, marshalling, hidden-return pointers and caller-owned
destinations stay unchanged. No source restriction, fact model, runtime, API,
code-selection redesign or frozen-authority change is proposed.

A fresh native design challenger independently converges on that narrow direction.
It cautions that accepting arbitrary emitted targets would be circular and that
canonical storage reuse does not justify collapsing distinct link/code variants.
Its role has no permitted filesystem reader; relayed code facts are explicitly
not independently inspected. It makes no expert qualification verdict. Main
separately reads quality/routing obligations: correction permits one bounded
fix-only rereview cycle, not fewer reviewers or missing specialist lenses.
Pending semantics, platform, output and performance review remains pending,
not skipped-as-passed; the original wrapper/retention verification still owns
remaining storage/output/runtime closure.

The incorrect oracle-completion promotion is withdrawn: progress is 44/60,
one approval-blocked oracle task, one implemented but unverified interference
task, wrapper verification and 13 later tasks not started. AR-P18 remains approved;
AR-P19 alone is open. All current oracle hashes stay exact. No production/test
edit follows candidate `9a6e3f38`; only this durable stop record changes.
No RED commit, push or positive public NMI admission is made. RD-05/DEF-7 remain
open; portfolio status reconciliation stays deferred to integration.

Authority lineage remains expert 2.0.3/content
`22cc5f00f381c82d347cf342be4fcff16bc291c6`, router SHA-256
`599a68a63721f89ddc7283461f1f2e3e4fee4ae2a3c1723393e81a7e25634030`,
Specification `BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`.
Selected SFA lifetime/interference/closure, CPU interrupt/stack and lowering
contracts cite `MOS-PGM-1976`, `MOS-HW-1976`, `MOS-6526-1981`,
`CBM-C64-KERNAL-03`. No qualification grader/answer material is used in this
bounded correction review; no VICE or hardware claim is added.

Stop-record validation: the plan engine derives 44 verified / one blocked /
one verification-pending / 14 not started out of 60, with no structural problems.
Local Markdown links and diff whitespace pass. All 11 latest recorded oracle
hashes remain exact; `spec/` and the active expert tree remain clean. Snapshot
`5c75cdfe` differs from reviewed candidate `9a6e3f38` only in the six active
plan/feature-roadmap documents. Markdown is excluded by the repository formatter;
link/structure/count checks are performed directly, not called a skipped
formatter pass. No source/test correction follows the review gate.

## AR-P19 approved correction and fresh evidence — 2026-10-04 19:45

The user replies “I approve” to the exact same-owner applicability fix, two
lookup/entry-mechanics exceptions and one independent IRQ regression. The
register records that authority before implementation. Approval baseline
`6104639332aeadbe86cdfecc25da0c00e85bd7ba` → reviewed source/test candidate
`7e501c192fe2ae7890b825498510c0941a380580`. No other frozen oracle,
source fixture, API, fact model, runtime or authority is changed.

The new native specification author owns only the 150-line
`irq-call-lifetimes.spec.test.ts`. It reads frozen calls/lifetime contracts and
allowed public schemas, not implementation, prior oracles or supporting probes.
Source-origin granularity is clarified before the final oracle freezes. All four
public IRQ-only builds succeed; exact declaration identity, nonempty homes and
one-byte widths pass, then live main/G homes incorrectly overlap. After that RED,
the existing selected transitive walk gates reached-block projection on the same
actual-NMI predicate as inventory/lowering. The unchanged IRQ oracle passes all
four profiles. No instruction or new storage model is added.

| Frozen concern                                 | Before approval                                                    | Approved current SHA-256                                           |
| ---------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Caller-live NMI oracle, 299 lines              | `4f1759ab1e5052010c26591b4dfce786cbefb15dabc277e22620c5271783550c` | `6511fefe8744b52efbeb836251edeb31e62e395b3f65d3ca111aa00b32563047` |
| Retained call ABI, 231 lines                   | `b8fd9750b628fb660a53b3c86f3ecd01eed6af1dbc2f184e7f3da9ba1e27a7b3` | `5737195a8f5cb4117fcf0c7b91cb92bdad0a75da91c142f853dc2c574731fbe6` |
| Independent IRQ transitive lifetime, 150 lines | New independently authored oracle                                  | `4dacdc77b93e8cb7cf667883c53b13a2b40c56d70c2b7d6d669a9598257232cc` |

The two exact exceptions match source origin/scope/kind rather than lexical debug
names. The caller-live test matches required H/G/J targets against legitimate
code-entry sets, retaining one canonical private-home instance, widths,
separation and every native/volatile assertion. ABI marshalling, hidden return
pointers and caller-owned destinations stay binding. Public NMI testing remains
20/20 expected RED at unchanged E10245, with zero artifact assertions reached;
oracle-mechanics clearance is not artifact GREEN.

| Fresh check                        | Result                                       | Capture under `/tmp/blend65-nmi-ar15.cZhloG`       |
| ---------------------------------- | -------------------------------------------- | -------------------------------------------------- |
| Independent IRQ before/after       | Four RED → four GREEN; identical hash        | `ar19-irq-spec-red.log`, `ar19-irq-spec-green.log` |
| Build/typecheck                    | PASS                                         | `ar19-build-final.log`, `ar19-typecheck.log`       |
| Retained cases                     | 12 files, 92 PASS                            | `ar19-retained-tests.log`                          |
| Corrected guarded public NMI cases | 20 expected RED; no public artifact endpoint | `ar19-corrected-oracles-red.log`                   |
| Native ACME consumer seams         | 124 fresh PASS across all four profiles      | `ar19-native-*.log` groups below                   |
| Touched production/test formatting | PASS                                         | `ar19-format-check.log`                            |

Native groups are baseline 48, context-witness 4, unobserved-install 4,
retained-contract 16, parameter/aggregate/canonical/indirect 16,
dead/finite/mixed/returning/conditional 20, and direct/transitive/finite/variant
caller-live 16. Actual semantic context/capture/reached hashes stay exact through
normal inventory, interference, allocation, lowering, closure, layout and ACME.
These supporting seams do not bypass the public guard or qualify runtime entry.

The first build attempt, `ar19-build.log`, fails because the applicability hunk
lands in the neighboring legacy helper instead of the selected walk. The same
four lines are immediately moved into the authorized function; final build and
typecheck pass. The failed attempt stays a failure. No test expectation is
changed in response, and no broken checkpoint is committed.

The direct final homes remain Q.saved `$0bc0`, H.inside `$0bbd`, H.x `$0bbe`.
The complete PRG remains 901 bytes before/after. Its 251-byte instruction sum is
not complete shipped code: the actual selected user/wrapper region is 255 bytes
(including four terminator bytes), startup 345 and restore 287, plus 12 BASIC
bytes and the two-byte PRG header. This allocation correction adds zero bytes in
that witness. The unsafe prior artifact is not a correct equivalent expert
baseline. Summed logical home widths do not measure physical RAM occupancy.
Whole-program improvement and runtime/silicon parity remain unproved.

### Bounded independent review disposition

| Lens                                       | Boundary                                               | Disposition                                                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Correctness/oracle integrity               | One fix-only pass, `61046393 → 7e501c19`               | No findings; RV-006/RV-007 exact exceptions cleared; fixtures and all behavior expectations preserved                                                                    |
| SFA/ABI                                    | One fix-only pass, `61046393 → 7e501c19`               | No findings; RV-008 cleared; actual-NMI applicability restores IRQ-only transitive conflicts                                                                             |
| Semantics and modern-source DX, separately | First newly approved owner pass, `da051a2b → 7e501c19` | No findings; Verified partial at selected direct/transitive/finite seam; no new source restriction                                                                       |
| Host performance                           | First newly approved owner pass, `da051a2b → 7e501c19` | No findings; repeated closure work has no demonstrated material scaling regression; absolute latency remains Unknown                                                     |
| Emitted code and complete costs            | First newly approved owner pass, `da051a2b → 7e501c19` | No findings; Verified partial through source/assembly/native bytes; four changed operand bytes only, no added instructions, bytes, path cycles, stack/ZP or runtime work |
| C64 platform                               | First newly approved owner pass, `da051a2b → 7e501c19` | No findings; Verified partial through the selected four-profile RAM/ABI/native seam; runtime/hardware remain Unknown                                                     |

Reviewers are read-only and do not rerun verification. The independent author
does not review its own oracle. These are bounded new-owner and exact-fix passes,
not a third full AR-P17 review. All applicable lenses clear this correction;
none substitutes for later private-home/admission/publication/public/VICE gates.
The output review's first untracked-file comparison incorrectly suggests a
deletion; exact live-file SHA-256 values match the reviewed blobs and the
reviewer corrects that observation before its final disposition.

Complete native artifact attribution is 255/283/550/455 selected routine and
wrapper bytes, 887/915/1,182/1,087 shipped code bytes and 901/929/1,196/1,101 PRG
bytes for direct/transitive/finite/distinct-root witnesses respectively. Each
includes startup 345, restore 287 and BASIC/header 14 bytes, with zero observed
padding. Startup BSS separately reserves 50 bytes. Physical frame occupancy is
not inferred from logical request-width sums. The reviewer also identifies
pre-existing caller snapshot traffic (26 bytes/36 cycles versus a credible
20-byte/28-cycle direct-store idiom); it is outside this correction, not a new
finding against its changed owners, and must not be represented as routine
parity or a whole-program win in later cost qualification.

Process disclosure: initial routing orientation by main, the fresh correctness
reviewer and semantics reviewer accidentally includes the historical “Current
setup evidence” smoke summaries. Those summaries are excluded from all decisive
conclusions; no new blind expert-baseline qualification is claimed. No expert
qualification cases, evaluator answers or source-manifest audit map are read.
Later packets explicitly stop routing reads before that section.

Lineage remains qualified expert 2.0.3/content
`22cc5f00f381c82d347cf342be4fcff16bc291c6`, router SHA-256
`599a68a63721f89ddc7283461f1f2e3e4fee4ae2a3c1723393e81a7e25634030`,
Specification `BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`.
Selected normative SFA lifetime/interference/ABI/final closure, semantic
preservation/DX, CPU selected state/stack, lowering calls, C64 interrupt entry
and CIA ICR contracts retain source keys `MOS-PGM-1976`, `MOS-HW-1976`,
`MOS-6526-1981`, `CBM-C64-KERNAL-03`.

Progress is 47/61 verified. Wrapper/retention verification and 13 later tasks
remain. RD-05/DEF-7 stay open, public NMI admission guarded, `spec/` and active
expert bytes untouched. No VICE/hardware endpoint, commit or push is claimed.
The single owned temporary evidence directory remains necessary; no unrelated
`/tmp` contents are removed. Portfolio reconciliation stays at integration.

## Final-inventory check and AR-P20 source-contract prerequisite — 2026-10-04 20:14

The wrapper/retention correction finishes at 48/61 after all applicable bounded
reviews clear. Its genuine-source/native endpoint and public guard boundary do
not change. Baseline before the next unit is
`9931f2ce9c3459dac4ec339dbc00298c29831047`.

The final-inventory check uses actual reached NMI owner/root contexts after all
semantic and machine-selected requests close. It excludes noncertifying raw
retention and exempts only exact separately proved two-byte pointer captures;
name prefixes or persistence alone are insufficient. Canonical E10245 is
attributed to the responsible installation before machine binding/publication.
One 55-line pure storage module contains the check so the existing closure owner
stays at 651 lines; no new stage, registry, certificate field or runtime is added.
The service keeps its existing diagnostic pattern. The unit is implemented,
not verified or committed; complete NMI admission remains closed.

Build/typecheck pass (`nmi-private-build-final.log`, `nmi-private-typecheck.log`).
The root invocation passes 24 retained IRQ/stack cases; it does not select the
package storage files. The separate compiler invocation passes all 20 cases in
three storage-closure files (`nmi-private-storage-tests.log`). The 96-case public
admission/boundary run has 52 passing guards and 44 expected positive failures
at unchanged E10245, not artifact GREEN (`nmi-private-guarded-public.log`).

The first supporting native probe stops on eager diagnostic JSON serialization
of an otherwise complete BigInt-bearing record (`nmi-private-native.log`).
After only that nonfrozen logging correction, its empty-handler case passes but
the unchanged local-constant/helper expectation fails on PAL/6581
(`nmi-private-native-final.log`). Diagnostic inspection confirms one private
local `V` home and `LDA #7 / STA V / LDA #7 / STA $0411` in the actual NMI body.
This is a generic CFG declaration defect, not a reason to exempt live private
storage or change the frozen NMI source. Both failed attempts remain failures.

AR-P20 records the already frozen no-storage scalar/enum-constant rule and the
exact CFG/constructor/new-oracle owners. The user's standing PRIME workflow rule
4 overrides a default technical-only pause for this deterministic compiler
repair; there is no new product fork and no direct user approval is fabricated.
One independent native challenger favors the producer repair and identifies
required binding-map completeness, materialization/loadable distinctions and
shadowing as decisive obligations. Its facts are relayed, not independently
inspected; no qualification verdict follows. Main verifies the real fields are
`SemanticBinding.storage`, `.materialized` and `.loadable` before any correction.
The existing binding map will be required, not silently defaulted empty.

Two independent-test-first prerequisites bring progress to 48/63 verified.
The new author receives only frozen normative source/CPU contracts, public
types and the common public fixture. Implementation, existing oracles and
supporting probe results are forbidden. It does not run RED until the task is
marked implemented. No scalar correction or old-test edit precedes that RED.
Public NMI admission, later emitted publication/placement and final runtime/cost
qualification remain mandatory; no VICE/hardware, commit or push endpoint is added.

## AR-P20 first RED and AR-P21 lookup gate — 2026-10-04 20:31

The frozen 195-line scalar-constant oracle runs before any scalar CFG correction.
All 16 cases fail (`ar20-scalar-spec-red.log`, exit 1). Twelve are genuine
zero-storage failures across four profiles; used, unused and shadowing sources
have eight, ten and three function-storage intervals respectively. The mutable
control builds and retains addressable storage but cannot inspect its code because
the author packet supplies `Game.main` instead of the public source-qualified
owner ID. Its behavior checks are not exercised; no four-control PASS is claimed.

AR-P21 requests only four `functionBytes` lookup arguments to use
`src/game.blend::Game.main`. All source fixtures, values, no-home assertions,
exact routine bytes, volatile order/count and return expectations stay unchanged.
The original hash remains
`1bd90ebe497870f95e349e7b936fe2b6c9fd74b14ea434515d19662da44a7cf8`.
No test edit, scalar production correction, task promotion, commit or push occurs.
Progress stays 48/63; this exact exception is the necessary continuation gate.

After freeze, an agent-status response exposes the completed challenger's
implementation discussion to the author. All expectations predate the exposure;
no forbidden implementation file is opened. This disclosure is not treated as a
new blind qualification. The original failed run remains retained evidence.

## AR-P21 exact correction and AR-P22 oracle review — 2026-10-05 01:17

The user approves only AR-P21's four lookup arguments. Baseline snapshot is
`c710e7d8aa51e6b28f90be1f9c18ee6176f0485e`; corrected snapshot is
`daea86fc4e904d053ffc6ed9c9fa2fd6cea2d430`. The tree-to-tree oracle diff contains
exactly four string arguments, not a deletion. A single-tree comparison ignores
the untracked live file; that nondecisive output is not used as a change verdict.
The 195-line live hash is
`86ed5f63e5aaaa5d196047ad13664280452641dc83233edd31438a8f0b3ca333`.
No source, value, storage, effect, byte or cost expectation changes.

The old `/tmp/blend65-nmi-ar15.cZhloG` directory is absent on resume. Its earlier
recorded results stay historical, not fresh accessible evidence. No unrelated
temporary entry is removed. New captures live in `/tmp/blend65-nmi-ar21.0c36Fe`:

| Capture                      | Exact result / boundary                                                                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ar21-baseline-build.log`    | Fresh build command passes before RED; scalar producer unchanged                                                                                                                    |
| `ar21-scalar-spec-red.log`   | 16 failures: 12 genuine zero-storage failures; four mutable controls reach an incorrect ordinary-return assertion for `main`                                                        |
| `ar21-main-exit-probe.log`   | Genuine main emits valid `JMP startup.restore`; ordinary constant-free reference emits exactly 41 bytes ending `RTS`                                                                |
| `ar21-ordinary-controls.log` | 12 native four-profile controls pass: mutable body 71 bytes/nonzero storage/ordered external accesses; immediate reference 41 bytes/no homes; empty ordinary body one byte/no homes |

The native controls are supporting ABI/mechanics evidence, not scalar feature
GREEN or VICE execution. Actual constant sources remain failing and unchanged.
All measured pure-immediate values and signed/little-endian expectations agree
with frozen semantics; PRG half-open slicing correctly includes the two-byte
header. No whole-artifact parity, runtime or physical conclusion is made.

One read-only independent correctness review clears the exact AR-P21 exception
and reports two findings, root-numbered RV-009/RV-010 (reviewer RV-001/RV-002):

| Finding | Severity | Evidence / smallest remedy                                                                                                                                                                                                                                                                           |
| ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RV-009  | MAJOR    | All four measured bodies are `main`, but their terminal expectations require an ordinary `RTS`. Frozen Chapter 10 §5.3 and Appendix C64 §5.1 plus actual native bytes prove this fixture error. Move unchanged bodies to an ordinary helper called by `main`; keep all measured byte/cost checks.    |
| RV-010  | MAJOR    | Redirecting the two mutable assignments away from the addressable home would preserve the existing four external opcode checks and nonzero storage but produce wrong outputs. Add focused independent value checks, not a general dataflow validator. No current compiler miscompile is established. |

AR-P22 requests the exact one-file fixture correction plus four-profile mutable
value observations through existing sequential VICE/project fixtures. Distinct
input bytes `$13/$e3` must emerge at `$c020/$c021`; no home address or store/reload
form is mandated. This strengthens behavior without blocking future legal
optimization. Current fixtures already expose profile-specific startup, memory
write/read and execute checkpoints; no new harness, dependency or runtime is
needed. No AR-P22 oracle change or scalar implementation precedes approval.

The reviewer accidentally reads the routing document's generic “Current setup
evidence” summaries before main's narrower boundary arrives. It reports this
exposure; no expert qualification case, grader or existing suite is read. The
findings rest on the exact frozen main/exit contracts and supplied native bytes,
not those setup summaries, and do not claim fresh blind qualification.
Lineage stays expert 2.0.3/content `22cc5f00f381c82d347cf342be4fcff16bc291c6`,
normative startup/ordinary ABI and NMOS instruction rules, keys `MOS-PGM-1976`
and `CBM-C64-KERNAL-03`. `spec/` and active expert bytes remain untouched.

Progress remains 48/63. Task 2.2.4.1 blocks at the exact frozen-oracle gate;
constant producer and later NMI units are not promoted. No commit or push occurs.

## AR-P22 approved oracle repair and corrected RED — 2026-10-05 10:42

The user approves the exact one-file exception. A fresh implementation-blind
author changes only `test/rd05/local-scalar-constants.spec.test.ts`: unchanged
measured bodies now belong to ordinary `sample` routines called by `main`, with
the four exact public owner lookups corrected. Existing assertions remain.
The mutable control additionally uses existing sequential VICE/project helpers
to write `$13/$e3` at sample entry and observe those values at `$c020/$c021`,
after ordinary return and before startup restoration. It does not prescribe a
home address or a store/reload form. No harness or production change is made.

The 259-line corrected oracle freezes with SHA-256
`487aaab5c668af4a046cca21f53625f4f57621422097a842623518708c3ab1b7`.
Snapshot `7ae37670189199fc60508596e0b0a6dc62a077a2` precedes the correction;
`02b9b7df089fb06246ab323385aaf27f678c35a2` records it. Formatting and the
prohibited-reference scan pass. Parent marks implemented before granting RED.

Directed RED exits 1 in 7.86 seconds: twelve genuine constant-storage failures
(used eight, unused ten, shadowing three unexpected intervals on every profile)
and four mutable controls pass. Exact native constant bytes remain downstream of
the first failures, not yet exercised. Capture is
`/tmp/blend65-nmi-ar21.0c36Fe/ar22-scalar-spec-red.log`; no oracle change follows
freeze. Mutable behavior is VICE-verified / hardware-unverified, not a complete
cleanup, whole-program parity or unrestricted NMI qualification.

One independent bounded fix-only review clears RV-009/RV-010 with no findings.
The author does not review its own oracle. Task 2.2.4.1 is verified at 49/63;
scalar production task 2.2.4.2 remains next, public NMI admission stays guarded.
Expert 2.0.3/content `22cc5f00f381c82d347cf342be4fcff16bc291c6`, frozen
variables/main-exit contracts and NMOS ordinary ABI govern this bounded result.
`spec/` and expert bytes are unchanged. No commit or push occurs.

## Scalar producer and final private-inventory verification — 2026-10-05 10:53

Only the existing CFG producer changes: both constructor sites receive the
existing authoritative declaration map, stable binding identity resolves each
local, and only an unmaterialized/non-loadable scalar or enum constant omits its
declaration initializer/store. Uses already substitute those values. Mutable,
aggregate, materialized and loadable paths are unchanged. Missing declarations
fail closed. The sole synthetic constructor supplies an explicit empty map;
its malformed-jump expectations do not change. The three-file diff is 27
insertions/five deletions; no evaluator, optimizer, registry or runtime is added.

Scalar baseline is `59cb6deb9255b5e13e6ef87e6f80f5f62d81be90`, reviewed target
`598c264c0a63bc0ba23030186e49985de3844dc2`. The final private-home checker uses
baseline `9931f2ce9c3459dac4ec339dbc00298c29831047` and that same target, bounded
to the new pure checker and its after-closure/before-binding service call.

Fresh captures in `/tmp/blend65-nmi-ar21.0c36Fe`:

| Capture                                                      | Exact result / endpoint                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `ar20-scalar-fix-build.log`, `ar20-scalar-fix-typecheck.log` | Build/typecheck PASS                                                                                                      |
| `ar20-scalar-spec-green.log`                                 | All 16 immutable public scalar cases PASS; exact native bytes now exercised; four mutable VICE controls PASS              |
| `ar20-semantic-storage-regression.log`                       | 20 compiler semantic/storage files, 193 tests PASS                                                                        |
| `ar20-retained-constants.log`                                | Only the matched root profile-constant file, 50 tests PASS; other supplied filters matched no files                       |
| `ar20-retained-data-paths.log`                               | Four placement/asset/aggregate-runtime/comptime files, nine tests PASS                                                    |
| `ar20-private-inventory-first.log`                           | Initial probe fails while eager diagnostic JSON serializes BigInt, before expectation checks; not a compiler/test failure |
| `ar20-private-inventory.log`                                 | Logging-only probe correction; six actual sources × four profiles, 24 selected-storage consumer cases PASS                |

The private-inventory probe runs the genuine frontend, ordinary whole-program
closure, then production target selection/ownership/domain/context analyzers and
semantic/machine demand closure. It supplies no invented captures, reached sites
or execution contexts. Empty and constant-plus-helper sources have zero selected
NMI demands; handler/helper retained locals, word-read temporary and typed pointer
storage correctly identify the installation to reject. The public admission
guard stays closed: this seam proves no public NMI artifact/runtime/placement.
The probe is supporting internal evidence, not an independent public oracle.

Scalar oracle remains exactly 259 lines/hash
`487aaab5c668af4a046cca21f53625f4f57621422097a842623518708c3ab1b7`.
Touched formatting, whitespace and frozen spec/expert status pass. One bounded
base review reports no behavior/oracle finding and root RV-011 (reviewer RV-001)
MINOR: the service insertion extends its inherited 710-line size violation to 724. Report-only; directory-helper extraction is not added to this correction.
That reviewer discloses incidental routing setup-summary exposure and excludes
it from decisive evidence; no fresh blind qualification is claimed.
The independent SFA review is pending; neither task 2.2.4.2 nor 2.2.4 is promoted
yet. No public NMI, complete phase, whole-program parity, physical, commit or push
claim follows. Mutable endpoint stays VICE-verified / hardware-unverified.

### AR-P23 zero-width correction and bounded review closure — 2026-10-05 10:58

The independent SFA auditor reports root RV-012 (reviewer SF-001), MAJOR:
the pure checker rejects a zero-byte array position marker as private storage.
Frozen Chapter 08 AR-2 and actual selected frontend/machine/final inventory
establish a deterministic false rejection, not an unsafe allocation. The
first-profile RED is retained in `ar20-zero-length-private-red.log`.

The exact two-line correction skips only `request.bytes === 0`, preserving its
identity/marker in closure and all positive-width checks. No existing oracle,
public API, context, schema or compiler pass changes. Under PRIME workflow rule 4,
AR-P23 records the compiler ruling, not an invented user approval.

Fresh `ar23-zero-marker-build.log` passes. Seven-source/four-profile
`ar23-private-inventory-green.log` preserves all old 24 cases and adds four
actual zero-width-local PASS cases (28 total). Three closure files/20 tests
pass in `ar23-storage-regression.log`; formatting and freeze/whitespace pass.
One independent fix-only review of `598c264c` → `d1fde4c3` clears RV-012 with
no findings. It adds zero runtime bytes, cycles, RAM, ZP or stack use.
The planned internal private-storage hardening retains this boundary regression.

Both bounded reviewers clear the scalar repair. Tasks 2.2.4.2 and 2.2.4 are
verified; progress is 51/63. RV-011 remains the explicitly report-only MINOR.
Public NMI admission, emitted entry/placement, runtime and external obligations
are still unqualified and guarded. No complete-phase or parity claim, commit
or push occurs. Expert/spec lineage and the immutable scalar hash remain exact.

### Actual selected entry facts and finite mixed accounting — 2026-10-05

Baseline tree before entry-fact work: `7dca9f4d15012e65e175c4a18792410d5ed9e357`.
The existing entry-facts unit is subdivided before implementation into five
bounded units; task total becomes 67, with no capability or support-scope change.
The existing call/status owner is mechanically extracted before extension.
Initial missing extraction brace and an incorrect root test filter are retained
as failures; corrected build and workspace runs are fresh.

The finite IRQ walker excludes NMI routes from IRQ ownership and charges actual
NMI PHP/PHA publication saves. Its mixed-source peak is 10 (program 1/system 9),
not an independent-maxima sum. Selected NMI construction records only demanded
register/status saves plus the CPU's three bytes. Existing wrappers are unchanged.
The machine binder carries real reached contexts; noncertifying raw retention
does not supply a stack demand. The existing call/status analysis projects reached
bodies, follows selected callees and charges live saves. Each NMI entry is checked
separately against usable capacity; chained entries do not acquire additional
CPU frames. No unrestricted external aggregate is bounded.

| Fresh log                                                                                                                 | Bounded result                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `nmi-stack-build.log` / `nmi-stack-retained.log` / `nmi-stack-mixed.log`                                                  | Build, 26 retained tests and 32 actual-source cases PASS                                                                    |
| `nmi-publication-build.log` / `nmi-publication-source.log` / `nmi-publication-retained.log`                               | Build, 32 structured transaction cases and 482 retained CIA/IRQ tests PASS                                                  |
| `nmi-entry-build.log` / `nmi-entry-retained.log` / `nmi-entry-sequences.log`                                              | Build, eight actual retained tests and 32 structured save-sequence cases PASS; nonexistent lower-spec filter proves nothing |
| `nmi-call-stack-extract-build-final.log` / `nmi-call-stack-extract-tests-final.log` / `nmi-call-stack-extract-source.log` | Build, 26 tests and 32 source cases PASS                                                                                    |
| `nmi-entry-facts-build.log` / `nmi-entry-facts-tests.log` / `nmi-entry-facts-source.log`                                  | Build, 23 tests and 32 source cases PASS                                                                                    |
| `nmi-binder-build.log` / `nmi-binder-tests.log` / `nmi-binder-source-final.log`                                           | Build, 23 tests and 32 genuine binder/context cases PASS                                                                    |
| `nmi-entry-stack-build.log` / `nmi-entry-stack-retained.log` / `nmi-entry-stack-source-final.log`                         | Build, 31 tests and 40 actual-source cases PASS; four scoped-overflow controls reject 7 against usable 6                    |
| `nmi-entry-evidence-build.log` / `nmi-entry-evidence-root.log` / `nmi-entry-evidence-package.log`                         | Build, 33 root and three package tests PASS; nonexistent package filter adds no tests                                       |
| `nmi-entry-warning-source.log`                                                                                            | Eleven sources × four profiles (44 cases) PASS; actual 195-byte warning decomposes as entry 5/source saves 190              |

All logs above are retained in `/tmp/blend65-nmi-ar21.0c36Fe`.
Actual selected peaks: empty/zero-width/mixed entries 3, constant-plus-helper 7,
live PHP/helper 8 and nonreturning dead-PHP suffix 6. The last probe also proves
the warning boundary, not a published artifact. Evidence construction uses the
existing record shape and maximum finite component resource value; actual
published per-entry rows still await coupled final layout/native qualification.
Task 2.2.8.5 and parent 2.2.5 remain unverified at that boundary.

Status is Verified partial; claim kind Fact for these exact internal seams.
Skill 2.0.3/content `22cc5f00f381c82d347cf342be4fcff16bc291c6`,
SFA hardware-stack/final-closure and C64 revision-pinned NMI sections govern;
source keys MOS-PGM-1976, MOS-HW-1976, MOS-6510-1982, MOS-6526-1981
and CBM-C64-KERNAL-03 remain unchanged. Scalar oracle hash remains
`487aaab5c668af4a046cca21f53625f4f57621422097a842623518708c3ab1b7`.
No fresh NMI PRG/runtime/placement/parity qualification or physical-hardware,
complete-phase, commit or push claim is made. Public E10245 stays closed.

### Final native placement and zero-byte debug discrimination — 2026-10-05

The existing placement task is split into construction/label and physical-ledger
units (68 tasks total), with no new product or support scope. Complete wrappers
keep source constraints; published entries use low `$47`, with an immutable
three-byte JMP only when placement requires it. Stable exported labels resolve
the published entry even when the wrapper is physically earlier. The existing
memory ledger groups only contiguous machine blocks and never claims intervening
unrelated bytes for a function.

| Fresh log                                                     | Result and boundary                                                                                                                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nmi-layout-build.log`, `nmi-physical-ranges-build.log`       | Build PASS                                                                                                                                                                                        |
| `nmi-layout-retained.log`                                     | Wrong guessed workspace filters match no tests; not proof                                                                                                                                         |
| `nmi-layout-retained-final.log`                               | Five actual layout/ACME files, 31 tests PASS                                                                                                                                                      |
| `nmi-layout-native-first.log`, `nmi-layout-native-second.log` | Native assembly succeeds, but temporary evidence input construction fails (missing manifest, then invalid generation identity); not compiler failures or completed qualification                  |
| `nmi-layout-native-third.log`                                 | Two actual native artifacts/sidecars pass; initialized empty NMI then fails debug correlation with `Storage request lifetime has no final machine range`                                          |
| `nmi-layout-native-without-zero.log`                          | Native mixed/status/placement cases pass until the temporary probe uses the wrong, unqualified source-owner lookup                                                                                |
| `nmi-layout-native-without-zero-final.log`                    | Corrected lookup passes direct/fixed/aligned cases; a temporary blocker at `$0847` conflicts with real startup data, so its body-before-entry fixture is invalid                                  |
| `nmi-layout-native-without-zero-complete.log`                 | Blocker moved to legal `$0A47`; 36 actual native artifacts and all three existing memory/cost/debug validators PASS across four profiles; four whole-wrapper no-cross violations correctly reject |
| `nmi-native-transactions-and-saves.log`                       | New actual-byte assertion uses nonexistent `MachineFunction.name`; temporary probe error, not output failure                                                                                      |
| `nmi-native-transactions-and-saves-final.log`                 | Uses existing `sourceName`; four-profile 36-artifact native run PASS, including exact 31-byte coherent capture/high-only publication/removal and actual selected A/P helper/callee bytes          |
| `nmi-final-layout-format.log`                                 | All 14 targeted existing/focused source files PASS formatting; documentation self-check removes one inherited ephemeral comment reference                                                         |
| `ar24-zero-size-spec-red.log`                                 | Eight ordinary-with-poke cases PREPASS, not RED; exact six-byte routine and zero owned storage remain independent safety controls                                                                 |
| `ar24-empty-routine-spec-red.log`                             | Eight declaration-only ordinary cases PREPASS, not RED; exact one-byte RTS and zero owned storage remain independent safety controls                                                              |

Native output includes empty, helper, mixed IRQ/NMI, live status, high-stack,
direct/fixed/aligned and body-before-entry cases. Zero-length NMI is deliberately
excluded after its retained failure. The nonreturning suffix case supplies a
selected-stack check only: the temporary ordinary-base reachable-function set is
not substituted for the public producer's final retained set. Neither exclusion
is reported as artifact qualification. Actual per-entry sidecars correlate IDs,
peaks, 236-byte usable capacity, headroom and final debug entries. Mixed finite
peak remains 10, alongside separate NMI peaks of 3; no external peak is asserted.

All raw logs and exact artifact digests/paths remain under
`/tmp/blend65-nmi-ar21.0c36Fe`. A read of routing instructions accidentally continued
into historical setup smoke evidence. That evidence is not used as authority or
decisive proof for these compiler checks; independent oracle authors did not
receive it. No qualification grader/case map is used.

AR-P24 remains a necessary zero-byte debug investigation, not a completed fix.
The existing location validator also rejects a context-bearing empty range;
the bounded correction must preserve valid context/index checks and permit only
zero-width optimized-away symbols. Both independent ordinary files are frozen:
`nmi-route-zero-sized-local.spec.test.ts` (139 lines,
`06f097acb7cbe008aeef66ebab2e879793ad26fcd1f4986b2dbe7ca88ac9a8d6`) and
`zero-sized-empty-routine.spec.test.ts` (135 lines,
`d911e6d223c57cd54529d3c0dc40969dc6f4eb7786c75943e531d016a6114d64`).
Their prepasses do not justify a production change. The independent NMI-only
file is frozen before its guard RED: `nmi-route-zero-sized-handler.spec.test.ts`
(124 lines, `2c8b773b35094bdd03dcb4de9aebcb7641beed1c11dc5d3ac866d613083510fc`).
Candidate admission must expose its actual boundary before debug correction.

Status: Verified partial; claim kind Fact for these exact native boundaries.
Skill 2.0.3/content `22cc5f00f381c82d347cf342be4fcff16bc291c6`, SFA hardware-stack,
final-closure, C64 revision-pinned NMI and ACME placement/symbol headings govern.
Source keys MOS-PGM-1976, MOS-HW-1976, MOS-6510-1982, MOS-6526-1981,
CBM-C64-KERNAL-03 and ACME-097-R266 remain unchanged. No public NMI/runtime,
whole-program expert beat, physical-hardware, phase-completion, commit or push
claim follows. Public E10245 is still closed at this recorded boundary.

### Public candidate and debug correlation — 2026-10-05

The preceding guard/zero-byte notes describe their earlier boundary. Candidate
admission now removes only the temporary blanket semantic guard. Actual selected
storage E10245, ownership and observer gates remain. Independent zero-byte NMI
cases first record eight guard REDs and then four initialized debug REDs/four
uninitialized passes. The bounded marker correction produces 24/24 independent
ordinary/NMI passes without changing the three frozen hashes recorded above.
The internal validator controls pass 8/8, including positive-width and invalid
context/range rejection. The AR-P24 independent review clears its exact two-file
delta `046dba87 -> 69d3f6f`; the later implementation test is reserved for phase
review. This is not general public NMI qualification.

AR-P25 preserves the semantic-entry prefix on the generated reference-only IRQ
tail. Its stable function identity and three emitted bytes do not change. AR-P26
sorts function symbol labels by their actual emitted names. AR-P27 consumes only
the applicable NMI reached-point proof plus separate retained/captured code
demands, and associates a source call only with a variant emitting its operation.
The unchanged mapper is mechanically extracted before extending the oversized
owner. Retained `.main.root` and `.main.depth` variants receive matching debug and
memory source owners. No actual context is manufactured and no validator or
missing-required-body check is relaxed.

| Raw capture                                                                                          | Exact result / boundary                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ar24-debug-fix-build.log`, `ar24-debug-typecheck.log`, `ar24-debug-spec-green.log`                  | Build/typecheck PASS; three independent files/24 cases PASS                                                                                                                                                                          |
| `ar24-debug-retained.log`, `ar24-zero-location-controls.log`                                         | Eight files/44 retained cases PASS; package validator file/8 cases PASS                                                                                                                                                              |
| `nmi-native-final-with-zero.log`                                                                     | 40 actual native artifacts/sidecars PASS plus four expected whole-wrapper placement errors; nonreturning source seam remains excluded                                                                                                |
| `nmi-public-candidate-suite.log`                                                                     | Initial complete candidate: 24 files/448 cases, 272 PASS / 176 FAIL                                                                                                                                                                  |
| `ar25-reference-public-directed.log`, `ar25-public-producer-native.log`                              | Reference boundaries clear; focused four-file set is still RED (76 PASS / 52 FAIL). Actual public-producer native output: 44 artifacts PASS plus four expected placement errors                                                      |
| `ar26-masked-helper-before.log`, `ar26-terminal-before.log`                                          | Real public-producer/native assembly followed by missing debug machine-entry failure                                                                                                                                                 |
| `ar26-raw-debug-shape-final.log`                                                                     | Actual derived graph reveals unsorted emitted label names; borrowed header is shape-location support only, not qualification                                                                                                         |
| `ar26-raw-native-green.log`                                                                          | Four actual native raw-body artifacts PASS all producer validators                                                                                                                                                                   |
| `ar27-range-extraction-build.log`                                                                    | Initial mechanical extraction catches an unused import; retained, not a pass                                                                                                                                                         |
| `ar27-range-extraction-build-final.log`, `ar27-range-extraction-directed.log`                        | Corrected mechanical extraction builds; independent zero-byte controls 24/24 PASS                                                                                                                                                    |
| `ar27-public-candidate-suite.log`                                                                    | First selected consumer misapplies the NMI reached proof to legacy catalogues; 284 PASS / 164 FAIL. Ordinary/IRQ-only regression is corrected before qualification                                                                   |
| `ar27-public-candidate-suite-final.log`                                                              | Proof applicability corrected; 328 PASS / 120 FAIL. Previously unrecognised retained-main variants expose the next mapper/owner boundary                                                                                             |
| `ar27-actual-raw-before.log`, `ar27-retained-finite-before.log`, `ar27-retained-terminal-before.log` | Real public producer/native runs expose missing semantic block ownership on existing `.main.root` variants                                                                                                                           |
| `ar27-cross-sidecar-red.log`                                                                         | Individually valid actual sidecars fail the unchanged cross-sidecar owner correlation; no validation waiver                                                                                                                          |
| `ar27-cross-sidecar-build.log`, `ar27-selected-debug-typecheck.log`                                  | Build/typecheck PASS                                                                                                                                                                                                                 |
| `ar27-cross-*-final.log`                                                                             | Six actual sources across four profiles: 24 native artifacts, all five validators and actual cross-sidecar correlation PASS. Includes masked helper, terminal main, raw body, normal/raw helpers and finite returning/terminal calls |
| `ar27-public-candidate-cross-final.log`                                                              | Current whole public set: 24 files/448 cases, 336 PASS / 112 FAIL; not GREEN                                                                                                                                                         |
| `ar27-aggregate-diagnostic.log`                                                                      | Four actual native aggregate-call artifacts and all validators/cross-sidecar correlation PASS; ABI behavior/oracle discrimination remains a separate specialist assessment                                                           |

Independent correctness review: no findings on the bounded exact correction tree
`97441bef327e04296a71fb31e1e6953c54ee4c38 -> bc8212a13cebc1006c8af8798511ef08c5b4959c`.
Scope is the reference-tail label and three debug/memory owner files, including
the new mechanical mapper. Earlier storage/ABI work is baseline, not reapproved.
The reviewer confirms no frozen-oracle edits and no invented execution/reentrancy
guarantee. All native digests and artifact paths remain in their raw logs.

Status: Verified partial; claim kind Fact for these named artifact boundaries.
Current task 2.2.10 remains unverified. Frozen lookup/behavior/cost failures are
not permissions to edit tests. Whole public, runtime/VICE, expert parity, external
stack/firmware and physical endpoints remain unqualified. No phase completion,
commit or push is claimed. Governing skill/spec/source lineage is unchanged.

### Exact frozen-oracle approval gate — 2026-10-05

Task 2.2.10 remains unverified and is now explicitly blocked by pending AR-P28.
No successor task runs and no frozen test is changed. The exact proposed twelve
files are preserved in baseline tree
`bc8212a13cebc1006c8af8798511ef08c5b4959c`; the register enumerates all nineteen
identity replacements and the four proof corrections. Earlier AR-P22 approval
does not grant this exception. Current progress remains 61/68, seven tasks left.

Independent native SFA/ABI auditor `ar27_abi_oracle_review` finds no compiler
ABI/storage or dead-source-effect defect in the supplied exact artifacts.
SF-001–SF-004 identify incomplete/over-specific test proofs. The reviewer inspects
all four profiles and does not run tests, an emulator, edit or commit. This is a
bounded artifact assessment, not a renewed whole-phase or external-entry audit.

| Finding | Actual endpoint / bounded recommendation                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SF-001  | Both aggregate callers write their exact destination `$0ca2` into the closed pair `$02/$03` before calling H at `$09d8`. H reads its byte parameter at `$0ca1`, sets Y=0 and writes through that pair; both callers consume `$0ca2`. The oracle incorrectly demands a second callee pointer copy. Preserve all ownership/value/order checks and accept the existing direct caller-populated form. Setup is 8 code bytes/10 nominal CPU cycles and 2 ZP bytes. |
| SF-002  | The exact direct fixture stores raw Q `$09d1` as four adjacent per-instruction ranges: `A9 D1`, `8D 10 C0`, `A9 09`, `8D 11 C0`. The masked CINV entry is independently `$09ce`. No one range can contain both immediates. The same operation's ordered ranges prove the actual raw low/high stores; 10 code bytes/12 nominal cycles.                                                                                                                         |
| SF-003  | Six false dead-suffix matches in the all-finite fixture are declaration-provenance terminators, not the dead operations. Actual H has no dead NMI publication/removal or `$c014` write. Match operation containment and the correct source index, and corroborate whole-body bytes. One generic unreachable dispatch JMP remains: three bytes/zero executed cycles on these paths; task 2.3.3 must assess this real output without a parity waiver.           |
| SF-004  | Direct H is only `$09cb: JSR $09c2`, ending `$09ce`; executing raw Q ends at its H JSR, `$09da`. The independently retained CINV variant is only `$09ce: JMP ($0b9b)`. It must satisfy its exact predecessor-shell contract, not an H-call requirement. Never skip an entry only because a call was not found.                                                                                                                                                |

| Actual four-profile case | PRG SHA-256                                                        | Final SFA identity                                                 |
| ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Aggregate                | `d5f2dd9c85945baf2797014e2326dffc36a570ed51f0bc5a59f7d99789fe34cc` | `c3469f16503a044e2e0b6dffa2209479d2df96328807a02167c4501fe6af60cf` |
| Exact direct terminal    | `d946a8e062766c6d60f9e8cd2fbeb6ff6e134acbb40d6d5128075506ee66a4af` | `e486cb28a154daec02a566d4a0e7d15bdee80a62befe980cbb1c699de4d208e5` |
| All-finite terminal      | `16df8d8d9ffb1c1a12c34e87c26bc8f681e3422f28a34d71511b4aeb94c77a62` | `54f68c0c9698735e40cdf9d69c04302f2712acf8d4a05cb1f1e0242e85074d5a` |

All three actual native cases pass the five artifact validators and unchanged
cross-sidecar consistency checks. The direct fixture is copied exactly from the
frozen first nonreturning test; its decisive log is
`ar28-direct-terminal-diagnostic.log`, under `/tmp/blend65-nmi-ar21.0c36Fe`.
Aggregate and all-finite logs are `ar27-aggregate-diagnostic.log` and
`ar27-cross-retained-terminal-final.log`. Borrowed-header shape output is not the
qualification endpoint. Relevant function storage remains aggregate 8 RAM + 2 ZP
bytes, direct terminal 4 RAM bytes of links, all-finite 9 RAM bytes (5 selection/
value, 4 links); startup/code/padding/platform placement is accounted separately.

Fresh retained controls also pass: `ar27-retained-final.log` has seven root
files/72 tests; `ar27-package-retained.log` has two package files/17 tests.
The full public set remains 336 PASS / 112 FAIL. One hundred failures currently
stop at incorrect bare owner IDs; four at the pointer-copy assertion and eight
at instruction-range mechanics. Fixing those checks may expose additional real
defects; their present locations are not a forecast of GREEN or authorization to
alter any further expectation.

Status: Verified partial / Fact for the inspected artifact boundaries only.
Runtime/VICE, physical hardware, external raw-entry overlap, unrestricted
external stack, firmware completion and whole-program expert parity remain
Unknown. A raw numerical address does not prove invocation, arrival or lifetime.
Spec/expert and the twelve proposed files stay frozen. No commit/push. The only
Blend65 scratch root in `/tmp` is current verification/review evidence and is
still needed; nothing is deleted and no other `/tmp` content is touched.

Knowledge lineage remains expert 2.0.3/content
`22cc5f00f381c82d347cf342be4fcff16bc291c6`, router SHA-256
`599a68a63721f89ddc7283461f1f2e3e4fee4ae2a3c1723393e81a7e25634030`
and specification
`BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`.
SFA final closure, selected ABI, CPU addressing/stack, C64 interrupt-entry and
actual artifact-byte boundaries govern; keys MOS-PGM-1976, MOS-HW-1976,
MOS-6510-1982, CBM-C64-KERNAL-03 and ACME-097-R266 remain unchanged.

Approval-handoff checks PASS: forced targeted Markdown formatting, local links,
the four bounded source-file formatting checks, whitespace/diff integrity,
empty spec/expert status and exact twelve-file byte comparison to `bc8212a1`.
The sole checklist has 61 verified, one blocked and six pending tasks (68 total).
These documentation/integrity checks do not turn the public RED suite GREEN.

### Approved oracle repair and preserved boundaries — 2026-10-05

User approval: “I approve - proceed”, accepting only AR-P28's enumerated twelve
files. Nineteen lookup strings are corrected; fixtures and profiles remain
unchanged. Initial candidate tree is `c80b000d957019d1fe350b97b2f041892561466e`.
Directed twelve-file set: 136 PASS / 28 FAIL; both repaired proof files pass
24/24. The 23-file NMI-only set is 400 PASS / 28 FAIL; it excludes the retained
profile file, so it is not the earlier comparable 448-case checkpoint.
Logs: `ar28-public-repair-directed.log`, `ar28-public-candidate-suite.log`.

Independent exact-exception reviewer clears the ten lookup-only files but finds
two critical proof gaps in the new assertions: RV-013 (reviewer RV-001) permits a
pointer overwrite after caller setup, and RV-014 (reviewer RV-002) does not prove
the installed CINV target is the checked firmware shell. These are oracle
counterexamples, not reproduced production corruption. Ruling: fix both within
AR-P28's already-approved no-overwrite and independent-entry requirements; waive
neither. Caller/callee direct, indexed, indirect and call clobbers must fail the
pointer-survival check; actual CINV publication must identify the checked shell.
The source programs and product behavior do not change. The updated proof
owners stay below 300 lines. Fresh directed verification and one fix-only
independent re-review are required before exact exception clearance.

The reviewer accidentally reads release-record qualification narrative instead
of stopping at metadata. It reports the exposure and excludes that narrative
from decisive checks; no fresh blind domain qualification is claimed.
Remaining failures in three previously lookup-blocked files are under actual
native-byte/source-owner diagnosis, not permission for further frozen edits.
No successor, public GREEN, whole-phase qualification, commit or push.

### AR-P28 clearance and the next exact oracle gate — 2026-10-05

Corrected candidate tree: `c91d637f0ec141784fad8605cbd015169c6ff19d`.
The exact nineteen-replacement inverse check reconstructs each of the ten
lookup-only files from `bc8212a1`, applying only the approved identity replacements
and targeted formatting; all ten comparisons PASS. Source fixtures and profiles
remain unchanged. The two proof owners remain 288/294 lines.

The exact correctness reviewer completes its one fix-only review from `c80b000d`
to `c91d637f`, reports no findings and clears RV-013/RV-014. The independent
SFA/ABI reviewer corroborates complete destination setup/survival, closed pointer
homes, zero element offset, caller consumption and actual reference-shell
publication; no SFA/ABI findings remain at these repaired endpoints. No new
blind qualification, whole-phase or external/raw invocation proof is claimed.

| Fresh verification                                     | Result / evidence under `/tmp/blend65-nmi-ar21.0c36Fe`                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Two repaired proof files                               | 24 PASS; `ar28-proof-tighten-green.log`                                                                 |
| Comparable public set, including retained profile file | 24 files/448 cases: 420 PASS / 28 FAIL; `ar28-public-candidate-comparable-final.log`                    |
| Five exact newly exposed fixtures, four profiles each  | Twenty actual native artifacts PASS; all five validators and unchanged cross-sidecar consistency checks |

All 28 remaining failures are in the following three owners. Independent SFA
review SF-005 identifies a 345-byte startup range beginning with the three-byte
`STA $0b69`; the test incorrectly sends the whole block to its instruction operand
check. Every actual instruction decodes within the startup range. SF-006
identifies the two walkers' normal main-to-platform exit as another test
assumption, not function-storage overlap or an outside-owner source call.

| Exact fixture / native log                          | Actual main exit or startup endpoint           | PRG SHA-256, identical across its four profiles                    |
| --------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| links-simple / `ar29-links-simple-native.log`       | Startup `$080d–$0966`, 345 bytes               | `534284cca72e797a2b2c85404a2912c31c3194ca9b1ae468e705eb9d6042126c` |
| installer-empty / `ar29-installer-empty-native.log` | Main `$09bf: JMP $0b4a`; restore `$0b4a–$0c69` | `02a8559786dc717a89ed8f38d6b176ca66433882cc2d8cbc22cf2b1059cd4161` |
| installer-store / `ar29-installer-store-native.log` | Main `$09bf: JMP $0b54`; restore `$0b54–$0c73` | `b6251975e98a3b17c45188b2f028b0df260dd2f95dbb47291df5be713997f260` |
| owner-inline / `ar29-owner-inline-native.log`       | Main `$09bf: JMP $0b4a`; restore `$0b4a–$0c69` | `faf3bf38e1e7eabfb53741a85977e66aeeb757c59a20884fb2ce7cd2d29fb556` |
| owner-helper / `ar29-owner-helper-native.log`       | Main `$09c5: JMP $0c4a`; restore `$0c4a–$0d69` | `cb7a01c1d0376b1b2d5521c3b54d913c786f6eb3e0ae249f25997aac0723a354` |

Each actual restore range is generated/platform-owned and ends with PLP/RTS.
Frozen `spec/appendix-c64.md` requires the returning-main epilogue to restore
captured compiler-owned state and return to BASIC. Existing
`layout/startup.ts` emits the separate `startup.restore` block; native labels
must independently corroborate that precise target. A test may not simply accept
any outside-owner jump, drop the main JMP, or assign platform bytes to main.
The native byte review finds no absolute STA/STX/STY to `$0318` anywhere and no
function-owned LDA/LDX/LDY/BIT from `$dd0d` in these twenty actual artifacts.
Those controls remain binding. Borrowed-header shape output in the diagnostic
logs is not the decisive endpoint; the actual native PASS, five validators and
cross-sidecar checks are.

AR-P29 proposes only the local startup-range decoder and main-exit proof repairs
in three existing files. It additionally states the bounded 400-line local-owner
exception: current lengths are 292/313/333 after approved formatting; no shared
test-support framework or fixture-only split is proposed. Its exact permission
is pending. All fixtures, profiles, assertions, diagnostic/source ownership,
closed storage and expert-cost obligations remain unchanged.

| Frozen three-file baseline at `c91d637f`                  | SHA-256                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| `test/rd05/nmi-route-links.spec.test.ts`                  | `de6da591f70ebc4bcd0465e50ed4cf1d82bb400ef2322f379697667126323c77` |
| `test/rd05/nmi-route-raw-installer-output.spec.test.ts`   | `3d2dbba3b94003eed1c52d9a924ff42d70ef078f0dedb3c495da90ed4caeaaa1` |
| `test/rd05/nmi-route-raw-owner-continuation.spec.test.ts` | `e7d4a9dd17b7ad009f37d7059767928c43a14621f636819850c1cc6ed36e62d6` |

No three-file repair or successor work occurs before explicit approval. The sole
checklist remains 61 verified / 68 total: one blocked public-GREEN task and six
pending tasks. Native structure is Verified partial; runtime/VICE, hardware,
external stack/firmware completion and expert parity remain Unknown. No full
phase checkpoint, local commit or push. Frozen spec/expert lineage is unchanged.
The only Blend65 `/tmp` root remains needed evidence; nothing is deleted and no
other temporary content is touched.

### Approved AR-P29 local repair — 2026-10-06

User: “I approve”, accepting AR-P29's exact three-file mechanics and <=400-line
local-owner exception. Candidate tree `d0e36a60b6bf7b45371b9462f7cf0dd868d1271f`
changes only the approved test owners and plan/roadmap documents from `c91d637f`.
Production code, spec/expert authority and all other oracle files are unchanged.
The three complete `describe` bodies, all source fixtures, behavior/cost assertions
within them and profile lists are byte-identical to the baseline. A deterministic
comparison confirms this; helper-only changes still need exact independent review.

| Approved owner                                  | Lines | Candidate SHA-256                                                  |
| ----------------------------------------------- | ----- | ------------------------------------------------------------------ |
| `nmi-route-links.spec.test.ts`                  | 337   | `cbada3dcb93475e99597362980315e891db4f3b69a9a06a8c322a158c91b7f0a` |
| `nmi-route-raw-installer-output.spec.test.ts`   | 363   | `72c8cf941e5ff70620bf5b88fbb7d02a85949f52da9091822f7b4d2894cede3d` |
| `nmi-route-raw-owner-continuation.spec.test.ts` | 377   | `887a797970a4038b0f14bae5d2b9e8fbd1767497eb225a8583e6fc53ed74c668` |

Directed three-file verification: 28/28 PASS (`ar29-directed.log` under the existing
scratch root). Full comparable 24-file public verification and independent exact-
exception review are in progress; task 2.2.10 remains unverified. No successor,
public GREEN declaration, runtime/parity claim, local commit or push.

Exposure disclosure: the primary reads past routing's normative section into its
setup evidence; the independent reviewer reports accidental release-record
qualification-narrative exposure during metadata extraction. Both exclude these
narratives from decisive checks. This bounded exception audit uses the exact
diff, frozen contract, normative CPU/platform facts and actual native bytes; it
does not claim renewed blind expert/domain qualification.

The exact reviewer reports MAJOR RV-015 (its RV-001): both main walkers still
accept RTS/RTI/indirect JMP before entering the new platform-restoration branch.
Replacing main's final JMP at `$09bf` with RTS leaves the checked transactions
unchanged while bypassing restoration. Prevalidating the restore label/range
does not close this path. No unauthorized edit is found, but exception clearance
is withheld. The reviewer separately corroborates all twenty native hashes and
the 287-byte/99-instruction restore endpoint; current fixtures pass, which does
not refute its adversarial counterexample.

Ruling: accept the smallest helper-only correction required by the user's exact
AR-P29 contract. Under PRIME workflow rule 4, reject ordinary terminals whenever
the main restore exit is supplied; retain them for helpers, raw entries and the
separate recursive platform decoder. This implements the already-approved
main-only final-JMP requirement, not a new exception, user-owned fork, risk
waiver, source restriction or fixture change. Apply the correction only after
the pinned candidate's active test run finishes. Fresh directed/full public
verification and the one fix-only independent re-review are required.

RV-015 fix candidate: `9b098fac155e1325d7a73e5d7891d4e637033a6d`.
Fresh directed verification passes 28/28 (`ar29-fix-directed.log`). The one
fix-only exact reviewer reports no findings: direct main RTS/RTI/indirect JMP
now fail, while platform/raw/helper terminals and complete restore checks remain
unchanged. Bounded AR-P29 exception clearance is complete; fresh complete public
verification remains pending. The initial pre-fix public run is 448/448 PASS
(`ar29-public-comparable.log`), not evidence for the corrected candidate.

| Final frozen AR-P29 owner                       | Lines | SHA-256                                                            |
| ----------------------------------------------- | ----- | ------------------------------------------------------------------ |
| `nmi-route-links.spec.test.ts`                  | 337   | `cbada3dcb93475e99597362980315e891db4f3b69a9a06a8c322a158c91b7f0a` |
| `nmi-route-raw-installer-output.spec.test.ts`   | 366   | `489e09b5606444c265b4be4c14407a7e25780125d15bfc510c3974c366bbdd1d` |
| `nmi-route-raw-owner-continuation.spec.test.ts` | 380   | `31445afa52a6eae14680038f9b904d29af15a1f997a9729926fdc348f50ff309` |

No wider edit, risk waiver or phase/runtime/parity qualification follows. The
three files now freeze at these hashes. Required remaining internal, VICE,
expert-output and full-phase checks precede a coherent green local checkpoint.

Final corrected public checkpoint: all 24 files/448 cases PASS, no skips,
`ar29-fix-public-comparable.log`. Complete fixture/profile byte comparisons,
targeted formatting, documentation self-check, no planning-reference leaks,
whitespace and empty spec/expert status pass. Exact exception review and its
one fix-only pass are clear; RV-015 is resolved. Task 2.2.10 promotes to verified;
the sole checklist derives 62/68 (91%), six tasks remaining. Public artifact/check/
byte qualification is Verified partial: internal, runtime/VICE, full-phase,
expert parity, physical and external guarantees are not thereby qualified.

### Internal lifetime regression checkpoint — 2026-10-06

Task 2.3.1 uses real in-memory frontend/semantic inputs and the existing observer
and address-fact owners. Nine directed cases PASS (`nmi-lifetime-directed.log`);
three files/24 cases PASS with existing IRQ/context controls
(`nmi-lifetime-retained.log`). The first root-config invocation selected no
package files; the successful runs use the compiler workspace's actual test
command. No test failure, production change, public oracle edit or new harness.

The 243-line implementation test freezes at SHA-256
`a9fe9622cc13a4058dd8e4900069fc516be192b2c293811020b37f2d5053a7b1`.
Targeted formatting, documentation/reference scan, whitespace and empty
spec/expert status pass. All temporary evidence remains needed; nothing is
deleted. The checklist derives 63/68 (93%); five tasks remain. Runtime, expert
output, full-phase and physical qualification are still pending.

### Internal machine/layout checkpoint — 2026-10-06

Task 2.3.2 adds twelve selected-wrapper/private-scratch cases and 28 layout cases
across all four profiles. Exact opcode and independent cost expectations cover
empty, A-only, X-only, Y-only and full A/X/Y saves; transitive and unknown callees,
retained-but-unentered demands, complete source placement and late machine scratch
are separate controls. Real layout charges all loaded bytes, rejects actual
collisions/alignment/page violations, and uses only the immutable three-byte
adapter when the complete body needs it. No production or public oracle change.

The approved obsolete implementation-tier NMI case alone changes to success.
Every other case and source fixture in that file is unchanged. The first new
scratch test used a short function name; correcting its source-identity lookup
produces seven-file/76-case PASS (`nmi-machine-layout-retained.log`), including
existing IRQ, general layout and lifetime controls. Final typecheck, targeted
formatting, documentation/reference scan, whitespace and frozen-authority checks
PASS. Native runtime and equivalent complete-artifact parity are not claimed.

| Internal owner                           | Lines         | SHA-256                                                            |
| ---------------------------------------- | ------------- | ------------------------------------------------------------------ |
| `machine/nmi-entry.impl.test.ts`         | 286           | `cdc4e73b585fda12c5a850ddfec14b5ed6aabc6c86ce518ee9cd5c44c38941dc` |
| `machine/interrupt-domains.impl.test.ts` | Existing file | `9433402c9302e8f5be8ba6f4c9a145f9a6f5f5ab6a2c384d3ce91a74be83e795` |
| `layout/nmi-placement.impl.test.ts`      | 171           | `1b260e9eaed1a87d7575528a5b6f8f01482d83fb4267b0998ff8aa9b0533c28c` |

The only temporary Blend65 root remains needed evidence and is retained.
The checklist derives 64/68 (94%); four tasks remain. No coupled RED checkpoint
is committed and nothing is pushed.

### Native qualification and bounded cost repair — 2026-10-06

Task 2.3.3 is active. Sequential native replay now passes 32 scenario/profile
checks: 116 genuine RESTORE events, four real CIA2 Timer A events and twelve
programs copied from the exact ST-15 constant-copy/global-plus/combined sources.
The complete assertion capture is `nmi-native-assertions.log` in the retained
`/tmp/blend65-nmi-ar21.0c36Fe` root. It records each decisive log's SHA-256.
Public generations and all eight artifact digests per generation are in
`nmi-runtime-build.log`, `nmi-runtime-build-seeded.log` and
`nmi-runtime-build-flows.log`; compiler HEAD remains `4b19dd76` with the uncommitted
phase candidate. No old generation or historical runtime result is substituted.

The timer's initial native memory-trace record is absent at the FE54 stop.
It is not counted as proof. The retained `.read.log` replay stops before the
actual `LDY $DD0D` at FE51, takes exactly one native instruction step, and observes
FE54/Y81 after four cycles. Pinned ROM bytes from FE47 through FE54 independently
show no earlier consuming read. All four profiles pass this exact endpoint.
No monitor ICR read consumes the result. Genuine STOP reaches FE66 with STKEY7F;
neither firmware restart nor arbitrary external nesting is thereby qualified.
Status remains VICE-verified / hardware-unverified.

The required independent output auditor reports MINOR MC-001: a proved
nonreturning finite-call arm emits an unreachable three-byte continuation JMP.
Actual witness: `20 CB 09 4C 30 0A` at $0A27 in the four-profile retained-terminal
fixture. Keeping JSR but ending that arm with the existing unreachable terminator
removes three code bytes; in this fixed-low-byte layout, fill increases by three
and total loaded payload remains unchanged. Stack, effects and executed cycles
are unchanged. Returning or unknown arms must retain their continuations.

Ruling under PRIME workflow rule 4: accept this necessary deterministic repair
within the already-approved complete-cost qualification. Reuse the existing exact
`returningBodies` fact in `machine/lower-indirect.ts`; no pass, IR schema, tail-call
change, source restriction, framework or new product scope. An independent new
public specification regression and RED gate precede the code change. Existing
frozen test files remain untouched. This is not a risk waiver or user-owned fork.
Full expert qualification and mandatory measured local-meet tracking remain due.

The expanded required output review reports MAJOR MC-002/MC-003 and MINOR MC-004,
not a parity pass. H materializes, copies and recompares a single-consumer closed
conditional callback choice; effect-free empty terminal loops retain three jumps;
identical storage-free contexts duplicate each source terminal's body. Ordinary
JSR frames and the two distinct source identities remain part of the comparison.

| Equivalent complete retained work | Actual                 | Expert                 |
| --------------------------------- | ---------------------- | ---------------------- |
| H plus terminal bodies            | 110 code bytes         | 17 code bytes          |
| H path to target, nonzero / zero  | 71 / 62 nominal cycles | 12 / 13 nominal cycles |
| Recurring empty-loop iteration    | 6 cycles               | 3 cycles               |
| H function storage                | 5 bytes                | 0 bytes                |
| Raw Q → H → terminal stack        | 10 bytes               | 10 bytes               |
| Existing fixed-low-byte payload   | 872 bytes              | 872 bytes              |
| Complete resident RAM             | 931 bytes              | 926 bytes              |

In this exact layout the 93 code bytes become 93 extra loaded fill; no 93-byte
PRG saving or executed whole-program speedup is claimed for a retained-but-
uninvoked witness. The callback/loop cycle and storage gaps still violate the
expert floor. The analyst's separate restoration-block split would trade three
cold cycles for 180 fewer loaded bytes, but is not assembled/runtime-qualified
or approved for this slice. It stays a future measured path, not an implementation.

Mandatory local-meet debt is now [issue #96](https://github.com/blendsdk/blend65/issues/96),
created under the standing PRIME authorization. It records wrapper/transaction
local floors, complete padding/ROM/storage costs and the existing-layout route to
a whole-program win. It does not defer or waive MC-002/MC-003. No Git push.

The independent MC-001 spec author adds one new 238-line oracle, frozen at
`014c724207481fc1e71005eb29e7518bf1c953c8634216e60b9ace38aa16efea`.
Twelve cases fail on the actual unreachable terminal-arm jump. Four returning
controls fail an over-specific direct-call check: an existing canonical thunk
can be correct. These four are not counted as implementation defects. AR-P30's
exact new-file clarification requires observable callback effects and accepts
only a proved ABI-correct direct or canonical-thunk call. Existing oracles remain
unchanged; no expectations are silently weakened to ease implementation.

AR-P30 blocks task 2.3.3 before any production correction or ledger retirement.
The required blind direction challenge returns Justified and converges on the
bounded existing-owner repair, with Medium confidence pending equivalence proof.
No new pass/framework or cross-source identity merging is approved. The user must
approve this exact scope and new-oracle clarification before execution resumes.
Tasks 2.3.4–2.3.6 and the coherent green checkpoint remain due.

Evidence binding: `nmi-native-assertions.log` SHA-256
`944d1ab29eca9cd4618eaf3b7baff7da64644375b20fe05ac34330d4a1c9d938`;
assertion script `8e190cdbb63e4fe3c69846bfa2c054fd878c09d2c1fb68841d944fae68a2de3e`;
exact source-flow build inventory
`e00eae2709b7d2bd683100c2fde79a48d6f704ac6841468cbe9d62c2eb44fe4e`.
All twelve native source-flow invocations exit 0 (owned session 75425). The
independent auditor reconciles all 32 raw-log hashes and exact source/artifact
digests. Full A/X/Y assembled construction, unrestricted external stack, complete
firmware completion, arbitrary nesting and physical hardware remain Unknown.
All needed temporary evidence is retained; nothing unrelated is deleted.

Final blocked-handoff validation passes targeted Markdown/new-oracle formatting,
92 existing local links, exact 64/68 checklist count with one blocked task,
whitespace and empty frozen specification/expert status. All three approved
AR-P29 test hashes remain exact. No full-phase GREEN, ledger retirement, production
repair, commit or push is claimed while AR-P30 is awaiting the user.

## Approved AR-P30 start and exact AR-P31 oracle gate

The user confirmed repairing and verifying before commit/push on 2026-10-06.
MC-001 uses the existing exact-false returning-body fact to retain each ordinary
call while removing its impossible machine continuation. Returning/unknown arms
remain conservative. Build, touched production formatting and all 48 cases in
the four retained-call/nonreturning control files pass. Capture:
`ar30-mc001-retained-controls.log`. All sixteen
revised primary cases pass their behavior/effect/ABI assertions, then fail solely
at the resident-versus-loaded accounting assertion by 50 bytes. This is not a
GREEN test file. Capture: `ar30-mc001-primary.log` in the existing raw-evidence root.

The independent new selector-cost file freezes at SHA256
`731b0d908d48ad7a09dff074f16c32bdabcc5ac5b158ef46f5926f39cdf4eae2`
(198 lines). Its twenty profile/case rows are twelve genuine selector/loop/home
REDs, four wrongly assumed kind-field differences, and four complete physical
loaded-prefix/padding PASS controls. Primary freeze:
`a90667b30d4ec24b1deaaa9e0c5a805bb69623d7fdca1e06ad207377517bbc6a`
(325 lines). Neither faulty frozen assertion is changed without the exact AR-P31
ruling. Their author read no forbidden implementation, other tests or raw native
evidence. The main agent supplied the incorrect whole-resident accounting packet;
public source-role kind is not a raw/firmware ABI discriminator.

MC-002–MC-004 are not implemented. Their independent cost RED is now durable.
AR-P31 owns only two exact local oracle corrections and the primary local helper's
350-line ceiling. No new framework, schema, API, compiler producer or source rule
is proposed. All other fixtures, assertions, costs and frozen authorities remain
binding. Qualification, ledger retirement, full-phase review, commit and explicitly
authorized push remain pending; task count is still 64/68.

## Approved AR-P30/AR-P31 repaired endpoint — 2026-10-06

The user approves AR-P31's exact two assertions and local 350-line ceiling.
The independent blind author changes only the loaded-prefix accounting helper
and the final raw/firmware identity case. In-memory inverse reconstruction
reproduces both earlier frozen hashes. New freezes are primary
`0dc79802995c1eb0848c27d67550c9b8900c9d0c3392f8f46a645a27e1f499e5`
(337 lines) and selector
`d8c1cd86389a9cfb15777f1a1f7b96e96040f96aff6ead4c461be6f3f9b5e925`
(217 lines). Fixtures, all other assertions, independent behavior and cost
expectations remain unchanged. The author's pre-production run retains twelve
genuine selector/loop/home RED cases and 24 passing controls.

MC-001–MC-004 are implemented through the approved existing owners. The semantic
rewrite requires an immediate single-consumer merge/store/load/no-argument call,
two pure function-address arms and ordinary void constant-only nonreturning
loop leaves. It removes unnecessary homes before storage inventory. The existing
machine selector reuses only the adjacent fixed byte read's zero flag. Empty-loop
layout retains all labels and the backedge, collapsing only instruction-free
jump chains. Sharing is within one source identity only; surviving finite-indirect
consumers, returning/effectful leaves and parameter-bearing bodies keep their
existing selection. Raw and firmware interrupt entries remain separate.
No new pass, IR form, framework, API, schema, runtime or source restriction is added.

All 36 independent public output cases pass (`ar30-output-complete.log`). Four
internal files pass 32 conservative cases (`ar30-internal-expanded-final.log`):
observed identities, copied values, arguments, effect barriers, returning paths,
word/dynamic reads, explicit loop instructions and ordinary exit duties remain
conservative. The initial internal failure was a malformed implementation-tier
fixture referring to a missing CFG block; its block label alone is corrected.
Frozen specification oracles are not altered. Install, build and typecheck pass
in `phase2-final-{install,build,typecheck}.log`; the complete checkpoint remains
pending. Whole-phase review candidate tree is
`2b75e557760b73f9e57d5a114e2223acfba4bd00`, including all 92 owned dirty paths.

Four fresh actual native retained-witness artifacts are in
`native-l8gbSA`, `native-Jv569c`, `native-9sa6pE` and `native-jrJewV`
under the existing raw root `/tmp/blend65-nmi-ar21.0c36Fe` (each `assembled/`).
All PRGs have SHA256
`56fc56c36ce4e691f6bf01a03e0c77546cd2c0685509256956c48560f32d20d1`.
Actual build/debug/memory/cost/assets validators and cross-sidecar correlation
pass. The script's borrowed-header debug-shape probe is diagnostic only and is
not counted as qualification evidence. Capture:
`ar30-retained-terminal-native-final.log`.

Independent actual-byte accounting confirms H is 11 bytes with one `$C012` read,
an ordinary selected JSR frame and 12/13 cycles to callee entry. Each distinct
terminal source is one 3-byte/3-cycle self-loop. Complete code is 756 bytes
(−93), loaded fill 104 (+93), BASIC 12, payload 872/PRG 874 unchanged, SFA 4
(−5), resident RAM 926 (−5), ZP/scratch zero. The raw retained Q path has a
10-byte program stack peak; retention is not invocation. This is a local expert
meet, not a measured whole-program loaded-size or execution-speed win. Issue #96
owns the separate complete-layout opportunity; no above-floor defect is deferred.

The previously unknown full A/X/Y assembled endpoint is now independently
checkable in `ar30-full-axy-native.mjs` / `ar30-full-axy-native.log`. Four actual
ACME roots are `full-axy-8lrPmZ`, `full-axy-glvBvV`, `full-axy-u8e4W2`,
`full-axy-pibiA6`. All PRGs have SHA256
`4e5c30f0c10b362571dc9b600442daede5d3553897f426e46171f55536b1098f`.
This synthetic selected-machine body uses real `closeStorage`, exact request/home
binding, layout, serialization and ACME output verification. Its one persistent
page-safe tail is closed at `$C0FE/$C0FF`; no storage is invented after closure.
Actual bytes are `08 48 8A 48 98 48 D8 A9 01 A2 02 A0 03 68 A8 68 AA 68 28
6C FE C0`: body 6 bytes/6 cycles, wrapper 16/43, total 22/49, CPU-inclusive entry
stack 7. This proves the selected-machine/assembler boundary only, not a public
source-level full-AXY program or native runtime behavior.

Fresh public builds rebind all four seeded-write and twelve exact source-flow
fixtures to this compiler endpoint. Every source SHA and actual PRG SHA is
byte-identical to its earlier observed native fixture. Inventories are
`ar30-runtime-write-rebuild.log` and `ar30-runtime-flows-rebuild.log`; old generation
directories and native observations remain intact. The 32 earlier native
scenario assertions therefore still describe the exact final machine bytes,
not guessed new addresses. No duplicate VICE run or silicon proof is claimed.
Whole-phase independent review, full tests and chained ledger retirement remain
pending; no green commit or push yet.

## Final checkpoint review and necessary initializer correction

Task 2.3.3 verifies at 65/68 after the fix-only output review clears MC-001–MC-004,
full A/X/Y selected-machine cost and exact runtime PRG rebinding. Only the chained
ledger row retires; all three retained old oracle files pass 44/44. Issue #97
records the callback/terminal local meet and the unimplemented full-artifact win
path linked to #96. The actual original captured native observations remain
VICE-verified / hardware-unverified, with their stated limits.

Whole-phase base candidate `deae854c1391159e8388b1ffc159b0de4377d462` includes all
92 owned paths against Phase 2 baseline `e1a813c88003478d678c256f1b109090a30f1172`.
Independent correctness/maintainability/standards review reports no findings.
Its separate evidence completion independently inverts only the two AR-P31 slices
and reproduces both original hashes exactly; every other byte is unchanged.
AR-P11/AR-P14/AR-P19/AR-P21/AR-P22/AR-P28/AR-P29 exceptions likewise clear.

The first full checkpoint fails two old implementation-tier CIA fixture cases
because their supposedly proved synthetic NMI binding lacks the new matching-low
flag. Only the fixture's `matchingLowNmi: capability === "c64.system.restoreNMI"`
support field is added. Assertions, production guards and specification tests are
unchanged; the reviewer independently checks this exact delta. Four directed
internal files pass 62/62 (`phase2-cia-fixture-proof-final.log`). Typecheck passes;
the complete retry passes compiler 1,750 cases with two existing skips, while the
root suite finishes with 2,174 PASS and one FAIL: the retained portability
oracle detects a hard-coded C64 vector address in shared `interrupt-routes.ts`.
AR-P33 removes only the redundant literal, relying on the selected sink's
qualified capability/variant/domain identity. The oracle stays unchanged.
Neither attempt is called a full GREEN checkpoint.

SFA review finds MAJOR SF-001. Initializer staging/word-low requests and selected
machine-created pointer/helper demands omit their already-known main execution
domain. The asynchronous interference rule correctly requires explicit domains;
the omitted producer fact lets an initializer saved low byte overlay actual IRQ
retained storage. A legal source first initializes `ADDRESS = $C010`, installs
an IRQ through `arm()`, then initializes `result = peekw(ADDRESS)`. The IRQ keeps
two sampled bytes live before storing them; main also balances an empty chained
NMI and restores the IRQ. Actual closed shared layout puts both the initializer
low byte and the IRQ retained value at `$0BA4`. An IRQ between low-byte storage
and reload can change `$2211` into `$2233`. Startup does not mask initializers;
these are actual selected invocations and emitted accesses, not raw retention or
an ordinary parameter alias. The initializer pointer at `$02/$03` is also
domainless, though this witness has no competing IRQ pointer. Decisive captures:
`phase2-sfa-review-probes.mjs` and `phase2-sfa-review-probes-dynamic.log` in the
retained raw root. This is allocation/emission evidence, not a VICE observation.

AR-P32 owns the necessary deterministic correction under PRIME workflow rule 4:
propagate the existing selected main descriptor into initializer inventory and
normalize every initializer-discovered request/helper before closure. An
independent public initializer/IRQ regression must capture RED first. Reuse only
`storage/inventory.ts`, `machine/lower.ts` and one new existing-tier specification
file; preserve all old oracles. Do not mask startup, add a source workaround,
invent a storage model, or defer the corruption. Final full verification and one
bounded fix-only independent clearance remain mandatory before commit/push.

## Necessary checkpoint corrections — directed GREEN, final review pending

AR-P32–AR-P36 are necessary existing-owner corrections under PRIME workflow
rule 4, not new product choices or complexity approvals. No API, profile,
runtime, storage model, optimizer, schema, dependency or harness is added.
The whole-phase first pass and one combined fix-only pass remain distinct.
Fix candidate: `482c574fa008509a27d977f313e5147493075316` (97 owned paths).

| Correction      | Actual change and verification                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AR-P32 / SF-001 | Initializer inventory staging and word-low requests carry main execution; every selected initializer request and helper identity/request list uses existing domain normalization before storage closure. `ar32-domain-build.log` passes; `ar32-domain-directed.log` passes 44 cases. No startup masking or extra frame.                                                                |
| AR-P33          | Remove only the redundant `$0318` literal from shared route identity. Qualified selected capability/variant/domain still determine the route. `phase2-portability-directed.log`: 123 PASS; retained oracle unchanged.                                                                                                                                                                  |
| AR-P34 / SM-001 | Existing address-flow facts retain owned RAM/ZP places through word conversion and ordinary copies, use actual fixed placement when present, and inspect every write byte including wrap. Both ownership consumers use that same proof. Borrowed/opaque/unknown arithmetic remain conservative. `ar34-owned-address-directed.log`: 144 PASS, including retained unsafe-write controls. |
| AR-P35          | Debug projection matches the actual selected IRQ root to its canonical machine entry label. Existing homes/certificate remain the authority; no storage is created or all-variant projection fabricated. Eight frozen initializer cases pass before the allocator correction.                                                                                                          |
| AR-P36 / PE-001 | Only the three memoization keys omit vector words with no possible live reader. Complete observer closure traverses protected entries' inherited tails. Operational word maps and the physical binding catalogue remain intact. `pe001-key-internal.log`: 33 PASS; `pe001-key-public.log`: 72 PASS.                                                                                    |

The blind author freezes four new files. No old specification oracle changes
in these corrections. The first initializer file's eight REDs expose missing
debug projection, not allocator separation; the separate temporary file provides
the genuine four-case allocation RED. The writer file provides 40 genuine REDs
and 32 passing controls. The sequential-scope file's four baseline PASS cases
protect behavior; they do not independently measure performance.

| New file under `test/rd05/`                      | Frozen SHA256                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| `nmi-route-initializer-lifetimes.spec.test.ts`   | `0458459c6970db742dd1bad6514131404863871d2cf6085569b9543e0345e116` |
| `nmi-route-initializer-temporaries.spec.test.ts` | `1ad48e14fbc48c5e746bb6c55a8bce37671f467d528c9a1b459e071237807aeb` |
| `nmi-route-owned-address-writers.spec.test.ts`   | `c69f18b67e3fdab1419d6845d55c041577aa6550241d481a72ab3f3a28511726` |
| `nmi-route-sequential-scopes.spec.test.ts`       | `58ab2ec71b7b6499f5e4388984f91aabe3926784850d535e3ce3d39cb0cb3379` |

Host-cost witness: `phase2-sequential-scope-cost.mjs` measures only existing
whole-program closure after frontend/semantic construction. One instrumented
run per K counts actual Map writes and maximum map size; it is not peak RSS,
a hardware timing result or a general benchmark. Source hashes match before
and after for K=4/6/8. Binding counts remain K+2 at every measured endpoint.

| Sequential IRQ scopes K | Before ms / map writes / largest map | After ms / map writes / largest map |
| ----------------------- | ------------------------------------ | ----------------------------------- |
| 4                       | 121.04 / 14,493 / 221                | 39.18 / 4,712 / 47                  |
| 6                       | 476.80 / 62,789 / 917                | 45.33 / 6,762 / 67                  |
| 8                       | 2,104.37 / 274,525 / 3,701           | 43.50 / 8,828 / 87                  |
| 16                      | Not run                              | 71.51 / 17,252 / 167                |
| 20                      | Not run                              | 89.11 / 21,560 / 207                |

Logs: `pe001-before-k{4,6,8}.log`, `pe001-after-k{4,6,8,16,20}.log`.
The independent challenger preferred key projection over deleting operational
facts, subject to complete observer closure and overwrite-before-publication.
Its role could not use the available filesystem tool, so this is packet-grounded
hardening, not independent code clearance. The required source review remains.

### Whole-phase findings and retained optimization owners

First-pass base correctness and platform reviews report no findings. SFA
SF-001, semantics SM-001 and host PE-001 require the combined fix-only review.
The emitted-code reviewer finds no additional introduced NMI-output defect;
it separately identifies two inherited ordinary-lowering parity defects.
Neither is waived or silently treated as production-grade output.

| Finding        | Disposition and existing owner                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MC-005 / MAJOR | Ordinary constant-copy address store is 26 B / 36 cycles versus expert 5 B / 6; mutable-global-plus-one is 45 B / 62 versus 21 B / 30; combined is 71 B / 98 versus 26 B / 36. Output parity is **Incorrect**. Existing open [#70](https://github.com/blendsdk/blend65/issues/70) owns local copy/value propagation and dead homes; RD-08 owns the bounded address-destination extension. No general pass is added here.                     |
| MC-006 / MAJOR | Returning finite callback Q is 89 B versus expert 29; complete zero/nonzero paths 175/186 cycles versus 126/128. Preserve distinct contextual targets, captured links, ordinary frames and continuation. Output parity is **Incorrect**. Existing open [#83](https://github.com/blendsdk/blend65/issues/83) owns function-value home/coalescing; RD-08 owns its bounded returning-choice extension. This is not terminal-only AR-P30 or #97. |
| PE-002 / MINOR | Existing `privateHomeContext` scans all operations for each distinct non-call span: O(SN). RD-08 host-cost backlog owns an existing call-target index remedy; report-only, no new executable scope.                                                                                                                                                                                                                                          |
| PE-003 / MINOR | Existing address proof retains dead SSA facts across K conditional joins: quadratic map copying. RD-08 host-cost backlog owns no-write fast exit and use-aware fact retention; report-only, no new executable scope.                                                                                                                                                                                                                         |

MC-005 actual artifact totals remain CPU 695/722/748 + BASIC 12 + padding
165/138/112 = payload 872 / PRG 874; RAM 928/932/934, SFA 4/6/8 and ZP 2.
Expert code savings are absorbed by matching-low padding at this placement;
they are not loaded-image savings. MC-006 actual totals are CPU 924 + BASIC 12

- padding 704 = payload 1,640 / PRG 1,642, RAM 1,701. The proposed 60-byte
  Q reduction permits a lower matching-low page analytically: PRG 1,386 and RAM
  1,440. That endpoint is unassembled and unqualified, not a measured floor.
  Raw stack ten and reported bounded component three remain distinct endpoints.

Existing issue bodies were inspected before assigning these owners; no duplicate
issue, issue edit or issue closure is made. Local NMI meets retain #96/#97.
All raw captures above remain under `/tmp/blend65-nmi-ar21.0c36Fe` pending final
closeout. Full GREEN, fix-only clearance and final runtime-byte rebinding are
still required before committing or pushing.

### Completion of the initializer and agreeing-expression boundaries

The single fix-only SFA/semantics review found two incomplete boundaries before
clearance. SF-002: an initializer-only callee still lacked the caller's main
domain when no NMI hook existed. Preserve the union of existing source domains
and existing initializer-inclusive contexts in the same inventory owner. An
internal case also requires both main and IRQ homes when a helper has both
callers. SM-001: agreeing conditional expressions lacked a merge-result fact.
Transfer each predecessor's selected value before the existing intersection;
unknown or disagreeing alternatives remain unknown. No new analysis pass.

Two additional blind files freeze before production:

| File under `test/rd05/`                       | SHA256                                                             | RED / retained controls                                         |
| --------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| `nmi-initializer-only-calls.spec.test.ts`     | `f145ddc200502af178cb6435be8e76b336e0d18725889fe7b898200af962cf14` | Four actual staged-global-load/inner-parameter overlaps         |
| `nmi-route-owned-address-merges.spec.test.ts` | `88d188718e067fa2bbd9192776a8009a7b72d4f205370ae21e3d534a851e7815` | Eight false E10278 positives / four unsafe-vector controls PASS |

The author's original RED results were captured in tool sessions, not log files.
Primary corroborates them in `phase2-boundary-replay-red.log`: exactly twelve
FAIL / four PASS, using the two exact source owners from snapshot `482c574f`
while retaining frozen tests. A `finally` restores both source files byte-for-byte
to snapshot `69de41c3`. This is a directed RED replay, not a full old-tree build.
The normal directed set then passes 176 public cases across eight files; the
internal main/IRQ and retained SFA set passes 33. No oracle is weakened.

The actual domain-only initializer witness preserves payload 704 / RAM 758:
outer first-argument stage stays `$0AF5`, inner parameter moves to `$0AF6`.
An ABI consumer check then finds SF-003: loading the outer argument overwrites
the nested return still in A. `retainMachineValue` had ignored existing
initializer lifetimes. Resolve it in the same lifetime owner: ordinary functions
and executable initializers consult their own existing source lifetimes. Finite
discovered homes still normalize to main and close before emission.

The independent actual-value oracle
`initializer-nested-return-vice.spec.test.ts` is 77 lines, SHA256
`6349c8fcdacfbec87eb22dcb7d8dcce6233fa037e8b77da1e60a6b8c05bc00cc`.
All four profiles genuinely return 17 instead of required 7 before the correction
(`phase2-initializer-return-vice-red.log`), then return 7 on all four unchanged
cases (`phase2-initializer-return-vice-green.log`). Only source-visible data is
seeded before startup; no CPU register, frame, vector, ROM or code is patched.

Separate first-argument native corroboration reports original PAL output 7
instead of seeded 17, then correct output 17 on all four profiles. Publication
retired the old generation, so ACME reconstructs its exact captured assembly;
the actual reconstructed PRG SHA256 matches the prior public artifact exactly:
`02109ccbbb0b61e3790735444eb73f6969faf344c99ee56fc4831a1e01a1c769`.
This is a byte-identical reconstructed witness, not a fresh old-compiler run.
Capture: `phase2-initializer-native-complete.log`; existing pinned VICE helpers
govern every run. Initial failed probes with retired paths are not qualification.

The final initializer endpoint is **not cost-neutral**: the actual first-argument
fixture's payload grows 704→722, RAM 758→778 (18 code bytes plus two private
bytes). ZP zero, stack component four and scratch zero are unchanged. Register
retention now preserves values correctly; ordinary optimization debt must be
reported separately, not hidden behind the zero-cost domain-only endpoint.
`phase2-initializer-only-public-{before,after,complete}.log` binds each distinct
assembly/report/hash endpoint. Its completed independent output-cost review is
recorded below; the correctness delta and optimization gap are different accounts.

Final code snapshot `1e2be9ca0e4314846228856c11352065c183bcc4` contains 100 owned
paths. Independent SFA/ABI review clears the complete producer-to-consumer path,
including SF-001/SF-002/SF-003, selected IRQ projection and all three observer
keys. Semantics clears admitted owned addresses, selected-arm behavior and
conservative controls; its pending merge boundary is resolved. Host review
clears the demonstrated exponential-history defect, not all polynomial cost.
Base correctness and evidence-only completion clear every frozen old exception
and all seven new hashes. No repeated whole-phase audit or third MC review occurs.
Unrelated historical routing setup summaries accidentally read by two reviewers
are disclosed and excluded from decisive evidence; no current grader exposure.

The final sixteen public runtime rebuilds have identical source and PRG hashes
to their earlier native observations, including after the lifetime correction.
`phase2-complete-runtime-rebinding.log` binds all sixteen pairs; captures are
`phase2-complete-runtime-write-rebuild.log` and
`phase2-complete-runtime-flows-rebuild.log`. The earlier 32 native scenario checks
remain observations of the exact final bytes. New initializer observations are
separate evidence, not extra RESTORE events or silicon proof.

The first later full attempt is explicitly interrupted (exit 130) when the new
initializer/merge defects appear; only primary's owned Vitest child is signalled,
not unrelated user processes. It is not GREEN. Fresh final install/build/typecheck
pass in `phase2-complete-{install,build,typecheck}.log`; the complete test log
`phase2-complete-test.log` finishes GREEN. Earlier failures and the interrupted
attempt remain historical evidence, not successful checkpoints.

### Final initializer output account and whole-phase GREEN

The independent emitted-code reviewer completes only the new initializer
lifetime delta, not a third audit of MC-001–MC-004. No new correctness finding
survives. It independently rehashes all 32 retained initializer artifacts and
checks their source, generation, assembly, debug, memory and cost correlations.
All four profiles produce the observed 724-byte PRG, SHA256
`a5d038cd056986ec880795a3e40580ce7782a7f98a9118526a86c00fb7622fed`.
The actual retained files and their identities are enumerated in
`phase2-initializer-complete-artifacts.log`. The reviewer also rehashes all 128
actual files of the sixteen final runtime rebuilds; source and PRG identities
match the corresponding preserved AR-P30 observations.

MC-007 is MAJOR inherited ordinary forwarding/copy debt, owned by existing
[issue #70](https://github.com/blendsdk/blend65/issues/70) and RD-08. The exact
initializer witness joins that existing local-propagation owner, not a new debt
category or executable optimizer scope. Correct materialization must remain
until the existing single-use forwarding and certified-home copy proofs apply.
Both ordinary calls, parameter homes, evaluation order, returned values,
register/flag effects and the four-byte generated call-stack peak stay binding.
No inline expansion, source restriction or new pass is proposed.

| Account                            | Correct generated output | Equivalent expert expectation |
| ---------------------------------- | ------------------------ | ----------------------------- |
| First initializer                  | 13 bytes / 22 cycles     | 7 bytes / 14 cycles           |
| Out initializer, including callees | 42 bytes / 84 cycles     | 24 bytes / 60 cycles          |
| CPU code                           | 710 bytes                | 686 bytes                     |
| Loaded payload / PRG file          | 722 / 724 bytes          | 698 / 700 bytes               |
| Resident RAM                       | 778 bytes                | 752 bytes                     |
| Physical SFA homes                 | 4 bytes                  | 2 bytes                       |
| Padding / ZP / scratch             | 0 / 0 / 0 bytes          | Unchanged                     |
| Generated hardware-stack peak      | 4 bytes                  | Unchanged                     |

The measured output has an independent equivalent gap of **24 code bytes,
32 cycles and two private RAM bytes**. With zero padding, the analytical PRG
saving is also 24 bytes. The expert endpoint is an unassembled expectation,
not optimized production evidence. This gap is not the repair's +18-byte/
24-cycle delta versus the smaller but incorrect domain-only artifact.
MC-005/MC-006/MC-007 parity remains **Incorrect**; existing RD-08 ownership
does not waive the expert floor or permit optimized/game-grade closeout.

Final checkpoint: install, build, typecheck and all four package test suites plus
the full local Linux root suite PASS. Total: **4,127 PASS / two existing SKIP**.
Compiler: 1,755 PASS / two SKIP; CLI: 62 PASS; language server: 21 PASS;
VS Code: six PASS; root: 2,283 PASS. Root VICE cases run sequentially, including
all four unchanged nested-return native cases. No new skip, timeout increase,
oracle edit, dependency or verification tier is introduced by this checkpoint.

| Final raw log under `/tmp/blend65-nmi-ar21.0c36Fe` | SHA256                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `phase2-complete-install.log`                      | `496c21193ff839e9976d877a1037dfef5ce7cfa329d6d01c9d9be4f2dd1d8f01` |
| `phase2-complete-build.log`                        | `2fbf296a9459e94f7cacd5af42cf51097bc178887cf0535f9fd873dfa68b276f` |
| `phase2-complete-typecheck.log`                    | `313f87ce9b3d899913561094f0f5e120a7786203c30242d8156d20ad1427ff4e` |
| `phase2-complete-test.log`                         | `07d20deb40dc659b8766eaf5c588c7065c2a4dc6f397683cf0cd8ff8fd09fa33` |

Independent base correctness, SFA/ABI, semantics/DX and platform reviews clear
the bounded production contract and exact oracle exceptions. Host review clears
PE-001; PE-002/PE-003 remain report-only RD-08 costs. Emitted-code review clears
AR-P30 repairs and the initializer correctness delta while retaining the three
measured ordinary-output debts above. This is correct unoptimized compiler
qualification, **VICE-verified / hardware-unverified**, not complete RD-05,
universal nesting, total firmware/stack completion or production optimization.
