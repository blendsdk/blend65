# Blend65 Domain Expert Release Record

> **Active qualified version**: `2.0.1`
> **Status**: Active qualified and frozen — exact approval, byte-identical migration and immutable content binding complete
> **Recorded**: 2026-09-30

The single installed qualified baseline is 2.0.1, bound to the immutable content
commit below. Historical result and candidate sections retain their original
identities and activation state at capture; the current identity, gate table and
2.0.1 freeze declaration govern activation. Only traced unchanged case/knowledge
sections inherit earlier results. This baseline includes the approved CIA1 return
correction and prior RD-04 E10280/E10281 diagnostic errata.

## Identity

| Field | Value |
|---|---|
| Untouched legacy Git commit | `d39ae459e02133d474d7157807d53d7e71fd6268` |
| Legacy tree source | `git archive d39ae459e02133d474d7157807d53d7e71fd6268 -- .agents/skills/blend65-domain-expert` |
| Legacy isolation | Fresh directory under `/tmp`; extracted tree made read-only before assessment; removed after evidence capture |
| Sorted legacy file-record digest | `a373271c41c9c2f50f38956c60d42a387d1da09e25e8d06c5cc61f16c7784fab` |
| Original router SHA-256 | `3865874b9f8fab03e5554e01098ed1ca4834c9470698bcc1729e06f2cca5d998` |
| Metadata SHA-256 | `e4a9f2e3a50b59f4824ba39443ce8ff846f52134f5effdc0424b763805b5df38` |
| Legacy reference hashes | Pinned individually in `qualification/coverage-matrix.md` |
| Active router | `2.0.1` |
| Active router SHA-256 | `8111b2ebc7584ee427a16951be0bfafce199ae6166094de8befa9f092848ce68` |
| Qualified content commit | `1ce4852016e2a883cf1f733c6014c45e176bfc69` |
| Active Specification | `BLEND65-SPEC-4-1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf` |
| Active runtime-payload digest | `423e8907096fb5cdf533890c22c0a7b567cf70b935c83878c6c48cad9a768397` |
| Content-checkpoint full skill-tree digest | `85cfd0a19e06e8fa3c66f70ac3dcdbe8cfc465179be48961f190ee6ae6eeeca7` |
| Qualification payload digest | `b77c3c3b5c1e5a1ba723cb007910d19ff324eea74d6bc9d0349202c3e9849c91`; six qualification files, excluding this release record |
| Preceding active 2.0.0 content | `c9e70fab6039e9ced3108e88f0ea9730d4fd3007`; router `e3d3f8f570a7fa8b3c197208ede2f7b41878f29494fc1824fcfabd2c11f53304`; runtime digest `65e83868000931913f321df50a648e9f2b4468d133025a7a4e9b21134ecbfe42` |
| Previous 2.0.0 content commit | `5eaf2ae86b3b0176c84b35eba6385b80115b1c34`; superseded by the activation-state correction |
| Superseded qualified version | `1.0.0`; content commit `a96cfd3c41a456d4d4f983021cf43535a1d5bdaa` |

## Gate State

| Gate | State | Evidence / blocker |
|---|---|---|
| Structural | Pass | Byte-identical migration of 22 regular files and thirteen references; packaging, 84 runtime links and exact source/identity checks pass. |
| Coverage and traceability | Pass | All 111 preceding identities retained; Q-P23 added. Twelve fresh cases and 100 independently reviewed unchanged-input inherited cases are disjoint and complete. |
| Behavioral | Pass | Twelve selected cases have passing captures/grades and bounded independent corrections; old Q-P23 expected red and failed earlier responses are retained. |
| Specification consistency prerequisite | Pass | Corrected 18-member digest and exact 45-path corpus checked; only the approved appendix and non-normative inventory differ. All 27 Language Guard rows reviewed. |
| Hardware-limitation exceptions | Pass | Independent final omission scan is clear; existing HLE register unchanged. Stock write-only-state boundary is an approved hardware restriction. No new API/runtime or target support is inferred. |

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
`453e46102daac4fadf55f933d57dbee0a258452a14ea89e54f151b0e4797760e`. The user approved the exact
corrected identity on 2026-09-14, and the direct activation checks passed before this release-only
binding made it active.

## Historical 2.0.0 Freeze Declaration

At its original activation, Blend65 Domain Expert `2.0.0` was the single active qualified baseline. It was bound to immutable
content commit `c9e70fab6039e9ced3108e88f0ea9730d4fd3007`, Specification identity
`BLEND65-SPEC-4-5c6bac04a56b91d7d55ff570fbbf0dde5f521e2edce8901279dfa39a32c7acfa`,
router SHA-256 `e3d3f8f570a7fa8b3c197208ede2f7b41878f29494fc1824fcfabd2c11f53304`, and the
runtime/content-checkpoint digests recorded above. The corrected identity replaced the original
2.0.0 content on 2026-09-14 after direct checks and explicit exact-identity approval. Any
substantive router, knowledge, source-governance, or qualification-oracle change requires at least
a patch-version bump, affected/dependent requalification, independent review, and a new atomic
activation. Git history preserves older content; no parallel active version exists.

## 2.0.1 Active Release Binding and Freeze Declaration

Blend65 Domain Expert `2.0.1` is the single active qualified and frozen baseline.
The user approved the exact reviewed candidate with “I do” on 2026-09-30. Its
byte-identical live migration passed before immutable content commit
`1ce4852016e2a883cf1f733c6014c45e176bfc69` on `feature/v4-rebuild`.
This following release-record binding activates that content and supersedes
2.0.0 content `c9e70fab6039e9ced3108e88f0ea9730d4fd3007`.

The specification, router, runtime payload, six-file qualification payload and
content-checkpoint full-tree identities are recorded in the current Identity
table. Both final independent source and semantics reviews are clear. The
112-case closure consists of twelve fresh passing cases and 100 independently
dependency-reviewed unchanged-input cases. Live byte equality reuses that exact
qualified evidence; it does not create new model results.

Only activation bookkeeping in this release record changes after the content
checkpoint. Captured responses, grades, packet manifests, oracles, coverage,
runtime knowledge and specification bytes remain unchanged. Existing hardware
exceptions and owned deferrals remain unchanged. The current compiler handback,
VICE runtime and physical-hardware boundaries are still unverified; this freeze
qualifies domain authority, not compiler implementation or silicon behavior.

Any substantive router, knowledge, source-governance or qualification-oracle
change requires a version bump, affected/dependent qualification, independent
review and a new approved atomic activation. Git preserves historical versions;
there is no second active skill tree. Binding this already-qualified immutable
content ID is bookkeeping and does not require another version bump.


## 2.0.1 Final Independent Candidate Review

Both independent reviewers returned **no findings** on 2026-09-29. Their final
verdicts bind this exact pre-review-record snapshot:

| Reviewed identity | SHA-256 |
|---|---|
| Normative specification | `1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf` |
| Runtime payload | `423e8907096fb5cdf533890c22c0a7b567cf70b935c83878c6c48cad9a768397` |
| Router | `8111b2ebc7584ee427a16951be0bfafce199ae6166094de8befa9f092848ce68` |
| Frozen qualification, excluding release | `b77c3c3b5c1e5a1ba723cb007910d19ff324eea74d6bc9d0349202c3e9849c91` |
| Reviewed release-evidence snapshot | `eee80b2260a60bc229a811bcbd2d383fa127a8522084209675c465c9d93950b7` |
| Reviewed full 22-file skill tree | `81aa07e7ddfced8f861b9cf35d1eac8f85a3155919dd67e963f0b88a4e18168a` |

`/root/cia_return_final_source` independently reproduces the 45-path/18-member
scope, primary source hashes, Q-L01 source-gate corrections, 112 invariant-field
comparison and complete 12-fresh/100-inherited closure. All 19 preserved capture
texts, 381 recorded packet-file hashes and output identities reproduce. All 27
Language Guard rules are accounted for; zero omitted material source conflict
remains. The corpus presentation notes and rejected Q-L29 sentence stay visible.

`/root/cia_return_final_semantics` independently reproduces the same identities
and capture texts. CIA order/ownership/status, Q-C13 independent mathematical
and cost proofs, Q-L29 corrective disposition, all 27 design guard results and
the final exception/deferral scan are clear. No new API/storage/manager/runtime
exists; unchanged SFA, IL and peephole doctrine leave expert optimization open.

This release-only addition records those verdicts and marks candidate review
clear. It changes no reviewed runtime/specification/qualification payload,
capture, source key, oracle or result. Final approval and the two-commit binding
remain outstanding. No active release/freeze/compiler/VICE/silicon claim follows.

## 2.0.1 Final Candidate Dispositions

This is completed candidate evidence, not an active release or freeze. Final
exact-evidence review/approval, byte-identical migration, immutable content commit
and the following release-record binding remain required in that order.

| Cases | Final captured evidence / independent result |
|---|---|
| Q-P23 | candidate-handback / candidate-handback-grade Pass |
| Q-P07 | candidate-qp07-final / candidate-irq-final-grade Pass |
| Q-P09 | candidate-irq / candidate-irq-grade Pass |
| Q-L29 | candidate-ql29-final + candidate-ql29-source-probe / candidate-ql29-final-grade jointly Pass, with the overbroad sentence excluded below |
| Q-L01 | candidate-ql01-final + candidate-ql01-retirement-probe / candidate-ql01-complete-grade jointly Pass |
| Q-L24 | candidate-corpus-final / candidate-corpus-final-grade Pass |
| Q-A15, Q-L03, Q-L06, Q-R08, Q-P10 | candidate-controls-complete / candidate-controls-complete-grade Pass |
| Q-C13 | candidate-qc13-proof; exhaustive separate analytical grade plus independent source-chain correction Pass |

### Independent grading corrections and source-audit dispositions

The Q-C13 proof answer is
`769b9976b6aacc6e7c34fd468244943d38666f5e4ddfb371f754b379839dfbe5`;
unchanged oracle section is
`65cf1b1e3011e4771d27662c1a7d0c6deb20662a8fcd426c1c3e5d13e30a922d`.
The independent grader verifies 84 result entries, 22 selected streams, seven
comparisons and five lower-write alternatives through 6,301,696 abstract-model
evaluations, including flags and all stated path/resource costs. Its remaining
Fail concerns six links missing from its intentionally narrower filesystem.
Both independent final reviewers verify those six paths in the actual evaluator
packet and their primary source chain: normative Chapters 02/04, MOS-PGM
Appendices B/C and Chapter 10 §§10.0–10.4, MOS-HW and the WDC bus table. They give
a bounded corrective **Pass**; the original Fail stays captured below. This is
not assembled/compiler/VICE/silicon proof.

The Q-L29 source probe's blanket rejection of every already exposed two-byte
transition is independently refuted and excluded from authority. The unchanged
runtime doctrine and main response allow a separately proved interrupt-masked
active-vector update. Its joint Pass does not validate that sentence.

The Q-L01 audit allegations are retained, not silently accepted as new rules.
Chapter 15's stable/provisional labels are nonmaterial metadata drift. Appendix
G3's raw-ABI shorthand is resolved by its adjacent raw-profile-only/empty-default
conditions, concrete default sinks and takeover delta. F019's “Any read” and
F017's “deterministic results” are overstated subordinate non-normative summaries;
normative Chapter 03 fixes function-local W10190 and Chapter 04 preserves bounded
unspecified runtime-zero results. Existing conditional routing refutes the broad
shallow-branch allegation. Historical/current project-policy identities are
explicitly distinct and their relevant excerpts compared. No new core-spec edit
or undetermined runtime decision follows from these notes.

### Hardware-limitation / optimization / deferral scan

Independent review covers the specification, thirteen runtime references,
accepted decisions and all 112 invariant sections. Existing HLE-001–HLE-010
dispositions remain unchanged. The new stock-entry boundary is forced by
unreadable CIA mask/latch state, not compiler/SFA convenience. It does not promise
custom service restoration or missed-tick recovery. Clean nested pop is vector
only; dirty inner and unproved raw/nonstock routes remain precisely diagnosed.
NMI/RESTORE installation belongs to DEF-7 and later RD-05 work; D64 is excluded.
No deferral closes or loses its owner at this authority checkpoint. CIA edge
silicon QA remains RD-10; Phase 2 still owes four-profile sequential VICE proof.

The otherwise unchanged runtime/metadata files are byte-identical after only
approved version/specification-key normalization. SFA closure, IL legality,
instruction/cost selection, peephole opportunity and whole-program parity
doctrine do not change. No new storage, manager, public API, runtime, framework,
dependency or persistent qualification runner is added.

### Exact manual isolation command

Each run substitutes its recorded packet directory, fresh output directory,
model/effort, output filename and user-style instruction in this exact command.
All paths inside the packet are listed and individually hashed in the capture
manifests below. The immutable image digest is
`node@sha256:8a34c4ab3ea2c5cd194f07e317b2a8f09461d3c8b05c4e34c8ccd56d56024c4d`
(local image ID `6622b5ce1342`). Client 0.159.0 SHA-256 is
`d2752c52353401f7f6efbfcea68796f4f7a3d3e4769f5d1da53fa49d4856b72f`;
code-mode host SHA-256 is
`160c7ea08738447582821fbb2611ee016d6dd628853401bbc441767cb4e95ef8`.

```sh
docker run --rm --read-only --cap-drop ALL --security-opt no-new-privileges \
  --pids-limit 128 --memory 2g --cpus 1 --user 1000:1000 --tmpfs /tmp:rw,nosuid,nodev \
  --mount type=bind,src=<run>/packet,dst=/work,readonly \
  --mount type=bind,src=<run>/output,dst=/home/node/.codex \
  --mount type=bind,src=/home/gevik/.codex/auth.json,dst=/home/node/.codex/auth.json,readonly \
  --mount type=bind,src=/home/gevik/.codex/packages/standalone/releases/0.159.0-x86_64-unknown-linux-musl/bin/codex,dst=/usr/local/bin/codex,readonly \
  --mount type=bind,src=/home/gevik/.codex/packages/standalone/releases/0.159.0-x86_64-unknown-linux-musl/bin/codex-code-mode-host,dst=/usr/local/bin/codex-code-mode-host,readonly \
  --workdir /work --entrypoint /bin/bash 6622b5ce1342 \
  -c 'python3 /work/control.py && exec codex exec --ignore-user-config --ignore-rules \
    --ephemeral --skip-git-repo-check --cd /work -m <model> \
    -c model_reasoning_effort=<effort> -c analytics.enabled=false \
    -c feedback.enabled=false -c web_search=disabled \
    --dangerously-bypass-approvals-and-sandbox \
    --output-last-message /home/node/.codex/<answer.md-or-grade.md> --json "<instruction>"'
```

The client bypass flag applies only inside the enforced OS boundary. Its normal
home is a fresh empty private output mount; no host home/workspace/history or
Docker socket is mounted. Only the necessary credential file is read-only; no
credential bytes are captured here. Network access serves the model client, not
unallowlisted authority browsing. Controls print `ISOLATION PASS` before any
accepted evaluation or grade. Failed client/setup attempts are not evidence.

## 2.0.1 CIA1 Handback Qualification — Capture Record

These are immutable captured responses and separate grades, not live compiler
or runtime observations. The candidate was non-active at capture. Mixed earlier
grades and response-only omissions remain visible; the final disposition table
selects only evidence satisfying each frozen obligation. Historical or replaced
responses are not made authority by being preserved here.

All evaluator packets contain the exact router, unchanged metadata and thirteen
runtime references, prompt/control and explicitly allowed raw context. No oracle,
qualification history, implementation or author conversation was mounted. Each
fresh grader receives only the frozen oracle and exact response capture. The
positive packet-read and negative repository/oracle/history controls passed.

Runtime identity at the final stable source-review boundary is
`423e8907096fb5cdf533890c22c0a7b567cf70b935c83878c6c48cad9a768397`;
router identity is
`8111b2ebc7584ee427a16951be0bfafce199ae6166094de8befa9f092848ce68`;
corrected normative specification is
`1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf`.
Earlier capture manifests retain their exact earlier bytes; independent impact
review permits reuse only when the case's semantic/source inputs are unchanged.

Packet identities hash the sorted GNU `<SHA-256>  <relative-path>\n` record
stream. Output hashes bind the original unquoted UTF-8 capture bytes. Blockquotes
below preserve their text without introducing new case headings into the oracle
inventory. Evaluator `gpt-5.6-sol/high`; independent grader `gpt-6-astra/xhigh`.
Q-C13's final general proof uses `gpt-6.1-sol/xhigh` instead.

| Capture | Packet identity | Original output identity |
|---|---|---|
| candidate-handback | `ba44ff39b08fdf783b809b6ea2efa2388799432817190cd70f07e8cac8ecdc80` | `b03fe9702d554f8045d6a4038bbf2d618aed996716ed2dfe534facbb67aa19ab` |
| candidate-handback-grade | `122386c7a1fe14db37a4eed985a5d4aa8c82ba4606c8ec70b0ecbcd3bda3e304` | `559de98b64ae769c249c5032a86265e0a23de18eda7f97dcc8828e2dbb2cbdb8` |
| candidate-irq | `54151935b1470bc3501341f5d1eaadc0a7e1bc938c2589882aead4acc687aafc` | `f2aa19ed4f7d9b8e633ad8e5177ccfd2d63d5483e72d57d85bafb0a4068c1826` |
| candidate-irq-grade | `f67bf3a7c2d442357f32efc1f7bf7cd4ecd8d383813e73887220d5f245f55df2` | `a4dc7396f64740fc2d15dd277c3d5e65a1cc40331771d1086303454aaaa13b00` |
| candidate-qp07-final | `b4b3636195c557423ffef958fd31a3a309ae1dbf9581eccc5a88ea5c26312b16` | `3d944d5f42d71e275ca8de28b3771dc660a314bb9c139d0fbfd8b479cb35e795` |
| candidate-irq-final-grade | `4e8e898c62f6ff6e65851461bee85607f3813565484a860972c4dbb2c60fd43a` | `634b0527b7a30f7e2631e7569f66075ab82187ac555efc59cae9a94392750262` |
| candidate-controls-complete | `1eabfb048ec377acb8f667594ab3e3880d826d18aec66dcf7f70ee0ec9622b9f` | `86fa95aaafe721e999cf01dc83078ac289e825cba5e26e23d28f52ad510c6beb` |
| candidate-controls-complete-grade | `1cdc33e93d11899bb02326c291a6e87c9f03637ec69578c87940322a502855eb` | `796f47bd47f19a1335d87b03a403c30b15f8131ef64310a81062339c04c1bdc6` |
| candidate-corpus-final | `bcd4bd6bcfe72589d974f110d6ab80c0b0642508fed6d35f59ab89380d727575` | `3c80a1689c33707bfc43e6925b3d68bfc494e0f8d6907a377ea9d4e06c0eeec2` |
| candidate-corpus-final-grade | `46219ea41c846761755e8173d9533192c9573cb6d20cc335a3cd1717f5701ec5` | `c9a6e578f8d6c7e1dcecd528a19f28d02c5489eb8f2cd2fa7b35f08a7abc14f8` |
| candidate-ql01-final | `a80cd0572f64a6b7749b3b7f93d70b88a34092cc28ff68f6b362524621aaf0b9` | `2aa5ff88322b26664dda2720ea17ab7ffb1dab7dfc9cb5f6965d5e1608a1c2c5` |
| candidate-ql01-final-grade | `c7cade18f3d504084b90ae318b6a9fc3e1e7f0acf27f12aa46e20d151b3ad364` | `2d620312981441a4b2f970304dc9d29366176932c6f55df00d87e8f9b37c4703` |
| candidate-ql01-retirement-probe | `3e0e24c7d8c08b785d973f72e99508364f7cbf14049ca58a7555406431ce062b` | `3f5bd205795ee44de49a38513e494bdb5b40827917c3705950735ff28219ecdd` |
| candidate-ql29-final | `aaee7d160da0c5eec4e37a9d10261081bfab21ccbcdce41257a7d28421efdb5c` | `d2248f15a2a03dccc8866912907897d6cc0be9d3c90c22f86d0bd1f6bce554fa` |
| candidate-ql29-source-probe | `a064ac75d91ad12579b336399e3e9149f66d370b698c1128945ce7ba241d3362` | `68d5f6a7b32ec75597c3039c6807019f8dee64cca0f65f1581e532c10e8fd876` |
| candidate-ql29-final-grade | `809492b32cf50c5df2461b9c50d84f21ea7609e8ce5c9d87f335b39192b1365d` | `d9fe79b668ea86a7fe0d77199b1332ee1e0597d5943b17168cb8014febb94ca9` |
| candidate-qc13-proof | `ca3ab2c8d50e8abdb13cd44ecf6ea4cd01ca1817ba47d9c69e6d130dab962daf` | `769b9976b6aacc6e7c34fd468244943d38666f5e4ddfb371f754b379839dfbe5` |
| candidate-qc13-proof-grade | `1c41eff30817bfa9307c4506cdcd948dbc3f424ea68027aab437743ac992fc35` | `9ac7498d93c0a413ae53d5487e782509ac6cfb9f4dc747d84a9526c0c6a06659` |
| candidate-ql01-complete-grade | `ab431257923e6d595de65cd067bafca5d86ec38d0fbef3b283a5a104525c2240` | `2a4ae1f5f46d6978151bb18bf5fff520ce4202ce9a7bb296c2ed7561099a1299` |

<details>
<summary>candidate-handback: packet manifest and exact captured text</summary>

```text
8111b2ebc7584ee427a16951be0bfafce199ae6166094de8befa9f092848ce68  SKILL.md
e4a9f2e3a50b59f4824ba39443ce8ff846f52134f5effdc0424b763805b5df38  agents/openai.yaml
36229972f5e3f173efcff032790ff77f743eb9723606593aede1aec8ab10eba9  control.py
bf79f1bc704c34553860d23cee19cc3ad56314648c106b8780b9423dba09bcfd  prompt.md
4f3ea96e261ba9cc8f62b16ab5a7ed7f616b4980b7fa6efff4624d336f9a95cd  references/6502-lowering-casebook.md
3dfda1f0ea2e33e1e8632f56fd08dbf02030300a5ad9f101c278539ebeda56a3  references/acme-and-artifacts.md
74230f7f6d3d470c73b63306da7d59b9ff00e50359b01f854db8824dc39d74d0  references/blend65-semantics.md
d3bcc7a53424be398a7ef2e4c331ba403b7f02d648fd177904704ae1194dc112  references/c64-game-engineering.md
ab551b788474a4459a72a1ba8775436c6d75aeb86830162cf136097fc1dfa186  references/c64-hardware.md
199ca9b200158e532a21325ed2f1ffd9d84741aa929a6654f9d07350b167b16c  references/c64-memory-and-runtime.md
893c724b6ec7a84dfd66e7e73d8669783459b56472b2bb503788bc664d814e85  references/compiler-architecture.md
d25a45598a7669bf28ac0725c472760e3918cfb29151862d8beba9bb40a05b31  references/evidence-parity-and-recovery.md
7b38b1c9888df1aae0b1f63862c1f1824e1f905b4465a3ef1a24da8d95d40549  references/il-and-optimization.md
68838b0e38c60198c165160f2823759239ab27d233f72ed1dfc1e9e6b49716bf  references/mos-6502-family.md
4ee1b17f456e47d2bd2c854c343559a677c8ef367ccdaf8b9b33ddc7fb2f2ffb  references/sfa-and-abi.md
7c71f923db6dd19303b1554cdc47061c26d1ef435b923642ae95cc1173f8b421  references/source-manifest.md
028efcd8220207b3d370cf09075ffa99074b53833d2388a83305d0c24775e5b8  references/target-portability.md
```

> ## Independent authority evaluation
> 
> **Packet-level contract — Status: Verified complete. Claim kind: Fact.**  
> The supplied authority defines a coherent, implementable final-exclusive CIA1 handback for the four cooperative PRG profiles: PAL/NTSC × 6581/8580, stock BASIC/KERNAL entry, NMOS 6510, and KERNAL 901227-03.
> 
> **Compiler conformance, emitted output, runtime qualification, and silicon behavior — Status: Unknown.**  
> No compiler artifact, assembly, resource report, VICE trace, hardware result, or release record is present.
> 
> ### Implementable final-release transaction
> 
> The handback occurs inline at the **final** exclusive `restoreIRQ()` inside the existing:
> 
> ```text
> PHP
> PHA
> SEI
>     handback
> PLA
> PLP
> ```
> 
> The mandatory order is:
> 
> 1. Write `$1F` to CIA1 ICR to clear all five interrupt-mask sources.
> 2. Stop Timer A by writing CRA as `oldCRA & $80`, retaining only the TOD 50/60-Hz selection.
> 3. Stop Timer B with `CRB=$08`.
> 4. Read CIA1 ICR **exactly once**, after both timers have stopped. This consumes and discards pending end-of-game events.
> 5. Program Timer A low byte, then high byte:
> 
>    | Profile | Decimal reload | Hex | Low, high |
>    |---|---:|---:|---|
>    | PAL, either SID | 16421 | `$4025` | `$25`, `$40` |
>    | NTSC, either SID | 17045 | `$4295` | `$95`, `$42` |
> 
> 6. Restore both exact bytes of the saved predecessor CINV link while IRQ entry remains masked. It must be the saved LIFO predecessor, never a guessed ROM address.
> 7. Write `$81` to CIA1 ICR, enabling **only Timer A**.
> 8. Write CRA `(oldCRA & $80) | $11`, preserving TOD selection and issuing Timer A `LOAD` plus `START`. `LOAD` is a strobe, not persistent state.
> 9. Execute `PLA; PLP`. This restores the caller’s complete saved status, including `I` and `D`.
> 
> The packet specifies the vector restoration’s position—after reload programming and before Timer A is enabled—but does **not** prescribe low-byte-versus-high-byte order within the two saved CINV writes. That sub-order therefore must not be invented. Because IRQ remains masked until both bytes are restored, either implementation order can satisfy the supplied contract; emitted output must show which was selected.
> 
> This is a synthesis of known stock behavior, not a ROM-provided shutdown routine. The SID model does not alter the reload; only PAL versus NTSC does.  
> Authority: [stock CIA1 release contract](/work/references/c64-memory-and-runtime.md:210), source-manifest case `Q-P23`.
> 
> ### IRQ, CPU-status, and storage contract
> 
> The exclusive handler itself has a different status path from `restoreIRQ()`:
> 
> - An `interrupt function` is callback-only; it is not callable through ordinary `JSR`/`RTS`.
> - KERNAL 901227-03 has already saved A/X/Y before dispatch through CINV. The Blend65 CINV variant must not save them again.
> - NMOS interrupt entry and this KERNAL entry do not clear decimal mode. The exclusive handler therefore executes `CLD` before generated ordinary code.
> - The handler owns and acknowledges every enabled IRQ source, then jumps to the pinned `$EA81` restore-only tail.
> - That tail restores Y/X/A and ends in `RTI`; `RTI` restores the complete interrupted status, including the interrupted `D` and `I`.
> - Only entry variants reachable from actual sinks are emitted.
> - The predecessor CINV link is two writable static bytes. If used by an NMOS indirect `JMP`, `$xxFE` is a valid starting address; `$xxFF` must be relocated or rejected.
> - Handler bodies, ordinary helpers, temporaries, spills, and mainline/IRQ interference must all close through SFA before emission. Reusable helpers remain ordinary `JSR`/`RTS` functions.
> - The handback adds no source call, runtime flag, scheduler, state capsule, data/ZP/scratch object, or late SFA slot.
> 
> Known fixed route baselines are:
> 
> - IRQ CPU acceptance: 7 cycles, 3 hardware-stack bytes.
> - KERNAL `PULS` through CINV: 29 cycles, 16 existing-ROM bytes, peak 6 stack bytes including the CPU frame.
> - Exclusive wrapper plus `$EA81` tail: `27 + body/ack` cycles, `4 + body` emitted bytes, 6 existing-ROM tail bytes, peak 6 stack bytes.
> - IRQ acceptance through completion: `63 + body/ack` cycles, excluding VIC/CIA stalls.
> 
> The final-release `PHP; PHA` contributes two transient pushes, but its whole-program stack peak depends on its calling context. Actual body, handback, output-byte, path-cycle, SFA-placement, and total-stack results are **Unknown** without emitted code and a resource report.  
> Authority: [interrupt-route completion gate](/work/references/sfa-and-abi.md:327), [IRQ entry/exit and cost baseline](/work/references/c64-memory-and-runtime.md:313), [NMOS interrupt behavior](/work/references/mos-6502-family.md:221); source keys `MOS-PGM-1976`, `MOS-HW-1976`, `CBM-C64-KERNAL-03`.
> 
> ### Required contrasts
> 
> | Case | Required result |
> |---|---|
> | Clean inner LIFO route | Vector-only pop; it does not perform the final stock CIA1 handback. |
> | Inner route changed CIA1 | Diagnose `E10278`. Nested CIA1 restoration capsules are not introduced. |
> | Exclusive route only read timer counters | The final exclusive release still performs the complete stock handback. Reads do not waive it. |
> | Counter reads without an exclusive lease | Observation adds no restoration work. |
> | Ordinary chained route performs counter reads | No stock handback is added merely because of observation. |
> | Known raw CIA1 mutation outside proved typed ownership | Diagnose `E10278`; do not claim typed restoration covers it. |
> | Custom resident handler/service existed before game entry | Outside the stock-entry precondition. An unproved nonstock predecessor is `E10278`; stock handback cannot revive that handler’s CIA1 service. |
> 
> Stock compatibility also does not reconstruct KERNAL ticks missed while the game held exclusive ownership.
> 
> ### State-recovery questions
> 
> **Can reads recover arbitrary old CIA1 masks or timer reload latches? No.**
> 
> - The ICR mask is write-only. An ICR read reports pending source bits and clears the returned interrupt data/IRQ condition; it does not reveal the old mask.
> - Pending state and mask state are separate.
> - Timer reload latches are write-only.
> - Low-then-high counter reads observe a changing counter, are not an atomic latch snapshot, and do not recover the programmed reload.
> 
> The approved operation therefore installs the pinned **stock** Timer A state; it does not restore arbitrary prior CIA1 state.  
> Authority: [CIA timer and ICR semantics](/work/references/c64-hardware.md:253), source key `MOS-6526-1981`.
> 
> **Can whole `IOINIT` satisfy the release? No.** It also changes CIA2, SID, ports, and CPU mapping, exceeding the scoped CIA1/CINV contract.
> 
> **Can a main-return-only repair satisfy it? No.** Ownership stacks must already be empty when `main` returns, and an earlier final `restoreIRQ()` must restore service at that release point. If release happens immediately before return, the same handback may occur there, but it remains the release transaction—not a generic epilogue substitute.
> 
> ### Independent proof required
> 
> Two independent oracles are needed:
> 
> 1. **Behavior oracle:** the exact state transition above, including volatile access order/count, saved CINV identity, caller-status restoration, stock Timer A behavior, and all negative cases.
> 2. **Assembly/resource oracle:** expected instructions, exactly one consuming ICR read, reload bytes, CINV writes while masked, reachable variant selection, page-safe saved link, output bytes/cycles, SFA inventory, and stack peak.
> 
> The smallest proof sequence is:
> 
> - Compile all four profiles and retain compiler identity/options, emitted assembly, assembled bytes, symbols/map, and resource report.
> - Assert the exact CIA1 access sequence and that no `IOINIT`, second ICR read, guessed CINV address, hidden state manager, or late scratch allocation appears.
> - Exercise counter-only exclusive ownership, no-exclusive observation, clean inner pop, CIA1-changing inner route, known raw mutation, and nonstock predecessor diagnostics.
> - Run all four profiles sequentially under pinned VICE 3.10 settings, checking restored vector bytes, caller A/P including `I` and `D`, Timer A cadence/service, and volatile read/write trace.
> - After that, the bounded claim may be `VICE-verified / hardware-unverified`.
> - Physical CIA-edge/revision behavior still requires targeted tests on recorded hardware. No universal silicon, timing-stall, missed-tick, analogue SID, or physical-machine result is established by this packet.
> 
> ### Lineage
> 
> - `skillVersion=2.0.1`
> - `knowledgeIdentity=BLEND65-SPEC-4-1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf`
> - `contentCommit=Unknown` — the release record is intentionally absent and no commit is guessed.
> - Release activation/qualification status: **Unknown** from this packet.
> - Governing references: `c64-memory-and-runtime.md#stock-cia1-service-on-final-exclusive-release`, `#interrupt-entry-and-exit-contracts`; `c64-hardware.md#timers-and-control`, `#interrupt-control`; `sfa-and-abi.md#interrupt-route-completion-gate`, `#hardware-stack-duties`; `mos-6502-family.md#reset-interrupt-and-stack-behavior`; `evidence-parity-and-recovery.md#evidence-boundary-rules`.
> - Source keys: `BLEND65-SPEC-4-1c2a2d75`, `CBM-C64-KERNAL-03`, `MOS-6526-1981`, `MOS-PGM-1976`, `MOS-HW-1976`, `CBM-C64-PRG-1982`; audit cases `Q-P23`, `Q-L29`, `Q-P07`, and `Q-P09/Q-P10`.

</details>


<details>
<summary>candidate-handback-grade: packet manifest and exact captured text</summary>

```text
b03fe9702d554f8045d6a4038bbf2d618aed996716ed2dfe534facbb67aa19ab  answer.md
e1a14afa11ff99d9c271e2c3352bf943d368c2d5b3624399a9942a84f8bc7e91  control.py
3f66cd4446e9de167da6bee835226343b1ebec203a292a81409772e7aad5afbf  oracle.md
fc1e91a459a65965f2a48c66fa7fd12dc581057f6d53ec3e4fc9483a48adecf2  prompt.md
```

> **Q-P23 — Return to stock BASIC after exclusive CIA1 timer ownership: Pass.**
> 
> The captured answer satisfies the frozen [decision invariants](/work/oracle.md:8) and exhibits none of the [disqualifying outcomes](/work/oracle.md:9).
> 
> | Oracle obligation | Decisive answer evidence |
> |---|---|
> | Final exclusive release; ordered, masked handback | [Line 11](/work/answer.md:11): “final exclusive `restoreIRQ()`.” The sequence at [line 24](/work/answer.md:24) clears masks, stops both timers, reads ICR “**exactly once**, after both timers have stopped,” programs the reload, restores both saved CINV bytes while masked, enables only Timer A, starts it while preserving TOD selection, then restores caller status. |
> | Exact reloads and saved predecessor identity | [Lines 32–35](/work/answer.md:32) give PAL `16421 / $4025` and NTSC `17045 / $4295`, low byte before high, and require “the saved LIFO predecessor, never a guessed ROM address.” |
> | Callback identity, ABI, status, storage, and accounting | [Line 49 onward](/work/answer.md:49) specifies callback-only entry, existing register saves, `CLD`, source acknowledgement, `$EA81`/`RTI`, page-safe static CINV storage, and SFA closure. [Line 57](/work/answer.md:57) excludes extra APIs and hidden storage. [Lines 59–66](/work/answer.md:59) distinguish fixed output/ROM/stack/cycle baselines from unknown actual resource results; RAM/ZP obligations appear at lines 55–57. |
> | Required ownership contrasts and diagnostics | [Lines 73–79](/work/answer.md:73) cover clean inner pop, CIA1-changing inner route, exclusive counter-only use, observation without exclusivity, ordinary chains, raw mutation, and nonstock predecessors. Unsafe cases receive `E10278`; counter-only exclusive use still requires handback. |
> | No arbitrary state recovery or substitute shutdown | [Line 87](/work/answer.md:87): “The ICR mask is write-only”; [line 90](/work/answer.md:90): counter reads “do not recover the programmed reload.” [Lines 95–97](/work/answer.md:95) reject whole `IOINIT` and main-return-only repair. [Lines 79–81](/work/answer.md:79) exclude recovery of custom service and missed ticks. |
> | Independent proof and bounded claims | [Lines 103–113](/work/answer.md:103) require separate behavior and assembly/resource oracles, retained compiler artifacts, negative cases, four sequential VICE profiles, and targeted hardware testing. [Line 6](/work/answer.md:6) explicitly leaves compiler conformance, emitted output, runtime qualification, and silicon behavior **Unknown**. |
> 
> This is a pass for the captured answer’s contract and proof requirements. It establishes no compiler, runtime, or silicon qualification; the later evidence required by [oracle line 10](/work/oracle.md:10), including source/span evidence, remains outstanding. Activation and future content commit are outside this evaluation.

</details>


<details>
<summary>candidate-irq: packet manifest and exact captured text</summary>

```text
8111b2ebc7584ee427a16951be0bfafce199ae6166094de8befa9f092848ce68  SKILL.md
e4a9f2e3a50b59f4824ba39443ce8ff846f52134f5effdc0424b763805b5df38  agents/openai.yaml
36229972f5e3f173efcff032790ff77f743eb9723606593aede1aec8ab10eba9  control.py
3d4e6c1575a4dea34e315f5e7033fe08933bd4e16799e696320789e2111f587e  prompt.md
4f3ea96e261ba9cc8f62b16ab5a7ed7f616b4980b7fa6efff4624d336f9a95cd  references/6502-lowering-casebook.md
3dfda1f0ea2e33e1e8632f56fd08dbf02030300a5ad9f101c278539ebeda56a3  references/acme-and-artifacts.md
74230f7f6d3d470c73b63306da7d59b9ff00e50359b01f854db8824dc39d74d0  references/blend65-semantics.md
d3bcc7a53424be398a7ef2e4c331ba403b7f02d648fd177904704ae1194dc112  references/c64-game-engineering.md
ab551b788474a4459a72a1ba8775436c6d75aeb86830162cf136097fc1dfa186  references/c64-hardware.md
199ca9b200158e532a21325ed2f1ffd9d84741aa929a6654f9d07350b167b16c  references/c64-memory-and-runtime.md
893c724b6ec7a84dfd66e7e73d8669783459b56472b2bb503788bc664d814e85  references/compiler-architecture.md
d25a45598a7669bf28ac0725c472760e3918cfb29151862d8beba9bb40a05b31  references/evidence-parity-and-recovery.md
7b38b1c9888df1aae0b1f63862c1f1824e1f905b4465a3ef1a24da8d95d40549  references/il-and-optimization.md
68838b0e38c60198c165160f2823759239ab27d233f72ed1dfc1e9e6b49716bf  references/mos-6502-family.md
4ee1b17f456e47d2bd2c854c343559a677c8ef367ccdaf8b9b33ddc7fb2f2ffb  references/sfa-and-abi.md
7c71f923db6dd19303b1554cdc47061c26d1ef435b923642ae95cc1173f8b421  references/source-manifest.md
028efcd8220207b3d370cf09075ffa99074b53833d2388a83305d0c24775e5b8  references/target-portability.md
fa33c4a76fcb003d7682c00c86a64321ec7751410f334832b3fbc570612aa7b1  spec/06-functions.md
925c7eb49fd32093e2de791a8f4c8887e2797d2956429cf5974aca985933936c  spec/12-intrinsics.md
4c414a44de2106540eae29d89e370e412e93f40ee848fd72193cb9b750a7fef2  spec/14-diagnostics.md
9ed9c41cf7ed22cfc4d557951e5e0f3f9c0fcba7e4d4a2ff63cc35694234ba73  spec/15-platform-profile.md
70e822e3ec88506fd694303d98f37b8eacc0bf6cb4febb5fe7fea5d4f0fe25f2  spec/appendix-c64.md
83b7baac19b72e8eeced5b156cd2ce79a56bfc1391739283e11009787669d95b  spec/evaluations/F007-interrupt-functions.md
```

> ## Packet authority
> 
> The packet defines a coherent candidate contract, but does not prove an activated skill release or any current compiler behavior.
> 
> - `skillVersion=2.0.1`
> - Specification identity: `BLEND65-SPEC-4-1c2a2d75`, digest `1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf`
> - Release/content commit: **Unknown**. `qualification/release.md` is intentionally absent.
> - Activation: **Unknown**; the source manifest says activation is pending qualification/review/approval ([source-manifest.md](/work/references/source-manifest.md:33)).
> - Current compiler implementation, assembly, artifact, emulator, and hardware status: **Unknown**. None was supplied.
> 
> The results below therefore describe the candidate authority contract, not observed compiler conformance.
> 
> ## Q-P07
> 
> **Status:** Verified partial for the candidate route decision; active-release and implementation status are Unknown.  
> **Claim kind:** Recommendation plus packet facts.
> 
> ### Selected route
> 
> Select **default KERNAL CINV chaining** with `c64.system.setIRQ` for a VIC-II raster IRQ while retaining stock KERNAL services.
> 
> Selected context:
> 
> - Profile: `c64-pal-prg-kernal-6581`
> - Machine: stock, unexpanded C64; no cartridge, REU, turbo, or extra SID
> - CPU: NMOS MOS 6510, 0.985248 MHz
> - Video: PAL, 312 × 63 cycles
> - SID: MOS 6581 at `$D400`
> - KERNAL: revision `901227-03`
> - Banking: processor-port mask `$07`, DDR low bits `$07`, latch low bits `$06`; BASIC out, KERNAL ROM and I/O visible
> - Exact VIC-II, CIA1/CIA2, board, and PLA revisions: **Unknown**; the profile names only VIC-II and documented 6526 behavior, not physical silicon revisions ([appendix-c64.md](/work/spec/appendix-c64.md:31), [appendix-c64.md](/work/spec/appendix-c64.md:844)).
> 
> Vector state:
> 
> - Active hardware IRQ vector `$FFFE/$FFFF` is in visible KERNAL ROM and enters `PULS/PULS1`.
> - `PULS/PULS1` saves A/X/Y, leaves D unchanged, then dispatches through CINV `$0314/$0315`.
> - `setIRQ` atomically saves the current CINV into a two-byte page-safe link and installs the CINV-compatible entry.
> - NMINV `$0318/$0319` remains on the stock KERNAL path; hardware NMI `$FFFA/$FFFB` enters `$FE43`.
> - Underlying RAM at the hardware vectors is not the active vector source under mapping `$06`; raw helpers are unavailable in this profile ([appendix-c64.md](/work/spec/appendix-c64.md:233), [appendix-c64.md](/work/spec/appendix-c64.md:748)).
> 
> Source and nesting contract:
> 
> - Owned source: VIC raster interrupt; acknowledge exactly bit 0 by writing `$01` to `$D019`.
> - Also enabled: stock CIA1 Timer A IRQ, owned by the saved prior KERNAL handler.
> - Disabled/quiescent by the local contract: other VIC IRQ enables and CIA1 Timer B, TOD, serial, and FLAG interrupt masks.
> - Expansion IRQ/NMI is absent because the profile is stock and unexpanded.
> - IRQ does not self-nest: hardware sets I on entry and the handler does not execute `CLI`.
> - CIA2 masks are locally assumed disabled. RESTORE remains a physical NMI source handled through stock NMINV.
> - The packet supplies no finite repeated-RESTORE/NMI bound. Therefore an arbitrary IRQ-plus-reentrant-NMI worst-case stack/cycle total is **Unknown**; the fixed IRQ-only route below assumes no NMI edge during that measured invocation.
> 
> ### ABI and cost
> 
> The handler is callback-only, not callable with `JSR`. Firmware owns A/X/Y preservation. The wrapper executes:
> 
> ```asm
> PHP
> CLD
> ; write $01 to $D019
> PLP
> JMP (saved_previous_cinv)
> ```
> 
> For an otherwise empty raster handler using `LDA #$01; STA $D019`:
> 
> - CPU IRQ acceptance: 7 cycles, 0 output bytes, 3 stack bytes.
> - KERNAL `PULS` to CINV: 29 cycles, 16 existing-ROM bytes, stack reaches 6 bytes.
> - Generated chain wrapper: 14 cycles, 6 output bytes.
> - Raster acknowledgement: 6 cycles, 5 output bytes.
> - Fixed total through the jump to the predecessor: **56 cycles**, **11 output bytes**, and **16 existing-ROM bytes**.
> - Prior-handler cycles and bytes: **Unknown/variable** and follow the jump.
> - VIC/CIA bus stalls and interrupted-instruction completion: **Unknown**, explicitly excluded from the fixed baseline.
> - Peak stack during this body: **7 bytes**. Each ordinary helper call would add two live return-address bytes plus deeper call/explicit-stack use.
> - Static link: exactly **2 RAM bytes**, with its low byte no greater than `$FE`; `$xxFE` is legal and `$xxFF` must be relocated or rejected.
> - No general runtime, dispatcher, heap, or automatic acknowledgement is added.
> - Installer/restore bytes and cycles are required in the build report but are **Unknown** without generated output.
> 
> The prior CINV handler is the terminal owner: Blend65 restores entry flags with `PLP`, jumps through the saved link exactly once, and the predecessor/KERNAL path eventually restores Y/X/A and executes `RTI`. Evidence: [c64-memory-and-runtime.md](/work/references/c64-memory-and-runtime.md:313), [sfa-and-abi.md](/work/references/sfa-and-abi.md:327).
> 
> ### Ownership
> 
> - Compiler: preserve handler provenance; select the no-second-save entry; establish D=0; close SFA, stack, reachability, link placement, and costs.
> - Platform/profile API: CINV installation/restoration and interrupt-disabled two-byte vector transaction.
> - Firmware: initial A/X/Y save and final normal KERNAL service/restore/`RTI`.
> - Developer: enabled-source inventory, VIC acknowledgement, shared-state synchronization, and the decision to retain the predecessor.
> 
> ### Counterexample and proof
> 
> Counterexample: replacing this route with `setIRQExclusive` while stock CIA1 Timer A remains enabled skips the normal KERNAL CIA1 service. The handler would not own every enabled IRQ source, potentially leaving CIA1 asserted or discarding service.
> 
> Independent proof needed: compile an isolated exact-profile case; inspect the ACME source, map, artifact bytes, link placement, and stack report; trace simultaneous VIC-raster and CIA1 Timer-A assertions in VICE 3.10 `x64sc`; then perform targeted testing on an exactly identified PAL board/VIC/CIA revision. Until the physical check, any edge-sensitive result is `VICE-verified / hardware-unverified`.
> 
> Source keys: `Q-P07`, `CBM-C64-KERNAL-03`, `CBM-C64-PRG-1982`, `MOS-PGM-1976`, `MOS-HW-1976`, `ZAKS-6502-1980` ([source-manifest.md](/work/references/source-manifest.md:1558)).
> 
> ## Q-P09
> 
> **Status:** Verified partial for the candidate API disposition; active-release, exact silicon, and compiler output are Unknown.  
> **Claim kind:** Recommendation plus hardware facts.
> 
> ### Disposition
> 
> Use a **typed zero-cost platform API** for CIA ICR operations, with a compile-time ownership diagnostic when the caller lacks the corresponding CIA interrupt lease.
> 
> Selected context:
> 
> - Same `c64-pal-prg-kernal-6581` machine/profile and `$06` banking as Q-P07.
> - CIA1 ICR is `$DC0D`; I/O is visible.
> - Interrupt mode for the concrete example: `setIRQExclusive`, with CIA1 Timer A as the only enabled IRQ source. All VIC IRQ enables and CIA1 mask bits 1–4 are disabled; those physical facilities are also required to be quiescent or handled if their latches can arise.
> - Stock NMINV remains active; the operation does not consume CIA2 `$DD0D`.
> - Exact installed CIA revision is **Unknown**. The documented contract is the November 1981 MOS 6526 behavior.
> 
> Required API meanings:
> 
> - Acknowledge/read: exactly one `LDA $DC0D`. It returns all latched bits 0–4, plus bit 7 if an enabled source caused IRQ, and clears all returned interrupt data/IRQ state.
> - Enable Timer A: write `$81` to `$DC0D`.
> - Disable Timer A: write `$01` to `$DC0D`.
> - Disable all five masks: write `$1F`.
> - No read-modify-write and no read-mask-write sequence.
> - The write-only mask cannot be reconstructed by reading ICR.
> - A single read may consume several simultaneous source latches; an exclusive owner must process or intentionally discard the entire returned bitset.
> 
> These effects come directly from [c64-hardware.md](/work/references/c64-hardware.md:279).
> 
> ### Costs and visibility
> 
> For isolated constant operations:
> 
> | Operation | Sequence | Output | Cycles |
> |---|---|---:|---:|
> | Read/acknowledge | `LDA $DC0D` | 3 bytes | 4 |
> | Enable Timer A | `LDA #$81; STA $DC0D` | 5 bytes | 6 |
> | Disable Timer A | `LDA #$01; STA $DC0D` | 5 bytes | 6 |
> | Disable all masks | `LDA #$1F; STA $DC0D` | 5 bytes | 6 |
> 
> Register reuse may remove an immediate load only if final assembly proves the same value and effects; the one volatile ICR access may never be removed, duplicated, or reordered.
> 
> For the selected exclusive Timer-A handler containing only one ICR read:
> 
> - IRQ acceptance + KERNAL entry + exclusive wrapper/tail: 63 cycles.
> - ICR read: 4 cycles.
> - Fixed route: **67 cycles**, excluding interrupted-instruction completion and bus stalls.
> - Generated handler bytes: 4-byte exclusive wrapper plus 3-byte read = **7 output bytes**.
> - Existing ROM: **16 bytes** from PULS to CINV plus the **6-byte** `$EA81` restore tail; neither is emitted.
> - Peak stack: **6 bytes**; add two for each active helper call.
> - Route static link: zero.
> - If restoration is reachable, interrupt-install ownership still requires one two-byte predecessor word for each simultaneously live install that must be restored.
> - No RAM, ZP, or stack is required by the constant ICR access itself. A retained returned bitset or dispatch logic must be charged according to its actual home/code.
> - The generated bytes enlarge the resident PRG payload. BSS predecessor storage is not serialized when placed in the trailing BSS suffix. Exact startup, installer, final stock-CIA1 handback, PRG transfer time, and loader cost are **Unknown** without the artifact; this profile adds no D64 runtime loader.
> 
> On final exclusive release, the platform must perform the packet’s exact stock handback: clear all masks, stop both timers, read ICR exactly once, load PAL `$4025`, restore the saved CINV, enable only Timer A, and restart it while preserving the TOD-input bit ([appendix-c64.md](/work/spec/appendix-c64.md:241)).
> 
> ### Ownership
> 
> - Compiler: volatile count/order, address visibility, register allocation, and exact cost reporting.
> - Platform API/profile: CIA1/CIA2 distinction, typed read-versus-write meanings, lease validation, and stock handback.
> - Developer: source selection, treatment of every returned bit, exclusive ownership, and physical quiescence assumptions.
> - Diagnostic owner: semantic/platform validation. A CIA1 acknowledge without ownership should be rejected rather than silently stealing KERNAL events; the packet does not assign a specific public diagnostic code for that exact misuse.
> 
> ### Counterexample and proof
> 
> Counterexample:
> 
> ```text
> old = read($DC0D);
> write($DC0D, old);
> ```
> 
> This is not save/restore. The read has already acknowledged all returned latches, and the write interprets bit 7 as mask set/clear control rather than storing the byte.
> 
> Independent proof needed: an exact-profile compiler case showing one absolute read or one immediate write and no extra access; artifact/trace checks with multiple simultaneous CIA latch bits; VICE 3.10 observation; and physical testing on the exact CIA revision for revision- or edge-sensitive behavior.
> 
> Source keys: `Q-P09/Q-P10`, `MOS-6526-1981`, `CBM-C64-PRG-1982` ([source-manifest.md](/work/references/source-manifest.md:1561)).
> 
> ## Q-L29
> 
> **Status:** Verified complete as a candidate normative disposition; active-release and current compiler conformance are Unknown.  
> **Claim kind:** Fact about the supplied specification.
> 
> The `interrupt function` remains one callback-only source identity. Provenance-preserving flow to recognized sinks selects different entry ABIs; it does not turn the handler into an ordinary callable function.
> 
> ### Entry-path disposition
> 
> | Build/sink | Disposition | Stack at body; with the stated helper call | Terminal owner | Fixed cost excluding body/helper/ack |
> |---|---|---|---|---|
> | Cooperative KERNAL: `setIRQ` | Select CINV chain variant | 7 bytes; **9** while one helper return address is live | `PLP; JMP (saved CINV)`; predecessor ultimately owns `RTI` | 50 cycles from IRQ acceptance to predecessor jump, 6 output wrapper bytes, 16 existing-ROM bytes |
> | Cooperative KERNAL: `setIRQExclusive` | Select exclusive CINV variant | 6 bytes; **8** during helper | `JMP $EA81`; 901227-03 tail restores Y/X/A and executes `RTI` | 63 cycles, 4 output wrapper bytes, 16 entry-ROM bytes plus 6 tail-ROM bytes |
> | Takeover: `setRawIRQ` | Select raw IRQ variant only when `$FFFE/$FFFF` is writable and active | 6 bytes; **8** during helper | Compiler restore sequence and direct `RTI` | 44 cycles from IRQ acceptance, 12 output wrapper bytes |
> | Default build: `pokew($0314, &onRasterIRQ)` | **Rejected with E10252** | None emitted from the failed build | None | No artifact |
> | Default cooperative profile: `setRawIRQ` | Unavailable/rejected because `raw_interrupt_paths` is empty | None | None | Exact diagnostic code is not supplied |
> | Takeover profile: `setIRQ`/`setIRQExclusive` | Unavailable because takeover replaces the KERNAL routing maps | None | None | Exact diagnostic code is not supplied |
> 
> The chain fixed total is `7 + 29 + 14 = 50` cycles; exclusive is `7 + 29 + 27 = 63`; raw is `7 + 37 = 44`. Body, ordinary-helper execution, VIC acknowledgement, bus stalls, and interrupted-instruction completion remain separate terms.
> 
> The helper uses ordinary `JSR`/`RTS`; its parameters, locals, temporaries, spills, pointer pairs, and scratch are invocation-private SFA storage. Homes must be disjoint from every overlapping mainline/NMI activation. The exact helper bytes, cycles, RAM/ZP homes, and whether code bodies can be shared are **Unknown** because its body and generated output were not supplied.
> 
> The explicit VIC raster acknowledgement must remain exactly one write of bit 0 to `$D019`; the compiler does not invent it. An isolated `LDA #$01; STA $D019` costs 5 bytes and 6 cycles, though final register reuse must be established from actual assembly.
> 
> ### Static storage and variant rules
> 
> - Only sink-reachable entry variants are emitted.
> - If chain and exclusive sinks are both reachable in a corrected cooperative build, both entry variants are required; the raw variant is not.
> - In a takeover build using only `setRawIRQ`, only the raw variant is required.
> - A literal source file that unconditionally invokes all three APIs has no single applicable profile and must fail. “Under their applicable profiles” must therefore mean separate/profile-conditional builds.
> - Default chain needs one two-byte saved-CINV link per live installation. Its address may begin at `$xxFE` but not `$xxFF`.
> - Exclusive and raw execution variants have zero route-static-link bytes, but a reachable matching restore still needs the compile-time LIFO predecessor storage required by the installation lifecycle.
> - Any body/helper duplication and all domain-specific SFA homes must be reported; a generic runtime dispatcher or frame selector is forbidden.
> - Chain preserves entry status using `PHP/CLD/.../PLP`.
> - Exclusive and raw execute `CLD`; their eventual `RTI` restores the complete interrupted P, including the prior D and I values.
> 
> Because E10252 is an error and any error suppresses the artifact, the default build containing the visible CINV `pokew` literally emits **no final entry path**. Removing that statement would allow the reachable chain and exclusive variants to be emitted.
> 
> ### Compiler boundary
> 
> - Semantic analysis owns the callback-only kind, provenance preservation, E10247 for erased/unknown provenance, and E10252 for the visible CINV ABI mismatch.
> - The selected profile owns sink availability, register-save owner, stack shape, terminal, vector visibility, and raw-vector capability.
> - Whole-program/SFA analysis owns reachability, overlapping execution domains, helper closure, installation LIFO state, and static homes.
> - Backend lowering owns `CLD`, status preservation, save/restore sequences, helper `JSR/RTS`, volatile `$D019` access, and exact bytes/cycles.
> - Platform startup/library owns atomic vector installation and banking transitions.
> - The developer owns enabled-source inventory and acknowledgement.
> 
> If the raw vector is not proven both writable and active, `setRawIRQ` is unavailable, no raw entry is emitted, and there is no automatic fallback to CINV. The program must select an applicable cooperative profile/API or fail. A genuinely opaque raw write may retain reachability but cannot certify its entry/exit ABI; the exactly visible `$0314` write is not opaque and remains E10252.
> 
> Evidence: [06-functions.md](/work/spec/06-functions.md:744), [appendix-c64.md](/work/spec/appendix-c64.md:759), [appendix-c64.md](/work/spec/appendix-c64.md:1025), and source key `Q-L29` ([source-manifest.md](/work/references/source-manifest.md:1531)).

</details>


<details>
<summary>candidate-irq-grade: packet manifest and exact captured text</summary>

```text
f2aa19ed4f7d9b8e633ad8e5177ccfd2d63d5483e72d57d85bafb0a4068c1826  answer.md
e1a14afa11ff99d9c271e2c3352bf943d368c2d5b3624399a9942a84f8bc7e91  control.py
552657fcabb070e48c98cba88453802d10d15f737d0940a740c75f802482e08b  oracle.md
fc1e91a459a65965f2a48c66fa7fd12dc581057f6d53ec3e4fc9483a48adecf2  prompt.md
```

> - **Q-P07 — Fail.** The answer leaves required NMI knowledge and nesting unresolved. [Answer line 38](/work/answer.md:38) says NMINV “remains on the stock KERNAL path”; [line 49](/work/answer.md:49) says there is “no finite repeated-RESTORE/NMI bound” and excludes NMI from its fixed accounting. It does not establish the required NMINV register/status save order, CIA2 single-consumer ownership, safe vector installation, or NMI nesting contract. These are explicit [oracle obligations](/work/oracle.md:17); leaving RESTORE/nesting open is a [disqualifier](/work/oracle.md:26). Reporting Unknown is honest, but does not supply the missing local knowledge.
> 
> - **Q-P09 — Pass.** [Answer lines 113–119](/work/answer.md:113) distinguish destructive reads from mask writes: “exactly one `LDA $DC0D`,” `$81` to enable, `$01` to disable, and “The write-only mask cannot be reconstructed by reading ICR.” The [counterexample explanation](/work/answer.md:167) explicitly rejects ordinary stored-byte semantics. This satisfies the [oracle’s central invariant and disqualifier](/work/oracle.md:38). The answer also supplies model bounds, visibility, ownership, cost expectations, and the [independent proof needed](/work/answer.md:169), while leaving actual silicon and compiler results Unknown.
> 
> - **Q-L29 — Fail.** Most entry-path decisions are correct, including E10252, status restoration, page-safe links, helper ABI, and rejection of unproven raw vectors. However, [answer line 185](/work/answer.md:185) says “Select exclusive CINV variant” without establishing its required source-ownership precondition. The generic assignment that “The developer owns enabled-source inventory and acknowledgement” at [line 218](/work/answer.md:218) does not establish that exclusive installation requires ownership of **every enabled IRQ source whose prior service is skipped**, as [the oracle requires](/work/oracle.md:66). Its local cost obligations also omit installer costs: [line 205](/work/answer.md:205) requires reporting body/helper duplication and SFA homes, but the [oracle additionally requires every installer and full cycle path](/work/oracle.md:72). These are completeness failures, not demands for measurements absent from the packet.
> 
> Unmeasured compiler output, runtime behavior, and silicon remain **Unknown**. Activation and future content commits were not grading criteria. Neither file was changed.

</details>


<details>
<summary>candidate-qp07-final: packet manifest and exact captured text</summary>

```text
8111b2ebc7584ee427a16951be0bfafce199ae6166094de8befa9f092848ce68  SKILL.md
e4a9f2e3a50b59f4824ba39443ce8ff846f52134f5effdc0424b763805b5df38  agents/openai.yaml
36229972f5e3f173efcff032790ff77f743eb9723606593aede1aec8ab10eba9  control.py
f8bcc82cb4179858b67b0698828c0f6c4d8c17ef106c06f35506461c3e8ef74e  prompt.md
4f3ea96e261ba9cc8f62b16ab5a7ed7f616b4980b7fa6efff4624d336f9a95cd  references/6502-lowering-casebook.md
3dfda1f0ea2e33e1e8632f56fd08dbf02030300a5ad9f101c278539ebeda56a3  references/acme-and-artifacts.md
920ba4f16884ef06823d87d600c9bb9454e1e28b110c60dad89be03884dd683d  references/blend65-semantics.md
d3bcc7a53424be398a7ef2e4c331ba403b7f02d648fd177904704ae1194dc112  references/c64-game-engineering.md
ab551b788474a4459a72a1ba8775436c6d75aeb86830162cf136097fc1dfa186  references/c64-hardware.md
199ca9b200158e532a21325ed2f1ffd9d84741aa929a6654f9d07350b167b16c  references/c64-memory-and-runtime.md
893c724b6ec7a84dfd66e7e73d8669783459b56472b2bb503788bc664d814e85  references/compiler-architecture.md
d25a45598a7669bf28ac0725c472760e3918cfb29151862d8beba9bb40a05b31  references/evidence-parity-and-recovery.md
7b38b1c9888df1aae0b1f63862c1f1824e1f905b4465a3ef1a24da8d95d40549  references/il-and-optimization.md
68838b0e38c60198c165160f2823759239ab27d233f72ed1dfc1e9e6b49716bf  references/mos-6502-family.md
4ee1b17f456e47d2bd2c854c343559a677c8ef367ccdaf8b9b33ddc7fb2f2ffb  references/sfa-and-abi.md
4bca2b8bd8d3e0e0d115c291d11797ef12ecd3b2c0bc4316f3a518c951788392  references/source-manifest.md
028efcd8220207b3d370cf09075ffa99074b53833d2388a83305d0c24775e5b8  references/target-portability.md
37b19bc98a032223e28bed69b0c228b8ab9ba4b988d797d2ab51ee7f46091a28  scenarios.md
fa33c4a76fcb003d7682c00c86a64321ec7751410f334832b3fbc570612aa7b1  spec/06-functions.md
925c7eb49fd32093e2de791a8f4c8887e2797d2956429cf5974aca985933936c  spec/12-intrinsics.md
4c414a44de2106540eae29d89e370e412e93f40ee848fd72193cb9b750a7fef2  spec/14-diagnostics.md
9ed9c41cf7ed22cfc4d557951e5e0f3f9c0fcba7e4d4a2ff63cc35694234ba73  spec/15-platform-profile.md
70e822e3ec88506fd694303d98f37b8eacc0bf6cb4febb5fe7fea5d4f0fe25f2  spec/appendix-c64.md
83b7baac19b72e8eeced5b156cd2ce79a56bfc1391739283e11009787669d95b  spec/evaluations/F007-interrupt-functions.md
```

> ## Evaluation
> 
> **Status: Verified partial.**  
> **Claim kinds:** packet-defined ABI, route legality, instruction shapes, and analytical costs are **Facts**. Conditional raw/NMI acceptance is an **Inference from explicit proof obligations**. Current compiler support, emitted assembly, artifact bytes, VICE behavior, silicon behavior, and release activation are **Unknown** because none was supplied or observed.
> 
> The packet identifies `skillVersion=2.0.1` and specification identity `BLEND65-SPEC-4-1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf`. The omitted release record means its content commit and activation status are both **Unknown**; they are not inferred here.
> 
> ## Fixed concrete context
> 
> For the stock IRQ cases:
> 
> - Machine: stock, unexpanded Commodore 64 PRG profile.
> - CPU: NMOS MOS 6510, documented instruction set only.
> - Video: PAL, 0.985248 MHz, 312 lines × 63 cycles; PAL VIC-II/6569 family. Exact VIC-II revision is not supplied.
> - SID: MOS 6581 at `$D400`.
> - CIA logical model: 6526. Exact CIA revisions are not supplied.
> - KERNAL: precisely 901227-03.
> - CPU port: `$0000` low DDR bits `$07`, `$0001` low latch bits `$06`, hence `LORAM=0`, `HIRAM=1`, `CHAREN=1`: BASIC is out, I/O and KERNAL ROM are visible.
> - CINV `$0314/$0315`: writable RAM, entered only after KERNAL saves A/X/Y.
> - NMINV `$0318/$0319`: writable RAM, entered through `$FFFA/$FFFB → $FE43`, whose `SEI; JMP ($0318)` does **not** save A/X/Y or clear D.
> - Raw IRQ/NMI vector RAM is not active in this stock profile. Hardware fetches the vectors from visible KERNAL ROM.
> - Enabled IRQ sources in the concrete case: VIC raster and CIA1 Timer A.
> - IRQ entry sets I, so this IRQ does not self-nest unless handler code deliberately changes I. NMI may pre-empt mainline or IRQ and is not blocked by `SEI`.
> - Cooperative stack capacity is 256 bytes with a 20-byte platform reserve, leaving 236 bytes for the measured program peak. No peak is proved by the scenario.
> 
> The qualified stock/unexpanded profile excludes cartridges. The separate “ordinary stock NMI” scenario explicitly admits possible cartridges; that broader case is not closed by the qualified-profile assumption and therefore has unknown expansion state.
> 
> ## IRQ route selection
> 
> ### 1. Default KERNAL chaining — selected for the raster-only source
> 
> **Status: Verified complete as a source/platform route contract.**  
> **Concrete compiler/artifact status: Unknown.**
> 
> `setIRQ(&onRasterIRQ)` is the correct stock route when the new handler owns VIC raster but leaves CIA1 Timer A to the saved stock KERNAL handler.
> 
> The actual entry/exit shape is:
> 
> ```asm
> ; CPU: 7 cycles, pushes PCH/PCL/P
> ; 901227-03 PULS-to-CINV:
> ;   saves A/X/Y, then JMP ($0314)
> ;   29 cycles, 16 existing-ROM bytes, 0 output bytes
> 
> handler_cinv_chain:
>     PHP                         ; 1 byte, 3 cycles
>     CLD                         ; 1 byte, 2 cycles
> 
>     LDA #$01
>     STA $D019                   ; expected VIC raster ack: 5 bytes, 6 cycles
> 
>     JSR ordinary_helper         ; 3 bytes, 6 cycles
>     ; helper body
>     RTS                         ; 1 byte, 6 cycles
> 
>     PLP                         ; 1 byte, 4 cycles
>     JMP (saved_previous_cinv)   ; 3 bytes, 5 cycles
> ```
> 
> Packet baseline:
> 
> - Generated wrapper: **6 bytes, 14 cycles**, excluding body/source action.
> - CPU acceptance plus KERNAL entry to CINV: **36 cycles**.
> - Fixed path to the prior handler: **50 cycles plus body**.
> - The saved prior handler then has a variable path and prevents a fixed complete total.
> - Existing ROM: **16 bytes** from PULS to CINV; the stock prior route eventually uses the applicable six-byte restore/`RTI` tail, also existing ROM and zero output bytes.
> - Static link: **2 writable bytes**, one for each simultaneously live install. The link may start at `$xxFE`; `$xxFF` must be relocated or rejected because NMOS `JMP ($xxFF)` wraps.
> - Wrapper stack: 7 bytes while `PHP` is live—CPU frame 3, KERNAL A/X/Y 3, compiler status 1.
> - One live ordinary helper call raises the generated-path peak to **9 bytes**, before any helper pushes, deeper calls, NMI overlap, or prior-handler peak.
> - The helper remains an ordinary `JSR`/`RTS` function. Its locals, parameters, temporaries, spills, and scratch require IRQ-domain SFA homes disjoint from overlapping mainline/NMI activations. Their sizes are **Unknown**.
> - `STA $D019` must write one to raster bit 0. An RMW instruction is not an interchangeable acknowledgement.
> - This wrapper must **not** read CIA1 `$DC0D`: the saved stock handler owns that consuming ICR read and the Timer A service.
> 
> The immediate VIC acknowledgement shown above is the required assembly oracle when A is not already proved `$01`. A proved reusable A value could remove `LDA #$01`; no such proof or output exists here.
> 
> Installation must atomically save CINV and replace its two bytes inside a caller-state-preserving IRQ-disabled transaction. Restoration pops the matching per-sink LIFO predecessor. Its exact emitted instructions, bytes, and cycles are **Unknown** because no assembly or cost report exists.
> 
> ### 2. Explicit KERNAL takeover
> 
> #### Raster-only handler
> 
> **Status: Incorrect.**
> 
> `setIRQExclusive(&onRasterIRQ)` is illegal for the first source because CIA1 Timer A remains enabled but the handler acknowledges only VIC raster. Jumping to `$EA81` skips KERNAL’s CIA1 ICR read. The CIA IRQ remains asserted or pending and can immediately retrigger; KERNAL timer service is also lost.
> 
> #### Handler that accounts for every enabled IRQ source
> 
> **Status: Verified complete for conditional legality.**  
> **Generated implementation and total cost: Unknown.**
> 
> The second source may use `setIRQExclusive` because the scenario asserts that it accounts for both enabled sources. “Accounts for” must mean that it either:
> 
> - acknowledges VIC raster with a one-write `$D019` operation; and
> - owns CIA1 and reads `$DC0D` exactly once, handling every returned bit whose consumption matters; or disables the source through an equally complete ownership contract.
> 
> A CIA1 ICR read has the expected core:
> 
> ```asm
>     LDA $DC0D                   ; 3 bytes, 4 cycles; clears returned latches
> ```
> 
> Masking A afterward does not undo consumption of other returned bits.
> 
> The exclusive route is:
> 
> ```asm
> ; CPU acceptance: 7 cycles, 3 stack bytes
> ; KERNAL PULS-to-CINV: 29 cycles, 16 existing-ROM bytes
> 
> handler_cinv_exclusive:
>     CLD                         ; 1 byte, 2 cycles
>     ; body:
>     ;   acknowledge VIC
>     ;   consume/dispatch CIA1 ICR once
>     ;   JSR ordinary_helper
>     JMP $EA81                   ; 3 bytes, 3 cycles
> 
> ; existing 901227-03 restore-only tail at $EA81:
>     PLA
>     TAY
>     PLA
>     TAX
>     PLA
>     RTI                         ; 6 ROM bytes, 22 cycles
> ```
> 
> Costs and ownership:
> 
> - Generated wrapper: **4 bytes + body**, **5 cycles + body**.
> - Wrapper plus ROM restore tail: **27 cycles + body**.
> - Complete fixed IRQ-acceptance path: **63 cycles + body**.
> - Existing ROM: 16-byte entry plus six-byte `$EA81` tail, both zero output bytes.
> - Route static link: **0 bytes** because the handler does not chain.
> - A returning cooperative program still needs a **two-byte saved CINV predecessor** for later `restoreIRQ()`. A provably nonreturning terminal install that never restores need not retain restoration storage, but must be allowed by the profile.
> - Wrapper peak: 6 stack bytes; one live helper call makes it **8 bytes**, excluding deeper calls/NMI.
> - `RTI` restores the complete interrupted status, including the original D value. `PHP/PLP` would be redundant and must not be added.
> - Helper/SFA sizes, body bytes/cycles, branch paths, bus stalls, and final stack peak remain **Unknown**.
> 
> On the final exclusive `restoreIRQ()` of a returning cooperative PRG, release is not merely a vector write. Inside the existing `PHP; PHA; SEI` transaction it must:
> 
> 1. Clear all CIA1 masks with `$1F`.
> 2. Stop Timer A while retaining CRA bit 7; stop Timer B with `$08`.
> 3. Read CIA1 ICR exactly once.
> 4. Reload PAL Timer A with `$4025`, low `$25` then high `$40`.
> 5. Restore the exact saved CINV bytes.
> 6. Enable only Timer A with `$81`.
> 7. Load/start Timer A with `(oldCRA & $80) | $11`.
> 8. Restore A/status with `PLA; PLP`.
> 
> This does not recover missed ticks or arbitrary prior write-only mask/latch state. No output measurement exists for the inline handback.
> 
> ### 3. Raw IRQ installation
> 
> #### Stock `$06` banking profile
> 
> **Status: Incorrect.**
> 
> `setRawIRQ` is unavailable: `raw_interrupt_paths` is empty and `$FFFE/$FFFF` is fetched from KERNAL ROM. Writes there can reach underlying RAM, but that RAM is not the active hardware vector while HIRAM remains one. This does not extend the stock PRG profile.
> 
> #### Hypothetical proved raw profile
> 
> **Status: Verified complete as a conditional contract.**  
> **Artifact/runtime status: Unknown.**
> 
> A valid takeover transition first writes the complete underlying RAM vectors while ROM still supplies valid entry paths, then performs the single banking change that exposes RAM. For the packet’s takeover shape, low latch bits become `$05` under DDR mask `$07`. Both IRQ and NMI vectors must already be valid because `SEI` cannot suppress NMI.
> 
> Conceptually:
> 
> ```asm
> ; KERNAL ROM still visible; writes reach RAM underneath.
>     LDA #<raw_nmi
>     STA $FFFA
>     LDA #>raw_nmi
>     STA $FFFB
> 
>     LDA #<raw_irq
>     STA $FFFE
>     LDA #>raw_irq
>     STA $FFFF
> 
> ; Preserve unowned processor-port bits and switch the owned low bits to $05.
> ; After this single visibility change, both raw routes are valid.
> ```
> 
> The raw IRQ handler is:
> 
> ```asm
> raw_irq:
>     PHA
>     TXA
>     PHA
>     TYA
>     PHA
>     CLD
> 
>     ; acknowledge/dispatch every enabled IRQ source
>     ; JSR ordinary_helper
> 
>     PLA
>     TAY
>     PLA
>     TAX
>     PLA
>     RTI
> ```
> 
> - Wrapper: **12 output bytes, 37 cycles + body**.
> - With hardware acceptance: **44 cycles + body**.
> - Stack: 6 bytes; **8 bytes** with one live helper call.
> - Route static link: 0.
> - Hardware vector storage: two physical RAM bytes for IRQ, plus the required valid NMI vector. Packaging/initializer bytes are **Unknown**.
> - The application owns all enabled IRQ/NMI sources, acknowledgements, raw vectors, bank states, nesting, and terminal `RTI`.
> - With the concrete VIC+CIA1 sources, the Q‑L29 raster-only body remains insufficient even in raw mode. The all-source version is conditionally valid.
> 
> An unproved transition must be rejected. If vectors are already exposed, a raw IRQ update is certifiable only with a separately proved `I=1` transaction, a continuously valid NMI route, visible handler code, and restoration of incoming CPU state. For raw NMI, `SEI` is never sufficient: the update must occur in a proved NMI-quiescent window or every torn intermediate vector must itself be valid.
> 
> ## Q‑L29 sink results
> 
> For the hypothetical handler that acknowledges VIC, calls one ordinary helper, and provides no account of CIA1 Timer A:
> 
> | Sink/write | Result |
> |---|---|
> | `setIRQ(&onRasterIRQ)` | **Accepted conditionally**: stock predecessor owns CIA1, handler owns VIC, then chains once. |
> | `setIRQExclusive(&onRasterIRQ)` | **Rejected**: enabled CIA1 Timer A is unhandled. |
> | `setRawIRQ(&onRasterIRQ)` | **Unavailable** on the stock profile; in a proved raw profile it is still **rejected** until CIA1 is handled or disabled. |
> | `pokew($0314, word(&onRasterIRQ))` | **E10252**: visible raw-entry address written to post-save CINV. The raw entry would save A/X/Y again and execute the wrong terminal. |
> 
> A constant `pokew` would normally be low byte then high byte:
> 
> ```asm
>     LDA #<value
>     STA $0314
>     LDA #>value
>     STA $0315
> ```
> 
> That is 10 bytes/12 cycles before atomicity protection, but **no such output is generated for this program** because the visible mismatch is a compile-time error. Making the address genuinely opaque removes compiler certification; it does not make the installation safe.
> 
> ## NMI routes
> 
> The ordinary NMI scenario lacks:
> 
> - an exact CIA2 enabled-mask/source inventory;
> - a RESTORE disposition;
> - a fixed cartridge-present/absent and acknowledgement contract;
> - a finite re-entry bound;
> - an NMI-safe two-byte update protocol; and
> - a stack/SFA bound.
> 
> Therefore installation on the ordinary stock machine is **Unknown and must be rejected**, even though its entry ABI is fully determined.
> 
> ### NMINV chain ABI
> 
> ```asm
> ; Hardware: 7 cycles, pushes PCH/PCL/P
> ; ROM $FE43:
>     SEI
>     JMP ($0318)                 ; 7 cycles, 4 existing-ROM bytes
> 
> nminv_chain:
>     PHP                         ; status must be saved before A/X/Y
>     PHA
>     TXA
>     PHA
>     TYA
>     PHA
>     CLD
> 
>     ; body must not consume $DD0D when prior stock handler owns CIA2
>     ; optional JSR ordinary_helper
> 
>     PLA
>     TAY
>     PLA
>     TAX
>     PLA
>     PLP                         ; restore after A/X/Y
>     JMP (saved_previous_nminv)
> ```
> 
> - Wrapper: **16 output bytes, 43 cycles + body**.
> - CPU acceptance to prior handler: **57 cycles + body**.
> - Existing ROM stub: four bytes, zero output bytes.
> - Static link: two writable page-safe bytes; `$xxFE` valid, `$xxFF` forbidden.
> - Stack: 7 bytes; **9 bytes** during one helper call.
> - The prior stock handler has variable CIA2, RS-232, cartridge, and RESTORE paths, so no fixed complete total exists.
> - A simple chain must perform **zero** CIA2 ICR reads. The saved stock handler owns its one consuming `$DD0D` read.
> 
> ### Exclusive NMINV ABI
> 
> ```asm
> nminv_exclusive:
>     PHA
>     TXA
>     PHA
>     TYA
>     PHA
>     CLD
> 
>     LDA $DD0D                   ; exactly once if this adapter owns CIA2
>     ; preserve and dispatch every returned source bit
>     ; separately handle/prove RESTORE and cartridge behavior
> 
>     PLA
>     TAY
>     PLA
>     TAX
>     PLA
>     RTI
> ```
> 
> - Wrapper: **12 output bytes, 37 cycles + body**.
> - Including hardware and ROM stub: **51 cycles + body**.
> - Stack: 6 bytes; **8 bytes** with one helper call.
> - Route static link: zero; a returning installation needs a two-byte predecessor for restoration.
> - There is no general stock CIA2 restoration synthesis. Any continuing mask must come from an exact software-owned state/baseline.
> - Writing or reading CIA2 does not acknowledge RESTORE or a cartridge source.
> 
> ### Raw NMI ABI
> 
> The wrapper is the same 12-byte/37-cycle save/restore/`RTI` sequence, but without the ROM stub:
> 
> - **44 cycles + body** from hardware acceptance.
> - Six stack bytes, or eight during one helper call.
> - `$FFFA/$FFFB` and the handler must remain visible in every reachable bank state.
> - The raw vector must be populated before exposure or updated through an independently proved NMI-safe scheme.
> 
> A hypothetical contract with exact finite sources, a finite re-entry depth `d`, and a safe update can accept chain, exclusive, or raw NMI according to ownership. SFA then provides disjoint homes for every simultaneously live level and stack analysis accumulates each active CPU/wrapper/helper frame. Because neither `d` nor helper/storage costs are supplied, no numeric NMI peak or runtime bound is asserted.
> 
> ## Source expressiveness and ownership
> 
> Blend65 source may:
> 
> - declare any number of `interrupt function name(): void` handlers;
> - take their non-callable handler addresses;
> - use recognized IRQ/NMI sinks;
> - acknowledge MMIO sources explicitly;
> - call ordinary helpers using `JSR`/`RTS`;
> - access globals and MMIO, subject to shared-state race warnings;
> - express dynamic `poke`/`pokew` addresses as deliberate unsafe boundaries.
> 
> It may not:
> 
> - give an interrupt handler parameters or a return;
> - call an interrupt function normally;
> - pass an ordinary function to an interrupt sink;
> - erase/lose handler provenance at a recognized sink;
> - visibly install a raw entry at incompatible CINV/NMINV;
> - select a raw installer on a profile without an active/writable raw vector;
> - accept unbounded storage-bearing or hardware-stack nesting;
> - use a raw decimal-mode intrinsic—the compiler owns entry `CLD`, while typed BCD operations own balanced decimal regions.
> 
> Ownership is divided as follows:
> 
> - **Compiler:** preserve handler identity, select only sink-reachable variants, generate decimal/status/register wrappers, manage install/restore LIFOs and page-safe links, close SFA and stack analysis, report all bytes/cycles/storage, and reject unsafe routes.
> - **Platform/profile:** define CPU/KERNAL/vector entry ABI, banking and vector visibility, enabled-source and nesting guarantees, stack capacity/reserve, ROM tails, and raw-path availability.
> - **Developer:** select chain/exclusive/raw ownership, configure and acknowledge devices, account for every enabled/physical source, define RESTORE/cartridge behavior, make shared helper/global access concurrency-safe, and supply any external finite nesting or quiescent-update proof.
> 
> ## Counterexample and required independent proof
> 
> Counterexample: install the raster-only source through `setIRQExclusive` while CIA1 Timer A remains enabled. The handler writes `$01` to `$D019` and jumps to `$EA81`. Because `$EA81` begins after KERNAL’s CIA1 ICR read, `$DC0D` is never consumed; CIA1 remains pending and IRQ immediately re-enters. This disproves “VIC acknowledged, therefore the exclusive IRQ is complete.”
> 
> Independent proof must contain two separate oracles:
> 
> 1. **Assembly/cost oracle:** inspect the exact emitted variant, installer/release transaction, saved-link placement, one `$D019` write, appropriate `$DC0D/$DD0D` read count, `CLD`, terminal, linked helper variants, output/ROM bytes, SFA, and stack report.
> 2. **Behavior oracle:** on exact VICE 3.10 `x64sc` configuration, inject simultaneous VIC+CIA sources and each selected NMI source; observe vector states, bank transitions, volatile access order/count, restored A/X/Y/P/D, source-line deassertion, nesting, and stack high-water.
> 
> Targeted physical QA remains necessary for CIA revision/edge behavior, RESTORE pulses, cartridge NMI acknowledgement, and every claimed NMI re-entry bound. No emulator or physical result exists in this packet.
> 
> Lineage: [SFA interrupt gate](/work/references/sfa-and-abi.md:327), [C64 entry contracts](/work/references/c64-memory-and-runtime.md:313), [IRQ costs](/work/references/c64-memory-and-runtime.md:328), [NMI contracts](/work/references/c64-memory-and-runtime.md:359), [device acknowledgements](/work/references/c64-hardware.md:41), [interrupt source contract](/work/spec/06-functions.md:664), [C64 IRQ routes](/work/spec/appendix-c64.md:746), and [Q‑P07/Q‑L29 authority map](/work/references/source-manifest.md:1538).

</details>


<details>
<summary>candidate-irq-final-grade: packet manifest and exact captured text</summary>

```text
74cdb3033fa79b8b62b15a5b9a28a4e23c2273d8987bb84a07947ff790dae3a1  answer.md
e1a14afa11ff99d9c271e2c3352bf943d368c2d5b3624399a9942a84f8bc7e91  control.py
101f4ad1be7c3c5beacb0f0e9ddda5c5f3c51dc467889220114b8ddd40af6240  oracle.md
fc1e91a459a65965f2a48c66fa7fd12dc581057f6d53ec3e4fc9483a48adecf2  prompt.md
```

> **Q-P07 — Pass.**
> 
> The capture satisfies the decision and safety obligations:
> 
> - The CINV chain uses `PHP; CLD` and restores status before `JMP (saved_previous_cinv)` ([answer, lines 47–59](/work/answer.md:47)). It reports “**2 writable bytes**” and permits `$xxFE` while rejecting `$xxFF` ([line 69](/work/answer.md:69)), satisfying [oracle lines 10–16](/work/oracle.md:10).
> - Exclusive entry uses `CLD` and `JMP $EA81`; raw entry owns register preservation and `RTI`. Raw installation requires both vectors to be valid before banking exposes them ([lines 112–138](/work/answer.md:112), [167–217](/work/answer.md:167)).
> - NMI chaining saves status before registers and restores it afterward ([lines 263–280](/work/answer.md:263)). “A simple chain must perform **zero** CIA2 ICR reads” preserves the predecessor’s ownership ([line 289](/work/answer.md:289)). The incomplete ordinary NMI installation “**must be rejected**” ([line 252](/work/answer.md:252)); missing source, nesting, and installation guarantees are not silently accepted. These satisfy [oracle lines 17–28](/work/oracle.md:17).
> - Costs, ownership, a counterexample, and independent assembly/behavior/physical-QA obligations are supplied ([lines 355–370](/work/answer.md:355)), addressing [oracle line 29](/work/oracle.md:29).
> 
> **Q-L29 — Fail — required knowledge and remedy are incomplete.**
> 
> The central lowering analysis is correct: it preserves handler identity, distinguishes the three entry conventions, reports page-safe links and storage obligations, and rejects the exact visible write with “**E10252**” ([lines 389–398](/work/answer.md:389)). Two required elements remain absent:
> 
> - **Language constraint:** [oracle lines 59–60](/work/oracle.md:59) explicitly require that Specification 4 exposes no raw decimal-mode intrinsic. This capture explains compiler “decimal normalization” ([line 630](/work/answer.md:630)) but never establishes that language restriction. Correct `CLD` wrappers do not supply the missing source-language fact.
> - **Separate remedy:** [oracle lines 76–77](/work/oracle.md:76) require “a remedy separated from any finding.” The capture diagnoses the incompatible `pokew`, but supplies no explicit corrective action for that write. Its closing discussion says making the address opaque “crosses into an explicit unsafe hardware boundary” ([line 634](/work/answer.md:634)); that warning does not provide the required remedy.
> 
> Unmeasured compiler output, runtime, and silicon remain **Unknown**, without penalty for absent measurements. Neither file was modified.

</details>


<details>
<summary>candidate-controls-complete: packet manifest and exact captured text</summary>

```text
8111b2ebc7584ee427a16951be0bfafce199ae6166094de8befa9f092848ce68  SKILL.md
e4a9f2e3a50b59f4824ba39443ce8ff846f52134f5effdc0424b763805b5df38  agents/openai.yaml
e149152014fc002ea411e6576760461cf0c79c111256db49b3f7cea4ed6b6057  context.md
36229972f5e3f173efcff032790ff77f743eb9723606593aede1aec8ab10eba9  control.py
fcc8321629a654a4022594943535429d5a574f15e1e0129ad228462bc1062e7a  prompt.md
b625d2fa628a284c4802a672a1a138d567c56be3c7fa62a9da89f4f2e20eb6a3  raw-inputs.md
4f3ea96e261ba9cc8f62b16ab5a7ed7f616b4980b7fa6efff4624d336f9a95cd  references/6502-lowering-casebook.md
3dfda1f0ea2e33e1e8632f56fd08dbf02030300a5ad9f101c278539ebeda56a3  references/acme-and-artifacts.md
920ba4f16884ef06823d87d600c9bb9454e1e28b110c60dad89be03884dd683d  references/blend65-semantics.md
d3bcc7a53424be398a7ef2e4c331ba403b7f02d648fd177904704ae1194dc112  references/c64-game-engineering.md
ab551b788474a4459a72a1ba8775436c6d75aeb86830162cf136097fc1dfa186  references/c64-hardware.md
199ca9b200158e532a21325ed2f1ffd9d84741aa929a6654f9d07350b167b16c  references/c64-memory-and-runtime.md
893c724b6ec7a84dfd66e7e73d8669783459b56472b2bb503788bc664d814e85  references/compiler-architecture.md
d25a45598a7669bf28ac0725c472760e3918cfb29151862d8beba9bb40a05b31  references/evidence-parity-and-recovery.md
7b38b1c9888df1aae0b1f63862c1f1824e1f905b4465a3ef1a24da8d95d40549  references/il-and-optimization.md
68838b0e38c60198c165160f2823759239ab27d233f72ed1dfc1e9e6b49716bf  references/mos-6502-family.md
4ee1b17f456e47d2bd2c854c343559a677c8ef367ccdaf8b9b33ddc7fb2f2ffb  references/sfa-and-abi.md
7c71f923db6dd19303b1554cdc47061c26d1ef435b923642ae95cc1173f8b421  references/source-manifest.md
028efcd8220207b3d370cf09075ffa99074b53833d2388a83305d0c24775e5b8  references/target-portability.md
73f7deb046abcc2caa6bcced73bd62c741bb2c0e954b16cfb1633e3cbdab8651  spec/02-type-system.md
1dcefd066aee1e9a35e255172a5c772a442092ff57e8ebf2076803934ff2d4e8  spec/04-expressions-operators.md
fa33c4a76fcb003d7682c00c86a64321ec7751410f334832b3fbc570612aa7b1  spec/06-functions.md
0097af18c1763ea50450eb0476afb2ee4d2c309afe7bb9c4fd476917ec926925  spec/11-memory-model.md
925c7eb49fd32093e2de791a8f4c8887e2797d2956429cf5974aca985933936c  spec/12-intrinsics.md
```

> The packet supports the language, machine, and design conclusions below. It does not support any claim about current compiler output, assembled bytes, emulator execution, or silicon observation.
> 
> Authority envelope: the supplied skill is a `2.0.1` candidate, but its release record is deliberately absent, so its content commit and activation are `Unknown`. The frozen Specification 4 identity is `1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf`. Q-A15 separately declares the preceding active authority as `2.0.0@c9e70fab6039e9ced3108e88f0ea9730d4fd3007`.
> 
> ## Q-C13 — signed and unsigned shifts
> 
> Status:
> 
> - Language behavior and analytical NMOS-6510 lowering oracle: `Verified complete`.
> - Current compiler lowering, final bytes, and runtime timing: `Unknown`.
> - Claim kinds: specification facts plus machine-level inferences.
> 
> The source rules are decisive: signed `>>` is arithmetic; unsigned `>>` is logical; `<<` is identical for signed and unsigned. Counts at least the width saturate rather than being masked: negative signed right shifts yield all ones; all other wide shifts yield zero ([type-system](/work/spec/02-type-system.md:499), [expressions](/work/spec/04-expressions-operators.md:209)). NMOS `ROR` consumes carry, while `ASL` exposes the old sign bit through carry ([CPU reference](/work/references/mos-6502-family.md:166)).
> 
> Assumptions: byte operand is disposable in `A`; word result is in-place at ordinary absolute `v/v+1`; count is a compile-time constant; branches do not cross a page; A/flags need not be preserved; no MMIO, aliasing, interrupt observation, helper, or call.
> 
> ### Results
> 
> | Count | `$80` signed `>>` / `<<` | `$7F` signed `>>` / `<<` | `$FF` unsigned `>>` / `<<` |
> |---:|---|---|---|
> | 0 | `80 / 80` | `7F / 7F` | `FF / FF` |
> | 1 | `C0 / 00` | `3F / FE` | `7F / FE` |
> | 7 | `FF / 00` | `00 / 80` | `01 / 80` |
> | 8 | `FF / 00` | `00 / 00` | `00 / 00` |
> | 15, 16, 17 | `FF / 00` | `00 / 00` | `00 / 00` |
> 
> | Count | `$8001` signed `>>` / `<<` | `$7FFF` signed `>>` / `<<` | `$FFFF` unsigned `>>` / `<<` |
> |---:|---|---|---|
> | 0 | `8001 / 8001` | `7FFF / 7FFF` | `FFFF / FFFF` |
> | 1 | `C000 / 0002` | `3FFF / FFFE` | `7FFF / FFFE` |
> | 7 | `FF00 / 0080` | `00FF / FF80` | `01FF / FF80` |
> | 8 | `FF80 / 0100` | `007F / FF00` | `00FF / FF00` |
> | 15 | `FFFF / 8000` | `0000 / 8000` | `0001 / 8000` |
> | 16, 17 | `FFFF / 0000` | `0000 / 0000` | `0000 / 0000` |
> 
> ### Actual byte candidates
> 
> ```asm
> ; B-ASR: repeat for signed byte >> k, where 1 <= k <= 6
> CMP #$80
> ROR A
> 
> ; B-SIGN: signed byte >> 7 or any count >= 8
> ; ASL is safe because A will be replaced.
> ASL A
> LDA #$FF
> BCS done
> LDA #$00
> done:
> 
> ; B-L7: any byte << 7
> LSR A
> LDA #$00
> ROR A
> ```
> 
> `B-SIGN` is 7 bytes, one byte smaller than the casebook’s `CMP`-based terminal sequence, with the same 7-cycle negative / 8-cycle non-negative paths. It should also be selected at count 7: every signed byte shifted right seven positions is determined solely by its sign.
> 
> ```asm
> ; W-ASR1-size: signed word >> 1, code-size choice
> LDA v+1
> ASL A
> ROR v+1
> ROR v
> 
> ; W-ASRk: signed word >> k, 2 <= k <= 7
> LDA v+1
> ; repeat k times:
> CMP #$80
> ROR A
> ROR v
> ; end repeat
> STA v+1
> 
> ; W-ASR8
> LDA v+1
> STA v
> ASL A
> LDA #$FF
> BCS fill8
> LDA #$00
> fill8:
> STA v+1
> 
> ; W-SIGN: signed word >> 15, 16, or 17
> LDA v+1
> ASL A
> LDA #$FF
> BCS fill
> LDA #$00
> fill:
> STA v
> STA v+1
> ```
> 
> Count 15, like count 16+, is sign-only. Thus the routed casebook’s 44-byte repeated count-15 baseline is semantically legal but not the expert selection.
> 
> Logical word right shift uses:
> 
> ```asm
> LDA v+1
> ; repeat:
> LSR A
> ROR v
> ; end repeat
> STA v+1
> ```
> 
> Word left shift mirrors it with `LDA v`, `ASL A`, `ROL v+1`, `STA v`. Count 8 copies the source byte to the other byte and stores zero. Count 15 can isolate the single surviving bit:
> 
> ```asm
> ; unsigned word >> 15
> LDA v+1
> ASL A
> LDA #$00
> STA v+1
> ROL A
> STA v
> 
> ; any word << 15
> LDA v
> LSR A
> LDA #$00
> STA v
> ROR A
> STA v+1
> 
> ; any unsigned >> or any << when count >= 16
> LDA #$00
> STA v
> STA v+1
> ```
> 
> ### Complete analytical cost
> 
> Data accesses exclude instruction and operand fetches. NMOS absolute RMW contributes one data read and two writes.
> 
> | Operation/count | Bytes | Cycles | Data accesses |
> |---|---:|---:|---:|
> | Byte, count 0 | 0 | 0 | 0 |
> | Signed byte `>>1` | 3 | 4 | 0 |
> | Signed byte `>>7`, or `>>8+` | 7 | 7 negative / 8 non-negative | 0 |
> | Unsigned byte `>>1` / `>>7` | 1 / 7 | 2 / 14 | 0 |
> | Any byte `<<1` / `<<7` | 1 / 4 | 2 / 6 | 0 |
> | Unsigned byte `>>8+`; any byte `<<8+` | 2 | 2 | 0 |
> | Signed word `>>1`, size choice | 10 | 18 | 7 |
> | Signed word `>>1`, lower-traffic alternative | 12 | 18 | 5 |
> | Signed word `>>7` | 48 | 78 | 23 |
> | Signed word `>>8` | 16 | 19 negative / 20 non-negative | 3 |
> | Signed word `>>15/16/17` | 16 | 19 negative / 20 non-negative | 3 |
> | Unsigned word `>>1`; any word `<<1` | 10 | 16 | 5 |
> | Unsigned word `>>7`; any word `<<7` | 34 | 64 | 23 |
> | Unsigned word `>>8`; any word `<<8` | 11 | 14 | 3 |
> | Unsigned word `>>15`; any word `<<15` | 13 | 18 | 3 |
> | Unsigned word `>>16+`; any word `<<16+` | 8 | 10 | 2 |
> 
> For repeated shifts, the final shift/rotate defines `N/Z/C`; `V`, `D`, and `I` are preserved. Terminal signed fills leave `C` equal to the original sign and `N/Z` describing the fill. Wide-zero loads set `N=0,Z=1` while preserving `C/V/D/I`. `X/Y` are untouched.
> 
> All candidates use zero additional ZP, frame, stack, scratch, data, tables, or padding. Existing `A` and absolute word homes are assumed. There is no call, helper, loader, or page-dependent timing. The word `>>1` choices are Pareto alternatives: 10 bytes with extra RMW traffic versus 12 bytes with fewer RAM accesses.
> 
> Lineage: `spec/02-type-system.md#TS-19`, `spec/04-expressions-operators.md#Bitwise Operators`, `references/mos-6502-family.md#Instruction effects`, source keys `BLEND65-SPEC-4-1c2a2d75`, `MOS-PGM-1976`, `MOS-6510-1982`.
> 
> ## Q-L03 — two volatile reads
> 
> Status:
> 
> - Proposed CSE of the two reads: `Incorrect`.
> - Required language behavior: `Verified complete`.
> - Current compiler behavior: `Unknown`.
> 
> Each volatile memory intrinsic is a separate, exactly-once source observation in source order ([intrinsics](/work/spec/12-intrinsics.md:180)). The IL must retain volatile operation identity, count, width, address, and order; equal addresses do not authorize commoning ([IL doctrine](/work/references/il-and-optimization.md:161)).
> 
> Observable trace:
> 
> 1. Evaluate the first address once.
> 2. Perform volatile read 1.
> 3. Keep its returned value live until its last consumer.
> 4. Evaluate the second address as required.
> 5. Perform volatile read 2, even if the address is equal.
> 6. Consume the two independently observed values in source order.
> 
> A device can change between reads or acknowledge state on the first read. Therefore “same address and same returned value in one test” is insufficient. Pure address calculation may be shared, but the accesses may not.
> 
> If both values are needed simultaneously, the first needs a surviving register or SFA temporary while the second load occurs. Any runtime-address ZP pointer and result spill must enter SFA closure. Exact storage and complete cost are `Unknown` without the containing expression and address form. At a constant absolute address, eliminating one read would appear to save 3 bytes, 4 CPU cycles, and one device access—but that candidate is not equivalent.
> 
> Ownership:
> 
> - Semantic analysis marks volatility/effects.
> - Semantic IR preserves two ordered operations.
> - Memory-aware optimization rejects CSE.
> - SFA/resource binding owns any live temporary or spill.
> - Instruction selection emits two legal loads.
> 
> Smallest remedy: mark volatile reads as non-commonable ordered effects in the existing optimizer rule, retain both nodes, and add one focused behavior oracle where the device changes/acknowledges between reads plus an assembly oracle requiring two loads in order. No new pass or registry is justified.
> 
> Lineage: `references/il-and-optimization.md#Memory Effects and Volatility`, `references/compiler-architecture.md#Responsibility Map`, source key `BLEND65-SPEC-4-1c2a2d75`.
> 
> ## Q-L06 — `a` calls `b` while `a` remains live
> 
> Status:
> 
> - Required SFA/ABI behavior: `Verified complete`.
> - Any allocation that overlays live `a` storage with `b`: `Incorrect`.
> - Current compiler allocation: `Unknown`.
> 
> An ordinary non-recursive call is legal. `a` remains active while `b` executes, and every `a` value used after the call is live across that call. Consequently those homes interfere with `b`’s parameters, locals, temporaries, spills, and helper scratch ([SFA interference](/work/references/sfa-and-abi.md:166)). Functions on the same call path require separate live storage ([function specification](/work/spec/06-functions.md:452)).
> 
> Only `a` slots proved dead before the call may share compatible storage with `b`. A live value may instead survive in a register only if the explicit ABI and `b`’s complete clobber summary prove that register preserved. A spill introduced during binding returns to SFA before final closure.
> 
> Costs:
> 
> - Direct `JSR`/`RTS`: 12 cycles and two peak hardware-stack bytes for this active edge.
> - Parameters, returns, and frame storage remain static; they do not move onto the hardware stack.
> - Required static RAM is the compatible placement of all simultaneously live `a` slots plus `b`’s execution storage. Its byte total is `Unknown` because types and frame contents were not supplied.
> - Parameter traffic, result traffic, register saves, ZP promotion, and full code bytes are likewise `Unknown`.
> 
> Responsible boundary: whole-program call/liveness analysis establishes the overlap, SFA adds the interference edges and places homes, ABI/resource binding respects clobbers, and final closure prevents later scratch invention.
> 
> Smallest remedy for a wrong overlay: add interference edges only between `a`’s live-across-call slots and `b`’s concurrent storage, recolor/reallocate, and rerun final SFA closure. Add a focused test whose sentinel local is used after `b`, plus an allocation assertion showing disjoint homes. Do not reject the call or introduce dynamic frames.
> 
> Lineage: `references/sfa-and-abi.md#Lifetime Model`, `#Interference and Reentrancy`, `spec/06-functions.md#SFA Calling Convention`.
> 
> ## Q-R08 — generalized pass registry
> 
> Status:
> 
> - Generalized registry proposal under the supplied facts: `Incorrect` as an architectural recommendation.
> - The unspecified local rewrite’s correctness and benefit: `Unknown`.
> 
> The Blend65 domain-expert skill applies because this is compiler architecture and optimization design. The smallest sufficient reference set is:
> 
> 1. [SKILL.md anti-overengineering gate](/work/SKILL.md:143)
> 2. [compiler architecture design/pipeline rules](/work/references/compiler-architecture.md:21)
> 3. [IL pass-rule packet](/work/references/il-and-optimization.md:357)
> 
> Material assumptions:
> 
> - There is exactly one local rewrite.
> - No measured failure, second consumer, plugin need, new target, fixed-point family, or missing semantic representation has been demonstrated.
> - The rewrite’s exact match, effects, cost, and pipeline position are not supplied.
> - Existing compiler structure is neither authority nor evidence for the desired architecture.
> 
> The registry fails the gate: no demonstrated failure requires it; a direct rule has not been shown insufficient; only one consumer exists; no current complexity is replaced; and no registry-specific qualification evidence exists. Architecture doctrine explicitly prefers a direct interface for one consumer ([pipeline invariant](/work/references/compiler-architecture.md:124)), while the IL doctrine says not to create a registry merely to store a handful of direct transformations ([pass rules](/work/references/il-and-optimization.md:374)).
> 
> Recommendation: implement the rewrite locally in its accountable existing stage, with a rule packet covering match, applicability, semantic and machine effects, placement, complete cost, counterexample, behavior oracle, and assembly oracle. Keep it removable if the measured win does not appear. Revisit a registry only after multiple real rules demonstrate shared discovery, ordering, configuration, or reporting needs.
> 
> Compiler-build cost, maintenance cost, and target code benefit remain `Unknown`; the rewrite itself was not supplied.
> 
> ## Q-P10 — bounded CIA1 keyboard/joystick transaction
> 
> Status:
> 
> - Analytical transaction under the stated local contract: `Verified complete`.
> - Current compiler/platform implementation and VICE/silicon behavior: `Unknown`.
> - Disposition: explicit local contract, exposed through a zero-cost platform API; diagnose if its ownership preconditions cannot be proved.
> 
> Assumptions:
> 
> - Stock PAL C64, NMOS 6510, PAL VIC-II 6569 family; exact VIC revision is `Unknown` and irrelevant to this non-raster transaction.
> - SID 6581 at `$D400`, untouched.
> - Two CIAs use documented MOS 6526 port behavior; exact CIA revision is `Unknown`, with no revision-sensitive timer/edge claim.
> - KERNAL 901227-03; I/O is visible through the existing `$0000/$0001` state, which is untouched.
> - CIA2 `$DD00/$DD02`, its serial state, ICR/pending state, and current VIC bank remain untouched.
> - CIA1 entry latches/directions are exactly `PRA=$FF`, `PRB=$FF`, `DDRA=$FF`, `DDRB=$00`.
> - The caller grants temporary exclusive CIA1-port ownership. The KERNAL keyboard service cannot intervene. No NMI edge occurs. This is not a claim that `SEI` masks NMI.
> - Joystick-2 switches are released while the keyboard sample occurs.
> - `key_fe` and `joy2` are ordinary writable absolute result homes.
> 
> `$FE` is the active-low CIA1 PA column-selection mask; the PB read returns its eight row bits.
> 
> ```asm
> LDA #$FE
> STA $DC00       ; select PA0 keyboard column
> LDA $DC01       ; one keyboard observation
> STA key_fe
> 
> LDA #$FF
> STA $DC00       ; release all PA lines / restore PRA latch
> LDA $DC00       ; joystick-2 pin observation
> AND #$1F
> STA joy2
> ```
> 
> The hardware reference assigns joystick 2 to CIA1 PA0–PA4, keyboard selection to PRA, and row input to PRB ([CIA ports](/work/references/c64-hardware.md:201)). CIA2 is explicitly unrelated to this scan ([input doctrine](/work/references/c64-game-engineering.md:506)).
> 
> Cost and effects:
> 
> - 24 output bytes, 30 instruction-core cycles.
> - Four intentional CIA accesses in exact order: write `$DC00=$FE`, read `$DC01`, write `$DC00=$FF`, read `$DC00`.
> - Two ordinary absolute result writes.
> - Two mutable result bytes; zero additional scratch, ZP, stack, table, data, or padding.
> - No DDR access, no ICR access, no `$0000/$0001` access, and no CIA2 access.
> - Exit latches/directions exactly match entry.
> - `A=joy2 & $1F`; final `N/Z` describe that mask. `C/V/D/I` and `X/Y` are unchanged.
> - No IRQ/NMI wrapper, vector, acknowledgement, or stack cost is introduced. The 30 cycles exclude latency from any unrelated permitted preemption; such end-to-end latency is `Unknown`.
> - Loader code/data/time and initialization-loading work are exactly zero because the input states that this scan has no loader.
> - CPU/VIC visibility and the current VIC bank do not change.
> 
> Counterexample: holding a joystick-2 direction low while PRA is driving the keyboard selection can pull a shared matrix line and create a false/ambiguous keyboard closure. No compiler sequence can manufacture independent simultaneous electrical observations. Another invalid case is the KERNAL keyboard IRQ changing PRA between the store and PB read.
> 
> Independent proof needed: first inspect emitted assembly and assembled bytes for exactly the four CIA accesses and restoration. Then run a pinned VICE 3.10 `x64sc` trace with the specified PAL/CIA/ROM configuration, checking register access order, result bytes, CIA1 pre/post state, and unchanged CIA2/VIC bank. Simultaneous joystick/key sharing and unusual controllers remain a targeted physical-hardware boundary.
> 
> Lineage: `references/c64-hardware.md#CIA register effects and ownership`, `references/c64-game-engineering.md#Input`, source keys `MOS-6526-1981`, `CBM-C64-PRG-1982`, `CBM-C64-KERNAL-03`.
> 
> ## Q-A15 — false NMOS decimal-mode fact
> 
> | Item | Status | Claim kind | Result |
> |---|---|---|---|
> | F: “NMOS6510 IRQ clears D” | `Incorrect` | Fact | NMOS IRQ sets `I` but provides no CMOS-style `D` clear. |
> | A: omit `CLD` at exclusive CINV body entry | `Incorrect` | Inference | KERNAL 901227-03 also reaches CINV without clearing D; binary body entry is therefore unproved. |
> | B: price wrapper without normalization | `Incorrect` | Inference | It undercounts the equivalent correct wrapper by one output byte and two cycles. |
> | C’s dependency on F/A | `Verified complete` as unaffected | Fact | The input explicitly says immutable-asset placement is unrelated. |
> | C’s substantive placement correctness | `Unknown` | Unknown | No placement artifact, map, or costs were supplied. |
> | Supplied 2.0.1 correction | `Verified partial` | Fact | Its CPU/KERNAL reference text is correct, but its release commit, qualification, review, and activation are absent. |
> | Active 2.0.0 content or repository defect | `Unknown` | Unknown | Only its identity is supplied; F is synthetic and must not be attributed to the active repository skill. |
> | Current compiler | `Unknown` | Unknown | No implementation or artifact was supplied. |
> 
> The exact CPU rule is that IRQ pushes PC/status, sets `I`, and does not clear NMOS `D` ([CPU interrupt and decimal rules](/work/references/mos-6502-family.md:221)). KERNAL 901227-03 saves A/X/Y and dispatches through CINV without clearing `D` ([C64 runtime](/work/references/c64-memory-and-runtime.md:313), [pinned KERNAL source record](/work/references/source-manifest.md:739)).
> 
> Equivalent correct exclusive-CINV accounting is:
> 
> - CPU acceptance: 7 cycles, 3 stack bytes, zero output bytes.
> - Existing KERNAL `PULS` to CINV: 29 cycles, 16 existing-ROM bytes, peak stack 6.
> - Generated `CLD; body/ack; JMP $EA81`: `4 + body` output bytes.
> - Wrapper plus existing `$EA81` restore tail: `27 + body/ack` cycles and 6 additional existing-ROM bytes.
> - Full IRQ-acceptance path: `63 + body/ack` cycles.
> - Decimal normalization itself: 1 output byte, 2 cycles, no data access, ZP, frame, stack, data, padding, or loader cost.
> - Final `RTI` restores the interrupted status, including the original `D`.
> 
> The omitted-`CLD` price would be 3 generated bytes and `61 + body/ack` full-path cycles, but it is not equivalent when entry has `D=1` and the body performs ordinary `ADC/SBC`. Therefore it cannot be used as a parity baseline.
> 
> Smallest evidence-backed action: pause only F-dependent work A/B; treat supplied 2.0.1 as an unactivated patch candidate; establish its actual content commit; retain the corrected NMOS/KERNAL rule; add a discriminating `D=1` exclusive-CINV case that checks `CLD`, binary body state, exact `+1 byte/+2 cycles`, and `RTI` restoration; requalify the changed CPU/interrupt cases and A/B; obtain independent review; then bind the actual commit and activate atomically. Record A/B as `corrected` or `revalidated` from their new evidence. Record C as `unaffected` and do not reopen it.
> 
> Lineage: active authority supplied as `skillVersion=2.0.0`, `contentCommit=c9e70fab6039e9ced3108e88f0ea9730d4fd3007`; candidate `skillVersion=2.0.1`, `contentCommit=Unknown`; source keys `MOS-PGM-1976`, `MOS-HW-1976`, `MOS-6510-1982`, `CBM-C64-KERNAL-03`.

</details>


<details>
<summary>candidate-controls-complete-grade: packet manifest and exact captured text</summary>

```text
86fa95aaafe721e999cf01dc83078ac289e825cba5e26e23d28f52ad510c6beb  answer.md
e1a14afa11ff99d9c271e2c3352bf943d368c2d5b3624399a9942a84f8bc7e91  control.py
902a9dfb6471c360e1187e09b1fd154e08acd290497af30f919def3f548445c3  oracle.md
fc1e91a459a65965f2a48c66fa7fd12dc581057f6d53ec3e4fc9483a48adecf2  prompt.md
```

> **5 Pass; 1 Fail.** Grades use only the frozen packet. Missing compiler, runtime, silicon, and candidate-release evidence is not itself a failure.
> 
> | Case | Grade | Decisive answer evidence and oracle obligation |
> |---|---|---|
> | **Q-A15** | **Pass** | [Answer line 332](/work/answer.md:332): “pause only F-dependent work A/B,” requalify affected cases, and “Record C as `unaffected`.” The status table separates incorrect claims from unknown implementation/release facts; [line 334](/work/answer.md:334) records version/content lineage. Meets the [oracle’s targeted pause, point-release, regression, and impact-audit obligations](/work/oracle.md:8), without silently patching or restarting everything. |
> | **Q-C13** | **Fail** | [Answer line 13](/work/answer.md:13) correctly states that negative signed wide shifts “yield all ones”; neither arithmetic-shift disqualifier is demonstrated. However, [line 9](/work/answer.md:9) claims the analytical lowering is “`Verified complete`,” while [lines 57](/work/answer.md:57) and [96](/work/answer.md:96) select changed code shapes. The expected-result tables and candidate listings do not supply an independent equivalence proof connecting the changed sequences to those results across their stated input domains. This leaves the [oracle’s explicit independent behavior-proof obligation](/work/oracle.md:26) unmet. The failure is missing proof, not missing execution measurements. |
> | **Q-L03** | **Pass** | [Answer line 171](/work/answer.md:171): “equal addresses do not authorize commoning.” The [observable trace](/work/answer.md:173) preserves both reads and the first result’s lifetime; ownership and the [local remedy](/work/answer.md:194) are explicit. Meets the [count/order invariant and effect/lifetime evidence requirements](/work/oracle.md:35); MMIO is not treated as ordinary memory. |
> | **Q-L06** | **Pass** | [Answer line 206](/work/answer.md:206): live caller homes “interfere with `b`’s parameters, locals, temporaries, spills, and helper scratch.” [Line 208](/work/answer.md:208) permits sharing only for proved-dead slots, and [line 219](/work/answer.md:219) gives a focused interference/reallocation remedy. Meets the [simultaneous-lifetime invariant](/work/oracle.md:46), with responsibility, assumptions, and unknown allocation costs distinguished. |
> | **Q-R08** | **Pass** | [Answer line 243](/work/answer.md:243): “a direct rule has not been shown insufficient; only one consumer exists.” It identifies the [smallest reference set](/work/answer.md:230), states missing rewrite facts, and recommends implementation “locally in its accountable existing stage” at [line 245](/work/answer.md:245). Meets the [anti-overengineering and existing-seam obligations](/work/oracle.md:57); no unsupported framework is added. |
> | **Q-P10** | **Pass** | [Answer line 265](/work/answer.md:265) requires “temporary exclusive CIA1-port ownership.” The [access/effect accounting](/work/answer.md:289) preserves directions, restores entry latches, and specifies “no CIA2 access.” Machine bounds, costs, interference counterexamples, and [required independent checks](/work/answer.md:301) are explicit; VICE/silicon behavior remains Unknown. Meets the [port-ownership, CIA separation, and bounded proof/accounting obligations](/work/oracle.md:68), without clobbering video-bank bits. |

</details>


<details>
<summary>candidate-corpus-final: packet manifest and exact captured text</summary>

```text
8111b2ebc7584ee427a16951be0bfafce199ae6166094de8befa9f092848ce68  SKILL.md
e4a9f2e3a50b59f4824ba39443ce8ff846f52134f5effdc0424b763805b5df38  agents/openai.yaml
36229972f5e3f173efcff032790ff77f743eb9723606593aede1aec8ab10eba9  control.py
c34f02c6a13ac5bfbf9457b607b1810fbe0fcd56e8dd11367ab40b22d2ac25c7  invalid-source.blend
de2e7e8567efb9a0f10eff330465200badc4bec07457163f589d28d9a46f66ac  project-policy-excerpts.md
78ef48241052e29f9d3750ef3e2f5f8fa7041e2b5b1aa285ff6e8a9662fdf556  prompt.md
4f3ea96e261ba9cc8f62b16ab5a7ed7f616b4980b7fa6efff4624d336f9a95cd  references/6502-lowering-casebook.md
3dfda1f0ea2e33e1e8632f56fd08dbf02030300a5ad9f101c278539ebeda56a3  references/acme-and-artifacts.md
f4353dbb552e470084be965b963cb161ede43c0407fc6eaf344d3c096dea2437  references/blend65-semantics.md
d3bcc7a53424be398a7ef2e4c331ba403b7f02d648fd177904704ae1194dc112  references/c64-game-engineering.md
ab551b788474a4459a72a1ba8775436c6d75aeb86830162cf136097fc1dfa186  references/c64-hardware.md
199ca9b200158e532a21325ed2f1ffd9d84741aa929a6654f9d07350b167b16c  references/c64-memory-and-runtime.md
893c724b6ec7a84dfd66e7e73d8669783459b56472b2bb503788bc664d814e85  references/compiler-architecture.md
d25a45598a7669bf28ac0725c472760e3918cfb29151862d8beba9bb40a05b31  references/evidence-parity-and-recovery.md
7b38b1c9888df1aae0b1f63862c1f1824e1f905b4465a3ef1a24da8d95d40549  references/il-and-optimization.md
68838b0e38c60198c165160f2823759239ab27d233f72ed1dfc1e9e6b49716bf  references/mos-6502-family.md
4ee1b17f456e47d2bd2c854c343559a677c8ef367ccdaf8b9b33ddc7fb2f2ffb  references/sfa-and-abi.md
394f66e0c2521b1b0d880af150f5a73bcd24722d5d753c45d82baf02a5b8c12c  references/source-manifest.md
028efcd8220207b3d370cf09075ffa99074b53833d2388a83305d0c24775e5b8  references/target-portability.md
ab393b09a630b8b8db90c7fb5e273ff0bbef1e5299c2902affbf4a33d43a6b0a  spec/00-feature-index.md
74f1bb84818f11fddb0d4142af071c14e634f58e326a370f2ad92f2e14a03fa1  spec/00-introduction.md
f0e9de860cc820c950188cb2e2ab77c89e836168475921c4ba568c7c0068c6bb  spec/00-normative-inventory.md
4312fb663eeb3f26137aadcc8acbfa6ba586ef19996f54254409f8ead7982d1c  spec/01-lexical-structure.md
73f7deb046abcc2caa6bcced73bd62c741bb2c0e954b16cfb1633e3cbdab8651  spec/02-type-system.md
e8c017b9671b9cf1c8ac633cf4aee59fd1591df13ea94ddab323b7c42a11807d  spec/03-variables.md
1dcefd066aee1e9a35e255172a5c772a442092ff57e8ebf2076803934ff2d4e8  spec/04-expressions-operators.md
187ea573d6ddaf6a033321f9118835c2b3442118e1e363dcd68bc634f59b0ab2  spec/05-statements-control-flow.md
fa33c4a76fcb003d7682c00c86a64321ec7751410f334832b3fbc570612aa7b1  spec/06-functions.md
a3afc05f37ab7118ed365ae570ff98ca05ac2ca73120b5b48280b58b98f8cd45  spec/07-structs.md
500a6c18f84dc54a41fd7fe82b0fb5e0029bc1e050615ec9c929e148f76be515  spec/08-arrays-strings.md
e0772e924b761ed16e58b14f72906d4fa3014ed3bf2e9886fd01759a127192d6  spec/09-enums.md
a5ad0cc83e34867de7b1e1ada3d94efb1a136230cf199578c7a0d7a283a57383  spec/10-modules.md
0097af18c1763ea50450eb0476afb2ee4d2c309afe7bb9c4fd476917ec926925  spec/11-memory-model.md
925c7eb49fd32093e2de791a8f4c8887e2797d2956429cf5974aca985933936c  spec/12-intrinsics.md
29a16540be2a29cc4d4e5ba3bed0e407b9644dd25d4acc803666cf3df71079e7  spec/13-data-inclusion.md
4c414a44de2106540eae29d89e370e412e93f40ee848fd72193cb9b750a7fef2  spec/14-diagnostics.md
9ed9c41cf7ed22cfc4d557951e5e0f3f9c0fcba7e4d4a2ff63cc35694234ba73  spec/15-platform-profile.md
70e822e3ec88506fd694303d98f37b8eacc0bf6cb4febb5fe7fea5d4f0fe25f2  spec/appendix-c64.md
cd79fa582b71c3126916f455f6d623c3c1a8fd35b064cae22ee4a311261a19df  spec/evaluations/F001-multi-file.md
d522d443a3f946ac6d0201ada84d45e321c35094e951bd3ecb1d616bd9f1d98a  spec/evaluations/F002-modules.md
9673502debd656fe4733a160454d1d86ed6adcbf70fb7bc68325f67d49385920  spec/evaluations/F003-module-contents.md
dd7ef96a96873a1ff1ff1a9c3bf97ea07ece0717051ff485432b6a951abb8162  spec/evaluations/F004-entry-point.md
add33b6dd89783250bd495247264966aadee57d4dec3dc44a1698fdbe1442aa3  spec/evaluations/F005-memory-placement.md
13e3f8af5bc2d698a70827b111fab22c8aeaf6ed2f310031d6b8c61a83423760  spec/evaluations/F006-address-of.md
83b7baac19b72e8eeced5b156cd2ce79a56bfc1391739283e11009787669d95b  spec/evaluations/F007-interrupt-functions.md
bb503f0aa1aff317c71cb8a61c5e071b9f3c8bbeea1476438306f3b82c60dc04  spec/evaluations/F008-for-loop.md
2d5116b586c2abe6bb4ee43a2372f974dc90e719177443bfe714c53c542d72ce  spec/evaluations/F009-switch-statement.md
9013ae2793ba44f96c13e9fdb567b324e6bd5a8f331af9083605eff12fe2f359  spec/evaluations/F010-signed-types.md
4118af9de2c2b34022a883cddc5762e87bd164cda03ed38f47fe4f77577db026  spec/evaluations/F011-structs.md
c06a710a4dca63f35d91af4850f2ba1aa6e94c06e1bd89bc81b0d5720c96fc5c  spec/evaluations/F012-cpu-control-intrinsics.md
1a36d5db689bb97d84b93318e604a7da31a36c38dc057993c3192c0907731faa  spec/evaluations/F013-control-flow.md
938d3adb011bb60eac49dcfe160c65c48b2279aa610a1bb2c82cb3171c53ba2f  spec/evaluations/F014-arrays.md
cc383e7d7258c1cb7eecd8a51bffa360098fda5ddfbb2a8752061a5e647a942f  spec/evaluations/F015-data-inclusion.md
0ccfec6274dadc849eb93a3440bb090f9b24f77119f7b297fa5217f827608f4e  spec/evaluations/F016-type-system.md
ecf5e10be85f9610c20d400aac6dbda2cc8dea0a1edbbccfce2b87a32e7ff44d  spec/evaluations/F017-operators.md
02a7600cf86659a1713d83891c4bbe08806b9c7a9c1686da2642c379c6ff2a42  spec/evaluations/F018-functions.md
15628edf3f35fb2252f20ad938b16b8b6006f32d196ffe0d8ffa8e496f3fa017  spec/evaluations/F019-variables.md
3a6d7e2e07dedfed392dc407e1cb598042f5aad270152740f99ae056e492b945  spec/evaluations/F020-memory-intrinsics.md
a77babccebc4b20ee55f062ace152674a46860ebb53fdec9fd2408b85eea441a  spec/evaluations/F021-lexical-structure.md
0d12f268294ce67560417599b4e2a88b69f743f7d4f00aaed9e412f4c5719e6f  spec/evaluations/F022-enums.md
66dc1c0ad8222f09871b3550ae032a0d0cfcecb7cf338174e85af29bdbd2d303  spec/evaluations/F024-conditional-operator.md
f14a19ee370fbfe6de5c3a4b0c599d1a5cf4359863a2110efe2c1d3b303e2f4d  spec/evaluations/F025-comptime-functions.md
e38910dbf5e9a710b8171081c1698730bfd835df058b6267d5b2edf54d0dbcea  spec/future-considerations.md
8d4533443a31067627f790540c5e1c3900a57cff52ea2b751908b4917e3fed94  spec/grammar.ebnf.md
```

> # Independent authority evaluation
> 
> Packet lineage: `skillVersion=2.0.1`; specification identity `BLEND65-SPEC-4-1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf`; source-manifest key `BLEND65-SPEC-4-1c2a2d75`.
> 
> The 18 normative files reproduce the stated digest exactly. The live `spec/**/*.md` set and the candidate crosswalk each contain the same 45 unique paths, with no omissions or duplicates.
> 
> The release content commit and activation status are `Unknown`: `qualification/release.md` was intentionally omitted, so I have not invented a commit or treated the skill candidate as an activated release.
> 
> ## Q-L01
> 
> ### Language ruling
> 
> - Status: `Verified complete`
> - Claim kind: `Fact`
> 
> Both conversions are valid because they are explicitly enumerated exceptions to the general explicitness principle:
> 
> - `byte + word` is legal. TS-4 requires zero-extension of the `byte`, and the result type is `word` ([02-type-system.md:161](/work/spec/02-type-system.md:161)). The same rule covers the reverse operand order and signed `sbyte`/`sword` widening.
> - Enum-to-`byte` is legal. TS-14 and EN-9 explicitly permit it for assignment, byte parameters, `poke`, arithmetic, and comparisons ([02-type-system.md:413](/work/spec/02-type-system.md:413), [09-enums.md:185](/work/spec/09-enums.md:185)).
> - A4 is not contradicted. It requires explicit annotations, casts for cross-signedness, and casts for narrowing ([00-introduction.md:100](/work/spec/00-introduction.md:100)); it does not cancel conversions explicitly authorized by later governing rules.
> 
> Boundaries:
> 
> - Mixed signedness remains invalid without an explicit cast.
> - `byte`/`word` narrowing remains explicit.
> - `byte` to enum remains explicit and is not member-range checked.
> - Enum-to-`word` or enum-to-`sword` is not an implicit chain; an explicit wider conversion is required.
> - Enum-to-byte has no conversion instructions or additional storage, but enum nominal identity must survive semantic checking before being lowered to its byte representation.
> 
> ### Crosswalk inventory audit
> 
> Branch key:
> 
> - `SEM`: `blend65-semantics`
> - `ARCH`: `compiler-architecture`
> - `SFA`: `sfa-and-abi`
> - `IL`: `il-and-optimization`
> - `CPU` / `LOW`: `mos-6502-family` / `6502-lowering-casebook`
> - `C64M` / `C64H`: C64 memory/runtime / hardware
> - `GAME`: C64 game engineering
> - `ART`: ACME and artifacts
> - `PORT`: target portability
> 
> #### Governing and support paths
> 
> | Evidence and authority role | Substantive payload | Compiler/storage/effect consequence and boundary | Correct branch; inapplicable facet |
> |---|---|---|---|
> | [00-feature-index.md](/work/spec/00-feature-index.md:1) — non-normative navigation | Routes features to owners; records F023 retirement | Navigation must defer to chapters and Chapter 14; cannot define semantics or diagnostics | `SEM`; independent authority N/A |
> | [00-introduction.md §Design Axioms](/work/spec/00-introduction.md:46) — normative | Modern C-like source, SFA, defined behavior, explicitness, target-neutral core | Preserve deterministic behavior; do not turn compiler limitations into language restrictions | `SEM`, `ARCH`, `SFA`; none |
> | [00-normative-inventory.md §Authority Rule](/work/spec/00-normative-inventory.md:7) — non-normative identity owner | Exact membership and digest procedure | Establishes authority identity but cannot itself define language behavior | `SEM` authority, source manifest; direct compiler semantics N/A |
> | [01-lexical-structure.md §Tokenization Rules](/work/spec/01-lexical-structure.md:558) — normative | UTF-8, maximal munch, exact token spans, closed escapes | Lexer retains token value/spelling/span and recovers without target mapping | `ARCH` frontend; target byte mapping N/A at lexing |
> | [02-type-system.md §Expression Type Rules](/work/spec/02-type-system.md:142) — normative | Width, signedness, promotions, casts, constants, wrapping | Preserve type/conversion kind through legalization; reject mixed signedness/narrowing | `IL` mandatory payload; none |
> | [03-variables.md §Memory Placement](/work/spec/03-variables.md:215) — normative | Mutable, constant, loadable, ZP, initialization and `place(...)` classes | Separate compile-time/package-only/function/global storage and startup effects | `SFA` storage ownership; none |
> | [04-expressions-operators.md §Evaluation Order](/work/spec/04-expressions-operators.md:42) — normative | Left-to-right effects, short circuit, places, addresses and memory operations | Explicit CFG/effects; provenance extends local liveness; no eager RHS evaluation | `IL`, `SFA` lifetime; none |
> | [05-statements-control-flow.md §For Loop](/work/spec/05-statements-control-flow.md:217) — normative | Three-clause loops, Boolean conditions, switch and exits | `continue` reaches update; `break`/`return` skip it; local loadables remain package-only | `IL` control flow; none |
> | [06-functions.md §SFA Calling Convention](/work/spec/06-functions.md:414) — normative | Calls, finite function targets, caller-owned aggregate returns and SFA | Close parameters, temporaries, destinations, helpers and overlapping domain homes before emission | `SFA`, `IL`; `C64M+C64H` also required for its C64 interrupt routes |
> | [07-structs.md §Struct Rules](/work/spec/07-structs.md:85) — normative | Ordered contiguous layout, by-reference parameters, value assignment/returns | Preserve alias identity, offsets, caller destinations and copy effects | `SFA` aggregates, `IL` memory; none |
> | [08-arrays-strings.md §Array Rules](/work/spec/08-arrays-strings.md:80) — normative | Fixed shapes, ordinal promotion, any-size parameter form, encoding and bounds | Preserve extent/scaling/count provenance; default unchecked access wraps the effective address | `IL` memory effects; none |
> | [09-enums.md §EN-9](/work/spec/09-enums.md:185) — normative | Nominal byte-backed enums and asymmetric conversion | Retain nominal identity until conversion is validated; then byte lowering is free | `IL` legalization; none |
> | [10-modules.md §Entry Point](/work/spec/10-modules.md:154) — normative | Modules, visibility, one `main`, dependency/effect-ordered startup | Build the complete symbol/root/initializer graph and deterministic startup order | `ARCH` frontend, `SFA` roots; none |
> | [11-memory-model.md §Static Frame Allocation](/work/spec/11-memory-model.md:106) — normative | Segments, SFA coloring, aggregate destinations, ZP and stack budgets | Keep function storage separate from global/asset layout; prove final resource peaks | `SFA`; none |
> | [12-intrinsics.md §CPU Control Intrinsics](/work/spec/12-intrinsics.md:25) — normative | Exactly five CPU controls, BCD and volatile memory/query operations | Model flags, stack kinds, decimal ownership and access count/order | `IL` machine effects, `CPU`; none |
> | [13-data-inclusion.md §EMB-5](/work/spec/13-data-inclusion.md:116) — normative | Raw and profile-selected embeds, exact handler versions/selectors, resident/loadable ownership | Keep bytes symbolic; no hidden copy/runtime; HLE-010 permits only trusted direct D64 loading | `GAME`, `C64M`, `ART`; final residency N/A until layout |
> | [14-diagnostics.md §Authority and Ownership](/work/spec/14-diagnostics.md:10) — normative registry | 184 unique public codes, poison, cascade suppression and artifact prohibition | Owning stage emits one root; poisoned constructs cannot lower, allocate or emit | `SEM` diagnostics, `ARCH`; none |
> | [15-platform-profile.md §Qualified Target Profiles](/work/spec/15-platform-profile.md:22) — normative contract | Exactly nine indivisible C64 profiles | Reject partial/mixed/unknown IDs with E10279 before lowering | `ARCH` target composition; none |
> | [appendix-c64.md §Qualified Profile Set](/work/spec/appendix-c64.md:10) — normative platform authority | 6510/C64 map, IRQ ABI, assets, PRG/D64, encodings and ACME 0.97 | Platform layout/entry/packaging own banking, device visibility and artifact behavior | `C64H`, `C64M`, `GAME`, `ART`; none |
> | [future-considerations.md §Deferred Items](/work/spec/future-considerations.md:34) — non-normative register | 11 resolved and 8 open `FUT` entries, plus two rejected features and their reconsideration bars | Deferred/rejected items cannot become current behavior; future-machine facts remain constraint-only | `SEM` authority **plus `PORT`**; current semantics N/A |
> | [grammar.ebnf.md §Expressions](/work/spec/grammar.ebnf.md:306) — normative grammar | Complete syntax; precedence delegated to Chapter 04 | Parser acceptance must agree with grammar and owning chapters; mismatch would be a blocked conflict | `ARCH` frontend; none |
> 
> #### Evaluation paths
> 
> All are non-normative rationale. They can explain intent or evidence but cannot override the corresponding normative owner.
> 
> | Evidence | Substantive payload | Compiler/storage/effect consequence and boundary | Correct branch; inapplicable facet |
> |---|---|---|---|
> | [F001 §Rules](/work/spec/evaluations/F001-multi-file.md:11) | Supplied files form one binary; paths have no semantic meaning | Resolve cross-file references through modules | `ARCH`; discovery, file mapping, duplicate-module policy and diagnostic stability are explicitly N/A |
> | [F002 §Rules](/work/spec/evaluations/F002-modules.md:19) | Module declaration and naming intent | Preserve module identity and spans through resolution | `ARCH`; none |
> | [F003 §Initialization](/work/spec/evaluations/F003-module-contents.md:42) | Allowed contents, visibility and initializers | Retain declaration class and initializer dependencies/effects | `SFA` roots, `ARCH`; none |
> | [F004 §Rules](/work/spec/evaluations/F004-entry-point.md:11) | Unique `main(): void` | Establish the program root; invalid entry suppresses the artifact | `SFA` roots, `ARCH`; none |
> | [F005 §place](/work/spec/evaluations/F005-memory-placement.md:27) | Closed placement constraints and ZP | Carry symbolic region/alignment requirements and diagnose budget conflicts | `SFA`; add `C64M` for concrete C64 placement |
> | [F006 §Rules](/work/spec/evaluations/F006-address-of.md:29) | Addressable places and lifetime restrictions | Preserve identity, address-taken state, provenance and relocation | `SFA` lifetime/escape; none |
> | [F007 §Generated Entry Variants](/work/spec/evaluations/F007-interrupt-functions.md:47) | Callback-only handlers, CINV/raw variants and acknowledgement ownership | Allocate disjoint domain homes; preserve D/status/tails and device acknowledgement | `SFA` **plus `C64M+C64H` for the C64 routes**; none |
> | [F008 §Exact Evaluation](/work/spec/evaluations/F008-for-loop.md:60) | Familiar loop clauses, mutation, exits and wrap | Always provide correct generic CFG; specialize induction only with proof | `IL`; none |
> | [F009 §Auto-Break](/work/spec/evaluations/F009-switch-statement.md:40) | Auto-break, explicit fallthrough and lowering alternatives | Preserve case order/type/fallthrough and select equivalent CFG | `IL`; `LOW+CPU` if validating displayed assembly/cost |
> | [F010 §Rules](/work/spec/evaluations/F010-signed-types.md:90) | Signed ranges, widening, comparisons and shifts | Preserve signedness/width through selection | `IL`; `LOW+CPU` for its codegen claims |
> | [F011 §Rules](/work/spec/evaluations/F011-structs.md:147) | Layout, by-reference calls, returns and arrays of structs | Preserve offsets, alias-visible order and caller-owned results | `SFA`, `IL`; `LOW+CPU` for access-cost claims |
> | [F012 §Exact Machine Effects](/work/spec/evaluations/F012-cpu-control-intrinsics.md:48) | Exact five controls and status/interrupt effects | Keep ordered machine-state barriers and stack kinds | `IL` machine effects **plus `CPU`**; none |
> | [F013 §Rules](/work/spec/evaluations/F013-control-flow.md:103) | Boolean conditions, scope, definite assignment and returns | Construct CFG/scope/recovery state at the frontend | `IL` control flow; none |
> | [F014 §Index Context](/work/spec/evaluations/F014-arrays.md:148) | Fixed arrays, encoding, const parameters and ordinal promotion | Retain extent, address scaling, alias/const and encoding identity | `IL` memory; `LOW+CPU` for displayed code/cost |
> | [F015 §Format Handlers](/work/spec/evaluations/F015-data-inclusion.md:140) | Handler identity, selectors, versions, placement and SID compatibility | Keep imports/relocations symbolic and fail closed on unqualified formats | `GAME`, `C64M`, `ART`; final residency N/A without a map |
> | [F016 §Expression Types](/work/spec/evaluations/F016-type-system.md:134) | Type table, promotion, casts and intermediate width | One semantic evaluator must preserve context-specific constant/runtime rules | `IL`; none |
> | [F017 §Short Circuit](/work/spec/evaluations/F017-operators.md:163) | Operators, short circuit, shifts and arithmetic tiers | Preserve effects/width/signedness; choose lowering after semantic validation | `IL`; `LOW+CPU` for its assembly/cost claims |
> | [F018 §SFA Convention](/work/spec/evaluations/F018-functions.md:373) | Calls, recursion rejection, frames and per-instance costs | Stage arguments left-to-right and charge every overlapping activation | `SFA`; `LOW+CPU` for emitted call sequences |
> | [F019 §Indeterminate Variables](/work/spec/evaluations/F019-variables.md:211) | Initialization, startup, warnings and package-only loadables | Track lifetime/class and definite assignment; loadables get no runtime home | `SFA`; none |
> | [F020 §Memory Access](/work/spec/evaluations/F020-memory-intrinsics.md:32) | Volatile variable-address access, byte order and queries | Preserve exact access count/order; dynamic-address scratch closes through SFA | `IL`; `LOW+CPU` for selected sequences/cost |
> | [F021 §Lexer Summary](/work/spec/evaluations/F021-lexical-structure.md:594) | Token inventory, maximal munch and positions | Deterministic tokens and recoverable spans; mapping remains semantic | `ARCH`; target encoding N/A at lexing |
> | [F022 §Nominal Typing](/work/spec/evaluations/F022-enums.md:144) | Nominal enum identity and asymmetric conversion | Validate enum distinctions before free byte lowering | `IL` legalization; none |
> | [F024 §Semantics](/work/spec/evaluations/F024-conditional-operator.md:65) | Boolean condition, selected arm only and type unification | Explicit branch/merge; unselected arm has no effects | `IL` control flow; none |
> | [F025 §Budgets](/work/spec/evaluations/F025-comptime-functions.md:115) | Deterministic compile-time functions and three fixed budgets | Evaluate target-free; budget failure poisons the root and emits no partial artifact | `SEM`, `IL`; runtime/SFA code N/A after successful folding |
> 
> ### Crosswalk findings
> 
> - Semantic contradictions: none found in the inspected governing payloads.
> - Missing or duplicate paths: none; live set = crosswalk set = 45, and every row is unique.
> - Duplicated authority: none. The inventory/index/future register and all F-evaluations remain expressly non-normative. Chapter 14 remains the sole public diagnostic registry.
> - Shallow routing:
>   - The candidate `06-functions` and F007 rows need `C64M` and `C64H` when their CINV/raw C64 route claims are assessed.
>   - `12-intrinsics` and F012 require the CPU branch for exact status/instruction claims.
>   - `future-considerations` requires `PORT`, not only the semantic-authority branch.
>   - Displayed assembly/cycle claims in the evaluations require `LOW+CPU`; their semantic branches alone do not verify those machine totals.
> - Unsupported packet link: [00-feature-index.md:76](/work/spec/00-feature-index.md:76) links to `../.clinerules/language-guard.md`, which is absent from this packet. This is a navigation-evidence gap, not a missing `spec/**/*.md` path or a semantic conflict.
> - Release consistency: `Unknown`, because the release record and content commit are absent.
> 
> ### Mandatory closure checks
> 
> - All FUT entries inspected: resolved `001–005`, `008–010`, `013–014`, `019`; open `006`, `007`, `011`, `012`, `015–018`; rejected `REJ-001` and `REJ-002`. Each has a reason and, where applicable, a reconsideration bar.
> - Warning scopes preserved: W10190 is function-local maybe-read-before-first-assignment only; W10141 independently covers every nonzero uninitialized mutable array, including module arrays.
> - SFA costs are per allocated activation. Overlapping domains require distinct homes; optional stack-free return pairs are also per activation/entry variant. No-recursion alone does not prove one home.
> - Aggregate-parameter field/element addresses are directly addressable and inherit the caller object’s lifetime and mutability ([04-expressions-operators.md:373](/work/spec/04-expressions-operators.md:373)).
> - HLE-001 through HLE-010 were individually traced: recursion, runtime division zero, unchecked indexing, interrupt/SFA domains, indeterminate storage, runtime-invalid BCD, local-address lifetime, fixed arrays/no views, 16-bit object limits, and trusted-media-only KERNAL loading.
> - F001 remains limited to supplied source files, one output binary, path-name irrelevance and module-based references; it does not define input discovery or file/module mapping.
> - All nine exact C64 IDs are present; partial or mixed identities are E10279.
> - C64 unchecked indexing defaults to modulo-65536 effective addresses, byte-by-byte `$FFFF`→`$0000` continuation under the active map; `--bounds-check` is independent and off by default.
> - ACME 0.97 has two distinct authorities: Appendix A selects it for the C64 target; [project-policy-excerpts.md:7](/work/project-policy-excerpts.md:7) separately makes it the repository’s terminal assembler. The “meet requires a GitHub debt issue” rule is project/workflow policy, not language semantics. No issue, commit or push was warranted by this read-only evaluation.
> 
> Crosswalk content status: `Verified partial`. Its path coverage and selected semantic summaries verify, but the routing additions and missing release lineage prevent a complete result.
> 
> ## Q-L24
> 
> ### Required behavior
> 
> - Status: `Verified complete`
> - Claim kind: `Fact`
> 
> At [invalid-source.blend:4](/work/invalid-source.blend:4), `1` has default type `byte`, while `true` has type `boolean` ([02-type-system.md:109](/work/spec/02-type-system.md:109)). `&&` requires two Boolean operands ([04-expressions-operators.md:258](/work/spec/04-expressions-operators.md:258)).
> 
> The required root error is therefore:
> 
> ```text
> error[E10280]: Logical operator '&&' requires Boolean operands — found 'byte'
> ```
> 
> The primary span covers the literal `1`. The right operand is valid, so it receives no E10280. The poisoned `&&` expression must not cause a secondary assignment-type or lowering diagnostic. E10280’s per-operand span rule is explicit at [14-diagnostics.md:251](/work/spec/14-diagnostics.md:251).
> 
> Under default unsuppressed warnings, W10191 also independently applies because `bad` is never used. It is not a second root error. Its observed suppression or promotion is `Unknown` because no diagnostic flags were supplied.
> 
> ### Responsible compiler boundary and effects
> 
> 1. Lexing and parsing accept the syntax and preserve the relevant spans.
> 2. Semantic/type analysis owns E10280 and poisons the logical expression.
> 3. Later semantic recovery may continue only to find independent diagnostics.
> 4. The poisoned declaration must not enter CFG lowering, optimization, SFA allocation, instruction selection or emission.
> 5. The compilation driver must suppress every usable artifact: assembly, object code, serialized IL, maps, symbols, executable and package output ([14-diagnostics.md:54](/work/spec/14-diagnostics.md:54)).
> 
> Consequently:
> 
> - No operand is evaluated at runtime.
> - Short-circuit control flow is never generated.
> - No store initializes `bad`.
> - No SFA home, temporary, spill, stack byte or helper scratch may be allocated for the rejected construct.
> - There are no runtime memory/MMIO effects, target bytes or cycles to measure.
> - CPU variant, machine profile, banking and assembler are immaterial because failure occurs before target lowering.
> 
> ### Remedy
> 
> The supplied required behavior—one E10280 root and no artifact—is correct, so no remedy is needed.
> 
> If a compiler instead accepts the source, inserts integer truthiness, emits cascade errors, allocates the rejected local, or produces an artifact, the smallest compiler remedy is:
> 
> - enforce Boolean operands in semantic analysis;
> - emit E10280 at each non-Boolean operand and poison the expression;
> - suppress poison-dependent diagnostics and all downstream lowering/allocation; and
> - retain the driver’s unconditional no-artifact-on-error gate.
> 
> The smallest source correction, if Boolean `true` was intended, is `let bad: boolean = true && true;`; there is no legal integer-to-Boolean cast.
> 
> Current compiler conformance remains `Unknown`: no compiler execution, diagnostics transcript, assembly or artifact was supplied.

</details>


<details>
<summary>candidate-corpus-final-grade: packet manifest and exact captured text</summary>

```text
3c80a1689c33707bfc43e6925b3d68bfc494e0f8d6907a377ea9d4e06c0eeec2  answer.md
e1a14afa11ff99d9c271e2c3352bf943d368c2d5b3624399a9942a84f8bc7e91  control.py
7f1590cb5763269bd0c45b6e44b454127f1de6a8bf2dbeb73ed300faab16fad9  oracle.md
fc1e91a459a65965f2a48c66fa7fd12dc581057f6d53ec3e4fc9483a48adecf2  prompt.md
```

> **Q-L01 — Fail.** The required migration/HLE disclosure evidence is incomplete.
> 
> - [Answer line 120](/work/answer.md:120) claims “HLE-001 through HLE-010 were individually traced,” but supplies topic labels such as “runtime division zero,” “runtime-invalid BCD,” and “local-address lifetime.” It does not present the migration disclosures or their governing locations and applicable effect/lifetime boundaries.
> - The concrete C64 indexing disclosure at [line 123](/work/answer.md:123) provides useful partial coverage. It does not complete the obligation in [oracle lines 39–49](/work/oracle.md:39), which requires migration/C64 HLE disclosures and exact governing evidence with applicable traces.
> - Credit is due for the conversion ruling, 45-path audit, warning scopes, per-activation SFA costs, and ACME authority distinction. In particular, [line 124](/work/answer.md:124) correctly separates the appendix’s toolchain selection from repository policy. The failure is missing required disclosure evidence, not ACME provenance.
> - “Missing release lineage” at [line 126](/work/answer.md:126) is excluded from this grading by [prompt line 8](/work/prompt.md:8).
> 
> **Q-L24 — Pass.** The answer satisfies the required diagnostic, recovery, and artifact-suppression obligations in [oracle lines 60–62](/work/oracle.md:60).
> 
> - [Line 140](/work/answer.md:140) specifies `error[E10280]: Logical operator '&&' requires Boolean operands — found 'byte'`. [Line 143](/work/answer.md:143) identifies the offending operand’s span and prohibits poison-dependent cascades.
> - [Lines 150–153](/work/answer.md:150) assign responsibility to semantic analysis and the compilation driver, including suppression of downstream allocation and all compilation artifacts.
> - [Line 160](/work/answer.md:160) states: “No SFA home, temporary, spill, stack byte or helper scratch may be allocated for the rejected construct.” The remedy is separately stated at [line 168](/work/answer.md:168).
> - [Line 177](/work/answer.md:177) appropriately leaves current compiler conformance **Unknown**. The stated effects are required consequences of rejection, not measured execution results.

</details>


<details>
<summary>candidate-ql01-final: packet manifest and exact captured text</summary>

```text
8111b2ebc7584ee427a16951be0bfafce199ae6166094de8befa9f092848ce68  SKILL.md
e4a9f2e3a50b59f4824ba39443ce8ff846f52134f5effdc0424b763805b5df38  agents/openai.yaml
36229972f5e3f173efcff032790ff77f743eb9723606593aede1aec8ab10eba9  control.py
c34f02c6a13ac5bfbf9457b607b1810fbe0fcd56e8dd11367ab40b22d2ac25c7  invalid-source.blend
de2e7e8567efb9a0f10eff330465200badc4bec07457163f589d28d9a46f66ac  project-policy-excerpts.md
699015c50a8d4421fe2c60e6d42d7e277570dd51a5b90b5521fb38c2b10fcd32  prompt.md
4f3ea96e261ba9cc8f62b16ab5a7ed7f616b4980b7fa6efff4624d336f9a95cd  references/6502-lowering-casebook.md
3dfda1f0ea2e33e1e8632f56fd08dbf02030300a5ad9f101c278539ebeda56a3  references/acme-and-artifacts.md
f4353dbb552e470084be965b963cb161ede43c0407fc6eaf344d3c096dea2437  references/blend65-semantics.md
d3bcc7a53424be398a7ef2e4c331ba403b7f02d648fd177904704ae1194dc112  references/c64-game-engineering.md
ab551b788474a4459a72a1ba8775436c6d75aeb86830162cf136097fc1dfa186  references/c64-hardware.md
199ca9b200158e532a21325ed2f1ffd9d84741aa929a6654f9d07350b167b16c  references/c64-memory-and-runtime.md
893c724b6ec7a84dfd66e7e73d8669783459b56472b2bb503788bc664d814e85  references/compiler-architecture.md
d25a45598a7669bf28ac0725c472760e3918cfb29151862d8beba9bb40a05b31  references/evidence-parity-and-recovery.md
7b38b1c9888df1aae0b1f63862c1f1824e1f905b4465a3ef1a24da8d95d40549  references/il-and-optimization.md
68838b0e38c60198c165160f2823759239ab27d233f72ed1dfc1e9e6b49716bf  references/mos-6502-family.md
4ee1b17f456e47d2bd2c854c343559a677c8ef367ccdaf8b9b33ddc7fb2f2ffb  references/sfa-and-abi.md
4bca2b8bd8d3e0e0d115c291d11797ef12ecd3b2c0bc4316f3a518c951788392  references/source-manifest.md
028efcd8220207b3d370cf09075ffa99074b53833d2388a83305d0c24775e5b8  references/target-portability.md
ab393b09a630b8b8db90c7fb5e273ff0bbef1e5299c2902affbf4a33d43a6b0a  spec/00-feature-index.md
74f1bb84818f11fddb0d4142af071c14e634f58e326a370f2ad92f2e14a03fa1  spec/00-introduction.md
f0e9de860cc820c950188cb2e2ab77c89e836168475921c4ba568c7c0068c6bb  spec/00-normative-inventory.md
4312fb663eeb3f26137aadcc8acbfa6ba586ef19996f54254409f8ead7982d1c  spec/01-lexical-structure.md
73f7deb046abcc2caa6bcced73bd62c741bb2c0e954b16cfb1633e3cbdab8651  spec/02-type-system.md
e8c017b9671b9cf1c8ac633cf4aee59fd1591df13ea94ddab323b7c42a11807d  spec/03-variables.md
1dcefd066aee1e9a35e255172a5c772a442092ff57e8ebf2076803934ff2d4e8  spec/04-expressions-operators.md
187ea573d6ddaf6a033321f9118835c2b3442118e1e363dcd68bc634f59b0ab2  spec/05-statements-control-flow.md
fa33c4a76fcb003d7682c00c86a64321ec7751410f334832b3fbc570612aa7b1  spec/06-functions.md
a3afc05f37ab7118ed365ae570ff98ca05ac2ca73120b5b48280b58b98f8cd45  spec/07-structs.md
500a6c18f84dc54a41fd7fe82b0fb5e0029bc1e050615ec9c929e148f76be515  spec/08-arrays-strings.md
e0772e924b761ed16e58b14f72906d4fa3014ed3bf2e9886fd01759a127192d6  spec/09-enums.md
a5ad0cc83e34867de7b1e1ada3d94efb1a136230cf199578c7a0d7a283a57383  spec/10-modules.md
0097af18c1763ea50450eb0476afb2ee4d2c309afe7bb9c4fd476917ec926925  spec/11-memory-model.md
925c7eb49fd32093e2de791a8f4c8887e2797d2956429cf5974aca985933936c  spec/12-intrinsics.md
29a16540be2a29cc4d4e5ba3bed0e407b9644dd25d4acc803666cf3df71079e7  spec/13-data-inclusion.md
4c414a44de2106540eae29d89e370e412e93f40ee848fd72193cb9b750a7fef2  spec/14-diagnostics.md
9ed9c41cf7ed22cfc4d557951e5e0f3f9c0fcba7e4d4a2ff63cc35694234ba73  spec/15-platform-profile.md
70e822e3ec88506fd694303d98f37b8eacc0bf6cb4febb5fe7fea5d4f0fe25f2  spec/appendix-c64.md
cd79fa582b71c3126916f455f6d623c3c1a8fd35b064cae22ee4a311261a19df  spec/evaluations/F001-multi-file.md
d522d443a3f946ac6d0201ada84d45e321c35094e951bd3ecb1d616bd9f1d98a  spec/evaluations/F002-modules.md
9673502debd656fe4733a160454d1d86ed6adcbf70fb7bc68325f67d49385920  spec/evaluations/F003-module-contents.md
dd7ef96a96873a1ff1ff1a9c3bf97ea07ece0717051ff485432b6a951abb8162  spec/evaluations/F004-entry-point.md
add33b6dd89783250bd495247264966aadee57d4dec3dc44a1698fdbe1442aa3  spec/evaluations/F005-memory-placement.md
13e3f8af5bc2d698a70827b111fab22c8aeaf6ed2f310031d6b8c61a83423760  spec/evaluations/F006-address-of.md
83b7baac19b72e8eeced5b156cd2ce79a56bfc1391739283e11009787669d95b  spec/evaluations/F007-interrupt-functions.md
bb503f0aa1aff317c71cb8a61c5e071b9f3c8bbeea1476438306f3b82c60dc04  spec/evaluations/F008-for-loop.md
2d5116b586c2abe6bb4ee43a2372f974dc90e719177443bfe714c53c542d72ce  spec/evaluations/F009-switch-statement.md
9013ae2793ba44f96c13e9fdb567b324e6bd5a8f331af9083605eff12fe2f359  spec/evaluations/F010-signed-types.md
4118af9de2c2b34022a883cddc5762e87bd164cda03ed38f47fe4f77577db026  spec/evaluations/F011-structs.md
c06a710a4dca63f35d91af4850f2ba1aa6e94c06e1bd89bc81b0d5720c96fc5c  spec/evaluations/F012-cpu-control-intrinsics.md
1a36d5db689bb97d84b93318e604a7da31a36c38dc057993c3192c0907731faa  spec/evaluations/F013-control-flow.md
938d3adb011bb60eac49dcfe160c65c48b2279aa610a1bb2c82cb3171c53ba2f  spec/evaluations/F014-arrays.md
cc383e7d7258c1cb7eecd8a51bffa360098fda5ddfbb2a8752061a5e647a942f  spec/evaluations/F015-data-inclusion.md
0ccfec6274dadc849eb93a3440bb090f9b24f77119f7b297fa5217f827608f4e  spec/evaluations/F016-type-system.md
ecf5e10be85f9610c20d400aac6dbda2cc8dea0a1edbbccfce2b87a32e7ff44d  spec/evaluations/F017-operators.md
02a7600cf86659a1713d83891c4bbe08806b9c7a9c1686da2642c379c6ff2a42  spec/evaluations/F018-functions.md
15628edf3f35fb2252f20ad938b16b8b6006f32d196ffe0d8ffa8e496f3fa017  spec/evaluations/F019-variables.md
3a6d7e2e07dedfed392dc407e1cb598042f5aad270152740f99ae056e492b945  spec/evaluations/F020-memory-intrinsics.md
a77babccebc4b20ee55f062ace152674a46860ebb53fdec9fd2408b85eea441a  spec/evaluations/F021-lexical-structure.md
0d12f268294ce67560417599b4e2a88b69f743f7d4f00aaed9e412f4c5719e6f  spec/evaluations/F022-enums.md
66dc1c0ad8222f09871b3550ae032a0d0cfcecb7cf338174e85af29bdbd2d303  spec/evaluations/F024-conditional-operator.md
f14a19ee370fbfe6de5c3a4b0c599d1a5cf4359863a2110efe2c1d3b303e2f4d  spec/evaluations/F025-comptime-functions.md
e38910dbf5e9a710b8171081c1698730bfd835df058b6267d5b2edf54d0dbcea  spec/future-considerations.md
8d4533443a31067627f790540c5e1c3900a57cff52ea2b751908b4917e3fed94  spec/grammar.ebnf.md
```

> # Independent authority evaluation — Q-L01
> 
> ## Result
> 
> `byte + word` and enum-to-byte use are valid implicit conversions because the specification explicitly enumerates both.
> 
> - [A4](/work/spec/00-introduction.md:100) requires explicit annotations, explicit cross-signedness conversions, and explicit narrowing. It does not prohibit specified value-preserving widening.
> - [TS-4](/work/spec/02-type-system.md:161) makes `byte + word` legal: `byte` is zero-extended to `word`, and the result is `word`. Assigning that result back to `byte` still requires an explicit cast.
> - [TS-14](/work/spec/02-type-system.md:413) and [EN-9](/work/spec/09-enums.md:185) make enum→`byte` legal for assignment, byte arguments, `poke`, arithmetic, and comparison.
> - Enum→`byte` is the only implicit enum conversion. Enum→`word` is not an implicit two-step conversion; use `word(enumValue)`.
> - Mixed signedness remains invalid without a cast under TS-5.
> 
> Status: **Verified complete**  
> Claim kind: **Fact**
> 
> ## Authority and identity
> 
> - The live inventory contains exactly **45** Markdown paths: **18 normative**, **27 non-normative**.
> - Crosswalk set equality: **45 unique rows, no missing or extra paths**.
> - All files are regular UTF-8 Markdown with LF line endings and no symlinks.
> - The independently recomputed 18-file normative digest is  
>   `1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf`, matching [the inventory](/work/spec/00-normative-inventory.md:72).
> - `skillVersion=2.0.1`.
> - Content commit and activation status: **Unknown**. The release record was intentionally omitted, so no commit or active-baseline claim is made.
> - Compiler implementation, generated assembly, artifact construction, and runtime conformance: **Unknown**; none was supplied or permitted.
> 
> Branch abbreviations below: `SEM` = semantic crosswalk, `ARCH` = compiler architecture, `SFA` = SFA/ABI, `IL` = IL/optimization.
> 
> ## Exact 45-path audit
> 
> ### Normative and corpus-level files
> 
> | Path | Authority and substantive payload | Consequence and interaction/failure boundary | Branch | Genuinely N/A facet |
> |---|---|---|---|---|
> | [00-feature-index.md](/work/spec/00-feature-index.md:1) | Non-normative navigation; maps topics and feature IDs to owners. | Navigation cannot alter chapters, diagnostics, profiles, or corpus membership. | SEM | Independent semantics: N/A; it is discovery only. |
> | [00-introduction.md](/work/spec/00-introduction.md:46) | Normative axioms: modern source, SFA, defined behavior, explicit conversions, target-neutral core. | Compiler restrictions require normative or physical justification; unspecified bits are permitted only at registered hardware boundaries. | SEM+SFA+ARCH | None. |
> | [00-normative-inventory.md](/work/spec/00-normative-inventory.md:7) | Non-normative identity owner; exact 18/27 membership and digest algorithm. | Establishes which files may govern; unlisted files cannot supply semantics. | SEM | Direct compiler/runtime behavior: N/A. |
> | [01-lexical-structure.md](/work/spec/01-lexical-structure.md:560) | Normative UTF-8 lexical grammar, closed escapes, maximal munch, token spans. | Lexer must retain spelling/value/span; encoding lookup occurs later, not in lexing. | SEM+ARCH | Runtime cost: N/A; lexing is compile-time. |
> | [02-type-system.md](/work/spec/02-type-system.md:161) | Normative widths, signedness, TS-4 widening, casts, enum conversion, wrapping, object-size domain. | Type/nominal identity must survive until consumed; mixed signedness and narrowing fail, while same-signed widening is legal. | SEM+IL | None. |
> | [03-variables.md](/work/spec/03-variables.md:303) | Normative mutable, resident const, package-only loadable const, placement, initialization/publication. | Storage classes cannot be conflated; a failed/partial load invalidates only its captured range, and unsafe reads fail E10276. | SEM+SFA+ARCH | None. |
> | [04-expressions-operators.md](/work/spec/04-expressions-operators.md:42) | Normative precedence, left-to-right effects, arithmetic, conditional selection, address provenance, volatile access. | IL must preserve exactly-once evaluation, short circuit, widths, volatile counts, and address lifetime; default runtime-zero division has unspecified result bits. | SEM+IL+SFA | None. |
> | [05-statements-control-flow.md](/work/spec/05-statements-control-flow.md:219) | Normative blocks, Boolean conditions, three-clause `for`, switch, exits. | Requires explicit CFG: `continue` reaches update; `break`/`return` skip it; loop-local `loadable const` has scope but no runtime home. | SEM+IL | None. |
> | [06-functions.md](/work/spec/06-functions.md:414) | Normative calls, typed function values, aggregate returns, SFA, interrupts, compile-time functions. | Left-to-right staging, caller-owned destinations, per-overlap homes, reachable entry variants, and compile-time budgets must close before emission. | SEM+SFA+ARCH+IL | None. |
> | [07-structs.md](/work/spec/07-structs.md:95) | Normative contiguous declaration-order layout, by-reference parameters, value assignment/return. | Preserve field offsets, aliases and caller-owned destinations; remaining overlapping copies need safe direction or SFA snapshots. | SEM+SFA+IL | None. |
> | [08-arrays-strings.md](/work/spec/08-arrays-strings.md:224) | Normative fixed arrays, ordinal promotion, encoding, const/any-size parameters, bounds behavior. | Default runtime access uses modulo-65536 effective addresses; `T[]` is not a storable slice and carries address+word count only as a parameter. | SEM+IL+SFA | None. |
> | [09-enums.md](/work/spec/09-enums.md:174) | Normative byte-backed nominal enums and asymmetric conversion. | Retain nominal identity until enum→byte is consumed; byte→enum requires explicit cast but no member-range runtime check. | SEM+IL | None. |
> | [10-modules.md](/work/spec/10-modules.md:199) | Normative modules, imports/exports, unique entry point, dependency/effect-ordered startup. | Build complete symbol and initializer graphs; cycles are E10194 and filenames/input order cannot determine behavior. | SEM+ARCH+SFA | None. |
> | [11-memory-model.md](/work/spec/11-memory-model.md:106) | Normative memory segments, SFA instances, ZP, hardware-stack budgets, aggregate destinations. | Function storage must be distinct from globals/assets; all temporaries, spills, pointer pairs and helper scratch enter final closure. | SEM+SFA+ARCH | None. |
> | [12-intrinsics.md](/work/spec/12-intrinsics.md:25) | Normative five CPU controls, BCD operations, volatile memory access and queries. | Machine effects and status-stack kinds are ordered; runtime addresses require SFA-accounted pointer scratch; no removed raw controls may reappear. | SEM+IL+SFA | None. |
> | [13-data-inclusion.md](/work/spec/13-data-inclusion.md:71) | Normative raw/handler embed, resident versus loadable data, deduplication, exact D64 transfer. | Compile-time import is zero runtime work, but bytes/residency remain layout costs; HLE-010 allows overwrite beyond the expected range on replaced media. | SEM+ARCH+SFA | None. |
> | [14-diagnostics.md](/work/spec/14-diagnostics.md:10) | Normative sole public diagnostic registry: 184 unique active codes. | One root diagnostic, poison recovery, no artifact after error; owning chapters define predicates, not public presentation. | SEM+ARCH | Runtime behavior: N/A; diagnostics govern compilation. |
> | [15-platform-profile.md](/work/spec/15-platform-profile.md:22) | Normative profile schema and exactly nine indivisible C64 identities. | Exact profile selection precedes lowering; incomplete/mixed IDs are E10279; profile facts feed allocation, ABI, backend and packaging. | SEM+ARCH+SFA+IL | None. |
> | [appendix-c64.md](/work/spec/appendix-c64.md:53) | Normative concrete C64 maps, budgets, IRQ ABIs, artifacts, assets, loader and safety stop. | Banking, vectors, timing, asset visibility and loader effects are profile-owned; none may leak into core semantics or be repaired by hidden copies/runtime. | SEM+ARCH+SFA+IL | None. |
> | [grammar.ebnf.md](/work/spec/grammar.ebnf.md:33) | Normative master source grammar, delegating expression precedence to Chapter 04. | Parser acceptance must agree with governing chapters; a mismatch is a specification conflict, not a precedence assumption. | SEM+ARCH | Runtime/resource cost: N/A; it governs syntax. |
> 
> ### Evaluation and future-history files
> 
> All `Fxxx` files are non-normative rationale. Their authority facet is therefore N/A: they may explain intent and costs but cannot override the corresponding normative chapter.
> 
> | Path | Substantive payload | Consequence and interaction/failure boundary | Branch |
> |---|---|---|---|
> | [F001-multi-file.md](/work/spec/evaluations/F001-multi-file.md:7) | Supplied source files form one binary; paths have no meaning; cross-file names use modules. | Preserve the supplied set; it does **not** specify discovery, module/file mapping, duplicate-module policy, or diagnostic stability. | SEM+ARCH |
> | [F002-modules.md](/work/spec/evaluations/F002-modules.md:19) | Mandatory first module declaration; files may merge a module. | Preserve module identity and spans; normative Chapter 10 owns final behavior. | SEM+ARCH |
> | [F003-module-contents.md](/work/spec/evaluations/F003-module-contents.md:7) | Modules contain declarations, export/private visibility, runtime initializer intent. | Retain declaration class, visibility and effect dependencies; loose executable code is rejected. | SEM+ARCH+SFA |
> | [F004-entry-point.md](/work/spec/evaluations/F004-entry-point.md:7) | Exactly one `main(): void`, except library builds. | Establishes one root; invalid/multiple entry selection suppresses artifact emission. | SEM+SFA |
> | [F005-memory-placement.md](/work/spec/evaluations/F005-memory-placement.md:14) | Automatic placement plus closed `place(at, align, noCross, region)` and ZP block. | Preserve symbolic constraints through layout; unsatisfiable placement/resource intersections fail rather than copy. | SEM+ARCH+SFA |
> | [F006-address-of.md](/work/spec/evaluations/F006-address-of.md:8) | Storage addresses are words; function and handler values remain typed; parameter/field/element places are addressable. | Preserve provenance and once-evaluated address formulas; escaping local-origin addresses fail E10260. | SEM+SFA+IL |
> | [F007-interrupt-functions.md](/work/spec/evaluations/F007-interrupt-functions.md:7) | Callback-only handler, sink-selected raw/firmware entry, explicit acknowledgement. | Complete call/preemption graph, disjoint private homes, exact RTI/RTS/tail and status restoration; unbounded overlap fails. | SEM+SFA+ARCH+IL |
> | [F008-for-loop.md](/work/spec/evaluations/F008-for-loop.md:9) | Ordinary three-clause loop with exact clause order and proof-based induction optimization. | Always lower a correct generic CFG; source legality cannot depend on counted-loop recognition. | SEM+IL+SFA |
> | [F009-switch-statement.md](/work/spec/evaluations/F009-switch-statement.md:9) | Auto-break with explicit `fallthrough`, cases/default and alternative lowering shapes. | Preserve case order and intentional fallthrough; choose linear/tree/table lowering only after type and cost proof. | SEM+IL |
> | [F010-signed-types.md](/work/spec/evaluations/F010-signed-types.md:10) | Signed ranges, conversions, comparison, shifts and arithmetic lowering. | Signedness must survive legalization; unsigned substitutions cannot replace signed comparison/right shift without proof. | SEM+IL |
> | [F011-structs.md](/work/spec/evaluations/F011-structs.md:10) | Contiguous layout, nesting, aliasing, arrays of structs, by-reference calls. | Preserve offsets and alias-visible order; cost differences cannot become source restrictions. | SEM+SFA+IL |
> | [F012-cpu-control-intrinsics.md](/work/spec/evaluations/F012-cpu-control-intrinsics.md:7) | Exactly five controls with exact flag/stack effects; typed BCD owns decimal mode. | Keep ordered machine effects and kind-correct stack state; removed raw decimal/BRK APIs are not current behavior. | SEM+IL+SFA |
> | [F013-control-flow.md](/work/spec/evaluations/F013-control-flow.md:9) | If/while/do-while, scope, reachability, definite assignment and returns. | Build explicit CFG and declaration identity; independent root diagnostics survive poison recovery. | SEM+IL |
> | [F014-arrays.md](/work/spec/evaluations/F014-arrays.md:10) | Arrays, strings, characters, const parameters, indexing tiers and encodings. | Retain extent, element scale, alias/const effects and encoding identity; SoA is an optimization choice, not an expressiveness rule. | SEM+IL+SFA |
> | [F015-data-inclusion.md](/work/spec/evaluations/F015-data-inclusion.md:10) | Exact handler selectors, format/version validation, placement metadata and SID compatibility. | Keep assets/relocations symbolic; platform layout owns residency and alignment; known SID incompatibility fails without conversion. | SEM+ARCH |
> | [F016-type-system.md](/work/spec/evaluations/F016-type-system.md:10) | Consolidated typing, promotions, casts, overflow and constant evaluation rationale. | Compile-time and runtime evaluation share operator rules but retain their different width models. | SEM+IL |
> | [F017-operators.md](/work/spec/evaluations/F017-operators.md:10) | Operator set, short circuit, shifts, comparisons and expensive arithmetic tiers. | Preserve effects/width/signedness; helper selection carries full resource/clobber cost. | SEM+IL+SFA |
> | [F018-functions.md](/work/spec/evaluations/F018-functions.md:373) | SFA ABI, recursion prohibition, aggregate returns and per-instance cost. | Every bounded overlapping activation is separately charged; “no recursion” does not imply one home per source function. | SEM+SFA+IL |
> | [F019-variables.md](/work/spec/evaluations/F019-variables.md:83) | Mutable/constant/loadable declarations and startup initialization. | Preserve storage/lifetime and initialization state; local `loadable const` has lexical scope but no runtime initialization or SFA home. | SEM+SFA+ARCH |
> | [F020-memory-intrinsics.md](/work/spec/evaluations/F020-memory-intrinsics.md:32) | Volatile peek/poke, variable addresses, little-endian word order and queries. | Exactly-once ordered access; dynamic address scratch closes through SFA; fixed queries fold while any-size length loads a count. | SEM+IL+SFA |
> | [F021-lexical-structure.md](/work/spec/evaluations/F021-lexical-structure.md:38) | Token inventory, literals, closed escapes, maximal munch and positions. | Lexer preserves symbolic literal content and spans; platform mapping remains semantic, not lexical. | SEM+ARCH |
> | [F022-enums.md](/work/spec/evaluations/F022-enums.md:86) | Byte-backed nominal enum and asymmetric conversion. | Preserve identity until conversion validation, then lower with no runtime table or member-range check. | SEM+IL |
> | [F024-conditional-operator.md](/work/spec/evaluations/F024-conditional-operator.md:65) | Boolean condition, selected-arm-only evaluation and arm unification. | Lower as branch/merge; the unselected arm must produce no calls, volatile access or other effects. | SEM+IL |
> | [F025-comptime-functions.md](/work/spec/evaluations/F025-comptime-functions.md:32) | Typed deterministic evaluator with fixed steps/live-memory/depth budgets. | Emit no target function/frame/runtime; exhaustion poisons the root and emits no partial artifact. | SEM+ARCH |
> | [future-considerations.md](/work/spec/future-considerations.md:34) | Non-normative deferral/resolution/rejection register. | Open items are not current behavior; resolved items defer to normative chapters and reopen only under their stated triggers. | SEM |
> 
> ## Required high-risk closures
> 
> - **Warnings:** [W10190](/work/spec/03-variables.md:535) applies only to a possibly uninitialized **function-local read path**. [W10141](/work/spec/08-arrays-strings.md:837) independently applies to every uninitialized nonzero mutable array, including module-level arrays. One local array can receive both.
> - **SFA instances:** Frames, aggregate destinations, temporaries, spills, pointer pairs, helpers, and optional stack-free return homes are charged per simultaneously possible activation/entry variant—not per source function.
> - **Address lifetime:** [Memory-model §3.4](/work/spec/11-memory-model.md:157) makes a scalar parameter live for its invocation, but a field or element reached through an aggregate parameter retains the caller object’s lifetime and read-only provenance. Every place/index is evaluated once; E10260 rejects escape beyond the retained lifetime.
> - **F001 boundary:** It defines only supplied files, one binary, path-name irrelevance, and module-based cross-file references. Discovery and the other named policies remain unspecified there.
> - **Nine profiles:** The exact list is [Chapter 15 §2](/work/spec/15-platform-profile.md:22). `c64-pal`, `c64-pal-d64-kernal-8580`, `c64u-pal`, and every other partial/mixed ID are E10279.
> - **Unchecked C64 indexing:** [AR-8](/work/spec/08-arrays-strings.md:224) emits no default check. Addressing is modulo 65536; a multi-byte element continues byte-by-byte from `$FFFF` to `$0000` under the active bank/MMIO map. `--bounds-check` is independent, explicit and off by default.
> - **Trusted-media loader:** [HLE-010](/work/spec/13-data-inclusion.md:206) states that stock KERNAL `LOAD` writes before its end address can be checked. A longer replacement file can overwrite beyond the destination before `false`; no checksum, staging buffer or containment exists.
> 
> ## Current hardware and resource boundaries
> 
> | Boundary | Governing location and concrete consequence |
> |---|---|
> | Address/object width | [TS-24](/work/spec/02-type-system.md:563): array extents and complete fixed arrays/structs are limited to `0..65535`; queries return `word`. No hidden wider integer/runtime exists. |
> | Resident memory | [C64 §2](/work/spec/appendix-c64.md:53): code, const data, mutable data and SFA share `$0801–$CFFF`, 51,199 bytes. Binary and RAM maxima are not separate pools; trailing BSS is not serialized. |
> | Zero page | [C64 §3](/work/spec/appendix-c64.md:109): `$02–$8F`, 142 bytes. User objects, pointer pairs, temporaries and interrupt-specific scratch share the ledger according to interference. |
> | Hardware stack | [C64 §4](/work/spec/appendix-c64.md:149): 256 bytes; cooperative KERNAL reserves 20, leaving 236; takeover reserves zero but charges every raw route. Stack stores return addresses, interrupt state and explicit pushes—not SFA locals. Warning threshold is 188 bytes. |
> | SFA lifetime | [Memory model §3](/work/spec/11-memory-model.md:106): each overlapping mainline/startup/IRQ/NMI/callback activation needs a disjoint home. Unbounded storage-bearing re-entry is E10245; late helper/spill storage must return to closure. |
> | Multiply/divide | [Expressions §3.2–3.3](/work/spec/04-expressions-operators.md:86): the 6510 has no hardware multiply/divide. Helpers add ROM, cycles, frame/ZP scratch and call clobbers. Default runtime zero division terminates but produces unspecified valid-width quotient/remainder bits. |
> | Interrupt status and entry | [C64 §9.2](/work/spec/appendix-c64.md:746): NMOS entry does not clear D. CINV already saved A/X/Y; chaining adds `PHP; CLD; PLP`, while exclusive uses `CLD` and `$EA81`. A raw entry has different save/RTI ownership. |
> | NMOS indirect jump | [C64 §9.2](/work/spec/appendix-c64.md:782): saved vector words may not begin at `$xxFF`, because `JMP ($xxFF)` fetches the high byte from `$xx00`. |
> | Asset residency | [Data inclusion §4](/work/spec/13-data-inclusion.md:153): compile-time import/SFA cost may be zero, but embedded bytes, alignment, RAM/ROM visibility and package residency remain distinct layout costs. |
> | Safety stop | [C64 §9.4](/work/spec/appendix-c64.md:807): enabled bounds/division checks branch to four ROM bytes (`SEI; JMP self`), using no RAM/ZP/stack. IRQ is masked; NMI/reset/external hardware remain active. |
> 
> ## Future-register closure
> 
> All 19 `FUT` entries were inspected:
> 
> - Resolved: FUT-001 field/element address-of; 002 parameter address-of; 003 typed function values; 004 interrupt-domain call-graph/SFA analysis; 005 typed interrupt sinks; 008 const aggregate parameters; 009 duplicate field-address issue; 010 aggregate returns; 013 compile-time table generation; 014 closed placement constraints; 019 three-clause loops replacing range keywords.
> - Open: FUT-006 labeled break pending demonstrated nested-exit demand; 007 switch ranges pending demand and a clean range/fallthrough design; 011 external assembly pending ABI/object/effect qualification; 012 copy intrinsic deferred because aggregate assignment already supplies semantics; 015 modern image conversion pending deterministic qualified conversion; 016 stack-free calls pending measured stack pressure despite larger/slower call sites; 017 general barrier pending a distinct optimizer need; 018 separate volatile operations pending proof that ordinary RAM can safely differ from always-volatile peek/poke.
> - Rejected: REJ-001 transparent aliases remain rejected and `type` reserved; REJ-002 inline assembly/full opcode API remains rejected, while external assembly is only FUT-011.
> 
> No historical path was invented from the crosswalk’s old 50-path prose.
> 
> ## Findings
> 
> 1. **Normative stability contradiction — Incorrect / Fact.**  
>    [Chapter 15’s header](/work/spec/15-platform-profile.md:1) says `Stability: stable`, while its own [classification table](/work/spec/15-platform-profile.md:521) says Chapter 15 is `Provisional`. The profile semantics remain readable, but the Chapter-15 stability field is `blocked-conflict` until one value is selected and repaired.
> 
> 2. **First-profile IRQ checklist conflict — Incorrect / Fact.**  
>    [Appendix Gate G3](/work/spec/appendix-c64.md:1081) says the first profile’s `interrupt_entry_variants` include “raw IRQ ABIs,” while the same checklist says `setRawIRQ` requires a raw profile and `raw_interrupt_paths` is empty. The concrete first record contains KERNAL variants; raw variants appear only in the takeover delta. The checklist cell should say KERNAL IRQ/NMI chain/exclusive variants, with raw variants defined only by the takeover replacement.
> 
> 3. **W10190 subordinate summary contradiction — Incorrect / Fact.**  
>    [F019 line 244](/work/spec/evaluations/F019-variables.md:244) and normative Chapter 03 limit W10190 to function-local reads, but [F019 VAR-A8](/work/spec/evaluations/F019-variables.md:640) says “Any read while INDETERMINATE triggers W10190.” Normative behavior is determined; the evaluation summary is stale/shallow.
> 
> 4. **Division summary contradiction — Incorrect / Fact.**  
>    F017 correctly records unspecified runtime-zero results, but its [C5 summary](/work/spec/evaluations/F017-operators.md:1168) says all operations produce deterministic results. Replace that with “defined effects and width; runtime-zero result bits are unspecified.”
> 
> 5. **Duplicated normative surfaces — Verified partial / Fact.**  
>    Memory/query intrinsics are defined in both Chapters 04 and 12; the first concrete profile is repeated in Chapter 15 and Appendix A; initialization/SFA/query rules also have several normative copies. Checked copies mostly agree, but the IRQ checklist conflict demonstrates the maintenance risk. A smallest remedy is to designate one canonical owner per duplicated field and make other locations precise cross-references or generated summaries.
> 
> 6. **Branch coverage is shallow for exact interrupt routes — Verified partial / Fact.**  
>    The candidate crosswalk often links F007 primarily to SFA. Exact interrupt-route evaluation also needs architecture ownership and IL machine/status effects; the correct packet-local union is `SEM+SFA+ARCH+IL`.
> 
> 7. **Policy lineage unsupported beyond the supplied excerpt — Unknown.**  
>    The architecture/IL branches cite historical policy identity `BLEND65-PROJECT-POLICY-P3-28627e0c`, while the packet supplies an excerpt declaring repository-source SHA-256 `648e2400…c0602cc5`. The omitted original `AGENTS.md` prevents independent verification of that source hash. The supplied text nevertheless corroborates ACME 0.97 and the meet-level parity issue rule.
> 
> 8. **Missing paths: none. Unsupported implementation coverage: all implementation claims.**  
>    The crosswalk’s pipeline statements are requirements, not evidence that a compiler implements them. No compiler, build, generated assembly, artifact, emulator observation or hardware observation was supplied.
> 
> ## Project-policy overlay
> 
> The policy excerpt and [C64 evidence contract](/work/spec/appendix-c64.md:829) independently agree on ACME 0.97. Their authority remains distinct:
> 
> - the specification makes it a qualified target/toolchain fact;
> - project policy governs repository workflow and requires a GitHub debt issue after a measured “meet” that cannot be beaten.
> 
> No generated-code comparison occurred, so the issue rule was not triggered. No issue, commit or push was performed.
> 
> Overall packet evaluation status: **Verified partial**—the authority answer and 45-path coverage are verified, while the listed consistency defects prevent a clean consistency-ready result.

</details>


<details>
<summary>candidate-ql01-final-grade: packet manifest and exact captured text</summary>

```text
f69815f7fae221b39f4d85e3c5ae256ece60f83c31046026a4462db4956c069e  answer.md
e1a14afa11ff99d9c271e2c3352bf943d368c2d5b3624399a9942a84f8bc7e91  control.py
2cc0704696b4d784e93471da081814cefe8eac1f8df5b3917e43902e296fdaac  oracle.md
fc1e91a459a65965f2a48c66fa7fd12dc581057f6d53ec3e4fc9483a48adecf2  prompt.md
```

> **Q-L01 — Fail: required local knowledge is missing.**
> 
> The decisive omission is **retained diagnostic retirement/migration dispositions**, explicitly required by [oracle.md:44](/work/oracle.md:44). The diagnostics row describes “184 unique active codes” and “One root diagnostic, poison recovery, no artifact after error” ([answer.md:51](/work/answer.md:51)), but nowhere supplies the retained retirement/migration dispositions or their governing locations. Active-code coverage does not satisfy that separate obligation. The oracle expressly does **not** require a removed migration guide.
> 
> Crediting the answer’s sections jointly, it covers the conversion decision, 45-path audit, F001 limits, aggregate-return semantics, warning scopes, per-activation SFA costs, address lifetimes, future entries, and hardware/loader boundaries. Its ACME authority distinction agrees with the oracle ([answer.md:151](/work/answer.md:151)). Leaving implementation, generated output, runtime, activation, and content commit Unknown is appropriate.
> 
> **Contradictions:** No actual contradiction between complementary portions of the answer is established. It reports source conflicts involving stability, IRQ variants, W10190, and division ([answer.md:125](/work/answer.md:125)); those are audit findings, not inherently contradictory answer claims. The frozen oracle does not independently substantiate those specific source conflicts.
> 
> **Required remedy:** Supply the retained diagnostic retirement/migration dispositions with exact governing normative citations. Neither file was modified.

</details>


<details>
<summary>candidate-ql01-retirement-probe: packet manifest and exact captured text</summary>

```text
8111b2ebc7584ee427a16951be0bfafce199ae6166094de8befa9f092848ce68  SKILL.md
e4a9f2e3a50b59f4824ba39443ce8ff846f52134f5effdc0424b763805b5df38  agents/openai.yaml
36229972f5e3f173efcff032790ff77f743eb9723606593aede1aec8ab10eba9  control.py
c34f02c6a13ac5bfbf9457b607b1810fbe0fcd56e8dd11367ab40b22d2ac25c7  invalid-source.blend
de2e7e8567efb9a0f10eff330465200badc4bec07457163f589d28d9a46f66ac  project-policy-excerpts.md
110ae1fae3a1430ef05560cfb86859e42bbafdbff6ff34e54b51a76c16c4af11  prompt.md
4f3ea96e261ba9cc8f62b16ab5a7ed7f616b4980b7fa6efff4624d336f9a95cd  references/6502-lowering-casebook.md
3dfda1f0ea2e33e1e8632f56fd08dbf02030300a5ad9f101c278539ebeda56a3  references/acme-and-artifacts.md
f4353dbb552e470084be965b963cb161ede43c0407fc6eaf344d3c096dea2437  references/blend65-semantics.md
d3bcc7a53424be398a7ef2e4c331ba403b7f02d648fd177904704ae1194dc112  references/c64-game-engineering.md
ab551b788474a4459a72a1ba8775436c6d75aeb86830162cf136097fc1dfa186  references/c64-hardware.md
199ca9b200158e532a21325ed2f1ffd9d84741aa929a6654f9d07350b167b16c  references/c64-memory-and-runtime.md
893c724b6ec7a84dfd66e7e73d8669783459b56472b2bb503788bc664d814e85  references/compiler-architecture.md
d25a45598a7669bf28ac0725c472760e3918cfb29151862d8beba9bb40a05b31  references/evidence-parity-and-recovery.md
7b38b1c9888df1aae0b1f63862c1f1824e1f905b4465a3ef1a24da8d95d40549  references/il-and-optimization.md
68838b0e38c60198c165160f2823759239ab27d233f72ed1dfc1e9e6b49716bf  references/mos-6502-family.md
4ee1b17f456e47d2bd2c854c343559a677c8ef367ccdaf8b9b33ddc7fb2f2ffb  references/sfa-and-abi.md
4bca2b8bd8d3e0e0d115c291d11797ef12ecd3b2c0bc4316f3a518c951788392  references/source-manifest.md
028efcd8220207b3d370cf09075ffa99074b53833d2388a83305d0c24775e5b8  references/target-portability.md
ab393b09a630b8b8db90c7fb5e273ff0bbef1e5299c2902affbf4a33d43a6b0a  spec/00-feature-index.md
74f1bb84818f11fddb0d4142af071c14e634f58e326a370f2ad92f2e14a03fa1  spec/00-introduction.md
f0e9de860cc820c950188cb2e2ab77c89e836168475921c4ba568c7c0068c6bb  spec/00-normative-inventory.md
4312fb663eeb3f26137aadcc8acbfa6ba586ef19996f54254409f8ead7982d1c  spec/01-lexical-structure.md
73f7deb046abcc2caa6bcced73bd62c741bb2c0e954b16cfb1633e3cbdab8651  spec/02-type-system.md
e8c017b9671b9cf1c8ac633cf4aee59fd1591df13ea94ddab323b7c42a11807d  spec/03-variables.md
1dcefd066aee1e9a35e255172a5c772a442092ff57e8ebf2076803934ff2d4e8  spec/04-expressions-operators.md
187ea573d6ddaf6a033321f9118835c2b3442118e1e363dcd68bc634f59b0ab2  spec/05-statements-control-flow.md
fa33c4a76fcb003d7682c00c86a64321ec7751410f334832b3fbc570612aa7b1  spec/06-functions.md
a3afc05f37ab7118ed365ae570ff98ca05ac2ca73120b5b48280b58b98f8cd45  spec/07-structs.md
500a6c18f84dc54a41fd7fe82b0fb5e0029bc1e050615ec9c929e148f76be515  spec/08-arrays-strings.md
e0772e924b761ed16e58b14f72906d4fa3014ed3bf2e9886fd01759a127192d6  spec/09-enums.md
a5ad0cc83e34867de7b1e1ada3d94efb1a136230cf199578c7a0d7a283a57383  spec/10-modules.md
0097af18c1763ea50450eb0476afb2ee4d2c309afe7bb9c4fd476917ec926925  spec/11-memory-model.md
925c7eb49fd32093e2de791a8f4c8887e2797d2956429cf5974aca985933936c  spec/12-intrinsics.md
29a16540be2a29cc4d4e5ba3bed0e407b9644dd25d4acc803666cf3df71079e7  spec/13-data-inclusion.md
4c414a44de2106540eae29d89e370e412e93f40ee848fd72193cb9b750a7fef2  spec/14-diagnostics.md
9ed9c41cf7ed22cfc4d557951e5e0f3f9c0fcba7e4d4a2ff63cc35694234ba73  spec/15-platform-profile.md
70e822e3ec88506fd694303d98f37b8eacc0bf6cb4febb5fe7fea5d4f0fe25f2  spec/appendix-c64.md
cd79fa582b71c3126916f455f6d623c3c1a8fd35b064cae22ee4a311261a19df  spec/evaluations/F001-multi-file.md
d522d443a3f946ac6d0201ada84d45e321c35094e951bd3ecb1d616bd9f1d98a  spec/evaluations/F002-modules.md
9673502debd656fe4733a160454d1d86ed6adcbf70fb7bc68325f67d49385920  spec/evaluations/F003-module-contents.md
dd7ef96a96873a1ff1ff1a9c3bf97ea07ece0717051ff485432b6a951abb8162  spec/evaluations/F004-entry-point.md
add33b6dd89783250bd495247264966aadee57d4dec3dc44a1698fdbe1442aa3  spec/evaluations/F005-memory-placement.md
13e3f8af5bc2d698a70827b111fab22c8aeaf6ed2f310031d6b8c61a83423760  spec/evaluations/F006-address-of.md
83b7baac19b72e8eeced5b156cd2ce79a56bfc1391739283e11009787669d95b  spec/evaluations/F007-interrupt-functions.md
bb503f0aa1aff317c71cb8a61c5e071b9f3c8bbeea1476438306f3b82c60dc04  spec/evaluations/F008-for-loop.md
2d5116b586c2abe6bb4ee43a2372f974dc90e719177443bfe714c53c542d72ce  spec/evaluations/F009-switch-statement.md
9013ae2793ba44f96c13e9fdb567b324e6bd5a8f331af9083605eff12fe2f359  spec/evaluations/F010-signed-types.md
4118af9de2c2b34022a883cddc5762e87bd164cda03ed38f47fe4f77577db026  spec/evaluations/F011-structs.md
c06a710a4dca63f35d91af4850f2ba1aa6e94c06e1bd89bc81b0d5720c96fc5c  spec/evaluations/F012-cpu-control-intrinsics.md
1a36d5db689bb97d84b93318e604a7da31a36c38dc057993c3192c0907731faa  spec/evaluations/F013-control-flow.md
938d3adb011bb60eac49dcfe160c65c48b2279aa610a1bb2c82cb3171c53ba2f  spec/evaluations/F014-arrays.md
cc383e7d7258c1cb7eecd8a51bffa360098fda5ddfbb2a8752061a5e647a942f  spec/evaluations/F015-data-inclusion.md
0ccfec6274dadc849eb93a3440bb090f9b24f77119f7b297fa5217f827608f4e  spec/evaluations/F016-type-system.md
ecf5e10be85f9610c20d400aac6dbda2cc8dea0a1edbbccfce2b87a32e7ff44d  spec/evaluations/F017-operators.md
02a7600cf86659a1713d83891c4bbe08806b9c7a9c1686da2642c379c6ff2a42  spec/evaluations/F018-functions.md
15628edf3f35fb2252f20ad938b16b8b6006f32d196ffe0d8ffa8e496f3fa017  spec/evaluations/F019-variables.md
3a6d7e2e07dedfed392dc407e1cb598042f5aad270152740f99ae056e492b945  spec/evaluations/F020-memory-intrinsics.md
a77babccebc4b20ee55f062ace152674a46860ebb53fdec9fd2408b85eea441a  spec/evaluations/F021-lexical-structure.md
0d12f268294ce67560417599b4e2a88b69f743f7d4f00aaed9e412f4c5719e6f  spec/evaluations/F022-enums.md
66dc1c0ad8222f09871b3550ae032a0d0cfcecb7cf338174e85af29bdbd2d303  spec/evaluations/F024-conditional-operator.md
f14a19ee370fbfe6de5c3a4b0c599d1a5cf4359863a2110efe2c1d3b303e2f4d  spec/evaluations/F025-comptime-functions.md
e38910dbf5e9a710b8171081c1698730bfd835df058b6267d5b2edf54d0dbcea  spec/future-considerations.md
8d4533443a31067627f790540c5e1c3900a57cff52ea2b751908b4917e3fed94  spec/grammar.ebnf.md
```

> ## Result
> 
> **Status:** Verified complete for the supplied source-contract boundary.  
> **Claim kind:** Fact.  
> **Implementation/runtime status:** Unknown; no compiler, generated artifact, release record, or runtime observation was supplied.
> 
> The isolation check passed, the 18-file normative digest reproduces as `1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf`, and the active catalogue contains exactly **184 unique codes: 155 errors and 29 warnings**.
> 
> ### Governing authority
> 
> - The normative corpus and identity are defined by [00-normative-inventory.md § Normative Files](/work/spec/00-normative-inventory.md:17).
> - [14-diagnostics.md §1](/work/spec/14-diagnostics.md:10) alone owns public codes, severity, templates, spans, help, suppression/promotion, and migration history.
> - The owning language chapter defines the triggering predicate and semantic consequence.
> - The active error and warning catalogues are [§3](/work/spec/14-diagnostics.md:92) and [§4](/work/spec/14-diagnostics.md:269).
> - The complete retained history is the 59-row table in [§5](/work/spec/14-diagnostics.md:305).
> - The crosswalk confirms this split in [Diagnostic Doctrine](/work/references/blend65-semantics.md:707). It is guidance, not a competing registry.
> - The feature index and evaluations are non-normative navigation/rationale.
> 
> The history does not reactivate old meanings. For an older draft collision, the accepted active condition keeps the number and the displaced condition is remapped or retired. This is not post-retirement reuse. A genuinely retired code remains reserved. Unknown, retired, malformed, or severity-mismatched codes used in diagnostic options are command-line errors.
> 
> An active error poisons the rejected construct, suppresses dependent cascades, prevents lowering/allocation/emission for it, and prevents every usable compilation artifact. Warnings continue compilation unless promoted; suppression is applied to the original `W` identity before promotion. See [§2.1](/work/spec/14-diagnostics.md:54).
> 
> ## Complete 59-row disposition audit
> 
> The grouping below assigns each retained row by its principal consequence. Mixed rows note their additional effect.
> 
> ### Source acceptance and source-surface changes — 15 rows
> 
> | Former assignment | Current contract |
> |---|---|
> | E10111 zero-length array | Retired: zero-length arrays are valid; every known index is E10240. `W10111` is a distinct warning code. |
> | E10060 read-only for-loop variable | Retired: a for-header `let` has normal mutability; assignment to `const` is E10192. |
> | E10061 zero range step | Retired with range-loop syntax; the three-clause loop uses ordinary update expressions. |
> | E10062 nested loop variable | Retired: lexical shadowing is legal; only same-scope duplication is E10003. |
> | E10064 range end outside counter type | Retired with range-loop syntax; normal conversion/comparison rules apply. |
> | E10101 nested shadowing | The `E` code is retired and shadowing is legal; same-scope duplication is E10003. Active `W10101` is the unrelated narrowing-cast warning. |
> | E10133 non-exhaustive enum switch | Retired: exhaustiveness is not required. Active E10133 means unknown asset selector. |
> | E10138/E10139 partial-embed offsets | Retired with generic offset arguments; prepare the raw asset or use a format selector. |
> | E10141 enum-member maximum / selector offset | Retired: no separate enum-count limit exists, and `embed()` has no generic offset argument. |
> | E10142 duplicate enum value | Retired: duplicate enum values are legal aliases. Active E10142 means array-selector expression misuse. |
> | E10175 eight-parameter maximum | Retired: no language parameter-count limit exists. Active E10175 means attempting to call a non-function value. |
> | E10255 raw decimal-state violation | Retired with `asm_cld()`/`asm_sed()`; those source operations do not exist. |
> | E10259 missing BRK contract | Retired with `asm_brk()`; Specification 4 exposes no BRK operation. |
> | W10120 decimal-mode warning | Retired with raw decimal-control operations. |
> | W10121 release-build BRK warning | Retired with BRK; Specification 4 has no debug/release semantic mode. |
> 
> Current owners include the three-clause loop and shadowing rules in [Chapter 05 §7](/work/spec/05-statements-control-flow.md:217), array legality in [Chapter 08 AR-2–AR-4](/work/spec/08-arrays-strings.md:105), enum aliases/non-exhaustiveness in [Chapter 09 EN-5](/work/spec/09-enums.md:145), unlimited parameters in [Chapter 06 FN-11](/work/spec/06-functions.md:298), and the closed CPU surface in [Chapter 12 §2](/work/spec/12-intrinsics.md:25).
> 
> ### Diagnostic selection and numeric collisions — 35 rows
> 
> | Former condition | Active disposition; current same-number meaning |
> |---|---|
> | E10002 module declaration not first | Now E10237; E10002 remains “more than one module declaration.” |
> | E10033 RAM budget exceeded | Now E10238; E10033 remains invalid keyword inside `zeropage`. |
> | E10040/E10041 intrinsic arity | Now E10171. E10040 remains address-of an inlined scalar constant; E10041 is retired and parameters are addressable. |
> | E10080 invalid operator operand | Select the precise type/operator diagnostic; E10080 remains incompatible implicit conversion. |
> | E10082 constant division by zero | Now E10160; E10082 remains implicit narrowing. |
> | E10083 wide shift | E10161 for invalid shift type or W10174 for a constant amount at least the width; E10083 remains unsigned negation. |
> | E10100 undeclared identifier | Now E10239; E10100 remains non-Boolean condition. |
> | E10112 platform array budget | Now E10238; E10112 remains initializer-count mismatch. |
> | E10114 invalid index type | Now E10263; E10114 remains fill syntax without explicit size. |
> | E10115 static out-of-bounds index | Now E10240; E10115 remains invalid fill element. |
> | E10130/E10131 break/continue outside loop | Now E10063; E10130 and E10131 remain file-not-found and empty-embedded-file diagnostics. |
> | E10132 duplicate case | Now E10070; E10132 remains missing asset selector. |
> | E10140 empty enum | Now E10234; E10140 remains embedded-data size mismatch. |
> | E10143 enum backing range | Now E10233; E10143 remains asset-alignment conflict. |
> | E10151 unknown type | Now E10241; E10151 remains Boolean arithmetic/bitwise misuse. |
> | E10152 assignment mismatch | Select E10080, E10082, or E10235; E10152 remains cast to/from `void`. |
> | E10153 signedness mismatch | Now E10081; E10153 remains unsupported aggregate/function cast. |
> | E10154 narrowing | Now E10082; E10154 remains ordered comparison on Boolean. |
> | E10155 invalid cast | Retired as a catch-all; select E10080/E10082/E10086/E10152/E10153/E10235. No active E10155 exists. |
> | E10160 unknown struct field | Now E10242; E10160 remains constant division by zero. |
> | E10161 missing struct initializer field | Now E10096; E10161 remains invalid shift-amount type. |
> | E10162 extra struct initializer field | Now E10243; E10162 remains incompatible conditional arms. |
> | E10163 empty struct | Now E10090; E10163 is retired. |
> | E10170 wrong call arity | Now E10171; E10170 remains missing function return annotation. |
> | E10171 argument type mismatch | Now E10172; E10171 remains wrong argument count. |
> | E10172 missing return on a path | Now E10102; E10172 remains argument type mismatch. |
> | E10174 recursion | Now E10180/E10181; E10174 remains bare return in a non-void function. |
> | E10191 assignment to const | Now E10192; E10191 remains compile-time-evaluability failure. |
> | E10192 const without initializer | Now E10190; E10192 remains assignment to const. |
> | E10193 non-constant initializer | Now E10191; E10193 is retired. |
> | E10200 embed outside const | Now E10134; E10200 remains invalid `sizeof` argument. |
> | E10201 embedded file missing | Now E10130; E10201 remains invalid `offsetof` type. |
> | E10202 embedded size mismatch | Now E10140; E10202 remains invalid `offsetof` field. |
> | E10203 unknown asset selector | Now E10133; E10203 remains invalid `length` argument. |
> | W10130 unreachable code | Now W10131; W10130 remains the constant-false-condition warning. |
> 
> The current predicates are found in the owning diagnostic tables: [types](/work/spec/02-type-system.md:589), [variables](/work/spec/03-variables.md:510), [control flow](/work/spec/05-statements-control-flow.md:546), [functions](/work/spec/06-functions.md:922), [structs](/work/spec/07-structs.md:466), [arrays](/work/spec/08-arrays-strings.md:809), [enums](/work/spec/09-enums.md:275), [modules](/work/spec/10-modules.md:264), and [data inclusion](/work/spec/13-data-inclusion.md:221).
> 
> A clear collision example is **E10040**: “intrinsic arity” is only the former draft assignment; active E10040 is exclusively “cannot take the address of an inlined scalar constant.” Wrong arity is E10171.
> 
> ### Storage and lowering consequences — 7 rows
> 
> | Former assignment | Current storage/lowering contract |
> |---|---|
> | E10011 constant-only module initializer | Retired: runtime module `let` initializers are legal and execute once in compiler-generated startup before `main`. |
> | E10042 generic arity / field-element address restriction | Retired: fields and indexed elements are addressable places; their components evaluate once. |
> | E10093 struct return | Retired: fixed structs return through compiler-managed caller-owned destinations. |
> | E10119 whole-array assignment | Retired: exact-shape fixed arrays have ordinary value assignment. |
> | E10120 fixed-array return | Retired for fixed arrays; caller-owned destinations apply. Unsized `T[]` remains non-returnable under E10253. |
> | E10085 signed array index | Retired: every integer type is a valid final index; signed values follow the index-ordinal rules. |
> | E10117/E10118 array-tier index width | Retired: declaration size does not determine source legality; lowering may narrow only with an equivalence proof. |
> 
> These are governed by module initialization in [Chapter 03 §5.1](/work/spec/03-variables.md:388), addressable places and provenance in [Chapter 04 §8.2](/work/spec/04-expressions-operators.md:360), aggregate returns in [Chapter 06 FN-4/FN-5](/work/spec/06-functions.md:159), and fixed-array/index rules in [Chapter 08 AR-3–AR-5](/work/spec/08-arrays-strings.md:118).
> 
> They require real lowering and storage accounting; they are not merely removals of diagnostics. Startup expressions and callees enter SFA closure, aggregate returns may require caller destinations or SFA snapshots, and dynamic addresses may require runtime calculation. The specification does not establish whether any compiler implements those requirements.
> 
> ### Optimization/reporting consequences — 2 rows
> 
> | Former assignment | Current rule |
> |---|---|
> | W10142 declaration-size addressing warning | Retired: address selection is per access; actual cost belongs in the build report. |
> | W10060 word loop counter | Retired: narrowing an induction representation is an optimizer proof, not source advice or a legality rule. |
> 
> Chapter 08 requires access-specific selection based on proven range, element size, placement, and registers, with the selected forms and costs described in [§10](/work/spec/08-arrays-strings.md:657) and [§11](/work/spec/08-arrays-strings.md:795). No compiler limitation permits rejecting a word index/counter or demanding manual narrowing.
> 
> ## Boundary findings
> 
> - The active registry is the current public contract; the retained table is lineage needed to interpret older draft reports and avoid code/meaning confusion.
> - “Retired” can mean that a former restriction is now legal, that its syntax/API no longer exists, or that the condition moved to a different code. Those outcomes are materially different.
> - The crosswalk says former Specification 3 build, preflight, target-appendix, and migration material was removed from the **active corpus**. The packet supplies no filenames for those materials, so none can responsibly be invented or claimed physically deleted.
> - No current compiler status follows from this audit. Conformance of diagnostic selection, poisoning, SFA, lowering, generated assembly, artifacts, or runtime behavior remains **Unknown**.
> 
> Knowledge lineage: `skillVersion=2.0.1`; specification key `BLEND65-SPEC-4-1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf`; governing manifest key `BLEND65-SPEC-4-1c2a2d75`. The skill’s referenced `qualification/release.md` was not supplied, so its content-commit/activation record is **Unknown** rather than inferred.

</details>


<details>
<summary>candidate-ql29-final: packet manifest and exact captured text</summary>

```text
8111b2ebc7584ee427a16951be0bfafce199ae6166094de8befa9f092848ce68  SKILL.md
e4a9f2e3a50b59f4824ba39443ce8ff846f52134f5effdc0424b763805b5df38  agents/openai.yaml
36229972f5e3f173efcff032790ff77f743eb9723606593aede1aec8ab10eba9  control.py
eb16cb3e2b5c5d3caec1e73b04f35e4fbdac2d5df10d4b30b477bb0c852d8dc7  prompt.md
4f3ea96e261ba9cc8f62b16ab5a7ed7f616b4980b7fa6efff4624d336f9a95cd  references/6502-lowering-casebook.md
3dfda1f0ea2e33e1e8632f56fd08dbf02030300a5ad9f101c278539ebeda56a3  references/acme-and-artifacts.md
920ba4f16884ef06823d87d600c9bb9454e1e28b110c60dad89be03884dd683d  references/blend65-semantics.md
d3bcc7a53424be398a7ef2e4c331ba403b7f02d648fd177904704ae1194dc112  references/c64-game-engineering.md
ab551b788474a4459a72a1ba8775436c6d75aeb86830162cf136097fc1dfa186  references/c64-hardware.md
199ca9b200158e532a21325ed2f1ffd9d84741aa929a6654f9d07350b167b16c  references/c64-memory-and-runtime.md
893c724b6ec7a84dfd66e7e73d8669783459b56472b2bb503788bc664d814e85  references/compiler-architecture.md
d25a45598a7669bf28ac0725c472760e3918cfb29151862d8beba9bb40a05b31  references/evidence-parity-and-recovery.md
7b38b1c9888df1aae0b1f63862c1f1824e1f905b4465a3ef1a24da8d95d40549  references/il-and-optimization.md
68838b0e38c60198c165160f2823759239ab27d233f72ed1dfc1e9e6b49716bf  references/mos-6502-family.md
4ee1b17f456e47d2bd2c854c343559a677c8ef367ccdaf8b9b33ddc7fb2f2ffb  references/sfa-and-abi.md
4bca2b8bd8d3e0e0d115c291d11797ef12ecd3b2c0bc4316f3a518c951788392  references/source-manifest.md
028efcd8220207b3d370cf09075ffa99074b53833d2388a83305d0c24775e5b8  references/target-portability.md
37b19bc98a032223e28bed69b0c228b8ab9ba4b988d797d2ab51ee7f46091a28  scenarios.md
fa33c4a76fcb003d7682c00c86a64321ec7751410f334832b3fbc570612aa7b1  spec/06-functions.md
925c7eb49fd32093e2de791a8f4c8887e2797d2956429cf5974aca985933936c  spec/12-intrinsics.md
4c414a44de2106540eae29d89e370e412e93f40ee848fd72193cb9b750a7fef2  spec/14-diagnostics.md
9ed9c41cf7ed22cfc4d557951e5e0f3f9c0fcba7e4d4a2ff63cc35694234ba73  spec/15-platform-profile.md
70e822e3ec88506fd694303d98f37b8eacc0bf6cb4febb5fe7fea5d4f0fe25f2  spec/appendix-c64.md
83b7baac19b72e8eeced5b156cd2ce79a56bfc1391739283e11009787669d95b  spec/evaluations/F007-interrupt-functions.md
```

> ## Authority evaluation
> 
> ### Status
> 
> - **Source/platform contract — Verified complete.** Claim kind: **Fact** from the supplied packet.
> - **Concrete default build — Incorrect/rejected.** The visible `pokew($0314, &onRasterIRQ)` is an ABI mismatch and requires E10252. No final artifact may be emitted.
> - **Actual compiler lowering, assembly, installer size, artifact, runtime behavior, VICE result, and silicon behavior — Unknown.** None was supplied or observed.
> - **Release identity — Unknown.** `skillVersion=2.0.1` and specification identity `BLEND65-SPEC-4-1c2a2d75` are present, but the release record, content commit, and activation status were deliberately omitted and are not inferred.
> 
> The selected stock context is PAL `c64-pal-prg-kernal-6581`, NMOS 6510, KERNAL 901227-03, processor-port low DDR bits `$07`, latch bits `$06`, with VIC raster and CIA1 Timer A IRQs enabled. Its hardware stack has 256 bytes, a 20-byte reserve, 236 usable bytes, and a warning threshold of 188 bytes.
> 
> ## IRQ routes
> 
> The handler is a callback-only `interrupt function (): void`. Its address may flow through provenance-preserving assignments, copies, identity casts, and same-kind conditional merges. A recognized sink consumes that retained identity and selects a specialized entry address; it is not required to install the raw numeric address represented by `&onRasterIRQ`.
> 
> | Route | Concrete decision | Fixed path and terminal | Static/stack obligation |
> |---|---|---|---|
> | `setIRQ` on stock profile | **Accepted in isolation** | KERNAL CINV chain; saved predecessor owns eventual termination | Two-byte page-safe predecessor link; at least 9 live stack bytes while its helper executes |
> | `setIRQExclusive` with supplied VIC-only accounting | **Rejected** | No route may be emitted: enabled CIA1 Timer A would be abandoned | No wrapper cost may be claimed |
> | Exclusive variant that accounts for every enabled IRQ source | **Conditionally accepted** | KERNAL entry, then `$EA81` restore-only tail and ROM-owned `RTI` | No entry-chain link, but a two-byte predecessor is needed when later restoration is required; at least 8 stack bytes during helper |
> | `setRawIRQ` on the default KERNAL profile | **Unavailable/rejected** | `raw_interrupt_paths` is empty | No raw wrapper, vector installer, or raw root |
> | `setRawIRQ` on a proved raw profile, with complete source ownership | **Conditionally accepted** | Compiler save/restore and compiler-emitted `RTI` | Fixed `$FFFE/$FFFF` vector plus any saved predecessor required for restoration; at least 8 stack bytes during helper |
> | Visible `pokew($0314, &onRasterIRQ)` | **Rejected: E10252** | Raw entry cannot be installed at post-save CINV | No POKE or artifact is emitted |
> 
> ### Default chained IRQ
> 
> The required shape is:
> 
> ```asm
> ; CPU acceptance:
> ; push PCH, PCL, P; fetch $FFFE/$FFFF
> 
> ; existing 901227-03 PULS path:
> PHA
> TXA
> PHA
> TYA
> PHA
> ; test stacked B and select IRQ/BRK route
> JMP ($0314)
> 
> ; emitted chained variant:
> PHP
> CLD
>     ; body in source order, including ordinary:
>     JSR helper_irq_variant
>     ; ...
>     ; reference VIC raster acknowledgement when A is not already proven $01:
>     LDA #$01
>     STA $D019
> PLP
> JMP (saved_previous_cinv)
> ```
> 
> The `$D019` operation writes one to bit 0; it is not a read-modify-write. The compiler must preserve its volatile count and order.
> 
> Analytical costs, excluding the interrupted instruction, bus stalls, body, acknowledgement, and prior-handler path:
> 
> - Hardware acceptance: 7 cycles, 3 stack bytes.
> - KERNAL PULS-to-CINV: 29 cycles, 16 existing-ROM bytes, 6 live stack bytes.
> - Emitted wrapper: 14 cycles plus body, 6 output bytes plus body, 7 live stack bytes during the body.
> - Fixed path to the prior handler: **50 cycles plus body**.
> - The ordinary `JSR`/`RTS` transfer adds 12 cycles and two live stack bytes; the callsite is three bytes and the helper’s `RTS` one byte, possibly shared with other callers.
> - The reference VIC acknowledgement is 5 bytes and 6 cycles unless register knowledge permits an equivalent smaller sequence.
> - With the one helper call, at least **9 stack bytes** are live. The complete build peak remains Unknown because mainline depth, helper internals, other interrupts, and the prior handler were not supplied.
> 
> The wrapper restores entry flags before chaining. The saved predecessor—normally the stock handler—owns CIA1 servicing and the eventual `RTI`. Therefore VIC-only acknowledgement is compatible with this route: the generated handler owns VIC, while the prior KERNAL path remains responsible for CIA1.
> 
> The saved indirect link consumes two writable bytes. Its low address may be `$xxFE`; `$xxFF` must be relocated or rejected because of the NMOS indirect-jump wrap.
> 
> ### Exclusive CINV IRQ
> 
> With CIA1 Timer A enabled, the supplied handler’s VIC acknowledgement is insufficient. The `$EA81` path deliberately skips the normal KERNAL CIA1 ICR read. Consequently, a raster-only handler would leave CIA1 asserted or unserviced and must be rejected. The packet supplies no exact diagnostic number for this ownership failure, so none is invented.
> 
> If a conditional variant proves that it handles or disables every enabled IRQ source, its shape is:
> 
> ```asm
> ; CPU and KERNAL have already pushed status and A/X/Y
> CLD
>     ; body:
>     JSR helper_irq_variant
>     ; VIC acknowledgement
>     ; exactly complete CIA1/other-source handling
> JMP $EA81
> 
> ; existing six-byte ROM tail at $EA81:
> PLA
> TAY
> PLA
> TAX
> PLA
> RTI
> ```
> 
> Costs:
> 
> - 4 output wrapper bytes plus body.
> - 27 cycles plus body for the wrapper and ROM tail.
> - 16 existing-ROM entry bytes and 6 existing-ROM tail bytes, both zero output bytes.
> - **63 cycles plus body** from hardware IRQ acceptance.
> - Six stack bytes at body entry; at least eight during the ordinary helper call.
> - The final `RTI` restores the complete interrupted status, including D and I. No `PHP`/`PLP` pair belongs in this route.
> 
> The entry variant itself has no chain link. A predecessor word is nevertheless required for each simultaneously live install that must later restore the previous CINV.
> 
> ### Raw IRQ
> 
> The raw form is:
> 
> ```asm
> PHA
> TXA
> PHA
> TYA
> PHA
> CLD
>     ; body, helper call, VIC and every other owned source
> PLA
> TAY
> PLA
> TAX
> PLA
> RTI
> ```
> 
> It costs 12 output bytes and 37 cycles plus body after acceptance, or **44 cycles plus body** including the hardware’s 7 cycles. Six stack bytes are live at body entry and at least eight during the helper call. The compiler owns register preservation and the terminal `RTI`; no KERNAL entry or tail participates.
> 
> This route is legal only if both conditions hold:
> 
> 1. `$FFFE/$FFFF` is profile-proven writable and active in every relevant bank state.
> 2. The application handles or disables every enabled IRQ source, including CIA1 Timer A in the stated initial configuration.
> 
> A complete raw takeover must also establish its NMI vector and policy before exposing RAM vectors; proving only the IRQ address is insufficient for the full takeover transition.
> 
> If the raw vector is not proven writable and active, the profile must omit the raw path and `setRawIRQ` is unavailable. No raw variant, installer, static predecessor, stack root, or cost is introduced.
> 
> A vector already visible as active is not automatically writable safely. A maskable IRQ update can be legal only under a separately proved interrupt-masked transaction. No such proof is supplied here, so the already-visible/unproved case is rejected. This differs from NMI: `SEI` can never protect an NMI vector update.
> 
> ## Installation and release
> 
> ### CINV installation
> 
> The stock installer is a caller-state-preserving, interrupt-disabled two-byte transaction of this shape:
> 
> ```asm
> PHP
> PHA
> SEI
>     ; save current $0314/$0315 into the current LIFO predecessor word
>     ; install both bytes of the selected specialized entry address
> PLA
> PLP
> ```
> 
> The precise byte order, emitted instruction selection, bytes, and cycles must come from final assembly; none exists in the packet, so those measurements are Unknown.
> 
> Installation ownership is a compile-time per-sink LIFO effect:
> 
> - Each simultaneously live install that must chain or later restore requires one two-byte predecessor word.
> - A clean nested restore reinstates the exact predecessor.
> - An unbounded install depth is E10245.
> - Underflow, out-of-order/cross-sink restoration, unequal control-flow states, or restoration after a raw vector write is E10278.
> - A returning cooperative PRG must empty its ownership stacks before return. A permitted nonreturning path may retain ownership.
> 
> ### Final exclusive `restoreIRQ()`
> 
> On the final exclusive release in the four cooperative PRG profiles, restoration is not merely a vector write. It performs the approved stock CIA1 handback inside the existing `PHP; PHA; SEI … PLA; PLP` transaction:
> 
> 1. Write `$1F` to `$DC0D` to clear all five CIA1 masks.
> 2. Stop Timer A while retaining CRA bit 7; set `CRB=$08`.
> 3. Read `$DC0D` exactly once, consuming ending-game pending events.
> 4. Program PAL Timer A reload `$4025`, low `$25` then high `$40`.
> 5. Restore both exact saved CINV bytes.
> 6. Write `$81` to `$DC0D`, enabling only Timer A.
> 7. Load/start Timer A with CRA `(old & $80) | $11`.
> 8. Execute `PLA; PLP`, restoring caller I and D.
> 
> This cannot reconstruct arbitrary prior masks or reload latches because those are write-only. It restores the pinned stock service, does not reconstruct missed KERNAL ticks, and does not broaden ownership to CIA2, NMI, VIC, D64, or raw takeover. It adds no runtime flag, scheduler, hidden storage, ZP scratch, or SFA slot. Exact inline bytes and cycles remain Unknown without emitted assembly.
> 
> ## NMI routes required by the raw scenario
> 
> The supplied handler’s VIC acknowledgement is not an acknowledgement of CIA2, RESTORE, or cartridge NMI. More importantly, the ordinary stock scenario supplies neither a finite NMI re-entry bound nor a certified two-byte NMINV update. Because NMI is not blocked by I and every route consumes stack, the concrete stock NMI installation is rejected with E10245 for unbounded overlap; installation safety is independently unproved.
> 
> The entry ABIs are nevertheless determinate:
> 
> | Route | Conditional instruction shape | Fixed cost | Stack/terminal |
> |---|---|---:|---|
> | Stock `NMINV` chain | `PHP; save A/X/Y; CLD; body; restore Y/X/A; PLP; JMP (savedNMIV)` | 16 output bytes, 43 cycles plus body; **57 plus body** from acceptance; 4 existing ROM bytes | 7 body-entry bytes, at least 9 during helper; predecessor owns terminal |
> | Exclusive `NMINV` | `save A/X/Y; CLD; body; restore Y/X/A; RTI` | 12 output bytes, 37 cycles plus body; **51 plus body** from acceptance | 6 body-entry bytes, at least 8 during helper; compiler `RTI` |
> | Raw `$FFFA/$FFFB` | Same compiler save/restore/`RTI` | 12 output bytes, 37 cycles plus body; **44 plus body** from acceptance | At least 8 during helper; compiler `RTI` |
> 
> The stock pre-entry stub is exactly:
> 
> ```asm
> SEI
> JMP ($0318)
> ```
> 
> It costs 7 cycles and occupies 4 existing ROM bytes. It saves no registers and does not clear decimal mode.
> 
> The chained output shape is:
> 
> ```asm
> PHP
> PHA
> TXA
> PHA
> TYA
> PHA
> CLD
>     ; body, including JSR/RTS helper
> PLA
> TAY
> PLA
> TAX
> PLA
> PLP
> JMP (saved_previous_nminv)
> ```
> 
> Status must be pushed before A/X/Y so it can be restored immediately before the chain. A simple chain must not read `$DD0D`; the saved stock handler owns and consumes CIA2 ICR state. The supplied VIC write is irrelevant to the triggering NMI but does not replace the required chain.
> 
> Exclusive or raw NMI becomes legal only under the hypothetical finite-source/bounded-nesting contract when all of the following are proven:
> 
> - A finite re-entry bound with disjoint SFA homes and sufficient cumulative stack.
> - CIA2 ownership: exactly one `$DD0D` read, all simultaneously returned bits handled, and any continuing mask restored from software-owned state.
> - Defined behavior for physical RESTORE and every possible cartridge NMI, or proof that each is absent.
> - A safe vector update.
> - Raw-vector visibility and handler visibility for every reachable bank state.
> 
> Writing `$0318/$0319` cannot be protected by `SEI`. Installation therefore requires either a profile-proven NMI-quiescent window or an update protocol in which every torn intermediate address is valid. For raw takeover, the complete underlying `$FFFA/$FFFB` RAM vector must be populated while the ROM route is still valid, followed by the single mapping transition. An already active raw NMI vector cannot be rewritten merely by setting I.
> 
> No finite NMI stack number is manufactured. The exact peak depends on the hypothetical nesting bound, helper path, concurrent IRQ/mainline depth, and explicit pushes.
> 
> ## Static allocation and compiler boundary
> 
> For every accepted route, the build must report:
> 
> - Every reachable wrapper and any duplicated handler/helper machine-code variant.
> - Two bytes per live saved predecessor required for chaining or restoration.
> - Fixed raw vector bytes where applicable.
> - All handler/helper parameters, locals, staging, temporaries, spills, ZP pairs, and helper scratch.
> - Disjoint SFA homes for mainline, IRQ, NMI, and bounded nested activations that can overlap.
> - Hardware-stack peak, showing calls, interrupt frames, and explicit pushes separately.
> - ROM/output bytes, RAM, ZP, installer/release code, and cycles.
> - Existing ROM separately: 16 bytes for PULS-to-CINV, 6 bytes for `$EA81`, and 4 bytes for the NMI stub.
> 
> No SFA amount is derivable because the helper body, locals, liveness, mainline callers, nesting bound, and final instruction selection are absent. The final total must fit the profile’s 142-byte ZP maximum, 51,199-byte RAM/binary budgets, and 236-byte usable stack capacity.
> 
> The responsibility boundaries are:
> 
> 1. Semantic analysis keeps the callback-only handler kind and source identity. Directly calling it is E10051; a known ordinary function at the sink is E10244; erased provenance at a recognized sink is E10247.
> 2. The selected profile chooses CINV, exclusive, raw IRQ, NMINV, exclusive NMI, or raw NMI. The front end must not encode C64 vector addresses as language semantics.
> 3. Whole-program/SFA analysis establishes reachability, ownership, finite preemption, disjoint static homes, links, and stack/resource closure.
> 4. Target lowering emits the exact wrapper, decimal normalization, volatile acknowledgement, helper ABI, and terminal form.
> 5. The emitter only renders the already-selected machine program; it may not invent the ABI or late storage.
> 6. Artifact execution, VICE observation, and physical-hardware behavior are separate proof boundaries and remain Unknown here.
> 
> A general `pokew` remains an ordinary legal volatile intrinsic. What is illegal is this compiler-visible pairing of a raw interrupt entry with the incompatible firmware CINV vector. Making the address genuinely opaque crosses into an explicit unsafe hardware boundary: the compiler must retain reachability where visible, but cannot certify its entry, exit, or ownership convention.
> 
> Evidence: [prompt.md](/work/prompt.md), [scenarios.md](/work/scenarios.md), [function interrupt contract](/work/spec/06-functions.md:662), [profile interrupt metadata](/work/spec/15-platform-profile.md:242), [C64 IRQ routes](/work/spec/appendix-c64.md:746), [interrupt completion gate](/work/references/sfa-and-abi.md:327), [C64 entry/exit contracts](/work/references/c64-memory-and-runtime.md:313), and [VIC/CIA effects](/work/references/c64-hardware.md:41). Governing source-manifest keys are `BLEND65-SPEC-4-1c2a2d75`, `MOS-PGM-1976`, `CBM-C64-PRG-1982`, `CBM-C64-KERNAL-03`, `MOS-6526-1981`, `CSG-6567-318014`, and `VIC-BAUER-2024`.

</details>


<details>
<summary>candidate-ql29-source-probe: packet manifest and exact captured text</summary>

```text
8111b2ebc7584ee427a16951be0bfafce199ae6166094de8befa9f092848ce68  SKILL.md
e4a9f2e3a50b59f4824ba39443ce8ff846f52134f5effdc0424b763805b5df38  agents/openai.yaml
36229972f5e3f173efcff032790ff77f743eb9723606593aede1aec8ab10eba9  control.py
b48eaf6e8bd5c12d618d28cc7bd017bad7e8ae0e062533c1f5f8d1c3e02112f0  prompt.md
4f3ea96e261ba9cc8f62b16ab5a7ed7f616b4980b7fa6efff4624d336f9a95cd  references/6502-lowering-casebook.md
3dfda1f0ea2e33e1e8632f56fd08dbf02030300a5ad9f101c278539ebeda56a3  references/acme-and-artifacts.md
f4353dbb552e470084be965b963cb161ede43c0407fc6eaf344d3c096dea2437  references/blend65-semantics.md
d3bcc7a53424be398a7ef2e4c331ba403b7f02d648fd177904704ae1194dc112  references/c64-game-engineering.md
ab551b788474a4459a72a1ba8775436c6d75aeb86830162cf136097fc1dfa186  references/c64-hardware.md
199ca9b200158e532a21325ed2f1ffd9d84741aa929a6654f9d07350b167b16c  references/c64-memory-and-runtime.md
893c724b6ec7a84dfd66e7e73d8669783459b56472b2bb503788bc664d814e85  references/compiler-architecture.md
d25a45598a7669bf28ac0725c472760e3918cfb29151862d8beba9bb40a05b31  references/evidence-parity-and-recovery.md
7b38b1c9888df1aae0b1f63862c1f1824e1f905b4465a3ef1a24da8d95d40549  references/il-and-optimization.md
68838b0e38c60198c165160f2823759239ab27d233f72ed1dfc1e9e6b49716bf  references/mos-6502-family.md
4ee1b17f456e47d2bd2c854c343559a677c8ef367ccdaf8b9b33ddc7fb2f2ffb  references/sfa-and-abi.md
4bca2b8bd8d3e0e0d115c291d11797ef12ecd3b2c0bc4316f3a518c951788392  references/source-manifest.md
028efcd8220207b3d370cf09075ffa99074b53833d2388a83305d0c24775e5b8  references/target-portability.md
37b19bc98a032223e28bed69b0c228b8ab9ba4b988d797d2ab51ee7f46091a28  scenarios.md
fa33c4a76fcb003d7682c00c86a64321ec7751410f334832b3fbc570612aa7b1  spec/06-functions.md
925c7eb49fd32093e2de791a8f4c8887e2797d2956429cf5974aca985933936c  spec/12-intrinsics.md
4c414a44de2106540eae29d89e370e412e93f40ee848fd72193cb9b750a7fef2  spec/14-diagnostics.md
9ed9c41cf7ed22cfc4d557951e5e0f3f9c0fcba7e4d4a2ff63cc35694234ba73  spec/15-platform-profile.md
70e822e3ec88506fd694303d98f37b8eacc0bf6cb4febb5fe7fea5d4f0fe25f2  spec/appendix-c64.md
83b7baac19b72e8eeced5b156cd2ce79a56bfc1391739283e11009787669d95b  spec/evaluations/F007-interrupt-functions.md
```

> ## Independent authority evaluation — Q‑L29
> 
> Context: NMOS MOS 6510, stock PAL/6581 cooperative KERNAL profile, KERNAL 901227‑03, `$0000` low bits `$07`, `$0001` low bits `$06`, VIC raster IRQ and stock CIA1 Timer A enabled.
> 
> ### Findings
> 
> | Boundary | Status | Claim kind | Conclusion |
> |---|---|---|---|
> | Source CPU-control contract | Verified complete | Fact | The closed source surface is `asm_sei()`, `asm_cli()`, `asm_php()`, `asm_plp()`, and `asm_nop()`. |
> | `pokew($0314, &onRasterIRQ)` | Incorrect | Fact | `$0314/$0315` is the post-A/X/Y-save KERNAL CINV hook. Installing a raw-entry address there is E10252. |
> | Cooperative source correction | Verified complete | Recommendation | Use the typed `setIRQ(&onRasterIRQ)` sink without converting the handler to `word`. |
> | Exclusive route for the supplied handler | Unknown | Unknown | VIC acknowledgement is stated, but ownership, disabling, or servicing of enabled CIA1 Timer A is not supplied. |
> | Raw route in the stated stock profile | Incorrect | Fact | `$06` keeps KERNAL ROM active and the cooperative profile does not expose `setRawIRQ`. |
> | Current compiler lowering, bytes, and runtime | Unknown | Unknown | No compiler, assembly, artifact, cost report, VICE run, or hardware observation was supplied. |
> 
> ### Source-level status controls
> 
> The developer can write:
> 
> - `asm_sei()` and `asm_cli()` to set or clear only `I`. `SEI` does not mask NMI.
> - A balanced `asm_php()`/`asm_plp()` pair to preserve and restore the source-owned status snapshot. It cannot consume the CPU interrupt frame or compiler ABI saves. Unbalanced paths are E10248, and every live save adds one stack byte.
> - `asm_nop()` for an exact two-cycle ordered effect; it does not change status.
> 
> There is no source `asm_cld()` or `asm_sed()`, nor arbitrary flag-setting or inline assembly. Consequently, source can directly adjust `I` and can preserve/restore its own status, but it cannot take ownership of interrupt-entry decimal normalization. These controls are specified in [spec/12-intrinsics.md](/work/spec/12-intrinsics.md:25).
> 
> Compiler-owned normalization is a separate ABI obligation:
> 
> - NMOS IRQ entry does not clear `D`.
> - Every materialized handler variant must give the first Blend65 statement and initially called ordinary helper `D=0`.
> - The default chain must use `PHP; CLD; body/ack; PLP` so the prior CINV handler receives its original flags.
> - Exclusive and raw routes use `CLD` without another status save; their eventual `RTI` restores the complete interrupted status, including the original `D` and `I`.
> - Source `PHP`/`PLP` executes inside that normalized body and cannot replace or interfere with the compiler-owned save.
> 
> These obligations are defined in [spec/06-functions.md](/work/spec/06-functions.md:701) and the route gate in [references/sfa-and-abi.md](/work/references/sfa-and-abi.md:327).
> 
> ### Corrected source
> 
> For the stated cooperative program:
> 
> ```blend65
> import { restoreIRQ, setIRQ } from c64.system;
> 
> interrupt function onRasterIRQ(): void {
>     poke($D019, $01); // acknowledge the VIC raster latch by writing bit 0 as one
>     ordinaryHelper();
> }
> 
> function main(): void {
>     setIRQ(&onRasterIRQ);
> 
>     // program
> 
>     restoreIRQ(); // required before returning under the cooperative profile
> }
> ```
> 
> The material correction is:
> 
> ```blend65
> setIRQ(&onRasterIRQ);
> ```
> 
> not:
> 
> ```blend65
> pokew($0314, word(&onRasterIRQ)); // E10252
> ```
> 
> The typed sink must prove all of the following:
> 
> - `onRasterIRQ` is the callback-only `interrupt function (): void` identity, with no `word` conversion or erased provenance.
> - The sink selects the no-second-save CINV-chain variant; it must neither save A/X/Y again nor execute `RTI` directly.
> - Installation is atomic, and the prior CINV is retained in a two-byte link whose address begins no later than `$xxFE`; `$xxFF` must be relocated or rejected.
> - The VIC acknowledgement has the correct volatile operation and order: write one to `$D019` bit 0, not an unproved memory RMW.
> - The saved prior CINV is chained exactly once, allowing the enabled stock CIA1 service to run.
> - Install/restore ownership is finite, LIFO-balanced, and consistent at every control-flow join and program return.
> - The ordinary helper retains `JSR`/`RTS`. Its complete parameters, locals, temporaries, spills, pointer pairs, and late scratch are separated from every overlapping mainline/IRQ/NMI activation.
> - Interrupt nesting is bounded, shared-state hazards are diagnosed, and the complete RAM, ZP, ROM, stack, banking, and timing costs fit the profile.
> 
> The known route baseline is 7 CPU-acceptance cycles, 29 cycles and 16 existing-ROM bytes from KERNAL entry to CINV, then 14 cycles and 6 output bytes for the chain wrapper/tail, plus the body, acknowledgement, helper, prior-handler path, and stalls. It uses a two-byte saved-CINV link and seven stack bytes before calls; the one ordinary helper call raises the instantaneous baseline to at least nine stack bytes. The full total, installer cost, SFA use, and emitted bytes remain unknown without output.
> 
> ### Other typed sinks
> 
> - `setIRQExclusive(&onRasterIRQ)` is only valid after proving ownership of every enabled IRQ source. Here CIA1 Timer A remains enabled but is not accounted for, so exclusive selection is not certified. Its required baseline would be 63 cycles plus body/ack from IRQ acceptance, 4 output wrapper bytes, 16 existing entry-ROM bytes, and the 6-byte existing-ROM `$EA81` tail; stack baseline is six bytes plus calls.
> - `setRawIRQ(&onRasterIRQ)` belongs only to a takeover profile. It requires `$FFFE/$FFFF` to be completely populated in underlying RAM before changing the mapping from `$06` to `$05`, with valid routes on both sides and valid vector/handler visibility in every reachable bank state. An unproved or already exposed two-byte transition is rejected. Its generic baseline is 44 cycles from acceptance, 12 output bytes plus body, and six stack bytes plus calls.
> 
> Exact route contracts and costs are in [spec/appendix-c64.md](/work/spec/appendix-c64.md:746) and [references/c64-memory-and-runtime.md](/work/references/c64-memory-and-runtime.md:313).
> 
> Obscuring `$0314` or transforming the handler address is not a safe remedy. It may hide the recognizable E10252 pattern, but it does not transform the raw entry into the required post-save CINV variant, restore the prior status, select the correct terminal, or prove the external caller’s stack convention. It also erases provenance, causing E10247 if later passed to a typed sink, and a raw vector mutation can invalidate helper ownership, making a later restore E10278.
> 
> Lineage: `skillVersion=2.0.1`; specification identity `BLEND65-SPEC-4-1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf`; governing manifest keys `Q-L29`, `Q-C07`, `Q-C09`, `Q-P07`, `Q-P08`, and `Q-P09`. The packet contains no `qualification/release.md`, so the skill content commit and activation status are `Unknown`; the specification digest must not be treated as that missing release record.

</details>


<details>
<summary>candidate-ql29-final-grade: packet manifest and exact captured text</summary>

```text
6cd9a5036cf5aa721231c613bf51ffa5d02c55e9eb101aee01c00262ee4801bf  answer.md
e1a14afa11ff99d9c271e2c3352bf943d368c2d5b3624399a9942a84f8bc7e91  control.py
83dcf60ef668a0f95d9aa10ea292e0a2782e6e04598bf7996180793faf586fb7  oracle.md
fc1e91a459a65965f2a48c66fa7fd12dc581057f6d53ec3e4fc9483a48adecf2  prompt.md
```

> **Q-L29 — Pass**, grading both captures jointly against the frozen oracle. This is a contract/knowledge pass, not verification of compiler output or execution.
> 
> - **Handler identity and entry selection:** [answer.md:16](/work/answer.md:16) states that a recognized sink “consumes that retained identity and selects a specialized entry address.” This satisfies the identity and sink-selected variant obligation in [oracle.md:20](/work/oracle.md:20).
> - **CINV chain:** The assembly at [answer.md:44](/work/answer.md:44) supplies `PHP`, `CLD`, ordinary helper invocation, explicit VIC acknowledgement, `PLP`, and indirect chaining without another register save. [answer.md:71](/work/answer.md:71) explicitly permits `$xxFE` and requires `$xxFF` to be “relocated or rejected,” satisfying [oracle.md:21](/work/oracle.md:21).
> - **Exclusive and raw paths:** [answer.md:77](/work/answer.md:77) conditions exclusive acceptance on ownership of every enabled source and supplies `CLD` followed by `JMP $EA81`. [answer.md:112](/work/answer.md:112) supplies the raw register-save/normalization/restore/`RTI` path. [answer.md:137](/work/answer.md:137) makes raw installation unavailable without writable/active-vector proof. These meet [oracle.md:24](/work/oracle.md:24).
> - **Decimal ownership and helper ABI:** The complementary capture explicitly says, “There is no source `asm_cld()` or `asm_sed()`” at [answer.md:290](/work/answer.md:290), then establishes body/helper `D=0` and outgoing-status restoration. [answer.md:343](/work/answer.md:343) preserves `JSR`/`RTS` and separates overlapping invocation storage. These satisfy [oracle.md:28](/work/oracle.md:28).
> - **Storage, costs, and compiler boundaries:** [answer.md:239](/work/answer.md:239) requires reporting reachable wrappers, duplicated bodies/helpers, predecessor words, private storage, stack, installer/release code, and resource/cycle costs. [answer.md:254](/work/answer.md:254) assigns semantic, profile, SFA, lowering, and emission responsibilities. Analytical route costs are supplied; actual output and execution remain explicitly **Unknown**, as required.
> - **Exact rejection and separate remedy:** [answer.md:8](/work/answer.md:8) assigns E10252 to `pokew($0314, &onRasterIRQ)`. [answer.md:277](/work/answer.md:277) separately labels typed `setIRQ(&onRasterIRQ)` as a recommendation, satisfying [oracle.md:45](/work/oracle.md:45).
> 
> **Contradiction:** The source probe’s blanket statement, “An unproved or already exposed two-byte transition is rejected” ([answer.md:351](/work/answer.md:351)), conflicts with the final capture’s allowance for an already-active IRQ-vector update under a separately proved interrupt-masked transaction ([answer.md:139](/work/answer.md:139)). This overbroad rejection does not introduce a frozen-oracle disqualifier: both captures reject the required unproved raw-installation case.
> 
> The exclusive-route labels “Unknown” and “Rejected” are compatible here: missing ownership evidence prevents certification; neither capture accepts that route without proof.

</details>


<details>
<summary>candidate-qc13-proof: packet manifest and exact captured text</summary>

```text
8111b2ebc7584ee427a16951be0bfafce199ae6166094de8befa9f092848ce68  SKILL.md
e4a9f2e3a50b59f4824ba39443ce8ff846f52134f5effdc0424b763805b5df38  agents/openai.yaml
36229972f5e3f173efcff032790ff77f743eb9723606593aede1aec8ab10eba9  control.py
41b57aabed1611dd157e6056f530eac3fd4f13e4143424ea922e5f9ce815e734  prompt.md
4f3ea96e261ba9cc8f62b16ab5a7ed7f616b4980b7fa6efff4624d336f9a95cd  references/6502-lowering-casebook.md
3dfda1f0ea2e33e1e8632f56fd08dbf02030300a5ad9f101c278539ebeda56a3  references/acme-and-artifacts.md
f4353dbb552e470084be965b963cb161ede43c0407fc6eaf344d3c096dea2437  references/blend65-semantics.md
d3bcc7a53424be398a7ef2e4c331ba403b7f02d648fd177904704ae1194dc112  references/c64-game-engineering.md
ab551b788474a4459a72a1ba8775436c6d75aeb86830162cf136097fc1dfa186  references/c64-hardware.md
199ca9b200158e532a21325ed2f1ffd9d84741aa929a6654f9d07350b167b16c  references/c64-memory-and-runtime.md
893c724b6ec7a84dfd66e7e73d8669783459b56472b2bb503788bc664d814e85  references/compiler-architecture.md
d25a45598a7669bf28ac0725c472760e3918cfb29151862d8beba9bb40a05b31  references/evidence-parity-and-recovery.md
7b38b1c9888df1aae0b1f63862c1f1824e1f905b4465a3ef1a24da8d95d40549  references/il-and-optimization.md
68838b0e38c60198c165160f2823759239ab27d233f72ed1dfc1e9e6b49716bf  references/mos-6502-family.md
4ee1b17f456e47d2bd2c854c343559a677c8ef367ccdaf8b9b33ddc7fb2f2ffb  references/sfa-and-abi.md
4bca2b8bd8d3e0e0d115c291d11797ef12ecd3b2c0bc4316f3a518c951788392  references/source-manifest.md
028efcd8220207b3d370cf09075ffa99074b53833d2388a83305d0c24775e5b8  references/target-portability.md
73f7deb046abcc2caa6bcced73bd62c741bb2c0e954b16cfb1633e3cbdab8651  spec/02-type-system.md
1dcefd066aee1e9a35e255172a5c772a442092ff57e8ebf2076803934ff2d4e8  spec/04-expressions-operators.md
```

> Signed `>>` must sign-extend. A negative signed operand therefore yields `-1` at counts at least its width; unsigned `>>` and every `<<` yield zero at those counts. Counts are not masked.
> 
> **Status:** `Verified complete` for the packet-based language result and the bounded analytical proofs below. Actual compiler lowering, assembled artifacts, execution, and measured timing are each `Unknown`.
> 
> The governing language evidence is [TS-19 and TS-20](/work/spec/02-type-system.md:499) and [Chapter 04’s bitwise rules](/work/spec/04-expressions-operators.md:198). Instruction legality, flags, and costs come from the packet’s [NMOS instruction grid](/work/references/mos-6502-family.md:97), [instruction effects](/work/references/mos-6502-family.md:166), and [bus-access rules](/work/references/mos-6502-family.md:192).
> 
> All costs below concern inline operations with compile-time constant counts. Bytes start in A and finish in A. Words occupy an overwritable, little-endian pair `L/H` in ordinary absolute RAM and finish there. A is available for the word sequences that use it; X, Y, and S remain unchanged. There are no live flags, concurrent operand observers, banking changes, interrupts, or bus stalls during the operation. These preconditions permit intermediate RAM writes. Preserving a separate live source requires a different storage contract and corresponding costs.
> 
> The optimization objective is not supplied. My recommendation favors smaller code at equal cycles within this ordinary-RAM scope, while exposing the extra memory traffic.
> 
> The numerical result follows independently from the language rule. For width \(w\), let \(u\) be the unsigned bit pattern, \(s\) its top bit, and \(x=u-s2^w\) its signed value:
> 
> \[
> \begin{aligned}
> \text{unsigned }u\gg k &= \lfloor u/2^k\rfloor,\\
> \text{signed }x\gg k &= \lfloor x/2^k\rfloor,\\
> u\ll k &= u2^k\bmod 2^w.
> \end{aligned}
> \]
> 
> For \(k\ge w\), these give unsigned right zero, signed right \(-s\), and left zero. Arithmetic right shift rounds negative values downward; it is not truncation-toward-zero division.
> 
> All entries below are hexadecimal bit patterns at the original operand width.
> 
> | Operand and operation | 0 | 1 | 7 | 8 | 15 | 16 | 17 |
> |---|---:|---:|---:|---:|---:|---:|---:|
> | signed `$80 >>` | 80 | C0 | FF | FF | FF | FF | FF |
> | signed `$7F >>` | 7F | 3F | 00 | 00 | 00 | 00 | 00 |
> | signed `$80 <<` | 80 | 00 | 00 | 00 | 00 | 00 | 00 |
> | signed `$7F <<` | 7F | FE | 80 | 00 | 00 | 00 | 00 |
> | unsigned `$FF >>` | FF | 7F | 01 | 00 | 00 | 00 | 00 |
> | unsigned `$FF <<` | FF | FE | 80 | 00 | 00 | 00 | 00 |
> | signed `$8001 >>` | 8001 | C000 | FF00 | FF80 | FFFF | FFFF | FFFF |
> | signed `$7FFF >>` | 7FFF | 3FFF | 00FF | 007F | 0000 | 0000 | 0000 |
> | signed `$8001 <<` | 8001 | 0002 | 0080 | 0100 | 8000 | 0000 | 0000 |
> | signed `$7FFF <<` | 7FFF | FFFE | FF80 | FF00 | 8000 | 0000 | 0000 |
> | unsigned `$FFFF >>` | FFFF | 7FFF | 01FF | 00FF | 0001 | 0000 | 0000 |
> | unsigned `$FFFF <<` | FFFF | FFFE | FF80 | FF00 | 8000 | 0000 | 0000 |
> 
> Counts must have an unsigned type; a signed count triggers E10161. W10174 applies to the supplied byte counts 8, 15, 16, 17 and word counts 16, 17. The shorter signed forms at byte count 7 and word count 15 do not change that warning threshold.
> 
> For byte lowering, use these exact streams. `I` means no instruction; `BZ` means `LDA #$00`.
> 
> | ID | Actual instruction sequence |
> |---|---|
> | BS1 | `CMP #$80; ROR A` |
> | BU1 | `LSR A` |
> | BL1 | `ASL A` |
> | BU7 | `ASL A; LDA #$00; ROL A` |
> | BL7 | `LSR A; LDA #$00; ROR A` |
> 
> The signed terminal form, **BSF**, is:
> 
> ```asm
> ASL A
> LDA #$FF
> BCS done
> LDA #$00
> done:
> ```
> 
> It applies to every signed byte count **at least 7**, because every signed byte divided by \(128\), with floor rounding, is either `-1` or zero.
> 
> For the flag ledger, `NZ(t)` means `N=bit7(t)` and `Z=(t==0)`. Let \(b_i\) denote original input bit \(i\), and \(s=b_7\). Let `p=1` when the taken fill branch crosses a page, otherwise zero.
> 
> | Operation/count | ID | Complete code bytes | Cycles | Operand reads/writes | Final N/Z | Final C |
> |---|---|---:|---:|---:|---|---|
> | Any byte shift, 0 | I | 0 | 0 | 0/0 | incoming | incoming |
> | Signed right, 1 | BS1 | 3 | 4 | 0/0 | NZ(result) | \(b_0\) |
> | Signed right, 7, 8, 15, 16, 17 | BSF | 7 | negative `7+p`; nonnegative 8 | 0/0 | \(s,\neg s\) | \(s\) |
> | Unsigned right, 1 | BU1 | 1 | 2 | 0/0 | NZ(result), N=0 | \(b_0\) |
> | Unsigned right, 7 | BU7 | 4 | 6 | 0/0 | \(0,\neg b_7\) | 0 |
> | Either left, 1 | BL1 | 1 | 2 | 0/0 | NZ(result) | \(b_7\) |
> | Either left, 7 | BL7 | 4 | 6 | 0/0 | \(b_0,\neg b_0\) | 0 |
> | Unsigned right or either left, 8, 15, 16, 17 | BZ | 2 | 2 | 0/0 | 0,1 | incoming |
> 
> Every byte stream preserves V, D, and I. A contains the numerical result. In particular, `LDA #$00` does **not** establish `C=0`.
> 
> The decisive byte reasoning is:
> 
> - BS1: `CMP #$80` sets C to the original sign. `ROR A` produces \(a'=\lfloor a/2\rfloor+128s\). Its signed interpretation is \(\lfloor(a-256s)/2\rfloor\), proving arithmetic shift for all 256 inputs.
> - BSF: `ASL A` extracts the original sign into C; the damaged accumulator value is discarded. The loads preserve C, and the branch selects precisely `$FF` for negative input and `$00` otherwise.
> - BU7: `ASL` extracts \(b_7\); rotating it into a freshly loaded zero produces \(b_7\), the unsigned quotient by 128.
> - BL7: `LSR` extracts \(b_0\); rotating it into zero produces \(128b_0\), the wrapped product by 128.
> 
> For words, use the following exact streams. **WI** is empty; **WZ** is `LDA #$00; STA L; STA H`.
> 
> | ID | Actual instruction sequence |
> |---|---|
> | WS1 | `LDA H; ASL A; ROR H; ROR L` |
> | WU1 | `LSR H; ROR L` |
> | WL1 | `ASL L; ROL H` |
> | WU7 | `ASL L; LDA H; ROL A; STA L; LDA #$00; ROL A; STA H` |
> | WL7 | `LSR H; LDA L; ROR A; STA H; LDA #$00; ROR A; STA L` |
> | WU8 | `LDA H; STA L; LDA #$00; STA H` |
> | WL8 | `LDA L; STA H; LDA #$00; STA L` |
> | WU15 | `ASL H; LDA #$00; ROL A; STA L; LSR A; STA H` |
> | WL15 | `LSR L; LDA #$00; ROR A; STA H; ASL A; STA L` |
> 
> **WS7** is:
> 
> ```asm
> ASL L
> LDA H
> ROL A
> STA L
> LDA #$FF
> BCS fill
> LDA #$00
> fill:
> STA H
> ```
> 
> **WS8** is:
> 
> ```asm
> LDA H
> STA L
> ASL A
> LDA #$FF
> BCS fill
> LDA #$00
> fill:
> STA H
> ```
> 
> **WSF**, for signed counts at least 15, is:
> 
> ```asm
> LDA #$00
> BIT H
> BPL fill
> LDA #$FF
> fill:
> STA L
> STA H
> ```
> 
> Let \(s=b_{15}\), and let `rL/rH` be the final result bytes. The signed fill branches retain the same definition of `p`.
> 
> | Operation/count | ID | Complete code bytes | Cycles | Operand reads/writes | Final N/Z | Final C |
> |---|---|---:|---:|---:|---|---|
> | Any word shift, 0 | WI | 0 | 0 | 0/0 | incoming | incoming |
> | Signed right, 1 | WS1 | 10 | 18 | 3/4 | NZ(rL) | \(b_0\) |
> | Signed right, 7 | WS7 | 19 | negative `25+p`; nonnegative 26 | 2/4 | \(s,\neg s\) | \(s\) |
> | Signed right, 8 | WS8 | 16 | negative `19+p`; nonnegative 20 | 1/2 | \(s,\neg s\) | \(s\) |
> | Signed right, 15, 16, 17 | WSF | 15 | nonnegative `17+p`; negative 18 | 1/2 | \(s,\neg s\) | incoming |
> | Unsigned right, 1 | WU1 | 6 | 12 | 2/4 | NZ(rL) | \(b_0\) |
> | Unsigned right, 7 | WU7 | 16 | 24 | 2/4 | \(0,\neg b_{15}\) | 0 |
> | Unsigned right, 8 | WU8 | 11 | 14 | 1/2 | 0,1 | incoming |
> | Unsigned right, 15 | WU15 | 13 | 20 | 1/4 | 0,1 | \(b_{15}\) |
> | Unsigned right, 16, 17 | WZ | 8 | 10 | 0/2 | 0,1 | incoming |
> | Either left, 1 | WL1 | 6 | 12 | 2/4 | NZ(rH) | \(b_{15}\) |
> | Either left, 7 | WL7 | 16 | 24 | 2/4 | \(b_0,\neg b_0\) | 0 |
> | Either left, 8 | WL8 | 11 | 14 | 1/2 | 0,1 | incoming |
> | Either left, 15 | WL15 | 13 | 20 | 1/4 | 0,1 | \(b_0\) |
> | Either left, 16, 17 | WZ | 8 | 10 | 0/2 | 0,1 | incoming |
> 
> All word streams preserve D and I. They preserve V **except WSF**, whose `BIT H` establishes `V=b14`. WI, WU1, and WL1 preserve A; the others clobber it. X, Y, and S are preserved throughout.
> 
> These flags are properties of the listed streams, not language-level shift results. For example:
> 
> - WS1 on `$8001` produces `$C000` but leaves `N=0,Z=1,C=1`, because the last instruction shifts the low byte.
> - WS1 on `$7FFF` produces positive `$3FFF` but leaves `N=1`.
> - WSF on `$7FFF` produces zero, preserves incoming C, and leaves `V=1`.
> - WU15 on `$FFFF` produces `$0001` but leaves `Z=1`, because its final accumulator result is the zero high byte.
> 
> The word transformations follow from byte identities, independently of those flag outcomes:
> 
> - **Right by one:** WS1 first extracts the original high-byte sign into C without modifying H. `ROR H` injects that sign and emits original H bit 0; `ROR L` injects that bit into the low byte. The resulting unsigned pattern is \(\lfloor u/2\rfloor+32768s\), whose signed interpretation is \(\lfloor x/2\rfloor\). WU1 uses zero injection instead.
> - **Right by seven:** the low result is
>   \[
>   (2H+(L\gg7))\bmod256.
>   \]
>   `ASL L` supplies \(L_7\), and `ROL A` constructs this low result while emitting \(H_7\). WU7 stores that emitted bit as high byte 0 or 1. WS7 stores high byte zero or `$FF`, yielding exactly the signed quotient.
> - **Right by eight:** the original H becomes L. The new H is zero for unsigned input or the sign mask for signed input.
> - **Signed right by fifteen or more:** every signed word’s floor quotient by 32768 is `-1` or zero. WSF selects that mask. On its nonnegative path, `BIT` leaves `N=0,Z=1` because A is zero; on its negative path, `LDA #$FF` establishes `N=1,Z=0`.
> - **Unsigned right by fifteen:** only original bit 15 survives. WU15 extracts it into C, rotates it into zero, stores low byte 0 or 1, then shifts that accumulator to zero for H.
> - **Left by seven:** the result bytes are
>   \[
>   r_H=(128(H\mathbin{\&}1)+\lfloor L/2\rfloor)\bmod256,\qquad
>   r_L=128(L\mathbin{\&}1).
>   \]
>   WL7 transports H bit 0 through C into the first `ROR`, then L bit 0 through C into the second.
> - **Left by eight:** L relocates to H and the new L is zero.
> - **Left by fifteen:** only L bit 0 survives, at H bit 7. WL15 constructs that high byte, then `ASL A` makes the low byte zero.
> - **Left by one:** WL1 propagates the low-byte carry upward, giving \(2u\bmod65536\). WZ implements the independently derived zero result for wide unsigned-right and left counts.
> 
> The cost totals include every instruction in the selected stream. The relevant NMOS prices are accumulator shifts `1 byte/2 cycles`, immediate loads and compare `2/2`, absolute loads/stores/BIT `3/4`, absolute RMW `3/6`, and relative branches `2 bytes`, with `2` cycles untaken or `3+p` taken.
> 
> Straight-line streams execute every listed instruction. For example, WS1 costs `3+1+3+3=10` bytes and `4+2+6+6=18` cycles. The fill-path sums are:
> 
> - BSF negative: `2+2+(3+p)=7+p`; nonnegative: `2+2+2+2=8`.
> - WS7 negative: `6+4+2+4+2+(3+p)+4=25+p`; nonnegative replaces the branch cost with 2 and executes another 2-cycle load, totaling 26.
> - WS8 negative: `4+4+2+2+(3+p)+4=19+p`; nonnegative totals 20.
> - WSF nonnegative: `2+4+(3+p)+4+4=17+p`; negative uses an untaken branch and the extra load, totaling 18.
> 
> Every fill branch skips exactly one 2-byte load, so its displacement is `+2` and needs no range repair. Both loads count toward static code size. No padding is introduced; the ledger retains the possible page penalty instead of assuming a supplied placement.
> 
> The memory counts include NMOS RMW’s **one read, old-value write, and modified-value write**. Thus WU15, for example, reads H once and writes H three times plus L once. Instruction-stream fetches are additional: straight-line paths fetch all encoded instruction bytes, while a taken fill branch skips two. Accumulator shifts and taken branches also consume their listed fetch cycles. For these unstalled streams, total nominal bus writes equal the table’s W count and total bus reads equal path cycles minus W. This is analytical traffic accounting, not an observed bus trace.
> 
> Every selected stream adds **zero data/table bytes, zero ZP bytes, zero SFA scratch/frame bytes, zero hardware-stack depth, and zero padding bytes**. The existing word home occupies two RAM bytes; its classification as a global or SFA allocation is not supplied. Immediate constants are already included in code size. There is no count load, spill, loop, helper, or call.
> 
> If a byte must first be loaded from absolute RAM, `LDA source` adds exactly 3 bytes, 4 cycles, and one read. An absolute result store, `STA destination`, adds 3 bytes, 4 cycles, and one write. Those additions apply only where required by the actual storage contract; a constant-zero result need not read an effect-free ordinary operand.
> 
> The supplied [arithmetic-shift baselines](/work/references/6502-lowering-casebook.md:303) are legal, but constant specialization improves several of them. The following comparisons use `p=0`; all have the same zero incremental non-code resources stated above.
> 
> | Operation | Complete comparison stream | Bytes; cycles; operand R/W | Selected form |
> |---|---|---|---|
> | Signed byte right 7 | `[CMP #$80; ROR A] × 7` | 21; 28; 0/0 | BSF: 7; 7 negative/8 nonnegative; 0/0 |
> | Signed byte right ≥8 | `CMP #$80; LDA #$FF; BCS done; LDA #$00` | 8; 7/8; 0/0 | BSF: one byte smaller, same paths |
> | Signed word right 1 | `LDA H; CMP #$80; ROR A; STA H; ROR L` | 12; 18; 2/3 | WS1: 10; 18; 3/4 |
> | Signed word right 7 | `LDA H; [CMP #$80; ROR A; ROR L] × 7; STA H` | 48; 78; 8/15 | WS7: 19; 25/26; 2/4 |
> | Signed word right 8 | `LDA H; STA L; CMP #$80; LDA #$FF; BCS fill; LDA #$00; fill: STA H` | 17; 19/20; 1/2 | WS8: one byte smaller, same paths |
> | Signed word right 15 | Previous count-8 stream, then `LDA L; [CMP #$80; ROR A] × 7; STA L` | 44; 55/56; 2/3 | WSF: 15; 18 negative/17 nonnegative; 1/2 |
> | Signed word right ≥16 | `LDA H; CMP #$80; LDA #$FF; BCS fill; LDA #$00; fill: STA L; STA H` | 17; 19/20; 1/2 | WSF: 15; 18 negative/17 nonnegative; 1/2 |
> 
> The comparisons require discarded flags and available A. Repeated byte right-by-seven leaves `C=b6`; BSF leaves `C=b7`. Repeated word right-by-seven leaves N/Z describing its low byte and `C=b6`; WS7 leaves N/Z describing the sign mask and `C=b15`. The comparison word terminal fill preserves V and produces `C=b15`; WSF produces `V=b14` and preserves incoming C. These differences are legal here.
> 
> The extra-traffic choices also have clear alternatives. Replacing WS7/WU7’s initial `ASL L` with `LDA L; ASL A`, or WL7’s initial `LSR H` with `LDA H; LSR A`, costs one additional code byte, keeps cycles identical, and reduces operand traffic from 2/4 to 2/2. Likewise, replacing WU15/WL15’s initial memory shift with a load and accumulator shift costs one byte, keeps 20 cycles, and reduces traffic from 1/4 to 1/2. These are valid alternatives when fewer writes matter more than that byte.
> 
> A lone logical right shift is **Incorrect** for negative signed inputs: `$80` would become `$40`, and `LSR H; ROR L` would turn signed `$8001` into `$4000`. Those contradict the independently derived `$C0` and `$C000`.
> 
> If the operands themselves are compile-time-known in an ordinary fixed-width expression, fold the numerical result first. Byte materialization is `LDA #result` at 2 bytes/2 cycles. Word materialization is `LDA #low; STA L; LDA #high; STA H` at 10 bytes/12 cycles and 0 reads/2 writes; equal result bytes permit `LDA #byte; STA L; STA H` at 8 bytes/10 cycles. Consumer elimination may remove that materialization. A full-precision `const` initializer is a separate context governed by TS-18’s range rules.
> 
> No compiler, assembler, emulator, or repository execution was performed. No emitted shift artifact or measured result was supplied. Closing those `Unknown` boundaries would first require compiler identity/options and emitted assembly, then assembled bytes and placement, followed by execution under a recorded NMOS6510 configuration.
> 
> Lineage: `skillVersion=2.0.1`; advertised specification identity `BLEND65-SPEC-4-1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf`. `contentCommit=Unknown` and activation status `Unknown`, because the release record is explicitly omitted. Governing source-manifest keys are `BLEND65-SPEC-4-1c2a2d75`, `MOS-PGM-1976`, `MOS-HW-1976`, and `MOS-6510-1982`; the reference boundaries used are `6502-lowering-casebook.md#shifts-and-rotates`, `mos-6502-family.md#instruction-effects` and `#bus-visible-accesses`, and `evidence-parity-and-recovery.md#transformation-proof` and `#equivalent-work-accounting`.

</details>


<details>
<summary>candidate-qc13-proof-grade: packet manifest and exact captured text</summary>

```text
769b9976b6aacc6e7c34fd468244943d38666f5e4ddfb371f754b379839dfbe5  answer.md
e1a14afa11ff99d9c271e2c3352bf943d368c2d5b3624399a9942a84f8bc7e91  control.py
65cf1b1e3011e4771d27662c1a7d0c6deb20662a8fcd426c1c3e5d13e30a922d  oracle.md
```

> **Fail on evidence completeness. The analytical content passes.**
> 
> [oracle.md:15](/work/oracle.md:15) requires “Primary-source pinpoints after freeze.” All six local source links in [answer.md:5](/work/answer.md:5) and [answer.md:206](/work/answer.md:206) resolve to missing files. Consequently, the required source grounding—including the `E10161`/`W10174` rules—cannot be independently verified from the supplied workspace.
> 
> The substantive checks found no errors:
> 
> | Area | Concrete evidence |
> |---|---|
> | Results and proofs | All **84 table entries** match exact integer arithmetic. The floor-division and modular-arithmetic proofs correctly establish sign extension and results at or above operand width. |
> | Every supplied lowering | All **22 selected streams, seven comparison streams, and five lower-write alternatives** passed exhaustive abstract-model checks across every operand value and both incoming C and V states: **6,301,696 evaluations**. |
> | Flags and clobbers | Correct, including WS1’s flags describing the low byte, WSF’s `V=b14` with incoming C preserved, and WU15 leaving `Z=1` despite a possible `$0001` result. |
> | Path costs | All listed sizes and cycles agree. Taken branches skip a two-byte load and incur the stated possible page penalty. |
> | Memory and resources | RMW accounting correctly includes the old-value and modified-value writes. Zero incremental ZP/frame/stack/data/padding costs hold under the declared storage contract; the existing word occupies two RAM bytes. |
> | Other supplied sequences | Materialization, boundary loads/stores, and rejected logical-shift examples check out. Lone logical shifts incorrectly produce `$40` and `$4000` in the supplied negative-input examples. |
> 
> For example, the four conditional streams have the stated costs:
> 
> | Stream | Code bytes | Negative cycles | Nonnegative cycles |
> |---|---:|---:|---:|
> | BSF | 7 | `7+p` | 8 |
> | WS7 | 19 | `25+p` | 26 |
> | WS8 | 16 | `19+p` | 20 |
> | WSF | 15 | 18 | `17+p` |
> 
> Compiler output, assembly encoding/placement, target execution, and measured timing remain **unobserved**, appropriately marked `Unknown` in [answer.md:226](/work/answer.md:226). Those unknowns are **not grounds for this failure**: the checks above establish analytical behavior using an independent model, not actual compiler or runtime behavior.
> 
> No files were modified.

</details>


<details>
<summary>candidate-ql01-complete-grade: packet manifest and exact captured text</summary>

```text
ac0d02a323ff848d8c24f7e262985eaa4376f44126b78c1c4299149aeeb320f2  answer.md
e1a14afa11ff99d9c271e2c3352bf943d368c2d5b3624399a9942a84f8bc7e91  control.py
2cc0704696b4d784e93471da081814cefe8eac1f8df5b3917e43902e296fdaac  oracle.md
```

> **Pass — graded jointly against the frozen [oracle.md](/work/oracle.md:28).**
> 
> Decisive evidence:
> 
> - [Capture 1](/work/answer.md:7) correctly accepts TS-4 widening and TS-14 enum→byte conversion, while retaining narrowing and signedness restrictions.
> - The [corpus audit](/work/answer.md:31) contains **45 distinct path rows**, with substantive payloads, consequences, authority roles, branch routing, and justified N/A treatment. It respects F001’s limited contract and audits the live future entries.
> - [High-risk coverage](/work/answer.md:90) addresses warning scopes, per-activation SFA costs, provenance-bounded lifetimes, unchecked addressing, division, and loader overwrite risks. Fixed-aggregate returns are recognized without claiming implementation support.
> - [Capture 2](/work/answer.md:186) supplies **59 retained-history disposition rows**—15 + 35 + 7 + 2—distinguishing retired restrictions, removed operations, remapped conditions, and active numeric collisions.
> - [ACME provenance and debt-issue policy](/work/answer.md:151) remain distinct, matching the oracle’s explicit requirement.
> 
> The reported stability, IRQ-checklist, W10190-summary, and division-summary contradictions [remain unresolved findings](/work/answer.md:125). Passing this audit does not certify the underlying corpus as conflict-free. Capture 1’s overall “Verified partial” and Capture 2’s source-boundary “Verified complete” concern different scopes.
> 
> No removed migration filenames are invented. Compiler/runtime conformance and activation appropriately remain **Unknown**; the oracle does not require supplying them.
> 
> No files were modified.

</details>
