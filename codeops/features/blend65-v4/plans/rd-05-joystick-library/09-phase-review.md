# Phase 1 review: bundled C64 input source

> **Date**: 2026-10-01
> **Phase baseline tree**: `b593e6970797cec2919b183b77b6a9785706702d`
> **Status**: Complete — full checkpoint green; independent review has no findings
> **Scope**: Strict — one fixed packaged source file and existing analysis/editor seams

## Scope and authority

The delivered source is `packages/compiler/stdlib/c64/input.blend`, with six documented ordinary
exported byte constants. Only the four approved C64 profiles admit it. Preparation is request-local,
bounded by the existing source-byte ceiling and exact UTF-8 decoding. User source records, overlays
and the user-only loader identity remain unchanged. Compiler results, build/debug evidence and
editor diagnostics use the actual consumed source records and the unchanged portable hash tuple.

No caller-configurable resolver, library framework, persistent cache, dependency, runtime input
system, optimizer or game-policy API was added. The existing constant dependency map was corrected
to exclude rejected duplicates; two generic implementation cases check cascade suppression and
preservation of independent errors. The phase's exact modification set owns this bounded repair.

Governing decisions are AR-P1–AR-P4 and AR-P9 in the [decision register](00-ambiguity-register.md).
Contracts and tests are [component design](03-joystick-library.md) and
[ST-1–ST-9](07-testing-strategy.md). Frozen specification and expert authority remain untouched.
Expert baseline: 2.0.1, content commit `1ce4852016e2a883cf1f733c6014c45e176bfc69`;
`compiler-architecture.md` and `blend65-semantics.md`, using
`BLEND65-SPEC-4-1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf`.

## Specification-test integrity

All three new specification files were authored before production implementation. The valid gate
was 23 assertion failures and one justified existing-profile validation pass; setup failures were
excluded. The [execution ledger](99-execution-plan.md) records the blind-author read boundary.
No pre-existing specification test changed in Phase 1.

| New oracle | Frozen Git blob |
| --- | --- |
| Library semantics | `45db89094093a4c7087a802b53832f9c135c00c7` |
| Editor diagnostics | `cd7c7a3066566e37aa44b488fabf47e4a791b29b` |
| Installed evidence, original | `35d61b218d8170955c8ee66cbea0b9744844e0b3` |
| Installed evidence, exact approved AR-P9 correction | `1b15b8b35699434bc5bce08e6fb3402101ad02ce` |

AR-P9 adds only the constant-binding selection to the evidence test's `masks` projection. All
fixtures and assertions remain unchanged, including six values/types/source IDs and the exact
count. Existing joystick functions are preserved. This narrow user-approved authority exception
does not permit any other oracle change. Removing that one predicate in memory reproduces the
original frozen blob identity exactly; the original need not be stored as a Git object to check it.
The other two new oracles retain their recorded identities byte-for-byte.

## Verification

| Boundary | Directed result |
| --- | --- |
| New phase-1 specification cases | 24/24 GREEN |
| Existing import boundaries | 36/36 pass |
| Existing snapshot, host and race controls | 36/36 pass |
| Existing frontend/module/constant controls | 74/74 pass |
| Existing service/artifact controls | 41/41 pass |
| Editor specification and regression cases | 19/19 pass |
| Compiler implementation cases | 12/12 pass |
| Editor implementation cases | 2/2 pass |

Native-read cases prove the exact 4 MiB ceiling, bounded chunks, initial/growing overflow rejection,
invalid UTF-8 rejection, regular-file checks, changed-file rejection, handle cleanup and fresh reads
after installed bytes change. Detached tarball tests prove actual packaged bytes, outside-checkout
analysis/build, portable relocation identity and source/hash evidence. Real-stdio editor tests
prove duplicate routing in both source-ID orders, standalone installed faults, close-triggered
fallback, normal-error coexistence and clearing. Transport-only implementation fixtures also prove
canonical installed URIs and user-only overlays.

Checkpoint logs are captured outside the repository in `/tmp/blend65-bundled-phase1.0gQxfT/`:
`checkpoint-install.log`, `checkpoint-build.log`, `checkpoint-typecheck.log`, `checkpoint-test.log`.
The complete unchanged-command retry passes install, build, typecheck and all 3,150 tests:
compiler 1,652 (two unchanged native-host skips), CLI 62, language server 21, editor extension 6
and root 1,409. The retry logs use the `checkpoint-retry-` prefix in the same scratch directory.
Root emulator cases ran sequentially. Native tools: Linux x64, Node 22.23.1, Yarn 1.22.22,
ACME 0.97 and VICE 3.10. Touched-code/config formatting, local Markdown links/anchors, task/source
identities, diff checks and frozen-authority checks pass. Authored Markdown is not policed by
Prettier under the existing repository policy; its structure and links were checked separately.

The first complete run passed 3,148 cases and failed two existing shared-storage padded-image
cases at their 50-second VICE wait. An unchanged five-case retry repeated two timeouts under host
load about 25. A detached build of pre-phase `bb753d63` and the current compiler produced identical
PRG hashes and restore checkpoint addresses for all three origins:

| Fixed origin | PRG bytes | SHA-256, both compilers |
| --- | --- | --- |
| 52986 | 50,940 | `d330e49026118b1513b024b52322cad1383cf07938bc26c3a118e61328247935` |
| 52987 | 50,941 | `3aff11a9cbc95010b424a93bf4a22e42ce8befffcdf6093333c0d6c536dec50f` |
| 52992 | 50,946 | `a1048bfd4baec5ea6cfc81ffc2c7e524acfdae996f9dc0ede0298e4db149f4c0` |

Only these padded implementation cases now use a 90-second finite host wait and a 100-second
outer test budget. Small-image waits stay 50/60 seconds. Programs, checkpoints, emulated cycle
limits, stimuli and assertions are unchanged. This necessary verification-fixture correction is
in the phase modification set; it changes no compiler, machine-code or language behavior.
Comparison and retry evidence is captured alongside the checkpoint logs.

## Independent review

Independent reviewer `/root/joystick_phase1_review` reports **no findings**. It reviewed the
supplied snapshot through correctness, maintainability, standards, security, API surface and
concurrency lenses. It independently confirmed the exact AR-P9 change, both other oracle hashes,
absence of pre-existing specification-test edits, frozen authority and the captured 3,150-pass
checkpoint. The fixed read, consumed-input evidence, duplicate-order repair and editor routing
satisfy the assigned Phase 1 contract. No ruling or fix-only re-review was needed.

The review diff includes committed, staged, unstaged and new phase files while excluding pre-phase
changes. The baseline and complete packet are recorded in the phase scratch directory. Roadmap
and verified-task completion bookkeeping follows the review; production and tests remain unchanged.
Separate security-profile and performance-critical auditors are not activated: no configured
web/authentication/financial/tenant/MCP profile or performance-critical machine-code change applies.
The fixed host-read and publication risks remain in the correctness review rather than unreviewed.

## Qualification boundary and next phase

Phase 1 does not qualify new joystick operations or claim expert assembly/cost parity. Both-port
operations, volatile order, exact output/resource expectations and runtime input stimuli belong to
Phase 2. This is not an RD-05 closeout; its remaining platform obligations and deferral-expiry gate
remain owned there. Windows/macOS user-host and physical hardware release checks remain RD-10.
No opted-in `docs/index.md` exists; the authorized small platform-library page remains a plan
closeout deliverable, without adding a documentation framework at this phase checkpoint.

# Phase 2 review: both-port joystick operations

> **Date**: 2026-10-02
> **Phase baseline tree**: `d8bf67fbc1c5a1761bb211c3b7f8659f4a987c7e`
> **Status**: Complete — checkpoint green; no unresolved review finding
> **Scope**: Strict — direct operations and existing forwarding guards, not an optimizer

## Phase 2 authority and delivered boundary

The three new declarations are `readJoystick1`, `joystickUp` and `joystickDown`. Existing names
and signatures remain. Both port observations select one volatile absolute LDA returning the
full byte in A. Five saved-byte predicates select the exact active-low mask and zero condition,
without another hardware read. The existing sole-use, adjacent same-block, fixed byte-store
selector admits both reads; dynamic addresses, multiple uses, intervening instructions, word
stores and cross-block consumers retain the ordinary stable-value path. CIA producers remain
excluded. No scratch, helper, keyboard scan, hidden IRQ mask or device-state write was added.

The user explicitly approved [AR-P12](00-ambiguity-register.md#ar-p12-output-scope-and-independent-cost-evidence)
instead of adding general local/SFA, condition/layout optimization or cycle-reporting machinery
to this pilot. Canonical `none` may finish this named pilot only; all semantic/MMIO/accounting
oracles and exact direct-operation floors remain. Whole-local expert targets stay with RD-08
before optimized or production game-grade closeout. This is not an optimized-output golden or a
permanent exception to the expert directive. The bounded test-local cost check follows only
forward control-flow edges for explicitly known assembled instructions. It charges actual branch
page penalties and the equal-contract three-byte/three-cycle restoration transfer. Unknown public
whole-program cycles remain unknown, not free. Complete artifact/resource accounting stays active.

Specification identity and expert 2.0.1/content commit remain those recorded for Phase 1 above.
No frozen specification or expert file changed. The review snapshot includes committed, staged,
unstaged and untracked Phase 2 files, excluding changes already present at phase start.
Evidence directory: `/tmp/blend65-joystick-phase2.Lkb8GS/`; snapshot: `phase2-review.diff`.

## Phase 2 oracle integrity and finding disposition

| Exception | Exact prior user ruling and checked boundary |
| --- | --- |
| AR-P8 | Add only three ordered operations to the two existing frontend inventories and change the one thirty-seven→forty title. Reviewer independently confirms the exact diff; every old row, fixture and behavior assertion remains. |
| AR-P10 | Change only two stopped-CPU comparisons to their existing addresses and remove one unused checkpoint-ID binding. Prior parent inverse-patch hash proof is recorded in the execution ledger. |
| AR-P11 | Correct only the public signature lookup; preserve signatures, return-type, storage/effect and all source/behavior/cost assertions. Prior parent inverse-block hash proof is recorded in the execution ledger. |
| AR-P12 | Change only the original cycle helper and two output-cost regions. Reviewer independently reproduces byte equality outside those regions against stored AR-P11 blob `537e0d4d10db5b7937ee70da11db9ef54ab8f03a`. |

Current API/output blob: `e43cc234a0d5a0f69d825cce56c09d672bd89492`.
Physical-input blob, unchanged: `ceacfdb9c3c69aa2036f0a5adea675c408883e52`.
The older AR-P10/AR-P11 input blobs were hashed but not persisted as Git objects. Their historical
inverse proofs are parent evidence, not claimed as independently repeated by this reviewer.
The current identities, exact inventory changes and AR-P12 outside-region proof are independently
checked. No source fixture or semantic/runtime block changed under AR-P12.

| Finding | Severity / lens | Disposition |
| --- | --- | --- |
| RV-001 | Critical / standards: the role mandates a finding for any existing/frozen specification-test edit | Resolved by the already-given exact user rulings AR-P8/AR-P10/AR-P11/AR-P12, with the evidence boundary above. The reviewer requests preserving this disposition, confirms no edit exceeds the independently checked approvals, and finds no other defect. No new test change or waiver is authorized by this record. |

Reviewer `/root/joystick_phase2_review` reports no other findings through correctness,
maintainability, standards, API surface, closed-fixture security and direct-output performance.
The role's automatic integrity finding is retained, not silently omitted. Its exact existing user
authority is fulfilled; no duplicate ruling or fix-only re-review is needed because no additional
change is requested. A future edit outside these approvals remains a new stop.
The separate semantic reviewer owns effects, flags, retained values and IRQ preservation.
Reviewer `/root/joystick_phase2_semantics` reports no surviving semantic findings. It traces
frontend identity/effects, saved-value retention, active-low and canonical Boolean lowering,
the shared forwarding guards and cooperative IRQ status preservation. All 28 additional
in-memory compile-stage counterexample probes across four profiles pass, including aliases,
nested arguments, dynamic destinations, saved/conditional samples, ordinary function identity,
return ABI and IRQ/local closure. Neither reviewer ran an emulator or changed a file.
No configured security-profile or performance-critical tag applies, so dedicated security and
performance auditors are not activated; fixture validation and exact direct costs remain reviewed.

## Phase 2 verification

| Gate | Result |
| --- | --- |
| Full directed source/output/runtime qualification | 252/252 pass, four profiles, sequential VICE |
| Approved frontend inventories | 55/55 pass |
| Directed implementation tests | 55/55 pass: 19 joystick, 17 collision, 19 profile cases |
| Strict isolated root fixture/oracle TypeScript | Pass |
| Checkpoint install / build / typecheck | Pass |
| Touched TypeScript formatting and frozen-authority checks | Pass |
| Complete local Linux tests | All 3,421 pass; two unchanged native-host skips. Compiler 1,671, CLI 62, language server 21, editor 6, root 1,661. |
| Local Markdown links/anchors and plan structure | 83 links pass; scoped checklist parser passes |

The first full run's existing `cia-basic-return-vice.spec.test.ts` PAL/8580 case expected stopped
PC 2662 and received 2594. That source has no joystick operation. No causal attribution or test
change is made from this observation alone. The failure is at the first pre-release checkpoint
(line 200), not a failed return/restoration assertion. All four unchanged profile cases pass the
directed sequential retry. The complete unchanged-command retry also passes all 3,421 tests;
task 2.3.2 is verified only after that complete GREEN. Evidence: `checkpoint-test.log`,
`cia-return-unchanged-retry.log` and `checkpoint-test-retry.log`. No timeout, fixture, specification
or compiler change was made for this retry; the observed failure is retained rather than hidden.

Runtime evidence proves all 32 simulated switch combinations, all five saved-byte predicates,
released upper pins, shared-line interference, exact reads, CIA1 latch/DDR preservation, both caller
IRQ states and separate mainline/cooperative-handler samples. Simulation is not physical-stick
proof; there is no joystick-only isolation or atomic two-port sample promise. Status remains
VICE-verified / hardware-unverified; final physical and user-host release evidence stays RD-10.

## Final planned document completion

The same reviewer completes the previously unreviewed task 2.3.3 documents against supplied
`phase2-doc-completion.diff` and reports **no new findings**. The first continuation packet omitted
that diff and stopped without performing a review; the corrected packet supplies the exact
baseline projection. This is not a fix re-review or an extra pass over changed compiler code.
The guide/closeout preserve source-vs-operation staging, keyboard sharing, VICE limits, measured
costs and RD-05/RD-08/RD-10 owners. The exact guide source builds on four profiles and all 90 local
links/anchors pass. All 13 non-Markdown diff sections remain byte-identical to the original reviewed
snapshot. Only verified completion bookkeeping follows; no production/test/authority change.
After that bookkeeping adds the roadmap's closeout link, the parent verifies all final 91 local
links/anchors and the unchanged feature counter 4/10 in `final-doc-checks.log`.
