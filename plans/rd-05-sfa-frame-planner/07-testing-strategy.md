# Testing Strategy: RD-05 SFA Frame Planner

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- Unit tests: ≥ 90% of critical-path SFA logic (frame computation, interference, coloring, ZP,
  stack, budgets, symbols, plan assembly).
- Golden-snapshot: deterministic `AllocationPlan` for representative call graphs (AC-21).
- No emulator tier (AR-27; arrives with RD-12). All RD-05 tests are unit + golden (AR-22 tiers 1–2).

### Test file naming (project convention)

- **Spec tests** (written first, from ST-cases): `*.spec.test.ts`.
- **Impl tests** (edge cases/internals, after implementation): `*.impl.test.ts`.

## 🚨 Specification Test Cases (MANDATORY)

> Derived exclusively from `01-requirements.md`, the `03-0x` specs, RD-05, and frozen spec Ch 11.
> Expectations come from the specification — NOT from implementation. Immutable oracle.

### Frame computation (03-01)

| #     | Input / Scenario                                              | Expected Output / Behavior                                     | Source            |
|-------|--------------------------------------------------------------|----------------------------------------------------------------|-------------------|
| ST-F1 | `slotSize(byte local)`                                       | `1`                                                            | R2 / §3.3         |
| ST-F2 | `slotSize(word local)`                                       | `2`                                                            | R2 / §3.3         |
| ST-F3 | `slotSize(struct param byRef)` (struct byteSize 4)          | `2` (pointer)                                                  | R2 / §3.3         |
| ST-F4 | `slotSize(struct local)` (struct byteSize 4)                | `4` (sizeof)                                                  | R2 / §3.3         |
| ST-F5 | `slotSize(array T[3] local)` (elem byte)                    | `3` (elem×N)                                                  | R2 / §3.3         |
| ST-F6 | `computeFrame` with [param sword, local byte]               | slots ordered param→local; offsets 0,2; `totalSize 3`         | R6 / §4.2         |
| ST-F7 | `computeFrame` with no params/locals                        | `slots []`, `totalSize 0`                                     | R4                |
| ST-F8 | `computeFrame` slot with `void`/`error` type                | slot size `0`; never throws                                   | R60               |

### Interference graph (03-02)

| #     | Input / Scenario                                              | Expected Output / Behavior                                     | Source            |
|-------|--------------------------------------------------------------|----------------------------------------------------------------|-------------------|
| ST-I1 | chain `a→b→c`                                                | edges {a-b, a-c, b-c}                                          | R10/R11 / §4.3    |
| ST-I2 | siblings `m→{x,y}` (x,y no callees)                         | edges {m-x, m-y}; **no** x-y edge                             | R10 / §4.3        |
| ST-I3 | interrupt `irq` + unrelated `f`                             | irq interferes with `f` (and all)                             | R14               |
| ST-I4 | escaped `g` (isEscaped) + unrelated `f`                    | g interferes with `f` (and all)                               | R15               |
| ST-I5 | unreachable `dead` (isReachable false)                     | `dead` absent from nodes and edges                            | R17               |
| ST-I6 | `main→{a,b}`                                               | main interferes with a and b                                  | R13               |

### Frame coloring (03-02)

| #     | Input / Scenario                                              | Expected Output / Behavior                                     | Source            |
|-------|--------------------------------------------------------------|----------------------------------------------------------------|-------------------|
| ST-C1 | two non-interfering frames size 2 each                      | overlapping offsets (both 0); `frameRegionSize 2`             | R12 / §4.4        |
| ST-C2 | two interfering frames size 2 each                          | offsets 0 and 2; `frameRegionSize 4`                          | R12 / §4.4        |
| ST-C3 | interfering sizes [3,1] ordered desc                        | 3@0, 1@3; region 4                                            | R15-order / §4.4  |
| ST-C4 | run coloring twice on same input                            | identical offsets (determinism)                               | R18               |
| ST-C5 | zero-size frame among others                                | offset 0; does not grow region                                | R4                |
| ST-C6 | **Ch 11 §3.4 example** (full call graph)                   | init/update/render share; handleInput/drawSprites share; moveEnemies/drawBackground share | AC-07 / §3.4 |

### Module vars & ZP (03-03)

| #     | Input / Scenario                                              | Expected Output / Behavior                                     | Source            |
|-------|--------------------------------------------------------------|----------------------------------------------------------------|-------------------|
| ST-Z1 | module vars [byte, word, byte]                              | offsets 0,1,3; total 4; addresses ramStart+offset             | R24 / §4.5        |
| ST-Z2 | ZP order: argBlock 4, user 1, ptr 1, mainTemp 4, irq 2     | categories in order arg-block→user→pointer→temp→irq-temp      | R29 / §4.7        |
| ST-Z3 | generated ZP names                                          | `__zp_ptr_0`, `__zp_tmp_0`, `__zp_irq_tmp_0`                   | §4.11             |
| ST-Z4 | `computePeakPointers`: sequential f(struct);g(struct)       | `1`                                                           | R31/R32 / §4.7    |
| ST-Z5 | `computePeakPointers`: nested f→g (both by-ref)            | `2`                                                           | R31/R32 / §4.7    |
| ST-Z6 | ZP allocation exceeds `zpEnd`                               | **E10032** once; `overflowed true`; stops                     | R35 / AC-11       |
| ST-Z7 | ZP usage ≥ 80% budget, not overflowed                      | **W10030** emitted                                            | R43               |
| ST-Z8 | ZP allocation run twice                                     | identical layout (determinism)                                | R36               |

### Stack & budgets (03-04)

| #     | Input / Scenario                                              | Expected Output / Behavior                                     | Source            |
|-------|--------------------------------------------------------------|----------------------------------------------------------------|-------------------|
| ST-S1 | chain main→a→b (no irq)                                     | `maxMainDepth 3`; `maxMainStackBytes 6`; irqOverhead 0        | R37 / §4.9        |
| ST-S2 | with one interrupt irq→x                                    | irqOverhead 6; `maxIrqStackBytes 4`; total = main+6+4         | R38 / §4.9        |
| ST-S3 | total stack ≥ 75% budget                                    | **W10180** emitted                                            | R40 / AC-13       |
| ST-S4 | RAM used > budget                                           | **E10033** emitted (pre-ACME)                                 | R42 / AC-12       |
| ST-S5 | RAM used ≥ 90% budget (not over)                           | **W10033** emitted                                            | R44               |
| ST-S6 | `upstreamErrors true`                                       | no budget diagnostics at all (cascade suppression)            | R62 / §4.13       |

### Symbols & plan (03-05)

| #     | Input / Scenario                                              | Expected Output / Behavior                                     | Source            |
|-------|--------------------------------------------------------------|----------------------------------------------------------------|-------------------|
| ST-A1 | symbol for frame base `Game.update` @ $0810                | `{name:"__frame_Game_update", value:0x0810}`                  | §4.11             |
| ST-A2 | symbol for slot `dx` (offset 2) of that frame              | `{name:"__frame_Game_update_dx", value:0x0812}`               | §4.11             |
| ST-A3 | module var `Game.score`                                    | `{name:"__var_Game_score", value:<addr>}`                     | §4.11             |
| ST-A4 | symbol generation order                                    | deterministic (frames by name, then vars, then ZP)            | R50 / AC-16       |
| ST-P1 | `planAllocation` minimal (one empty `main`)               | regionSize 0; valid plan; `__frame_main` symbol present       | AC-01             |
| ST-P2 | `planAllocation` Ch 11 §3.4 program                        | plan matches golden snapshot (frames/zp/stack/symbols)        | AC-07/AC-21       |
| ST-P3 | `planAllocation` `resourceData`                            | contains zp/ram/frame/stack used+budget                       | AC-18             |
| ST-P4 | `planAllocation` with RAM overflow                         | `hasErrors true`; E10033 in bag                               | AC-12             |
| ST-P5 | `planAllocation` never throws on empty/partial input       | returns valid plan                                            | AC-17             |
| ST-P6 | `modelToFunctionInfo(emptyModel)`                          | `[]` (deferred seam)                                          | AC-22 / D1/D3/D5  |

> **Authoring rule:** ST expectations derive from the specs above. If any expected value cannot be
> determined from the specification, STOP and add an ambiguity to `00-ambiguity-register.md`.

## Test Categories

### Specification Tests (from ST-cases)

| Test File                                                  | ST Cases Covered          | Component                  |
|------------------------------------------------------------|---------------------------|----------------------------|
| `packages/frontend/src/sfa/frame-computation.spec.test.ts` | ST-F1..ST-F8              | Frame computation          |
| `packages/frontend/src/sfa/interference.spec.test.ts`      | ST-I1..ST-I6              | Interference graph         |
| `packages/frontend/src/sfa/coloring.spec.test.ts`          | ST-C1..ST-C6              | Frame coloring             |
| `packages/frontend/src/sfa/zp-allocator.spec.test.ts`      | ST-Z1..ST-Z8              | Module vars + ZP           |
| `packages/frontend/src/sfa/stack-analysis.spec.test.ts`    | ST-S1..ST-S3              | Stack analysis             |
| `packages/frontend/src/sfa/budgets.spec.test.ts`           | ST-S4..ST-S6              | Budget diagnostics         |
| `packages/frontend/src/sfa/symbols.spec.test.ts`           | ST-A1..ST-A4              | ACME symbols               |
| `packages/frontend/src/sfa/plan-allocation.spec.test.ts`   | ST-P1..ST-P6              | Plan assembly + adapter    |

### Implementation Tests (edge cases/internals)

| Test File                                                  | Description                                        | Priority |
|------------------------------------------------------------|----------------------------------------------------|----------|
| `packages/core/src/sfa/*.impl.test.ts`                     | Record shape existence / type guards               | Med      |
| `packages/frontend/src/sfa/coloring.impl.test.ts`          | Gap-fitting edge cases, large N determinism         | High     |
| `packages/frontend/src/sfa/zp-allocator.impl.test.ts`      | argBlock=0, exact-fit boundary, multi-byte user var | High     |
| `packages/frontend/src/sfa/stack-analysis.impl.test.ts`    | multiple interrupts, no-main, diamond call graphs   | High     |

### Golden Snapshots

- `plan-allocation.spec.test.ts` ST-P2 serializes the `AllocationPlan` for the Ch 11 §3.4 program
  to a stable JSON snapshot; `--update-golden` regenerates. Asserts determinism (AC-21).

## Test Data

### Fixtures Needed

- `C64_FIXTURE_PROFILE` — interim `PlatformProfile` with C64 budget values (a test helper).
- `FunctionInfo` builders for: linear chain, sibling tree, interrupt, escaped, unreachable, the
  Ch 11 §3.4 game graph, by-ref pointer-sharing cases.

### Mock Requirements

- None — all inputs are plain `FunctionInfo`/profile fixtures; use a real `DiagnosticBag` via
  `createDiagnosticBag()`.

## Verification Checklist

- [ ] All ST-* defined with concrete input/output pairs (above)
- [ ] Every ST traces to a requirement / spec / AR
- [ ] Spec tests written BEFORE implementation; verified to FAIL (red phase)
- [ ] All spec tests pass after implementation (green phase)
- [ ] Impl tests written for edge cases
- [ ] Golden snapshot committed for the Ch 11 §3.4 program
- [ ] No regressions; R15 boundary tier still green (`test/boundary.spec.test.ts`)
- [ ] `spec/` clean; full verify passes
