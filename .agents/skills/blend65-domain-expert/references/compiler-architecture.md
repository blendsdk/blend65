# Compiler Architecture Doctrine

> **Construction status**: Candidate knowledge for the unqualified `0.4.0-cpu-lowering`
> build. This module defines responsibilities and invariants, not a mandatory class diagram.

## Design Objective

Blend65 is one language compiler for the 6502 family, with C64 as the first platform and later
targets composed from shared and target-specific responsibilities. Modern source ergonomics and
expert-quality assembly are simultaneous requirements. A convenient internal boundary is not valid
if it loses language meaning, forces hardware lore into normal source, or prevents a later backend
from producing target-appropriate code.

ACME is the currently selected emitter dialect by explicit product/toolchain policy, not a Blend65
language semantic. The responsibility boundaries below therefore keep emitter dialect selectable:
changing the assembler replaces terminal serialization facts, not typed semantics, SFA, or machine
operation meaning.
`[BLEND65-PROJECT-POLICY-P3-3541841b, Environment & dependencies; Project-specific: Skill/implementation independence]`

The architecture must stay smaller than the problem. Add a representation, pass, plugin seam, or
framework only when a current consumer and a lost-or-preserved invariant justify it. LLVM,
LLVM-MOS, cc65, KickC, Prog8, and Oscar64 are comparative evidence; none dictates Blend65's class
count, IR stack, runtime, or ABI.

## Responsibility Map

| Responsibility | Input contract | Output contract | Must not own |
|---|---|---|---|
| Source loading and lexing | UTF-8 source identity and bytes | token kind/value, exact span, recoverable lexical diagnostics | platform maps, machine costs, name/type meaning |
| Parsing | complete token stream and grammar | syntax structure, preserved spans, syntax diagnostics and recovery boundaries | target capability, allocation, instruction choice |
| Semantic analysis | syntax plus program/module symbol graph | resolved names/types/constants, full-precision validated extents and aggregate sizes, conversions, effects, volatility, control restrictions, semantic diagnostics | concrete addresses/registers, C64 memory map, assembly text |
| Semantic representation | fully typed legal program | exact operations, CFG, evaluation order, aliases/escapes, symbolic storage and source associations | premature CPU instruction or segment choice |
| Whole-program analysis | roots, calls/escapes, effects, lifetimes | reachability, interference, constant and dead-code facts with closed-world assumptions stated | pretending unknown external calls do not exist |
| SFA and allocation planning | function storage requirements, call/preemption graph, target resource facts | final static homes, overlays, budgets, ABI storage, explainable failures | asset/global bank layout; hidden dynamic frames |
| Target legalization | exact semantic operations plus selected CPU capabilities | operations expressible by target forms/helpers without lost meaning or effects | final text syntax; unaccounted helper state |
| Instruction selection | legalized operations, known facts, cost model | symbolic machine operations with flags, clobbers, addressing and costs explicit | ACME string fragments as data model |
| Resource binding | symbolic machine operations and liveness | A/X/Y/flag/ZP/static-home assignments, spills returned to SFA, preserved ABI | inventing storage after closure |
| Machine optimization and CFG layout | bound or constrainable machine graph | equivalent legal graph, chosen fall-through/order, branch-repair requirements | recovering semantic facts erased upstream |
| Emitter | symbolic machine program and dialect contract | deterministic ACME source with relocations/directives | semantic optimization, platform policy |
| Packager/startup/platform library | emitted objects, target profile and artifact request | loadable PRG/ROM/XEX/artifact, startup/interrupt/device contracts | target-neutral semantics or generic compiler orchestration |
| Compilation driver | stage results and diagnostics | deterministic orchestration; no artifact after error; build summary | reimplementing stage logic or hiding failures in readiness gates |

The number of concrete modules may be less than, equal to, or greater than these responsibility
rows. A small compiler may combine adjacent responsibilities when the contracts remain explicit and
independently testable. It may split one responsibility when different consumers or proof rules
require it. Do not infer a required one-class-per-row design.

## Target-Neutral Front End

Lexing, parsing, name resolution, type/effect checking, semantic control flow, and the first safe
canonicalizations operate without a platform memory map. A selected target may be queried through
declarative capabilities for a language-mandated availability check, but the semantic node records
the capability requirement—not `$D000`, a VIC bank, an ACME directive, or a C64-only helper name.

A frontend test should be runnable with a minimal abstract profile. If changing a C64 address
requires rebuilding parser or analyzer expectations, the boundary is wrong. If a platform rule
changes whether a source program is supported, diagnostics should name the selected target and the
missing capability while leaving the language operation itself target-independent.

### Information that cannot be erased early

- width, signedness, nominal type, wrapping and constant/runtime evaluation rules;
- left-to-right evaluation, short-circuit control, selected conditional arms, and side effects;
- volatile/MMIO identity, access width, count, and order;
- lvalue/place identity, aliasing, address-taking, escape, and external visibility;
- function/interrupt source identity, candidate entry variants, call effects, reentrancy class,
  synchronous BRK contract identity, and source diagnostics;
- symbolic storage class, alignment, placement, bank/visibility constraint, and embedded-data
  identity; and
- enough source association to explain any later target or resource failure.

See [Blend65 Semantics](blend65-semantics.md#semantic-preservation-checklist) for the language-source
crosswalk and [IL and Optimization](il-and-optimization.md#mandatory-semantic-payload) for the
representation tests.

## Target Composition

Treat four selections independently even when the first implementation ships them together:

| Selection | Examples | Owns |
|---|---|---|
| CPU variant | NMOS 6502, 6510, 65C02 | legal instructions/addressing, flag behavior, silicon hazards, cycle/byte facts |
| Machine/platform | C64, C64U, X16, Atari 800XL, Atari 7800 | memory/I/O map, reserved regions, interrupt/device model, encodings, asset visibility, resource budgets |
| Emitter dialect | ACME | expression/directive/local-label syntax, relocation spelling, segment syntax |
| Artifact packager | PRG, XEX, A78/ROM | load address/header, startup, memory image, bank/ROM layout, final validation |

The shared 6502-family backend consumes the selected CPU definition and platform facts. Adding an
Atari target must not mean copying a C64 backend and renaming hooks. Conversely, “universal” hooks
must not smear VIC-II, VERA, ANTIC, or MARIA concepts across every target. Share a responsibility
only where its semantics are truly common; compose the rest.

Platform data should be structured and validated. Prefer symbolic register/device identities and
constraints over raw constants. A C64 library may expose `VIC.borderColor` while lowering it to
`$D020`; target-neutral semantic analysis sees a typed volatile register access. The zero-cost
wrapper is an abstraction for the source author, not a runtime tax.

Interrupt source meaning follows the same boundary. Semantic analysis records a callback-only
`interrupt function` and preserves its identity through recognized sinks. The selected platform
then chooses a raw CPU entry or an exact firmware-mediated entry/tail. On the default C64 profile,
`setIRQ` and `setIRQExclusive` select KERNAL CINV variants that do not save A/X/Y again; a raw
profile selects the compiler save/restore/`RTI` variant. The backend emits only reachable variants
and reports all duplicated bodies, page-safe saved-vector storage, decimal/status normalization,
stack bytes, cycles, and installer code. On NMOS, Blend65 handler code begins with `D=0`; a chained
variant restores its entry flags before reaching the previous handler, while raw/exclusive `RTI`
paths restore the interrupted status. Proof may remove redundant normalization but never weaken
either status boundary.
Do not solve this with a universal dispatcher, wrapper stack, or runtime ABI registry.

BRK uses the same target-bound discipline without becoming an interrupt-handler API. The neutral
frontend records a synchronous software-interrupt operation. The selected profile must then supply
its exact vector/handler identity, returning or non-returning edge, stack peak, clobbers, and machine
effects. The backend emits only `$00 $EA`; missing proof is E10259, never an invitation to add a
debug runtime.

## Required Pipeline Invariants

### Each transition is accountable

For every live transition, record:

- accepted input facts and poison/error policy;
- facts produced, refined, or deliberately consumed;
- observable semantics that cannot change;
- target facts consulted and why this is the earliest correct stage;
- diagnostics owned here rather than downstream;
- verification evidence for the transition; and
- the smallest simpler shape considered.

If a later stage must guess signedness, volatility, aliasing, call effects, or placement meaning, an
earlier boundary is defective. If a stage accepts invalid input only to crash later, the pipeline
gate is defective. If the only consumer of a generalized interface is one concrete caller, prefer a
direct interface until another proven need exists.

### Diagnostics stop unsafe progression

Recovering from a local source error helps report more independent problems, but recovered/poisoned
nodes never become silently valid optimizer or allocation input. Stage contracts say whether they
accept partial results. A source error prevents final artifact emission even if later safe analysis
continues. Diagnostic numbers come from reconciled frozen semantics, never from current test
expectations.

### Function storage reaches closure

Legalization and resource binding may discover spills, helper scratch, or expanded temporaries. Such
storage returns to the SFA planner. A final no-new-function-storage gate precedes final layout and
emission. Global data and hardware-visible assets use the independent platform layout path. See
[Final Storage Closure](sfa-and-abi.md#final-storage-closure).

### Emission is a terminal translation

The emitter translates a symbolic machine representation into ACME syntax. It does not choose a
new calling convention, parse pseudo-assembly to rediscover operands, repair lost semantic effects,
or invent helpers. Branch range repair and layout must occur on structured machine data before or
through an explicitly modeled relaxation loop—not through opaque search-and-replace on text.

## Restriction Triage

Before defending any rejected source, classify the actual cause:

| Cause | Correct response | Incorrect response |
|---|---|---|
| Normative language rule | cite the reconciled spec and explain the deliberate behavior | infer it from current parser/codegen limits |
| Physical CPU/platform impossibility | issue a selected-target diagnostic with the exact missing resource/capability | globally weaken the language for all targets |
| Finite selected-target resource exhaustion | report budget, demand, interference/path, and realistic remedy | crash, overlap memory, or silently install a huge runtime |
| Missing lowering/analysis/optimization | record an implementation defect and design the smallest correct compiler remedy | force hand-unrolling, magic constants, or hardware-shaped source |
| Platform-library gap | add/repair a zero-cost typed abstraction whose emitted operations remain expert quality | make every source author repeat device lore |
| Intentionally explicit low-level escape hatch | define exact effects, clobbers, and safety contract | let it weaken optimizer correctness around ordinary code |

`POKE(variableAddress, value)` is a representative test. The language permits the dynamic address;
the IR preserves the volatile write and address expression; target legalization selects an indirect
store sequence and accounts for pointer scratch. Requiring a literal address or manually unrolled
stores is a compiler defect because it is not forced by the 6502.

The `for` statement is another representative test. A normal three-clause loop lowers to a small
generic CFG without a runtime or special SFA model. Common induction patterns are recovered by
proof-based analysis so a semantic `word` counter over 256 elements can still become an expert
8-bit `INX/BNE` loop. Reintroducing range-only syntax, making counters read-only, or asking the user
to choose machine width for optimizer convenience would turn missing analysis into a language
restriction.

## Architecture Evaluation Packet

Review a proposed or current seam using this compact packet:

| Field | Required answer |
|---|---|
| Problem | Which current source behavior, output-quality gap, or target addition requires change? |
| Semantic payload | Which exact distinctions cross the seam? |
| Consumers | Which concrete current stages use each distinction? |
| Target inputs | Which CPU/platform/emitter/packager facts are required, and why here? |
| Lost facts | What would become impossible or unsafe if this boundary erased them? |
| SFA/ABI effect | Does it create storage, calls, helpers, escapes, or interference? |
| Optimization effect | Which transformations become enabled or blocked? |
| Diagnostics | Which stage can explain a failure best from source evidence? |
| Verification | Which behavior and assembly/cost oracles prove the seam? |
| Simpler option | Can an existing representation or direct interface carry the facts? |
| Status | Verified, Verified partial, Inferred, Unknown, or Incorrect, with evidence limits |

The live compiler is evidence for this packet, not the desired answer. A current package boundary
may be preserved, simplified, split, or removed after the audit. Never freeze it merely because code
already exists.

## Practical Modular Baseline

The following flow is a responsibility baseline, not a command to create these exact artifacts:

```text
source
  -> lex / parse / analyze
  -> target-neutral semantic operations and CFG
  -> whole-program effects, roots, lifetimes and SFA plan
  -> selected CPU/platform legalization
  -> instruction selection and resource binding
  -> final SFA closure
  -> machine optimization, layout and branch repair
  -> ACME emission
  -> selected-machine packaging
```

Feedback edges are allowed where a later responsibility discovers facts required by an earlier
plan, but they must converge on a named invariant. The important example is storage discovered by
legalization returning to SFA before closure. An open-ended pipeline that repeatedly invents
storage or reparses text is not convergence.

## Decision Examples

### Adding another 6502 machine

Start by comparing the new CPU variant, platform map/device model, emitter needs, and artifact
format. Reuse the semantic frontend and common 6502 lowering where their contracts match. Add only
the target facts and handlers with a real consumer. Prove that selecting the new target cannot emit
instructions unavailable on its CPU and cannot inherit C64 memory/register assumptions.

### Optimizer asks for an LLVM-shaped IR layer

Ask which semantic distinction or transformation cannot be represented now. If the answer is only
familiarity or future flexibility, reject the layer. If a concrete pass needs structured control
flow or effect facts currently unavailable, add the smallest representation that preserves those
facts and give it behavior/cost qualification cases.

### Platform API hides a hardware rule

Keep the source operation named and typed, express the required volatile/device effects in the
semantic representation, and lower to the same instructions an expert would write. If the wrapper
adds a generic dispatch runtime or copies data an expert would place directly, its abstraction is
not zero cost and must be redesigned or the measured gap filed.

## Audit Checklist

- Can lexer/parser/analyzer tests run without C64 addresses?
- Does every target-specific decision name the selected CPU, platform, emitter, or packager owner?
- Are all language effects present until their accountable consumer?
- Are SFA, platform layout, and artifact packaging separate ownership domains?
- Can helpers and spills reach final SFA closure?
- Do raw machine effects have explicit clobber/ordering contracts?
- Is the emitter free of semantic decisions and opaque text rewrites?
- Does each abstraction have a current consumer and a qualification case?
- Are compiler limitations classified as defects rather than user restrictions?
- Does verification cover both behavior and expert assembly/cost?

## Sources

- `[BLEND65-PROJECT-POLICY-P3-3541841b, PRIME DIRECTIVE headings; Environment & dependencies; Project-specific: Skill/implementation independence]` — product/process authority for modern input, expert output, and the selected ACME toolchain
- `[BLEND65-SPEC-P3-ed278ab9, spec/00-introduction.md §Design Axioms]`
- `[BLEND65-SPEC-P3-ed278ab9, spec/15-platform-profile.md §Platform Profile Contract]`
- `[BLEND65-SPEC-P3-ed278ab9, spec/06-functions.md §SFA Calling Convention]`
- `[BLEND65-SPEC-P3-ed278ab9, spec/11-memory-model.md §Static Frame Allocation]`
- `[LLVM-CODEGEN-22, Code Generator chapter]` — comparative responsibility model only
- `[LLVM-MOS-275C7FC, repository architecture and target implementation]` — comparative only
- `[OSCAR64-1.32.273, compiler/codegen/CodeGenerator6502.cpp and compiler/optimizer/]` — comparative instruction-selection and optimization structure only
- `[KICKC-0.8.6, src/main/java/dk/camelot64/kickc/passes/ and src/main/fragment/]` — comparative pass and fragment structure only
- `[PROG8-12.1.1, compiler/ and codeGenCpu6502/]` — comparative modern-language and target-lowering structure only
- `[CC65-2.19, src/cc65/ and libsrc/runtime/]` — comparative optimizer, ABI, and runtime structure only
