# Ambiguity Register: Blend65 Expert Skillset

> **Status**: ✅ GATE PASSED — all 34 items resolved
> **Last Updated**: 2026-09-04 21:28

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Scope | Which CodeOps feature owns the expert-skillset work? | New `blend65-expert-skillset` feature (recommended) / existing `asm-parity` feature | User chose the new `blend65-expert-skillset` feature. | ✅ Resolved |
| 2 | Technical | Is the deliverable one coherent expert skill with modular references, or several independently activated skills? | One `blend65-domain-expert` skill with deep modular references (recommended) / several top-level skills | User chose one public skill with modular references. | ✅ Resolved |
| 3 | Scope | How much platform expertise belongs in the first frozen baseline? | Deep C64 + NMOS 6502/6510 expertise with a concise cross-target constraint matrix (recommended) / equally deep coverage of every future platform now | User chose C64 as the implementation focus and later expansion to C64U, C128, X16, Atari 8-bit, and Atari 7800. | ✅ Resolved |
| 4 | Technical | Is SFA one candidate memory model or a binding compiler invariant? | Binding project axiom for general function frames (recommended) / reopen general frame allocation alternatives | User confirmed SFA as the sole general function-frame model, with final closure over function storage and an explicit boundary from platform/global/asset placement. | ✅ Resolved |
| 5 | Scope | Does this plan include recovery changes to the compiler implementation? | Skill creation and qualification only; compiler audit and redesign follow under the frozen skill (recommended) / mix skill and compiler changes | User explicitly chose skill creation first, followed by review and diagnosis of the current compiler. | ✅ Resolved |
| 6 | Integration | Is the deliverable a tool/framework or an expertise layer over CodeOps? | Instructions, directives, curated knowledge, and qualification evidence layered over CodeOps (recommended) / new orchestration framework | User explicitly defined the skillset as an expertise layer, not a tool or framework. | ✅ Resolved |
| 7 | Data & state | Once implementation begins, what does "do not change the skill mid-journey" permit when a substantive change is needed? | Freeze one active qualified version; bump, qualify, and atomically replace it before use | User later refined this to a version bump for every substantive skill change, one latest-qualified active version, and dependency-targeted impact review. | ✅ Resolved |
| 8 | Data & state | What evidence standard must the knowledge base use? | Distilled local guidance with claim-level primary-source citations and a pinned source manifest (recommended) / vendor complete manuals into the skill | User chose distilled, traceable guidance and clarified that copyright concern must not drive exclusion of publicly available legacy-system knowledge. | ✅ Resolved |
| 9 | Behavioral | What evidence is required before the skill baseline may be frozen and used for compiler recovery? | Structural validation + coverage traceability + isolated adversarial behavioral qualification against explicit expected decisions | User chose all three gates using committed Markdown oracles/results, ephemeral evaluator copies, separate graders, and no new framework. | ✅ Resolved |
| 10 | Scope | How should the deep knowledge be decomposed without recreating a monolith? | A short router plus focused reference modules spanning language, compiler architecture, SFA/ABI, IL/optimization, CPU, lowering, C64 systems, game engineering, toolchain, portability, and audit/parity (recommended) / retain the four broad references | User chose the focused 13-module knowledge map under one router. | ✅ Resolved |
| 11 | Technical | Should the skill freeze the tentative compiler pipeline as the required architecture? | Freeze only proven invariants and evaluation criteria; defer exact IL forms, pass count, and interfaces to the later evidence-backed redesign (recommended) / prescribe the tentative pipeline now | User chose the invariant-first policy; concrete topology remains a later audit/redesign decision. | ✅ Resolved |
| 12 | Integration | How should the skill incorporate the frozen Blend65 language specification without creating a competing specification? | Exhaustive decision-oriented crosswalk to reconciled authoritative `spec/`; independently resolve internal contradictions before affected oracles freeze | User chose the exhaustive crosswalk, bounded consistency prerequisite, and explicit product rulings; compiler behavior never supplies precedence. | ✅ Resolved |
| 13 | Scope | What 65C02 depth may the C64-first `v1.0` baseline claim? | Exact NMOS 6502/6510 expertise plus an authoritative 65C02 delta/portability matrix; defer production 65C02 codegen qualification to the first 65C02 target baseline (recommended) / claim equally deep production codegen expertise now | User chose production-depth NMOS 6502/6510 coverage and a portability-only 65C02 delta matrix. | ✅ Resolved |
| 14 | Data & state | How should later platform expertise be added without destabilizing an active compiler journey? | Extend the same skill only between journeys through a separately researched, qualified, versioned baseline release per platform (recommended) / create unrelated top-level skills or mutate the active baseline | User chose separately researched, qualified, and versioned platform extensions to the same skill between journeys. | ✅ Resolved |
| 15 | Non-functional | What proves that a knowledge module is deep enough? | Coverage contract per module: facts, interactions, compiler consequences, idioms, failure modes, decision rules, evidence, and qualification cases; no arbitrary word-count target (recommended) / minimum page or word count | User chose the coverage-based depth-completion contract with no word-count substitute. | ✅ Resolved |
| 16 | Scope | Which C64 subjects are required versus encyclopedic background? | Cover both PAL/NTSC; relevant VIC-II/SID/CIA revisions; memory/banking/startup/interrupts/timing; graphics, audio, input, loaders, placement, and representative game systems as compiler/API concerns; exclude electronics repair and unrelated peripheral encyclopedias (recommended) / attempt exhaustive C64 documentation | User accepted the compiler- and game-development-focused C64 boundary. | ✅ Resolved |
| 17 | Dependencies | Must the frozen skill require Internet access during compiler recovery? | Make essential decision knowledge self-contained locally; URLs remain trace/audit links and research is required only for a future baseline or critical erratum (recommended) / browse manuals during ordinary use | User chose a self-contained frozen baseline for ordinary compiler work. | ✅ Resolved |
| 18 | Data & state | How should the existing four-reference skill migrate to the new structure? | Pin/quarantine it as migration evidence, independently verify retained rules, pass an isolated Candidate Pre-delete Gate, then switch/delete coherently | User chose controlled in-place replacement with no legacy shadow authority. | ✅ Resolved |
| 19 | Behavioral | What is the behavioral qualification pass rule? | Independent review and corrections precede one definitive complete blind suite; all mandatory cases/cells pass with zero material failure | User chose the zero-tolerance material-correctness gate and final-candidate ordering. | ✅ Resolved |
| 20 | Integration | May mutable current-code observations become frozen domain knowledge? | No: keep durable expertise separate and require live code inspection; current code is evidence for plan/current-state and qualification scenarios only (recommended) / embed current file/line status as lasting skill facts | User chose live inspection over frozen current-code claims. | ✅ Resolved |
| 21 | Scope | Does this feature need a separate requirements-development cycle before planning? | Use this standalone plan's `01-requirements.md` as the owner because the conversation already supplies the requirements (recommended) / stop and create a separate RD set first | User chose the standalone plan requirements document. | ✅ Resolved |
| 22 | Integration | Should the new CodeOps feature receive its own roadmap? | Create a minimal per-feature roadmap and link/cascade it according to CodeOps rules (recommended) / leave the feature untracked | User chose a minimal feature roadmap integrated with the portfolio. | ✅ Resolved |
| 23 | Non-functional | Which verification checks govern implementation checkpoints? | Select by touched surface; complete relevant qualification at major completion | User superseded full-per-task verification: skill/Markdown work runs no compiler suite; later compiler work uses directed tests and broad runs only at affected integration boundaries. | ✅ Resolved |
| 24 | Stakeholder conflicts | Whose mental model judges source ergonomics and whose judges generated output? | Normal modern programmer for source; expert 6502/C64 game developer for output | User established the dual-audience contract and prohibited compiler-convenience/SFA restrictions unless explicitly approved and genuinely platform-forced. | ✅ Resolved |
| 25 | Security & compliance | May research documents or qualification prompts authorize code execution or external mutation? | No; sources are treated as untrusted reference material, and research/qualification stays read-only except for scoped repository artifacts (required scope boundary) | User authorized only skill and planning artifacts; compiler changes follow later. | ✅ Resolved |
| 26 | Naming & terminology | What are the durable public name, location, and invocation policy? | Preserve project-local `.agents/skills/blend65-domain-expert`, one public name, and normal automatic discovery (recommended) | User chose the existing single public skill and project-level CodeOps overlay. | ✅ Resolved |
| 27 | Edge cases | How are conflicts, omissions, or uncertainty across authoritative sources handled? | Record exact variants, apply authority order, use VICE for configured automation, and require targeted hardware evidence for physical/revision-sensitive disputes | User chose explicit bounds, release-blocking material conflicts, and `VICE-verified / hardware-unverified` where targeted QA remains. | ✅ Resolved |
| 28 | Naming & terminology | What exact file topology implements the chosen thirteen-module map and qualification separation? | Thirteen named references plus one coverage matrix, five case files, and one active `qualification/release.md` | User chose the fixed topology without ancillary framework or historical release files. | ✅ Resolved |
| 29 | Data & state | How is the frozen baseline identified without adding release-management machinery? | Declare one active semantic version in `SKILL.md`; bind it to the content commit in `qualification/release.md`; preserve history in Git | User chose one latest-qualified version, one active release record, and no registry/changelog system. | ✅ Resolved |
| 30 | Behavioral | How are qualification cases selected and isolated without an arbitrary quota? | Risk/depth-driven cases; authority-gated oracle freeze; ephemeral evaluator copies; separate grading | User chose coverage depth over a fixed count and strict evaluator/oracle/history separation. | ✅ Resolved |
| 31 | Integration | How can a standalone full plan be tracked in the requested CodeOps feature roadmap when the roadmap schema supports only RD, lightweight-task, and nested-deferral identities? | Add one formal `RD-01` as the lifecycle owner, then make the plan RD-based (recommended) / keep the standalone plan and omit its per-feature roadmap | User chose a single `RD-01` lifecycle owner and an RD-based plan. | ✅ Resolved |
| 32 | Naming & terminology | What exact concern partitions keep qualification cases bounded and evaluator oracles separated? | Five named case files for routing/evidence, language/architecture/SFA, CPU/lowering/optimization, C64/platform/games, and parity/recovery/portability (recommended) / one monolithic case file | User chose the five named concern partitions. | ✅ Resolved |
| 33 | Behavioral | Are C64 game-development techniques merely descriptive knowledge, or must the skill force their realization in the compiler? | Add a structured game-technique casebook inside the accepted references, mapping every technique to a deterministic compiler/API disposition and proof (recommended) / maintain a separate tricks skill or optimizer framework | User chose the structured casebook within the single skill. The skill guides development; the shipped compiler must encode deterministic mechanisms and must not depend on AI or skill prose at compile time. | ✅ Resolved |
| 34 | Scope | Should The Last Ninja's Integrator approach remain implicit in general asset coverage or become an explicit skill qualification scenario? | Strengthen existing Q-P15 with an Integrator-style compile-time scene/asset workflow (recommended) / leave it implicit or add a separate tool/framework | User explicitly requested the Q-P15 refinement. It remains one case within the existing game/asset knowledge and adds no tool or framework. | ✅ Resolved |

## Controlling Preflight Refinements

The table above preserves creation-time decisions. The accepted preflight rulings in
`00-preflight-report.md` are later and control where they refine an earlier entry:

| Concern | Controlling refinement |
|---|---|
| Semantic authority | PF-001: unaffected work proceeds, but an independent spec-consistency prerequisite and explicit product rulings precede final semantic qualification; compiler behavior is never authority. |
| Oracle order and blindness | PF-002/PF-003: external-fact oracles freeze after Phase-2 source pinning; evaluators use ephemeral allowlisted copies and separate graders. |
| Focused/final evaluation | PF-004/PF-005: early runs grade content only; independent review/corrections precede the one definitive complete suite. |
| Emulator/hardware evidence | PF-006: VICE 3.10 is the automated runtime oracle; targeted hardware QA settles physical/revision-sensitive claims and provisional status is labelled. |
| Legacy migration | PF-007/PF-008: pin/quarantine the legacy tree, independently verify migrated rules, pass an isolated Candidate Pre-delete Gate, then switch/delete atomically before formal live gates. |
| Freeze boundary | PF-009: oracle fields freeze at authority gates; result fields are append-only through final evaluation, freeze before the Candidate Pre-delete Gate, and are only verified afterward; only `qualification/release.md` plus roadmaps change after the content checkpoint. |
| Verification | PF-010: retain 60 detailed substeps under seven executable phases; checks are impact-based and the compiler suite does not run for skill/Markdown-only changes. |
| Feasibility snapshot | PF-011: the optional game-feasibility matrix/page is non-authoritative, removable, and absent from skill/audit dependencies. |
| Versioning and lineage | PF-012/PF-013: one latest-qualified active version, one `qualification/release.md`, semantic-version bump for every substantive change, and commit/heading/source lineage for downstream decisions. |
| SFA and modern source | PF-014/PF-015: SFA closes all function-execution storage but not global/asset/platform placement; ordinary modern source cannot be restricted for compiler convenience. |
| Semantic and optimization depth | PF-016/PF-017: add interaction cases and require independent behavior plus assembly/cost expectations for every optimization. |
| Baseline and validation details | PF-018/PF-019: include Q-R12 in the red subset and describe `quick_validate.py` narrowly. |
| Data placement and replication | PF-020: placement remains the default; identical data may be replicated only at compile time when hardware visibility or measured timing requires it, alternatives cannot meet the need, and the consumer, constraint, bytes, and timing benefit are recorded. Buffers with different evolving states are not duplication. |
| Technique realization | AR-33: C64 game techniques are mapped to concrete compiler treatments and independent proof. Safe transformations may be automatic; context-sensitive or risky techniques require costs, zero-cost APIs, local contracts, or diagnostics. |
| Technique qualification | PF-021: Q-P11/Q-P15/Q-P16 each prove one representative audio, loader/asset, or engine-structure realization end to end without adding cases. |
| Oracle integrity | PF-022: independent source-to-oracle review precedes external-oracle freeze; a later proven factual defect reopens only the affected gate and invalidates its dependents. |
| Future-target case ordering | PF-023: Q-A17 has an explicit Phase-6 portability-content facet and Phase-7 version/release integration facet; the definitive suite grades their union once. |
| Integrator-style workflow | AR-34: Q-P15 explicitly covers reusable element/panel composition, masks/foreground priority, attribute conflicts, memory-versus-draw-speed choices, emitted layout, and runtime rendering contracts. |

### Resolution Notes

**AR-1:** The skillset is a prerequisite and governance capability for compiler recovery, not an asm-parity implementation slice. It receives its own feature lifecycle and plan.

**AR-2:** One public router preserves a single versioned expertise baseline and prevents partial activation; modular reference documents keep the knowledge maintainable and selectively loadable.

**AR-3:** Future machines constrain seam design but do not receive superficial pseudo-expertise in this baseline. Their own deep platform modules are later, separately qualified additions.

**AR-4:** SFA governs all function-execution storage and reaches a final closure over parameters,
returns, locals, temporaries, spills, and function/helper scratch. The 6502 hardware stack remains
available for `JSR`/`RTS`, interrupt state, register preservation, and explicit stack operations;
that does not reopen general dynamic frames. Global data, assets, platform alignment/banking,
segments, loaders, and artifact placement stay outside SFA.

**AR-5:** Current compiler files may be read as evidence while authoring and qualifying the skill, but this plan will not repair or redesign compiler implementation.

**AR-6:** The implementation must prefer small Markdown knowledge modules and validation artifacts over new runtime services, orchestration layers, or generalized support infrastructure.

**AR-7:** Freeze v1.0.0 when compiler recovery starts. Any substantive later skill change—not only
a critical erratum—bumps the single active version by at least a patch, qualifies before atomic
activation, and triggers review only for decisions/artifacts dependent on changed rules. Release
bookkeeping that binds an already-qualified commit is not a substantive change.

**AR-8:** The knowledge modules distill actionable rules and attach claim-level citations to a source manifest pinned by title, edition/revision, URL, retrieval date, and dependent section. Publicly available full manuals remain valid source material, and exact tables may be reproduced locally when useful. Whole-manual embedding is rejected for retrieval noise and poor selective loading, not as a copyright-driven restriction.

**AR-9:** The frozen release must pass all three gates. Qualification uses committed Markdown cases
and result records rather than a new framework. Fresh evaluators operate from an ephemeral
allowlisted copy without expected answers, qualification files, author history, or prior results;
separate graders receive the oracle and captured output.

**AR-10:** The router will dispatch to thirteen focused modules: Blend65 semantics/spec crosswalk; compiler architecture; SFA/ABI; IL/optimization; MOS 6502 family; lowering casebook; C64 memory/runtime; C64 hardware; C64 game engineering; ACME/artifacts; target portability; evidence/parity/recovery; and the pinned source manifest.

**AR-11:** Skill doctrine fixes only proven constraints: SFA; C64-first delivery; target-neutral language semantics and front-end reasoning; preservation of volatility, widths, signedness, symbolic addresses, placement, interrupt identity, effects, and observable ordering; and explicit CPU/platform/assembler/artifact separation. The later audit owns concrete IR levels, pass boundaries, backend interfaces, and data structures.

**AR-12:** The crosswalk covers all relevant chapters, evaluations, appendices, grammar, migration
decisions, and future considerations. It summarizes compiler consequences and traps, but final
semantic qualification requires a reconciled frozen specification: duplicate assignments and
direct cross-chapter contradictions receive independent audit and explicit product rulings first.

**AR-13:** C64 code executes on the NMOS 6510 and receives complete instruction, flag, timing, addressing, stack, interrupt, and silicon-hazard treatment. The WDC 65C02 is covered as a precise architectural delta for X16 portability, but no 65C02 target behavior is implemented or qualified in this plan.

**AR-14:** Later platforms extend the same public skill only between target journeys. Each platform addition gets its own authoritative research, focused modules, cross-module integration review, adversarial cases, and newly frozen versioned baseline before target work begins.

**AR-15:** Every required coverage cell must supply authoritative facts and variants, cross-domain interactions, Blend65/compiler consequences, expert idioms, failure modes and counterexamples, actionable decision rules, evidence, and a discriminating qualification case. Length is neither a proxy nor a target.

**AR-16:** Cover both PAL and NTSC; relevant VIC-II, SID, and CIA variants; memory and banking; startup and runtime ownership; interrupts and raster timing; graphics, audio, input, loaders, placement, and representative game-system patterns when they affect language, compiler, platform-library, emitted-code, or verification decisions. Exclude electronics repair and unrelated peripheral encyclopedias.

**AR-17:** Essential decision knowledge is local and usable offline. External URLs remain provenance and audit links. Live research is reserved for preparing a future baseline or resolving a critical erratum.

**AR-18:** Pin and quarantine the current four broad references as read-only migration evidence.
Each rule migrates only after independent verification. An isolated complete candidate must pass
the exact pre-delete gate; then replace the live router and delete the legacy files coherently
before formal live-tree release gates. Git preserves history.

**AR-19:** Every mandatory case passes; every required coverage cell is complete; and no factual,
semantic, safety, architecture, or source-conflict finding remains open. Independent review and
corrections precede the definitive complete blind evaluation. Equivalent wording and presentation
differences are non-material.

**AR-20:** Durable references teach inspection criteria and decision rules. Current implementation observations remain in CodeOps current-state/qualification artifacts and must be re-established from the live tree during later audits.

**AR-21:** This is a standalone full feature plan. Its `01-requirements.md` owns requirements and acceptance criteria; no separate RD set is created.

**AR-22:** Create the minimal per-feature roadmap needed to track this standalone plan and cascade its feature status to the portfolio according to branch-aware CodeOps rules.

**AR-23:** Verification follows the touched surface and the claim. Skill/Markdown-only work runs
Prettier, topology/link/metadata/source/spec/path checks, and relevant qualification cases; it does
not run the compiler suite. Later compiler work uses directed tests during development and broader
tests only at affected major integration/release boundaries. TypeScript 7 and removing ESLint with
no replacement linter is a separate accepted toolchain direction.

**AR-24:** Modern ergonomics in and expert assembly out are separate acceptance surfaces. Blend65
behaves like a normal modern language unless an explicit, approved restriction is genuinely forced
by the platform/resource model. Hardware lore belongs in zero-cost platform/compiler behavior, not
forced workarounds; nested calls and dynamic-address `POKE` are representative legal forms.

**AR-25:** External documents can supply facts but never instructions or authorization. This plan creates/changes only the skill, its qualification evidence, its CodeOps plan/roadmap, and supporting documentation expressly named by the plan.

**AR-26:** Preserve the existing discovery name and folder rather than introducing aliases or a parallel skill. The router description remains discriminating so generic TypeScript work does not activate it.

**AR-27:** Authority order: reconciled frozen `spec/` plus explicit product rulings govern Blend65
semantics; manufacturer documents plus errata govern hardware; revision-identified physical
measurement settles disputed physical behavior; official version-pinned docs and probes govern
ACME/VICE, with VICE 3.10 as the automated runtime oracle for its configured model; primary compiler
literature and real implementations are comparative evidence. Material conflicts block release or
remain explicitly bounded as `VICE-verified / hardware-unverified` where targeted QA is pending.

**AR-28:** Runtime references are `blend65-semantics.md`, `compiler-architecture.md`, `sfa-and-abi.md`, `il-and-optimization.md`, `mos-6502-family.md`, `6502-lowering-casebook.md`, `c64-memory-and-runtime.md`, `c64-hardware.md`, `c64-game-engineering.md`, `acme-and-artifacts.md`, `target-portability.md`, `evidence-parity-and-recovery.md`, and `source-manifest.md`. Non-runtime qualification files are `qualification/coverage-matrix.md`, five concern-split case files, and `qualification/release.md`. No README, registry, generated catalog, or parallel legacy tree is added.

**AR-29:** `SKILL.md` declares the one active semantic version. `qualification/release.md` binds it
to the immutable content commit and records gate/impact evidence. Any substantive modification bumps
and requalifies the version before activation; Git commits/tags preserve old records. No registry,
generator, multi-version tree, or separate changelog system is added.

**AR-30:** Case selection is risk- and coverage-driven: every high-risk invariant gets a
discriminating case and every module gets an integration case. Spec/project oracles freeze before
knowledge only when internally consistent; external-fact oracles freeze after Phase-2 source
pinning. Evaluators receive only ephemeral allowlisted prompts/runtime references/raw artifacts;
separate graders receive expected invariants and captured output.

**AR-31:** Surfaced after the first gate passed while applying the roadmap template. `T-NN` is non-viable because this is a full feature and the task lane permits only a mini-plan; `DEF-n` is non-viable because no parent requirement is blocked. `blend65-expert-skillset/RD-01` is the lifecycle owner. AR-21 is superseded: the RD becomes the requirements authority and `01-requirements.md` becomes the required thin delta view.

**AR-32:** Qualification cases live in `qualification/cases/routing-and-evidence.md`,
`language-architecture-and-sfa.md`, `cpu-lowering-and-optimization.md`,
`c64-platform-and-games.md`, and `parity-recovery-and-portability.md`. This keeps evaluator
packets bounded while preserving cross-domain cases inside the concern that owns the expected
decision.

**AR-33:** The skill is development-time expertise, not part of the released compiler. Each
game-technique entry must identify recognizable source/IL/target facts, preconditions, full costs,
hazards, and one compiler disposition: automatic semantics-preserving optimization, cost-guided
selection, zero-cost platform API or specialized lowering, explicit local opt-in contract, or a
diagnostic when safety cannot be proved. Later compiler audit/redesign chooses the smallest actual
implementation seam; it must encode the result as deterministic algorithms, tables, target facts,
or APIs and prove behavior independently from assembly/cost. No natural-language inference,
separate tricks skill, generic game-optimization flag, service, framework, or new runtime layer is
added.

**AR-34:** Integrator is treated as a historically grounded cross-development asset/scene workflow,
not as a magic optimizer rewrite or a mandate to reproduce a particular editor. Existing Q-P15 and
the loading/assets family must require reusable graphical elements/panels, compile-time scene
composition, foreground/occlusion masks, draw priority, multicolor attribute-conflict handling,
precomputed rendering data, explicit memory-versus-draw/mask-speed accounting, emitted C64 asset
layout, and the runtime renderer contract. Original-author/practitioner evidence establishes the
workflow; hardware claims follow the normal C64 authority hierarchy. No additional case, runtime
artifact, tool, or framework is added.
