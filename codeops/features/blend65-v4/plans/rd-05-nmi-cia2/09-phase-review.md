# Execution evidence: cooperative NMI qualification

> **Parent**: [Execution plan](99-execution-plan.md)
> **Status**: Phase 1 complete; Phase 2 pending; no generated NMI qualification
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
