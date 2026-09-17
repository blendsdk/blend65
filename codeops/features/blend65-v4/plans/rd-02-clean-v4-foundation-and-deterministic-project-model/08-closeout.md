# RD-02 Foundation Qualification

> **Status**: Blocked (was: Executing) — local implementation checkpoint, not final RD closeout
> **CodeOps Artifact Schema**: 1

## Required Direct Inspections

Declared before Phase 3 implementation, alongside its runnable specification
oracles. Actual results will be recorded below; configuration is not execution.

| Obligation         | Required evidence                                                                                                                                                                                                                                                          | Current state                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| ST-36              | Complete install/build/typecheck/test on actual Node 22 Linux x64 and Windows x64; real containment, aliases, symlink/junction, permission and race fixtures execute without silently skipped proof                                                                        | Linux PASS: 674 actual tests; Windows blocked by DEF-1                                  |
| ST-36 portability  | Native Windows command invocation, including the existing root test's direct Yarn `tsc` shim execution, must be verified; any locked-oracle correction requires a separately approved narrow exception                                                                     | Pending                                                                                 |
| ST-39              | Real foundation example identity, input counts/bytes, CPU/RAM/OS/filesystem and tool versions; separate discovery, JSONC, inventory/snapshot, build, test and peak-memory observations                                                                                     | PASS: actual example records below                                                      |
| ST-39 non-gate     | Inspect that measurements are observations only, with no benchmark framework, synthetic scale fixture or acceptance threshold                                                                                                                                              | PASS: one scratch observation, no new runner or threshold                               |
| ST-40              | Compare frozen spec/expert identities and active/reference-only ownership with RD-01                                                                                                                                                                                       | PASS: root facts and full authority diff checks                                         |
| ST-40 deferrals    | Walk v4 requirement/plan registers, RD-02 Won't Have, every future-consideration trigger and expert release/qualification deferrals; answer the exact deferral-expiry question; expired rationales require existing or explicit owners, with no orphan RD-02 landing place | PASS: checkpoint walk below; repeat if deliverables change                              |
| No publication     | Built CLI and library leave absent output absent and existing output unchanged; no compiler artifacts, source upload, assembler/emulator or external subprocess in production                                                                                              | PASS on Linux: actual traces and existing-output sentinel; Windows pending              |
| Independent review | Review verified implementation and simplicity; final closeout review follows all required native evidence                                                                                                                                                                  | Checkpoint PASS: no findings, simplicity PASS; final RD evidence review pending Windows |

## Entry

Clean local branch `feature/v4-rebuild`, HEAD `2787f2c`; Phase 3 baseline tree
`3dcf9871225670a3f09a027673a28c72bed9ae6a`. Resume build/typecheck and 558 compiler
tests pass. Frozen Specification 4 and expert 2.0.0 remain the authority.
The public library currently loads snapshots; no language compilation exists.

## Real Example Observations

Observed on 2026-09-18: Node 22.23.1, Yarn 1.22.22, TypeScript 7.0.2, Turbo
2.9.16, Vitest 2.1.9; Linux 6.8.0-138-generic x86_64, ext4, Intel Core
i7-7820HQ at 2.90 GHz, eight logical CPUs, 15 GiB host RAM. Values describe this
busy development host only. They are not thresholds, synthetic scale results or
cross-host performance guarantees.

| Real input                           | Identity / size                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Combined snapshot                    | `8d8950ba746a7ee81b495da1600d3d13dab4bc1a0bcc741fa52fabdfe2e40aa8`                               |
| `examples/foundation/blend65.json`   | 255 bytes; SHA-256 `f630c5552f9f71ad2574ec8d8a0fa82ca38440f64fa30a2014d1cf7d9dcb6abf`            |
| `src/main.blend`                     | One source, 46 bytes; SHA-256 `71a9f3d466497f85e1712848604756c9f9d74eecee5c19dda38835a045f56e0d` |
| Total admitted manifest/source input | 301 bytes; no assets                                                                             |

| Observed phase                                            | Duration | Memory                                   |
| --------------------------------------------------------- | -------- | ---------------------------------------- |
| Native nearest-project discovery                          | 1.514 ms | Not isolated per phase                   |
| Pure JSONC/schema validation after native read/decoding   | 4.347 ms | Not isolated per phase                   |
| Native path validation and inventory                      | 4.138 ms | Not isolated per phase                   |
| Complete public snapshot load/revalidation                | 9.038 ms | Observation process peak RSS: 61,048 KiB |
| Root `yarn build`, warm Turbo cache                       | 0.32 s   | Maximum single-process RSS: 99,764 KiB   |
| Actual TypeScript `tsc --build --force` reference rebuild | 0.14 s   | Maximum single-process RSS: 75,776 KiB   |
| Root `yarn test`, compiler cached, CLI/root executed      | 6.31 s   | Maximum single-process RSS: 122,240 KiB  |

The snapshot measurement includes discovery, validation, inventory and re-reading;
it is not a subtraction of the separately observed phase calls. Node's process
resource usage records the observation process peak; GNU time records maximum
single-process RSS, not total memory across concurrent test workers. No public
metrics API, benchmark harness, synthetic project or performance PASS gate was added.
One scratch observation script invokes existing functions on the actual example.
Raw records: `/tmp/blend65-rd02-phase3-observations.json` and
`/tmp/blend65-rd02-phase3-{build,test}-observations.log`.
The actual TypeScript rebuild record is
`/tmp/blend65-rd02-phase3-ts-build-observations.log`; it is separate from the
warm, cached Turbo orchestration measurement.

## Linux CLI No-Publication Proof

Actual built-bin success was traced with Linux `strace -f -yy` file/write
syscalls. No project write or write-capable open/mutation was attempted, and the
example's absent `out` remained absent. A separate invalid-option invocation
returned 2 without an example read. Existing-output preservation is independently
proved by the built-bin spec sentinel. Phase 2 already supplies actual native
library success, invalid UTF-8/path and unreadable-input write-attempt traces.
Neither trace is Windows evidence.

Logs: `/tmp/blend65-rd02-phase3-cli-syscalls.log`,
`/tmp/blend65-rd02-phase3-invalid-args-syscalls.log`,
`/tmp/blend65-rd02-phase3-cli-readonly.log`,
`/tmp/blend65-rd02-phase3-invalid-args.log`.

## Deferral-Rationale Walk

**Did this RD's deliverables expire any deferral's stated rationale? No.**

This is the completed walk for the implemented checkpoint, not permission to
close without Windows evidence. Reinspect if qualification requires deliverable
changes. Reviewed the v4 requirement register, both v4 plan registers, RD-02's
Won't Have section, every open/resolved/rejected future-consideration entry and
reconsideration criterion, and the expert's release/qualification deferral records.

| Reviewed item                                                     | Actual result / continuing owner                                                                                                                                        |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements AR-011/AR-026: incrementality                        | One 301-byte load-only input, no Blend65 analysis/editor or measured re-analysis delay; no rationale expired. Later measured compiler/editor owner remains RD-04/RD-09. |
| Requirements AR-012/AR-036: public plugins, bundler, remote cache | No plugin, packaging consumer or demonstrated remote-cache need was introduced. Existing explicit approval would still be required; no support surface added.           |
| RD-02 Won't Have and AR-P2/P3/P7                                  | Language pipeline/publication remain owned by RD-03 and later compiler/asset RDs; loading does not produce artifacts. No orphan RD-02 landing slice.                    |
| FUT-006/FUT-007                                                   | No compiled real-world nested-exit/range-switch workload or syntax-design evidence was produced. Future language-change owner, not host tooling.                        |
| FUT-011/FUT-012                                                   | No external object/link ABI or demonstrated need for a duplicate array-copy intrinsic. Existing compiler/language owner remains responsible.                            |
| FUT-015/FUT-016                                                   | No modern-image conversion, stack-pressure measurement or stack-free calling contract was produced. Future asset/compiler owner.                                        |
| FUT-017/FUT-018                                                   | No optimizer, cross-statement scheduling, RAM/MMIO proof or measured volatility bottleneck exists in this foundation. Later optimizer owner RD-08.                      |
| Resolved FUT entries and rejected forms                           | Existing Specification 4 resolutions/rejections remain unchanged; the host foundation adds no language form or new reconsideration evidence.                            |
| Future targets                                                    | Base-C64 profile recognition is not compiler qualification. C64U remains with `blend65-c64u`; X16/Atari notes remain non-normative future-target constraints.           |
| Expert release/qualification records                              | Frozen 2.0.0 remains qualified authority. Implementation discrepancies are audit subjects; no deferred knowledge or RD-02 landing obligation exists.                    |

No expired rationale or unowned deferral was found; no backlog expansion or
discarded v3 expressiveness ledger is needed. DEF-1 is the explicit qualification
blocker, not silently deferred implementation or waived Windows acceptance.

## Native Host Access Blocker

The current host is Linux x64, not Windows. Read-only checks found no configured
libvirt VM, no accessible Windows connector and no registered self-hosted GitHub
runner for this repository. Existing completed CI runs name other commits; they
cannot qualify this local, unpushed implementation. The adapted Windows hosted
matrix has not executed this revision. No push, credential or new infrastructure
was used to bypass that gap.

DEF-1 owner: the user supplies an existing Windows host or an authorized route
to execute the current revision; the agent runs the declared qualification there.
Then verify native aliases/junctions/symlinks/ACLs/races and command portability,
record results, complete final evidence review/commit, and mark RD-02 Done only
on actual acceptance. Final task 3.3.2 remains blocked.

## Verified Local Implementation Checkpoint

Linux Node 22 x64 complete install/build/typecheck/test PASS: 674 tests,
570 compiler + 61 CLI + 43 root. An additional forced package-test run and fresh
root-test run reproduced those counts without cached test results. Build and
typecheck use actual workspace/dependency declarations. Frozen spec/expert bytes
remain unchanged from RD-01; the root authority test reproduces their identities.
Log: `/tmp/blend65-rd02-phase3-native-linux-verify.log`.

An independently reviewed local implementation checkpoint is allowed under the
overriding project workflow directive to commit coherent green work. It is not
the final RD acceptance commit. Actual Windows results and final closeout review
remain required by task 3.3.2; no requirement, oracle, host fixture or completion
criterion is waived by committing the implemented consumer.

Independent implementation checkpoint review: no findings; simplicity PASS.
The generic independent reviewer reproduced all 61 CLI cases, 12 classifier
cases and 34 root foundation/boundary cases, inspected the actual forced Linux
674-test log, reproduced all five frozen authored hashes and confirmed the
original root oracle's 16,323-byte prefix remained exact. Frozen authority diff
and whitespace checks passed. No extra security/performance auditor applies.

The named reviewer role was interrupted before a finding result because its
blanket no-spec-file-additions rule conflicts with the plan's explicitly approved
independent test-author tasks. The permitted generic fallback preserved all review
lenses and verified no post-RED oracle change; no integrity exception or changed
expectation was used. Only the fallback completed the checkpoint review.

Actual workspace-installed POSIX `blendc` help and example loading also passed
after a normal frozen-lockfile force relink of the built binary. Yarn classic
only creates links for already existing built files. Log:
`/tmp/blend65-rd02-phase3-installed-bin-verify.log`. The documented direct Node
entry works without that development relink. Native Windows bin/shim behavior
still requires its actual qualification.

Final RD evidence review remains pending Windows qualification. No push is
authorized or performed. This checkpoint does not close Phase 3 or RD-02.

## Specification-First Evidence

Before any CLI implementation, an independent blind author wrote 47 CLI cases,
12 primitive host-identity cases and three root structural additions. Parent
repeated CLI RED: all 47 fail on missing main API, package metadata or built bin,
not on already implemented behavior. Root RED: one actual CI contract failure
(no Windows matrix) and three missing CLI-manifest failures, including two
existing package/config cases. Six existing root checks pass. All 12 classifier
vectors already pass the Phase 2 implementation; they prove classification, not
native Windows behavior. No frozen authority or existing Phase 1 assertion changed.

Logs: `/tmp/blend65-rd02-phase3-cli-red.log`,
`/tmp/blend65-rd02-phase3-root-red.log`,
`/tmp/blend65-rd02-phase3-host-baseline.log`.

| Frozen authored file                                       | SHA-256                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/cli/src/cli.spec.test.ts`                        | `0ecce95e0b6afdd6ccf3719dffee486a9159e53a30fd42ed682082a1adb6d2f0` |
| `packages/cli/src/bin.spec.test.ts`                        | `b1045a24087b5c722f2d441f9502b7853ed9dc1cd540507a0554d29ecbb704c4` |
| `packages/cli/test/cli-fixtures.ts`                        | `49d9c22cac36cfc6d4ea0ba1e0f875ec9160b89109ee9b416ef32b910dc839ba` |
| `packages/compiler/src/project/host-identity.spec.test.ts` | `7fe51d96e585edf9ae0e7334a8767afd5f1c00f5af7b1506dd4d19fc8fec777a` |
| `test/foundation.spec.test.ts` including additions         | `fff29ec5af48ab34438acbe76afe0e79f6eed463fd489b3e4d62201d9b7d1628` |
