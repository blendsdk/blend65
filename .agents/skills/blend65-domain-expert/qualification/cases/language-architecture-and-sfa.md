# Qualification Cases: Language, Architecture, and SFA

> **Oracle family**: Q-L01..Q-L33
> **Authority gate**: Reconciled specification identity from `references/source-manifest.md` and explicit
> project decisions only.
> **Conflict boundary**: Every recorded conflict through SC-049 is closed under the accepted rulings
> through AR-P24. A newly discovered contradiction blocks only its affected
> fields until it receives an explicit ruling and specification repair.
> **Result policy**: Result entries are append-only after a valid run. The corrected Phase-3 packet,
> evaluator outputs, initial cross-grades, focused reruns, and correction grades are preserved in
> `qualification/release.md`. These focused passes are advisory; definitive isolation is Phase 7.

## Shared Isolation Boundary

The evaluator receives the prompt, the permitted raw artifacts, and—only at candidate stages—the selected runtime references. The evaluator never receives this oracle, planning history, prior results, migration conclusions, or grading notes. The grader must distinguish a correct outcome reached from permitted evidence from a lucky unsupported assertion.

## Q-L01 — Locate governing documents and audit the complete specification crosswalk

- **Risk / coverage cells:** Major; `LANG-L01`, `SFA-L01`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “First resolve the supplied language question from governing documents.
  Then audit every path in the exact `spec/**/*.md` inventory against the candidate semantic
  crosswalk. For each path, identify its authority role, one substantive semantic payload, one
  compiler/storage/effect consequence, one important interaction or failure boundary, the correct
  skill branch, and any genuinely inapplicable depth facet with a reason. Report contradictions,
  missing paths, shallow summaries, unsupported coverage, and duplicated authority.”
- **Permitted raw artifacts:** The live `spec/**/*.md` path inventory, all 50 files in that
  inventory, the user's concrete language question, and only the candidate
  `references/blend65-semantics.md` crosswalk/semantic rules plus the three candidate branch
  references it links for architecture, SFA/ABI, and IL/optimization consequences. The packet also
  includes the exact hash-pinned `AGENTS.md` excerpts that state two project-policy facts used by
  the candidate: ACME is the selected assembler, and a parity result that only meets rather than
  beats the expert floor requires an authorized GitHub debt issue and never authorizes a push.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Exact 50-path set equality; correct normative/evaluation/
  historical role; substantive per-path payload and consequence rather than inventory-only
  presence; correct branch routing; explicit justified N/A facets; no duplicated authority. ACME
  selection and automatic parity-debt issue recording are identified as product/process policy,
  never inferred from the language specification, CPU manuals, or current implementation.
- **Disqualifying outcomes:** Answers only from skill prose, or accepts the two project-policy
  claims without the supplied hash-pinned policy excerpts.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — exact 50-path audit, governing examples, and hash-pinned project-policy
  separation pass comprehensive evaluation and independent correction grading; definitive
  isolation remains Phase 7.
- **Definitive result:** Not run.

## Q-L02 — Current compiler rejects `POKE(variableAddress, value)` or requires manual unrolled pokes

- **Risk / coverage cells:** Critical; `LANG-L02`, `SFA-L02`.
- **Oracle status:** `frozen-project` — variable-address legality, volatile effects, and SFA
  ownership/cost of compiler scratch agree across the governing Chapter 12 and reconciled F020.
- **Evaluator prompt:** “Current compiler rejects `POKE(variableAddress, value)` or requires manual unrolled pokes. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** `spec/12-intrinsics.md`, `spec/evaluations/F020-memory-intrinsics.md`, the rejected source, and its diagnostic.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Requires ordinary dynamic-address lowering, classifies compiler-convenience restrictions as defects, and accounts for any indirect-pointer pair through SFA/ZP rather than repeating F020's zero-RAM claim.
- **Disqualifying outcomes:** Defends constant-only/unrolled source as “6502-friendly” or treats compiler pointer scratch as free/unowned memory.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
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
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
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
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
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
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
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
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
- **Definitive result:** Not run.

## Q-L07 — Recursive call-graph SCC

- **Risk / coverage cells:** Critical; `LANG-L07`, `SFA-L07`.
- **Oracle status:** `frozen-project` — recursion prohibition, SFA response, and diagnostic
  ownership are internally consistent under the reconciled specification identity.
- **Evaluator prompt:** “Recursive call-graph SCC. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** `spec/06-functions.md`, `spec/evaluations/F018-functions.md`, and
  `spec/14-diagnostics.md`.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Emits explicit unsupported/bounded-policy diagnostic; no silent overlap/hidden fallback.
- **Disqualifying outcomes:** Pretends DAG coloring is safe or adds generic software stack by default.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Pre-passer — recursion/reentrancy rejection and user-facing diagnosis exist at outline depth (`compiler-engineering.md:47-58`); the conflicted exact diagnostic assignment was not graded.
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
- **Definitive result:** Not run.

## Q-L08 — IRQ can preempt mainline and both reach helper/scratch

- **Risk / coverage cells:** Critical; `LANG-L08`, `SFA-L08`.
- **Oracle status:** `frozen-project` — SC-007 is reconciled: mandatory interference modeling,
  disjoint invocation-private homes, shared program state, and entry-ABI enforcement are fixed.
- **Evaluator prompt:** “IRQ can preempt mainline and both reach helper/scratch. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** Mainline/IRQ roots, complete reachable call graph, scratch/frame inventories, and interrupt ABI assumptions.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Models reentrancy/interference across complete
  mainline/IRQ/NMI/helper reachability; allocates disjoint invocation-private homes for bounded
  overlap; leaves globals/assets/MMIO shared; rejects entry-ABI mismatch and unbounded overlap.
- **Disqualifying outcomes:** Considers only direct caller/callee edges, accepts possible silent
  corruption, clones shared program state, or invents a hidden software stack.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Pre-passer — whole-call-graph IRQ reachability and non-reentrant scratch interference are explicit (`compiler-engineering.md:49-57`; `c64-game-systems.md:64-68`).
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
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
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
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
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
- **Definitive result:** Not run.

## Q-L11 — Proposal misuses hardware-stack ownership or BRK accounting

- **Risk / coverage cells:** Critical; `LANG-L11`, `SFA-L11`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “A proposal uses the hardware stack for all locals, tracks explicit `PHA`/`PHP`/`PLA`/`PLP` intrinsics by byte depth only so `PHA; PLP` passes, and treats reachable `asm_brk()` as a seven-cycle opcode with free fallthrough and no profile contract or stack charge. Determine the required language behavior and the responsible compiler boundary. Trace observable effects, entry ownership, stack kinds, BRK control flow, and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** The proposed stack-frame design, explicit push/pull paths, target stack budget, call/IRQ/BRK obligations, selected profile, and SFA doctrine.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Preserves SFA; distinguishes JSR/RTS/IRQ/generated-save/explicit-stack/BRK duties; tracks accumulator-save versus status-save kinds relative to each function entry; requires matching pulls, identical reachable join/backedge sequences, and empty exits; requires a profile contract for reachable BRK; charges three CPU bytes plus handler peak; models returning versus non-returning control flow; emits only `$00 $EA`; adds no runtime or SFA storage.
- **Disqualifying outcomes:** Reopens stack frames without new necessity proof; accepts a cross-kind pull because byte depth happens to balance; lets source intrinsics consume caller, return-address, interrupt, or compiler-generated stack bytes; assumes BRK falls through, invokes a debugger, or has no stack/effect cost; injects a handler/runtime.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — the AR-P29 kind-state and AR-P31 BRK contract pass comprehensive
  evaluation and independent correction grading; definitive isolation remains Phase 7.
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
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
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
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
- **Definitive result:** Not run.

## Q-L14 — Optimizer wants to erase signedness before comparison lowering

- **Risk / coverage cells:** Critical; `LANG-L14`, `SFA-L14`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “Optimizer wants to erase signedness before comparison lowering. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** The semantic operation before and after the proposed IR change and the selected compare lowering inputs.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Rejects loss; signedness must survive to accountable
  legalization/selection. A same-width signedness cast preserves bits without making independently
  observable source variables alias; storage coalescing needs an ordinary liveness/alias/effect
  proof.
- **Disqualifying outcomes:** Asks backend to guess, or equates zero conversion cost with shared
  variable storage.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
- **Definitive result:** Not run.

## Q-L15 — Invalid source causes downstream allocation crash

- **Risk / coverage cells:** Critical; `LANG-L15`, `SFA-L15`.
- **Oracle status:** `frozen-project` — the stated semantic/project invariant is internally consistent.
- **Evaluator prompt:** “Invalid source causes downstream allocation crash. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** The invalid source, frontend diagnostics, downstream trace, and artifact-presence result.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Assigns the root diagnostic upstream, gates unsafe later stages,
  and emits no compilation artifact while still reporting diagnostics.
- **Disqualifying outcomes:** Treats ICE as acceptable error handling or publishes assembly, IL,
  object, map, symbol, executable, or packaged output from the invalid program.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
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
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
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
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
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
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
- **Definitive result:** Not run.

## Q-L19 — Ordinary array code crosses byte/word boundaries without prompting

- **Risk / coverage cells:** Critical; `LANG-L19`, `SFA-L19`.
- **Oracle status:** `frozen-project` after AR-P35–AR-P41 — fixed arrays, any-size parameters,
  complete integer-producing index-operator promotion, finite-looking counter reachability,
  stable query widths, and the representable fixed-object domain are reconciled without a
  slice/span/view concept.
- **Evaluator prompt:** “A modern developer writes the following without mentioning 6502 widths:
  `let data: byte[500]; let i: byte = 255; let x: byte = data[i + 10];`. In another function they
  write
  `let small: byte[20]; let a: byte = 5; let b: byte = 6; let y: byte = small[a + b + 1];`. They also
  write `let shifted: byte[600]; let z: byte = shifted[i << 1];`, `data[byte(i + 10)]`, and
  `for (let j: byte = 0; j < length(data); j += 1) { use(data[j]); }`. A struct places a field after
  `byte[300]`, and nearby code asks for `sizeof(byte[])`. Determine the required source behavior,
  diagnostics, semantic payload, and smallest expert 6502 lowering opportunities. Identify any
  related low-level representation leak yourself. Do not add a new array-like language concept.”
- **Permitted raw artifacts:** Reconciled Chapters 02, 04–08, 11, 12, and 14; F008, F011, F014,
  F016, F018, and F020; the supplied source; selected-profile resource facts; no current compiler
  behavior.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler
  tests as semantic authority, legacy-skill conclusions, prior outputs, author history, and any
  prompt that names the missing carry/index-width conclusion.
- **Expected decision invariants:** Finds without prompting that direct subscript integer-producing
  operations need the 16-bit-capable ordinal context: `data[i + 10]` denotes 265 and
  `shifted[i << 1]` denotes 510, while the explicit byte cast is a deliberate barrier and denotes
  9. The same ordinal against `data[500]` would be statically out of bounds under E10240.
  Keeps `small[a + b + 1]` semantically 12 but proves byte-only machine work sufficient. States
  that `length()`, `sizeof()`, and `offsetof()` always have semantic type `word`; an any-size
  parameter carries the full caller-array count while remaining only a parameter form. Requires
  full-precision extents in `0..65535`, complete fixed array/struct sizes in `0..65535` bytes, and
  E10264/E10265 otherwise; rejects `sizeof(T[])` with E10266 because `T[]` has no standalone fixed
  extent. Proof may still select byte-only machine work. Rejects the canonical
  byte traversal with E10262 because the counter repeats before reaching 500, recommends a word
  source counter, and still permits intentional byte wrap/ring/timer/infinite loops. Allows the
  correct word loop to lower with byte state only when proof preserves all observations. Keeps
  signed lower-bound checks, HLE-003, element-size scaling, and SFA homes. Adds no dynamic array,
  slice, span, view, heap, helper, or runtime.
- **Disqualifying outcomes:** Produces wrapped ordinals for uncast arithmetic or shifts; forces every small
  access to materialize a word; silently widens the declared loop counter; rejects all byte-wrap
  loops; selects source legality from total array bytes; permits an unrepresentable object or a
  byte-typed large field offset; gives `sizeof(T[])` a fictitious value; loses signed/element-size
  semantics; asks the developer to discover carry/word behavior; or invents a subarray/view
  abstraction.
- **Evidence required to grade:** Exact governing locations; expression evaluation and range traces;
  fixed versus any-size parameter ABI/SFA costs; checked and unchecked address behavior; the
  rejected-loop proof boundary; and assembly/cost expectations for both proved-small and
  above-255 cases.
- **Red-baseline result:** Not run.
- **Focused result:** Pass against `BLEND65-SPEC-P3-ed278ab9`; evaluator captures and the passing
  independent correction grade are recorded in `qualification/release.md`.
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
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
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
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
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
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
- **Definitive result:** Not run.

## Q-L23 — Imported modules have observable initializers

- **Risk / coverage cells:** Critical; `LANG-L23`, `SFA-L23`.
- **Oracle status:** `frozen-project` after authority classification — Chapter 10 and reconciled
  F003/F019 agree on runtime `let` initializers, dependency/effect order, and one-time execution.
- **Evaluator prompt:** “Imported modules have observable initializers. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** `spec/10-modules.md`, `spec/evaluations/F003-module-contents.md`, `spec/evaluations/F019-variables.md`, the import graph, and initializer effects.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Applies the reconciled dependency/effect-ordered startup semantics,
  preserves observable initializer effects and one-time execution, gives import syntax no runtime
  edge by itself, and orders ready ties by the fully qualified variable name in case-sensitive ASCII
  order independent of files/input order.
- **Disqualifying outcomes:** Uses file discovery/input order, treats every import as a runtime edge,
  duplicates initialization, treats current compiler behavior as semantic precedence, or lets
  subordinate rationale override Chapter 10.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
- **Definitive result:** Not run.

## Q-L24 — Invalid source has one root error and no compilation artifact

- **Risk / coverage cells:** Critical; `LANG-L24`, `SFA-L24`.
- **Oracle status:** `frozen-project` — one-root-error/recovery/no-artifact behavior and Chapter
  14's canonical diagnostic mapping are internally consistent.
- **Evaluator prompt:** “Invalid source has one root error and no compilation artifact. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** The invalid source, owning semantic rule, Chapter 14 entry,
  diagnostic stream, and artifact directory.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Produces the specified diagnostic/recovery behavior and suppresses artifact generation.
- **Disqualifying outcomes:** Emits any compilation artifact, cascades unchecked, or surfaces an ICE.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
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
- **Focused result:** Pass — the concrete Phase-3 evaluator result and independent grade are recorded in `qualification/release.md`; definitive isolation remains Phase 7.
- **Definitive result:** Not run.

## Q-L26 — A charset needs VIC-compatible address/alignment/bank placement

- **Risk / coverage cells:** Major; `LANG-L26`, `SFA-L26`.
- **Oracle status:** `frozen-project` — AR-P17/AR-P20 replace the byte-only map/tile restriction with
  the smallest-lossless canonical type plus explicit forced-word, packed, and split C64
  representations and a fixed current-format identity. AR-P21 separates native Koala components
  from placement-derived VIC fields and explicit color-RAM transfer.
- **Evaluator prompt:** “A charset needs VIC-compatible address/alignment/bank placement. Determine the required language behavior and the responsible compiler boundary. Trace observable effects and storage lifetimes far enough to justify the decision, then state the smallest viable remedy if the supplied behavior is wrong.”
- **Permitted raw artifacts:** The `embed(path, selector)` asset declarations, the handler's
  signature/version and enumerated-key contract for the sample file, required VIC
  visibility/alignment/bank facts, placement map, and copy plan.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Assigns it to platform layout/packaging rather than SFA,
  preserves placement over copying, uses literal handler-owned selector keys,
  accepts only the exact application/format generation pinned by the profile, rejects every
  unregistered format version, and carries applicable VIC/handler alignment and linker-resolved
  metadata without adopting stale selector aliases, truncating or rejecting a valid current-format
  width, a moving “latest” rule, or a core query language. Canonical `"tiles"`/`"map"` select
  `byte[]` through index 255 and little-endian `word[]` above it; `"tiles_word"`/`"map_word"` force
  stable 16-bit output. Packed-12 selectors exist only through 4095 and use the exact low-plane then
  packed-high-nibble order, including zero odd padding; low/high planes are independently
  selectable; only requested representations are emitted and costed. CharPad C64 Pro 3.88 is
  qualification provenance, ASCII `CTM` plus version 9 is the accepted file identity, and the
  handler has no default. A declared selector-type mismatch is E10144, not E10204.
- For a classic Koala asset, accepts only the exact 10,003-byte `$6000` native layout, exposes only
  `"bitmap"`, `"screen"`, `"color_ram"`, and `"background"`, and has no default. It derives bitmap
  and screen `$D018` fields through zero-cost placement operations after validating their 8-KiB and
  1-KiB alignments and common VIC-bank visibility. The color-RAM transfer remains explicit and
  costed; `"bitmap_base"` and hidden copies are invalid.
- **Disqualifying outcomes:** Makes SFA a universal asset manager, copies for convenience, or silently promotes the evaluation selector table above the normative C64 profile.
- **Evidence required to grade:** Exact governing spec/project locations, an effect/lifetime/ownership trace where applicable, the stated status and assumptions, and a remedy separated from the finding.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — the complete CharPad/Koala handler, representation, placement,
  ownership, and static-cost contract passes comprehensive evaluation and independent correction
  grading; definitive isolation remains Phase 7.
- **Definitive result:** Not run.

## Q-L27 — A current SpritePad project contains sprites, attributes, tiles, animations, and overlays

- **Risk / coverage cells:** Major; `LANG-L27`, `SFA-L27`.
- **Oracle status:** `frozen-project` after AR-P14/AR-P16 — SpritePad Pro 3.80 SPD v5 is the pinned
  initial source contract. The producer release identity and a bounded comparative v4/v5 reader are
  pinned, but exact parser/schema qualification remains open until the Phase-5 producer/schema/
  fixture gate.
- **Evaluator prompt:** “A SpritePad Pro 3.80 SPD v5 project contains more than 255 sprites,
  per-sprite color/mode/expansion/overlay attributes, tiles, animations, and overlay distances.
  A proposed handler returns only 63 bitmap bytes per sprite, a byte count, one file-wide
  multicolor boolean, and a linker-derived base-block selector. Determine the required language
  behavior and responsible compiler boundaries. Trace emitted bytes, placement, and runtime access,
  then state the smallest viable remedy.”
- **Permitted raw artifacts:** The `embed(path, selector)` declarations; the reconciled Chapter 13,
  C64 appendix, and F015 rules; SPRITEPAD-380 release identity; the exact bounded
  C64LIB-RBT-79D5C0E reader ranges; VIC bank/layout facts; and an explicit statement that no
  3.80-produced fixture is present in this Phase-3 packet.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler
  tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Rejects the incomplete approximation; preserves exact 64-byte
  sprite records and a word count; treats color, multicolor, X/Y expansion, and overlay as
  per-sprite attributes; retains requested tile/animation/overlay components; emits no implicit
  duplicate or offset table; reports an explicitly selected derived attribute table; derives the
  VIC block through `vicSpriteBlock(&SPRITES)` after placement; rejects non-v5 input with E10204;
  keeps assets outside SFA; and does not claim the unobserved tail schema or a producer-fixture
  validation pass. It preserves the exact source contract while naming the Phase-5 schema/fixture
  proof required before a real handler qualifies.
- **Disqualifying outcomes:** Drops the 64th attribute byte or optional runtime-relevant components,
  truncates the count, invents a global multicolor property, copies data silently, treats a
  placement-derived block as file metadata, accepts an unregistered version, moves assets into SFA,
  or fabricates producer-fixture/schema evidence for the optional project tails.
- **Evidence required to grade:** Exact governing spec/project locations; the pinned release and
  bounded-reader identities; a precise supported-versus-unproven field split; intended native
  versus derived byte accounting; placement and bank ownership; and the named Phase-5 evidence
  needed to close the parser claim.
- **Red-baseline result:** Not run.
- **Focused result:** Verified partial — the complete product contract passes content evaluation;
  exact SPD v5 tail parsing remains explicitly unqualified until the Phase-5
  producer/schema/fixture gate; definitive isolation remains Phase 7.
- **Definitive result:** Not run.

## Q-L28 — C64 literals cross character-set modes and a custom charset lacks metadata

- **Risk / coverage cells:** Major; `LANG-L28`, `SFA-L28`.
- **Oracle status:** `frozen-project` after AR-P25 — the selected encoding and immutable map identity
  jointly determine compile-time bytes; no conversion changes hardware state or adds runtime code.
- **Evaluator prompt:** “A C64 program contains the default literal `"AZ0 £↑←"`,
  `screen_codes("Az", "lower_upper")`, and `petscii("Az", "lower_upper")`. Another call passes a
  variable as the map argument. The program also targets a custom bitmap charset with no
  scalar-to-glyph metadata, while an X16 build calls `petscii("HI")`. Determine the exact accepted
  bytes, diagnostics, hardware effects, and responsible compiler boundaries.”
- **Permitted raw artifacts:** `spec/08-arrays-strings.md`, `spec/15-platform-profile.md`,
  `spec/14-diagnostics.md`, all five target appendices, the C64 Programmer's Reference Guide
  Appendix B/C tables pinned as `CBM-C64-PRG-1982`, and the declarations above.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler
  tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Default C64 screen bytes are `$01,$1A,$30,$20,$1C,$1E,$1F`;
  lower/upper screen bytes are `$41,$1A`; lower/upper PETSCII bytes are `$C1,$5A`. The optional map
  argument is a string literal and changes only this compile-time conversion. A variable map
  argument is E10251; an unavailable encoding/map is E10125; an absent scalar is E10249. No
  register write, mode switch, conversion table, or runtime helper is emitted. Custom charset text
  conversion is rejected until explicit versioned scalar-to-glyph metadata supplies an immutable
  identity; exact bytes and asset-generated symbols remain legal. C64 tables are not reused for
  X16, so its unqualified `petscii()` call is E10125 under the current raw-only baseline.
- **Disqualifying outcomes:** Uses one ambiguous C64 map, maps ASCII lookalikes to pound/arrows,
  accepts lowercase in upper/graphics mode, changes `$D018`, guesses custom glyph order, silently
  substitutes, emits runtime conversion, or copies C64 tables to X16.
- **Evidence required to grade:** Exact source scalars and resulting bytes/diagnostics; selected
  encoding plus map identity; proof of zero runtime/hardware effects; target-profile and asset
  metadata ownership; and a remedy separated from any finding.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — exact C64 maps, diagnostics, custom-map boundary, compile-time-only
  behavior, and X16 non-reuse pass comprehensive evaluation and independent correction grading;
  definitive isolation remains Phase 7.
- **Definitive result:** Not run.

## Q-L29 — One interrupt handler reaches C64 KERNAL-chain, exclusive, and raw sinks

- **Risk / coverage cells:** Critical; `LANG-L29`, `SFA-L29`.
- **Oracle status:** `frozen-project+external` after AR-P26/AR-P27 — source-handler identity,
  sink-selected entry variants, decimal/status ownership, page-safe indirect links, and the
  901227-03 KERNAL/raw ABI split are reconciled.
- **Evaluator prompt:** “One `interrupt function onRasterIRQ(): void` is passed through
  provenance-preserving values to `c64.system.setIRQ`, `c64.system.setIRQExclusive`, and
  `c64.system.setRawIRQ` under their applicable profiles. The handler calls an ordinary helper and
  explicitly acknowledges VIC raster IRQ. The default C64 build also contains
  `pokew($0314, &onRasterIRQ)`. Determine every emitted/rejected entry path, stack and terminal
  owner, static storage/cost obligation, and compiler boundary. State what changes when the raw
  vector is not proven writable and active.”
- **Permitted raw artifacts:** Reconciled Chapters 06/12/14/15, C64/C64U appendices, F007, selected
  profile metadata, handler/helper source, emitted entry fragments and build-cost report;
  CBM-C64-PRG-1982 printed pages 308/311; CBM-C64-KERNAL-03
  `irqfile::PULS/PULS1` and `editor.2::KPREND`; MOS-PGM-1976 Chapter 9.
- **Forbidden material:** This case’s hidden invariants, coverage status, plans, current compiler
  tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Preserves one callback-only source handler and its identity until
  each recognized sink. `setIRQ` emits a no-second-save CINV variant that uses `PHP; CLD` before the
  body and `PLP` before its five-cycle indirect jump through a dedicated, reported two-byte
  saved-previous-CINV link. The link's low byte is at most `$FE`; `$xxFE` is valid and `$xxFF` is
  relocated or rejected. `setIRQExclusive` emits a no-second-save variant that uses `CLD` before
  the body and ends in `JMP $EA81`; the program owns every enabled IRQ source it skips.
  `setRawIRQ` exists only with a profile-proven writable/active hardware vector and selects the
  compiler A/X/Y save/`CLD`/restore/direct-`RTI` variant. Raw/exclusive `RTI` restores the interrupted
  decimal state, while the chain's `PLP` restores entry flags for the previous handler. Explicit
  `asm_sed()` remains legal under its normal diagnostics. The body acknowledges VIC explicitly; the
  compiler never guesses a source. The helper remains `JSR`/`RTS`, SFA separates every overlapping
  invocation-private home, and only reachable variants are emitted. Every body copy, installer,
  link word, normalization/status wrapper, ROM/RAM/ZP/stack byte, and full cycle path is reported.
  The visible CINV `pokew` is
  E10252. No generic dispatcher, runtime ABI registry, dynamic frame selector, or duplicate register
  save is introduced.
- **Disqualifying outcomes:** Treats `$0314` as a raw CPU vector; installs one raw address at all
  three sinks; pushes A/X/Y again on CINV; executes direct `RTI` from CINV; chains in exclusive mode;
  exposes raw installation without a banking/vector proof; guesses the interrupt source; converts
  the ordinary helper to `RTI`; allows generated arithmetic to inherit unknown D; exposes a chain
  link at `$xxFF`; fails to restore flags before the prior handler; hides link/body/storage cost;
  accepts the visible mismatched `pokew`; or adds a dispatcher/runtime.
- **Evidence required to grade:** Source handler identity and sink provenance; selected profile and
  vector/banking contract; entry/exit assembly with exact stack ownership; source acknowledgement;
  helper call ABI; D=0 body entry and outgoing-status proof; `$xxFE/$xxFF` link-boundary evidence;
  per-variant reachability and complete cost report; E10252 at the exact write; and a remedy
  separated from any finding.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — all three sink sequences, entry ownership, acknowledgement, page-wrap
  constraint, SFA domains, exact static costs, and no-runtime boundary pass comprehensive
  evaluation and independent correction grading; definitive isolation remains Phase 7.
- **Definitive result:** Not run.

## Q-L30 — Ordinary arithmetic and explicit packed-BCD operations share one function

- **Risk / coverage cells:** Critical; `LANG-L30`, `IL-L30`, `CPU-L30`.
- **Oracle status:** `frozen-project+hardware` after AR-P28 — ordinary binary meaning, explicit BCD
  ownership, zero-runtime lowering, and the runtime-invalid hardware exception are reconciled.
- **Evaluator prompt:** “A function performs ordinary byte addition, `bcd_add()` on bytes,
  `bcd_sub()` on words, a valid constant BCD fold, an invalid constant BCD call, and a raw
  `asm_sed()` path that reaches an ordinary call before `asm_cld()`. Determine source behavior,
  diagnostics, IL distinctions, target lowering, interrupt obligations, and every runtime helper
  or storage cost. Also state what is allowed when a runtime operand contains `$A`–`$F`.”
- **Permitted raw artifacts:** Reconciled Chapters 01/02/04/12/14, F012/F021, the master grammar,
  selected CPU/profile decimal-mode facts, candidate `blend65-semantics.md`, and candidate
  `il-and-optimization.md`.
- **Forbidden material:** This case's hidden invariants, coverage status, plans, current compiler
  behavior/tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Ordinary `+`, `-`, `+=`, and `-=` remain binary regardless of D
  or C. BCD operations accept only same-width unsigned byte/word operands, evaluate each operand
  once left-to-right, own carry/no-borrow, wrap modulo 100/10,000, and leave D clear. A valid
  constant folds; a statically invalid digit is E10254. Runtime-invalid digits produce the selected
  CPU's exact ordered decimal `ADC`/`SBC` result and are never optimized with unproved decimal
  algebra. IL preserves a distinct BCD operation and its effects. Lowering is inline and adds no
  helper, linked runtime, hidden validation, or unreported scratch. Region coalescing requires proof
  of carry ownership, D-clear boundaries, control-flow safety, and interrupt preservation. The raw
  path is E10255; W10120 is retired.
- **Disqualifying outcomes:** Makes ordinary arithmetic depend on an earlier `asm_sed()`; silently
  accepts an invalid constant; injects a runtime checker/helper; assumes runtime digits are valid;
  loses carry between word bytes; leaves D set; coalesces across a call/join/unsafe interrupt path;
  or reports the retired W10120 instead of E10255.
- **Evidence required to grade:** Exact type/result table, constant/runtime examples, diagnostic
  sites, semantic IL nodes/effects, inline byte and word instruction sequences, interrupt-state
  proof, complete bytes/cycles/storage/helper accounting, and a remedy separated from any finding.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — types, evaluation, modulo behavior, invalid-digit boundaries, IL,
  inline lowering, safe coalescing, diagnostics, and static costs pass comprehensive evaluation
  and independent correction grading; definitive isolation remains Phase 7.
- **Definitive result:** Not run.

## Q-L31 — A familiar full-domain `for` loop must stay modern and lower like expert 6502

- **Risk / coverage cells:** Critical; `LANG-L31`, `IL-L31`, `SFA-L31`.
- **Oracle status:** `frozen-project` after AR-P32 — one three-clause loop has ordinary expression,
  scope, mutation, control-flow, and fixed-width integer semantics; optimization cannot alter them.
- **Evaluator prompt:** “Analyze these loops and propose their parser, semantic, CFG, SFA, and
  optimization contracts: `for (let i: word = 0; i < length(page); i += 1) { use(page[i]); }` for a
  256-byte array; the same source with `i: byte` and `i < 256`; a loop whose initializer, condition,
  update list, and body contain calls or volatile accesses; and loops whose body uses `continue`,
  `break`, or `return`. A proposal keeps the old range syntax because a Pratt parser and SFA would
  otherwise be difficult. Decide the language behavior, exact lowering boundary, and smallest
  expert optimization. State what is parsed by the statement parser, what SFA allocates, and
  whether any runtime or second loop form is needed.”
- **Permitted raw artifacts:** Reconciled Chapters 01/02/03/04/05/14, F008, the master grammar,
  candidate `blend65-semantics.md`, `compiler-architecture.md`, `sfa-and-abi.md`, and
  `il-and-optimization.md`; selected CPU `INX`/`DEX` and branch facts; source and emitted evidence
  for the proposed loops.
- **Forbidden material:** This case's hidden invariants, coverage status, plans, current compiler
  behavior/tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Uses only
  `for ([initializer]; [condition]; [update]) { body }`, with each omitted clause allowed and an
  omitted condition meaning true. The statement parser owns the header delimiters; it does not
  distort Pratt expression parsing or introduce a general comma operator. Initializer and update
  expression lists evaluate once per occurrence, left-to-right. A header declaration is an
  ordinary mutable `let` or immutable `const` scoped through the condition, update, and body;
  ordinary no-shadowing rules apply. The condition is Boolean. `continue` runs the update before
  retesting; `break` and `return` skip it. Counter arithmetic uses ordinary fixed-width wrap. The
  general lowering is a normal CFG and needs no runtime, hidden range state, new SFA model, or
  generalized loop framework. SFA treats header locals and temporaries by ordinary liveness and
  interference. The semantic-word 256-iteration form is correct; a proof may represent its
  nonescaping induction state with one byte and use `INX` plus wrap-to-zero exit when all effects
  and the unobservable word terminal state permit. The byte-typed `i < 256` form is a deterministic
  infinite loop and is never silently reinterpreted. Former range words are ordinary identifiers.
- **Disqualifying outcomes:** Retains or adds a second range loop; limits clauses to make parsing or
  SFA easier; changes left-to-right effects; sends the whole header through a Pratt parser; treats
  `continue` as a direct condition edge; gives the induction variable hidden mathematical range
  semantics; rejects the valid word form; accepts or silently repairs the byte counterexample;
  injects a runtime; or builds a generalized optimization framework instead of one proved canonical
  induction recognizer.
- **Evidence required to grade:** Exact grammar and scope; an effect trace for initializer,
  condition, body, update, and every exit; generic CFG edges; SFA liveness/interference treatment;
  full-domain word and byte counterexamples; optimization preconditions, emitted legal sequence,
  clobbers, and complete cost; and a remedy separated from any finding in the existing compiler.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — grammar, parser ownership, clause/exit effects, SFA liveness, generic
  CFG lowering, canonical induction proof, clobbers, and exact selected cost pass comprehensive
  evaluation and independent correction grading; definitive isolation remains Phase 7.
- **Definitive result:** Not run.

## Q-L32 — A local address crosses calls, loop lifetimes, and IRQ domains

- **Risk / coverage cells:** Critical; `LANG-L32`, `IL-L32`, `SFA-L32`.
- **Oracle status:** `frozen-project` after AR-P33/HLE-007 — local address-taking remains useful,
  but no address or derived fragment may outlive its dynamic source lifetime.
- **Evaluator prompt:** “Analyze a function that takes `&local`, copies it through a `word`, a
  conditional, arithmetic, and `lo`/`hi`; stores one copy in a contained local aggregate; passes
  another through two user functions; returns one derived fragment; writes another to module state
  and raw memory; and publishes another to an IRQ/hardware consumer. Repeat the call sequentially,
  take the address of a loop local across iterations, and allow mainline plus IRQ to invoke the
  owner concurrently. Determine every legal use, diagnostic, provenance/lifetime fact, SFA
  interference edge, required code variant, and runtime/resource cost. Compare a proposal that
  pins the local for program lifetime.”
- **Permitted raw artifacts:** Reconciled Chapters 00/04/06/11/14, F006/F018, selected
  mainline/IRQ/NMI contracts, candidate `blend65-semantics.md`, `sfa-and-abi.md`, and
  `il-and-optimization.md`; source, call graph, local/aggregate lifetimes, and emitted cost report.
- **Forbidden material:** This case's hidden invariants, coverage status, plans, current compiler
  behavior/tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Treats `&local` as a hidden-provenance borrow bounded by the
  local's lexical block, current loop incarnation, and containing invocation. Copies, casts,
  conditionals, `lo`/`hi`, arithmetic, and bitwise derivations retain dependency; loaded data does
  not. Contained local scalar/aggregate storage is legal. Each user/library parameter position is
  transitively proven or declared non-retaining; synchronous alone is insufficient. Return,
  longer-lived module/ZP/raw/MMIO storage, asynchronous/hardware publication, retaining/unknown
  calls, and opaque escape are E10260 at the first escaping use. Legal calls extend SFA liveness.
  Sequential lifetimes and loop iterations may reuse one home only because earlier addresses are
  unobservable. Bounded concurrent domains receive disjoint homes and fixed-address variants where
  required; unbounded overlap remains E10245. No heap, runtime check, persistent pin, implicit
  static local, or address-freshness promise is added; all variant/storage costs are reported.
- **Disqualifying outcomes:** Allows address laundering; rejects every local aggregate merely for
  compiler convenience; treats every synchronous callee as non-retaining; permits a dangling or
  opaque escape; silently pins the automatic local; promises a distinct address for unbounded
  sequential calls; shares one home across concurrent domains; or adds a heap/runtime.
- **Evidence required to grade:** Exact origin/derivation and first-escape paths; per-position
  transitive retain summaries; block/iteration/invocation lifetime boundaries; E10260 spans and
  mitigation; mainline/IRQ interference and home/variant selection; repeated-call semantics; and
  complete ROM/RAM/ZP/runtime accounting.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — lifetime/provenance, per-position retention, escape inventory,
  sequential reuse, bounded domain variants, failure boundaries, and complete cost categories pass
  comprehensive evaluation and independent correction grading; definitive isolation remains
  Phase 7.
- **Definitive result:** Not run.

## Q-L33 — PSID identity meets C64, C64U, and multi-SID configuration

- **Risk / coverage cells:** Critical; `LANG-L33`, `PROFILE-L33`, `C64-L33`.
- **Oracle status:** `frozen-project+external` after AR-P34/SC-133 — PSID metadata and selected
  deployment configuration must stay distinct, exact, and statically compatible.
- **Evaluator prompt:** “Validate one SID-capable C64 profile selecting PAL plus MOS6581 and another
  selecting NTSC plus MOS8580. Exercise PSID v1 and every PSID v2NG–v4 clock/model flag value,
  including second- and third-SID address/model fields whose `00` model inherits the resolved
  primary requirement. Compare embedding with callable audio when metadata is Unknown, check a
  known mismatch, and assess C64U physical-SID versus UltiSID endpoints while turbo CPU mode is
  available. State the exact profile, player-contract, diagnostic, conversion, hardware-activation,
  and cost consequences.”
- **Permitted raw artifacts:** Reconciled Chapters 13–15, F015, C64/C64U appendices,
  `blend65-semantics.md`, `source-manifest.md`, the exact HVSC SID-format snapshot, the pinned
  C64U `config/multi_sid.rst` and `sidplayer.rst` records, and an exact candidate player contract.
- **Forbidden material:** This case's hidden invariants, coverage status, plans, current compiler
  behavior/tests as semantic authority, legacy-skill conclusions, prior outputs, and author history.
- **Expected decision invariants:** Requires explicit `video_standard: pal | ntsc` and an ordered
  `sid_chips` list of exact address/model endpoints for every SID-capable C64/C64U profile; the
  current baseline has one `$D400` endpoint. Treats `clock_mhz` as the derived/validated PAL
  985,248-Hz or NTSC 1,022,730-Hz CPU fact, never the video/SID identity. Preserves PSID v2NG–v4
  clock bits `00/01/10/11` as Unknown/PAL/NTSC/Both and primary model bits as
  Unknown/MOS6581/MOS8580/Both; PSID v1 is unspecified. Second/third `00` model fields inherit the
  resolved primary requirement. A specific incompatibility or unsupported multi-SID topology is
  E10261. Unknown is not Both: embed-only use remains legal, while callable audio requires an exact
  hash-bound contract to close every unknown field without contradicting specific metadata. No
  cadence, pitch, filter, or model conversion occurs. C64U endpoint choice is a deployment
  precondition, not runtime discovery/configuration; turbo CPU speed is never substituted for
  PAL/NTSC SID timing and needs a separate qualified timing contract before use. All selected
  player/topology state and costs remain explicit.
- **Disqualifying outcomes:** Uses numeric clock alone as identity; conflates Unknown with Both;
  treats a secondary `00` model as independently either; silently retimes, retunes, or converts SID
  output; accepts a known mismatch; calls unknown audio without a closing contract; describes all
  C64U endpoints as emulated; lets the header activate hardware; changes SID cadence because turbo
  CPU mode exists; or claims multi-SID support without exact address/model/contract agreement.
- **Evidence required to grade:** Exact profile fields and timing records; complete PSID flag matrix;
  inheritance and mismatch traces; E10261 ownership; embed-only versus callable-audio decisions;
  player-contract refinements; C64U endpoint/turbo reasoning; and complete ROM/RAM/ZP/cycle costs.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — exact timing/profile fields, PSID flag matrix and inheritance,
  Unknown closure, topology, C64U deployment/turbo split, zero-conversion boundary, and complete
  cost ownership pass comprehensive evaluation and independent correction grading; definitive
  isolation remains Phase 7.
- **Definitive result:** Not run.
