# Execution plan: VIC-II collision reads

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-01 09:04
> **Progress**: 10/10 tasks (100%)
> **CodeOps Artifact Schema**: 1

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---|
| 1 | Two consuming hardware reads | 10 |

The phase checklist is the sole task-progress authority. Update after every task:
mark implemented work `[~]` with a real timestamp, then verified work `[x]` with completion
timestamp. Only `[x]` counts; update Progress and Last Updated immediately. Resume the first
`[~]`, otherwise the first `[ ]`. Mark blockers `[!]` with `Blocked: reason` on that line.
Commits use the git-commit skill at coherent green checkpoints. Push is never automatic.
Effort handoffs follow AGENTS.md; planning approval is not a batch execution waiver.

**Execution batch authority (2026-10-01):** User: “effort is high, continue until all tasks
are complete.” This confirms high effort and waives repeated effort pauses for the remaining
named collision-read tasks 1.1.2–1.3.3 only. Material decisions and approval gates still stop.

## Phase 1: Two consuming hardware reads

> **Phase baseline tree**: 84485b973025215df270819ba0b0ee1f14b871a4
> **Scope mode**: strict — two consuming hardware reads; no collision engine or new runtime/harness.

**Expected modification set:** The three new `test/rd05/vic-collision-*.spec.test.ts` files;
`packages/compiler/src/frontend/profile.ts`, `profile.spec.test.ts`,
`profile-constants.spec.test.ts`, `profile-constants.impl.test.ts`;
`packages/compiler/src/target/c64-kernal.ts`;
`packages/compiler/src/machine/lower-c64.ts`, `lower-register-forwarding.ts`, `vic-collision.impl.test.ts`;
this plan's execution/index/ambiguity/component/testing/closeout/review evidence and the feature roadmap.
Any maintained API documentation path must be identified before its closeout edit.
The initial worktree was clean. Approved preflight content identity matched before execution.
**Lenses:** Compiler/language semantics, volatile hardware effects and expert output cost.
**Reference:** [Component contract](03-collision-reads.md), AR-P1–AR-P4.

**Necessary existing-seam correction (task 1.2.3):** Output oracles expose an unnecessary
temporary store/reload for retained collision results (+6 bytes/+8 nominal cycles).
The existing adjacent fixed-destination forwarding selector admits byte loads but not these
new platform producers. Extend that exact producer admission for the two approved reads;
retain its sole-use, adjacency, constant-destination and byte-width guards. This is within the
approved result-retention contract, not a new pass/representation or broader API/optimization.
The selector path above is attributed to this phase; no unrelated file is included.

### Session 1.1: Specification tests

- [x] 1.1.1 [spec-author] Write `test/rd05/vic-collision-api.spec.test.ts` and `vic-collision-output.spec.test.ts` from ST-1–ST-5/ST-10. ✅ (completed: 2026-10-01 07:31)
- [x] 1.1.2 [spec-author] Write `test/rd05/vic-collision-vice.spec.test.ts` from ST-6–ST-9 using existing bounded VICE utilities. ✅ (completed: 2026-10-01 07:46)
- [x] 1.1.3 Verify directed RED for the three new spec files; record failed missing-capability cases and justify any already-green cases in this plan. ✅ (completed: 2026-10-01 07:47)

**Verify:** Directed Vitest runs for the named files, with VICE sequential. RED must demonstrate
the missing capability, not broken setup, missing tools or a timeout.

**Task 1.1.1 evidence:** Independent implementation-blind author produced 13 API and 32 output
cases. Fresh public build passed. Directed Vitest run on 2026-10-01: 42 expected failures,
3 passes, 45 tests in 9.06 seconds. Eight API acceptance and 32 output cases fail on missing
approved exports (E10012); two arity cases correctly demand E10171 but currently receive E10012.
Repeated/cross-operation source also shows downstream E10239 after the absent binding.
Both misspelled-export E10012 cases and the unsupported-profile E10279 case already pass because
their rejection paths exist. All four marker-only compiler/ACME scaffolds pass; no setup/tool
failure or timeout occurred. Log: `/tmp/blend65-vic-collision-red.hQc0Py.log`.
Formatting and documentation checks pass; old specification tests and frozen authority untouched.
This completes test authoring only, not capability verification or the three-file RED task 1.1.3.
Tests remain uncommitted until a coherent green checkpoint, as required by AGENTS.md.

**Task 1.1.2 evidence:** The same implementation-blind author produced 16 runtime cases
(four controlled collision scenarios on each profile) using existing VICE utilities.
Directed RED: 16 expected failures on E10012/E10239 from absent collision exports;
no syntax, tool, setup or timeout failure. Log: `/tmp/blend65-vic-collision-vice-red.4peEx0.log`.
Formatting and documentation checks pass. The fixture has not executed in VICE yet;
runtime qualification remains Unknown until the implementation is green.

**Task 1.1.3 evidence:** Combined directed RED on all three new specification files:
58 expected failures and 3 existing-negative passes, 61 tests in 16.76 seconds.
The acceptance/output/runtime failures report absent approved exports E10012 and downstream
E10239; the arity cases demand E10171 but currently receive E10012. The already-green cases
are the two misspelling errors and one unsupported-profile error explained above.
Four marker-only ACME scaffolds still pass. No tool/setup failure or timeout occurred.
Log: `/tmp/blend65-vic-combined-red.Hfoswz.log`. All three files pass formatting;
source documentation is self-contained and frozen authority remains unchanged.
This establishes valid specification-first RED before any compiler implementation edit.

### Session 1.2: Implementation

- [x] 1.2.1 Add AR-P2 declarations and named device facts in `packages/compiler/src/frontend/profile.ts` and `target/c64-kernal.ts`; verify source/API cases. ✅ (completed: 2026-10-01 08:30; AR-P5 exact correction approved and applied)
- [x] 1.2.2 Apply only AR-P3's approved edits to `packages/compiler/src/frontend/profile.spec.test.ts` and `profile-constants.spec.test.ts`; verify both inventories. ✅ (completed: 2026-10-01 08:31)
- [x] 1.2.3 Add direct lowering in `packages/compiler/src/machine/lower-c64.ts` per the component contract; preserve existing result retention and effects without a new representation. Verify output cases. ✅ (completed: 2026-10-01 08:34)
- [x] 1.2.4 Verify directed GREEN for ST-1–ST-10 and the two inventory tests; inspect assembled bytes/cost and sequential runtime observations. Fix implementation, not new oracles. ✅ (completed: 2026-10-01 08:36)

**Verify:** Directed Vitest runs for new specification files and both inventories; existing
compiler build when fresh public declarations are needed. Do not commit a partially green tree.

**Task 1.2.1 evidence:** Fresh build and all 13 API cases pass after the exact AR-P5
comparison removal. No source signature, effect, fixture or diagnostic assertion changed.
Named machine facts and consuming-API comments are documented without planning references.
Log: `/tmp/blend65-vic-api-corrected.CxAZgE.log`. No lowering or runtime pass claimed yet.

**Task 1.2.2 evidence:** Both inventory files pass, 55 cases. Diff contains exactly two
added rows per file and the approved thirty-five→thirty-seven title correction; all old
rows, fixtures and assertions remain unchanged. Log: `/tmp/blend65-vic-inventory.eCIYp9.log`.

**Task 1.2.3 evidence:** Fresh build and all 32 independent output cases pass on all four
profiles. Actual ACME bytes match direct LDA absolute (3 bytes/4 nominal cycles), with only
the requested STA absolute for retained direct-store cases (another 3 bytes/4 cycles).
Discarded/repeated/cross-register reads retain exact counts/order; no D019 access, device
write, wrapper, hidden storage or resource delta. The first run exposed the existing
selector's missing producer admission; its narrow correction removes +6 bytes/+8 cycles
without touching any output oracle. Log: `/tmp/blend65-vic-output-forwarded.sccD4D.log`.

**Task 1.2.4 evidence:** All 61 new specification cases pass (including 16 sequential VICE
cases), and both inventories pass all 55 cases. Log: `/tmp/blend65-vic-directed-green.JLKduq.log`.
Real pixels produce sprite/sprite 81 and background 80 as specified, including independent
simultaneous masks in both read orders. After a full disabled frame, repeated samples are zero;
original RAM snapshots remain intact, D019 status unchanged and traced accesses exact.
Pinned VICE binary/ROM/model identities and the assembled PRG SHA check pass per case.
Bounded status: VICE-verified / hardware-unverified. Complete-cost probe at
`/tmp/blend65-vic-cost-evidence.D6MLq0.log` records payloads 649/652/655 bytes for scaffold,
discarded and retained slices; zero-page/scratch/execution-home delta zero, startup 12 bytes
unchanged. The reported hardware-stack aggregate remains 21 bytes: program-domain peak 1
plus a 20-byte platform reserve, not 21 bytes of measured use. No collision-related stack
delta is introduced. Whole-program cycles remain explicitly Unknown.

### Session 1.3: Implementation tests and hardening

- [x] 1.3.1 Write `packages/compiler/src/machine/vic-collision.impl.test.ts` for internal result retention and instruction selection. Per approved PF-001, update only `frontend/profile-constants.impl.test.ts` binding total 60→62 and both operation/constant boundaries 35→37, preserving all identity, immutability and fresh-state assertions. Verify both implementation-test files directly; specification expectations remain unchanged. ✅ (completed: 2026-10-01 08:41)
- [x] 1.3.2 Run the full AR-P4 checkpoint: `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, `yarn test`; check touched-file formatting, local links and frozen `spec/`/expert authority. Obtain required independent phase review and resolve blocking findings. ✅ (completed: 2026-10-01 08:59)
- [x] 1.3.3 Write `08-closeout.md` with bounded behavior/output/runtime evidence, measured expert comparison and deferral-expiry answer; update the feature roadmap without claiming RD-05 complete. Update maintained API docs through techdocs where applicable; commit the green checkpoint through git-commit. ✅ (completed: 2026-10-01 09:04)

**Verify:** AR-P4 full checkpoint, review clearance, document/link checks and frozen-authority
checks. Documentation-only closeout edits use impact-based validation, not a redundant full run.

**Task 1.3.1 evidence:** 17 focused collision implementation cases plus the existing profile
binding and forwarding tests pass, 42 cases total. Exact instruction/effect/flag/cost checks,
discarded reads, direct result forwarding, stable retention across a consuming clobber and
negative sole-use/address/width/block guards are covered. Only the approved three numeric
profile-binding expectations changed. Existing platform producers keep their prior path.
Log: `/tmp/blend65-vic-impl-final.exNqKG.log`. Documentation self-check and diff check pass.

**Task 1.3.2 evidence:** The unchanged full checkpoint retry passes install, build, typecheck
and all 2,980 tests (1,702 workspace and 1,278 root). Log:
`/tmp/blend65-vic-full-retry.KIcX5W.log`. The first attempt hit an unchanged service test's
five-second timeout; neither its timeout nor its assertions changed. Formatting, local links,
diff checks and frozen `spec/`/expert-authority checks pass. Three independent reviews are
complete; no unresolved implementation findings remain. [Review and explicit policy ruling](09-phase-review.md)
records the exact approved inventory-test exception without weakening existing cases.

**Task 1.3.3 evidence:** [Closeout](08-closeout.md) records unsigned consuming behavior,
assembled expert comparison, complete resource deltas, four-profile runtime identities,
review rulings and the deferral-expiry answer. No other deferral expires and RD-05 remains
Executing. No maintained C64 API documentation exists; durable JSDoc is updated without a
documentation framework. Required local-parity follow-up [#94](https://github.com/blendsdk/blend65/issues/94)
is filed for RD-08. All touched-file formatting, local links, diff checks and frozen-authority
checks pass; log `/tmp/blend65-vic-closeout-verify.PjCwYy.log`. The complete project checkpoint
above remains valid after documentation-only closeout. Local commit follows this verified
checkpoint; pushing is not authorized.

## Dependencies and success

Tasks run in listed order. Session 1.2 depends on valid RED; Session 1.3 depends on GREEN.
No other RD or unavailable Windows host is an execution dependency for this slice.
Success requires all ten tasks verified, independent review clear and no hidden runtime cost.
R5.27 remains subject to the recorded evidence boundary; other RD-05 obligations remain open.
If a new semantic ambiguity or material support mechanism is discovered, stop and record it
in the register before implementation. This plan does not authorize additional machinery.
