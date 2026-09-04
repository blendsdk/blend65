# Compiler Engineering for a Constrained 6502 Target

Use this reference when reviewing or changing semantics, allocation, IL, lowering, ABI,
diagnostics, or optimization. The objective is a small compiler whose representations preserve
exactly the information needed to emit strong 6502 code.

## Order of obligations

Evaluate a feature in this order:

1. **Expressible:** a modern programmer can state the useful program without target folklore.
2. **Defined:** the language fixes types, evaluation order, overflow, aliasing, side effects, and
   failure behavior.
3. **Correct:** every legal program is preserved through every compiler stage.
4. **Target-legal:** emitted instructions, addressing modes, memory placement, and runtime behavior
   are valid for the selected CPU and platform.
5. **Competitive:** hot paths meet expert assembly locally, while whole-program knowledge should
   create opportunities to beat a human implementation.

Do not trade an earlier obligation for a later one. A faster miscompile and a correct feature that
ordinary game code cannot express are both failures.

## Pipeline review

### Lexer and parser

- Derive the accepted language from the frozen grammar and prose together; record contradictions.
- Test complete constructs and recovery behavior, not just isolated token or node production.
- Confirm precedence, associativity, delimiter recovery, source spans, and malformed-input progress.
- Require every error path to consume input or terminate; recovery loops must not hang.
- Do not put type knowledge or target restrictions into parsing merely because it is convenient.

### Semantic analysis

- Give every expression one explicit type and every name one resolved declaration.
- Enforce signedness, width, narrowing, wrapping, constant-expression, and evaluation-order rules
  before lowering.
- Model scopes by declaration identity, not spelling. Two declarations with the same source name
  must never collapse onto one storage identity.
- Check intrinsic signatures exactly like normal functions unless a documented semantic rule
  requires special handling.
- Preserve volatility and observable ordering for MMIO. No later stage may infer that repeated
  hardware reads are stable or that adjacent writes can be widened.
- Make alias and by-reference behavior explicit enough that stores cannot be reordered across
  potentially overlapping objects.

### Static allocation and ABI

- Start from the whole call graph, including indirect or interrupt roots that the language permits.
- Prove frame overlap from mutually exclusive lifetimes; never infer safety merely because a test
  program happens not to use both paths concurrently.
- Treat mainline/interrupt reachability intersections as reentrancy hazards.
- Account separately for parameters, locals, return homes, compiler temporaries, indirect-pointer
  pairs, interrupt scratch space, hardware stack, and reserved platform zero page.
- Keep the calling convention visible: register inputs/outputs, clobbers, flags, scratch ownership,
  parameter evaluation order, and interrupt preservation must be written contracts.
- Reject recursion or reentrancy when the allocation model cannot support it. Diagnose the user
  construct; never let it surface later as an allocator ICE.

### Intermediate representation

- Preserve semantic facts until their last profitable consumer. Examples include constants,
  symbolic addresses, byte selection, volatile access, branch conditions, and alignment demand.
- Represent values by identity and type. Avoid encoding meaning in generated symbol names or
  instruction sequences that later passes must reverse-engineer.
- Use the narrowest IR that covers current language behavior. A target-independent abstraction is
  not automatically simpler than a direct target-aware operation on a single-target compiler.
- Add a new variant when extending an old one would let existing consumers accept a value with the
  wrong width, address interpretation, or side effects. Exhaustive unions are valuable only when
  their distinctions represent real semantics.
- Keep link-time constants symbolic. Do not materialize an address, divide it at runtime, and then
  discard most of the result when the assembler/linker can resolve the expression for free.
- Every legal variant needs an explicit consumer disposition: handle, deliberately preserve, or
  diagnose. Silent fall-through is a miscompile.

### Lowering and instruction selection

- Lower conditions directly to control flow when their value is consumed only by a branch. Avoid
  materializing `0`/`1`, storing it, and reloading it.
- Select from known value location and liveness: immediate, accumulator, X/Y, zero page, absolute,
  symbolic address, or memory. Do not reconstruct that state from prior text output.
- Track processor flags as values with producers, consumers, and clobbers. A comparison is free
  only while its flags remain live and have the required signed/unsigned meaning.
- Prefer fall-through layout and explicit branch inversion over unconditional jump cleanup after
  the fact.
- Keep direct-address objects direct. Form indirect pointers only for genuinely dynamic addresses.
- Avoid copying aggregates or assets when placement, indexing, pointer selection, or ownership can
  make the hardware read the original bytes.
- Make unsupported legal constructs fail at a semantic boundary with a stable diagnostic rather
  than deep in translation or serialization.

## Optimization strategy

Use this priority order because earlier tiers preserve more information and usually produce larger
wins with simpler proofs:

1. **Semantic and constant evaluation:** fold language constants and symbolic link-time facts.
2. **Shape-aware lowering:** choose direct loop, branch, call, address, and aggregate forms.
3. **Local value propagation:** reuse known registers/immediates and remove redundant loads/stores.
4. **Control-flow layout:** fall-through, branch inversion, jump threading, unreachable removal,
   then branch-range repair.
5. **Target idiom selection:** strength reduction, addressing-mode selection, flag reuse, and
   register-aware sequences.
6. **Peephole cleanup:** remove small residual patterns after the structured decisions are gone.
7. **Whole-program work:** placement, call-graph specialization, cross-routine allocation, and
   globally consistent resource use.

An empty peephole stage is not an optimizer. Conversely, important optimizations may live in
lowering or layout; inventory transformations by observable effect rather than directory name.

### Pass proof checklist

For every transformation state:

- the matched preconditions and type/width constraints;
- flags read, produced, or clobbered;
- registers and memory locations read or written;
- volatility and alias restrictions;
- branch and fall-through effects;
- CPU variants for which it is legal;
- whether it can create another match and how iteration terminates;
- the before/after bytes and path-specific cycles;
- a counterexample that must not transform.

Prefer one-pass structured transformations. Use fixed points only when transformations genuinely
enable each other, and bound them with a reasoned convergence rule.

## Diagnostics

- Distinguish user errors, target/resource limitations, and internal compiler defects.
- A legal frozen-spec program must not ICE. If implementation is intentionally incomplete, emit a
  precise unsupported-capability diagnostic until the feature is built.
- Never use a warning to legalize a wrong program or a miscompile.
- Test diagnostic code, primary span, stable message substance, related spans when useful, and
  continued analysis only when recovery is safe.
- Detect restrictions at the highest layer that understands the user's construct; do not leak IR,
  allocator, assembler, or planning terminology.

## Simplicity review

Before retaining an abstraction, identify its current callers and the semantic variation it
encapsulates. Prefer deletion or direct code when it has one speculative implementation, mirrors
another model, or exists only so tests can test the abstraction itself.

Useful seams normally separate independently testable semantic transformations or real target
variation. Warning signs include versioned schemas for internal transient data, publication and
replay protocols without external consumers, generated catalogs that duplicate source authority,
and validators whose inputs can only be produced by already-valid constructors.
