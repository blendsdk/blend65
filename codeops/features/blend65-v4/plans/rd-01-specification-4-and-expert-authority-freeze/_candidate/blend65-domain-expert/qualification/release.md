# Blend65 Domain Expert Release Record

> **Active qualified version**: `1.0.0`
> **Status**: Active — the only qualified Blend65 domain-expert baseline
> **Recorded**: 2026-09-09

## Identity

| Field | Value |
|---|---|
| Untouched legacy Git commit | `d39ae459e02133d474d7157807d53d7e71fd6268` |
| Legacy tree source | `git archive d39ae459e02133d474d7157807d53d7e71fd6268 -- .agents/skills/blend65-domain-expert` |
| Legacy isolation | Fresh directory under `/tmp`; extracted tree made read-only before assessment; removed after evidence capture |
| Sorted legacy file-record digest | `a373271c41c9c2f50f38956c60d42a387d1da09e25e8d06c5cc61f16c7784fab` |
| Original router SHA-256 | `3865874b9f8fab03e5554e01098ed1ca4834c9470698bcc1729e06f2cca5d998` |
| Metadata SHA-256 | `94dc79f61ffc4f834f45d9e03353837089ab46f9a0fa52703aa5619e742c9370` |
| Legacy reference hashes | Pinned individually in `qualification/coverage-matrix.md` |
| Active router | `1.0.0`; qualified and atomically active |
| Candidate router SHA-256 | `80fbc581e4a1a60e372fa2bff745748755da322d2f5db5a3c402b4bc2aa4621f` |
| Qualified content commit | `a96cfd3c41a456d4d4f983021cf43535a1d5bdaa` |
| Qualified runtime-payload digest | `bb05def96d180926bbc2cb57131550f633d2c87369a2b34c97b55d148d2cdf82` |
| Qualified content-checkpoint full skill-tree digest | `4379f1d0a7d6e8c3523c647591994a86fb5bfc99d66f75edf5b9a16b3c925e00` |
| Superseded qualified version | None; the legacy prototype was never qualified |

## Gate State

| Gate | State | Evidence / blocker |
|---|---|---|
| Structural | Passed | The isolated candidate has exactly thirteen linked references, seven qualification artifacts, valid metadata and links, and no legacy runtime reference. The Candidate Pre-delete Gate passed before atomic migration. |
| Coverage and traceability | Passed | Every case row and legacy heading has an exact knowledge destination, source basis, protecting case, and completed applicable facets. Native asset parser claims remain fail-closed until their stated producer-schema/fixture implementation proofs exist. |
| Behavioral | Passed | The complete isolated coverage sample under `BLEND65-SPEC-P3-4bf8a989` passed 105 cases and exposed Q-L26/Q-L27 defects. Those defects were corrected; current-packet focused Q-L26/Q-L27 evidence and independent re-review pass. All 107 case fields now contain applicable green final evidence. |
| Specification consistency prerequisite | Passed | SC-148..SC-155 are bound to `BLEND65-SPEC-P3-4bf8a989` (`4bf8a98934df6282febe013c31a16d89dd73f8e8bbbce9e87b6678e1b75013fe`). Mechanical checks reproduce 50 specification paths. No earlier result is relabelled as evidence for this identity. |
| Hardware-limitation exceptions | Passed | The final scan reconciled HLE-002/HLE-005, migration and C64 disclosures, per-activation costs, address-workaround bounds, and aggregate-return expressiveness debt. HLE-001..HLE-009 and EXP-001 are present with zero omitted, pending, or unreconciled exception. |

## Red-Baseline Method

The red baseline used one exact, isolated, read-only export of the untouched legacy identity. The
primary execution agent answered the selected case prompts using only that legacy router and its
four references, then graded the answers against the Phase-1 oracle fields. This is a baseline
capability inspection, not independent review and not final qualification. External-fact oracles
are still draft, so those rows are observations rather than release pass/fail evidence.

The isolated tree passed the existing `quick_validate.py` structural check. That check establishes
only valid skill packaging; it does not validate sources, routing depth, correctness, coverage, or
decision behavior.

## Red-Baseline Results

| Case | Result | Exact legacy evidence | What the result establishes |
|---|---|---|---|
| Q-R04 | Partial | `SKILL.md:28-39`; `compiler-engineering.md:47-58`; `c64-game-systems.md:57-69` | Relevant broad documents are discoverable, but there is no precise multi-module route or complete IRQ/SFA packet. |
| Q-R06 | Draft observation: partial | `c64-game-systems.md:99-110` | VICE versus hardware is bounded, but there is no explicit source-conflict authority procedure or pinned source manifest. |
| Q-R12 | Fail | `SKILL.md:28-39`; no `source-manifest.md`; ACME content is split across broad CPU/C64 references | A narrow ACME question cannot select the accepted ACME-plus-manifest-only route. |
| Q-L07 | Pre-passer | `compiler-engineering.md:47-58` | Recursion/reentrancy rejection and user-facing diagnosis are present at outline depth; exact diagnostic mapping is outside this frozen case field. |
| Q-L08 | Pre-passer | `compiler-engineering.md:49-57`; `c64-game-systems.md:64-68` | Mainline/IRQ reachability and non-reentrant scratch interference are explicitly recognized. |
| Q-C01 | Fail | `mos-6502-codegen.md:52-56` | The text says signed comparisons use `N xor V` but never says `CMP` leaves V stale; following it after `CMP` can miscompile. |
| Q-C07 | Draft observation: pre-passer | `mos-6502-codegen.md:58-60`; `c64-game-systems.md:64-65` | NMOS decimal-mode interrupt danger and ABI ownership are recognized, pending source freeze. |
| Q-C10 | Draft observation: pre-passer | `mos-6502-codegen.md:68`; `c64-game-systems.md:43-48` | Bus-visible RMW and VIC acknowledge hazards are recognized, pending source freeze. |
| Q-P01 | Draft observation: pre-passer | `c64-game-systems.md:19-34` | CPU banking, VIC bank selection, and bank-relative visibility are separated, pending source freeze. |
| Q-P07 | Draft observation: partial | `c64-game-systems.md:63-68` | Generic IRQ save/acknowledge/RTI duties exist, but KERNAL-vector versus raw-vector entry contracts do not. |
| Q-P21 | Draft observation: fail | `c64-game-systems.md:82-97` | The prototype lists game idioms but does not turn sprite multiplexing into deterministic compiler/API ownership, costs, hazards, and proof. |
| Q-A07 | Pre-passer | `evidence-and-parity.md:57-84` | Equivalent-work comparison and code/data/padding/ZP/frame/stack/helper costs are already explicit. |
| Q-A09 | Draft observation: partial | `evidence-and-parity.md:38-54,123-134` | The status vocabulary and salvage method exist, but no six-target constraint model supports the exact classification. |
| Q-A15 | Fail | Whole legacy tree; no semantic version, content commit, release binding, errata path, or dependency-targeted impact audit | A critical false fact could be silently patched and invalidate earlier decisions. |

The red subset therefore exposes material insufficiency even though several good high-level rules
pre-pass. Pre-passers stay recorded; they are not forced red and do not make legacy prose
authoritative.

## Phase-2 Source-to-Invariant Review

The independent source reviewer examined all 53 cases that originally crossed the external
authority gate. The first pass found six major precision/authority problems. Remediation replaced
dead datasheet links with identity-and-hash-pinned mirrors, added exact MOS/spec/ACME locations,
added revision-specific KERNAL and practitioner source symbols, removed placeholder citations, and
separated external facts from project method. Four cases—Q-C21, Q-A06, Q-A09, and Q-R06—were
correctly reclassified as project-policy oracles.

The second pass found two real frozen-spec conflicts, one overbroad signed-division case, and two
citation defects. At that checkpoint Q-C13 was blocked by SC-005 and Q-C19 by SC-006; AR-P32/SC-131
has since superseded Q-C19's range oracle. Q-C15 is explicitly limited to signed power-of-two
quotient/remainder correctness rather than general division implementation. ACME evaluation and
evidence anchors were corrected. The final narrow re-review
returned no findings and authorized all 47 non-conflicted external cases as `frozen-external`.
No assembler, emulator, or physical-hardware observation was run or claimed.

## Phase-2 Focused Results

Each evaluator received only the named construction references and prompt, not the hidden oracle,
coverage matrix, plan, legacy conclusions, prior outputs, or author history.

| Cases | Result | What the result establishes |
|---|---|---|
| Q-R05 | Pass | Essential knowledge is locally usable; URLs remain provenance only. |
| Q-R06 | Pass | Manufacturer and configured-VICE claims stay bounded; silicon-sensitive physical behavior remains `Unknown` pending targeted hardware QA. |
| Q-R07 | Pass | Parser plus assembly-shape evidence yields only a precisely bounded `Verified partial`. |
| Q-R08 | Pass | One local rewrite does not justify a generalized pass registry. |
| Q-R09 | Pass | Imperative text inside an external source remains inert and untrusted. |
| Q-A07 | Pass | Table/helper/ZP costs reverse a false local win; unmeasured path/page timing stays unknown. |
| Q-A08 | Pass | An unexpressible program is `Incorrect` and outside any finite parity ratio. |
| Q-A11 | Pass | A no-unique-value readiness layer is deleted without creating a replacement meta-harness. |
| Q-A12 | Pass | One proven slice is `Verified partial`; salvage waits for contract/boundary/recovery-cost evidence. |
| Q-A13 | Pass | Local 1.0 parity and the 200-byte whole-program win are reported separately. |
| Q-A16 | Pass | Mutable compiler completeness is `Unknown` until the live pipeline is reinspected. |

## Phase-3 Focused Results

The initial SC-001..SC-017 repair was completed first. Two fresh evaluators then received only the concrete
packets below, the four Phase-3 candidate references, and cited `spec/**/*.md` authority. They were
forbidden the qualification oracles, coverage/release conclusions, plans, legacy references,
implementation tests, and prior outputs. Their access boundary was instruction-enforced, not an OS
sandbox; these are advisory focused checks. Phase 7 still requires the definitive isolated
filesystem-sandboxed run.

### Concrete packet manifest

The digest is SHA-256 over the exact 35 `| Q-...` data rows below, each terminated by LF, in table
order: `775a387608b969fadb77afb78c38f68bb9142503dcd2bfb040b4ec6353bf04e8`.

This packet and its captured Q-L19 answer predate AR-P35–AR-P38. They are retained as historical
evidence of the invalidated `0565e5fd`-era model; the final affected-case section below is the only
current Q-L19 result.

| Case | Concrete raw-artifact packet |
|---|---|
| Q-L01 | Resolve a 256-iteration three-clause loop and its byte-counter nontermination counterexample, a module `let` initialized by `readTimer()`, and diagnostic-template ownership; then perform a substantive 50-path crosswalk audit with one authority role, semantic payload, compiler/storage/effect consequence, interaction/failure boundary, route, and justified N/A classification per exact `spec/**/*.md` path. |
| Q-L02 | A legal `(word, byte)` `poke` is rejected unless the address is literal; the proposed workaround unrolls many literal stores. |
| Q-L03 | Two reads of `$d012` feed later stores; a proposed CSE replaces the second volatile read with the first result. |
| Q-L04 | A proposed pre-target semantic node embeds `vicRegisterAddress: $d020`. |
| Q-L05 | `main` reaches mutually exclusive sibling calls `a`/`b`; neither escapes or overlaps asynchronously; each owns four private bytes. |
| Q-L06 | `a.temp` remains live across a call to `b`; both are proposed to share the same two bytes. |
| Q-L07 | Storage-bearing call graph `f -> g -> f`; no dynamic-frame runtime is authorized. |
| Q-L08 | Mainline and non-nesting raster IRQ both call an ordinary storage-bearing helper; its byte global is RMW-shared; RTI entry and RTS helper are explicit. |
| Q-L09 | A storage-bearing ordinary function escapes as opaque `word` to an external caller with no finite entry-time contract. |
| Q-L10 | A two-byte ZP pair is placed at `$ff`; a separate allocation exceeds the declared ZP budget by two bytes. |
| Q-L11 | Proposal replaces SFA with hardware-stack locals, accepts cross-kind explicit saves because byte depth balances, and assumes reachable BRK falls through without profile or stack proof. |
| Q-L12 | A fixed count of IRs, passes, and classes is requested before the live compiler seams are audited. |
| Q-L13 | Proposed Atari backend copies C64 code and replaces addresses; shared 6502-family support remains a goal. |
| Q-L14 | Canonicalization erases `sbyte`/`byte` before ordered comparisons reach legalization and tells the backend to guess. |
| Q-L15 | Unknown type `Sprtie` produces a frontend error, malformed typed node, SFA crash, and partial output artifact. |
| Q-L16 | Live evidence: `PlatformPlugin` exposes profile/intrinsic/runtime data and preamble/string/main-policy hooks (`packages/core/src/platform/platform-plugin.ts:96-185`); `runFrontend` loads it and passes only `registry` plus `plugin.profile` into `analyze` (`packages/compiler/src/api/run-frontend.ts:171-183`); `AnalyzeInput` accepts generic profile/registry/target facts and does not accept the plugin (`packages/frontend/src/semantics/analyze.ts:64-97`). Assess this seam against the modularity goal without treating the implementation as authority. |
| Q-L17 | In `f(1, g())`, first-argument staging is proposed to share storage with a transitive callee of `g`. |
| Q-L18 | `f(1, f(2, 3))` is rejected solely because the same eventual callee appears during outer-argument staging. |
| Q-L19 | Ordinary runtime declaration `let wide: word = byte(250) + byte(10)` is folded directly to 260, bypassing runtime intermediate-width wrap. |
| Q-L20 | Compare `const folded: word = byte(250) + byte(10)` with `let runtime: word = byte(250) + byte(10)` under TS-18 versus TS-9/TS-20. |
| Q-L21 | Both `consume(first(), gate() && second())` and `consume(first(), gate() || second())` are reordered and made eager; every call writes MMIO. |
| Q-L22 | Mutable `p` is passed twice by reference; proposed alias optimization assumes disjoint parameters; const-parameter effect is requested. |
| Q-L23 | A MMIO-reading module initializer feeds another module; an independent initializer writes MMIO; filesystem order and duplicate execution are proposed. |
| Q-L24 | Wrong call arity produces one owner error plus five causal cascades and still emits a binary. |
| Q-L25 | Legalization adds pointer/helper scratch after provisional allocation and places it in an unreported emergency global. |
| Q-L26 | `embed(path, selector)` CharPad imports, handler signature/version and exact-key inventory, charset at `$2800` in VIC bank 0, byte/word/packed/split software tiles and maps, proposed truncation, duplicate charset, hidden companion representations, and implicit offset tables. |
| Q-L27 | SpritePad Pro 3.80 SPD v5 with more than 255 sprites, packed per-sprite attributes, tiles, animations, overlays, proposed data loss, a false global mode, hidden duplicates, and a placement-derived file selector. |
| Q-L28 | C64 default and lower/upper literal conversions, a non-literal map argument, a custom charset without scalar metadata, and an unqualified X16 PETSCII call. |
| Q-L29 | One interrupt handler reaches default C64 KERNAL-chain, explicit KERNAL-exclusive, and profile-gated raw sinks; a visible raw address is also written to CINV. |
| Q-L30 | Ordinary byte addition, byte `bcd_add`, word `bcd_sub`, valid and invalid constant BCD, and a raw `asm_sed()` path all occur in one function. |
| Q-L31 | Compare semantic-word and byte-counter 256-iteration loops, effectful clauses, every loop exit, a proposed retained range syntax, generic CFG/SFA treatment, and a bounded canonical-induction optimization. |
| Q-L32 | Track one local address through copies, derived fragments, contained local aggregates, transitive calls, returns, persistent/raw stores, loop incarnations, sequential calls, and concurrent mainline/IRQ domains; compare persistent pinning. |
| Q-L33 | Validate PAL/MOS6581 and NTSC/MOS8580 C64 profiles against every PSID v1/v2NG–v4 clock/model value, secondary/tertiary inheritance, Unknown embedding versus callable audio, known mismatch, C64U physical-SID/UltiSID endpoints, and turbo CPU mode. |
| Q-R03 | Narrow routing question for a module initializer call, startup timing, transitive dependency cycle, and public diagnostic ownership. |
| Q-R04 | Narrow SFA-only assessment of mainline/IRQ helper overlap with RTI/RTS split; exact raster timing and IRQ acknowledge facts are absent. |

### Captured evaluator results

Evaluator A (`phase3_eval_a`) covered Q-L01..Q-L13 and Q-R03. Evaluator B
(`phase3_eval_b`) covered Q-L14..Q-L26 and Q-R04. Q-L27..Q-L33 were added after their governing
product reconciliations and have not run.
Both completed evaluators labelled their run advisory and non-release.
The tables below preserve their normalized outputs; no oracle correction has been folded into them.

| Case | Evaluator verdict | Responsible boundary | Decisive invariant / remedy | Cited authority |
|---|---|---|---|---|
| Q-L01 | 256 iterations; module call initializer legal conditionally; Chapter 14 owns templates | Ch 05/03/10/14 | Consolidated chapters govern; repair any implementation/derived contradiction | Semantic authority/crosswalk/diagnostics; Ch 05 §7.2, Ch 03 §5.1, Ch 10 §5.4, Ch 14 §§1–2 |
| Q-L02 | Literal-only rejection is an implementation defect | semantic acceptance → legalization → SFA | Preserve ordered volatile store; charge one two-byte compiler ZP pair through final SFA closure | Architecture restriction triage; IL effects/legalization; SFA storage/closure; Ch 12 §3.1; Ch 06 §5; F020 MI-A3 |
| Q-L03 | CSE is incorrect | semantic effects and memory optimization | Keep two ordered volatile reads | IL payload/effects/counterexamples; Ch 12 §3.1; F020 MI-1 |
| Q-L04 | VIC address in pre-target IR is incorrect | target-neutral semantics → selected platform | Carry symbolic capability/register; bind after target selection | Architecture responsibility/frontend/composition; IL payload; introduction A5; Ch 15 §§1/3 |
| Q-L05 | Overlay allowed conditionally | whole-program liveness/SFA coloring | Record width/alignment/region and non-overlap proof | SFA interference/coloring/proof; Ch 11 §3.4; Ch 06 §5.2 |
| Q-L06 | Overlay incorrect | CFG liveness/SFA interference | Caller temp is live through callee; allocate distinct homes unless a real transform ends liveness | SFA lifetime/interference; IL counterexamples; Ch 11 §3.4; Ch 06 §5.2 |
| Q-L07 | Reject E10181 before allocation | call-graph SCC/function diagnostics | Report ordered cycle; retain no-runtime recursion rule | SFA roots/proof; Ch 06 FN-6/§10; Ch 14 E10181 |
| Q-L08 | Helper legal; shared private homes unsafe; W10211 for shared RMW | execution domains/SFA/ABI/diagnostics/report | Disjoint mainline/IRQ homes; RTI entry/RTS helper; one shared global; full resource report | Semantic interrupt domain; SFA interference/ABI; Ch 06 §§7.3–7.6/§10; Ch 14 W10211 |
| Q-L09 | Closed-world overlay incorrect | root/escape/domain SFA | Checked finite sink or conservative rejection E10245 | SFA roots/interference/proof; Ch 06 FN-12/§8/§10; Ch 14 E10245 |
| Q-L10 | Both allocations invalid | target-aware ZP allocation/final closure | Recolor or legal non-ZP lowering; otherwise E10032 | SFA ZP/failure; Ch 11 §§4/8; Ch 15 §§3.1/5.2; Ch 14 E10032 |
| Q-L11 | Earlier stack-all-locals verdict predates AR-P29/AR-P31 | language/SFA/ABI/stack kind, BRK edge, and budget | Retain SFA; require kind-correct explicit saves; require BRK profile proof and charge CPU+handler stack with no runtime; rerun under replacement identity | SFA binding/stack/alternative gate; introduction A2; Ch 06 §§1/5; Ch 11 §§3.1–3.2/5.1; Ch 12 stack/BRK; Ch 15 BRK contract; CBM-C64-KERNAL-03 |
| Q-L12 | Fixed topology count rejected | architecture evaluation | Audit consumers/invariants; introduce only smallest justified seams | Architecture objective/map/evaluation/baseline; IL representation/layers; Ch 15 §5 |
| Q-L13 | C64-copy Atari backend rejected | CPU/platform/emitter/packager composition | Share only neutral/common work; add Atari profile/device/XEX packaging | Architecture composition; introduction A5; Ch 15 §§1–3/5; A800XL appendix §§2–7 |
| Q-L14 | Signedness erasure incorrect | semantic IR → legalization/selection | Preserve signedness or distinct comparison predicates until selection | Architecture non-erasure; IL semantic payload; Ch 02 §2.1; Ch 04 §5 |
| Q-L15 | Poison reaching SFA/artifact incorrect | type analysis/validity gate/driver | E10241; safe poison; stop SFA/emission; atomic artifact publication | Architecture diagnostic gate; semantic diagnostics; Ch 02 §14; Ch 14 §§1–2 |
| Q-L16 | Concrete plugin in analyzer incorrect | neutral frontend → CPU/platform → emitter → packager | Typed symbolic operation first; target bind and serialize later | Architecture responsibility/frontend/composition/emission; Ch 15 §§1/3/5 |
| Q-L17 | Staging overlay incorrect | call lowering/SFA lifetime | First argument stays live through all later-argument callees | SFA lifetime/nested arguments; Ch 06 FN-10/§5.4 |
| Q-L18 | Rejection as recursion incorrect | SCC analysis versus staging/lowering | Inner invocation completes before outer; caller-side staging and delayed marshal | SFA roots/nested arguments; IL counterexamples; Ch 06 FN-6/FN-10 |
| Q-L19 | Historical result: `word(4)`, not 260 | typed constant folding | Invalidated by AR-P35–AR-P41 for direct subscript operations, stable query widths, and aggregate-domain totality; retained only for the old ordinary-assignment packet | IL payload/arithmetic; Ch 02 TS-3/TS-9/TS-20..TS-23 |
| Q-L20 | Both results are 4 | folding/runtime arithmetic contract | Foldability cannot alter the typed operation | IL arithmetic/counterexamples; Ch 02 TS-9/TS-18/TS-20 |
| Q-L21 | Reorder/eager evaluation incorrect | effect IR/call lowering/CFG | `first`, `gate`, conditional `second`, then `consume`; preserve MMIO count/order | Architecture non-erasure; IL effects/CFG; Ch 06 FN-10; Ch 04 §6 |
| Q-L22 | No-alias assumption incorrect | alias/effect analysis/by-ref lowering | Both parameters retain `p` identity; const aggregate parameter access removes only write permission | Semantic const invariant; SFA nested args; IL payload; Ch 06 FN-3; Ch 07 SR-3/§4.7 |
| Q-L23 | Filesystem order/duplicate init incorrect | module/effect analysis/startup | Each initializer once; dependency/effect order with stable tie-break | Semantic crosswalk; SFA roots; Ch 10 §§5.3–5.4 |
| Q-L24 | Cascades and artifact incorrect | call checking/recovery/driver | E10171 root; causal poison; suppress cascades and artifact | Semantic diagnostics; architecture gate; Ch 06 §4.2; Ch 14 §§1–2/E10171 |
| Q-L25 | Emergency global incorrect | legalization/helper discovery → SFA closure | Return new storage to SFA and reclose all domains/budgets | Architecture closure; SFA storage/closure; IL legalization; Ch 11 §§3.1/3.4/6; Ch 06 §7.6 |
| Q-L26 | `$2800` placement conditional; copies/tables wrong; byte-only width answer invalidated by current-format evidence | handler/layout/platform operation/report | Literal handler-owned selector keys; exact pinned application/format generation; fail-closed version validation; `$0A` charset field; one charset; smallest-lossless canonical type; explicit packed/split alternatives; no hidden companions, truncation, or query language; report costs | SFA storage; architecture composition; IL cost oracle; Ch 13 §§2.2/EMB-5/§4/§7.2; C64 appendix §§7.2/9.3 |
| Q-L27 | Not run | handler/layout/C64 operations/report | Preserve exact SPD v5 records and full requested component model; word count; per-sprite attributes; no implicit copies/offsets; placement-derived VIC block; reject non-v5 | Ch 13 §§2.2/EMB-5/§7.2; C64 appendix §7.1; F015 §§2/4/5/10 |
| Q-L28 | Not run | semantic/profile encoding and asset metadata | Produce exact C64 mode-bound bytes; use E10125/E10249/E10251 precisely; emit no mode switch/runtime converter; reject guessed custom maps and unqualified X16 PETSCII | Ch 08 STR-2/STR-3; Ch 15 §3.1; C64 appendix §6; AR-P25; CBM-C64-PRG-1982 Appendices B/C |
| Q-L29 | Not run | source-handler provenance → platform entry selection → SFA/ABI/report | Select no-second-save CINV chain/exclusive or raw save/restore/`RTI`; preserve helper `JSR`/`RTS`; require raw-path proof; report all variants/link/stack/cycles; reject visible CINV mismatch with E10252; add no dispatcher/runtime | Ch 06 §7; Ch 12 §2.4/§4; Ch 15 §3.2; C64 appendix §9.2; AR-P26; CBM-C64-KERNAL-03 |
| Q-L30 | Not run | semantic arithmetic → explicit BCD IL → selected CPU lowering | Keep ordinary arithmetic binary; own BCD carry/D state; fold or diagnose constants; expose selected-hardware results for invalid runtime digits; add no helper/checker | Ch 02/04/12/14; F012/F021; AR-P28; MOS-PGM-1976; WDC-65C02S-2022 |
| Q-L31 | Not run | statement parsing → semantics/CFG → SFA → canonical induction recognition | Preserve one ordinary three-clause loop and its effects/exits/wrap; lower generically without runtime; optimize the valid word full-domain form only under proof; keep the byte form infinite | Ch 01/03/05/14; F008; master grammar; AR-P32/SC-131; MOS-PGM-1976 |
| Q-L32 | Not run | local-origin provenance → lifetime/retain analysis → SFA/domain binding | Permit contained local use and transitive non-retaining calls; reject the first escape with E10260; reuse sequential homes, separate bounded concurrent homes/variants, and add no pin/heap/runtime | Ch 00/04/06/11/14; F006/F018; AR-P33/SC-132/HLE-007 |
| Q-L33 | Not run | asset metadata → selected profile/topology → player-contract compatibility | Preserve all PSID clock/model meanings and inheritance; keep Unknown distinct from Both; reject known mismatch with E10261; treat C64U endpoints as deployment configuration; separate turbo CPU rate; add no conversion or hardware-activation runtime | Ch 13–15; F015; C64/C64U appendices; AR-P34/SC-133; HVSC-SID-FORMAT-20260906; TARGET-C64U-EE6B7AC |
| Q-R03 | Module initializer call legal conditionally; cycle E10194 | Ch 03/10/14 | Run once before `main`; break cycle rather than choose arbitrary order | Semantic Ch 03/10/14 crosswalk; Ch 03 §5.1; Ch 10 §5.4; Ch 14 §1/E10194 |
| Q-R04 | SFA-safe only with domain separation; timing/ack unknown | interrupt-domain analysis/SFA/ABI | RTI entry/RTS helper; disjoint private homes; bound answer to supplied facts | Semantic interrupt SFA; SFA interference; Ch 06 §§7.3/7.5–7.6; Ch 11 §§3.1/3.4 |

### Initial cross-grading

The evaluators swapped roles only after both output sets were frozen. Grader B passed every
Evaluator-A case. Grader A found four evaluator errors, one packet/evidence defect, one stale hidden
oracle, and the deliberately incomplete Q-R04 route. These initial failures remain recorded; they
are not silently overwritten by the focused correction run.

| Case | Initial grade | Material grading reason |
|---|---|---|
| Q-L01..Q-L13 | Pass | Each decision preserved its named semantic/storage invariant and cited sufficient permitted authority. |
| Q-R03 | Pass | The route used semantic authority only and resolved initializer legality, execution, cycle, and diagnostic ownership. |
| Q-L14 | Pass | Signedness remained available through accountable legalization/selection. |
| Q-L15 | Fail | The conclusion was correct, but “atomic artifact publication” prescribed a mechanism not required by the cited authority. |
| Q-L16 | Fail | The answer did not inspect the permitted live interface/consumer evidence or separate fact, inference, and recommendation. |
| Q-L17..Q-L19 | Historical pass | Argument-storage lifetimes and the old ordinary-assignment width rule were preserved; Q-L19 was later replaced by the array/index/counter packet. |
| Q-L20 | Fail | A TS-18 constant context was incorrectly given the TS-9/TS-20 runtime-width result. |
| Q-L21 | Fail | The answer covered the supplied `&&` branch but did not distinguish the requested `||` short-circuit branch. |
| Q-L22 | Pass | Alias identity and the limited effect of a const aggregate parameter were preserved. |
| Q-L23 | Invalid oracle | Runtime ordering was correct, but the hidden oracle still demanded detection of rationale that SC-004 had already repaired. The oracle was corrected to test agreement rather than require a fabricated defect. |
| Q-L24..Q-L25 | Pass | Diagnostic gating and final storage closure were preserved. |
| Q-L26 | Partial retained pass | Historical result: CharPad placement, ownership, version pinning, and selector boundaries remain valid. The old width answer is invalidated; a focused rerun against the accepted AR-P17 oracle is pending. |
| Q-L27 | Not run | Added after accepted AR-P14; its focused run follows specification reconciliation. |
| Q-L28 | Not run | Added after accepted AR-P25; its focused run follows specification reconciliation. |
| Q-L29 | Not run | Added after accepted AR-P26; its focused run follows specification reconciliation. |
| Q-L30 | Not run | Added after accepted AR-P28; its focused run follows replacement identity. |
| Q-L31 | Not run | Added after accepted AR-P32; its focused run follows replacement identity. |
| Q-L32 | Not run | Added after accepted AR-P33 and independent challenge; its focused run follows replacement identity. |
| Q-L33 | Not run | Added after accepted AR-P34 and independent challenge; its focused run follows replacement identity. |
| Q-R04 | Verified partial | The SFA/ABI facet passed. CPU, C64 banking/IRQ, and lowering modules do not exist until Phases 4–5, so exact raster/acknowledge routing remains openly incomplete rather than receiving a false Phase-3 pass. |

### Focused correction run

A fresh evaluator received only the five corrected packets, the candidate Phase-3 references, the
named specification files, and—for Q-L16 only—the three exact live-code ranges. It received no
qualification oracle, prior output, plan, tests, legacy conclusion, or compiler-behavior authority.

| Case | Corrected evaluator verdict | Decisive invariant / bounded conclusion | Exact permitted evidence |
|---|---|---|---|
| Q-L15 | Incorrect downstream behavior | E10241 is the root error; poison may support safe recovery but cannot enter SFA; no output artifact is produced; the internal artifact mechanism remains unspecified. | Ch 02 line 498; Ch 14 lines 54/208; compiler architecture lines 25/104/109 |
| Q-L16 | `Verified partial` | Fact: the plugin is absent from `AnalyzeInput`; only generic profile/registry facts cross the observed seam. Inference: this supports a plugin-free analyzer. The optional encoder wiring may need audit, while wider composition remains unknown; retain narrow facts rather than freeze the current interface. | `platform-plugin.ts:96-185`; `run-frontend.ts:171-183`; `analyze.ts:64-97`; compiler architecture lines 44/69 |
| Q-L20 | Required semantic split | The `const word` is 260 under TS-18 full-precision evaluation/range checking; the ordinary `let word` is 4 after byte-width runtime wrap then widening. Foldability does not select the semantic context. | Ch 02 lines 259/408/418/456; IL lines 103/114 |
| Q-L21 | Proposed lowering incorrect | Exact `&&` and `||` traces preserve left-to-right arguments, opposite short-circuit conditions, MMIO count/order, and SFA-accounted first-argument staging. | Ch 04 lines 189/197; Ch 06 line 267; IL lines 46/81; SFA line 32 |
| Q-L23 | Filesystem/duplicate proposal incorrect; sources agree | Every initializer runs once before `main`; dependency/effect edges and a stable tie-break determine order; exact independent-writer position is unknown without module facts; cycles are E10194. | Ch 10 lines 195/199/201/205/233; F003 line 55; F019 lines 174/426/622 |

The independent correction grader passed all five rows: Q-L15 kept poison inside safe recovery and
did not invent an artifact mechanism; Q-L16 separated supported live facts from bounded inference,
unknowns, and recommendation; Q-L20 preserved the 260/4 context split; Q-L21 preserved all four
short-circuit/MMIO traces; and Q-L23 applied the reconciled initializer schedule without inventing
missing ordering facts. Q-R04 remains the planned explicit partial: its SFA/ABI facet is green,
while CPU/C64/lowering route completion belongs to Phases 4–5.

### Comprehensive candidate run — `BLEND65-SPEC-P3-3344394e`

Two fresh evaluators received only the exact packet rows, the current four Phase-3 knowledge
modules, `source-manifest.md`, and the 50 specification files. Q-L16 additionally received its
three allowlisted live interface ranges. They were forbidden the oracle files, matrix, release
conclusions, plans, compiler tests, legacy conclusions, and prior outputs. This remains an advisory
content run rather than the definitive Phase-7 filesystem-isolated qualification.

Evaluator C (`phase3_eval_c`) covered Q-L01..Q-L17 plus Q-R03. It reported every case as pass and
explicitly declined any release conclusion.

| Case | Captured verdict | Decisive invariant / bounded result | Exact permitted authority used |
|---|---|---|---|
| Q-L01 | Pass | The word loop visits 256 values and may narrow only under proof; the byte form is infinite; module call initializers run once in the dependency/effect schedule; Chapter 14 alone owns public diagnostic fields; all 50 crosswalk paths and roles agree with the candidate digest. | Chapters 03/05/10/14; all 50 crosswalk rows; source-manifest candidate record |
| Q-L02 | Pass | Runtime-address `poke` is legal; preserve one volatile write and return any indirect-pointer storage to SFA; literal-only/unrolled source is a compiler defect. | Chapter 12; F020; IL legalization; architecture restriction triage |
| Q-L03 | Pass | Two `$D012` reads remain two ordered volatile observations; CSE is invalid. | F020; IL memory effects/counterexamples |
| Q-L04 | Pass | Pre-target semantics carries a symbolic volatile capability; the selected platform binds `$D020`. | Chapter 15; architecture frontend/composition boundary |
| Q-L05 | Pass | Proven mutually exclusive, non-escaping siblings may share one compatible four-byte SFA range. | Chapter 11; SFA interference/coloring/proof |
| Q-L06 | Pass | A live caller value interferes with callee storage and therefore cannot share its two bytes. | SFA lifetime/interference; IL counterexamples |
| Q-L07 | Pass | The recursive SCC is E10181 before allocation; no hidden dynamic-frame or software-stack runtime. | Chapter 06; SFA call-graph gate |
| Q-L08 | Pass | Mainline/IRQ helper invocations get disjoint private homes and correct entry/helper exits; the real shared RMW global stays shared and receives W10211. | Chapter 06; SFA execution-domain/ABI rules |
| Q-L09 | Pass | An escaped storage-bearing function without a finite entry/overlap contract is E10245; a checked finite contract or storage-free path is required. | Chapters 06/11; SFA roots/interference |
| Q-L10 | Pass | A two-byte pair cannot start at `$FF`; over-budget placement is E10032 with exact contributors and deficit. | Chapters 03/11; SFA ZP/failure reporting |
| Q-L11 | Pass | SFA remains binding; explicit saves are kind-correct; reachable BRK needs an exact profile contract or E10259. | Introduction; Chapters 11/12/15 |
| Q-L12 | Pass | Representation/pass/class counts wait for observed consumers and proof boundaries. | Architecture seam evaluation; IL responsibilities |
| Q-L13 | Pass | Share only CPU-family legality/lowering; compose Atari-specific memory/devices/startup/packaging rather than copy-patching C64. | Chapter 15; architecture target composition |
| Q-L14 | Pass | Width and signedness, or an already disambiguated relation, survive until their accountable comparison consumer. | Chapters 02/04; IL payload/legalization |
| Q-L15 | Pass | E10241 creates safe poison; malformed typed data cannot enter SFA; all usable output artifacts are suppressed. | Chapters 02/14; architecture diagnostic gate |
| Q-L16 | Pass | Live facts show useful dependency injection but dual profile truths and one cross-layer platform interface; recommendation separates one immutable semantic profile from CPU/platform/emitter/packager contracts without prescribing class count. | Three allowlisted live ranges; architecture seam-evaluation doctrine |
| Q-L17 | Pass | First-argument staging stays live across every transitive later-argument callee and cannot share their homes. | Chapter 06; SFA nested-argument lifetime |
| Q-R03 | Pass | Initializer calls are legal, scheduled once by transitive dependencies/effects, rooted in SFA, and use E10194 for an unschedulable cycle; Chapter 14 owns presentation. | Chapters 03/10/14; semantics initialization/diagnostic doctrine |

Evaluator D (`phase3_eval_d`) covered Q-L18..Q-L33 plus Q-R04. It rejected each deliberately
incorrect proposal, verified the valid contracts, retained Q-L27 and Q-R04 at their designed
partial boundaries, and explicitly declined any release conclusion.

| Case | Captured verdict | Decisive invariant / bounded result | Exact permitted authority used |
|---|---|---|---|
| Q-L18 | Pass — proposal incorrect | The outer call is not active during argument evaluation; stage argument one, complete the inner call, then marshal and invoke the outer call without a recursion error or source split. | Chapter 06; SFA nested-argument contract |
| Q-L19 | Historical pass — invalidated packet | The old packet tested ordinary assignment, not direct subscript integer operations, stable query widths, or aggregate-domain totality. AR-P35–AR-P41 replace this result; the final affected-case section governs. | Chapter 02; IL typed folding |
| Q-L20 | Pass | The `const word` is 260 under full-precision constant evaluation; the `let word` is 4 after runtime-width wrap. | Chapter 02; IL typed folding |
| Q-L21 | Pass — proposal incorrect | Preserve left-to-right arguments, opposite `&&`/`||` short-circuit conditions, and every MMIO write's identity/count/order. | Chapters 04/06; IL CFG/effects |
| Q-L22 | Pass — optimization incorrect | Two arguments retain one shared base and may not be treated disjoint; W10112 applies to proven same-base mutable structs; a const aggregate parameter is transitive compile-time read-only with no ABI or immutability claim. | Chapters 07/08; semantics const aggregate parameter access; SFA aliasing |
| Q-L23 | Pass — proposal incorrect | Actual initializer dependencies precede consumers; ready independent nodes use fully qualified ASCII order with conservative opaque effects; every initializer runs once. | Chapters 03/10; semantics initializer order |
| Q-L24 | Pass — behavior incorrect | Wrong arity is root E10171; causal cascades are suppressed, independent errors remain, and every compilation artifact is suppressed. | Chapters 06/14; architecture diagnostic gate |
| Q-L25 | Pass — behavior incorrect | Late pointer/spill/helper storage returns to SFA and all interference/budgets reclose before emission; no emergency global exists. | Chapter 11; SFA final closure; IL legalization |
| Q-L26 | Pass | Exact CTM v9 validation and selector inventory preserve smallest-lossless, forced-word, packed-12, and split-plane forms; no truncation/hidden companion/implicit offsets; `$2800` placement derives field `$0A` without copy. | Chapter 13; C64 appendix CharPad/placement contracts |
| Q-L27 | Verified partial | The product contract preserves SPD v5 word counts, native records, per-sprite fields, tiles/animations/overlays, explicit derived tables, and placement-derived blocks; tail parsing remains externally unqualified until the Phase-5 producer/schema/fixture gate. | C64 appendix; source-manifest SpritePad evidence boundary |
| Q-L28 | Pass | Exact C64 mode bytes and E10125/E10249/E10251 boundaries are compile-time-only; custom/X16 maps remain unavailable without their own evidence. | Chapters 08/15; C64/CX16 appendices |
| Q-L29 | Pass | Sink selection creates exact no-second-save CINV chain/exclusive or proven raw variants; helpers remain RTS; all costs are reported; visible raw CINV write is E10252. | Chapters 06/15; C64 appendix; source manifest |
| Q-L30 | Pass | Ordinary arithmetic stays binary; explicit BCD owns carry/D state and folds/diagnoses constants; an unsafe raw-D path is E10255; no helper/checker runtime. | Chapters 04/12; IL decimal-state rules |
| Q-L31 | Pass | Only the ordinary three-clause form remains; exact clause/exit/wrap effects lower through generic CFG/SFA; a proved word induction may use `INX/BNE`, while the byte form stays infinite. | Chapter 05; SFA loop lifetime; IL induction proof |
| Q-L32 | Pass | Provenance survives every derivation; contained uses and transitive non-retaining calls are legal; first escape is E10260; sequential homes may reuse and bounded concurrent homes separate; no pin/runtime. | Chapters 04/06/11; IL provenance |
| Q-L33 | Pass | Every PSID version/clock/model/inheritance case is resolved against exact video/endpoint topology and player contract; Unknown embed-only use remains legal, callable use needs closure, known mismatch is E10261, C64U endpoint choice is deployment-only, turbo timing is separate, and no conversion/activation runtime exists. | Chapters 13–15; C64/C64U appendices; source-manifest HVSC/C64U records |
| Q-R04 | Verified partial | The SFA/ABI packet proves disjoint mainline/IRQ private homes and the entry/helper return split; exact raster timing and device acknowledgement remain intentionally unqualified until the Phase-4/5 route exists. | Chapter 06; SFA interference/ABI; IL timing boundary |

### Targeted comprehensive evidence correction

The first comprehensive graders found no invalid oracle, but correctly rejected several compressed
result rows as insufficient release evidence. Two new evaluators therefore received only the
affected raw packets, the current five Phase-3 knowledge modules, and the exact governing
specification corpus. They received no qualification cases, coverage/release conclusions, plans,
tests, implementation behavior, legacy conclusions, or prior evaluator output. Both independently
recomputed the candidate digest as
3344394e69e10c9e9ba6674f2773f514a8634438fe86f5efb3d0db49b4846c27. The material evidence is
preserved below instead of being reduced to a verdict.

#### Q-L01 exact 50-path audit

The evaluator found 50 filesystem paths, 50 unique crosswalk paths, empty set difference, no
duplicate exact path, no duplicate basename, and no duplicate complete-file SHA-256. The
manifest-prescribed digest exactly matched BLEND65-SPEC-P3-3344394e.

| # | Exact path | Authority role | Semantic payload | Compiler/storage/effect consequence | Interaction or failure boundary | Route | Justified N/A |
|---:|---|---|---|---|---|---|---|
| 1 | spec/00-feature-index.md | Discovery index and diagnostic mirror | Axioms, feature-to-chapter map, diagnostic discovery, deferral links | Use as navigation/checksum; do not derive behavior from mirrored summaries | Any mismatch defers to the owning chapter and Chapter 14 | Discovery → owning chapter / Ch 14 | N/A only as independent semantic authority |
| 2 | spec/00-introduction.md | Normative design axioms | Modern C-like source, SFA, deterministic bounded behavior, explicitness, multi-platform scope | All stages must avoid undefined behavior, hidden dynamic storage, and target leakage | Reject unsupported/resource-impossible programs rather than corrupting state | Global invariants → all stages; SFA/target composition | None |
| 3 | spec/01-lexical-structure.md | Normative lexical chapter | UTF-8, tokens, comments, identifiers, literals, escapes, maximal munch, spans | Preserve token spelling/value/span and symbolic escape identity | Lexical recovery must not invent target mappings or lose the root span | Source loader → lexer → parser | None |
| 4 | spec/02-type-system.md | Normative type chapter | Width, signedness, nominal types, promotions, casts, constant/runtime arithmetic, wrap, shifts | Preserve width/signedness/nominal identity until their lowering consumer | Early erasure miscompiles comparisons, shifts, division, wrap, and enum checks | Analyzer → typed semantic form → legalization | None |
| 5 | spec/03-variables.md | Normative declaration/storage chapter | let, const, scope, initialization, module/local/ZP placement | Separate compile-time constants, module storage, local lifetime, and startup evaluation | Omitted initializer emits no write; placement/resource failure is diagnosed | Analyzer → startup scheduler or SFA/platform layout | None |
| 6 | spec/04-expressions-operators.md | Normative expression chapter | Precedence, source-order evaluation, short circuit, casts, address-of, local borrows, memory operations | Retain order, effects, place/value identity, types, aliases, and address provenance | Reordering, eager arm execution, volatile elimination, or escaping &local is invalid | Parser/analyzer → semantic CFG/effects → SFA/legalization | None |
| 7 | spec/05-statements-control-flow.md | Normative statement chapter | Blocks, Boolean conditions, three-clause for, switch, exits | Build explicit CFG with exact clause order, scope, wrap, and exit targets | continue reaches update; break/return skip it; invalid state gets owning diagnostic | Semantic CFG → reachability/liveness → layout | None |
| 8 | spec/06-functions.md | Normative function/ABI chapter | Calls, left-to-right arguments, SFA ABI, recursion rejection, function addresses, interrupt entry variants | Preserve call targets, staging, return ownership, roots, escape, entry ABI, stack-kind state | Recursion, unbounded overlap, sink mismatch, stack mismatch, or local-address escape rejects | Call graph → SFA/ABI → target entry lowering | None |
| 9 | spec/07-structs.md | Normative aggregate chapter | Field order, layout, composition, by-reference passing, copying, aliasing | Preserve aggregate shape, offsets, alignment, base identity, and copy effects | No alias independence without proof; illegal returns/equality/forms diagnose | Analyzer → aggregate/address representation → SFA/layout | None |
| 10 | spec/08-arrays-strings.md | Normative array/text chapter | Static extents, indexing, initialization, encodings/maps, strings, const aggregate parameter access | Preserve extent, element type, address, alias/const effects, and symbolic character mapping | OOB policy, unavailable mappings, unsized storage, or illegal aggregate operations diagnose | Analyzer → encoding/array lowering → SFA/platform layout | None |
| 11 | spec/09-enums.md | Normative enum chapter | Byte representation with nominal identity and checked conversions | Retain enum identity until operation/conversion legality is settled | Premature byte erasure permits invalid cross-enum operations | Analyzer → typed IR → byte legalization | None |
| 12 | spec/10-modules.md | Normative program-structure chapter | Modules/imports/exports, unique main, startup, dependency/effect-ordered initialization | Build complete symbol graph, startup roots, initializer edges, and deterministic schedule | Duplicate/missing entry or initializer cycle rejects; imports alone add no runtime edge | Loader/resolver → whole-program/startup graph | None |
| 13 | spec/11-memory-model.md | Normative memory/SFA chapter | Segments, frame coloring, ZP, hardware-stack capacity, BRK stack edge | Prove all function storage, overlap, placement, explicit-stack state, and final peak | Unknown/unbounded overlap, invalid stack sequence, or resource overrun rejects | SFA/stack analysis → closure → layout | None |
| 14 | spec/12-intrinsics.md | Normative intrinsic/effect chapter | CPU controls, kind-correct explicit stack, BCD, BRK, volatile memory, queries | Model exact ordered machine effects, clobbers, dynamic-address scratch, and BRK successor | Cross-kind pulls, raw-D violations, missing BRK contract, or invalid use rejects | Analyzer/effect IR → target legalization/SFA | None |
| 15 | spec/13-data-inclusion.md | Normative asset chapter | Raw/format-aware embedding, canonical identity, selectors, alignment, metadata, callable audio | Emit selected bytes without runtime copy; retain relocation/format/profile provenance | Bad version/selector/configuration or placement fails closed | Handler → platform layout → artifact packaging | None |
| 16 | spec/14-diagnostics.md | Sole normative public diagnostic registry | Code, severity, canonical template, span shape, help, suppression/promotion, retirement | Owning stage emits one rooted diagnostic, poison, recovery state; any error suppresses artifact | Feature chapter owns trigger predicate; index/evaluations cannot redefine public fields | Owning stage → Ch 14 presentation → driver | None |
| 17 | spec/15-platform-profile.md | Normative target contract | CPU/platform capabilities, budgets, encodings, sinks, entry variants, vectors, BRK, output | Select target facts declaratively; bind ABI, resource, encoding, startup, and packaging facts | Missing/incompatible capability, finite bound, BRK proof, or resource produces target diagnostic | Target selection → legalization/SFA/layout/packager | None |
| 18 | spec/appendix-a7800.md | Normative selected-target profile | Sally/6502C, MARIA/TIA, RAM shadows, 192-byte stack window, ROM/A78, reset startup | One physical owner for aliased RAM; ROM code/data, scarce disjoint mutable/SFA region, A78 vectors | C64 layout/startup/device assumptions are invalid; unqualified handlers remain absent | A7800 profile → backend/layout/startup/A78 packager | N/A when another target is selected |
| 19 | spec/appendix-a800xl.md | Normative selected-target profile | 6502C, ANTIC/GTIA/POKEY, OS/ZP reservations, XEX/RUNAD | Use ordered emitted XEX intervals, omit BSS holes, perform Atari bootstrap and startup schedule | PRG, VIC/SID/CIA, or C64 banking cannot leak into this path | A800XL profile → backend/layout/startup/XEX packager | N/A when another target is selected |
| 20 | spec/appendix-c64.md | Normative primary-target profile | 6510, VIC-II/SID/CIA, PRG, KERNAL CINV variants, character maps, assets/audio, BRK absence | Compose shared 6502 lowering with C64 memory, IRQ, startup, visibility, and PRG rules | No second A/X/Y save at CINV; default BRK rejects; known ABI/config mismatch rejects | C64 profile → backend/layout/library/PRG packager | N/A when another target is selected |
| 21 | spec/appendix-c64u.md | Normative selected-target profile | C64 compatibility plus REU, SID endpoint deployment, turbo separation, compatible CINV aliases | Inherit only explicitly compatible C64 facts; keep SID timing separate from turbo CPU | Patched ROM, raw vectors, multi-SID, or BRK need separately qualified profile facts | C64U profile → selected compatible C64 seams plus C64U layout | N/A when another target is selected |
| 22 | spec/appendix-cx16.md | Normative selected-target profile | 65C02, VERA, banked RAM, PRG/startup, raw text baseline | Select 65C02 legality and X16 platform facts independently | No 65C02 opcode on NMOS targets; no VIC/C64 map inheritance | CX16 profile → CPU lowering/layout/startup/PRG packager | N/A when another target is selected |
| 23 | spec/build-plan.md | Historical plan | Spec-writing phases, chapter map, prior risks/status | May explain document intent only | Cannot override completed chapters or create compiler behavior | Historical context → confirm in live chapter | N/A for current runtime semantics |
| 24 | spec/evaluations/F001-multi-file.md | Subordinate evaluation rationale | Source discovery, module/file merge, deterministic multi-file compilation | Preserve source/module identity and stable diagnostics | Final module chapter controls conflicts | Rationale → Ch 10 | None as intent evidence; not independent authority |
| 25 | spec/evaluations/F002-modules.md | Subordinate evaluation rationale | Module syntax/name/file relationship | Retain module identity and source spans through resolution | Chapter 10 wins any mismatch | Rationale → Ch 10 | None as intent evidence |
| 26 | spec/evaluations/F003-module-contents.md | Subordinate evaluation rationale | Legal declarations, visibility, universal explicit-initializer behavior | Classify declaration/storage and include call/effect facts in startup scheduling | No initializer means no write; callable initializers remain governed by Ch 10 | Rationale → Ch 03/10 | None as intent evidence |
| 27 | spec/evaluations/F004-entry-point.md | Subordinate evaluation rationale | Unique main, signature, startup invocation, non-callability | Mark one program entry root and suppress invalid artifacts | Invalid entry configuration diagnoses before packaging | Rationale → Ch 06/10 | None as intent evidence |
| 28 | spec/evaluations/F005-memory-placement.md | Subordinate evaluation rationale | Module/function/ZP/const placement and budgets | Carry symbolic storage class/placement request to correct allocator | Resource conflicts must be explained, not silently relocated where semantics differ | Rationale → Ch 03/11/15 | None as intent evidence |
| 29 | spec/evaluations/F006-address-of.md | Subordinate evaluation rationale | Addressable objects/functions, symbolic code/data addresses | Preserve identity, provenance, address-taken reachability, escape, relocation | Invalid target or escaping local address is rejected by governing chapters | Rationale → Ch 04/06/11 | None as intent evidence |
| 30 | spec/evaluations/F007-interrupt-functions.md | Subordinate evaluation rationale | Callback-only handlers, raw/firmware entry, domains, reentrancy, shared state | Model complete mainline/IRQ/NMI/helper closure and allocate private overlapping homes | Unbounded overlap E10245; ABI mismatches E10244/E10247/E10252 | Rationale → Ch 06/11/15 | None as intent evidence |
| 31 | spec/evaluations/F008-for-loop.md | Subordinate evaluation rationale | Three-clause order, scope/mutation/wrap, canonical induction | Generic CFG is always valid; optional proof may recover expert induction form | Byte <256 is infinite; word <256 is 256 iterations | Rationale → Ch 05 plus type/effect rules | None as intent/cost evidence |
| 32 | spec/evaluations/F009-switch-statement.md | Subordinate evaluation rationale | Auto-break, explicit fallthrough, cases/default, code-selection choices | Preserve case order, scope, fallthrough, comparison type, CFG | Illegal cases/fallthrough diagnose; lowering choice remains cost-driven | Rationale → Ch 05 | None as intent/cost evidence |
| 33 | spec/evaluations/F010-signed-types.md | Subordinate evaluation rationale | Signed ranges, casts, comparisons, shifts, overflow | Retain signedness and width through selection; establish every consumed flag | CMP does not set V; stale-V signed compare is invalid | Rationale → Ch 02/04 | None as intent/lowering evidence |
| 34 | spec/evaluations/F011-structs.md | Subordinate evaluation rationale | Layout, nesting, references, aliasing, access cost | Retain offsets/base identity/alias-visible order; account pointer homes | Cost cannot become an expressiveness restriction; alias warning needs proof | Rationale → Ch 07/11 | None as intent/cost evidence |
| 35 | spec/evaluations/F012-cpu-control-intrinsics.md | Subordinate evaluation rationale | Thirteen controls, BCD, kind stack, BRK, barriers | Preserve exact opcode/effect, per-function kind sequence, D state, BRK contract | E10248/E10245/E10255/E10259 own distinct failures | Rationale → Ch 11/12/15 | None as reconciled low-level intent |
| 36 | spec/evaluations/F013-control-flow.md | Subordinate evaluation rationale | General branches/loops, scopes, assignment/return completeness | Build CFG, definite-assignment and reachability state | Invalid Boolean/scope/return paths use owning diagnostics | Rationale → Ch 05 | None as intent/lowering evidence |
| 37 | spec/evaluations/F014-arrays.md | Subordinate evaluation rationale | Arrays, strings, const parameters, encoding, two-tier indexing | Preserve extent/type/address/alias/const/map identity; keep SoA optional | Static extent, bounds, mapping, or const failures diagnose | Rationale → Ch 08/15 | None as intent/cost evidence |
| 38 | spec/evaluations/F015-data-inclusion.md | Subordinate evaluation rationale | Raw/handled embed, selectors, versions, alignment, metadata, outputs | Keep data/relocations symbolic; handler selects representation; layout owns placement | Unknown selector/version/configuration fails closed; no implicit conversion/copy | Rationale → Ch 13/15/appendix | None as intent/handler evidence |
| 39 | spec/evaluations/F016-type-system.md | Subordinate evaluation rationale | Type table, promotions, casts, constants, intermediate width | One semantic model must preserve specified constant/runtime distinctions | Destination type cannot retroactively widen an intermediate | Rationale → Ch 02 | None as intent evidence |
| 40 | spec/evaluations/F017-operators.md | Subordinate evaluation rationale | Operators, short circuit, expensive arithmetic, comparisons/shifts | Preserve effects/types; choose helper/strength reduction only after complete cost proof | Invalid zero/sign/width assumptions or hidden helper costs defeat transformation | Rationale → Ch 02/04/12 | None as intent/cost evidence |
| 41 | spec/evaluations/F018-functions.md | Subordinate evaluation rationale | Calls, SFA, argument order, recursion, function addresses, stack state | Build roots/call graph/staging/homes/clobbers and preserve address provenance | Recursion, unknown overlap, invalid callback ABI or stack sequence rejects | Rationale → Ch 06/11 | None as function/ABI evidence |
| 42 | spec/evaluations/F019-variables.md | Subordinate evaluation rationale | Initialization, module startup, locals, definite assignment, constants | Schedule each explicit module initializer once; no blanket clearing | Initializer cycles E10194; uninitialized reads retain ordinary warning behavior | Rationale → Ch 03/10 | None as startup intent evidence |
| 43 | spec/evaluations/F020-memory-intrinsics.md | Subordinate evaluation rationale | peek/poke, dynamic addresses, word order, size/element-count queries | Preserve every access exactly once/in order; SFA owns indirect pointer scratch and any-size parameter state | No commoning/deletion/reordering of intrinsic accesses | Rationale → Ch 04/12/11 | None as effect/lowering evidence |
| 44 | spec/evaluations/F021-lexical-structure.md | Subordinate evaluation rationale | Complete token inventory, literals, escapes, positions, ambiguities | Deterministic maximal munch and recoverable exact spans | Target encoding availability is semantic, not lexical | Rationale → Ch 01/08 | None as lexical intent evidence |
| 45 | spec/evaluations/F022-enums.md | Subordinate evaluation rationale | Byte-backed nominal enums, casts, member resolution | Preserve nominal identity through semantic validation | Byte representation does not authorize cross-enum interchange | Rationale → Ch 09/02 | None as enum intent evidence |
| 46 | spec/evaluations/F024-conditional-operator.md | Subordinate evaluation rationale | Boolean condition, selected-arm-only evaluation, type unification | Build branch/merge value; preserve unchosen-arm non-effects and right association | Eager evaluation or invalid arm unification is wrong | Rationale → Ch 04/02 | None as intent/lowering evidence |
| 47 | spec/future-considerations.md | Deferral/reconsideration authority, not live behavior | Deferred and rejected capabilities with expiry triggers | Do not implement deferred behavior; reopen when the stated reason expires | A future item cannot silently alter v3 semantics | Closeout/reconsideration → new decision/spec work | N/A for current semantics |
| 48 | spec/grammar.ebnf.md | Derived conformance grammar | Consolidated syntax and ambiguity boundaries | Parser acceptance must track syntax-owning chapters | Any contradiction is fixed in the grammar; grammar cannot overrule a chapter | Chapters → maintained grammar → parser conformance | N/A as independent authority |
| 49 | spec/preflight-report.md | Historical audit context | Earlier ambiguities, integrity checks, recommended fixes | Use only to locate history requiring confirmation | Stale recommendations do not govern current behavior | Historical pointer → live chapter | N/A for current semantics |
| 50 | spec/v2-to-v3-migration.md | Migration context | Removed/changed v2 constructs and v3 replacement direction | Detect legacy carryover; never restore v2 behavior absent v3 authority | No blanket BSS clear, generic data copy, or legacy construct by inertia | Migration diagnosis → current chapter | N/A as independent current authority |

The same evaluation resolved the three packet examples without a conflict. A semantic-word
0-to-255 loop executes 256 iterations and may use an 8-bit machine induction only under a
non-observability proof; a byte loop with condition below 256 wraps and is infinite. An explicit
module let initializer may call ordinary non-void functions, runs exactly once in the
dependency/effect schedule, and roots its complete storage/helper closure. Chapter 14 alone owns
public diagnostic code, severity, template, spans, help, suppression, promotion, and retirement;
the feature chapter owns only the trigger and semantic consequence.

The packet's two non-language conclusions were also separated correctly. ACME is the current
selected assembler by product/toolchain policy, not by the language specification or an ACME
manual. A measured parity result that only meets rather than beats the expert floor creates an
authorized GitHub debt issue recording the exact cost delta and path to the win, but never
authorizes a push. These conclusions are bound only to
BLEND65-PROJECT-POLICY-P3-3541841b, the SHA-256
3541841b1ec1c4dc84a29821f046879f6eeaf029578cfa21fe21c6e2a58dd1c3 snapshot of repository
AGENTS.md headings “PRIME DIRECTIVE — expert assembly game developer,” “PRIME DIRECTIVE —
workflow, audience & decisions,” and “Environment & dependencies,” as recorded in
references/source-manifest.md under that source key. Any change invalidates the policy key and
requires impact review.

#### Q-L08, Q-L09, Q-L11, Q-L12, Q-L13, Q-L14, and Q-L17 correction evidence

| Case | Preserved correction evidence |
|---|---|
| Q-L08 | Reachability starts from startup, every initializer, main, IRQ/NMI, recognized callbacks, address-taken/exported/external/raw-vector entries, then closes over direct calls, finite indirect sets, and legalization-selected helpers. Invocation-private parameters, returns, locals, staging, temporaries, spills, ZP pairs, helper scratch, and saved state get disjoint homes for simultaneous mainline/IRQ/NMI/callback activations. Globals, explicit module ZP, assets, tables, shared buffers, and MMIO remain genuinely shared. Frame separation does not make RMW atomic or multi-byte access tear-free; W10211 reports provable shared RMW. Finite profile-proven nesting allocates and reports enough RAM/ZP/ROM/stack instances; an unbounded storage/stack re-entry cycle is E10245, while finite capacity failure keeps its resource diagnostic. Raw entry ends RTI, firmware entry uses its declared chain/restore tail, helpers remain JSR/RTS; E10244, E10247, and E10252 keep their distinct mismatch predicates. |
| Q-L09 | An address-taken/exported storage-bearing function crossing an opaque boundary remains a root with its full helper/storage closure. Unknown entry time is an unknown edge, not no edge: ABI, domain, clobbers, preemption, return convention, and finite overlap must be contracted. Otherwise E10245 rejects the unbounded path. If one closure costs R RAM, Z ZP, and C body bytes, a bound N costs up to N×R and N×Z before proven coloring; fixed-address specialization may duplicate the affected code toward N×C. The concrete three-activation example costs 12 RAM, 6 ZP, and 60 ROM for a duplicated 20-byte fixed-address body. Remove the escape or use a finite recognized contract; do not pin locals or add dynamic frames. |
| Q-L11 | SFA remains the only general frame model. Hardware stack ownership stays separate: two bytes per active JSR return; three CPU bytes per interrupt/BRK; selected compiler/firmware ABI saves; one byte per live explicit PHA/PHP; and a contract's complete handler peak. Kind analysis appends/removes A-save or P-save, requires matching tops, identical sequences at joins/backedges, and an empty relative sequence at every exit. It may never consume caller return, CPU, compiler, or firmware bytes. E10248 owns finite kind/state errors; E10245 owns unbounded growth. asm_brk emits exactly $00 $EA, costs two ROM bytes and seven base cycles, charges CPU 3 + contract handler peak, follows only a declared returning-after-padding or nonreturning edge, and otherwise is E10259. No runtime, vector, handler, catch path, debugger bridge, or SFA storage is synthesized. |
| Q-L12 | No IR/pass/class count is frozen. Required proof boundaries are: source/token/span; parse/grammar; semantic type/effect/diagnostic; semantic CFG/order/place/alias/symbolic storage; whole-program roots/calls/effects/lifetimes; SFA interference/budgets; target legalization plus all new scratch/helpers; instruction legality/flags/cost; register/ZP/static binding; machine optimization/layout/branch repair with termination; terminal dialect emission; platform startup/packaging; and driver poison/artifact policy. Payload includes width, signedness, arithmetic context, nominal identity, place/value, order, effects, volatility, aliases, escape, storage/lifetime, placement/bank, calls/clobbers/entry variant, and source association. Adjacent responsibilities may combine only when these proofs and consumers remain explicit. |
| Q-L13 | Target composition separates CPU legality/lowering, machine platform/device/startup/layout, emitter dialect, assembler/serializer, and artifact packager. Shared work is limited to target-neutral semantics/CFG/effects, whole-program analysis, SFA/stack algorithms, proven common 6502 operations, and a deliberately shared selected emitter. C64 VIC/SID/CIA, banking, KERNAL, PRG and encoding cannot be copy-patched into Atari ANTIC/GTIA/POKEY or MARIA/TIA, RAM-shadow, XEX/A78/vector contracts. Machine operations stay structured until terminal emission; ACME policy and its pinned behavior do not establish Atari packaging. |
| Q-L14 | Width, signedness, nominal identity, source order/effects, place, alias, volatility, and source identity survive until their accountable consumers. CMP does not define V, so a signed ordered branch using N xor V after CMP is invalid unless a sequence independently establishes the relation and every flag. Same-width byte↔sbyte and word↔sword casts preserve bits and cost no conversion instruction, but do not alias distinct objects: observable assignment still transfers the value. Coalescing requires ordinary liveness, alias, volatility/effect, call, and execution-domain proof; a bit-identical cast is not proof. |
| Q-L17 | For an effectful first argument A followed by g(), the exact visible order is all A effects, then all effects in g and its transitive callees, then f's body effects. A is evaluated once and its result stays live across the entire g closure; the g result then stays live until marshalling/consumption. Neither staging home may share with an overlapping parameter/local/temporary/spill/helper or feasible IRQ/NMI activation. If g can reach f, early placement into f's parameter home is unsound. Use caller staging or another proven non-clobbered home; all new storage returns to SFA. |

The following fields make the evaluator's finding, assumptions, remedy, and authority independently
gradeable. Every status is advisory under the unqualified construction version; none is a release
claim.

| Case | Status and assumptions | Finding | Smallest viable remedy | Exact governing location |
|---|---|---|---|---|
| Q-L08 | Determined for the supplied graph; selected profile supplies finite preemption/nesting and sink ABI facts. | Direct-edge-only allocation, cloned shared state, or one private home across overlapping domains would corrupt observable state. | Close roots over every source/generated edge, allocate only invocation-private state per proven peak, preserve shared state, and reject an unbounded storage-bearing cycle. | spec/06-functions.md “Interrupt functions,” especially §§7.3–7.6 and “Diagnostics”; spec/11-memory-model.md “Static Frame Allocation”; references/sfa-and-abi.md “Execution domains and interrupt interference,” “ABI ownership,” and “Failure model”; spec/14-diagnostics.md E10244/E10245/E10247/E10252 and W10211. |
| Q-L09 | Determined for a storage-bearing address-taken/exported function crossing an opaque caller boundary with no finite contract. | Treating the absent visible caller as no edge is unsound and leaves overlap, ABI, stack, and storage unbounded. | Remove the escape or supply a recognized finite entry/domain/preemption/ABI contract; otherwise E10245. | spec/06-functions.md “Function addresses and callbacks” and “Reentrancy and invocation overlap”; spec/11-memory-model.md “SFA allocation” and “Allocation failure”; references/sfa-and-abi.md “Root, escape, and overlap closure” and “Failure model”; spec/14-diagnostics.md E10245/E10247. |
| Q-L11 | Determined for SFA-governed frames, path-sensitive explicit stack operations, and a reachable BRK on the selected profile. | General stack locals, byte-depth-only pull validation, or free BRK fallthrough violates separate stack ownership and control-flow proof. | Keep general storage in SFA; track exact A-save/P-save sequences; require a profile BRK contract and charge its exact edge, or emit E10259. | spec/00-introduction.md A2; spec/06-functions.md “Stack accounting”; spec/11-memory-model.md “Hardware stack” and “Static Frame Allocation”; spec/12-intrinsics.md “Explicit stack intrinsics” and “Software interrupt”; spec/15-platform-profile.md “Software-interrupt contract”; references/sfa-and-abi.md “Hardware-stack ownership” and “SFA remains binding”; spec/14-diagnostics.md E10245/E10248/E10259. |
| Q-L12 | Determined only at responsibility/proof level; exact topology is explicitly unknown until the live repository and consumers are audited. | Freezing an idealized count before that audit can either merge incompatible proofs or create unused layers. | Audit live producers/consumers first, then use the smallest topology that preserves every listed boundary; combine or split only with evidence. | references/compiler-architecture.md “Responsibility map,” “Boundary-preservation contract,” “Evaluation before topology,” and “Emission is a terminal translation”; references/il-and-optimization.md “Representation responsibilities,” “Legalization and final closure,” and “Two-oracle proof.” |
| Q-L13 | Determined for the target-composition design; actual Atari implementation completeness remains unaudited. | Copying C64 and replacing addresses conflates CPU, platform/device, dialect emission, serialization, and packaging. | Share only proven neutral/common work and select each CPU/platform/emitter/packager contract independently. | spec/00-introduction.md A5; spec/15-platform-profile.md “Composition model”; spec/appendix-c64.md, spec/appendix-a800xl.md, and spec/appendix-a7800.md profile/packaging sections; references/compiler-architecture.md “Target composition” and “Emission is a terminal translation”; references/il-and-optimization.md “Target transition.” |
| Q-L14 | Determined for same-width casts and ordered comparisons; coalescing remains conditional on the complete program proof. | Erasing signedness asks the backend to guess, and treating a zero-instruction cast as object aliasing changes observable state. | Retain typed relations or width/signedness through legalization and coalesce only after ordinary liveness/alias/effect/call/domain proof. | spec/02-type-system.md “Signed integer types,” “Explicit casts,” and “Comparison results”; spec/04-expressions-operators.md “Comparison operators”; references/il-and-optimization.md “Required semantic payload”; references/sfa-and-abi.md “Interference and coloring.” |
| Q-L17 | Determined for the supplied nested call; A denotes the packet's effectful first-argument expression producing 1. | Reusing its live staging home across g or marshalling into f's fixed home before a transitive g→f call can overwrite the value and reorder effects. | Preserve left-to-right evaluation with caller-side/delayed staging and return every new home to final SFA closure. | spec/06-functions.md “Call semantics,” “Argument evaluation and static staging,” and the nested-call examples; references/sfa-and-abi.md “Nested-call staging lifetime” and “Interference and coloring”; references/il-and-optimization.md “Observable order and effects.” |

#### Q-L22, Q-L23, Q-L26, and Q-L28 correction evidence

| Case | Preserved correction evidence | Exact permitted authority |
|---|---|---|
| Q-L22 | Struct/array arguments carry base addresses and evaluate exactly once left-to-right. Passing mutable p twice makes both parameters share one base. For write a.x=1; read b.x; write b.x=2; read a.x, the reads are 1 then 2, final p.x is 2, and no optimizer/SFA step may infer independence or reorder the alias-visible operations. Proven same-base mutable structs produce W10112; may-alias uncertainty does not warn but still cannot justify independence. A const aggregate parameter access permits transitive reads, makes writes E10123, cannot flow into mutable aggregate positions, keeps the same base-address ABI, and costs zero runtime. It does not freeze storage against another mutable alias, IRQ, hardware, or external change. Scalar/enum const parameters remain E10246. | spec/06-functions.md:103-143,260-271; spec/07-structs.md:283-295; spec/08-arrays-strings.md:456-501; sfa-and-abi.md:233-235; blend65-semantics.md:211-224 |
| Q-L23 | Import syntax creates named local access and permits circular declaration imports; import alone creates no runtime edge. Every explicit module/global or ZP let initializer forms one graph and executes once before main; const initialization is compile-time only. Direct/transitive reads and transitive call effects create predecessor edges; compound assignment reads and writes; opaque MMIO/raw effects are conservative barriers. Ready nodes use fully qualified Module.Path.variable names in case-sensitive ASCII order. File paths, declaration-file order, and command-line/input order have no language meaning. A real dependency/effect cycle is E10194 with its closing path. Startup and all initializer callees root complete SFA/helper closure and reported storage/ROM/cycles. | spec/10-modules.md:107-150,184-229; blend65-semantics.md:259-266 |
| Q-L26 common handler | Both embed arguments are literals: nonliteral path E10136; present nonliteral selector E10250. Extension only nominates a handler; full signature/version/structure validates before selectors. Malformed/unsupported input is E10204, omitted selector with no default E10132, unknown/empty selector E10133, handler type mismatch E10144, explicit extent mismatch E10140. Keys are opaque, exact, and case-sensitive. Output is immutable/directly placed, with no runtime conversion. Canonical-identical path + resolved selector + representation aliases one emitted object/address with W10151; distinct selectors/representations remain distinct. | spec/13-data-inclusion.md:32-62,103-145,159-182 |
| Q-L26 CharPad | The pinned identity is CharPad C64 Pro 3.88 CTM v9: bytes 0..2 are CTM, byte 3 is 9, and full flags/counts/dimensions/optional blocks/payload/reference bounds/EOF validate. It has no default. Exact keys: charset; tiles and map canonical byte-or-word; tiles_word/map_word forced LE word; tiles_packed12/map_packed12; tiles_low/high and map_low/high independent planes; colors; color_method byte; map_width/map_height word; tile_width/tile_height byte (1 without tile layer); tile_mode boolean. Canonical is byte when max index ≤255, otherwise LE word, never truncation. Packed12 emits N low bytes then ceil(N/2) high-nibble bytes, with high byte j = low-nibble of v[2j] high part OR high-nibble of v[2j+1] high part; odd final upper nibble is zero. $123,$456,$789 emits $23,$56,$89,$41,$07. Packed selector is absent/E10133 if layer absent or any value exceeds $FFF. Only requested forms emit; no hidden companion, flattening, derived colors/base/offsets. charset has 2048-byte alignment and selected-bank visibility; vicCharsetSelect computes ((bankOffset/2048)&7)<<1, so charset at $2800 in VIC bank 0 yields $0A, with no runtime code/copy. Platform layout owns assets; SFA does not move/duplicate them. | spec/appendix-c64.md:324-382; sfa-and-abi.md:39-57 |
| Q-L26 Koala | Exactly 10,003 bytes: LE load address $6000, 8,000 bitmap, 1,000 screen, 1,000 color RAM, one background byte. Exact boundaries/EOF and zero high nibbles for color/background validate; metadata address bytes never emit. Wrong structure is E10204. No default. Exact outputs: bitmap byte[8000], screen byte[1000], color_ram byte[1000], background byte. Only selected component emits. vicBitmapSelect requires common selected-bank visibility and 8-KiB alignment, returning ((bankOffset/$2000)&1)<<3. vicScreenSelect requires same bank and 1-KiB alignment, returning ((bankOffset/$0400)&$0F)<<4. Both are compile-time only. Color RAM is hardware at $D800 and requires a source-requested, costed transfer; the handler hides none. | spec/appendix-c64.md:521-553 |
| Q-L28 | Exact C64 sentinels are: default screen_codes AZ0 £↑← = $01,$1A,$30,$20,$1C,$1E,$1F; screen lower_upper Az = $41,$1A; PETSCII upper_graphics AZ0 £↑← plus LF/CR = $41,$5A,$30,$20,$5C,$5E,$5F,$0D,$0D; PETSCII lower_upper Az = $C1,$5A. Unwrapped C64 literals default to screen upper_graphics. Named maps are literal upper_graphics/lower_upper and affect only their literal. Unknown/unavailable intrinsic/map is E10125; a scalar/escape/character not representable by one byte is E10249; nonliteral map is E10251. Exact \0 and \xNN bypass mapping. No normalization, transliteration, replacement, table, helper, register write, charset switch, or runtime code occurs. Custom charsets need explicit versioned scalar-to-glyph metadata; without it, exact bytes and generated symbols remain legal. X16 currently has raw ASCII only and no PETSCII/screen intrinsic; C64 maps cannot be inferred. | spec/08-arrays-strings.md:290-352,382-409; spec/15-platform-profile.md:163-181; spec/appendix-c64.md:180-255; spec/appendix-cx16.md:161-183; blend65-semantics.md:238-257 |

#### Q-L29 exact C64 interrupt-sink correction evidence

All source handlers are callback-only interrupt functions. Recognized sinks preserve their source
identity and choose the sink-specific entry; ordinary helpers remain JSR/RTS.

| Sink | Exact entry/body/exit contract | Fixed cost and proof boundary |
|---|---|---|
| c64.system.setIRQ | CPU pushes PCH/PCL/P; KERNAL 901227-03 PULS/PULS1 saves A/X/Y and dispatches through CINV $0314/$0315; generated code does not save them again. It executes PHP; CLD; acknowledged handler body; PLP; JMP (saved_previous_cinv). PLP restores the CINV-entry status for the previous handler. The previous link is saved and replacement installed atomically in a caller-preserving interrupt-disabled critical section. | Body entry has 7 live bytes: CPU 3 + KERNAL 3 + compiler PHP 1. Wrapper is 3 bytes/9 cycles/1 stack byte; tail is 3 bytes/5 cycles plus chained handler; saved link is 2 RAM bytes. Link start $xxFE is legal, $xxFF must relocate/fail because NMOS indirect JMP wraps the high-byte fetch. |
| c64.system.setIRQExclusive | Same six-byte CPU+KERNAL entry frame; generated code is CLD; acknowledged body; JMP $EA81, whose exact ROM tail pulls Y/X/A and RTI. No second saves, no extra status push, no chain. Program owns/handles/disables every enabled reachable IRQ source. | Body entry 6 bytes. Normalization 1 byte/2 cycles; jump 3 bytes/3 cycles; KERNAL restore+RTI tail 22 cycles; no static link. |
| c64.system.setRawIRQ | Available only when the selected profile proves $FFFE/$FFFF writable and active. Exact generated sequence: PHA; TXA; PHA; TYA; PHA; CLD; body; PLA; TAY; PLA; TAX; PLA; RTI. | CPU 3 plus compiler A/X/Y 3 gives 6 live body-entry bytes. Fixed generated overhead is 12 bytes/37 cycles. CLD establishes binary Blend65 entry; RTI restores status. |

The handler body, not the compiler, acknowledges the selected VIC/CIA/other source. Only reachable
variants emit. Overlapping execution domains receive disjoint complete SFA homes; storage-free code
may share; unbounded storage-bearing overlap is E10245. Stack reports include the selected entry,
two bytes per active nested call, explicit pushes, and cumulative overlapping entries. Visible
pokew($0314,&handler) is E10252 because the raw address is incompatible with post-save CINV; an
opaque write remains unsafe/reachable but uncertified. No runtime table, dispatcher, selector,
wrapper stack, or linked runtime exists. Governing locations are spec/06-functions.md:573-765,
spec/15-platform-profile.md:256-275,398-400, and spec/appendix-c64.md:592-624.

#### Q-L30 exact packed-BCD correction evidence

Accepted operations are same-width unsigned byte/byte or word/word bcd_add and bcd_sub; signed or
mixed widths are E10172. Arguments evaluate once left-to-right. Each byte is two decimal nibbles,
each word four. Add owns initial C=0; subtract owns C=1 as no incoming borrow. Word operations
process low byte first and propagate carry/no-borrow. Final carry/borrow is discarded: byte wraps
modulo 100 and word modulo 10,000 ($99+$01→$00; $00-$01→$99). D is clear on every exit.

Two valid constants fold with those rules; known invalid digits are E10254. Runtime-invalid digits
produce the selected CPU's exact bytewise decimal ADC/SBC result under the owned carry sequence;
there is no portable invented result, default check, trap, helper, or scratch. IL retains a distinct
BCD operation, width, operand order, validity facts, carry/no-borrow input, modulo result, full flag
effects, and D-clear exit.

After operand staging, byte lowering is SED; CLC or SEC; ADC or SBC right; store if needed; CLD.
Word lowering is SED; CLC/SEC; LDA left low; ADC/SBC right low; STA result low; LDA left high;
ADC/SBC right high; STA result high; CLD. Addressing/materialization varies, but this semantic
sequence does not. Adjacent BCD regions may coalesce only when each carry input remains explicit,
no ordinary arithmetic/address formation/call occurs, CFG D states agree, every IRQ/NMI restores
D, and all exits clear D. Otherwise keep separate regions. Raw asm_sed does not reinterpret normal
arithmetic; E10255 owns the first unsafe arithmetic, address calculation, call, terminal, or
mismatched join before asm_cld. W10120 is retired. Constant folds cost zero; runtime lowering is
inline; selected instructions/materialization and any SFA temporary are reported. No
addressing-independent fixed cost is claimed. Authorities: spec/12-intrinsics.md:78-95,155-184;
spec/14-diagnostics.md:339-341; il-and-optimization.md:161-174; blend65-semantics.md:319.

#### Q-L31 exact three-clause for correction evidence

The grammar is for ( optional initializer ; optional expression ; optional update ) block. The
initializer is one ordinary local let/const declaration or a nonempty expression list; the update
is a nonempty expression list when present. Both semicolons are mandatory. The statement parser
owns punctuation/body and delegates expressions to the ordinary expression parser; only top-level
commas split the two lists. There is no comma operator, increment/decrement, separate Pratt
grammar, range IR, iterator, frame, or runtime object.

Execution enters the loop scope, evaluates initializer once, tests the condition before each
iteration (omission means true), runs the body, and sends normal completion/continue through the
left-to-right update list before retesting. Break and return skip update. A present condition must
be Boolean (E10100). The header declaration's scope covers condition/update/body only; the body is
nested; ordinary let/const, no-shadowing, effects, conversions, and fixed-width wrap rules apply.
The former until/to/downto/step words are ordinary identifiers and the range diagnostics
E10060/E10061/E10062/E10064/W10060 are retired.

Generic CFG lowering is always correct. A proof-based canonical induction optimization must prove
initial value, invariant bound, stride, alias/escape safety, body/call effects, all exits, and every
observable induction value. A nonescaping word 0..<256 whose body needs only the low byte may use
LDX #0; body; INX; BNE for exactly 256 iterations. A byte counter with condition below 256 remains
infinite; a failed proof falls back to the generic form. Every selected form reports bytes, cycles,
register/flag clobbers, traffic, RAM/ZP, materialization, and spills. Authorities:
spec/05-statements-control-flow.md:203-329; spec/grammar.ebnf.md:217-233;
spec/evaluations/F008-for-loop.md:35-54; il-and-optimization.md:182-196.

The header local and every initializer/condition/update/body temporary use the same CFG liveness,
interference, execution-domain, and final SFA closure rules as any other local; the optimization
does not create a second storage model. For the exact body-excluded canonical sequence, LDX #0 is
2 bytes/2 cycles, INX is 1 byte/2 cycles per iteration, and BNE is 2 bytes with 3 cycles for each
of 255 taken branches and 2 cycles for the final fallthrough. Loop-control code is therefore
5 bytes and 1,281 cycles across 256 iterations, excluding body and surrounding materialization.
It occupies/clobbers X and updates N/Z through INX; BNE consumes Z. The transform is illegal when
the body's register/flag needs cannot be reconciled without a separately costed save, spill, or
different selected form.

#### Q-L32 exact local-borrow correction evidence

An &local word carries hidden origin provenance and is bounded by the local block, current loop
incarnation, and containing invocation. Identity copies, casts, conditional selection, lo/hi,
arithmetic, bitwise derivation, and multi-origin combinations retain every dependency. Data loaded
through the address is the provenance cutoff. A local scalar/aggregate may contain the address only
when its entire lifetime is contained in every referent lifetime.

Legal uses are immediate memory access, contained local storage, and a parameter position proven
non-retaining on every reachable path. Retention summaries are per position, transitive, and
whole-program; platform positions need explicit contracts, and synchronous alone is insufficient.
Legal calls extend liveness through the entire call/helper chain and all feasible preemptions.
E10260 reports the first escape with origin/path for return, global/ZP/raw/MMIO store, insufficiently
contained object, IRQ/hardware publication, retaining/unknown/external/unproven parameter,
unproven forwarding, or opaque proof-destroying transformation.

After the last legal use and source lifetime, sequential calls/loop incarnations may reuse a home.
Bounded simultaneous mainline/IRQ/NMI/callback domains get disjoint complete homes and, when fixed
addresses differ, zero-cost home-specific code variants. Unbounded self-overlap is E10245.
Persistent addresses must instead use module or caller-owned storage. No heap, runtime check,
ownership runtime, hidden persistent home, static-local conversion, or pin is added. All ROM/RAM/ZP
variants/homes are reported. Authorities: spec/04-expressions-operators.md:323-379;
spec/06-functions.md:323-335; spec/11-memory-model.md:118-132,322-329;
sfa-and-abi.md:77-122.

#### Q-L33 exact SID/profile correction evidence

Any C64/C64U profile registering SID assets/audio requires video_standard pal|ntsc and a nonempty
ordered sid_chips list of exact address plus mos6581|mos8580 model records. Current baseline is one
$D400 MOS6581-compatible endpoint. clock_mhz is derived/validated data, not identity.

| Standard | Cycles/s | clock_mhz | Raster | Cycles/frame | Derived fps |
|---|---:|---:|---|---:|---:|
| PAL | 985,248 | 0.985248 | 312 × 63 | 19,656 | ≈50.124542 |
| NTSC | 1,022,730 | 1.022730 | 263 × 65 | 17,095 | ≈59.826265 |

PAL-N, early NTSC, tolerances, and other revisions stay excluded. PSID v1 has no clock/model flags
and makes no claim. PSID v2NG-v4 uses this exact matrix:

| Field | 00 | 01 | 10 | 11 |
|---|---|---|---|---|
| Video bits 2–3 | Unknown | PAL | NTSC | PAL and NTSC |
| Primary model bits 4–5 | Unknown | MOS6581 | MOS8580 | both models |
| Second model bits 6–7, v3+ | inherit primary | MOS6581 | MOS8580 | both models |
| Third model bits 8–9, v4+ | inherit primary | MOS6581 | MOS8580 | both models |

Specific sets must contain the selected profile value. Unknown asserts no restriction but provides
no proof: embedding remains legal, callable audio requires an exact hash-bound player contract
covering video and the complete ordered topology. It may close Unknown but cannot contradict a
specific header. Secondary/tertiary addresses and inherited/resolved models must exist exactly in
the profile and player contract. Current one-SID baselines reject second/third SID as E10261; C64U
extras require a separate qualified profile/player contract. Plain PSID never supplies it.

The player contract owns init/tick/song/SFX/voice forms, ABI/clobbers, writable/self-modifying
ranges, placement/banking, cadence, domains, IRQ/CIA/SID ownership, arbitration, reentrancy, and
complete code/data/RAM/ZP/stack/cycle costs. audioTick is one source-scheduled update; constant
operations lower to direct register setup plus absolute JSR. No dispatcher, scheduler, mixer,
queue, copy, name lookup, or linked runtime exists. On C64U, $D400 may be a physical SID or
UltiSID; that is a deployment precondition, not runtime discovery/configuration/activation. Turbo
CPU speed needs a separate execution-timing contract and does not alter SID/video identity. No
cadence conversion, retiming, retuning, filter/model translation, or hardware activation occurs;
known mismatch is E10261 before lowering. Authorities: spec/15-platform-profile.md:40-91,497-509;
spec/appendix-c64.md:384-511,581-590; spec/appendix-c64u.md:169-180;
spec/13-data-inclusion.md:242-246.

Q-L27 and Q-R04 were deliberately not relabelled as complete by this correction. Q-L27 remains a
verified product-contract partial until the Phase-5 SpritePad producer/schema/fixture gate proves
the SPD v5 tail. Q-R04 remains a verified SFA/ABI partial until the Phase-4/5 CPU/C64 routing
modules exist. These are explicit qualification boundaries, not unrecorded semantic gaps.

#### Independent correction grades

Fresh graders read the complete oracles and the durable correction evidence, not the earlier
grader output. No oracle was invalid.

| Cases | Final correction grade | Boundary |
|---|---|---|
| Q-L01, Q-L08, Q-L09, Q-L11..Q-L14, Q-L17 | Pass | Complete 50-path/policy, root/escape/stack, responsibility/composition, type, effect, ownership, remedy, authority, and cost evidence is present. |
| Q-L22, Q-L23, Q-L26, Q-L28..Q-L33 | Pass | Complete alias, initializer, asset, encoding, IRQ, BCD, loop, local-borrow, SID/profile, runtime-boundary, and static-cost evidence is present. |
| Q-L27 | Verified partial | The complete intended product contract is proven; SPD v5 tail parsing remains explicitly unqualified until its Phase-5 producer/schema/fixture gate. |
| Q-R04 | Verified partial | The complete Phase-3 SFA/ABI facet is proven; CPU/C64 raster/acknowledgement routing remains explicitly unqualified until Phases 4–5. |

### Final Phase-3 exact-identity evaluator captures

These are evaluator outputs captured before independent grading. They do not make a release
decision. Both evaluators used exact candidate `BLEND65-SPEC-P3-ed278ab9`, digest
`ed278ab974513b4975ece688d7b9a91a2346e4d0f6478c96b85a4a2bd3d50a14`, and independently
recomputed the 50-path identity.

| Capture | Evaluator | Cases | Result | Material evidence |
|---|---|---|---|---|
| P3-EVAL-ARRAY-ed278ab9 | McClintock, focused array evaluator | Q-L01, Q-L14, Q-L19, Q-L20, Q-L24 | Pass | Fixed/no-view arrays, exact and any-size parameter ABI, direct index-ordinal promotion and narrow barriers, E10240/E10262, stable `word` queries, representable object domains, proof-gated byte lowering, and SFA/no-runtime boundaries agree. Chapter 08 and F014 now both state that ordinal 510 is valid for `shifted[600]` and E10240 for `data[500]`. |
| P3-EVAL-IMPACT-ed278ab9 | Herschel, full impact evaluator | Q-L01, Q-L06, Q-L12, Q-L14, Q-L19, Q-L20, Q-L22, Q-L24, Q-L25, Q-L31 | Pass | The 50 specification paths equal the crosswalk; all four candidate references bind the exact identity; fixed-array/no-view ABI, stable queries, loop reachability, poisoning/artifact suppression, SFA closure, all 29 reserved intrinsic routes, and SC-146 source/cost/diagnostic repairs remain consistent. No material contradiction or accidental runtime, heap, view, or prescribed pass topology was found. |

#### P3-EVAL-ARRAY-ed278ab9 — detailed evaluator output

The focused evaluator reported a read-only content result of **Pass**. It ran no compiler, build,
lint, package test, assembler, readiness, VICE, or other emulator command and made no release
decision. The following per-case evidence is its independently gradable output; formatting is
normalized, and its later Q-L01 status corrigendum is incorporated.

##### Q-L01 — Pass

- **Evidence and trace:** The exact identity and digest are recorded at
  `references/blend65-semantics.md:6-12`; all four candidate modules cite that identity at
  `references/compiler-architecture.md:264-267`, `references/sfa-and-abi.md:421-426`, and
  `references/il-and-optimization.md:434-438`. Stored arrays are fixed contiguous objects and the
  only contextual `T[]` roles are initializer extent inference and any-size parameters
  (`spec/08-arrays-strings.md:12-15,88-98`). SC-134..SC-147 bind the current identity and evaluator
  result (`references/blend65-semantics.md:635-648`).
- **ABI/SFA/cost:** Exact `T[N]` parameters own a two-byte address home; any-size `T[]` parameters
  own a two-byte address plus a two-byte element-count home (`spec/06-functions.md:143-148,387-401`;
  `spec/11-memory-model.md:104-125`). The candidate ABI preserves caller storage before `JSR`, the
  same two-versus-four-byte cost per concurrent instance, and the `0..65535` count domain
  (`references/sfa-and-abi.md:285-302`).
- **Status/assumptions:** Historical candidates do not govern this result. Candidate modules are
  construction material, not replacements for the specification. Independent grading remains
  separate.
- **Finding:** None. **Remedy:** None.

##### Q-L14 — Pass

- **Evidence and trace:** All integer types may index all arrays; array size and backend tier do not
  select source legality (`spec/evaluations/F014-arrays.md:125-142`). Direct unary `~`/`-`,
  arithmetic, shift, and bitwise operations inside `[]` use the 16-bit-capable ordinal context;
  Boolean-producing comparisons/logicals are invalid indices; explicit 8-bit casts, typed 8-bit
  assignments/compound assignments, and completed calls are narrow barriers
  (`spec/evaluations/F014-arrays.md:144-166`; governing copy
  `spec/08-arrays-strings.md:135-166`). Any-size parameters accept/forward a complete fixed array
  but cannot be assigned, stored, returned, converted to exact `T[N]`, or used to make a subarray
  (`spec/evaluations/F014-arrays.md:599-611`). Reserved built-in names are not redeclared, and the
  color-ramp example explicitly narrows its proven `0..7` value
  (`spec/evaluations/F014-arrays.md:684-701,1063-1069`).
- **ABI/SFA/cost:** Exact/any-size parameters cost two/four SFA bytes; ZP is an allocation result,
  not an ABI promise (`spec/evaluations/F014-arrays.md:613-632`). The displayed word-element read is
  21–26 cycles/14–17 bytes with stated ZP/absolute and page-cross boundaries
  (`:684-701`); the general 16-bit byte-element read is 28–31 cycles/19–22 bytes and one
  compiler-owned ZP pair (`:704-724`); the 40-byte fill is 403 cycles on-page or 442 with all 39
  taken backedges crossing, and 10 ROM bytes (`:727-740`). The summary separates proven direct
  access from general formation and folded fixed queries from loaded any-size counts (`:780-789`).
- **Status/assumptions:** Totals use each displayed boundary; allocation and page-cross additions
  apply only where named. These are permitted expert lowerings, not source restrictions or one
  mandatory sequence.
- **Finding:** None. **Remedy:** None.

##### Q-L19 — Pass

- **Evidence:** Fixed extents and parameters are governed at `spec/08-arrays-strings.md:12-15,77-98,535-615`;
  ordinal and bounds behavior at `:135-166,205-220`; stable query/object domains at
  `spec/02-type-system.md:504-530`; loop reachability at
  `spec/05-statements-control-flow.md:255-295`; diagnostics at
  `spec/14-diagnostics.md:219,241-245,268-269`; and proof duties at
  `references/il-and-optimization.md:143-153,195-210`.
- **Expression/range trace:** With `data: byte[500]` and `i: byte = 255`, `data[i + 10]` evaluates
  direct unbarriered addition in ordinal context and selects 265, not 9. With `small: byte[20]`,
  `a=5`, and `b=6`, `small[a + b + 1]` selects 12 while proof may keep machine work byte-sized.
  `data[byte(i + 10)]` deliberately completes narrow byte arithmetic first and selects 9;
  W10161 replaces W10160 when the exact wrap is known. `shifted[i << 1]` selects valid ordinal 510
  for `shifted: byte[600]`, while literal `data[510]` is E10240 because `data` ends at ordinal 499
  (`spec/08-arrays-strings.md:145-151`; `spec/evaluations/F014-arrays.md:153-159`).
- **Loop/query/object trace:** `length(data)` is compile-time `word` 500. A declared byte `j`
  remains byte and wraps before its invariant `j < 500` condition can become false, so the supplied
  finite-looking loop is E10262. Ring cursors, timers, explicit infinite loops, and paths with
  another explicit exit remain legal (`spec/05-statements-control-flow.md:255-278`). `length`,
  `sizeof`, and `offsetof` are stable `word`; extents and complete fixed array/struct byte sizes must
  fit `0..65535` (E10264/E10265), and `sizeof(T[])` is E10266 because no standalone extent exists
  (`spec/02-type-system.md:506-530`; `spec/04-expressions-operators.md:527-582`).
- **Bounds/effects/ownership:** Default unchecked address formation is
  `(base + ordinal * elementSize) modulo 65536` and preserves bank/MMIO effects. `--bounds-check`
  evaluates once, checks signed lower and upper bounds, enters the source-labelled non-returning
  safety stop on failure, and links no runtime library (`spec/08-arrays-strings.md:205-217`). `T[]`
  is not a slice, span, view, subrange, storable/returnable value, heap object, or descriptor
  runtime (`:571-586`).
- **ABI/SFA/cost:** Exact arrays pass a two-byte address; any-size arrays pass address plus word
  count, using four SFA bytes per concurrent instance (`spec/06-functions.md:143-148,387-401`;
  `spec/11-memory-model.md:104-125`). Proven constants may become direct accesses; proven byte
  offsets may use direct indexing; otherwise the displayed general byte-element path uses 16-bit
  formation plus `(ptr),Y`, 28–31 cycles/19–22 bytes and one compiler-owned ZP pair
  (`spec/08-arrays-strings.md:661-681`). Carry may feed address formation without a source-visible
  word temporary (`:164-166`). A correct word source loop may use byte machine state only under
  complete proof (`spec/05-statements-control-flow.md:266-269`).
- **Status/assumptions:** `use(byte): void` is assumed declared and non-retaining. No profile was
  supplied, so W10143 is profile-dependent; W10141 remains target-independent for the uninitialized
  nonzero arrays. Bounds checking is off unless requested. No one emitted sequence is claimed.
- **Finding:** None. **Remedy:** None.

##### Q-L20 — Pass

- **Evidence and trace:** `sizeof(Type)` and `offsetof(Struct, field)` are compile-time `word`; a
  field may start at offset 300; `length(array)` is element count and always `word`
  (`spec/evaluations/F020-memory-intrinsics.md:262-417`). Fixed length folds; any-size length reads
  the caller's 16-bit count without creating a dynamic array (`:407-434`). `sizeof(byte[])` is
  E10266, with E10264/E10265 owning invalid extent/object domains (`:298-312`;
  `spec/14-diagnostics.md:243-245`). Runtime `peek`/`poke` effects and compiler-owned temporary
  pointer ownership remain explicit.
- **ABI/SFA/cost:** All fixed queries cost zero runtime cycles; any-size `length()` is one word load
  from its SFA count home (`spec/evaluations/F020-memory-intrinsics.md:497-504`). A constant address
  uses no compiler pointer; a variable address owns one invocation-private two-byte ZP pair. The
  stated displayed boundaries are: `peek` 19–21 cycles/12–14 bytes before its consumer, `poke`
  23–26/14–17, `peekw` 28–31/16–18, and `pokew` 34–38/19–23 (`:474-488`). Pointer homes overlay only
  across proven non-overlap and stay disjoint across overlapping mainline/IRQ/NMI use (`:485-488`).
- **Status/assumptions:** Semantic `word` is stable even when proof selects byte machine work. Each
  cost excludes or includes surrounding evaluation only as its local boundary states. No heap,
  query descriptor, or runtime library is assumed.
- **Finding:** None. **Remedy:** None.

##### Q-L24 — Pass

- **Evidence and trace:** IL retains scalar width/signedness, ordinal context, element size, extent
  source, order, effects, aliasing, and symbolic storage until the responsible consumer discharges
  each fact (`references/il-and-optimization.md:35-52,143-153`). It distinguishes promoted direct
  operations from completed narrow barriers, fixed extents from caller counts, semantic width from
  proof-selected machine width, and in-bounds proof from HLE-003. Loop lowering first creates the
  ordinary initializer/condition/body/update/end CFG; only bounded proof may remove tests, narrow
  counters, or select wrap-exit idioms (`:195-210`). Unchecked mode preserves address/banking/MMIO
  effects; checked mode evaluates once and fails before memory access. Neither creates a new array
  concept or general runtime.
- **ABI/SFA/cost:** Caller evaluation is left-to-right and storage precedes `JSR`; exact arrays use
  two-byte address homes and any-size arrays use four-byte address/count homes per concurrent SFA
  instance (`references/sfa-and-abi.md:285-302`). Constant/direct/carry-fed/narrowed/indirect
  alternatives require equal value, wrap, bounds, alias, volatile/MMIO, register/flag, and address
  behavior. Every rule records applicability, preconditions, effects, pipeline point, cost,
  counterexample, behavior oracle, and separate assembly/cost oracle
  (`references/il-and-optimization.md:282-314`). Binding accounts for registers, flags, ZP/static
  homes, spills, interrupts, page behavior, and final SFA closure. A word-source 256-element loop
  may become expert `INX/BNE` only under that proof
  (`references/compiler-architecture.md:168-179`).
- **Status/assumptions:** The modules define responsibilities and proof duties, not a required pass
  count. No implementation conformance, binary result, or release status is claimed.
- **Finding:** None. **Remedy:** None.

#### P3-EVAL-IMPACT-ed278ab9 — detailed evaluator output

The full-impact evaluator independently confirmed the 50-path digest and reported an overall
**Pass**. This evaluator output is separate from the later formal-semantics review and makes no
release decision. Formatting is normalized below; the per-case decisions, evidence, traces,
assumptions, and remedies are retained.

##### Q-L01 — Pass

- **Evidence:** The exact 50-path rule is at `references/blend65-semantics.md:151-156`. The
  discovery/normative core is individually covered at `:158-174`, the target appendices at
  `:175-179`, build-plan at `:180`, F001..F022/F024 at `:181-203`, future considerations at `:204`,
  derived grammar at `:205`, preflight history at `:206`, and migration history at `:207`.
  Chapter 14's authority split is `spec/14-diagnostics.md:10-19`; architecture and storage routing
  are `references/compiler-architecture.md:25-46` and `references/sfa-and-abi.md:39-57`.
- **Trace:** All 50 live paths appear once with role, payload, compiler/storage/effect consequence,
  interaction boundary, expert-module route, and explicit N/A rationale. Normative chapters own
  behavior, evaluations retain rationale, Chapter 14 owns public diagnostic presentation, grammar
  is derived, and historical files cannot override current chapters. The full-domain word loop is
  legal while the equivalent finite-looking byte loop is E10262
  (`spec/05-statements-control-flow.md:255-278`). A valid module-scope runtime initializer runs once
  before `main` and is dependency/effect ordered; cycles produce E10194
  (`spec/10-modules.md:184-215`). ACME and parity-debt issue creation remain project policy
  (`AGENTS.md:151-172,204-208,232-239`), never language semantics or push authority.
- **Status/assumptions:** Frozen-project oracle, exact `ed278ab9` identity, current implementation
  excluded; definitive isolation remains Phase 7.
- **Finding:** None. **Remedy:** None.

##### Q-L06 — Pass

- **Evidence:** SFA owns parameters, returns, locals, temporaries, spills, staging, pointer pairs,
  and helper scratch (`spec/11-memory-model.md:66-75`; `references/sfa-and-abi.md:59-75`). Caller
  values live across callees interfere (`references/sfa-and-abi.md:149-166,195-210,385-402`;
  `spec/11-memory-model.md:117-125`).
- **Lifetime/ownership trace:** A value defined in `a` and used after `a → b` remains live while
  `b`'s function storage is live. The relevant homes are simultaneously observable, receive an
  interference edge, and require disjoint compatible address ranges. Mutually exclusive sibling
  calls may overlay only after graph/lifetime/preemption proof; caller and callee homes may not.
- **ABI/SFA/cost:** Ordinary calls use static incoming homes and `JSR`/`RTS`
  (`references/sfa-and-abi.md:285-296`). Exact RAM cost depends on concrete home widths after
  coloring; static total and simultaneous peak stay separate, so no unsupported numeric cost is
  claimed.
- **Status/assumptions:** Frozen-project oracle; `a → b`, with an `a` home live across the call; no
  exclusion/non-liveness proof assumed. Definitive isolation remains Phase 7.
- **Finding:** None. **Remedy:** None.

##### Q-L12 — Pass

- **Evidence/trace:** Architecture defines responsibilities/invariants, not a class diagram
  (`references/compiler-architecture.md:1-5`). LLVM/comparative compilers do not dictate IR,
  runtime, ABI, or class count (`:20-23`). Required responsibility contracts cover frontend,
  semantic representation/analysis, whole-program analysis, SFA, legalization, selection, resource
  binding, machine optimization/layout, emission, packaging, and driver, while concrete modules may
  combine or split (`:25-46,203-223`). No single IL, SSA, DAG, pseudo-assembly layer, or pass count
  is required (`references/il-and-optimization.md:23-62`). Every topology must preserve semantic
  payload until its consumer, return newly discovered function storage to SFA closure, and delay
  emission until facts/homes are ready.
- **ABI/SFA/cost:** The chosen topology must preserve the frozen ABI and final-storage closure.
  Transformations state effects and full cost boundaries—bytes, path cycles, data, ZP, frame,
  stack, helpers, and layout assumptions (`references/il-and-optimization.md:299-314`). No class
  count or numeric cost follows from the language.
- **Status/assumptions:** Frozen-project architecture oracle, not current repository topology;
  definitive isolation remains Phase 7.
- **Finding:** None. **Remedy:** None.

##### Q-L14 — Pass

- **Evidence/trace:** Width and signedness survive until their accountable consumer
  (`references/il-and-optimization.md:35-44`); later guessing is an architectural defect
  (`references/compiler-architecture.md:60-70,115-132`). Same-width signed/unsigned casts
  reinterpret bits but do not merge independent objects (`spec/02-type-system.md:333-355`;
  `spec/evaluations/F010-signed-types.md:345-360`). General signed `a < b` cannot use unsigned
  `CMP` as though V were valid. The displayed legal path uses `SEC; SBC`, overflow normalization,
  and a sign branch (`spec/evaluations/F010-signed-types.md:289-304`). A backend may substitute
  only a sequence that establishes every consumed flag.
- **ABI/SFA/cost:** The displayed variable-variable signed comparison is 13–18 cycles/11–13 bytes;
  the matching unsigned form is 8–12/6–8; zero comparison may use a cheaper sign test
  (`spec/evaluations/F010-signed-types.md:306-309`). Same-size cast conversion costs zero, but
  ordinary assignment/storage may still cost (`:437-452`).
- **Status/assumptions:** Frozen-project oracle; proposed early signedness erasure is rejected;
  definitive isolation remains Phase 7.
- **Finding:** None. **Remedy:** None.

##### Q-L19 — Pass

- **Source/range trace:** The evaluator recorded the exact forms and results: `data[i + 10]` with
  `i: byte = 255` selects 265; `small[a + b + 1]` for 5 and 6 selects 12;
  `shifted[i << 1]` selects valid 510 in `byte[600]`; literal `data[510]` is E10240 for
  `data: byte[500]`; and `data[byte(i + 10)]` deliberately selects wrapped 9. These appear together
  at `spec/08-arrays-strings.md:135-166` and `spec/evaluations/F014-arrays.md:144-167`. The ordinal
  context covers all integer-producing unary/arithmetic/shift/bitwise operators; Boolean results
  are E10263; explicit/earlier narrow barriers retain wrap. IL retains these distinctions
  (`references/il-and-optimization.md:135-153`).
- **Extent/query/ABI:** All stored arrays are fixed; extents and complete fixed array/struct sizes
  fit `0..65535` or produce E10264/E10265 (`spec/08-arrays-strings.md:10-15,77-98`). `length`,
  `sizeof`, and `offsetof` are stable `word`; a field may start beyond 255; `sizeof(byte[])` is
  E10266 (`spec/02-type-system.md:504-526`; `spec/04-expressions-operators.md:527-582`;
  `spec/14-diagnostics.md:219-245`). Exact arrays pass a two-byte address; any-size `T[]` passes
  address plus word count and is neither dynamic storage nor slice/span/view/storable/returnable
  value (`spec/08-arrays-strings.md:559-615`; `spec/06-functions.md:143-148,387-401`).
- **Bounds/loop trace:** Known negative/OOB is E10240; checked signed access tests both bounds;
  unchecked signed access sign-extends and effective-address overflow wraps, preserving
  element-size scaling (`spec/08-arrays-strings.md:159-166`). A byte counter cannot reach word bound
  500, so the supplied canonical finite-looking traversal is E10262 without silently widening the
  source counter. Intentional wrap/ring/timer/infinite loops remain legal
  (`spec/05-statements-control-flow.md:255-278`).
- **Assembly/cost:** Proven byte-range byte access may use `LDX` plus absolute-X load/store
  (`spec/08-arrays-strings.md:621-639`). The displayed scaled `word[]` form is 21–26 cycles/14–17
  bytes (`:641-659`); general above-255 byte access is 28–31/19–22 plus one compiler-owned ZP pair
  (`:661-682`). Selection uses proven ordinal range, element size, placement, and registers—not
  array declaration size (`:113-133`). Actual selected costs are report-owned
  (`spec/evaluations/F014-arrays.md:1088-1096`).
- **Status/assumptions:** Frozen after AR-P35–AR-P41/SC-147; default unchecked; no implementation
  behavior assumed. No heap, copy, view, hidden helper, wider runtime integer, or general runtime.
- **Finding:** None. **Remedy:** None.

##### Q-L20 — Pass

- **Semantic/warning trace:** In true constant context,
  `const folded: word = byte(250) + byte(10)` evaluates full precision to 260. In runtime context,
  `let runtime: word = byte(250) + byte(10)` performs byte arithmetic, wraps to 4, then widens to
  `word(4)` (`spec/02-type-system.md:265-294,437-456`;
  `references/il-and-optimization.md:135-160`). Exact reaching values make W10161 replace W10160;
  proof respects aliases, calls, interrupts, and volatile effects
  (`spec/14-diagnostics.md:268-269`).
- **Storage/cost:** Scalar constants inline and consume no scalar RAM
  (`spec/03-variables.md:306-320`). A materialized runtime word uses a two-byte home
  (`spec/11-memory-model.md:108-115`). Widening has no context-free surcharge; the complete shown
  stored zero-extension is 11–14 cycles/8–11 bytes, but consumers may absorb work and must report
  actual selected cost (`spec/evaluations/F016-type-system.md:167-171`).
- **Status/assumptions:** Frozen-project oracle; token-identical arithmetic occurs in two distinct
  semantic contexts; no runtime/helper/heap added. Definitive isolation remains Phase 7.
- **Finding:** None. **Remedy:** None.

##### Q-L22 — Pass

- **Behavior/effect trace:** Structs/arrays pass by reference without default copy, arguments
  evaluate left-to-right, and two parameters may alias the same object
  (`spec/06-functions.md:103-120,265-276`; `spec/07-structs.md:289-301`). For
  `writeThenRead(boss, boss)`, both marshalled addresses identify `boss`; `a.hp = 1` precedes
  `b.hp`, whose read must observe 1. Reordering, caching, eliminating the read, or assuming
  independence is invalid (`references/sfa-and-abi.md:218-235`;
  `references/il-and-optimization.md:122-124`). Aggregate `const` is transitive read-only access,
  not ownership/noalias and adds no ABI cost (`spec/08-arrays-strings.md:471-530`). W10112 fires
  only for statically proven same-base mutable struct arguments
  (`spec/07-structs.md:298-301,486`; `spec/14-diagnostics.md:260`).
- **ABI/SFA/cost:** Each exact aggregate parameter has a two-byte base-address home; any-size arrays
  additionally carry word count (`references/sfa-and-abi.md:285-302`). Exact indirect cost depends
  on selected placement/addressing; no context-free number is claimed.
- **Status/assumptions:** Frozen-project oracle; both mutable aggregate arguments resolve to one
  object; no noalias contract. Definitive isolation remains Phase 7.
- **Finding:** None. **Remedy:** None.

##### Q-L24 — Pass

- **Diagnostic/ownership trace:** In a one-argument call to a two-parameter `combine`, Chapter 06
  owns wrong-arity E10171 and emits no call (`spec/06-functions.md:321-326,802-811`); Chapter 14
  owns its public presentation (`spec/14-diagnostics.md:176-178`). The rejected call/result becomes
  poison; purely dependent type/lowering/allocation/codegen errors are suppressed, independently
  invalid arguments retain their own roots, and poison is never lowered/allocated
  (`spec/14-diagnostics.md:54-66`). Any error suppresses assembly, object, serialized IL, maps,
  symbols, executable, and package while preserving diagnostics (`:68-81`). Architecture requires
  poison-aware stage contracts (`references/compiler-architecture.md:115-140`).
- **ABI/SFA/cost:** A rejected call creates no marshalling, callee invocation, SFA need, helper,
  machine code, or artifact. Safe independent analysis may continue only for diagnostic recovery.
- **Status/assumptions:** Frozen-project oracle; dependent failures have no independent cause;
  definitive isolation remains Phase 7.
- **Finding:** None. **Remedy:** None.

##### Q-L25 — Pass

- **Storage/lifetime trace:** Spills/helper scratch are SFA-owned function storage
  (`references/sfa-and-abi.md:39-75`). When legalization/resource binding discovers one after
  provisional allocation, it returns to SFA with identity, width, alignment, owner, live interval,
  helper edges, clobbers, reentrancy, and interrupt-domain facts; SFA recomputes interference,
  placement, budgets, and ABI; bounded monotonic closure repeats before emission
  (`references/il-and-optimization.md:266-280`; `references/sfa-and-abi.md:337-355`). A post-closure
  need uses contracted reserved scratch, reopens closure, or rejects the transform; the emitter may
  not grab anonymous RAM/ZP (`references/sfa-and-abi.md:357-359`).
- **ABI/SFA/cost:** Helper selection accounts for calls, code, parameters/returns, scratch, spills,
  ZP, clobbers, interrupt safety, tables/alignment, frequency, and barriers
  (`references/il-and-optimization.md:225-240`). Reports separate static totals, simultaneous peak,
  stack, helper ROM/data, cycles, and placement. Failure to fit/converge is a source diagnostic,
  not emergency globals, a software stack, runtime allocation, or crash
  (`references/sfa-and-abi.md:361-374`).
- **Status/assumptions:** Frozen-project oracle; allocation still provisional and emission has not
  begun; numeric cost requires the concrete selected helper/homes. Definitive isolation remains
  Phase 7.
- **Finding:** None. **Remedy:** None.

##### Q-L31 — Pass

- **Grammar/effect trace:** The only current loop is
  `for ([initializer]; [condition]; [update]) { body }`; clauses are optional
  (`spec/grammar.ebnf.md:217-228`; `spec/05-statements-control-flow.md:206-220`). Statement parsing
  owns delimiters; top-level commas occur only in initializer/update lists
  (`spec/grammar.ebnf.md:230-233`; `spec/evaluations/F008-for-loop.md:34-37`). Former range words are
  ordinary identifiers (`spec/evaluations/F008-for-loop.md:53-54`). `I` runs once, Boolean `C`
  before each possible iteration, body next, normal/`continue` through `U`, and `break`/`return`
  around `U`; calls/MMIO/conversions/aliases/wrap keep that order
  (`spec/05-statements-control-flow.md:228-253`). Generic CFG maps `continue` to update and `break`
  to end (`:286-295`; `references/il-and-optimization.md:189-210`).
- **SFA/proof:** Header locals, temporaries, call staging, spills, and materialized values use normal
  CFG liveness/SFA; there is no hidden iterator/range state, dynamic frame, second loop IR, helper,
  or runtime. A word-source 256-iteration loop may use `LDX #0; ...; INX; BNE` only when the counter
  does not escape, bound 256 is invariant, calls/aliases/MMIO cannot change induction, exits are
  preserved, and body needs only the low byte (`spec/05-statements-control-flow.md:266-269,291-295,319-344`).
- **Exact cost/effects:** The selected loop executes 256 `INX`, 255 taken and one not-taken `BNE`;
  induction control excluding setup/body is 1,279 cycles on-page plus 255 if every taken backedge
  crosses. X is clobbered; `INX` defines N/Z and adjacent `BNE` consumes Z. Setup, body,
  materialization, spills, RAM/ZP, and alternate addressing stay outside that boundary (`:319-344`).
  The byte-source form is E10262 only when the canonical proof shows it repeats before bound 256;
  deliberate infinite/modular/ring/timer/other-exit forms remain legal (`:255-278`).
- **Status/assumptions:** Frozen after AR-P32; `page` length 256; optimization requires stated
  proof; definitive isolation remains Phase 7.
- **Finding:** None. **Remedy:** None.

#### First independent grade of the detailed exact-identity captures

The independent grader did not trust the evaluator labels. It passed the full-impact capture and
Q-L19 in the focused capture, but found that four focused answers addressed different questions
than their stored case IDs. That is an evidence-integrity failure even though the same actual cases
passed in the separate impact capture. The failed result is preserved here; it is not overwritten.

| Capture | Case grades | Overall | Required correction |
|---|---|---|---|
| P3-EVAL-ARRAY-ed278ab9 | Q-L01 Fail; Q-L14 Fail; Q-L19 Pass; Q-L20 Fail; Q-L24 Fail | Fail | Rerun Q-L01/Q-L14/Q-L20/Q-L24 against their actual stored prompts, capture separately, then independently regrade |
| P3-EVAL-IMPACT-ed278ab9 | Q-L01/Q-L06/Q-L12/Q-L14/Q-L19/Q-L20/Q-L22/Q-L24/Q-L25/Q-L31 Pass | Pass | None |

The failed focused answers omitted the decisive oracle content: Q-L01's complete 50-path audit and
project-policy separation; Q-L14's signedness/cast/coalescing proof; Q-L20's full-precision constant
versus runtime-width result; and Q-L24's root-error poison/cascade/artifact suppression. The
corrective evaluator run is `P3-EVAL-ARRAY-CORRECTION-ed278ab9`; its result and a fresh independent
grade must appear below before Phase 3 can close.

#### P3-EVAL-ARRAY-CORRECTION-ed278ab9 — corrective evaluator output

The evaluator reran only the four mismatched stored prompts. It did not rerun Q-L19. This was a
read-only content evaluation under the same exact identity; no compiler, test, assembler, emulator,
diagnostic stream, or artifact directory was executed or inspected.

##### Q-L01 — Pass

- **Path/authority audit:** The evaluator compared all 50 live `spec/**/*.md` paths with the 50
  crosswalk rows and found an empty symmetric difference and no duplicate. It audited the
  discovery/normative core (`references/blend65-semantics.md:158-174`), five target appendices
  (`:175-179`), historical build plan (`:180`), F001..F022/F024 (`:181-203`), future register
  (`:204`), derived grammar (`:205`), historical preflight (`:206`), and migration context (`:207`)
  against the required one-row/no-omission contract (`:151-157`) and preservation dimensions
  (`:136-149`). Each row records role, payload, compiler/storage/effect consequence, boundary,
  expert route, and a real N/A explanation where applicable.
- **Policy separation/ownership:** Chapters 00–15 and selected target appendices are normative;
  Chapter 14 owns public diagnostic identity/presentation while feature chapters own predicates;
  evaluations are subordinate rationale; grammar is derived; build/preflight are history;
  future-considerations governs deferrals; migration is comparison context
  (`spec/14-diagnostics.md:10-19`). ACME selection is product/toolchain policy
  (`AGENTS.md:232-239`; `references/compiler-architecture.md:14-18`). A meet-only parity result
  requires an issue with the measured gap/path to a win, but never a push
  (`AGENTS.md:151-168,204-208`; `references/il-and-optimization.md:375-384`). Types/effects route
  through semantic IL, function storage/scratch through SFA, global/assets through platform layout,
  volatile operations through effect-aware lowering, target facts through profile composition, and
  errors through the artifact gate. Current implementation/tests own no semantic authority.
- **Status/assumptions:** Verified for the live inventory/candidate crosswalk and supplied policy
  excerpts. The prior array prompt belongs only to Q-L19 and was intentionally not reused.
- **Finding:** None. **Remedy:** None.

##### Q-L14 — Pass

- **Decision/evidence:** Reject early signedness erasure. Comparison semantics follow operand types,
  mixed signedness requires an explicit cast, and same-width cross-signedness casts reinterpret bits
  without merging independent objects (`spec/02-type-system.md:154-174,191-205,236-244,322-355`).
  Signedness remains mandatory IL payload until compare selection
  (`references/il-and-optimization.md:35-44,388-401`).
- **Semantic/machine trace:** Bit patterns `$C8`/`$64` mean unsigned 200/100, so `>` is true; after
  same-size casts they mean signed -56/100, so `>` is false. Unsigned comparison may use
  `LDA`/`CMP`/carry branch at 8–12 cycles/6–8 bytes. General signed comparison must establish V
  with `SEC`/`SBC`, normalize `N xor V`, then branch, at 13–18/11–13; `CMP` does not establish V
  (`spec/evaluations/F010-signed-types.md:217-231,272-309`). Signed zero comparison may use the
  smaller `LDA`/`BMI` form.
- **Cast/SFA trace:** `let s: sbyte = sbyte(b)` costs no bit conversion or helper, but independent
  observable `b` and `s` may still require a move and distinct homes. Coalescing requires proof of
  liveness, aliases, volatility, alignment, effects, interference, and asynchronous domains
  (`references/sfa-and-abi.md:195-210`).
- **Status/assumptions:** Content-only semantic/lowering/SFA result; implementation unobserved.
- **Finding:** The proposed erasure is invalid. **Remedy:** Retain signedness through selection;
  model same-width casts as bit reinterpretation; decide coalescing independently by proof.

##### Q-L20 — Pass

- **Constant/runtime trace:** `const folded: word = byte(250) + byte(10)` is a true constant context:
  full-precision 260 then destination range-check; a `const byte` destination is E10084. In
  `let runtime: word = byte(250) + byte(10)`, byte operand width controls the intermediate, so it
  wraps to 4 before zero-extension to `word(4)` (`spec/02-type-system.md:265-301,437-456,485-500`;
  `references/il-and-optimization.md:132-160`). Exact reaching values make W10161, not W10160,
  applicable (`spec/02-type-system.md:284-294,556-567`).
- **Storage/lowering/cost:** Scalar constants inline with no runtime storage
  (`spec/03-variables.md:17-20,182-189`; `spec/11-memory-model.md:299-305`). A materialized local
  runtime word owns two SFA bytes; a module word owns two general-RAM bytes and startup work
  (`spec/11-memory-model.md:299-313`). Optimization may fold the runtime form only after applying
  byte-wrap semantics and preserving W10161. Materialization writes low 4/high 0 as required by
  actual placement; no unsupported fixed instruction count, helper, or runtime is claimed.
- **Status/assumptions:** Frozen rules; the packet supplies no concrete expression, so the governing
  `byte(250) + byte(10)` example is used in both contexts. Implementation unobserved.
- **Finding:** None. **Remedy:** None.

##### Q-L24 — Pass

- **Root/poison trace:** For otherwise-valid `data: byte[500]` and `bad: byte = data[510]`, Chapter
  08 rejects constant ordinal 510 against valid `0..499` with exactly one E10240 before address
  generation (`spec/08-arrays-strings.md:135-163,791`). Chapter 14 owns the public message/span
  (`spec/14-diagnostics.md:10-19,27-52,208-220`). The index expression is the primary span; the
  access/result becomes poison; dependent type/address/lowering/allocation/emission complaints are
  suppressed; unrelated errors remain; no ICE occurs (`:54-66`).
- **Effect/storage/artifact trace:** No memory read, address temporary, pointer pair, helper scratch,
  result temporary, initializer code, optimizer input, or SFA home may arise from the rejected
  access. Any error suppresses every usable executable/package/assembly/object/serialized-IL/map/
  symbol artifact while diagnostics remain available (`spec/14-diagnostics.md:68-81`;
  `references/compiler-architecture.md:115-140`). A recovery dump is allowed only if explicitly
  marked invalid and unusable downstream. No runtime recovery helper is introduced.
- **Status/assumptions:** Normative content result. Expected observation is one E10240, no dependent
  cascade/ICE/artifact; actual compiler output remains unobserved by plan boundary.
- **Finding:** None. **Remedy:** None.

**Corrective evaluator verdict:** Q-L01, Q-L14, Q-L20, and Q-L24 all pass under
`BLEND65-SPEC-P3-ed278ab9`. Q-L19 retains its earlier focused Pass. Independent regrading is
recorded separately below.

#### Independent correction grade

The fresh grader received the four corrected captures and the stored case oracles, not the prior
failed labels. It found each answer complete and independently gradable.

| Case | Grade | Decisive evidence retained |
|---|---|---|
| Q-L01 | Pass | Exact 50-path equality, document authority, project-policy separation, and compiler non-authority |
| Q-L14 | Pass | Signedness retention, cast semantics, comparison trace, and proof-gated SFA coalescing |
| Q-L20 | Pass | Full-precision constant result 260 versus runtime byte-width result 4, storage, and lowering bounds |
| Q-L24 | Pass | Root E10240, poison/cascade suppression, no derived storage/effects, and complete artifact suppression |

Together with the retained Q-L19 Pass, the focused five-case set passes. The separate ten-case
impact capture also passes. This is Phase-3 content evidence, not the final Phase-7 release
decision.

The closeout sequence deliberately invalidated earlier candidates instead of relabelling their
results. The last broad candidate, `BLEND65-SPEC-P3-96d1cf19`, passed the full impact set but failed
the focused Q-L19 completeness check because it did not explicitly diagnose ordinal 510 against a
500-element array. SC-147 repaired that example-only gap; both evaluator sets then passed against
the new exact identity above. Q-L27 and Q-R04 remain explicit later-phase evidence boundaries, not
Phase-3 semantic defects.

## Phase-4 Focused Results

The Phase-4 evaluator received only the seven allowlisted candidate knowledge modules and the case
prompts, not the hidden oracles, coverage/release/plan material, legacy conclusions, compiler code,
tests, examples, readiness artifacts, or prior outputs. Aquinas first reported 20 passes and five
material content failures: Q-C04, Q-C13, Q-C14, Q-C15, and Q-C20 lacked complete local sequences or
cost evidence. The candidate was corrected rather than the cases. Its first focused rerun left two
cost-proof failures because Q-C14/Q-C15 omitted taken-branch page-cross terms. The second correction
added exact page formulas, and the final focused rerun passed both. No failure was waived or parked.

| Case | Final evaluator result | Decisive current evidence |
|---|---|---|
| Q-C01 | Pass | Rejects stale V after `CMP`; legal controlled-subtraction/normalization/sign-split families and costs |
| Q-C02 | Pass | Full signed-byte boundaries and both initial V states; N-only/C-only counterexamples |
| Q-C03 | Pass | Direct `CMP`/`BCS` branch with no unnecessary Boolean home |
| Q-C04 | Pass | Complete signed-word high-first stream; 37 bytes and six exact base path totals |
| Q-C05 | Pass | Source-independent `CLC` and low-to-high word carry chain |
| Q-C06 | Pass | Source-independent `SEC` and low-to-high no-borrow chain |
| Q-C07 | Pass | NMOS IRQ does not clear D; exact raw/exclusive/chained ABI ownership and costs |
| Q-C08 | Pass | ZP indirect pointer wraps at `$ff`; page-safe pair allocation is mandatory |
| Q-C09 | Pass | NMOS `JMP ($12ff)` high-byte fetch wraps within the page; W65C02S differs |
| Q-C10 | Pass | NMOS RMW bus sequence blocks unproved VIC/MMIO substitution |
| Q-C11 | Pass | Relative range, taken/page timing, and branch-over-`JMP` repair are explicit |
| Q-C12 | Pass | Indexed-read page penalty and fixed indexed-store timing/bus effects are distinct |
| Q-C13 | Pass | Constant/runtime signed byte/word shifts cover zero, boundaries, wide counts, state, storage, and page costs |
| Q-C14 | Pass | Constant chains plus legal looped/unrolled byte and word multiply candidates have complete cost formulas |
| Q-C15 | Pass | Exact signed power-of-two quotient/remainder streams preserve truncation toward zero and dividend-signed remainder |
| Q-C16 | Pass | Branch use consumes flags directly; only the escaping Boolean is materialized |
| Q-C17 | Pass | Selected NMOS target legality overrides assembler acceptance of W65C02 forms |
| Q-C18 | Pass | Inline/helper choice includes body, calls, ABI, dead stripping, SFA/ZP/stack, and IRQ reentrancy |
| Q-C19 | Pass | Ordinary word loop runs 256 iterations; proof may use byte `INX/BNE`; byte source loop is not silently repaired |
| Q-C20 | Pass | ACME `#<`/`#>` and parenthesized offsets preserve assembly-time symbol resolution |
| Q-C21 | Pass | Independent behavior oracle and separate assembly/resource expectation are both mandatory |
| Q-C22 | Pass | Full/partial/no unroll is selected from measured workload and layout costs |
| Q-C23 | Pass | Self-modifying specialization requires writable code, ownership, IRQ/reentry/bank proof, and measured benefit |
| Q-C24 | Pass | Tables/pre-shifted data charge payload, padding, placement/banking, access, workload, and behavior |
| Q-R01 | Pass | Focused route selects semantics, CPU, lowering, parity/evidence, and source traceability; live router remains quarantined |

### Independent Phase-4 grade

Herschel had not reviewed Phase 4 before this grade. The grader received the complete frozen case
oracles and current candidate references, but not the evaluator verdicts, release/coverage/plan
artifacts, compiler implementation, tests, legacy references, or feasibility matrix. It independently
recalculated the signed-compare, shift, multiply, signed division/remainder, helper, branch/page,
indexed-access, and canonical 256-loop totals.

| Grade | Result | Boundary |
|---|---|---|
| Q-C01..Q-C24 | 24/24 Pass | Legal selected-CPU forms, semantics, counterexamples, full cost/resource evidence, and proof duties pass |
| Q-R01 | Pass | Candidate-content route is sufficient; this does not qualify the quarantined live router |
| Material findings | None | No oracle was changed and no result was accepted with missing evidence |

Both evaluation stages were read-only content reviews. No compiler build, typecheck, lint, package
test, assembler, readiness suite, VICE/emulator, or hardware test ran or is claimed.

## Phase-5 Focused Results

The platform and game evaluators received the three new C64 candidate references, the source
manifest, and their assigned case prompts. They did not receive compiler code, tests, readiness
artifacts, the feasibility matrix, legacy conclusions, or prior verdicts. The first pass exposed
incomplete banking-state preservation, incorrect KERNAL-tail accounting, three game-workload proof
gaps, and asset-format evidence overclaims. The candidate knowledge was corrected; no case or
oracle was weakened and no gap was parked.

| Case | Final result | Decisive current evidence |
|---|---|---|
| Q-P01 | Pass | CPU, VIC, and physical RAM views stay distinct; placement is preferred to copying |
| Q-P02 | Pass | Banking transaction preserves DDR, latch, CPU I, device masks, pending-state observability, and IRQ/NMI ownership |
| Q-P03 | Pass | VIC bank, `$D018`, alignment, pointer range, CPU visibility, and loader placement close together |
| Q-P04 | Pass | PAL/NTSC profiles use separate line/cycle/frame budgets and prohibit average-frame substitution |
| Q-P05 | Pass | Badline work subtracts exact unavailable slots and keeps model/scroll assumptions explicit |
| Q-P06 | Pass | Eight-sprite DMA pressure is charged as a union with badline stalls, not omitted or double-counted as capacity |
| Q-P07 | Pass | CINV/NMINV chain, revision-pinned exclusive, and raw IRQ/NMI variants have distinct entry saves, observer-safe elision, status order, bytes, cycles, stack, source/nesting ownership, and vector/banking transitions |
| Q-P08 | Pass | `$D019` write-one acknowledgement is volatile, ordered, and not replaced by generic RMW |
| Q-P09 | Pass | Exact CIA offsets and CRA/CRB/ICR bits preserve timer, mask, acknowledgement, and port-output effects |
| Q-P10 | Pass | Exact active-low joystick bits and full PA-column/PB-row keyboard matrix preserve shared lines, DDR/latches, and CIA2 VIC-bank ownership |
| Q-P11 | Pass | Exact SID voice/global/control/filter maps underpin player-neutral music-only, integrated music/SFX, SFX-only, and custom-player paths without a generic runtime |
| Q-P12 | Pass | Independent evolving buffers are distinct storage; visibility changes prefer placement and pointer/base flips |
| Q-P13 | Pass | Fixed 24-sprite oracle, stable sort/drop rules, raw-IRQ ownership, page-contained tables, and exact 1,213-byte IRQ/117-cycle event accounting close the content case |
| Q-P14 | Pass | Named constant border write lowers to the expert direct-store sequence with no call, temporary, or hidden read |
| Q-P15 | Pass | Integrator-style elements/panels, masks, attributes, layout, loading, zero-cost renderer, and proof ownership are explicit without inventing an editor framework |
| Q-P16 | Pass | Fixed 320-slot/40-active workload, 3,984-byte neutral base, eight state actions, half-open AABB rule, and exact 20-pair oracle make layouts comparable |
| Q-P17 | Pass | Stable regions require path-bounded local cycle contracts; the PAL double-IRQ baseline now fixes mechanism, 64-cycle convergence, 78-byte wrapper, nine-byte local stack high-water, ownership, and rejection/proof bounds |
| Q-P18 | Pass | VSP/AGSP remains explicit opt-in with safer fallback and mandatory selected-hardware QA |
| Q-P19 | Pass | FLI/FLD/line-crunch/border/sprite-crunch templates name exact events, ownership, resource surfaces, fallbacks, and future proof boundaries |
| Q-P20 | Pass | Scrolling compares pointer flips, justified replication, pre-shifted data, dirty updates, unrolling, and copies under one behavior/resource oracle |
| Q-P21 | Pass | Sprite-multiplexer knowledge reaches modern API, schedule, SFA/IRQ, lowering, cost, and proof seams instead of remaining runtime prose |
| Q-R04 | Pass | Minimum route closes SFA interference and VIC availability; banking, entry/stack, and lowering references are conditional on the actual sink and emitted-code question |

Asset evaluation separately confirmed that the skill does not claim unsupported native parsing.
SpritePad Pro 3.80/SPD v5, CharPad Pro 3.88/CTM v9, the accepted PSID v1–v4 subset, and classic
Koala identity are pinned, but a parser or selector remains fail-closed until its producer schema,
representative producer fixture, malformed/wrong-version fixture, exact selector result, and hash
are present. This is the required implementation-proof boundary, not deferred Phase-5 knowledge.

The final Q-P13/Q-P16 correction grade independently recalculated every stated byte/cycle/storage
total and the deterministic collision/sprite oracles. Both pass. All focused work was read-only
content evaluation. No compiler build, typecheck, lint, package test, assembler, readiness suite,
VICE/emulator, or hardware test ran or is claimed.

## Phase-6 Focused Results

The Phase-6 evaluator received only `acme-and-artifacts.md`, `target-portability.md`,
`evidence-parity-and-recovery.md`, `source-manifest.md`, `compiler-architecture.md`, and the ten
assigned prompts. It was forbidden the hidden oracles, plans, compiler code/tests, legacy
references, prior outputs, network access, and executable tools. Its first pass found two content
integration defects: Q-R12's minimum route was inferable but not explicit, and one selected module
still displayed an older construction version. Both were corrected without changing an oracle.
The evaluator's focused recheck passed.

An independent grader then received the captured decisions, the two hidden case files, current
candidate references, and the already downloaded pinned primary materials. It checked the exact
ACME bytes and diagnostic, C64 BASIC/PRG layout, VICE option/debug-cart semantics, target facts,
status bounds, and case integrity. It reported no findings.

| Case | Final result | Decisive current evidence |
|---|---|---|
| Q-A01 | Pass | Resolved symbol, report and actual bytes are mandatory; the exact future width probe expects `a5 fa ad 00 01 ad fa 00 a5 fa` |
| Q-A02 | Pass | Generated low/high extraction is parenthesized and the exact future result for `$12ff + 1` is `00 13` |
| Q-A03 | Pass | Value, symbol, forced-width and first-pass-forward behavior are distinct and byte-checked |
| Q-A04 | Pass | Displacement 128 has the exact source-derived error; legal compiler repair occurs before serialization and retains path-cost proof |
| Q-A05 | Pass | The 22-byte PRG, `$0801` load header, `$080b` terminator link, `$0810` entry and BASIC `SYS 2064` startup agree; runtime remains a separate future proof |
| Q-A06 | Pass | Missing or skipped VICE remains `Unknown` and outside every green count |
| Q-A09 | Pass | Atari/X16 delegation to C64 startup/output is `Scaffold/stub`, never support |
| Q-A10 | Pass | Language, CPU, platform, serializer and packager/startup facts retain separate owners |
| Q-A17 portability facet | Pass | Primary sources, constraint-only status, target cases, separated contracts and a vertical artifact proof are required; Phase-7 integration remains |
| Q-R12 | Pass | A narrow ACME question loads only `acme-and-artifacts.md` and `source-manifest.md` unless its scope expands |

These results qualify the knowledge content and exact future proof specifications, not executable
observations. Phase 6 did not run ACME, VICE, the compiler, package tests, readiness, or hardware.

## Phase-7 Candidate Integration Results

The focused router evaluator received the isolated `1.0.0` candidate router and only the references
available through that router. It evaluated Q-R01..Q-R04, Q-R10..Q-R11, Q-A14..Q-A15, Q-A17, and
one cross-domain sprite-multiplexer routing regression. It did not receive hidden oracle text,
prior answers, plans, compiler implementation, readiness artifacts, or the feasibility matrix.

The first independent grade passed every answer except Q-R01. That answer selected lowering and CPU
knowledge but omitted the Blend65 semantics and parity/evidence references required for a generated
signed-comparison review. The router was corrected so concrete lowering always selects lowering and
CPU knowledge, and a Blend65 parity review also selects semantics and evidence/parity knowledge.
A corrective evaluator rerun selected exactly those four references; the independent re-grade
passed Q-R01 and the cross-domain regression. Q-R02, Q-R10, Q-R11, Q-A14, Q-A15, and both Q-A17
facets now have focused evaluator and grader passes.

The independent broad review covered hardware/tool accuracy, semantics and SFA, lowering/effects/
optimization/cost, C64 game practicality, modern ergonomics and representation leaks, source
governance, routing, migration completeness, oracle integrity, and overengineering. It found one
major activation-state contradiction and two stale construction labels in runtime references. The
user accepted the remedies on 2026-09-08. The C64 baseline now has activation-stable wording, and
runtime references no longer carry construction-phase labels. A final bounded re-review and
Prettier check returned no findings. No specification test was present or changed.

The first complete filesystem-isolated run was validly launched but failed grading and is wholly
invalidated. Its five evaluator captures contained all 107 case rows. Routing plus parity/recovery/
portability passed 29/29; language/architecture/SFA passed 22/33; CPU/lowering plus C64/game passed
42/45, for 93/107 overall. Independent diagnosis found thirteen evaluator-capture omissions caused
by the launch instruction's demand for compact one-row answers. The required knowledge for those
thirteen cases was already present. Q-L26 exposed one real candidate defect: the runtime CharPad
knowledge lacked exact packed-12 byte order, the 4095 availability boundary, odd-count padding,
the complete selector/type/availability surface, and E10144 ownership.

The accepted correction adds those exact frozen-spec invariants without changing the oracle or
introducing a new language concept. The independent correction review first found missing `const`
array result types and imprecise tile-only availability; the repaired table then passed re-review
with no findings. A fresh focused Q-L26 evaluator and independent grader passed both Q-L26 and a
cross-domain canonical/packed/split-map plus VIC-placement regression. The corrected runtime-tree
digest is `2d93fa030b9355300e67c02b39847edcfca3e0e2cc4353aa0285d88eb76c83c7`;
the focused answer hash is
`b25f637220eb08728a15c3eb5cd86468344183322ae030064df9e356058295a2`. The replacement definitive
launch removes the compact-row constraint and requires exhaustive case-by-case rule coverage. No
result from the invalidated run contributes to release qualification.

## Migration

The coverage matrix pins every material legacy heading and its planned destination. Phase-3 through
Phase-6 candidate modules now provide evaluated replacements for every old heading. The four old
references remain in the working tree as hash-checked read-only evidence until the Phase-7
Candidate Pre-delete Gate.

## Verification

The initial Phase-1 verification passed on 2026-09-04, but the independent quality review
invalidated that result because its field-presence check did not detect malformed packet values.
The accepted remediation added meaningful-value, inline-code-delimiter, pipe-integrity,
module-conflict, and split legacy-router identity checks. Remediation verification passed on
2026-09-04: the existing skill validator, touched-file Prettier, all 100 eleven-field packets,
exact case/spec/topology sets, SC-001..SC-004, 40 legacy headings, both router identities, five
unchanged legacy-evidence files, local Markdown links, the strict phase allowlist, `spec/`
cleanliness, spec-test integrity, and `git diff --check` are green. The independent re-review
returned no findings. No compiler package, readiness, boundary, emulator, or full repository test
is applicable to this Markdown-only construction checkpoint.

Phase-2 content verification passed on 2026-09-05. The skill packaging validator and touched-file
Prettier check are green. The case files and matrix contain the same 100 unique case IDs; the live
specification and matrix contain the same 50 Markdown paths; all non-policy source-audit rows name
a defined stable source; all 47 non-conflicted external oracles are frozen; the four reclassified
project-policy oracles and two externally gated blocked conflicts have their exact expected states;
and all 11 focused evidence/recovery cases record a pass. The current construction-router identity,
five unchanged legacy-evidence hashes, strict Phase-2 path allowlist, roadmap links, `spec/`
cleanliness, spec-test integrity, and `git diff --check` also pass. This was content validation only:
no compiler build or test, assembler, VICE or other emulator executable, emulator probe, readiness
suite, or physical-hardware proof ran or is claimed.

Phase-3 content verification passed on 2026-09-07 under identity
`BLEND65-SPEC-P3-ed278ab9`, with full digest
`ed278ab974513b4975ece688d7b9a91a2346e4d0f6478c96b85a4a2bd3d50a14`.
The skill validator, touched-file Prettier check, exact 50-path set/digest, 96 grammar-definition and
production-index sets, 29 reserved intrinsic routes, 177 diagnostic entries (148 errors and 29
warnings), 107 unique eleven-field qualification cases (R12/L33/C24/P21/A17), source-key
definitions, local links, legacy/live hashes, strict path allowlist, spec-test integrity, and
`git diff --check` pass. This was documentation and content validation only. No compiler build,
typecheck, lint, package test, assembler, readiness suite, VICE/emulator, or hardware test ran.

Phase-4 content verification passed on 2026-09-07. The machine grid contains all 56 documented
NMOS mnemonics, 151 legal mnemonic/addressing pairs, and 151 unique official opcode bytes. The five
casebooks retain 107 unique eleven-field cases (`R12/L33/C24/P21/A17`); Q-C01..Q-C24 and the focused
candidate route Q-R01 all pass their evaluator and independent grade. The skill packaging validator,
touched-file Prettier check, local Markdown path/anchor check, source-key resolution, exact current
router identity, five pinned legacy hashes, strict Phase-4 path allowlist, frozen-`spec/` check,
spec-test integrity check, and `git diff --check` are green. This was content validation only: no
compiler build, typecheck, lint, package test, assembler, readiness suite, VICE/other emulator, or
physical-hardware test ran or is claimed.

Phase-5 content verification passed on 2026-09-07. The case files retain 107 unique cases with all
eleven required fields; Q-P01..Q-P21 and the focused candidate route Q-R04 pass after corrective
evaluation. Every candidate citation key is defined in the manifest; all checked local Markdown
links and named reference anchors resolve; the required PAL/NTSC, VIC-II, CIA, SID, asset, Integrator,
memory, runtime, and game-engineering topics are present. The construction-router identity and four
legacy-reference hashes match their records. The skill packaging validator, touched-file Prettier,
strict Phase-5 path allowlist, frozen-`spec/` check, spec-test integrity check, and
`git diff --check` pass. This was content validation only: no compiler build, typecheck, lint,
package test, assembler, readiness suite, VICE/other emulator, or physical-hardware test ran or is
claimed.

Phase-6 content verification passed on 2026-09-08. The skill validator and touched-file Prettier
check pass. The five case files retain 107 unique cases with exactly all eleven required fields;
Q-A01..Q-A06, Q-A09/Q-A10, Q-A17's portability-content facet, and Q-R12 record focused passes in
their correct packets. All candidate citation keys are defined, every checked local Markdown path
and anchor resolves, all required ACME/PRG/VICE/target markers exist, the construction version is
consistently `0.6.0-artifacts-portability`, and all four legacy-reference hashes match. The strict
Phase-6 path allowlist, frozen-`spec/`, spec-test integrity, and `git diff --check` pass. This was
content validation only: no compiler build, typecheck, lint, package test, readiness suite, ACME,
VICE/other emulator, or physical-hardware test ran or is claimed.

Phase-7 Candidate Pre-delete verification passed on 2026-09-09. The skill validator, metadata YAML
parse, touched-file Prettier, local Markdown links, source-key equality, exact thirteen-reference
and seven-qualification-file topologies, exact 50-path specification set and digest, 107 unique
eleven-field cases, 107 appended definitive passes, final runtime-payload identity, focused-output
hashes, legacy-reference pins, specification-test integrity, authorized path boundary, and
`git diff --check` are green. The independent correction re-review reports no findings. The final
HLE re-scan contains HLE-001..HLE-009 and EXP-001 with zero omitted, pending, or unreconciled
exception. This was skill and Markdown validation only: no compiler build, typecheck, lint,
package test, readiness suite, assembler, VICE/other emulator, or physical-hardware test ran.

## Post-phase Review

### Phase 1

| Finding | User ruling | Remediation state |
|---|---|---|
| RV-001 — Q-L21 packet and matrix row were truncated | Accepted 2026-09-04 | Implemented and verified; independent re-review found no remaining issue |
| RV-002 — Q-L23 ignored a frozen-spec contradiction | Accepted 2026-09-04 | SC-004 recorded and case blocked; independent re-review found no remaining issue |
| RV-003 — legacy-router identity rule contradicted quarantine replacement | Accepted 2026-09-04 | Historical/live identities split; independent re-review found no remaining issue |

### Phase 2

| Finding | Resolution authority | Remediation state |
|---|---|---|
| RV-001 — AC20 still required compiler/full-repository verification | User's explicit skill-only verification instruction, 2026-09-05 | Replaced with applicable content checks and an explicit no-executable boundary; re-review clear |
| RV-002 — requirements retained obsolete multi-release path and full-verification wording | Accepted single-active-release design | Topology, release prose, and AC17 now use only `qualification/release.md`; re-review clear |
| RV-003 — future-target precision was overstated and no manufacturer VIC-II source was pinned | Accepted source-depth and source-governance requirements | Added bounded hash-pinned CSG 6567 evidence, exact target locations/identities, and SRC-011; re-review clear |

The independent re-review found no remaining critical or major issue. Spec-test integrity remained
intact, and no compiler, assembler, readiness, emulator, or hardware execution was performed.

### Phase 3

The first correctness and semantics review found an incomplete grammar/runtime/diagnostic conflict
scan, unsupported focused-result evidence, a weakened parity-debt rule, an incorrect function-local
user-ZP assumption, and imprecise comparative source keys. Those accepted findings were remediated.
The rebound semantics review confirmed the 50-path inventory, exact digest method, CharPad/Koala/
future-target rulings, cast independence, data diagnostics, project-policy provenance, and
historical-document containment. It then found seven further inconsistencies: non-total Unicode
mapping (P3-001), open/mismatched ABI prose (P3-002), an unsound signed-division cost table
(P3-003), callback-to-interrupt migration drift (P3-004), incomplete `for` syntax summaries
(P3-005), provisional type-alias wording (P3-006), and incorrect token totals (P3-007).
P3-002..P3-007 are repaired as SC-043..SC-048. AR-P24 was accepted after clarifying that Unicode
exists only in hosted source, and P3-001 is repaired as SC-049 with finite compile-time
scalar-to-byte maps and E10249 rejection. Strict re-review then invalidated
`BLEND65-SPEC-P3-9ea60a68`: AR-P25 repaired exact map identity as SC-050, mechanical corrections
closed SC-051..SC-053, and AR-P26 repaired the C64 KERNAL/raw interrupt split as SC-054. The first
comprehensive evaluator then found four derived-document defects: stale evaluation-authority claims,
contradictory startup guidance, a literal-category miscount, and a grammar count/undefined-symbol
error. Those defects are repaired as SC-055..SC-058. A focused Q-L29 rerun then found that the NMOS
IRQ ABI did not establish binary-mode handler entry and did not constrain the saved indirect-chain
pointer away from `$xxFF`. AR-P27 repairs both as SC-059. Final correction evaluation then found
invalid ISO notation in the master lexical grammar, F021's missing `?` production, absent governing
authority for ordinary expression operand order, and absent Chapter-14 authority for dependent
cascade suppression. These are repaired as SC-060..SC-062. Clean Q-L01 reruns then found incomplete
ISO normalization across the remaining lexical grammar surfaces, a stale migration diagnostic count, a
mandatory conditional tail in one expression fragment, and a missing governing SpritePad default.
These are repaired as SC-063..SC-066. The reconciled 50-path specification is
then repaired once more as SC-067 after the final Q-L27 evaluator found a stale fictitious
SpritePad `"colors"` selector in the generic profile example. It is now bound as
`BLEND65-SPEC-P3-001b1331` after a deep all-file rerun also repaired stale type/array/primary
grammar fragments, standardized Unicode exclusions, and narrowed startup authority as
SC-068..SC-072. The paired regression also corrected F024 concatenation, removed the unsupported
frame-warning profile field while preserving exact frame-cost reporting, restored canonical
diagnostic-code ownership, and reconciled the initial SID selector surface as SC-073..SC-075.
One final focused regression removed a residual C64 frame-warning claim and a master-only array
trailing-comma allowance as SC-076..SC-077. Mechanical path, grammar, and diagnostic equality checks
pass.
Historical comprehensive correction reruns and independent grading passed under
`BLEND65-SPEC-P3-3344394e`; that identity was later invalidated and is supporting evidence only.
Subsequent reviews and accepted rulings expanded the durable reconciliation through AR-P42 and
SC-151. They replaced range-only loops with the familiar three-clause loop; closed local-address,
explicit-stack, BRK, audio/SID, fixed-array, any-size-parameter, index-ordinal, object-domain,
query-width, cost-boundary, diagnostic, and derived-grammar gaps; and explicitly rejected a new
view/slice/span/subrange language concept. Each specification edit produced a new digest rather
than inheriting a historical grade. `BLEND65-SPEC-P3-ed278ab9` passed its Phase-3 affected-case
evaluation, focused Q-L19 evaluation, and formal-semantics re-review. The first independent grade rejected four focused answers
because they addressed the wrong stored case meanings; that failed evidence grade is recorded
above. The corrective four-case capture and fresh independent grade pass Q-L01, Q-L14, Q-L20, and
Q-L24; Q-L19 retains its pass. The final correctness re-review reports no findings. No Phase-3
semantic conflict or new array-view concept remained in that historical checkpoint. The third
definitive Phase-7 attempt later exposed AR-P42's four crosswalk conflicts. The corrected
then-current identity was `BLEND65-SPEC-P3-6f5a1734`; AR-P43 later superseded it with
`BLEND65-SPEC-P3-4bf8a989`. No earlier result is relabelled as qualifying evidence for either
identity.

### Phase 4

The correctness reviewer found two major content defects and one minor reference defect. The reset
entry lacked exact timing, stack-pointer effects, and page-one bus accesses; traceability still
described completed CPU/lowering modules as planned; and two references used the wrong opcode-grid
anchor. The remedies add the exact bounded seven-cycle NMOS reset sequence and registered
`VISUAL6502-RESET-2010` evidence, reconcile every affected Phase-4 status boundary, and correct both
anchors. The independent re-review reports no findings. Security and performance specialist reviews
were skipped because this phase changed only non-executable skill and planning Markdown. Spec-test
and frozen-`spec/` integrity remain intact; no compiler, assembler, readiness, emulator, or hardware
execution was performed.

### Phase 5

The correctness reviews found eight major defects across the initial and final passes. Each finding
was repaired in the candidate knowledge and its affected case was re-graded; Q-P07 was strengthened
to cover its plan-mandated NMI half without weakening an existing invariant, and no skill-content
gap was deferred.

| Finding | Remediation and focused re-grade |
|---|---|
| RV-001 — exclusive-CINV and raw IRQ costs included redundant `PHP`/`PLP` | Removed the pair where final `RTI` restores status; Q-P07 passes with exact wrapper/tail/output/stack totals |
| RV-002 — CPU availability subtracted VIC refresh as a CPU-denied slot | Availability now unions only second-phase denial and keeps BA warning distinct from AEC denial; Q-P04–Q-P06 and Q-R04 pass |
| RV-003 — double-IRQ stabilization was named but not taught | Added the bounded PAL template with 64-cycle convergence, exact 78-byte wrapper and nine-byte local stack high-water, fixed low-raster domain, ownership, rejection cases, and future proof; Q-P17 passes |
| RV-004 — joystick and keyboard mappings were missing | Added exact active-low CIA1 joystick bits, complete PA-column/PB-row matrix, shared-line/DDR/latch rules, and direct-lowering bounds; Q-P10 passes |
| RV-005 — CIA/SID register and bit maps were conceptual rather than exact | Added the complete CIA offsets/CRA/CRB/ICR bits and SID voice/global/control/filter maps; Q-P09 and Q-P11 pass |
| RV-006 — Q-P13 logical-record and resource totals overlapped ambiguously | Defined the six-byte record and one additive `457 + 2 + 2`, then padding/alignment, partition; Q-P13 passes after independent recalculation |
| RV-007 — task 5.2's wrapped/raw NMI half had no exact contract or qualification | Added revision-pinned `$FE43`/NMINV and raw routes, exact save/status/cycle/byte/stack accounting, CIA2/RESTORE/cartridge/nesting ownership, safe vector/banking transitions, and future proof; strengthened Q-P07 passes a fresh grade |
| RV-008 — chained-NMI save elision ignored prior-handler observers | Restricted interrupted-point-only elision to exclusive/raw routes; a chain also proves every reachable prior-handler observer; Q-P07 passes its correction re-grade |

The final independent correctness re-review reports no findings. All re-grades were content-only.
Security and performance specialist reviews remain inapplicable to this non-executable
documentation phase. Frozen-`spec/` and spec-test integrity remain intact; no compiler, assembler,
readiness, emulator, or hardware execution was performed.

### Phase 6

The initial review packet omitted the exact verification recipe/result, so the correctness reviewer
correctly refused to issue a verdict. While completing that packet, it also identified that the
Q-R12 focused-result text had been placed under Q-R02. The result was moved to its exact case and
Q-R02 was restored to `Not run`; no oracle text changed. The complete verification recipe then
passed, and the resumed independent correctness review reported no findings. Security and
performance specialist reviews were skipped because this phase changes only non-executable skill
and planning Markdown. Frozen-`spec/` and spec-test integrity remain intact; no compiler, assembler,
readiness, emulator, or hardware execution was performed.

### Phase 7 definitive qualification

The first two definitive evaluator attempts were invalid because the evaluator omitted required
case fields. The third attempt used smaller batches and produced substantially complete routing,
parity, CPU, language, and C64 answers. It is nevertheless invalidated in full: Q-L01 correctly
exposed four material conflicts between summary/specification text and the candidate crosswalk.
AR-P42 resolves them without preserving or consulting compiler implementation behavior:

| Correction | Accepted result |
|---|---|
| Atari 7800 timing summary | 1.79 MHz nominal CPU timing; 1.19 MHz TIA/RIOT accesses and MARIA DMA stalls remain separate constraints |
| Axiom A4 | No hidden execution or unenumerated coercions; only TS-4 and TS-14 supply current implicit conversions |
| Future register | Count-free `FUT-NNN` reference; the live register is the only endpoint authority |
| F001 crosswalk | Only supplied files, one output binary, path-name irrelevance, and module-based cross-file references; no invented discovery, mapping, duplicate-module, or diagnostic-stability rules |

An independent decision challenger preferred these narrow corrections over changing TS-4/TS-14,
broadening F001, or creating a second authoritative errata layer. The accepted corrections are
SC-148..SC-151 under exact specification identity `BLEND65-SPEC-P3-6f5a1734`, digest
`6f5a17341fa2b67f9783a875bf791d8cf3ad2bbe838a929981023ffa6e503c81`. The intermediate
`BLEND65-SPEC-P3-400777d0` identity is also invalidated: changed-surface review found its feature
index still duplicated the future-register endpoint. All outputs and grades from
the three earlier definitive attempts are historical diagnostic evidence only. Current
qualification requires a complete blind coverage sample, focused green evidence for every
corrected and dependency-traced case, deterministic gates, and independent review with zero
unresolved material knowledge or oracle defect before activation.

The next isolated run under `BLEND65-SPEC-P3-6f5a1734` produced all 107 answers and reached
107/107 after response-only corrective captures. That result is preserved as historical evidence,
not qualification: the mandatory final hardware-limitation scan then found substantive candidate,
oracle, and derived-specification omissions. AR-P43 resolves them as SC-152..SC-155:

| Final-scan finding | Selected correction |
|---|---|
| Division safety text allowed a selected failure handler | Only default-off `--division-zero-check`; C64 uses the canonical source-labelled `SEI` plus self-loop stop with no handler/runtime/RAM/ZP. |
| HLE-005 omitted W10141 | W10190 remains function-local read-path analysis; W10141 independently covers every nonzero uninitialized mutable array, including module arrays. |
| Historical range and per-function activation claims survived | SC-104 is historical under SC-131; frame and optional return-home costs are per allocated activation instance. |
| Address workarounds were called universal | Manual base-plus-`offsetof` applies only to addressable named objects and lifetime-contained uses; parameter fields need a separately passed address. |
| Migration and C64 default-boundary disclosures were absent | Migration now lists HLE-001..HLE-009; the C64 appendix states default modulo-65536 addressing and banking/MMIO effects. |
| Aggregate returns lacked a debt owner | EXP-001 marks current E10093/E10120 fixed aggregate-return rejection as redesign debt and selects caller-owned destination passing through SFA. |

The corrected specification identity is `BLEND65-SPEC-P3-4bf8a989`, digest
`4bf8a98934df6282febe013c31a16d89dd73f8e8bbbce9e87b6678e1b75013fe`. Q-L20, Q-L23, and
Q-A08 are strengthened in place, so the inventory remains exactly 107 cases. The changed surface
passed independent review and affected-case isolated evaluation; no result from
`BLEND65-SPEC-P3-6f5a1734` is relabelled.

The immediately preceding `BLEND65-SPEC-P3-8983563e` candidate is also historical. Independent
changed-surface review found one minor but real provenance defect: FUT-010 covered struct and fixed
array returns in its body while its source metadata and summary still named only F011/structs. The
repair names aggregate returns and binds both F011 and F014; the evaluator process started before
that finding was stopped and none of its output counts toward qualification.

The final `BLEND65-SPEC-P3-4bf8a989` complete coverage sample produced 107 answers and 107
independent grades. It passed 105 cases and exposed the only two material misses, Q-L26 and Q-L27.
The candidate runtime payload digest was
`1dfcffd62bb6dde82f03faf11d1aa5abe22e26086bd485d5dbb6e9c2533aaa56`; the sorted output-tree
digest was `64eca25491bb2620a2203211be95b89a593a2b88bb6b175c9f7ec21a55368e34`.
Under AR-P44, those failures invalidate only their corrected and dependency-traced surfaces; they
cannot be hidden by aggregate scoring or an unrelated pass.

The first corrected focused packet passed both Q-L26 and Q-L27. Its case-prompt hash was
`0c806f1f538a5191b8924cc7deed1c76cacaafb6e2f9ec104a030571cfd0b630`; its relative-path sorted
packet-tree digest was `c11fa066897ce95568241dec2b24a3738942eddf05e45507d6205c3927f022f8`, and its
`SKILL.md`/`agents`/`references` runtime-payload digest was
`807315680008b2275795b274034a2900aec25099ec84a3a5bfda5b8bb7827e0d`. The independent grade
hashes were `1d5823dcbbb3d477b62e8d2f4c7fb61654c7f2988fde2f1656f7ec145060cae4` for Q-L26 and
`3aebd0b981ee2e15f05dcf88f6fac80008c5d517c4a160a4a6f8e76e6a191ab8` for Q-L27.

The final router and interval-based VIC placement packet used the same case-prompt hash, a
relative-path sorted packet-tree digest of
`a0a558350c09b8981fbbcf36b0a3fcc1da86ae2ced31c67469d237bedd495594`, and a runtime-payload
digest of `bb05def96d180926bbc2cb57131550f633d2c87369a2b34c97b55d148d2cdf82`. Its Q-L27 evaluator
and grade hashes were `99705ad563eafc0705f6db24647210d5ec17c3943ec2974c04e1f527a87e9b35` and
`1f29c46e3de1c679fbe0cb6dcd96937f0225c0f4e15ad014fa8c503b7a2a7ea8`. The grade passed
interval-based VIC placement, active-screen and contained pointer-table occupancy, alignment,
padding, runtime access, resident subsets, and fixture provenance. A final Q-L26 native-handler
regression against those exact packet/runtime digests produced evaluator hash
`c34092d25d75d93c6172e09c789399b5d83aa662d0f5dc079b4364c0a7a06982` and independent passing
grade hash `291a788bfd00d6f6c6bbd0c457fc16332a2fa26290023f22534621c6e2a7eda5`. All packet-tree digests
use `(cd packet && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum)`;
runtime-payload digests use the same method over `SKILL.md`, `agents`, and `references`. Positive
and negative sandbox controls passed before each final launch. No compiler, assembler, readiness,
VICE, other emulator, or hardware test ran or is claimed.

The final correctness review found three major evidence-integrity defects and one minor metadata
defect: no post-router-change native-handler regression, ambiguous prompt-only packet hashes, 105
unwritten definitive-result fields plus stale matrix states, and an AR-P44 header lag. The remedies
added the exact-current-packet Q-L26 pass, reproducible packet/runtime digests, all 107 append-only
final results, reconciled matrix states, and current ambiguity metadata. Independent re-review
reports no findings and confirms specification-test integrity.

## Specification 4 Candidate Dependency Closure

This section is the qualification boundary for expert candidate 2.0.0. Earlier sections are
historical 1.0.0 evidence and are not relabelled as current.

### Byte identities and comparison method

| Record | SHA-256 / result |
|---|---|
| Active 1.0.0 runtime payload | `bb05def96d180926bbc2cb57131550f633d2c87369a2b34c97b55d148d2cdf82` |
| Candidate 2.0.0 runtime payload | `af8579e3453a02c81024a5f800079586b961a8e0c8c8ff38bff242f7f9addfb9` |
| Changed H2-section comparison | 51 records; `c5042ecc87910558e727779be7db9d6870c9219f3fc2e39efb92ad9ede8a8136` |
| Changed case-section comparison | 16 records; `d6869018aa8fc980767dc3e8810b355fa60e7e2fbbcc284346eb36a1d8b70baf` |
| Runtime files | 15 total; 13 changed; `references/c64-hardware.md` and `references/mos-6502-family.md` byte-identical controls |
| Case identities | 107 prior identities preserved plus Q-C25, Q-C26, Q-C27, and Q-P22 = 111 unique |

Runtime-payload digests use the existing relative-path-sorted GNU SHA-256 record-stream method over
`SKILL.md`, `agents/`, and `references/`. The H2 comparison splits `SKILL.md` and every reference
into the byte-exact preamble plus each `##` heading through the byte before the next `##`; it emits
`<active-hash> <candidate-hash> <relative-path>#<heading><LF>` only when bytes differ, sorts those
records by the complete record under `LC_ALL=C`, and hashes the stream. The case comparison applies
the same method to every `## Q-NN —` section. A missing new section hashes as the empty byte string.
This keeps an unrelated version/preamble edit from invalidating an unchanged knowledge heading,
while any byte change inside a referenced heading or hidden case oracle invalidates inheritance.

`agents/openai.yaml` changed from
`94dc79f61ffc4f834f45d9e03353837089ab46f9a0fa52703aa5619e742c9370` to
`e4a9f2e3a50b59f4824ba39443ce8ff846f52134f5effdc0424b763805b5df38`; it affects package
metadata, not evaluator case semantics. Router behavior uses the changed `SKILL.md` sections and is
covered by the routing cases below.

### Required fresh case set

The transitive set is conservative: it includes every changed case section and every existing case
whose routed knowledge, authority/source section, or decision policy intersects one of the 51
changed sections.

| Casebook | Changed or dependent cases requiring fresh evaluation |
|---|---|
| Routing/evidence | Q-R01, Q-R03, Q-R04, Q-R05, Q-R08, Q-R10, Q-R11 |
| Language/architecture/SFA | Q-L01, Q-L08, Q-L11, Q-L14, Q-L19, Q-L20, Q-L21, Q-L26, Q-L29, Q-L30, Q-L31, Q-L33 |
| CPU/lowering/optimization | Q-C07, Q-C13, Q-C15, Q-C18, Q-C19, Q-C21, Q-C22, Q-C23, Q-C24, Q-C25, Q-C26, Q-C27 |
| C64/platform/games | Q-P07, Q-P11, Q-P12, Q-P13, Q-P15, Q-P16, Q-P20, Q-P21, Q-P22 |
| Parity/recovery/portability | Q-A08, Q-A09, Q-A17 |

This is 43 cases. It covers the frozen Spec 4 crosswalk, removed intrinsics/targets, aggregate
returns, C64/D64/KERNAL/Koala, product boundary, optimizer modes/frontier, and router/source
governance. No case is added merely to test formatting or a baseline label.

### Fixed unchanged controls

Each control's case section and all named decisive knowledge sections are byte-identical to active
expert 1.0.0. They are nevertheless rerun to prove packet isolation and evaluator behavior.

| Casebook control | Case SHA-256 | Decisive unchanged knowledge SHA-256 |
|---|---|---|
| Q-R02 | `4141ea9aab697a19c91c580d93dcd674c340e62a72a642f838766de382797d93` | `SKILL.md#Selective Loading` `dfc908423d41db0bab160aea5f73da2a7c86975d2f494770d3f7b7b9713c9594` |
| Q-L03 | `f368e9c82472d879601092e4598083e80204e82c1f31a1237bb8ad81dddecdef` | `il-and-optimization.md#Memory Effects and Volatility` `073f3c33896417cbde95218ce1d64cfac1968b5dbf2ec89a19402327d0692daf` |
| Q-C10 | `a65dcc3327dbd25102f2ef453c90e438813f6e3236324d4e9d02136209e886e5` | `c64-hardware.md#Volatile and RMW policy` `60b3fa7a55735335ba44f366d07362beeae78144ebb0990904e1de7945ecf5e5`; `6502-lowering-casebook.md#Volatility and device memory` `7e1f53ed5d2db6470bdec5441fa52ff04290c43f78482146849695a6831359f2` |
| Q-P08 | `d004d45a6d1727c7b3269c63ba624bbb754437f4e51e4023b016db51e690b95e` | `c64-game-engineering.md#Raster scheduling` `3d2e6af00685ed3bcdc11e024ecd433ea44c6ad9b1c9d9d6d47dcee533a153f7`; same unchanged C64 RMW section as Q-C10 |
| Q-A06 | `4a356dd9f23d8af29168d7bc22d59899d35266f9359ae7a2cdd3d2740c689920` | `evidence-parity-and-recovery.md#Five Capability States` `41bda940dca651572b9d7fef62c0de9094e46217c1cd51121484921e104b29f3`; `acme-and-artifacts.md#VICE Proof Contract` `1a5ab58a9fdbcaaa7435d3b6734cbf12a3a1dc34e96e4a97f710b0afff6b9b60` |

### Strictly eligible inherited evidence

These 68 existing cases have byte-identical case oracles and byte-identical routed knowledge/source
sections. The five named controls are eligible but will receive fresh evidence; only the remaining
63 may actually inherit their recorded green result.

- Routing/evidence: Q-R02, Q-R06, Q-R07, Q-R09, Q-R12.
- Language/architecture/SFA: Q-L02..Q-L07, Q-L09, Q-L10, Q-L12, Q-L13,
  Q-L15..Q-L18, Q-L22..Q-L25, Q-L27, Q-L28, Q-L32.
- CPU/lowering: Q-C01..Q-C06, Q-C08..Q-C12, Q-C14, Q-C16, Q-C17, Q-C20.
- C64/platform/games: Q-P01..Q-P06, Q-P08..Q-P10, Q-P14, Q-P17..Q-P19.
- Parity/recovery/portability: Q-A01..Q-A07, Q-A10..Q-A16.

The 43 fresh cases and 68 eligible cases are disjoint and cover all 111 candidate identities. If a
later byte change touches a listed input, inheritance closes and the affected case moves to the
fresh set. Coverage/release prose and plan state are never supplied to evaluators and therefore do
not create semantic dependencies.

## Specification 4 Isolated Qualification

Candidate 2.0.0 was evaluated with `gpt-5.6-sol` at high reasoning and independently graded with
`gpt-6-astra` at xhigh reasoning. Kernel Landlock restricted each process to its packet and private
output paths. Every final evaluator and grader read its packet successfully; every attempted read
of the repository `AGENTS.md` failed with `Permission denied`. Evaluators never received case
oracles. Only graders received the matching oracle sections.

The final evidence covers 43 changed/dependent cases and the five fixed controls. All 48 have a
passing evaluator response and separate passing grade. The other 63 cases inherit only because
their case and routed-knowledge sections remain byte-identical. No aggregate score hides a failed
case.

### Final evaluator captures

Each entry is `case IDs: packet-tree SHA-256 / evaluator-output SHA-256`. Packet-tree hashes use the
relative-path-sorted GNU record-stream method.

| Casebook | Final capture groups |
|---|---|
| Routing/evidence | Q-R01/Q-R02/Q-R05/Q-R08/Q-R10/Q-R11: `329f991ff73a56355678ebaf52097bb43f48b92a6c186df78bf052de0094dd5f` / `9f1311d0f9f76fdae3f110ace56778009e306da909c785359bedcacc9c4c6681`; Q-R04: `25430a2cf0237ad7c4ad1f20d31830393754e137cd20bc63a5a6e19c3c1ce7d2` / `aafcd46b3297d49e56bf241898cb95c79ea83f21fecb007f07989eb62900b29a`; Q-R03: `fff3710bf570ca03137d99f5598d678f7431d4e9e04aa0cc587c07527904ed1e` / `dac939a8e86a0ab523e526202778f1dd2eb2a217a97ff75c32b92ae9b701f05d` |
| Language/architecture/SFA | Q-L08/Q-L11/Q-L26/Q-L29: `652965694470ee986a768b0b137a31fe73548f267574b46242208bc13ef5b120` / `5d84fe5190621471a39fbdb2112adb87cb1890637887e683147119d16c1f227e`; Q-L03/Q-L14/Q-L20/Q-L21: `8083b5bb55d6d39b213c2cbafa0198e1fee50390b91c06da6edcf1d37085e3d2` / `ff24ceeea4fe3d36c656b7ac36d532951aad7795656d6c50a296e0c0568867fb`; Q-L33: `8cc3e2c66761d8e6ae7928064c0b404f9a8207320f3fdf943be350c5920ddca6` / `29ab5383f82f2360baaadf583ee4417e62f0f6271a768bbd50d5ad1f8a0d2d99`; Q-L01/Q-L30: `7f55f2868d86b8d43eb1776cf83bfa118164a432779732bc3c783c2deb92f341` / `d3f55b90da905a6480a269af0873fab6ee9e1ef23c0c0a35c79a2d48592217c9`; Q-L31: `a9014fd0fbc051cc2466b8d6784a3c705038303d169f047a6a415ccd0aa93a27` / `f73fa90ccbb77573a0d186a7f77acedafe640674fe208f090aec837b2f023353`; Q-L19: `635014ded39a3cd75384145f61d9623ef4df63cb1419971f51036fd603574eed` / `119c374d535d578ad0017c68cc2c85733b711ad72a5d804e56a2a3ce1a670e61` |
| CPU/lowering/optimization | Q-C07: `4dd8c8a2eb8fe128de4b1429e10d26d9905db89d5f8c3d210b1c5007633cc7f8` / `4399a8aae01414cf599bee36b36e8457ce2ba13d6ec05619ca021a7518f11095`; Q-C10/Q-C13/Q-C15/Q-C18/Q-C19/Q-C21–Q-C27: `d91311ca89713d848f3eb5c794fda1af127665d2ac53da695183515398341798` / `ce23c45cec3d8e1a9fcd1859903961538c1d41ba0a297bc93d52bde54b74fafd` |
| C64/platform/games | Q-P16/Q-P20/Q-P21/Q-P08: `ba4a49306888d7009b42e931e87a714daadaef1a971009feb36cb9939d6640d0` / `c8b057de39816fed09472dcc702af0d2e818d4836601085ef333ebe3411b0953`; Q-P13: `4cf8de6f9d1fb14363e4f246906cbd4ca75fb723cb5e34c6f488f0a86086f7a8` / `400b9c0bf58addd835f4856978b6d0b458da31c383287af34e9fe6456ee7612e`; corrected Q-P15: `3d452eb2e13ca80b36c8560d2ee6f9243e026efc56a9c14e9e9fef707db5f6f7` / `f3de138a8e76a24a7f678cd791e58d3d5c85a67a515497b0fc5ed0839518ec0f`; Q-P11: `0ef387401958609dfe825855983c0c15340c851d844a97ef27048726955a1a96` / `c97cca5a302b3c44dae5d0efdf61b234de7dcd568ec0ec471f74d262fe8461a2`; Q-P07/Q-P12/Q-P22: `08e750dc54dc7317b50c8ee175f09db3220c24e7971793e8f07a31c92d101a31` / `a62dd1653de50a102e1af38a119c5acf50783492884fbb43ea056a6c7b2c3c6d` |
| Parity/recovery/portability | Q-A06/Q-A08/Q-A09/Q-A17: `e0d500681b23f98de50120ddada1507d9ce3572971ccf77ea703f3db1e982d3e` / `132fb45253896a6ed43ab283515124bbb6f1b39e1c35fa07fba4cedb42bf4569` |

### Independent grades

| Casebook | Grade SHA-256 | Result |
|---|---|---|
| Routing/evidence | `65b9f7cb1d47c64de9cdd14fd6689449d0f0cc4a90a3c8f5e56080069e921063` | 8/8 Pass; both controls Pass |
| Language/architecture/SFA | `72645fc1be8ca6dc537ddb19bca1091d7b1541ac50c80bcaff448722d390617c`, then focused correction grades `b5ad9c9912a03181904a41c8bba3d86ab29d67eccac279c4d3b2bb7481dd4bda`, `1080a164ebf67630b1ef1f23c250107c1281153bdacc4df17bd9216c3804028e`, and `a519d4cbb643d412054901352418c44bfc95aa8c475f6bdd84ce53ee6a7018bb` | 13/13 Pass after response-only corrections and one BCD-completeness repair; both controls Pass |
| CPU/lowering/optimization | `120c81e7e44029d1b19b799b9f8e98688f62bc843de0fea534b58cb00094e6ea` | 13/13 Pass; both controls Pass |
| C64/platform/games | `9dc23a54f3c5508118920c46fbc7f0c880ae472c40986a1db327c291ea37c950`; corrected Q-P15 `80a240f1b8e32d8ee372f2b8c5aa43e9094f774d6bd51e1e255d4848988298ae` | 10/10 Pass after the focused Q-P15 ownership correction; both controls Pass |
| Parity/recovery/portability | `75ec7915262d1c12e749607f553dcf13af98c949cce6333fb9552b2766d8d7d6` | 4/4 Pass; both controls Pass |

The fail-closed correction loop repaired only concrete omissions: corpus membership/digest scope,
grammar and loop boundaries, BCD completeness, SID timing/profile fields, NMI costs, D64
directory/loading rules, static-replication proof, scene-policy ownership, and the HLE-010
trusted-media boundary. It added no framework, runtime, dependency, or game-policy API. Candidate
runtime payload is `af8579e3453a02c81024a5f800079586b961a8e0c8c8ff38bff242f7f9addfb9`;
the qualification payload excluding this self-recording release file is
`6f6e0ca8bc1659414e5262d96658ffcfefd04a81f1b94141fc4a9347f0c9769e`.

### Phase 4 review correction

The independent phase review found that Q-P15 assigned scene composition and scene-specific
conflict diagnostics too broadly to the compiler, and that the matrix and 16 changed/new case
records did not all state their current Phase 4 result. The user authorized both corrections.
Q-P15 now keeps composition, conflict detection, masks, attributes, priority, representation
construction, rendering, and scene policy in user-authored Blend65. The toolchain boundary is
limited to ingestion, imported-format validation, typing, placement, packaging, correct lowering,
and proved optimization. A fresh isolated Q-P15 evaluator and independent grader both passed. The
grader packet-tree digest is
`c565505697545d1b149c306c5603237d1feaab06e2cdbe31a16bb4620626ab88`.
The same independent reviewer then reproduced all four Q-P15 hashes, the runtime, H2, case, and
qualification-payload digests, and returned **No findings**. It also confirmed that `spec/`, the
single active expert 1.0.0 tree, and every `*.spec.test.*` file remain unchanged.

### Phase 5 activation-state correction qualification

The Phase 5 independent review found two stale activation-state statements after the otherwise
successful activation. The corrected candidate changes exactly two lines from the approved Phase 4
candidate: `SKILL.md` uses a status-neutral 2.0.0 version label, and the coverage matrix records the
completed Phase 4 qualification instead of requiring a nonexistent Phase 7.

Neither change touches a `##` knowledge section or a `## Q-*` case oracle. The changed H2 and case
closure digests therefore remain
`c5042ecc87910558e727779be7db9d6870c9219f3fc2e39efb92ad9ede8a8136` and
`d6869018aa8fc980767dc3e8810b355fa60e7e2fbbcc284346eb36a1d8b70baf`. No model case is reopened.
Targeted deterministic requalification covers exact two-line scope, version and activation-state
consistency, case/matrix set equality, regular-file topology, packaging, links, formatting, and
the frozen Specification 4 identity.

The corrected runtime-payload digest is
`65e83868000931913f321df50a648e9f2b4468d133025a7a4e9b21134ecbfe42`; the corrected qualification
payload digest excluding this release record is
`453e46102daac4fadf55f933d57dbee0a258452a14ea89e54f151b0e4797760e`. This corrected candidate is
not active until its exact full-tree identity passes re-review and receives explicit approval.

## Freeze Declaration

Blend65 Domain Expert `1.0.0` is the single active qualified baseline. It is bound to immutable
content commit `a96cfd3c41a456d4d4f983021cf43535a1d5bdaa`, router SHA-256
`80fbc581e4a1a60e372fa2bff745748755da322d2f5db5a3c402b4bc2aa4621f`, and the runtime/full-tree
digests recorded above. Activation occurred on 2026-09-09 after all release gates passed. Any
substantive router, knowledge, source-governance, or qualification-oracle change requires at least
a patch-version bump, affected/dependent requalification, independent review, and a new atomic
activation. Git history preserves older content; no parallel active version exists.
