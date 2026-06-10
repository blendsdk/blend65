# Current State: RD-07b IL→Instr Translation, Register Binding & `generateInstr`

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> **Purpose**: The as-built code RD-07b builds **on** and **from**, and the gaps that fix the
> slice scope (D1). Everything here was read from the live tree on 2026-06-06.

## What RD-07b builds ON (the stable foundation — RD-07a)

The RD-07a stable core is shipped under `packages/codegen/src/instr/` and re-exported from
the `@blend65/codegen` barrel. RD-07b **consumes it unchanged**.

### `instr/` model + helpers (RD-07a — consume, never modify)

- **`opcode.ts`** — `NMOS_OPCODES` (56), `W65C02_OPCODES` (8), `OPCODES` (64), `type Opcode`.
- **`addressing-mode.ts`** — `ADDRESSING_MODES` (14, incl. `ZeroPageIndirect`),
  `type AddressingMode`.
- **`operand.ts`** — `type InstrOperand`; constructors `none()`, `imm8(v)`,
  `symbolRef(name, { offset?, byteSelect? })`, `labelRef(label)`, `zpSlot(name)`; guards
  `isImmediateOperand` (renamed per RD-07a D10), `isSymbolRef`, `isLabelRef`, `isZpSlot`.
- **`stream.ts`** — `type CpuVariant = "nmos6502" | "wdc65c02"`; `type AcmeDirective`;
  `type StreamEntry` (`{ type:"instr"; opcode; mode; operand; sourceSpan? } | {type:"label";
  name} | {type:"directive"; directive}`); `interface InstrStream { symbol; segment; entries }`;
  constructors `instr(opcode, mode, operand, sourceSpan?)`, `label(name)`, `directive(d)`;
  guards `isInstr`/`isLabel`/`isDirective`.
- **`cpu-table.ts`** — `type CpuTable`, `NMOS_6502_TABLE`, `W65C02_TABLE`, `cpuTableFor`.
- **`validate.ts`** — `isLegalMode(opcode, mode, cpuVariant)`, `validateStream(stream,
  cpuVariant, bag)` (raises `IceCode.Unexpected`/E90001 via `bag.addICE`). **RD-07b calls
  `validateStream` over each emitted stream (FR-22).**
- **`print-instr.ts`** — `printInstr(stream): string` (deterministic ACME text; the golden
  surface), `instrByteSize(entry): number`. **RD-07b's goldens serialize via `printInstr`.**

> **Intentionally absent in RD-07a (this plan adds them):** no `InstrProgram`, no
> `generateInstr`, no IL→Instr translation, no register binder. RD-07a validates and
> serializes hand-built `Instr` fixtures; RD-07b produces those streams from real IL.

## What RD-07b builds FROM (the live inputs)

### RD-06 IL model (`packages/codegen/src/il/` — consume read-only)

The IL **data model is complete**; the **lowering is a gate/slice-2 slice**. Barrel
`il/index.ts` exports (relevant to translation):

- **`cfg.ts`** — `interface ILProgram { functions; initCode; constData; allocationPlan }`
  (note: **carries the `AllocationPlan`** — D2), `interface ILFunction { name; params;
  returnType; blocks; tempCount; isInterrupt }`, `interface BasicBlock { label; instructions;
  terminator }`, `interface ConstDataEntry`.
- **`instruction.ts`** — `type ILInstruction` (discriminated on `op`), `type ILTerminator`
  (discriminated on `kind`), `type ILOp`, and the op-family tuples `ARITHMETIC_BINARY_OPS`
  (`add/sub/mul/div/mod`), `BITWISE_BINARY_OPS` (`and/or/xor/shl/shr`), `COMPARISON_OPS`
  (`eq/ne/lt/le/gt/ge`), `CONVERSION_OPS` (`zext/sext/trunc`), `IL_OPS`.
- **`operand.ts`** — `type ILOperand`; constructors `imm(value, type)`, `temp(id, type)`,
  `loc(name, type)`; guards `isImmediate`, `isTemp`, `isLocation`. (Note RD-07a's operand
  guard was renamed to `isImmediateOperand` precisely to avoid colliding with this
  `isImmediate` at the codegen barrel — RD-07a D10.)
- **`il-type.ts`** — `type ILType`; `IL_BYTE`, `IL_SBYTE`, `IL_WORD`, `IL_SWORD`;
  `ilTypeEquals`, `ilTypeOfType`. **Width selection (D5) reads each operand's `.type`.**

#### Exactly what `lowerToIL` emits LIVE today (read from `il/lower.ts`)

This is the **translation set** RD-07b must cover (D3):

| Live IL produced | Source construct (lowered) | RD-07b handler |
| ---------------- | -------------------------- | -------------- |
| `load`  (`{op:"load",  a:dest, b:loc}`) | variable read, `peek` | FR-9 |
| `store` (`{op:"store", a:val,  b:loc}`) | `let` init, assign, `poke` | FR-10 |
| `const` (`{op:"const", dest, src:imm}`) | `materialise` of a non-temp before a store | FR-11 |
| `add/sub/mul/div/mod` (binary) | `+ - * / %` | FR-2/3/7/8 |
| `and/or/xor/shl/shr` (binary) | `& | ^ << >>` | FR-4/5 |
| `eq/ne/lt/le/gt/ge` (binary) | `== != < <= > >=` | FR-6 |
| `ret` terminator (`{kind:"ret", value?}`) | `return`, fall-through end | FR-12 |
| operands: `imm`, `temp`, `loc` (incl. `$HEX` address-symbol `loc`) | literals, temps, frame slots, `poke`/`peek` addr | FR-1 |

**Not emitted by live lowering** (→ RD-07b ICE-default arm, deferred to RD-07c): `neg`,
`not`, `zext`/`sext`/`trunc`, `load_indexed`/`store_indexed`, `load_indirect`/
`store_indirect`, `copy`, `call`, `intrinsic`, `source_span` standalone; the `br`/`brcond`/
`unreachable` terminators. Also: each live `ILFunction` is **single-block** (`lowerFunction`
builds one entry block and `finish`es with `ret`), so multi-block CFG translation is
inherently RD-07c.

> **Caveat (RD-06 D5):** under the *live passthrough* `lowerToIL` currently returns an **empty
> `ILProgram`** (the `SemanticModel` façade is not yet populated), and the real lowering is
> **fixture-tested**. RD-07b's end-to-end goldens (FR-25) therefore drive translation from the
> same RD-06 lowering **fixtures** (real IL, deterministically built), exactly as RD-06 tests
> do — not from the not-yet-wired live passthrough. This keeps the slice runtime-verifiable
> today without depending on the deferred façade wiring.

### RD-05 `AllocationPlan` (`@blend65/core`, `sfa/allocation-plan.ts` — consume read-only)

Carried inside `ILProgram.allocationPlan`. RD-07b register binding (FR-13/FR-15) reads:

- **`zpAllocations: readonly ZpAllocation[]`** — each `{ name; address; size; category }`.
  The **`category: "temp"`** runs (`__zp_tmp_N`) are the spill scratch bytes the binder hands
  out when A/X/Y are exhausted (FR-15). `category: "pointer"` runs serve indirect ops (RD-07c).
- **`frames: ReadonlyMap<string, FrameAllocation>`** — per-FQ-function frame placement; the
  frame-slot `Location` symbols (`__frame_<Mod_fn>_<var>`) are what `load`/`store` reference
  (the lowering already emits these as `loc(...)` operands — RD-07b renders them as
  `SymbolRef`).
- **`symbolDefinitions: readonly SymbolDefinition[]`** — `{ name; value }` for the `.asm`
  header (RD-09 consumes; RD-07b only carries the plan through).

### Core diagnostics (`@blend65/core` — consume read-only)

- `DiagnosticBag` / `createDiagnosticBag()` / `bag.addICE(IceCode.Unexpected, span, msg)` /
  `bag.hasErrors()`; `IceCode.Unexpected` (`E90001`); `SourceSpan`. RD-07b uses the **real**
  bag (code.md §29). Cost warnings W10170/W10171/W10172 are added to the same bag (FR-23).

## The gap that scopes RD-07b (why it is a slice)

| Dependency | Status | Effect on RD-07b |
| ---------- | ------ | ---------------- |
| RD-10 `PlatformProfile` | **Absent** — `@blend65/platforms` is `VERSION` only; the core `PlatformProfile` is the interim RD-04/05 stub marked `DEFERRED(RD-10)` (no `cpuVariant`, no hooks) | `generateInstr` takes a `cpuVariant` primitive (D2); platform hooks R46–R49 + `preamble` deferred to RD-07c |
| RD-06 full lowering | **Slice** — only the gate/slice-2 op set is emitted | Translate the live set; ICE-default + defer the rest (D3); goldens drive from RD-06 fixtures |
| RD-17 `__rt_*` routine bodies | **Absent** | mul/div/mod emit the `JSR __rt_*` **call-site** only (D4); bodies link later (AR-30) |

## R15 / AR-20 boundary (inherited unchanged)

All RD-07b artifacts live in `@blend65/codegen`. `frontend` and `language-server` must never
import `@blend65/codegen` — enforced by ESLint `no-restricted-imports` (AR-P7) and spec-tested
by `test/boundary.spec.test.ts` (ST-R15a/b/c). RD-07b adds files inside the existing `instr/`
directory, so the boundary is untouched; the closeout re-confirms the boundary tier is green.

## Frozen `spec/`

`spec/` is the frozen v3.0 baseline (decision D3 project-wide). RD-07b reads spec Ch 04 §3
(arithmetic/mul/div cost) and Ch 06 §6–§7 (return convention) for the translated ops but
**modifies nothing** under `spec/`; `git status --porcelain spec/` must stay empty.
