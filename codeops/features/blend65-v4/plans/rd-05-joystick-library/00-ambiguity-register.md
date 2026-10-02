# Joystick and Bundled C64 Library — Planning Decisions

> **CodeOps Artifact Schema**: 1
> **Status**: ✅ All planning decisions and runtime exceptions through AR-P12 resolved
> **Last Updated**: 2026-10-02 06:38 UTC
> **Authority**: Approved plan-local runtime exceptions are recorded below; frozen specification and expert authority remain unchanged.

## Planning scope contract

| Boundary | Contract |
| --- | --- |
| Planning target | A bounded `blend65-v4/RD-05` joystick pilot based on R5.24/AC-19, applying the user's library-first decision. |
| Context artifacts | [Feature roadmap](../../00-roadmap.md), [RD-05](../../requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md), [RD-08](../../requirements/RD-08-optimization-and-expert-output.md), frozen Specification 4, qualified expert 2.0.1, current module/call/platform/distribution paths. |
| Modification set | This plan's seven documents and its feature-roadmap link after the planning gate. No existing requirement, `spec/`, skill, compiler, test or package change during planning. |

The user approved high-effort planning after requesting these outcomes:

- Apply library-first reasoning to joystick support.
- Ship platform-specific standard libraries as real Blend65 source included in the distribution.
- Consider a final analysis/refactoring RD if the pilot supports it; analysis must justify any refactoring.
- Update the expert skill through its qualified version/activation process after pilot evidence.

Those approvals establish product intent. They do not prove that ordinary source functions already
compile with the same cost as current intrinsics, authorize an early optimizer, or justify a broad rewrite.

## Ambiguity register

| ID | Category | Decision | Authority / recommendation | Status |
| --- | --- | --- | --- | --- |
| AR-P1 | Scope / product intent | Should ordinary platform helpers prefer shipped Blend65 source over compiler intrinsics where behavior and output are equally good? | User approved the library-first direction and included platform libraries, then approved high-effort planning. Keep required hardware semantics in the compiler; do not add gameplay policy or migrate by architectural preference alone. | ✅ Resolved |
| AR-P2 | Scope / sequencing | May this pilot establish bundled source constants/masks and correct joystick operations now, while source-function migration waits for the separately owned optimizer prerequisite? | User: "great! i approve - let's continue" in direct response to the staged-boundary recommendation. Preserve current direct operations; add no name-based fake library, slower replacement, inline syntax or early optimizer. Source-function migration stays with RD-08. | ✅ Resolved |
| AR-P3 | Public API / naming | Which source declarations belong in this pilot? | Compiler-owned choice under AGENTS.md workflow directive 4; exact API below. Retain every existing name/signature; add port 1, up/down and six source masks only. | ✅ Resolved |
| AR-P4 | Technical / integration | How do real bundled source bytes enter existing analysis, distribution and evidence? | Compiler-owned minimum-sufficient design under directive 4, independently challenged below. One fixed installed file, one shared preparation helper and additive analysis input metadata; no library framework. | ✅ Resolved |
| AR-P5 | Behavior / hardware state | What does a joystick sample promise when keyboard lines or output pins interfere? | Primary CIA/C64 semantics and R5.24: return the actual captured port byte, test active-low bits, write no device state. Do not promise isolation or complete R5.25. Exact boundary below. | ✅ Resolved |
| AR-P6 | Verification / performance | What proves the source library and direct operations work without hidden cost? | Existing project verification rule plus R5.24/AC-19/R5.50 and expert output directive; concrete obligations below. Reuse existing test/ACME/VICE paths. | ✅ Resolved |
| AR-P7 | Scope / completion | Who owns later callable-library migration, deep analysis and skill changes? | AR-P2 keeps source-function migration with RD-08 R8.19/AC-17. Pilot closeout must report evidence for the user-requested final review RD and qualified skill update, not create or activate them implicitly. | ✅ Resolved |
| AR-P8 | Test authority | May the two old exhaustive API inventories admit the three approved additional operations? | User: "Yes, approve these exact inventory additions." Add exactly `c64.input.joystickDown(byte): boolean pure`, `joystickUp(byte): boolean pure` and `readJoystick1(): byte volatile-read` to `frontend/profile.spec.test.ts` and `frontend/profile-constants.spec.test.ts`; change only the latter's title from thirty-seven to forty operations. Preserve every existing row, fixture and behavior assertion. | ✅ Resolved |
| AR-P9 | Runtime / frozen test authority | May the installed-package probe select constant bindings before asserting exactly six source masks? | User: "I approve", directly approving the narrow test correction on 2026-10-01. Add only `binding.storage === 'constant'` to the JSON probe's existing `masks` filter in `test/rd05/bundled-input-evidence.spec.test.ts`. Preserve every fixture and assertion, including the six exact values/types/SourceIds and length six. Existing functions remain exposed under AR-P3. | ✅ Resolved |
| AR-P10 | Runtime / frozen test authority | May the frozen API/output VICE setup compare stopped CPU addresses rather than checkpoint IDs? | User: "Yes, approve this exact fixture correction (Recommended)" on 2026-10-01. Change only its two stop comparisons to the already-selected addresses `0x2001` and `0x3000`, and discard the unused completion-checkpoint return value. Preserve all source fixtures and behavior/MMIO/byte/cycle/resource expectations. | ✅ Resolved |
| AR-P11 | Runtime / frozen test authority | May the API-binding case check complete signatures in the public selected-profile capability table, rather than assuming a profile binding's return-type field contains a FunctionType? | User: "I approve", directly answering the sole pending lookup-only correction. Replace only that case's unsupported FunctionType lookup with the matching `analyzed.program.profile.capabilities` row. Preserve exact parameters, return types, storage/effects and every program/behavior/cost expectation; also require the binding's resolved return type to equal the independent expected scalar type. No compiler metadata/schema change. | ✅ Resolved |
| AR-P12 | Technical (complexity escalation) / runtime test authority | The approved two-file seam cannot satisfy the frozen retained-local/predicate floors or function-owned numeric cycle evidence. What is the smallest authorized correction without adding an early optimizer or changing the return contract? | User: "I approve", directly answering the sole pending AR-P12 staging correction. Accept canonical `none` for this pilot only; preserve semantic/MMIO/accounting checks, direct-operation floors and independently measured expert references. General local/condition/layout performance remains RD-08-owned. Only the named cost blocks and cycle helper may change; no optimizer, production cycle subsystem, frozen authority or game-grade relaxation. Independent verdict: Simplify. | ✅ Resolved |

## AR-P12: Output scope and independent cost evidence

Task 2.2.3's authorized changes pass the fresh compiler build, formatting and nine unchanged
machine controls. The API/output suite now has 96 passes and 124 failures, with no setup or timeout
failure. Direct discarded and fixed-store samples have the expected body bytes, one port read and
zero SFA; their 16 remaining failures are missing function-owned numeric cycle evidence. Eight
retained-sample failures and 100 predicate-output failures expose existing local save/reload,
Boolean materialization and branch-layout costs. The four-profile semantic saved-byte and ordered
read tests pass. Evidence: `/tmp/blend65-joystick-phase2.Lkb8GS/joystick-authorized-seam.json`,
`joystick-authorized-seam.log` and `joystick-seam-controls.log`.

The authorized selector deliberately retains the sole-use and adjacency guards
(`machine/lower-register-forwarding.ts:63–106`). Local RAM homes are inventoried before lowering
(`storage/inventory.ts:424–460`, `services/services.ts:226–256`), and retained semantic values
receive separate homes (`machine/lower-state.ts:263–316`). Removing both local and temporary
homes needs proof shared with SFA, not a joystick-name special case or a later storage invention.

The public cost writer currently publishes one compiler-owned unknown whole-program cycle entry
(`services/evidence.ts:295–314`). The frozen oracle requires function-owned bounded cycles
(`test/rd05/joystick-api-output.spec.test.ts:211–229`), which cannot be supplied by the approved
two-file seam. It also budgets a one-byte RTS for main, whereas these cooperative programs end
main with a three-byte transfer to the required restoration path. The common return contract must
not be changed merely to satisfy that assumption.

There is a sequencing conflict to resolve explicitly. RD-05 R5.50 records expert deltas under
`none` as RD-08 inputs, and the qualified expert defines `none` without optional rewrite search
or a parity gate. This pilot's AR-P6 and frozen output oracle instead make several whole-local
expert bounds closeout gates. AGENTS.md's expert-output prime directive remains in force; neither
the directive nor frozen authority will be silently weakened.

Original goal: both-port, active-low, zero-abstraction-cost joystick operations and a real bundled
source library, without gameplay policy, an early inliner or broad compiler refactoring.
Extra system or support code: possible shared local/register/condition proofs before SFA and
bounded cycle-evidence production; no implementation of this machinery has begun.
Why it may be needed: the narrow existing admission fixes direct samples but cannot remove
general local homes, invert live conditions, compact branch layout or publish new cycle evidence.
Evidence: the paths and measured test results above; six public-build artifact probes in
`joystick-seam-measurements.log` confirm 27-byte retained, 33-byte branch, 55-byte negated and
37-byte escaping main intervals, with 2/2/3/3 SFA bytes respectively. These include the common
three-byte restoration transfer, not an ordinary RTS.
Smallest solution that still works: retain the approved direct-read/fixed-store seam and align
this pilot's acceptance with the staged `none` contract. Keep all behavior, polarity, volatile
access count/order, source programs, snapshot retention, interrupt/state and physical accounting
checks. Keep the retained-local, condition propagation/materialization and compact branch-layout
expert references and performance goals as explicit RD-08-owned acceptance inputs, not silent
deletions or claims of expert-grade output. Preserve the named-operation no-dispatch/no-helper/
no-extra-volatile-access gates here. Numeric costs for the bounded selected forms can be checked
from assembled instructions using the existing qualification pattern, without requiring an
unsupported function-owned public-report encoding. Account for the required restoration transfer
rather than replacing it with an RTS to satisfy the oracle.
Extra cost: the larger direction would cross local inventory/SFA, value retention, condition
lowering, branch layout and cycle reporting, with independent clobber/effect/escape/domain/debug
proofs. The smaller direction adds no production subsystem, dependency, runtime or optimizer;
it needs only the explicitly authorized test/acceptance correction and durable RD-08 ownership.
Independent verdict: Simplify — the blind challenger recommends staged-contract correction over
general local/condition/layout optimization or a reporting subsystem inside this joystick pilot.
It assessed the supplied grounded packet only and did not independently open repository files.
Direct user decision: approved smaller solution — the user said "I approve" in direct response to
the sole pending AR-P12 packet. This authorizes the named pilot-only staging/test correction, not
the larger shared optimization/report machinery. Task 2.2.3 may resume; no phase completion or
green commit is implied by approval.

Required bounded approval: amend only this pilot's acceptance so canonical `none` output may
finish RD-05 while these whole-local expert floors remain due in RD-08. This explicitly reconciles
the AGENTS.md output-floor directive for this named unoptimized pilot; it does not lower optimized
or production game-grade output requirements. Authorize only the retained-local and predicate
output-cost blocks in `joystick-api-output.spec.test.ts:460–571` to separate those future floors
from current canonical qualification, and the cycle helper at `:211–229` to use independently
measured selected-form costs rather than unsupported report ownership. Correct the RTS/common-tail
assumption in those cost blocks. Keep every semantic/runtime oracle and all other test blocks
unchanged. Preserve the expert performance targets with an explicit RD-08 owner and reconsideration
gate, not a new golden derived from current compiler output. The user has now given that direct
approval. The historical alternative was to keep the pilot open until a separately authorized
shared optimization prerequisite; it was not selected.

Execution boundary: the corrected tests will still run every existing source case. Direct discarded
and fixed-store reads retain exact byte, one-read, no-transfer, resource and zero-SFA gates. Retained
samples retain exact port/destination accesses and complete accounting, with the 9-byte/12-cycle
body and zero-SFA reference recorded rather than made an unoptimized acceptance limit. Predicate
cases retain exact masks, single zero-condition branch where applicable, no helper calls and
complete accounting. Their whole-local storage/compact-layout targets remain RD-08 inputs.
The measured main interval includes its three-byte/three-cycle transfer to restoration; common
startup/restoration remains separately charged in complete artifact/resource evidence.
Use only a closed, forward-only instruction-cost check for these small assembled fixtures, not a
CPU interpreter, new test transport or production reporting subsystem. The public whole-program
unknown remains honestly unknown. No semantic/runtime block or physical-input oracle may change.

Confidence: High for the sequencing and scope recommendation; retaining the unconditional
per-mode output floor would change the viable direction to the separate prerequisite.
Hardening: narrowed the possible shared-proof/report expansion to a staged acceptance correction.
Challenger: converged. Strongest counterargument: this is a genuine pilot-only relaxation of the
current unconditional output gate, so it is user-owned rather than a clerical fixture correction.

Additional bounded runtime evidence: all 32 physical-input cases pass sequentially across the
four profiles, including all simulated combinations, full-byte shared-line behavior, CIA1
latch/DDR preservation, caller interrupt states and independent mainline/IRQ samples.
Evidence: `joystick-narrow-runtime.json` and `.log` in the phase scratch directory.
Status is VICE-verified / hardware-unverified; neither frozen oracle blob changed.

## AR-P11 — Profile signature evidence location

Task 2.2.1 adds only the three approved capability rows and named port-B register fact. Fresh
compiler build and 39 unchanged target-profile controls pass. The directed API run has 52 passing
arity/type/unknown-name cases and four failed signature cases, one per profile. All four fail at
`test/rd05/joystick-api-output.spec.test.ts:287`: the binding's type is scalar, not FunctionType.

This is not a missing signature or incorrect argument admission. Existing profile bindings retain
their return type at `frontend/profile-bindings.ts:22–26`; the complete signature is retained
separately at `:149–159`. The public `TypedProgram.profile` exposes the selected capability table
(`frontend/service.ts:49–51`, `frontend/profile.ts:25–33`). The frozen source-language contract
requires exact callable signatures, not a specific binding metadata encoding. Reworking the shared
compiler representation only to satisfy the test would be unrelated scope.

The smallest correction changes only the unsupported signature block in the existing API-binding
case. Keep its source program, successful-analysis assertion, exact storage and operation effects.
Replace the FunctionType-kind assertion/guard and parameter/return lookup with:

```ts
const capability = analyzed.program.profile?.capabilities.find(
  (candidate) => candidate.name === `c64.input.${operation.name}`,
);
expect(capability?.parameters).toEqual(
  read ? [] : [{ kind: "scalar", name: "byte" }],
);
expect(capability?.returnType).toEqual({
  kind: "scalar", name: read ? "byte" : "boolean",
});
expect(binding?.type).toEqual({ kind: "scalar", name: read ? "byte" : "boolean" });
```

Every signature value remains independently specified, not copied from the compiler. The binding's
actual resolved return type is additionally proved. Preserve every other case, all source fixtures,
Boolean/MMIO/resource expectations and assembly/cost floors. No new API, helper, framework,
optimizer or compiler schema is proposed. Frozen blob
`fea1b92b5a92961ca32c87631e8323592bb78eb7` is the pre-correction frozen identity.
Evidence: `/tmp/blend65-joystick-phase2.Lkb8GS/api-signatures-green.log` (52 pass, 4 fixture
failures), `api-declarations-build.log` and `target-profiles-green.log` (39 pass).
The user explicitly approved the lookup-only correction. The same binding-presence guard remains
without its unsupported FunctionType-kind condition, preserving strict typing of the unchanged
effect assertion. No program, parameter/return value, storage/effect or output-cost expectation
changed. Corrected frozen blob: `537e0d4d10db5b7937ee70da11db9ef54ab8f03a`; SHA-256:
`e69bb863a743144398355f92f738844b4bb11a4bbc1938216d243efb5519904a`.
The inverse-block proof reproduces the prior blob exactly. All 56 four-profile API cases and
isolated strict types pass; no other test block changed.

## AR-P10 — VICE stop address versus checkpoint identity

The independent physical-input authoring run exposed four fixture-control failures, excluded from
RED: `waitForStop()` returned `12032` (`$2F00`, the correct CPU stop address), while the new
unfrozen helper compared it with checkpoint ID `1`. The allowed external monitor resolves the
stopped event's two-byte CPU address at `test/m1/vice-monitor.ts:359`. The
[official stopped-event contract](https://vice-emu.sourceforge.io/vice_13.html)
likewise carries PC; checkpoint identities arrive in separate checkpoint responses.

The earlier frozen API/output fixture repeats that setup assumption at
`test/rd05/joystick-api-output.spec.test.ts:255` and `:260`. Its current blob
`0fa623d4d4192608b070b353d6ad629b1161e853` is the original frozen identity. The missing APIs had
prevented these runtime paths from reaching the setup assertion;
their existing assertion RED remains genuine, but makes no runtime claim.

The smallest correction is exactly three lines: compare the first stop with `0x2001`, compare
completion with `0x3000`, and call `setExecuteCheckpoint(0x3000)` without binding its unused
return value. Keep the entry checkpoint ID solely for deleting that checkpoint. This repairs
host setup, not source semantics, the compiler, monitor behavior, any cost floor or feature
expectation. Changing the existing monitor to return IDs instead would break its established
address contract and is not viable.

The user explicitly approved that exact correction on 2026-10-01. The corrected frozen blob is
`fea1b92b5a92961ca32c87631e8323592bb78eb7`; SHA-256 is
`1006802dba4a1b574a9f1875ed600a7ccc9b3167dcbf81fa84b0e2c4d3ecf071`.
A read-only inverse-patch proof reproduces the original blob exactly, establishing that no other
line or expectation changed. Directed verification remains part of the two-file RED gate.
The still-unfrozen physical-input file may correct its own setup before valid RED. No larger
mechanism is authorized by this exception.

## AR-P9 — Installed-package probe classification

The frozen probe at `test/rd05/bundled-input-evidence.spec.test.ts:33` selects every exported
`c64.input.*` binding, then the acceptance assertion at line 196 requires exactly six masks.
That selection also includes the four retained direct functions (`readJoystick2` and fire/left/right
predicates). Once analysis and service identity are implemented, the two package-success cases
therefore receive ten bindings despite all six exact source masks being present.

The approved contract requires six ordinary source constants and preservation of all existing
operations. Removing functions to satisfy the fixture would violate that contract. The smallest
correction is the single constant-storage predicate in the test probe, not a changed expectation,
compiler restriction, schema, API or runtime mechanism. Because the oracle was frozen after valid
RED, its correction requires explicit authority. Its original blob
`35d61b218d8170955c8ee66cbea0b9744844e0b3` remains the historical authoring identity.
The user explicitly approved the single filter correction on 2026-10-01; no assertion change is
authorized. The execution plan records its corrected frozen identity and verification.
Evidence: `/tmp/blend65-bundled-phase1.0gQxfT/evidence-green.log` (17 pass, 2 fixture-classification
failures); 41 unchanged service/artifact tests, build and targeted formatting pass.

## AR-P2 — Evidence and smallest viable direction

### Current facts

| Boundary | Evidence | Bounded conclusion |
| --- | --- | --- |
| Joystick API | `packages/compiler/src/frontend/profile.ts:242–245` | Current selected-profile declarations provide `readJoystick2` and fire/left/right predicates; port 1 and up/down are absent from this declaration inventory. |
| Direct lowering | `packages/compiler/src/machine/lower-c64.ts:395–443` | The existing read selects a hardware port access; predicate calls select masks and conditions without an ordinary source-function call. This is source inspection, not a new binary/runtime qualification. |
| Ordinary calls | `packages/compiler/src/machine/lower-call.ts:73–193` | Ordinary calls marshal parameter homes and emit `JSR`. Merely rewriting a predicate as a source function does not remove that overhead. |
| Current build boundary | `packages/compiler/src/services/services.ts:125–143`, `:165–250` | Explicit non-`none` build options are rejected. The checked pipeline has no optimizing call-expansion stage. No optimized-output claim is made. |
| Module inputs | `packages/compiler/src/frontend/modules.ts:164–176`; `packages/compiler/src/project/snapshot.ts:168–185` | Existing module resolution indexes supplied snapshot sources; source discovery currently supplies project inputs. There is no demonstrated bundled-source integration at these boundaries. |
| Distribution | `packages/compiler/package.json`, `packages/cli/package.json` | Both package file allowlists contain only `dist`; a real `.blend` library needs deliberate packaging and availability proof. |
| Existing optimization ownership | RD-08 R8.19 and AC-17; expert `references/il-and-optimization.md#optimization-modes-and-finite-frontier` | General inline/outline work is optimization, not a reason to silently redefine `none` during the joystick slice. |

**Status:** Verified partial. **Claim kind:** Fact for the inspected paths; recommendation for the
staged direction. Future library behavior, artifact bytes, runtime behavior and equal-cost
source-function expansion are not verified by this inspection.

Knowledge lineage: `skillVersion=2.0.1`, qualified content commit
`1ce4852016e2a883cf1f733c6014c45e176bfc69`;
`references/compiler-architecture.md#target-composition`,
`references/il-and-optimization.md#optimization-modes-and-finite-frontier`,
`references/c64-hardware.md#ports-and-data-direction`.
Governing authorities are Specification 4 Chapter 10 module/import rules, project product/output
policy, RD-05 R5.24/R5.50 and RD-08 R8.19. Input hardware facts route to
`MOS-6526-1981` and `CBM-C64-PRG-1982` in the expert source manifest.

### Independent challenge

One blind `design-challenger` assessed the supplied repository packet. It did not independently
open source files; this record does not claim that it did.

- **Recommended direction:** source constants/masks plus direct operations now; source-function
  migration has a separately owned optimizer prerequisite.
- **Bundling verdict:** `Simplify`. Use existing module machinery and a small explicit bundled
  inventory. A package manager, extensible framework or runtime is unnecessary.
- **Early-inlining verdict:** `Unnecessary` inside this joystick pilot. If ordinary callable
  helpers must be proved now, optimizer work becomes a separate prerequisite requiring an explicit
  scope/order decision.
- **Strongest counterargument:** a constants-only library proves distribution and constant use,
  not successful migration of ordinary function helpers.
- **Confidence:** High under the inspected `none`/call boundaries. Qualified general call
  expansion or a user-approved change in milestone ordering would change the recommendation.
- **Hardening:** the conditional source-function proposal was narrowed after inspecting the
  missing optimization prerequisite; parent and challenger converged on the staged boundary.

No early inliner, extra optimization mode, annotation, support framework or broad compiler refactoring
is included in this plan. No implementation has started. If such machinery is later proposed,
its exact scope/cost requires the applicable complexity and authority gates.

## AR-P3 — Exact source API

Keep `c64.input` and its existing four operations. Add `readJoystick1(): byte` with a
`volatile-read` effect and `joystickUp(byte): boolean` / `joystickDown(byte): boolean` with
pure effects. Both reads are zero-argument; predicates consume a saved byte, never sample a port.
All four currently qualified cooperative C64 profiles expose the same declarations; unqualified
targets retain E10279. Normal name, arity and type validation remains authoritative.

The real source file is `packages/compiler/stdlib/c64/input.blend`, declaring module `c64.input`.
It exports only byte constants: `joystickUpMask = 1`, `joystickDownMask = 2`,
`joystickLeftMask = 4`, `joystickRightMask = 8`, `joystickFireMask = 16` and
`joystickControlsMask = 31`. These are ordinary parsed Blend65 declarations, not TypeScript
profile constants or source functions backed secretly by special name matching. No register
address, keyboard policy, runtime global, input object or gameplay helper is added.

## AR-P4 — Smallest bundled-source integration

Preserve `loadProject`'s root-contained user inventory, exact user SourceIds and snapshot hash.
Admit the library only after selecting one of the four qualified C64 profiles; target-neutral
analysis and rejected profiles gain no C64 library. Prepare one internal analysis view after user
overlays and before module discovery; each selected analysis request reads/adds the fixed library once.
Reuse this boundary for synchronous, asset-aware
and overlay analysis. Parser/analyzer internals receive immutable source records, not host loading
or a new resolver. The installed path is fixed relative to the compiler package; no user search
path, network fetch, generator, registry, cache, watcher or dependency is introduced.

Expose additive `AnalysisResult.inputs` metadata with readonly `sources` and `inputSha256` for the
actual analysis inventory. Build/debug evidence consumes that inventory rather than rereading
the library or omitting it. Factor/reuse the existing versioned input-hash tuple; do not alter
the root-loader tuple or include absolute installation paths in portable hashes. Overlay analysis
still leaves the supplied snapshot untouched; its returned analysis inputs describe the effective
text. An unavailable library returns an error result with the successfully admitted input inventory,
no program and no fallback implementation.

Use logical library SourceId `@blend65/stdlib/c64/input.blend`; while an exact user SourceId
already occupies it, prepend another `@`. Preserve all user IDs, sort the combined inventory by
the existing UTF-8 byte ordering and retain the true installed path only as `resolvedPath`.
This relative logical ID satisfies current evidence-path rules without a schema change. Module
identity still comes from the `module` header. Normal Chapter 10 merging/duplicate rules apply;
do not seal `c64.input` or reserve a user's filename.

The LSP uses returned inputs to map bundled diagnostic/related spans to the fixed installed file
URI. If a diagnostic's primary is in the admitted bundled source, display it at the first related
open user location in the compiler's related-location order; if none exists, display it as a
project-level diagnostic on the triggering user document if still open, otherwise the first
remaining admitted open user document in the existing open-document map order. If no user document
remains open, publish nothing. Preserve and clearly label the
exact installed primary and every original related location. Compiler ordering, codes, messages
and spans remain unchanged; ordinary user-primary diagnostics retain their own exact ranges.
Aggregate each open document's diagnostics before publication, including any fallback, so neither
overwrites the other; publish cleared results after correction. Keep user overlays restricted to
the original known project sources; the library is not an editable project overlay. This adds
import/typechecking visibility, not navigation/completion or other RD-09 capabilities. Frontend
exports still cannot reach backend/artifact/tool stages.

Add `stdlib` to the compiler package's existing file allowlist; dependents keep their existing
public imports and external compiler dependency. Qualify an actual tarball outside the checkout.
No VSIX packager currently exists, so this pilot adds none and makes no VSIX-release claim.
Missing/unreadable installed source uses `PROJECT_READ_FAILED`; malformed UTF-8 uses
`PROJECT_INVALID_UTF8`; the library read uses the existing per-source byte ceiling and
`PROJECT_HOST_LIMIT`. Bound allocation before reading; do not reduce existing user source/file
budgets to accommodate one trusted additional file.
Normal source diagnostics apply after parsing. Messages expose no native exception, stack or
private host path; no new diagnostic code or frozen-spec edit is needed.

### Grounding and second bounded challenge

The parent inspected `frontend/service.ts:481–509`, `frontend/overlay.ts`,
`project/snapshot.ts:168–185,238–252`, `project/types.ts`, `services/services.ts:317`,
`services/evidence.ts:378,485`, `artifacts/evidence-validation.ts:156–174`,
`packages/language-server/src/server.ts`, both editor Vite configs and package manifests.
The synchronous/async APIs share existing module machinery; service evidence and LSP maps currently
use the original user inventory. A real bundled source must reach those consumers too.

The same independent challenger assessed a second, bounded supplied-facts packet without opening
files. Verdict: **Justified**, simplified to one common preparation function. It required repeated
logical-ID collision handling and an explicit installed-file URI map. Caching, generators, VSIX
tooling, DDR analysis, setup tokens and polling abstractions are **Unnecessary**. The strongest
counterargument remains that constants prove distribution, not callable-helper migration.
**Confidence: High** for this bounded design; **Hardening:** common preparation and diagnostic
mapping tightened; **Challenger: converged**. This is ordinary feature integration, not a new
material support framework or a broadened product surface.

## AR-P5 — Physical sample and preservation boundary

`readJoystick1` reads CIA1 Port B (`$DC01`); `readJoystick2` reads Port A (`$DC00`). Return all
eight captured bits unchanged. Each named predicate means its corresponding bit in that captured
sample was zero. Neither read writes PRA, PRB, DDRA, DDRB, CIA1 control/masks, CIA2 or interrupt
state; neither predicate accesses MMIO. Separate reads are separate observations, not an atomic
two-port snapshot. Repeated/discarded volatile calls retain their source access count and order.
Port B's documented PC handshake pulse is part of the hardware read, not a software write or
a guarantee of a side-effect-free external pin operation.

For a sample to identify joystick switches independently, the five lines must be released
(input DDR or high output latch) and other connected lines must not pull them low. Keyboard keys,
a keyboard scan, low output latches and connected devices can affect the same physical lines.
The returned raw sample must reflect that interference; a pure bit test cannot infer its cause.
No hidden scan, interrupt masking, setup token or general port-state proof engine is added.
This pilot qualifies read-only behavior and stated fixture preconditions, not isolated readings
under arbitrary shared-line state. Combined input policy remains R5.25; full R5.24/AC-19 closeout
must reconcile that coexistence evidence rather than treating this pilot as all RD-05 input support.

Primary evidence: `MOS-6526-1981` printed pp.5–6 (actual pin reads, DDRs and PC handshake) in the
[MOS datasheet](https://myoldcomputer.nl/Files/mos_6526_cia.pdf); `CBM-C64-PRG-1982` printed
[p.343](https://www.devili.iki.fi/Computers/Commodore/C64/Programmers_Reference/Chapter_6/page_343.html)
and [p.344](https://www.devili.iki.fi/Computers/Commodore/C64/Programmers_Reference/Chapter_6/page_344.html)
(five shared active-low lines). Source manifest keys and expert
`c64-hardware.md#ports-and-data-direction` govern; secondary tips are not authority.

## AR-P6 — Required proof, no new verification machinery

Use specification-first cases with independent hardware/semantic values and separate assembled
output/cost expectations. Cover all 32 low-control combinations per port, all upper-bit patterns,
saved snapshots, Boolean value/control use, volatile read order/count, repeated/discarded results,
preserved DDRs/latches/unrelated bits and interference under stated fixture conditions.
Exercise all four cooperative profiles sequentially through existing VICE utilities; actual input
or pin setup belongs to the fixture and is separated from the operation's trace.
The existing `test/m1/vice-monitor.ts:634–643` already sends binary monitor joyport command
`$A2` for port 2. Add the corresponding `setJoystick1(value)` test-adapter method with port index 0
and values 0–31, keeping the existing port-2 API/behavior and five-bit validation. Port 1 also needs
opt-in I/O-simulation device activation (`-controlport1device 37`) in the existing `startVice`
utility in `test/m1/vice-runtime.ts`; existing callers retain their startup defaults. These are
small extensions of the same external-tool fixture, not another monitor client, resource API or
harness. `VICE-310-MANUAL` documents the command; `VICE-310-SOURCE` pins its emulator implementation.
Verify active device selection, port identity and polarity through actual compiled samples,
not by trusting the test adapter's name or a write to an unselected simulation buffer.

Authoring setup evidence: the pinned simulation device stores only the five supplied bits and
returns that complete byte, with its upper three bits low. It cannot prove released upper pins.
The unfrozen oracle therefore separates all-32 switch tests on device 37 from full-byte/DDR/latch
tests on explicitly disconnected devices (device 0), with compiled raw-peek controls for both.
The existing startup helper adds a default-preserving second-port flag; its new optional first-port
flag selects simulation when true, no device when false, and the old default when omitted.
No existing call changes. This is the same external-tool fixture, not another hardware API or
verification framework. The read contract remains the actual eight-bit sample, without masking.
Primary tool evidence is the pinned
[simulation implementation](https://raw.githubusercontent.com/VICE-Team/svn-mirror/4d283a2e7dd59b7e378524878e81ecc7826b700c/vice/src/joyport/joyport_io_sim.c)
and [released-device implementation](https://raw.githubusercontent.com/VICE-Team/svn-mirror/4d283a2e7dd59b7e378524878e81ecc7826b700c/vice/src/joyport/joyport.c).

Prove real source constants through ordinary imports, sync/async/overlay agreement, normal duplicate
diagnostics with visible errors and preserved installed primary/related locations in either
source-ID ordering, unchanged user snapshot/IDs, actual source
hashes in build/debug evidence, changed library-byte identity, and outside-checkout tarball use.
Test missing/corrupt library input and hostile source/module names without interpolated shell text.
Importing unused scalar masks must add no target storage, initializer, helper or emitted payload.

Direct output expectations follow expert `mos-6502-family.md` and
`6502-lowering-casebook.md#bit-operations-and-tests`: one absolute port load (3 bytes/4 nominal
CPU cycles), then only required result preservation; a branch-only bit test uses `AND #mask`
(2 bytes/2 cycles) and the correct zero branch, without a callable wrapper or materialized Boolean
home. Charge loads, saves, branch/page costs and escaping Boolean materialization separately under
the same live-value contract. Gratuitous transfers or temporary traffic are defects, not new
optimizer authorization. Correct them through existing guarded seams where proved; otherwise stop
for the needed authority and track the measured gap. A new capability below the expert local floor
cannot pass closeout. A genuine local meet needs the AGENTS.md measured path-to-beat issue.

Both joystick read producers belong in the existing register-forwarding admission for a sole-use
byte sample consumed by the next machine operation in the same block: a byte write to a fixed
address. Preserve all existing adjacency, liveness, width and destination guards; dynamic stores,
intervening machine operations, repeated uses and cross-block uses retain necessary stable storage.
Remove the redundant port-2 transfer in direct selection. Adapt only the obsolete port-2 forwarding
assertion in `machine/vic-collision.impl.test.ts`; keep its CIA exclusion and all negative guards.
This is an implementation-test correction, not an extension of AR-P8's specification-test authority.

Directed tests run during tasks. Each phase checkpoint runs `yarn install --frozen-lockfile`,
`yarn build`, `yarn typecheck`, `yarn test`, touched-file formatting, links, frozen-authority checks
and configured independent review. Report VICE-verified / hardware-unverified; physical and native
user-host release proof remain RD-10. No new runner, benchmark service or parallel emulator tier.

## AR-P7 — Follow-up ownership and expiry

Source-function migration becomes due when RD-08's qualified general inlining can remove helper
call/ABI overhead under the same semantic, effect, alias, interrupt-domain and resource obligations.
RD-08 R8.19/AC-17 owns that prerequisite; this pilot does not amend or claim it delivered.
Keep API names stable so source helpers can replace direct predicates without caller rewrites when
proved. Do not define a fake source helper or redefine `none` to make migration appear complete.

At pilot closeout, answer whether pilot evidence warrants the user-requested final platform-library
analysis/refactoring RD. If yes, recommend a bounded new RD after the existing roadmap, with a named
dependency on qualified optimization and refactoring conditional on actual defects/benefits.
Creation still uses the requirements gate. If not, record the evidence; do not invent refactoring.
The frozen expert skill update has its own semantic-version, qualification and atomic-activation
gate after evidence. Neither follow-up is an implementation task in this plan. Preserve the
deferral-expiry answer at pilot closeout and carry open owners into eventual RD-05 closeout.

## Systematic planning scan

All twelve ambiguity categories were considered. Scope/technical/integration, behavior/edge cases,
data/state, performance, naming and compatibility are resolved above. No persistent migration,
web service, authentication, network package fetch, infrastructure or secrets exist in this slice;
those categories are N/A. Input trust, source identity and deterministic evidence are concrete
security/integration duties. User docs distinguish bundled source, direct hardware primitives and
the separately owned source-function migration. The product remains a compiler, not a game engine.

Domain lenses: compiler/language; data/migration for source/API compatibility and deterministic
distributed inputs. Hardware/interrupt coexistence is a concrete C64 proof obligation, not an
authorization for a new concurrency framework.

The user has approved scope, staging and AR-P8's exact inventory exception. AGENTS.md directive 4
explicitly delegates compiler/plan technical choices and overrides default confirmation guardrails;
AR-P3–AR-P7 use that authority, not inferred silence or auto-design. No material decision remains
open. Planning may now produce executable documents; preflight and execution effort/authority
gates remain separate. This is not an implementation or frozen-authority change.
