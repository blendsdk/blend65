# Ambiguity Register: RD-01 Specification 4.0 and Expert Authority Freeze (plan)

> **Status**: ✅ GATE PASSED — all 10 items resolved
> **Last Updated**: 2026-09-13
> **Scope**: Plan-level decisions only. The owning RD
> (`../../requirements/RD-01-specification-4-and-expert-authority-freeze.md`) and the Blend65 v4
> requirements register own AR-001 through AR-050. Those decisions are already resolved and are not
> reopened here. This register uses `AR-P#` for decisions introduced by the implementation plan.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|---|---|---|---|---|
| AR-P1 | Scope | Confirm the planning target, context boundary, and modification set. | **Recommended:** plan only `blend65-v4/RD-01`; read the existing specification, expert skill, qualification evidence, requirements, and inherited implementation only as context; modify only this RD-01 plan folder and the required roadmap lifecycle rows during planning. Do not edit `spec/`, the expert skill, compiler packages, the parked v3 worktree, or RD-02 artifacts until a later `exec-plan` run owns those changes. Expanding into RD-02 or implementation contradicts the handoff. | User accepted the recommendation on 2026-09-13. | ✅ Resolved |
| AR-P2 | Technical (complex) | How should the large authority transition be divided into independently reviewable, green phases? | **Recommended:** eight bounded phases: (1) bootstrap/input authority and direct oracle baselines; (2) control-flow/scope/integer/array/aggregate/address semantics; (3) function values/comptime/placement/loadable/intrinsics/safety semantics; (4) C64 profiles/assets/D64, false-target removal, final Guard and diagnostic integrity; (5) normative inventory, P3→4 crosswalk, deterministic Spec 4 identity and candidate freeze; (6) expert `2.0.0` router/references/source governance and new AR-046 cases; (7) complete qualification plus independent review and qualified-content commit; (8) explicit approval, release-record binding, atomic activation, freeze proof, and deferral-expiry closeout. Five broad phases make review units unsafe; nine or more narrow phases churn shared grammar/diagnostic/Guard owners. | User accepted the recommendation on 2026-09-13. | ✅ Resolved |
| AR-P3 | Technical / testing | What is the specification-first oracle and validation mechanism for a documentation-and-skill-only RD? | **Recommended:** reuse the existing implementation-blind Markdown qualification casebooks and composed-evidence method; add only the RD-01-derived changed/new cases needed for Specification 4 and AR-046, preserve all 107 existing identities, run focused RED evaluations against the active P3/1.0.0 baseline, then qualify the candidate with direct structural/content commands and independent graders. Do not add a generalized runner, validator framework, evidence database, or compiler test package. | User accepted the recommendation on 2026-09-13. | ✅ Resolved |
| AR-P4 | Verification | Which verification boundary fills the plan's Verify lines? | **Recommended:** use the impact-based RD-01 boundary from `AGENTS.md`: touched-file Prettier; `quick_validate.py` for basic skill packaging only; separate direct set-equality, field-integrity, Markdown link/anchor, source-key, topology, identity/hash, crosswalk, Guard, diagnostic, and qualification-evidence checks; plus independent changed-surface/blast-radius review at the qualified candidate. Explicitly exclude compiler build/typecheck/lint/tests, ACME, VICE, readiness, emulator, and feasibility commands. | User accepted the recommendation on 2026-09-13. | ✅ Resolved |
| AR-P5 | Authority identity (complex) | How can every normative Specification 4 file name its own content-derived identity without making the hash self-referential? | **Recommended after independent challenge:** add `spec/00-normative-inventory.md` as the sole path/role/algorithm owner. Derive `BLEND65-SPEC-4-<64hex>` only from inventory-marked normative files in byte-sorted repo-relative path order. Require exactly one fixed identity line in each normative file; normalize only its 64-hex payload to 64 ASCII zeroes; SHA-256 each normalized file into the established GNU `<hash><two spaces><path><newline>` record; hash the ordered record stream; stamp the result and require recomputation equality. Reject duplicate, missing, undeclared, invalid-role, or out-of-tree paths. Qualification and release files name but do not enter the digest. The closeout separately records raw at-rest hashes, including stamped identity lines. | User accepted the recommendation on 2026-09-13. | ✅ Resolved |
| AR-P6 | Artifact ownership | Which exact files durably own the inventory, transition crosswalk/summary, approval, hashes, and freeze proof without creating a second semantics source? | **Recommended after independent challenge:** `spec/00-normative-inventory.md` owns normative membership and the identity algorithm; the existing discovery-only `spec/00-feature-index.md` becomes the concise retained/changed/removed navigation summary and is marked non-normative; this plan's `08-closeout.md` owns the complete P3→4 transition crosswalk, final raw hashes, approval, freeze proof, unresolved-finding result, future-target constraints, and deferral-expiry answer. The crosswalk cites exact normative destinations and is explicitly non-normative evidence. Do not create a v3→v4 migration document or duplicate the crosswalk. | User accepted the recommendation on 2026-09-13. | ✅ Resolved |
| AR-P7 | Technical / complexity correction | How is the accepted simplification applied to the RD-01 plan? | Replace the eight-phase, 108-task design with five coherent phases: (1) baseline and exact semantic oracles; (2) core and closed-program language reconciliation; (3) C64/Guard/diagnostic closure plus central inventory, concise crosswalk, and digest; (4) isolated expert candidate plus impact-based qualification; (5) final review, approval, activation, freeze, deferral closeout, and roadmap. Use executable direct checks and coherent outcome tasks; add no passive test files, per-file stamps, generalized validator, full-corpus model rerun, or mechanical microtask batching. AR-P7 supersedes the mechanisms in AR-P2, AR-P3, AR-P5, and AR-P6 while retaining their scope and authority goals. | User authorized the simplification reset on 2026-09-13 and confirmed proceeding after reviewing its prevention contract. | ✅ Resolved |
| AR-P8 | Language / testing | Which exact implementation-blind trigonometry oracle feeds the lean plan? | **Recommended:** inherit AR-050's mathematical rule, representative vectors, and independently reproduced exhaustive sine fingerprints. Derive cosine through the quarter-turn relation. The plan may not derive expected values from its candidate specification or prescribe its internal algorithm. | User accepted the recommendation on 2026-09-13. | ✅ Resolved |
| AR-P9 | Technical (complexity escalation) / executable authority checks | How can RD-01 satisfy CodeOps specification-first ordering without recreating the rejected passive test bureaucracy? | Add exactly one RD-specific executable pair using the repository's existing Vitest/Node toolchain: `test/rd01-authority.spec.test.ts` for requirements-derived observable authority checks and `test/rd01-authority.impl.test.ts` for direct edge/failure checks. Organize the pair by phase, require RED or an individually justified pre-pass before each changed authority, then GREEN after it. Do not add a generalized validator, runner, schema, service, evidence database, dependency, or passive Markdown test file. Amend RD-01's allowed non-code boundary only for this pair. | User explicitly accepted the recommended bounded pair on 2026-09-13 while resolving preflight PF-001. | ✅ Resolved |
| AR-P10 | Workflow / proportionality correction | Does RD-01 need executable spec-test files merely to satisfy the generic CodeOps phase template? | No. RD-01 is a one-time authority/document transition with no compiler implementation. Use the accepted requirements as the immutable oracle, exact direct mechanical checks where possible, explicit semantic review where judgment is unavoidable, and independent review. Create no Vitest pair, grammar validator, passive test file, generalized validation framework, dependency schema, or additional phase. This explicit user instruction supersedes AR-P9 and the generic CodeOps spec-first file/RED requirement for RD-01 only; it does not weaken the plan's concrete acceptance checks or later compiler specification-test requirements. | After seeing the preflight remedies, the user explicitly directed: “DO NOT OVERCOMPLICATE OR OVERENGINEER THIS. NOW PROCEED.” on 2026-09-13. | ✅ Resolved |

### Resolution Notes

**AR-P1:** The handoff authorizes only the RD-01 plan and explicitly reserves the compiler skeleton
for RD-02. The nested feature target is already implied by `blend65-v4/RD-01`.

**AR-P2:** The original eight-phase choice is historical. AR-P7 supersedes its decomposition after
the resulting 108 tasks demonstrated disproportionate process. Shared grammar, diagnostic, and
Guard ownership is now closed once after coherent semantic groups instead of driving extra phases.

**AR-P3:** The active expert baseline's five implementation-blind casebooks remain the oracle.
AR-P7 replaces the proposed broad rerun with changed/dependent cases plus one fixed unchanged
control per casebook and all-case structural validation.

**AR-P4:** `quick_validate.py` does not prove topology, expertise, source accuracy, or behavioral
qualification. The plan must keep those claims attached to their separate direct checks.

**AR-P5:** AR-P7 removes repeated per-file identity fields. The central inventory is the sole
identity owner and is non-normative, so it does not enter its own normative-corpus digest.

**AR-P6:** Co-locating the complete crosswalk with the closeout satisfies the requirement that the
closeout contain it and avoids two mutable copies. Reusing the existing feature index preserves its
navigation role; it must never become a second semantic authority. `Confidence: high`.

**AR-P7:** The plan's own task count and preflight findings demonstrated that the original
mechanisms violated the minimum-sufficient-design rule. One independent challenger agreed that the
authority outcome remains safe with five macro-phases, a central digest, direct checks, targeted
qualification plus unchanged controls, and one final review. The user accepted that replacement.

**AR-P8:** The user accepted AR-050's exact rule and independent oracle on 2026-09-13. The plan
may not calculate expectations from candidate prose or prescribe the compiler's internal algorithm.

**AR-P9:** This is the named exception required by the CodeOps specification-first protocol. It is
bounded to two RD-specific files and the existing Vitest dependency. The user approved its exact
purpose and cost after an independent challenger confirmed that it does not restore the rejected
16 passive Markdown artifacts or create reusable machinery. AR-P10 supersedes it before any test
file is created.

**AR-P10:** The user rejected the process-only test surface after a proportionality review. The
requirements remain the immutable oracle; direct checks and independent review remain mandatory.
The Zero-Ambiguity Gate passes with all ten items resolved.
