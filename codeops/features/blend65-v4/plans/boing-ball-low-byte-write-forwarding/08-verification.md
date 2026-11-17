# Low-byte extraction write forwarding — evidence

> **Status**: 6/6 verified; actual complete checkpoint GREEN, bounded unit complete
> **Baseline**: `ee9bb67d`, clean at task entry
> **Progress authority**: [execution plan](99-execution-plan.md), 6/6

Sections below are chronological. The final complete-checkpoint section owns current qualification;
earlier pending statements and failed prefreeze adapter attempts retain their original context.

## Fresh baseline and independent selection

The primary copied only the unchanged example manifest, source and `ball.bin` into an owned
temporary project and used the public compiler/real ACME in canonical `none`.
Generation `3b3986bc-6600-4ff4-810a-745944bf5b99` reproduces committed PRG SHA-256
`a078f81092528beff9388204690ff67a207a6082a3b3c84f791385a5cd41ec58`.
Cost/memory records report code 1,241, entry 326, SFA 45, platform state 49, resident RAM 7,261,
ZP/scratch 0 and payload 7,167. Code 1,241 + assets 1,024 + padding 4,890 + BASIC 12 = 7,167.
The equivalent twin's 442-byte code pin remains unchanged; the gap is 799.

The primary separately traversed the real closed semantic source before machine lowering:
52 original blocks of `src/main.blend:1485:5978`. Complete operation and branch/return counts
show eight one-use `lo` results with immediately adjacent fixed byte writes. Their operand
definitions are ordinary scalar-word loads; the unchanged whole-program certificate succeeds
with nine publications. Exact result/block/index and home identities are in the plan.
No home-specific observer exemption or new proof was used.

Actual assembled bytes within the CPU main range `$0953..$0CE6` (exclusive end):

| Result | PC | Original 12-byte core |
| --- | --- | --- |
| `v36` | `$09D4` | `AD 39 24 8D 4C 24 AD 4C 24 8D 00 D0` |
| `v39` | `$09E0` | `AD 3B 24 8D 4D 24 AD 4D 24 8D 02 D0` |
| `v42` | `$09EC` | `AD 39 24 8D 4E 24 AD 4E 24 8D 04 D0` |
| `v45` | `$09F8` | `AD 3B 24 8D 4F 24 AD 4F 24 8D 06 D0` |
| `v206` | `$0B47` | `AD 39 24 8D 46 24 AD 46 24 8D 00 D0` |
| `v209` | `$0B53` | `AD 3B 24 8D 47 24 AD 47 24 8D 02 D0` |
| `v212` | `$0B5F` | `AD 39 24 8D 48 24 AD 48 24 8D 04 D0` |
| `v215` | `$0B6B` | `AD 3B 24 8D 49 24 AD 49 24 8D 06 D0` |

Every exact core occurs once in that code range. The two removable absolute instructions
occupy six bytes/eight nominal CPU cycles per site. Eight homes are distinct one-byte CPU16
`retained-value` intervals, not duplicate VIC projections. These are baseline observations;
the predicted 48-byte/eight-demand improvement has not been implemented or measured.

Independent Astra challenge `ses_e1500ca1effecsLrbURhK2K698` converged on low-byte-to-fixed-write
forwarding. It considered high-byte branches, named arithmetic destinations, immediate reuse
and reload-only elimination. It required the original semantic-use trace/certificate, supplied
by the primary above. Its code-grounded recommendation was medium-confidence because the native
charter prevented direct inspection of hidden expert/generated paths; it clearly labeled the
parent's baseline measurements. No denial was retried or bypassed. No reviewer agreement is
treated as runtime, byte or physical proof.

| Owned temporary baseline artifact | SHA-256 before eventual cleanup |
| --- | --- |
| `extraction-trace.json` | `e36117bf9902186f50c069220d9851bbe4f49c088c43b6c04da6e200b5c77f4a` |
| `baseline-byte-cores.json` | `af41d86dfd9fa8cb5cb48fe521d2471060df090e99bc089ed9662040192a3a02` |

Only a fresh public build and focused inspection have run in this unit. The predecessor's actual
complete GREEN is not rerun or claimed as new evidence. No emulator is launched by these probes.
Whole-frame timing, loading time and physical behavior remain Unknown here. No push, issue
closure, production change or existing-oracle edit.

Expert lineage: `2.0.4`, content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`;
load/store and instruction-effect references and source keys are bound in the plan.

## Independent specifications, RED and freeze

The clean plan/preflight checkpoint is local `99b79ad1`; production still matches `ee9bb67d`.
Independent Sol author `ses_e14f53034ffeMpz6TTa7wfQNT4` consumed only the supplied contract,
declarations and source adapters, reports no forbidden exposure and ran no commands.
The primary is the sole execution owner.

Prefreeze adapter corrections do not count as implementation RED:

- Author added the missing await to the asynchronous analysis call.
- The primary's monitor signature incorrectly included `pc` on `ViceCpuRegisters`. The first
  runtime attempt failed four setup assertions on that nonexistent member. The author removed
  only those two duplicate member checks; all exact `waitForStop` PC equalities and 257-sample
  state/flags/SP/MMIO-count expectations remain unchanged. No monitor, helper or timeout changed.
- Formatting expanded the selector file to 573 lines. The author partitioned its exact 49 cases
  into 29 producer/address and 20 barrier cases. The primary mechanically extracted the same small
  adapter into a local fixture, adding only export documentation. Fit auditor
  `ses_e14f9f685ffe8v46Xo12JNGAJi` independently confirms no new material support mechanism;
  case/body preservation remains the author's stated evidence plus matching executed counts.

| Executed check | Actual result |
| --- | --- |
| Source adapter legality | All eight supplied positive/observer source forms complete frontend, semantic construction and whole-program closure. |
| Original selector RED | 49 cases: two intended missing-selection failures, 47 pass. |
| Split selector RED | Same 49 cases and same two failures; both files collect, 47 controls pass. No missing-module, invalid-source or setup failure is called RED. |
| Public output RED | 16 cases: eight intended anonymous-pair failures across four profiles; eight continued-acceptance controls pass. |
| Corrected runtime baseline | Four cooperative profiles, 257 independent values/A/N/Z/C/V/D/I/SP samples and exactly 257 ordered writes each pass; command 9.743 s. This already-correct behavior is an independent preservation baseline, not output-shape RED. |
| Static checks | Compiler/helper project check passes. New internal specifications pass strict directed TypeScript checking including exact optional properties; root specifications pass strict checking apart from the inherited optional-property mode noted below. |

An additional, non-project root-test static probe with `exactOptionalPropertyTypes` reports the
pre-existing `test/m1/vice-runtime.ts:335` optional `enableJoystick1` assignment (`TS2379`).
The identical diagnostic is reproduced by checking that unchanged helper alone, with no new
specification inputs. It is not fixed or hidden by changing this unit or the shared helper.
The root specifications have no diagnostics under strict checking without that extra mode.
The repository's required build/typecheck/test gates remain due; this extra probe is not claimed
green and does not establish a new project-wide root-test typing gate.

Frozen before production implementation:

| File | SHA-256 |
| --- | --- |
| `packages/compiler/src/machine/low-byte-write-forwarding.spec.test.ts` | `be6374ba517b19037c776c02f2c874419303a352059ea93d84210158ccba80cc` |
| `packages/compiler/src/machine/low-byte-write-forwarding-barriers.spec.test.ts` | `c3568d1b64216dbb6ef9979263843e0e3212abee119561ad7892bc0c8d57a58d` |
| `packages/compiler/src/machine/low-byte-write-forwarding-test-support.ts` | `6c9e3af11fe40e7b97534c687165d35e187627b0eda4bf77115446784ac921b3` |
| `test/rd05/low-byte-write-forwarding.spec.test.ts` | `6ba8466ad30d98e994443f6953a18326e6d02e670537d3f16978325e4ab45d7f` |
| `test/rd05/low-byte-write-forwarding-vice.spec.test.ts` | `888d164c1bf0ec22e74560826efcfeb559b798076a063f3768a5fc0da98fea0b` |

All 27 old source/oracle boundaries still match the initial baseline, including the unchanged
safe-return/shared-runtime paths. Frozen spec/expert authority is untouched. No production edit
exists at freeze; no old-oracle edit authority is inferred.

## Implementation and directed GREEN

Production delta is only `packages/compiler/src/machine/byte-write-forwarding.ts`: a bounded
ordinary-word-load/`lo` producer arm, sharing the existing complete-use/reachability/certificate
queries. The old addition predicate has the same conditions. No caller/lowerer/proof/startup,
named-source, target or optimizer-policy change. The five frozen oracle/fixture hashes match.

| Executed command boundary | Result |
| --- | --- |
| Compiler reference build / production formatting | Pass |
| Four new/old selector specification files | 107/107 pass |
| New/old public output specifications | 38/38 pass |
| Ten compiler selector/publication specification and implementation files | 178/178 pass, including all eight new controls |
| Five host output/cost/poll/publication files | 80/80 pass, including the measured downward boing cost pin |
| Six affected serialized VICE files | 13/13 pass, command 93.920 s: new four-profile 257-write checks, old byte-write 257 samples, unchanged boing startup/source trace/frame comparison and saved-port provenance |

The dense control passes through the real certificate exactly once for 256 extraction candidates;
the conflicting-definition control queries it zero times. The 6,000-block entry chain is iterative.
The storage control checks absence of the extraction's retained-value request in both returned
inventory and machine required storage after real allocation/lowering. These are bounded controls,
not a new globally linear claim for the inherited certificate.

## Fresh actual code/resource evidence

Public generation `7e61b657-37f3-4b09-bae7-772755eb7b77`, PAL cooperative KERNAL/6581,
canonical `none`, real ACME:

| Resource | Baseline | Current |
| --- | --- | --- |
| Complete code | 1,241 | 1,193 |
| Equivalent twin / remaining code gap | 442 / 799 | 442 / 751 |
| CPU16 SFA / resident RAM | 45 / 7,261 | 37 / 7,253 |
| Startup entry / platform snapshot | 326 / 49 | 326 / 49 |
| ZP / scratch | 0 / 0 | 0 / 0 |
| Reported hardware-stack resource | 1 | 1 |
| Assets / BASIC / helper | 1,024 / 12 / 0 | 1,024 / 12 / 0 |
| Padding / payload | 4,890 / 7,167 | 4,938 / 7,167 |
| PRG SHA-256 | `a078f81092528beff9388204690ff67a207a6082a3b3c84f791385a5cd41ec58` | `b8f5771116ba30b40851604c0a714954dc6970e19ce7c28d4534d0a4fc659d77` |

All eight exact retained-value home identities are absent from final CPU16 intervals.
Actual source-word homes remain `x=$2439`, `xr=$243B`, identified through the named local
intervals. Original selected bytes were recorded above; current byte cores each occur twice,
only inside actual CPU16 code:

| Named source / device | Startup PC | Loop PC | Actual six-byte core |
| --- | --- | --- | --- |
| `x` / `$D000` | `$09D4` | `$0B2F` | `AD 39 24 8D 00 D0` |
| `xr` / `$D002` | `$09DA` | `$0B35` | `AD 3B 24 8D 02 D0` |
| `x` / `$D004` | `$09E0` | `$0B3B` | `AD 39 24 8D 04 D0` |
| `xr` / `$D006` | `$09E6` | `$0B41` | `AD 3B 24 8D 06 D0` |

The primary compared all 326 startup-entry bytes directly: identical to the baseline.
Each selected core is one original absolute `LDA` and one original absolute `STA`: 6 B / 8
nominal CPU cycles versus 12 B / 16. Eight sites save exactly 48 code bytes and 8 home bytes,
with no branch-size delta. Four startup sites and four loop sites save 32 nominal CPU cycles
per group; this is not elapsed frame timing under DMA or firmware.
The local two-instruction form meets the expert floor. The existing #168 owner retains the
concrete path to a whole-program win: repeated source arithmetic/reloads, allocation/layout and
equivalent whole-frame measurement. No silent local-meet or whole-program-win claim.

The selected-core temporary record SHA-256 is
`e24c041db287d1255f08db99e4a1bdd4fd0bb4809913ebc42b8cb2a9db5fa7c2` before eventual cleanup.
Complete checkpoint and independent execution reviews remain due. Current runtime boundary is
VICE-verified / hardware-unverified on the executed profiles; external interrupt/firmware peak,
completion/deadline bounds and historical whole-program body-byte identity remain unproved.

## Scoped residual and deferral assessment

This is a task continuation, not an RD closeout. Subject to the remaining review/checkpoint,
its missing low-byte-to-fixed-write handoff is delivered, so that specific implementation
rationale expires. Nothing here removes the separate high-byte branch/flag ownership proof,
named-destination arithmetic staging, broader observer/interrupt analysis or allocation/timing
obligations. All unsupported legal source keeps its existing general lowering.

The parent byte-write and startup units are not reopened or requalified by this bounded result.
Their inherited Unknown safe-return timeout cause and reboot-cleared historical raw evidence
remain documented. The old safe-return test/helper and 20-second waits are byte-identical.
No RD future slice, FUT rationale or source restriction is closed by this selector addition.
No new deferral is introduced or left without an owner: #168 retains the 751-byte equivalent
code gap, remaining arithmetic/reload/allocation work and whole-frame timing. The existing
external firmware/interrupt, physical-host and hardware ownership boundaries stay unchanged.

No architecture/API or startup contract changes, and there is no opted-in `docs/index.md`
techdocs surface to regenerate. These scoped plan/evidence records own this lowering correction.
Final acceptance still requires the six execution lenses and actual complete checkpoint.

## Independent execution review

All six roles in [review dispositions](05-findings.md) return no findings after their bounded
source, contract, test and recorded-artifact inspections. No source fix or oracle edit follows.
The SFA and machine-code reviewers received the current five release metadata fields and
selected normative excerpts; authentication is primary-owned, not their direct hidden-file read.
The machine-code reviewer independently decodes the primary-recorded byte cores, but does not
claim raw-PRG, hash, Git-tree or test execution. The host reviewer initially requested the actual
patch rather than a summary; the exact production patch and complete-new-file addition
identities were supplied before its no-findings verdict.

Reviewers preserve semantic/storage/assembly/actual-byte/runtime/physical endpoints. The primary
retains responsibility for exact diff identities, freezes and executed gates. Incidental
routing-history exposure reported by some reviewers was excluded from decisive evidence; no
qualification answer map was supplied. No native denial was retried or bypassed.

Task T-168.33 closes at 5/6 plan tasks. Job `sh_1eb257882001LFMnOdTr9aL9JA` runs the actual
`yarn test:changed --host` then `yarn test` with captured source/test/boundary hashes. No result
or pass is claimed until completion notification; no competing emulator is launched.
Only then may unchanged final prechecks and one actual `yarn test:full` qualify closeout.

## Actual changed+host and host checkpoint — GREEN

Job `sh_1eb257882001LFMnOdTr9aL9JA` completes successfully:

| Command | Actual executed boundary | Result |
| --- | --- | --- |
| `yarn test:changed --host` | Fast root45files/1,282tests; changed compiler machine84/1,090; selected root integration2/17; selected serialized VICE1/4; complete host249/5,199 | Exit0,643.374 s |
| `yarn test` | All seven Turbo tasks cache misses; fresh compiler253files/4,223passed/2existing skipped, CLI70/server21/editor18; fresh root host249files/5,199tests | Exit0,503.374 s |

The changed selector includes the newly changed runtime file even with `--host`; that four-case
VICE slice ran serially with no other emulator. The later host root tier launches no emulator.
Root host durations were554.21 s in the changed command and241.57 s in the subsequent full host
command; workspace compiler duration260.44 s. All41 guarded input hashes match after both commands.
The frozen input manifest SHA-256 is
`65c1f75bb888d8d05ad34442482274f37d4d8a80fca009f6f1020cf73343250c`.
These results are not substituted for the complete serialized VICE tier.

No source/test change follows these gates or the six clear reviews. Final frozen install,
build/typecheck, formatting and one actual `yarn test:full` remain to qualify closeout.
Normal content-addressed cache replay is disclosed if used; the actual root host and serialized
VICE tiers must appear and finish successfully. No automatic retry is scheduled.

## Actual complete checkpoint — GREEN

Job `sh_1eb38546b001YqIr0lDUtvYty1` exits zero. The primary independently rechecks its result
manifest, both host/VICE tier markers, all 41 guarded source/test/boundary input hashes and all five
frozen specification/fixture hashes after completion. Every identity matches.

| Actual step | Result |
| --- | --- |
| Targeted formatting | Pass,0.753 s |
| `yarn install --frozen-lockfile` | Pass,0.293 s |
| `yarn build` | Pass,1.064 s; normal Turbo cache |
| `yarn typecheck` | Pass,0.661 s; normal Turbo cache |
| `yarn test:full`, workspace tier | Seven successful Turbo tasks, normal cache replay of the preceding fresh host checkpoint: compiler253files/4,223passed/2existing skipped, CLI70/server21/editor18 |
| Complete root host | Fresh249files/5,199tests pass,254.14 s |
| Serialized VICE | Fresh133files/2,387tests pass; only existing1file/4test skips,4,278.13 s |
| Complete command / entire final chain |4,533.332 s /4,536.110 s |

The workspace results were freshly executed in the preceding `yarn test`, not rerun in this
complete invocation. Cache replay is not described as fresh execution. Both root tiers execute
fresh in the actual complete command. The unchanged safe-return file passes all three cases;
the unchanged canonical-fallback file passes21/21. New runtime4/4 and saved-port provenance3/3
pass within the full gate. The original helper and 20-second waits remain byte-identical.
No isolated rerun or retry substitutes for this actual complete GREEN.

| Retained evidence identity before cleanup | SHA-256 |
| --- | --- |
|41-input manifest | `65c1f75bb888d8d05ad34442482274f37d4d8a80fca009f6f1020cf73343250c` |
| Complete command log | `bbbe55f2da7d8a9aff64890fa4d69687249d25a2e99a4f933ca45513c158f75a` |
| Complete result manifest | `61d989af4d58284c074b4c8ef944dbad2c2085055747d4fe44ab3b1dea0caca2` |
| Preceding fresh host-checkpoint log | `441f301b4db7f6fa7b93248b32792e820f3a139ff959e51b03b00e8a2a6016eb` |

All six independent reviews remain applicable: no production/source/oracle change followed them.
Required project gates are GREEN; the separate inherited extra-mode root typing probe remains
explicitly non-green and out of this unit's modification scope. Frozen `spec/` and expert authority
are untouched. No existing specification test, helper, monitor, timeout, source, twin, startup or
observer proof was edited. The only old test change is the measured downward implementation-cost
pin, code1,241→1,193.

The scoped residual/deferral assessment above is reconfirmed. The feature roadmap records6/6;
the portfolio cascade is deferred to integration branch `v3` under roadmap policy, rather than
rewriting unrelated portfolio state from `feature/v4-rebuild`. Final documentation/links/diff
checks and the coherent local commit complete the handoff. Owned temporary baseline projects,
logs, manifests and scratch are removed after durable recording and commit.

Final bounded result: 48 fewer code bytes, eight fewer SFA/resident bytes, no payload win
(padding absorbs the code saving). The equivalent442-byte twin, remaining751-byte code gap,
arithmetic/reload/allocation opportunities and whole-frame timing remain #168-owned.
This is VICE-verified / hardware-unverified, not a whole-program beat or unrestricted interrupt
guarantee. Current expert2.0.4/content`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`.
The previous safe-return timeout's cause remains Unknown; current GREEN neither explains that
history nor reconstructs raw evidence lost at reboot. No push or issue closure.
