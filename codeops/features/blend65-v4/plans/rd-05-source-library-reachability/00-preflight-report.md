# Preflight: source-library reachability prerequisite

> **Status**: PASSED — both findings resolved and independently rechecked
> **Iteration**: 2
> **Artifact**: Seven plan documents in `codeops/features/blend65-v4/plans/rd-05-source-library-reachability/`
> **Artifact SHA-256**: `1134c17e20496311f4bf28ce356bdc630f63dced9ce0a736ad51a5d6facbae02`
> **Code baseline**: `16e6d793d22f9a617cf30d82d05b55bd3f524c17`
> **Last Updated**: 2026-10-08 21:11 CEST
> **Scope mode**: strict
> **CodeOps Artifact Schema**: 1

SAME-SESSION REVIEW: the lead authored this plan. Independent bounded reviewers counter this
bias; fresh thread creation hit the runtime limit after one new auditor, so existing independent
reviewer contexts received complete new packets. No blind qualification is claimed. One auditor
accidentally read qualification summaries; those are excluded from decisive evidence.

## Codebase context and target

TypeScript 7.0.2/Node22+/Yarn1/Turbo/Vitest. Actual path: source analysis → semantic root/data
closure → ZP reservation → SFA inventory/binding → machine/layout/artifact/evidence. Export-only
callable and assignment roots exist; global consumers are separate. CLI/manifest expose no actual
library-build ABI. Proposed new helper/spec paths are deliverables, not phantom existing APIs.

Target is only the seven index/register/requirements/current-state/component/test/execution docs;
identity hashes sorted filename + NUL + exact bytes, excluding this report/continuity notes.
Context: RD-05, keyboard AR-P7, frozen Chapters3/6/8/10–12 and expert2.0.4, selected source and
public test helpers. Modification set: bounded target fixes under existing AR-P7 authority.
No sibling RD/spec/expert/old-oracle edit. Security/host-input expansion is absent. Existing
atomic fresh artifact publication is unchanged; no data format/cache migration.

## Scan coverage

| Cluster                     | Dimensions                       | Result                             |
| --------------------------- | -------------------------------- | ---------------------------------- |
| Soundness                   | 1,3,12                           | No findings                        |
| Grounding                   | 2,13 including all ten subchecks | No findings                        |
| Delivery                    | 4,5,11                           | No findings                        |
| Risk                        | 6,8,9                            | PF-001 at dimension9; others clear |
| Fit                         | 7,10                             | PF-002 at dimension7; scope clear  |
| Compiler/language domain    | Selected lens                    | No additional findings             |
| Callback concurrency domain | Selected lens                    | No additional findings             |
| Data/compatibility domain   | Selected lens                    | No findings                        |

## PF-001 — unchecked indexed places can observe cold storage 🟠 MAJOR

Location: `03-01-reachability.md:24–36`. Code evidence:
`semantic/lower-expressions.ts:274–281,299–305,458–459` represents scalar array access as
load/store with indexed SemanticPlace; `machine/lower-aggregate.ts:214–222` forms its address.
Frozen Chapter8 AR-8 (`spec/08-arrays-strings.md:228–231`) requires modulo65536 unchecked
addressing and forbids assuming runtime indices are in bounds.

An explicitly placed byte[1] indexed by an unknown word CIA counter can access every physical
byte, including a cold candidate, without a raw memory-read or place-address operation. Keeping
only the named array root is insufficient. Optional bounds checks happen later and are off by
default. Named addresses/raw peek/poke coverage do not refute the witness.

Surviving option: extend the existing conservative observer fallback to reached indexed places
and destinations; unproved footprints retain candidates, with exemptions only for proved safe
accesses. Reusing an already established range fact is viable only if actually present. A general
alias solver/pass is neither required nor authorized. Independent challenge converged on this
bounded correction: current width facts and later optional bounds checks do not establish the
earlier complete footprint. Confidence: High. Hardening: the retained placed-array witness
survives direct code/spec refutation; no existing earlier range proof was found.
Authority for the bounded correction: compiler-owned resolution under AGENTS PRIME workflow4;
existing user-approved AR-P7 scope. No risk waiver or extra machinery. **Resolved:** the
component now requires complete indexed-place footprints, conservative fallback and the new
ST-16 witness. The risk auditor directly rechecked the final digest and closed PF-001.

## PF-002 — missing exported-helper assignment witness 🟡 MINOR

Location: `07-testing-strategy.md:16`, execution task1.1.1. ST-3's generic finite indirect call
does not require main to assign a global callback before entering an exported helper which invokes
it. Current `function-targets.ts:304–316,431–450` can seed that helper with UNKNOWN_TARGET;
the existing implementation witness at `function-targets.impl.test.ts:185–195` is unexported.
All current planned test rows could miss this producer correction despite naming its code edit.

Best option: strengthen ST-3 with that exact ordinary source pattern and independently specified
successful effect/value, preserving unassigned-route negatives. No new test harness or old-oracle
exception. Confidence High; this is a concrete missing distinction, not a behavior change.
Hardening: generic indirect-call and byte-global rows do not force the exported-helper boundary.
Authority: compiler-owned test completeness under AGENTS PRIME workflow4 and accepted AR-P7.
**Resolved:** ST-3 now requires that exact exported-helper callback pattern and unchanged
unassigned-route negatives. The fit auditor directly rechecked the final digest and closed PF-002.

## Final disposition

All thirteen universal dimensions and three selected domain clusters are complete. The risk
and fit auditors independently verified the two fixes; the semantics reviewer rechecked their
callback/storage consequences and reported no additional finding. Delivery, grounding and
scope remain unchanged. Original digest `7532179898a81706bffac9c4ca07df42ed321e09ce9cb5ff99d057ca2b4088ae`
transitions to the final digest above. No critical/major finding remains open; no waiver.
The fresh implementation-blind specification author is available for execution. The temporary
continuity note is retired; this report owns the completed review record.

## Evidence limits

Final directed foundation check12/12 passes (21:12 CEST; 5.39 seconds);22 local plan links/anchors
and the exact final seven-document digest pass. Log: Git-private
`source-reachability-planning.X4uAlv/foundation-final.log`. No compiler code
or new spec tests exist yet, so output/runtime correctness remains Unknown. Expert lineage2.0.4,
content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; selected normative architecture/SFA/IL
and frozen source key `BLEND65-SPEC-4-038b70e9`. Placed-function entry concern failed refutation:
placement alone is not an established executable ABI; actual address provenance stays protected.
Known portfolio drift waits for integration, not this prerequisite. No push authority.
