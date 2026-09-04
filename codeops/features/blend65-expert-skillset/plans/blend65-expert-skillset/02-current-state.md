# Current State: Blend65 Expert Skillset

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> **Observed**: 2026-09-04 on `feature/domain-expert-skill`

## Headline

The current skill is a useful routing prototype, not a safe frozen expertise baseline. It passes
the structural validator and expresses the project's stance, but only four broad references carry
all compiler, CPU, C64, and recovery knowledge. Their combined size is 555 lines (665 including
`SKILL.md`), citations are sparse, there is no pinned source manifest or coverage traceability,
and there are no adversarial behavioral qualifications. One high-risk rule is already unsafe:
`mos-6502-codegen.md:54` says signed comparisons require `N xor V`, but does not state that `CMP`
does not produce `V`; following it can consume a stale overflow flag.

The compiler repository also contains enough mixed maturity to make a frozen “current
architecture” narrative dangerous. The skill must teach how to inspect and decide, while the later
recovery audit re-establishes every status claim from the live tree.

## Existing Skill Inventory

| Artifact | Current role | Evidence | Gap to RD-01 |
|---|---|---|---|
| `SKILL.md` | Correct public identity, stance, four-way router, review sequence | `.agents/skills/blend65-domain-expert/SKILL.md:1` | No version, authority hierarchy, exact thirteen-module routing, freeze/errata contract, or selective-loading qualification |
| `compiler-engineering.md` | Broad pipeline/SFA/IL/optimizer reminders | `references/compiler-engineering.md:1` | No exhaustive spec crosswalk, deep SFA case model, interface criteria, or sources per material claim |
| `mos-6502-codegen.md` | Cost landmarks and lowering reminders | `references/mos-6502-codegen.md:1` | No complete opcode/effect model, weak silicon/revision treatment, incomplete lowering inventory, unsafe signed-comparison wording |
| `c64-game-systems.md` | Banking/chip/game overview | `references/c64-game-systems.md:1` | No PAL/NTSC/revision matrix, detailed side-effect model, game-system decision tables, or claim-level traceability |
| `evidence-and-parity.md` | Audit and parity outline | `references/evidence-and-parity.md:1` | No frozen response contract, source-conflict protocol, coverage map, independent cases, or release binding |
| `agents/openai.yaml` | UI/discovery metadata | `.agents/skills/blend65-domain-expert/agents/openai.yaml:1` | Must remain synchronized with final router without expanding public identities |

### Structural Baseline

- `python3 /home/gevik/.codex/skills/.system/skill-creator/scripts/quick_validate.py
  .agents/skills/blend65-domain-expert` currently passes.
- That validator checks `SKILL.md` presence, YAML frontmatter/name/description constraints, basic
  body content, and unfinished scaffold markers. It does not traverse reference links, validate
  `agents/openai.yaml`, check tree topology, or prove correctness, source quality, coverage,
  routing discrimination, or decision behavior.
- There is no `qualification/` directory and no source manifest today.

## Live Compiler Evidence Relevant to Skill Design

These observations justify realistic prompts for later auditing; they are never authority for
knowledge rules, qualification expectations, or what the recovery architecture must become. If a
live behavior conflicts with the specification, SFA doctrine, or primary target evidence, record it
for the later compiler audit rather than adapting the skill to it.

| Observation | Current evidence | Why the skill must cover it |
|---|---|---|
| Frontend is followed by SFA, IL lowering, two fixed IL passes, instruction assembly, optional instruction peepholes, branch relaxation, and ACME serialization. | `packages/compiler/src/api/emit.ts:98`, `packages/compiler/src/api/emit.ts:146` | The audit needs pass-obligation and evidence rules, but must not canonize this exact topology. |
| Semantic analysis receives both an interim default semantics profile and the plugin profile; SFA still consumes the default profile. | `packages/compiler/src/api/run-frontend.ts:171`, `packages/compiler/src/api/run-frontend.ts:185` | Target-neutral/target-dependent ownership and profile migration require scrutiny. |
| SFA already computes frames, an interference graph, coloring, RAM placement, ZP pressure, pointer aliases, and IRQ scratch separation. | `packages/frontend/src/sfa/plan-allocation.ts:99` | “SFA exists” is not enough; expert review needs lifetimes, concurrency, ABI, budget, and failure cases. |
| Canonical platform data includes CPU, address ranges, budgets, output format, encoding, and timing metadata. | `packages/core/src/platform/platform-profile.ts:36` | The later architecture should preserve data-driven target distinctions without assuming these fields are sufficient. |
| The platform plugin mixes profile data with preamble, startup, encoding, output-directive, and runtime-module hooks. | `packages/core/src/platform/platform-plugin.ts:95` | The skill must distinguish CPU, platform, emitter, and packager concerns before recommending seams. |
| C64 declares NMOS 6502, PRG output, C64 memory budgets, PETSCII, and PAL-oriented timing metadata. | `packages/platforms/src/c64.ts:36` | C64 knowledge must test assumptions against model/revision and runtime banking rather than accept constants blindly. |
| Atari/X16 plugins openly delegate major hooks to C64-style implementations. | `packages/platforms/src/a800xl.ts:1`, `packages/platforms/src/a7800.ts:1`, `packages/platforms/src/cx16.ts:1` | Existing non-C64 rows are scaffolding evidence, not proof of qualified target backends. |
| The parity corpus records structural, data-placement, instruction-selection, and ceremony gaps in generated code. | `packages/test-harness/test/golden/SCOREBOARD.md:47` | The skill needs equivalent-work costing and a principled salvage/anti-overengineering method. |

## Local Toolchain Baseline

| Tool | Observed version | Qualification use | Boundary |
|---|---|---|---|
| ACME | 0.97 “Zem” (2020-06-28; official SVN r266) | Pin syntax/encoding/artifact behavior from official documentation/source and specify later byte-level proofs | Version-specific claims are not generalized silently; ACME is not executed in this skill plan. |
| VICE `x64sc` | 3.10 | Define the later automated runtime-oracle contract for the declared model/configuration | VICE is not executed in this skill plan; physical or revision-sensitive claims still require targeted real-hardware QA. |
| Node/Yarn/Turbo/Vitest | Repository-pinned | Repository context only | Compiler builds and test suites are outside this skill/Markdown plan. |
| Skill validator | Existing `quick_validate.py` | Basic `SKILL.md` frontmatter/name/description/body checks | Topology, links, metadata, sources, coverage, routing, and expertise need separate checks. |

## Primary Evidence Baseline

Research found viable primary/authoritative source families for the release:

| Concern | Baseline authority | Planned use |
|---|---|---|
| NMOS 6502 | MOS MCS6500 Programming Manual and Hardware Manual | Instructions, addressing, registers, cycles, bus behavior, interrupts, stack, and documented assumptions |
| WDC 65C02 delta | WDC W65C02S datasheet | Explicit CMOS instruction/behavior delta and portability constraints |
| C64 platform | Commodore 64 Programmer's Reference Guide, Commodore service/schematic material, original chip documentation where available | Memory map, 6510 port, VIC-II/SID/CIA programming model, startup, and revision-aware constraints |
| Compiler architecture | LLVM code-generator documentation and llvm-mos implementation/SDK | Comparative legalization/selection/allocation/emission patterns and whole-program static-stack evidence; never Blend65 authority |
| Assembler/emulator | ACME official repository/release docs and VICE 3.10 manual/source | Version-specific syntax, output, monitor, timing, and executable proof specifications for later work |

The source manifest must pin exact editions, revisions, URLs or repository commits, retrieval date,
dependent knowledge sections, and known conflicts. Secondary sources may help locate ambiguities,
but cannot silently outrank the hierarchy in RD-01.

## Demonstrated Gaps

| Gap | Impact if left unresolved | Required plan response |
|---|---|---|
| Structural validation is mistaken for expertise validation | A polished but wrong answer can freeze into the recovery baseline. | Three gates: structure, coverage traceability, adversarial behavior. |
| Broad references mix unrelated concerns | Narrow tasks either under-load needed knowledge or load a monolith. | Exactly thirteen focused modules with explicit multi-module routes. |
| No exhaustive language crosswalk | The skill can invent or miss semantics. | Set-equal crosswalk over all 50 frozen Markdown spec files. |
| SFA is mentioned, not fully operationalized | Recovery could reopen impossible frame strategies or miss reentrancy/IRQ hazards. | Deep SFA/ABI doctrine and adversarial call-graph/budget cases. |
| CPU flags and effects lack producer/consumer rigor | Signed compares, carry chains, decimal state, and MMIO can miscompile. | Complete effect tables plus counterexample-driven lowering cases. |
| C64 coverage is overview-level | Banking, badlines, chip revisions, timing, and APIs may be judged incorrectly. | Revision/timing matrices and cross-domain game cases. |
| Sources are sparse and unpinned | Facts cannot be audited or reproduced. | Claim-linked source manifest and conflict policy. |
| No behavioral qualification | Router quality and judgment depth are unproven. | Immutable case packets, current red baseline, blind green runs, independent review. |
| No frozen version identity | Mid-recovery edits could invalidate earlier decisions. | Content commit + release-result binding + controlled errata protocol. |

## Overengineering Risks and Controls

| Temptation | Why it is rejected | Smaller accepted mechanism |
|---|---|---|
| Build a knowledge database/search service | No runtime consumer requires it; it creates another system to maintain. | Focused Markdown references loaded by the existing skill router. |
| Download and vendor every manual | It increases retrieval noise and does not produce decision guidance. | Distilled local rules with exact citations and selected tables only where operationally valuable. |
| Create a qualification runner/framework | Seven Markdown artifacts and existing agent/repo commands are sufficient. | Human/agent-executable case packets with recorded evidence. |
| Freeze an ideal backend class hierarchy | The current implementation still needs diagnosis; premature topology would bias it. | Freeze durable responsibilities and invariants; decide interfaces during live recovery. |
| Shallowly cover every future target | It would advertise competence the baseline cannot prove. | C64 production depth plus explicit constraint-only portability rows. |

## Readiness to Plan

The repository has a requirements checkpoint at commit `8fa69c1`, the exact artifact topology is
fixed, and required local tools are present. A bounded specification-consistency prerequisite is
now known: duplicate diagnostic assignments and direct cross-chapter contradictions must receive
independent audit and explicit product rulings before final semantic qualification. Unaffected
skill work may proceed, and the current compiler cannot resolve that prerequisite. Any newly
discovered product ambiguity still enters the Ambiguity Register before the affected work resumes.
