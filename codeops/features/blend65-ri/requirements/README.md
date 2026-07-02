# Blend65 Compiler — Requirements Documents

> **Project**: Blend65 Compiler (`blendc`) — a TypeScript compiler that turns
> Blend65 source (`.blend`) into 6502 machine code for retro platforms.
> **Status**: Discovery CLOSED — Zero-Ambiguity Gate **PASSED** 2026-05-30 (AR-1..AR-93); preflight protocol recorded in `01-preflight-checklist.md`; RD authoring is the active phase

> **Created**: 2026-05-30
> **Implements**: Language specification `spec-v3.0` (frozen baseline)
> **Architecture**: TypeScript monorepo (Yarn classic + Turborepo), Node CLI, `@blend65/*` packages

---

## Overview

This requirements set defines **the compiler** for the Blend65 language. The language
itself is already fully specified and frozen as `spec-v3.0` (15 chapters + grammar +
23 feature evaluations + 5 platform appendices). These requirement documents describe
the *software that implements that specification* — the lexer, parser, semantic
analyzer, SFA frame planner, IL, code generator, peephole optimizer, ACME emitter,
platform plugin system, diagnostics, language server, VS Code extension, and
test/verification harness.

The compiler pipeline (agreed during planning):

```
source.blend
  → Lexer → Parser (recursive-descent + Pratt) → AST + scopes/modules
  → Semantic / type check → Control-flow & rule validators
  → SFA frame planner + zero-page allocator        ← Blend65-specific
  → IL lowering → Optimizer 1 (IL-level, passthrough v1)
  → 6502 codegen → structured Instr list
  → Optimizer 2 (peephole on Instr list, passthrough v1)
  → ACME emitter (Instr list → ACME .asm text)
  → ACME assembles → platform binary (.prg etc.)
  (Diagnostics, Platform Plugins, Resource Reporter span all stages)
```

> **This is a living index.** RDs are added/refined as they are identified during
> discovery. Numbers, scope, and ordering may change until the Zero-Ambiguity Gate
> passes and the full RDs are authored.

---

## Repository Layout (per AR-19, AR-20)

```
blend65/  (repo root — Yarn workspaces + turbo.json)
├── spec/                  → language specification (renamed from language-specification-v3); frozen spec-v3.0
├── docs/                  → reserved for make_techdocs VitePress site (compiler architecture)
├── plans/                 → plans + requirements (committed to git)
├── research/              → research notes
├── examples/              → sample .blend programs
└── packages/
    ├── @blend65/core            → shared types, diagnostics engine, Instr model, span utils
    ├── @blend65/frontend        → lexer, parser, AST, semantic analysis, SFA planner (error-tolerant, library-first)
    ├── @blend65/codegen         → IL, IL optimizer, 6502 codegen, peephole, ACME emitter
    ├── @blend65/platforms       → platform plugins (data + codegen hooks): c64, cx16, a800xl, a7800, c64u
    ├── @blend65/config          → blend65.json loading + validation (JSONC)
    ├── @blend65/compiler        → thin façade → public programmatic API
    ├── @blend65/cli             → blendc command (yargs + chalk)
    ├── @blend65/language-server → LSP server (depends on frontend + core)
    ├── @blend65/vscode          → VS Code extension client (bundles language-server)
    └── @blend65/test-harness    → published emulator test harness (AR-24); EmulatorDriver (VICE x64sc), headless+GUI
```

---

## Domain Glossary

| Term | Definition |
|------|-----------|
| **`blendc`** | The Blend65 compiler command-line tool. |
| **SFA** | Static Frame Allocation — no heap/recursion; every function has one statically-allocated frame; frames reused for non-overlapping lifetimes. |
| **IL** | Intermediate Language — target-independent representation between AST and 6502 codegen. |
| **`Instr`** | A structured, in-memory representation of a single 6502 instruction (mnemonic + operand + addressing mode), produced by codegen and consumed by the peephole optimizer and ACME emitter. NOT a separate spec'd language (avoids the v2 "ASM-IL" trap). |
| **Peephole optimizer** | Pass that rewrites short windows of the `Instr` list into cheaper equivalents (v1 = passthrough). |
| **ACME emitter** | Serializes the `Instr` list into ACME assembler source text. |
| **ACME** | External 6502 assembler that turns the emitted `.asm` text into a platform binary. |
| **Platform plugin** | A target platform implemented as data + codegen-strategy hooks (per AR-18): zero-page range, RAM map, char encoding, binary format, cycle timing, CPU variant, plus behavior hooks (startup stub, binary wrapping, string encoding). |
| **LSP** | Language Server Protocol — powers the VS Code extension (highlighting, diagnostics, completion, hover, go-to-def). |

---

## RD Index (living capture list)

> Status legend: 🟡 Candidate (identified, not yet authored) · 🟢 Authored · ⚪ Deferred

| # | Document | Description | Depends On | MVP Phase | Status |
|---|----------|-------------|------------|-----------|--------|
| RD-01 | [Project scaffolding & toolchain](RD-01-project-scaffolding-toolchain.md) | Monorepo setup (Yarn+Turbo), `@blend65/*` packages, Node 22, Vitest, ESLint+Prettier, GH Actions, Vite | — | A | 🟢 Authored |
| RD-02 | [Lexer](RD-02-lexer.md) | Tokenizer incl. contextual keywords; **error-tolerant (AR-15)** | RD-01 | A | 🟢 Authored |
| RD-03 | [Parser & AST](RD-03-parser-ast.md) | Recursive-descent + Pratt; AST node model (51 node kinds); **error-recovering, partial AST (AR-15)**; Pratt 14-level precedence; visitor contract | RD-02 | A | 🟢 Authored |
| RD-04 | [Semantic analysis & type system](RD-04-semantic-analysis.md) | Type checking (Ch 02), scope model, 4-pass architecture, name resolution (AR-42), expression typing, declaration/statement validation, call-graph & recursion detection, const evaluator, intrinsic validation, poison-type cascade suppression; 121 requirements, 20 acceptance criteria; **library-first (AR-15)** | RD-03 | A | 🟢 Authored |
| RD-05 | [SFA frame planner & zero-page allocator](RD-05-sfa-frame-planner.md) | Frame computation, interference-graph coloring (AR-87), interrupt/escape-set isolation (AR-88/93), ZP priority allocation (AR-90), stack-depth analysis, budget diagnostics pre-ACME (AR-81), `AllocationPlan` output with ACME symbol definitions (AR-66); 62 requirements, 21 acceptance criteria; **error-tolerant (AR-15)** | RD-04 | A | 🟢 Authored |
| RD-06 | [IL & IL optimizer](RD-06-il-optimizer.md) | Flat TAC IL (AR-45, SSA rejected), explicitly typed temps (AR-46), basic-block CFG (AR-48), symbolic operand model (AR-52), AST→IL lowering for all 51 node kinds, intrinsic dispatch (AR-49), `zext`/`sext`/`trunc` materialization (AR-46), stable textual form for `--emit-il` + golden snapshots (AR-51), pass-pipeline optimizer (v1 passthrough, AR-38); 70 requirements, 19 acceptance criteria | RD-05 | A | 🟢 Authored |
| RD-07 | [6502 codegen & structured `Instr` model](RD-07-codegen-instr.md) | Typed `Instr` record (AR-53/54), `Opcode`+`AddressingMode` enums, symbolic operand union (AR-56), `byteSelect` hi/lo modifier (AR-57), per-function `InstrStream` with labels+directives (AR-55/59), CPU validation table (AR-58), IL→`Instr` translation for all ops, register binding A/X/Y+ZP-scratch (AR-47), calling convention + interrupt prologue/epilogue, for-loop Pattern A/B (Ch 05 §7.7), multiply 3-tier strategy, platform codegen hooks (AR-18/64/65/69), canonical `--emit-asm` serialization (AR-60); 61 requirements, 19 acceptance criteria | RD-06, RD-10 | A | 🟢 Authored |
| RD-08 | [Peephole optimizer](RD-08-peephole-optimizer.md) | Sliding-window pattern matcher over `InstrStream` entries (AR-55); `PeepholeRule` interface with `match()`/`replace()`, CPU-variant filtering (AR-58), label/directive barriers, post-optimization CPU validation, iteration-limit safety; v1 = passthrough with empty rule set (AR-38); catalog of 11 planned future rules; `--optimize`/`--no-optimize` flags; optimization statistics for resource report (RD-11); 31 requirements, 17 acceptance criteria | RD-07 | B | 🟢 Authored |
| RD-09 | [ACME emitter & assembler integration](RD-09-acme-emitter.md) | Single canonical `serializeToAcme()` serializer (AR-60/63) for both `--emit-asm` and build; ACME-syntax output with uppercase mnemonics, `$` hex, `!` directives; symbol-definition emission from `AllocationPlan` (AR-66); platform preamble via plugin directives (AR-64/65); defined segment ordering; ACME discovery three-tier strategy (AR-62); child-process invocation with label-file output (AR-67); ACME failure = ICE with `.asm` retained (AR-68); post-ACME binary-size budget check E10034 (AR-81); VICE label-file parser; `BuildResult` with binary + `.asm` + symbol map; 47 requirements, 20 acceptance criteria | RD-07, RD-08, RD-10 | A | 🟢 Authored |
| RD-10 | [**Platform plugin system**](RD-10-platform-plugin-system.md) | `PlatformPlugin` interface (data+hooks, AR-18) in `@blend65/core`; `PlatformProfile` with all Ch 15 §3 required/optional fields (memory map, budgets, output format, CPU variant, encoding, ZP arg-block AR-34); codegen hooks `emitPreamble()`/`emitStartupShim()`/`getOutputDirective()`/`encodeString()`/`encodeChar()`/`getMainTerminationPolicy()` (AR-64/65/69); 3 startup-shim variants (terminating/non-terminating/bare); T4 intrinsic descriptor contributions + runtime `.asm` modules (AR-28–30/33); static plugin registry in `@blend65/platforms`; 5 built-in plugins (c64 MVP, c64u, cx16, a800xl, a7800) per AR-37; profile validation at load time; C64 plugin sketch with BASIC stub + PETSCII encoder; 41 requirements, 20 acceptance criteria | RD-01 | A | 🟢 Authored |
| RD-11 | [Diagnostics & resource reporting](RD-11-diagnostics-reporting.md) | **Diagnostics engine** in `@blend65/core`: `Diagnostic` structured record (AR-71), `SourceSpan` with interned `SourceId`+byte offsets + on-demand line/col/UTF-16 (AR-72), `DiagnosticBag` accumulator with deterministic ordering/dedup/`--max-errors` (AR-73), error-sentinel nodes + cascade suppression (AR-74), `E10xxx`/`W10xxx` user + `E9xxxx` ICE namespace (AR-70), `SeverityPolicy` layer `--warn-as-error`/`--suppress-warning` (AR-75), multi-renderer terminal caret + JSON (AR-76), library-first API (AR-77), LSP-ready (AR-78). **Resource reporter**: `ResourceReport` aggregator (AR-79), data-source ownership SFA/ACME/profile/plugin (AR-80), budget-diagnostic timing split (AR-81), terminal table + JSON renderers (AR-82), on-by-default build summary (AR-83), MVP scope code+binary+budgets (AR-84); 49 requirements, 21 acceptance criteria | RD-01 | A | 🟢 Authored |
| RD-12 | [Test harness & emulator verification](RD-12-test-harness.md) | 3-tier taxonomy: unit/golden-snapshot/emulator-runtime (AR-22); `@blend65/test-harness` published pkg (AR-24); `EmulatorDriver` abstraction + VICE `x64sc` binary-monitor driver (AR-23); headless+GUI modes; register/memory assertions as truth, screenshots as failure artifacts (AR-25); run strategies `runUntilLabel`/`runFrames`/`runUntilMemory` with mandatory timeout (AR-26); golden-snapshot helpers with `--update-golden`; CI policy unit+golden in GH Actions, emulator local-only (AR-27); test fixture for emulator lifecycle; 35 requirements, 16 acceptance criteria | RD-01 | A | 🟢 Authored |
| RD-13 | [Non-functional requirements](RD-13-non-functional-requirements.md) | Cross-cutting quality attributes: compile-time performance targets (< 2s full build, < 250ms LSP reparse), Node.js portability (Windows/macOS/Linux, Node 22+, zero native addons), error UX quality bar (actionable messages, conditional color, jargon-free), compiler determinism (same input → same output, golden-enforced), reliability (no crashes, atomic artifacts, graceful degradation), maintainability (strict TS, ESLint+Prettier, zero-dep core, JSDoc, enforced package boundaries), three-tier testability (≥ 90% critical-path coverage, every diagnostic code tested), security (no eval, no network, scoped FS, JSONC-only config); 38 requirements, 15 acceptance criteria | — | A | 🟢 Authored |
| RD-14 | [VS Code extension & Language Server](RD-14-vscode-language-server.md) | Two-package architecture: `@blend65/vscode` extension client + `@blend65/language-server` LSP server (AR-20 load-bearing boundary: server depends only on frontend+core, never codegen); TextMate grammar for syntax highlighting (32 keywords, contextual keywords, literals, comments, escape sequences); full LSP capabilities (AR-14): real-time diagnostics via debounced whole-program reparse (AR-41, ~200ms), completion (scope chain + keywords + types + module-qualified + intrinsics + signature help), hover (types + intrinsic docs + enum/const values), go-to-definition (variables, functions, structs, enums, imports, cross-file), document symbols (outline); `CompilerHost` LSP buffer-overlay implementation (AR-40); `SourceSpan` → LSP Position UTF-16 conversion (AR-72); extension configuration (`acmePath`, `maxErrors`, `debounceMs`); 45 requirements, 16 acceptance criteria | RD-03, RD-04 | B | 🟢 Authored |
| RD-15 | [Programmatic + CLI API](RD-15-programmatic-cli-api.md) | Library-first architecture (AR-77): `@blend65/compiler` facade with `compile()` (frontend-only, used by LSP), `build()` (full pipeline), `emitAsm()` (AR-60), `emitIl()` (AR-51); injectable `CompilerHost` (AR-40); structured result types (`CompileResult`/`BuildResult`/`EmitResult`), never throws (AR-15). `@blend65/cli` `blendc` command (AR-3): yargs (AR-16), `build`/`check` subcommands, `--platform`/`--out-dir`/`--emit-asm`/`--emit-il`/`--emit-report`/`--max-errors`/`--warn-as-error`/`--suppress-warning`/`--diagnostics-format`/`--acme-path`/`--optimize`/`--quiet`/`--no-color`/`--report=json`; conditional chalk (AR-17); diagnostics→stderr, summary→stdout; exit codes 0/1/2/3 with the R50 classification rule; 51 requirements, 20 acceptance criteria | RD-01, RD-09, RD-10, RD-11, RD-16 | A | 🟢 Authored (preflighted 2026-07-03) |
| RD-16 | [Compiler configuration (`blend65.json`)](RD-16-compiler-configuration.md) | `@blend65/config` package: JSONC project config (AR-13) with `tsconfig.json`-style discovery (walk up from cwd); schema covering `platform` (AR-37), `include`/`exclude` globs (AR-39), `outDir`/`outName`, `acmePath` (AR-62), `maxErrors` (AR-73), `warnAsError`/`suppressWarnings` (AR-75), `diagnosticsFormat` (AR-76), `optimize` (AR-38), `quiet` (AR-83), `startup` (AR-69); schema validation (unknown keys warn, invalid types error, invalid platform lists available); merge order defaults←config←CLI←API; synchronous `loadConfig()` with typed `BlendConfig` result; 28 requirements, 14 acceptance criteria | RD-01 | A | 🟢 Authored |
| RD-17 | [Intrinsic functions & runtime-routine ABI](RD-17-intrinsics-runtime-abi.md) | 4-tier taxonomy T1–T4 (AR-28): T1 opcode (one 6502 instruction, CPU-conditioned), T2 inline/compile-time (peek/poke/lo/hi/sizeof/offsetof/length), T3 core runtime (mul/div/mod `.asm` modules, JSR-linked, dead-stripped), T4 platform (contributed by plugins, explicit import required). Typed `IntrinsicDescriptor` registry (AR-29) with signature, availability predicate, lowering strategy, cost metadata, clobber list; platform packages contribute T4 entries. Hybrid body strategy (AR-30): TS Instr-emit for T1/T2, hand-written `.asm` for T3/T4, never Blend65 source. Import boundary: T1–T3 ambient, T4 imported; all names reserved (AR-31). CPU/platform conditioning → compile-time error (AR-32). Runtime-routine ABI (AR-33): ≤3 bytes in A/X/Y registers, overflow in ZP arg-block (≥4 bytes guaranteed, AR-34), pointers as ZP pairs for `(ptr),Y`, return byte→A word→A/X, per-routine clobber. Compiler-marshalled SFA→ABI at call sites. "Crazy asm" = registered routine only (AR-35); `extern` deferred (AR-36). Complete Ch 12 catalog with 18 core intrinsics. 38 requirements, 18 acceptance criteria | RD-04, RD-10 | A | 🟢 Authored |


> The table above is provisional and will be refined during discovery. New rows are
> appended as requirements surface; ordering and dependencies may shift.
> **All discovery threads resolved (AR-1..AR-93):** ~~RD-17 (intrinsics)~~ ✅ (AR-28..AR-36) · ~~RD-12 (testing harness)~~ ✅ (AR-22..AR-27) · ~~first platform & ordering~~ ✅ (AR-37) · ~~compiler infrastructure + build methodology~~ ✅ (AR-38..AR-42) · ~~MVP vertical slice~~ ✅ (AR-43..AR-44) · ~~IL design~~ ✅ (AR-45..AR-52) · ~~`Instr` model~~ ✅ (AR-53..AR-60) · ~~ACME integration~~ ✅ (AR-61..AR-69) · ~~diagnostics & error-code wiring~~ ✅ (AR-70..AR-78) · ~~build summary / resource reporting~~ ✅ (AR-79..AR-85) · ~~VIC-20 as 6th/final target~~ ✅ (AR-86, spec work deferred to final platform phase) · ~~preflight gap sweep (under-specified Ch-11 algorithms + FUT-003 insurance)~~ ✅ (AR-87..AR-93). **No open threads remain — the Zero-Ambiguity Gate is PASSED (2026-05-30); the five-gate preflight protocol is recorded in `01-preflight-checklist.md`. RD authoring (MVP-first) is the active phase.**






---

## Dependency Graph (provisional)

```
RD-01 (Scaffolding & toolchain)
  ├── RD-16 (blend65.json config)
  ├── RD-15 (Programmatic + CLI API) ────────── (with RD-09, RD-10, RD-11, RD-16 — preflight PF-001)
  ├── RD-10 (Platform plugins) ──────────────── (feeds RD-07, RD-09)
  ├── RD-11 (Diagnostics & resource reporting)
  ├── RD-12 (Test harness & emulator verification)
  └── RD-02 (Lexer)
        └── RD-03 (Parser & AST)
              ├── RD-14 (VS Code ext & LSP)
              └── RD-04 (Semantic & types)
                    ├── RD-17 (Intrinsics) ──── (with RD-10)
                    └── RD-05 (SFA frame planner)
                          └── RD-06 (IL & opt 1)
                                └── RD-07 (Codegen & Instr)
                                      ├── RD-08 (Peephole)
                                      └── RD-09 (ACME emitter)
RD-13 (Non-functional) — cross-cutting
```

---

## Suggested Implementation Order (provisional)

| Phase | Documents | Description |
|-------|-----------|-------------|
| **A: MVP vertical slice** | RD-01 → infra (RD-10/11/12/15/16) → RD-02 → RD-07 + RD-09 + RD-17 | Smallest end-to-end program compiling to a runnable binary on the first target platform. **Gate = `poke` a constant on c64 → `.prg` → VICE asserts `$D020` (AR-43); terminating `main` (AR-44); slice 2 adds a local `byte` to bring SFA + ZP allocator online.** |
| **B: Optimization, LSP & breadth** | RD-08, RD-14, additional platforms | Peephole optimizer; VS Code extension/LSP; expand platform coverage. |


> Note: the error-tolerant front-end (AR-15) means the "live squiggles in VS Code"
> milestone can land soon after RD-03/RD-04, possibly before full codegen.

---

## Key Architecture Decisions (so far)

| Decision | Choice | Rationale | AR Ref |
|----------|--------|-----------|--------|
| Implementation language | TypeScript | v2 was TS and worked; author fluency; small-game target | AR-1 |
| Optimization weighting | Prototyping speed & fluency | Compiler not perf-critical for target workload | AR-2 |
| Distribution | Node CLI | Matches TS ecosystem | AR-3 |
| Package manager / monorepo / runner | Yarn classic / monorepo / Turborepo | Author preference | AR-4/5/6 |
| Build / bundle / test | tsc / Vite / Vitest | Standard TS stack | AR-7/8/9 |
| Node / CI / lint | Node 22 / GitHub Actions / ESLint+Prettier | Standard | AR-10/11/12 |
| Config file | `blend65.json` (JSONC) | tsconfig-like project config | AR-13 |
| VS Code extension | Full LSP | Non-negotiable DX goal | AR-14 |
| Front-end reusability | Library-first, error-tolerant | Shared by CLI + LSP | AR-15 |
| CLI lib / color | yargs / conditional chalk | CLI ergonomics | AR-16/17 |
| Platform model | Plugins (data + codegen hooks) | No platform logic hardcoded in core | AR-18 |
| Repo layout | /spec, /docs, /plans (committed), /packages | Separation of concerns | AR-19 |
| Package layout | 9-package, frontend/backend split (+`test-harness` = 10) | Clean LSP boundary | AR-20/24 |
| npm scope | `@blend65/*` | User owns scope | AR-21 |
| Test taxonomy | 3 tiers: unit / golden / emulator | Fast feedback + deterministic codegen checks + C5 runtime verification | AR-22 |
| Emulator harness | `EmulatorDriver`; VICE x64sc binary monitor (MVP) | Robust programmatic register/memory access; pluggable for other emulators | AR-23 |
| Harness packaging | Published `@blend65/test-harness`, headless+GUI | Exposed to game developers; works on any binary + profile | AR-24 |
| Assertions | Memory/registers = truth; screenshots = artifacts | Deterministic; avoids flaky pixel diffs | AR-25 |
| Run strategies | label (default) / frames / sentinel, all timeout-guarded | Supports terminating AND non-terminating (game) programs | AR-26 |
| Emulator CI policy | Local-only now; headless VICE on self-hosted server later | No VICE/display on GH Actions yet | AR-27 |
| Intrinsic taxonomy | 4 tiers: T1 opcode / T2 inline / T3 core runtime / T4 platform | Uniform model; kills v2 per-intrinsic special-casing | AR-28 |
| Intrinsic descriptor registry | Typed entries; platform packages contribute | Type-checked uniformly; basis of platform plugin contract | AR-29 |
| Intrinsic body strategy | Hybrid: TS Instr-emit (T1/T2) + hand-written `.asm` runtime (T3/T4) | Never blend source; JSR-linked + dead-stripped | AR-30 |
| Import boundary / names | Core ambient, platform imported; names reserved | Predictable DX; no shadowing footguns | AR-31 |
| CPU/platform conditioning | Availability predicate → compile-time error | Upholds P1/H5/L7 | AR-32 |
| Runtime-routine ABI | Registers (≤3 bytes) + reserved ZP arg-block; compiler-marshalled | Decouples hand-written asm from SFA layout | AR-33 |
| ZP arg-block sizing | Profile-declared with core-guaranteed minimum | Respects 7800 tiny ZP; gives authors a floor | AR-34 |
| "Crazy asm" surface | Registered T3/T4 runtime routine only | Bounds the v2 sprawl point; no inline asm | AR-35 |
| End-user `extern function` | Deferred to FUT-011 (same ABI) | Too footgun-prone for game devs in v3 | AR-36 |
| First platform & ordering | `c64 → c64u → cx16 → a7800 → a800xl → vic20`; C64 = MVP | Largest community + best tooling; c64u is a C64 superset; vic20 added last (AR-86) | AR-37/86 |
| Build methodology | Vertical walking skeleton (grammar up front, AST/semantics per slice) | Fixes v2: "100% lexer/parser first" made later refinements ripple | AR-38 |
| File-set discovery | CLI list → `blend65.json` globs → default `**/*.blend` | Imports are by module name, not path — whole file set needed first | AR-39 |
| Source-input abstraction | Single `CompilerHost` interface; CLI=disk, LSP=buffer overlay | The CLI ⇄ LSP boundary; keeps frontend reusable (AR-15) | AR-40 |
| LSP recompilation (MVP) | Full whole-program reparse, debounced ~150–250ms | C64-scale projects reparse in ms; incremental deferred | AR-41 |
| Name-resolution architecture | One unified resolver: imports + intrinsics over global symbol table | Circular imports allowed; intrinsic names reserved (AR-31) | AR-42 |
| MVP gate program | Option A (`poke` a constant); Option B (local `byte`) = next slice | Gate proves full pipeline; SFA frame planner + ZP allocator come online in slice 2 | AR-43 |
| MVP `main` termination | Terminating `main` (C64 shim restore-BASIC/`RTS`) | Deterministic clean-exit assertion; non-terminating path tested later | AR-44 |
| IL shape | Flat three-address code (TAC); **SSA rejected** | SSA tried in v2 and went badly; φ/dominance cost inverts on a 3-register 8-bit target | AR-45 |
| IL typing | Explicitly typed temps/ops (width+sign); explicit `zext`/`sext`/`trunc` | Codegen never re-derives types; picks 8- vs 16-bit, signed vs unsigned ops from IL | AR-46 |
| IL temp binding | Virtual temps in IL; A/X/Y + ZP bound at codegen | Allocation-agnostic IL; gate needs 0 temps, slice 2 brings binding online | AR-47 |
| IL control flow | Basic-block CFG + explicit `br`/`brcond`/`jmp`; no φ-nodes | Substrate for DCE + W10130/W10131 + the two for-loop patterns | AR-48 |
| Intrinsics in IL | Fold queries · `load`/`store` for peek/poke · `call` for T1/T3/T4 | Gate `poke` = first-class IL store; uniform descriptor-driven calls otherwise | AR-49 |
| Lowering levels | Two only: IL + `Instr` (no third "ASM-IL") | Clean opt seam (IL opt + peephole); avoids the v2 spec'd-assembly trap | AR-50 |
| IL inspectability | Stable textual form; golden-snapshot; `--emit-il` | Cheap per-slice regression check at IL stage (C4) | AR-51 |
| IL operand model | constant \| virtual-temp \| symbolic location | Addresses stay symbolic→ACME labels; upholds P3; feeds `runUntilLabel` | AR-52 |
| `Instr` granularity | One real 6502 opcode per `Instr` (labels/directives separate) | No macro/pseudo-ops; avoids re-introducing the "ASM-IL" abstraction (H2) | AR-53 |
| `Instr` shape | Typed record `{ mnemonic, addressingMode, operand, sourceSpan? }` | Table-driven 6502 model; typed enums, not stringly-typed | AR-54 |
| Labels/directives | First-class inline stream entries `Array<Instr\|Label\|Directive>` | Survives peephole insert/delete (no index drift); feeds symbol table | AR-55 |
| `Instr` operand model | Symbolic: `Immediate`/`SymbolRef`/`LabelRef`/`ZeroPageSlot`/`None` | No hard `$xxxx` in core codegen — ACME resolves via labels (P3) | AR-56 |
| Hi/lo byte selection | Operand modifier `byteSelect` → ACME `<sym`/`>sym` | Carries pointer setup + `lo()`/`hi()` without pseudo-mnemonics | AR-57 |
| `Instr` CPU validation | Validate vs active CPU's legal opcode+mode table | Illegal opcode = internal diagnostic, never a silent wrong binary (H5/L7) | AR-58 |
| `Instr` stream organization | Flat per-function stream `{ symbol, segment, instrs[] }` | Peephole + ACME want linear windows; flattening is the IL→`Instr` job | AR-59 |
| `Instr` inspectability | One canonical text form = pre-ACME asm; `--emit-asm`; golden | Same serializer the emitter feeds ACME (no drift; AR-51 lesson) | AR-60 |
| Assembler | ACME, exclusively (not swappable; future = purpose-built Blend65 assembler) | Target ACME syntax + PRG/`cbm` writer directly, zero abstraction tax | AR-61 |
| ACME discovery | Explicit (`--acme-path`/`acmePath`) → PATH → hard error | No silent fallback; golden tests assert `.asm` text not bytes | AR-62 |
| `Instr`→ACME handoff | Single AR-60 serializer writes one `.asm`; ACME assembles that file | `--emit-asm` = build input byte-identical (no drift); failed build keeps `.asm` | AR-63 |
| Layout + startup emission | Platform plugin emits origin/BASIC stub/startup shim as ACME `Directive`s | Core stays platform-agnostic (P3); stub directive-form w/ fixed `"2061"` | AR-64 |
| Output format | Platform plugin via ACME native writer (`!to ...,cbm`) | ACME writes `$01 $08` PRG header; core never hand-rolls it | AR-65 |
| Address realization split | SFA owns ZP/frame addrs (symbol defs); ACME places code/data labels | ZP packing is an SFA decision; labels read back via label file | AR-66 |
| Symbol feedback | ACME emits VICE label file → symbol→address map artifact | Powers `runUntilLabel`/`runUntilMemory`-by-name (AR-26) + build summary | AR-67 |
| ACME-stage failure | Validated-first → ACME error = `E1xxxx` internal-compiler-error | User errors must never first surface at ACME (H5/L7) | AR-68 |
| Startup-shim variants | Cross-platform contract: terminating/fall-through/bare; core analyzes, plugin renders | Auto via CFG termination analysis; per-platform returnable-main policy (a7800 warns) | AR-69 |
| Diagnostic code namespace | Partitioned: Ch 14 `E10xxx`/`W10xxx` user codes; `E9xxxx` ICE band | `E1xxxx`/`W1xxxx` placeholders resolve; user/ICE codes never collide (L6/H5) | AR-70 |
| Diagnostic value model | One structured `Diagnostic` record; never a pre-rendered string | Primary LSP-enabler; rendering is a separate concern | AR-71 |
| Span model | Interned `SourceId` + byte offsets; line/col + UTF-16 computed on demand | Multi-file; spans survive lowering via `Instr.sourceSpan?` | AR-72 |
| Diagnostic accumulation | Accumulating `DiagnosticBag` in core; deterministic order, dedup, `--max-errors` | Never throw-on-first; the mechanism behind AR-15 | AR-73 |
| Error-recovery commitment | Split: architecture stable now / rule-coverage provisional; cascade-suppression mandatory | All retrofit risk frozen into architecture layer; sync points additive later (F4/H5) | AR-74 |
| Severity policy | One central promote/suppress layer over the bag | Single impl point for Ch 14 §4 flags; rest stays policy-agnostic | AR-75 |
| Diagnostic rendering | Multi-renderer over same `Diagnostic[]`: terminal caret + JSON emitter | JSON feeds tooling/LSP; renderers never re-derive meaning | AR-76 |
| Compiler invocation surface | Library-first API returning `Diagnostic[]`; CLI is one consumer | Keeps future LSP possible without a front-end rewrite | AR-77 |
| LSP build posture | "Keep-ready, don't build now"; placeholder future/experimental RD | MVP ships no LSP but stays LSP-compatible; AR-14 reaffirmed, deferred | AR-78 |
| Resource reporter home | Dedicated aggregator in `@blend65/core`; stages contribute, never render | Mirrors AR-71/76 model-vs-render split; testable, deterministic | AR-79 |
| Report data ownership | SFA planner (frames/ZP/depth) + ACME artifacts (code/data/binary) + profile (budgets) + plugin (startup) | Composed not guessed; each number has one owner | AR-80 |
| Budget-diagnostic timing | ZP/RAM pre-ACME (fail fast); binary-size post-ACME | Upholds AR-68 (never a raw ACME crash first) | AR-81 |
| Report rendering | Multi-renderer over one `ResourceReport`: terminal table + JSON | Reuses AR-76 pattern; JSON for CI/LSP | AR-82 |
| Report visibility | On by default for successful build; quiet flag suppresses; JSON opt-in | Memory headroom is a core DX promise (H4) | AR-83 |
| MVP reporter scope | Gate = code+binary+budgets; full columns with slice 2; shape defined now | Staged with walking skeleton; no later reshape | AR-84 |
| Where recorded | Folded into RD-11; warnings via AR-75 severity layer | Shares core home + architecture with diagnostics | AR-85 |
| VIC-20 target platform | Accepted as 6th & final target, added after all others; rides c64 toolchain | Zero core-language impact (profile + appendix only, F2); spec row/appendix deferred to final platform phase | AR-86 |

---







## How to Use These Documents

Each RD is designed to feed the `make_plan` protocol:

1. Pick an RD (e.g., RD-01)
2. Run `make_plan`
3. The plan system uses the RD as input to create an implementation plan
4. Run `exec_plan [feature-name]`
5. Implement iteratively

> **Note:** Authoring began after the Zero-Ambiguity Gate (`00-ambiguity-register.md`)
> passed. RD authoring proceeds **MVP-first** (RD-01 is the root everything depends on).
> A uniform structure for all RDs is defined in `RD-TEMPLATE.md`. Status of each RD is
> tracked in the RD Index table above.
