# Canonical fixed-object ABI — preflight

> **CodeOps Artifact Schema**: 1
> **Verdict**: ✅ PREFLIGHT PASSED — all 3 findings resolved
> **Date**: 2026-11-06
> **Target**: Seven plan documents listed below; notes/report excluded
> **Pre-amendment target manifest SHA-256**: `148a026a52e921c69b6ab6700b8e5a2bce75da5f1d6d946636d8eff4e800f018`
> **Iteration-2 target manifest SHA-256**: `acf08c8204c780c17cad3022bfb6e09000ba3296cf30f8c9bc1e360993658ab6`
> **Scope**: strict; approved AR-P6/AR-P9; no canonical ABI implementation begun

Same-session primary authored the plan. Seven independent Astra audits cover
all thirteen dimensions and both selected domains; the primary merges findings.
Context: existing compiler, old tests, root-remediation artifacts and routing.
Those context artifacts are neither passed audit targets nor oracle-edit surfaces.

## Frozen target identity

| Document | SHA-256 |
| --- | --- |
| `00-ambiguity-register.md` | `253493a5cf75f507a715b2110b7de3417b3237c437edf08e9d0472224813174f` |
| `00-index.md` | `b450b8c7af9b471dba140aaed9997dae7d9d1e9ef36c70cc79560e58e2e2c9a0` |
| `01-requirements.md` | `1e98656c3206601ee920d921c829aa957caa0435330bf48d6d10b7e50a39e7fc` |
| `02-current-state.md` | `273fa17ce99e3b788df02de86ac555885bb5750406a6d870174a4eb97fc553e1` |
| `03-01-representation-boundary.md` | `140fdde96a21cb3a593fb94f5da39b3d93b86f126575e29cc001dc09c57a58ca` |
| `07-testing-strategy.md` | `823ff632b87fbf670943c9fad8e250dc78dd1bc4e49dfded8c854c4c7b46b344` |
| `99-execution-plan.md` | `3e672df31d44c79e4b880943cb2ac7d216174d776264697ec9b7b6f1b8c989de` |

### Iteration 2 corrected target identity

| Document | SHA-256 |
| --- | --- |
| `00-ambiguity-register.md` | `e4d137107d5142cea98abbd4922b916f61ecf7841123fd2bab71b165870eeef2` |
| `00-index.md` | `23a36e71cd7cf7bb472aa10182af1ae262886abc1c4baa75cf47213f64714df5` |
| `01-requirements.md` | `c08a0267ce6387f73447da665be8baa2100126708feff43ca984c888f210d703` |
| `02-current-state.md` | `6fcac793aa0027237ad989ac99a8fb8b3046c48998c5741f6be829f0db890609` |
| `03-01-representation-boundary.md` | `3748aca3e990fca4799a7b879d675f027b6d822191bbd2b69f27c61c78aefb05` |
| `07-testing-strategy.md` | `6512e1e2799708ab7be2ca5ff649760c0c6f28b0cd5ac9ab57a60957921f18bc` |
| `99-execution-plan.md` | `7179c9e9733df8cc319747ebf30e368a42037fdc443f3ebf42474e0389cb0573` |
| **Manifest** | `acf08c8204c780c17cad3022bfb6e09000ba3296cf30f8c9bc1e360993658ab6` |

The iteration-2 scan verifies PF-001–003 against this corrected target. The
original `148a…` identity remains the pre-amendment evidence baseline; it is not
a pass verdict and must not be cited as the corrected plan identity.

## Context and coverage

The existing fixed-result/parameter machinery can consume selected object
backing, but canonical lowering is allocation-first and lacks final-observer
metadata. Actual BASIC saves account for the failed 49/50-byte gates; they
cannot be removed without removing real pointer demand. The read-only fact
probe establishes eligibility, not physical closure or resource success.

| Cluster | Dimensions | Result |
| --- | --- | --- |
| Soundness | 1,3,12 | No findings |
| Grounding | 2,13, including ten alignment checks | Two major findings |
| Delivery | 4,5,11 | Two major findings; one duplicates grounding |
| Risk | 6,8,9 | No findings |
| Fit | 7,10 | No findings |
| Compiler/language | Source, calls, storage and final proof | No additional findings |
| Artifact compatibility | Schemas, debug, result identity, pins and publication | No additional findings |

## PF-001 — MAJOR: metadata collection also enables transformations

**Dimensions:** 2,5,13. **Merged:** PA-GR-002 and PA-DE-001.

**Target:** `03-01-representation-boundary.md:21–25,41–51`;
`99-execution-plan.md:23–24`.

Canonical `none` omits observer evidence (`services/size-selection.ts:338–351`).
Raw annotations require it (`machine/lower-memory.ts:36–65`), but final checking
requires authenticated associations in both layouts (`services/size-observer-effects.ts:789–803`,
`services/size-observer-raw-layout.ts:643–670`). Enabling it also enables shift
folding, global removal and stronger bounds (`machine/lower.ts:607–613,682–689`,
`machine/lower-bounds.ts:459–477`). Absent optimization facts are insufficient.
Both unchanged target fixtures contain raw accesses, so literal reuse either
falls back without fixing the gates or changes unrelated canonical output.

**Recommended resolution:** explicit metadata-only internal scope at the
already-approved machine/service owners. Retain authentic producer annotations;
do not reconstruct them from spans. `machine/lower-function.ts:109` can pass
the existing bounds query its prior conservative evidence value while lowering
collects metadata; `machine/lower.ts` retains old transformation guards. Verify
annotated generic instructions, demand, data and startup against the original
generic construction, and preserve optimized construction exactly.

Directly splitting the bounds consumer is viable but adds an unnecessary owner
at present. Add no `machine/lower-bounds.ts` authority unless the bounded caller
seam proves insufficient and a further exact amendment is approved.

**Ruling:** user approved application in AR-P9; plan correction applied. Iteration-2
delivery cluster recheck (`ses_e4fb7dccdffeEIZxb0IbEu5BuO`) found PF-001
**fixed in plan** with no delivery findings. Metadata-only authority, both-layout
authenticity, transform-guard preservation, the `lower-function` caller seam,
IT-7 and task ordering were verified; no `lower-bounds.ts` edit is authorized.
**Complexity:** Simplify; no new production owner.

## PF-002 — MAJOR: byte-loop/MMIO control remains unproved

**Dimensions:** 5,13. **Source:** PA-GR-001.

**Target:** `03-01-representation-boundary.md:47–51` limits final-proof work to
a reference-form assumption; AR-P6's eleven owners omit residual effects.

The unchanged acquisition fixture has a byte loop and conditional MMIO
(`test/rd05/returned-local-output.spec.test.ts:72–104`). The residual gate rejects
raw-owning multiblock bodies without induction bounds
(`services/size-observer-effects.ts:683–705`); the existing facts require a word
counter (`semantic/fixed-loop-facts.ts:209–216,312–318`). Eligible fixed backing
does not prove this independent control-flow obligation. Fabricated word facts
or empty bounds entries would weaken the oracle, not resolve the defect.

**Recommended resolution:** add only `services/size-observer-effects.ts` to the
approved owner set. Reuse its continuation machinery (`:98–189,217–299`) for a
bounded unchanged-control proof: authentic block membership/continuations in
both layouts; unchanged predicates, byte-counter initialization/update/compare
and value/flag dependencies; only separately certified ABI substitutions and
relocation differ. Preserve independent raw-byte order/count, pointer/dummy
accesses and physical envelopes. Missing proof falls back; inconsistent evidence
errors. No arbitrary ignored ranges, range facts, loop IR or general CFG engine.

A competing validator in `size-observers.ts` could avoid adding a filename but
duplicates residual admission and creates another acceptance path. It is not
the minimum-maintenance remedy. The exact owner/proof amendment needs approval.

**Ruling:** user approved exact owner/proof expansion and application in AR-P9;
plan correction applied, independent recheck pending. **Complexity:** Justified;
one additional existing owner.

## PF-003 — MAJOR: independent semantics review is absent

**Dimension:** 4. **Source:** PA-DE-002.

**Target:** `00-index.md:41–48`; `99-execution-plan.md:30`.

C-4 promises evaluation, snapshots, aliases, nested calls and unchanged source
acceptance, but delivery omits `semantics-reviewer`. Routing explicitly requires
that independent role (`codeops/agent-routing.md:55`). Oracle review is not a
later implementation semantics review; other specialists have distinct lenses.

**Recommended resolution:** add the existing role to the table and phase gate,
with semantic preservation and modern-source developer experience separately
reported. No specialist creation or compiler-surface expansion is needed.

**Ruling:** user approved application in AR-P9; role and separate semantics/DX
delivery gate added. Iteration-2 soundness cluster recheck
(`ses_e4faa08a9ffeIuXhZCoybDqO9s`) found PF-003 **fixed** with no new findings.
**Complexity:** Justified; existing required review only.

## Iteration-2 synthesis

| Cluster | Dimensions | Result |
| --- | --- | --- |
| Delivery | 4,5,11 | PASS; PF-001 and PF-002 fixed in plan; `ses_e4fb7dccdffeEIZxb0IbEu5BuO` |
| Soundness | 1,3,12 | PASS; PF-003 fixed; no new findings; `ses_e4faa08a9ffeIuXhZCoybDqO9s` |
| Risk | 6,8,9 | PASS; no new findings; `ses_e4fa9674cffeFSnIXi7eiAjhyy` |
| Grounding | 2,13 | Original PF-001/002 findings resolved by the delivery recheck against actual code; no remaining major |
| Fit | 7,10 | Pre-amendment pass; delivery recheck verified IT-7/IT-8 feasibility |
| Compiler domain | ABI/source/closure/final proof | Pre-amendment pass; residual-owner amendment reviewed by delivery/soundness |
| Artifact compatibility | Schemas, pins, rollback | Pre-amendment pass; no schema or identity change in the amendments |

All three critical/major findings are resolved. No minor finding remains open.
The corrected plan identity is `acf08…`; the pre-amendment `148a…` scan remains
the evidence baseline. This pass authorizes independent specification authoring
and the gated implementation phases; it is not an implementation or runtime result.

## Post-preflight AR-P11 owner amendment

The directed implementation proved two existing owners necessary for the
approved behavior: `services/services.ts` for the canonical object-attempt hook
and fallback comparison, and `machine/lower-aggregate.ts` for direct fixed-result
and nested-literal construction. The user approved exactly these two owners under
AR-P11; no new pass, runtime, dependency, public interface, oracle, ceiling or
hash is authorized. The original design and preflight findings remain valid.
Directed evidence after the amendment: new ABI spec41/41, unchanged
returned-local oracle20/20 and pinned identities3/3. Independent implementation
reviews and full root verification remain pending.

## Hardening and evidence limits

Independent challenger `ses_e517f5c94ffenLwhzX3KRIeljd` refutes none of the
three findings and identifies the smaller caller-side metadata seam. Confidence
is high on the findings, medium-high on metadata isolation and medium on the
control-proof remedy until real layouts close. No commands or runtime probes
were executed by reviewers. Hashes and measured facts are primary evidence.

Authority: active qualified/frozen expert2.0.4, immutable content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`, Specification4.0; bounded ABI/SFA,
interrupt and selected-machine excerpts supplied without qualification answers.
The plan is **preflight passed** at the corrected identity; specification
authoring and implementation remain future gates. No canonical ABI, resource,
native, silicon or full-root pass is established. Plan remains 0/9.
