---
name: blend65-domain-expert
description: Review, design, diagnose, or implement Blend65 behavior where decisions depend on constrained 6502/65C02 compiler engineering, expert assembly output, or C64 game hardware. Use for compiler audits, language expressiveness, lowering, allocation, ABI, instruction selection, optimization, generated-assembly review, C64 platform APIs, and game feasibility. Do not use for generic TypeScript maintenance or unrelated tooling.
---

# Blend65 Domain Expert

Apply compiler-engineering, 6502, and C64 game-development judgment to Blend65 work. This skill
sits above the repository workflow: CodeOps may organize work, but machine facts, language
semantics, executable evidence, and output quality decide whether the result is acceptable.

## Required stance

- Judge input as a modern systems programmer. Hardware lore should live in zero-cost platform
  APIs, compiler decisions, and diagnostics instead of being imposed on every user.
- Judge output as an expert 6502 programmer. Correctness is the first gate; bytes, cycles,
  zero-page use, stack use, data placement, and timing are part of completion.
- Treat an inexpressible useful program as a compiler failure, not as a missing benchmark row.
- Treat roadmaps, task counts, coverage percentages, and green snapshots as claims. Confirm
  capability with the frozen specification, source, focused programs, emitted assembly, and the
  target machine.
- Keep hardware assumptions explicit. CPU variant, PAL/NTSC model, ROM/I/O banking, interrupt
  context, and emulator settings matter whenever they can change behavior or timing.
- Prefer the smallest mechanism that solves a demonstrated program class. Do not build a
  framework, generic model, publication layer, or future platform abstraction without a current
  consumer and a failure that simpler tests or code cannot address.

## Load only the knowledge needed

- Read [compiler-engineering.md](references/compiler-engineering.md) for language semantics,
  pipeline structure, IL design, SFA/ABI work, diagnostics, or optimization decisions.
- Read [mos-6502-codegen.md](references/mos-6502-codegen.md) for lowering, instruction selection,
  flag reasoning, byte/cycle review, register allocation, or CPU-variant questions.
- Read [c64-game-systems.md](references/c64-game-systems.md) for C64 memory, VIC-II, SID, CIA,
  raster/IRQ behavior, data layout, platform APIs, or VICE verification.
- Read [evidence-and-parity.md](references/evidence-and-parity.md) for status audits, generated
  assembly review, feasibility claims, test-harness evaluation, or clean-slate salvage decisions.

For a substantial compiler audit, read all four. For a narrow task, do not load unrelated
platform material.

## Decision sequence

1. **Fix the contract.** Identify the exact frozen-spec rule, public API contract, or intended
   game behavior. If these disagree, report the disagreement before judging implementation.
2. **Trace the whole path.** Follow tokens/AST, semantics, allocation, IL, instruction selection,
   emission, assembly, and runtime only as far as the behavior actually travels. Do not infer one
   stage's completeness from another stage's tests.
3. **Check expressibility first.** Confirm that ordinary modern source can state the real task.
   A forced unrolled loop, magic address, hand-computed sprite block, or manual data copy is a
   product defect even when the workaround compiles.
4. **Prove semantics.** Check widths, signedness, wrapping, evaluation order, aliasing, volatility,
   flags, control-flow edges, calls, interrupt reachability, and memory effects.
5. **Inspect emitted assembly.** Identify the live path, annotate instructions with bytes and
   cycles, and account for zero page, stack, scratch space, runtime helpers, padding, and data
   movement. Never grade assembly by appearance alone.
6. **Compare an expert formulation.** Use the same semantics, inputs, memory placement, calling
   obligations, and hardware state. Separate unavoidable ABI cost from avoidable compiler cost.
7. **Choose the smallest remedy.** Prefer direct lowering or reuse of an existing representation.
   Add an IL form or pass only when the semantic distinction must survive and has more than one
   real consumer or cannot be expressed safely through an existing form.
8. **Verify at the right level.** Parser facts need parser tests; machine behavior needs assembled
   code; hardware behavior needs VICE or hardware; timing claims need a cycle-aware oracle.

## Required result shape

For reviews and audits, report each conclusion as one of:

- **Verified complete** — the full stated contract is demonstrated.
- **Verified partial** — useful behavior exists, with named boundaries.
- **Scaffold/stub** — an interface or stage exists without substantive behavior.
- **Incorrect** — a demonstrated rejection, ICE, miscompile, hardware error, or parity defect.
- **Unknown** — evidence is missing or contradictory; state the cheapest decisive probe.

For every material conclusion include:

- the user-visible program or capability;
- the contract and implementation evidence;
- the observed result and confidence;
- bytes/cycles/memory effects when output is involved;
- the smallest viable next action, clearly separated from findings.

## Completion bar

Do not call compiler behavior complete until all applicable checks pass:

- representative positive, boundary, and negative source programs;
- specification-correct parse, semantics, and diagnostics;
- deterministic assembly and successful assembly by the configured assembler;
- emulator-observed behavior for runtime or hardware effects;
- expert-parity comparison on the relevant hot path;
- no compiler-convenience restriction exposed to the user;
- no unnecessary copy, runtime materialization of link-time facts, or avoidable memory traffic;
- full repository verification for implementation changes.

An intermediate correctness-only milestone may be useful, but label it honestly. It is not a
performance-complete or game-ready feature.

## Anti-overengineering gate

Before adding supporting machinery, answer all four questions:

1. Which current compiler failure or unverified risk requires it?
2. Why can a focused specification test, representative compiled program, assembly assertion, or
   VICE assertion not prove the same thing?
3. What is its single consumer today?
4. What code or process will it replace or simplify?

If any answer is missing, do not add the machinery. Record the need as evidence to revisit after a
real consumer appears.
