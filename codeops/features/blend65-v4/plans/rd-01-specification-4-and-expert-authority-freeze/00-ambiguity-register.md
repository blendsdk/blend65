# Ambiguity Register: RD-01 Specification 4.0 and Expert Authority Freeze (plan)

> **Status**: ✅ GATE PASSED — all 6 items resolved
> **Last Updated**: 2026-09-13 01:37
> **Scope**: Plan-level decisions only. The owning RD
> (`../../requirements/RD-01-specification-4-and-expert-authority-freeze.md`) and the Blend65 v4
> requirements register own AR-001 through AR-048. Those decisions are already resolved and are not
> reopened here. This register uses `AR-P#` for decisions introduced by the implementation plan.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|---|---|---|---|---|
| AR-P1 | Scope | Confirm the planning target, context boundary, and modification set. | **Recommended:** plan only `blend65-v4/RD-01`; read the existing specification, expert skill, qualification evidence, requirements, and inherited implementation only as context; modify only this RD-01 plan folder and the required roadmap lifecycle rows during planning. Do not edit `spec/`, the expert skill, compiler packages, the parked v3 worktree, or RD-02 artifacts until a later `exec-plan` run owns those changes. Expanding into RD-02 or implementation contradicts the handoff. | User accepted the recommendation on 2026-09-13. | ✅ Resolved |
| AR-P2 | Technical (complex) | How should the large authority transition be divided into independently reviewable, green phases? | **Recommended:** eight bounded phases: (1) bootstrap/input authority and direct oracle baselines; (2) control-flow/scope/integer/array/aggregate/address semantics; (3) function values/comptime/placement/loadable/intrinsics/safety semantics; (4) C64 profiles/assets/D64, false-target removal, final Guard and diagnostic integrity; (5) normative inventory, P3→4 crosswalk, deterministic Spec 4 identity and candidate freeze; (6) expert `2.0.0` router/references/source governance and new AR-046 cases; (7) complete qualification plus independent review and qualified-content commit; (8) explicit approval, release-record binding, atomic activation, freeze proof, and deferral-expiry closeout. Five broad phases make review units unsafe; nine or more narrow phases churn shared grammar/diagnostic/Guard owners. | User accepted the recommendation on 2026-09-13. | ✅ Resolved |
| AR-P3 | Technical / testing | What is the specification-first oracle and validation mechanism for a documentation-and-skill-only RD? | **Recommended:** reuse the existing implementation-blind Markdown qualification casebooks and composed-evidence method; add only the RD-01-derived changed/new cases needed for Specification 4 and AR-046, preserve all 107 existing identities, run focused RED evaluations against the active P3/1.0.0 baseline, then qualify the candidate with direct structural/content commands and independent graders. Do not add a generalized runner, validator framework, evidence database, or compiler test package. | User accepted the recommendation on 2026-09-13. | ✅ Resolved |
| AR-P4 | Verification | Which verification boundary fills the plan's Verify lines? | **Recommended:** use the impact-based RD-01 boundary from `AGENTS.md`: touched-file Prettier; `quick_validate.py` for basic skill packaging only; separate direct set-equality, field-integrity, Markdown link/anchor, source-key, topology, identity/hash, crosswalk, Guard, diagnostic, and qualification-evidence checks; plus independent changed-surface/blast-radius review at the qualified candidate. Explicitly exclude compiler build/typecheck/lint/tests, ACME, VICE, readiness, emulator, and feasibility commands. | User accepted the recommendation on 2026-09-13. | ✅ Resolved |
| AR-P5 | Authority identity (complex) | How can every normative Specification 4 file name its own content-derived identity without making the hash self-referential? | **Recommended after independent challenge:** add `spec/00-normative-inventory.md` as the sole path/role/algorithm owner. Derive `BLEND65-SPEC-4-<64hex>` only from inventory-marked normative files in byte-sorted repo-relative path order. Require exactly one fixed identity line in each normative file; normalize only its 64-hex payload to 64 ASCII zeroes; SHA-256 each normalized file into the established GNU `<hash><two spaces><path><newline>` record; hash the ordered record stream; stamp the result and require recomputation equality. Reject duplicate, missing, undeclared, invalid-role, or out-of-tree paths. Qualification and release files name but do not enter the digest. The closeout separately records raw at-rest hashes, including stamped identity lines. | User accepted the recommendation on 2026-09-13. | ✅ Resolved |
| AR-P6 | Artifact ownership | Which exact files durably own the inventory, transition crosswalk/summary, approval, hashes, and freeze proof without creating a second semantics source? | **Recommended after independent challenge:** `spec/00-normative-inventory.md` owns normative membership and the identity algorithm; the existing discovery-only `spec/00-feature-index.md` becomes the concise retained/changed/removed navigation summary and is marked non-normative; this plan's `08-closeout.md` owns the complete P3→4 transition crosswalk, final raw hashes, approval, freeze proof, unresolved-finding result, future-target constraints, and deferral-expiry answer. The crosswalk cites exact normative destinations and is explicitly non-normative evidence. Do not create a v3→v4 migration document or duplicate the crosswalk. | User accepted the recommendation on 2026-09-13. | ✅ Resolved |

### Resolution Notes

**AR-P1:** The handoff authorizes only the RD-01 plan and explicitly reserves the compiler skeleton
for RD-02. The nested feature target is already implied by `blend65-v4/RD-01`.

**AR-P2:** This is a high-stakes plan decision. An independent design challenger recommended the
eight-phase structure after rejecting the five-phase option as too broad, the seven-phase option as
still oversized at core semantics, and the nine-to-ten-phase option as unnecessary churn. Its
strongest counterargument is that shared grammar, diagnostic, and Guard files may be touched in both
semantic phases; the plan must therefore assign disjoint ST cases and exact section ownership.

**AR-P3:** The active expert baseline already uses five implementation-blind casebooks, a coverage
matrix, focused runs, one complete isolated blind sample, independent grading, and direct content
checks. Extending that method is smaller and more auditable than introducing a new harness.

**AR-P4:** `quick_validate.py` does not prove topology, expertise, source accuracy, or behavioral
qualification. The plan must keep those claims attached to their separate direct checks.

**AR-P5:** The existing P3 method byte-sorts repo-relative paths and hashes GNU SHA-256 records, but
it hashes raw files whose identity string lives outside `spec/`. Specification 4 requires the
identity in every normative file, so the exact one-field normalization is necessary to avoid an
impossible self-hash. The challenger rejected whole-line exclusion because it would leave the
field label, prefix, format, and multiplicity outside the identity. `Confidence: high`.

**AR-P6:** Co-locating the complete crosswalk with the closeout satisfies the requirement that the
closeout contain it and avoids two mutable copies. Reusing the existing feature index preserves its
navigation role; it must never become a second semantic authority. `Confidence: high`.
