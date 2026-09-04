# Qualification Cases: Language, Architecture, and SFA

> **Oracle family**: Q-L01..Q-L26
> **Authority gate**: Internally consistent frozen specification and explicit project decisions only.
> **Conflict boundary**: The function-diagnostic assignment conflict between `spec/06-functions.md` and `spec/14-diagnostics.md` is not silently resolved. Cases may freeze unaffected semantics while excluding those numeric assignments; any case that requires the exact assignment is `blocked-conflict`.
> **Result policy**: Result entries are append-only. “Not run” is not a pass.

## Shared Isolation Boundary

The evaluator receives the prompt, the permitted raw artifacts, and—only at candidate stages—the selected runtime references. The evaluator never receives this oracle, planning history, prior results, migration conclusions, or grading notes. The grader must distinguish a correct outcome reached from permitted evidence from a lucky unsupported assertion.

## Q-L01 — Given a language question, locate all governing frozen documents

- **Risk / coverage cells:** Major; `LANG-L01`, `SFA-L01`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “Given a language question, locate all governing frozen documents. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** The live `spec/**/*.md` path inventory and the user’s concrete language question.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Exact crosswalk path(s), normative/evaluation distinction, no duplicated authority.
- **Disqualifying outcomes:** Answers only from skill prose.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L02 — Current compiler rejects `POKE(variableAddress, value)` or requires manual unrolled pokes

- **Risk / coverage cells:** Critical; `LANG-L02`, `SFA-L02`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “Current compiler rejects `POKE(variableAddress, value)` or requires manual unrolled pokes. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** `spec/12-intrinsics.md`, `spec/evaluations/F020-memory-intrinsics.md`, the rejected source, and its diagnostic.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Requires ordinary dynamic-address lowering and classifies compiler-convenience restrictions as defects.
- **Disqualifying outcomes:** Defends constant-only/unrolled source as “6502-friendly”.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L03 — Optimize two volatile reads into one

- **Risk / coverage cells:** Critical; `LANG-L03`, `SFA-L03`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “Optimize two volatile reads into one. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** The relevant volatile/MMIO contract, before/after IL or assembly, and observable-access trace.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Rejects unless platform contract proves identical observable count/order.
- **Disqualifying outcomes:** Treats MMIO as ordinary memory.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L04 — Put C64 addresses into semantic analyzer nodes

- **Risk / coverage cells:** Major; `LANG-L04`, `SFA-L04`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “Put C64 addresses into semantic analyzer nodes. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** The proposed semantic-node change, target-profile interface, and the relevant frozen semantic documents.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Preserves target-neutral frontend; routes capability via declarative target facts.
- **Disqualifying outcomes:** Hardcodes map into language semantics.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L05 — `main` calls either sibling `a` or `b`, never nested

- **Risk / coverage cells:** Major; `LANG-L05`, `SFA-L05`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “`main` calls either sibling `a` or `b`, never nested. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** A closed call graph for `main`, `a`, and `b`, plus live-range and frame-home facts.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Explains when static frames may safely overlay and proof required.
- **Disqualifying outcomes:** Assumes all functions need distinct frames.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L06 — `a` calls `b` while `a` values remain live

- **Risk / coverage cells:** Critical; `LANG-L06`, `SFA-L06`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “`a` calls `b` while `a` values remain live. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** The `a → b` call graph, values live across the call, and proposed frame placement.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Frames/homes cannot overlap where simultaneous lifetime exists.
- **Disqualifying outcomes:** Overlays from mutually-exclusive-call slogan.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L07 — Recursive call-graph SCC

- **Risk / coverage cells:** Critical; `LANG-L07`, `SFA-L07`.
- **Oracle status:** `frozen-project` for recursion prohibition and SFA response; exact diagnostic-code assignment excluded as `blocked-conflict`.
- **Evaluator prompt:** “Recursive call-graph SCC. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** `spec/06-functions.md` and `spec/evaluations/F018-functions.md`; exact function diagnostic numbers are excluded pending conflict resolution.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Emits explicit unsupported/bounded-policy diagnostic; no silent overlap/hidden fallback.
- **Disqualifying outcomes:** Pretends DAG coloring is safe or adds generic software stack by default.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Pre-passer — recursion/reentrancy rejection and user-facing diagnosis exist at outline depth (`compiler-engineering.md:47-58`); the conflicted exact diagnostic assignment was not graded.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L08 — IRQ can preempt mainline and both reach helper/scratch

- **Risk / coverage cells:** Critical; `LANG-L08`, `SFA-L08`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “IRQ can preempt mainline and both reach helper/scratch. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** Mainline/IRQ roots, complete reachable call graph, scratch/frame inventories, and interrupt ABI assumptions.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Models reentrancy/interference and separates interrupt-unsafe state.
- **Disqualifying outcomes:** Considers only direct caller/callee edges.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Pre-passer — whole-call-graph IRQ reachability and non-reentrant scratch interference are explicit (`compiler-engineering.md:49-57`; `c64-game-systems.md:64-68`).
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L09 — Address-taken/exported function has unknown caller

- **Risk / coverage cells:** Major; `LANG-L09`, `SFA-L09`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “Address-taken/exported function has unknown caller. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** The exported/address-taken function set, caller visibility, and proposed closed-world assumptions.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Uses conservative root/escape policy and names cost.
- **Disqualifying outcomes:** Assumes closed-world direct graph.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L10 — ZP pair lands at final byte or pressure exceeds budget

- **Risk / coverage cells:** Critical; `LANG-L10`, `SFA-L10`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “ZP pair lands at final byte or pressure exceeds budget. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** Target ZP windows/reservations, object widths/alignments, and the allocation result.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Handles two-byte fit/wrap and produces explainable target-budget failure.
- **Disqualifying outcomes:** Wraps silently or hides in generic spill area.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L11 — Proposal uses hardware stack for all locals

- **Risk / coverage cells:** Critical; `LANG-L11`, `SFA-L11`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “Proposal uses hardware stack for all locals. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** The proposed stack-frame design, target stack budget, call/IRQ obligations, and SFA doctrine.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Preserves SFA; distinguishes JSR/RTS/IRQ/register/explicit-stack duties.
- **Disqualifying outcomes:** Reopens stack frames without new necessity proof.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L12 — Asked how many IRs/classes Blend65 must have

- **Risk / coverage cells:** Major; `LANG-L12`, `SFA-L12`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “Asked how many IRs/classes Blend65 must have. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** The required compiler responsibilities and the live repository seams, without an idealized class diagram.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Gives responsibilities/invariants and defers exact topology to live audit.
- **Disqualifying outcomes:** Freezes an LLVM-shaped architecture.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L13 — Add Atari target by copying C64 backend

- **Risk / coverage cells:** Major; `LANG-L13`, `SFA-L13`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “Add Atari target by copying C64 backend. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** The C64 and proposed Atari responsibility maps plus selected CPU/platform/emitter/packager facts.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Recommends shared 6502 responsibilities plus selected CPU/platform/emitter/packager.
- **Disqualifying outcomes:** Approves copy or universal C64 hooks.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L14 — Optimizer wants to erase signedness before comparison lowering

- **Risk / coverage cells:** Critical; `LANG-L14`, `SFA-L14`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “Optimizer wants to erase signedness before comparison lowering. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** The semantic operation before and after the proposed IR change and the selected compare lowering inputs.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Rejects loss; signedness must survive to accountable legalization/selection.
- **Disqualifying outcomes:** Asks backend to guess.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L15 — Invalid source causes downstream allocation crash

- **Risk / coverage cells:** Critical; `LANG-L15`, `SFA-L15`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “Invalid source causes downstream allocation crash. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** The invalid source, frontend diagnostics, downstream trace, and artifact-presence result.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Assigns root diagnostic upstream and gates unsafe later stage.
- **Disqualifying outcomes:** Treats ICE as acceptable error handling.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L16 — Compare current plugin interface with desired modularity

- **Risk / coverage cells:** Major; `LANG-L16`, `SFA-L16`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “Compare current plugin interface with desired modularity. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** The live plugin interface and consumers at exact file/line locations plus the modularity goal.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Uses live code as evidence, labels recommendation/inference, does not freeze current seam.
- **Disqualifying outcomes:** Restates current classes as baseline truth.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L17 — `f(1, g())` with transitive callees in the later argument

- **Risk / coverage cells:** Critical; `LANG-L17`, `SFA-L17`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “`f(1, g())` with transitive callees in the later argument. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** `spec/06-functions.md`, the nested-call source, left-to-right effect trace, and proposed homes/lifetimes.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Keeps the earlier argument home live across later-argument evaluation and preserves left-to-right effects.
- **Disqualifying outcomes:** Overlays storage unsafely or rejects ordinary source.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L18 — `f(1, f(2, 3))` with the same eventual callee

- **Risk / coverage cells:** Critical; `LANG-L18`, `SFA-L18`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “`f(1, f(2, 3))` with the same eventual callee. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** `spec/06-functions.md`, the same-callee nested-call source, marshalling timeline, and proposed homes/lifetimes.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Treats outer argument marshalling as live staging, not active recursion; compiles through an SFA-compatible solution.
- **Disqualifying outcomes:** Calls it recursion, emits an ICE, or imposes an alien restriction.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L19 — Narrow intermediate arithmetic crosses its width boundary

- **Risk / coverage cells:** Critical; `LANG-L19`, `SFA-L19`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “Narrow intermediate arithmetic crosses its width boundary. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** `spec/02-type-system.md`, `spec/04-expressions-operators.md`, and `spec/evaluations/F016-type-system.md` with boundary operands.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Applies the exact specified intermediate width and overflow/wrap behavior before later widening.
- **Disqualifying outcomes:** Computes at a convenient host width.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L20 — The same expression is evaluated as a constant and at runtime

- **Risk / coverage cells:** Critical; `LANG-L20`, `SFA-L20`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “The same expression is evaluated as a constant and at runtime. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** The governing constant-expression and runtime-width spec sections plus both evaluation traces.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Preserves the specified full-precision constant rules and runtime-width wrapping distinction.
- **Disqualifying outcomes:** Forces both paths to share the wrong arithmetic model.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L21 — Left-to-right calls combined with `&&`/`||` side effects

- **Risk / coverage cells:** Critical; `LANG-L21`, `SFA-L21`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “Left-to-right calls combined with `&&`/`||` side effects. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** `spec/04-expressions-operators.md`, `spec/evaluations/F017-operators.md`, and a side-effect trace.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Preserves evaluation order, short-circuiting, and exact observable effects.
- **Disqualifying outcomes:** Reorders or eagerly evaluates for easier lowering.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L22 — Two by-reference arguments alias the same object

- **Risk / coverage cells:** Critical; `LANG-L22`, `SFA-L22`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “Two by-reference arguments alias the same object. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** `spec/06-functions.md`, `spec/07-structs.md`, the aliased call, and ordered memory trace.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Preserves alias-visible write/read ordering and refuses unsafe independence assumptions.
- **Disqualifying outcomes:** Treats by-reference arguments as non-aliasing.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L23 — Imported modules have observable initializers

- **Risk / coverage cells:** Critical; `LANG-L23`, `SFA-L23`.
- **Oracle status:** `blocked-conflict` — the frozen specification disagrees about module-initializer admissibility and ordering.
- **Evaluator prompt:** “Imported modules have observable initializers. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** `spec/10-modules.md`, `spec/evaluations/F003-module-contents.md`, `spec/evaluations/F019-variables.md`, the import graph, and initializer effects.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Reports and preserves the conflict without choosing between variable-dependent topological runtime initialization and compile-time-constant initialization governed by import/declaration ordering; waits for a product ruling and reconciled specification commit.
- **Disqualifying outcomes:** Silently chooses or freezes either initialization model, uses file discovery order, duplicates initialization, or treats current compiler behavior as semantic precedence.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L24 — Invalid source has one root error and no output binary

- **Risk / coverage cells:** Critical; `LANG-L24`, `SFA-L24`.
- **Oracle status:** `frozen-project` for one-root-error/recovery/no-artifact behavior; exact conflicting function-code assignment excluded as `blocked-conflict`.
- **Evaluator prompt:** “Invalid source has one root error and no output binary. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** The invalid source, applicable diagnostic chapters, diagnostic stream, and artifact directory; exact conflicting function-code assignments remain excluded.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Produces the specified diagnostic/recovery behavior and suppresses artifact generation.
- **Disqualifying outcomes:** Emits a binary, cascades unchecked, or surfaces an ICE.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L25 — Legalization creates a spill/helper scratch slot after provisional allocation

- **Risk / coverage cells:** Critical; `LANG-L25`, `SFA-L25`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “Legalization creates a spill/helper scratch slot after provisional allocation. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** The provisional/final allocation plans, newly introduced spill/helper scratch, and all function-storage consumers.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Returns it to SFA and reaches final no-new-function-storage closure before emission.
- **Disqualifying outcomes:** Allocates hidden dynamic/function storage after closure.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-L26 — A charset needs VIC-compatible address/alignment/bank placement

- **Risk / coverage cells:** Major; `LANG-L26`, `SFA-L26`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “A charset needs VIC-compatible address/alignment/bank placement. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** The asset declaration, required VIC visibility/alignment/bank facts, placement map, and copy plan.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Assigns it to platform layout/packaging rather than SFA while preserving placement over copying.
- **Disqualifying outcomes:** Makes SFA a universal asset manager or copies for convenience.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Not run.
- **Definitive result:** Not run.
