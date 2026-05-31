# Changelog

All notable changes to the Blend65 language specification are recorded here.
The format is loosely based on [Keep a Changelog](https://keepachangelog.com/),
and the project follows a major-version contract: breaking changes to a
**stable** feature require a major version bump.

---

## [Unreleased] — Compiler Discovery

### RD authoring (MVP-first)

- **Added a uniform RD template** (`requirements/RD-TEMPLATE.md`): a shared structure
  for all 17 Requirements Documents — purpose, scope, AR-traceable decisions table,
  design detail, RD interactions, acceptance criteria, and a Surface-During-Authoring
  open-questions guard.
- **Authored RD-01 — Project scaffolding & toolchain**
  (`requirements/RD-01-project-scaffolding-toolchain.md`), the root of the RD dependency
  graph. Specifies the Yarn-classic + Turborepo monorepo, the ten `@blend65/*` package
  skeletons with their dependency edges (incl. the load-bearing frontend/backend boundary
  that forbids `frontend`/`language-server` → `codegen`), `tsc` project references,
  Vite/Vitest/ESLint+Prettier wiring, and the GitHub Actions CI (unit+golden tiers; no
  emulator tier per AR-27). Every decision traces to AR-1, AR-4..AR-12, AR-19..AR-21,
  AR-24, AR-27, AR-38. Status set to 🟢 Authored in the RD index.
- **Authored RD-02 — Lexer** (`requirements/RD-02-lexer.md`). Specifies the tokenizer
  in `@blend65/frontend` implementing Ch 01 (Lexical Structure): 76+ token types, 32
  keywords, contextual keywords (`until`/`to`/`downto`/`step` → `IDENTIFIER`), decimal/
  hex (`$`+`0x`)/binary (`0b`) literals with underscore separators, string/char literals
  with escape validation, maximal-munch operator scanning, `LineMap` construction, and
  the error-tolerant recovery strategy (never throws, appends to `DiagnosticBag`, always
  produces a complete stream ending in `EOF`). Traces to Ch 01, F021, AR-15, AR-20,
  AR-40, AR-72, AR-73, AR-74. Status set to 🟢 Authored in the RD index.
- **Authored RD-03 — Parser & AST** (`requirements/RD-03-parser-ast.md`). Specifies the
  recursive-descent + Pratt parser in `@blend65/frontend` and the complete AST node model
  (51 node kinds) in `@blend65/core`. Covers all 85 grammar productions, 14-level Pratt
  operator precedence with binding-power table, error-tolerant recovery (error-sentinel
  nodes `ErrorExpr`/`ErrorStmt`/`ErrorType`, context-specific sync points, cascade
  suppression), the `AstVisitor<R>` contract with `walkNode`/`walkChildren`, type/operator
  enums (`AssignOp`/`BinaryOp`/`UnaryOp`/`IntrinsicKind`), struct-literal disambiguation,
  contextual keyword recognition, 17 parser diagnostic codes (E103xx band), and the public
  `parse()` API. Traces to grammar.ebnf.md, Ch 02–13, F001–F006/F008–F009/F011–F019/
  F022/F024, AR-15, AR-38, AR-72, AR-73, AR-74. Status set to 🟢 Authored in the RD index.
- **Authored RD-04 — Semantic Analysis & Type System**
  (`requirements/RD-04-semantic-analysis.md`). Specifies the complete semantic analysis
  phase in `@blend65/frontend` with type/scope/symbol data structures in `@blend65/core`.
  Defines a 4-pass architecture (declaration collection → type resolution → body checking
  → post-check validation), hierarchical scope model (global/module/function/block),
  unified name resolver (AR-42), full type representation (`Type` discriminated union with
  poison `ErrorType` for cascade suppression), all Ch 02 type-checking rules (widening
  promotion, mixed-signedness errors, no implicit narrowing, bool-not-numeric, enum↔byte
  cast), expression typing for all 17 expression node kinds, declaration validation
  (variables, constants, functions, structs, enums, main(), interrupts), statement
  validation (control-flow conditions, return completeness, break/continue/fallthrough
  context), call-graph construction with DFS recursion detection (FN-12), compile-time
  const evaluator, intrinsic validation against typed descriptors (AR-29/31/32), array
  and data-inclusion checks, warning generation (unused variables, unreachable code,
  use-before-init), and the `SemanticModel` output record consumed by downstream SFA/IL
  phases. 121 requirements (R1–R121), 20 acceptance criteria (AC-01–AC-20), 45+ semantic
  diagnostic codes from Ch 14. Traces to Ch 02–10, Ch 12–14, F002/F003/F010/F011/F016/
  F018/F019/F022, AR-15, AR-29, AR-31, AR-32, AR-42, AR-73, AR-74, AR-75, AR-77, AR-91.
   Status set to 🟢 Authored in the RD index.
- **Authored RD-05 — SFA Frame Planner & Zero-Page Allocator**
  (`requirements/RD-05-sfa-frame-planner.md`). Specifies the SFA frame planner and
  zero-page allocator in `@blend65/frontend` — the last front-end phase that transforms
  the `SemanticModel` into a concrete `AllocationPlan`. Defines frame computation per
  function (slot sizes from Ch 11 §3.3), interference-graph construction from the call
  graph, greedy frame-coloring algorithm for memory sharing between non-overlapping-
  lifetime functions (AR-87), interrupt-handler frame isolation (always-live, separate
  ZP/temp pool, AR-88), escape-set insurance for FUT-003 typed function pointers
  (AR-93), zero-page allocation with Ch 11 §4.2 priority order (AR-90), ZP pointer
  sharing via the interference graph, stack-depth analysis from call graph, pre-ACME
  budget diagnostics (E10032/E10033, AR-81), budget warnings (W10030/W10033/W10180),
  ACME symbol definition generation for all SFA-owned addresses (AR-66), module-level
  variable placement, and the `AllocationPlan` output record with resource-report data
  (AR-79/80). 62 requirements (R1–R62), 21 acceptance criteria (AC-01–AC-21), 5
  diagnostic codes. Traces to Ch 11, Ch 06 §5–§7, Ch 14, F005/F018/F019, AR-15,
  AR-22, AR-47, AR-66, AR-81, AR-87–AR-93. Status set to 🟢 Authored in the RD index.
- **Authored RD-06 — IL & IL Optimizer** (`requirements/RD-06-il-optimizer.md`).
  Specifies the Intermediate Language in `@blend65/codegen` — a flat three-address code
  (TAC, AR-45, SSA explicitly rejected) with explicitly typed virtual temps (AR-46),
  basic-block CFG with `br`/`brcond`/`ret` terminators (AR-48, no φ-nodes), and a
  three-variant symbolic operand model (immediate/temp/location, AR-52). Defines the
  complete IL instruction set (28 opcodes: arithmetic, bitwise, comparison, type
  conversion, memory load/store/indexed/indirect, call, intrinsic call, copy, const),
  AST→IL lowering rules for all 51 AST node kinds (short-circuit `&&`/`||` → conditional
  branches, ternary → branch+merge, for-loop → header/body/increment/back-edge, switch
  → cascading brcond chain, compound assignment → load+op+store), intrinsic dispatch
  per AR-49 (fold compile-time queries, load/store for peek/poke, call for T1/T3/T4),
  stable deterministic textual form for `--emit-il` and golden-snapshot testing (AR-51),
  and the pass-pipeline IL optimizer (v1 passthrough per AR-38, future: constant folding,
  DCE feeding W10130, strength reduction). 70 requirements (R1–R70), 19 acceptance
  criteria (AC-01–AC-19). Traces to Ch 02–06, Ch 08–09, Ch 11–14, AR-15, AR-22,
  AR-38, AR-45–AR-52, AR-66, AR-70, AR-74. Status set to 🟢 Authored in the RD index.
- **Authored RD-07 — 6502 Code Generation & Structured Instr Model**
  (`requirements/RD-07-codegen-instr.md`). Specifies the 6502 code generator in
  `@blend65/codegen` — the final lowering level (AR-50). Defines the typed `Instr`
  record (AR-53/54) with `Opcode` and `AddressingMode` enums, the symbolic operand
  union (AR-56) with `byteSelect` hi/lo modifier (AR-57), per-function `InstrStream`
  containers with first-class labels and ACME directives (AR-55/59), CPU validation
  against the platform's legal opcode+mode table (AR-58), IL→`Instr` translation rules
  for all IL ops (arithmetic sequences, comparison flag patterns, type conversions,
  memory load/store, calling convention, interrupt prologue/epilogue), register binding
  of virtual temps to A/X/Y+ZP-scratch (AR-47), for-loop Pattern A/B selection
  (Ch 05 §7.7), multiply three-tier codegen strategy (Ch 04 §3.2), platform codegen
  hooks for startup/format/origin (AR-18/64/65/69), source-span propagation (AR-72),
  and the canonical `--emit-asm` text serialization (AR-60). 61 requirements (R1–R61),
  19 acceptance criteria (AC-01–AC-19). Traces to Ch 04–06, Ch 08, Ch 11–12, AR-18,
  AR-47, AR-50, AR-53–AR-60, AR-64–AR-65, AR-69–AR-70, AR-72.
  Status set to 🟢 Authored in the RD index.
- **Authored RD-08 — Peephole Optimizer** (`requirements/RD-08-peephole-optimizer.md`).
  Specifies the peephole optimizer in `@blend65/codegen` — the second and final
  optimization stage (AR-50), operating on the `InstrProgram` between codegen (RD-07)
  and ACME emitter (RD-09). Defines the `PeepholeRule` interface (`name`, `windowSize`,
  `priority`, `cpuCompat`, `match()`/`replace()`), the sliding-window pattern scanner
  over `StreamEntry[]` with label/directive barriers (AR-55), post-optimization CPU
  validation (AR-58), source-span preservation (AR-72), deterministic output (H5),
  iteration-limit safety, `--optimize`/`--no-optimize` compiler flags, and optimization
  statistics for the resource report (RD-11). v1 is a passthrough with an empty rule
  set (AR-38); a catalog of 11 planned future rules (redundant load, dead store,
  tail-call, branch-over-JMP, STZ replacement, etc.) is specified to guide the
  interface design. 31 requirements (R1–R31), 17 acceptance criteria (AC-01–AC-17).
  Traces to AR-38, AR-50, AR-55, AR-58, AR-59, AR-67, AR-70, AR-72, AR-79, AR-83,
  Language Guard F3. Status set to 🟢 Authored in the RD index.
- **Authored RD-09 — ACME Emitter & Assembler Integration**
  (`requirements/RD-09-acme-emitter.md`). Specifies the ACME emitter (serializer) in
  `@blend65/codegen` and the assembler integration layer in `@blend65/compiler`. Defines
  the single canonical `serializeToAcme()` function (AR-60/63) producing ACME-syntax
  `.asm` text (uppercase mnemonics, `$` hex, `!` directives, colon labels); symbol-
  definition emission from `AllocationPlan` (AR-66, ZP/frame/module-var symbols); platform
  preamble serialization from plugin directives (AR-64/65, BASIC stub, startup shim);
  defined segment ordering (preamble→code→const-data→BSS); ACME discovery three-tier
  strategy `--acme-path`→PATH→hard error (AR-62); child-process invocation with label-file
  and report-file flags (AR-67); ACME failure as ICE with `.asm` retained (AR-68); post-ACME
  binary-size budget check E10034 (AR-81); VICE label-file parser (`al C:xxxx .name`);
  `BuildResult` record with binary+`.asm`+symbol-map+resource-report; complete entry-
  serialization rules for all 13 addressing modes and 7 directive kinds; example `.asm`
  output for the MVP gate program. 47 requirements (R1–R47), 20 acceptance criteria
  (AC-01–AC-20). Traces to Ch 15 §3, appendix-c64 §5, AR-55–AR-69, AR-80–AR-81.
  Status set to 🟢 Authored in the RD index.
- **Authored RD-10 — Platform Plugin System**
  (`requirements/RD-10-platform-plugin-system.md`). Specifies the platform plugin
  architecture in `@blend65/core` (interface) and `@blend65/platforms` (implementations).
  Defines the `PlatformPlugin` interface (data+hooks, AR-18) with `PlatformProfile`
  covering all Ch 15 §3 required/optional fields (memory map, resource budgets, output
  format, CPU variant, character encoding, ZP arg-block size AR-34); codegen hooks
  `emitPreamble()`/`emitStartupShim()`/`getOutputDirective()`/`encodeString()`/
  `encodeChar()`/`getMainTerminationPolicy()`/`validateProfile()` (AR-64/65/69); three
  startup-shim variants (terminating/non-terminating/bare); T4 intrinsic descriptor
  contributions and hand-written `.asm` runtime modules (AR-28–30/33); static plugin
  registry with 5 built-in platforms (c64 MVP → c64u → cx16 → a7800 → a800xl, AR-37);
  VIC-20 deferred (AR-86); profile validation at load time; C64 plugin sketch with
  BASIC stub emission, PETSCII encoder, and terminating main policy. 41 requirements
  (R1–R41), 20 acceptance criteria (AC-01–AC-20). Traces to Ch 15, appendices c64/c64u/
  cx16/a800xl/a7800, AR-18, AR-28–34, AR-37, AR-58, AR-64–65, AR-69, AR-86.
  Status set to 🟢 Authored in the RD index.
- **Authored RD-11 — Diagnostics Engine & Resource Reporting**
  (`requirements/RD-11-diagnostics-reporting.md`). Specifies the two cross-cutting
  subsystems in `@blend65/core`: the **diagnostics engine** and the **resource reporter**.
  Diagnostics: `Diagnostic` structured record (AR-71), `SourceSpan` with interned
  `SourceId` + byte offsets + on-demand line/col/UTF-16 (AR-72), `DiagnosticBag`
  accumulator with deterministic ordering/dedup/`--max-errors` (AR-73), error-sentinel
  AST nodes + cascade suppression (AR-74), `E10xxx`/`W10xxx` user + `E9xxxx` ICE
  namespace partition (AR-70), central `SeverityPolicy` for `--warn-as-error`/
  `--suppress-warning` (AR-75), multi-renderer terminal caret + JSON (AR-76), library-
  first API returning `Diagnostic[]` (AR-77), LSP-ready posture (AR-78). Resource
  reporting: `ResourceReport` aggregator (AR-79), explicit data-source ownership
  SFA/ACME/profile/plugin (AR-80), budget-diagnostic timing split pre/post-ACME
  (AR-81), terminal table + JSON renderers (AR-82), on-by-default build summary
  (AR-83), MVP scope code+binary+budgets with full shape defined now (AR-84),
  budget warnings via severity layer (AR-85). 49 requirements (R1–R49), 21 acceptance
  criteria (AC-01–AC-21). Traces to Ch 14, AR-70–AR-85.
  Status set to 🟢 Authored in the RD index.
- **Authored RD-13 — Non-Functional Requirements**
  (`requirements/RD-13-non-functional-requirements.md`). Specifies the cross-cutting
  quality attributes that constrain all functional RDs: compile-time performance targets
  (< 2s full build for 10 KLOC, < 250ms LSP reparse per AR-41), Node.js portability
  (Windows/macOS/Linux, Node 22+, zero native addons, no OS-specific APIs), error UX
  quality bar (every diagnostic actionable with code/location/fix, jargon-free per L3,
  conditional color per AR-17), compiler determinism (same input → identical .asm +
  diagnostics + report, enforced by golden snapshots), reliability (no crashes on
  malformed input, atomic build artifacts, graceful ICE degradation), maintainability
  (TS strict mode, ESLint+Prettier, zero-dep core pipeline, JSDoc on all exports,
  enforced package boundaries per AR-20), testability (three-tier taxonomy per AR-22,
  ≥ 90% critical-path coverage, every diagnostic code tested), and security (no eval,
  no network, scoped FS, JSONC-only config). 38 requirements (R1–R38), 15 acceptance
  criteria (AC-01–AC-15). Traces to Language Guard H2/H4/H5/L3/L6/L7, AR-1–AR-3,
  AR-10, AR-13, AR-15–AR-17, AR-20, AR-22, AR-27, AR-38, AR-40–AR-41, AR-58, AR-62–
  AR-63, AR-68, AR-70, AR-73–AR-74, AR-77–AR-78.
  Status set to 🟢 Authored in the RD index.
- **Authored RD-17 — Intrinsic Functions & Runtime-Routine ABI**
  (`requirements/RD-17-intrinsics-runtime-abi.md`). Specifies the intrinsic function
  system and the runtime-routine ABI — the final RD (17 of 17). Four-tier taxonomy
  (AR-28): T1 opcode (one 6502 instruction, CPU-conditioned), T2 inline/compile-time
  (peek/poke/lo/hi/sizeof/offsetof/length), T3 core runtime (mul/div/mod `.asm`
  modules, JSR-linked, dead-stripped on 4KB 7800), T4 platform (contributed by plugins,
  explicit import required). Typed `IntrinsicDescriptor` registry (AR-29): signature,
  availability predicate keyed on CPU/platform, lowering strategy (opcode/inline/fold/
  call), cost metadata (cycles/bytes/ZP), per-routine clobber list; platform packages
  contribute T4 entries. Hybrid body strategy (AR-30): TS Instr-emit for T1/T2,
  hand-written `.asm` for T3/T4, never Blend65 source. Import boundary (AR-31): T1–T3
  ambient, T4 imported; all names reserved (shadowing = compile-time error). CPU/
  platform conditioning (AR-32): calling unavailable intrinsic = compile-time error
  naming required CPU/platform. Runtime-routine ABI (AR-33): ≤3 scalar bytes in
  A/X/Y registers, overflow in ZP arg-block (≥4 bytes guaranteed floor, AR-34),
  pointers as ZP pairs for `(ptr),Y`, return byte→A word→A/X, per-routine clobber
  declaration; compiler-marshalled SFA→ABI at call sites. "Crazy asm" = registered
  routine only (AR-35); end-user `extern function` deferred to FUT-011 (AR-36),
  same ABI. Complete Ch 12 catalog (18 core intrinsics). 38 requirements (R1–R38),
  18 acceptance criteria (AC-01–AC-18). Traces to Ch 12, AR-28–AR-36, AR-18.
  Status set to 🟢 Authored in the RD index.
- **Authored RD-16 — Compiler Configuration (`blend65.json`)**
  (`requirements/RD-16-compiler-configuration.md`). Specifies the `@blend65/config`
  package and the `blend65.json` JSONC project configuration file (AR-13). Covers
  `tsconfig.json`-style discovery (walk up from cwd), full schema (`platform` AR-37,
  `include`/`exclude` globs AR-39, `outDir`/`outName`, `acmePath` AR-62, `maxErrors`
  AR-73, `warnAsError`/`suppressWarnings` AR-75, `diagnosticsFormat` AR-76, `optimize`
  AR-38, `quiet` AR-83, `startup` AR-69), schema validation (unknown keys warn,
  invalid types error, invalid platform lists available platforms), merge order
  `defaults ← blend65.json ← CLI flags ← programmatic API`, synchronous `loadConfig()`
  returning typed `BlendConfig` result, example configurations for C64/CX16. 28
  requirements (R1–R28), 14 acceptance criteria (AC-01–AC-14). Traces to AR-13,
  AR-37–AR-39, AR-62, AR-69, AR-73, AR-75–AR-77, AR-83.
  Status set to 🟢 Authored in the RD index.
- **Authored RD-15 — Programmatic & CLI API**
  (`requirements/RD-15-programmatic-cli-api.md`). Specifies the two public invocation
  surfaces: `@blend65/compiler` (library-first programmatic API, AR-77) and `@blend65/cli`
  (`blendc` command, AR-3). Programmatic API: `compile()` (frontend-only, used by LSP),
  `build()` (full pipeline), `emitAsm()` (AR-60), `emitIl()` (AR-51); injectable
  `CompilerHost` (AR-40); structured result types (`CompileResult`/`BuildResult`/
  `EmitResult`), never throws (AR-15). CLI: yargs (AR-16), `build`/`check` subcommands,
  complete flag set (`--platform`/`--out-dir`/`--emit-asm`/`--emit-il`/`--emit-report`/
  `--max-errors`/`--warn-as-error`/`--suppress-warning`/`--diagnostics-format`/
  `--acme-path`/`--optimize`/`--quiet`/`--no-color`/`--report=json`/`--help`/`--version`),
  conditional chalk color (AR-17), diagnostics→stderr / summary→stdout separation,
  exit codes 0/1/2/3, `DiskCompilerHost` file discovery (AR-39). 44 requirements
  (R1–R44), 19 acceptance criteria (AC-01–AC-19). Traces to AR-3, AR-15–AR-17,
  AR-39–AR-40, AR-51, AR-60, AR-62–AR-63, AR-68, AR-73, AR-75–AR-77, AR-82–AR-83.
  Status set to 🟢 Authored in the RD index.
- **Authored RD-14 — VS Code Extension & Language Server**
  (`requirements/RD-14-vscode-language-server.md`). Specifies the two-package VS Code
  integration: `@blend65/vscode` (extension client) and `@blend65/language-server` (LSP
  server, AR-20 load-bearing boundary: depends on frontend+core only, never codegen).
  TextMate grammar for syntax highlighting covering all Ch 01 lexical categories (32
  keywords, contextual keywords, literals, comments, escape sequences). Full LSP
  capabilities (AR-14, non-negotiable): real-time diagnostics via debounced whole-program
  reparse (AR-41, ~200ms configurable), completion (scope chain, keywords, type names,
  module-qualified, intrinsics T1–T4 per AR-31, signature help), hover (types, intrinsic
  docs from AR-29 registry, enum values, const values, Markdown format), go-to-definition
  (variables, functions, structs, enums, imports, cross-file via Ch 10 §2; intrinsics
  return no location), document symbols (outline). `CompilerHost` LSP implementation
  with open-buffer overlay + disk fallback (AR-40). `SourceSpan` byte-offset → LSP
  Position UTF-16 conversion via `LineMap.getUtf16Column()` (AR-72). Extension
  configuration settings (`acmePath`, `maxErrors`, `debounceMs`). 45 requirements
  (R1–R45), 16 acceptance criteria (AC-01–AC-16). Traces to Ch 01, Ch 14, AR-14,
  AR-15, AR-20, AR-29, AR-31, AR-39–AR-41, AR-62, AR-70–AR-73, AR-77–AR-78.
  Status set to 🟢 Authored in the RD index.
- **Authored RD-12 — Test Harness & Emulator Verification**
  (`requirements/RD-12-test-harness.md`). Specifies the three-tier testing taxonomy
  (unit / golden-snapshot / emulator-runtime, AR-22) and the `@blend65/test-harness`
  published package (AR-24). Defines the `EmulatorDriver` abstraction interface (AR-23)
  with VICE `x64sc` binary-monitor protocol MVP driver; headless+GUI modes; register/
  memory assertions as truth with screenshots as failure artifacts only (AR-25); three
  run strategies `runUntilLabel`/`runFrames`/`runUntilMemory` with mandatory timeout
  guards (AR-26); golden-snapshot testing helpers with `--update-golden` support; test
  fixture for emulator lifecycle management; CI policy: unit+golden in GH Actions,
  emulator local-only initially (AR-27). 35 requirements (R1–R35), 16 acceptance
  criteria (AC-01–AC-16). Traces to AR-22–AR-27, AR-67, Language Guard C4/C5.
  Status set to 🟢 Authored in the RD index.

### Repository layout

- **Renamed `language-specification-v3/` → `spec/`** (per AR-19), via `git mv` so
  full file history is preserved. Live path references in `requirements/` and
  `.clinerules/` were updated; the historical "renamed from" notes were kept
  intentionally.

### Discovery closed — Zero-Ambiguity Gate PASSED (2026-05-30)


The compiler requirements discovery phase is complete. All ambiguity-register
threads (**AR-1..AR-93**) are resolved and the **Zero-Ambiguity Gate is PASSED**,
unblocking RD (requirements document) authoring against the frozen `spec-v3.0`.

- **Preflight protocol** added (`requirements/01-preflight-checklist.md`): a
  repeatable five-gate audit (spec-hygiene, spec-contradiction, AR-coverage,
  RD-traceability, MVP-reachability). First run recorded as PASS.
- **AR-86**: VIC-20 accepted as the 6th and final target platform (after
  `c64 → c64u → cx16 → a7800 → a800xl`); rides the c64 toolchain with zero
  core-language impact — spec row, appendix, and profile variants deferred to the
  final platform phase.
- **AR-87..AR-93**: preflight gap sweep surfaced a class of *under-specified
  algorithms* in Ch 11 ("the compiler computes X from the static call graph" with
  no algorithm). Registered as delegation entries owned by RD-05 (frame coloring,
  interrupt frames, ZP allocation, frame-region peak) and RD-04 (module-init
  topological sort), with FN-A9 raw-vector escape declared out-of-scope and a
  FUT-003 (typed function pointers) "escape-set" forward-insurance note. Soundness
  rests on the **provably complete v3 call graph** (FN-12: functions are not
  values; no indirect calls; recursion forbidden).

---

## [spec-v3.0] — 2026-05-30 — Frozen Baseline


The first frozen baseline of the Blend65 v3 language specification. This tag is
the **stable reference** against which compiler implementation begins. No further
changes land on this baseline; subsequent spec work proceeds toward a future
version.

### Contents

- **15 specification chapters** (`00`–`15`): introduction, lexical structure,
  type system, variables, expressions & operators, statements & control flow,
  functions, structs, arrays & strings, enums, modules, memory model,
  intrinsics, data inclusion, diagnostics, platform profile.
- **Master grammar** (`grammar.ebnf.md`): ISO 14977 EBNF, 85 productions,
  LL(2) maximum lookahead, Gate G4 certified (PASS).
- **23 feature evaluations** (`evaluations/F001`–`F024`): every feature passed
  the 23-rule Language Guard across all five target platforms.
- **5 platform appendices**: Commodore 64, C64 Ultimate, Commander X16,
  Atari 800XL, Atari 7800.
- **Supporting documents**: feature index, future considerations, v2→v3
  migration guide, pre-flight report, build plan.

### Pre-flight audit (resolved in this baseline)

- Undefined behavior eliminated in favor of an explicit **unspecified-value**
  model — every input yields a defined result or a compile-time error.
- Source file extension standardized to `.blend` (was `.b65` in v2).
- Identifier length limit specified.
- `for`-loop range keywords `until` (exclusive), `to`/`downto` (inclusive),
  and `step` fully specified as **contextual keywords** with bound-range
  semantics and codegen notes.
- Module initialization order defined, with circular-initializer detection.
- Matching diagnostics added: use-before-assign warning, loop-bound error,
  circular-initializer error.

### Stability

- Baseline commit: `c2dded1`
- Spec internal version: **3.0**
- This baseline is **stable**.
