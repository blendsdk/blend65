# Preflight: low-byte extraction write forwarding

> **Status**: ✅ PREFLIGHT PASSED — clean scan, 0 findings
> **Iteration**: 1
> **Audit target**: `99-execution-plan.md` only
> **Audited SHA-256**: `e1048931311424269f2de66fc7a6dab7486d0502c7a24f54a099b91ec6fa2a22`
> **Baseline**: `ee9bb67d`
> **Scope**: strict
> **Last Updated**: 2026-11-17

The primary authored this mini-plan in the current session. Independent Astra contexts perform
the clustered scan; the primary owns reconciliation, authority and evidence checks. This
same-session synthesis is not an inline independent review. The plan alone is the audit target;
completed plans, source, tests and baseline generation are context, not passed artifacts.

## Codebase context

TypeScript/ESM compiler, Vitest specification/implementation tiers, ACME output and serialized VICE.
The actual handoff is existing word-byte extraction in `lower-unary.ts:538–548`, existing
retention bypass in `lower-state.ts:680–687`, existing union in `lower-function.ts:335–345`
and fixed byte store in `lower-memory.ts:472–494`, all under `packages/compiler/src/machine/`.
`byte-write-forwarding.ts` already supplies identity/use/reachability checks and one final
publication-certificate query. No new pass, runtime, state field or public API is planned.

The primary's fresh build reproduces the committed PRG hash. Semantic and raw-byte inspections
verify eight sole-use low-byte extraction/write cores, their distinct homes, exact preceding
ordinary word loads and successful unchanged nine-publication certificate. Baseline evidence and
byte cores are recorded in [verification](08-verification.md), not treated as future qualification.
The primary rechecked 27 unchanged source/oracle boundaries and the exact target hash.

## Cluster coverage

| Cluster | Dimensions | Independent session | Result |
| --- | --- | --- | --- |
| Soundness | 1 Ambiguities; 3 Contradictions; 12 Consistency | `ses_e14fc0e13ffeLLSmkcYzbcK2cZ` | No findings |
| Grounding | 2 Assumptions; 13 Alignment, all ten subchecks | `ses_e14fbd4bcffeI2d9gR4R1MgIUn` | No findings |
| Delivery | 4 Completeness; 5 Dependencies; 11 Sequencing | `ses_e14fba2e5ffegTRfWC9uz90g8k` | No findings |
| Risk | 6 Feasibility; 8 Security; 9 Edge cases | `ses_e14fac22bffeykSxe6QwP8CHnq` | No findings |
| Fit | 7 Testability; 10 Scope | `ses_e14f9f685ffe8v46Xo12JNGAJi` | No findings |
| Compiler/language | Semantics, effects, storage handoff and modern-source DX | `ses_e14f8afadffeESBDnLE4vQadvp` | No findings in semantics or DX |

The exact universal partition covers all 13 dimensions once. The additional domain cluster does
not replace them. Reviewers attempted to refute register freshness/flags, observer safety,
complete use counts, missing interfaces, frozen-test compatibility, runtime adapter feasibility
and unwanted infrastructure. The completed clusters find no surviving target defect.

## Limits and authority

Reviewers did not run shell, builds, tests or VICE. Exact hashes, fresh byte measurements and
the semantic trace remain primary-owned evidence. Grounding's external trace read was denied;
no retry or bypass followed. Authorized bounded normative excerpts supplied instruction effects,
volatile/extraction semantics and independent-oracle/accounting requirements. No qualification
cases or answer maps were supplied. Incidental historical smoke-summary exposure in routing
was disclosed and not used as current-plan evidence.

All six contexts are reconciled: zero findings, no accepted risks or oracle exceptions introduced
by this audit. The compiler-domain review independently refuted extra/cold/terminator uses,
intervening operations, foreign identity, dynamic destinations and observable capture homes
against the existing handoff. Its incidental routing-history exposure was disclosed and excluded
from authority and behavioral evidence. This is static plan review, not blind-oracle validation.
The primary's adversarial synthesis found no unsupported support surface, source restriction,
oracle authority or missing producer-to-consumer seam. Preflight passes for this plan only.
No source behavior,
existing oracle, frozen specification/expert, helper, timeout, observer proof or compiler output
has changed. Expert reported lineage: `2.0.4` /
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; source keys and normative headings are in the
target. Whole-frame timing and physical behavior remain Unknown.

## Bounded execution-entry refinement

The audited hash binds the original plan, before mutable execution metadata/task marks.
Formatting later expanded the independently authored selector specification to 573 lines.
Its exact 49 expectations were partitioned into two concern files; the existing small
source-to-closure/mutation adapter was mechanically extracted into component-local
`low-byte-write-forwarding-test-support.ts`. Only the handoff/file-organization paragraph
changed; producer, observer, semantic and acceptance contracts stayed unchanged.

The same independent fit auditor `ses_e14f9f685ffe8v46Xo12JNGAJi` rechecked that precise
plan/helper delta and returned no findings in dimensions 7/10: no new harness, runner,
analyzer or material support mechanism. The author confirms unchanged cases and reports no
forbidden exposure; executed split RED reproduces the original two intended failures/47
controls before freeze. This bounded structural recheck supplements, rather than replaces,
the original six-context scan. Subsequent execution qualification is owned by
[verification](08-verification.md), not this static preflight verdict.
