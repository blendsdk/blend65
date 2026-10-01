# Joystick and Bundled C64 Library — Planning Decisions

> **CodeOps Artifact Schema**: 1
> **Status**: ✅ GATE PASSED — scope and exact test exception approved
> **Last Updated**: 2026-10-01 15:05
> **Planning only**: No implementation or frozen-authority change is authorized by this document.

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
URI. Keep user overlays restricted to the original known project sources; the library is not an
editable project overlay. This adds import/typechecking visibility, not navigation/completion or
other RD-09 capabilities. Frontend exports still cannot reach backend/artifact/tool stages.

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
`$A2` for port 2. Add only the corresponding `setJoystick1(value)` test-adapter method, keeping
the existing port-2 API/behavior and five-bit validation. This is a small extension of the same
external-tool utility, not another monitor client or harness. `VICE-310-MANUAL` documents that
command; `VICE-310-SOURCE` pins its emulator implementation. Verify port identity and polarity
through actual compiled samples, not by trusting the test adapter's name.

Prove real source constants through ordinary imports, sync/async/overlay agreement, normal duplicate
diagnostics with correct installed related locations, unchanged user snapshot/IDs, actual source
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
