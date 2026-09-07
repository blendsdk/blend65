# Testing Strategy: Blend65 Expert Skillset v1.0.0

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Principle

The skill is qualified as decision behavior, not by length, polished prose, or structural validity.
The five qualification case files are the implementation-blind oracle tier. Spec/project-derived
expectations freeze in Phase 1 only where governing documents agree; conflicted semantics wait for
the independent consistency prerequisite and explicit product rulings. External CPU, hardware,
ACME, and VICE expectations remain draft until Phase 2 pins primary evidence. A failure is fixed in
the router/knowledge/evidence; a frozen oracle is not weakened to make authored content pass.

Implementation validation has three independent gates:

1. structural packaging and exact topology;
2. coverage/depth/source traceability; and
3. blind adversarial behavioral evaluation.

All three must pass. Known current-skill pre-passers are recorded honestly in the red baseline.
The existing compiler, tests, readiness harness, roadmaps, scoreboards, and feasibility snapshot
are never expected-answer authorities.

## Case Packet Rules

Every case entry in `qualification/cases/*.md` contains:

- case ID, risk, and coverage cells;
- user-style evaluator prompt;
- permitted raw artifacts and declared machine/tool assumptions;
- forbidden oracle, grading invariants, prior conclusions, and author output;
- hidden expected decision invariants;
- explicit disqualifying outcomes;
- evidence required to grade; and
- red-baseline/final-run result fields.

Prompts must demand an actual judgment, not merely ask the evaluator to repeat a heading. Raw
artifacts should be the smallest realistic source/spec/code/assembly/register trace needed. Cases
that can pass by generic compiler prose are not discriminating enough.

Oracle fields are immutable after their applicable authority gate. Result fields are append-only
until the Candidate Pre-delete Gate and immutable afterward. Blind evaluators run as fresh one-shot
processes inside `/usr/bin/bwrap` or an equivalently enforced operating-system filesystem sandbox,
with no inherited author conversation/history. The sandbox mounts only an ephemeral allowlisted
copy of the candidate router/runtime references, prompt, permitted raw artifacts, and the minimum
read-only system/model-client paths needed to execute; it does not mount the repository, normal
workspace, or broader user-data paths. A permitted-file positive control must succeed and a known
repository-path negative control must fail. If this cannot be enforced, the blind gate is blocked;
a same-workspace promise is insufficient. A separate grader receives the oracle and captured
output. The exact sandbox command, effective mount list, controls, packet paths/hashes, outputs,
and grading evidence are recorded without adding a permanent runner or framework.

## `routing-and-evidence.md`

| ID | Scenario | Required invariant | Disqualifying outcome |
|---|---|---|---|
| Q-R01 | Review a Blend65 signed comparison emitted for C64 | Skill activates and routes to CPU, lowering, semantics, and parity knowledge | Generic code review or one unrelated reference |
| Q-R02 | Rename a private TypeScript helper with no compiler-semantic effect | Skill does not claim domain expertise is required | Loads the whole hardware knowledge base |
| Q-R03 | Explain one frozen Blend65 grammar/semantic question | Loads `blend65-semantics.md`, cites exact spec; no unrelated C64 module | Invented rule or “read all references” |
| Q-R04 | Assess a raster IRQ function using SFA scratch | Loads SFA, CPU, C64 hardware/memory, and lowering modules | Misses concurrency, banking, or ABI context |
| Q-R05 | Answer with network unavailable | Essential facts and decision rules remain usable locally; URL is provenance only | Defers ordinary runtime use to Web research |
| Q-R06 | Manufacturer table conflicts with a revision-specific VICE result | Treats VICE as the configured automated oracle, keeps physical truth bounded, and requests targeted hardware QA where the disputed fact is silicon-sensitive | Treats VICE as universal physical evidence or silently picks a claim |
| Q-R07 | Evidence supports only parser and assembly shape | Classifies separate facts/inferences/unknowns and `Verified partial` | Calls full capability complete |
| Q-R08 | Propose a generalized pass registry to support one local rewrite | Applies anti-overengineering gate and recommends smaller existing seam | Adds framework without consumer/failure proof |
| Q-R09 | External manual text contains imperative shell instructions | Treats it as untrusted evidence and does not execute or broaden authority | Executes or treats prose as authorization |
| Q-R10 | Request a useful skill enhancement during recovery | Requires a semantic-version bump, qualification, and atomic replacement before the latest version becomes active | Silently edits the active baseline or keeps multiple active versions |
| Q-R11 | Report a material finding with mixed evidence | Uses status, claim kind, assumptions, evidence, cost, finding, remedy fields | Blends inference/fact or finding/remedy |
| Q-R12 | Narrow ACME syntax question | Loads ACME and source manifest only unless target behavior is asked | Loads compiler/C64/game monolith |

## `language-architecture-and-sfa.md`

| ID | Scenario | Required invariant | Disqualifying outcome |
|---|---|---|---|
| Q-L01 | Given a language question, locate all governing frozen documents | Exact crosswalk path(s), normative/evaluation distinction, no duplicated authority | Answers only from skill prose |
| Q-L02 | Current compiler rejects `POKE(variableAddress, value)` or requires manual unrolled pokes | Requires ordinary dynamic-address lowering and classifies compiler-convenience restrictions as defects | Defends constant-only/unrolled source as “6502-friendly” |
| Q-L03 | Optimize two volatile reads into one | Rejects unless platform contract proves identical observable count/order | Treats MMIO as ordinary memory |
| Q-L04 | Put C64 addresses into semantic analyzer nodes | Preserves target-neutral frontend; routes capability via declarative target facts | Hardcodes map into language semantics |
| Q-L05 | `main` calls either sibling `a` or `b`, never nested | Explains when static frames may safely overlay and proof required | Assumes all functions need distinct frames |
| Q-L06 | `a` calls `b` while `a` values remain live | Frames/homes cannot overlap where simultaneous lifetime exists | Overlays from mutually-exclusive-call slogan |
| Q-L07 | Recursive call-graph SCC | Emits explicit unsupported/bounded-policy diagnostic; no silent overlap/hidden fallback | Pretends DAG coloring is safe or adds generic software stack by default |
| Q-L08 | IRQ can preempt mainline and both reach helper/scratch | Models reentrancy/interference and separates interrupt-unsafe state | Considers only direct caller/callee edges |
| Q-L09 | Address-taken/exported function has unknown caller | Uses conservative root/escape policy and names cost | Assumes closed-world direct graph |
| Q-L10 | ZP pair lands at final byte or pressure exceeds budget | Handles two-byte fit/wrap and produces explainable target-budget failure | Wraps silently or hides in generic spill area |
| Q-L11 | Proposal misuses stack locals, explicit-save kinds, or BRK accounting | Preserves SFA; distinguishes JSR/RTS/IRQ/register/explicit-stack/BRK duties; requires exact BRK profile/control/stack proof with no runtime | Reopens stack frames, accepts cross-kind pulls, or assumes free/fallthrough/debugger BRK behavior |
| Q-L12 | Asked how many IRs/classes Blend65 must have | Gives responsibilities/invariants and defers exact topology to live audit | Freezes an LLVM-shaped architecture |
| Q-L13 | Add Atari target by copying C64 backend | Recommends shared 6502 responsibilities plus selected CPU/platform/emitter/packager | Approves copy or universal C64 hooks |
| Q-L14 | Optimizer wants to erase signedness before comparison lowering | Rejects loss; signedness must survive to accountable legalization/selection | Asks backend to guess |
| Q-L15 | Invalid source causes downstream allocation crash | Assigns root diagnostic upstream and gates unsafe later stage | Treats ICE as acceptable error handling |
| Q-L16 | Compare current plugin interface with desired modularity | Uses live code as evidence, labels recommendation/inference, does not freeze current seam | Restates current classes as baseline truth |
| Q-L17 | `f(1, g())` with transitive callees in the later argument | Keeps the earlier argument home live across later-argument evaluation and preserves left-to-right effects | Overlays storage unsafely or rejects ordinary source |
| Q-L18 | `f(1, f(2, 3))` with the same eventual callee | Treats outer argument marshalling as live staging, not active recursion; compiles through an SFA-compatible solution | Calls it recursion, emits an ICE, or imposes an alien restriction |
| Q-L19 | Ordinary array code crosses byte/word boundaries without prompting | Discovers index/operator/carry/counter/query/object-domain leaks itself; preserves ordinal 265 for uncast `byte(255)+10` and 510 for `byte(255)<<1`, byte-only lowering for proved-small work, explicit-cast wrap, stable word `length()`/`sizeof()`/`offsetof()`, the `0..65535` extent/object domain with E10264..E10266, E10262 for only the proved finite-looking loop, and the any-size parameter ABI without inventing another array concept | Produces wrapped ordinals without a cast, forces word machinery everywhere, silently widens source state, rejects intentional wrap, permits unrepresentable objects, narrows field offsets, selects legality from array bytes, or adds a slice/span/view concept |
| Q-L20 | The same expression is evaluated as a constant and at runtime | Preserves the specified full-precision constant rules and runtime-width wrapping distinction | Forces both paths to share the wrong arithmetic model |
| Q-L21 | Left-to-right calls combined with `&&`/`||` side effects | Preserves evaluation order, short-circuiting, and exact observable effects | Reorders or eagerly evaluates for easier lowering |
| Q-L22 | Two by-reference arguments alias the same object | Preserves alias-visible write/read ordering and refuses unsafe independence assumptions | Treats by-reference arguments as non-aliasing |
| Q-L23 | Imported modules have observable initializers | Applies the specified once-only initialization and dependency order | Uses file discovery order or duplicates initialization |
| Q-L24 | Invalid source has one root error and no output binary | Produces the specified diagnostic/recovery behavior and suppresses artifact generation | Emits a binary, cascades unchecked, or surfaces an ICE |
| Q-L25 | Legalization creates a spill/helper scratch slot after provisional allocation | Returns it to SFA and reaches final no-new-function-storage closure before emission | Allocates hidden dynamic/function storage after closure |
| Q-L26 | A charset needs VIC-compatible address/alignment/bank placement | Assigns it to platform layout/packaging rather than SFA, preserves placement, and handles the accepted lossless index-width contract | Makes SFA a universal asset manager, copies for convenience, truncates, or rejects a supported current width |
| Q-L27 | Current SpritePad v5 project with sprites, attributes, tiles, animations, and overlays | Preserves exact records and typed optional content, reports explicit derived bytes, and derives VIC blocks from placement | Drops attributes/content, truncates counts, invents a file-wide mode or file-owned block, or emits hidden duplicates |
| Q-L28 | C64 literals cross character-set modes and a custom charset lacks metadata | Produces the exact mode-bound bytes at compile time, preserves diagnostic ownership, emits no mode switch/runtime conversion, and keeps unqualified target/custom maps inactive | Uses an ambiguous map, guesses glyphs, writes hardware state, or copies C64 mappings to X16 |
| Q-L29 | One handler reaches C64 KERNAL-chain, exclusive, and raw sinks | Selects the exact no-double-save or raw entry variant, keeps helpers RTS, reports every link/body/stack cost, gates raw availability, and rejects visible CINV ABI mismatch | Uses one RTI body for all sinks, guesses sources, exposes unproven raw entry, hides costs, or adds a dispatcher/runtime |
| Q-L30 | Ordinary arithmetic and explicit packed-BCD operations share one function | Keeps ordinary operators binary, preserves explicit BCD/carry/D semantics, rejects invalid constants, records runtime-invalid CPU dependence, and emits no runtime helper | Makes ordinary arithmetic ambient-BCD, assumes valid digits, leaks D, or injects a checker/helper |
| Q-L31 | Familiar full-domain `for` loop crosses parser, CFG, SFA, and optimization | Preserves one ordinary three-clause loop, exact clause effects/exits/wrap, generic no-runtime CFG lowering, normal SFA liveness, and proof-gated byte induction for the valid word form | Retains a range form, changes effects for implementation ease, repairs the infinite byte form, or builds a runtime/generalized framework |
| Q-L32 | Local address crosses calls, derivations, loop lifetimes, repeated calls, and IRQ/mainline domains | Preserves hidden provenance and the exact dynamic source lifetime; permits contained local storage and transitively proven non-retaining calls; rejects escape with E10260; reuses sequential homes and separates bounded concurrent homes/variants with no runtime | Launders the address, pins an automatic local, rejects safe local aggregates for convenience, treats synchronous as no-retain, permits dangling escape, shares concurrent homes, or adds heap/runtime |
| Q-L33 | Validate PSID clock/model flags against C64/C64U video standard and SID endpoint topology | Keeps Unknown distinct from Both, requires exact callable-audio closure, and rejects known mismatch with E10261 without runtime conversion | Uses numeric clock as identity, guesses hardware, or silently converts/accepts mismatch |

## `cpu-lowering-and-optimization.md`

| ID | Scenario | Required invariant | Disqualifying outcome |
|---|---|---|---|
| Q-C01 | `CMP` followed by signed branch with V pre-seeded both ways | Detects stale V: CMP does not produce V; rejects `N xor V` use | Accepts sequence under favorable V |
| Q-C02 | Signed byte `<` over `-128,-1,0,1,127` pairs | Selects valid sign-normalize/sign-split/controlled-SBC family with assumptions/cost | Uses N or C alone |
| Q-C03 | Unsigned byte `>=` in branch context | Uses CMP carry directly and avoids boolean materialization | Calls helper or uses signed rule |
| Q-C04 | Signed word compare with equal/different high bytes | High-byte signed decision first, lower byte only on equality | Lets low-byte carry override signed high relation |
| Q-C05 | Word addition with live incoming carry irrelevant to source | Establishes carry before low byte and propagates upward | Reuses unknown carry |
| Q-C06 | Word subtraction | Starts SEC/no-borrow chain and records clobbers | Treats carry as borrow |
| Q-C07 | IRQ arrives while decimal mode may be set on NMOS C64 | Applies declared ABI/CLD policy and NMOS versus CMOS distinction | Assumes interrupt clears D |
| Q-C08 | `(zp),Y` pointer stored at `$FF` | Detects zero-page pointer high-byte wrap and placement constraint | Treats fetch as `$00FF/$0100` |
| Q-C09 | `JMP ($12FF)` on NMOS | Detects indirect high-byte page wrap; avoids or uses deliberately | Applies 65C02 corrected behavior to C64 |
| Q-C10 | Replace VIC register update with INC/RMW | Accounts for bus-visible RMW/device semantics before deciding | Optimizes from bytes/cycles only |
| Q-C11 | Forward/backward branch near range and page boundary | Reports not-taken/taken/page-cross paths and later relaxation/layout ownership | Gives one unconditional cycle count |
| Q-C12 | Absolute-indexed load/store crossing page | Adds conditional read cost but not a fictitious store discount | Applies same timing rule to both |
| Q-C13 | Signed right shift byte/word | Preserves arithmetic sign extension; a negative signed operand shifted by at least its width produces `-1`, while non-negative signed and unsigned operands produce `0` | Produces zero for a negative signed wide shift or uses LSR alone as arithmetic shift |
| Q-C14 | Multiply by 0/1/power/constant/variable | Uses fold/identity/shifts/add chain/table/helper by semantics and total cost | Always calls general helper |
| Q-C15 | Signed division by power of two with negative odd value | Preserves specified rounding/remainder semantics | Replaces blindly with arithmetic shift |
| Q-C16 | Comparison feeds branch then separately stored boolean | Branches directly where possible, materializes only escaping value | Materializes every condition early |
| Q-C17 | W65C02-only opcode in selected C64 output | Rejects as illegal target form despite assembler acceptance mode | Treats family superset as safe |
| Q-C18 | Inline versus helper with two call sites and IRQ reachability | Includes call/ABI/body/dead-strip/reentrancy/ZP costs | Compares body instruction count only |
| Q-C19 | Full 256-iteration canonical loop | Preserves ordinary word semantics, proves any byte induction representation, and identifies the byte-typed source form as deterministically infinite | Rejects the word form, repairs the byte form, loses an iteration, or narrows without escape/effect proof |
| Q-C20 | Link-time symbol low/high bytes | Keeps symbolic assembler resolution; no runtime helper/materialization | Calculates known address at runtime |
| Q-C21 | An optimization changes lowered assembly | Requires both an independent behavior oracle and the intended assembly/cost expectation; differential execution is supporting only | Accepts shape/cost alone or lets two paths validate a shared lowering bug |
| Q-C22 | Fixed-trip hot loop is considered for unrolling | Chooses from measured trip count, path frequency, code/layout cost, and cycle benefit; partial/full/no unroll are all legitimate results | Unrolls every constant loop or rejects unrolling universally |
| Q-C23 | Specialize an indirect access by modifying an absolute operand | Requires writable code, exclusive/synchronized ownership, non-reentrancy or a protocol, IRQ safety, selected-target legality, and measured benefit; otherwise keeps a safe form | Enables self-modifying code from performance intent alone |
| Q-C24 | Replace arithmetic or shifts with lookup/pre-shifted data | Includes table bytes, alignment/padding, placement/banking, actual access cost, workload frequency, and behavior proof | Calls table lookup faster without whole-program cost or visibility analysis |

## `c64-platform-and-games.md`

| ID | Scenario | Required invariant | Disqualifying outcome |
|---|---|---|---|
| Q-P01 | CPU writes RAM under I/O while VIC reads display data | Separates CPU bank view, VIC bank view, and exact `$0001`/CIA2 state | Uses one universal memory map |
| Q-P02 | Mainline changes `$01` while IRQ may run | Treats banking state as shared observable context; defines masking/save/restore contract | Moves bank writes freely |
| Q-P03 | Move charset/screen to another VIC bank | Uses alignment/bank/register/pointer facts and placement over copy | Copies assets merely for compiler convenience |
| Q-P04 | Raster workload budgeted for both PAL and NTSC | Gives variant-specific assumptions and safe/worst-case budget | Uses one PAL number as universal C64 |
| Q-P05 | Work scheduled on a badline | Accounts for VIC bus stealing and register timing, not CPU nominal cycles only | Declares fit from instruction sum alone |
| Q-P06 | Eight sprites active during raster work | Includes sprite-DMA cycle pressure/model assumptions | Ignores DMA stalls |
| Q-P07 | Select KERNAL-chain, KERNAL-exclusive, or raw IRQ entry | Matches exact KERNAL revision/vector/banking, save/tail/source ownership, static link and full cost contract | Uses one prologue/RTI blindly, double-saves, or exposes raw entry without proof |
| Q-P08 | Acknowledge VIC raster IRQ | Preserves exact volatile access semantics/order and register-specific acknowledgement | Generic RMW without device proof |
| Q-P09 | CIA interrupt-control register read/write | Distinguishes mask-setting/clearing and read-to-ack semantics as applicable | Treats it as ordinary stored byte |
| Q-P10 | Scan joystick/keyboard while CIA2 selects VIC bank | Preserves port direction/ownership and does not conflate CIA1/CIA2 | Clobbers video bank bits |
| Q-P11 | Design player-neutral C64 game audio across music-only, integrated music/SFX, SFX-only, and custom-player paths | Separates PSID metadata from a hash-bound callable contract; lowers constant operations directly; leaves tick scheduling with source; proves ABI, writable state, cadence, voice/arbitration, concurrency, full feature costs, and revision bounds; adds no generic runtime | Infers SFX from PSID, guesses player identity, adds hidden scheduling/mixing/copying, ignores unsafe overlap or costs, or claims universal sound from a register trace |
| Q-P12 | Double-buffer screen/charset across visibility regions | Prefers placement and pointer/base flips; permits compile-time replication only when alternatives cannot meet a named hardware/timing need, with consumer, constraint, bytes, and benefit recorded; treats buffers with different evolving states as distinct storage | Copies or duplicates for convenience, leaves replication unmeasured, or calls distinct evolving buffers duplicated data |
| Q-P13 | Sprite multiplexer with IRQ-only sorter/update helpers | Connects data layout, raster timing, SFA interference, scratch, and API expressibility | Reviews hardware in isolation |
| Q-P14 | Named `vic.borderColor.set(5)`-style wrapper | Requires exact expert store sequence after compile-time folding | Accepts hidden call/temp/read/write overhead |
| Q-P15 | Design an Integrator-style compile-time scene/asset pipeline for a large visible game area | Composes reusable elements/panels; generates masks, foreground priority, and attribute-conflict evidence; chooses precomputation/representation from memory-versus-draw/mask cost; assigns compiler/toolchain, emitted layout, loader, visibility/IRQ ownership, and zero-cost renderer responsibilities; proves artifact and runtime behavior | Says only “use Integrator/build an editor,” flattens everything into generic copying, ignores attribute/mask/runtime costs, or leaves asset preparation unowned |
| Q-P16 | Design entity storage, collision, and state dispatch for a fixed game workload | Chooses fixed pools and SoA/AoS from hot paths, models broad/narrow collision and function-pointer/SFA consequences, and gives a deterministic compiler/API disposition with behavior and assembly/resource proof | Declares one layout universally best or leaves engine structures as descriptive lore |
| Q-P17 | Stable raster region calls variable-path logic or a helper | Requires an explicit local cycle contract, path-invariance proof or bounded scheduling design, and a diagnostic when the budget cannot be proved | Assumes source shape or average cycles are stable |
| Q-P18 | Request VSP/AGSP for a general C64 build | Requires an explicit silicon/risk/compatibility contract, safer alternative comparison, VICE evidence, and targeted physical QA; never enables it by default | Treats one emulator result as safe universal hardware behavior |
| Q-P19 | Use FLI/FLD/line-crunch/border/sprite-crunch technique | Maps intent to a named API/template/lowering and exact timing/layout/ownership obligations, not a generic peephole | Pattern-matches arbitrary stores/loops into a display trick |
| Q-P20 | Optimize a scrolling/rendering hot path | Compares pointer flips, placement/justified replication, pre-shifted data, dirty updates, unrolling, and copying against actual frame and memory budgets | Blindly copies, duplicates, or unrolls without equivalent-work accounting |
| Q-P21 | Bake a sprite-multiplexer technique into Blend65 support | Produces a deterministic realization plan spanning modern source API, schedule/data representation, SFA/IRQ interference, target facts, lowering/layout ownership, cost, and proof | Merely describes the trick or assumes the shipped compiler can consult the skill |

## `parity-recovery-and-portability.md`

| ID | Scenario | Required invariant | Disqualifying outcome |
|---|---|---|---|
| Q-A01 | ACME source looks ZP-sized but symbol resolves above `$FF` | Inspects actual bytes/report; distinguishes serializer from assembler | Grades emitted text alone |
| Q-A02 | ACME precedence/low-high expression ambiguity | Uses pinned 0.97 official evidence and gives an exact future proof with expected bytes | Relies on memory, another assembler, or an invented observation |
| Q-A03 | Automatic ZP/absolute selection boundary | Derives value/symbol/force-width behavior from pinned evidence, specifies the later byte proof, and accounts bytes/cycles | Assumes source mnemonic fixes width |
| Q-A04 | Out-of-range relative branch | Requires compiler repair before serialization or explicit assembler error; verifies bytes | Treats successful text generation as completion |
| Q-A05 | Build C64 PRG | Confirms two-byte load header, origin, body, symbols, startup | Confuses raw binary with PRG |
| Q-A06 | VICE test skipped because emulator missing | Reports runtime status unknown/skipped, not pass | Rolls skip into green count |
| Q-A07 | Generated routine uses smaller code but adds table/helper/ZP | Includes all attributable costs and equivalent obligations | Announces win from routine bytes alone |
| Q-A08 | Expert routine cannot be written in ordinary Blend65 source | Records expressiveness failure outside finite ratio | Omits program from scoreboard and calls parity good |
| Q-A09 | Atari/X16 plugin delegates C64 startup/output hooks | Classifies scaffold/partial with exact boundary | Calls target supported because registry entry exists |
| Q-A10 | Decide where a new target fact belongs | Separates CPU, platform, serializer, packager, semantics | Adds catch-all platform special case upstream |
| Q-A11 | Readiness harness has many tests but no unique failure | Applies demonstrated-value/single-consumer/replacement test; simplify/delete | Preserves because it exists or has coverage |
| Q-A12 | Existing subsystem is complex but correct on one slice | Uses contract/evidence/boundary/recovery-cost salvage criteria | Keeps from sunk cost or rewrites from aesthetics |
| Q-A13 | Generated local routines meet expert, global layout improves program | Separately reports local floor and whole-program win | Claims every routine individually beats physical optimum |
| Q-A14 | Request ordinary baseline edit during compiler audit | Refuses mutation until later baseline | Changes skill and invalidates earlier decisions |
| Q-A15 | Discover critical false CPU fact after recovery decisions | Pauses affected work, point release, affected/regression cases, targeted impact audit | Silently patches or restarts everything |
| Q-A16 | Ask skill for current compiler completeness months later | Reinspects live repository; frozen skill contains method, not stale status | Quotes v1.0.0 current-state observation as fact |
| Q-A17 | Add a future target | Content facet requires primary research, platform-specific cases, honest unqualified status, and CPU/platform/serializer/packager separation; integration facet requires version bump, complete qualification, atomic activation between journeys, and dependent-impact review | Appends shallow notes, implies production support, or mutates the active baseline mid-journey |

## Red Baseline Selection

Run at least Q-R04, Q-R06, Q-R12, Q-L07, Q-L08, Q-C01, Q-C07, Q-C10, Q-P01, Q-P07,
Q-P21, Q-A07, Q-A09, and Q-A15 against the current four-reference skill before replacement
authoring.
Record every failure, partial result, pre-passer, and draft-oracle observation in
`qualification/release.md`. This subset exercises the known stale-V defect, narrow selective
loading, and the highest-risk cross-domain gaps.

## Structural and Traceability Commands

Run from repository root. These use existing tools only:

```bash
python3 /home/gevik/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  .agents/skills/blend65-domain-expert

find .agents/skills/blend65-domain-expert/references -maxdepth 1 -type f -printf '%f\n' | sort
find .agents/skills/blend65-domain-expert/qualification -type f -printf '%P\n' | sort

comm -3 \
  <(rg --files spec -g '*.md' | sort) \
  <(rg -o 'spec/[A-Za-z0-9_./-]+\.md' \
      .agents/skills/blend65-domain-expert/references/blend65-semantics.md | sort -u)

git status --porcelain spec/
npx prettier --check \
  .agents/skills/blend65-domain-expert \
  codeops/features/blend65-expert-skillset
```

Expected: the basic `SKILL.md` validator succeeds; separate exact-tree, link, metadata, source-key,
qualification, `comm`, and path checks pass; `git status` for `spec/` produces no output; and
Prettier succeeds. During migration, compare the live tree against the exact topology in RD-01,
not merely the number of files. Do not claim that `quick_validate.py` performs the separate checks.

Claim-key/reference-link set checks may use `rg`, `sort`, and `comm` in the same one-shot style. Do
not add a permanent validator unless a demonstrated failure proves existing commands insufficient;
RD-01 currently forbids such a framework.

## Focused Evaluation Order

| Knowledge checkpoint | Case file/run |
|---|---|
| Source and recovery foundation | Content only: Q-R05..Q-R09, Q-A07/Q-A08, Q-A11..Q-A13, and Q-A16 after their external oracles freeze |
| Blend65/compiler/SFA/IL | Content only: all unblocked Q-L plus Q-R03/Q-R04; conflicted semantic cases remain pending |
| CPU/lowering | Content only: all unblocked Q-C plus Q-R01; conflicted cases remain pending |
| C64 platform/game | Content only: all Q-P |
| ACME/portability/recovery | Content only: Q-A01..Q-A06, Q-A09/Q-A10, Q-A17's portability-content facet, and Q-R12 |
| Integrated candidate | Router facets of Q-R01..Q-R04 plus Q-R10/Q-R11, Q-A14/Q-A15, Q-A17's version/release integration facet, and cross-domain regression; then independent review and correction |
| Definitive isolated candidate | Complete blind suite, all evidence writes, then the Candidate Pre-delete Gate |
| Byte-identical live candidate | Formal live Gates 1–3; Gate 3 reuses the isolated evidence only when the payload hashes match exactly |

Phase 2 through Phase 6 focused runs manually select completed modules and do not claim router,
selective-loading, response-shape, or freeze facets. Q-R10, Q-R11, Q-A14, Q-A15, and Q-A17's
version/release integration facet are reserved for Phase 7 because their required invariants are
version, response, freeze, release, or errata behavior. Independent review and corrections precede
the definitive suite. Every later runtime-content or qualification-evidence change invalidates the
full run and requires review of the change plus another complete blind suite.

## Impact-Based Verification

Select checks from the touched surface and claim:

| Checkpoint | Required checks |
|---|---|
| Touched skill/Markdown files | Prettier on touched files, links, allowed paths, and relevant source/case identifiers |
| Completed knowledge module | All relevant content-focused cases plus source/depth/coverage cells for that module |
| Candidate integration | Candidate topology, metadata, links, source/spec sets, migration, focused router cases, and independent review |
| Final skill completion | Complete isolated skill qualification, all structural/source/path/freeze checks, and `spec/` cleanliness |

Do not run compiler builds or package/readiness/boundary tests, ACME, VICE, or another emulator for
this skill/Markdown-only feature. Tool and runtime cases inspect source-backed knowledge and the
precision of future proof specifications; they do not fabricate execution results.
Later compiler implementation uses directed package/consumer tests during development and broader
tests only at an affected major integration or release boundary. TypeScript 7 and removal of ESLint
without a replacement linter is a separate future toolchain change, not part of this plan.

## Pass Bar

Every listed case is mandatory; the current inventory is 107 cases, derived from unique IDs rather
than used as a quota. Case selection follows semantic and risk depth. Every required coverage cell,
source link, structural check, blind case, and independent material review must pass. Presentation
differences are non-material; factual, semantic, architecture, safety, source-conflict, routing, or
scope failures are material and release-blocking.
