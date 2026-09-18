# Semantic Analysis: RD-03 Frontend First

> **Parent**: [Index](00-index.md)
> **Decisions**: AR-P2, AR-P4, AR-P5, AR-P6, AR-P7

## Ownership and Internal Stage Interfaces

| File under `packages/compiler/src/frontend/` | Current consumer/responsibility |
|---|---|
| `modules.ts` | Header index, selected graph, merged declarations and qualified lookup |
| `semantic-types.ts` | Closed scalar/fixed aggregate type facts and typed syntax payload |
| `analyzer.ts` | Body scopes, direct calls and typed expression checks |
| `constants.ts` | Exact compile-time evaluation and explicit fixed-width conversion |
| `flow.ts` | Structured return/assignment/reachability and bounded loop proof |
| `aggregates.ts` | Struct/fixed-array types, literals, places, parameters and queries |
| `effects.ts` | Direct-call effects and initializer schedule |
| `service.ts` | Direct stage orchestration and truthful result |

No new workspace, CFG/IR library, generic pass, alias framework, abstract provider
registry or allocation service is required. Typed AST control structure and small
flow/effect summaries serve current checks. Backend CFG/storage representations
are later R3.11–R3.15 work, not speculative files here (AR-P2).

```typescript
indexModules(snapshot: ProjectSnapshot): ModuleIndexResult;
resolveModules(snapshot: ProjectSnapshot, index: ModuleIndex): ModuleGraphResult;
analyzeModules(snapshot: ProjectSnapshot, graph: ModuleGraph): AnalysisResult;
analyzeProject(snapshot: ProjectSnapshot): AnalysisResult;
```

Intermediate results retain stage diagnostics/poison/unchecked obligations but
are not a `TypedProgram`. Use readonly discriminated unions and constants for
result/node discriminators. Test authors receive these contracts and syntax/type
definitions, not implementation files (AR-P4).

## Admitted Slice

| Surface | Completed semantic obligations in this plan | Unchecked implementation obligations |
|---|---|---|
| Modules | Headers, merged contributions, imports/aliases, qualified exported access, selected entry, direct-call/body lookup and initializer graph | Profile-provided module declarations/constants |
| Scalars | Four integer types, Boolean/void, explicit annotations, module/local const/let, all ordinary scalar operators, casts, assignment and conditionals | Enums, function values, address-of provenance, compile-time functions/trigonometry |
| Control/functions | Braced if/while/standard for, expression statements, break/continue/return, ordinary direct/nested calls, scalar return, recursion and return completeness | Do-while, switch/fallthrough, interrupt/indirect calls and stack controls |
| Aggregates | One-dimensional fixed/inferred initialized arrays of scalars or scalar-field structs; zero extent; exact array/struct parameters; literal initialization; fields/index places; transitive const permission; fixed queries | Nested structs/arrays, unsized parameters, whole aggregate assignment/copy/return matrix |
| Intrinsics | `peek`, `poke`, `peekw`, `pokew`, `lo`, `hi`, fixed `sizeof`/`offsetof`/`length` | Remaining built-ins, character conversion, raw/native embed and qualified target capabilities |
| Storage | Symbolic module/local/parameter identity and source scopes | Zeropage budgets, place constraints, loadable data/publication, actual addresses and SFA |

This is a partial implementation profile, not a new language dialect or source
restriction. Record each encountered unchecked form/region at its source span.
Do not emit retired aggregate-rejection codes or require users to rewrite legal
forms. Unused ordinary source declarations in a reachable module are checked;
unreachable modules receive header indexing only. A pending callee/type affects
dependent checks, but independent admitted siblings continue (AR-P4, AR-P5).

## Module Graph and Binding

Upstream AR-028/AR-030 and Chapter 10 own discovery and entry semantics. Read
headers for all snapshot sources; module names, never paths, determine identity.
Group all contributions to one case-sensitive module. Start from effectiveEntry;
follow named imports and module-qualified type/value references transitively.
Declaration-only cycles are legal. Obtain declarations before checking bodies.
Resolve exported names and import aliases; check duplicate merged declarations
and local aliases. Do not search directories again or reread source bytes.

Keep every binding's declaration identity as sourceId plus raw declaration span;
fully qualified names are presentation/schedule keys, not local identity. Module
declarations are order-independent; local declarations become visible after their
initializer; parameters share the outer body's duplicate-name domain. Child
scopes may shadow and restore the outer binding. These are Chapters 03 VAR-5–8,
05 CF-4 and 06 FN-13, not new rules.

Selected reachable graph has exactly one `main(): void`; multiple reachable
entries, wrong signature and ordinary calls to main use Chapter 14 codes. A
different entry in an unselected target module is not a collision. A missing
required dependency cannot produce an accepted graph; if no admitted normative
predicate proves its public diagnostic, retain an unresolved dependency obligation
rather than assigning an unrelated code. Known-module missing export is E10012.
Profile module demand remains incomplete until its real qualified owner exists.

## Types, Constants and Ordered Expressions

Chapters 02 TS-2–13, TS-17–25 and 04 own types/expressions. Retain width,
signedness, conversion kind, compile-time versus runtime context and source span
on typed nodes. Numeric literals adapt only where the chapter permits. Same-sign
widening is explicit in typed facts; mixed-sign, narrowing, Boolean arithmetic,
unsigned negation and void misuse use the precise published root diagnostic.

True constant contexts use exact integer arithmetic, then validate declared
ranges and full-precision extents/sizes. Use `bigint` for exact intermediate
integers, not host floating-point or bitwise operators that silently truncate.
Runtime-expression facts retain operand-driven width and deterministic wrapping,
signed right-shift and saturated wide counts. Assignment is not a constant
expression. Constant division by zero is E10160; do not fabricate a constant
runtime-zero result or a hidden safety check.

Retain explicit short-circuit and selected-conditional arms in typed syntax.
Ordinary operands/callee/arguments preserve left-to-right order. Assignment stores
its once-evaluated place and converted RHS value; compound assignment preserves
place, old read, RHS, operation and one store. Its result is the written value,
not a destination reload. Nested argument calls keep source grouping/order; this
plan does not allocate their staging homes.

Semantic reaching-value proof is small and conservative: literal/const and one
unmodified reaching local value suffice. Invalidate facts on aliasing writes,
calls or volatile effects that can affect the binding. Emit W10161 instead of
W10160 only when exact narrow wrap before widening is proved. Keep W10100 and
W10101 under their distinct predicates. Backend-dependent cost warnings require
their later machine evidence; do not guess a cycle number here.

## Structured Flow and Direct Calls

Chapters 05 and 06 govern scopes, Boolean conditions, return completeness and
recursion. Flow records normal, return, break and continue exits and assignment
facts keyed by binding/place identity. Branch joins intersect definitely assigned
facts; loops do not assume a body executes. W10190 applies only to function-local
reads before assignment. Partial array initialization tracks the proven element
range; an unproved dynamic read remains potentially uninitialized. Do not insert
storage clearing or runtime initialization checks.

For-loop initializer and update lists are ordered. Continue flows through update;
break/return bypass it; omitted condition is true. Recognize only Chapter 05
§7.4's bounded canonical induction predicates for E10262; body/call modification,
mutable bound or another explicit exit defeats that proof. Intentional ring/wrap
or infinite loops remain legal. This is not a general termination solver.

Check direct call signatures and each independently checkable supplied argument.
Wrong arity poisons the result but never suppresses an independent argument error.
Aggregate parameters are by reference with exact shape and permission; scalars
are by value. Detect recursion over actual direct callee edges, not repeated
nested invocation syntax. Cycle errors carry complete ordered call-edge locations.
Unresolved/unchecked call targets cannot disappear from the proof.

## Aggregates, Places and Intrinsics

Chapters 07/08 own nominal struct identity, ordered no-padding fields, full-size
domain, array shape and initialization. Implement complete literals for the
admitted scalar-field struct; validate missing, reordered and unknown fields.
Resolve array extent inference only from an initializer, never a runtime count.
Check exact parameter types and recursively read-only field/element access.
Const does not imply no mutable alias. No runtime borrow machinery is introduced.

Direct unbarriered integer-producing subscript operators widen byte/sbyte to
word/sword before evaluation. Parentheses/selected conditional arms retain the
context; explicit narrow casts, completed narrow assignments and called narrow
results are barriers. All integer final indices are legal. Known negative or
out-of-extent ordinals use E10240; noninteger indices use E10263. Retain element
size, sign extension, modulo-65536 address meaning and options as symbolic facts,
not a chosen instruction or actual address.

All fixed size/count/offset queries return word, including values below 256.
Validate extents and object sizes in 0..65535 using full precision. Array fill
uses exactly one compile-time constant element and an explicit extent. Preserve
partial initialized ranges and W10140/W10141 without fabricating zero bytes.
A local uninitialized nonzero array may receive both declaration W10141 and read
W10190. Zero-length arrays are legal but every known index is outside the extent.

Raw memory intrinsic signatures come from Chapter 12 §3. Preserve dynamic word
addresses, operand evaluation once in order, volatility, byte/word width and
low-byte-before-high-byte access. `lo`/`hi` return byte. No literal-address
restriction or pointer scratch is assigned by this frontend.

## Effects and Initializer Schedule

After direct-call recursion validation, propagate finite may-read/may-write sets
and opaque volatile barriers through the actual call graph. Aggregate parameter
effects substitute caller places conservatively; may-alias means no invented
disjointness. These focused summaries serve initialization and reaching-value
checks now, not a generalized whole-machine alias or lifetime framework.

Chapter 10 §5.4 owns scheduling: actual direct/transitive reads create predecessor
edges; imports alone do not. Ready initialized variables order by fully qualified
ASCII name; observable independent effects preserve that schedule. Writes alone
do not require the destination's initializer first. Opaque MMIO effects remain
conservative barriers. An actual cycle uses E10194 with its initializer/call/read
path. Const data is not runtime initialization. Pending effects imply incomplete
analysis, not a guessed legal schedule or false cycle.

## Service Boundary

`AnalysisResult` is a readonly union with `kind` and ordered `diagnostics`:

| Kind | Additional fields | Meaning |
|---|---|---|
| `complete` | `program: TypedProgram` | Every required admitted frontend check finished, no error/poison/unchecked obligation |
| `error` | No `program` | Proved invalid source; all required analysis obligations completed |
| `incomplete` | `obligations: readonly AnalysisObligation[]`; no `program` | At least one required check unfinished; independent proved diagnostics retained |

An obligation has fixed kind `syntax`, `implementation`, `dependency`, `profile`,
`asset` or `analysis-limit`, the proving source span (nullable only for global
limits), and a safe short explanation. These are internal completion facts, not
new public diagnostic codes. Incomplete takes precedence over error when both
exist; diagnostics still retain their original error severity. Stage completion
is not full selected-profile, backend, storage, artifact or language conformance.
Even `complete` cannot be used as public `blendc check` until the remaining
required selected-profile checks have a real consumer/implementation (AR-P4).

`TypedProgram` owns reachable source modules, resolved types/bindings, typed
declarations/bodies, direct call/effect facts and initializer schedule. Preserve
source associations, symbolic storage class, place identity, conversions, wrap,
volatility, access order and control structure. It contains no poison, unchecked
node, host absolute path, MMIO constant, opcode, segment, address or SFA home.
Only the complete branch exposes it; intermediate partial facts stay internal.

## Testing and Evidence Limits

ST-15–ST-44 and ST-46–ST-48 own module/semantic/integration expectations.
Tests inspect typed facts and independent constant/flow conclusions; no custom
interpreter or emitter is added. Actual target execution, allocation, cycles,
bytes and expert parity remain Unknown until later pipeline evidence exists.
