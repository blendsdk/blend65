# RD-13: Non-Functional Requirements

> **Status**: 🟢 Authored
> **MVP Phase**: A
> **Depends On**: —
> **Implements**: `spec-v3.0` Language Guard rules (H2, H4, H5, L3, L6, L7); AR-1..AR-3,
>   AR-10, AR-15, AR-17, AR-22, AR-27, AR-38, AR-41, AR-73, AR-74, AR-77, AR-78
> **Owning package(s)**: Cross-cutting — applies to all `@blend65/*` packages
> **Created**: 2026-05-31
> **Last Updated**: 2026-05-31

---

## 1. Purpose

This document specifies the **non-functional requirements** (NFRs) for the Blend65
compiler — the quality attributes that every functional RD (RD-01..RD-12, RD-14..RD-17)
must satisfy but that belong to no single package or pipeline stage. NFRs are
cross-cutting constraints on *how* the compiler behaves, not *what* it computes.

The categories covered are: **compile-time performance**, **portability** (of the
compiler tool itself), **error UX** (quality of diagnostics and developer experience),
**reliability & determinism**, **maintainability & code quality**, **testability**, and
**security**. Each requirement traces to a resolved AR entry or a frozen spec rule.

---

## 2. Scope

**In scope:**
- Compile-time performance targets and measurement strategy
- Node.js runtime portability of the compiler tool
- Diagnostic UX quality bar (actionable messages, caret rendering, color)
- Compiler determinism (same input → same output, always)
- Code quality standards (TypeScript strictness, linting, documentation)
- Test coverage expectations per tier (unit / golden / emulator)
- Security posture (dependency hygiene, no arbitrary code execution)

**Out of scope (and where it lives instead):**
- Generated-code performance on 6502 → spec rules H1/H2/H3 (Language Guard); codegen
  quality is a functional concern in RD-07/RD-08
- Platform-specific runtime behavior → platform appendices + RD-10
- LSP-specific performance (incremental reparsing) → RD-14 (deferred past MVP, AR-78)
- CI pipeline configuration details → RD-01

> **Traceability rule:** Every decision below must cite the Ambiguity Register entry
> (`AR-NN`, in `00-ambiguity-register.md`) that resolved it, or the frozen spec section
> it implements. No decision may be invented here — discovery is closed.

---

## 3. Decisions & Requirements

### 3.1 Compile-Time Performance

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R1 | Whole-program compile time must be acceptable for C64-scale projects | Target: full compile (lex → parse → semantic → SFA → IL → codegen → ACME) in **< 2 seconds** for a 50-file / 10 KLOC project on a modern dev machine. This is not a hard contractual SLA — it is the design target that guides architecture decisions | AR-2, AR-41 |
| R2 | LSP reparse must complete within the debounce window | Full whole-program reparse must complete in **< 250 ms** for a 50-file / 10 KLOC project so the debounced recompilation strategy (AR-41) delivers responsive squiggles | AR-41 |
| R3 | No stage may have super-linear worst-case complexity without justification | Every compiler stage must be O(n) or O(n log n) in the size of the input. If a stage is O(n²) or worse (e.g., interference-graph coloring in RD-05), the expected input size must be documented and the practical impact shown to be negligible for the target workload (C64-scale programs ≤ 10 KLOC, ≤ 200 functions) | AR-2 |
| R4 | No unnecessary file I/O during compilation | Source files are read once and held in the `SourceMap` (RD-11). The lexer, parser, and semantic phases operate on in-memory strings. Disk I/O is limited to: (1) reading source files, (2) reading `blend65.json`, (3) writing `.asm` output, (4) invoking ACME (child process), (5) writing the build summary | AR-40 |
| R5 | ACME invocation is the expected bottleneck | The child-process spawn + ACME assembly is an external I/O cost. The compiler should minimize what it asks ACME to do (one file, one invocation). The golden-test tier avoids ACME entirely by asserting on `.asm` text | AR-61, AR-63, AR-22 |

### 3.2 Portability (of the Compiler Tool)

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R6 | The compiler runs on Node.js 22+ | Node 22 is the minimum supported version (pinned LTS). No Node-version-specific APIs below v22 are used | AR-10 |
| R7 | The compiler runs on Windows, macOS, and Linux | All file-path handling uses `node:path` (never hardcoded separators). Child-process invocation (ACME) uses `node:child_process` with `shell: false`. No OS-specific APIs other than `process.platform` for ACME discovery | AR-3 |
| R8 | No native Node addons | All `@blend65/*` packages are pure JavaScript/TypeScript. No `node-gyp`, no NAPI bindings, no WASM. This ensures `npm install` works without a C++ toolchain | AR-1 |
| R9 | The compiler has no implicit external dependencies beyond ACME | ACME is the only external binary required and its absence is a clear `E1xxxx` diagnostic (AR-62). No other external tools are silently required | AR-62 |

### 3.3 Error UX & Developer Experience

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R10 | Every user-facing diagnostic has a unique, permanent error code | Codes follow the `E10xxx`/`W10xxx` namespace (AR-70). Every code is documented in the spec (Ch 14) with a message, example trigger, and suggested fix | AR-70, L6 |
| R11 | Error messages are actionable | Every diagnostic must tell the developer (1) what went wrong, (2) where it went wrong (source location), and (3) how to fix it. "How to fix it" may be in the `help` field or implied by the message | L6 |
| R12 | Errors are caught at compile time wherever possible | Runtime failures on 6502 are catastrophic (no OS, no exceptions). The compiler must reject invalid programs at compile time with clear diagnostics. Runtime-only failures are a last resort and must be documented | L7 |
| R13 | Error recovery produces useful multi-error output | The compiler continues after errors (AR-15/AR-73) and produces multiple diagnostics in a single run. Cascade suppression (AR-74) prevents one real error from producing dozens of derived errors | AR-15, AR-73, AR-74 |
| R14 | Terminal output uses conditional color | Color is on by default for TTY, off for pipes/files. Respects `NO_COLOR` env var and `--no-color` flag. Library API never uses color | AR-17 |
| R15 | The CLI provides a `--help` and `--version` flag | Standard CLI ergonomics. `--help` lists all flags with descriptions. `--version` prints the compiler version | Design, AR-16 |
| R16 | Compiler messages use clear, jargon-free language | Messages target TypeScript/C developers (L3). Terms like "SFA" or "zero page" are explained on first use in a diagnostic or have a `note` attachment. Internal compiler terminology (e.g., "IL lowering") never appears in user-facing messages | L3 |

### 3.4 Reliability & Determinism

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R17 | The compiler is deterministic | Same source input + same configuration + same platform target → identical `.asm` output, identical diagnostics (set and order), identical `ResourceReport`. No randomness, no timestamp-dependent behavior, no hash-order-dependent iteration. This is enforced by golden-snapshot tests | H5, AR-74 |
| R18 | No undefined behavior in the compiler itself | Every input to the compiler produces either a well-defined output (build artifacts + diagnostics) or a graceful failure with diagnostics. The compiler never crashes, hangs, or produces corrupt output silently. An unrecoverable internal error produces an ICE diagnostic (`E9xxxx`) with as much context as possible | H5 |
| R19 | The compiler never produces a silent wrong binary | If the generated code would be incorrect (e.g., illegal opcode for the target CPU), the compiler must detect this and produce an ICE diagnostic, not silently emit bad code. This is the AR-58/AR-68 contract | AR-58, AR-68, H5 |
| R20 | Build artifacts are atomic | A failed build never leaves a `.prg` behind (the binary is only written on success). A failed build *does* leave the `.asm` file for debugging (AR-63). Partial artifacts never masquerade as successful builds | AR-63, AR-68 |
| R21 | The compiler handles malformed input gracefully | Arbitrary byte sequences as input (binary files, truncated files, BOM-prefixed files, files with mixed line endings) must not crash the compiler. They may produce lexer errors, but the process must exit cleanly | AR-15 |

### 3.5 Maintainability & Code Quality

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R22 | TypeScript strict mode is enabled | `tsconfig.json` uses `"strict": true` across all packages. No `any` types except in explicitly documented escape hatches (e.g., JSON parsing). No `@ts-ignore` without a justification comment | AR-1 |
| R23 | ESLint + Prettier enforced in CI | All code must pass ESLint (with the project's configured rule set) and Prettier formatting checks. CI fails on lint/format violations | AR-12 |
| R24 | Public APIs are documented with JSDoc | Every exported function, interface, type, and class in every `@blend65/*` package has a JSDoc comment describing its purpose, parameters, return value, and usage notes | Design |
| R25 | Internal module boundaries are enforced | The package dependency graph (RD-01) is enforced. The load-bearing boundary — `@blend65/frontend` and `@blend65/language-server` must NOT depend on `@blend65/codegen` — is verified by the build system (tsc project references reject the import) | AR-20 |
| R26 | Code follows the single-responsibility principle | Each `@blend65/*` package has a well-defined scope documented in RD-01. Functions and classes within packages should have focused responsibilities. God objects/functions are rejected in code review | Design |
| R27 | No circular dependencies between packages | Turborepo + tsc project references enforce a DAG. Circular `import` between packages is a build failure | AR-5, AR-20 |
| R28 | Diagnostic codes are centrally cataloged | A code-to-message mapping exists in `@blend65/core` so that no diagnostic code is used without being registered. Duplicate code usage is a test failure | AR-70, L6 |

### 3.6 Testability

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R29 | Three-tier test taxonomy is followed | Unit tests (Vitest, no I/O), golden-snapshot tests (assert on `.asm`/IL text), emulator tests (VICE binary-monitor) — per AR-22. Every RD specifies which tiers apply to its features | AR-22 |
| R30 | Unit + golden tests run in CI | GitHub Actions runs unit and golden tiers on every PR. No emulator tests in CI (AR-27) | AR-27 |
| R31 | Golden snapshots are committed to git | Golden files (expected `.asm`, expected IL text, expected diagnostic output) are version-controlled. `--update-golden` refreshes them deliberately | AR-22, AR-60, AR-51 |
| R32 | Emulator tests are runnable locally | A developer with VICE installed can run the emulator tier with a single command. Tests auto-skip with a clear message when VICE is not found | AR-27, AR-24 |
| R33 | Every diagnostic code has at least one test | For every `E10xxx`/`W10xxx` code used in the compiler, there exists at least one unit or golden test that triggers it and asserts the diagnostic is produced | L6, AR-22 |
| R34 | Coverage target: critical paths ≥ 90% line coverage | The lexer, parser, semantic analyzer, and codegen are critical paths. Coverage is measured per package. Non-critical paths (CLI argument parsing, color detection) have no formal target | Design |

### 3.7 Security

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R35 | No arbitrary code execution from source files | The compiler reads `.blend` source files as text. It never `eval()`s, `import()`s, or executes any content from source files. The only executed external process is ACME (an assembler, not user-controlled code) | Design |
| R36 | Dependency hygiene | npm dependencies are minimized. Direct runtime dependencies are audited. `npm audit` is part of CI. No dependency is added without justification | Design |
| R37 | File-system access is scoped | The compiler reads from the project directory (source files, `blend65.json`) and writes to the output directory (`.asm`, `.prg`, reports). It never writes outside the project/output directory. No network access | AR-40 |
| R38 | `blend65.json` is data, not code | The config file is JSONC (data only). It is never `require()`d or `import()`ed — it is parsed by a JSON parser. Config values are validated against a schema | AR-13 |

---

## 4. Design Detail

### 4.1 Performance Measurement Strategy

Performance is measured, not assumed. The walking-skeleton methodology (AR-38) means
performance is observable from the first vertical slice:

```
┌─────────────────────────────────────────────────────────────┐
│  Measurement approach:                                       │
│                                                              │
│  1. Each slice adds a real program to the golden-test suite  │
│  2. The CI job reports wall-clock compile time per golden     │
│     test as a Vitest annotation (no separate benchmark infra)│
│  3. If a golden-test compile time exceeds 500ms (single      │
│     file) or 2000ms (full suite), a review is triggered      │
│  4. LSP reparse latency is profiled manually during RD-14    │
│     development using Node.js performance.now() instrumentation│
└─────────────────────────────────────────────────────────────┘
```

**No dedicated benchmark infrastructure in v1.** The golden-snapshot test suite
*is* the implicit performance test — each golden test compiles a real program,
and regressions in compile time are visible in CI wall-clock times. Formal
performance benchmarks (with statistical rigor) are deferred to post-MVP.

### 4.2 Determinism Verification

Determinism (R17) is verified structurally, not by repeated runs:

1. **Golden snapshots** (AR-22): committed expected output for `.asm`, IL text, and
   diagnostic output. Any non-determinism breaks a golden test on the first CI run.
2. **Deterministic ordering** in `DiagnosticBag` (AR-73/R18 in RD-11): sort by
   `(sourceId, start, code)`, not by insertion order.
3. **No `Map`/`Set` iteration** where order matters: use sorted arrays or `Map` with
   explicit key ordering when the output must be deterministic.
4. **No `Date.now()` or `Math.random()`** in any code path that affects output.

### 4.3 Error UX Quality Bar

Every diagnostic must pass this checklist before being merged:

| Criterion | Required? | Example |
|-----------|-----------|---------|
| Has a unique `E10xxx`/`W10xxx` code | ✅ Yes | `E10042` |
| Message describes the problem in user terms | ✅ Yes | `'poke()' expects 2 arguments — found 3` |
| Points to the correct source location | ✅ Yes | `player.blend:42:5` |
| Has a `help` suggestion when non-obvious | Recommended | `help: remove the extra argument` |
| Has `note` for context when needed | Recommended | `note: 'poke' signature is poke(address: word, value: byte)` |
| Does NOT use compiler-internal terminology | ✅ Yes | No "IL temp", "SFA frame", "InstrStream" |
| Tested with at least one golden/unit test | ✅ Yes | — |

### 4.4 Dependency Policy

Runtime dependencies are categorized and controlled:

| Category | Policy | Examples |
|----------|--------|----------|
| **Zero-dep core** | `@blend65/core`, `@blend65/frontend`, `@blend65/codegen` have **zero** runtime npm dependencies | — |
| **CLI-only deps** | `@blend65/cli` may depend on `yargs` and `chalk` | AR-16, AR-17 |
| **Config-only deps** | `@blend65/config` may depend on a JSONC parser (or use a bundled one) | AR-13 |
| **VS Code deps** | `@blend65/vscode` depends on the `vscode` extension API | AR-14 |
| **Dev deps** | Vitest, ESLint, Prettier, TypeScript, Turborepo are dev-only | AR-7..AR-12 |

The **core pipeline packages** (`core`, `frontend`, `codegen`, `platforms`, `compiler`)
have no runtime npm dependencies. This minimizes supply-chain risk and ensures the
compiler can be vendored or bundled without dependency resolution issues.

### 4.5 Graceful Degradation Under Errors

The compiler's behavior when processing invalid input follows a strict priority:

```
Priority 1: Produce the correct diagnostic(s) for the error
Priority 2: Continue processing to find more errors (AR-15)
Priority 3: Produce partial/useful output where possible (e.g., --emit-il
             still works even if codegen would fail)
Priority 4: Never crash, never hang, never corrupt
```

If the compiler encounters an internal inconsistency (a state that "should never
happen"), it:
1. Emits an `E9xxxx` ICE diagnostic with the failing invariant and source context
2. Aborts the current stage (not the whole process)
3. Skips downstream stages that depend on the failed stage
4. Still produces whatever diagnostics were collected before the failure

---

## 5. Interactions With Other RDs

| RD | Relationship |
|----|--------------|
| RD-01 | **Enforces**: package boundaries (R25, R27), CI configuration (R23, R30), Node version (R6) |
| RD-02 | **Constrains**: lexer must be O(n), must handle malformed input (R3, R21) |
| RD-03 | **Constrains**: parser must be O(n), must produce error-sentinel nodes (R3, R13) |
| RD-04 | **Constrains**: semantic analysis must be O(n) or O(n log n), must cascade-suppress (R3, R13) |
| RD-05 | **Constrains**: SFA coloring may be O(n²) but practical impact must be documented (R3) |
| RD-06 | **Constrains**: IL lowering must be O(n), deterministic output (R3, R17) |
| RD-07 | **Constrains**: codegen must validate every `Instr` (R19), deterministic (R17) |
| RD-08 | **Constrains**: peephole optimizer must terminate (iteration limit), deterministic (R17) |
| RD-09 | **Constrains**: ACME integration must handle ACME absence gracefully (R9), atomic output (R20) |
| RD-10 | **Constrains**: platform plugins are data + hooks, no arbitrary code (R35) |
| RD-11 | **Enforces**: diagnostic UX quality bar (R10–R16), deterministic ordering (R17) |
| RD-12 | **Enforces**: three-tier test taxonomy (R29–R34), golden snapshots for determinism (R17) |
| RD-14 | **Constrains**: LSP reparse latency target (R2) |
| RD-15 | **Constrains**: CLI ergonomics (R14, R15) |
| RD-16 | **Constrains**: config is data-only JSONC (R38) |
| RD-17 | **Constrains**: intrinsic descriptors are data, not executable code (R35) |

---

## 6. Acceptance Criteria

- [ ] AC-01: TypeScript `strict: true` is enabled in all package `tsconfig.json` files
- [ ] AC-02: ESLint + Prettier pass in CI for all packages
- [ ] AC-03: No `@blend65/core`, `@blend65/frontend`, `@blend65/codegen`, `@blend65/platforms`,
      or `@blend65/compiler` package has a runtime npm dependency (zero-dep core policy)
- [ ] AC-04: The load-bearing frontend→codegen boundary is enforced: `@blend65/frontend`
      cannot import from `@blend65/codegen` (tsc project references reject it)
- [ ] AC-05: The compiler produces identical `.asm` output for identical input (determinism
      verified by golden-snapshot tests)
- [ ] AC-06: The compiler handles binary/truncated/BOM-prefixed input without crashing
- [ ] AC-07: Every `E10xxx`/`W10xxx` code used in the compiler has at least one test
- [ ] AC-08: Terminal output respects `NO_COLOR` env var and `--no-color` flag
- [ ] AC-09: The build summary prints by default; `--quiet` suppresses it (R15 from RD-11)
- [ ] AC-10: A failed build never leaves a `.prg` file; it does leave the `.asm` file
- [ ] AC-11: No `eval()`, `Function()`, `require()` on user-provided content paths
- [ ] AC-12: `npm audit` runs in CI with no high/critical vulnerabilities
- [ ] AC-13: Every exported symbol in every `@blend65/*` package has a JSDoc comment
- [ ] AC-14: Compiler exit code is 0 on success, non-zero on any error
- [ ] AC-15: All decisions trace to an `AR-NN` or a frozen spec section

---

## 7. Open Questions

> Discovery is **closed** (Zero-Ambiguity Gate PASSED). This section must normally be
> **empty**. If authoring surfaces a *new* ambiguity, STOP, add it to
> `00-ambiguity-register.md` as the next `AR-NN` (tagged `(runtime)`), resolve it with the
> user, then resume — per the Surface-During-Authoring rule. Do not fill gaps by guessing.

None.
