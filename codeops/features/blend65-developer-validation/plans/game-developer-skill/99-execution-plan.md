# Execution Plan: Game-Developer Skill First

> **Parent**: [Index](00-index.md)
> **Status**: Complete — bounded skill slice; exact AR-P5 disposition, aggregate RED
> **Last Updated**: 2026-10-18 01:54 CEST
> **Progress**: 20/20 tasks (100%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement only the [requirements delta](01-requirements.md). The component owns
interfaces/protocols; the testing strategy owns ST answers; the register owns
decisions. This checklist alone owns task progress. No task here implements
Slither, changes a compiler owner or closes RD-01. AR-S1, AR-S11.

## Implementation Phases

| Phase | Title | Tasks |
| --- | --- | ---: |
| 1 | Independent expectations, isolated authoring and bounded qualification | 20 |

The twenty tasks are small source/document changes or isolated verification and
review actions. No elapsed-hour estimate or readiness beyond the plan's actual
preflight verdict is implied.

**Execution rule:** mark an implemented task `[~]` immediately with an actual
timestamp. After its stated verification passes, mark it `[x]`, then update the
Progress and Last Updated fields. Resume the first `[~]`, otherwise the first
`[ ]`. Mark a blocker `[!]` with a same-line reason. Only `[x]` counts complete.
Never duplicate task lines in summaries or maintain another progress store.
Use the git-commit skill only at coherent green checkpoints; this repository's
no-push rule and protection of unrelated work remain binding. Expected RED work
may remain uncommitted until the logical green unit is complete.

## Phase 1: Companion Skill and Independent Core-Source Proof

> **Phase baseline tree**: `71538f94c1f30e6c22213b8b8597798e4e9a1b6a` — clean tracked tree at `e715977d`; scoped safety adjustment below.
> **Lenses**: correctness, maintainability, standards, security, api-surface, concurrency
> **Reasoning**: high — independent authoring contexts and identity-bound runtime evidence

**Scope mode:** strict. Expected modifications are the two assigned new spec
files, the planned qualification driver and its implementation tests, the four
approved native skill Markdown files, the qualification requests/authored modules/
result under `examples/developer-skill-qualification/`, this plan's execution and
review records, and the feature-local roadmap. Compiler/stdlib, old oracles,
frozen authority and other owners are excluded. Portfolio cascade is deferred
on this non-integration branch.

**Baseline safety:** the stock snapshot helper executes unfiltered `git add -A`.
It was not run because it could include protected/unknown files. Tracked status
was clean at entry; the explicit future test/application paths were absent.
Review uses the recorded HEAD tree and only the assigned phase paths; unrelated
untracked paths are not discovered, read or included. This changes no deliverable
or verification endpoint.

### Step 1.1 — Specification Tests and Oracle Review

**Reference:** `03-skill-and-qualification.md` §§Independence/Acceptance;
`07-testing-strategy.md` ST-01–ST-13; AR-S2–AR-S8, AR-S12.

- [x] 1.1.1 [spec-author] Write `test/developer-skill/package.spec.test.ts` from ST-01–ST-03, including harmless malformed/missing payload controls. ✅ (completed: 2026-10-16 06:29; draft verification: 3 intended absent-payload RED, 23 packaging/control passes; formatting clean; oracle review/freeze remains 1.1.4)
- [x] 1.1.2 [spec-author] Write the fixed request/vector and public-observation assertions in `test/developer-skill/authoring.spec.test.ts` from ST-05–ST-06/ST-12; no implementation reads. ✅ (completed: 2026-10-16 07:07; both authoring cases fail at explicit missing-input assertions, no runtime launched; combined 5 intended RED/23 control passes; formatting clean)
- [x] 1.1.3 [spec-author] Add ST-07–ST-09's discriminating controls to the same new spec file without weakening the existing expected answers. ✅ (completed: 2026-10-16 08:40; exact AR-P2 exception applied independently, bounded correctness review confirms preserved expectations, strict typecheck/format pass; actual discrimination remains runtime work)
- [x] 1.1.4 Obtain an independent review of both new oracle files against the ST cases; reviewer must not be their author. Record the bounded disposition in execution notes. ✅ (completed: 2026-10-16 08:42; authorised corrected revision independently reviewed/refrozen; exact hashes and scope/exposure limits validated; artifact/runtime endpoints remain unproved)
- [x] 1.1.5 Run directed specs and record explicit absent-payload/application RED assertions; distinguish structural RED from the later semantic controls, never count a loader crash as proof. ✅ (completed: 2026-10-16 08:43; corrected freeze: 5 explicit missing-deliverable RED/23 package controls pass; 12 runtime controls deliberately unexecuted pending VICE window, not counted as passed)

**Deliverable:** independent reviewed oracles and honest initial RED evidence;
no payload or authored application exists yet.

**Verify:** directed specification command from the testing strategy; expected
assertion failures are recorded, not labelled a green checkpoint.

### Step 1.2 — Observation, Payload and Fresh Authoring

**Reference:** component §§Payload/Writer Packets/Runtime Observation/Acceptance;
ST-01–ST-12; AR-S3–AR-S10, AR-S12.

- [x] 1.2.1 Implement the public-build and validated source/global/range mapping portion of `test/developer-skill/qualification-driver.ts` from its planned interface; accept no expected values. ✅ (completed: 2026-10-16 11:16; bounded fix review, strict types/format and all ten selected malformed/binding controls pass; two actual semantic controls and identity-retaining repeat probes pass; no expected answers enter the observer)
- [x] 1.2.2 Complete the same driver's fixed-exercise VICE observation and owned `finally` teardown using unchanged M1 helpers; keep the file focused and within project size limits. ✅ (completed: 2026-10-16 11:16; bounded platform review and actual stopped VICE word/Boolean observations pass; owned teardown awaited and final x64sc check empty; additional ROM/MMIO/port implementation regressions remain 1.3.1)
- [x] 1.2.3 Obtain a renewed exclusive emulator window and run the compiled wrong-module and identity controls from ST-07–ST-09; record actual semantic mismatch/Unknown results before genuine authoring. ✅ (completed: 2026-10-16 11:23; 12 selected controls pass, 2 genuine cases unexecuted; separate probes retain exact identities; final x64sc check empty and window explicitly released at 11:16; evidence validated)
- [x] 1.2.4 Copy only the component's answer-free request sections into `examples/developer-skill-qualification/requests.md`; preserve the oracle boundary. ✅ (completed: 2026-10-16 11:25; verbatim sections/answer-free boundary/format verified; request SHA-256 recorded in execution notes)
- [x] 1.2.5 [fresh payload writer] Create `.opencode/skills/blend65-game-developer/SKILL.md` and `references/workflow-and-source.md` using the allowlisted packet, never the plan or grading inputs. ✅ (completed: 2026-10-16 11:34; fresh writer reports no forbidden exposure, router/workflow metadata/docs/format/known links pass; two references, native load and semantic/authoring qualification remain due)
- [x] 1.2.6 [same payload writer] Create `references/game-systems.md` and `references/evidence-and-boundaries.md`; cover the full guidance table without broader qualification claims. ✅ (completed: 2026-10-16 11:40; all four files formatted, all 26 package/link/negative-control cases pass, full guidance table represented; independent semantic/security review and actual skill authoring qualification remain due)
- [x] 1.2.7 Obtain independent semantics/DX and security review of the four-file payload; route general corrections to its writer without exposing exercise answers. ✅ (completed: 2026-10-16 11:45; both no-finding reviews/exposure limits, four exact payload hashes, 26 package passes and two public snippet builds verified; no native/authoring qualification inferred)
- [x] 1.2.8 Verify native discovery/loading of `blend65-game-developer` and the exact selected payload identity; report any override or permission blocker without changing configuration. ✅ (completed: 2026-10-16 11:47; native tool selected this worktree's exact router/body/version/base and references; all four payload hashes unchanged, no configuration/permission edits; source-writing qualification remains due)
- [x] 1.2.9 [fresh application author] Load the pinned skill and score request only; write `examples/developer-skill-qualification/score/src/award-math.blend` and `score.blend` without grader/plan/compiler-internal exposure. ✅ (completed: 2026-10-16 11:52; fresh native-guided author reports only assigned request/workflow/normative reads and no forbidden exposure; ordinary source/public check/build pass; actual behavior remains 1.2.11)
- [x] 1.2.10 [different fresh application author] Load the same pinned skill and patrol request only; write `examples/developer-skill-qualification/patrol/src/patrol.blend` without answers or prior attempts. ✅ (completed: 2026-10-16 11:56; distinct fresh native-guided author reports no forbidden exposure; ordinary normal-return source/public check/build pass; behavior still awaits coordinated 1.2.11)
- [x] 1.2.11 Run public check/build and directed specification tests with actual sequential VICE observations; require GREEN for every fixed answer and control, or keep the affected task blocked. ✅ (completed: 2026-10-16 12:47; 40/40 frozen feature tests pass without skips; exact genuine source/artifact/actual-value evidence retained; owned teardown complete/window released at 12:35; no broader qualification claimed)

**Deliverable:** the four-file native skill and two genuinely authored application
modules, observed through the public compiler and existing execution facilities.
Structural, native, source and runtime endpoints remain separately recorded.

**Verify:** directed specs, native load/content check and actual fresh-context
dispatch records. No silent fallback, oracle edit or stand-in author is allowed.

### Step 1.3 — Implementation Tests and Hardening

**Reference:** component §§Result/Refresh/Failure; ST-08–ST-13; AR-S8–AR-S12.

- [x] 1.3.1 Write `test/developer-skill/qualification-driver.impl.test.ts` for actual field/location/path and cleanup failure boundaries with harmless owned fixtures; no new validator framework. ✅ (completed: 2026-10-16 12:59; 12/12 hardening tests pass, strict types/format/unchanged oracle identities verified; port-response mocks/cleanup scope and unavailable numerical coverage explicitly recorded; window released)
- [x] 1.3.2 Obtain final independent correctness, source-semantics and applicable platform review of the complete phase diff, actual new oracles/applications and claimed endpoints; resolve findings through the normal ruling gate. ✅ (completed: 2026-10-16 13:21; all five scoped reviews report no findings, exact authority/exposure/ST-11 limits and unchanged code/oracles validated; full owned checkpoint and final record remain due)
- [x] 1.3.3 Run locked install, build, typecheck, complete owned tests and exact touched-file formatting with coordinated sequential emulator ownership; record full results and remaining skips honestly. ✅ (completed: 2026-10-18 01:49; exact AR-P5 disposition/provenance and 317-name/assertion receipt validated; all 265 root files accounted; fresh install/build/typecheck, strict root types, 52/52 owned tests and targeted formatting pass; no new skip/failure; aggregate remains RED, VICE released)
- [x] 1.3.4 Write `examples/developer-skill-qualification/qualification.md`, bind exact native/author/compiler/input/artifact identities and coverage limits, and record this slice's closeout/reopening obligations without closing the full RD. ✅ (completed: 2026-10-18 01:54; exact qualification/coverage/cost/refresh/owner record validated; independent docs-only closeout supplement has no findings; formatting/links/frozen guards and roadmap engine checks pass; owned diagnostic scratch/backlink removed without following links; Slither/RD remain open and aggregate RED)

**Deliverable:** reviewed, verified and identity-bound skill-slice evidence;
complete Slither and any unproved capability remain explicitly open.

**Verify:** helper hardening plus full checkpoint commands in the testing strategy;
source/identity and exposure review of the final record. Clean owned temporary
artifacts before reporting the slice complete.

## Dependencies and Stop Conditions

The steps above are sequential. Payload authoring waits for independent oracle
review and semantic controls. Application authors wait for reviewed native
payload identity. Full verification waits for actual runtime GREEN and relevant
reviews. New findings return to the normal user ruling gate; unavailable public
compiler behavior returns to its existing owner, not a source workaround.

If the payload or request changes, follow the component's refresh rules before
crediting old exercise results. If no meaningful exercise subset can be proved,
stop without declaring the skill qualified. Slither's blocked full-port plan is
not silently implemented by any task here.

## Success Boundary

All twenty marks must be verified complete, the precise skill subset must satisfy
its ST/workflow endpoints, and all required reviews/checks must pass. The feature
roadmap may report the skill milestone while retaining full-port ownership and
the RD's incomplete count. No general compiler, engine, expert-parity, other-profile,
native release-host or physical-hardware qualification follows.
