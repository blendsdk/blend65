# RD-09: ACME Emitter & Assembler Integration

> **Status**: 🟢 Authored
> **MVP Phase**: A
> **Depends On**: RD-07, RD-08, RD-10
> **Implements**: `spec-v3.0` Ch 15 §3 (output format contract), appendix-c64 §5
>   (PRG format + startup sequence); assembler integration per AR-61..AR-69
> **Owning package(s)**: `@blend65/codegen` (ACME emitter serializer),
>   `@blend65/compiler` (ACME invocation + artifact handling)
> **Created**: 2026-05-31
> **Last Updated**: 2026-05-31

---

## 1. Purpose

This document specifies the **ACME emitter** and the **assembler integration layer** —
the final compiler stages that turn the structured `InstrProgram` (from RD-07/RD-08)
into a runnable platform binary. The process has two halves:

1. **Emitter**: serializes the in-memory `InstrProgram` into ACME assembler source text
   (a single `.asm` file). This uses the same canonical serializer that powers `--emit-asm`
   (AR-60/AR-63), ensuring the build input and the developer-inspectable output are
   byte-identical.

2. **ACME invocation**: discovers and runs the external ACME assembler on the `.asm` file
   to produce the platform binary (`.prg`, `.bin`, `.rom`, etc.) and the VICE label file.
   ACME is the **exclusive** assembler — no abstraction layer, no pluggable backends
   (AR-61).

This is the last stage before the build is complete. Every user-facing error must have
been caught before this point; an ACME failure is by definition an internal compiler
error (AR-68).

---

## 2. Scope

**In scope:**

- ACME text serialization: `InstrProgram` → `.asm` file content
- Serialization format: ACME syntax (mnemonics, directives, labels, symbols)
- Symbol definition emission from `AllocationPlan` (AR-66)
- Platform preamble emission: `!to`, origin, BASIC stub, startup shim (via plugin directives, AR-64/65)
- Segment ordering: preamble → code → const data → mutable/BSS (AR-64)
- `--emit-asm` flag: write the `.asm` file without invoking ACME
- ACME executable discovery: `--acme-path` / `acmePath` → PATH → hard error (AR-62)
- ACME invocation with correct flags and working directory
- ACME output artifact capture: binary file + VICE label file (AR-67)
- ACME failure handling: surface as ICE, retain `.asm` for inspection (AR-68)
- Post-ACME binary-size budget check (`E10034`, AR-81)
- Label-file parsing for symbol→address feedback (AR-67)

**Out of scope (and where it lives instead):**

- `Instr` model, `InstrProgram` structure → RD-07
- Peephole optimization of the `InstrProgram` → RD-08
- Platform profile data (output format, load address, memory map) → RD-10
- Startup-shim content and variant logic → RD-10 (platform plugin)
- Pre-ACME budget checks (ZP/RAM) → RD-05
- Resource report rendering → RD-11
- CLI flag wiring → RD-15
- `blend65.json` config → RD-16

> **Traceability rule:** Every decision below must cite the Ambiguity Register entry
> (`AR-NN`, in `00-ambiguity-register.md`) that resolved it, or the frozen spec section
> it implements. No decision may be invented here — discovery is closed.

---

## 3. Decisions & Requirements

### 3.1 ACME as Exclusive Assembler

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R1 | ACME is the only assembler | No abstraction layer, no pluggable assembler backends. The emitter targets ACME syntax directly. If ACME ever proves insufficient, the path forward is a purpose-built Blend65 assembler, not adopting ca65/64tass/Kick | AR-61 |
| R2 | The emitter produces valid ACME source | All output text must be syntactically valid ACME assembler. Invalid ACME output is a compiler bug | AR-61 |

### 3.2 Serialization: InstrProgram → .asm Text

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R3 | One canonical serializer for both `--emit-asm` and the build | The same `serializeToAcme()` function produces the `.asm` text in both cases. `--emit-asm` writes the file to disk and stops; a full build writes the same file and feeds it to ACME. No drift is possible | AR-60, AR-63 |
| R4 | The serializer produces one `.asm` file | All code, data, symbol definitions, directives, and the platform preamble are emitted into a single `.asm` file. No multi-file ACME output | AR-63 |
| R5 | Output is deterministic | Same `InstrProgram` → same `.asm` text, byte-for-byte. Required for golden-snapshot testing | H5, AR-60 |
| R6 | Mnemonics are uppercase | `LDA`, `STA`, `JSR`, not `lda`, `sta`, `jsr` | AR-60 |
| R7 | Hex values use `$` prefix | `$D020`, `$0801`, `#$42` — ACME syntax | AR-61 |
| R8 | Labels end with colon | `_main:`, `.loop:`, `__init:` | ACME syntax |
| R9 | ACME directives use `!` prefix | `!byte`, `!word`, `!text`, `!fill`, `!to` | AR-61 |
| R10 | Comments document structure | The emitter adds section-separator comments (e.g., `; --- function: main ---`, `; --- const data ---`) for human readability. Comments do not affect assembly | Design |

### 3.3 Symbol Definition Emission

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R11 | SFA-owned addresses are emitted as ACME symbol definitions at the top of the `.asm` file | Zero-page allocations (`__zp_c = $02`), frame base addresses, and module variable addresses are defined as symbols. Operands reference these symbols by name; ACME substitutes the values | AR-66 |
| R12 | Symbol names follow a deterministic naming convention | Function frames: `__frame_<module>_<function>`. ZP vars: `__zp_<name>`. Module vars: `__var_<module>_<name>`. The convention is internal — not exposed to Blend65 source | AR-66 |
| R13 | Symbol definitions are grouped and commented | ZP symbols first, then frame-base symbols, then module-variable symbols. Each group has a section comment | AR-66, Design |

### 3.4 Segment Ordering

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R14 | The `.asm` file follows a defined segment order | (1) `!to` output directive, (2) symbol definitions, (3) origin (`* = $XXXX`), (4) platform preamble (BASIC stub + startup shim), (5) function code streams, (6) const-data streams, (7) mutable-data / BSS reservation | AR-64 |
| R15 | Function code streams are emitted in a deterministic order | Functions are emitted in a stable order: `__init` first, then `_main`, then remaining functions in declaration order (module order → source order). This guarantees golden-snapshot stability | H5 |
| R16 | Const-data streams follow code | `!byte`/`!word`/`!text` data blocks are emitted after all code, with labels for each block | Design |
| R17 | Mutable/BSS reservations are last | `!fill N, $00` for BSS or mutable initial values at the end of the binary | Design |

### 3.5 Platform Preamble Emission

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R18 | The preamble is supplied by the platform plugin as `Directive` entries | The emitter serializes `InstrProgram.preamble` — a list of `StreamEntry` values produced by the platform plugin (RD-10). Core emitter logic does not contain platform-specific addresses or byte sequences | AR-64, P3 |
| R19 | For C64: the preamble includes `!to`, origin, and BASIC stub | `!to "output.prg", cbm` → `* = $0801` → BASIC stub as `!byte`/`!word`/`!text` directives → startup shim as instructions (bank out BASIC, zero BSS, `JSR _main`, restore BASIC, `RTS`) | AR-64, AR-65, appendix-c64 §5.2 |
| R20 | The `!to` directive names the output file and format | The output filename and format are provided by the platform plugin. C64: `!to "<name>.prg", cbm`. Other platforms: `!to "<name>.bin", plain` or equivalent | AR-65 |
| R21 | Startup-shim variant is already selected | The preamble contains the correct shim variant (terminating/non-terminating/bare) as determined by core analysis + plugin rendering (AR-69). The emitter does not make shim decisions — it only serializes | AR-69 |

### 3.6 StreamEntry Serialization Rules

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R22 | Each `StreamEntry` type has a defined serialization | `instr` → `MNEMONIC operand`; `label` → `name:`; `directive` → the ACME directive text | AR-60 |
| R23 | `Instr` operand serialization follows ACME addressing-mode syntax | Immediate: `#$XX` or `#<sym`/`#>sym`; ZeroPage: `$XX` or `sym`; Absolute: `$XXXX` or `sym`; Indirect: `(sym)`; IndirectX: `(sym,X)`; IndirectY: `(sym),Y`; Relative: `label`; Accumulator: `A`; Implied: (no operand) | AR-56, AR-61 |
| R24 | `byteSelect` → ACME lo/hi operators | `byteSelect: 'low'` → `<sym`; `byteSelect: 'high'` → `>sym`. Used in immediate context: `#<sym`, `#>sym` | AR-57 |
| R25 | `SymbolRef` with offset → `sym + offset` | `{ kind: 'symbolRef', name: 'frame_a', offset: 3 }` → `frame_a + 3` | AR-56 |
| R26 | `ZeroPageSlot` → the ZP symbol name | `{ kind: 'zpSlot', name: '__zp_ptr1' }` → `__zp_ptr1`. Addressing mode determines if it's a ZP load or ZP-indirect | AR-56 |
| R27 | `AcmeDirective` serialization per kind | `origin` → `* = $XXXX`; `symbolDef` → `name = $XXXX`; `byte` → `!byte $XX, $YY, ...`; `word` → `!word $XXXX, ...`; `text` → `!text "..."` (with encoding); `fill` → `!fill N, $XX`; `outputFile` → `!to "name", format` | AR-55, AR-61 |

### 3.7 ACME Discovery & Invocation

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R28 | ACME is discovered via a three-tier strategy | (1) Explicit: `--acme-path` CLI flag or `acmePath` in `blend65.json`; (2) PATH probe: search `PATH` for `acme` executable; (3) Hard error: if neither resolves, the build fails with a dedicated error — no silent fallback | AR-62 |
| R29 | The discovery error is actionable | Error message: `"ACME assembler not found — install ACME and ensure it is on your PATH, or set --acme-path / acmePath in blend65.json"` | AR-62 |
| R30 | ACME is invoked as a child process | The compiler spawns ACME with the `.asm` file as input. Working directory is the build output directory. ACME stdout/stderr are captured | Design |
| R31 | ACME flags include label-file output | The invocation includes `-l <labelfile>` (or `--labeldump`) to produce the VICE label file | AR-67 |
| R32 | ACME flags include the report file for any warnings | ACME is invoked with `--report <reportfile>` for diagnostic capture | AR-68 |
| R33 | ACME exit code is checked | Exit 0 = success. Non-zero = failure → ICE (see R35) | AR-68 |
| R34 | `--emit-asm` skips ACME invocation | When `--emit-asm` is set, the `.asm` file is written and the build stops. No ACME invocation, no binary produced. Useful for inspecting generated assembly | AR-63 |

### 3.8 ACME Failure Handling

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R35 | An ACME failure is an internal compiler error | Because all `Instr` records are CPU-validated (AR-58), addresses are compiler-assigned (AR-66), and the emitter produces valid syntax (R2), an ACME error is by definition a compiler bug. It is reported as `E9xxxx` ICE | AR-68 |
| R36 | The `.asm` file is retained on failure | When ACME fails, the `.asm` file remains on disk for inspection. The ICE message includes the path to the `.asm` file | AR-68 |
| R37 | ACME stderr is included in the ICE diagnostic | The full ACME error output is captured and included in the ICE message, so the developer can report the bug with context | AR-68 |
| R38 | A user error must never first surface at ACME | If a user mistake (e.g., exceeding memory, type mismatch) is only caught by ACME, that is a missed-earlier-diagnostic compiler bug. All user errors must be caught in the frontend or codegen phases | AR-68 |

### 3.9 Build Artifacts

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R39 | A successful build produces three artifacts | (1) The platform binary (`.prg`, `.bin`, etc.); (2) The `.asm` source (always retained, not just on `--emit-asm`); (3) The VICE label file (`.lbl` or `.vs`) | AR-63, AR-67 |
| R40 | The binary file is named by the platform plugin | Default: `<project-name>.<ext>` where `ext` is from the profile's `output_format` (e.g., `.prg` for C64) | AR-65 |
| R41 | The label file is a VICE-format symbol→address map | Each line: `al C:xxxx .label_name`. Parsed by the compiler to create a `Map<string, number>` for downstream use (test harness `runUntilLabel`, build summary) | AR-67 |
| R42 | All artifacts are written to the build output directory | Default: `./build/` or as configured in `blend65.json` (`outDir`). The directory is created if it does not exist | Design |

### 3.10 Post-ACME Budget Check

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R43 | Binary size is checked against the platform budget after ACME | After ACME produces the binary, the compiler reads the file size and compares it to `max_binary_size` from the platform profile. If exceeded → `E10034` | AR-81, Ch 14 |
| R44 | The binary size feeds the resource report | The actual binary size (from the `.prg` file, excluding the 2-byte load header for PRG format) is contributed to the `ResourceReport` (RD-11) | AR-80 |

### 3.11 Label-File Parsing

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R45 | The VICE label file is parsed into a symbol map | Each `al C:xxxx .label_name` line is parsed into a `Map<string, number>` entry. The `C:` prefix is the VICE "compute" prefix | AR-67 |
| R46 | The symbol map is a first-class build artifact | Returned alongside the binary as part of the `BuildResult`. Used by the test harness (RD-12) for `runUntilLabel` and by the resource report (RD-11) for code/data size breakdown | AR-67 |
| R47 | Parse failures in the label file are non-fatal warnings | If a line cannot be parsed (unexpected ACME version, extra columns), it is skipped with a warning. The build is not failed | Design |

---

## 4. Design Detail

### 4.1 Serializer Interface

```typescript
/**
 * Serialize an InstrProgram to ACME assembler source text.
 * This is the single canonical serializer (AR-60/AR-63):
 *   --emit-asm writes this text and stops.
 *   A full build writes this text and feeds it to ACME.
 *
 * @param program  The InstrProgram from codegen/peephole (RD-07/08)
 * @returns        The complete .asm file content as a string
 */
function serializeToAcme(program: InstrProgram): string;
```

### 4.2 Serializer Algorithm

```
function serializeToAcme(program: InstrProgram): string:
  lines: string[] = []

  // 1. Output directive (from preamble)
  for entry in program.preamble:
    if entry.type === 'directive' and entry.directive.kind === 'outputFile':
      lines.push(serializeDirective(entry.directive))

  // 2. Symbol definitions (from AllocationPlan)
  lines.push("; --- zero-page allocations ---")
  for sym in program.allocationPlan.zpSymbols:
    lines.push(`${sym.name} = $${hex(sym.address)}`)

  lines.push("; --- frame base addresses ---")
  for sym in program.allocationPlan.frameSymbols:
    lines.push(`${sym.name} = $${hex(sym.address)}`)

  lines.push("; --- module variables ---")
  for sym in program.allocationPlan.moduleVarSymbols:
    lines.push(`${sym.name} = $${hex(sym.address)}`)

  // 3. Origin + preamble (excluding !to, which was emitted above)
  for entry in program.preamble:
    if entry.type !== 'directive' or entry.directive.kind !== 'outputFile':
      lines.push(serializeEntry(entry))

  // 4. Function code streams (deterministic order)
  for stream in program.streams.filter(s => s.segment === 'code'):
    lines.push(`; --- function: ${stream.symbol} ---`)
    for entry in stream.entries:
      lines.push(serializeEntry(entry))

  // 5. Const-data streams
  for stream in program.streams.filter(s => s.segment === 'data'):
    lines.push(`; --- const data: ${stream.symbol} ---`)
    for entry in stream.entries:
      lines.push(serializeEntry(entry))

  // 6. Mutable/BSS streams (zp segment already handled as symbol defs)
  for stream in program.streams.filter(s => s.segment === 'bss'):
    lines.push(`; --- mutable data: ${stream.symbol} ---`)
    for entry in stream.entries:
      lines.push(serializeEntry(entry))

  return lines.join('\n') + '\n'
```

### 4.3 Entry Serialization

```typescript
function serializeEntry(entry: StreamEntry): string {
  switch (entry.type) {
    case 'label':
      return `${entry.name}:`;

    case 'directive':
      return serializeDirective(entry.directive);

    case 'instr':
      return `    ${Opcode[entry.opcode]}${serializeOperand(entry)}`;
  }
}

function serializeOperand(instr: InstrStreamEntry): string {
  const op = instr.operand;
  switch (op.kind) {
    case 'none':
      // Implied or Accumulator
      return instr.mode === AddressingMode.Accumulator ? ' A' : '';

    case 'immediate': {
      const val = `$${hex(op.value)}`;
      return ` #${val}`;
    }

    case 'symbolRef': {
      let sym = op.name;
      if (op.offset) sym += ` + ${op.offset}`;
      const bs = op.byteSelect;
      if (bs === 'low') sym = `<${sym}`;
      else if (bs === 'high') sym = `>${sym}`;
      return formatAddressingMode(instr.mode, sym);
    }

    case 'labelRef':
      return ` ${op.label}`;  // Relative branches use label names

    case 'zpSlot': {
      return formatAddressingMode(instr.mode, op.name);
    }
  }
}

function formatAddressingMode(mode: AddressingMode, sym: string): string {
  switch (mode) {
    case Immediate:   return ` #${sym}`;
    case ZeroPage:    return ` ${sym}`;
    case ZeroPageX:   return ` ${sym},X`;
    case ZeroPageY:   return ` ${sym},Y`;
    case Absolute:    return ` ${sym}`;
    case AbsoluteX:   return ` ${sym},X`;
    case AbsoluteY:   return ` ${sym},Y`;
    case Indirect:    return ` (${sym})`;
    case IndirectX:   return ` (${sym},X)`;
    case IndirectY:   return ` (${sym}),Y`;
    case Relative:    return ` ${sym}`;
    default:          return '';
  }
}

function serializeDirective(dir: AcmeDirective): string {
  switch (dir.kind) {
    case 'origin':     return `* = $${hex(dir.address)}`;
    case 'symbolDef':  return `${dir.name} = $${hex(dir.value)}`;
    case 'byte':       return `!byte ${dir.values.map(v => `$${hex(v)}`).join(', ')}`;
    case 'word':       return `!word ${dir.values.map(v => `$${hex(v)}`).join(', ')}`;
    case 'text':       return `!text "${dir.text}"`;
    case 'fill':       return `!fill ${dir.count}, $${hex(dir.value)}`;
    case 'outputFile': return `!to "${dir.name}", ${dir.format}`;
  }
}
```

### 4.4 ACME Invocation

```typescript
interface AcmeConfig {
  /** Explicit ACME path (--acme-path or blend65.json acmePath) */
  acmePath?: string;
}

interface AcmeResult {
  /** Whether ACME succeeded */
  success: boolean;

  /** Path to the binary output (if success) */
  binaryPath?: string;

  /** Path to the label file (if success) */
  labelFilePath?: string;

  /** ACME stderr output (for ICE diagnostic on failure) */
  stderr?: string;

  /** Binary file size in bytes (excluding load header) */
  binarySize?: number;
}

/**
 * Discover and invoke ACME on the given .asm file.
 *
 * @param asmPath     Path to the .asm file
 * @param config      ACME configuration
 * @param bag         DiagnosticBag for errors
 * @returns           ACME result
 */
async function invokeAcme(
  asmPath: string,
  config: AcmeConfig,
  bag: DiagnosticBag
): Promise<AcmeResult>;
```

### 4.5 ACME Discovery Algorithm

```
function discoverAcme(config: AcmeConfig, bag: DiagnosticBag): string | null:
  // Tier 1: explicit path
  if config.acmePath:
    if isExecutable(config.acmePath):
      return config.acmePath
    bag.addError(E_ACME_NOT_FOUND,
      `ACME path '${config.acmePath}' is not executable`)
    return null

  // Tier 2: PATH probe
  path = findOnPath('acme')
  if path:
    return path

  // Tier 3: hard error
  bag.addError(E_ACME_NOT_FOUND,
    "ACME assembler not found — install ACME and ensure it is on your " +
    "PATH, or set --acme-path / acmePath in blend65.json")
  return null
```

### 4.6 Label-File Parser

```typescript
/**
 * Parse a VICE label file into a symbol→address map.
 * Format: "al C:xxxx .label_name" (one per line)
 */
function parseLabelFile(content: string): Map<string, number> {
  const symbols = new Map<string, number>();
  for (const line of content.split('\n')) {
    const match = line.match(/^al\s+C:([0-9a-fA-F]{4})\s+\.(.+)$/);
    if (match) {
      const address = parseInt(match[1], 16);
      const name = match[2].trim();
      symbols.set(name, address);
    }
    // Non-matching lines are silently skipped (R47)
  }
  return symbols;
}
```

### 4.7 Build Result

```typescript
interface BuildResult {
  /** Whether the build succeeded */
  success: boolean;

  /** All diagnostics accumulated during compilation */
  diagnostics: Diagnostic[];

  /** Path to the binary output (if success) */
  binaryPath?: string;

  /** Path to the .asm source (always produced, even on failure) */
  asmPath?: string;

  /** Symbol→address map from VICE label file */
  symbols?: Map<string, number>;

  /** Binary size in bytes (content only, excluding load header) */
  binarySize?: number;

  /** Resource report data */
  resourceReport?: ResourceReport;
}
```

### 4.8 Example .asm Output (C64 gate program)

The MVP gate program (`poke($D020, 1)`) would produce:

```asm
!to "gate.prg", cbm

; --- zero-page allocations ---

; --- frame base addresses ---

; --- module variables ---

* = $0801

; --- BASIC stub: 10 SYS 2061 ---
    !word $080B         ; pointer to next BASIC line
    !word $000A         ; line number 10
    !byte $9E           ; SYS token
    !text "2061"        ; SYS address
    !byte $00           ; end of BASIC line
    !word $0000         ; end of BASIC program

; --- startup shim (terminating) ---
__startup:
    LDA #$36
    STA $01             ; bank out BASIC ROM
    JSR _main
    LDA #$37
    STA $01             ; restore BASIC ROM
    RTS

; --- function: _main ---
_main:
    LDA #$01
    STA $D020
    RTS
```

---

## 5. Interactions With Other RDs

| RD | Relationship |
|----|--------------|
| RD-01 | Package structure: serializer in `@blend65/codegen`, ACME invocation in `@blend65/compiler` |
| RD-05 | **Input**: `AllocationPlan` provides symbol definitions (ZP addresses, frame bases, module vars) that are emitted as ACME symbol defs at file top |
| RD-07 | **Input**: `InstrProgram` structure, `StreamEntry` types, `Opcode`/`AddressingMode` enums — the emitter serializes these |
| RD-08 | **Input**: the potentially optimized `InstrProgram` (or unoptimized passthrough) |
| RD-10 | **Input**: platform plugin provides: (a) preamble directives (origin, stub, shim, `!to`); (b) output format and filename; (c) startup-shim variant selection |
| RD-11 | **Data contributor**: binary size, code/data segment sizes (from label file), and artifact paths feed the `ResourceReport` |
| RD-12 | **Artifact provider**: the label file (symbol map) enables `runUntilLabel` in the test harness |
| RD-15 | **Flag surface**: `--emit-asm`, `--acme-path` flags exposed via CLI |
| RD-16 | **Config surface**: `acmePath`, `outDir` settings in `blend65.json` |

---

## 6. Acceptance Criteria

- [ ] AC-01: `serializeToAcme()` accepts an `InstrProgram` and returns a valid ACME `.asm` string
- [ ] AC-02: The serializer is deterministic: same `InstrProgram` → same `.asm` output (golden snapshot)
- [ ] AC-03: `--emit-asm` writes the `.asm` file and stops (no ACME invocation)
- [ ] AC-04: The `.asm` file produced by `--emit-asm` is byte-identical to the build input fed to ACME
- [ ] AC-05: Symbol definitions from the `AllocationPlan` appear at the top of the `.asm` file
- [ ] AC-06: The platform preamble (BASIC stub, startup shim) is correctly serialized from plugin directives
- [ ] AC-07: Every `StreamEntry` type (`instr`, `label`, `directive`) has a defined serialization
- [ ] AC-08: All 13 addressing modes produce correct ACME syntax
- [ ] AC-09: `byteSelect` low/high produces ACME `<sym`/`>sym` syntax
- [ ] AC-10: ACME discovery follows the three-tier strategy (explicit → PATH → hard error)
- [ ] AC-11: ACME invocation produces a binary and a VICE label file on success
- [ ] AC-12: ACME failure is reported as ICE (`E9xxxx`) with stderr included
- [ ] AC-13: The `.asm` file is retained on ACME failure for inspection
- [ ] AC-14: Post-ACME binary-size check emits `E10034` when budget exceeded
- [ ] AC-15: The VICE label file is parsed into a `Map<string, number>` symbol map
- [ ] AC-16: Build artifacts (binary, `.asm`, label file) are written to the output directory
- [ ] AC-17: Segment order in the `.asm` file matches R14 (preamble → code → const data → BSS)
- [ ] AC-18: Unit tests cover serialization of all `Opcode`/`AddressingMode` combinations (AR-22 tier 1)
- [ ] AC-19: Golden-snapshot tests assert `.asm` output for representative programs (AR-22 tier 2)
- [ ] AC-20: All decisions trace to an `AR-NN` or a frozen spec section

---

## 7. Open Questions

> Discovery is **closed** (Zero-Ambiguity Gate PASSED). This section must normally be
> **empty**. If authoring surfaces a *new* ambiguity, STOP, add it to
> `00-ambiguity-register.md` as the next `AR-NN` (tagged `(runtime)`), resolve it with the
> user, then resume — per the Surface-During-Authoring rule. Do not fill gaps by guessing.

1. **ACME version compatibility**: The emitter targets ACME's stable subset of directives
   (`!byte`, `!word`, `!text`, `!fill`, `!to`, `* =`). No version-specific features are
   used. If a future ACME version changes syntax, the compiler would need an update to
   the serializer. This is a maintenance concern, not an architectural decision.

2. **ACME invocation parallelism**: For multi-file projects with separate compilation
   units, ACME could potentially be invoked in parallel. The current design emits one
   `.asm` file per compilation (the whole program), so parallelism is not applicable.
   If incremental compilation is added in the future, this could be revisited.
