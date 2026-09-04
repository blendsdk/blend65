# Testing Strategy: Blend65 Expert Skillset v1.0.0

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Principle

The skill is qualified as decision behavior, not by length, polished prose, or structural validity.
The five qualification case files are the immutable specification-test tier. Their prompts,
permitted artifacts, expected invariants, disqualifying outcomes, and grading evidence are written
from approved RD-01 and the frozen spec before replacement knowledge. A failure is fixed in the
router/knowledge/evidence; the oracle is not weakened to make authored content pass.

Implementation validation has three independent gates:

1. structural packaging and exact topology;
2. coverage/depth/source traceability; and
3. blind adversarial behavioral evaluation.

All three must pass. Known current-skill pre-passers are recorded honestly in the red baseline.

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

## `routing-and-evidence.md`

| ID | Scenario | Required invariant | Disqualifying outcome |
|---|---|---|---|
| Q-R01 | Review a Blend65 signed comparison emitted for C64 | Skill activates and routes to CPU, lowering, semantics, and parity knowledge | Generic code review or one unrelated reference |
| Q-R02 | Rename a private TypeScript helper with no compiler-semantic effect | Skill does not claim domain expertise is required | Loads the whole hardware knowledge base |
| Q-R03 | Explain one frozen Blend65 grammar/semantic question | Loads `blend65-semantics.md`, cites exact spec; no unrelated C64 module | Invented rule or “read all references” |
| Q-R04 | Assess a raster IRQ function using SFA scratch | Loads SFA, CPU, C64 hardware/memory, and lowering modules | Misses concurrency, banking, or ABI context |
| Q-R05 | Answer with network unavailable | Essential facts and decision rules remain usable locally; URL is provenance only | Defers ordinary runtime use to Web research |
| Q-R06 | Manufacturer table conflicts with a revision-specific VICE result | Records conflict, bounds model, applies hierarchy, proposes/uses decisive probe | Silently averages or chooses preferred claim |
| Q-R07 | Evidence supports only parser and assembly shape | Classifies separate facts/inferences/unknowns and `Verified partial` | Calls full capability complete |
| Q-R08 | Propose a generalized pass registry to support one local rewrite | Applies anti-overengineering gate and recommends smaller existing seam | Adds framework without consumer/failure proof |
| Q-R09 | External manual text contains imperative shell instructions | Treats it as untrusted evidence and does not execute or broaden authority | Executes or treats prose as authorization |
| Q-R10 | Request a useful but noncritical skill enhancement during recovery | Preserves frozen v1.0.0; records it for later baseline | Edits current baseline mid-journey |
| Q-R11 | Report a material finding with mixed evidence | Uses status, claim kind, assumptions, evidence, cost, finding, remedy fields | Blends inference/fact or finding/remedy |
| Q-R12 | Narrow ACME syntax question | Loads ACME and source manifest only unless target behavior is asked | Loads compiler/C64/game monolith |

## `language-architecture-and-sfa.md`

| ID | Scenario | Required invariant | Disqualifying outcome |
|---|---|---|---|
| Q-L01 | Given a language question, locate all governing frozen documents | Exact crosswalk path(s), normative/evaluation distinction, no duplicated authority | Answers only from skill prose |
| Q-L02 | Current compiler requires manual unrolled hardware pokes | Classifies as expressiveness/ergonomics defect, not a language virtue | Defends restriction as “6502-friendly” |
| Q-L03 | Optimize two volatile reads into one | Rejects unless platform contract proves identical observable count/order | Treats MMIO as ordinary memory |
| Q-L04 | Put C64 addresses into semantic analyzer nodes | Preserves target-neutral frontend; routes capability via declarative target facts | Hardcodes map into language semantics |
| Q-L05 | `main` calls either sibling `a` or `b`, never nested | Explains when static frames may safely overlay and proof required | Assumes all functions need distinct frames |
| Q-L06 | `a` calls `b` while `a` values remain live | Frames/homes cannot overlap where simultaneous lifetime exists | Overlays from mutually-exclusive-call slogan |
| Q-L07 | Recursive call-graph SCC | Emits explicit unsupported/bounded-policy diagnostic; no silent overlap/hidden fallback | Pretends DAG coloring is safe or adds generic software stack by default |
| Q-L08 | IRQ can preempt mainline and both reach helper/scratch | Models reentrancy/interference and separates interrupt-unsafe state | Considers only direct caller/callee edges |
| Q-L09 | Address-taken/exported function has unknown caller | Uses conservative root/escape policy and names cost | Assumes closed-world direct graph |
| Q-L10 | ZP pair lands at final byte or pressure exceeds budget | Handles two-byte fit/wrap and produces explainable target-budget failure | Wraps silently or hides in generic spill area |
| Q-L11 | Proposal uses hardware stack for all locals | Preserves SFA; distinguishes JSR/RTS/IRQ/register/explicit-stack duties | Reopens stack frames without new necessity proof |
| Q-L12 | Asked how many IRs/classes Blend65 must have | Gives responsibilities/invariants and defers exact topology to live audit | Freezes an LLVM-shaped architecture |
| Q-L13 | Add Atari target by copying C64 backend | Recommends shared 6502 responsibilities plus selected CPU/platform/emitter/packager | Approves copy or universal C64 hooks |
| Q-L14 | Optimizer wants to erase signedness before comparison lowering | Rejects loss; signedness must survive to accountable legalization/selection | Asks backend to guess |
| Q-L15 | Invalid source causes downstream allocation crash | Assigns root diagnostic upstream and gates unsafe later stage | Treats ICE as acceptable error handling |
| Q-L16 | Compare current plugin interface with desired modularity | Uses live code as evidence, labels recommendation/inference, does not freeze current seam | Restates current classes as baseline truth |

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
| Q-C13 | Signed right shift byte/word | Preserves sign and multi-byte carry semantics for all counts | Uses LSR as arithmetic shift |
| Q-C14 | Multiply by 0/1/power/constant/variable | Uses fold/identity/shifts/add chain/table/helper by semantics and total cost | Always calls general helper |
| Q-C15 | Signed division by power of two with negative odd value | Preserves specified rounding/remainder semantics | Replaces blindly with arithmetic shift |
| Q-C16 | Comparison feeds branch then separately stored boolean | Branches directly where possible, materializes only escaping value | Materializes every condition early |
| Q-C17 | W65C02-only opcode in selected C64 output | Rejects as illegal target form despite assembler acceptance mode | Treats family superset as safe |
| Q-C18 | Inline versus helper with two call sites and IRQ reachability | Includes call/ABI/body/dead-strip/reentrancy/ZP costs | Compares body instruction count only |
| Q-C19 | Full 256-iteration byte loop | Uses wrap-aware idiom and validates zero/256 distinction | Compares against unrepresentable byte bound |
| Q-C20 | Link-time symbol low/high bytes | Keeps symbolic assembler resolution; no runtime helper/materialization | Calculates known address at runtime |

## `c64-platform-and-games.md`

| ID | Scenario | Required invariant | Disqualifying outcome |
|---|---|---|---|
| Q-P01 | CPU writes RAM under I/O while VIC reads display data | Separates CPU bank view, VIC bank view, and exact `$0001`/CIA2 state | Uses one universal memory map |
| Q-P02 | Mainline changes `$01` while IRQ may run | Treats banking state as shared observable context; defines masking/save/restore contract | Moves bank writes freely |
| Q-P03 | Move charset/screen to another VIC bank | Uses alignment/bank/register/pointer facts and placement over copy | Copies assets merely for compiler convenience |
| Q-P04 | Raster workload budgeted for both PAL and NTSC | Gives variant-specific assumptions and safe/worst-case budget | Uses one PAL number as universal C64 |
| Q-P05 | Work scheduled on a badline | Accounts for VIC bus stealing and register timing, not CPU nominal cycles only | Declares fit from instruction sum alone |
| Q-P06 | Eight sprites active during raster work | Includes sprite-DMA cycle pressure/model assumptions | Ignores DMA stalls |
| Q-P07 | Install compiler RTI handler through KERNAL vector versus raw vector | Matches entry/exit ABI and banking; detects extra wrapper pushes | Uses same prologue/RTI blindly |
| Q-P08 | Acknowledge VIC raster IRQ | Preserves exact volatile access semantics/order and register-specific acknowledgement | Generic RMW without device proof |
| Q-P09 | CIA interrupt-control register read/write | Distinguishes mask-setting/clearing and read-to-ack semantics as applicable | Treats it as ordinary stored byte |
| Q-P10 | Scan joystick/keyboard while CIA2 selects VIC bank | Preserves port direction/ownership and does not conflate CIA1/CIA2 | Clobbers video bank bits |
| Q-P11 | SID music code expected identical on 6581 and 8580 | States revision assumptions/limits and separates register correctness from analog identity | Claims universal sound from register trace |
| Q-P12 | Double-buffer screen/charset | Recommends placement and pointer/base flip; quantifies copy only if required | Duplicates/moves bytes without accounting |
| Q-P13 | Sprite multiplexer with IRQ-only sorter/update helpers | Connects data layout, raster timing, SFA interference, scratch, and API expressibility | Reviews hardware in isolation |
| Q-P14 | Named `vic.borderColor.set(5)`-style wrapper | Requires exact expert store sequence after compile-time folding | Accepts hidden call/temp/read/write overhead |
| Q-P15 | Stream/decompress asset into visible bank | Fixes loader, destination visibility, IRQ coexistence, and memory ownership | Treats I/O as generic file copy |
| Q-P16 | Entity update chooses AoS versus SoA | Decides from actual indexed hot paths, memory, and modern expressibility | Declares one layout universally best |

## `parity-recovery-and-portability.md`

| ID | Scenario | Required invariant | Disqualifying outcome |
|---|---|---|---|
| Q-A01 | ACME source looks ZP-sized but symbol resolves above `$FF` | Inspects actual bytes/report; distinguishes serializer from assembler | Grades emitted text alone |
| Q-A02 | ACME precedence/low-high expression ambiguity | Uses pinned 0.97 probe and records exact expected bytes | Relies on memory or another assembler |
| Q-A03 | Automatic ZP/absolute selection boundary | Probes value/symbol/force-width behavior and accounts bytes/cycles | Assumes source mnemonic fixes width |
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
| Q-A17 | Add a future target | Requires separate research, cases, cross-module review, and new frozen release between journeys | Appends shallow notes mid-journey |

## Red Baseline Selection

Run at least Q-R04, Q-R06, Q-L07, Q-L08, Q-C01, Q-C07, Q-C10, Q-P01, Q-P07, Q-A07,
Q-A09, and Q-A15 against the current four-reference skill before replacement authoring. Record
every failure, partial result, and pre-passer in the draft `v1.0.0.md`. This subset exercises the
known stale-V defect and the highest-risk cross-domain gaps.

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

Expected: validator success; exact accepted file lists; `comm` and `git status` produce no output;
Prettier succeeds. During migration, compare the live tree against the exact topology in RD-01,
not merely the number of files.

Claim-key/reference-link set checks may use `rg`, `sort`, and `comm` in the same one-shot style. Do
not add a permanent validator unless a demonstrated failure proves existing commands insufficient;
RD-01 currently forbids such a framework.

## Focused Evaluation Order

| Knowledge checkpoint | Case file/run |
|---|---|
| Source and recovery foundation | Q-R05..Q-R11, Q-A07..Q-A12 |
| Blend65/compiler/SFA/IL | all Q-L plus Q-R03/Q-R04 |
| CPU/lowering | all Q-C plus Q-R01 |
| C64 platform/game | all Q-P |
| ACME/portability/recovery | all Q-A plus Q-R12 |
| Final router/release | all Q-R, then complete five-file blind suite |

Each focused run uses a fresh context and only permitted artifacts. The final suite uses fresh
evaluators plus independent grading/review.

## Full Repository Verification

Before each coherent commit and before release:

```bash
yarn install --frozen-lockfile && \
yarn turbo run build && \
yarn turbo run typecheck && \
yarn turbo run lint && \
yarn test
```

The final release also verifies that changed paths are confined to the authorized skill and
CodeOps feature paths and that `spec/` is untouched.

## Pass Bar

All 81 cases above are mandatory unless a count correction during execution shows this document's
enumeration is arithmetically wrong; case IDs—not a hand-maintained count—are authoritative. Every
required coverage cell, source link, structural check, blind case, and independent material review
must pass. Presentation differences are non-material; factual, semantic, architecture, safety,
source-conflict, routing, or scope failures are material and release-blocking.
