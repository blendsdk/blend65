# Static Frame Allocation and ABI Doctrine

> **Construction status**: Candidate knowledge for the unqualified `0.3.2-compiler-knowledge`
> build.
>
> **Binding specification rule**: Static Frame Allocation (SFA) is the sole general function-frame
> model. The 6502 hardware stack is not a general local-variable stack.

## Why SFA Is Binding

The 6502 hardware stack is one fixed 256-byte page shared by subroutine return addresses,
interrupt entry state, register preservation, and explicit stack operations. A conventional
per-call local frame consumes scarce stack space, needs costly indexed/indirect access machinery,
and either restricts call depth or introduces a software-stack runtime. The Blend65 design axioms
and memory model establish SFA as the general model for this language and target family.

This is a binding compiler-design constraint from the language specification, not permission to
weaken normal source semantics. SFA must support
ordinary function calls, nested argument expressions, left-to-right effects, by-reference
aggregates, target helpers, interrupts under a proven contract, and clear diagnostics for genuinely
unsupported dynamics. It must not make the programmer manually expose compiler temporaries or
rewrite `f(1, g())` into hardware-shaped code.

## Modern Source and Static Storage

Separate three concepts:

- **source call state**: values and effects required by normal language evaluation;
- **function-execution storage**: statically assigned parameter, return, local, temporary, spill,
  and helper homes; and
- **machine call mechanism**: `JSR`/`RTS`, registers, flags, and any explicitly bounded stack use.

SFA changes where call state lives; it does not change the source meaning. If an earlier argument
has been evaluated, its value remains live while later arguments run. If a later argument calls the
eventual callee, that is nested evaluation, not source recursion by the outer call. The allocation
and ABI must provide distinct staging so the inner call cannot overwrite the outer not-yet-invoked
call's homes.

## Storage Ownership Boundary

| Storage concern | Owner | Reason |
|---|---|---|
| parameters and return homes | SFA plus ABI | lifetime is tied to function/call execution |
| locals and address-taken locals | SFA | function lifetime and escape determine interference |
| expression temporaries | SFA | source evaluation order and calls determine lifetime |
| spills created by resource binding | SFA | they are new function-execution storage |
| compiler/runtime-helper scratch | SFA plus helper ABI | calls, interrupts, and clobbers determine interference |
| explicit module-level `zeropage { ... }` objects | platform allocation outside function-frame overlay; included in the target ZP resource ledger | program-lifetime user state must not be silently overlaid with compiler homes |
| module globals and constants | platform layout | program lifetime and segment/placement constraints, not function frames |
| sprites, charsets, bitmaps, SID data, lookup tables | platform layout and packager | hardware visibility, banking, alignment, load format, one object for each distinct path/selector/representation output, canonical-identical declarations aliasing that object, and no runtime or unrequested copy |
| startup/loader buffers | platform runtime/layout | artifact and phase-of-execution ownership |

SFA must not move or duplicate an emitted asset object to solve a frame problem. Separate selected
components or representations remain separate objects; canonical-identical embed declarations are
aliases for one object/address. Platform layout must not hide a spill or helper byte outside the SFA
proof. A VIC-compatible charset is laid out where the VIC can read it; a late legalization spill
returns to SFA.

## Frame Contents and Homes

The complete function-storage inventory includes:

| Class | Required facts |
|---|---|
| Parameter homes | type/size/alignment, by-value or by-reference, evaluation/marshalling lifetime, address-taking, callee ownership |
| Return home | type/size, producer/consumer lifetime, register/static split, nested-call survival |
| Locals | lexical scope, actual live range, address-taken/escape status, initialization state |
| Temporaries | defining/use operations, evaluation-order edges, calls crossed, alias/effect dependencies |
| Spills | value identity, width/alignment, live interval, reason, reallocation iteration |
| Helper scratch | helper identity, nested/helper-call graph, reentrancy/interrupt safety, clobber contract |
| Saved machine state | A/X/Y/flags/decimal/interrupt ownership, stack or static home, entry/exit balance |

A “frame size = declared parameters + locals” calculation is incomplete. Code generation becomes
unsound if later stages invent pointer pairs, word temporaries, return staging, or helper bytes that
were absent from the interference and budget proof.

## Lifetime Model

Prefer the smallest proven lifetime, but never a guessed one.

- A value is live from the point its current value becomes observable to the last possible use,
  including uses after calls and along all reachable CFG paths.
- Address-taken storage remains live and non-reusable while a legal alias can observe it. A local's
  borrow is bounded by its dynamic source lifetime: lexical block, current loop incarnation, and
  containing invocation. It never silently pins an automatic local for program lifetime.
- A parameter's source value may require a caller-side staging home before the callee's parameter
  home can be safely written.
- A return value remains live until consumed or copied to a non-clobbered home.
- A helper's scratch conflicts with any caller or asynchronous domain that can overlap the helper.
- Conservative whole-frame lifetime is safe but may waste RAM. Per-slot reuse is allowed only when
  liveness, aliasing, calls, and preemption prove non-overlap.

A three-clause `for` loop adds no allocation model. A header declaration is an ordinary local whose
lexical scope covers the condition, update, and body; each clause temporary follows its real CFG
definition/use paths. `continue` reaches the update block, while `break` and `return` do not.
Canonical-induction analysis may keep a semantic `word` counter only in an 8-bit register when all
wider values and addresses are unobservable or can be reconstructed exactly. Otherwise the normal
home and spill rules apply. There is no hidden iterator object, runtime frame, or range-owned
scratch.

A local-origin address keeps hidden provenance even though its source type is `word`. Identity
copies, casts, conditionals, `lo`/`hi`, arithmetic, and bitwise derivations retain dependency on
every contributing local address; data loaded through the address does not. A derived value may
live in local scalar or aggregate storage only when that storage's lifetime is proved contained in
the referent's lifetime. Return, longer-lived module/zero-page/raw/MMIO storage, an interrupt or
hardware publication, and any opaque boundary are escapes. Diagnose the first such use with
E10260. Never accept integer laundering as proof that the local dependency disappeared.

A callee parameter is non-retaining only when every reachable path dereferences, mutates, or
forwards the value solely within the referent lifetime. Forwarding is legal only to another proven
non-retaining argument position; returning, persisting, publishing asynchronously, or calling an
unknown/external consumer is retaining. Infer user-function summaries transitively over the whole
program and require an explicit library/platform contract. “Synchronous” is not a proof because a
synchronous callee may still save an address for later.

When the last legal borrow ends, a sequential invocation or later loop iteration may reuse the
same physical home; address freshness and cross-lifetime identity are deliberately unobservable.
A loop local has a distinct dynamic source lifetime each iteration even when its slot repeats. A
live borrow adds interference against every callee and feasible preempting domain. Concurrent
mainline/IRQ/NMI instances therefore need disjoint homes and, where a fixed `&local` constant
differs, domain-specific code variants or an equally zero-cost proven binding. Report the complete
ROM/RAM/ZP cost. Unbounded reentry remains E10245.

The allocator should be deterministic. Stable ordering by domain, function identity, storage class,
alignment, and source identity makes budgets and assembly comparisons reproducible.

## Call Graph, Roots, and Escape

Build a graph that is wider than direct syntax calls. It includes:

- direct calls;
- statically resolved indirect calls;
- helper calls introduced by legalization or selection;
- module-initialization and startup edges once their reconciled semantics are known;
- main/program entry;
- IRQ and NMI entry roots;
- exported, address-taken, externally installed, or raw-vector-callable functions; and
- any platform/runtime callback edge declared by the selected target contract.

Classify each edge as direct, finite indirect set, or unknown. An unknown edge is not silently
dropped. Use a conservative root/escape policy, require a checked platform contract, or issue an
unsupported-analysis diagnostic. State the RAM/ZP cost of conservatism.

Strongly connected components (SCCs) expose recursion or cycles. The frozen language prohibits
recursion; an SCC with a self-edge or more than one function receives the reconciled recursion
diagnostic before allocation. Never break an SCC arbitrarily and color it as a DAG. A bounded
policy would be a new authorized language/runtime capability, not an allocator detail.

## Interference and Reentrancy

Two storage homes interfere when their values can be live at the same time. Sources of overlap
include:

- caller values live across a callee;
- nested calls and argument staging;
- legal aliases that extend liveness within the referent's dynamic source lifetime;
- helpers called from more than one active path;
- mainline preempted by IRQ or NMI;
- IRQ preempted or nested according to the platform contract; and
- externally callable/address-taken functions with unknown entry time.

Mutually exclusive sibling calls may overlay when neither sibling is active while the other's
state is live and no asynchronous/escaped path defeats that proof. Caller and callee storage may
not overlay merely because their functions differ. A frame reachable from both mainline and IRQ is
not automatically safe: the analysis must prove the domains cannot overlap, allocate disjoint
instances/scratch, or diagnose the unsupported situation.

The reconciled interrupt-domain rule is:

1. model mainline, IRQ, NMI, startup, callbacks, and external entry as explicit execution domains;
2. apply the selected platform's masking, nesting, and preemption contract;
3. allocate disjoint homes for every invocation-private storage set that can be simultaneously live;
4. create a domain-specific machine-code variant only when absolute home references or specialized
   callees require it; storage-free code with identical call targets remains shared; and
5. diagnose an unbounded entry/nesting set or resource failure rather than accept corruption or add
   runtime dispatch.

Interrupt handlers, their materialized entry variants, and ordinary interrupt-context callbacks
are distinct ABI facts. A raw CPU entry owns its save/restore and terminates with `RTI`; a
firmware-mediated entry must use the firmware's existing stack frame and declared chain/restore
tail; a callback invoked through `JSR` terminates with `RTS`. The selected profile names recognized
function-address sinks, accepted source kind, exact entry variant, execution domain, and interrupt
source; never infer a sink from its spelling. Provenance survives direct scalar declaration,
assignment, copy, identity cast, and conditional merging while all source functions remain known
and storage has not escaped. Reject a known source-kind mismatch and erased/unknown provenance at a
recognized sink. A visible raw interrupt address written to an exactly known incompatible firmware
vector is also rejected. Only a genuinely opaque address is an uncertifiable hardware boundary.

Disjoint frames do not duplicate or serialize module/global state. Shared byte accesses remain
ordered by actual interrupt timing; a cross-domain read-modify-write sequence can lose an update,
and a multi-byte access can tear. Treat statically detected interrupt-shared state as asynchronously
observable, preserve access order, and warn on unprotected lost-update or tearing hazards. Never
silently mask interrupts, clone program state, or imply that frame separation provides atomicity.

## Overlay and Coloring Proof

Represent each allocatable home or conservative frame as a vertex. Add an interference edge when
simultaneous liveness is possible or cannot be disproved under the declared closed-world and
preemption assumptions. A color represents one compatible address range, not merely a number:
width, alignment, region, bank visibility, ZP suitability, and reservations must all match.

A valid overlay proof records:

- the roots and call/escape graph version used;
- the CFG/liveness facts or conservative frame rule;
- asynchronous-domain and masking assumptions;
- every width/alignment/region constraint;
- deterministic placement order;
- resulting static total and peak/interference total; and
- why every pair sharing a range cannot be simultaneously observable.

Example: `main` calls either `drawMenu` or `playLevel`, and neither can call the other or escape.
Their private non-address-taken homes can share compatible ranges. If `drawMenu` calls
`formatScore` while a `drawMenu` pointer remains live, those homes interfere. If IRQ can call
`formatScore`, its scratch also conflicts with any preemptible mainline use unless protected or
duplicated under the platform contract.

## Nested Argument Evaluation

Blend65 evaluates parameters left to right. The safe abstract sequence for `f(1, g())` is:

1. evaluate `1` and preserve it in an outer-call staging home;
2. call `g()` using its own proven homes and preserve its result;
3. marshal both results into `f`'s incoming homes without destroying either; and
4. call `f`.

For `f(1, f(2, 3))`, the inner call is complete before the outer invocation. It is not active
recursive execution, but it uses the same callee homes. Therefore the outer first argument cannot
be written early into a home the inner call overwrites. Caller-side staging, delayed marshalling,
or another statically proven scheme is required. Asking the source author to split the expression
is not a valid default solution.

By-reference arguments carry alias identity. If two arguments reference the same object, writes by
the callee and left-to-right address evaluation remain observable in the specified order; SFA or
optimization cannot assume independence.

## Zero-Page Allocation

Zero page is a scarce, selected-target resource, not a universal performance bucket. Model separate
classes where their requirements differ: explicit module-level user ZP objects, ABI parameter/return homes,
indirect pointer pairs, hot compiler temporaries, helper scratch, and interrupt-safe storage.

For every request retain width, alignment, addressable windows, reservations, lifetime/interference,
and fallback policy. A two-byte pair starting at `$FF` is invalid because the high byte would wrap to
`$00`; it must move to a fitting pair or produce the selected resource outcome. Do not silently
wrap. If a non-ZP home is semantically legal but slower, the allocator may place it in RAM only when
the lowering supports that form and the cost/status policy permits it. An explicit `zeropage`
request that cannot be honored follows the frozen target/resource diagnostic contract.

Report both:

- **static total**: all reserved bytes in the final artifact; and
- **peak/interference demand**: the simultaneously required bytes under the proven overlay model.

The report should identify the largest contributors, lost overlay opportunities, reserved target
ranges, and any interrupt-safe duplication. This makes a resource failure actionable.

## General RAM and Bank Visibility

Frame regions must lie in RAM visible to the CPU under the states in which the function executes.
Do not place interrupt-needed homes behind a bank configuration the interrupt contract cannot
guarantee. Reject overlap with platform-reserved regions, program code, loader state, globals, or
hardware-visible assets.

SFA consumes target windows and reservations through a declarative profile. It does not encode a
C64 map in language semantics. Later machines may have different RAM, ZP, banking, or ROM rules
while preserving the same language and SFA invariants.

## ABI Contract

The ABI is explicit data shared by call lowering, SFA, instruction selection, helper generation,
interrupt lowering, assembly review, and platform libraries. At minimum it states:

| Contract area | Required facts |
|---|---|
| Parameters | evaluation order, caller staging, incoming homes/registers, widths, by-reference encoding, alignment |
| Returns | void/scalar/aggregate policy, register/static homes, clobber lifetime, nested-call survival |
| Registers and flags | caller/callee-saved ownership for A/X/Y and relevant flags; condition-code lifetime |
| Calls | direct/indirect forms, helper equivalence, tail-call preconditions if supported |
| Stack | return-address depth, interrupt entry cost, saved-register order, explicit intrinsic effects, warning budget |
| Scratch | owner, width, nested-call behavior, interrupt/reentrancy class, SFA inventory identity |
| Entry/exit | startup state, normal function entry, source handler kind, raw/firmware IRQ/NMI variants, save owner, `RTS`/`RTI`/firmware tail, decimal/interrupt policy |
| Platform boundary | KERNAL/raw vectors or other platform entry conventions, bank state, callbacks, preserved device state |

The active recovery baseline is the ABI fixed by frozen [Chapter 06](../../../../spec/06-functions.md),
not an open architecture choice. Callers evaluate arguments left to right and store every argument
in the callee's static frame before `JSR`. Scalar and enum arguments are copied by value. Struct
and exact `T[N]` array arguments store a two-byte base address and are accessed by reference. An
any-size `T[]` parameter adds the caller array's full two-byte element count, for four SFA bytes per
concurrent parameter instance; the validated `0..65535` extent domain makes that count total. It is
only a parameter ABI form and cannot be stored or returned. A byte, sbyte, boolean, or enum result
returns in A; a word or sword returns in A (low byte) and X (high byte);
aggregate returns are rejected. Ordinary functions and ordinary address-taken callbacks use
`JSR`/`RTS`. An `interrupt function` is callback-only: its raw-vector variant uses the specified
save/restore sequence and `RTI`, while a compiler-recognized firmware sink selects the matching
firmware-frame and terminal variant. The C64 KERNAL CINV variants must not save A/X/Y twice.
Every compiler-generated interrupt body begins with the profile's declared decimal state. For the
NMOS C64 baseline that state is binary: raw and exclusive variants execute `CLD` and let the
eventual `RTI` restore the interrupted status, while the default chain holds one `PHP` byte across
the body and executes `PLP` before the prior-handler jump. Its two-byte saved-vector link must begin
at a low byte no greater than `$FE`. All normalization, link placement, and stack costs participate
in the same static ABI/resource proof.

Recovery must audit current lowering and output against that complete contract. A potentially
better ABI is design evidence for a future versioned specification decision, not permission to
reinterpret v3 during recovery. Any future ABI still has to be complete, measurable, shared by all
consumers in the table above, and represented before optimization.

### Hardware stack duties

The hardware stack remains valid for `JSR`/`RTS` return addresses, CPU interrupt state, bounded
register preservation, and explicit stack intrinsics with defined effects. Profiles supply raw
capacity/reserve and interrupt masking/nesting facts; they never pre-subtract one assumed entry.
Stack analysis computes the peak across every simultaneously feasible mainline/IRQ/NMI/callback
path, including all live calls, entries, saved state, and explicit pushes. A reachable unbounded
preemption cycle is rejected; a finite peak must fit raw capacity minus the platform reserve. It
does not count general locals because those belong to SFA. W10180 fires at the profile's explicit
`warn_stack_peak`, or at 80% of derived usable capacity rounded down when that optional field is
absent; E10238 remains the hard error above derived usable capacity.

`asm_brk()` is a distinct synchronous edge. The CPU contributes three live bytes for PC+2 and
status; the selected `brk_contract` contributes its complete maximum handler stack peak. A
returning contract resumes after the mandatory padding byte with its declared preservation and
effects. A non-returning contract ends the path. Missing proof is E10259. Never model BRK as an
ordinary `JSR`, assume an emulator monitor, charge only the opcode, or create a handler/runtime to
make the analysis convenient.

Explicit push/pull operations are ordered machine-state effects. Analysis tracks a LIFO sequence
relative to each function entry: `asm_pha()` adds an accumulator-save, `asm_php()` adds a
status-save, and the corresponding pull must consume the matching top kind. Every reachable join
and loop backedge requires the identical sequence, and every exit restores the empty relative
sequence. A callee or interrupt handler starts its own empty sequence and cannot consume
caller-held entries, return addresses, CPU interrupt bytes, or compiler-generated ABI saves. The
optimizer preserves these operations and their order. This kind-aware proof changes no emitted
instruction, allocates no SFA storage, and links no runtime code.

## Final Storage Closure

Allocation is allowed to be iterative; emission is not allowed to discover storage.

```text
typed program and effects
  -> provisional call/lifetime/SFA inventory
  -> target legalization and helper selection
  -> resource binding and spill discovery
  -> merge every new temporary/spill/helper home into SFA
  -> recompute interference, placement and budgets
  -> repeat until no new function storage appears
  -> freeze ABI homes and emit
```

Each iteration must make monotonic, bounded progress or report why it cannot converge. Avoid an
unbounded “retry until it works” allocator. The closure certificate records the final storage
inventory, graph/profile identity, placements, budget totals, and the assertion that downstream
stages cannot allocate function-lifetime bytes.

A post-closure transformation that requires new scratch must be rejected, use already reserved
scratch whose contract covers it, or return the pipeline to closure. It may not grab anonymous ZP
or RAM in the emitter.

## Failure and Diagnostic Model

An impossible allocation is a source-level compilation failure, not an internal crash. Report:

- the failed invariant (`recursion`, `unknown reentrancy`, `simultaneous lifetime`, `ZP pair fit`,
  `alignment`, `RAM visibility`, `stack depth`, or `budget`);
- relevant source functions/objects and the shortest explaining call/preemption path;
- requested bytes/alignment/class and available target range/budget;
- assumptions that made the conflict conservative, such as an escaped address; and
- realistic remedies, such as removing an escape, shortening lifetime, selecting a target with the
  needed resource, or using a library contract that proves non-overlap.

Do not propose source contortions that merely compensate for missing compiler analysis. Do not
silently overlap, silently wrap ZP, introduce a generic software stack, or move hardware assets.

## Software-Stack Alternative Gate

A software stack is not a routine fallback. It adds pointer updates, indirect accesses, RAM
reservation, helper/clobber rules, interrupt coordination, and code/cycle costs to ordinary calls.
Consider it only if an explicitly authorized language capability cannot be implemented by SFA and
the product accepts measured whole-program costs for the selected machines. That decision would
require its own semantics, ABI, optimization, diagnostics, and qualification work. Compiler
convenience or familiarity with modern ABIs is not evidence of necessity.

## Required Proof Cases

| Case | Correct invariant |
|---|---|
| sibling `a` or `b`, never nested or escaped | compatible private homes may overlay after graph/lifetime proof |
| `a` calls `b` while `a` value remains live | those homes interfere |
| recursive SCC | reject under current language rule; do not color as acyclic |
| mainline and IRQ reach same helper/scratch | allocate disjoint domain homes and specialize code only where required; report cost or diagnose resource failure |
| IRQ and NMI roots | use selected platform nesting/masking contract, not a universal assumption |
| address-taken/exported unknown caller | conservative root/escape treatment or checked contract; cost named |
| local address passed to a proven non-retaining call chain | keep the local home live through the chain; permit no return, persistent store, asynchronous publication, or opaque forwarding |
| local address or derived fragment may outlive its referent | E10260 at the first escaping use; do not pin the home, add a heap, or promise cross-invocation identity |
| pointer scratch live across interrupt | scratch interferes unless platform contract proves atomic protection |
| two-byte ZP pair proposed at `$FF` | move to a fitting range or diagnose; never wrap |
| aggregate exceeds alignment/RAM budget | explain requested layout and selected target deficit |
| `f(1, g())` | preserve first argument across `g()` and left-to-right effects |
| `f(1, f(2, 3))` | stage outer argument outside overwritten callee homes; not false recursion |
| legalization creates spill/helper byte | return it to SFA and re-close before emission |
| VIC charset needs bank/alignment | platform layout owns it; SFA does not move or copy it |
| one handler reaches C64 CINV and a raw vector | emit only the required distinct entry variants; establish binary body entry, preserve chained status, keep the indirect link off `$xxFF`, charge every body/link/stack path, and never use one prologue/tail blindly |

## Review Checklist

- Does the inventory include parameters, returns, locals, temporaries, spills, and helper scratch?
- Are direct, indirect, escaped, startup, IRQ, and NMI roots represented?
- Are SCCs and unknown edges handled explicitly?
- Does every overlay have a lifetime, alias, and preemption proof?
- Are nested argument staging and left-to-right effects preserved?
- Are ZP width/alignment/wrap and target reservations checked?
- Are static totals, peak demand, and stack depth all reported separately?
- Is global/asset/platform placement outside SFA?
- Can no post-closure stage invent function storage?
- Does failure produce a useful source diagnostic instead of a runtime or allocator surprise?

## Sources

- `[BLEND65-SPEC-P3-ed278ab9, spec/00-introduction.md §A2, §A3]`
- `[BLEND65-SPEC-P3-ed278ab9, spec/06-functions.md §FN-6, §FN-10, §SFA Calling Convention, §Interrupt Functions]`
- `[BLEND65-SPEC-P3-ed278ab9, spec/11-memory-model.md §Static Frame Allocation, §Zero-Page Allocation, §Hardware Stack Usage]`
- `[BLEND65-SPEC-P3-ed278ab9, spec/03-variables.md §Memory Placement]`
- `[BLEND65-SPEC-P3-ed278ab9, spec/13-data-inclusion.md §Code Generation]`
- `[BLEND65-SPEC-P3-ed278ab9, spec/15-platform-profile.md §Platform Profile Contract]`
