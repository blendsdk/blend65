# Evidence, Parity, and Recovery

> **Construction version**: `0.2.0-evidence-foundation`
> **Role**: Decide what is actually known, compare generated work fairly with expert 6502 work,
> and recover useful compiler parts without preserving accidental complexity.

## Non-Negotiable Direction of Authority

Evidence flows in one direction:

```text
reconciled Blend65 specification and explicit product decisions
                         +
        pinned hardware/tool/practitioner evidence
                         ↓
            qualified expert-skill guidance
                         ↓
       current compiler inspection and redesign
```

The existing compiler is evidence about what was built. It is never evidence for what the
language, CPU, machine, or replacement architecture ought to mean. A current test may expose a
contract, implementation, regression, or accidental restriction; classify which one before using
it. A roadmap, readiness score, game-feasibility row, generated golden, or historical design note
cannot override stronger authority.

During this skill-creation plan, compiler builds/tests, readiness and boundary suites, ACME, VICE,
and emulators are deliberately not run. This reference defines proof that later compiler audit and
implementation work must collect; it does not fabricate those observations now.

## Claim Kinds

Keep these four classes visibly separate in notes, findings, recommendations, and final answers.

| Claim kind | Meaning | Required wording |
|---|---|---|
| Fact | Directly supported by a named authority or observed artifact | State the bound, cite the source/artifact, and avoid stronger generalization. |
| Inference | Reasoned consequence of one or more facts | Name the facts and the reasoning step; say “inference”. |
| Unknown | Evidence is absent, skipped, conflicting, stale, or too weak | Say exactly what remains unknown and the smallest proof that would resolve it. |
| Recommendation | A proposed compiler, API, workflow, or recovery decision | Name assumptions, alternatives considered when material, costs, risks, and proof obligations. |

Do not turn a recommendation into a fact by writing it in imperative form. Do not turn an unknown
into a negative fact. “No runtime result was collected” means runtime correctness is unknown; it
does not mean the feature fails.

## Five Capability States

Use only these labels for a named capability. The label applies to the exact boundary stated, not
to a package, phase, or target in general.

| Status | Required evidence | Typical misuse to reject |
|---|---|---|
| `Verified complete` | Every part of the named contract is present and independently proven through every applicable stage to its required endpoint. Negative/boundary behavior and resource obligations are included. | Parser acceptance, one golden, or a passing smoke program is called “complete”. |
| `Verified partial` | A precisely stated subset is proven; excluded behavior and downstream stages are named. | “Mostly done” without a boundary or proof. |
| `Scaffold/stub` | Shape or delegation exists, but required behavior is absent, placeholder, copied from another target, or intentionally not implemented. | A plugin/class/file existing is called target support. |
| `Incorrect` | Decisive evidence contradicts the governing contract for at least one in-scope case. | A known miscompile is softened to “partial”. |
| `Unknown` | The available evidence cannot decide the contract, including when an applicable test was skipped or only stale evidence exists. | A skipped emulator suite is counted as a pass, or absence of evidence as failure. |

Status is not cumulative prestige. A large subsystem can be `Incorrect`; a small, fully bounded
operation can be `Verified complete`. If one critical case is wrong inside a supposedly complete
contract, the complete label is invalid until the boundary is narrowed or the defect is fixed.

## Evidence Ladder

Use the lowest-cost evidence that can answer the question, but never claim a higher rung than was
actually reached.

| Evidence level | It can establish | It cannot establish alone |
|---|---|---|
| Source/shape inspection | Presence, topology, dependencies, explicit branches, stubs, delegation, and obvious unsupported paths | Runtime correctness, absence of hidden paths, or completeness |
| Focused stage observation | Behavior at one parser, analyzer, SFA, IL, optimizer, or codegen boundary | Downstream encoding, packaging, device behavior, or whole-pipeline correctness |
| Emitted assembly inspection | Selected symbolic instructions, labels, data, and source-level layout intent | Actual instruction encodings, final addresses, container bytes, or runtime behavior |
| Assembled bytes/report/symbols | Encoding, final placement, branch range, load address, body bytes, symbols, and size | CPU/device behavior or timing under a machine model |
| VICE 3.10 observation | Automated behavior for the exact recorded emulator tag, machine/video/chip model, settings, and path | Universal silicon, board, analogue audio, power, temperature, or revision behavior |
| Physical measurement | Behavior on the recorded unit, board/chip revisions, peripherals, power, temperature, and test method | Universal C64 behavior without justified sampling/generalization |
| Expert equivalent-work comparison | Whether generated and expert solutions perform the same work and why their cost differs | Programs the language cannot express or unmeasured whole-program interactions |

The governing sources for CPU, C64, ACME, and VICE evidence are pinned in
`source-manifest.md#processor-and-bus-sources`, `#commodore-64-and-chip-sources`, and
`#tool-authorities`.

## Evidence Boundary Rules

1. Match the endpoint to the claim. An assembly-shape claim ends at emitted assembly; an opcode-
   encoding claim needs bytes; a device behavior claim needs an execution model; a physical claim
   needs physical evidence.
2. Record skips. A conditional suite that does not execute contributes no evidence for the skipped
   endpoint.
3. Preserve raw identity. Record source commit, compiler commit, options, target profile, assembler
   version, emulator/model, and input identity before interpreting results.
4. Separate positive, boundary, and negative cases. One happy path does not cover rejection,
   overflow, aliasing, interrupts, range repair, or target mismatch.
5. Inspect the path actually shipped. A unit helper that works is not proof that the public compiler
   reaches it or preserves its result.
6. Prefer a small decisive proof. Add a broad harness only when it catches a named failure no
   smaller proof can catch.

## Transformation Proof

An optimizer changes the program representation and usually changes the final assembly. Proving
that it did the intended work therefore requires two independent expectations:

1. **Behavior oracle** — expected externally visible semantics derived from the language contract,
   input domain, side effects, traps/wrap rules, volatile/MMIO behavior, and target environment.
2. **Assembly/resource oracle** — the intended code shape and complete cost derived from the
   optimization goal, expert idiom, selected CPU, and placement/timing assumptions.

Running optimized and unoptimized forms and comparing their outputs is useful differential
evidence, but it is not an independent oracle: both forms may share the same defect. Comparing only
assembly shape can prove the rewrite happened, not that the result is correct. Comparing only
behavior can accept a correct but pointless or regressive optimization.

For every material transformation, record:

- preconditions and the pass that proves each one;
- semantics preserved, including evaluation order, width, signedness, aliasing, volatility, and
  interrupts;
- registers, flags, memory, bank state, and scratch changed;
- chosen alternative and rejected viable alternatives;
- path-specific bytes/cycles and all non-code resources;
- an independent behavior case, including relevant boundaries;
- the expected assembly/resource change; and
- counterexamples that must leave the source form unchanged or produce a diagnostic.

This rule is supported by the frozen Blend65 semantics and the instruction/device effects pinned
in the source manifest; it is a compiler proof method, not a claim that one external compiler uses
the same pipeline.

## Equivalent-Work Accounting

### Establish Equivalence First

Do not calculate a parity ratio until both programs have the same obligations:

- input domain, output, width, signedness, overflow/wrap, division/remainder, and error behavior;
- evaluation order, short-circuiting, alias behavior, volatile access count/order, and MMIO effects;
- initial/final registers, status flags, decimal mode, bank state, and interrupt state;
- call/return ABI, preserved state, parameters, returns, reentrancy, recursion policy, and nested
  call staging;
- data/table availability, initialization, loader responsibility, placement, and lifetime;
- exact hot/cold path, taken/not-taken path, page crossing, badline/sprite DMA, and video/chip model;
- startup, shutdown, container, dead-strip, and helper-sharing obligations; and
- safety/compatibility scope, including physical-hardware requirements.

If the obligations differ, report “not equivalent” and the difference. Do not repair the ratio by
silently ignoring work.

### Cost Ledger

Report generated and expert costs separately in the following units. Never collapse scarce bytes
and cycles into one unexplained score.

| Resource | Include |
|---|---|
| Code bytes | Routine body, call sites, stubs, trampolines, startup, repair sequences, alignment-induced code growth |
| Data bytes | Constants, tables, masks, pre-shifted assets, relocation/link metadata that ships, and duplicated representations |
| Padding/alignment | Gaps required for pages, banks, VIC bases, branches, tables, or timing |
| Zero page | Persistent allocation, temporaries, pointers, helper state, IRQ-reserved cells, fragmentation/placement constraints |
| Static frames | Parameters, returns, locals, temporaries, spills, argument staging, overlay interference, escaped/indirect roots |
| Hardware stack | Return addresses, saved status/registers, interrupt nesting, explicit pushes, maximum depth |
| Scratch | Shared helper scratch, ownership, lifetime, reentrancy/IRQ exclusion, and initialization |
| Memory traffic | Reads/writes/RMW accesses, volatile/MMIO count and order, bank switches, copies, loader transfers |
| Cycles | Per meaningful path, call overhead, page conditions, branch result, DMA/badline loss, IRQ jitter, and frequency |
| Build/runtime dependencies | Helper retention, table generator, loader, platform API, target mode, and proof burden |

Shared helper/table cost uses a declared attribution policy: total whole-program cost, marginal cost
for this call site, and amortized cost when useful. State which one a ratio uses.

### Parity Result

For an equivalent local routine and a chosen scalar cost, use:

```text
ratio = generated cost / expert cost
```

- `ratio < 1.0`: generated code beats the expert baseline for that exact measure/path.
- `ratio = 1.0`: it meets the local floor. Record the missing whole-program or transformation
  opportunity as actionable debt during later compiler work.
- `ratio > 1.0`: parity defect unless a different measured resource or contract justifies the
  tradeoff and the comparison reports it openly.

There is no universal weighted ratio. A raster deadline can make worst-path cycles decisive; a
resident loader can make bytes decisive; a ZP shortage can reject the faster routine. Report the
Pareto tradeoff when no option wins every resource.

## Local Floor and Whole-Program Win

An expert can still hand-tune an isolated routine to the machine. Matching that routine is the
local floor. Blend65's durable opportunity to beat hand work is at program scope:

- global constant/range propagation and dead removal;
- whole-call-graph SFA overlay and scarce-ZP allocation;
- consistent specialization across every call site;
- cross-routine placement, bank/layout selection, and branch/page repair;
- shared-helper/table decisions with total rather than local cost;
- exhaustive strength reduction and target-specific selection; and
- absence of forgotten or inconsistently hand-tuned paths.

Report the two results independently. “Every local routine meets the expert and global placement
saves 200 bytes” is a valid whole-program win. It does not rewrite the local ratios below 1.0.
Likewise, one fast routine does not prove the program beats expert work if its table, loader, or ZP
pressure makes the program worse.

## Expressiveness Is Outside the Ratio

If ordinary Blend65 cannot express the useful program or forces the user to encode compiler/
hardware mechanics that a modern developer should not need, there is no finite parity ratio. The
scoreboard contains only programs that compile and is structurally unable to represent this
failure.

During the later recovery audit, record:

- the ordinary modern source intent;
- the rejected or distorted Blend65 form;
- the platform-mandated limitation, if one truly exists;
- any workaround and the hardware lore/manual repetition it exposes;
- the compiler/language/platform-library owner that should remove the restriction; and
- the smallest conformance and output-parity proof.

Examples include an intrinsic that rejects a variable address without a platform reason, an API
that requires manual unrolled register writes, or a convenience wrapper that introduces runtime
overhead instead of folding to the expert sequence. These are defects or explicit platform limits,
not user education opportunities.

## Live Compiler Recovery Audit

### Reinspect Before Every Status Claim

The skill stores method, sources, and durable constraints. It must not freeze current compiler
completeness. At the start of every audit or after material repository change:

1. record the live branch and commit plus whether the worktree is dirty;
2. read the current feature and portfolio roadmaps for claimed lifecycle only;
3. identify public entry points and trace the real pipeline path;
4. inventory current tests and whether their applicable endpoint actually ran;
5. inspect emitted/assembled/runtime artifacts only when the claim requires them;
6. compare observed behavior with independent authority; and
7. assign one five-state result with an explicit boundary.

Roadmap state directs where to look. It is not proof. If a previous report is reused, revalidate its
identity and mutable evidence rather than copying its conclusion.

### Segment Record

Use this compact record for each lexer, parser, analyzer, SFA, IL, optimizer, codegen, emitter,
packager, platform, library, CLI, or harness capability:

| Field | Required content |
|---|---|
| Scope | One named contract and explicit exclusions |
| Authority | Reconciled spec/product decision or requested program behavior; never current implementation |
| Knowledge lineage | `{skillVersion, contentCommit, referencePath#heading, sourceKeys, claimKey?}` |
| Live path | Public entry through actual files/functions/transforms with line evidence |
| Evidence reached | Exact evidence-ladder endpoint, commands/artifacts, skips, and identities |
| Result | One five-state label plus proven boundary |
| Correctness gaps | Counterexample, violated rule, severity, and user-visible consequence |
| Output parity | Equivalent-work baseline, resource ledger, local ratio(s), whole-program result |
| Complexity | Mechanisms, real consumers, duplication, maintenance and verification cost |
| Salvage | `Keep`, `Simplify`, `Rewrite`, or `Delete` with evidence |
| Next proof/action | Smallest decisive next step and owner |

Do not derive a package-level status by averaging its rows. Summarize counts and name every
critical/major exception.

## Salvage Decisions

### Keep

Keep only when the component has a necessary current responsibility, a clear boundary, correct
evidence for its whole claimed contract, active consumers, and lower recovery cost than a simpler
replacement. “Already implemented” is not a reason.

### Simplify

Simplify when the responsibility and behavior are valid but the mechanism has abstractions,
configuration, duplicated layers, or gates without distinct consumers. State what is removed,
which proof remains, and why the smaller form covers the contract.

### Rewrite

Rewrite when the contract is useful but the design blocks correctness, modular target seams,
modern source ergonomics, SFA closure, expert output, or feasible verification. Preserve only
independently verified behavior/data that is cheaper and safer to migrate than recreate.

### Delete

Delete when the component is unused, duplicated, speculative, stale, non-authoritative, or more
expensive to understand/prove than to replace. Before deletion, resolve real consumers and retain
the smallest necessary acceptance proof. Sunk cost, test count, and old roadmap completion do not
count as value.

## Harness Demonstrated-Value Test

A test/readiness/workflow mechanism earns continued cost only if all answers below are concrete:

1. Which named material failure does it catch?
2. Which real decision consumes that result?
3. Why can a smaller stage test, representative compiled program, assembly/byte assertion, or
   emulator assertion not catch it?
4. Which existing proof does it replace or consolidate?
5. What is its execution and maintenance cost, including irrelevant reruns?
6. Does a skip remain visible as `Unknown`, rather than becoming green?

If the unique failure and consumer are absent, delete it. If the responsibility is valid but the
mechanism is too broad, simplify it into the smallest directed check. Do not build a replacement
meta-harness merely to organize the old harness. Run directed checks during work and the relevant
full acceptance set only at a major closeout where its endpoints matter.

## Feasibility Matrix Boundary

The C64 game-feasibility matrix is a naive checkpoint view of what a game might be able to express
and run if developed from scratch with the compiler state at that moment. It is not authoritative,
does not determine compiler architecture or qualification, and must never seed a status claim.
It may be regenerated, become stale, or be removed entirely without changing skill doctrine.

When it is useful, update it only after independent compiler evidence exists. A feasible row whose
program is not expressible in modern Blend65 or whose output loses to the expert floor is not a
reason to lower the bar; it is evidence that the snapshot was optimistic.

## Knowledge Lineage and Version Impact

Every material recovery conclusion records:

```text
{
  skillVersion,
  contentCommit,
  referencePath#heading,
  sourceKeys,
  claimKey? // only when one heading owns independent rules
}
```

When a qualified skill version changes, inspect only conclusions whose lineage intersects changed
rules/sources and assign exactly one disposition:

| Disposition | Meaning |
|---|---|
| `unaffected` | No changed rule/source participates in the conclusion. |
| `revalidated` | It depends on changed material, but fresh evidence reaches the same conclusion. |
| `corrected` | The conclusion changes and all affected records/decisions are updated. |
| `invalidated/reopened` | Evidence is no longer sufficient or downstream work must be reconsidered. |

Do not edit a qualified skill silently mid-journey. Build and qualify a semantic-versioned
replacement, perform the targeted impact audit, and activate it atomically as the only active
version. A materially false source/oracle reopens the affected authority gate and dependent results;
it is never “fixed” by weakening an expectation to match authored prose.

## Finding and Recommendation Shape

For a material audit result, report:

| Field | Content |
|---|---|
| Status | Five-state label and exact boundary |
| Claim kind | Fact, inference, unknown, or recommendation |
| Assumptions | CPU/platform/model, inputs, ABI, interrupts, placement, and workload |
| Evidence | Source/artifact identity, endpoint reached, skips, and lineage |
| Cost | Complete equivalent-work ledger or “not yet measurable” |
| Finding | One clear contract gap or confirmed capability |
| Recommendation | Single best viable action and why |
| Proof | Smallest test/artifact/measurement required to close it |

Lead with the recommendation when a decision is needed. Do not create a menu of speculative
architectures. A localized defect gets a localized remedy unless evidence shows the seam itself is
wrong. A material current-implementation discrepancy belongs in the later compiler recovery
backlog; it must not bend the skill toward the faulty implementation.

## Failure Conditions

Stop or downgrade the claim when any of these occurs:

- the compiler/test under audit supplies its own expected behavior;
- a parser, assembly shape, or skipped runtime tier is called end-to-end proof;
- generated code is compared with an expert routine that performs different work;
- tables, padding, ZP, frames, stack, scratch, helpers, loader, or path timing are omitted;
- one emulator model is generalized to physical hardware;
- an inexpressible program disappears from parity accounting;
- old complexity is preserved because it exists or has many tests;
- current completeness is copied from the skill instead of re-inspected;
- the feasibility matrix influences architecture or truth; or
- a qualified version changes without a bump, qualification, atomic activation, and impact review.
