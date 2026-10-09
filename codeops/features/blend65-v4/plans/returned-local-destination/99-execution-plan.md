# Execution: proved returned-local destination

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-10 00:24 CEST
> **Progress**: 17/19 tasks (89%)
> **CodeOps Artifact Schema**: 1

## Implementation phase

| Phase | Title                                   | Tasks |
| ----- | --------------------------------------- | ----- |
| 1     | Proved whole-function destination reuse | 19    |

Task lines below are the single mutable progress authority and appear once.
Immediately mark implemented work `[~]` with its real timestamp; only promote to
`[x]` after its relevant verification passes. Update Progress/Last Updated after
each task. Resume the first `[~]`, otherwise the first `[ ]`. A blocker uses `[!]`
and an explicit reason. Only `[x]` counts complete. Green local commits use the
git-commit skill; no automatic push. No frozen or existing spec-test amendment.

## Phase 1: whole-function destination reuse

> **Phase baseline tree**: 8ff0ebe0091b9ed6890509371b01f6373b90348d
> **Lenses**: compiler/language, SFA/ABI, generated asynchronous observation, emitted output, host cost

**Execution scope:** strict; the minimum design and AR-1 boundary are unchanged.
Expected changes: the thirteen production modules named in Session 1.2; the three
new specification files in Session 1.1; the two new internal test files in 1.3.1;
this plan's progress/qualification documents and the feature roadmap/upstream
AR-P11 execution status. No existing spec test or frozen authority is included.
The phase snapshot excludes all earlier planning edits. Root owns tightly coupled
production work and durable progress; independent authors own only their assigned
new specification file. No automatic push.

### Session 1.1 — independent specification tests

Reference: [07](07-testing-strategy.md), [AR-1](00-ambiguity-register.md).

- [x] 1.1.1 [spec-author] Write ST-1–ST-5 and ST-12–ST-13 in `test/rd05/returned-local-behavior.spec.test.ts`, using existing public/VICE fixture interfaces. ✅ (implemented: 2026-10-09 21:44 CEST; verified: 2026-10-09 21:48 CEST)
- [x] 1.1.2 [spec-author] Write ST-6–ST-11 and ST-14 in `test/rd05/returned-local-safety.spec.test.ts`, preserving the frozen legality/value oracle. ✅ (implemented: 2026-10-09 21:57 CEST; verified RED baseline: 2026-10-09 22:12 CEST)
- [x] 1.1.3 [spec-author] Write ST-15–ST-18 in `test/rd05/returned-local-output.spec.test.ts`; establish the exact selected PA-only diagnostic source/baseline for ST-18 before production changes. ✅ (implemented: 2026-10-09 22:06 CEST; verified RED baseline: 2026-10-09 22:18 CEST)
- [x] 1.1.4 Run the new specification files; record RED output assertions and justified baseline-pass safety cases in `99-execution-plan.md`; no implementation yet. ✅ (implemented: 2026-10-09 22:18 CEST; verified: 2026-10-09 22:20 CEST)

Verify: `yarn vitest run test/rd05/returned-local-behavior.spec.test.ts test/rd05/returned-local-safety.spec.test.ts test/rd05/returned-local-output.spec.test.ts`, sequential VICE. Expected new output failures are RED evidence, not a green commit.

### Session 1.2 — existing-stage correction

Reference: [03-01](03-01-destination.md). Order below is dependency order; keep
each edit bounded and verify its existing directed consumer suite. Do not add a
new general framework or start the unrelated optimization debts.

- [x] 1.2.1 Preserve fresh declaration origin in `semantic/operations.ts` and `semantic/cfg.ts`; see 03-01 §Small retained facts. ✅ (implemented: 2026-10-09 22:20 CEST; verified: 2026-10-09 22:21 CEST)
- [x] 1.2.2 Reuse bounded literal/mask and exact raw-address routines through `semantic/aggregate-place-proof.ts` and `semantic/reachable-globals.ts`, with no behavior change to the old consumer. ✅ (implemented: 2026-10-09 22:22 CEST; verified: 2026-10-09 22:23 CEST)
- [x] 1.2.3 Reuse complete place footprints and hardware-RAM observer routines in those same two modules; see 03-01 §Whole-function eligibility, ST-8–ST-11. ✅ (implemented: 2026-10-09 22:24 CEST; verified: 2026-10-09 22:24 CEST)
- [x] 1.2.4 Implement complete-local/initializer/use eligibility in `semantic/returned-local-destination.ts`; see 03-01 §Whole-function eligibility, ST-1–ST-3/ST-6–ST-9/ST-17. ✅ (implemented: 2026-10-09 22:27 CEST; verified: 2026-10-09 22:30 CEST)
- [x] 1.2.5a Complete actual reachable-call inventory, fresh private destination and argument-alias qualification in `semantic/returned-local-destination.ts`; see 03-01 §Whole-function eligibility, ST-4–ST-5/ST-14. This is body/caller preparation only, with no production certificate publication. ✅ (implemented: 2026-10-09 22:34 CEST; verified: 2026-10-09 22:35 CEST)
- [x] 1.2.5b Complete ordinary/helper and generated-asynchronous observer qualification and prepare the immutable fact shape in `semantic/whole-program.ts`, but keep production publication absent until task 1.2.7; see 03-01 §Small retained facts, ST-10–ST-11. ✅ (implemented: 2026-10-09 22:36 CEST; verified: 2026-10-09 22:39 CEST)
- [x] 1.2.6 Bind every certified root through the hidden result pointer in `machine/lower-state.ts` and `machine/lower-aggregate.ts`; see 03-01 §Root and construction consumers, ST-1–ST-3/ST-8/ST-12/ST-17. ✅ (implemented: 2026-10-09 22:41 CEST; verified: 2026-10-09 22:44 CEST)
- [x] 1.2.7a Preserve direct nested construction/completed stores and omit only proved terminal address/copy delivery in `machine/lower-aggregate-members.ts`, `machine/lower-aggregate-build.ts`, `machine/lower-aggregate-return.ts` and `machine/lower-operation.ts`. Existing large-member construction remains the owner; correct only its certified scalar target writes. No production certificate is published. See 03-01 §Root and construction consumers, ST-15–ST-18, runtime AR-2. ✅ (implemented: 2026-10-09 22:48 CEST; verified: 2026-10-09 22:50 CEST)
- [x] 1.2.7b Activate the prepared whole-program fact and matching local omission in `semantic/whole-program.ts` and `storage/inventory.ts` together, only after every consumer is ready. See 03-01 §Root and construction consumers, ST-15–ST-18. ✅ (implemented: 2026-10-09 22:51 CEST; verified: 2026-10-09 23:02 CEST)
- [x] 1.2.8 Run `yarn build`, then all new specification files to GREEN without changing their oracle; record results in `99-execution-plan.md`. ✅ (verification started: 2026-10-09 23:02 CEST; verified: 2026-10-09 23:04 CEST)

Verify: the new directed specification command above plus impacted existing
whole-program/source-library, nested-construction and aggregate-return suites.
Run `yarn build` first whenever directed tests import the public compiler package
after production edits. Until task 1.2.7 activation, production uses no certificate
and retains every current home/copy; proof and consumer preparation remain inert.
Production file paths in these tasks are relative to `packages/compiler/src/`.
If a task exceeds its one reviewable concern or needs six files/200 added lines,
split it before execution and preserve the same authority and ordering.

### Session 1.3 — internals, qualification and independent review

Reference: [07](07-testing-strategy.md), [A-1–A-6](01-requirements.md#plan-local-acceptance).

- [x] 1.3.1a Add focused `packages/compiler/src/semantic/aggregate-place-proof.impl.test.ts` after GREEN; cover complete footprints, raw address wrap, mask conversions and bounded shared definition walks in 07. ✅ (implemented: 2026-10-09 23:05 CEST; verified: 2026-10-09 23:06 CEST)
- [x] 1.3.1b Add the body/inventory portion of `packages/compiler/src/semantic/returned-local-destination.impl.test.ts` after GREEN; cover missing/bad body facts and ST-7's unchanged semantic operations/complete local inventory in 07. ✅ (implemented: 2026-10-09 23:08 CEST; verified: 2026-10-09 23:09 CEST)
- [x] 1.3.1c Complete that same internal file's caller/observer guards, deterministic certificates and domain propagation in 07; no additional test module. ✅ (implemented: 2026-10-09 23:10 CEST; verified: 2026-10-09 23:12 CEST)
- [!] 1.3.2 Qualify actual assembled bytes, complete costs and sequential four-profile VICE cases, then run the full project checkpoint; retain raw evidence and results in `08-closeout.md`. ⛔ (blocked: 2026-10-09 23:55 CEST; TP-001 incoming bitmap visibility requires AR-6 scope ruling; full verification intentionally halted)
- [!] 1.3.3 Run independent correctness, semantics/DX, SFA/ABI, platform, output and host-performance phase reviews in waves; dispose findings, verify any authorized fixes, complete the deferral check and update `08-closeout.md` plus the feature roadmap. ⛔ (blocked: 2026-10-09 23:55 CEST; all six lenses reported, TP-001 MAJOR remains unresolved under AR-6)

Verify: `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, `yarn
test`; targeted touched-file formatting, frozen-authority/old-oracle and whitespace
guards. Only the implementation owner runs expensive verification. VICE is always
sequential, and skips do not pass. Reviewers are read-only and independent of the
author; the spec author is not an independent reviewer of its own tests.

## Completion boundary

All nineteen tasks must be verified; [A-1–A-6](01-requirements.md#plan-local-acceptance)
must have their stated evidence. Critical/major findings require their normal
decision gate. A materially larger mechanism reopens AR-1; no generic fix approval
grants it. Full-body parity debts stay measured and owned, not silently waived.

At closeout answer whether deliverables expire any deferral rationale; check
relevant ambiguity/Won't-Have/future-consideration owners without reopening
unrelated work or editing frozen authorities. T-14 completion does not close
RD-05/DEF-7 or qualify the public keyboard library. The next owned work is the
still-separate keyboard technical/positive plan gate.

## Execution evidence

Task 1.3.2 is blocked on AR-6. Exact-source ordinary and all four selected after-generations
are retained in `ordinary-qualified` and `acquisition/after-*`; originals survive.
The initial full checkpoint passes install/build/typecheck, then reports one old
internal barrier failure among 1,933 compiler passes and two existing skips.
The same construction helper was narrowed to its existing hidden aggregate-result
pointer namespace; unrelated direct-target Y barriers keep their original behavior.
No oracle or production module was added. Fresh full specifications and directed
barrier tests are rerunning; complete checkpoint and actual cycle audit remain due.
Raw logs: `after-artifacts.log`, `full-install.log`, `full-build.log`,
`full-typecheck.log`, `full-test.log`, `construction-barrier-*`.

Independent output qualification reproduces MC-001: identical-source word-array
`make` grows 829 → 1,086 bytes while improving 5,207 → 2,154 nominal cycles;
complete packaged payload grows 257 bytes. AR-4 records the necessary existing
construction-consumer correction. Consecutive Y offsets and matching private
pointer steps are prepared; focused internal checks, final exact-source artifacts,
frozen specifications and the fresh full checkpoint are pending. No new emitter,
old-test amendment or general word-fill optimization is introduced.

AR-4's fresh directed verification passes all 41 cases (31 new internals and ten
unchanged construction-barrier cases); explicit strict internal TypeScript
checking passes. All seventeen retained final public generations build. The
independent output auditor reconciles final ordinary 53-byte/118-cycle sample,
selected 363-byte acquisition and identical-source 827-byte word constructor;
the new size regression is gone. Complete costs and remaining expert debts are
recorded in [qualification](08-closeout.md); final full tests and six review
gates remain pending. `full-test2.log` was intentionally interrupted after AR-4
arrived during its run; it is supporting evidence, not a final pass. Only its
verified owned VICE descendant was stopped before the fresh final checkpoint.
Raw logs: `y-selection-*`, `final-artifacts.log`, `final-{install,build,typecheck,test}.log`.

Read-only review preparation finds SM-001: a caller's earlier VIC RAM publication
persists during the call, but only callee/helper and asynchronous unsafe facts
were checked. The platform reviewer independently corroborates real SFA overlap.
AR-5 records the necessary whole-reached-program publication guard, including
executable initializers. Three focused caller/helper/initializer internal cases
first reproduce the incorrect certificate; no old/specification oracle changes.
AR-5 verification passes all 44 directed cases (34 new internals and ten unchanged
construction barriers), and strict internal TypeScript checking passes. Semantics
and platform fix-only reviews agree that SM-001 is resolved. Artifact identity
after this guard remains unverified. Fresh install/build/typecheck pass; compiler
tests pass 1,944 cases with two existing skips. The complete root run was
intentionally halted when independent TP-001 exposed incoming bitmap visibility;
it is not a full checkpoint pass. AR-6 blocks final qualification and closeout.

Only the verified owned emulator descendant was terminated after stopping the run.
Raw logs: `persistent-observer-green.log`, `persistent-observer-types.log`,
`qualified-{install,build,typecheck,test}.log`.
Raw RED log: `persistent-observer-red.log` (three intended failures; the selected
run's eighteen unselected tests are not counted as passes).

The separately approved [T-16 assessment](09-entry-observation-assessment.md) is
complete on 2026-10-10. It separates physical bitmap overlap from specified
source/platform observation and recommends a narrow plan-contract clarification.
The ruling is still pending; tasks 1.3.2 and 1.3.3 remain blocked. Assessment adds
no compiler edit, runtime proof, protected-oracle exception or full checkpoint pass.

Task 1.3.1c: both new internal files pass all 24 cases. Explicit strict TypeScript
checking of these normally build-excluded test files also passes. Mixed callers,
unknown/cyclic arguments, raw observer distinctions, complete domain pointer
inventory and missing profile/closure facts are covered. An initial new-test
`flatMap` inference error was fixed with its precise semantic operation type.
No production or old/new specification oracle changed. Raw logs:
`all-proof-internals2.log`, `internal-types5.log`.

Task 1.3.1b: all five body/inventory cases pass. The partial fixture keeps both
the original operation references/deep values and its full two-byte local demand.
The proved path keeps the caller object and hidden pointer; missing metadata
and an additional returned-address use retain fallback. Fixture setup initially
omitted the required effect records; a separate BigInt JSON comparison failed
before proof. Both were corrected in the new internal tests only; failed logs
are retained, not counted as verification. Raw log: `returned-body-internals3.log`.

Task 1.3.1a: all 13 new internal cases pass. They cover signed masks, narrowing,
packed word width/stride, unknown facts, wrapped/inclusive raw accesses, hardware
mirrors and 10,000 shared conversion definitions. Independent read counting
confirms memoized tails, not just eventual completion. Raw log:
`place-proof-internals2.log`. The new struct fixture retains its nominal binding.

Task 1.2.8: fresh build and all 88 frozen specifications pass, no skips,
99.88 seconds. Both authority trees and the three recorded oracle hashes are
unchanged. Raw logs: `all-spec-build.log`, `all-spec-green.log`.

Before internal-test authoring, task 1.3.1 was split into shared proof, returned
body/inventory and caller/observer checks to stay within the task-size bound.
Runtime AR-3 corrects only the two approved files'
locations to the existing compiler package's `src/semantic` test convention.
No test configuration, coverage mechanism or additional test module is added.

Task 1.2.7b corrected verification: fresh build and all 141 existing directed
tests pass. All 20 frozen output checks pass on the four profiles. Ordinary
sample/main are 62/20 bytes (baseline 70/20), payload 703, SFA 12, ZP 2 and
resident 766. Selected acquisition is 372 bytes (baseline 397), payload 1137,
padding 8, SFA 34, ZP 6 and resident 1227. No cost oracle changed; nominal path
cycles still require actual-byte qualification. Raw logs: `activation-build2.log`,
`activation-directed2.log`, `activation-output2.log`. The correction remains
within existing construction, with no new mechanism or broader eligibility.

Task 1.2.7b first verification: fresh build and 141 existing directed tests pass.
The unchanged output oracle passes 16/20, but the ordinary routine grows from
70 to 80 bytes. Its retained assembled artifact shows repeated `LDA #0` before
each private pointer store: the existing constant-construction accumulator fact
was cleared by immediate Y offsets and indirect stores even though neither
changes A. Correct that same approved helper's A-only tracking; do not change
the oracle, add a pass or expand eligibility. Task remains unverified until the
required net-cost checks pass. Raw logs: `activation-build.log`,
`activation-directed.log`, `activation-output.log`; retained diagnostic generation
`ordinary-after/out/666ab5db-f8c3-4b7e-8d0a-e685bd91a240` under the execution root.

Task 1.2.6: fresh build and all 55 directed storage/aggregate cases pass.
Root lookup caches the whole-function fact once per machine context; missing
fact preserves existing direct/global lookup. Certified roots are indirect,
fixed in-page accesses reuse the hidden pointer and multi-page construction
restores its base. Raw logs: `root-consumers-build.log`,
`root-consumers-directed.log`. Production publication remains absent.

Root/guard follow-up: the existing result-pointer lookup is shared without
changing the ABI; absent certificate avoids even host-state cache mutation.
Argument-definition cycles and both bytes of a wrapping bank-port write retain
fallback. Fresh build plus 141 existing directed cases pass; logs
`root-consumers-build2.log`, `root-consumers-directed2.log`.

Task 1.2.7a: complete nested-child proof, direct certified scalar construction,
completed store and terminal delivery consumers are prepared. Fresh build and
55 existing cases pass. The first build caught one unused import, removed on
the same task; its failed log is retained, not counted as a pass. Public output
remains exactly at 20 intended RED checks (5.16 seconds), confirming no premature
publication. Raw logs: `completed-consumers-build2.log`,
`completed-consumers-directed.log`, `consumers-inactive-output.log`.
All three frozen new-oracle hashes and both frozen authority trees are unchanged.

Before task 1.2.7 execution, runtime AR-2 identified the existing large-member
construction consumer omitted from the original file list. Its bounded scalar
target-write correction adds one existing module, not a new mechanism. Consumer
preparation and atomic publication/inventory were split into 1.2.7a/b to keep
each task below six files. Contract and activation order are unchanged.

Before task 1.2.5 implementation, its existing two guard concerns were split into
1.2.5a (actual callers/aliases) and 1.2.5b (observers/retained fact). This keeps
each reviewable edit below the task-size boundary. Scope, authority, consumers,
specification cases and activation order are unchanged; the original preflight's
fifteen-task cardinality records its historical scan, not added compiler work.

The combined untouched-compiler baseline is 60 PASS/28 intended RED/88 enabled,
no skips or fixture failures, 86.69 seconds. All 28 behavior cases and 32 safety
cases pass; the eight binding controls and all 20 output cases fail only the
specified missing-optimization expectations. Raw log: the execution evidence
root's `all-spec-baseline.log`. This is RED evidence, not implementation success.

Frozen new-oracle SHA-256 identities, in behavior/safety/output order:
`3c7ec37c396c79f5944203470440b9cdd7aff4e58b14c6076d90ef3bebd3eb5f`,
`925f59f26e796758cd5ddde2294e658c2f4f5a742dd61907203d108278c0b02c`,
`f0b8e481de35ce2d6c01a42736dac83f42e52e70360cf88c1ef972a990b6f986`.

Task 1.2.1: the existing compiler-package CFG/operation suites pass 33/33 in
2.06 seconds. The initial root-scoped command found no package tests; the
successful run used the package's own Vitest configuration. Only declaration
origin metadata changed; no certificate is published and output is unchanged.
Raw log: `fresh-local-directed-package.log` in the execution evidence root.

Task 1.2.2: unchanged literal/conversion, ordinal-mask, definition inventory and
wrapping raw-address routines now share one module. The existing whole-program
and reachable-global suites pass 86/86 in 3.19 seconds, including scaling and
masked-index boundaries. Raw log: `shared-values-directed.log`. No certificate
is published and no semantic operation or output path changes.

Task 1.2.3: shared complete place footprints and selected-profile raw/platform
observer checks preserve the old consumer's index-only trigger. The same 86
existing cases pass in 3.20 seconds. Raw log: `shared-footprints-directed.log`.
The extracted content remains bounded; no range solver or output path is added.

Task 1.2.4: fresh build and the same 86 existing cases pass. Eight directed
semantic probes accept complete, masked, byte[257], word[129] and the selected
acquisition local, while address identity, partial coverage and unchecked index
retain no candidate. Partial/large-array warnings are preserved. Raw logs:
`local-proof-build.log`, `local-proof-directed.log`, `local-proof-probe.log`.
This is prepared body eligibility, not published whole-function certification,
changed output or transformed runtime qualification.

Task 1.2.5a: fresh build and 86 existing directed cases pass. Five whole-program
probes accept fresh-only and selected acquisition callers, reject existing-object
assignment, mixed callers and canonical/indirect entry, and confirm no production
fact is present. Raw logs: `caller-proof-build.log`, `caller-proof-directed.log`,
`caller-proof-probe.log`. This preparation preserves every current home/copy.

Task 1.2.5b: fresh build and 86 existing cases pass. Prepared proof accepts known
disjoint MMIO and a safe helper, rejects unknown raw input, hardware-RAM
publication and an unsafe helper. The selected PA-only acquisition prepares one
binding; absent selected-profile identity yields no binding. Matched I=1 probes
accept the no-live-NMI control (W10181 preserved) and reject the live generated
NMI observer. Production publication remains absent. Raw logs:
`observer-proof-build.log`, `observer-proof-directed.log`,
`observer-proof-probe.log`, `observer-nmi-probe.log`.

| Task  | Verification                                                     | Result and bounded meaning                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1.1 | `yarn vitest run test/rd05/returned-local-behavior.spec.test.ts` | 28/28 pass, no skips, 37.33 seconds. Independent source-value, alias/lifetime and exact MMIO count/order protection on all four profiles. Baseline behavior passes are expected; destination/storage/output assertions are still pending. VICE-verified / hardware-unverified.                                                                                                                                                              |
| 1.1.2 | `yarn vitest run test/rd05/returned-local-safety.spec.test.ts`   | 40 enabled: 32 PASS, eight intended binding RED, no skips or fixture failures; 46.84 seconds. Masked-index and no-live-NMI controls pass values but retain redundant callee homes. Address identity, unchecked original-base write, unknown raw read, hardware observer, IRQ/NMI fallback and canonical indirect ABI pass. Expected RED authoring verification is not a green implementation checkpoint.                                    |
| 1.1.3 | `yarn vitest run test/rd05/returned-local-output.spec.test.ts`   | All 20 intended output assertions RED, no skips, admission failures or adapter exceptions; 5.26 seconds. Ordinary and page/stride witnesses retain a complete callee home; ordinary code remains 70 bytes. The selected acquisition independently exposes a distinct complete callee object even when its physical allocation overlays later uses. Runtime assertions remain unexercised because the intended output assertions fail first. |

The independent behavior author read only its allowed normative packet and public
fixture signatures, not compiler implementation, old assertions or private
qualification answers. No expectation changed after verification. Raw log:
`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/returned-local-execution.ljm6xa/behavior-baseline.log`.

Safety raw evidence uses the same root, `safety-baseline.log`. Earlier adapter
attempts are not decisive qualification. The initial full log was overwritten
before the preservation instruction arrived; its 28 PASS/eight RED/four generated-
origin adapter failures survive only in the transcript. Attempts two/three and
the bounded unchecked-write probes are retained separately. Before final proof,
public import/name/union adapters were corrected without changing source-value,
admission or output expectations. The unchecked sentinel initially overwrote the
live index parameter; sentinel eight preserves the specified runtime index. Its
post-write execute stop now follows the independently verified one-byte NOP,
allowing the pending RAM-watch event to be observed before return copying.
Both final original-target `$6B` and exactly-one-store assertions pass unchanged.

The safety author enumerated forbidden plan filenames without opening them and
incidentally read the semantics reference's historical identity preamble. Those
inputs supplied no oracle authority; normative sources and the explicit packet
govern its expectations. Compiler implementation, helper implementations, old
assertions and qualification answers remained unread. No production edits yet.
Expected RED files remain uncommitted until the coherent corrected checkpoint
is green; no broken tree is committed.

Output raw evidence uses the same root, `output-baseline.log`; its first run is
preserved as `output-baseline-attempt1.log`. Public metadata adapters were
corrected before baseline verification. The complete source-local object guard
was then strengthened without weakening or removing any existing assertion.
Compiler implementation, existing test assertions and private qualification
answers remained unread. The author's incidental release-summary exposure was
excluded from oracle authority. All three specification files are now frozen.

### Selected acquisition-shaped diagnostic baseline

Before production changes, the implementation owner composed the accepted
PA-only scoped sequence, with one fresh declaration caller and a normal
post-return borrowed saved-row consumer. The ingress writes idle PA and the
marker only; the acquisition itself still saves/configures/restores DDRs.
This diagnostic is not the public keyboard library or runtime qualification.
Public check/build succeeds on all four profiles with the existing W10211
marker warning, whose lifetime-specific truth remains unqualified.

Retained source/artifact root:
`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/returned-local-execution.ljm6xa/acquisition/`.
Input source SHA-256:
`860a0c523355e544a0d47da99089e2d74994a78c67dfd1efdb65e1cb4aa314f0`;
caller source:
`a5d2ec4473b267366695a01e3ede9f45cf3659e1ec312965916669611c3466c2`.

| Profile   | Retained baseline generation           |
| --------- | -------------------------------------- |
| PAL/6581  | `82566255-51a5-459c-9cea-be908ef7fcc3` |
| PAL/8580  | `d6fb1180-b74d-4c58-8e1a-d34f649da3fd` |
| NTSC/6581 | `a0065880-b599-4244-b4c7-ed4b519baeba` |
| NTSC/8580 | `0296a17d-25c0-4a08-bcbb-8d0fff151174` |

Fresh independent native output inspection reconciles complete artifacts and
their recorded hashes. All four PRGs share SHA-256
`fe308743c9f485d4a1fc123f2473431c0a39c93f693fef471a37eb0f62968022`.
The auditor decoded actual bytes; nominal cycles below are static calculations,
not runtime timing. It made no mutations or additional toolchain runs.

| Component                                       | Actual bytes |                                   Nominal cycles |
| ----------------------------------------------- | -----------: | -----------------------------------------------: |
| Acquisition                                     |          397 |                 1,790 COMPLETE / 308 UNAVAILABLE |
| Saved-row reader                                |           63 |                                               91 |
| Main caller                                     |           55 | 75, including its two JSRs but excluding callees |
| Selected ingress                                |           18 |                           33 to predecessor jump |
| Startup / restoration                           |    328 / 281 |                                        441 / 385 |
| Three ordinary routines together                |          515 |                 1,956 COMPLETE / 474 UNAVAILABLE |
| Full generated startup-through-restoration path |            — |               2,782 COMPLETE / 1,300 UNAVAILABLE |

Cycle assumptions: binary ABI; PBON clear/set selects COMPLETE/UNAVAILABLE;
eight rows; no interrupt, marker zero on COMPLETE, no VIC bus stalls. BASIC/SYS,
retained firmware and external nesting are excluded. The two terminal delivery
templates are each 21 bytes including RTS: early 204 cycles, final 214 because
its ten taken loop branches cross a page. Each has an unused two-byte source
pointer. Source PLP is separate, one byte/four cycles. RTS-only delivery is the
conditional one-byte/six-cycle comparison, not a prediction of complete corrected
costs. Publication/removal are 21/10 bytes and 36/22 nominal cycles. CPU/ROM ingress
entry adds 14 cycles and zero generated bytes; retained continuation is unknown.

Complete baseline: 1,142 machine-code bytes, 12 BASIC bytes, 239 padding bytes;
1,393 payload / 1,395 container / 1,498 resident occupancy; BSS 50 (platform state
49 plus marker one), general SFA 45 including the two-byte link, ZP ten, helper
scratch zero. Generated mainline and generated NMI per-entry stack components
are each five bytes, not an aggregate external peak. COMPLETE inventories 14 CIA1
reads/15 writes; UNAVAILABLE reads the two controls only. These are static path
inventories, not observed bus traces.

The eleven-byte returned-local home overlays ten bytes of surviving saved-row
and caller argument homes. Its removal does not promise eleven net RAM bytes.
The 239-byte matching-low ingress gap can absorb code savings as extra padding.
Regenerated complete costs therefore decide improvement; subtracting a copy or
home size is insufficient. Source form appears compatible with the narrow guard,
but certification and changed-access profitability remain unproved until execution.

Whole-path nominal cycle expectations use independent actual-byte qualification
at 1.3.2, not a new CPU interpreter/test harness or the report's unknown cycle
field. Automated output tests independently cover RTS delivery, actual code,
complete homes and resources; no whole-path cycle pass is claimed before that
separate qualification. Expert 2.0.4/content `0e2a6280`; normative CPU, ABI,
aggregate/effect, artifact and C64 interrupt headings govern. The auditor's
incidental historical routing smoke-table exposure was excluded as evidence.
