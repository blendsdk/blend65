# Full Checkpoint: Inherited RED Disposition

> **Status**: Exact one-checkpoint disposition approved — aggregate remains RED
> **Baseline**: `e715977d`, tree `71538f94c1f30e6c22213b8b8597798e4e9a1b6a`
> **Last Updated**: 2026-10-18 01:43 CEST
> **Owner**: AR-P5 in the selected plan; compiler obligations remain v4/RD-05/RD-08-owned
> **CodeOps Artifact Schema**: 1

## Actual Aggregate Run

Locked install, build and workspace typecheck pass. `yarn test` runs the complete
workspace tier, then stops on the compiler failure before its `&& vitest run`
root leg. It is **not a passing checkpoint**.

| Workspace | Actual result |
| --- | --- |
| Compiler | 14 failed, 2300 passed, 2 skipped; 1 failed/157 passed files |
| CLI | 62 passed |
| Language server | 21 passed |
| VS Code | 6 passed |
| Full root leg | Not reached by aggregate; all 265 files subsequently accounted across the interrupted unmasked run and complete per-file retries: 5790 passed, 303 failed, zero skips |

The independently executed new feature 40/40 and implementation 12/12 passes
remain bounded evidence. They do not erase the aggregate failure. No failed
oracle was edited, deleted, weakened or excluded, no unsupported mode fell back,
and no commit was made.

## Finite Compiler Failure Set

All fourteen failures belong to unchanged
`packages/compiler/src/services/input-size-frontier.spec.test.ts`, SHA-256
`3a44dd3c8f3c518c4a05d485400cd85e14839288a219a6517a675c41716a31c5`.

| Exact case family | Parameters / count | Actual failure and deterministic cause |
| --- | --- | --- |
| `closed version-one cost evidence > should preserve a rejected baseline and feasible selection when costs round-trip` | 1 | At `:104`, encoder returns `error`, expected `complete`. The authored fixture marks the baseline rejected (`:80–84`); unchanged `costs-evidence-validator.ts:455–464` requires both baseline and selection in its feasible map. No environment or source-author output participates in this pure validation. |
| `complete size frontier on <profile> > should close a bounded recipe inventory for <count> ordinary sites` | Every PAL/NTSC × 6581/8580 profile, counts 32 and 64: 8 | At `:371`, actual `failure`, expected `success`; `SERVICE_INVALID_OPTION`. Unchanged `services.ts:127–136` rejects any requested mode other than `none`. |
| `complete size frontier on <profile> > should fit an ordinary seventy-two-function returned pair despite a rejected reference` | The same four profiles: 4 | At `:412`, actual `failure`, expected `success`; the explicit `size` request hits the same unchanged option guard after the expected rejected `none` reference. |
| `last-good size publication > should preserve every last-good byte after a source failure in size` | 1 | At `:480`, expected E10174 is absent. `size` is rejected by the unchanged option guard before semantic analysis (`services.ts:170–178`), so this future-mode diagnostic-priority/publication expectation is not established. The `none` variant passes. |

The four profile IDs above are exactly `c64-pal-prg-kernal-6581`,
`c64-pal-prg-kernal-8580`, `c64-ntsc-prg-kernal-6581` and
`c64-ntsc-prg-kernal-8580`.

Minimal existing-owner reproduction:

```text
yarn workspace @blend65/compiler test src/services/input-size-frontier.spec.test.ts
```

This session does not implement those compiler contracts. The active v4 roadmap
already records the whole-input/size-cost closure at 9/40 with intentional size
RED and a user restart pause. No v4 progress or ownership is changed here.

## Baseline Provenance

Byte equality against `e715977d` is checked for the failing oracle, root package/
lock/TypeScript/Vitest configuration, compiler package/TypeScript/Vitest
configuration, imported profile/source-library fixtures, the option guard and
cost validator. The entire compiler source/stdlib and CLI/editor source diffs
against the baseline are empty. Dependencies were installed with the unchanged
frozen lock; current Node/tool identities remain recorded in observer evidence.

This is stronger than an unchanged failure count: each case has a fixed identity,
assertion and unchanged deterministic causal path. It proves no newly observed
change in those failures, not absence of regressions behind their blocked paths.
Those future capabilities remain unqualified. Additional root failures cannot be
silently absorbed into this fourteen-case set.

## Contract Decision History

### Root-Diagnostic Interruption

On continuation at 14:59 CEST the first root attempt has no final JSON/failure
report. Bounded process metadata confirms its Python/test runner is gone. One
orphaned `x64sc` remains, adopted by the user service manager. Its exact cwd is
this worktree, its detached process-group identity equals its PID and its start
falls within the announced diagnostic window. No command-line, environment or
target-directory contents were read to establish that ownership.

At 15:06 CEST the primary terminates only that run-owned orphan, using a PID-bound
handle with fresh ownership checks and confirmed exit. No emulator remains and
the old window ends. The initial diagnostic is **incomplete**, not a completed
suite or a newly classified baseline failure. A fresh window and foreground
unmasked retry write stdout/stderr incrementally to owned scratch rather than
holding the complete output only in the interrupted parent process. The precise
cause of the original runner's disappearance is not asserted.

### Retry Continuation — 2026-10-17

The foreground retry is also interrupted before its final JSON report. Its
incremental default-reporter log is preserved, including genuinely completed slow
cases: the saved-query-purity file alone passes four cases in roughly 29 minutes.
There is no emulator left at continuation. Neither interrupted invocation is
relabelled a successful single full run.

Exact root discovery accounts for 265 files. Completed per-file log summaries
cover 131 files: 120 completed pass files are retained, while eleven completed
failure files and every unfinished file form a 145-file diagnostic retry set.
This includes non-size RD-05 failures; they are not silently included in the
fourteen compiler failures or pre-approved as inherited. Every failed/unfinished
file is invoked through the existing Vitest command with a final JSON report,
sequentially, preserving each result immediately so another interruption does
not discard hours of completed work. No source, test or discovery config changes.

The resulting evidence is explicitly **batched diagnostic coverage**, not an
assertion that either original whole-suite invocation completed. All roots must
be accounted for, source identities unchanged, skips/failures reported and any
additional failure separately classified before an AR-P5 ruling or checkpoint.
A new empty-check VICE window is reserved under standing authority at 00:28 CEST.

### Complete Batched Result

The 120 retained completed pass files and 145 final per-file reports cover all
265 discovered Linux root files. Retained pass-file counts are taken only from
complete default-reporter file summaries; every failed or unfinished file is
rerun to a final JSON report. The combined result is **5790 passed, 303 failed,
zero skipped, 6093 total**. All three skill-owned files pass: 26 package, 14
authoring/control and 12 helper cases. These 52 are included in 5790, not added
again. No suite setup-only failure is omitted. No test source or discovery
configuration changes, and no completed failure is treated as a pass.

Per-file source hashes are checked before execution; every failed old root
oracle matches `e715977d` byte-for-byte. The public compiler resolves to this
checkout. A forced TypeScript rebuild from its unchanged source preserves all
216 generated JavaScript files' combined identity:
`1764f571dc0578bd56a31fec50c957c645fa8bf30eae1474b3d3d8a278d367ab`.
This excludes a stale/cross-worktree compiler artifact explanation, not every
possible regression behind an already failing path.

Post-file and final checks find no `x64sc`; the diagnostic window is explicitly
released at **00:59 CEST**. The result remains batched coverage, not a completed
single-process root/aggregate run or proof of aggregate ordering/teardown stability.

### Expanded Finite Failure Scope

There are **317 total failures in 16 unchanged files**: 14 compiler cases above
plus 303 root cases. Root classification is 238 unsupported-size service
rejections, one unsupported-size CLI rejection, 40 whole-artifact byte-delta
assertions, eight startup/register-read/initialized-output assertions, eight
whole-resource/copy-cost thresholds, four retained volatile-call ordering
assertions and four initializer-temporary debug-residency assertions.

Thus **64 root failures are not size-mode failures**. They are not described as
obsolete, harmless, passing or already adjudicated. Existing v4/RD-05 and RD-08
owners retain those compiler/output/proof obligations. No root failure is silently
absorbed into the initial fourteen-case future-size explanation.

The following fingerprints identify exact failing name sets, not file-wide
exceptions. For each file, the case-set digest hashes UTF-8 compact JSON of the
sorted Vitest full-name strings (`ensure_ascii=false`, separators comma/colon).
The global 303-root-case digest, over sorted `[file, fullName]` pairs, is
`031739380d63cc4562244f0cf57ab3cafa6123c70b9b60fd386147085ed4f8d8`.
Source identities are additionally fixed by the unchanged files at `e715977d`.
These are one-checkpoint evidence receipts, not an executable exclusion registry.

| Root file under `test/` | Failed | Cause family | Exact case-set SHA-256 |
| --- | ---: | --- | --- |
| `rd05/input-acquisition-output.spec.test.ts` | 4 | Unsupported size service | `b5eeb3f51ce152b3a63c0a58e7f7558eb30117a2fd55357cf64ccf0f6f0bed45` |
| `rd05/input-library-output.spec.test.ts` | 4 | Unsupported size service | `fb4102f1e74240d9e9a74d0939fab954bfad690b8dc79324d490b593f206bfa4` |
| `rd05/input-saved-query-output.spec.test.ts` | 4 | Unsupported size service | `7cd5f5179c56132a5abbdd48d801b634c806b65439c5d7f8ed5b16e3a59fd730` |
| `rd05/joystick-api-output.spec.test.ts` | 8 | Program-byte delta, e.g. 555 versus 6 | `6787f889434282852fb2ae6bec3478ca119b232ca309a402285aab9d3b45885a` |
| `rd05/nmi-route-initializer-temporaries.spec.test.ts` | 4 | Source-retained temporary count 0 versus greater than 0 | `55577d08c73cf61cf4adb6014b33904e029a16581f547b63301343017b5e0eaf` |
| `rd05/nmi-route-retained-call-lifetimes.spec.test.ts` | 4 | Volatile/call/store address order, e.g. 2776 not below 2762 | `4fac2e1989fdb12b17fef95476da9d3db77f391e731dcfba60d9acb2ed2abba6` |
| `rd05/profile-pipeline.spec.test.ts` | 8 | Expected startup register read/output identity | `304ad59638ecc2fcafd6f0a353d0c184f0c8e98236bd257e847405a52c91efcb` |
| `rd05/returned-local-output.spec.test.ts` | 8 | Resource/copy thresholds, e.g. 50 versus 49 or 343 versus 328 | `e8fa10ec4f173adb8b13b1fb56bc34a58fb531913f0739e323c6bb5ff03f5e66` |
| `rd05/vic-collision-output.spec.test.ts` | 32 | Program-byte delta, e.g. 555 versus 6 | `b83f5d5206d1ff680b3556be1b1f95d7d456bd89a1f22edbc2debbe09933dfb0` |
| `rd08/input-byte-selection.spec.test.ts` | 56 | Unsupported size service | `06e7d19675310e8fd84ad2deebe0c6527b4d7ed03d2d91c35b6018f8abc4f716` |
| `rd08/input-loop-storage.spec.test.ts` | 20 | Unsupported size service | `cb5e32d321b9088518f2c8be339b2f36ba7d841f9eeaca702311c6d21992aeb1` |
| `rd08/input-object-facts.spec.test.ts` | 32 | Unsupported size service | `fd50548a7ec3e95ad5c69e323b7742b03b19593c83f93097c4bfe97497b652eb` |
| `rd08/input-size-mode.spec.test.ts` | 3 | Unsupported size service/CLI | `ab83388d7929d88b017e8da890081cb3025051c8b1bd4a0d393d9f04d58b960c` |
| `rd08/input-size-runtime.spec.test.ts` | 64 | Unsupported size service | `4a843f1c2eb17ab6aad9fadf00d4c48c4684f617841a698ab942a647325779d4` |
| `rd08/input-startup-selection.spec.test.ts` | 52 | Unsupported size service | `70a4f8853da22a5958c4b4f4d9f884c622786f710347ace2563ec4e61ee4a5ee` |

Assertion evidence is not reduced to a count/name: exact failure messages,
locations and per-case reports were captured, then mapped to the unchanged causal
assertions. Examples: joystick `:557` and collision `:157` compare full program
byte deltas; profile pipeline `:239,:269` checks startup reads/instruction identity;
returned-local `:467,:569` checks resources/cost; retained-call `:245` checks
store/call order; initializer `:63` requires debug-retained temporary residency.
No claim is made that these assertions are wrong or that blocked deeper paths
have been exercised. New/changed failure identities or causes invalidate a scoped
disposition rather than expanding it automatically.

### Claim-Intersection Check

| Failed property family | Independently established here | Explicitly not established |
| --- | --- | --- |
| Startup reads/initialization/output identity | Exact source/PRG/debug binding, actual checkpoint arrival after inspected result stores, live DDR/port visibility and 16 expected result vectors | General startup instruction preservation, state restoration after return, whole-program initialization/cost equivalence or all shared-machine state |
| NMI volatile lifetime/order/debug residency | Pure ordinary calls/const reads and normal scalar/struct values in programs with no installed IRQ/NMI hooks or retained local addresses | Retained-handler ordering, temporary residency, full ABI/SFA closure, reentrancy or unrestricted firmware stack/arrival guarantees |
| Program/resource/copy costs | Actual behavior observations and independent answers | Expert parity, satisfying the failing byte/resource thresholds, complete performance or production-game readiness |

The observer does not infer globals from temporary debug records, a cost budget
or a promised startup opcode sequence. It validates its own declaration-bound
global records and complete operation interval, actual PRG correspondence, stopped
RAM visibility and real memory values; malformed mapping/identity/visibility
controls also pass. The code/evidence reviews explicitly bound these claims.
If a failed shared property is shown to invalidate those actual observations,
the claim must stop; a user exception cannot turn invalid evidence into proof.

Independent challenger `ses_ebb84ed7dffecRwESctD6X2oiy` re-evaluates this expanded
scope and still recommends one explicit bounded ruling, with moderate-high
confidence conditional on the supplied provenance. It withdraws the earlier
future-size-only/all-available-capabilities-GREEN description. A paired entire
baseline rerun is not required for deterministic unchanged-input attribution,
but no reproduced historical full baseline or universal regression absence is
claimed. Batched coverage and the exact 317-case commit-relevance interpretation
must both be expressly approved, or the existing-owner GREEN-baseline dependency
remains. No ruling or commit is authorised by this recommendation itself.

The initial challenge's root-incomplete, future-size-only proposal is superseded
by the expanded finite scope and claim-intersection check above. The current
proposed relevance boundary covers only the exact 317 unchanged-input failures,
including the 64 non-size root failures, for this one bounded skill milestone.
It requires all 52 owned checks and every non-excepted executed test to pass,
no additional/changed failure or new skip, exact provenance and truthful aggregate
RED reporting. Complete batched root coverage is a separately explicit acceptance
condition, not a claim that the interrupted aggregate finished. No test exclusion,
new framework, compiler/old-oracle change or reusable waiver is proposed.

The real alternative is to retain absolute full-repository GREEN and wait for
the existing compiler owner to supply a qualified baseline, then explicitly
refresh the pinned inputs and reverify. The current plan remains blocked until
the user chooses. An impact-scoped commit interpretation must be explicit;
merely documenting inherited RED or qualifying `none` does not grant it.

**Confidence:** moderate-high in the bounded recommendation, conditional on the
recorded provenance and claim boundaries. **Hardening:** one independent challenge
reconciled against the expanded diagnostics. Direct user ruling remains pending;
no final qualification/phase-completion or all-tests-pass claim.

## Direct User Ruling — 2026-10-18

The user explicitly selects **“Approve scoped (Recommended)”** after the exact
question is asked again. AR-P5 records the authoritative approval. The user
accepts all 265 root files' complete batched coverage and only the exact 317
baseline-pinned failures across 16 unchanged files as non-blocking for one
bounded `none`-based skill checkpoint and local commit. This replaces the
pending-decision state above; the diagnostic history is preserved.

All 52 skill-owned checks and every non-excepted executed test must pass. New or
materially changed failures or new skips invalidate the disposition. Two existing
compiler skips remain disclosed. The full test command still fails; no single
completed aggregate, universal regression absence or compiler readiness is claimed.
The final qualification record and bounded independent closeout review remain
required. No oracle, compiler, policy, requirements, other-owner, push or reusable
waiver authority is granted. Exact failure identities and observations selected
as durable evidence must survive removal of disposable scratch.

The [static failure-identity receipt](14-checkpoint-failure-identities.md) retains
all 317 exact expanded names and root assertion-set digests. It is not consumed
by a runner and creates no general failure-allowance mechanism.
