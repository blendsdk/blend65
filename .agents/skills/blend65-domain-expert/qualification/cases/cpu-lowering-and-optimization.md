# Qualification Cases: CPU, Lowering, and Optimization

> **Oracle family**: Q-C01..Q-C24
> **Authority gate**: All 49 external machine-fact oracles across the case families are frozen. The
> Phase-2 review froze 47 directly. The reconciled Phase-3 specification binds Q-C13 and
> AR-P32/SC-131's replacement Q-C19 semantic oracle; Phase 4 supplies and independently grades
> their CPU/lowering qualification.
> **Result policy**: Result entries are append-only. Draft observations cannot count as pass/fail release evidence.

## Shared Isolation Boundary

The evaluator receives the prompt, the named raw machine artifacts, and the candidate CPU/lowering references only when that run stage permits them. The evaluator never receives this oracle, planning material, source-to-oracle review notes, prior results, or author history. For any transformation, the grader requires an independent behavior oracle and a separate assembly/resource expectation; optimized-versus-unoptimized differential execution is supporting evidence only.

## Q-C01 — `CMP` followed by signed branch with V pre-seeded both ways

- **Risk / coverage cells:** Critical; `CPU-C01`, `LOWER-C01`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “`CMP` followed by signed branch with V pre-seeded both ways. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** Candidate sequence, all input pairs requested by the prompt, initial P states with V=0 and V=1, and an execution trace.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Detects stale V: CMP does not produce V; rejects `N xor V` use.
- **Disqualifying outcomes:** Accepts sequence under favorable V.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Draft observation: fail — the legacy text states `N xor V` but omits that `CMP` does not produce V, permitting stale-V reasoning (`mos-6502-codegen.md:52-56`).
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C02 — Signed byte `<` over `-128,-1,0,1,127` pairs

- **Risk / coverage cells:** Critical; `CPU-C02`, `LOWER-C02`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Signed byte `<` over `-128,-1,0,1,127` pairs. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** Signed byte operand pairs `-128,-1,0,1,127`, candidate lowering, initial flag states, and selected NMOS target.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Selects valid sign-normalize/sign-split/controlled-SBC family with assumptions/cost.
- **Disqualifying outcomes:** Uses N or C alone.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.
## Q-C03 — Unsigned byte `>=` in branch context

- **Risk / coverage cells:** Major; `CPU-C03`, `LOWER-C03`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Unsigned byte `>=` in branch context. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** Unsigned operands, branch context, candidate sequence, and live-register/flag obligations.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Uses CMP carry directly and avoids boolean materialization.
- **Disqualifying outcomes:** Calls helper or uses signed rule.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C04 — Signed word compare with equal/different high bytes

- **Risk / coverage cells:** Critical; `CPU-C04`, `LOWER-C04`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Signed word compare with equal/different high bytes. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** Signed word boundary pairs, candidate sequence, and high/low-byte decision trace.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** High-byte signed decision first, lower byte only on equality.
- **Disqualifying outcomes:** Lets low-byte carry override signed high relation.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C05 — Word addition with live incoming carry irrelevant to source

- **Risk / coverage cells:** Critical; `CPU-C05`, `LOWER-C05`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Word addition with live incoming carry irrelevant to source. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** Word operands, both incoming carry states, candidate sequence, and expected modular result.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Establishes carry before low byte and propagates upward.
- **Disqualifying outcomes:** Reuses unknown carry.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C06 — Word subtraction

- **Risk / coverage cells:** Critical; `CPU-C06`, `LOWER-C06`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Word subtraction. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** Word operands, both incoming carry states, candidate sequence, and expected modular result.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Starts SEC/no-borrow chain and records clobbers.
- **Disqualifying outcomes:** Treats carry as borrow.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C07 — IRQ arrives while decimal mode may be set on NMOS C64

- **Risk / coverage cells:** Critical; `CPU-C07`, `LOWER-C07`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “IRQ arrives while decimal mode may be set on NMOS C64. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** Declared NMOS C64 ABI, mainline decimal-state possibilities, IRQ entry/exit sequence, and arithmetic trace.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Applies declared ABI/CLD policy and NMOS versus CMOS distinction.
- **Disqualifying outcomes:** Assumes interrupt clears D.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Draft observation: pre-passer — NMOS interrupt decimal-state danger and ABI ownership are explicit (`mos-6502-codegen.md:58-60`).
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C08 — `(zp),Y` pointer stored at `$FF`

- **Risk / coverage cells:** Critical; `CPU-C08`, `LOWER-C08`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “`(zp),Y` pointer stored at `$FF`. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** Pointer placement at `$FF`, `(zp),Y` sequence, memory bytes, and selected CPU.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Detects zero-page pointer high-byte wrap and placement constraint.
- **Disqualifying outcomes:** Treats fetch as `$00FF/$0100`.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C09 — `JMP ($12FF)` on NMOS

- **Risk / coverage cells:** Critical; `CPU-C09`, `LOWER-C09`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “`JMP ($12FF)` on NMOS. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** Indirect vector at `$12FF`, surrounding memory, selected NMOS CPU, and candidate jump.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Detects indirect high-byte page wrap; avoids or uses deliberately.
- **Disqualifying outcomes:** Applies 65C02 corrected behavior to C64.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C10 — Replace VIC register update with INC/RMW

- **Risk / coverage cells:** Critical; `CPU-C10`, `LOWER-C10`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Replace VIC register update with INC/RMW. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** VIC register identity, before/after access sequence, bus/device trace, and candidate optimization.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Accounts for bus-visible RMW/device semantics before deciding.
- **Disqualifying outcomes:** Optimizes from bytes/cycles only.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Draft observation: pre-passer — bus-visible RMW and VIC acknowledgement hazards are explicit (`mos-6502-codegen.md:68`; `c64-game-systems.md:43-48`).
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C11 — Forward/backward branch near range and page boundary

- **Risk / coverage cells:** Major; `CPU-C11`, `LOWER-C11`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Forward/backward branch near range and page boundary. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** Branch addresses/displacements, taken state, source/destination pages, and candidate layout/repair.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Reports not-taken/taken/page-cross paths and later relaxation/layout ownership.
- **Disqualifying outcomes:** Gives one unconditional cycle count.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C12 — Absolute-indexed load/store crossing page

- **Risk / coverage cells:** Major; `CPU-C12`, `LOWER-C12`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Absolute-indexed load/store crossing page. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** Effective addresses on same/crossed pages for indexed reads and stores, with selected opcode forms.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Adds conditional read cost but not a fictitious store discount.
- **Disqualifying outcomes:** Applies same timing rule to both.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C13 — Signed right shift byte/word

- **Risk / coverage cells:** Critical; `CPU-C13`, `LOWER-C13`.
- **Oracle status:** `frozen-external` — the reconciled specification preserves arithmetic sign
  extension and the machine facts passed independent source review.
- **Evaluator prompt:** “Signed right shift byte/word. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** Byte/word negative and non-negative inputs, all relevant counts, candidate sequence, and result/flag trace.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Preserves arithmetic sign extension for signed `>>`. At counts
  at least the width, a negative operand produces `-1` and a non-negative operand produces `0`;
  unsigned `>>` and `<<` produce `0`.
- **Disqualifying outcomes:** Produces `0` for a negative signed wide right shift or uses `LSR`
  alone as an arithmetic shift.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C14 — Multiply by 0/1/power/constant/variable

- **Risk / coverage cells:** Major; `CPU-C14`, `LOWER-C14`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Multiply by 0/1/power/constant/variable. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** Operand widths/signedness, constants and variable cases, execution frequency, candidate sequences/tables/helpers, and full resource ledger.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Uses fold/identity/shifts/add chain/table/helper by semantics and total cost.
- **Disqualifying outcomes:** Always calls general helper.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C15 — Signed division and remainder by a power of two with negative odd value

- **Risk / coverage cells:** Critical; `CPU-C15`, `LOWER-C15`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Signed division and remainder by a power of two with negative odd value. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** The specified truncation-toward-zero quotient and signed-remainder
  identity, negative odd boundaries, divisor powers of two, and candidate transformations.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Preserves the specified truncation-toward-zero quotient and
  `r = a - q*b`, including `-3 / 2 == -1` and `-5 % 2 == -1`. Restricts plain shift/mask forms to
  unsigned, proven-nonnegative, or otherwise proven-equivalent inputs; otherwise uses a sign-aware
  correction or the general lowering.
- **Disqualifying outcomes:** Replaces signed-negative division blindly with arithmetic shift or
  signed-negative remainder blindly with a positive mask.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C16 — Comparison feeds branch then separately stored boolean

- **Risk / coverage cells:** Major; `CPU-C16`, `LOWER-C16`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Comparison feeds branch then separately stored boolean. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** Condition use graph showing branch and escaping boolean, candidate IL/assembly, and liveness.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Branches directly where possible, materializes only escaping value.
- **Disqualifying outcomes:** Materializes every condition early.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C17 — W65C02-only opcode in selected C64 output

- **Risk / coverage cells:** Critical; `CPU-C17`, `LOWER-C17`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “W65C02-only opcode in selected C64 output. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** Selected C64 NMOS target, assembler mode, emitted opcode bytes, and CPU-variant declaration.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Rejects as illegal target form despite assembler acceptance mode.
- **Disqualifying outcomes:** Treats family superset as safe.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C18 — Inline versus helper with two call sites and IRQ reachability

- **Risk / coverage cells:** Major; `CPU-C18`, `LOWER-C18`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Inline versus helper with two call sites and IRQ reachability. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** Two call sites, body/helper alternatives, live ABI state, IRQ reachability, dead-strip context, and complete cost ledger.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Includes call/ABI/body/dead-strip/reentrancy/ZP costs.
- **Disqualifying outcomes:** Compares body instruction count only.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C19 — Full 256-iteration canonical loop

- **Risk / coverage cells:** Major; `CPU-C19`, `LOWER-C19`.
- **Oracle status:** `frozen-project+external` after AR-P32 — ordinary three-clause semantics select
  behavior; the machine facts passed independent source review.
- **Evaluator prompt:** “Compare `for (let i: word = 0; i < 256; i += 1)` with the same loop using
  `i: byte`. For the declared CPU, determine exact source behavior and the smallest expert lowering
  for the word form. State every proof precondition and clobber, show the decisive state/path
  reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding
  costs where applicable.”
- **Permitted raw artifacts:** Reconciled three-clause loop semantics, both loop sources,
  initial/visited/terminal counter states, candidate sequence, execution-count trace, and selected
  CPU `INX`/`DEX` and branch facts.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** The word form visits 0 through 255 and reaches the semantic word
  terminal state 256. It may use one byte of induction state and `INX` plus a wrap-to-zero exit only
  when proof establishes the exact 256-step canonical shape, the semantic word value does not
  escape, the terminal state is unobservable, and calls/effects cannot observe or change it. The
  byte form wraps from 255 to 0, so `i < 256` stays true and the loop is deterministically infinite.
  It is diagnosed only by ordinary compile-time nontermination policy, never silently converted to
  a hidden range loop. Noncanonical loops use the correct general CFG lowering.
- **Disqualifying outcomes:** Rejects the valid word loop, silently widens or repairs the byte loop,
  loses an iteration, exposes the narrowed internal representation, applies wrap lowering without
  its escape/effect proof, adds a runtime, or retains a second range-loop contract.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C20 — Link-time symbol low/high bytes

- **Risk / coverage cells:** Major; `CPU-C20`, `LOWER-C20`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Link-time symbol low/high bytes. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** Symbol expression, assembler-visible relocation facts, candidate output, and assembled bytes/symbol report.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Keeps symbolic assembler resolution; no runtime helper/materialization.
- **Disqualifying outcomes:** Calculates known address at runtime.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C21 — An optimization changes lowered assembly

- **Risk / coverage cells:** Critical; `CPU-C21`, `LOWER-C21`.
- **Oracle status:** `frozen-project` — the accepted transformation-proof policy governs this
  method case; CPU/spec artifacts remain isolated evaluation inputs, not the source of the oracle.
- **Evaluator prompt:** “An optimization changes lowered assembly. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** Original and optimized forms, independent reference behavior oracle, adversarial states, emitted assembly, and complete cost ledger.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Requires both an independent behavior oracle and the intended assembly/cost expectation; differential execution is supporting only.
- **Disqualifying outcomes:** Accepts shape/cost alone or lets two paths validate a shared lowering bug.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C22 — Fixed-trip hot loop is considered for unrolling

- **Risk / coverage cells:** Major; `CPU-C22`, `LOWER-C22`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Fixed-trip hot loop is considered for unrolling. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** Trip count, path frequency, body, layout/branch range, code-size budget, and partial/full/no-unroll candidates.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Chooses from measured trip count, path frequency, code/layout cost, and cycle benefit; partial/full/no unroll are all legitimate results.
- **Disqualifying outcomes:** Unrolls every constant loop or rejects unrolling universally.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C23 — Specialize an indirect access by modifying an absolute operand

- **Risk / coverage cells:** Critical; `CPU-C23`, `LOWER-C23`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Specialize an indirect access by modifying an absolute operand. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** Code memory writability, ownership/reentrancy/IRQ facts, operand patch target, safe alternative, frequency, and full cost.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Requires writable code, exclusive/synchronized ownership, non-reentrancy or a protocol, IRQ safety, selected-target legality, and measured benefit; otherwise keeps a safe form.
- **Disqualifying outcomes:** Enables self-modifying code from performance intent alone.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.

## Q-C24 — Replace arithmetic or shifts with lookup/pre-shifted data

- **Risk / coverage cells:** Major; `CPU-C24`, `LOWER-C24`.
- **Oracle status:** `frozen-external` — independently source-reviewed in Phase 2; later content qualification remains required.
- **Evaluator prompt:** “Replace arithmetic or shifts with lookup/pre-shifted data. For the declared CPU, determine the correct behavior and expert lowering decision. State preconditions and clobbers, show the decisive state/path reasoning, and compare complete bytes, cycles, flags, memory traffic, ZP/frame/stack/data/padding costs where applicable.”
- **Permitted raw artifacts:** Arithmetic workload, candidate table data, alignment/padding/banking/visibility, access frequency, safe direct alternative, and full cost.
- **Forbidden material:** This hidden oracle, coverage conclusions, plans, prior outputs, legacy-skill conclusions, author history, and any CPU fact not in the allowlisted packet.
- **Expected decision invariants:** Includes table bytes, alignment/padding, placement/banking, actual access cost, workload frequency, and behavior proof.
- **Disqualifying outcomes:** Calls table lookup faster without whole-program cost or visibility analysis.
- **Evidence required to grade:** Primary-source pinpoints after freeze, a state/effect trace, exact legal instruction forms and clobbers, path-specific bytes/cycles, full attributable resource costs, and an independent behavior proof when code shape changes.
- **Red-baseline result:** Not run; draft observations only.
- **Focused result:** Pass — the Phase-4 evaluator and independent grade are recorded in
  `../release.md#phase-4-focused-results`.
- **Definitive result:** Not run.
