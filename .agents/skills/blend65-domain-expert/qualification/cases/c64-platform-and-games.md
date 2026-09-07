# Qualification Cases: C64 Platform and Games

> **Oracle family**: Q-P01..Q-P21
> **Authority gate**: Hardware, timing, tool-observed, revision, and practitioner-workflow
> expectations are `frozen-external` after the Phase 2 independent source-to-invariant review.
> This freezes the oracle, not the still-unwritten replacement knowledge or its later results.
> **Project constraints already fixed**: Modern source ergonomics, placement over copying, deterministic compiler/API realization, zero hidden runtime skill dependency, complete cost accounting, and targeted physical QA for silicon-sensitive claims.
> **Result policy**: Result entries are append-only. Draft observations cannot count as release pass/fail evidence.

## Shared Isolation Boundary

The evaluator receives the prompt, the named raw artifacts, declared C64/video/chip model, and selected candidate runtime references only. It never receives this oracle, planning material, source-review notes, prior results, feasibility-matrix data, or author history. The grader rejects answers that recall a trick without assigning recognizable preconditions, deterministic compiler/API ownership, hazards, full costs, and independent proof.

## Q-P01 — CPU writes RAM under I/O while VIC reads display data

- **Risk / coverage cells:** Critical; `C64-P01`, `GAME-P01`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “CPU writes RAM under I/O while VIC reads display data. State exact machine/video/chip and banking/interrupt assumptions. Choose a deterministic compiler, platform-API, local-contract, or diagnostic disposition; assign ownership; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** CPU `$0001` state, CIA2 VIC-bank state, target addresses/data, CPU/VIC observations, and declared machine model.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Separates CPU bank view, VIC bank view, and exact `$0001`/CIA2 state.
- **Disqualifying outcomes:** Uses one universal memory map.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Draft observation: pre-passer — CPU mapping, VIC-bank selection, and bank-relative visibility are separated (`c64-game-systems.md:19-34`).
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-P02 — Mainline changes `$01` while IRQ may run

- **Risk / coverage cells:** Critical; `C64-P02`, `GAME-P02`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Mainline changes `$01` while IRQ may run. State exact machine/video/chip and banking/interrupt assumptions. Choose a deterministic compiler, platform-API, local-contract, or diagnostic disposition; assign ownership; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** Mainline and IRQ code, `$0001` ownership protocol, interrupt-mask state, and observable memory/device accesses.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Treats banking state as shared observable context; defines masking/save/restore contract.
- **Disqualifying outcomes:** Moves bank writes freely.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-P03 — Move charset/screen to another VIC bank

- **Risk / coverage cells:** Major; `C64-P03`, `GAME-P03`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Move charset/screen to another VIC bank. State exact machine/video/chip and banking/interrupt assumptions. Choose a deterministic compiler, platform-API, local-contract, or diagnostic disposition; assign ownership; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** Screen/charset declarations, VIC bank/base-register state, required alignment, placement map, and proposed copy/flip operations.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Uses alignment/bank/register/pointer facts and placement over copy.
- **Disqualifying outcomes:** Copies assets merely for compiler convenience.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-P04 — Raster workload budgeted for both PAL and NTSC

- **Risk / coverage cells:** Critical; `C64-P04`, `GAME-P04`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Raster workload budgeted for both PAL and NTSC. State exact machine/video/chip and banking/interrupt assumptions. Choose a deterministic compiler, platform-API, local-contract, or diagnostic disposition; assign ownership; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** Raster schedule, PAL and NTSC model identifiers, line/cycle budgets, and all conditional paths.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Gives variant-specific assumptions and safe/worst-case budget.
- **Disqualifying outcomes:** Uses one PAL number as universal C64.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-P05 — Work scheduled on a badline

- **Risk / coverage cells:** Critical; `C64-P05`, `GAME-P05`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Work scheduled on a badline. State exact machine/video/chip and banking/interrupt assumptions. Choose a deterministic compiler, platform-API, local-contract, or diagnostic disposition; assign ownership; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** Raster line/model, badline conditions, instruction schedule, VIC state, and bus-cycle observation.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Accounts for VIC bus stealing and register timing, not CPU nominal cycles only.
- **Disqualifying outcomes:** Declares fit from instruction sum alone.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-P06 — Eight sprites active during raster work

- **Risk / coverage cells:** Critical; `C64-P06`, `GAME-P06`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Eight sprites active during raster work. State exact machine/video/chip and banking/interrupt assumptions. Choose a deterministic compiler, platform-API, local-contract, or diagnostic disposition; assign ownership; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** Sprite enable/Y positions, raster line/model, DMA schedule, and candidate CPU workload.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Includes sprite-DMA cycle pressure/model assumptions.
- **Disqualifying outcomes:** Ignores DMA stalls.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-P07 — Select KERNAL-chain, KERNAL-exclusive, or raw IRQ entry

- **Risk / coverage cells:** Critical; `C64-P07`, `GAME-P07`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Select among default KERNAL chaining, explicit KERNAL takeover, and raw IRQ installation for one source interrupt handler. State exact machine/video/chip, KERNAL revision, vector/banking, enabled-source, and nesting assumptions. Assign compiler/platform/developer ownership; account for bytes, cycles, static link storage, stack and visibility; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** Handler/helper source and assembly, selected profile, CINV and hardware vector paths, ROM banking, KERNAL/raw entry assumptions, saved registers, source acknowledgement, exit sequence, and cost report.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Default `setIRQ` uses the no-second-save CINV chain variant and a
  reported two-byte saved prior vector whose low byte is at most `$FE`. It preserves entry flags
  around a binary-mode Blend65 body before chaining. Explicit `setIRQExclusive` establishes binary
  mode, uses the no-second-save `$EA81` restore tail, and requires ownership of every enabled source.
  `setRawIRQ` exists only with a profile-proven writable/active raw vector, establishes binary mode,
  and owns save/restore/`RTI`. The handler acknowledges its source, helpers remain `JSR`/`RTS`,
  interrupted/chained status is preserved, and all variants/costs are explicit without a dispatcher.
- **Disqualifying outcomes:** Uses one prologue/`RTI` blindly, double-pushes A/X/Y at CINV, skips
  prior KERNAL work without source ownership, exposes a raw sink under an unproven banking path,
  accepts visible raw-entry installation at `$0314`, permits unknown decimal mode at body entry,
  places the indirect link at `$xxFF`, changes the prior handler's entry flags, or hides static
  link/body/stack cost.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Draft observation: partial — generic save/acknowledge/RTI duties exist, but KERNAL-vector versus raw-vector entry contracts do not (`c64-game-systems.md:63-68`).
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-P08 — Acknowledge VIC raster IRQ

- **Risk / coverage cells:** Critical; `C64-P08`, `GAME-P08`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Acknowledge VIC raster IRQ. State exact machine/video/chip and banking/interrupt assumptions. Choose a deterministic compiler, platform-API, local-contract, or diagnostic disposition; assign ownership; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** VIC IRQ status/mask values, proposed acknowledge sequence, and read/write trace.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Preserves exact volatile access semantics/order and register-specific acknowledgement.
- **Disqualifying outcomes:** Generic RMW without device proof.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-P09 — CIA interrupt-control register read/write

- **Risk / coverage cells:** Critical; `C64-P09`, `GAME-P09`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “CIA interrupt-control register read/write. State exact machine/video/chip and banking/interrupt assumptions. Choose a deterministic compiler, platform-API, local-contract, or diagnostic disposition; assign ownership; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** CIA ICR operation, prior mask/pending state, proposed reads/writes, and resulting trace.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Distinguishes mask-setting/clearing and read-to-ack semantics as applicable.
- **Disqualifying outcomes:** Treats it as ordinary stored byte.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-P10 — Scan joystick/keyboard while CIA2 selects VIC bank

- **Risk / coverage cells:** Critical; `C64-P10`, `GAME-P10`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Scan joystick/keyboard while CIA2 selects VIC bank. State exact machine/video/chip and banking/interrupt assumptions. Choose a deterministic compiler, platform-API, local-contract, or diagnostic disposition; assign ownership; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** Joystick/keyboard scan, CIA port directions/latches, VIC-bank selection, and ownership requirements.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Preserves port direction/ownership and does not conflate CIA1/CIA2.
- **Disqualifying outcomes:** Clobbers video bank bits.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-P11 — Design SID-player scheduling and music/SFX sharing across 6581/8580

- **Risk / coverage cells:** Major; `C64-P11`, `GAME-P11`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Design player-neutral C64 game audio that supports music-only, integrated music/SFX, minimal SFX-only, and exact custom-player paths. Separate PSID container metadata from a callable player contract. State the exact player/export identity, source operations, direct-call lowering, cadence, call domains, ABI/clobbers, writable state, voice mapping, arbitration, IRQ/CIA/SID ownership, banking, PAL/NTSC and 6581/8580 assumptions, and every enabled-feature byte/cycle/RAM/ZP/stack cost. Reject hidden runtime scheduling or mixing. Give one unsafe-overlap counterexample and the independent proof needed.”
- **Permitted raw artifacts:** Hash-pinned player/export and container contracts; init/tick/SFX entry ABIs; player-native queue/priority/resume behavior; cadence and IRQ ownership; voice/table/writable layout; 6581/8580 assumptions; comparative minimal SFX-only code; candidate-workflow documents explicitly marked unqualified; and reference register/audio traces.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Uses one player-neutral source surface whose constant forms lower to exact contract register loads and absolute calls. Treats PSID as insufficient to prove SFX or writable-state behavior; requires a hash-bound contract; leaves tick scheduling with source; permits only player-declared queues/arbitration or fully costed inline critical sections; models logical voice `0..2`; reports all selected costs; and preserves music-only, integrated, SFX-only, and custom-player choices without making one tracker the architecture. GoatTracker 2.77 is the first adapter family, SID Factory II remains a candidate, and multi-SID/GTUltra requires a separate profile.
- **Disqualifying outcomes:** Infers SFX from PSID, adds a generic dispatcher/scheduler/mixer/name table/runtime, silently copies the payload, guesses a player/export identity, ignores unsafe IRQ/mainline overlap, claims universal sound from a register trace, or leaves the technique as descriptive lore.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-P12 — Double-buffer screen/charset across visibility regions

- **Risk / coverage cells:** Major; `C64-P12`, `GAME-P12`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Double-buffer screen/charset across visibility regions. State exact machine/video/chip and banking/interrupt assumptions. Choose a deterministic compiler, platform-API, local-contract, or diagnostic disposition; assign ownership; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** Two evolving screen/charset states, visibility regions, base pointers, memory budget, update cost, and copy/flip candidates.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Prefers placement and pointer/base flips; permits compile-time replication only when alternatives cannot meet a named hardware/timing need, with consumer, constraint, bytes, and benefit recorded; treats buffers with different evolving states as distinct storage.
- **Disqualifying outcomes:** Copies or duplicates for convenience, leaves replication unmeasured, or calls distinct evolving buffers duplicated data.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-P13 — Sprite multiplexer with IRQ-only sorter/update helpers

- **Risk / coverage cells:** Major; `C64-P13`, `GAME-P13`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Sprite multiplexer with IRQ-only sorter/update helpers. State exact machine/video/chip and banking/interrupt assumptions. Choose a deterministic compiler, platform-API, local-contract, or diagnostic disposition; assign ownership; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** Object list, raster schedule, sorter/update call graph, IRQ/mainline reachability, scratch/frame plan, and emitted hot-path assembly.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Connects data layout, raster timing, SFA interference, scratch, and API expressibility.
- **Disqualifying outcomes:** Reviews hardware in isolation.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-P14 — Named `vic.borderColor.set(5)`-style wrapper

- **Risk / coverage cells:** Major; `C64-P14`, `GAME-P14`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Named `vic.borderColor.set(5)`-style wrapper. State exact machine/video/chip and banking/interrupt assumptions. Choose a deterministic compiler, platform-API, local-contract, or diagnostic disposition; assign ownership; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** The named wrapper call, constant argument, selected register, candidate lowering/assembly, and expert direct-store baseline.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Requires exact expert store sequence after compile-time folding.
- **Disqualifying outcomes:** Accepts hidden call/temp/read/write overhead.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-P15 — Design an Integrator-style compile-time scene/asset pipeline for a large visible game area

- **Risk / coverage cells:** Major; `C64-P15`, `GAME-P15`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Design an Integrator-style compile-time scene/asset pipeline for a large visible game area. State exact machine/video/chip and banking/interrupt assumptions. Choose a deterministic compiler, platform-API, local-contract, or diagnostic disposition; assign ownership; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** Reusable elements/panels, scene composition input, foreground/occlusion/priority rules, multicolor attributes, memory and draw/mask budgets, emitted layout, loader/visibility contract, and runtime renderer trace.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Composes reusable elements/panels; generates masks, foreground priority, and attribute-conflict evidence; chooses precomputation/representation from memory-versus-draw/mask cost; assigns compiler/toolchain, emitted layout, loader, visibility/IRQ ownership, and zero-cost renderer responsibilities; proves artifact and runtime behavior.
- **Disqualifying outcomes:** Says only “use Integrator/build an editor,” flattens everything into generic copying, ignores attribute/mask/runtime costs, or leaves asset preparation unowned.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-P16 — Design entity storage, collision, and state dispatch for a fixed game workload

- **Risk / coverage cells:** Major; `C64-P16`, `GAME-P16`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Design entity storage, collision, and state dispatch for a fixed game workload. State exact machine/video/chip and banking/interrupt assumptions. Choose a deterministic compiler, platform-API, local-contract, or diagnostic disposition; assign ownership; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** Fixed workload, hot queries/updates, entity fields, collision phases, state-dispatch needs, call/interrupt graph, and candidate layouts.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Chooses fixed pools and SoA/AoS from hot paths, models broad/narrow collision and function-pointer/SFA consequences, and gives a deterministic compiler/API disposition with behavior and assembly/resource proof.
- **Disqualifying outcomes:** Declares one layout universally best or leaves engine structures as descriptive lore.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-P17 — Stable raster region calls variable-path logic or a helper

- **Risk / coverage cells:** Critical; `C64-P17`, `GAME-P17`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Stable raster region calls variable-path logic or a helper. State exact machine/video/chip and banking/interrupt assumptions. Choose a deterministic compiler, platform-API, local-contract, or diagnostic disposition; assign ownership; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** Stable raster region, all callee/control paths, declared cycle contract, platform timing facts, and candidate schedule.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Requires an explicit local cycle contract, path-invariance proof or bounded scheduling design, and a diagnostic when the budget cannot be proved.
- **Disqualifying outcomes:** Assumes source shape or average cycles are stable.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-P18 — Request VSP/AGSP for a general C64 build

- **Risk / coverage cells:** Critical; `C64-P18`, `GAME-P18`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Request VSP/AGSP for a general C64 build. State exact machine/video/chip and banking/interrupt assumptions. Choose a deterministic compiler, platform-API, local-contract, or diagnostic disposition; assign ownership; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** Requested VSP/AGSP effect, exact chip/board/video assumptions, safe alternatives, VICE trace, and available physical-QA evidence.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Requires an explicit silicon/risk/compatibility contract, safer alternative comparison, VICE evidence, and targeted physical QA; never enables it by default.
- **Disqualifying outcomes:** Treats one emulator result as safe universal hardware behavior.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-P19 — Use FLI/FLD/line-crunch/border/sprite-crunch technique

- **Risk / coverage cells:** Critical; `C64-P19`, `GAME-P19`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Use FLI/FLD/line-crunch/border/sprite-crunch technique. State exact machine/video/chip and banking/interrupt assumptions. Choose a deterministic compiler, platform-API, local-contract, or diagnostic disposition; assign ownership; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** Named display technique, required visual intent, exact timing/layout/banking/IRQ ownership, API proposal, and reference effect trace.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Maps intent to a named API/template/lowering and exact timing/layout/ownership obligations, not a generic peephole.
- **Disqualifying outcomes:** Pattern-matches arbitrary stores/loops into a display trick.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-P20 — Optimize a scrolling/rendering hot path

- **Risk / coverage cells:** Major; `C64-P20`, `GAME-P20`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Optimize a scrolling/rendering hot path. State exact machine/video/chip and banking/interrupt assumptions. Choose a deterministic compiler, platform-API, local-contract, or diagnostic disposition; assign ownership; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** Scrolling/rendering workload, frame budget, memory map, dirty regions, candidate placement/replication/table/unroll/copy strategies, and whole-program costs.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Compares pointer flips, placement/justified replication, pre-shifted data, dirty updates, unrolling, and copying against actual frame and memory budgets.
- **Disqualifying outcomes:** Blindly copies, duplicates, or unrolls without equivalent-work accounting.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Not run.
- **Definitive result:** Not run.

## Q-P21 — Bake a sprite-multiplexer technique into Blend65 support

- **Risk / coverage cells:** Major; `C64-P21`, `GAME-P21`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Bake a sprite-multiplexer technique into Blend65 support. State exact machine/video/chip and banking/interrupt assumptions. Choose a deterministic compiler, platform-API, local-contract, or diagnostic disposition; assign ownership; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** Desired sprite-multiplexer behavior, modern source/API sketch, target facts, schedule/data plan, SFA/IRQ graph, lowering/layout alternatives, and proof artifacts.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Produces a deterministic realization plan spanning modern source API, schedule/data representation, SFA/IRQ interference, target facts, lowering/layout ownership, cost, and proof.
- **Disqualifying outcomes:** Merely describes the trick or assumes the shipped compiler can consult the skill.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Draft observation: fail — game idioms are listed, but sprite multiplexing is not mapped to deterministic compiler/API ownership, costs, hazards, and proof (`c64-game-systems.md:82-97`).
- **Focused result:** Not run.
- **Definitive result:** Not run.
