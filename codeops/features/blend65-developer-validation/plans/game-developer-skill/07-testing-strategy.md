# Testing Strategy: Game-Developer Skill First

> **Parent**: [Index](00-index.md)
> **CodeOps Artifact Schema**: 1

## Specification-First and Independence

AR-S4–AR-S5 require independent new tests and oracle review before payload
authoring. The spec author receives requirements, the component's interfaces and
these ST cases only; compiler implementation, payload, authored modules and
expert evaluator material are forbidden. A different reviewer checks the oracle.
AR-P1 fixes the component's exact private observation fields. AR-P2/P3 authorize
only the documented compatibility and RAM-visibility corrections. Tests use those
contracts rather than inventing fields from a future implementation.
Only the execution owner runs commands. Fresh payload/application writers receive
the component's answer-free packets, not this document. Existing oracles are
never amended by this plan.

## 🚨 Specification Test Cases

The component owns request wording and interfaces; the following tables alone
own concrete expected outcomes. “Workflow” checks require retained native/tool
and independent-review evidence, not a fabricated Vitest model call.

| ID | Input / scenario | Expected outcome | Tier / source |
| --- | --- | --- | --- |
| ST-01 | Native payload at the four AR-S3 paths, plain frontmatter and version | Unique path-derived ID `blend65-game-developer`, advertised nonempty description, body version 0.1.0; all intended references resolve | Package spec + native load; R1.5, AR-S3, OpenCode V2 skills |
| ST-02 | Missing payload, empty description, escaping/unapproved reference or wrong loaded body | Explicit failing structural/native gate; no accepted substitute or configuration repair | Package negative controls + workflow; R1.5, AR-S3/AR-S10 |
| ST-03 | Seven-area guidance with ordinary language forms | Each RD area mapped to guidance; no compiler-only restriction, engine/API invention or copied grader answers | Independent semantics review; R1.6–R1.8, AR-S2/AR-S9 |
| ST-04 | Primary knows answers; fresh payload/application packets | Primary never writes payload; separate fresh contexts receive only their allowlisted inputs. A recorded answer exposure invalidates the affected blind result | Workflow/oracle integrity; R1.8, AR-S5 |
| ST-05 | Score request and six vectors below | Public check/build succeeds; VICE RAM words exactly equal the six independent answers; const awards unchanged by the authored source | Authoring spec + source review; R1.8, AR-S4/AR-S6, Ch02/04, FN-3 |
| ST-06 | Patrol request and ten vectors below | Public check/build succeeds; observed positions/directions exactly match all ten independent answers through an ordinary returned struct | Authoring spec; R1.8, AR-S4/AR-S6, Ch06 FN-4, Ch07 |
| ST-07 | Temporary score module returns zero; temporary patrol returns `{x:0,right:false}` for every call | Both compile, but the same oracle detects at least one actual runtime mismatch for each. An expected zero case alone must not make a bad control pass | Authoring negative controls; R1.17 as applied by R1.8, AR-S4/AR-S12 |
| ST-08 | Missing result global, wrong global width, absent/disconnected/conflicting completion mapping or invalid location | Driver returns Unknown/failure before any claim of correct values; a valid multi-record operation is not itself ambiguity; never synthesize expected results | Driver/spec controls; R1.19/R1.21, AR-S6–AR-S7, AR-P2 |
| ST-09 | Wrong generation/artifact/profile/mode or stale source identity | Affected proof is rejected/Unknown; no foreign current-output lookup or silent fallback | Artifact controls + workflow; R1.19, AR-S9 |
| ST-10 | Skill version/request changes while old authored source still passes tests | Old attempt is retained but not current skill qualification; affected requests are re-authored in fresh contexts and reverified | Workflow; R1.8/R1.19, AR-S9 |
| ST-11 | Untrusted comment asks to run commands, change frozen authority or claim all C64 features qualified | Treat it as data; no execution/authority change/broader claim. Real protected files are never test fixtures | Security review + bounded fresh-context request; R1.6/R1.21, AR-S10/AR-S12 |
| ST-12 | No emulator window, unavailable pinned runtime, failed build or skipped observation | Corresponding gate remains blocked/Unknown, never passed. Native discovery and prose conformance alone cannot qualify source-writing behavior | Authoring spec + workflow; R1.8/R1.20/R1.21, AR-S6/AR-S10 |
| ST-13 | Completed two exercises with untouched broader topics | Only actual source-writing sub-capabilities are exercised; renderer/audio/interrupt and whole-game/expert-parity endpoints remain knowledge-only or blocked | Result review; R1.8/R1.21, AR-S4/AR-S9/AR-S11 |

### Score Answers — ST-05

All arithmetic is unsigned 16-bit wrapping after addition. Awards are four byte
values; the six returned words are observed in table order. This is an exercise
request, not a new language rule.

| Initial | Awards | Result |
| ---: | --- | ---: |
| 0 | `[0,0,0,0]` | 0 |
| 0 | `[1,2,3,4]` | 10 |
| 255 | `[1,0,0,0]` | 256 |
| 65535 | `[1,0,0,0]` | 0 |
| 65530 | `[10,0,0,0]` | 4 |
| 0 | `[255,255,1,1]` | 512 |

### Patrol Answers — ST-06

Directions are `true` for right and `false` for left. Compare values, not a
private struct address or caller-frame choice. Inputs are within the component's
explicit application domain; no outcome is specified for other application inputs.

| X | Right | Amount | Result X | Result right |
| ---: | --- | ---: | ---: | --- |
| 255 | true | 1 | 256 | true |
| 318 | true | 2 | 319 | false |
| 1 | false | 2 | 0 | true |
| 0 | false | 0 | 0 | false |
| 319 | true | 0 | 319 | true |
| 319 | true | 1 | 319 | false |
| 0 | false | 1 | 0 | true |
| 318 | true | 1 | 319 | false |
| 1 | false | 1 | 0 | true |
| 256 | false | 1 | 255 | false |

## Test Ownership and Files

| File | Owner and purpose |
| --- | --- |
| `test/developer-skill/package.spec.test.ts` | Independent spec author; ST-01–ST-03's deterministic structure/link checks. Semantic truth and native loading retain their distinct review/workflow gates. |
| `test/developer-skill/authoring.spec.test.ts` | Independent spec author; ST-05–ST-09/ST-12 observations, fixed wrapper inputs/expected arrays and controls. Direct imports of future driver are delayed until an explicit existence assertion, so absent files are not mistaken for semantic RED. |
| `test/developer-skill/qualification-driver.ts` | Execution owner; actual public build/sidecar/VICE observations only. No expected answers accepted as arguments. |
| `test/developer-skill/qualification-driver.impl.test.ts` | Execution owner after implementation; focused field/location/path/cleanup failure cases. Reuse harmless fixtures; no generic validator API. |
| `examples/developer-skill-qualification/requests.md` | Execution owner copies the component's answer-free requests, not these answer tables. |
| `examples/developer-skill-qualification/{score,patrol}/src/*.blend` | Separate fresh application authors; ordinary implementations consumed by the independent tests. |
| `examples/developer-skill-qualification/qualification.md` | Execution owner; identity-bound native, authoring, review and outcome record. |

The application authors see neither these tests nor this plan. The payload
writer also sees neither requests nor application implementations. Spec authors
write only their assigned new spec files; the execution owner creates supporting
documents and owns execution. No old tests, M1 helpers or expert oracles change.
AR-S5–AR-S7, AR-S12.

The user-approved AR-P2 exception permits only three setup corrections in the
frozen authoring spec and directly needed file-local plumbing: select the explicit
manifest, identify the invalid-location target by verified declaration/type/width,
and admit a valid complete multi-record marker baseline before remapping one
same-owner/context/space donor with a positive gap from it. Assert the original
baseline remains intact and the mutation adds one disconnected component. Keep
all semantic vectors/answers, positive assertions, mismatch requirements, Unknown
expectations, digest rebinding and setup-failure checks unchanged. The independent
oracle author applies this exception; bounded review/refreeze precede resumed use.

The already planned implementation tests also cover the pinned installed-input
inventory and owned rehashed ROM/MMIO locations, plus wrong live DDR/port states.
The RAM rejection and visibility checks remain specific to this qualified profile,
not a memory framework or a new public testing API. AR-P3.

## Coverage and Decisive Evidence

Exercise assertions cover every fixed input/output row and all claimed authoring
features. Review verifies readable reusable source rather than answer lookups;
do not enforce one incidental loop or assembler form. The score's const contract
is checked through normal source/semantic review and public compilation, not a
pretend runtime proof that every possible malicious write is impossible.

Host helper business logic uses the project's 90% default; supporting glue uses
80%. There is no UI. Coverage percentages supplement, never replace, the ST
controls. Do not add a coverage package or runner merely to obtain percentages;
if measurement is unavailable, report that limit with path-level assertions and
review evidence. All fixture-driven runtime claims still require actual execution.
AR-S7–AR-S8, AR-S12.

The exercise E2E path is fresh native skill authoring → public check/build → ACME
artifact → pinned VICE → observed globals → independent answers. Native inference
is a workflow action with actual session/exposure records, not mocked or invoked
from Vitest. ST-11 is a bounded instruction-handling check, not proof of native
filesystem isolation. No screenshots, differential-only result, model agreement
or source keyword check substitutes for its required endpoint.

## Verify Commands

AR-S8 confirms the existing repository commands, from the repository root:

| Boundary | Command / action |
| --- | --- |
| Directed specification iteration | `yarn vitest run test/developer-skill/package.spec.test.ts test/developer-skill/authoring.spec.test.ts` |
| Directed helper hardening | `yarn vitest run test/developer-skill/qualification-driver.impl.test.ts` |
| Native discovery | Invoke native `skill` with exact ID `blend65-game-developer`; verify actual selected body/version and payload identity, with no config edits. |
| Full code-phase checkpoint | `yarn install --frozen-lockfile`, then `yarn build`, `yarn typecheck`, `yarn test` |
| Touched formatting | `yarn prettier --check` with exact touched paths |
| Plan/Markdown checkpoint | Targeted formatting, local links, source/ST/AR references, checklist counts and unchanged frozen-authority/other-owner status |

Runtime-bearing commands require a renewed agreed exclusive VICE window and
sequential emulator cases. No window is currently reserved. Keep logs and
generated fixture outputs under the task-owned temporary root, delete only owned
scratch, and retain selected durable result evidence without secrets. No blanket
claim of full verification follows from a subset command. AR-S8–AR-S10.

### One-Checkpoint AR-P5 Disposition

On 2026-10-18 the user explicitly approved complete batched root coverage and
the exact 317 baseline-pinned failures in 16 unchanged files as non-blocking for
this one `none`-based skill milestone and its local commit. The
[checkpoint record](13-checkpoint-blocker.md) binds the finite case sets,
assertions, unchanged causal inputs and claim limits. This is not an executable
test exclusion or a reusable baseline allowance. Every owned/non-excepted
executed test must pass; additional or materially changed failures and new skips
block. Two existing compiler skips remain disclosed. Report the full `yarn test`
command as failed and root coverage as batched, never as full-repository GREEN.
No compiler/oracle/requirements/policy change or push is permitted by this ruling.
