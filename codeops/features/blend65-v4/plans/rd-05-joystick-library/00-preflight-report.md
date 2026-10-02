# Preflight Report: RD-05 joystick/source-library pilot

> **Status**: ✅ PREFLIGHT PASSED — all 3 findings resolved
> **Findings**: 3 historical findings resolved (0 critical, 2 major, 1 minor); 0 remaining
> **Iteration**: 2 — bounded re-scan after approved corrections
> **Previous Iteration**: 3 findings — all resolved at plan level
> **This Iteration**: 0 new findings; PF-001 close-trigger residual corrected and rechecked
> **Artifact**: the seven planning documents in `rd-05-joystick-library/`
> **First-scan revision**: `f996849caad9d6ee7e808c76a66e33b5efb430b3`
> **Iteration-2 start revision**: `861ea0f4`; corrected target bound by the seven blobs below
> **Last Updated**: 2026-10-01
> **CodeOps Artifact Schema**: 1

⚠️ SAME-SESSION REVIEW: This plan was authored in the current conversation.
Same-agent bias risk is elevated. Independent clustered reviewers and a separate
remedy challenger reduced that risk; they do not remove it. A fresh-session or
human domain review can provide further independence.

## Audit scope and identity

The verdict applies only to the following documents. Context was not independently
passed by this review. The three approved plan corrections have been applied and
rechecked. No compiler, test, package or frozen-authority change has been applied.

| Audited document | First-scan Git blob | Passing iteration-2 Git blob |
| --- | --- | --- |
| [Ambiguity register](00-ambiguity-register.md) | `c7f2836fb5002aa0d66629967e0d9d5424e10a54` | `5dd736351bc267b56f13185ed92e9ead1406df35` |
| [Index](00-index.md) | `09ce27f66cc9e501bf3ad91cf159b060a817e86a` | `db1653cf16b6ded4c6970f84dee9a6fd92310f05` |
| [Requirements](01-requirements.md) | `3e63445d8369b891d215dc8adc0bf12fc09d6a6e` | `3e63445d8369b891d215dc8adc0bf12fc09d6a6e` |
| [Current state](02-current-state.md) | `c23baa9b2d1586de776e1b0d9fe8fc76729ca075` | `a8f7cec2dd2606a88e78f34dbaa02fc426d07758` |
| [Design](03-joystick-library.md) | `4b7ad49523797d762b341301c3c823d252127dd2` | `076be0daaa71b1e03e6a5210c35604adbb657865` |
| [Testing strategy](07-testing-strategy.md) | `cd075589a46337e020c8ee3ae9011de749f9bfbb` | `8ea3cfe938ca3de9910367333b95668b2b2e360f` |
| [Execution plan](99-execution-plan.md) | `9665b058a6412ad901501148d15a496cccfbb8fd` | `f2f695b25e2b19242ca267d531f11db3ece723e7` |

Context: `AGENTS.md`, the feature roadmap, RD-05/RD-08, frozen Specification 4.0
Chapters 2/10/14/15, and active expert baseline 2.0.1, qualified content commit
`1ce4852016e2a883cf1f733c6014c45e176bfc69`. The expert/specification identity is
`BLEND65-SPEC-4-1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf`.
Live compiler, service, editor and VICE-fixture code supplies implementation evidence,
not language or expert authority.

The authorized product baseline is unchanged: one real packaged Blend65 constants
file, fixed source preparation, both raw joystick reads, five predicates, and bounded
source/output/runtime evidence. Callable-helper migration waits for RD-08 inlining.
AR-P1–AR-P8 remain respected, including AR-P8's exact two inventory-test exceptions.

The user approved the three bounded corrections and re-scan with “Great! Proceed
further”, then explicitly confirmed effort for the named correction/re-scan task.
The authorized modification set is the seven target documents, this report and the
roadmap's derived review annotation. No portfolio update is made on this
non-integration branch. Original findings below retain their first-scan locations
and problem descriptions; the iteration-2 evidence records their corrected state.

## Codebase context and independent review

The project uses Node 22, strict TypeScript ESM, Yarn workspaces, Turbo and Vitest.
The public frontend feeds semantic/machine stages; project loading owns user inputs;
build services retain evidence; the language server publishes to open user documents.
The library must enter that existing pipeline without adding runtime helpers or a
second project/source system.

| Evidence area | Key files examined |
| --- | --- |
| Source composition and identity | `frontend/service.ts`, `frontend/overlay.ts`, `frontend/modules.ts`, `project/snapshot.ts`, `project/types.ts`, `project/reads.ts` in the compiler |
| Existing bindings and tests | `frontend/profile.ts`, both profile inventory spec tests, `profile-constants.impl.test.ts` |
| Machine output and storage | `machine/lower-c64.ts`, `lower-register-forwarding.ts`, `lower-state.ts`, `vic-collision.impl.test.ts`; semantic/global constant lowering |
| Source evidence and editor | `services/services.ts`, retained build/debug evidence and validators; `packages/language-server/src/server.ts` and its existing tests |
| Installed distribution | Compiler/editor manifests and editor external-dependency configuration |
| Runtime fixtures | `test/m1/vice-runtime.ts`, `test/m1/vice-monitor.ts`, existing profile/runtime utilities |

Five required review clusters completed: soundness (1/3/12), grounding (2/13),
delivery (4/5/11), risk (6/8/9), and fit (7/10). Two read-only agents were reused
sequentially because another fresh thread was unavailable. The lead verified and
merged their evidence. Soundness and fit reported no findings.

Both major remedies received one independent batch challenge, without the lead's
preferred options. The available completed-phase reviewer inspected the actual
authoring diff and source evidence under a bounded read-only fallback packet.
This was not a claim that the dedicated design-challenger role was available.
The challenge refined PF-001's display routing and confirmed PF-002's smaller seam.

Iteration 2 reused the same two read-only auditors for all five bounded clusters,
checked each prior fix and direct consequences, and retained the three domain lenses.
The grounding reviewer found one narrower PF-001 residual: close-triggered analysis
can retain the just-closed URI as its anchor. The existing-map fallback was clarified
within the same root/task, then directly cleared by both delivery and risk reviewers.
This did not start another full scan or add a new finding, task or support system.
There are no surviving findings or new recommendation requiring another challenger.

## Summary

Dimension counts below retain the first-scan root causes; iteration 2 leaves none open.

| # | Dimension | Findings | Highest severity |
| --- | --- | --- | --- |
| 1 | Ambiguities | 0 | — |
| 2 | Implicit assumptions | 0 | — |
| 3 | Logical contradictions | 0 | — |
| 4 | Completeness gaps | 1: PF-001 | 🟠 Major |
| 5 | Dependency issues | 0 | — |
| 6 | Feasibility concerns | 1: PF-003 | 🟡 Minor |
| 7 | Testability | 0 | — |
| 8 | Security blind spots | 0 | — |
| 9 | Edge cases | 0 | — |
| 10 | Scope creep indicators | 0 | — |
| 11 | Ordering and sequencing | 0 | — |
| 12 | Consistency | 0 | — |
| 13 | Codebase alignment | 1: PF-002 | 🟠 Major |

| Severity | Count | State |
| --- | --- | --- |
| Critical | 0 | — |
| Major | 2 | Both resolved in the plan and independently rechecked |
| Minor | 1 | Resolved in the plan and independently rechecked |
| Observation | 0 | — |

## PF-001: Installed-library errors can disappear in the editor 🟠 MAJOR

**Dimension:** 4 — Completeness gaps.

**Location:** `07-testing-strategy.md:24` (ST-9), `03-joystick-library.md:86–89`,
and `99-execution-plan.md:50` (1.2.5); related to AR-P4.

**Codebase evidence:** `packages/compiler/src/frontend/modules.ts:53–55,516,536–544`
orders declarations by UTF-8 source ID and makes the later duplicate primary.
`packages/language-server/src/server.ts:146,194–208` publishes primary diagnostics
only for matching open user sources; its anchor fallback covers null primaries only.

**Problem:** A legal user ID such as `0/override.blend` sorts before the library ID.
A duplicate exported mask then has the installed library as its primary location and
the user declaration as related evidence. Adding installed text/URI maps alone does
not publish that error. Standalone installed-source errors have the same visibility
gap. ST-9 currently requires only the related library location and can miss both.

**BEST recommendation:** Keep compiler ordering and diagnostic meaning unchanged.
Display an installed-primary error at an existing related open user location when
available; otherwise display a project-level error on the triggering open user
document. Preserve and clearly label the exact installed primary and every original
related location. Aggregate each document's diagnostics before publication so the
fallback cannot overwrite its normal errors. Extend ST-9 to cover both source-ID
orders, standalone installed parse/type errors, and clearing after correction.

A viable but less precise alternative is to display every installed-primary error
on the triggering user document. It loses the useful exact user-declaration range.
Changing module ordering was rejected: it changes ordinary language processing and
still does not solve standalone library errors. No navigation, completion, editable
library ownership or namespace reservation is needed.

**Refutation check:** A related-user display could obscure where the compiler found
the error. Retaining and labeling the original primary answers that concern without
rewriting compiler diagnostics. Existing URI mapping by itself does not answer the
publication filter shown above.

**Confidence:** High. **Hardening:** Independent challenge refined the recommendation
to prefer the precise related user location and use the anchor only as fallback.

**User decision:** Approved the recommendation and plan correction; high effort confirmed.

**Iteration-2 evidence:** AR-P4 (`00-ambiguity-register.md:130–141`), design
(`03-joystick-library.md:87–99`), ST-9 (`07-testing-strategy.md:24`) and task 1.2.5
(`99-execution-plan.md:50`) now own both duplicate orientations, standalone errors,
original installed evidence, aggregation and clearing. The closed-trigger edge is
explicit: prefer a related open user location; otherwise the trigger if still open,
then the first remaining admitted open user from the existing map; with none open,
no fallback publication. This answers `server.ts:323–329` without new state machinery.

**State:** Resolved — plan correction independently verified. The LSP implementation
and its new tests remain execution work, not delivered functionality.

## PF-002: The old port-2 read cannot meet the promised output floor 🟠 MAJOR

**Dimension:** 13 — Codebase alignment, including test impact.

**Location:** `99-execution-plan.md:87,96` (2.2.3/2.3.1),
`07-testing-strategy.md:31` (ST-16), and AR-P6's no-gratuitous-traffic contract.

**Codebase evidence:** `packages/compiler/src/machine/lower-c64.ts:395–410`
emits `LDA $DC00` followed by redundant `TAX` for port 2.
`machine/lower-register-forwarding.ts:63–70` admits collision reads, not joystick
reads. `machine/lower-state.ts:278–300` retains an unforwarded live A result in a
temporary. `machine/vic-collision.impl.test.ts:203` expressly excludes port-2
forwarding; its separate CIA exclusions remain valid.

**Problem:** Task 2.2.3 permits adding only the new read to the existing forwarding
guard, while ST-16 covers both ports. A read-only machine-stage probe of a sole-use
port-2 sample immediately stored to a fixed address produces:

```text
LDA $DC00
TAX
STA temporary
LDA temporary
STA $0400
```

Removing `TAX` alone leaves avoidable save/reload traffic. Following the task's
current wording cannot satisfy its approved expert output contract.

**BEST recommendation:** Explicitly allow both joystick-read producers through the
existing sole-use, same-block, byte, fixed-store forwarding guards. Remove the
redundant transfer at direct selection. Name the obsolete port-2 implementation-test
assertion as an allowed adaptation in 2.3.1. Keep CIA exclusions, every negative
guard, and all old specification behavior oracles unchanged. This modifies the
existing seam; it does not introduce an optimization pass.

Duplicating consumer/liveness checks inside opcode selection was considered and
rejected because those checks already exist in the guarded forwarding seam. Narrowing
qualification to port 1 contradicts the approved both-port floor.

**Refutation check:** A saved sample must survive clobbers, repeated uses and dynamic
destinations. The recommendation retains those exclusion guards and necessary
storage; it does not promise forwarding without proof.

For the demonstrated adjacent fixed store, the hand-written load/store floor is
6 bytes and 8 nominal cycles before common surrounding work. `TAX` adds 1 byte and
2 cycles. Exact temporary traffic and complete artifact costs are **Unknown** until
final RAM/ZP allocation and assembly. The probe is not ACME/VICE or shipped-library
qualification; the complete cost/behavior evidence remains an execution obligation.

**Confidence:** High. **Hardening:** Independent challenge converged on the same seam;
no recommendation change. AR-P8's spec-test exception is not expanded.

**User decision:** Approved the recommendation and plan correction; high effort confirmed.

**Iteration-2 evidence:** AR-P6, design ownership/output sections, ST-16 and tasks
2.2.3/2.3.1 now explicitly own both producers, redundant transfer removal and the
obsolete implementation assertion. CIA exclusions, adjacency/liveness/width/fixed-store
guards and AR-P8's exact specification-test exception remain unchanged. The source
evidence above was rechecked; no optimizer pass or alternate consumer analysis was added.

**State:** Resolved — plan correction independently verified. Generated-output costs
and behavior still require the separately owned execution proof.

## PF-003: Port-1 stimulus also needs device activation 🟡 MINOR

**Dimension:** 6 — Feasibility concerns.

**Location:** `02-current-state.md:24`, `00-ambiguity-register.md:198–199`,
`07-testing-strategy.md:62–63`, and `99-execution-plan.md:76` (2.1.2).

**Codebase evidence:** `test/m1/vice-runtime.ts:278–279` selects only port-2
I/O-simulation device 37. `test/m1/vice-monitor.ts:640–642` uses the existing
zero-based joyport command. Pinned VICE source shows that
[setting simulated output lines updates its buffer](https://github.com/VICE-Team/svn-mirror/blob/4d283a2e7dd59b7e378524878e81ecc7826b700c/vice/src/joyport/joyport_io_sim.c#L220),
while [port reads select the active device's read callback](https://github.com/VICE-Team/svn-mirror/blob/4d283a2e7dd59b7e378524878e81ecc7826b700c/vice/src/joyport/joyport.c#L267).

**Problem:** Adding only `setJoystick1(value)` can change a buffer that is not
connected to port 1. That is invalid runtime stimulus, not valid implementation RED.
The plan already permits a necessary small fixture extension at execution-plan
lines 108–109, so this is a bounded missing setup detail, not an architectural blocker.

**BEST recommendation:** Explicitly own opt-in `-controlport1device 37` activation
through the same `startVice` utility, preserving existing callers' defaults. Add
`vice-runtime.ts` to 2.1.2's fixture ownership alongside the matching monitor method;
keep values 0–31 and port index 0 explicit. No new transport, runner, harness or
general resource-setting API is needed.

**Refutation check:** The generic small-fixture clause allows this correction, but
the repeated “only a method” restriction can still cause a wrong setup or false RED.
Explicit ownership removes that contradiction without adding a task.

**Confidence:** High. **Hardening:** In-context evidence/alternative/refutation checks;
the minor finding did not need a separate challenger.

**User decision:** Approved the recommendation and plan correction; high effort confirmed.

**Iteration-2 evidence:** AR-P6 (`00-ambiguity-register.md:206–214`), current-state/design
ownership, fixture strategy and task 2.1.2 (`99-execution-plan.md:76`) own both index-0
injection and opt-in device-37 activation. Existing startup defaults and port-2 behavior
are preserved. The existing monitor/runtime source references were rechecked.

**State:** Resolved — plan correction independently verified. Device stimulation and
runtime qualification remain execution work; no acceptance of a known setup defect.

## Domain and simplicity checks

| Selected lens | Result and bounded obligations |
| --- | --- |
| Compiler/language | Existing module merging, scalar constant folding and no-data constant lowering support the pilot. Ordinary source functions are deliberately not migrated before qualified inlining. PF-002 prevents a premature parity claim. |
| Data/compatibility | The unchanged user-loader tuple and the derived consumed-input tuple have separate roles. Library bytes belong in compiler input evidence; installed native paths do not belong in the portable digest. No persistent schema migration is needed. PF-001 covers editor delivery of the new source origin. |
| Bounded concurrency | Immutable prepared inputs and existing editor generations handle request supersession. Source-level volatile read count/order remains required; there is no atomic two-port promise or new IRQ/port-state analyzer. Runtime proof remains Unknown until execution. |
| Simplicity | No scope-creep finding. One packaged file and existing pipeline seams are adequate. Input metadata serves analysis, build/debug evidence and diagnostics, rather than a speculative library framework. The three remedies fit the existing 21 tasks. |

Standard-first checks used actual CIA pin/DDR semantics and the port-B handshake in
the [MOS 6526 datasheet, printed pages 5–6](https://myoldcomputer.nl/Files/mos_6526_cia.pdf),
and shared keyboard/joystick lines in the Commodore programming reference
[page 343](https://www.devili.iki.fi/Computers/Commodore/C64/Programmers_Reference/Chapter_6/page_343.html)
and [page 344](https://www.devili.iki.fi/Computers/Commodore/C64/Programmers_Reference/Chapter_6/page_344.html).
Raw samples do not promise joystick-only isolation. No hidden DDR/latch writes,
keyboard scanning, CIA2/ICR reads or interrupt masking is authorized.

Adversarial checks did not treat a constants library as completed callable-helper
migration, did not infer silicon proof from VICE, and did not accept editor maps or
old output tests as evidence that their new contracts already work. Approved AR
staging and remaining RD-05 obligations are not reopened merely to broaden the pilot.

## Verification boundary and next gate

The first-scan validation and machine probe remain historical evidence, not a runtime
qualification. Iteration 2 adds the following document and independent-review checks.

| Check | Result |
| --- | --- |
| Audited identity and structural checks | Seven corrected blobs bound above; 28 target-local Markdown links/anchors; eight resolved AR rows; 18 ST rows; 21 unique ordered unchecked tasks; five selected source keys verified |
| Plan parser | Scoped plan validation passes, 0/21 started; parser “Ready” is structural, not a semantic preflight pass |
| Artifact checks | Seven target documents and this report pass targeted Prettier and local-link validation |
| Independent re-scan | All 13 dimensions covered across five clusters; three domain lenses checked; all prior corrections and the close-trigger residual verified; no new or remaining findings |
| Roadmap counter check | No feature-counter drift; the existing portfolio 1/10→4/10 drift is intentionally deferred on this non-integration branch, not silently repaired or reported as a clean global check |
| Read-only machine probe | Existing public test-support lowering reproduces PF-002's five instructions on Node 22.23.1 |
| Frozen authority | `spec/` and the active expert skill have no changes |
| Compiler/runtime execution | No new library implementation, full compiler suite, ACME assembly or VICE runtime qualification was performed in this document-only scan |

The existing checkpoint `f996849c` was pushed on the user's explicit request.
This report is a local review checkpoint; it does not authorize another push.

**Next gate:** Begin task 1.1.1 with its separate effort handoff: specification-first
authoring of `test/rd05/bundled-input-library.spec.test.ts` from ST-1–ST-5.
The passing gate binds the seven corrected blobs above; a changed target requires a
bounded check of its changed sections before execution consumes it. No further scan
is required now. RD-05 remains Executing; the pilot remains 0/21 and RD-05 closeout
is not implied. Execution has not started and no push is authorized by this pass.

## Approved runtime acceptance amendment

The preceding identities and verdict describe the original document-only scan. On 2026-10-02,
the user directly approved AR-P12 after a blind independent challenge returned Simplify.
The bounded amendment accepts canonical `none` local storage/control-flow layout for this pilot,
retains exact direct read/store and all semantic/MMIO/accounting gates, and assigns general
whole-local expert targets explicitly to RD-08. Only the new oracle's named output-cost groups
and cycle helper may change; no optimizer, production reporter, frozen authority or final
game-grade relaxation is authorized. The amended requirement/design/testing sections are checked
against that exact decision during execution and included in the independent Phase 2 review.
This is runtime authority attribution, not a claim that the original preflight audited later code.
