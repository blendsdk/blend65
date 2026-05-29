# Appendix A — Platform Profile: Commodore 64 (`c64`)

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: provisional  
> **Fills**: Every profile slot defined in Ch 15, §3

---

## 1. Platform Summary

| Field | Value |
|-------|-------|
| Platform ID | `c64` |
| CPU | MOS 6510 (6502 + I/O port) |
| Clock | 0.985 MHz (PAL) / 1.023 MHz (NTSC) |
| RAM | 64 KB total |
| ROM | 20 KB (BASIC $A000–$BFFF, KERNAL $E000–$FFFF, Char ROM $D000–$DFFF) |
| Graphics | VIC-II |
| Sound | SID (6581/8580) |
| Storage | Disk (1541), cartridge, tape |
| Community | Largest active 6502 retrodev community |

The C64 is the **primary target** for Blend65. It has the largest community, the most tooling, and the best emulator support (VICE). Most Blend65 examples and tutorials should work on this platform first.

---

## 2. Memory Map

### 2.1 Default Configuration

The default profile assumes BASIC ROM is **banked out** (the compiler generates a startup sequence that writes to $01 to disable BASIC ROM), providing contiguous RAM from $0801 to $CFFF. The I/O area ($D000–$DFFF) and KERNAL ROM ($E000–$FFFF) remain active.

```
$0000–$0001  6510 I/O port (data direction + port)
$0002–$00FF  Zero page (partial availability — see §3)
$0100–$01FF  Hardware stack
$0200–$03FF  OS/KERNAL workspace
$0400–$07FF  Default screen memory (1 KB) — available if screen relocated
$0800        BASIC stub (1 byte: $00 — end of BASIC program marker)
$0801–$CFFF  ← USER PROGRAM (code + data + variables): 26,623 bytes
$D000–$D3FF  VIC-II registers
$D400–$D7FF  SID registers
$D800–$DBFF  Color RAM (1 KB, 4-bit nybbles)
$DC00–$DCFF  CIA1
$DD00–$DDFF  CIA2
$DE00–$DFFF  I/O expansion
$E000–$FFFF  KERNAL ROM (active)
```

### 2.2 Profile Values

```
memory:
  code_start:     $0801
  code_end:       $CFFF
  data_start:     $0801
  data_end:       $CFFF
  ram_start:      $0801
  ram_end:        $CFFF
  zp_start:       $02
  zp_end:         $8F
  stack_reserve:  20
```

### 2.3 Memory Map Notes

- **Code and data share the same segment** ($0801–$CFFF). The linker interleaves code and const data; mutable data is placed after code.
- **$0400–$07FF** (default screen) is not included in the usable range. Games that relocate the screen can reclaim this via a custom profile.
- **KERNAL at $E000–$FFFF** is kept active by default for file I/O and IRQ handling. Programs that bank out KERNAL gain another 8 KB but must handle IRQs directly.
- The 1-byte BASIC stub at $0800 (`$00`) ensures `RUN` from BASIC triggers the load address, which jumps to the entry point.

---

## 3. Zero Page

### 3.1 Available Range

With BASIC ROM banked out and KERNAL active:

| Range | Bytes | Owner | Available? |
|-------|-------|-------|-----------|
| $00–$01 | 2 | 6510 I/O port | ❌ Hardware |
| $02 | 1 | Free | ✅ |
| $03–$04 | 2 | Float→Int vector (BASIC) | ✅ (BASIC off) |
| $05–$06 | 2 | Float→Int vector (BASIC) | ✅ (BASIC off) |
| $07–$08 | 2 | BASIC search / temp | ✅ (BASIC off) |
| $09–$0A | 2 | BASIC scan column | ✅ (BASIC off) |
| $0B–$60 | 86 | BASIC workspace | ✅ (BASIC off) |
| $61–$6F | 15 | BASIC FP workspace | ✅ (BASIC off) |
| $70–$8F | 32 | BASIC temp / cassette | ✅ (BASIC off) |
| $90–$9F | 16 | KERNAL status / timing | ❌ KERNAL uses |
| $A0–$A2 | 3 | Jiffy clock | ❌ KERNAL uses |
| $A3–$B3 | 17 | KERNAL I/O | ❌ KERNAL uses |
| $B4–$BD | 10 | KERNAL temp | ⚠️ Usable between I/O calls |
| $BE–$C2 | 5 | KERNAL buffer | ❌ KERNAL uses |
| $C3–$CF | 13 | KERNAL I/O | ❌ KERNAL uses |
| $D0–$FA | 43 | KERNAL / screen editor | ❌ KERNAL uses |
| $FB–$FE | 4 | Free (always) | ✅ |
| $FF | 1 | BASIC temp | ✅ (BASIC off) |

**Default profile range**: `$02`–`$8F` = **142 zero-page bytes** available to the compiler.

### 3.2 Profile Values

```
budgets:
  max_zp: 142
```

---

## 4. Resource Budgets

```
budgets:
  max_binary_size: 26623    # $0801–$CFFF = 26,623 bytes
  max_ram:         26623    # shared with binary
  max_zp:          142      # $02–$8F
  stack_budget:    230      # 256 - 20 reserve - 6 IRQ overhead
```

### 4.1 Budget Notes

- **max_binary_size**: The PRG file includes a 2-byte load address header, so the actual file size is `binary_size + 2`. The 26,623 byte limit is for the executable content.
- **stack_budget**: 20 bytes reserved for KERNAL use (IRQ handler, file I/O); 6 bytes for IRQ overhead (return address + saved registers). This leaves 230 bytes for the program's call stack.
- **Frame size warning**: SFA frames larger than 64 bytes are flagged — on the C64 this is generous but helps catch runaway structures.

---

## 5. Output Format

```
output:
  output_format:  prg
  load_address:   $0801
```

### 5.1 PRG Format

The output is a standard C64 `.prg` file:

| Offset | Size | Content |
|--------|------|---------|
| $0000 | 2 bytes | Load address (little-endian): `$01 $08` |
| $0002 | n bytes | Program binary |

### 5.2 Startup Sequence

The compiler generates a BASIC stub at $0801 that auto-starts the program:

```
$0801: $0B $08 $0A $00 $9E $32 $30 $36 $31 $00 $00 $00
       (BASIC line: 10 SYS 2061)
$080D: ← actual entry point (2061 = $080D)
```

The generated startup code at $080D:
1. Writes `$36` to `$01` (bank out BASIC ROM, keep KERNAL + I/O)
2. Zeroes BSS segment
3. Copies DATA initializers to RAM
4. Calls `main()`
5. On return from `main()`: writes `$37` to `$01` (restore BASIC), executes `RTS` to BASIC

---

## 6. Character Encoding

```
encoding:
  default_encoding: petscii
  screen_encoding:  screen_codes
```

### 6.1 PETSCII

String literals are encoded in **PETSCII** (PET Standard Code of Information Interchange). The `encode()` intrinsic maps source characters to PETSCII values at compile time.

| Source Char | PETSCII Value | Notes |
|------------|---------------|-------|
| `'A'`–`'Z'` | $41–$5A | Uppercase (default C64 mode) |
| `'a'`–`'z'` | $C1–$DA | Lowercase (shifted mode) |
| `'0'`–`'9'` | $30–$39 | Same as ASCII |
| `' '` | $20 | Space |
| `'\n'` | $0D | Carriage return (C64 newline) |

### 6.2 Screen Codes

When writing directly to screen memory ($0400), screen codes differ from PETSCII. The platform library provides `to_screen_code()` for conversion, but the profile defines the mapping for compiler-level optimizations.

---

## 7. Embed Format Handlers

```
embed_formats:
  spd: spritepad
  ctm: charpad
  sid: sid_file
  prg: raw_binary
```

### 7.1 SpritePad (`.spd`)

| Selector | Type | Description |
|----------|------|-------------|
| `.sprites` | `const byte[]` | Sprite data (63 bytes per sprite, padded to 64) |
| `.colors` | `const byte[]` | Per-sprite color bytes |
| `.count` | `byte` | Number of sprites in file |

### 7.2 CharPad (`.ctm`)

| Selector | Type | Description |
|----------|------|-------------|
| `.tiles` | `const byte[]` | Character/tile data (8 bytes per char) |
| `.map` | `const byte[]` | Tile map (row-major) |
| `.colors` | `const byte[]` | Per-tile color attributes |
| `.map_width` | `byte` | Map width in tiles |
| `.map_height` | `byte` | Map height in tiles |

### 7.3 SID File (`.sid`)

| Selector | Type | Description |
|----------|------|-------------|
| `.data` | `const byte[]` | SID player + music data (relocatable binary) |
| `.init_address` | `word` | Init routine address |
| `.play_address` | `word` | Play routine address (call once per frame) |

---

## 8. Platform Warnings

```
warnings:
  warn_frame_size: 64
  warn_array_size: 256
```

| Warning | Threshold | Rationale |
|---------|-----------|-----------|
| W10030 (frame size) | 64 bytes | Large frames consume scarce RAM quickly |
| W10191 (array size) | 256 bytes | Arrays > 256 cannot use byte indexing |

---

## 9. Platform-Specific Notes

### 9.1 Cycle Timing

- **PAL**: 19,656 cycles per frame (312 lines × 63 cycles), 50 Hz
- **NTSC**: 17,095 cycles per frame (263 lines × 65 cycles), 60 Hz
- Raster time per visible line: 40 visible characters = 40 cycles (badlines steal more)

### 9.2 IRQ Considerations

The C64 KERNAL IRQ handler is at $EA31. The default profile keeps KERNAL active, so interrupt functions must coordinate with the KERNAL IRQ chain. Typical pattern:
- Use `asm_sei()` to disable interrupts
- Set up IRQ vector at $0314/$0315 (KERNAL indirect vector)
- Use `asm_cli()` to re-enable

### 9.3 VIC-II Bank Considerations

VIC-II can address 16 KB banks (selected via CIA2 $DD00). The default profile assumes Bank 0 ($0000–$3FFF). Programs using other banks should adjust `code_start` in a custom profile to avoid placing code in the VIC-II visible area.

---

## 10. Complete Profile

```yaml
# Blend65 Platform Profile: Commodore 64
platform: c64
cpu: 6502
clock_mhz: 0.985       # PAL (NTSC: 1.023)

memory:
  code_start:     $0801
  code_end:       $CFFF
  data_start:     $0801
  data_end:       $CFFF
  ram_start:      $0801
  ram_end:        $CFFF
  zp_start:       $02
  zp_end:         $8F
  stack_reserve:  20

budgets:
  max_binary_size: 26623
  max_ram:         26623
  max_zp:          142
  stack_budget:    230

output:
  output_format:  prg
  load_address:   $0801

encoding:
  default_encoding: petscii
  screen_encoding:  screen_codes

embed_formats:
  spd: spritepad
  ctm: charpad
  sid: sid_file
  prg: raw_binary

warnings:
  warn_frame_size: 64
  warn_array_size: 256
```

---

## Gate G3 Checklist (c64)

| Profile Slot | Filled? |
|---|---|
| code_start / code_end | ✅ $0801 / $CFFF |
| data_start / data_end | ✅ $0801 / $CFFF |
| ram_start / ram_end | ✅ $0801 / $CFFF |
| zp_start / zp_end | ✅ $02 / $8F |
| stack_reserve | ✅ 20 |
| max_binary_size | ✅ 26623 |
| max_ram | ✅ 26623 |
| max_zp | ✅ 142 |
| stack_budget | ✅ 230 |
| output_format | ✅ prg |
| load_address | ✅ $0801 |
| reset_vector | N/A (disk-based, not cartridge) |
| default_encoding | ✅ petscii |
| screen_encoding | ✅ screen_codes |
| embed_formats | ✅ spd, ctm, sid, prg |
| warn_frame_size | ✅ 64 |
| warn_array_size | ✅ 256 |
