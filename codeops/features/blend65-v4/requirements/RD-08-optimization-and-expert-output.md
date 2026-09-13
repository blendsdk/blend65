# RD-08: Optimization and Expert Output

> **Document**: RD-08-optimization-and-expert-output.md
> **Status**: Draft
> **Created**: 2026-09-10
> **Project**: Blend65 v4
> **Depends On**: RD-01, RD-02, RD-03, RD-04, RD-05, RD-06, RD-07
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

RD-08 adds optional optimization to the complete, correct `optimization: none` compiler. It does
not repair language semantics, legalization, SFA, target support, asset handling, or packaging.
Those paths are already complete before this RD begins. The optimizer preserves the same modern
Blend65 source behavior while selecting better modern target-neutral, whole-program, and NMOS 6510
forms for exactly three goals: `balanced`, `speed`, and `size`. Production `build` and `run`
continue to default to `balanced`. (AR-002, AR-003, AR-023, AR-033)

Candidate selection uses one deterministic complete-cost policy. Correctness, observable timing,
MMIO/effect order, ABI, selected-profile legality, placement, memory fit, and final SFA closure are
hard constraints. `balanced` accepts only a complete no-regression Pareto win; `speed` orders the
comparable semantic-path cycle vector `T`, resource vector `R`, then logical target-loadable bytes
`B`; `size` orders `B`, then `R`, then `T`. No mode guesses
execution frequency or hides a byte/cycle/resource tradeoff behind weights. Every transformation
has an independent behavior oracle and a separate assembly/cost oracle. Local expert parity is the
optimized-mode floor, while the compiler must beat realistic expert whole-program output through global facts,
allocation, specialization, reachability, and layout. Every optimized mode exhausts the same finite,
evidence-qualified modern-plus-6502 candidate frontier to proved closure; the modes differ only in
final cost ordering. The honest result is frontier-optimal, never a claim that every conceivable
equivalent 6502 program was searched. (AR-008, AR-023, AR-026, AR-038, AR-045, AR-046)

> **Decisions:** AR-002 through AR-005, AR-007, AR-008, AR-011 through AR-014, AR-018, AR-020,
> AR-022 through AR-026, AR-029 through AR-035, AR-038, AR-042 through AR-046.

---

## Functional Requirements

### Must Have

#### Modes, feasibility, and deterministic selection — complexity XL

- [ ] **R8.1 — Support exactly four modes.** The manifest and recorded CLI override accept only
  `none`, `balanced`, `speed`, and `size`. Production `build` and `run` default to `balanced`.
  Safety switches, target profile, and entry selection remain independent settings; an optimizer
  mode never enables a safety check, changes a target, or selects a loader. (AR-022, AR-023,
  AR-030)
- [ ] **R8.2 — Preserve `none` as the correctness reference.** `none` keeps every RD-04 mandatory
  correctness, legalization, instruction-selection, SFA, layout, branch-repair, emission, and
  packaging step while disabling the optional transformations owned by this RD. It uses RD-04's
  deterministic predefined direct lowering without candidate enumeration, rewrite search, B/R/T
  comparison, or expert-parity gating; reproducibility is bound to the recorded compiler identity,
  and that direct policy may improve between compiler versions. Optimized modes consume that semantic
  baseline; they cannot make an otherwise incomplete operation correct.
  (AR-023, AR-033)
- [ ] **R8.3 — Filter hard constraints before preferences.** Reject any candidate that changes
  specified values, evaluation order, volatility, MMIO count/order/bus behavior, observable timing,
  ABI, interrupt state, placement/banking, selected-CPU legality, load/publication behavior, or
  safety semantics, or that exceeds a final memory, ZP, stack, SFA, scratch, layout, disk, or
  profile capacity. Preference never rescues an infeasible candidate. (AR-002, AR-018, AR-020,
  AR-023, AR-029, AR-045)
- [ ] **R8.4 — Compare at the smallest complete owning scope.** Finalize a local choice only when
  helper/table reachability, shared setup, ZP/SFA interference, register spills, branch distance,
  layout/padding, banking, loading, packaging, and other consumers cannot reverse it. Otherwise
  retain the finite viable alternatives until function or whole-program closure and recompute
  after reachability, helper selection, SFA closure, layout, and branch repair. Packaging remains a
  hard feasibility/evidence boundary but its D64 container representation never changes B/R/T
  preference. (AR-018,
  AR-023, AR-045, AR-046)
- [ ] **R8.5 — Use one complete cost vector.** Every candidate records `B`, `T`, and `R`:
  `B` counts logical compiler-generated target-loadable program/data bytes. For a PRG build it
  includes generated PRG code, initialized data, embedded payload, helpers, tables, loader, padding,
  and branch repair. For D64 it counts logical compiler-generated target payloads only and excludes
  the fixed image length, BAM, directory, sector links/tails/fill, and host evidence/archive
  compression. `T` is the comparable cycle cost for every relevant semantic path class; and `R` is
  zero-page peak, combined resident
  RAM/SFA peak, hardware-stack peak, compiler/helper scratch, then any other profile-owned capacity
  in stable profile order. Costs include code, data, helpers, tables, padding, branch repair,
  deliberate replication, calls, setup, page alternatives, banking, and loading. D64 filesystem and
  container properties are separately reconciled hard-capacity/evidence facts, never optimization
  preference. A loadable byte contributes once to `B` and separately to `R` only while resident;
  those are different resources, not duplicate size accounting. (AR-008, AR-023, AR-029, AR-045)
- [ ] **R8.6 — Compare equivalent path classes.** Path classes come from source/semantic control
  and target contracts, not accidental optimized block names. Each candidate maps the same input,
  success/failure, branch, loop-bound, interrupt, page, bank, loader, and timing-observable cases.
  Costs may be exact values, bounded ranges, or formulas over the same declared domain. An unknown
  or non-comparable term cannot be treated as zero or as a win. (AR-023, AR-026, AR-045)
- [ ] **R8.7 — Apply the exact `balanced` rule.** From the feasible set, select a candidate only
  when it is weakly no worse than the `none` baseline and every other feasible competitor in every
  `B`, `T`, and `R` component, and strictly better in at least one. Otherwise retain the feasible
  baseline for that conflict while still applying independent dominance wins. If the baseline is
  infeasible and no feasible candidate dominates every remaining competitor, fail with a
  diagnostic that identifies the tradeoff and recommends explicit `speed` or `size`; never choose
  by a hidden preference. (AR-023, AR-045)
- [ ] **R8.8 — Apply the exact `speed` rule.** Sort comparable semantic-path cycle bounds from
  worst to best and lexicographically minimize that vector. Break a cycle-vector tie by minimizing
  the ordered `R` vector from R8.5, then `B`. This is frequency-free minimax selection; average,
  guessed-hot, or source-order weighting is forbidden. Statically proved loop counts and explicit
  timing contracts remain semantic/cost facts, not frequency weights. (AR-023, AR-045)
- [ ] **R8.9 — Apply the exact `size` rule.** Lexicographically minimize `B`, then the ordered `R`
  vector from R8.5, then the same worst-to-best cycle vector. A one-byte reduction may win
  even when it is slower, but never when it violates a hard timing or resource contract. (AR-023,
  AR-045)
- [ ] **R8.10 — Break only exact ties mechanically.** When two candidates have identical complete
  `B`, `T`, and `R` vectors, select the lexicographically smaller stable candidate ID. Candidate
  IDs are compiler-internal, deterministic, and independent of discovery order, object identity,
  host timing, filesystem traversal, or hash-map iteration. Stable ID never resolves a real cost
  tradeoff. (AR-022, AR-023, AR-045)
- [ ] **R8.11 — Keep source legality mode-independent.** All modes accept and reject the same
  language and target capabilities. A mode may change whether a valid program's final artifact
  fits finite target resources. Such a failure is an artifact/resource result with the exact
  deficit and alternatives, not a language restriction or a suggestion to write hardware-shaped
  source. (AR-002, AR-003, AR-023, AR-045)
- [ ] **R8.12 — Explain every consequential choice.** The existing `.costs.json` and `.build.json`
  evidence identify mode, candidate scope and stable ID, hard rejections, selected candidate,
  complete before/after vector, deferred-cost closure point, exact tie-break if used, and source
  association. For `balanced` non-selection, identify the incomparable components. Add no pass-log
  service or separate tuning database. (AR-008, AR-011, AR-022, AR-026, AR-045)

#### Target-neutral and whole-program transformation — complexity XL

- [ ] **R8.13 — Combine modern and 6502 optimization while preserving semantic payload.** The
  finite frontier combines useful modern target-neutral and whole-program transformations with
  proven NMOS 6510 legalization, instruction selection, allocation, layout, and structured
  peepholes. Technique origin never grants admission: use algorithms and proof ideas, not another
  compiler's architecture, implementation, preselected pass catalog, legality assumptions, or
  cost model. Every concrete technique needs a current Blend65 behavior, workload, or measured
  expert-output consumer and must pass R8.43. Optional transformations retain width,
  signedness, nominal type, constant-versus-runtime arithmetic context, ordinal promotion,
  place/value identity, evaluation order, short-circuit arms, volatility, aliases, escapes,
  lifetimes, storage class, target requirements, callbacks, source association, and diagnostic
  identity until their accountable consumer discharges them. (AR-002, AR-011, AR-012, AR-014,
  AR-018, AR-023, AR-046)
- [ ] **R8.14 — Fold constants under exact Blend65 rules.** Preserve RD-04's mandatory constant,
  `comptime function`, selected-profile, dimension, and relocation evaluation, then apply optional
  propagation/folding only in the same specified context. Preserve full-precision constant
  diagnostics, runtime-width wrap, signed shifts, signed division/remainder, BCD rules, side
  effects, and symbolic low/high address expressions. Host JavaScript arithmetic is never the
  oracle. (AR-014, AR-019, AR-030)
- [ ] **R8.15 — Remove only newly proved unreachable work.** Preserve RD-04's mandatory source
  reachability, then repeat it after optional folding/specialization. Whole-program roots include entry, startup,
  initialization, direct and finite indirect calls, recognized interrupt sinks and variants,
  callbacks, exported/address-taken identities, helpers, platform routines, loader paths, and
  packaged load units. Remove unreachable functions, variants, helper bodies, data, tables,
  handlers, asset selections, load units, and adapter features without deleting an escaped or
  asynchronously reachable object. (AR-018, AR-029, AR-038, AR-042)
- [ ] **R8.16 — Propagate values and ranges without changing effects.** Use constants, ranges,
  known bits, signedness, extents, call summaries, and profile facts to simplify arithmetic,
  comparisons, checks, addresses, and control flow. Preserve each volatile read/write, call,
  possible alias effect, zero-divisor behavior, checked-safety edge, and source evaluation order.
  (AR-002, AR-023)
- [ ] **R8.17 — Optimize memory through explicit alias/effect facts.** Eliminate or forward normal
  RAM loads/stores only when address provenance, overlap, call effects, local borrows, interrupt
  observation, and bank visibility prove equivalence. Unknown pointers or calls invalidate only
  the state they may observe; they neither authorize optimism nor force all memory globally
  unknown. MMIO follows R8.32. (AR-015, AR-016, AR-018)
- [ ] **R8.18 — Keep conditions as control when possible.** Simplify CFGs, invert branches, merge
  equivalent tails, remove unreachable edges, and preserve short circuit without materializing
  `boolean` values that only feed control. Materialize exactly `0` or `1` only for escaping value
  uses and preserve every merge path. (AR-002, AR-023)
- [ ] **R8.19 — Optimize calls with complete program cost.** Tail-call conversion, specialization,
  finite-target devirtualization, inlining, outlining, helper sharing, and direct construction are
  candidates only when ABI, bank, interrupt domain, address-taken entry, code duplication,
  marshalling, register pressure, SFA interference, stack, layout, and total reachable body cost
  are closed. No universal dispatcher, runtime library, or speculative unknown-target call is
  introduced. (AR-016, AR-018, AR-023)
- [ ] **R8.20 — Optimize fixed aggregates without breaking value semantics.** Apply copy elision,
  direct caller-owned construction, scalarization, field deadness, and legal layout changes only
  when exact shape, aliasing, address/layout observability, overlap, volatility, interrupt access,
  and asset ABI permit them. Explicit source copies retain snapshot/value behavior. (AR-015 through
  AR-017, AR-038)
- [ ] **R8.21 — Recover ordinary loop structure by proof.** Begin from the standard three-clause
  CFG. Recognize bounded canonical induction, invariant work, strength-reducible addressing, and
  full/partial/no-unroll candidates without changing initializer/condition/body/update order,
  `continue`, `break`, return, wrap, or observable counter values. A semantic word counter may use
  byte machinery only when every wider observation is reconstructible or absent. Add no range-loop
  IR or user tuning syntax. (AR-014, AR-023)
- [ ] **R8.22 — Optimize array and address arithmetic contextually.** Preserve word-capable ordinal
  semantics, element size, every nested rectangular stride, fixed or caller-supplied outer count,
  checks, and hidden borrow provenance. Narrow, carry-chain, hoist, combine, or scale address work
  only after proving the complete ordinal/effective address equivalent, including elements above
  255. (AR-015, AR-017)
- [ ] **R8.23 — Choose arithmetic families from complete candidates.** Compare fold, identity,
  increment/decrement, shift/add, table, inline, and dead-stripped helper forms for multiply,
  division, remainder, shifts, negation, and fixed-width arithmetic. Preserve incoming carry/decimal
  requirements, signed rounding, minimum signed values, zero-divisor behavior, optional checks,
  quotient/remainder reuse, clobbers, scratch, reentrancy, and helper/table cost. (AR-002, AR-018,
  AR-023)
- [ ] **R8.24 — Keep application policy in source.** The optimizer may improve a proved user-
  authored game loop, renderer, collision routine, state dispatch, sprite schedule, scroll path,
  audio call, or loader sequence. It must not inject or replace it with a compiler-owned game
  algorithm, scheduler, engine, mixer, renderer, scene system, fastloader, compressor, or runtime
  policy. (AR-029, AR-038, AR-042)

#### NMOS 6510 machine optimization — complexity XL

- [ ] **R8.25 — Optimize structured machine operations, not ACME text.** Selection, register/flag
  dataflow, target rewrites, CFG layout, and branch repair operate on symbolic machine instructions
  with operands, effects, clobbers, source identity, and cost. The emitter remains a deterministic
  terminal translation and never reparses or rewrites strings to recover meaning. (AR-012,
  AR-023)
- [ ] **R8.26 — Emit only official selected-CPU forms.** C64 profiles use documented NMOS 6510
  instructions and addressing modes. ACME acceptance cannot legalize W65C02-only or undocumented
  opcodes. No general fast/unsafe switch enables illegal instructions; a future silicon-specific
  local contract remains outside this RD. (AR-013, AR-024)
- [ ] **R8.27 — Reuse registers and flags exactly.** Track live A/X/Y values and individual
  N/V/D/I/Z/C ownership across instructions, calls, joins, and interrupt boundaries. Reuse a value
  or condition only when its producer still dominates every use; preserve or deliberately
  recompute clobbered state. `CMP` never supplies a fresh V flag, stores never supply N/Z, and
  carry-consuming operations own their input carry. (AR-013, AR-018)
- [ ] **R8.28 — Allocate zero page by whole-program opportunity cost.** Compare saved bytes/cycles
  against initialization, moves, spills, displaced higher-value uses, pair contiguity, `$FF` wrap,
  user reservations, platform workspace, and mainline/IRQ/NMI duplication. Report static ZP total
  and simultaneous peak separately. A locally faster use cannot silently displace a better global
  pointer/home. (AR-007, AR-018, AR-023, AR-045)
- [ ] **R8.29 — Select the narrowest proved address form.** Prefer immediate, zero-page, absolute,
  indexed, indirect, or symbolic relocation forms from known address/range/layout facts. Include
  pointer setup, ZP pair, page crossing, dummy access, banking, and live-register cost. A fixed
  symbol is not materialized as a runtime pointer without a real consumer. (AR-007, AR-020)
- [ ] **R8.30 — Use correct comparison and arithmetic idioms.** Unsigned relations use carry/equal
  forms; signed relations use a complete sign-normalized, sign-split, or V-producing sequence;
  multi-byte relational comparison proceeds most-significant first while carry arithmetic proceeds
  least-significant first. Every selected family covers byte/word boundaries and both possible
  incoming flag states. (AR-002, AR-023)
- [ ] **R8.31 — Treat helpers and tables as real program objects.** Charge a newly reachable body
  or table once, every call/access separately, and include ABI, setup, padding, placement, banking,
  scratch, SFA, stack, reentrancy, and displaced layout. Dead-stripped bodies cost zero. A shared
  helper with overlapping mainline/IRQ/NMI use receives safe distinct storage/code variants or is
  rejected; it never becomes a hidden general runtime. (AR-018, AR-023, AR-045)
- [ ] **R8.32 — Preserve volatile and device bus behavior.** Never common, speculate, duplicate,
  reorder, or delete a volatile read/write. Never replace a device load/ALU/store sequence with an
  NMOS read-modify-write instruction unless the exact selected-device contract proves the complete
  read/write/dummy-access sequence equivalent. A narrow platform rule may coalesce only operations
  whose visible count, value, order, ownership, and timing remain identical. (AR-013, AR-038)
- [ ] **R8.33 — Optimize layout with final addresses.** Choose block order, fall-through,
  condition inversion, tail merging, code/data placement, and page alignment from complete paths
  and object constraints. Recompute downstream symbols, padding, page-cross cost, bank visibility,
  and branch reach after every size-changing choice. There is no generic align-all-loops rule.
  (AR-007, AR-020, AR-023)
- [ ] **R8.34 — Repair branches monotonically.** Validate relative ranges after layout. Expand an
  out-of-range conditional branch to the inverse short branch over `JMP` or another proved legal
  form, then repeat a bounded monotonic relaxation until stable. A hard iteration cap may diagnose
  a compiler bug but is not the convergence proof. (AR-002, AR-023)
- [ ] **R8.35 — Optimize cycle-contract code only inside its proof.** Raster, IRQ, audio cadence,
  loader, or other timing-observable regions keep exact model, entry jitter, DMA/badline, branch,
  page, banking, ownership, and worst-path facts. A faster average path cannot replace a bounded
  path or move a required bus write. Unknown timing blocks selection rather than becoming zero.
  (AR-013, AR-023, AR-024, AR-026)
- [ ] **R8.36 — Make data-for-code choices explicit and complete.** A lookup table, pre-shifted
  asset, mask, split plane, replicated immutable object, or specialized routine is selected only
  when behavior and complete code/data/padding/access/load/placement cost win under the active
  mode. Preserve source-visible address/layout identity. Do not create unrequested asset selectors
  or duplicate mutable state. (AR-020, AR-023, AR-029, AR-038, AR-045)
- [ ] **R8.37 — Do not infer risky machine techniques.** Self-modifying code, cycle-exact VIC
  tricks, and any future undocumented-opcode form require their already-approved explicit local
  profile/API contract, writable-code/banking/interrupt ownership, exact alternatives, and
  measured win. Ordinary source shape or `speed` mode alone never opts in. (AR-013, AR-020,
  AR-023)

#### SFA, layout, and closure — complexity XL

- [ ] **R8.38 — Preserve SFA as the only general function-storage model.** Optimized parameters,
  returns, locals, temporaries, aggregate destinations, argument staging, spills, and helper
  scratch remain explicit SFA inventory. Optimization adds no dynamic frame, software stack,
  heap, or mandatory runtime. Globals, assets, load units, target reservations, and packaging stay
  outside SFA. (AR-002, AR-016, AR-018, AR-029)
- [ ] **R8.39 — Re-close after storage discovery.** Legalization, candidate selection, resource
  binding, and optimization may expose a new spill, pointer, helper home, or domain-specific
  variant only by returning it to the bounded SFA/interference loop. Recompute costs and candidate
  validity after closure. The closure certificate proves that no downstream stage can create
  function-lifetime storage. (AR-018, AR-023, AR-045)
- [ ] **R8.40 — Respect execution domains.** Whole-program liveness distinguishes mainline,
  startup, ordinary calls, recognized callbacks, raw/firmware IRQ variants, NMI, and finite indirect
  targets. Overlay only storage that cannot be simultaneously live. Preserve callback-only handler
  identity, status/D restoration, vector ownership, stack peak, and every reachable entry variant.
  (AR-013, AR-018, AR-024)
- [ ] **R8.41 — Solve code and non-function layout together.** Final optimization observes the
  combined intervals and constraints for code, globals, constants, SFA, ZP, hardware stack,
  sprites, charsets, bitmaps, SID/player data, tables, resident assets, loader state, destinations,
  and package/load windows. It may change placement or choose a representation, but never move an
  asset into SFA or copy bytes merely to simplify allocation. (AR-007, AR-020, AR-029, AR-038)
- [ ] **R8.42 — Run structured cost-selected peepholes without post-closure invention.** Peephole
  cleanup operates on symbolic machine instructions after required flag, register, liveness,
  effect, alias, and layout facts exist. For each region it considers the unchanged baseline and
  every applicable qualified substitution, then applies the active complete-cost ordering rather
  than greedy first match. It cannot reconstruct erased facts, rewrite emitted ACME text, or
  change MMIO/bus behavior. Peephole cleanup, branch repair, ACME emission, PRG/D64 serialization,
  and evidence generation use only closed resources. A transformation that needs new scratch is
  rejected, uses a compatible already-reserved home, or returns to closure; it never grabs
  anonymous RAM/ZP or emits a silent runtime buffer. (AR-018, AR-023, AR-046)

#### Proof, expert parity, and qualification — complexity XL

- [ ] **R8.43 — Admit every transformation through a complete rule packet.** A technique enters the
  frontier only for a named current consumer. Record match, applicability, semantic preconditions,
  consumed/generated facts, machine effects, pipeline location, complete cost, smallest
  counterexample, behavior oracle, and assembly/cost oracle. Encode this in the smallest existing
  structures and tests; do not build a public pass registry, plugin protocol, rule DSL, e-graph
  system, imported textbook suite, LLVM dependency, or optimizer framework merely to store rules.
  A new representation or shared mechanism requires concrete admitted consumers that cannot be
  implemented or proved safely with the existing smallest structure and must pass the anti-
  overengineering gate. (AR-011, AR-012, AR-023, AR-046)
- [ ] **R8.44 — Require two independent expectations.** The behavior oracle derives from frozen
  Specification 4, selected CPU/platform/ABI, and independently defined program results/effects.
  The assembly/cost oracle proves the intended transformed shape and complete resource change.
  Optimized-versus-`none` execution is supporting evidence only because both paths may share a
  lowering defect. (AR-002, AR-008, AR-014, AR-023)
- [ ] **R8.45 — Observe every relevant behavior channel.** Cases cover return values, ordinary
  memory, aliases, MMIO address/width/value/count/order, calls/helpers, live registers and flags,
  D/I state, stack balance, SFA homes, interrupt-visible state, control termination, load/failure
  publication, and timing when the contract makes it observable. Negative precondition cases prove
  the rewrite does not fire. (AR-018, AR-023, AR-029)
- [ ] **R8.46 — Compare genuinely equivalent expert work.** Expert and generated candidates share
  input domain, results, wrap/error behavior, side effects, ABI, initial/final machine state,
  reentrancy, safety, data availability, startup/loader obligations, placement, exact path, and
  machine/profile. Report code, data, padding, ZP, SFA, stack, scratch, traffic, cycles, setup, and
  dependency costs separately; no universal weighted ratio is allowed. (AR-008, AR-023, AR-045)
- [ ] **R8.47 — Enforce the local expert floor.** For each implemented operation/routine and active
  optimized-mode objective, generated output must meet or beat the smallest competent expert
  sequence for the same contract. A worse result blocks the checkpoint. An honest meet is allowed only when no
  current better candidate exists and automatically creates or links one authorized GitHub
  parity-debt issue with source/assembly, complete delta, and the specific missing transform,
  representation, allocation change, or platform primitive needed to beat it. Issue creation never
  pushes. (AR-002, AR-023)
- [ ] **R8.48 — Prove a whole-program win.** For each optimized mode, at least one representative
  complete program must beat its independently reviewed realistic expert whole-program baseline in
  the same mode objective without any local result falling below the expert floor or any hard
  resource/timing contract regressing. For `balanced`, this means no worse in every complete cost
  component and strictly better in at least one; `speed` and `size` use their approved
  lexicographic orders. Global allocation, dead stripping, specialization, helper sharing, and
  layout must account for the win; a single micro-routine is insufficient. (AR-002, AR-023,
  AR-038, AR-045)
- [ ] **R8.49 — Qualify real language and game workloads.** The corpus includes RD-03 M1; nested
  calls and dynamic `POKE`; signed/unsigned byte and word arithmetic; arrays above 255; aggregate
  returns/copies; finite function values; optional checks; Q-P13 sprite scheduling; Q-P16
  320-entity/collision work; user-authored scrolling/double-buffering; music plus action effects;
  RD-06 resident assets and Integrator-style compile-time composition; and RD-07 loadable/D64
  delivery. These are compiler qualification programs, never public game-engine modules. (AR-015
  through AR-019, AR-027, AR-029, AR-037, AR-038)
- [ ] **R8.50 — Prove mode separation with tradeoff fixtures.** Include at least: one strict
  all-resource dominance case selected by every optimized mode; one larger/faster candidate chosen
  only by `speed`; one smaller/slower candidate chosen only by `size`; one incomparable case where
  `balanced` retains the baseline; one infeasible-baseline/incomparable-feasible case where
  `balanced` diagnoses; one exact complete-cost tie resolved by stable ID; and one local winner
  reversed after helper/SFA/layout/packaging closure. (AR-023, AR-045)
- [ ] **R8.51 — Exhaust the qualified frontier to proved fixed points.** `balanced`, `speed`, and
  `size` have identical candidate-discovery and proof depth. At the smallest complete owning scope,
  enumerate every applicable qualified candidate and every surviving interaction that may change
  the closed result. Do not stop at the first improvement or after a configured round count. Prune
  only hard-infeasible candidates or candidates proved unable to win by closed cost or admissible
  dominance bounds; retain open or incomparable choices until their decisive scope closes. Repeat
  affected facts, transformations, reachability, helper/table selection, resource binding, SFA,
  layout, branch repair, and packaging feedback until the complete frontier and costs are stable.
  Every repeated group has a finite state space, finite lattice, or monotonic well-founded measure.
  A diagnostic iteration cap cannot prove success. Identical clean builds on the same supported
  host/tool identities emit byte-identical assembly, primary artifact, maps, costs, selected IDs,
  and diagnostics. Random iteration, host timing, and unstable traversal cannot affect output.
  Exact enumeration or superoptimization is allowed only for explicitly small finite regions with
  fixed NMOS 6510 legality, live-in/live-out state, effects, memory and interrupt assumptions,
  sequence bound, complete cost, and an independent decidable equivalence oracle. Prefer offline
  use to qualify direct candidates. Never perform open-ended global search or report universal
  mathematical optimality. A newly discovered winning expert candidate reopens the qualified
  frontier as parity debt. (AR-011, AR-022, AR-026, AR-046)
- [ ] **R8.52 — Fail safely and explain internal limits.** Nonconvergence, missing cost closure,
  impossible branch repair, stale facts, illegal opcode, post-closure storage demand, or failed
  optimizer invariant produces a source-associated compiler diagnostic and publishes no new
  artifact set. It never silently disables a requested mode, emits the last attempted program, or
  weakens an oracle to pass. (AR-002, AR-022, AR-023)
- [ ] **R8.53 — Use impact-based verification.** During implementation run the smallest directed
  semantic, transformation, machine, assembly, resource, and VICE cases that can disprove the
  change. At the RD checkpoint run the complete RD-08 qualification once across all modes and
  affected packages. Do not run the full readiness harness after every rule or add a replacement
  readiness product. (AR-011, AR-023, AR-026)
- [ ] **R8.54 — Preserve evidence limits.** Record compiler/specification/expert identity, mode,
  profile, ACME version, VICE 3.10 configuration, artifact hashes, and any skipped endpoint.
  Routine machine behavior may be `VICE-verified / hardware-unverified`; raster, CIA, SID analogue,
  undocumented/silicon-sensitive, expansion, and documentation-conflict claims require the targeted
  physical QA already assigned by RD-05/RD-07/RD-10. (AR-008, AR-013, AR-024)
- [ ] **R8.55 — Keep expressiveness outside the optimizer score.** A program rejected or distorted
  because of missing language/lowering support is an expressiveness defect with no finite parity
  ratio. Record it in the conformance/expressiveness ledger with its owner; never make optimization
  success hide it or teach the restriction as 6502 doctrine. (AR-002, AR-003, AR-004)
- [ ] **R8.56 — Close deferral expiry.** Before RD-08 closes, inspect every ambiguity record,
  RD Won't Have section, expert deferral, parity issue, conformance entry, and Specification 4
  future consideration whose rationale may have expired because the optimizer, closed cost model,
  or whole-program facts now exist. Reopen and assign each expired item; no deferral may name a
  completed RD-08 slice as its future owner. (AR-002, AR-014)
- [ ] **R8.58 — Preserve optimizer evidence for RD-09.** Expose stable source spans, machine ranges,
  optimized-away values, rematerialized values, and final homes through the existing debug/evidence
  contracts so later editor/debug integration can explain optimized code. RD-08 does not build an
  owned debug adapter or make ordinary LSP requests run code generation. Populate the RD-03-frozen
  debug version-1 optimization, inlined-context, split-location, rematerialized, optimized-away, and
  final-range forms without redefining the schema. Any missing representational fact blocks the
  producer and requires explicit schema evolution rather than an implementation-only field. (AR-010,
  AR-021)

### Should Have

- [ ] **R8.57 — Provide a concise human optimization explanation.** On explicit request, render
  the existing structured evidence as source-associated selected/rejected transformations, cost
  deltas, and limiting constraints. Keep normal builds quiet and deterministic. Add no interactive
  tuning UI, optimizer debugger, or permanent trace database. (AR-008, AR-011, AR-021, AR-045)
### Won't Have (Out of Scope)

- A fifth optimization mode, pass-level user switches, weights, hotness annotations, profile-guided
  optimization, runtime instrumentation, autotuning, or a tuning DSL. (AR-023, AR-045)
- A public optimizer plugin API, pass registry, rule language, e-graph framework, LLVM dependency,
  broad imported textbook pass suite, persistent build cache, or incremental compiler. A measured
  later need requires its own decision. (AR-011, AR-012, AR-046)
- A runtime optimizer, JIT, heap, dynamic frame, general software stack, mandatory helper library,
  hidden dispatcher, or target-side profiler. (AR-002, AR-018)
- Automatic undocumented opcodes, inferred self-modifying code, guessed cycle-exact VIC tricks, or
  unsafe target hybrids. (AR-013, AR-020, AR-023, AR-024)
- Compiler-owned game loops, renderers, entity/collision/state systems, sprite multiplexers,
  scrolling/buffering systems, audio schedulers/mixers, scenes, engines, fastloaders, compressors,
  or gameplay policy. (AR-029, AR-038, AR-042)
- New language syntax, changes to Specification 4 semantics, v3 compatibility, or support for an
  unqualified non-C64 target. (AR-004, AR-014, AR-024, AR-035)
- Hard wall-clock gates for host compiler/editor speed. RD-08 records observational timings under
  AR-026 but does not fail correctness because a shared host is slower. (AR-026)

---

## Technical Requirements

### Complete selection contract — complexity XL

The selector operates after hard feasibility filtering and only when every comparison term needed
at the owning scope is closed:

| Mode | Primary comparison | Secondary comparison | Tertiary comparison | Incomparable result |
|---|---|---|---|---|
| `none` | Deterministic predefined correct direct lowering | — | — | Use the required legal baseline or report its exact hard resource failure; perform no candidate comparison or expert-parity gate. |
| `balanced` | Pareto dominance across every `B`, `T`, and `R` component | — | Exact ties use stable ID only | Keep feasible baseline; if none is feasible, diagnose and recommend explicit `speed` or `size`. |
| `speed` | Worst-to-best semantic-path cycle vector `T` | Ordered scarce-resource vector `R` | Logical target-loadable bytes `B` | Lexicographic order decides without frequency. |
| `size` | Logical target-loadable bytes `B` | Ordered scarce-resource vector `R` | Worst-to-best semantic-path cycle vector `T` | Lexicographic order decides without frequency. |

The stable `R` order is zero-page peak, combined resident RAM/SFA peak, hardware-stack peak,
compiler/helper scratch, then additional profile capacities in stable profile-declared order.
Every capacity is already a hard feasibility barrier; the order is consulted only when higher
priorities tie. `B` reports logical compiler-generated target-loadable program/data components
separately; D64 filesystem/container overhead is excluded and remains separate package evidence and
a hard capacity constraint. The same logical data may also occupy a reported runtime interval in
`R`; these are different dimensions. `T` never turns best/worst paths into an average without
measured authority. (AR-045)

### Candidate lifetime and feedback — complexity L

```text
correct typed/effect program
  -> semantic and whole-program candidates
  -> target legalization and machine candidates
  -> provisional resource binding and SFA
  -> retain choices whose full cost is still open
  -> reachability/helper/table/layout/branch/package closure
  -> reject hard failures and apply selected mode order
  -> re-close SFA/layout if the selection changed storage or reachability
  -> freeze resources and emit
```

This is a responsibility flow, not a required count of passes or IRs. Every optimized mode searches
the same admitted frontier to a proved fixed point; only final cost ordering differs. Feedback must
have a finite state space, finite lattice, or monotonic well-founded measure. The implementation
plan may combine adjacent steps when one small structure retains every fact and each responsibility
remains independently testable.
(AR-011, AR-012, AR-018, AR-023, AR-046)

### Minimum transformation families — complexity XL

| Family | Required candidates or outcomes | Decisive proof boundary |
|---|---|---|
| Constants and ranges | mandatory RD-04 evaluation plus optional exact folding and known bits/ranges | Blend65 width/context/effect semantics, not host arithmetic |
| Reachability | repeat mandatory exclusion after optional transforms for newly dead functions, variants, helpers, data, assets, and load units | complete root/escape/callback/load graph |
| Memory and values | forwarding, dead normal stores, scalarization, copy elision, direct construction | alias, address/layout observation, volatility, interrupt domains |
| Control flow | direct flag branch, branch inversion, CFG simplification, tail merge | equivalent effects and source path classes |
| Calls | specialization, finite-target direct calls, inline/outline/helper, tail call | whole-program body/ABI/SFA/stack/layout cost |
| Loops and arrays | canonical induction, invariant work, address strength reduction, unroll choices | exact CFG, ordinal/extent/stride, wrap and observable counter behavior |
| Arithmetic | carry chains, comparison families, shifts, constant multiply/divide, inline/helper/table | exact signed/wrapped semantics, flags, scratch, full-domain counterexamples |
| Machine state | register/flag reuse, addressing narrowing, ZP allocation, spill decisions | liveness, clobbers, bus effects, global opportunity cost |
| Layout | fall-through, block/object order, alignment, branch relaxation, page/bank placement | final addresses, padding, profile visibility, monotonic repair |
| Assets and delivery | dead selected output, proved canonical alias, cost-guided legal representation | source identity, address observability, RAM/load/package costs; no hidden selector |

This table states required capability coverage. It does not require one pass, class, catalog, or
configuration switch per row. (AR-011, AR-012, AR-023, AR-038)

### Evidence and report contract — complexity L

The existing build evidence gains an optimizer section; no new standalone artifact is required:

| Evidence | Required fields |
|---|---|
| Identity | Specification 4 identity, expert `2.0.0` content commit, compiler commit, target/profile, mode, safety settings, ACME/VICE identity where used |
| Candidate | stable ID, owning scope, source spans, semantic operation/path mapping, preconditions, hard rejection reason |
| Cost | exact reconciled `B` components separate from D64/container evidence; path-cycle `T` and page ranges; ordered `R` components including ZP, resident RAM/SFA, stack, scratch, and selected-profile capacities; traffic and setup/load costs |
| Selection | baseline, enumerated and pruned alternatives, exhaustion/fixed-point evidence, closure point, mode ordering, selected result, exact tie-break or balanced incomparability |
| Proof | behavior-oracle case, assembly/cost expectation, counterexample, assembled addresses/bytes, VICE/hardware evidence status |
| Parity | expert baseline identity, equivalent obligations, local result by measure/path, whole-program result, linked meet-only debt issue |

Diagnostics and reports use ordinary source locations and plain explanations. Internal pass names
may supplement but never replace the source behavior, resource, or failed precondition. (AR-003,
AR-008, AR-022, AR-026)

### Required qualification matrix — complexity XL

At minimum, each row has positive, negative-precondition, boundary, deterministic rebuild, and
mode-difference coverage where applicable:

| Matrix | Required endpoint |
|---|---|
| Semantic rules | independent values/effects oracle plus transformed semantic representation |
| NMOS instruction families | exact assembled bytes, flags/clobbers, official-opcode legality, path cycles, page alternatives |
| SFA/ZP/stack | closed homes, interference paths, domain variants, static and peak reports, no post-closure allocation |
| C64 devices/timing | exact MMIO/bus sequence and configured VICE observation; physical QA where already required |
| Assets/layout | selected bytes only, intervals/banks/alignment, no hidden copies, complete resident/load/package cost |
| Whole programs | M1 and representative game workloads through fresh ACME artifact and VICE where runtime behavior is claimed |
| Parity | independently reviewed expert equivalent, local floor, at least one whole-program win per optimized mode |

Qualification is impact-based during development. The complete matrix runs once at the RD-08
checkpoint and again only when later changes touch its contract or at the final RD-10 release
boundary. (AR-011, AR-023, AR-026)

---

## Integration Points

| RD | Contract with RD-08 |
|---|---|
| RD-01 | Supplies frozen Specification 4, expert `2.0.0`, and AR-045/AR-046 policy plus the sourced combined optimization inventory. A discrepancy reopens authority; optimizer tests never redefine it. |
| RD-02 | Supplies the deterministic small monorepo/compiler service. RD-08 adds no workspace merely to mirror a pass taxonomy. |
| RD-03 | Supplies the original-art M1 rebuilt under all modes as a compiler fixture, never a bundled game framework. |
| RD-04 | Supplies complete `none` semantics, SFA, legal machine lowering, ACME, artifacts, and behavior oracles. RD-08 postpones none of them. |
| RD-05 | Supplies CPU/VIC/SID/CIA, banking, interrupt, timing, platform API, Q-P13, and Q-P16 contracts for user-authored workload optimization. |
| RD-06 | Supplies explicit asset values and resident layout. RD-08 cannot invent selectors, normalize bytes, add a renderer, or hide copy/load cost. |
| RD-07 | Supplies loader/D64/destination/quiescence facts. Optimization cannot add compression, fastloading, staging, or another strategy. |
| RD-09 | Consumes optimized source/machine mappings without putting codegen in ordinary LSP requests or requiring an owned debugger. |
| RD-10 | Consumes four-mode qualification, parity/debt, and cost policy across base-C64 profiles and for the C64U handoff. |

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Visible modes | Boolean optimization / pass flags / four goal modes | `none`, `balanced`, `speed`, `size` | Expresses user goals without exposing compiler internals. | AR-023 |
| Production default | `none` / `balanced` / `speed` / `size` | `balanced` | Takes only complete no-regression wins when no workload preference exists. | AR-023, AR-045 |
| Tradeoff policy | complete vectors / hidden weighted score / user weights and hotness | Pareto `balanced`; frequency-free lexicographic `speed` and `size` | Deterministic and honest without guessing workload frequency. | AR-045 |
| Cost closure | always local / smallest complete owning scope | Defer reversible candidates until all decisive downstream costs close | Prevents locally cheap helpers, tables, or layouts from losing globally. | AR-045 |
| Correctness reference | optimized implementation / complete `none` first | Complete `none` first | Optimizers cannot conceal missing language or lowering behavior. | AR-023, AR-033 |
| Architecture | pass framework / public plugins / responsibility-driven minimum | Smallest representations and direct rules with current consumers | Avoids rebuilding an optimizer support product. | AR-011, AR-012 |
| Technique frontier | 6502 tricks only / imported modern framework / combined qualified knowledge | Combined modern-plus-6502 finite frontier | Retains modern whole-program leverage while making exact 6502/C64 proof and cost the admission authority. | AR-046 |
| Game knowledge | compiler-owned systems / workload recognition and qualification | Optimize user-authored game code only | Blend65 is a language/compiler, not an engine. | AR-038 |
| Runtime profile data | PGO/autotuning / none | None | No runtime, instrumentation, tuning files, or guessed frequencies. | AR-002, AR-045 |

> **Traceability:** Every scope decision references the Ambiguity Register entry that authorized it.

---

## Security Considerations

- **Data sensitivity:** N/A — optimizer inputs are local source, compiler representations, assets,
  and build evidence; no credentials, personal data, or regulated records are introduced.
- **Input validation:** Validate manifest mode against the four-value allowlist; validate every
  source/asset/profile/placement input through its owning RD; treat corrupted internal candidate or
  cost data as a compiler error rather than emitting output.
- **Authentication and authorization:** N/A — this is a local compiler with no user accounts,
  authorization boundary, service endpoint, or remote control plane.
- **Injection risks:** The optimizer never constructs shell commands or executable ACME syntax from
  unescaped source text. Existing canonical contained paths and structured ACME emission remain in
  force. Candidate IDs and diagnostic labels are data, not executable text.
- **Encryption needs:** N/A — no sensitive data store or network transport is added.
- **Rate limiting:** N/A — no public or authentication endpoint exists.
- **Secrets management:** N/A — optimization requires no secret, token, credential, or network
  service.
- **Infrastructure:** No daemon, worker pool, database, telemetry service, remote cache, profiler,
  or new dependency is authorized. Local resource exhaustion must fail cleanly and predictably.
- **Security verification:** Negative cases cover invalid mode values, malformed/corrupted
  candidate state, path/ACME injection attempts through source identity, nonconvergence, resource
  exhaustion, and suppression of all new artifacts after failure.

---

## Non-Functional Requirements

### Correctness and determinism — complexity XL

- Optimized output is semantically equivalent for every declared input and observable machine
  state. Identical build identities produce identical decisions and bytes.
- Internal failure never publishes a partial, stale, or unverified artifact.

### Target performance and resources — complexity XL

- Every claimed improvement is measured from assembled output and final layout under the complete
  selected profile. Source-operation counts and intermediate instruction counts are not proof.
- Local expert parity is mandatory; each optimized mode demonstrates at least one complete
  whole-program win in its own primary objective.

### Host responsiveness — complexity S

- Record phase-separated optimizer time and peak host memory with project, compiler, mode, host,
  asset, and configuration identity. Treat trends as observations, not wall-clock pass/fail gates.
  Reopen incremental compilation only through AR-026's measured trigger.

### Maintainability — complexity L

- A transformation exists only with a current failing/optimization case, complete rule packet, and
  direct proof. No generalized framework is justified by anticipated future rules alone.
- Keep files and responsibilities small enough to review. Do not centralize all semantic and
  machine rewrites in a monolithic optimizer class.

---

## Acceptance Criteria

1. [ ] **AC-01 — Authority:** RD-08 implementation binds one frozen Specification 4 identity, one
   expert `2.0.0` content commit, and the complete resolved Blend65 v4 ambiguity register from
   AR-001 through AR-050; no v3 implementation/test or feasibility matrix acts as optimizer
   authority.
2. [ ] **AC-02 — Mode surface:** Manifest/schema/CLI cases accept exactly `none`, `balanced`,
   `speed`, and `size`; default `build`/`run` records `balanced`; invalid spelling fails before
   compilation; safety/target/entry settings remain independent.
3. [ ] **AC-03 — `none` boundary:** Seeded optional transforms are absent in `none`, while every
   mandatory correctness/legalization/SFA/layout/branch/package step still passes. No optional
   candidate enumeration, rewrite search, B/R/T comparison, or expert-parity gate runs.
4. [ ] **AC-04 — Hard filters:** Cases prove semantic, MMIO, timing, ABI, opcode, placement,
   memory, stack, SFA, and loader/package violations reject a candidate before mode preference.
5. [ ] **AC-05 — Complete cost:** A fixture with code, initialized data, BSS/globals, assets,
   helper, table, alignment/padding, ZP, SFA/resident RAM, stack, scratch, platform reservations,
   page, branch, loader, and package costs reports every component and reconciles CPU/physical/VIC
   views, residency groups, occupied/free intervals, largest compatible holes, final assembled
   addresses, and artifact bytes. D64 filesystem/container bytes are separately reconciled evidence,
   not B/R/T preference terms.
6. [ ] **AC-06 — Path equivalence:** Branch, loop-bound, success/failure, IRQ, page-cross, and
   bank/load fixtures map the same semantic path classes across candidates; an unknown term cannot
   win selection.
7. [ ] **AC-07 — `balanced`:** One strict dominance fixture is selected; one byte/cycle tradeoff
   retains the feasible baseline; independent non-conflicting dominance wins still apply.
8. [ ] **AC-08 — `balanced` no-baseline case:** With an infeasible baseline and two feasible
   incomparable candidates, compilation produces an actionable mode/resource diagnostic and no
   artifact; explicit `speed` and `size` each select their respective feasible result.
9. [ ] **AC-09 — `speed`:** A larger/faster fixture selects the lexicographically lowest
   worst-to-best cycle vector, then R8.5 resource order, then bytes; no average or frequency field
   participates, while a statically proved loop count and an explicit timing contract affect the
   qualified path cost as real facts.
10. [ ] **AC-10 — `size`:** A smaller/slower fixture selects the fewest logical target-loadable
    bytes, then R8.5 resource order, then the cycle vector while honoring a seeded hard timing bound.
11. [ ] **AC-11 — Tie and stability:** Exact complete-cost ties select the same stable candidate ID
    across repeated clean builds and randomized internal discovery order; a non-identical cost
    cannot be decided by ID.
12. [ ] **AC-12 — Deferred closure:** A locally winning helper/table candidate that loses after
    reachability, SFA, layout, branch repair, or a D64 hard-capacity check is retained until that
    boundary and rejected from the final artifact; container representation never reverses B/R/T
    preference.
13. [ ] **AC-13 — Semantic preservation:** Boundary cases cover width/wrap, full-precision
    constants, signed comparisons/shifts/division/remainder, zero divisor, BCD, evaluation order,
    short circuit, volatile access, aliasing, and optional safety checks with independent results.
14. [ ] **AC-14 — Modern expressiveness:** Nested calls, `POKE(variableAddress, value)`, arrays and
    ordinals above 255, rectangular arrays, aggregate returns/copies, local-derived addresses, and
    finite function values remain legal and behave identically in all four modes.
15. [ ] **AC-15 — Reachability:** Roots through startup, direct/finite calls, callbacks, all selected
    interrupt variants, helpers, player features, asset selections, and load units retain exactly
    reachable code/data and remove seeded dead counterparts.
16. [ ] **AC-16 — Memory/effects:** Normal-RAM forwarding/removal cases pass alias and interrupt
    boundaries; volatile/MMIO cases preserve exact address, value, width, count, order, and NMOS
    bus pattern and reject an unsafe RMW substitution.
17. [ ] **AC-17 — Control and calls:** Direct branch, short-circuit, tail merge, tail call,
    specialization, finite devirtualization, inline, outline, and helper cases each prove behavior,
    complete cost, and at least one negative precondition.
18. [ ] **AC-18 — Loops and arrays:** Zero/one/255/256/greater-than-256 trip and index cases prove
    standard `for` semantics, word-capable ordinal behavior, safe byte-machine induction only when
    unobservable, nested strides, and measured no/partial/full unroll choices.
19. [ ] **AC-19 — Arithmetic:** Byte/word signed/unsigned boundaries and both incoming carry/V
    states prove comparison, add/subtract, shift, multiply, divide, remainder, quotient-plus-
    remainder, inline/helper/table, and constant-strength candidates.
20. [ ] **AC-20 — CPU legality:** Every emitted opcode/addressing form is official NMOS 6510 and
    agrees with post-assembly bytes; seeded W65C02-only and undocumented forms fail even when ACME
    accepts their syntax.
21. [ ] **AC-21 — Register/ZP allocation:** Live register/flag reuse survives joins/calls correctly;
    a global ZP fixture chooses the better complete allocation, avoids an ordinary pair at `$FF`,
    preserves user/platform reservations, and reports static plus peak use.
22. [ ] **AC-22 — Layout and branches:** Final-address cases prove fall-through/inversion,
    alignment benefit versus padding, indexed/branch page costs, bank visibility, deterministic
    long-branch repair, and convergence after downstream size changes.
23. [ ] **AC-23 — SFA closure:** New spill/helper/pointer/domain-variant demands return to SFA,
    interference and budgets recompute, and an instrumented emitter/packager attempt to allocate
    function storage fails before artifact publication.
24. [ ] **AC-24 — Interrupt domains:** Mainline/IRQ/NMI/helper cases preserve separate reachable
    homes/variants, exact raw/firmware ABI, D/status restoration, vector/link placement, stack peak,
    and full path costs with no universal wrapper/dispatcher.
25. [ ] **AC-25 — Asset and loader integrity:** Resident and loadable fixtures preserve requested
    selectors, source bytes, addresses, intervals, quiescence, publication, and D64 structure; the
    optimizer introduces no hidden copy, selector, renderer, compressor, fastloader, or mutable
    duplication.
26. [ ] **AC-26 — Game-workload boundary:** M1, Q-P13, Q-P16, scrolling/buffering, audio cues, and
    Integrator-style composition compile as user-authored programs; public packages expose no
    compiler-owned engine/gameplay module or automatic application algorithm.
27. [ ] **AC-27 — Two oracles:** Every changed code shape has a semantics-derived behavior oracle,
    a separate exact/bounded assembly-cost expectation, and a counterexample; differential
    optimized/`none` execution alone cannot satisfy the criterion.
28. [ ] **AC-28 — Expert local floor:** Equivalent-work comparison covers all R8.46 obligations;
    no local ratio exceeds 1.0 for each optimized-mode objective. Every exact meet has a created
    GitHub issue with complete delta and a concrete path to a future win; no issue action pushes.
29. [ ] **AC-29 — Whole-program wins:** Against independent realistic expert baselines, `balanced`
    is no worse in every complete component and strictly better in at least one, while `speed` and
    `size` each win under their exact lexicographic order. Every local floor and hard constraint
    remains satisfied, and the evidence identifies the global decisions responsible.
30. [ ] **AC-30 — Diagnostics and atomic failure:** Incomparable balanced selection without a
    feasible baseline, nonconvergence, illegal instruction, cost-closure failure, resource
    exhaustion, and stale/inconsistent facts each produce source-associated diagnostics and no new
    output set or stale `run` launch.
31. [ ] **AC-31 — Evidence:** Final `.memory.json`, `.costs.json`, and `.build.json` contain every
    R8.12/report field after optimization, helper discovery, final SFA/layout, branch repair, and
    ACME; reconcile with `.asm`, labels, assets/debug maps, assembled bytes, primary artifact, and
    VICE observations; and separately report code, initialized data, BSS/globals, SFA, ZP, stack,
    assets, helpers, loader/scratch, alignment/padding, platform reservations, CPU/physical/VIC views,
    residency groups, occupied/free intervals, and largest compatible holes. Every overlap,
    overflow, visibility, alignment, contiguity, banking, ZP, SFA, stack, general-memory, or
    reconciliation failure prevents publication and names required versus available capacity,
    blockers, compatible holes, and remedies. Unproved dynamic low-level ranges bound the report's
    guarantee rather than adding runtime code or rejecting legal source.
32. [ ] **AC-32 — Determinism:** Two clean builds for every mode and representative PRG/D64 project
    produce identical selected IDs, assembly, maps, diagnostics, and artifact hashes under the same
    recorded toolchain identity.
33. [ ] **AC-33 — Impact-based verification:** Per-rule records show directed checks during work;
    one complete RD-08 boundary qualification runs at closeout. No evidence requires the full
    readiness suite after every change or introduces a replacement readiness framework.
34. [ ] **AC-34 — Host observations:** Phase-separated optimizer time and peak memory are recorded
    for the representative projects without a wall-clock correctness/release failure threshold.
35. [ ] **AC-35 — Security boundary:** Invalid modes, malformed internal cost/candidate state,
    source-name/path/ACME injection attempts, nonconvergence, and resource-exhaustion inputs fail
    deterministically without command injection, path escape, partial output, secret, service, or
    network dependency.
36. [ ] **AC-36 — Evidence status:** Every emulator result records exact VICE/profile/artifact
    identity; skipped or silicon-sensitive endpoints remain `Unknown` or
    `VICE-verified / hardware-unverified` until their assigned physical QA runs.
37. [ ] **AC-37 — Deferral expiry:** Closeout answers the mandatory deferral-expiry question,
    records every inspected register/Won't-Have/future/ledger/debt location, and assigns each expired
    item before RD-08 is marked complete.
38. [ ] **AC-38 — Combined-frontier completion:** Expert `2.0.0` supplies the sourced modern-plus-
    6502 inventory. Seeded cases prove identical discovery depth in all optimized modes, complete
    enumeration and justified pruning, cost-selected structured peepholes, a multi-group fixed
    point, deterministic failure on nonconvergence, bounded exact search for one tractable region,
    and rejection of an unbounded universal-optimality claim or imported framework assumption.

---

## Completion Outcome

RD-08 is complete only when all four modes are deterministic, the three optimized modes implement
the exact approved complete-cost policy and exhaust the same combined qualified frontier to proved
closure, every selected transformation is semantically proved and measured from final output, no
local code falls below the expert floor, and each optimized mode demonstrates a real whole-program
win. The result is frontier-optimal within its frozen expert/compiler identity and remains a small
ahead-of-time compiler: no universal-optimality claim, runtime optimizer, game engine, pass/tuning
product, PGO system, or hidden resource cost has been added.
