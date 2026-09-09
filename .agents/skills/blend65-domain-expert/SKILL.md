---
name: blend65-domain-expert
description: Review, design, diagnose, or implement Blend65 behavior where decisions depend on constrained 6502/65C02 compiler engineering, expert assembly output, or C64 game hardware. Use for compiler audits, language expressiveness, lowering, allocation, ABI, instruction selection, optimization, generated-assembly review, C64 platform APIs, and game feasibility. Do not use for generic TypeScript maintenance or unrelated tooling.
---

# Blend65 Domain Expert

> **Baseline version**: `1.0.0` (activation is governed by `qualification/release.md`)
> **Knowledge identity**: `BLEND65-SPEC-P3-4bf8a989`

This skill supplies domain judgment on top of CodeOps. It does not replace the frozen Blend65
specification, explicit product decisions, primary hardware/tool evidence, or normal CodeOps
authority and verification gates. Existing compiler code, tests, readiness artifacts,
scoreboards, and feasibility snapshots are audit subjects, never authority for language or
architecture decisions.

## Required Stance

- Judge source as a modern programmer expects: keep ordinary language forms legal unless a
  documented target/resource limit genuinely makes them impossible. Missing lowering, SFA, or
  compiler convenience never justifies alien source restrictions. Nested calls and
  `POKE(variableAddress, value)` are ordinary required forms.
- Judge output as an expert 6502 assembly programmer building a commercial C64 game would. Local
  expert parity is the floor; whole-program allocation, layout, and optimization should beat the
  realistic expert result where possible.
- Prefer evidence over status claims. Separate expressibility, semantics, lowering, assembly,
  artifact construction, runtime behavior, timing, and parity; success at one boundary does not
  prove another.
- Preserve Static Frame Allocation as the sole general function-execution storage model. SFA
  closes over parameters, returns, locals, temporaries, spills, and helper scratch before
  emission. It does not own globals, assets, banking, alignment, segments, loaders, or packaging.
- For any interrupt-sink or handler-route analysis, apply every item in
  `sfa-and-abi.md#interrupt-route-completion-gate`. Do not compress away callback-only identity,
  reachable-variant selection, full `RTI` status/D restoration, legal explicit `asm_sed()` under
  its normal diagnostics, exact saved-link boundaries, or existing-ROM versus output-byte costs.
- For any C64 workload or game-system comparison, apply
  `c64-game-engineering.md#machine-bound-workload-completion-gate`. CPU-heavy work still names the
  exact machine/video/banking context, interrupt absence or complete routes, and loader/startup
  costs. Generic code, stack, or cycle totals never substitute for introduced IRQ or renderer
  terms.
- For a selected-profile native-asset handler or `embed(path, selector)` review, apply the
  handler's complete selector/fixture checklist in
  `c64-game-engineering.md#native-asset-handlers`. Raw `embed(path)` has no handler selector or
  schema contract. For every embedded object, compile-time import and SFA costs may be zero, but
  artifact bytes and RAM/ROM/banked residency are separate and remain `Unknown` until final layout
  and packaging prove them.
- Prefer compile-time transformation, placement, banking, and pointer changes over runtime work
  or copying. Never introduce a hidden runtime, heap, dispatcher, scheduler, or safety cost.

## Fix the Decision Context

Before a material conclusion, establish every factor that can change it:

- Blend65 specification and skill-content identity;
- CPU variant and legal instruction set;
- target machine, video standard, chip/revision assumptions, and memory/banking state;
- interrupt/NMI entry, nesting, ownership, and observable machine state;
- assembler, emulator, artifact format, and relevant tool versions; and
- optimization/safety mode plus required behavior, cost, placement, and timing observations.

If a required fact is missing, keep the affected conclusion `Unknown` and name the smallest probe
that would settle it.

## Selective Loading

Read only the references needed for the task. Cross-domain work loads the union; a narrow question
must not trigger the whole knowledge base.

| Task signal | Read first | Add only when the task crosses this boundary |
|---|---|---|
| Language meaning, syntax, types, diagnostics, expressiveness, hardware-limit exceptions | [Blend65 semantics](references/blend65-semantics.md) | [Compiler architecture](references/compiler-architecture.md) for ownership or representation changes |
| Pipeline boundaries, modular backend, redesign, responsibility ownership | [Compiler architecture](references/compiler-architecture.md) | SFA, IL, or portability references for the affected seam |
| Frames, locals, parameters, calls, ABI, recursion, reentrancy, ZP, stack, IRQ/NMI reachability | [SFA and ABI](references/sfa-and-abi.md) | CPU stack facts and the selected platform budget/entry contract; when emitted assembly is supplied, assessed, or requested, also load the lowering casebook and CPU reference |
| IL legality, effects, pass order, optimization, proof obligations | [IL and optimization](references/il-and-optimization.md) | CPU and lowering references when choosing machine forms or preserving flags |
| Opcode legality, flags, addressing, cycles, NMOS 6502/6510 and 65C02 differences | [MOS 6502 family](references/mos-6502-family.md) | The lowering casebook when translating a language operation |
| Concrete operation lowering or generated-assembly parity | [6502 lowering casebook](references/6502-lowering-casebook.md) and [MOS 6502 family](references/mos-6502-family.md) | For Blend65 parity review, also load [Blend65 semantics](references/blend65-semantics.md) and [evidence, parity, and recovery](references/evidence-parity-and-recovery.md); add ABI, C64, or ACME only as the evidence path requires |
| C64 map, `$0000/$0001`, banking, startup, runtime ownership, placement, loading | [C64 memory and runtime](references/c64-memory-and-runtime.md) | ACME/artifacts for packaging; C64 hardware for device visibility |
| VIC-II, SID, CIA, raster, interrupts, input, device timing | [C64 hardware](references/c64-hardware.md) | C64 game and memory references for whole-system behavior |
| Game loop, graphics/audio systems, scrolling, multiplexing, streaming, asset/data layout, zero-cost APIs | [C64 game engineering](references/c64-game-engineering.md) | The exact memory, hardware, lowering, SFA, or optimization references it consumes |
| ACME syntax/encoding/output or VICE observation boundaries | [ACME and artifacts](references/acme-and-artifacts.md) and [source manifest](references/source-manifest.md) | Other modules only if the question expands into their domains |
| Multi-target seam or future-machine feasibility | [Target portability](references/target-portability.md) | CPU/platform references for the concrete constraint being compared |
| Status audit, parity, harness value, salvage, recovery, course correction | [Evidence, parity, and recovery](references/evidence-parity-and-recovery.md) | Each domain module traversed by the named behavior |
| Source dispute, revision, provenance, known erratum | [Source manifest](references/source-manifest.md) | The knowledge module whose claim is disputed |

## Decision Sequence

1. Fix the language/API contract and intended user-visible behavior.
2. Inventory the supplied evidence before judging it. Inspect every named file/path and record every
   stated exact value. Resolve a named relative path against every declared raw-evidence root;
   never declare an artifact or measurement absent until the allowlisted packet has been checked
   for it. A document that states intended behavior is not a compiler-run result.
3. Fix observability: values, order, volatility, flags, ABI state, interrupts, placement, timing,
   device access, and artifact bytes that must remain equivalent.
4. Trace only the relevant path through semantics, SFA, IL, machine lowering, assembly, artifact,
   and runtime.
5. Proactively look for hidden representation boundaries: byte/word width, carry, page/bank
   crossing, pointer provenance, element scaling, alignment, and CPU/VIC visibility. First exhaust
   inference, range proof, compile-time evaluation, direct carry use, and zero-cost abstractions.
6. Quantify complete costs with stated assumptions: ROM and data bytes, padding, ZP, frame,
   hardware stack, scratch, best/worst/path cycles, and loader or replication cost.
7. Compare equivalent work and obligations only. Every optimization needs an independent behavior
   oracle and a separate assembly/cost expectation; differential execution is supporting evidence.
8. Run the selected reference's completion checklist. Re-read the request and account for every
   requested boundary, exact value, diagnostic, cost, evidence item, and `Unknown`; brevity never
   permits dropping a material contract facet. For inventories, treat every supplied path or
   register entry independently and cite the exact raw source location rather than only this
   skill's summary.
9. Classify the result, then recommend the smallest viable remedy that preserves modular target
   seams, modern source, SFA closure, and expert output.

## Response and Lineage

For every material audit, design, diagnosis, or parity conclusion, report:

- `Status`: `Verified complete`, `Verified partial`, `Scaffold/stub`, `Incorrect`, or `Unknown`;
- `Claim kind`: `Fact`, `Inference`, `Unknown`, or `Recommendation`;
- context and user-visible capability;
- exact evidence and the decisive missing probe, if any;
- knowledge lineage: `skillVersion=1.0.0`, the content commit from
  [qualification/release.md](qualification/release.md), `referencePath#heading`, and governing
  source-manifest keys;
- complete relevant cost; and
- a finding distinct from its smallest viable remedy.

Short factual answers may compress this shape, but never hide a material assumption or present an
inference as fact. Reinspect the live repository before any current compiler-status claim.

`Unknown` is both a status and the claim kind for a conclusion whose decisive evidence is absent;
the fact that evidence is absent may be reported separately as a `Fact`. A proposed probe must
start from what is actually present. Never call an artifact byte-verified, runnable, or configured
when those preconditions are missing merely to describe the later runtime step.

Assign exactly one status to each assessed boundary. Do not answer with a range such as “at most.”
With no supplied or inspected artifact, declaration, stub, delegation, implementation, or
observation, capability status is exactly `Unknown`; constraint knowledge alone does not establish
`Scaffold/stub`.

## Anti-Overengineering Gate

Before recommending a new pass, IR form, abstraction, service, registry, harness, or support
artifact, answer all five questions:

1. Which demonstrated failure or unverified high-risk obligation requires it now?
2. Why can a direct lowering, existing representation, focused source case, assembly assertion, or
   VICE observation not solve or prove it?
3. Who consumes the distinction now?
4. Which current complexity does it replace, or which precise failure is unavoidable without it?
5. How can it be declined or removed if the expected evidence does not appear?

If any answer is missing, do not add the machinery.

## Freeze and Errata

Exactly one qualified baseline is active. Git preserves older versions; do not keep parallel live
skill trees or release records. During compiler recovery, ordinary useful additions wait for the
next between-journey baseline.

A substantive router, knowledge, source-governance, or qualification-oracle change must pause
affected work, bump the semantic version by at least a patch, strengthen a discriminating case,
requalify the changed and dependent cases, receive independent review, audit only dependent
decisions, and activate atomically. Classify each dependent decision as `unaffected`,
`revalidated`, `corrected`, or `invalidated/reopened`. A proven critical false fact follows this
path immediately; never patch it silently or restart unrelated work. Updating the release record
to bind an already-qualified content commit is bookkeeping and does not bump the version.

## Completion Bar

A domain task is complete only when its claimed boundary has direct evidence, material uncertainty
is explicit, applicable behavior and assembly/cost oracles agree, and no compiler-convenience
restriction or unsupported target claim is smuggled into the result. When physical silicon is not
yet checked for a revision-sensitive result, say `VICE-verified / hardware-unverified`.
