# Intermediate Representation and Optimization Doctrine

> **Construction status**: Candidate knowledge for the unqualified `0.3.2-compiler-knowledge`
> build. This module specifies semantic payload and proof duties, not a mandatory IR count or pass
> framework.

## Optimization Contract

Optimization changes the represented program and usually changes its assembly. Correctness means
the transformed program has the same specified observable behavior for every applicable input and
machine state. Success additionally means the intended output-quality improvement actually
occurred. These are separate questions and require separate expectations:

1. **behavior oracle** — proves semantic equivalence; and
2. **assembly/cost oracle** — proves the intended transformation and its claimed cycle, byte,
   memory, zero-page, stack, data-movement, or layout effect.

An assembly golden alone can bless a miscompile. Optimized-versus-unoptimized differential
execution alone can let two paths share the same lowering defect. A test that checks only the final
value can miss reordered or duplicated MMIO. Use the smallest decisive combination, but never omit
one oracle because the other is convenient.

## Representation Policy

Blend65 does not require a single IL, SSA, a DAG, a textual pseudo-assembly layer, or a fixed number
of passes. A representation earns its existence when a current responsibility needs facts that the
previous representation cannot safely express or transform. Combining stages is valid when their
contracts remain clear. Splitting them is valid when distinct semantics, target legality, or proof
rules require it.

Use this boundary test: if a later stage must guess a distinction that an earlier stage knew, the
representation is insufficient. If a proposed representation only mirrors another compiler's
architecture without a current Blend65 consumer, it is overengineering.

## Mandatory Semantic Payload

Until its accountable consumer deliberately discharges it, preserve:

| Payload | Why it matters | Unsafe early erasure |
|---|---|---|
| scalar width | intermediate wrap, carry propagation, load/store size | folding in host integer width and truncating only at assignment |
| signedness | comparisons, right shift, division/remainder, widening | using one unsigned compare after type information disappears |
| arithmetic context and overflow/wrap rule | TS-18 full-precision constants versus TS-9/TS-20 runtime-width wrap | applying one arithmetic model to both contexts |
| array ordinal context, element size, and extent source | direct index promotion across every integer-producing operator, address scaling, constant/runtime bounds, and fixed versus caller-count `length()` | wrapping byte operands before an unbarriered subscript operation or selecting legality from backend addressing tier |
| nominal type | enum/conversion diagnostics and legal operations | treating every byte-backed enum as an interchangeable byte too early |
| place versus value | assignment, address-of, volatile access, aliasing | converting every lvalue to a load before address use is known |
| evaluation order | calls and side effects in arguments/expressions | commuting operations because their arithmetic result matches |
| short-circuit/selected arm | unexecuted effects must remain unexecuted | evaluating both `&&`, `||`, or `?:` operands eagerly |
| volatile operation identity | each access is observable | commoning two reads or deleting an overwritten write |
| memory width/count/order | device protocols and word byte order | widening two MMIO bytes into an unsupported opaque operation |
| alias and escape | load/store/call invalidation and SFA lifetime | assuming by-reference arguments do not overlap |
| symbolic storage identity | relocation, address-taking, layout, diagnostics | baking a provisional address into arithmetic |
| storage class/lifetime | SFA versus global/platform ownership | assigning helper scratch outside final SFA closure |
| placement/alignment/bank visibility | device-visible data and legal addressing | treating asset constraints as a late text directive |
| CFG, source-handler, and entry-variant identity | reachability, raw/firmware interrupt ABI, loops, layout | flattening IRQ and mainline into one ordinary call tree or using one IRQ tail for every sink |
| synchronous BRK contract identity | returning/non-returning successor, vector/handler effects, three CPU stack bytes plus handler peak | assuming fallthrough, a debugger, or a zero-cost opaque opcode |
| calls/helpers/clobbers | registers, flags, memory, scratch, reentrancy | treating a multiply helper as a pure arithmetic token |
| source association | stable diagnostics and explainable cost failures | losing the expression/function that caused a spill or range error |

The representation may encode these as types, operation attributes, effect tokens, explicit CFG
edges, side tables, symbolic operands, or another small form. The encoding is secondary; lossless
use is mandatory.

## Operation and Effect Model

Each operation needs enough information to answer:

- what value it computes, at what width and signedness;
- which memory or machine state it reads/writes;
- whether the effect is volatile, trapping/diagnosing, or otherwise ordered;
- which control successors are possible and in what source order;
- which aliases, calls, or interrupts can observe the state;
- which registers/flags/scratch a lowering will define, use, preserve, or clobber; and
- which target capability is required.

For a function address, preserve source function identity separately from its numeric word. A
recognized platform sink can then select a raw or firmware-mediated interrupt entry without asking
a late peephole to infer stack ownership from an address. If one logical handler needs several
entry variants, each is a distinct root with its own save/tail/cost facts and SFA reachability.
Outside a recognized sink, `&interruptFunction` denotes the raw-entry address. A visible store of
that address to an exactly known incompatible firmware vector is a compile-time ABI error, not an
optimization opportunity.

For `&local`, preserve the local identity and dynamic source-lifetime dependency separately from
the numeric `word`. Propagate the dependency through identity copies, casts, conditional selection,
`lo`/`hi`, arithmetic, and bitwise derivations; do not propagate it to data loaded through the
address. The semantic/effect layer must identify the first return, longer-lived store,
asynchronous publication, retaining call, or opaque boundary that would cross the referent lifetime
and issue E10260. A call argument carries its exact transitive non-retaining/retaining status by
position. Optimization cannot erase this provenance, turn an automatic local into persistent
state, or make legality depend on whether a call was inlined.

Do not call an operation “pure” merely because it returns a value. A memory-mapped read can change
device state. A helper call can clobber scratch. An explicit CPU-control intrinsic changes flags or
interruptibility. Address computation may be pure while the load/store using it is observable; keep
those identities distinct.

A BRK node remains a control-and-machine-effect operation until the selected platform contract is
bound. Legalization may emit only `$00 $EA`; it must not synthesize a vector, handler, trap block,
or runtime. The CFG uses the contract's exact successor kind, and stack/resource analysis charges
three CPU-pushed bytes plus the handler peak. If no contract exists, semantic target validation owns
E10259 before emission.

## Memory Effects and Volatility

Every `peek`, `peekw`, `poke`, and `pokew` access is side-effectful under the frozen language
contract, including a variable address. Represent address calculation separately from the ordered
access. Preserve:

- exact access identity and source order;
- read versus write and byte/word width;
- little-endian byte order for word access where specified;
- the symbolic or computed address and alias class;
- volatile/device identity when known from a selected platform; and
- surrounding barriers, interrupt-state changes, and call effects.

Two reads from the same MMIO address cannot be common-subexpression eliminated merely because their
address matches. Two stores cannot be merged merely because the first value is overwritten in
ordinary RAM. A target-specific device contract may justify a narrow transformation only when it
proves identical observable count/order and the rule names that contract.

Normal RAM operations can use alias/effect analysis. Unknown pointers, by-reference aggregates,
escaped addresses, and external calls conservatively invalidate only the facts they may observe;
avoid both unsound optimism and a global “all memory always changes” policy.

A legal borrowed local address also contributes alias and liveness edges. A memory optimization may
shorten that borrow only after its last derived use; it may never move a use past block exit, loop
reincarnation, function return, or another lifetime boundary. Separate domain-specific SFA homes
can require separate fixed-address machine variants, and their ROM/RAM/ZP cost is part of the
selection report.

## Arithmetic and Constant Evaluation

The constant evaluator and runtime lowering share operator precedence, operand conversions,
signedness, side-effect order, and the other rules that the specification makes common. They do
not share one arithmetic-width model. A true constant-expression context uses the full-precision
evaluation and declared-type range check from Chapter 02 TS-18. An ordinary runtime expression uses
the operand-determined intermediate width and deterministic wrapping from TS-9 and TS-20, even when
all operands happen to be foldable literals. Constant folding must preserve the semantics of the
expression's context; foldability alone never changes a runtime expression into a TS-18 constant
expression.

Array subscripting adds one specified context to that rule. Direct unbarriered byte/sbyte operands
promote before every integer-producing unary or binary operation into a signedness-preserving
16-bit ordinal domain. The covered operators are unary `~` and `-`, plus `+`, `-`, `*`, `/`, `%`,
`<<`, `>>`, `&`, `|`, and `^`; existing legality still rejects unsigned unary minus. Comparisons and
logical operators produce `boolean`, so they cannot become indices. An explicit narrow cast, typed
8-bit assignment, compound assignment, or already-completed callee result remains a narrow barrier.
IL must preserve that distinction, the final ordinal's signedness, the element-size scale, and
whether the bound is a fixed constant or an any-size parameter's caller-supplied word count. It may
replace word work with byte work or feed carry straight into address formation only after proving
the complete ordinal and effective-address behavior identical. Array declaration size is never a
source-legality tier.

Examples of required discipline:

- `let runtime: word = byte(250) + byte(10)` has runtime-expression value `word(4)`: the byte
  intermediate wraps before widening. `const folded: word = byte(250) + byte(10)` has
  constant-expression value `260`: TS-18 evaluates it at full precision, then checks that `260`
  fits `word`. A `const byte` destination would report E10084 rather than wrap.
- signed right shift retains sign semantics through legalization. At counts at least the width, a
  negative signed operand yields `-1`; non-negative and unsigned right shifts yield `0`.
- signed comparison cannot become a generic unsigned `CMP` relation after signedness is erased.
- division/remainder transformation must preserve truncation toward zero, the identity
  `r = a - trunc(a / b) * b`, the dividend sign of a nonzero signed remainder, zero-divisor
  behavior, and the exact quotient/remainder field being claimed. A plain arithmetic shift or mask
  is therefore not a general replacement for a negative signed operand.
- strength reduction for multiplication or division by a constant includes code size, cycles,
  scratch, clobbers, and boundary values—not just an algebraic identity.

Host-language behavior is never the oracle. Use explicit width masks, signed interpretation, and
reference operations derived from Blend65 semantics.

Packed-decimal arithmetic is not an ambient mode on ordinary arithmetic. Preserve `bcd_add` and
`bcd_sub` as explicit semantic operations with byte/word width, operand evaluation order,
valid-digit facts, owned carry/no-borrow input, result wrap, complete flag effects, and a D-clear
exit. Constant folding rejects a statically invalid digit and otherwise computes modulo 100 or
10,000. Runtime-invalid digits remain a selected-CPU behavior boundary, so an optimizer cannot use
decimal algebra without a digit-validity proof.

Legalization normally emits an inline `SED`, owned `CLC`/`SEC`, the ordered low-to-high
`ADC`/`SBC` chain, and `CLD`; it does not introduce a helper or linked runtime. It may coalesce
adjacent decimal regions only when every operation still owns its carry input, no ordinary
arithmetic, address formation, call, or mismatched control-flow edge enters the region, every
interrupt path preserves decimal state, and the region exits with D clear. Raw `asm_sed()` remains
an opaque ordered effect. It cannot change ordinary operator meaning or justify folding an
ordinary `+`/`-` as BCD.

## Control Flow and Layout

Build explicit control flow for branches, loops, short-circuit operators, conditional expressions,
switch auto-break/fallthrough, early return, and interrupt entry. Preserve source evaluation edges
until effect ordering is settled.

A `for (I; C; U) B` loop has ordinary expression semantics, not a hidden mathematical range.
Lower it to explicit initializer, condition, body, update, and end blocks. `I` runs once; `C` runs
before every possible iteration; `U` runs after normal body completion and `continue`; `break` and
`return` skip `U`. Preserve left-to-right initializer/update lists, present-condition effects,
ordinary mutation, and fixed-width wrap. An omitted condition is the constant `true`.

Recover counted-loop facts through a bounded canonical-induction analysis over that CFG. Prove the
initial value, invariant bound, stride, aliases/escapes, body and call effects, every exit, and every
observable induction value before folding a test, narrowing a semantic counter, or using wrap as a
machine exit. For example, a non-escaping `word` induction from 0 to the exclusive constant 256 may
use `INX/BNE` when the body needs only its low byte. E10262 rejects a canonical finite-looking
`byte` spelling when the same bounded proof shows repetition before its invariant condition can be
false and there is no other explicit exit; deliberate modular and infinite loops remain legal. An
unrecognized loop remains correct generic CFG code. Do not add a parallel range IR, general
termination solver, or generalized loop framework merely to recognize this family. Any widened
value, materialization, or spill is charged through SFA.

Machine block layout may invert conditions, choose fall-through, merge tails, or reorder blocks
only after proving identical reachable effects. Branch range is a post-layout machine constraint;
repair it on structured machine operations with a deterministic relaxation rule. Do not rely on an
emitter string rewrite or assume all conditional branches reach after later code/data layout.

Timing becomes semantic only where the program/platform contract makes it observable. For a raster
kernel or cycle-declared API, layout and page-crossing assumptions belong in the behavior/cost
oracle. For ordinary code, timing is an output-quality metric rather than language behavior.

## Calls, Helpers, and Clobbers

A call operation carries direct/indirect target information, argument evaluation order, parameter
and return types/homes, memory effects, escape/reentrancy class, register/flag clobbers, and source
identity. A helper introduced by legalization is a real call or machine region with the same
obligations. It is not a free abstract opcode.

Before selecting a helper, account for:

- call/return instructions and reachable code bytes;
- parameters, return home, SFA scratch, spills, and ZP pairs;
- A/X/Y and flag clobbers;
- interrupt/reentrancy safety;
- static helper/table data and alignment;
- call frequency and hot-path cycles; and
- opportunities lost by opaque helper boundaries.

A locally shorter instruction sequence can lose at whole-program scale if it pulls in a helper,
table, or non-overlapping frame. Conversely, one shared helper may beat repeated inline sequences.
Measure equivalent work at both local and program scope.

## Machine State and Explicit Low-Level Effects

The 6502 status register is not one interchangeable boolean. Track at least the validity and owner
of carry, zero, negative, overflow, decimal, and interrupt-disable facts when a transformation uses
them. An instruction can leave a flag unchanged, define it from a different value, or make a
previous relation stale.

Explicit CPU-control and stack intrinsics are ordered machine effects. Their specified flag/stack
changes, barriers, and ABI obligations must survive optimization. They do not permit unrelated
ordinary operations to move across an interrupt-enable/disable boundary when an interrupt could
observe the movement.

An NMOS interrupt entry is not proof that decimal mode is clear. The selected interrupt ABI must
establish the handler-body decimal contract before generated arithmetic or ordinary helper calls.
For a chained C64 CINV variant, status preservation around the body is observable because the prior
handler may inspect the inherited flags. Eliding `PHP; CLD; PLP` or a raw/exclusive `CLD` therefore
requires proof of both the body-entry state and the outgoing chain/return state; a local unused-flag
observation is insufficient. Indirect-chain pointer placement must also respect the NMOS
`JMP ($xxFF)` high-byte wrap rule.

Target instruction details and silicon hazards belong in the later CPU module, but this IR must
carry enough facts for that module to act. A peephole pass cannot reconstruct which signed relation
an erased branch meant or whether a stale overflow flag is valid.

## Legalization

Legalization converts a well-defined semantic operation into forms supported by the selected CPU
and ABI. It may split widths, introduce helper calls, create control flow, request pointer pairs,
or expose carry chains. It must preserve all observable behavior and declare every new resource.

Legalization is not emission. Its output remains structured, with operands, effects, clobbers,
symbolic storage, and source association. Any new temporary, spill, parameter/return home, or helper
scratch returns to [final SFA closure](sfa-and-abi.md#final-storage-closure). An asset relocation or
VIC bank constraint goes to platform layout instead.

Dynamic `POKE(address, value)` illustrates the boundary: evaluate the address and value in language
order, retain the volatile write, legalize to an indirect-addressable machine form, request any
pointer home through SFA, bind resources, then select and emit the target instructions. Rejecting the
source because direct absolute store needs a constant is a missing lowering.

## Optimization Layers

| Layer | Suitable work | Required proof |
|---|---|---|
| Semantic canonicalization | constant folding, identity simplification, unreachable edges, known condition | exact Blend65 width/wrap/effect/order semantics |
| Whole-program analysis | reachability, call effects, constants, dead routines/data, SFA interference | explicit roots, escapes, callbacks, initialization, and closed-world boundary |
| Legalization | unsupported width/op split, helpers, address forms | equivalent values/effects plus complete resource and clobber inventory |
| Instruction selection | flags, addressing modes, transfers, RMW, branch forms | legal CPU sequence and complete machine-state/cost model |
| Resource binding | A/X/Y/flags, ZP/static homes, spills | liveness/interference, ABI, interrupt safety, SFA closure |
| CFG/layout | fall-through, inversion, block order, tail merge | control/effect equivalence; timing assumptions stated |
| Branch repair | expand out-of-range branches after layout | legal ranges, monotonic convergence, disclosed timing/size change |
| Target optimization | 6502 strength reduction, addressing narrowing, load/store removal | CPU effects/flags/MMIO/ABI/page behavior preserved |
| Peephole cleanup | small residual contextual substitutions | narrow complete pattern; no missing upstream semantic fact |

This table does not mandate nine pass objects. It separates proof regimes. One implementation step
may cover several rows when it retains their facts and tests.

## Pass Rule Packet

Every transformation rule—whether coded as a pass, selector pattern, or local rewrite—states:

| Field | Required content |
|---|---|
| Match | exact operation/control/machine pattern |
| Applicability | types, constants, target variants, liveness, alias/effect and range conditions |
| Semantic preconditions | width, wrap, evaluation order, memory/volatile and interrupt assumptions |
| Consumed/generated facts | which distinctions are discharged or newly created |
| Machine effects | registers, flags, stack, scratch, calls and MMIO |
| Placement in pipeline | why it occurs before/after legalization, allocation, layout, or branch repair |
| Cost model | bytes, cycles by path, data, ZP, frame, stack, helpers, page/layout assumptions |
| Counterexample | smallest input/state that fails if a precondition is omitted |
| Behavior oracle | independent expected effects/results |
| Assembly/cost oracle | exact shape or bounded metric proving the intended win |

An optimization catalog is useful only if each entry has this packet. Do not create a registry,
plugin protocol, or rule DSL merely to store a handful of direct transformations.

## Fixed Points and Pass Order

Repeat a transformation only with a termination measure, such as fewer operations, a monotonically
widening legal branch form, or a finite lattice reaching stability. A rewrite cycle between equal
forms is a compiler bug even if a hard iteration cap prevents hanging. The cap may diagnose the bug;
it is not the proof.

Order passes from dependencies:

- a rule needing signedness runs before signedness is deliberately discharged;
- helper/resource discovery precedes final SFA closure;
- resource binding uses finalized or iteratively refined liveness;
- final block layout precedes definitive branch-range checks;
- any size-changing repair may require another bounded layout/range iteration; and
- peepholes run only after their contextual flags/liveness facts are available.

Do not order passes by tradition or to make current goldens pass.

## Two-Oracle Proof

### Behavior oracle

Derive expected behavior from the reconciled language specification, selected CPU semantics, ABI,
and platform contract. Observe every relevant channel:

- return value and ordinary memory;
- MMIO address, width, value, identity, count, and order;
- call/helper and alias-visible effects;
- live registers, flags, stack balance, SFA homes, and interrupt-visible state;
- control termination where specified; and
- timing only for an explicitly timing-observable contract.

Choose the smallest decisive method:

- exhaustive evaluation for tractable byte/state spaces;
- adversarial boundary sets for wider operations;
- a direct mathematical/reference oracle;
- assembled execution for exact machine semantics; or
- configured VICE for declared C64 behavior.

Physical hardware remains the final authority for silicon-sensitive behavior, but routine compiler
development normally uses PC-hosted source/assembly checks and VICE. Hardware QA is targeted near
release or when emulator fidelity is the disputed fact.
`[BLEND65-PROJECT-POLICY-P3-3541841b, Project-specific: C64 verification authority]`

### Assembly and cost oracle

Prove the transformed output actually contains the intended expert idiom or meets a precise
equivalent-work bound. Count all attributable costs:

- reachable code and data bytes, alignment/padding, relocations and branch repairs;
- cycles for relevant paths, including page-cross alternatives when possible;
- ZP, static frames, stack, spills, parameter/return homes, helper scratch;
- helper/table inclusion and call overhead; and
- copies, banking changes, setup, and amortization boundary.

Normalize equivalent work. A specialized routine processing one byte cannot be compared directly
with an expert routine processing eight. Report local parity and whole-program impact separately.
Meeting expert local output is the floor; a whole-program compiler should seek wins through global
allocation, consistency, reachability, specialization, and layout. Every measured “meet” that
cannot currently be beaten requires a GitHub issue before the compiler checkpoint can close. The
issue records the source/assembly pair, complete measured cost delta, and the concrete missing
optimization pass, IL form, allocation change, or platform-library primitive that provides a path
to the win. Issue creation is authorized for this parity debt; never push as part of that action.
This mutation rule is explicit project/process policy, not a language or optimizer semantic.
`[BLEND65-PROJECT-POLICY-P3-3541841b, PRIME DIRECTIVE — expert assembly game developer]`

## Counterexamples That Must Stay in the Test Set

| Tempting rewrite | Counterexample / missing proof |
|---|---|
| combine identical volatile reads | device may change or acknowledge state on each read |
| delete first of two MMIO writes | first write may trigger device behavior |
| reorder `f()` and `g()` arguments | Blend65 requires left-to-right observable effects |
| evaluate both conditional arms then select | unselected arm may call or write MMIO |
| fold byte expression in host integer width | specified intermediate wrap changes result before widening |
| erase signedness before compare/right shift | signed relation or sign extension is lost |
| overlay caller and callee temporary | caller value may remain live across call |
| regard outer `f(1, f(2,3))` as recursion | outer call is not active, but early marshalling would be clobbered |
| remove load after unknown by-reference call | callee may alias and modify object |
| choose short helper without global accounting | helper code/data/frame/ZP and call cost may reverse win |
| use stale status flags after intervening instruction | branch observes a different relation |
| add scratch in peephole/emitter | bypasses SFA closure and interrupt proof |
| place hardware asset by copying at runtime | wastes RAM/cycles; layout should place bytes where hardware reads |

## Verification Status Language

Use only evidence-supported status:

- **Verified** — the complete stated claim passed its declared behavior and assembly/cost oracles;
- **Verified partial** — a precisely bounded portion passed, with excluded dimensions named;
- **Inferred** — strong evidence supports the claim but decisive execution/measurement is absent;
- **Unknown** — evidence is insufficient or a required external/hardware observation is missing;
- **Incorrect** — a counterexample, semantic mismatch, or cost failure disproves the claim; or
- **blocked-conflict** — frozen authority disagrees on the field.

Never turn one passing fixture into optimizer-wide correctness, one emulator run into universal
hardware proof, or one instruction-count decrease into a whole-program win.

## Review Checklist

- Can every later decision read width, signedness, wrap, order, volatility, alias, and source facts?
- Does the transformation state exact applicability and a smallest counterexample?
- Are calls/helpers represented with full effects, clobbers, scratch, and cost?
- Does any new function storage return to SFA before closure?
- Are behavior and assembly/cost expectations independent?
- Does the behavior oracle observe MMIO count/order and interrupt-visible state when relevant?
- Does the cost oracle include code, data, padding, ZP, frame, stack, helpers, and setup?
- Is pass order derived from facts and termination proven for repetition?
- Is a peephole being asked to reconstruct information lost upstream?
- Is the design the smallest one that carries the required invariants?

## Sources

- `[BLEND65-PROJECT-POLICY-P3-3541841b, PRIME DIRECTIVE — expert assembly game developer]` — product/process authority for expert parity and tracked meet-level debt
- `[BLEND65-SPEC-P3-ed278ab9, spec/02-type-system.md §Intermediate Overflow, §Constant Expression Evaluation, §Right Shift Semantics, §Overflow Behavior]`
- `[BLEND65-SPEC-P3-ed278ab9, spec/04-expressions-operators.md §Arithmetic Operators, §Logical Operators, §Conditional Operator, §Memory Intrinsics]`
- `[BLEND65-SPEC-P3-ed278ab9, spec/06-functions.md §Parameter Evaluation Order, §SFA Calling Convention]`
- `[BLEND65-SPEC-P3-ed278ab9, spec/07-structs.md §Aliasing]`
- `[BLEND65-SPEC-P3-ed278ab9, spec/12-intrinsics.md §CPU Control Intrinsics, §Memory Intrinsics]`
- `[LLVM-CODEGEN-22, Code Generator chapter]` — comparative pass-responsibility evidence only
- `[LLVM-MOS-275C7FC, target implementation]` — comparative 6502 evidence only
