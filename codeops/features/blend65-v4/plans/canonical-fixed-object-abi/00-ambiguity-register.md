# Ambiguity Register: Canonical fixed-object ABI

> **CodeOps Artifact Schema**: 1
> **Status**: ✅ GATE PASSED — AR-P9 amendment approved; preflight fix recheck pending
> **Last Updated**: 2026-11-06
> **Planning target**: Returned-local root-suite gates owned by T-18/task1.1.6

## Planning boundary

Context includes the existing returned-local and closed-object proofs, canonical
lowering/storage closure, final observers and unchanged returned-local tests.
The proposed modification set is this standalone plan, the owning remediation
checklist/findings and derived feature roadmap. No requirement, specification,
expert authority, old test, budget or pinned artifact amendment is proposed.
Only this incremental register exists while the scope gate is closed. A complete
standalone plan and its review gates must precede any implementation.

| ID | Category | Decision | Authority | Status |
| --- | --- | --- | --- | --- |
| AR-P6 | Technical (complexity escalation), runtime | Permit the restricted canonical fixed-object ABI extension described below, rather than treating it as a small observer fix. | User selected “Approve AR-P6 (Recommended)” on2026-11-06 | ✅ Resolved |
| AR-P7 | Technical integration | Keep Direct/Original lowering; carry complete sealed object-only facts, reclose actual demand and validate against the real generic construction. No optimizer activation or unrelated parameter selection. | Technical execution of AR-P6 under the repository's compiler/plan decision directive | ✅ Resolved |
| AR-P8 | Verification and compatibility | Public interfaces, old oracles and pinned artifacts stay fixed. Independent specification-first cases, complete verification, local green commits and no automatic push. | Approved root goal, AR-P6 and repository verification commands | ✅ Resolved |
| AR-P9 | Technical (complexity amendment), runtime | Apply PF-001–003: metadata-only scope in existing owners; add only `services/size-observer-effects.ts` for bounded unchanged-control/MMIO correspondence; require existing semantics review. All prior exclusions remain. | User selected “Approve amendment (Recommended)” on2026-11-06 in the exact owner/proof question | ✅ Resolved |
| AR-P11 | Technical (scope amendment), runtime | Add only existing owners `services/services.ts` for the canonical object-attempt service hook and `machine/lower-aggregate.ts` for direct fixed-result/nested construction. No new pass, runtime, dependency, public interface, oracle/ceiling/hash or general mechanism is authorized. | User selected “Approve two owners (Recommended)” on2026-11-06 after the implementation proved the two seams necessary; ABI spec41/41, unchanged returned-local20/20 and pinned3/3 pass | ✅ Resolved |

## AR-P6 visible complexity packet

**Original goal:** qualify approved AR-P3, finish complete root remediation with
unchanged behavior/resource oracles, then finish RD-05; do not start RD-06.

**Extra system or support code:** carry the existing proof-backed fixed-object
calling convention through canonical `none` construction and its storage/final
validation boundaries. This is a cross-owner internal ABI/closure extension,
not activation of the complete optimizer bundle.

**Why it may be needed:** the unchanged ordinary test requires49 platform BSS
bytes. Actual output uses50:49 real full-startup bytes plus one saved borrowed
BASIC byte at `$03`. Acquisition requires50 including its global byte, but
actually uses53:1 global plus52 startup/borrow bytes. Its three saved borrowed
bytes also add15 bytes to both startup directions. Those bytes preserve real
caller state and must not be subtracted or omitted. The generic two-byte result
pointer necessarily borrows preserved zero page within the frozen `$02..$8F`
allocation window; the acquisition borrower also needs a generic pointer.

**Evidence:** `layout/startup.ts:77–98,282–285` charges actual preservation;
`storage/inventory.ts:413–445` requests the generic result pointer;
`machine/lower-call.ts:234–259,307–320` already consumes fixed result/parameter
backing; `storage/selection.ts:293–346,519–524,599–665` seals and projects that
representation only in its existing selected construction;
`services/size-selection.ts:328–351` retains canonical generic allocation;
`services/size-observer-borrows.ts:391–433` distinguishes its reference/candidate
contracts. Paths are relative to `packages/compiler/src/`.

The primary's read-only fact probe uses the existing derivation without changing
production selection. For the exact ordinary fixture it finds a selected result,
returned local and one caller-local origin for `Game.sample`. For acquisition it
finds the same for `Input.readInputSnapshot`; the complete `Input.savedRow`
parameter call set resolves to that same caller root and is marked stable.
Actual ordinary allocation is `$02..$03`; acquisition additionally uses
`$04..$05`. These observations establish existing fact eligibility, not a new
canonical storage/ABI proof or a passing resource result.

**Smallest solution that still works:** reuse existing unique-origin,
returned-local, early-publication and complete-call proofs only for an eligible
returned object and its same-object borrowed consumers. Keep the generic ABI on
any missing, ambiguous, escaped, asynchronous or stale proof. No smaller viable
producer repair is established. Keeping the current generic ABI is safe but
leaves the eight gates blocked; weakening preservation or costs is not viable.

**Proposed exact implementation boundary after approval and planning:** existing
`semantic/closed-object-facts.ts`, `semantic/returned-local-destination.ts`,
`storage/selection.ts`, `machine/machine-types.ts`, `machine/lower-state.ts`,
`machine/lower-call.ts`, `machine/lower-function.ts`, `machine/lower.ts`,
`services/size-selection.ts`, `services/size-observer-borrows.ts` and
`services/size-observers.ts`, plus the AR-P9-approved
`services/size-observer-effects.ts` and the AR-P11-approved
`services/services.ts` and `machine/lower-aggregate.ts`, only where this
representation crosses those owners. Reuse existing projections and consumers;
no second alias solver. Necessary focused specification/implementation
regressions use existing test tiers. Further owners or material mechanisms
reopen this gate.

**Excluded:** full Closed optimization in `none`; unrelated by-reference
specialization; fixture-name/source-hash eligibility; new pass, IR, runtime,
dependency, source restriction, public API/schema, startup policy or target
allocation window; any old-oracle, resource-ceiling, source-fixture or hash edit.
The saved fixture's ordinary borrowed queries remain byte-identical.

**Extra cost:** integration across the listed existing fact, machine, storage
and final-proof owners; independent specification-first fallback/corruption
tests; correctness, SFA/ABI, CPU/platform/output and host-cost review; full
verification. Not every allowlisted file necessarily changes. There is no new
runtime or external dependency, but internal representation maintenance is real.

**Independent verdict:** Justified as a bounded existing-machinery direction,
with explicit complexity approval required. The independent challenger found no
smaller viable producer-only remedy and rejected a global Closed-mode switch.
Confidence is high on the boundary and medium on all resource results until
actual canonical reclosure and pinned identity checks pass.

**Strongest counterexample:** a borrower called with both the returned object
and another object must not be hard-wired to the returned one. Returned-local
freshness alone also does not prove a unique destination. Require complete
unique-origin facts independently; generic fallback remains legal.

**Required qualification:** all four unchanged ordinary/acquisition gates;
multiple results/borrower origins, nested calls, indirect/escaped entries,
raw aliases, IRQ overlap, stale facts and truthful debug locations; actual
pointer-demand removal and complete SFA interference/result backing; unchanged
A/X/Y/P/SP, banking, MMIO and initializer effects; saved709, acquisition943 and
none2163 with their pinned hashes; complete `yarn test` exit zero.

**Direct user decision:** user selected “Approve AR-P6 (Recommended)” in the exact
scope question on2026-11-06. The question explicitly permits the standalone plan
and subsequent gated implementation within this recorded boundary, with generic
fallback and all tests, resource limits, preservation duties and hashes fixed.
Complete standalone planning, independent review and specification-first gates
still precede implementation; this approval is not evidence that they pass.

## AR-P9 preflight complexity amendment

The original goal and exclusions remain unchanged. PF-001–003 show two missing
proof prerequisites and one required review. Observer metadata currently also
enables folding, data removal and stronger bounds; acquisition's byte loop cannot
be proved by the existing word-loop admission. Ignoring either obligation would
leave the old gates blocked or weaken canonical semantics/validation.

The smallest remedy separates metadata from transformation authority at existing
caller/lowering seams, adds a bounded unchanged-control proof at the existing
residual-effects owner, and adds the existing semantics reviewer. This adds one
production owner to the original eleven, authentic control/ABI correspondence
and negative/invariance tests, not a general CFG engine, loop IR, range solver,
runtime or competing validator. `machine/lower-bounds.ts` remains outside scope;
an insufficient caller seam requires another exact amendment before editing it.

Evidence and recommendation hardening are owned by
[PF-001–003](00-preflight-report.md). Independent challenger
`ses_e517f5c94ffenLwhzX3KRIeljd` confirms all three findings; metadata isolation
is **Simplify**, the residual owner/proof is **Justified**, and existing required
semantics coverage is **Justified**. The rejected competing validator would
save a filename but duplicate acceptance logic. Confidence is high on the gaps,
medium-high on metadata isolation and medium on real-layout proof sufficiency.

The user approved and requested application of all three remedies, explicitly
naming `packages/compiler/src/services/size-observer-effects.ts`, by selecting
“Approve amendment (Recommended)”. All original tests, ceilings, preservation,
profiles and pinned artifacts remain fixed. Plan correction and independent
recheck precede specification authoring and implementation.

## Other discovery boundaries

The original language, source behavior, profile set, zero-page window, resource
limits and artifact identities are already fixed by the approved remediation
and immutable tests. They are not reopened. All twelve categories were checked:

| Categories | Resolution |
| --- | --- |
| Feature, scope, stakeholders | AR-P6 names the sole mechanism/exclusions; no sibling requirement or public feature changes. |
| Behavior, edge cases, data/state | Existing evaluation, unique-origin/publication proofs and generic fallback govern; ambiguous origins do not specialize. |
| Technical, integration | AR-P7 retains existing owners, complete sealed maps, projection/closure and independent final validation. |
| Security, non-functional | No new host input, tool execution, dependency or runtime; retain source/evidence identity, complete resource gates and host-cost review. |
| UX, naming | No new public option or diagnostic; internal names follow existing conventions without an additional product decision. |

AR-P7/8 implement the complete named mechanism and fixed-contract baseline
approved in AR-P6; they add no user-owned fork. Any broader machinery, ambiguous
behavior or expanded owner reopens the gate. Passed discovery is not a passing
preflight or execution claim.
