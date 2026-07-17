# RD-07: 6502 Code Generation & Structured Instr Model

> **🔱 07a/07b SPLIT (decision D1, plan `rd-07a-instr-model`):** RD-07 is implemented in
> two parts to isolate the stable core from the consumer-coupled remainder (the AR-38
> pattern already used for RD-04→RD-04b — later superseded by the RD-18 rollout — and RD-11→RD-11a). **RD-07a** (implemented) ships
> the *stable, zero-throwaway core*: the `Instr` model (R1–R13), the NMOS-6502 CPU
> validation table + validator with gated 65C02 extensions (R14–R16), and the canonical
> ACME serializer `printInstr` (R52–R54), all in `@blend65/codegen/src/instr/`, taking only
> a `cpuVariant` primitive (not a `PlatformProfile`, decision D2). **RD-07b** (slice
> implemented, plan `rd-07b-il-to-instr`) adds the *consumer-coupled* remainder for the
> **RD-06 live op set**: IL→`Instr` translation over `load`/`store`/`const`,
> arithmetic/bitwise/shift/comparison binary ops, `mul`/`div`/`mod` call-sites and `ret`
> (R17–R28/R32, both widths), register binding (R40–R45), `InstrProgram` assembly +
> `generateInstr` taking `cpuVariant` (R55–R61), and source-span propagation (R50–R51).
> **RD-07c** (slice implemented, plan `rd-07c-codegen-platform-preamble`) ships **Half A**:
> the additive `assembleProgram(ilProgram, plugin, bag)` wrapper that fills the
> `InstrProgram.preamble` from the RD-10 plugin's `emitPreamble` hook (R46–R49/R55), plus the
> entry-function `_main` label + `.`→`_` sanitization of all other function labels (R47). The
> genuinely-blocked remainder — **Half B**: the IL ops no live lowering emits, multi-block
> CFG, the calling convention, interrupt prologue/epilogue, for-loop patterns A/B, and the
> `JSR _main` fall-through optimization — stays deferred until RD-06 widens its lowering.
> See `plans/rd-07c-codegen-platform-preamble/` for the Half-A/B split and the D1–D10
> decision log; `plans/rd-07b-il-to-instr/` for the live-op-set slice; `plans/rd-07a-instr-model/`
> for the original split rationale.

> **Status**: 🟡 Partially implemented (RD-07a done; RD-07b live-op-set slice done; RD-07c Half A done; RD-07c Half B — deferred IL ops/multi-block CFG/calling convention/interrupts/for-loops/fall-through — pending RD-06 widening)

> **MVP Phase**: A
> **Depends On**: RD-06, RD-10
> **Implements**: `spec-v3.0` Ch 04 §3–§9 (codegen cost tables), Ch 05 §7.7 (for-loop
>   patterns A/B), Ch 06 §5–§7 (calling convention, interrupt prologue/epilogue);
>   Ch 11 §6 (build summary code/data sizes); all codegen examples in spec chapters
> **Owning package(s)**: `@blend65/codegen` (IL→Instr translation, Instr model,
>   register allocator, CPU validation)
> **Created**: 2026-05-31
> **Last Updated**: 2026-06-10

---

## 1. Purpose

This document specifies the **6502 code generator** — the compiler stage that translates
the target-independent IL (from RD-06) into a structured list of real 6502 machine
instructions (`Instr` records). This is the second and final lowering level (AR-50): IL
is target-independent; `Instr` is target-specific.

The `Instr` model is not a string or text — it is a **typed, in-memory record** where
each entry represents exactly one real 6502 opcode with its addressing mode and symbolic
operand (AR-53/54). Labels and assembler directives are first-class entries in the same
stream (AR-55). The `Instr` stream is the input to both the peephole optimizer (RD-08)
and the ACME emitter (RD-09).

The codegen stage is also where **register binding** happens: IL virtual temps (unlimited)
are mapped to the 6502's three 8-bit registers (A, X, Y) plus ZP scratch bytes (AR-47).
Platform-specific codegen hooks (AR-18) are called at defined extension points — the
core codegen stays platform-agnostic (P3).

---

## 2. Scope

**In scope:**

- `Instr` record model: mnemonic enum, addressing-mode enum, symbolic operand union (AR-53/54/56)
- `Label` and `Directive` as first-class stream entries (AR-55)
- Operand byte-select modifier for hi/lo byte (`<sym`/`>sym`) (AR-57)
- Per-function `InstrStream`: `{ symbol, segment, entries[] }` (AR-59)
- CPU validation: every `Instr` validated against the active CPU's legal opcode+mode table (AR-58)
- IL→`Instr` translation for every IL instruction kind
- Register binding: virtual temps → A/X/Y + ZP scratch (AR-47)
- Calling convention codegen: parameter stores, JSR, return value extraction (Ch 06 §5)
- Interrupt function codegen: PHA/TXA-PHA/TYA-PHA prologue, PLA/TAY/PLA/TAX/PLA/RTI epilogue (Ch 06 §7.4)
- For-loop Pattern A (compare-and-branch) and Pattern B (wrap termination) selection (Ch 05 §7.7)
- Multiply/divide codegen strategy selection (Ch 04 §3.2–§3.3)
- Platform codegen hooks: startup/stub emission, binary format selection (AR-18/64/65)
- Source-span propagation: `Instr.sourceSpan?` for diagnostic traceability (AR-54/72)
- Canonical text serialization: the `--emit-asm` surface = the ACME input (AR-60)

**Out of scope (and where it lives instead):**

- IL representation and AST→IL lowering → RD-06
- SFA frame addresses, ZP allocation, symbol definitions → RD-05
- Peephole optimization on the `Instr` stream → RD-08
- ACME text serialization and assembler invocation → RD-09
- Platform profile data (RAM/ZP ranges, CPU variant, binary format) → RD-10
- Intrinsic descriptor registry and ABI → RD-17

> **Traceability rule:** Every decision below must cite the Ambiguity Register entry
> (`AR-NN`, in `00-ambiguity-register.md`) that resolved it, or the frozen spec section
> it implements. No decision may be invented here — discovery is closed.

---

## 3. Decisions & Requirements

### 3.1 Instr Model

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R1 | One `Instr` = one real 6502 machine instruction | No macro-instructions, no pseudo-ops. Multi-byte operations (e.g., 16-bit add) produce multiple `Instr` records. This avoids re-introducing a third "ASM-IL" tier | AR-53 |
| R2 | `Instr` is a typed discriminated record | `{ mnemonic: Opcode, addressingMode: AddressingMode, operand: InstrOperand, sourceSpan?: SourceSpan }`. No stringly-typed fields — typed enums throughout | AR-54 |
| R3 | `Opcode` is a typed enum of all legal 6502 mnemonics | Covers the NMOS 6502 instruction set (56 unique opcodes). 65C02 extensions are available but gated by the platform profile's CPU variant | AR-54, AR-58 |
| R4 | `AddressingMode` is a typed enum | `Implied`, `Immediate`, `ZeroPage`, `ZeroPageX`, `ZeroPageY`, `Absolute`, `AbsoluteX`, `AbsoluteY`, `Indirect`, `IndirectX` (`(zp,X)`), `IndirectY` (`(zp),Y`), `Relative`, `Accumulator` | AR-54 |
| R5 | Labels are first-class inline stream entries | The stream is `Array<Instr | Label | Directive>`. Labels survive peephole insert/delete without index drift | AR-55 |
| R6 | Directives are first-class inline stream entries | Directives cover ACME pseudo-ops: `!byte`, `!word`, `!text`, `!fill`, `!to`, `* =` (origin), symbol definition (`sym = $XXXX`). Used by platform plugins for startup stubs and data segments | AR-55, AR-64 |
| R7 | The `Instr` stream is organized per-function | Container `InstrStream = { symbol: string, segment: 'code' | 'data' | 'zp', entries: StreamEntry[] }`. One stream per function + one for init code + one per const-data block | AR-59 |

### 3.2 Instr Operand Model

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R8 | Operands are a symbolic union | `InstrOperand = Immediate | SymbolRef | LabelRef | ZeroPageSlot | None`. No hard `$xxxx` addresses in core codegen — ACME resolves via labels (P3) | AR-56 |
| R9 | `Immediate` holds a numeric literal | `{ kind: 'immediate', value: number }`. 8-bit for most instructions, 16-bit for address operands | AR-56 |
| R10 | `SymbolRef` references a named symbol from the `AllocationPlan` | `{ kind: 'symbolRef', name: string, offset?: number, byteSelect?: 'low' | 'high' | 'none' }`. Emitted as ACME symbol references; offset for struct field access | AR-56, AR-57 |
| R11 | `LabelRef` references a code label within the current function | `{ kind: 'labelRef', label: string }`. Used for branch targets | AR-56 |
| R12 | `ZeroPageSlot` references a ZP allocation | `{ kind: 'zpSlot', name: string }`. Emitted as the ACME symbol name for that ZP byte | AR-56 |
| R13 | `byteSelect` modifier selects hi/lo byte of a 16-bit symbol | `low` → ACME `<sym`; `high` → ACME `>sym`. Used for pointer setup (`LDA #<addr` / `LDA #>addr`) and `lo()`/`hi()` codegen | AR-57 |

### 3.3 CPU Validation

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R14 | Every `Instr` is validated against the active CPU's opcode+mode table | The platform profile declares the CPU variant (NMOS 6502, 65C02). The codegen validates that every generated `Instr` uses a legal opcode+addressing-mode combination for that CPU | AR-58 |
| R15 | An invalid opcode+mode is an internal compiler error | A violating codegen is a compiler bug, not a user error. The diagnostic uses the `E9xxxx` ICE band, not the user `E10xxx` band | AR-58, AR-70 |
| R16 | NMOS 6502 codegen never emits 65C02-only modes | When targeting C64/7800/800XL (NMOS 6502), the codegen must not emit `STZ`, `BRA`, `(zp)` indirect-without-index, or any other 65C02-only instruction or mode | AR-58 |

### 3.4 IL→Instr Translation

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R17 | Each IL instruction translates to one or more `Instr` records | The translation is deterministic: same IL → same `Instr` sequence. Translation rules are documented per IL op | AR-50 |
| R18 | 8-bit `add` → `CLC` + `ADC` sequence | `LDA left; CLC; ADC right; STA dest` | Ch 04 §3.1 |
| R19 | 16-bit `add` → lo-byte add + hi-byte add-with-carry | `LDA left_lo; CLC; ADC right_lo; STA dest_lo; LDA left_hi; ADC right_hi; STA dest_hi` | Ch 04 §3.1 |
| R20 | 8-bit `sub` → `SEC` + `SBC` sequence | `LDA left; SEC; SBC right; STA dest` | Ch 04 §3.1 |
| R21 | `mul` → three-tier strategy | (1) constant-fold if both operands known → no code; (2) constant power-of-2 → shift sequence; (3) runtime → `JSR __rt_mul8` / `__rt_mul16` software subroutine. Emit W10170/W10172 as appropriate | Ch 04 §3.2 |
| R22 | `div`/`mod` → software subroutine call | Always `JSR __rt_div8` / `__rt_div16`. Emit W10171 | Ch 04 §3.3 |
| R23 | Comparison → flag-based branch pattern | 8-bit unsigned: `CMP` + carry flag; signed: `CMP` + N⊕V; 16-bit: compare hi bytes, then lo bytes. Result → set temp to 0 or 1 | Ch 04 §5 |
| R24 | `zext` → zero high byte | `LDA src; STA dest_lo; LDA #$00; STA dest_hi` | AR-46 |
| R25 | `sext` → sign-extend via conditional | `LDA src; STA dest_lo; BPL .pos; LDA #$FF; .pos: LDA #$00; STA dest_hi` (or BIT/N flag pattern) | AR-46 |
| R26 | `trunc` → take low byte | `LDA src_lo; STA dest` (ignore high byte) | AR-46 |
| R27 | `load` → `LDA` (8-bit) or `LDA`+`LDX` (16-bit) | Load from absolute address (SymbolRef). ZP variables use zero-page addressing mode | AR-52 |
| R28 | `store` → `STA` (8-bit) or `STA`+`STX` (16-bit) | Store to absolute address (SymbolRef) | AR-52 |
| R29 | `load_indexed` → `LDA addr,X` or `LDA addr,Y` | Array element load with index in X or Y register. If index exceeds register, use indirect addressing | Ch 08 |
| R30 | `load_indirect` → setup ZP pointer + `LDA (ptr),Y` | Load base address to ZP pointer pair, offset in Y, use indirect-indexed mode | Ch 06 FN-3 |
| R31 | `call` → store args to frame + `JSR` | Per Ch 06 §5.4: evaluate each argument → store to callee's frame slot → `JSR callee_label`. Return value in A (8-bit) or A/X (16-bit) | Ch 06 §5.4 |
| R32 | `ret` → place value in A (or A/X) + `RTS` | 8-bit return: `LDA result; RTS`. 16-bit: `LDA result_lo; LDX result_hi; RTS`. Void: `RTS` | Ch 06 FN-4 |
| R33 | Interrupt function → save/restore prologue/epilogue + `RTI` | Prologue: `PHA; TXA; PHA; TYA; PHA`. Epilogue: `PLA; TAY; PLA; TAX; PLA; RTI`. 35 cycles overhead, 11 bytes ROM | Ch 06 §7.4 |
| R34 | `br` → `JMP label` | Unconditional branch in IL → `JMP` in `Instr` | AR-48 |
| R35 | `brcond` → comparison + conditional branch | `LDA cond; BNE trueLabel; JMP falseLabel` (or BEQ for inverted sense). Peephole can later optimize `JMP`→`Bxx` when in range | AR-48 |
| R36 | For-loop Pattern A → `CPX` + `BCS` | Counter in X (8-bit); compare to bound; branch if past. Per Ch 05 §7.7 | Ch 05 §7.7 |
| R37 | For-loop Pattern B (full range) → `INX` + `BNE` | Counter wraps 255→0; `BNE` continues until wrap. Per Ch 05 §7.7 | Ch 05 §7.7 |
| R38 | `intrinsic` (T1 CPU control) → single opcode | `asm_sei()` → `SEI`; `asm_cli()` → `CLI`; etc. One `Instr` per T1 intrinsic | Ch 12, AR-49 |
| R39 | `intrinsic` (T3/T4 runtime routine) → arg marshalling + `JSR` | Marshal arguments per the ABI (AR-33): ≤3 scalar bytes in A/X/Y, rest via ZP arg-block; `JSR __rt_<name>`; extract return value | AR-33, AR-49 |

### 3.5 Register Binding

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R40 | Virtual temps are bound to A/X/Y and ZP scratch at codegen time | The IL has unlimited virtual temps (AR-47). Codegen maps them to the 6502's three registers + ZP scratch bytes from the `AllocationPlan` | AR-47 |
| R41 | A is the primary accumulator for all operations | Most 6502 arithmetic/logic uses A. The codegen routes the "hot" operand through A | 6502 architecture |
| R42 | X and Y are used for indexing and secondary storage | X for array indexing (`LDA addr,X`), loop counters, 16-bit return high byte. Y for indirect-indexed offset (`LDA (ptr),Y`) | 6502 architecture |
| R43 | ZP scratch bytes hold spilled temps | When all three registers are busy, intermediate values are stored to ZP scratch bytes allocated by RD-05. The codegen minimizes spills by scheduling operations to reuse registers | AR-47, RD-05 |
| R44 | Register state tracking | The codegen tracks which value is currently in each register to avoid redundant loads. A `LDA x` is suppressed if A already holds `x` | Optimization |
| R45 | After `intrinsic_call` (CC-5), all registers are assumed clobbered | Per Ch 12 CC-3, after any `asm_*()` call the compiler reloads values from memory | Ch 12 CC-3 |

### 3.6 Platform Codegen Hooks

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R46 | Platform plugins provide codegen hooks at defined extension points | Hooks: startup-stub emission, binary-format directive, origin setting, character encoding for string literals. Core codegen calls hooks at the right time; plugins provide the implementation | AR-18 |
| R47 | Startup stub is emitted by the platform plugin as `Directive` entries | The C64 plugin emits the BASIC stub (`10 SYS 2061`), startup shim (bank-out BASIC, zero BSS, copy DATA inits, `JSR _main`, restore-BASIC + `RTS`), and `* = $0801` origin. Core codegen emits function code after the plugin's preamble | AR-64 |
| R48 | Binary format is selected by the platform plugin | The plugin emits `!to "<name>.prg", cbm` (C64) or equivalent for other platforms. Core never hand-writes binary headers | AR-65 |
| R49 | Startup-shim variant is selected by core analysis + plugin rendering | Core analyzes `main()` termination (can it return?). The plugin renders the appropriate shim variant (terminating/non-terminating/bare). Per AR-69 | AR-69 |

### 3.7 Source Span Propagation

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R50 | `Instr` records carry optional source spans | `Instr.sourceSpan?: SourceSpan` links generated code back to source for diagnostics. Not every `Instr` needs a span — only the "lead" instruction of a sequence | AR-54, AR-72 |
| R51 | Spans survive from AST through IL to `Instr` | The IL carries `source_span` instructions; codegen propagates them to the corresponding `Instr` entries | AR-72 |

### 3.8 Canonical Text Serialization

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R52 | The `Instr` stream has one canonical text form | This is the pre-ACME assembly text that the ACME emitter (RD-09) serializes. `--emit-asm` output and the actual build input to ACME are byte-identical (same serializer, no drift) | AR-60, AR-63 |
| R53 | The text form is deterministic | Same `Instr` stream → same text output. Required for golden-snapshot testing (AR-22) | AR-60, H5 |
| R54 | The text form uses ACME syntax | Mnemonics in uppercase, hex with `$`, labels with colon, ACME directives (`!byte`, `!word`, `!to`, etc.) | AR-61 |

### 3.9 Codegen Output

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R55 | Codegen produces an `InstrProgram` record | Contains all `InstrStream` entries (one per function + init + const data), ordered for assembly | Design |
| R56 | The `InstrProgram` is consumed by RD-08 (peephole) and RD-09 (emitter) | Peephole operates on the `InstrStream` entries; the emitter serializes to ACME text | AR-50 |
| R57 | The `InstrProgram` carries the `AllocationPlan` reference | The emitter needs symbol definitions from the plan | RD-05 |
| R58 | Code-size contribution to the resource report | Codegen can compute the ROM byte count from the `Instr` stream (each `Instr` has a known byte size). This feeds the `ResourceReport` before ACME is invoked | AR-80 |

### 3.10 Error Tolerance & Diagnostics

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R59 | Codegen skips functions that have no IL | Functions that were skipped during IL lowering (error tolerance) produce no `InstrStream` | AR-15 |
| R60 | Codegen emits cost warnings for expensive operations | W10170 (runtime multiply), W10171 (runtime divide), W10172 (shift-and-add multiply). These are emitted during instruction selection, not IL lowering | Ch 04 §3.2–§3.3 |
| R61 | CPU validation failures are ICE diagnostics | If codegen produces an illegal opcode+mode for the target CPU, it emits `E9xxxx` (internal compiler error). This should never happen in correct codegen | AR-58, AR-70 |

---

## 4. Design Detail

### 4.1 Type Definitions

```typescript
// --- Opcode enum (NMOS 6502 subset shown) ---
enum Opcode {
  ADC, AND, ASL, BCC, BCS, BEQ, BIT, BMI, BNE, BPL,
  BRK, BVC, BVS, CLC, CLD, CLI, CLV, CMP, CPX, CPY,
  DEC, DEX, DEY, EOR, INC, INX, INY, JMP, JSR, LDA,
  LDX, LDY, LSR, NOP, ORA, PHA, PHP, PLA, PLP, ROL,
  ROR, RTI, RTS, SBC, SEC, SED, SEI, STA, STX, STY,
  TAX, TAY, TSX, TXA, TXS, TYA,
  // 65C02 extensions (gated by profile)
  BRA, PHX, PHY, PLX, PLY, STZ, TRB, TSB,
}

enum AddressingMode {
  Implied,        // CLC, RTS, ...
  Accumulator,    // ASL A
  Immediate,      // LDA #$42
  ZeroPage,       // LDA $02
  ZeroPageX,      // LDA $02,X
  ZeroPageY,      // LDX $02,Y
  Absolute,       // LDA $D020
  AbsoluteX,      // LDA $0400,X
  AbsoluteY,      // LDA $0400,Y
  Indirect,       // JMP ($FFFC)
  IndirectX,      // LDA ($02,X)
  IndirectY,      // LDA ($02),Y
  Relative,       // BEQ label
}
```

### 4.2 Operand Types

```typescript
type InstrOperand =
  | { kind: 'none' }
  | { kind: 'immediate'; value: number }
  | { kind: 'symbolRef'; name: string; offset?: number;
      byteSelect: 'low' | 'high' | 'none' }
  | { kind: 'labelRef'; label: string }
  | { kind: 'zpSlot'; name: string };
```

### 4.3 Stream Entry Types

```typescript
type StreamEntry =
  | { type: 'instr'; opcode: Opcode; mode: AddressingMode;
      operand: InstrOperand; sourceSpan?: SourceSpan }
  | { type: 'label'; name: string }
  | { type: 'directive'; directive: AcmeDirective };

type AcmeDirective =
  | { kind: 'origin'; address: number }              // * = $0801
  | { kind: 'symbolDef'; name: string; value: number } // sym = $XXXX
  | { kind: 'byte'; values: number[] }               // !byte $01, $02
  | { kind: 'word'; values: number[] }               // !word $0801
  | { kind: 'text'; text: string; encoding?: string } // !text "hello"
  | { kind: 'fill'; count: number; value: number }   // !fill 256, $00
  | { kind: 'outputFile'; name: string; format: string }; // !to "out.prg", cbm

interface InstrStream {
  symbol: string;                                     // function or data label
  segment: 'code' | 'data' | 'zp';
  entries: StreamEntry[];
}

interface InstrProgram {
  preamble: StreamEntry[];          // platform plugin preamble (origin, !to, symbol defs)
  streams: InstrStream[];           // per-function code + init + const data
  allocationPlan: AllocationPlan;   // from RD-05
}
```

### 4.4 Register Allocator

The register allocator maps IL virtual temps to physical resources:

```
Resources:
  A register    — primary accumulator (all ALU ops)
  X register    — index register, 16-bit return high byte
  Y register    — index register for indirect-indexed mode
  ZP scratch    — 2–4 bytes from AllocationPlan (spill area)
```

**Strategy: Linear scan with register tracking**

```
For each IL instruction in the current basic block:
  1. Determine which operands need to be in registers
  2. Check if any operand is already in a register (avoid redundant load)
  3. Allocate the needed registers:
     - A is always available (primary)
     - X/Y are used when needed for indexing or secondary storage
     - If all registers are busy, spill the least-recently-used to ZP scratch
  4. Emit the instruction sequence
  5. Update register tracking state
```

**Register tracking:**
```typescript
interface RegisterState {
  a: string | null;    // which symbolic value is currently in A (or null)
  x: string | null;    // which symbolic value is currently in X
  y: string | null;    // which symbolic value is currently in Y
}
```

At block boundaries (labels, branches), register state is **reset** — all registers
assumed unknown. This is simple and correct for a non-SSA IL.

### 4.5 Calling Convention Codegen

**Regular function call** (Ch 06 §5.4):
```
For each argument (left to right):
  evaluate argument → get result in A (or A/X for word)
  STA callee_frame_param          ; store to callee's frame slot
  (for word: STA callee_lo; STX callee_hi)
JSR callee_label
; Return value now in A (byte) or A/X (word)
```

**Interrupt function** (Ch 06 §7.4):
```
; Prologue (11 bytes, 13 cycles)
PHA                     ; save A
TXA
PHA                     ; save X
TYA
PHA                     ; save Y

; ... function body ...

; Epilogue (11 bytes, 16 cycles)
PLA
TAY                     ; restore Y
PLA
TAX                     ; restore X
PLA                     ; restore A
RTI                     ; return from interrupt
```

### 4.6 For-Loop Codegen Patterns

**Pattern A — compare-and-branch** (counter not at type max):
```
; for (let i: byte = 0 until 10)
    LDX #$00            ; init counter
.loop:
    CPX #$0A            ; compare to bound
    BCS .end            ; exit if >= bound
    ; body...
    INX                 ; increment
    JMP .loop
.end:
```

**Pattern B — wrap termination** (counter 0 to 255):
```
; for (let i: byte = 0 to 255)
    LDX #$00            ; init counter
.loop:
    ; body...
    INX                 ; increment (wraps 255→0)
    BNE .loop           ; continue until wrap
.end:
```

Pattern selection is a codegen decision based on the for-loop's bound and counter type:
- If `to` keyword and bound == type_max → Pattern B
- Otherwise → Pattern A

### 4.7 Public API

```typescript
/**
 * Generate 6502 instructions from the optimized IL program.
 *
 * @param ilProgram   The IL program from RD-06 (post-optimization)
 * @param profile     The active platform profile (RD-10)
 * @param bag         DiagnosticBag for cost warnings and ICE errors
 * @returns           The Instr program
 */
function generateInstr(
  ilProgram: ILProgram,
  profile: PlatformProfile,
  bag: DiagnosticBag
): InstrProgram;
```

This function lives in `@blend65/codegen`, alongside the IL.

### 4.8 CPU Validation Table

The codegen validates each `Instr` against a lookup table:

```typescript
type CpuTable = Map<Opcode, Set<AddressingMode>>;

const NMOS_6502: CpuTable = new Map([
  [Opcode.LDA, new Set([Immediate, ZeroPage, ZeroPageX, Absolute, AbsoluteX,
                         AbsoluteY, IndirectX, IndirectY])],
  [Opcode.STA, new Set([ZeroPage, ZeroPageX, Absolute, AbsoluteX,
                         AbsoluteY, IndirectX, IndirectY])],
  // ... all 56 opcodes with their legal modes
]);

function validateInstr(instr: StreamEntry, cpu: CpuTable, bag: DiagnosticBag): void {
  if (instr.type !== 'instr') return;
  const legalModes = cpu.get(instr.opcode);
  if (!legalModes || !legalModes.has(instr.mode)) {
    bag.addICE(E9_ILLEGAL_OPCODE, instr.sourceSpan,
      `illegal opcode+mode: ${instr.opcode} ${instr.mode}`);
  }
}
```

---

## 5. Interactions With Other RDs

| RD | Relationship |
|----|--------------|
| RD-01 | Package structure: codegen lives in `@blend65/codegen` |
| RD-05 | **Input**: `AllocationPlan` provides frame addresses, ZP allocations, symbol definitions, and ZP scratch bytes for register spilling |
| RD-06 | **Input**: `ILProgram` provides the IL to translate. Every IL instruction has a defined `Instr` translation |
| RD-08 | **Consumer**: peephole optimizer operates on `InstrStream` entries, rewriting short windows into cheaper equivalents |
| RD-09 | **Consumer**: ACME emitter serializes `InstrProgram` to `.asm` text using the canonical serializer (AR-60) |
| RD-10 | **Input**: platform profile provides CPU variant (for validation table), platform hooks (for startup/format), and codegen-strategy hints |
| RD-11 | **Data contributor**: code-size estimate from `Instr` byte counts feeds the `ResourceReport` pre-ACME check |
| RD-17 | **Input**: intrinsic descriptors (AR-29) define how each T1/T3/T4 intrinsic is translated to `Instr` sequences. Runtime-routine ABI (AR-33) defines arg marshalling |

---

## 6. Acceptance Criteria

> **RD-07b slice progress (plan `rd-07b-il-to-instr`):** the items below are ticked for the
> **RD-06 live op set** (the AR-38 slice). Items scoped to deferred ops, platform hooks,
> calling convention, interrupt prologue/epilogue, or for-loops are carried by **RD-07c**.

- [x] AC-01: `generateInstr()` returns an `InstrProgram` — takes a `cpuVariant` primitive (D2), not a `PlatformProfile` (the real profile is threaded by the RD-15 driver when RD-10 lands)
- [~] AC-02: Every **live** IL instruction kind has a defined `Instr` translation; deferred ops reach a documented `E90001` ICE boundary (RD-07c)
- [x] AC-03: Each `Instr` record uses typed `Opcode` and `AddressingMode` enums (no strings)
- [x] AC-04: All operands are symbolic — no hard-coded `$xxxx` addresses in core codegen
- [x] AC-05: Labels and directives are first-class `StreamEntry` values in the stream
- [x] AC-06: Every generated `Instr` passes CPU validation (`generateInstr` runs `validateStream`)
- [x] AC-07: The calling convention (parameter store → JSR → return extraction) matches Ch 06 §5.4 *(shipped by RD-18 slice 5a; VICE-verified across every later slice fixture)*
- [x] AC-08: Interrupt prologue/epilogue *(shipped by RD-18 slice 8a: unconditional A/X/Y save + reverse restore + RTI at every exit; VICE-verified raster fixture)*
- [x] AC-09: For-loop Pattern A/B selection *(Pattern A shipped by RD-18 slice 4a; Pattern-B full-range iteration remains a documented 8a-deferred LOUD ICE boundary)*
- [x] AC-10: Multiply generates constant-fold / shift-and-add / software-call per Ch 04 §3.2, with W10172/W10170 warnings
- [x] AC-11: The `byteSelect` modifier produces correct ACME `<sym`/`>sym` syntax (RD-07a; consumed by 07b word const/load)
- [x] AC-12: Source spans propagate from IL (`source_span`) through to `Instr.sourceSpan` (lead instr, R50)
- [x] AC-13: The `InstrProgram` is deterministic: same IL → same output
- [x] AC-14: Platform codegen hooks — RD-07c Half A: `assembleProgram` fills `InstrProgram.preamble` from the RD-10 plugin's `emitPreamble` hook (origin/`!to`/startup shim); the entry function is labelled `_main` and other labels sanitized (R46–R49/R55/R47). Startup-shim *variant analysis* (R49) uses the Half-A rule (single-block entry ⇒ terminating); real CFG termination + fall-through is Half B
- [x] AC-15: Functions with no IL (error tolerance) produce no `InstrStream`
- [x] AC-16: Cost warnings (W10170/W10171/W10172) are emitted for expensive operations
- [x] AC-17: Unit tests cover Instr translation for the **live** IL instruction kinds (AR-22 tier 1)
- [x] AC-18: Golden-snapshot tests assert end-to-end `Instr` text for representative programs (AR-22 tier 2; ST-G1..G3)
- [x] AC-19: All decisions trace to an `AR-NN`/`D-N` or a frozen spec section


---

## 7. Open Questions

> Discovery is **closed** (Zero-Ambiguity Gate PASSED). This section must normally be
> **empty**. If authoring surfaces a *new* ambiguity, STOP, add it to
> `00-ambiguity-register.md` as the next `AR-NN` (tagged `(runtime)`), resolve it with the
> user, then resume — per the Surface-During-Authoring rule. Do not fill gaps by guessing.

1. **Register allocator sophistication**: §4.4 describes a simple linear-scan strategy
   with register tracking. For small 6502 programs, this produces adequate code. A more
   sophisticated allocator (graph coloring over the 3 registers) could improve code
   quality but adds complexity. The current design is sufficient for v1; the peephole
   optimizer (RD-08) can clean up redundant loads/stores that a better allocator would
   avoid.

2. **Switch codegen strategy**: R35/R40 use a cascading compare-and-branch chain. For
   large switches with dense case values, a jump table would be more efficient. Jump-table
   codegen can be added as a future enhancement; the cascading chain is correct and
   simple for v1.

3. **Software multiply/divide routine location**: R21/R22 reference `__rt_mul8`,
   `__rt_div8`, etc. These are T3 core runtime routines defined by RD-17. The codegen
   emits `JSR __rt_mul8`; the routine's body is linked from a hand-written `.asm` module
   per AR-30. Dead-stripping ensures unused routines are not included.
