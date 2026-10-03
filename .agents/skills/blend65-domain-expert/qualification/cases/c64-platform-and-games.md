# Qualification Cases: C64 Platform and Games

> **Oracle family**: Q-P01..Q-P23
> **Authority gate**: Hardware, timing, tool-observed, revision, and practitioner-workflow
> expectations are `frozen-external` after the Phase 2 independent source-to-invariant review.
> This freezes the existing oracles, not replacement knowledge or later results. New Q-P23 passed
> its separate independent source review on 2026-09-29; candidate qualification remains pending.
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
- **Focused result:** Pass — Phase-5 isolated content evaluation; decisive evidence is recorded in `qualification/release.md`.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

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
- **Focused result:** Pass — Phase-5 isolated content evaluation; decisive evidence is recorded in `qualification/release.md`.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

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
- **Focused result:** Pass — Phase-5 isolated content evaluation; decisive evidence is recorded in `qualification/release.md`.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

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
- **Focused result:** Pass — Phase-5 isolated content evaluation; decisive evidence is recorded in `qualification/release.md`.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

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
- **Focused result:** Pass — Phase-5 isolated content evaluation; decisive evidence is recorded in `qualification/release.md`.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

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
- **Focused result:** Pass — Phase-5 isolated content evaluation; decisive evidence is recorded in `qualification/release.md`.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

## Q-P07 — Select KERNAL-chain, KERNAL-exclusive, or raw IRQ/NMI entry

- **Risk / coverage cells:** Critical; `C64-P07`, `GAME-P07`.
- **Oracle status:** `frozen-project/external` — independently source-reviewed in Phase 2 and strengthened
  during the Phase-5 review to include task 5.2's previously omitted NMI half; no existing
  invariant or disqualifier was weakened. The conditional stock-NMINV-at-program-entry
  policy is separately user-approved on 2026-10-03; independent source/oracle review
  cleared its new discriminating fields before guidance authoring. Oracle fields
  are frozen; qualification and activation remain separate.
- **Evaluator prompt:** “Select among default KERNAL chaining, explicit KERNAL takeover, and raw installation for one IRQ or NMI source handler. State exact machine/video/chip, KERNAL revision, CINV/NMINV/hardware-vector and banking state, every enabled/physical source, and nesting assumptions. Assign compiler/platform/developer ownership; account for bytes, cycles, static link storage, stack and visibility; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** Handler/helper source and assembly, selected profile, CINV/NMINV and hardware vector paths, ROM banking, KERNAL/raw entry assumptions, saved registers/status, CIA1/CIA2/RESTORE/cartridge source behavior and acknowledgement, vector-update sequence, exit sequence, and cost report.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Default `setIRQ` uses the no-second-save CINV chain variant and a
  reported two-byte saved prior vector whose low byte is at most `$FE`. It preserves entry flags
  around a binary-mode Blend65 body before chaining. Explicit `setIRQExclusive` establishes binary
  mode, uses the no-second-save `$EA81` restore tail, and requires ownership of every enabled source.
  `setRawIRQ` exists only with a profile-proven writable/active raw vector, establishes binary mode,
  and owns save/restore/`RTI`. The handler acknowledges its source, helpers remain `JSR`/`RTS`,
  interrupted/chained status is preserved, and all variants/costs are explicit without a dispatcher.
  The revision-pinned NMI route recognizes that `$FE43` reaches NMINV without saving registers:
  a chain saves status before A/X/Y, restores A/X/Y before status, and then jumps to a page-safe
  saved prior NMINV; exclusive/raw forms save A/X/Y and end in `RTI`. CIA2 ICR is consumed once by
  one owner, RESTORE/cartridge behavior and generated NMI reentrancy are closed, and a raw vector is populated
  before its bank state becomes visible. No use of `SEI` is accepted as NMI exclusion.
  On only the four cooperative PRG profiles, a complete private-home-free reentrant NMI path may
  be expressible with unbounded external arrivals. External aggregate hardware-stack use and
  retained-firmware reentrancy/completion stay explicitly unproved; one-entry cost is not a peak.
  Generated NMINV-installation users on those four profiles require stock `$FE47` at program
  entry and no independent resident vector owner; reset alone does not establish this later
  entry value. No-installation programs acquire no new vector-entry requirement. Matching-low
  placement/high-byte-only publication is conditional on a complete `$47` invariant across
  every reachable transition, complete predecessor capture and immutable live-link lifetime.
  An unknown writer or mismatching initial low byte cannot be assumed safe. Preserves keyboard,
  both joystick ports and RESTORE; does not turn this condition into a finite arrival guarantee.
- **Disqualifying outcomes:** Uses one prologue/`RTI` blindly, double-pushes A/X/Y at CINV, skips
  prior KERNAL work without source ownership, exposes a raw sink under an unproven banking path,
  accepts visible raw-entry installation at `$0314`, permits unknown decimal mode at body entry,
  treats NMINV as though KERNAL already saved registers, consumes CIA2 state before a chained owner,
  assumes `SEI` protects a two-byte NMI-vector update, leaves generated reentrancy or source behavior open, places
  an indirect link at `$xxFF`, changes or liveness-elides a prior handler's observable entry
  flags/registers, hides static link/body/stack cost, treats the exception as a finite arrival bound,
  or claims unrestricted external/firmware safety. Assumes reset implies stock NMINV at a later
  program entry, accepts high-only updates without the low-byte invariant or after an unproved
  writer, adds the conditional entry restriction to no-installation programs, or treats alignment
  savings as complete measured program cost.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Draft observation: partial — generic save/acknowledge/RTI duties exist,
  but KERNAL-vector versus raw-vector IRQ/NMI entry contracts do not
  (`c64-game-systems.md:63-68`).
- **Focused result:** Pass — the initial IRQ-only pass was invalidated by RV-007; the strengthened
  IRQ/NMI case passed a fresh Phase-5 isolated content re-grade, with decisive evidence recorded in
  `qualification/release.md`.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

### 2.0.1 integrated qualification result — Q-P07

**Pass** for the contract/knowledge boundary only. CINV, raw IRQ and bounded NMI ABI/ownership/installation obligations pass; unproved NMI installation remains rejected.

Evidence: `candidate-qp07-final / candidate-irq-final-grade`; exact packet/output identities and captured text
are preserved in `../release.md` under the 2.0.1 capture record. Separate model
grades and independent review are retained, including prior failures and bounded
corrective dispositions. Actual compiler output, runtime and hardware remain
Unknown; this result is not an activation declaration.


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
- **Focused result:** Pass — Phase-5 isolated content evaluation; decisive evidence is recorded in `qualification/release.md`.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

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
- **Focused result:** Pass — Phase-5 isolated content evaluation; decisive evidence is recorded in `qualification/release.md`.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

### 2.0.1 integrated qualification result — Q-P09

**Pass** for the contract/knowledge boundary only. One consuming ICR read versus distinct mask writes, pending effects and source ownership pass.

Evidence: `candidate-irq / candidate-irq-grade`; exact packet/output identities and captured text
are preserved in `../release.md` under the 2.0.1 capture record. Separate model
grades and independent review are retained, including prior failures and bounded
corrective dispositions. Actual compiler output, runtime and hardware remain
Unknown; this result is not an activation declaration.


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
- **Focused result:** Pass — Phase-5 isolated content evaluation; decisive evidence is recorded in `qualification/release.md`.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

### 2.0.1 integrated qualification result — Q-P10

**Pass** for the contract/knowledge boundary only. Fixed CIA1 port-ownership control passes; CIA2/video banking is not clobbered.

Evidence: `candidate-controls-complete / candidate-controls-complete-grade`; exact packet/output identities and captured text
are preserved in `../release.md` under the 2.0.1 capture record. Separate model
grades and independent review are retained, including prior failures and bounded
corrective dispositions. Actual compiler output, runtime and hardware remain
Unknown; this result is not an activation declaration.


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
- **Focused result:** Pass — Phase-5 isolated content evaluation; decisive evidence is recorded in `qualification/release.md`.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

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
- **Focused result:** Pass — Phase-5 isolated content evaluation; decisive evidence is recorded in `qualification/release.md`.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

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
- **Focused result:** Pass — Phase-5 isolated content evaluation; decisive evidence is recorded in `qualification/release.md`.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

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
- **Focused result:** Pass — Phase-5 isolated content evaluation; decisive evidence is recorded in `qualification/release.md`.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

## Q-P15 — Design an Integrator-style compile-time scene/asset pipeline for a large visible game area

- **Risk / coverage cells:** Major; `C64-P15`, `GAME-P15`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Implement an Integrator-style compile-time asset-composition workload in ordinary Blend65 for a large visible game area. State exact machine/video/chip and banking/interrupt assumptions. Separate user-authored composition/rendering policy from compiler-owned asset ingestion, semantics, placement, and proved optimization; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** Reusable elements/panels, scene composition input, foreground/occlusion/priority rules, multicolor attributes, memory and draw/mask budgets, emitted layout, loader/visibility contract, and runtime renderer trace.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Keeps scene composition, conflict detection, mask/priority decisions, representation construction, and rendering policy in user-authored compile-time/runtime Blend65. The compiler provides asset ingestion, imported-format validation, exact bytes/types/metadata/symbols, placement/package facts, correct lowering, and proved optimization. It supplies no scene-specific diagnostics, renderer, or scene runtime. The case proves both emitted assets and the user-authored runtime behavior.
- **Disqualifying outcomes:** Says only “use Integrator/build an editor,” adds a compiler-owned renderer/scene API, flattens everything into generic copying, ignores attribute/mask/runtime costs, or leaves asset ingestion/placement unowned.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the corrected Specification 4 Phase-4 isolated evaluator and independent grade passed Q-P15; exact evidence is recorded in `qualification/release.md`.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

## Q-P16 — Design entity storage, collision, and state dispatch for a fixed game workload

- **Risk / coverage cells:** Major; `C64-P16`, `GAME-P16`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Design entity storage, collision, and state dispatch for a fixed game workload. State exact machine/video/chip and banking/interrupt assumptions. Choose a deterministic compiler, platform-API, local-contract, or diagnostic disposition; assign ownership; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** Fixed workload, hot queries/updates, entity fields, collision phases, state-dispatch needs, call/interrupt graph, and candidate layouts.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Keeps pools, entity policy, collision, and state dispatch user-authored; compares SoA/AoS and other legal representations from the fixed workload; and requires the compiler to lower/optimize the chosen ordinary language forms with behavior and assembly/resource proof.
- **Disqualifying outcomes:** Declares one layout universally best, adds a compiler-owned entity/collision/state framework, or leaves the required lowering as descriptive lore.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Specification 4 Phase-4 isolated evaluator and independent grade passed Q-P16; exact evidence is recorded in `qualification/release.md`.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

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
- **Focused result:** Pass — Phase-5 isolated content evaluation; decisive evidence is recorded in `qualification/release.md`.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

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
- **Focused result:** Pass — Phase-5 isolated content evaluation; decisive evidence is recorded in `qualification/release.md`.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

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
- **Focused result:** Pass — Phase-5 isolated content evaluation; decisive evidence is recorded in `qualification/release.md`.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

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
- **Focused result:** Pass — Phase-5 isolated content evaluation; decisive evidence is recorded in `qualification/release.md`.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

## Q-P21 — Bake a sprite-multiplexer technique into Blend65 support

- **Risk / coverage cells:** Major; `C64-P21`, `GAME-P21`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “A developer writes a sprite multiplexer in ordinary Blend65. State exact machine/video/chip and banking/interrupt assumptions. Separate user-authored scheduling/drop policy from compiler lowering, optimization, typed VIC operations, and local timing/ownership contracts; account for bytes, cycles, memory, visibility, IRQ and loader costs; give one counterexample and the independent proof needed.”
- **Permitted raw artifacts:** Desired sprite-multiplexer behavior, modern source/API sketch, target facts, schedule/data plan, SFA/IRQ graph, lowering/layout alternatives, and proof artifacts.
- **Forbidden material:** This hidden oracle, planning/coverage conclusions, prior outputs, feasibility-matrix claims, legacy-skill conclusions, author history, and unallowlisted Web or repository content.
- **Expected decision invariants:** Keeps the multiplexer algorithm, capacity, sorting, channel assignment, and late/drop policy user-authored. The compiler preserves modern source, SFA/IRQ safety, layout constraints, and expert code generation; the platform surface is limited to typed zero-cost VIC operations and explicit local timing/ownership contracts.
- **Disqualifying outcomes:** Adds a compiler/library multiplexer or scheduler, merely describes the trick, or assumes the shipped compiler can consult the skill.
- **Evidence required to grade:** Pinned hardware/practitioner sources after freeze, declared revision/model bounds, deterministic responsibility/precondition mapping, whole-program resource accounting, behavior proof, assembly/timing/layout expectations, VICE evidence where applicable, and targeted hardware-QA status for physical claims.
- **Red-baseline result:** Draft observation: fail — game idioms are listed, but sprite multiplexing is not mapped to deterministic compiler/API ownership, costs, hazards, and proof (`c64-game-systems.md:82-97`).
- **Focused result:** Pass — the Specification 4 Phase-4 isolated evaluator and independent grade passed Q-P21; exact evidence is recorded in `qualification/release.md`.
- **Definitive result:** Pass — the final `BLEND65-SPEC-P3-4bf8a989` complete blind coverage
  sample evaluator output and independent grade passed this case without a material finding. The
  packet, runtime-payload, output, isolation, and grading evidence is recorded in
  `qualification/release.md`.

## Q-P22 — Package and load a trusted D64 load unit through KERNAL 901227-03

- **Risk / coverage cells:** Critical; `C64-P22`, `ARTIFACT-P22`, `LOAD-P22`.
- **Oracle status:** `frozen-project+external` — Specification 4 and `HLE-010` supply policy;
  `CBM-1541-D64-35` and `CBM-C64-KERNAL-LOAD-03` supply geometry and ROM ABI facts.
- **Evaluator prompt:** “Package a boot PRG plus one reachable load unit in the active
  `c64-pal-d64-kernal-6581` profile, then load that unit directly into its declared destination with
  KERNAL 901227-03. Prove D64 geometry/directory/data chaining, call ABI, application quiescence,
  success/failure publication, resource effects, and the trusted-media limit. Give the smallest
  correct implementation; do not introduce a loader framework or staging copy.”
- **Permitted raw artifacts:** The selected profile, file names/payloads/destinations, exact D64
  bytes/map, KERNAL call sequence and workspace, application/interrupt state, returned X/Y/carry/A,
  post-load visibility/invalidation state, and complete byte/cycle/resource report.
- **Forbidden material:** This hidden oracle, plans, prior outputs, current compiler/tests as
  authority, feasibility claims, unpinned disk/ROM lore, and unallowlisted repository/network data.
- **Expected decision invariants:** Requires exactly 174,848 bytes and 683 sectors with the stated
  track geometry, BAM 18/0, directory start 18/1, 664 data blocks, at most 144 entries, closed PRG
  type `$82`, 254-byte payload chaining, and `byte1 - 1` final payload. Calls `$FFBA`, `$FFBD`, then
  `$FFD5` with A=0, secondary address zero, and X/Y destination; consumes one-past-end X/Y on
  carry-clear success or A/carry-set failure. Uses boot device `$BA` by declared policy. The
  application and all conflicting observers/writers are absent or quiescent. Success publishes
  only the captured destination range; failure invalidates only that range. KERNAL workspace,
  call/clobber/cycle costs, disk payload/container capacity, and load window are explicit.
  `HLE-010` permits direct loading only from trusted compiler-produced media because a readable
  longer replacement can overwrite before end-address validation. No checksum, containment claim,
  hidden copy, generic loader, or runtime framework is added.
- **Disqualifying outcomes:** Treats a D64 as flat payload bytes; counts container overhead in
  optimizer `B`; uses the file header address despite secondary address zero; calls LOAD before
  quiescence; publishes an uncaptured or failed range; claims altered-media containment; omits ROM
  workspace/resource effects; or adds a staging buffer/framework.
- **Evidence required to grade:** Exact source keys and hashes; byte-level image/map and file-chain
  proof; KERNAL register/carry trace; state-ownership and publication/invalidation trace; complete
  output/container/RAM/ZP/stack/cycle costs; and an independent malformed/longer-media boundary
  check.
- **Red-baseline result:** Not run; new Specification 4 case.
- **Focused result:** Pass — the Specification 4 Phase-4 isolated evaluator and independent grade passed Q-P22; exact evidence is recorded in `qualification/release.md`.
- **Definitive result:** Pass — the Specification 4 Phase-4 qualification passed without a material finding.

## Q-P24 — Reentrant NMI code is not an unlimited external-stack guarantee

- **Risk / coverage cells:** Critical; `C64-P24`, `GAME-P24`, `SFA-L08`.
- **Oracle status:** `frozen-project/external` — explicit user approval of the
  narrow proof-scope correction on 2026-10-03; NMOS CPU, CIA and stock KERNAL facts
  retain their primary-source authority. Independent source/oracle review cleared
  the corrected invariants on 2026-10-03 before candidate knowledge authoring.
  Those proof-scope fields remain frozen. Independent source/oracle review also
  cleared the separately approved conditional stock-entry fields before new
  guidance authoring. Oracle fields are frozen; qualification and activation
  remain separate.
- **Evaluator prompt:** “Assess cooperative NMI support on PAL/NTSC PRG profiles
  with either SID model and stock KERNAL 901227-03. Compare a private-home-free
  generated ingress, a helper that introduces scratch, a register-only local,
  shared state, a growing stack cycle and a no-installed-handler program. Decide
  what is expressible, rejected, proved or unproved. Audit status/D, source and
  vector/link ownership; distinguish one-entry cost from program peak and finite
  timing. Keep normal keyboard/joystick and RESTORE behavior. Give the smallest
  compiler/library boundary without a new runtime. Contrast known stock `$FE47`,
  unknown/custom initial NMINV, reset-only history and a later unproved writer;
  assess high-byte-only publication and a no-generated-installation program.”
- **Permitted raw artifacts:** Approved normative Chapters 06/11/14/15 and C64
  appendix; NMOS CPU/CIA primary excerpts and pinned KERNAL `init`/`time`/`rs232nmi`;
  complete synthetic selected-instruction and storage inventories; immutable
  saved-link layout; hypothetical source effects and transition sequences.
- **Forbidden material:** This hidden oracle, qualification/history, CodeOps
  plans, current compiler/tests as authority, prior model answers, author history,
  and unallowlisted repository or Web content.
- **Expected decision invariants:** Keeps NMI non-self-masking and externally
  unbounded. Admits only a complete generated path proved reentrant with no
  invocation-private RAM/ZP homes on the four cooperative PRG profiles; source
  locals/helpers are not syntactically banned. Closes parameters/results/staging/
  temporaries/spills/helper scratch after selection and SFA closure. Rejects
  hidden private scratch, incomplete generated invocation-private/ABI/device
  reentrancy and growing compiler-controlled stack cycles. Preserves source-defined
  non-atomic shared effects, their volatile order/count and existing W10211/W10212
  hazard diagnostics; shared RMW alone is not a new source prohibition. Recursion retains E10180/E10181 and ordinary
  finite overflow retains E10238. Keeps callback-only identity, exact A/X/Y/P/D,
  banking and page-safe immutable/lifetime-owned links, event/terminal behavior
  and one consuming CIA2 ICR owner. Installation state is not activation-private
  scratch; a live predecessor cannot be overwritten. `SEI` is not NMI exclusion.
  Reports unrestricted external aggregate stack and unproved retained-firmware
  reentrancy/completion even with no installed generated handler. Per-entry CPU
  three-byte frames and generated saves remain exact; bounded costs cannot be
  labelled full peak/headroom. Finite deadlines require real source/completion
  proof. Raw takeover and D64 receive no new exception. No source exclusion,
  RESTORE suppression, dropping/coalescing, dynamic frames/heap/depth guard,
  input manager, queue, scheduler or dispatcher. Ordinary saved-data interpretation
  belongs in Blend65 platform libraries; this correction does not approve an API
  or certify keyboard ambiguity/port restoration.
  For generated NMINV-installation users only, applies the approved four-profile
  stock `$FE47` program-entry/no-independent-resident-owner condition. Does not
  infer later entry from reset or from the separate IRQ/CIA1 stock handback.
  Proves low byte `$47` through all reachable transitions before high-only update,
  complete predecessor capture before publication and immutable saved-link
  lifetime while an interrupted route may still observe it. An unknown writer
  invalidates the proof; no generated installation means no new entry condition.
  Matching-low direction and nominal instruction savings do not qualify output,
  omit padding/link/context cost or prove a finite external stack/deadline.
- **Disqualifying outcomes:** Invents a nesting number or human-speed assumption;
  blanket-rejects proved private-free generated code on an approved profile;
  accepts an invocation-private RAM/ZP-bearing unbounded route, equates no source locals with reentrancy,
  certifies arbitrary shared effects, treats hardware stack as general local
  storage, suppresses events, consumes firmware-owned ICR, relies on `SEI` for
  vector safety, reports an external finite peak or deadline without proof, or
  claims compiler/VICE/silicon qualification from this contract assessment. Assumes
  stock initial NMINV without the conditional entry contract, treats unknown
  writers as preserving `$47`, allows saved-link reuse while a route remains
  live, or applies the NMI-installation entry requirement to every program.
- **Evidence required to grade:** Exact rule/source citations; complete transitive
  storage/effect trace; all route ownership and state boundaries; independent
  behavior and assembly/cost duties; explicit unknowns and bounded claims.
- **Red-baseline result:** Pending expected failure against the unchanged 2.0.1
  authority. No earlier output is relabelled.
- **Focused result:** Pending isolated candidate evaluation and separate grade.
- **Definitive result:** Pending exact-content independent release review.

## Q-P23 — Return to stock BASIC after exclusive CIA1 timer ownership

- **Risk / coverage cells:** Critical; `CASE-Q-P23`, `SPEC-20`.
- **Oracle status:** `frozen-project+external` — independent source-authority/semantic-soundness review on 2026-09-29 found no defect. The product owner approved the narrow stock-compatible return contract; arbitrary prior-device restoration is excluded. The release transaction is a synthesis of the pinned hardware/stock setup, not a claimed existing ROM exit routine.
- **Evaluator prompt:** “A Blend65 game starts from stock BASIC on each cooperative PAL/NTSC, 6581/8580 PRG profile pinned to KERNAL 901227-03. It installs an exclusive IRQ handler, performs a valid CIA1 mask/pending-source handoff, and uses typed CIA1 timers. The product owner approved normal Quit-to-BASIC by restoring stock CIA1 Timer A service when the final exclusive handler is released. Explain the implementable contract, exact PAL/NTSC reloads, device-access and saved-vector order, CPU-status and storage obligations, and independent proof. Contrast an inner route that changed CIA1, counter reads with and without an exclusive route, known raw writes, and a custom pre-entry resident handler. Can reads recover arbitrary old CIA1 mask/latch state? Can whole IOINIT or a main-return-only repair satisfy this release? Use only supplied local authority; keep unmeasured output/runtime/silicon claims explicit.”
- **Permitted raw artifacts:** Selected profile identities and stock entry declaration; public typed CIA1/IRQ operation signatures; product-approved stock-compatible release contract; optional pinned MOS-6526-1981 timer/ICR and CBM-C64-KERNAL-03 init/PIOKEY extracts. Evaluated router and thirteen runtime references supply local knowledge. No compiler implementation or generated artifact is supplied.
- **Forbidden material:** This oracle, coverage matrix, qualification/release history, plans/reports, prior outputs, compiler code/tests, author conversation, and unallowlisted Web or repository content.
- **Expected decision invariants:** Counters/pending data are readable, reload latches/masks are write-only; no arbitrary prior-state capture is claimed. Qualified stock entry permits an inline stock handback on final exclusive `restoreIRQ()`, even if only counter reads occurred. Observation without an exclusive lease and ordinary chains add none. Retains callback-only identity, exact saved LIFO CINV and existing ABI/terminal ownership. IRQ stays masked across full source-mask clear, Timer A/B stop, one consuming CIA1 ICR read, Timer A low/high reload (`16421`/`$4025` PAL; `17045`/`$4295` NTSC), exact saved-CINV restoration, Timer-A-only mask enable and TOD-preserving Timer A load/start, then caller-status restoration. An inner route that modified CIA1, unproved nonstock predecessor ownership, or known raw mutation is diagnosed rather than speculatively reset; returning `main` has no unreleased handler. No whole IOINIT, epilogue-only release, extra source API, shadow-state manager, late SFA storage or runtime ownership flag. Names full output/ROM/RAM/ZP/stack/cycle accounting and independent behavior plus assembly/cost proof; no emitted cost or VICE/silicon result follows from this packet. Stock compatibility does not recover missed KERNAL ticks or custom pre-entry service.
- **Disqualifying outcomes:** ICR mask snapshot or counter-as-latch claim; predecessor exposed before quiescence/complete CINV; repeated consuming read; active outer owner silently reset; fabricated reload, physical guarantee or measured compiler result; IOINIT return routine; extra release API or hidden runtime storage/framework.
- **Evidence required to grade:** Independent source review; exact candidate/packet identity; enforced isolation controls; evaluator capture and separate grade; explicit uncertainty for unmeasured compiler/runtime costs. Later compiler qualification requires source/span, ordered volatile and assembly/cost oracles, four sequential VICE profiles, and bounded hardware QA.
- **Red-baseline result:** Pending; evaluate unchanged qualified 2.0.0 knowledge before adding handback guidance.
- **Focused result:** Pending candidate qualification.
- **Definitive result:** Pending independent grading and exact candidate activation.
- **2.0.1 red-baseline result, 2026-09-29:** Fail — unchanged active 2.0.0 evaluator answer SHA-256 `8774f9b5aba3edb37f938002ae7a39988954d1e7427b82fc9ea7533bfbdf447c`; separate grade `8742e9d13a9c637b8801f220fec25be6d8962e67f79513559cd2646fa0c1f17a`. Missing reloads and unsafe release order/nested reconstruction discriminate the old baseline. Frozen pre-evaluation oracle section SHA-256 `f223beece43dbab4a422cd5329ba83ab2f40c4920b33bb1696bc6b4c571bbe6d`.
- **2.0.1 focused result, 2026-09-29:** Pass — fresh candidate evaluator and separate independent grade agree on all stock-handback invariants; exact capture identities are recorded in `../release.md`. Final review/approval and byte-identical activation remain open; no compiler/runtime/silicon pass is implied.

### 2.0.1 integrated qualification result — Q-P23

**Pass** for the contract/knowledge boundary only. Ordered stock handback, exact reloads, ownership contrasts and write-only-state limits pass.

Evidence: `candidate-handback / candidate-handback-grade`; exact packet/output identities and captured text
are preserved in `../release.md` under the 2.0.1 capture record. Separate model
grades and independent review are retained, including prior failures and bounded
corrective dispositions. Actual compiler output, runtime and hardware remain
Unknown; this result is not an activation declaration.

## 2.0.2 Dependency-Closed Result Record

This append-only record does not change any oracle or historical result. Exact output, packet hashes, separate grades, failed attempts and corrective dispositions are retained in `../release.md`. Qualification covers documentary reasoning, not compiler implementation, unrestricted external NMI guarantees or physical hardware.

| Case | Result | Evidence and applicability |
|---|---|---|
| Q-P01 | Inherited, unchanged decisive facts only | Prior qualified 2.0.1 lineage (content 1ce4852016e2a883cf1f733c6014c45e176bfc69) and its retained result/capture identities; not a fresh 2.0.2 run. |
| Q-P02 | Pass, fresh documentary qualification | timing / grade-timing; actual runtime b87ef4e3; reviewed unchanged decisive facts apply to final 5a422482. |
| Q-P03 | Inherited, unchanged decisive facts only | Prior qualified 2.0.1 lineage (content 1ce4852016e2a883cf1f733c6014c45e176bfc69) and its retained result/capture identities; not a fresh 2.0.2 run. |
| Q-P04 | Pass, fresh documentary qualification | timing / grade-timing; actual runtime b87ef4e3; reviewed unchanged decisive facts apply to final 5a422482. |
| Q-P05 | Pass, fresh documentary qualification | timing / grade-timing; actual runtime b87ef4e3; reviewed unchanged decisive facts apply to final 5a422482. |
| Q-P06 | Pass, fresh documentary qualification | timing / grade-timing; actual runtime b87ef4e3; reviewed unchanged decisive facts apply to final 5a422482. |
| Q-P07 | Pass, fresh documentary qualification | input-boundary-final / grade-input-boundary-final; actual runtime 0c078efb; reviewed unchanged decisive facts apply to final 5a422482. |
| Q-P08 | Pass, fresh documentary qualification | platform / grade-platform; actual runtime b87ef4e3; reviewed unchanged decisive facts apply to final 5a422482. |
| Q-P09 | Pass, fresh documentary qualification | platform / grade-platform; actual runtime b87ef4e3; reviewed unchanged decisive facts apply to final 5a422482. |
| Q-P10 | Pass, fresh documentary qualification | platform / grade-platform; actual runtime b87ef4e3; reviewed unchanged decisive facts apply to final 5a422482. |
| Q-P11 | Pass, fresh documentary qualification | final-corrections / grade-final-corrections; actual runtime 639cd727; reviewed unchanged decisive facts apply to final 5a422482. |
| Q-P12 | Inherited, unchanged decisive facts only | Prior qualified 2.0.1 lineage (content 1ce4852016e2a883cf1f733c6014c45e176bfc69) and its retained result/capture identities; not a fresh 2.0.2 run. |
| Q-P13 | Pass, fresh documentary qualification | timing / grade-timing; actual runtime b87ef4e3; reviewed unchanged decisive facts apply to final 5a422482. |
| Q-P14 | Inherited, unchanged decisive facts only | Prior qualified 2.0.1 lineage (content 1ce4852016e2a883cf1f733c6014c45e176bfc69) and its retained result/capture identities; not a fresh 2.0.2 run. |
| Q-P15 | Inherited, unchanged decisive facts only | Prior qualified 2.0.1 lineage (content 1ce4852016e2a883cf1f733c6014c45e176bfc69) and its retained result/capture identities; not a fresh 2.0.2 run. |
| Q-P16 | Inherited, unchanged decisive facts only | Prior qualified 2.0.1 lineage (content 1ce4852016e2a883cf1f733c6014c45e176bfc69) and its retained result/capture identities; not a fresh 2.0.2 run. |
| Q-P17 | Pass, fresh documentary qualification | timing / grade-timing; actual runtime b87ef4e3; reviewed unchanged decisive facts apply to final 5a422482. |
| Q-P18 | Inherited, unchanged decisive facts only | Prior qualified 2.0.1 lineage (content 1ce4852016e2a883cf1f733c6014c45e176bfc69) and its retained result/capture identities; not a fresh 2.0.2 run. |
| Q-P19 | Pass, fresh documentary qualification | timing / grade-timing; actual runtime b87ef4e3; reviewed unchanged decisive facts apply to final 5a422482. |
| Q-P20 | Pass, fresh documentary qualification | final-corrections / grade-final-corrections; actual runtime 639cd727; reviewed unchanged decisive facts apply to final 5a422482. |
| Q-P21 | Pass, fresh documentary qualification | platform / grade-platform; actual runtime b87ef4e3; reviewed unchanged decisive facts apply to final 5a422482. |
| Q-P22 | Inherited, unchanged decisive facts only | Prior qualified 2.0.1 lineage (content 1ce4852016e2a883cf1f733c6014c45e176bfc69) and its retained result/capture identities; not a fresh 2.0.2 run. |
| Q-P24 | Pass, fresh documentary qualification | input-boundary-final / grade-input-boundary-final; actual runtime 0c078efb; reviewed unchanged decisive facts apply to final 5a422482. |
| Q-P23 | Pass, fresh documentary qualification | platform / grade-platform; actual runtime b87ef4e3; reviewed unchanged decisive facts apply to final 5a422482. |

## 2.0.3 bounded entry-contract qualification

This append-only record preserves every oracle, old result, failed attempt and
actual capture identity. It grades documentary reasoning, not compiler output,
runtime behavior, keyboard acquisition or physical hardware.

| Case | Current result | Decisive evidence |
|---|---|---|
| Q-P07 | Pass, fresh restricted evaluation and separate grade | nmi-boundary-final / grade-nmi-boundary-final; all six IRQ/NMI routes and twelve fixtures; exact 24-file input envelope. |
| Q-P24 | Pass, fresh restricted evaluation and separate grade | Same paired capture, graded independently; conditional stock entry/no-hook distinction, complete low-byte/capture/live-link proof obligations and unproved external guarantees retained. |
| Q-P23 | Pass, fresh unchanged-control evaluation and separate grade | control-boundary-final / grade-control-boundary-final; exact 16-file input envelope, bounded stock-handback fixture, no NMINV-entry restriction for no-hook programs. |

The paired evaluator answer is `4126f2afb451b64ab118923aa78bf6294a8d0e6cc45d2216fc2225efeb5df36e`;
its independent grade is `8d30d2949bfa4b53a99e812638c3651bcab55504762fff688307725711bcd256`.
The control answer is `bef1f45f76ad777030e1ebcca296fca24599f6c17b6e3b487eca4c47452c7ba4`;
its grade is `eee5ecb2d23a1ce50501908e17edc510d0ecf4e81860c7f27c6ce8b6e3c872bc`.
Both have zero unresolved grading defects. Exact packets, lossless answers,
requests, launch commands and receipts are retained in `../release.md`.
The earlier overbroad packets, their genuine pre-pass/failed grades and focused
completions are supporting only; they do not constitute final qualification.
Other platform cases inherit only independently reviewed unchanged decisive
fields from qualified 2.0.2/content `13b995d0ddacc304aa066e015c14c63678e99dcc`.
