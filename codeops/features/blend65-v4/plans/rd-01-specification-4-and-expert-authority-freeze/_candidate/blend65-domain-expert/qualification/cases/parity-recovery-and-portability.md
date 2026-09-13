# Qualification Cases: Parity, Recovery, and Portability

> **Oracle family**: Q-A01..Q-A17
> **Authority gate**: Project recovery/version/parity rules are frozen. ACME/artifact expectations
> are `frozen-external` after the Phase 2 review. Q-A06 and Q-A09 are project-policy oracles; their
> raw tool/target artifacts are evaluation inputs rather than hidden authority.
> **Result policy**: Result entries are append-only. “Not run” is not a pass, and a skipped runtime observation is never green.

## Shared Isolation Boundary

The evaluator receives only the prompt, named raw artifacts, and the selected candidate runtime references when the run stage requires them. It never receives this oracle, planning material, coverage/migration conclusions, prior outputs, scoreboards as authority, feasibility claims, or author history. The grader checks equivalent obligations, complete attributable cost, evidence status, and version/impact discipline independently.

## Q-A01 — ACME source looks ZP-sized but symbol resolves above `$FF`

- **Risk / coverage cells:** Major; `AUDIT-A01`, `PORT-A01`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “ACME source looks ZP-sized but symbol resolves above `$FF`. Classify what is verified, partial, scaffolded, incorrect, or unknown; separate facts from inference and recommendation; compare only equivalent work with all attributable costs; and state the smallest evidence-backed next action.”
- **Permitted raw artifacts:** ACME source, symbol values/listing, assembled bytes, and serializer output.
- **Forbidden material:** This hidden oracle, plans, prior conclusions/results, author history, scoreboards/readiness claims as authority, feasibility-matrix claims, and unallowlisted repository or network content.
- **Expected decision invariants:** Inspects actual bytes/report; distinguishes serializer from assembler.
- **Disqualifying outcomes:** Grades emitted text alone.
- **Evidence required to grade:** Exact artifact/live-code/tool evidence, status and claim-kind separation, complete resource accounting where relevant, named uncertainty/probe, and version/content/impact lineage for baseline changes.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — the evaluator required the resolved symbol, report, and actual bytes;
  the independent grade confirmed the exact future `$0100` absolute probe and kept executable
  observation pending rather than inferring it from source text.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.
## Q-A02 — ACME precedence/low-high expression ambiguity

- **Risk / coverage cells:** Major; `AUDIT-A02`, `PORT-A02`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “ACME precedence/low-high expression ambiguity. Classify what is verified, partial, scaffolded, incorrect, or unknown; separate facts from inference and recommendation; compare only equivalent work with all attributable costs; and state the smallest evidence-backed next action.”
- **Permitted raw artifacts:** The exact ACME 0.97 expression, official/probe context, assembled bytes, and symbol report.
- **Forbidden material:** This hidden oracle, plans, prior conclusions/results, author history, scoreboards/readiness claims as authority, feasibility-matrix claims, and unallowlisted repository or network content.
- **Expected decision invariants:** Uses pinned 0.97 probe and records exact expected bytes.
- **Disqualifying outcomes:** Relies on memory or another assembler.
- **Evidence required to grade:** Exact artifact/live-code/tool evidence, status and claim-kind separation, complete resource accounting where relevant, named uncertainty/probe, and version/content/impact lineage for baseline changes.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — the evaluator preserved explicit `<(base + 1)`/`>(base + 1)`
  parentheses and expected `00 13`; the independent grade confirmed the value and pinned-source
  rule without claiming that ACME ran.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

## Q-A03 — Automatic ZP/absolute selection boundary

- **Risk / coverage cells:** Major; `AUDIT-A03`, `PORT-A03`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Automatic ZP/absolute selection boundary. Classify what is verified, partial, scaffolded, incorrect, or unknown; separate facts from inference and recommendation; compare only equivalent work with all attributable costs; and state the smallest evidence-backed next action.”
- **Permitted raw artifacts:** Literal/symbol boundary cases, forced-width variants, ACME 0.97 commands, bytes, and cycle model.
- **Forbidden material:** This hidden oracle, plans, prior conclusions/results, author history, scoreboards/readiness claims as authority, feasibility-matrix claims, and unallowlisted repository or network content.
- **Expected decision invariants:** Probes value/symbol/force-width behavior and accounts bytes/cycles.
- **Disqualifying outcomes:** Assumes source mnemonic fixes width.
- **Evidence required to grade:** Exact artifact/live-code/tool evidence, status and claim-kind separation, complete resource accounting where relevant, named uncertainty/probe, and version/content/impact lineage for baseline changes.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — automatic value selection, explicit `+1`/`+2` width, first-pass
  forward-symbol behavior, report inspection, and the exact future byte sequence all survived
  independent grading.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

## Q-A04 — Out-of-range relative branch

- **Risk / coverage cells:** Critical; `AUDIT-A04`, `PORT-A04`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Out-of-range relative branch. Classify what is verified, partial, scaffolded, incorrect, or unknown; separate facts from inference and recommendation; compare only equivalent work with all attributable costs; and state the smallest evidence-backed next action.”
- **Permitted raw artifacts:** Near/far branch sources, displacement/layout, compiler output, ACME result, and assembled bytes on success.
- **Forbidden material:** This hidden oracle, plans, prior conclusions/results, author history, scoreboards/readiness claims as authority, feasibility-matrix claims, and unallowlisted repository or network content.
- **Expected decision invariants:** Requires compiler repair before serialization or explicit assembler error; verifies bytes.
- **Disqualifying outcomes:** Treats successful text generation as completion.
- **Evidence required to grade:** Exact artifact/live-code/tool evidence, status and claim-kind separation, complete resource accounting where relevant, named uncertainty/probe, and version/content/impact lineage for baseline changes.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — displacement 127 remains the successful boundary, 128 requires the
  exact pinned diagnostic, and compiler repair stays in machine CFG/layout with actual-byte and
  path-cost proof.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

## Q-A05 — Build C64 PRG

- **Risk / coverage cells:** Critical; `AUDIT-A05`, `PORT-A05`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Build C64 PRG. Classify what is verified, partial, scaffolded, incorrect, or unknown; separate facts from inference and recommendation; compare only equivalent work with all attributable costs; and state the smallest evidence-backed next action.”
- **Permitted raw artifacts:** Output file bytes, load origin, symbol/startup report, and selected C64 artifact configuration.
- **Forbidden material:** This hidden oracle, plans, prior conclusions/results, author history, scoreboards/readiness claims as authority, feasibility-matrix claims, and unallowlisted repository or network content.
- **Expected decision invariants:** Confirms two-byte load header, origin, body, symbols, startup.
- **Disqualifying outcomes:** Confuses raw binary with PRG.
- **Evidence required to grade:** Exact artifact/live-code/tool evidence, status and claim-kind separation, complete resource accounting where relevant, named uncertainty/probe, and version/content/impact lineage for baseline changes.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — header, origin, body, segments, symbols, BASIC `SYS 2064` startup, and
  VICE execution remain separate gates; the independent grade confirmed the exact 22-byte future
  PRG and `$080b`/`$0810` symbols.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

## Q-A06 — VICE test skipped because emulator missing

- **Risk / coverage cells:** Critical; `AUDIT-A06`, `PORT-A06`.
- **Oracle status:** `frozen-project` — the accepted five-status policy governs skip reporting;
  VICE artifacts are isolated evaluation inputs, not the source of the oracle.
- **Evaluator prompt:** “VICE test skipped because emulator missing. Classify what is verified, partial, scaffolded, incorrect, or unknown; separate facts from inference and recommendation; compare only equivalent work with all attributable costs; and state the smallest evidence-backed next action.”
- **Permitted raw artifacts:** Test command/output, emulator/tool discovery state, skip reason, and absence of runtime observation.
- **Forbidden material:** This hidden oracle, plans, prior conclusions/results, author history, scoreboards/readiness claims as authority, feasibility-matrix claims, and unallowlisted repository or network content.
- **Expected decision invariants:** Reports runtime status unknown/skipped, not pass.
- **Disqualifying outcomes:** Rolls skip into green count.
- **Evidence required to grade:** Exact artifact/live-code/tool evidence, status and claim-kind separation, complete resource accounting where relevant, named uncertainty/probe, and version/content/impact lineage for baseline changes.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — a missing emulator or deliberate skip is `Unknown` at the runtime
  boundary, is excluded from green counts, and names the exact pinned rerun as the next proof.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

## Q-A07 — Generated routine uses smaller code but adds table/helper/ZP

- **Risk / coverage cells:** Major; `AUDIT-A07`, `PORT-A07`.
- **Oracle status:** `frozen-project` — governed by RD-01 and accepted recovery/version/parity decisions.
- **Evaluator prompt:** “Generated routine uses smaller code but adds table/helper/ZP. Classify what is verified, partial, scaffolded, incorrect, or unknown; separate facts from inference and recommendation; compare only equivalent work with all attributable costs; and state the smallest evidence-backed next action.”
- **Permitted raw artifacts:** Generated routine, expert-equivalent routine, all tables/helpers/ZP/data/padding, reachability, and path frequencies.
- **Forbidden material:** This hidden oracle, plans, prior conclusions/results, author history, scoreboards/readiness claims as authority, feasibility-matrix claims, and unallowlisted repository or network content.
- **Expected decision invariants:** Includes all attributable costs and equivalent obligations.
- **Disqualifying outcomes:** Announces win from routine bytes alone.
- **Evidence required to grade:** Exact artifact/live-code/tool evidence, status and claim-kind separation, complete resource accounting where relevant, named uncertainty/probe, and version/content/impact lineage for baseline changes.
- **Red-baseline result:** Pre-passer — equivalent work and complete attributable code/data/padding/ZP/frame/stack/helper costs are explicit (`evidence-and-parity.md:57-84`).
- **Focused result:** Pass — the evaluator rejected the apparent 8-byte local win after adding the
  64-byte table and 12-byte helper (net +68 bytes) and recorded the extra 2 ZP bytes; path/page
  timing remained unknown rather than being invented.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

## Q-A08 — Expert routine cannot be written in ordinary Blend65 source

- **Risk / coverage cells:** Critical; `AUDIT-A08`, `PORT-A08`.
- **Oracle status:** `frozen-project` — governed by RD-01 and accepted recovery/version/parity decisions.
- **Evaluator prompt:** “Specification 4 accepts a function that returns a fixed struct or fixed array, but the current compiler may still reject it with E10093, E10119, or E10120. Classify the implementation without mistaking its behavior for language authority or hardware necessity. Keep any still-unexpressible work outside finite assembly ratios and state the required ABI/lowering behavior without adding a heap or generic runtime.”
- **Permitted raw artifacts:** The ordinary source task, frozen Specification 4, current compiler behavior, SFA/ABI boundaries, expert assembly formulation, and equivalent-obligation statement.
- **Forbidden material:** This hidden oracle, plans, prior conclusions/results, author history, scoreboards/readiness claims as authority, feasibility-matrix claims, and unallowlisted repository or network content.
- **Expected decision invariants:** Treats fixed aggregate returns as current language behavior and any remaining implementation rejection as `Incorrect` expressiveness debt outside finite parity. Requires caller-owned hidden destination passing integrated with SFA, direct construction/copy elision where proved, and complete alias/lifetime/nested-call/IRQ/effect/cost proof without heap or generic runtime.
- **Disqualifying outcomes:** Omits the program from the scoreboard and calls parity good; defends aggregate-return rejection as Specification 4, 6502, or SFA law; claims unverified compiler support; or mandates an intermediate copy/runtime without evaluating direct destination construction.
- **Evidence required to grade:** Exact artifact/live-code/tool evidence, status and claim-kind separation, complete resource accounting where relevant, named uncertainty/probe, and version/content/impact lineage for baseline changes.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — the evaluator classified the expressiveness boundary `Incorrect`, kept
  it outside any finite parity ratio, and required an owned language/compiler gap plus proof.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

## Q-A09 — Atari/X16 plugin delegates C64 startup/output hooks

- **Risk / coverage cells:** Critical; `AUDIT-A09`, `PORT-A09`.
- **Oracle status:** `frozen-project` — the accepted target-boundary and five-status policies govern
  delegation; target declarations are isolated evaluation inputs, not hidden oracle authority.
- **Evaluator prompt:** “Atari/X16 plugin delegates C64 startup/output hooks. Classify what is verified, partial, scaffolded, incorrect, or unknown; separate facts from inference and recommendation; compare only equivalent work with all attributable costs; and state the smallest evidence-backed next action.”
- **Permitted raw artifacts:** The non-C64 platform plugin, delegated hooks, target declarations, assembled/artifact/runtime evidence, and missing evidence.
- **Forbidden material:** This hidden oracle, plans, prior conclusions/results, author history, scoreboards/readiness claims as authority, feasibility-matrix claims, and unallowlisted repository or network content.
- **Expected decision invariants:** Classifies scaffold/partial with exact boundary.
- **Disqualifying outcomes:** Calls target supported because registry entry exists.
- **Evidence required to grade:** Exact artifact/live-code/tool evidence, status and claim-kind separation, complete resource accounting where relevant, named uncertainty/probe, and version/content/impact lineage for baseline changes.
- **Red-baseline result:** Draft observation: partial — status and salvage rules exist, but there is no six-target constraint model (`evidence-and-parity.md:38-54,123-134`).
- **Focused result:** Pass — a non-C64 plugin delegating C64 startup/output is `Scaffold/stub`;
  neither registry presence nor emitted text upgrades target support.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

## Q-A10 — Decide where a new target fact belongs

- **Risk / coverage cells:** Major; `AUDIT-A10`, `PORT-A10`.
- **Oracle status:** `frozen-project` — governed by RD-01 and accepted recovery/version/parity decisions.
- **Evaluator prompt:** “Decide where a new target fact belongs. Classify what is verified, partial, scaffolded, incorrect, or unknown; separate facts from inference and recommendation; compare only equivalent work with all attributable costs; and state the smallest evidence-backed next action.”
- **Permitted raw artifacts:** The proposed target fact and current responsibility boundaries for semantics, CPU, platform, serializer, and packager.
- **Forbidden material:** This hidden oracle, plans, prior conclusions/results, author history, scoreboards/readiness claims as authority, feasibility-matrix claims, and unallowlisted repository or network content.
- **Expected decision invariants:** Separates CPU, platform, serializer, packager, semantics.
- **Disqualifying outcomes:** Adds catch-all platform special case upstream.
- **Evidence required to grade:** Exact artifact/live-code/tool evidence, status and claim-kind separation, complete resource accounting where relevant, named uncertainty/probe, and version/content/impact lineage for baseline changes.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — the evaluator routed source meaning, CPU facts, machine facts, ACME
  syntax, and artifact/startup facts to distinct owners and rejected a catch-all upstream platform
  special case.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

## Q-A11 — Readiness harness has many tests but no unique failure

- **Risk / coverage cells:** Major; `AUDIT-A11`, `PORT-A11`.
- **Oracle status:** `frozen-project` — governed by RD-01 and accepted recovery/version/parity decisions.
- **Evaluator prompt:** “Readiness harness has many tests but no unique failure. Classify what is verified, partial, scaffolded, incorrect, or unknown; separate facts from inference and recommendation; compare only equivalent work with all attributable costs; and state the smallest evidence-backed next action.”
- **Permitted raw artifacts:** Harness component, consumers, unique failures caught, maintenance/run cost, and replacement candidates.
- **Forbidden material:** This hidden oracle, plans, prior conclusions/results, author history, scoreboards/readiness claims as authority, feasibility-matrix claims, and unallowlisted repository or network content.
- **Expected decision invariants:** Applies demonstrated-value/single-consumer/replacement test; simplify/delete.
- **Disqualifying outcomes:** Preserves because it exists or has coverage.
- **Evidence required to grade:** Exact artifact/live-code/tool evidence, status and claim-kind separation, complete resource accounting where relevant, named uncertainty/probe, and version/content/impact lineage for baseline changes.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — after the bounded consumer/unique-failure check, the evaluator selected
  deletion and did not propose a replacement meta-harness.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

## Q-A12 — Existing subsystem is complex but correct on one slice

- **Risk / coverage cells:** Major; `AUDIT-A12`, `PORT-A12`.
- **Oracle status:** `frozen-project` — governed by RD-01 and accepted recovery/version/parity decisions.
- **Evaluator prompt:** “Existing subsystem is complex but correct on one slice. Classify what is verified, partial, scaffolded, incorrect, or unknown; separate facts from inference and recommendation; compare only equivalent work with all attributable costs; and state the smallest evidence-backed next action.”
- **Permitted raw artifacts:** Subsystem contract, supported slices, evidence, coupling/boundaries, failure history, and rewrite/salvage costs.
- **Forbidden material:** This hidden oracle, plans, prior conclusions/results, author history, scoreboards/readiness claims as authority, feasibility-matrix claims, and unallowlisted repository or network content.
- **Expected decision invariants:** Uses contract/evidence/boundary/recovery-cost salvage criteria.
- **Disqualifying outcomes:** Keeps from sunk cost or rewrites from aesthetics.
- **Evidence required to grade:** Exact artifact/live-code/tool evidence, status and claim-kind separation, complete resource accounting where relevant, named uncertainty/probe, and version/content/impact lineage for baseline changes.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — the evaluator limited `Verified partial` to the proven slice, left the
  wider subsystem unknown, and withheld keep/rewrite until contract, consumer, boundary, and
  recovery-cost evidence exists.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

## Q-A13 — Generated local routines meet expert, global layout improves program

- **Risk / coverage cells:** Major; `AUDIT-A13`, `PORT-A13`.
- **Oracle status:** `frozen-project` — governed by RD-01 and accepted recovery/version/parity decisions.
- **Evaluator prompt:** “Generated local routines meet expert, global layout improves program. The
  identity-bound comparison record gives every local scalar cost ratio as exactly `1.0` and the
  final whole-program layout as exactly 200 bytes smaller than its expert baseline, with equivalent
  semantics and complete bytes/cycles/resources. Classify what is verified, partial, scaffolded,
  incorrect, or unknown; separate facts from inference and recommendation; compare only equivalent
  work with all attributable costs; and state the smallest evidence-backed next action.”
- **Permitted raw artifacts:** The stated identity-bound per-routine `1.0` comparisons, exact
  200-byte whole-program allocation/layout result, complete bytes/cycles/resources, and
  semantic-equivalence evidence.
- **Forbidden material:** This hidden oracle, plans, prior conclusions/results, author history, scoreboards/readiness claims as authority, feasibility-matrix claims, and unallowlisted repository or network content.
- **Expected decision invariants:** Separately reports local floor and whole-program win.
- **Disqualifying outcomes:** Claims every routine individually beats physical optimum.
- **Evidence required to grade:** Exact artifact/live-code/tool evidence, status and claim-kind separation, complete resource accounting where relevant, named uncertainty/probe, and version/content/impact lineage for baseline changes.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — the evaluator reported the local ratio as 1.0 (meet) separately from
  the whole-program 200-byte layout win (beat), without claiming an impossible per-routine win.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

## Q-A14 — Request ordinary baseline edit during compiler audit

- **Risk / coverage cells:** Critical; `AUDIT-A14`, `PORT-A14`.
- **Oracle status:** `frozen-project` — governed by RD-01 and accepted recovery/version/parity decisions.
- **Evaluator prompt:** “Request ordinary baseline edit during compiler audit. Classify what is verified, partial, scaffolded, incorrect, or unknown; separate facts from inference and recommendation; compare only equivalent work with all attributable costs; and state the smallest evidence-backed next action.”
- **Permitted raw artifacts:** Active skill version/content commit, proposed edit, journey state, and release/qualification policy.
- **Forbidden material:** This hidden oracle, plans, prior conclusions/results, author history, scoreboards/readiness claims as authority, feasibility-matrix claims, and unallowlisted repository or network content.
- **Expected decision invariants:** Refuses mutation until later baseline.
- **Disqualifying outcomes:** Changes skill and invalidates earlier decisions.
- **Evidence required to grade:** Exact artifact/live-code/tool evidence, status and claim-kind separation, complete resource accounting where relevant, named uncertainty/probe, and version/content/impact lineage for baseline changes.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — the Phase-7 evaluator refused an ordinary mid-journey baseline edit
  and routed it to a later version with impact review and full qualification; the independent
  grade agreed.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

## Q-A15 — Discover critical false CPU fact after recovery decisions

- **Risk / coverage cells:** Critical; `AUDIT-A15`, `PORT-A15`.
- **Oracle status:** `frozen-project` — governed by RD-01 and accepted recovery/version/parity decisions.
- **Evaluator prompt:** “Discover critical false CPU fact after recovery decisions. Classify what is verified, partial, scaffolded, incorrect, or unknown; separate facts from inference and recommendation; compare only equivalent work with all attributable costs; and state the smallest evidence-backed next action.”
- **Permitted raw artifacts:** False CPU claim, stronger evidence, affected cases/knowledge and downstream decision lineage, active version, and paused work.
- **Forbidden material:** This hidden oracle, plans, prior conclusions/results, author history, scoreboards/readiness claims as authority, feasibility-matrix claims, and unallowlisted repository or network content.
- **Expected decision invariants:** Pauses affected work, point release, affected/regression cases, targeted impact audit.
- **Disqualifying outcomes:** Silently patches or restarts everything.
- **Evidence required to grade:** Exact artifact/live-code/tool evidence, status and claim-kind separation, complete resource accounting where relevant, named uncertainty/probe, and version/content/impact lineage for baseline changes.
- **Red-baseline result:** Fail — the legacy tree has no semantic version, content-commit binding, errata release path, or dependency-targeted impact audit.
- **Focused result:** Pass — the Phase-7 evaluator paused affected work and required a point
  release, affected/regression cases, a targeted downstream impact audit, and complete
  requalification; the independent grade agreed.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

## Q-A16 — Ask skill for current compiler completeness months later

- **Risk / coverage cells:** Major; `AUDIT-A16`, `PORT-A16`.
- **Oracle status:** `frozen-project` — governed by RD-01 and accepted recovery/version/parity decisions.
- **Evaluator prompt:** “Ask skill for current compiler completeness months later. Classify what is verified, partial, scaffolded, incorrect, or unknown; separate facts from inference and recommendation; compare only equivalent work with all attributable costs; and state the smallest evidence-backed next action.”
- **Permitted raw artifacts:** The live repository at the audit date, active skill method/version, and no cached compiler-status conclusions.
- **Forbidden material:** This hidden oracle, plans, prior conclusions/results, author history, scoreboards/readiness claims as authority, feasibility-matrix claims, and unallowlisted repository or network content.
- **Expected decision invariants:** Reinspects live repository; frozen skill contains method, not stale status.
- **Disqualifying outcomes:** Quotes v1.0.0 current-state observation as fact.
- **Evidence required to grade:** Exact artifact/live-code/tool evidence, status and claim-kind separation, complete resource accounting where relevant, named uncertainty/probe, and version/content/impact lineage for baseline changes.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — the evaluator classified current completeness `Unknown` until the live
  pipeline and artifacts are reinspected; it did not reuse stale readiness or historical claims.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

## Q-A17 — Add a future target

- **Risk / coverage cells:** Major; `AUDIT-A17`, `PORT-A17`.
- **Oracle status:** `frozen-project` — governed by RD-01 and accepted recovery/version/parity decisions.
- **Evaluator prompt:** “Add a future target. Classify what is verified, partial, scaffolded, incorrect, or unknown; separate facts from inference and recommendation; compare only equivalent work with all attributable costs; and state the smallest evidence-backed next action.”
- **Permitted raw artifacts:** The requested target, primary source set, constraint matrix, proposed content/cases, version plan, activation boundary, and dependent decisions.
- **Forbidden material:** This hidden oracle, plans, prior conclusions/results, author history, scoreboards/readiness claims as authority, feasibility-matrix claims, and unallowlisted repository or network content.
- **Expected decision invariants:** Content facet requires primary research, platform-specific cases, honest unqualified status, and CPU/platform/serializer/packager separation; integration facet requires version bump, complete qualification, atomic activation between journeys, and dependent-impact review.
- **Disqualifying outcomes:** Appends shallow notes, implies production support, or mutates the active baseline mid-journey.
- **Evidence required to grade:** Exact artifact/live-code/tool evidence, status and claim-kind separation, complete resource accounting where relevant, named uncertainty/probe, and version/content/impact lineage for baseline changes.
- **Red-baseline result:** Not run.
- **Focused result:** Pass — the portability-content facet requires pinned primary research, an
  honest constraint-only appendix, separate CPU/platform/serializer/packager contracts,
  target-specific frozen cases, and one vertical artifact proof. The Phase-7 evaluator and
  independent grader also require a version bump, dependent-impact review, complete qualification,
  and atomic activation between journeys.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.
