# RD-01: C64-First Blend65 Domain Expert Baseline

> **Document**: RD-01-c64-first-domain-expert-baseline.md
> **Status**: Complete
> **Created**: 2026-09-04
> **Project**: Blend65 Expert Skillset
> **Depends On**: —
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

Create and freeze `blend65-domain-expert` version `1.0.0`: one project-local Codex skill that
supplies the durable expertise needed to audit, redesign, and later implement Blend65 as a
multi-target 6502-family compiler without repeating v2's overengineering. The baseline must be
deep enough to guide real semantic, allocation, lowering, optimization, assembly, platform, and
game-software decisions; structural skill validity or a collection of broad reminders is not
sufficient. (AR #1, #2, #5, #15)

The release is production-depth for NMOS 6502/6510 and the C64. It includes a precise WDC 65C02
delta and cross-target constraint matrix so later architecture choices remain portable, but it
does not claim unqualified expertise for future machines. Compiler implementation and redesign
remain a separate follow-on conducted under this frozen baseline. (AR #3, #11, #13, #14)

---

## Functional Requirements

### Must Have

- [ ] **R1 — Stable public router (M):** Preserve the project-local
  `.agents/skills/blend65-domain-expert/SKILL.md` identity and automatic discovery. The router
  declares baseline `1.0.0`, shared non-negotiable rules, selective-loading routes, authority
  order, and freeze/errata behavior without becoming a knowledge monolith. (AR #2, #7, #26, #29)
- [ ] **R2 — Fixed knowledge topology (L):** Provide exactly the thirteen runtime references in
  §Knowledge topology, each linked from the router with a precise loading condition. (AR #10, #28)
- [ ] **R3 — Blend65 semantic crosswalk (L):** Map every frozen `spec/` document to relevant
  expert guidance or an explicit not-applicable rationale. The crosswalk explains compiler
  consequences and dangerous interactions but never replaces the cited normative rule. (AR #12)
- [ ] **R4 — SFA and ABI doctrine (L):** Treat SFA as the binding general frame model and cover
  call-graph/interference reasoning, lifetimes, overlays, placement, zero page, parameter/return
  conventions, temporaries, recursion, reentrancy, interrupts, hardware-stack usage, diagnostics,
  and target-dependent budgets. (AR #4)
- [ ] **R5 — Architecture decision discipline (L):** Teach the proven target-neutral and
  target-dependent boundaries in §Architecture invariants while leaving exact IR count, pass
  topology, and concrete backend interfaces for the later live-code audit. (AR #11, #20)
- [ ] **R6 — NMOS 6502/6510 expert model (L):** Cover the complete documented instruction and
  addressing model, registers and flags, decimal behavior, interrupts, stack, timing variants,
  page crossings, bus-visible read-modify-write behavior, silicon hazards, zero-page behavior,
  undocumented-opcode policy, and 6510 I/O-port consequences. (AR #13, #15)
- [ ] **R7 — 6502 lowering casebook (XL):** Define expert decision tables, valid sequences,
  cost/flag/memory effects, and counterexamples for all Blend65-relevant scalar widths,
  signedness, constants, arithmetic, comparison, shifts, multiply/divide, booleans, control flow,
  calls, pointers, aggregates, addressing, volatile access, interrupt paths, and runtime helpers.
  (AR #12, #13, #15)
- [ ] **R8 — C64 platform and game expertise (XL):** Cover both PAL and NTSC where behavior or
  timing differs; relevant VIC-II, SID, and CIA revisions; memory/banking/startup/runtime
  ownership; IRQ/NMI and raster timing; graphics, sprites, scrolling, audio, input, loaders,
  placement, data layout, streaming, and representative game-system patterns that constrain the
  compiler or zero-cost platform APIs. (AR #16, #24)
- [ ] **R9 — ACME and artifact expertise (M):** Cover version-pinned ACME syntax and expression
  semantics, labels/symbols, addressing selection, branch reach, directives, placement,
  serialization, assembled-byte inspection, C64 PRG formation, and VICE verification boundaries.
  (AR #8, #27)
- [ ] **R10 — Target portability model (M):** Distinguish CPU model, platform model, emitter, and
  artifact packaging; provide a concise constraint matrix for C64U, C128, X16, Atari 8-bit, and
  Atari 7800 without presenting those machines as qualified implementation targets. (AR #3, #11,
  #13, #14)
- [ ] **R11 — Evidence, parity, and recovery method (L):** Define evidence levels, live pipeline
  tracing, capability status classes, equivalent-work parity accounting, expressiveness failures,
  expert-local parity, whole-program opportunities, harness-value tests, salvage criteria, and
  anti-overengineering decisions. (AR #5, #6, #19, #20, #24)
- [ ] **R12 — Pinned evidence manifest (M):** Record each source's title, issuing authority,
  edition/revision/version, stable URL or repository path, retrieval date, dependent knowledge
  sections, and any known ambiguity/errata. Essential operational guidance remains local and
  usable without Internet access. (AR #8, #17, #27)
- [ ] **R13 — Coverage-driven qualification (XL):** Provide the exact qualification topology in
  §Qualification. Every required coverage cell and high-risk invariant maps to authoritative
  evidence, knowledge guidance, and a discriminating case. All mandatory cases pass with no
  unresolved material failure. (AR #9, #15, #19, #30, #32)
- [ ] **R14 — Blind independent evaluation (L):** Evaluate realistic cases with fresh agents that
  receive only prompts and necessary raw artifacts, never oracles or prior conclusions. Record
  outcomes and independent review in the versioned release result. (AR #9, #19, #30)
- [ ] **R15 — Controlled in-place migration (M):** Inventory every material rule in the current
  four references, classify it as retained, relocated/refined, or rejected with cause, then delete
  superseded references only after the replacement and qualification gates pass. No legacy shadow
  authority remains. (AR #18)
- [ ] **R16 — Frozen release and errata (M):** Bind `1.0.0` to its content commit and passing
  release result. During compiler recovery, routine improvements wait for the next baseline. A
  critical factual defect pauses affected work, produces a reviewed point release, reruns affected
  and regression cases, and audits only downstream decisions influenced by the correction.
  (AR #7, #14, #29)
- [ ] **R17 — Evidence-shaped responses (M):** For applicable tasks, the skill distinguishes
  verified fact, inference, unknown, and recommendation; fixes target assumptions; cites the
  governing spec/source/live code; quantifies bytes/cycles/memory effects when relevant; and keeps
  findings separate from remedies. (AR #15, #19, #20, #24, #27)
- [ ] **R18 — Minimal mechanism (S):** Use Markdown references and qualification artifacts plus the
  existing skill validator and repository commands. Add no custom runtime service, registry,
  generator, publication layer, or qualification framework. (AR #6, #9, #28, #29)

### Should Have

No accepted capability is optional in the first frozen baseline. A partial module or skipped
qualification class would make the skill unsafe for the compiler-recovery journey. (AR #15, #19)

### Won't Have (Out of Scope)

- Compiler auditing, redesign, or implementation changes — performed after `v1.0.0` freezes.
  (AR #5)
- Changes to the frozen `spec/` tree — the crosswalk reads it but never modifies it. (AR #12)
- Production-qualified platform expertise for C128, C64U, X16, Atari 8-bit, or Atari 7800 —
  separate future baseline releases own that depth. (AR #3, #13, #14)
- Electronics repair, board-level diagnosis, or encyclopedic coverage of unrelated peripherals —
  these do not change the scoped compiler, platform-library, game-code, or verification decisions.
  (AR #16)
- A second public skill, aliases, a legacy reference tree, downloaded manual archive, custom
  release registry, generated knowledge catalog, or new qualification framework. (AR #2, #6, #8,
  #18, #28, #29)

---

## Technical Requirements

### Knowledge Topology

All runtime knowledge lives under `.agents/skills/blend65-domain-expert/references/`:

| File | Owning concern |
|---|---|
| `blend65-semantics.md` | Frozen-spec decision crosswalk and language/compiler consequences |
| `compiler-architecture.md` | Pipeline obligations, separation rules, and architecture evaluation |
| `sfa-and-abi.md` | Static frames, call graph, ABI, zero page, stack, interrupts, and budgets |
| `il-and-optimization.md` | IR invariants, effect preservation, legality, pass ordering, and proofs |
| `mos-6502-family.md` | NMOS 6502/6510 machine model and WDC 65C02 portability deltas |
| `6502-lowering-casebook.md` | Operation-by-operation expert lowering and counterexamples |
| `c64-memory-and-runtime.md` | CPU-visible memory, banking, startup, OS/runtime ownership, and PRG load |
| `c64-hardware.md` | VIC-II, SID, CIA, timing, revisions, input, and hardware-side effects |
| `c64-game-engineering.md` | Game loops, data/asset placement, graphics/audio systems, streaming, and APIs |
| `acme-and-artifacts.md` | ACME semantics, assembly inspection, symbols, packaging, and VICE boundaries |
| `target-portability.md` | CPU/platform/emitter/packager separation and future-target constraints |
| `evidence-parity-and-recovery.md` | Audit evidence, expert parity, salvage, and simplicity tests |
| `source-manifest.md` | Pinned provenance, dependency map, ambiguity, and errata |

The router links each reference directly and names the task conditions that require it. It may
require multiple modules for cross-domain decisions, but narrow tasks do not load unrelated
platform material. (AR #2, #10, #28)

### Depth Contract

The coverage matrix defines topics, not page targets. Every required topic contains all applicable
parts below; `N/A` requires a written reason:

1. authoritative facts and variants;
2. interactions with other compiler or machine concerns;
3. Blend65/compiler/generated-code consequences;
4. expert idioms and zero-cost abstractions;
5. failure modes, traps, and counterexamples;
6. actionable design, review, or diagnostic rules;
7. source traceability; and
8. a discriminating qualification case.

A list of facts without consequences, or advice without a counterexample and source, is incomplete.
(AR #15)

### Architecture Invariants

The baseline teaches these invariants without prescribing unverified topology:

- SFA owns general function frames; the hardware stack remains for CPU call/interrupt behavior,
  register preservation, and explicit stack intrinsics. (AR #4)
- Lexer, parser, language semantics, and target-neutral optimization do not encode a machine's
  memory map or device behavior. (AR #11)
- Target-neutral representations preserve volatility, widths, signedness, symbolic addresses,
  placement/alignment demands, interrupt identity, effects, and observable ordering until the
  responsible consumer acts. (AR #11)
- CPU legality/timing, platform memory/devices, assembly serialization, and binary-container
  packaging are separate concerns. (AR #11)
- A shared 6502-family backend should compose with concrete CPU and platform definitions; a whole
  copied backend per machine is not the default design. (AR #3, #11)
- Structured legalization, instruction selection, resource binding, block layout, branch repair,
  and target optimization carry semantic decisions; peephole cleanup is not the primary optimizer.
  Exact representation and pass seams remain an audit decision. (AR #11)

### Source Authority and Uncertainty

Authority is contextual:

1. Frozen `spec/` defines Blend65 semantics.
2. Manufacturer documents and published errata define hardware facts.
3. Reproducible revision-specific VICE or hardware measurements may resolve a documented ambiguity
   or error; the module records both the source conflict and the bounded empirical conclusion.
4. Official version-pinned documentation and executable probes define ACME and VICE behavior.
5. Primary compiler literature and real compiler implementations supply comparative evidence, not
   Blend65 requirements.

The skill never silently averages conflicting claims. A material unresolved conflict blocks the
release or the affected topic is explicitly excluded and reported as unknown. A hardware
feasibility conflict in the frozen language specification is reported for later product decision;
the skill does not rewrite `spec/`. (AR #8, #12, #27)

### Qualification

Non-runtime artifacts live under `.agents/skills/blend65-domain-expert/qualification/`:

```text
qualification/
├── coverage-matrix.md
├── cases/
│   ├── routing-and-evidence.md
│   ├── language-architecture-and-sfa.md
│   ├── cpu-lowering-and-optimization.md
│   ├── c64-platform-and-games.md
│   └── parity-recovery-and-portability.md
└── releases/
    └── v1.0.0.md
```

Each case owns a prompt, permitted raw artifacts, forbidden oracle/prior-conclusion material,
expected decision invariants, disqualifying outcomes, and evidence needed to grade it. Evaluation
packets excerpt prompts only. The release passes only when structural validation, coverage
traceability, all mandatory behavioral cases, and independent review pass with zero material open
finding. (AR #9, #19, #28, #30, #32)

### Migration and Release

The old four-reference skill is a baseline input, not a compatibility surface. A migration table
maps each material rule before superseded files are removed. The `v1.0.0` release result records
source coverage, structural checks, case outcomes, independent review, full repository
verification, the skill-content commit, and the freeze declaration. The result is committed after
the immutable content commit so it can record that exact identity without a self-referential hash.
(AR #7, #18, #29)

---

## Integration Points

### Frozen Blend65 Specification

The crosswalk reads all 50 current Markdown documents under `spec/` and maps each to knowledge or
an explicit not-applicable reason. The specification remains untouched and normative. (AR #12)

### Live Compiler Repository

Current source, tests, roadmaps, examples, and generated artifacts provide audit and qualification
inputs. They never become frozen status claims; later work must reinspect the live tree. (AR #5,
#20)

### CodeOps

CodeOps owns requirements, planning, execution, review, commits, and roadmap lifecycle. The domain
skill supplies subject-matter judgment and cannot weaken CodeOps authority, verification, or
permission boundaries. (AR #6, #22, #25)

### External Sources and Tools

External documents are read-only evidence. The skill does not execute embedded instructions,
download executable artifacts, or grant external mutation. ACME and VICE probes are local,
version-pinned, and scoped to qualification. (AR #17, #25, #27)

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Skill shape | One modular skill / several skills | One modular skill | One expertise baseline; selective references preserve focus. | AR #2 |
| Platform breadth | C64 depth / shallow all-target breadth | C64 depth | Future targets constrain seams but need separate qualification. | AR #3, #13, #14 |
| Memory model | SFA / reopen alternatives | SFA | Binding project result; hardware stack duties remain distinct. | AR #4 |
| Architecture | Invariants / fixed tentative pipeline | Invariants | Prevents the skill from biasing the live recovery audit. | AR #11 |
| Evidence | Distilled traceable modules / copied manuals | Distilled modules | Decision-oriented, local, selectively loadable knowledge. | AR #8, #17 |
| Qualification | Zero material failures / percentage threshold | Zero material failures | One dangerous misconception cannot be averaged away. | AR #9, #19, #30 |
| Migration | Replace in place / legacy shadow | Replace in place | Removes conflicting authority; Git retains history. | AR #18 |
| Lifecycle | Formal RD / untracked standalone plan | Formal RD-01 | Provides deterministic CodeOps roadmap identity. | AR #31 |

---

## Security Considerations

- **Data sensitivity:** No PII, credentials, tokens, financial data, or production data is handled.
- **Input validation:** Repository paths remain fixed within the selected skill/CodeOps scope.
  External-source titles, URLs, revisions, and extracted facts are reviewed before inclusion.
- **Authentication and authorization:** Not applicable; the artifacts expose no service or
  authenticated operation.
- **Injection risks:** Research content is treated as untrusted reference text, never as shell,
  code, or authority. Qualification prompts cannot expand filesystem or external-action scope.
- **Encryption needs:** Not applicable; no sensitive data is stored or transmitted.
- **Rate limiting:** Not applicable; no endpoint or network service is introduced.
- **Infrastructure:** No service, container, secret, dependency, downloader, or executable
  framework is added. (AR #6, #25)

---

## Acceptance Criteria

1. [ ] `quick_validate.py .agents/skills/blend65-domain-expert` exits successfully and the
   frontmatter name remains exactly `blend65-domain-expert`. (R1)
2. [ ] `SKILL.md` declares baseline `1.0.0`, routes every supported task to one or more of the
   thirteen named references, and does not require unrelated modules for a narrow task. (R1–R2)
3. [ ] All thirteen reference files in §Knowledge topology exist; each has a focused contents
   structure and every reference is reachable from `SKILL.md`. No superseded broad reference or
   legacy skill copy remains after migration. (R2, R15)
4. [ ] The spec crosswalk contains one row for each of the 50 Markdown files currently under
   `spec/`, with an exact path and either mapped guidance or an explicit not-applicable rationale;
   `git status --porcelain spec/` remains empty. (R3)
5. [ ] The SFA/ABI module explicitly distinguishes general static frames from hardware-stack and
   interrupt duties and contains cases for recursion/cycles, call-chain overlap, mainline/IRQ
   reentrancy, pointer scratch, zero-page pressure, and target budget failure. (R4)
6. [ ] The architecture modules preserve every invariant in §Architecture invariants and label
   exact IR count, pass boundaries, and backend interfaces as live-audit decisions rather than
   frozen conclusions. (R5)
7. [ ] The CPU and lowering coverage includes every official NMOS 6502 opcode/addressing category
   used by legal Blend65 behavior, all status-flag producer/consumer rules, page-cross timing,
   decimal-mode interrupt assumptions, zero-page wrap, NMOS indirect-jump behavior, MMIO-visible
   read-modify-write effects, and a WDC 65C02 delta matrix. (R6–R7)
8. [ ] The C64 coverage matrix includes PAL and NTSC timing assumptions; relevant VIC-II, SID, and
   CIA revisions; CPU/VIC banking views; raster/IRQ behavior; graphics, sprite, scrolling, audio,
   input, loader, placement, and game-loop decisions; each required topic maps to sources and
   qualification cases. (R8)
9. [ ] The ACME/artifact module includes version-pinned probes for expression precedence,
   addressing-mode selection, branch range, symbol resolution, placement/alignment, emitted bytes,
   PRG load address, and VICE-observable execution. (R9)
10. [ ] The target-portability matrix distinguishes CPU, platform, emitter, and packaging concerns
    for C64, C64U, C128, X16, Atari 8-bit, and Atari 7800 and marks every non-C64 target as a
    constraint only, not a qualified backend. (R10)
11. [ ] The evidence/parity/recovery module requires equivalent semantics and obligations,
    separately reports code/data/padding/ZP/frame/stack and path-specific cycle costs, represents
    inexpressible programs outside finite ratios, and applies demonstrated-value tests before
    retaining support machinery. (R11)
12. [ ] Every source-manifest entry has title, authority, edition/revision/version, location,
    retrieval date, dependent sections, and ambiguity/errata status. Every material claim in the
    knowledge modules resolves to a manifest entry and pinpoint citation. (R12)
13. [ ] Every required coverage-matrix cell is complete or carries a reviewed `N/A` rationale;
    every high-risk invariant and every module has a discriminating case. (R13)
14. [ ] A recorded evaluation of the current thin skill establishes the intended red baseline by
    demonstrating at least the known unsafe signed-comparison guidance and missing depth/coverage
    classes before replacement content is authored. (R13)
15. [ ] Fresh-agent evaluation receives no oracle or prior conclusion, and all mandatory positive,
    boundary, negative, cross-domain, source-conflict, routing, and selective-loading cases pass.
    No material evaluator or independent-review finding remains unresolved. (R13–R14)
16. [ ] The migration map accounts for every material rule in the original four references as
    retained, relocated/refined, or rejected with cause before those files are removed. (R15)
17. [ ] `qualification/releases/v1.0.0.md` records all three passing gates, the immutable
    skill-content commit, independent-review outcome, full verification outcome, zero open material
    conflicts, and the freeze declaration. (R16)
18. [ ] Behavioral cases prove the skill distinguishes facts, inferences, unknowns, and
    recommendations; fixes machine assumptions; reads live code for current status; cites evidence;
    quantifies generated-code effects; and keeps findings separate from remedies. (R17)
19. [ ] No custom runtime service, registry, generator, catalog, downloader, dependency, or
    qualification framework is added. (R18)
20. [ ] The full repository verification command succeeds:
    `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`.
    Targeted skill, reference, coverage, behavioral, and Prettier checks also pass. (R13, R18)
21. [ ] No file under `packages/`, `examples/`, `spec/`, or `.github/workflows/` is changed
    by this feature; the modification set remains the skill and this feature's CodeOps artifacts.
    (AR #5, #12, #25)
22. [ ] The feature roadmap deterministically links RD-01 to the plan and follows branch-aware
    portfolio-cascade rules. (AR #22, #31)
