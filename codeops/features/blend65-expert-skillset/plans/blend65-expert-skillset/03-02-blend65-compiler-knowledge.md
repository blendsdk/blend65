# Component Specification: Blend65 Compiler Knowledge

> **Document**: 03-02-blend65-compiler-knowledge.md
> **Parent**: [Index](00-index.md)
> **Owns**: `blend65-semantics.md`, `compiler-architecture.md`, `sfa-and-abi.md`, `il-and-optimization.md`

## Objective

Give the agent enough language and compiler depth to audit or redesign Blend65 without confusing
the current code with the desired architecture. The four modules jointly define normative
language lookup, proven SFA constraints, durable compiler responsibilities, and optimization proof
rules. They intentionally do not freeze the number or concrete type shape of IRs, passes, or
backend interfaces before the recovery audit examines the live system.

## Shared Content Rule

Every required topic uses the RD-01 depth contract: authoritative facts/variants, interactions,
compiler consequence, expert idiom, failure/counterexample, actionable rule, source traceability,
and a discriminating qualification case. Cross-module facts are owned once and linked; they are not
copied into four slightly different doctrines.

## `blend65-semantics.md`

### Role

This module is a decision crosswalk, not a substitute language specification. It tells the agent
which frozen documents govern a question, what information must survive the pipeline, and which
compiler/hardware interactions are dangerous. Every semantic conclusion still cites and reads the
governing `spec/` section.

### Required Crosswalk Shape

The module contains exactly one row for every current `spec/**/*.md` file. Rows have:

| Column | Meaning |
|---|---|
| Exact path | Stable repository path discovered from the live tree |
| Normative status | Normative, evaluation rationale, migration context, plan/history, future consideration, grammar, or preflight context |
| Relevant semantic concerns | Concrete language questions governed or illuminated by the file |
| Pipeline obligations | Width, signedness, evaluation order, effect, storage, diagnostic, target, or artifact facts that must survive |
| Expert module links | Other reference sections required for the implementation consequence |
| N/A rationale | Required only when the file adds no runtime/compiler guidance; never blank |

Set equality is checked between the 50 live paths and the 50 crosswalk paths. A future spec-file
count change makes qualification fail loudly until a new baseline is planned.

### Semantic Coverage Families

| Family | Required consequences and traps |
|---|---|
| Lexical/grammar | Token boundaries, literals, comments, keyword/operator disambiguation, error recovery, source spans; no target leakage |
| Types | Exact byte/word widths, signedness, wrapping/overflow, conversions, constants, booleans, arrays, structs, enums, pointers/references if present |
| Expressions | Precedence, evaluation order, side effects, short circuit, volatile access count/order, lvalue/place versus value, address-of, conditional operator |
| Statements/control flow | Reachability, loop bounds/wrap, switch/branch meaning, break/continue/return, nontermination, diagnostic ownership |
| Functions/modules | Resolution, visibility, initialization order, calls, entry point, interrupts, address-taken behavior, separate compilation assumptions |
| Storage/memory | Module/static/local/zeropage/data/embed placement, initialization, lifetime, aliasing, escape, MMIO volatility |
| Intrinsics/platform | Semantic versus target availability checks, type/effect contracts, CPU control, hardware access, encoding, output format |
| Diagnostics | One root cause, stable code/primary span, notes, recovery without silent poison, separation from implementation crashes |
| Future/migration/evaluations | Reconsideration triggers and intent evidence, never promoted above the final normative chapter |

### Decision Rules

- A hardware limitation does not become a language rule merely because current lowering is weak.
- A behavior the language cannot express is reported as an expressiveness failure, outside finite
  assembly parity ratios.
- Target-neutral stages retain semantic distinctions until their owning consumer can act safely.
- A conflict between frozen semantics and demonstrable hardware feasibility is surfaced for a
  later product decision; this feature never edits `spec/`.

## `compiler-architecture.md`

### Responsibility Model

The module teaches responsibilities and boundary tests rather than a required class diagram:

| Responsibility | Target-neutral obligations | Target-dependent obligations |
|---|---|---|
| Lex/parse | Source structure, recovery, spans | None beyond parsing explicitly specified target syntax, if any |
| Semantic analysis | Names, types, constants, effects, volatility, control restrictions, diagnostics | Validate selected platform/CPU capabilities through declarative facts, without embedding memory maps |
| SFA/allocation planning | Lifetimes, call-graph interference, frame ownership, escape/reentrancy classes | RAM/ZP windows, reserved regions, ABI resources, interrupt model, budgets |
| High/mid-level IR | Exact semantic operations, widths, signedness, effects, symbolic storage/placement constraints | No premature concrete register/address selection |
| Target legalization/selection | Preserve operation meaning and observability | Convert unsupported widths/ops; choose legal CPU forms and helpers |
| Resource binding | Abstract liveness and conflicts | Bind A/X/Y, flags, ZP pseudo-registers, static homes, scratch, clobbers |
| Machine optimization/layout | General proof framework and CFG meaning | 6502 idioms, branch polarity, block order, branch reach, page/timing effects |
| Emitter | Stable symbolic machine representation | ACME syntax/expressions/directives only |
| Packager/runtime/platform library | No machine assumptions | PRG/startup/runtime/device APIs, memory banking, target artifact |

### Required Boundary Tests

- Could a frontend test run without a platform memory map?
- Does the target-neutral representation preserve volatility, signedness, width, placement,
  alignment, interrupt identity, and effect ordering until an accountable consumer?
- Can one shared 6502-family backend select CPU-variant definitions and compose a platform model,
  emitter, and packager without copying the backend?
- Does any platform hook expose assembler text where symbolic machine data would suffice?
- Is a target restriction a hardware fact, a platform policy, a missing lowering, or a compiler
  convenience? The category changes the remedy.
- Does each representation transition have an explicit input contract, output contract,
  diagnostics boundary, and evidence tier?

### Architecture Evaluation Method

For any proposed seam, record: semantic distinction carried, current consumers, target facts
required, optimization opportunities enabled, invariants lost at the boundary, verification
surface, and simpler alternatives. Reject generic extension points with no current consumer.

The module may illustrate legalization → selection → resource binding → layout/relaxation → emit
as proven responsibility categories. It must explicitly state that LLVM is comparative evidence,
not a mandate to recreate LLVM or use its exact IR stack on this small compiler.

## `sfa-and-abi.md`

### Binding Rule

SFA owns general function storage. Parameters, locals, temporaries, spills, and compiler scratch
are statically assigned unless an explicitly supported dynamic feature requires a separately
proven mechanism. The 6502 hardware stack remains available for JSR/RTS return addresses,
interrupt entry/exit state, register preservation, and explicit stack intrinsics; it is not the
general local-frame allocator.

### Required SFA Model

| Concern | Required treatment |
|---|---|
| Frame contents | Parameters, returns, locals, temporaries, spills, address-taken slots, alignment, and compiler scratch ownership |
| Lifetime | Per-slot lifetime versus conservative frame lifetime; what evidence permits reuse |
| Call graph | Direct/indirect/address-taken edges, roots, reachability, recursion/cycles, initialization, exported/unknown callers |
| Interference | Caller/callee overlap, siblings, reentrant paths, IRQ/NMI/mainline concurrency, escaped entry points |
| Overlay/coloring | Safety invariant, deterministic placement, benefit/cost, diagnostic when proof is missing |
| Zero page | Scarce resource classes, pair alignment/wrap, ABI arguments, hot data, scratch, interrupt-safe separation, pressure tradeoffs |
| General RAM | Target windows, reserved/visible regions, module data versus frames, banking visibility, placement failure |
| ABI | Parameter/return homes, A/X/Y/flags, clobbers, helper calls, tail calls if any, interrupt ABI, startup/entry/exit obligations |
| Unsupported dynamics | Recursion, reentrancy, complex function-pointer graphs, dynamic alloca; explicit diagnostic or proven bounded policy |
| Budgeting | Static totals and peak/interference totals, target reservations, error/warning thresholds, explainable allocation reports |

### Mandatory Cases

The module must reason correctly about:

- mutually exclusive sibling calls that may overlay versus nested calls that may not;
- a recursive SCC, with no pretend acyclic allocation;
- a function reachable from both mainline and IRQ;
- separate IRQ/NMI roots that can nest or preempt according to the platform contract;
- an address-taken or externally callable function with unknown caller overlap;
- pointer scratch and spill state live across a possible interrupt;
- ZP pair allocation at `$xxFF` and zero-page wrap behavior;
- aggregate alignment/size and a target RAM/ZP budget failure;
- call-site parameter homing, return ownership, and helper clobbers; and
- a tempting software-stack alternative, rejected unless an authorized language capability proves
  both necessity and acceptable target cost.

### Diagnostics Doctrine

An impossible static allocation is a source-level diagnostic with the failed invariant, involved
call/reentrancy path, requested resource, target budget, and likely source remedy. It must not become
an allocator crash, silent overlap, or unbounded fallback to a hidden software stack.

## `il-and-optimization.md`

### Semantic Payload

Any IR used by Blend65 must preserve, until consumed:

- scalar width and signedness;
- wrapping/overflow and comparison meaning;
- volatile read/write identity, count, width, and order;
- alias/escape and memory-effect information;
- symbolic address, storage class, placement, alignment, and bank/visibility constraints;
- control-flow and interrupt-entry identity;
- call, clobber, helper, and observable side-effect obligations; and
- enough source association for stable diagnostics and evidence.

The module does not mandate a single IL, SSA, DAG, or fixed pass count. It provides a test: if a
later stage must guess a distinction already erased, the boundary is wrong.

### Optimization Taxonomy

| Layer | Examples | Proof obligation |
|---|---|---|
| Target-neutral canonicalization | constant folding, algebraic simplification, dead unreachable code, known branch folding | Exact Blend65 semantics including widths, wrapping, effects, and evaluation order |
| Whole-program analysis | call reachability, static frame/ZP allocation, interprocedural constants, dead routines/data | Closed-world assumptions explicitly justified; escapes and entry roots conservative |
| Legalization | split word operations, lower unsupported arithmetic, preserve volatile access | Equivalent operation and effects on the selected CPU/runtime contract |
| Instruction selection | exploit flags, addressing modes, RMW, transfers, direct branches | Legal instruction/flag sequence with complete clobber and cost model |
| Resource binding | A/X/Y/flag lifetimes, homes, spills, ZP pairs | No live-value/flag conflict; ABI and interrupt safety |
| CFG/layout | fall-through, inversion, block order, tail merge | Same control semantics; branch probability/timing assumptions stated |
| Branch repair | long-branch expansion after layout | All ranges legal; no semantic or timing surprise hidden |
| Target optimization | 6502 strength reduction, addressing narrowing, redundant load/store removal | Machine effects, flags, MMIO, page behavior, and ABI preserved |
| Peephole cleanup | local residual substitutions | Narrow pattern is proven in context; never asked to recover erased semantics |

### Pass Review Checklist

Every optimization rule states applicability, semantic preconditions, killed/generated facts,
flag and memory effects, target legality, cost model, counterexample, verification case, and whether
it must run before/after allocation/layout. Fixed-point iteration requires a termination argument;
pass ordering requires a dependency, not taste.

### Anti-Patterns

- treating IL as a textual assembly staging area before semantic legalization is complete;
- using a peephole pass as the primary place for signedness, volatile, call, or control semantics;
- constant-folding through MMIO or dropping/reordering volatile accesses;
- optimizing instruction count while worsening bytes, hot-path cycles, scarce ZP, or data movement;
- selecting runtime helpers for assembler/link-time facts;
- adding an IR layer because another compiler has one; or
- measuring only isolated routines while whole-program allocation/layout costs regress.

## Integration Qualification

The language/architecture case file must include single-module questions and cross-domain cases
where one answer requires all four references: e.g. a modern source operation with signed word
semantics, an IRQ-visible volatile access, SFA scratch state, target legalization, and a parity
comparison. Correct routing and explicit uncertainty matter as much as a plausible conclusion.
