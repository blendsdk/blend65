# Requirements: RD-05 SFA Frame Planner & Zero-Page Allocator

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-05](../../requirements/RD-05-sfa-frame-planner.md) · spec Ch 11, Ch 06 §5–§7

## Feature Overview

The SFA frame planner is the final front-end stage. It consumes per-function frame inputs
(`FunctionInfo[]`) plus a platform budget profile and produces an immutable `AllocationPlan`:
every function's frame is computed and assigned an offset via interference-graph coloring
(non-overlapping-lifetime functions share frame memory), module-level variables and zero-page
variables/pointers/temps are placed, worst-case hardware stack depth is computed, budgets are
checked with pre-ACME diagnostics, and ACME symbol definitions are produced for the emitter.

Per register **D1**, all algorithms are implemented for real and tested against fixtures. Per
**D3/D5**, the planner's input is the RD-05-owned `FunctionInfo` record (not the semantic
`Symbol`); the live `SemanticModel → FunctionInfo[]` extraction (`modelToFunctionInfo`) is the
single deferred seam (returns `[]` under the RD-04 passthrough).

## Functional Requirements

### Must Have — Core records (`@blend65/core/sfa/`)

- [ ] **FR-1** `FunctionInfo` + `FrameVar` records (planner input; D3/D5) — RD-05 §4.2 / R1/R2/R6
- [ ] **FR-2** `FunctionFrame` + `FrameSlot` records — RD-05 §4.2
- [ ] **FR-3** `AllocationPlan` + sub-records (`FrameAllocation`, `ZpAllocation`,
      `ModuleVariableAllocation`, `StackAnalysis`, `SymbolDefinition`, `SfaResourceData`) — RD-05 §4.10
- [ ] **FR-4** Interim `PlatformProfile` budget fields added additively to the core stub (D2) —
      RD-05 R20/R28/R39/R40, §4.5/§4.9
- [ ] **FR-5** C64-shaped test fixture profile with concrete budget values — D2

### Must Have — Frame computation (`frame-computation.ts`)

- [ ] **FR-6** Compute a `FunctionFrame` per function: ordered slots (parameters first, then
      locals), each with name/kind/type/size/offset — R1/R6
- [ ] **FR-7** Slot sizes follow the Ch 11 §3.3 type-size table (byte/sbyte/boolean/enum=1;
      word/sword=2; struct param=2 ptr; array param=2 ptr; struct local=`sizeof`; array
      local=`elem×N`) — R2
- [ ] **FR-8** Frame size = sum of slot sizes; no alignment/padding — R3
- [ ] **FR-9** Empty frames (no params/locals) have size 0 but still exist in the graph — R4
- [ ] **FR-10** `main()` is treated like any other function — R5

### Must Have — Interference graph & coloring (`interference.ts`, `coloring.ts`)

- [ ] **FR-11** Build interference graph: ancestor-descendant call pairs interfere — R10/R11, §4.3
- [ ] **FR-12** Always-live nodes (interrupt R14, escaped R15, `main` R13) interfere with all — R13/R14/R15
- [ ] **FR-13** Unreachable functions excluded from the graph (no frame, no offset) — R17
- [ ] **FR-14** Greedy chordal coloring assigns frame offsets; interfering functions never
      overlap, non-interfering may overlap; region size minimized — R12, §4.4
- [ ] **FR-15** Deterministic: order by frame size desc, ties by name → identical layout — R18, §4.4
- [ ] **FR-16** `frameRegionSize` = max(offset+size) = peak simultaneous footprint — R21/R22

### Must Have — Layout & zero-page (`zp-allocator.ts`, layout in plan)

- [ ] **FR-17** Module-level `let` variables placed sequentially (init order, declaration order);
      sizes summed for budget; absolute base after module vars — R24, §4.5
- [ ] **FR-18** Const scalars inlined (0 bytes); const aggregates are Data-segment (not RAM-placed
      by planner) — R25/R26 (recorded; planner places only `let` RAM vars + ZP)
- [ ] **FR-19** Frame region placed immediately after module variables;
      `F.absoluteAddress = frameRegionBase + F.frameOffset` — R19/R23, §4.6
- [ ] **FR-20** ZP priority allocation: (1) user `zeropage` vars, (2) struct/array pointers,
      (3) main expression temps, (4) IRQ temps (separate pool) — R29, §4.7
- [ ] **FR-21** ZP pointer bytes shared via the interference graph (sequential share, nested
      accumulate); peak = deepest by-ref nesting × 2 — R31/R32, §4.7
- [ ] **FR-22** Configurable expression-temp reservation (default 4 main / 2 IRQ) — R33, §4.8
- [ ] **FR-23** Reserve the platform ZP arg-block minimum (read from profile); **interim default 0 — deferred to RD-17 (D8)**, category plumbed — RD-05 §7-Q3, R(AR-34)
- [ ] **FR-24** ZP allocation deterministic — R36

### Must Have — Stack depth & budgets (`stack-analysis.ts`, `budgets.ts`)

- [ ] **FR-25** Worst-case main-path stack depth = longest call chain × 2 — R37, §4.9
- [ ] **FR-26** Interrupt overhead (6 bytes/handler) + IRQ-path depth added to worst case — R38, §4.9
- [ ] **FR-27** Stack budget from profile; W10180 above warning threshold — R39/R40
- [ ] **FR-28** ZP budget exceeded → **E10032** (pre-ACME) — R30/R35/R41
- [ ] **FR-29** RAM budget exceeded (module vars + frame region) → **E10033** (pre-ACME) — R42
- [ ] **FR-30** Large ZP → **W10030**; RAM nearing limit → **W10033**; stack near limit → **W10180** — R43/R44/R45
- [ ] **FR-31** All diagnostics flow through the passed `DiagnosticBag` — R46

### Must Have — Symbols, plan & API (`symbols.ts`, `plan-allocation.ts`, `model-adapter.ts`)

- [ ] **FR-32** Generate ACME symbol definitions: `__frame_*`, `__frame_*_<slot>`, `__var_*`,
      `__zp_*`, `__zp_ptr_N`, `__zp_tmp_N`, `__zp_irq_tmp_N` — R47/R50, §4.11
- [ ] **FR-33** Symbol names deterministic, ASCII `[A-Za-z0-9_]`, `__`-prefixed — R47, §4.11
- [ ] **FR-34** `planAllocation(input: PlanInput, profile, bag): AllocationPlan` assembles the
      9-step pipeline and returns an immutable plan; the `PlanInput` object carries
      `functions: FunctionInfo[]` + module/ZP-var lists (signature refinement, **D9**) — R51–R59, §4.1/§4.12
- [ ] **FR-35** `AllocationPlan.resourceData` carries all numbers RD-11 needs (frame/zp/ram/stack
      used vs budget) — R58
- [ ] **FR-36** `modelToFunctionInfo(model): FunctionInfo[]` adapter — **returns `[]`** under the
      passthrough (single deferred seam, D1/D3/D5) — RD-05 §5 (RD-04 interaction)

### Must Have — Error tolerance

- [ ] **FR-37** Planner never throws; runs on partial input — R60/R61, AR-15
- [ ] **FR-38** Functions with error types / unresolved data get empty frames, are skipped — R60/R61
- [ ] **FR-39** Budget diagnostics suppressed when input indicates upstream errors
      (cascade suppression) — R62, AR-74

### Should Have

- [ ] **FR-40** `sharingSaved` = Σ frame sizes − `frameRegionSize` (reporting) — R56
- [ ] **FR-41** Golden-snapshot serialization of `AllocationPlan` for determinism tests — AC-21

### Won't Have (Out of Scope — lives elsewhere)

- Call-graph construction & recursion detection → RD-04 (planner consumes, asserts acyclicity)
- Code/data segment placement (function code, const data addresses) → RD-09 (ACME `* = $XXXX`)
- Canonical platform profile definition (full memory map) → RD-10 (interim shape only here, D2)
- IL representation / lowering → RD-06; virtual-temp→register binding → RD-07
- Resource report aggregation/rendering → RD-11 (planner only contributes `resourceData`)
- Live population of `FunctionInfo` from a real `SemanticModel` → deferred to RD-04b (adapter seam)

## Technical Requirements

### Performance

- Coloring is O(N²) over functions (N < ~100 for 6502 programs) — acceptable (RD-05 §4.4).

### Compatibility

- ESM, NodeNext, strict TS, ES2023; relative imports use `.js`.
- `@blend65/core/sfa` consumable by `frontend` and `language-server`; **R15/AR-20** — frontend
  `sfa/` MUST NOT import `@blend65/codegen`.
- Additive only: extending `PlatformProfile` and barrels must not break RD-04's frozen surface.
- `spec/` untouched (D3-RD04 freeze) — `git status --porcelain spec/` stays empty.

### Security

- N/A (compiler internal; no external input, no network, no FS in these passes).

## Scope Decisions

| Decision                         | Options Considered                    | Chosen | Rationale                                            | AR Ref |
| -------------------------------- | ------------------------------------- | ------ | ---------------------------------------------------- | ------ |
| Build strategy                   | A full fixture-tested / B passthrough | A      | Pure functions; real testable value now              | D1     |
| Platform budgets                 | A interim fields / B RD-10 slice      | A      | Unblocks RD-05; RD-10 supersedes additively          | D2     |
| Frame-input surface              | A extend `Symbol` / B `FunctionInfo`  | B      | Clean stage contract; one adapter = deferral seam    | D3/D5  |
| Diagnostic codes                 | A reuse / B add                       | A      | Codes verified present; one-registry rule            | D4     |
| Module directory                 | A `sfa/` / B `allocator/` / C semantics | A    | Names the domain; symmetric with `semantics/`        | D6     |
| Commit mode                      | ask / no-commit / auto                | no-commit | Consistent with RD-01..RD-04                      | D7     |

> **Traceability:** every decision above references the Ambiguity Register (`00-ambiguity-register.md`).

## Acceptance Criteria

Mapped to RD-05 §6 (AC-01..AC-21). Items marked **(deferred-wiring)** are satisfied structurally
now; their live behavior activates with the `modelToFunctionInfo` adapter under RD-04b.

1. [ ] **AC-01** `planAllocation()` accepts `FunctionInfo[]` + `PlatformProfile` (+ bag), returns `AllocationPlan`
2. [ ] **AC-02** Every function with params/locals gets a `FunctionFrame` with correct slot sizes (Ch 11 §3.3)
3. [ ] **AC-03** Coloring: interfering functions non-overlapping, non-interfering overlapping
4. [ ] **AC-04** Interrupt frames never share with any other frame
5. [ ] **AC-05** Escaped (address-taken) frames never share with any other frame
6. [ ] **AC-06** `frameRegionSize` = peak simultaneous footprint (not Σ all frames)
7. [ ] **AC-07** Ch 11 §3.4 example: `init`/`update`/`render` share; `handleInput`/`drawSprites` share
8. [ ] **AC-08** `zeropage` vars placed at valid ZP addresses within range
9. [ ] **AC-09** ZP priority order: user → pointers → temps → IRQ temps
10. [ ] **AC-10** ZP pointer bytes shared between non-overlapping-lifetime functions
11. [ ] **AC-11** E10032 emitted when ZP allocation exceeds budget
12. [ ] **AC-12** E10033 emitted when RAM (module vars + frame region) exceeds budget
13. [ ] **AC-13** W10180 emitted when stack depth approaches budget
14. [ ] **AC-14** Budget errors (E10032/E10033) emitted pre-ACME
15. [ ] **AC-15** ACME symbol definitions generated for frame bases, slots, module vars, ZP allocations
16. [ ] **AC-16** Symbol names + addresses deterministic for identical input
17. [ ] **AC-17** Planner never crashes on partial/error input (error-tolerant)
18. [ ] **AC-18** `resourceData` contains all SFA-owned numbers for the ResourceReport
19. [ ] **AC-19** All decisions trace to an AR or frozen spec section
20. [ ] **AC-20** Unit tests cover frame computation, interference, coloring, ZP, stack, budgets
21. [ ] **AC-21** Golden-snapshot tests assert deterministic `AllocationPlan` output
22. [x] **AC-22 (plan-local)** `modelToFunctionInfo` returns `[]` under passthrough; documented `// DEFERRED` seam (D1/D3/D5) — **superseded by RD-18 Slice 3a (2026-07-05):** the seam is now *implemented* for **populated** models (frontend `sfa/model-adapter.ts` → real `FunctionInfo[]`); the empty passthrough model still yields `[]` (contract preserved, spec-tested). See `plans/rd-18-slice-3a-model-seam/`.
23. [ ] All verification passing (`build`/`typecheck`/`lint`/`test`); `spec/` clean; R15 boundary green
