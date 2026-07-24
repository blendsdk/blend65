# Ambiguity Register: Commercial-Game Optimizer and Code Generator

> **Status**: ✅ GATE PASSED — all 26 items resolved
> **Last Updated**: 2026-07-24 22:05 CEST
> **Mode**: Auto-design
> **Root invocation ID**: `game-optimizer-codegen-20260724-01`
> **Policy version**: 1

| # | Category | Ambiguity / gap | Resolution | Authority | Status |
|---|---|---|---|---|---|
| AR-1 | Product scope | Is optimization a secondary enhancement or part of Blend65's product identity? | Blend65 is an absolute top-of-the-line commercial-game-class compiler; optimizer and code generator quality are product requirements | User, explicit 2026-07-24 | ✅ Resolved |
| AR-2 | Product acceptance | Which workload class defines success? | Faithful C64 games in the class of Commando, The Last Ninja and fast Super Mario Bros-style scrolling; representative original workloads, not copyrighted game code or reduced-scope demakes | User goal plus project faithfulness directive | ✅ Resolved |
| AR-3 | Scope | Does optimizer/codegen success alone make every exemplar game feasible? | No; optimizer/codegen owns generated-code quality, while streaming, overlays, indirect calls, sound and libraries remain separately gated capabilities | User goal reconciled with capability matrix | ✅ Resolved |
| AR-4 | Architecture | Where does this capability live? | A separate `game-optimizer-codegen` feature consumes compiler-readiness semantic evidence and asm-parity expert evidence; it does not alter active compiler-readiness/RD-02 | AI delegated by `--auto-design`; blind challenger converged | ✅ Resolved |
| AR-5 | Semantic authority | What decides whether an optimization is correct? | Frozen language semantics plus independent readiness oracles and target execution; compiler output, current goldens and hand twins cannot manufacture semantic truth | AI delegated by `--auto-design` | ✅ Resolved |
| AR-6 | Optimization representation | Must the canonical mutable TAC IL be replaced with SSA? | Keep canonical TAC as the pipeline boundary; construct a derived, non-serialized SSA/value-and-memory overlay for analysis and optimization, then lower back before allocation/codegen | AI delegated by `--auto-design` | ✅ Resolved |
| AR-7 | Effects and aliasing | How are memory, MMIO, calls and interrupts modeled? | One conservative effect system classifies ordinary memory regions, aliases, volatile/MMIO, calls, intrinsics, interrupt-visible state and unknown effects; absence of proof blocks motion/removal | AI delegated by `--auto-design` | ✅ Resolved |
| AR-8 | Pipeline identity | How are passes classified, ordered and replayed? | Closed content-addressed pass manifest with stable IDs, revisions, phase, kind, prerequisites, invalidations, effect contract, skippability and deterministic order | AI delegated by `--auto-design` | ✅ Resolved |
| AR-9 | Optimization scope | Is optimization function-local or whole-program? | Whole-program AOT optimization is the default: call-graph summaries, specialization, inlining, internal ABI selection, runtime pruning and cross-routine allocation; conservative boundaries remain around exported/indirect/interrupt entry points | AI delegated by `--auto-design` | ✅ Resolved |
| AR-10 | Allocation | What allocation quality is required on a three-register CPU? | Jointly optimize A/X/Y residency, zero page, static frames, call-graph overlays, spills and reloads using liveness/effect data; allocation is part of the cost search, not a fixed pre-pass | AI delegated by `--auto-design` | ✅ Resolved |
| AR-11 | Instruction selection | How is expert-quality 6502 selection obtained? | Costed dynamic-programming selection over typed/effect-aware patterns with flag-state tracking, addressing-mode choice, constant materialization and runtime-call alternatives | AI delegated by `--auto-design` | ✅ Resolved |
| AR-12 | Local optimality | How are short 6502 sequences made optimal? | An offline bounded superoptimizer exhaustively validates candidate sequences and publishes a reviewed rule catalog; production compilation applies only proven deterministic rules | AI delegated by `--auto-design` | ✅ Resolved |
| AR-13 | Feedback | Is static optimization sufficient for game hot paths? | No; deterministic VICE-backed profile-guided optimization is required as an optional evidence input, with stable workload identity and safe static fallback | AI delegated by `--auto-design` | ✅ Resolved |
| AR-14 | Hardware semantics | May optimization reorder hardware access or ignore timing? | Volatile/MMIO and CPU-control effects are ordered barriers; explicit interrupt/raster contracts preserve stated cycle windows and latency, while ordinary code may become faster without treating incidental instruction timing as language semantics | AI delegated by `--auto-design` | ✅ Resolved |
| AR-15 | Cost model | Which resources are optimized? | Exact linked bytes, path-sensitive NMOS 6502 cycles, zero-page bytes, static RAM/frame bytes, stack depth, data padding, runtime helper cost and frame/IRQ worst-case budgets | AI delegated by `--auto-design` | ✅ Resolved |
| AR-16 | Trade-offs | May one resource regress to improve another? | Never worsen both bytes and cycles; a one-axis regression requires an explicit objective/budget and a measured whole-program win; the default profile rejects unexplained Pareto regressions | AI delegated by `--auto-design` | ✅ Resolved |
| AR-17 | Correctness proof | What must every transform prove? | Machine-checkable preconditions, pass-contract specs, bounded translation validation where modeled, generated oracle comparison, ACME/VICE obligations, mutation effectiveness, replay/shrinking and independent review | AI delegated by `--auto-design` | ✅ Resolved |
| AR-18 | Failure localization | How are interaction failures diagnosed? | Reference, isolated-pass, pass-prefix and full profiles share one case identity but carry distinct execution identities; first-failing-prefix bisection and pass-set reduction preserve the terminal predicate | AI delegated by `--auto-design` | ✅ Resolved |
| AR-19 | Performance evidence | What represents commercial game workloads? | Game-shaped kernels and whole programs cover smooth scrolling, sprite multiplexing, input, sound cadence, animation, collision, AI, streaming boundaries and IRQ/mainline interaction, each with expert twins and budgets | AI delegated by `--auto-design` | ✅ Resolved |
| AR-20 | User ergonomics | How much hardware tuning must a Blend65 programmer perform? | Modern source remains the default; the compiler infers placement, allocation and transforms. Advanced profiles/budgets express intent, not 6502 mechanics, and zero-cost platform APIs hide hardware lore | AI delegated by `--auto-design` | ✅ Resolved |
| AR-21 | Evolution | How do profiles, manifests and evidence survive change? | Closed versioned schemas, content revisions, atomic publication, exact replay or explicit invalidation, deterministic migrations and no nearest-version fallback | AI delegated by `--auto-design` | ✅ Resolved |
| AR-22 | Concurrency and security | How do large campaigns run safely? | Canonical isolated roots, allowlisted IDs/paths, argument-array subprocesses, bounded resources, deterministic parallel merge, cancellation cleanup and no generated shell/filesystem authority | AI delegated by `--auto-design` | ✅ Resolved |
| AR-23 | Rollout | When may a pass or pipeline become the default? | Lifecycle `proposed → experimental → assured → default-enabled → retired`; all existing transforms are inventoried; every default-enabled pass is semantically assured and quality-gated, with meet-only parity debt filed | AI delegated by `--auto-design` | ✅ Resolved |
| AR-24 | Portfolio scope | Which non-optimizer capabilities are still required for commercial-game-class Blend65? | Track expressiveness/conformance, indirect calls, platform libraries, IRQ/raster services, asset pipeline, fixed-point math, sound/tracker integration, disk I/O/fast loading, streamed data, overlays/linking, debugging/profiling and release packaging as explicit external dependencies; never hide them inside optimizer completion | User requested completeness audit; AI structured under `--auto-design` | ✅ Resolved |
| AR-25 | Target architecture | Does C64-first acceptance permit C64 constants in generic optimizer/backend logic? | No; C64/NMOS 6502 is the first commercial gate, but costs, legal instructions, memory regions, ABI, effects and hardware constraints are versioned target-profile contracts. A target may claim commercial quality only after its own proof and corpus gates pass | AI delegated by `--auto-design`, grounded in the repository's five declared target families | ✅ Resolved |
| AR-26 | Resource budgets | Which initial resource ceilings make boundedness testable before empirical tuning? | Freeze explicit interactive, release and campaign safety ceilings in RD-18; later lowering requires measured evidence and a versioned profile revision, while raising a ceiling requires an authorized resource/security review | AI delegated by `--auto-design` | ✅ Resolved |

## Resolution Records

### AR-1 — Commercial-game-class product identity

- **Authority:** User — explicit decision on 2026-07-24
- **Decision:** Blend65 exists to be an absolute top-of-the-line commercial-game-class compiler;
  optimizer and code generator quality are core product behavior, not optional polish.
- **Acceptance consequence:** plans may not call a pipeline complete merely because output is
  correct; generated code must meet the project's expert floor and beat realistic whole-program
  hand optimization.

### AR-2 — Workload class

- **Authority:** User — explicit goal on 2026-07-24
- **Decision:** target faithful workloads in the class of Commando's vertical action scrolling,
  The Last Ninja's isometric/multiload engine, and fast Super Mario Bros-style horizontal
  scrolling.
- **Boundary:** use original Blend65 fixtures and legally independent workload models. The titles
  define capability and quality classes, not source/assets to reproduce.
- **Reopen trigger:** the capability matrix adds a harder commercial workload class that changes
  the optimizer/codegen architecture.

### AR-3 — Capability boundary

- **Authority:** User goal plus existing project capability model
- **Decision:** optimizer/codegen is necessary but not sufficient. The Last Ninja class also
  requires streamed data; other titles may require overlays, indirect calls, sound or libraries.
- **Evidence:** `docs/game-feasibility-matrix.json` identifies Commando as optimizer-bound and The
  Last Ninja as streamed-data-bound.
- **Strongest counterargument:** a broad compiler feature could own every blocker.
- **Resolution:** rejected because it would hide independent expressiveness/platform deliverables
  and make optimizer acceptance unfalsifiable.

### AR-4 — Feature ownership

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal requirements architecture within the confirmed product scope
- **Objective:** preserve independent semantic and performance authorities while avoiding conflict
  with active compiler-readiness execution.
- **Decision:** create a separate `game-optimizer-codegen` feature. Consume versioned provider
  contracts from compiler-readiness, blend65-ri and asm-parity.
- **Evidence:** compiler-readiness excludes performance from semantic readiness; asm-parity twins
  are cost evidence rather than semantic authority; blend65-ri's IL/peephole RDs own passthrough
  seams rather than the complete commercial optimizer.
- **Rejected alternatives:** put everything in compiler-readiness; put semantic assurance in
  asm-parity; reopen the active RD-02 plan.
- **Strongest counterargument:** a separate feature adds dependency fan-in and traceability work.
- **Confidence:** High — change only if the scope is reduced to a one-shot semantic check.
- **Hardening:** blind design challenger converged on separate ownership and versioned provider
  contracts.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** provider boundaries cannot expose evidence without copied semantic logic.

### AR-5 — Independent semantic authority

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** optimizer verification architecture
- **Objective:** prevent circular proof of wrong-code transformations.
- **Decision:** frozen semantics plus independent readiness oracles and ACME/VICE results decide
  correctness. Goldens/twins remain regression and cost evidence only.
- **Evidence:** compiler-readiness already establishes this authority split.
- **Rejected alternatives:** optimized-vs-unoptimized differential alone; hand assembly as semantic
  oracle.
- **Strongest counterargument:** the independent evaluator is intentionally bounded.
- **Confidence:** High — unsupported semantics remain explicit gaps, never passes.
- **Hardening:** Alive2/Csmith/YARPGen comparison reinforced multi-oracle coverage.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** readiness cannot model a required observable for an enabled transform.

### AR-6 — Derived SSA/value-memory overlay

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal optimizer representation
- **Objective:** enable top-tier dataflow and whole-program optimization without destabilizing the
  shipped TAC/codegen boundary.
- **Decision:** canonical IL remains mutable TAC. The optimizer builds a derived SSA value graph,
  dominance/loop forest and memory/effect overlay, applies verified rewrites, then lowers back to
  canonical IL before allocation.
- **Evidence:** current `ILPass` accepts/returns `ILProgram`; the earlier SSA rejection conflated a
  compile-time analysis form with scarce target registers. A non-serialized overlay avoids a third
  public lowering level.
- **Rejected alternatives:** optimize mutable TAC only; permanently replace IL with SSA; sea of
  nodes as the first implementation.
- **Strongest counterargument:** SSA construction/destruction adds compiler complexity.
- **Confidence:** High — change if measured optimizer compile-time or destruction costs exceed the
  bounded budgets without delivering coverage.
- **Hardening:** the 10×-budget and contrarian review moved the design from TAC-only to an overlay,
  while retaining the stable boundary.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** the overlay cannot faithfully represent mutable memory/effects or round-trip.

### AR-7 — Effect and alias authority

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** compiler semantic-analysis mechanism
- **Objective:** permit aggressive motion/elimination only where hardware-visible behavior is
  proven unchanged.
- **Decision:** one effect model owns alias regions, escape state, reads/writes, volatile/MMIO,
  calls, intrinsics, interrupts and unknown effects; transforms query it rather than duplicating
  barriers.
- **Evidence:** current lowering already treats CPU-control intrinsics as barriers; commercial C64
  code makes MMIO ordering observable.
- **Rejected alternatives:** opcode-local purity guesses; treat every memory operation as volatile.
- **Strongest counterargument:** conservative aliasing can suppress valuable transforms.
- **Confidence:** High — precision grows through proof-bearing summaries, never optimistic guesses.
- **Hardening:** unchanged after adversarial effect-order review.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** a legal program exposes an effect the closed model cannot classify.

### AR-8 — Pass manifest and pipeline identity

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal data/evolution mechanism
- **Objective:** make every compiled result, failure and cost delta attributable and replayable.
- **Decision:** publish a closed content-addressed manifest containing stable pass identity,
  implementation revision, phase, kind, dependency/order, analysis invalidations, effect contract,
  skippability and objective compatibility.
- **Evidence:** the current pipeline has always-on IL layout, optional peephole and always-on branch
  legalization; a Boolean optimize flag cannot identify this composition.
- **Rejected alternatives:** implicit source-order arrays; public arbitrary pass ordering.
- **Strongest counterargument:** manifest churn invalidates evidence frequently.
- **Confidence:** High — semantic revisions must invalidate stale evidence.
- **Hardening:** LLVM OptBisect comparison added explicit skippable-versus-legalizer classification.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** two materially different pipelines can share an identity.

### AR-9 — Whole-program AOT optimization

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** optimizer scope and algorithms
- **Objective:** exploit the compiler-only advantage over per-routine hand tuning.
- **Decision:** use whole-program call/effect summaries for inlining, specialization, constant
  propagation, internal ABI selection, runtime pruning and cross-routine allocation. Exported,
  indirect, recursive and interrupt roots impose conservative boundaries.
- **Evidence:** Blend65 is AOT with static allocation; the Prime Directive requires the win at
  whole-program scale.
- **Rejected alternatives:** function-local optimizer only; unrestricted code duplication.
- **Strongest counterargument:** global analysis increases compile time and code-size risk.
- **Confidence:** High — budgets and Pareto gates constrain growth.
- **Hardening:** no change after 10×-budget review.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** separate compilation or dynamic linking becomes a supported product mode.

### AR-10 — Joint register/ZP/frame allocation

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** allocation algorithm
- **Objective:** remove the systematic absolute-frame traffic an expert would avoid.
- **Decision:** optimize register residency, ZP, static-frame overlays, spill/reload placement and
  call/IRQ interference jointly from liveness and cost data.
- **Evidence:** the target has A/X/Y plus scarce ZP; current static allocation decides too early for
  later optimizer knowledge.
- **Rejected alternatives:** fixed pre-codegen allocation; register-only greedy allocation.
- **Strongest counterargument:** exact joint allocation can become combinatorial.
- **Confidence:** High — use bounded regional search with deterministic fallback.
- **Hardening:** reframing added call-graph overlays and IRQ interference to the original
  register/ZP design.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** search budgets routinely fall back on game-shaped hot regions.

### AR-11 — Costed instruction selection

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** code-generation algorithm
- **Objective:** choose the same or better addressing/instruction idioms as an expert 6502 coder.
- **Decision:** dynamic-programming selection over typed patterns, incoming/outgoing register and
  flag states, addressing modes, constants and runtime alternatives.
- **Evidence:** a direct one-IL-op/one-template translator cannot compare multi-instruction idioms.
- **Rejected alternatives:** ordered first-match templates; rely on peephole cleanup.
- **Strongest counterargument:** stateful selection tables are harder to maintain.
- **Confidence:** High — generated tables and exhaustive legality tests contain complexity.
- **Hardening:** contrarian review rejected pushing all quality into peephole rules.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** selection state cannot express a required expert idiom without exponential
  growth.

### AR-12 — Verified bounded superoptimization

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** optimizer algorithm and publication mechanism
- **Objective:** exhaustively discover locally optimal 6502 sequences without trusting search at
  production compile time.
- **Decision:** run bounded offline enumerative/equality-saturation search, validate all modeled
  entry states and effects, review counterexamples, then publish content-addressed rules.
- **Evidence:** the 8/16-bit state space makes many short sequences exhaustively tractable; Alive2
  demonstrates the value of translation validation.
- **Rejected alternatives:** online stochastic search; hand-authored peepholes only.
- **Strongest counterargument:** full 6502 state including memory is too large.
- **Confidence:** High — partition by declared live state/effects and leave unsupported forms
  unassured.
- **Hardening:** 10×-budget review promoted superoptimization from optional to required.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** validator independence or state coverage cannot be demonstrated.

### AR-13 — Deterministic profile-guided optimization

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** performance-engineering mechanism
- **Objective:** optimize actual frame-critical paths without requiring users to know 6502 lore.
- **Decision:** optionally ingest versioned VICE workload profiles; bind counts/edges to program,
  workload, target and tool revisions; fall back safely to static estimates.
- **Evidence:** scrolling and multiplexing concentrate work in a small set of per-frame paths.
- **Rejected alternatives:** static heuristics only; runtime-adaptive code on the C64.
- **Strongest counterargument:** representative profiles are hard to collect and can overfit.
- **Confidence:** Medium — raise to High after two game-shaped programs improve without cold-path
  regressions.
- **Hardening:** PGO added by the 10×-budget reframing.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** profile collection perturbs timing beyond the declared tolerance or profiles
  are not replay-stable.

### AR-14 — Hardware effects and timing

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** codegen safety and performance policy within confirmed hardware target
- **Objective:** preserve VIC/CIA/SID/CPU-visible behavior while still optimizing ordinary code.
- **Decision:** MMIO and CPU-control accesses are ordered volatile effects. Explicit IRQ/raster
  contracts carry worst-case cycle/latency budgets; incidental instruction timing elsewhere is not
  frozen.
- **Evidence:** reordering register writes can visibly corrupt a frame; freezing all timing would
  prohibit optimization.
- **Rejected alternatives:** all timing observable; timing never observable.
- **Strongest counterargument:** v3 lacks a complete user-facing timing-contract syntax.
- **Confidence:** Medium — requirements keep timing contracts in configuration/fixtures until a
  Language-Guard-approved source surface exists.
- **Hardening:** balanced hardware correctness against the modern-programmer directive.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** users need source-level cycle contracts that cannot be expressed externally.

### AR-15 — Multi-resource exact cost model

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** optimizer cost model
- **Objective:** optimize the resources that actually limit a commercial C64 game.
- **Decision:** cost exact post-link bytes, path cycles, ZP, static RAM/frame, stack, padding,
  runtime helpers and frame/IRQ worst cases; include relocation/layout effects.
- **Evidence:** prior parity work showed a 13-byte code win can disappear into alignment padding.
- **Rejected alternatives:** instruction count; pre-link bytes/cycles only; one weighted scalar.
- **Strongest counterargument:** vector comparison complicates search.
- **Confidence:** High — Pareto fronts and explicit budgets preserve the real trade-offs.
- **Hardening:** project measurement history changed the design from code-only to linked-program
  cost.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** a matrix capability exposes an unmodeled limiting resource.

### AR-16 — Trade-off policy

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** performance mechanism constrained by the existing Prime Directive
- **Objective:** prevent optimizations that win a metric while making real programs worse.
- **Decision:** reject transforms that worsen both bytes and cycles. A one-axis regression needs a
  named objective/budget and measured whole-program benefit; unexplained regressions fail default.
- **Evidence:** no universal scalar exchange rate exists between bytes, cycles and scarce memory.
- **Rejected alternatives:** fixed weighted score; always prefer speed; always prefer size.
- **Strongest counterargument:** Pareto sets can grow.
- **Confidence:** High — deterministic pruning and per-region bounds contain them.
- **Hardening:** unchanged.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** the search cannot meet compile-time budgets with bounded Pareto sets.

### AR-17 — Transformation assurance gate

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** testing and release mechanism
- **Objective:** make wrong-code default enablement structurally impossible.
- **Decision:** require pass specs, RED mutation proof, precondition/equivalence validation,
  independent source oracle, ACME/VICE where applicable, interaction campaigns, replay/shrink,
  promoted regression and independent semantic/performance review.
- **Evidence:** unit goldens cannot prove semantic equivalence; generated end-to-end tests alone do
  not localize a pass.
- **Rejected alternatives:** unit tests only; differential optimized/unoptimized only.
- **Strongest counterargument:** the full gate is expensive for trivial rules.
- **Confidence:** High — evidence routes scale by risk while no semantic obligation is waived.
- **Hardening:** comparable-system analysis converged on layered proof.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** a pass class cannot reach a decisive independent oracle.

### AR-18 — Profiles, bisection and reduction

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** failure localization and replay
- **Objective:** turn a full-pipeline wrong result into one actionable transform and minimal case.
- **Decision:** run reference, isolated, prefix and full profiles under a separate execution
  identity; bisect the first failing prefix and reduce the required pass set and program.
- **Evidence:** current public optimize Boolean controls only peephole while other transforms and
  legalizers always run.
- **Rejected alternatives:** expose arbitrary public pass lists; compare only O0/O1.
- **Strongest counterargument:** some failures require non-monotonic pass interactions.
- **Confidence:** High — interaction minimization supplements prefix bisection.
- **Hardening:** LLVM OptBisect added invocation-level tracing and legalizer distinction.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** a failure cannot be reproduced from its recorded execution identity.

### AR-19 — Game-shaped acceptance corpus

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** testing/performance architecture within user-confirmed workload class
- **Objective:** measure code real games contain rather than constant-by-construction microfixtures.
- **Decision:** maintain independent kernels and whole programs for scrolling, multiplexing, input,
  sound cadence, collision, AI, animation, streaming boundaries and IRQ/mainline interaction.
- **Evidence:** the existing parity roadmap records that synthetic fixtures dominate its headline
  ratio and `boing-ball` is the first game-shaped twin candidate.
- **Rejected alternatives:** microbenchmarks only; copyrighted game disassembly corpus.
- **Strongest counterargument:** synthetic kernels may still miss emergent whole-program behavior.
- **Confidence:** High — require both kernels and complete original programs.
- **Hardening:** user exemplars expanded the corpus beyond generic optimizer tests.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** a target game class remains blocked by generated-code quality with all
  current corpus gates green.

### AR-20 — Modern programmer ergonomics

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** compiler interface mechanism within the governing audience directive
- **Objective:** produce expert assembly without asking game developers to encode 6502 tricks.
- **Decision:** infer optimization, allocation, placement and library idioms. Advanced controls
  state intent/budgets; platform APIs hide hardware granularity at zero cost.
- **Evidence:** project directives explicitly separate modern input ergonomics from expert output.
- **Rejected alternatives:** require manual unrolling/register selection; opaque optimizer with no
  budget surface.
- **Strongest counterargument:** inference cannot know every game-specific hot path.
- **Confidence:** High — PGO and declarative budgets cover exceptional cases.
- **Hardening:** unchanged.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** a common expert idiom remains expressible only through hardware-lore source.

### AR-21 — Evidence and manifest evolution

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** reversible data/migration design
- **Objective:** preserve historical failures and cost trends without stale claims.
- **Decision:** closed schemas, content revisions, deterministic migrations, atomic publication and
  exact replay; otherwise emit explicit invalidation and never substitute current/nearest logic.
- **Evidence:** compiler-readiness already uses exact implementation/replay identity.
- **Rejected alternatives:** semantic version labels alone; best-effort replay.
- **Strongest counterargument:** old implementation revisions may become unavailable.
- **Confidence:** High — explicit invalidation is honest and auditable.
- **Hardening:** data/migration lens added atomic publication and mixed-version rejection.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** an allowed migration cannot be made deterministic or recoverable.

### AR-22 — Safe deterministic campaigns

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** concurrency, security and operational mechanisms
- **Objective:** scale expensive compiler/ACME/VICE validation without nondeterminism or host risk.
- **Decision:** isolated canonical roots, allowlisted paths/IDs, argument arrays, caps, deterministic
  merge, collision checks, cancellation cleanup, bounded workers and no generated host authority.
- **Evidence:** VICE is a real subprocess with sequential resource constraints; generated inputs are
  untrusted host data.
- **Rejected alternatives:** shared output directories; shell interpolation; unbounded parallelism.
- **Strongest counterargument:** strict isolation adds I/O overhead.
- **Confidence:** High — correctness and host safety dominate minor harness overhead.
- **Hardening:** concurrency lens added cancellation/unknown-outcome recovery.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** deployment adds remote workers or shared durable queues.

### AR-23 — Pass lifecycle and default enablement

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal rollout mechanism under explicit commit authority
- **Objective:** prevent experimental transforms from silently becoming product behavior.
- **Decision:** every pass moves through proposed, experimental, assured, default-enabled and
  retired states. Existing transforms enter the inventory and must clear the same gate. A local
  meet-only expert result files a tracked improvement issue.
- **Evidence:** current always-on and optional stages are not represented by one lifecycle; the
  Prime Directive forbids silent settle-at-meet.
- **Rejected alternatives:** merge implies enablement; grandfather existing passes.
- **Strongest counterargument:** lifecycle ceremony slows small local improvements.
- **Confidence:** High — risk-scaled evidence can be small, but correctness/parity gates remain.
- **Hardening:** challenger reinforced auditing existing transforms before any umbrella claim.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** lifecycle state and production pipeline composition can drift undetected.

### AR-24 — Commercial-game capability dependencies

- **Authority:** User requested a complete missing-capability list on 2026-07-24; AI structured the
  technical ownership under `--auto-design`
- **Eligibility:** portfolio decomposition within the confirmed commercial-game product goal
- **Objective:** prevent a top-tier optimizer from being mistaken for a complete game-production
  toolchain.
- **Decision:** optimizer/codegen requirements publish explicit dependencies on:
  1. language conformance and computed-memory expressiveness;
  2. indirect calls and stable external/platform ABIs;
  3. zero-cost C64 register, IRQ, raster, sprite, input and memory APIs;
  4. asset conversion, compression, packing and placement;
  5. fixed-point, lookup-table and bounded math libraries;
  6. SID/tracker playback and interrupt-safe sound integration;
  7. disk image/file APIs, fast loaders and streamed-data pipelines;
  8. code/data overlays, relocation and linker support;
  9. source-level debugging, profiling, cycle tracing and optimizer explanations;
  10. deterministic release packaging and real-hardware acceptance.
- **Evidence:** the capability matrix marks Commando optimizer-bound but The Last Ninja
  streamed-data-bound, and names overlays, indirect calls, fixed-point math and hand-tuned-assembly
  gaps separately. The conformance audit records computed-memory and call-address expressiveness
  failures that optimization cannot repair.
- **Rejected alternatives:** expand this feature until it owns the entire toolchain; omit external
  dependencies from optimizer acceptance.
- **Strongest counterargument:** a separate dependency map creates additional portfolio work.
- **Confidence:** High — each capability has a distinct correctness and delivery boundary.
- **Hardening:** the user challenge expanded the requirements from generated-code quality to a
  complete portfolio dependency contract.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** the capability matrix identifies another independent blocker for a target
  commercial workload.

### AR-25 — Target-parametric architecture

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal compiler architecture within the confirmed C64-first product goal
- **Objective:** deliver the C64 commercial gate without making the optimizer unusable for the
  C64 Ultimate, Commander X16, Atari 800XL or Atari 7800 targets declared by Blend65.
- **Decision:** C64/NMOS 6502 is the first acceptance profile. Generic analyses and transformations
  consume versioned target contracts for cost, legal instructions/addressing modes, ABI, memory
  regions, effects and timing. Target-specific behavior remains behind `@blend65/platforms` and
  backend profile seams. No other target inherits the C64 commercial claim.
- **Evidence:** the repository declares five target families, while this feature's workload and
  expert-twin evidence is explicitly C64/NMOS 6502.
- **Rejected alternatives:** hardcode C64 throughout and refactor later; require all targets to
  reach commercial parity in the first release.
- **Strongest counterargument:** an abstract target seam can over-generalize before a second backend
  exercises it.
- **Confidence:** High — keep the contract narrow and evidence-driven; add no speculative target
  operations.
- **Hardening:** challenged against the current package boundary: target facts already belong in
  `@blend65/platforms`, so the seam follows an existing ownership boundary.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** a second target cannot implement the contract without C64-specific leakage
  or a target needs a materially different optimization phase model.

### AR-26 — Initial bounded-resource profiles

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** local safety and determinism limits, reversible through versioned profiles
- **Objective:** make denial-of-service resistance and failure behavior testable before performance
  calibration exists.
- **Decision:** RD-18 freezes explicit initial hard ceilings for interactive, release and campaign
  operation. A limit hit returns the last semantically valid state and cannot publish assurance.
  Lower limits may be adopted from measured p99 usage plus headroom; increases require a resource
  and security review and a new profile revision.
- **Evidence:** “calibrate later” cannot satisfy exact-limit/limit+1 acceptance tests and would
  leave hostile or accidental complexity unbounded.
- **Rejected alternatives:** unbounded first release; one universal ceiling; silently truncate
  analyses and continue.
- **Strongest counterargument:** pre-implementation ceilings may be conservative or generous.
- **Confidence:** Medium-high — they are safety ceilings rather than performance promises and are
  intentionally versioned.
- **Hardening:** every ceiling has an explicit typed failure and publication prohibition, so later
  empirical tuning cannot alter correctness.
- **Policy version:** 1
- **Root invocation ID:** `game-optimizer-codegen-20260724-01`
- **Reopen triggers:** largest committed game-shaped fixture reaches 75% of a ceiling, or p99
  measured usage shows a ceiling is more than 8× normal demand.

## Systematic Gate Scan

| Category | Result |
|---|---|
| Feature and behavioral gaps | AR-1–AR-3, AR-9–AR-20 define optimizer/codegen; AR-24 names external toolchain dependencies |
| Scope | C64-first workload, target-parametric architecture and independent capability boundaries are explicit |
| Technical unknowns | Representation, effects, allocation, selection, superoptimization and PGO resolved |
| Edge cases | Overflow, flags, aliasing, MMIO, interrupts, calls, CFG, layouts and interactions required |
| Integration | compiler-readiness, blend65-ri, asm-parity, ACME, VICE and capability matrix named |
| Data and state | Content-addressed manifests, profiles, replay, migration and invalidation resolved |
| Security | Generated input, paths, subprocesses and exact resource bounds covered by AR-22/AR-26 |
| Non-functional | Determinism, scale, compile cost, target portability, evidence evolution and recovery included |
| UX/presentation | Modern intent/budget controls and explainable reports required |
| Stakeholder conflict | Semantic correctness, expert parity and modern ergonomics remain separate authorities |
| Naming | Feature, pass lifecycle, execution profiles, cost vector and assurance terms defined |
