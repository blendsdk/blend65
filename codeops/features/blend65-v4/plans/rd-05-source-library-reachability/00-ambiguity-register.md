# Decisions: source-library reachability prerequisite

> **Status**: ✅ GATE PASSED — all 6 items resolved
> **Last Updated**: 2026-10-08 20:42 CEST
> **CodeOps Artifact Schema**: 1

## Boundaries and authority

Planning target: the approved [keyboard AR-P7](../rd-05-keyboard-input/00-ambiguity-register.md#ar-p7--selected-library-reachability-discovery)
prerequisite under blend65-v4/RD-05. This is not acquisition implementation or a new RD.
Context: frozen Chapters 3, 10–12; selected frontend, semantic, storage and artifact consumers;
the accepted keyboard contract. Modification set: this compact plan, the keyboard register,
feature roadmap, bounded compiler closure/metadata code and new tests. No old specification
test edits, bundled-library export changes, dependency, CLI mode, spec or expert changes.

The original complexity decision remains owned by keyboard AR-P7, including its complete
packet, independent **Justified** verdict and direct user **“I approve”** on 2026-10-08.
It is imported, not reopened or duplicated. Compiler-owned technical choices below use the
user's AGENTS.md PRIME workflow clause 4, which overrides default technical-decision prompts.
This is **not** `--auto-design`. Scope expansion and old-oracle edits still require exact authority.

| #    | Category                    | Closed question                                     | Resolution and authority                                                                                                                                                                                                                                                                                                                                                                       | Status      |
| ---- | --------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| AR-1 | Scope / approved complexity | Which prerequisite is authorized?                   | Only keyboard AR-P7's ordinary executable root/private-storage correction; imported exact approval.                                                                                                                                                                                                                                                                                            | ✅ Resolved |
| AR-2 | Behavior / integration      | Does source export create a binary entry?           | Frozen Chapter 10 defines visibility. Current builds require main; CLI/manifest/services expose no library-build ABI. Keep main, initializer, normative address and selected callback roots; remove export-only roots and their independent-entry seed in target analysis. A discovered real independent ABI reopens this item. Compiler-owned resolution.                                     | ✅ Resolved |
| AR-3 | Data / edge cases           | Which unused storage can disappear safely?          | Only explicitly private module storage with no initializer, placement, address escape or reached use. Unknown metadata, exported data, constants and explicitly requested zeropage remain. Apply before reservation/SFA/layout. Unknown or overlapping raw-memory access retains candidates; known disjoint byte/word access respects 16-bit wrapping. Compiler-owned resolution within AR-P7. | ✅ Resolved |
| AR-4 | Compatibility / failure     | What remains observable and how do failures behave? | Preserve every explicit initializer and its ordering, all reached load/store/address/destination uses, normative function addresses, handler routes and volatile effects. No new diagnostic or source restriction. Unknown proof retains data rather than rejecting source. Existing spec tests immutable, including AR-P6 until later acquisition implementation. Compiler-owned resolution.  | ✅ Resolved |
| AR-5 | Non-functional / naming     | How much machinery and cost is allowed?             | One focused semantic helper if needed to keep existing whole-program file below its size limit; optional private-visibility metadata, no new pass/framework/API. Scan definitions/uses with maps/sets, no per-global cross-product or new fixed-point solver. Runtime support cost zero; unused code/data absent; exact artifact deltas measured. Compiler-owned resolution.                   | ✅ Resolved |
| AR-6 | Verification / security     | Which proof and review gates apply?                 | Existing approved project rule: directed tests, then frozen install/build/typecheck/full Linux tests; VICE sequential. New implementation-blind spec author; independent correctness, semantics, SFA, output and host-performance review. No new input/security/host-tool boundary; immutable negative checks stay intact. Existing user-approved rule imported.                               | ✅ Resolved |

## Systematic scan

All twelve categories checked: feature, behavior and scope (AR-1/2/4); technical and
integration (AR-2/5); edge and data/state (AR-3/4); security/compliance (AR-6); non-functional
(AR-5/6); UX (AR-4, no new diagnostic); stakeholder conflict (AR-1/4, modern source and expert
output both retained); naming (AR-5, existing conventions). No hidden deferral or optional feature.

## Grounding and limits

`semantic/whole-program.ts:201–225` roots exports; `semantic/function-targets.ts:289–309`
also seeds exported functions as independent entries. `semantic/lower.ts:106–195` lacks
global visibility metadata. `services/zero-page-globals.ts:18` and `machine/lower.ts:73–98`
consume the retained global list. Frontend selection stays unchanged.

The executable API inspection includes `packages/cli/src/args.ts`, project manifest and
`services/services.ts:175–210`; frozen Chapter 10 mentions a future `--library` flag, which
this correction does not implement or redefine. Current selected platform operations have
scalar/handler inputs and fixed device/vector effects, not arbitrary source-RAM access;
operand place dependencies and callback bodies remain visible. Raw computed memory operations
are checked separately. A new opaque platform operation reopens this proof, not permission
to assume it harmless.

Confidence: Medium; a real independently callable ABI or unaccounted memory observer changes
the remedy. Hardening: include assignment-entry provenance, aggregate destinations, address
escape and raw-memory boundaries before consumers, not emitter-only pruning. Challenger:
converged for imported AR-P7; the planning run's two-challenger budget is exhausted for further
technical details. Those details add no material support surface and will receive independent
preflight/phase review. No compiler/output/runtime result is claimed yet.

Preflight PF-001 refines AR-3's conservative observer rule to cover unproved unchecked indexed
places/destinations, including locals and borrowed parameters, with complete width/stride/wrap
footprints. Independent finding-batch challenger converged on this direct extension; no new
range/alias framework or material support surface. PF-002 refines the existing indirect-call test
to require caller-assigned global callback use inside an exported helper. Both are compiler-owned
correctness/test-completeness resolutions under PRIME workflow4, not user risk waivers or new
product decisions. The approved AR-P7 boundary and immutable old-oracle rule are unchanged.

Expert lineage: `2.0.4`, content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`;
`compiler-architecture.md#information-that-cannot-be-erased-early`,
`sfa-and-abi.md#call-graph-roots-and-escape` and `#final-storage-closure`,
`il-and-optimization.md#memory-effects-and-volatility` and `#two-oracle-proof`;
source key `BLEND65-SPEC-4-038b70e9`. Finding: current export/data retention prevents the cold
source-library bound. Remedy: approved existing-closure correction. Status: Verified partial
(source inspection only); claim kind: Fact for current retention, Recommendation for remedy.
