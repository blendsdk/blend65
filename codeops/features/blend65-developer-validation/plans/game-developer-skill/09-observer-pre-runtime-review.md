# Observer Pre-Runtime Review

> **Status**: Static fixes reviewed — runtime/control verification remains due
> **Date**: 2026-10-16 08:08 CEST
> **Codebase**: `e715977d` plus the uncommitted owned execution work
> **Target**: New `test/developer-skill/qualification-driver.ts`, 640 lines
> **CodeOps Artifact Schema**: 1

## User Ruling

The user explicitly selected **“Approve repairs (Recommended)”** after the five
repairs, three frozen-oracle setup areas and unchanged input/answer/rejection
boundaries were presented. AR-P2/P3 record the authority. The independent author
may apply only that exact exception; the primary owns observer/plan corrections.
One bounded major-fix review, exact refreeze and actual evidence gates remain due.

The pending wording in the first-scan sections below is historical; this ruling
authorizes repair, not a finding closure or runtime claim.

## Assessed Boundary

This is the static review before the first observer-controlled VICE run, not the
final phase review or a qualified skill. The existing M1 helpers, public compiler
interfaces and two frozen new oracles are context only. No compiler, library,
monitor, frozen authority or existing oracle has changed. No VICE window was
reserved or process launched.

Strict driver/oracle TypeScript and formatting pass. The earlier 40-case initial
RED contains 17 explicit missing-deliverable failures and 23 package/control
passes; it does not execute the new fixture setups. Those static checks did not
establish compatibility with the real public artifacts. Affected task completions
have therefore been reopened visibly, rather than preserving misleading counts.

## Independent Reviews

| Boundary | Session | Result |
| --- | --- | --- |
| Base correctness/maintainability/standards and data binding | `ses_ebcbb4566ffeSVw5PVAfZa5NJs`, Astra/high | RV-001/RV-002 major; frozen control setups share the assumptions. |
| Selected machine, runtime observation and owned teardown | `ses_ebcbae37affeOKRnsYql04ZewZ`, Astra/xhigh | TP-001 major; model/ROM/checkpoint/decoding/cleanup structure otherwise has no finding. |
| Host-input/path/capability safety | `ses_ebcba89d9ffeb1O0c7SBSgvtog`, Astra/high | No findings within freshly created fixed fixtures; not arbitrary-project filesystem isolation. |
| Consequential repair challenge | `ses_ebcb7f32cffe9AjXgzsBv9k63B`, Astra/xhigh | Converges on bounded corrections, with artifact-specific operation-entry proof. |

The challenger could not read the temporary artifact summary because native
permissions denied it. That denial was not bypassed or treated as clearance.
Its artifact assessment relies on facts supplied before that attempted read,
not independently inspected raw artifacts. The primary's build observations
below remain a distinct evidence endpoint.

## Pending Findings

| ID | Severity | Evidence / consequence | Smallest proposed correction |
| --- | --- | --- | --- |
| RV-001 | Major | Driver `:282–285` assumes human global names. The producer publishes binding keys; valid results cannot be located. Frozen invalid-location setup repeats it. | Unique verified source/declaration identity plus global kind/type/width, not emitted display names. |
| RV-002 | Major | Driver `:359–362` and frozen ambiguity setup assume one record per completion operation. Real marker emission has two adjacent instruction records. | Complete source-bound operation interval with valid ownership/reference closure, contiguity/PRG bounds and separate entry proof; disconnected ambiguity still rejects. |
| RV-003 | Major | Driver `:424–427` and frozen source-fault prebuild select a directory as `project`. Actual public check/build return `PROJECT_PATH_INVALID`, expected regular file. | Explicit `project: join(project, "blend65.json")`; no compiler/API change. |
| RV-004 | Major | Driver `:387` permits only local sources. Actual sidecars additionally contain the installed library source. | Exact local inventory plus one current library identity pin; no wildcard extra-source acceptance or directory scanning. |
| TP-001 | Major | Driver `:319–325,551` accepts any CPU-space location. `$E000` can be KERNAL ROM in the current CPU view, not result RAM. | Selected resident-RAM bounds and live DDR/port visibility at the stopped checkpoint; owned ROM/MMIO/wrong-port rejection coverage in planned implementation tests. |

All are qualification blockers, not compiler or language defects. User-owned
rulings are AR-P2/AR-P3. No correction or frozen-oracle exception is inferred
from the earlier generic request to proceed.

## Build-Only Diagnostic Evidence

The primary constructed only the existing constant-wrong test modules and fixed
wrappers under its owned temporary root. The first probes used the invalid
directory selector and failed as above. Selecting each explicit manifest then
produced successful public checks and real ACME builds. A newline-escaping error
in the primary's scratch wrapper generator was corrected in those scratch files
only; no oracle or source-authoring request changed. These are setup/artifact
observations, not successful wrong-module runtime discrimination.

| Fixture | Generation | Completion interval | Actual bytes | Public source count |
| --- | --- | --- | --- | ---: |
| Score control | `ea7d4b91-d107-4c52-9579-1602c88639de` | `$0A4B–$0A50`, half-open | `a9 0d 8d 20 d0` | 4 |
| Patrol control | `77969e3c-64c3-4cc7-af07-533bde4b009f` | `$0BF8–$0BFD`, half-open | `a9 0d 8d 20 d0` | 3 |

In each artifact two adjacent records identify one expression span, excluding
the trailing semicolon. The score expression is wrapper bytes `[578,604)` and
the patrol expression `[1092,1118)`. Supplied assembly excerpts place the final
result stores before `LDA #$0D; STA $D020`, followed by the startup-restore jump.
The source wrapper is straight-line calls/stores with one completion operation.
The complete entry/ownership proof remains a required acceptance condition, not
a general theorem that adjacency identifies an operation. Future genuinely
authored artifacts need their own proof; no permanent two-instruction shape is
imposed on source or compiler output.

The additional installed source is exactly:

`@blend65/stdlib/c64/input.blend`, 16,118 bytes, SHA-256
`d5c3129c80fea3cdc13e08edc22b53241b10f4a86cde9ef4524306baa23e29c7`.

Pinning that qualification input constrains accepted evidence but is not an
independent reread of installed bytes: both sidecars derive their inventories
from one producer snapshot. Public frontend analysis is an available alternative,
but adds another snapshot/analysis merely to avoid one fixed pin. The challenger
recommends the pin and affected-proof refresh on any compiler/library change.

| Artifact identity | Score SHA-256 | Patrol SHA-256 |
| --- | --- | --- |
| PRG | `b79e12366cffcabad51f269ad81eab9ac2e00b9a6aad416024ed493007114a89` | `15843c0741abe315924f4d01f97d633e54dc6b0fe00e2a51bab1bf7b2ffbc779` |
| Build sidecar | `08312876ae8cee53e324e22258af18e3d2b8c9b508618b776e64e5fbb81caa7a` | `aea60336fada1cb86ae986e20fc6e4147cc4d551e13b383a6f381f6052a00ea3` |
| Debug sidecar | `78bb112878edf9d4a77459c938ed9c404ae7cd073e1385789cc042a43bc84273` | `34870acbb4791ee161155d5287f21187faec9d529dbceaf8001a1c769dd95cd1` |
| Assembly | `42c91a920b74f8a8c05364ab64b7bb07a7ff50056af2a93ebb88e4815988356a` | `61c2f9e44520748b9a1a80e7a26c7078bd90befad723eb3efd53745f5a4fc2ea` |

Temporary fixture artifacts are diagnostic scratch, not a retained qualified
binary release. Identities, selected observations and the reproducing method
remain here; no runtime, full-cost or physical-hardware claim follows.

## Exact Ruling Boundary

**Recommended:** authorize the five smallest corrections above under AR-P2/P3.
Permit the independent spec author to amend only the three frozen setup areas
and directly needed file-local plumbing: explicit manifest selection, declaration-
based invalid-location selection, and a multi-record baseline plus a genuinely
disconnected ambiguity donor. Retain every input/answer/wrapper operation, semantic
mismatch, Unknown expectation, digest rebinding and setup-failure assertion.

Update the selected component/test contract accordingly, correct the existing
observer, obtain one bounded major-fix re-review, retype and refreeze the exact
oracle revision, then re-establish the applicable RED/negative-control proof.
Runtime work still needs an exclusive window. Compiler/M1 helpers/authority and
other owners stay unchanged. No new framework, support API or source workaround.

**Confidence:** high in the defects and bounded repair; operation-entry/runtime
validity remains conditional on its actual proof. **Hardening:** strengthened by
the independent challenge; no broader machinery recommended. **User ruling:**
recorded above. All five remain open until their authorized fixes verify.

## Authorized Fix and Bounded Re-Review

The independent oracle author applied only the approved three setup corrections
and directly needed file-local plumbing. File-local simplification kept the
formatted oracle below 700 lines without removing conditions or changing any
input, answer, positive assertion, mismatch requirement, Unknown expectation,
digest rebinding or setup-failure guard. The package oracle did not change.

Correctness session `ses_ebcbb4566ffeSVw5PVAfZa5NJs` performed the one bounded
major-fix re-review. It reports no findings and closes RV-001–RV-004 at the static
implementation endpoint. It explicitly checked the exact oracle exception and
preserved expectations against its initial inspection.

Platform session `ses_ebcbae37affeOKRnsYql04ZewZ` performed the one bounded TP-001
fix review. It closes the static implementation endpoint: result pieces are
resident-RAM bounded and the actual stopped CPU-port/DDR view is checked before
result reads. Tagged VICE code confirms that bank-0 peeks at `$0000/$0001` read
the processor port, not underlying RAM. Existing helpers remain unchanged.

Both reviews retain actual checkpoint arrival, semantic controls, malformed RAM/
port controls, cleanup execution and genuine authored-artifact entry proof as
unproved. Neither independently inspected the temporary raw artifacts. Their
static conclusions are not runtime, full-phase or silicon qualification.

Primary strict helper/oracle TypeScript and targeted formatting pass. Corrected
driver: 697 lines, SHA-256
`ddd314f7f30155fc889a727eded9566230fd60f18e9f397482d100bbe466654e`.
Authoring oracle: 698 lines, SHA-256
`dd085a89b1b8ad08af198f520beb30d2aa0a9fada6edfdbad4b410fe8b7f9613`.
The initial hashes/reviews above remain historical rather than being rewritten
to claim that the old setup assumptions worked.
