# Unreachable teardown — verification

> **Baseline**: `46292b77`; predecessor actual complete checkpoint passed, local commit only.
> **Status**: 7/7 verified; bounded teardown complete, actual full checkpoint green; #168 remains open.

The sections below are chronological. Initial RED and sampler blockers are retained as history;
the active freeze, approved exceptions and current checkpoint are recorded in the later sections.

## Independent author and freeze

The independent author consumed only approved requirements, signature/type excerpts and fixture
contracts. It reports no forbidden implementation exposure. The primary supplied missing
signatures without relaxing the read boundary. Before freeze the author added the valid IRQ
adapter, corrected two CIA negatives to actual configuration writes (ordinary reads are not the
write barrier), and separated producer assertions from later constructor assertions. No assertion
was removed. Primary formatting preserved behavior.

| Frozen specification                                             | SHA-256                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/compiler/src/machine/lower-dead-restore.spec.test.ts`  | `e944507383bb2530b161c877460345b4ed07f280032e72d95d4af411fd197cd2` |
| `packages/compiler/src/layout/startup-dead-restore.spec.test.ts` | `77c5b1e158e7db966c15fb835a9f8c6a4f78ef146bec00092ca2755b380621a4` |
| `packages/compiler/src/layout/c64-dead-restore.spec.test.ts`     | `bc2d226b10b81e035f7e3c689098ab616cc91399c69e9a6b0e49ff61db7f333f` |
| `test/rd05/nonreturning-startup.spec.test.ts`                    | `653d026fc268b40f4ee30b8ae19c076883fe3bf1afb40c2a4d80ece716f5e783` |

## Meaningful RED

| Executed boundary                                                                                                                                                                                              | Result before implementation                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three compiler files, `yarn workspace @blend65/compiler test src/machine/lower-dead-restore.spec.test.ts src/layout/startup-dead-restore.spec.test.ts src/layout/c64-dead-restore.spec.test.ts --reporter=dot` | Initial 35 cases: 9 meaningful failures, 26 pass. No setup/import/illegal-source failure. After the independent assertion split, machine-only rerun is 2 meaningful failures/12 pass, making the final compiler specification total 36 cases: 10 RED/26 controls. |
| `yarn vitest run --config vitest.integration.config.ts test/rd05/nonreturning-startup.spec.test.ts --reporter=dot`                                                                                             | 4 meaningful failures at emitted restore-label presence across the four profiles; 4 returning controls pass.                                                                                                                                                      |
| Targeted four-file formatting                                                                                                                                                                                  | Pass; hashes above bind the frozen files.                                                                                                                                                                                                                         |

Constructor/rebinding positives still contain restoration. Layout incorrectly admits dangling
restore references under the not-yet-implemented false handoff. The producer has no false fact.
These are behavior/structure failures, not missing-module RED. Default/returning/takeover,
malformed-snapshot and conservative owner/observer controls pass unchanged.

Owned directed logs are under
`/tmp/opencode/codeops/runtime-91b62a9d-8e6b-4802-bbb4-e3736b245244/issue168-teardown-6520kzg2/`.
Remove only this run's logs after persistent evidence and checkpoint completion. No emulator run,
future byte saving, full checkpoint or whole-program parity is claimed for this new unit yet.

## Producer and constructor GREEN; integrated sampler blocker

Producer-only selection/fallback passes 13/13 before constructor integration. After constructor
selection, the new producer/constructor and existing startup/cooperative/takeover suites pass
**79/79**. After layout support, the three new compiler specifications and existing layout tests
pass **54/54**, including all **36 new compiler cases**. Compiler reference build passes.

The first integrated command passes the unchanged **41 poll/publication controls** and four new
returning controls. Four new public positive cases reach the frozen sampler's nonexistent `stub`
cost component. That key was incorrectly supplied by primary; actual costs use `startup` for
`program:basic.stub`, 12 bytes. All other assertions remain unchanged. AR-P1 requests the exact
one-argument correction; no frozen file has been edited after freeze.

The existing implementation cost pin separately reports the measured decrease **1,593→1,309**,
exactly **281 restore bytes + 3 dead jump bytes**. Fresh complete cost vector is 1,309 code + 1,024
asset + 4,822 padding + 12 startup/stub = **7,167 payload**. Reported resident RAM **7,271**, ZP
**0**, bounded hardware stack **1**, scratch **0**; startup entry **328 bytes** and snapshot
**49 bytes** remain. These are primary artifact measurements, not independent output review or
VICE qualification. The equivalent-twin code gap is now **867 bytes** if this unit qualifies;
whole-frame timing remains Unknown. The measured implementation pin is not updated while the
integrated frozen-sampler gate remains blocked. No new full checkpoint has run.

## Authorized first sampler correction and remaining boundary issue

The user explicitly approved only the `"stub"` → `"startup"` argument in the new public test;
the 12-byte expectation remains. Active root-spec hash after that exact correction is
`022af7a2626aa841fee9c1fbbb143fe17683cc2fe45727b2522c84c85fec6694`.
Reverse-substitution reproduces the initial frozen hash, proving no other byte changed.

Rerun: new compiler specifications **36/36 pass**; public suite **4 returning controls pass /
4 positives fail** at its snapshot endpoint arithmetic, 50 versus 49. Actual state remains
49 bytes (`start=9216`, exclusive `end=9265`, `size=49`). Independent sampler review and challenge
identified two inclusive-end arithmetic expressions in that same new test; see RV-001/AR-P2.
Neither has been edited or authorized. The public schema, source contract, snapshot expectation
and compiler implementation are unchanged by the proposed adapter repair. No public GREEN,
VICE run, new complete checkpoint or phase completion is claimed.

## Exact second exception, active freeze and integrated GREEN

The user selected **Approve two fixes (Recommended)** for the two named interval-adapter
expressions only: PRG slice end `+3` → `+2`, and snapshot length without the inclusive `+1`.
The 49-byte snapshot, code-only seven-byte poll and every expected value remain unchanged.
The final active root specification hash is
`081dfc2979cfe1ad5c90facb224fa37d2ea928b4f5da696e86d055971b77dfdf`.
The other three frozen hashes remain unchanged. No further oracle edit is authorized.

| Executed verification                                                                            | Actual result                                                                                                              |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Three new compiler specification files                                                           | 36/36 pass.                                                                                                                |
| New public four-profile specifications plus measured implementation cost test                    | 9/9 pass (8 specifications + 1 cost pin).                                                                                  |
| Existing poll/publication suites                                                                 | 41/41 pass; seven-byte EOR loop retained.                                                                                  |
| Serialized existing startup, source-derived 100-checkpoint trace and original frame comparison   | 3 files / 5 pass; 67.69 s total. VICE-verified / hardware-unverified.                                                      |
| New implementation controls, existing startup-selection controls and new compiler specifications | 6 files / 98 pass. Fifteen new controls include a 6,001-block finite graph and all four existing constructor policies.     |
| Existing startup/cooperative/takeover and layout controls                                        | Directed 79/79 and 54/54 earlier passes include overlapping new specifications; not summed into a fictitious corpus total. |

The implementation cost pin now records the freshly measured 1,309 compiler code bytes. All other
pins remain unchanged. Independent transformation reviews and the complete phase checkpoint are
still pending. The predecessor's green full run does not qualify this new implementation.

## Review and current checkpoint

All six independent phase lenses are clear, including the bounded oracle fix review. See
[findings](05-findings.md). Frozen install, build and typecheck pass for the current tree.
`yarn test:changed --host` has exited zero in **649.89 s**, including **247 root files / 5,161
tests**. The subsequent actual `yarn test:full` exited zero in **5,006.38 s**. The captured log
explicitly includes both `vitest.host.config.ts` and `vitest.vice.config.ts`; this is a complete
green run, not an isolated rerun replacing a failed full gate. A separate duplicate outer
`yarn test` was not launched; no gate is omitted. No compiler or test changes entered that run.

| Complete checkpoint tier        | Actual result                                                             |
| ------------------------------- | ------------------------------------------------------------------------- |
| Compiler workspace              | 245 files / 4,046 passed / 2 skipped tests.                               |
| CLI / language server / VS Code | 10 files / 70 tests; 5 / 21; 5 / 18, all pass.                            |
| Root host                       | 247 files / 5,161 tests, all pass.                                        |
| Serialized VICE                 | 130 passed files / 2,379 passed tests; existing 1 file / 4 tests skipped. |
| Command                         | `yarn test:full`, exit zero, 5,006.38 s.                                  |

The owned logs are retained only until this evidence is persisted and the local checkpoint is
prepared, then removed. No push, issue closure, physical-hardware or whole-frame parity claim.

Status-only synchronization passes targeted formatting, file-link and `git diff --check`
validation. All four active specification hashes match; reversing only the three approved public
sampler expressions reproduces the initial frozen hash. `spec/`, the expert baseline and the
expressiveness ledger remain clean. The helper counts **7/7 verified (100%)**; its nonzero exit
is the previously documented single-file mini-plan index limitation, not a failed test.

Fresh canonical public memory evidence, generation `94b42bf2-5df4-4824-9d5b-0aaea2337ae5`,
contains **55 distinct SFA bytes**, the CPU16 union `[9265, 9320)` = `[$2431, $2468)`.
The separate platform snapshot occupies `[9216, 9265)`, 49 bytes. Thus the reported resident
7271 equals loaded payload 7167 + snapshot 49 + distinct SFA 55. This is a primary ledger
measurement, not an independently measured peak under external interrupts; bounded stack 1 is
reported separately and is not a firmware-inclusive bound. No storage saving is claimed.

## Scoped deferral-expiry assessment

**Did this unit's deliverables expire any deferral's stated rationale?** The claimed missing
capability was unconditional cooperative restore emission despite a proved nonreturning,
unobserved main. That bounded gap is implemented, independently reviewed and now qualified by
the actual complete green checkpoint. Its delivery closes within the admitted class. No broader
observation or startup contract changes follow.

| Register / boundary examined                                 | Assessment and continuing owner                                                                                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| This plan AR-P1/P2 and PF-001/PA-001 handoff history         | Both exact oracle exceptions are resolved and fix-reviewed. No unresolved or orphaned deferral is created by closing this mini-plan.                                                  |
| Publication-proof AR-1–AR-10, AR-P11/12                      | Reuses the same admitted class and firmware/identity barriers. No broader interval, hardware-state or interprocedural analysis becomes approved or due merely from dead-exit removal. |
| Requirement register AR-013/AR-045; RD-08 “Won't Have”       | Normal returning restoration and deterministic `none` remain unchanged. No new mode, public analysis API, constructor family, runtime, game policy or language feature is needed.     |
| Requirement register AR-011 incremental-compilation deferral | No new measured repeated-build latency premise or need for incremental infrastructure. The bounded graph work is reviewed separately; no deferral rationale expires.                  |
| Frozen future considerations FUT-006/007/011/012/015/016     | No new label/range syntax, object-link ABI, copy recognition, image conversion or stack-free function calling model. Removing a dead JMP is not a new ABI.                            |
| FUT-017/018                                                  | No cross-statement instruction scheduling, relaxed PEEK/POKE volatility or new volatile API. All executed source effects remain.                                                      |
| Parent #168 residual                                         | The 867-byte code gap, unchanged entry-capture/storage costs and unproved equivalent whole-frame timing remain due under #168, not deferred to an unnamed future slice.               |

No requirement, frozen specification, expressiveness ledger or unrelated issue is edited by this
assessment. No next-slice plan, test or implementation entered this checkpoint. After the
green local commit, the next candidate still needs a complete operation-and-terminator use trace
and proof that unchanged observer premises cover its actual anonymous arithmetic home. A need
for a new observer theorem or wider accepted class reopens the reserved support-scope gate.
