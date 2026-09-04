# Evidence, Assembly Parity, and Recovery Audits

Use this reference for compiler status reports, capability claims, test/readiness evaluation,
generated assembly review, and clean-slate salvage decisions.

## Establish separate baselines

Never blend these states:

1. **Specification baseline:** what legal programs and observable behavior are promised.
2. **Accepted implementation:** committed code whose verification state is known.
3. **Work in progress:** uncommitted or archival checkpoint work, which is evidence but not an
   accepted capability.
4. **Proposed replacement:** clean-slate work, which earns components only after re-verification.

Preserve old work before a recovery effort. Preservation does not endorse its architecture or make
its roadmap status authoritative.

## Evidence ladder

Use the cheapest level that can decide the claim, but do not stop below the level the claim needs:

| Level | Evidence | What it can establish |
|---|---|---|
| E0 | roadmap, plan, comment, coverage count | a claim or investigation lead only |
| E1 | source trace with file/line evidence | mechanism exists and appears reachable |
| E2 | focused unit/specification test | stage-local behavior under tested cases |
| E3 | representative source compiled through the public API | pipeline acceptance and diagnostics |
| E4 | emitted assembly assembled and bytes/symbols inspected | target legality, encoding, placement |
| E5 | deterministic emulator observation | runtime and digital hardware behavior |
| E6 | equivalent expert assembly with measured costs | local output parity and remaining cost |
| E7 | real hardware | silicon/analog behavior not settled by emulation |

A green lower level cannot prove a higher-level claim. For example, parser coverage cannot prove a
game construct reaches correct machine code, and a VICE smoke program cannot prove the frozen
language is complete.

## Capability audit record

For each language or compiler capability capture:

- source form and real game use;
- governing specification clause;
- implementation path by stage;
- positive, boundary, and negative probes;
- observed diagnostics or output;
- assembled bytes and symbol placement when relevant;
- emulator observation when behavior is runtime/hardware dependent;
- expert comparison and cost delta;
- status: verified complete, verified partial, scaffold/stub, incorrect, or unknown;
- confidence and the cheapest missing proof.

Audit representative vertical programs before exhaustively cataloguing internal variants. A small
set of real game-shaped programs reveals missing interactions that hundreds of isolated generated
cases can miss.

## Expert parity method

### Define equivalent work

The compiler and hand-written routine must share:

- the same inputs, outputs, side effects, and failure behavior;
- the same initial banking and interrupt state;
- the same data placement and alignment freedoms;
- the same calling and preservation obligations;
- the same steady-state versus one-time setup boundary.

If either side receives an advantage, state it and report a second normalized comparison.

### Measure all relevant costs

- code bytes, including reachable helper routines and call sites;
- data bytes, padding, lookup tables, duplicated assets, and pointer storage;
- path-specific cycles: setup, hot/steady path, taken/not-taken, and worst case;
- zero-page bytes and lifetime;
- hardware stack depth and static frame/scratch memory;
- MMIO access count/order and bank-switch overhead;
- whole-program effects such as alignment padding and dead helper retention.

Instruction-for-instruction equality is strong evidence but not the only success form. A compiler
may use a different sequence with equal or lower total cost. Conversely, deleting instructions can
leave binary size unchanged because alignment padding grows; report both local and whole-program
effects.

### Classify divergence

- **Correctness defect:** wrong value, control flow, width, flags, memory effect, or hardware state.
- **Expressiveness defect:** the useful program cannot be stated naturally or at all.
- **Local parity defect:** an expert routine is smaller/faster under equivalent obligations.
- **Whole-program opportunity:** global placement/allocation/specialization can beat isolated hand
  tuning.
- **Intentional tradeoff:** a measured cost buys a stated semantic guarantee or cold-path benefit.
  Require evidence that the tradeoff is necessary.

An unexpressible program has no finite parity ratio and must not disappear from reporting merely
because the scoreboard includes only successful compilations.

## Test-value audit

For each test framework, generated catalog, oracle, publication, replay format, or readiness layer,
ask:

1. Name a concrete defect it uniquely catches.
2. Show that the test fails when that defect is deliberately seeded or represented by a fixture.
3. Explain why a direct specification test, representative compiled program, assembly assertion,
   or VICE assertion is insufficient.
4. Measure maintenance cost: production lines, test lines, generated data, execution time, and
   concepts a contributor must understand.
5. Identify its external consumer or release decision.

Classify the component:

- **Retain:** unique, demonstrated value exceeds its cost.
- **Simplify:** valuable outcome, excessive mechanism.
- **Replace:** a smaller direct proof covers the same risk.
- **Quarantine:** preserve for study but remove from ordinary build/workflow paths.
- **Retire:** no unique consumer or demonstrated defect-finding value.

Coverage percentage, test count, schema validation, determinism, and replayability are properties
of a harness. They are not evidence that the harness asks the right compiler questions.

## Clean-slate salvage rule

Bring an old component into a replacement only when it passes all of these:

- the replacement currently needs the behavior;
- its contract is consistent with the frozen specification;
- focused tests and vertical probes demonstrate correctness;
- its dependency and abstraction cost is lower than rewriting the needed behavior directly;
- it does not import obsolete workflow concepts or constrain future expert-quality codegen.

Port the smallest coherent behavior, not an entire package by default. Lexer, parser, diagnostic,
emitter, and VICE-harness components may be independently salvageable even when the surrounding
pipeline is not.

## Audit safeguards

- Audit read-only unless the user separately authorizes fixes.
- Never silently repair a probe or weaken a specification test to obtain green.
- Keep audit fixtures temporary until their value is proven; promote only durable regressions.
- Record contradictions and unknowns rather than resolving product intent by assumption.
- Keep findings separate from remedies so an attractive rewrite does not bias the diagnosis.
- Report complexity measurements with their method and exclusions; generated data and tests should
  be separated from production code rather than hidden or combined selectively.
