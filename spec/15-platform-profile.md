# Chapter 15 — Conformance & Platform Profile Contract

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: Language Guard, F005, F015 (consolidated)

---

## 1. Overview

A **platform profile** defines everything the Blend65 compiler needs to know about a specific target platform. The core language specification (Ch 00–14) is platform-neutral — it never mentions a specific CPU speed, memory address, or hardware chip. All platform-specific details live in platform profiles.

This chapter defines:
- The contract a platform profile must fulfill
- The required and optional fields
- How the compiler uses profile data for code generation, resource checking, and diagnostics
- Conformance rules for the compiler itself

---

## 2. Target Platforms

Blend65 v3 targets five platforms:

| Platform ID | CPU | Clock | RAM | Notes |
|-------------|-----|-------|-----|-------|
| `c64` | 6502 | 1 MHz | 64 KB | Primary target, disk-based |
| `c64u` | 6502 + extensions | 1 MHz+ | 64 KB+ | C64 Ultimate (REU, etc.) |
| `cx16` | 65C02 | 8 MHz | 512 KB+ banked | Modern 6502 design |
| `a800xl` | 6502 | 1.79 MHz | 64 KB | Atari 800XL |
| `a7800` | 6502C | 1.19 MHz | 4 KB + cart | Atari 7800, tightest constraints |

---

## 3. Platform Profile Contract

Every platform profile must define the following sections. The compiler validates the profile at startup and refuses to compile if required fields are missing.

### 3.1 Required Fields

#### Memory Map

| Field | Type | Description |
|-------|------|-------------|
| `code_start` | `word` | Start address of code segment |
| `code_end` | `word` | End address of code segment |
| `data_start` | `word` | Start address of data segment |
| `data_end` | `word` | End address of data segment |
| `ram_start` | `word` | Start address of general RAM |
| `ram_end` | `word` | End address of general RAM |
| `zp_start` | `byte` | First available zero-page address |
| `zp_end` | `byte` | Last available zero-page address |
| `stack_reserve` | `byte` | Bytes reserved for OS/KERNAL on hardware stack |

#### Resource Budgets

| Field | Type | Description |
|-------|------|-------------|
| `max_binary_size` | `word` | Maximum output binary size in bytes |
| `max_ram` | `word` | Maximum RAM available for variables + frames |
| `max_zp` | `byte` | Maximum zero-page bytes available |
| `stack_budget` | `byte` | Usable hardware stack bytes (256 − stack_reserve − IRQ overhead) |

#### Output Format

| Field | Type | Description |
|-------|------|-------------|
| `output_format` | `string` | Binary format: `prg`, `bin`, `rom`, `xex`, `a78` |
| `load_address` | `word` | Load address written to binary header (if applicable) |
| `reset_vector` | `word` | Address written to reset vector (for cartridge platforms) |

### 3.2 Optional Fields

#### Character Encoding

| Field | Type | Description |
|-------|------|-------------|
| `default_encoding` | `string` | Character encoding for string literals: `petscii`, `atascii`, `ascii` |
| `screen_encoding` | `string` | Screen code encoding (if different from default) |

#### Asset Format Handlers

| Field | Type | Description |
|-------|------|-------------|
| `embed_formats` | `map` | File extension → format handler mapping for `embed()` selectors (→ Ch 13) |

#### Platform Warnings

| Field | Type | Description |
|-------|------|-------------|
| `warn_frame_size` | `word` | Warn if any single SFA frame exceeds this size |
| `warn_array_size` | `word` | Warn if any array exceeds this size |

---

## 4. Example Platform Profile (C64)

```
platform: c64
cpu: 6502
clock_mhz: 1.0

memory:
  code_start: $0801
  code_end:   $9FFF
  data_start: $0801      # interleaved with code
  data_end:   $9FFF
  ram_start:  $0801
  ram_end:    $9FFF
  zp_start:   $02
  zp_end:     $2F
  stack_reserve: 20

budgets:
  max_binary_size: 38911  # $0801–$9FFF
  max_ram:         38911
  max_zp:          46      # $02–$2F
  stack_budget:    230     # 256 - 20 reserve - 6 IRQ

output:
  output_format: prg
  load_address:  $0801

encoding:
  default_encoding: petscii
  screen_encoding:  screen_codes

embed_formats:
  spd: spritepad       # .sprites, .colors
  ctm: charpad         # .map, .tiles, .colors
  sid: sid_file         # .data, .initAddress, .playAddress

warnings:
  warn_frame_size: 64
  warn_array_size: 256
```

---

## 5. Compiler Conformance Rules

### 5.1 Language Conformance

A conforming Blend65 v3 compiler must:

1. Accept any source program that conforms to the grammar in Ch 01 and the semantic rules in Ch 02–13
2. Reject any source program that violates a rule, with the correct error code from Ch 14
3. Generate correct machine code for all target platforms defined in §2
4. Produce deterministic output — the same source + profile = the same binary, byte for byte
5. Report all diagnostics with the format specified in Ch 14, §1

### 5.2 Platform Conformance

For each platform profile:

1. Generated code must execute correctly on the target hardware (or a cycle-accurate emulator)
2. Memory placement must respect the profile's memory map boundaries
3. Resource usage must be validated against the profile's budgets
4. Budget violations must produce the correct error codes (E10032, E10033, E10034)
5. Budget warnings must fire at the thresholds defined in the profile

### 5.3 Determinism

All language features have fully defined behavior (Axiom A5 — no undefined behavior). Specifically:

| Operation | Defined Behavior |
|-----------|-----------------|
| Integer overflow | Wraps (natural 6502 behavior) |
| Unsigned subtraction underflow | Wraps to 255/65535 |
| Signed overflow | Wraps (two's complement) |
| Array index out of bounds (static) | Compile-time error E10115 |
| Array index out of bounds (runtime) | Wrapping index (modulo array size) |
| Division by zero (constant) | Compile-time error E10082 |
| Division by zero (runtime) | Returns 0 (defined, documented) |

### 5.4 Build Summary

A conforming compiler must produce a build summary (→ Ch 11, §6) that reports:
- Code, data, RAM, ZP usage (bytes and addresses)
- SFA frame allocation with sharing statistics
- Hardware stack peak usage
- Startup routine cost (bytes and cycles)
- Total binary size

---

## 6. Stability Classifications

Each chapter's features are classified per the Language Guard (→ `.clinerules/language-guard.md`, F4):

| Classification | Meaning | Contract |
|----------------|---------|----------|
| **Stable** | Fully designed, will not change | Breaking changes require major version bump |
| **Provisional** | Designed but may be refined | Minor adjustments possible in next minor version |
| **Experimental** | Exploratory, may be removed | No stability guarantee |

### v3 Chapter Classifications

| Chapter | Classification | Notes |
|---------|---------------|-------|
| 00 – Introduction | Stable | Design axioms are foundational |
| 01 – Lexical Structure | Stable | |
| 02 – Type System | Stable | |
| 03 – Variables & Constants | Stable | |
| 04 – Expressions & Operators | Stable | Multiply/divide/modulo: provisional (software routines) |
| 05 – Statements & Control Flow | Stable | |
| 06 – Functions | Stable | Interrupt functions: provisional |
| 07 – Structs | Stable | |
| 08 – Arrays & Strings | Stable | String encoding: provisional (platform-profile dependent) |
| 09 – Enums | Stable | |
| 10 – Modules | Stable | |
| 11 – Memory Model & SFA | Stable | |
| 12 – Intrinsics | Stable | |
| 13 – Data Inclusion | Stable | Format-aware embed selectors: provisional |
| 14 – Diagnostics | Stable | New codes may be added (never removed) |
| 15 – Platform Profile | Provisional | Profile schema may evolve with new platforms |
