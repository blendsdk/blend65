# 65C02 Multi-CPU Support Implementation Plan

> **Feature**: Multi-CPU codegen support (6502 + 65C02) for X16 platform
> **Status**: Planning Complete
> **Created**: 2026-06-02

## Overview

Add 65C02 instruction support to the Blend65 compiler v2 code generator. The X16 platform uses a 65C02 CPU which provides additional instructions that generate smaller, faster code. We use the **Strategy Pattern** to encapsulate CPU-specific instruction selection, keeping the existing codegen inheritance chain intact with zero duplication.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document - overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current implementation |
| 03 | [CPU Instruction Set Strategy](03-cpu-strategy.md) | CpuInstructionSet abstraction |
| 04 | [Codegen Integration](04-codegen-integration.md) | Integrating strategy into codegen layers |
| 05 | [ASM-IL Builder Updates](05-asm-il-builder.md) | New 65C02 instructions in builder |
| 06 | [Platform Config Updates](06-platform-config.md) | Adding cpuTarget to PlatformConfig |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test plan for both CPU modes |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Key Decisions

| Decision | Outcome |
|----------|---------|
| Architecture | Strategy Pattern (CpuInstructionSet) — not parallel inheritance |
| CPU targets | `'6502'` and `'65c02'` only (no 65816) |
| Default | `'6502'` for backward compatibility |
| Platform binding | PlatformConfig carries cpuTarget |

## 65C02 Instructions Used

| 65C02 Instruction | Replaces (6502) | Savings | Used In |
|-------------------|-----------------|---------|---------|
| `STZ addr` | `LDA #0` + `STA addr` | 1 byte, 2 cycles | memory.ts |
| `BRA rel` | `JMP abs` | 1 byte, 1 cycle | control.ts |
| `INA` / `DEA` | `CLC+ADC #1` / `SEC+SBC #1` | 1-2 bytes, 2-4 cycles | arithmetic.ts |
| `PHX` / `PLX` | `TXA+PHA` / `PLA+TAX` | 1 byte, 2 cycles | functions.ts |
| `PHY` / `PLY` | `TYA+PHA` / `PLA+TAY` | 1 byte, 2 cycles | functions.ts |
