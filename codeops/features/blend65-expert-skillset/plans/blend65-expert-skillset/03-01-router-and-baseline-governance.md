# Component Specification: Router and Baseline Governance

> **Document**: 03-01-router-and-baseline-governance.md
> **Parent**: [Index](00-index.md)
> **Owns**: `SKILL.md`, `agents/openai.yaml`, migration policy, response contract, release/errata routing

## Objective

Keep the public skill simple while making its behavior precise. `SKILL.md` is a router and a set of
shared non-negotiable directives; it is not the knowledge base. It must activate for real Blend65,
6502, and C64 compiler decisions, avoid generic TypeScript work, load only the references necessary
for the task, and make uncertainty and version-freeze behavior explicit.

## Public Identity

| Field | Required value/behavior |
|---|---|
| Folder | `.agents/skills/blend65-domain-expert/` |
| Frontmatter `name` | `blend65-domain-expert` exactly |
| Frontmatter `description` | Discriminates compiler semantics/lowering/SFA/assembly/C64 work from generic maintenance; includes concrete trigger phrases without becoming a keyword dump |
| Baseline version | `1.0.0`, declared in the body |
| Discovery | Existing implicit project-local skill discovery; no alias or second skill |
| UI metadata | `agents/openai.yaml` remains consistent with the final description and purpose |

## Router Body

The final router should stay compact and use this order:

1. baseline identity and authority relationship to CodeOps;
2. required stance: modern programmer input, expert 6502/C64 output, evidence over status claims;
3. fixed task context: language/spec version, CPU variant, machine/video model, memory/banking,
   interrupt state, tool versions, and optimization mode where material;
4. selective-loading table;
5. decision sequence;
6. required response/evidence shape;
7. anti-overengineering gate;
8. freeze and critical-errata protocol; and
9. completion bar.

The router may summarize a rule needed on every invocation. It must link to a reference instead of
duplicating topic knowledge that applies only to some tasks.

## Selective-Loading Contract

| Task signal | Required reference(s) | Conditional additions |
|---|---|---|
| Language meaning, syntax, diagnostics, expressiveness | `blend65-semantics.md` | `compiler-architecture.md` if a pipeline owner or representation changes |
| Pipeline boundary, modular backend, ownership, redesign | `compiler-architecture.md` | `sfa-and-abi.md`, `il-and-optimization.md`, or `target-portability.md` for affected seams |
| Frames, locals, calls, ABI, recursion, reentrancy, ZP, stack, interrupt reachability | `sfa-and-abi.md` | `mos-6502-family.md` for CPU stack/interrupt facts; platform module for budgets |
| IR legality, effects, pass order, optimization, proof obligations | `il-and-optimization.md` | CPU/lowering references when machine forms or flags are involved |
| Opcode, flags, addressing, cycles, 6502/6510/65C02 difference | `mos-6502-family.md` | `6502-lowering-casebook.md` when translating a language operation |
| Concrete operation lowering or assembly parity | `6502-lowering-casebook.md` and `mos-6502-family.md` | ABI, C64, ACME, or parity module according to context |
| C64 map, banking, startup, runtime ownership, loading | `c64-memory-and-runtime.md` | `acme-and-artifacts.md` for packaging; hardware module for device visibility |
| VIC-II, SID, CIA, raster, interrupt, input, timing | `c64-hardware.md` | game and memory modules for system-level behavior |
| Game loop, graphics/audio engine, streaming, data layout, zero-cost API | `c64-game-engineering.md` | relevant memory/hardware/lowering modules |
| ACME syntax/encoding/output or VICE observation boundary | `acme-and-artifacts.md` | source manifest for disputed/version-specific behavior |
| Multi-target seam or future machine feasibility | `target-portability.md` | CPU and platform modules for the concrete compared constraint |
| Status audit, parity, harness value, salvage, course correction | `evidence-parity-and-recovery.md` | every domain module traversed by the named behavior |
| Source dispute, citation, revision, known erratum | `source-manifest.md` | the dependent knowledge module |

Cross-domain tasks load the union. Narrow tasks must not require “read everything.” A substantial
compiler recovery audit is expected to traverse modules incrementally by the behaviors it audits,
not front-load all references into one context.

## Decision Sequence

Every applicable response follows this sequence:

1. Fix the contract: frozen Blend65 spec, public API, intended program behavior, CPU/machine model.
2. Fix observability: what must be equal, ordered, volatile, timed, placed, or externally visible.
3. Trace only the live path through source, semantics, SFA, IL, machine form, assembly, artifact,
   and runtime as needed.
4. Separate expressibility, semantic correctness, artifact correctness, runtime behavior, and
   parity; one green layer cannot prove another.
5. Quantify relevant resources with best/worst or path-specific values and state assumptions.
6. Compare only equivalent work and obligations.
7. Classify the finding before proposing a remedy.
8. Recommend the smallest viable remedy that preserves durable boundaries and the expert-output
   bar.
9. Name the decisive missing probe when evidence is incomplete.

## Required Response Shape

For substantial reviews, designs, diagnoses, or parity decisions, each material conclusion must
contain:

| Field | Required content |
|---|---|
| Status | `Verified complete`, `Verified partial`, `Scaffold/stub`, `Incorrect`, or `Unknown` |
| Claim kind | `Fact`, `Inference`, `Unknown`, or `Recommendation` |
| Context | Spec baseline, CPU, machine/video variant, banking/interrupt/tool assumptions that can alter the result |
| User-visible capability | The source program or game behavior being judged |
| Evidence | Exact spec section, source-manifest key, live `file:line`, assembly/bytes, or runtime observation |
| Cost | Bytes, relevant path cycles, ZP/frame/stack/data/padding/scratch costs when output is involved |
| Finding | What the evidence proves, with named boundaries and confidence |
| Remedy | Separate smallest viable next action; no remedy phrased as evidence |

Short factual answers may compress the shape, but may not omit a material assumption or turn an
inference into a fact.

## Anti-Overengineering Gate

Before recommending any new pass, IR form, service, registry, abstraction, harness, or support
artifact, the skill asks:

1. Which demonstrated current failure or unverified high-risk obligation requires it?
2. Why can a smaller direct lowering, existing representation, focused source case, assembly
   assertion, or VICE observation not solve/prove it?
3. Who consumes the distinction today?
4. Which existing complexity does it replace, or what precise future failure does its absence make
   unavoidable now?
5. How can it be deleted or declined if the expected evidence does not appear?

Missing answers mean “do not add it.” This is a decision rule, not a request for a generalized
scoring framework.

## Controlled Migration

The existing four references remain present while replacements are authored. The migration ledger
in `qualification/coverage-matrix.md` lists every material old heading/rule with:

- exact old file and section;
- disposition: retained, relocated/refined, or rejected;
- exact new file/section or rejection reason;
- factual correction note where meaning changed; and
- qualification case(s) that protect the result.

Deletion is permitted only after every ledger row is resolved, all thirteen new references exist,
the final router links them, focused qualification is green, and a diff confirms no valid rule was
lost. The four old filenames then disappear in the same migration commit; they are not retained as
redirects or shadow authority.

## Freeze and Errata

### Normal Freeze

- `SKILL.md` declares `1.0.0`.
- The complete runtime and qualification content is committed as one immutable content checkpoint.
- `qualification/releases/v1.0.0.md` records that exact commit in a following commit.
- Compiler recovery cites and uses that version without routine edits.
- New insights, conveniences, or additional targets wait for a separately planned later baseline.

### Critical Factual Erratum

A point release is allowed only when a factual defect can cause a wrong semantic, architecture,
lowering, hardware, or recovery decision. The affected work pauses. The correction must:

1. identify the false rule and its evidence;
2. establish corrected primary evidence or bounded empirical resolution;
3. add/strengthen a discriminating case before changing the rule;
4. update only affected knowledge and necessary routing;
5. run affected cases plus the full regression suite;
6. receive independent review;
7. bind a new point-version content commit; and
8. audit only downstream decisions that depended on the corrected rule.

A stylistic improvement, missing convenience, newly interesting topic, or future platform request
does not qualify.

## Failure Conditions

The router/governance component fails if it becomes a knowledge monolith, uses ambiguous routes,
requires all modules for ordinary tasks, claims authority over CodeOps or the frozen spec, lacks a
declared version, permits silent mid-journey edits, or introduces an artifact beyond the accepted
tree.
