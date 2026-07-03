# Ambiguity Register: Blend65 Compiler Requirements

> **Status**: ✅ GATE PASSED — discovery closed 2026-05-30; all AR-1..AR-93 resolved; preflight protocol run & recorded (see `01-preflight-checklist.md`); RD authoring unblocked

> **Last Updated**: 2026-07-03 (runtime AR-103..AR-105 — RD-11b plan gate; AR-105 addendum — RD-11b plan preflight PF-003; AR-102 — RD-11 preflight)


> **Purpose**: Audit trail — every decision in every RD traces to an entry here.
> **Scope**: The Blend65 compiler (`blendc`) — the software that implements the
> frozen `spec-v3.0` language specification.

---

## Register

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Technical | Implementation language for the compiler | Rust / TypeScript / Go / Zig / C# | **TypeScript** | ✅ Resolved |
| 2 | Technical | Primary optimization weighting driving language choice | (a) long-term perf/correctness; (b) prototyping speed & author fluency; (c) other | **(b) prototyping speed & author fluency** | ✅ Resolved |
| 3 | Technical | Distribution format for the finished compiler | (a) native single binary; (b) Node CLI; (c) defer | **(b) Node CLI** | ✅ Resolved |
| 4 | Technical | Package manager | npm / Yarn classic / Yarn berry / pnpm | **Yarn classic (v1)** | ✅ Resolved |
| 5 | Technical | Package type | single package / monorepo | **Monorepo** | ✅ Resolved |
| 6 | Technical | Monorepo task runner | Turborepo / Nx / Lerna | **Turborepo (`turbo`)** | ✅ Resolved |
| 7 | Technical | TypeScript builder | `tsc` / esbuild / swc | **`tsc`** | ✅ Resolved |
| 8 | Technical | Bundler (Vite) role | (a) VSCode webview UI only; (b) bundle CLI; (c) both; (d) repo-wide per-package | **(c)+(d) both, repo-wide per-package** | ✅ Resolved |
| 9 | Technical | Unit testing framework | Vitest / Jest / node:test | **Vitest** | ✅ Resolved |
| 10 | Technical | Node.js version | latest stable / pinned LTS | **Node v22 (pinned LTS)** | ✅ Resolved |
| 11 | Technical | CI | GitHub Actions / other | **GitHub Actions** | ✅ Resolved |
| 12 | Technical | Lint/format | ESLint + Prettier / Biome | **ESLint + Prettier** | ✅ Resolved |
| 13 | Technical | Compiler config file name & format | name + JSON/JSONC/YAML/TOML | **`blend65.json`, JSONC** | ✅ Resolved |
| 14 | Feature | VS Code extension v1 scope | (a) highlighting; (b) +diagnostics; (c) full LSP | **(c) Full LSP** | ✅ Resolved |
| 15 | Technical | Front-end reusability for language server | throw-on-error / library-first error-tolerant | **Library-first, error-tolerant parsing** | ✅ Resolved |
| 16 | Technical | CLI argument library | yargs / commander / oclif | **yargs** | ✅ Resolved |
| 17 | Technical | Terminal color output | always / never / conditional | **Conditional** (see notes) | ✅ Resolved |
| 18 | Architecture | Platform profile: data only vs data+behavior | (a) data/config only; (b) data + codegen-strategy hooks | **(b) Platform plugins** | ✅ Resolved |
| 19 | Architecture | Repo layout for docs/plans/spec | various | **`/spec`, `/docs` (techdocs), `/plans` committed** | ✅ Resolved |
| 20 | Architecture | Monorepo package granularity & boundaries | coarse / moderate / fine | **9-package moderate layout, frontend/backend split** | ✅ Resolved |
| 21 | Technical | npm scope for packages | `@blend65` / `@blendsdk` / unscoped | **`@blend65/...`** | ✅ Resolved |
| 22 | Testing | Test taxonomy / tiers | one tier / multiple tiers | **Three tiers: unit / golden-snapshot / emulator runtime** | ✅ Resolved |
| 23 | Testing | Emulator integration mechanism | binary monitor / text moncommands / autostart+screenshot | **`EmulatorDriver` abstraction; VICE `x64sc` binary monitor protocol (MVP driver)** | ✅ Resolved |
| 24 | Testing | Test-harness package status | dev-only internal / published public | **Dedicated `@blend65/test-harness`, published with supported public API; headless + GUI** | ✅ Resolved |
| 25 | Testing | Primary assertion surface | memory/registers / screenshots / both golden | **Memory/registers = truth; screenshots = failure artifacts (not golden by default)** | ✅ Resolved |
| 26 | Testing | Program-run synchronization strategy | label / frames / sentinel | **All three: `runUntilLabel` (default), `runFrames(n)`, `runUntilMemory(addr,val)`; mandatory timeout guard** | ✅ Resolved |
| 27 | Testing | CI policy for emulator tier | CI now / local-only | **Emulator tier local-only initially; unit+golden in GH Actions; headless VICE on self-hosted build server later** | ✅ Resolved |
| 28 | Architecture | Intrinsic organizing model | special-case per intrinsic / unified taxonomy | **4-tier taxonomy: T1 opcode / T2 inline-compile-time / T3 core runtime-routine / T4 platform** | ✅ Resolved |
| 29 | Architecture | How intrinsics are described to the compiler | hardcoded / typed descriptor registry | **Descriptor registry (name, signature, tier, availability predicate, lowering, cost, clobber); platform packages contribute entries** | ✅ Resolved |
| 30 | Architecture | Where intrinsic bodies live | blend source / compiler-internal / hand-written asm | **Hybrid: TS Instr-emit for T1/T2; hand-written tested `.asm` runtime modules for T3/T4 (JSR-linked, dead-stripped). Never blend source.** | ✅ Resolved |
| 31 | Feature | Import boundary + name reservation | all ambient / all imported | **Core (T1–T3) ambient; platform (T4) explicit import. All intrinsic names reserved — shadowing is a compile-time error.** | ✅ Resolved |
| 32 | Feature | CPU/platform conditioning of intrinsics | runtime / silent / compile-time error | **Availability predicate on `profile.cpu`/platform; calling an unavailable intrinsic is a compile-time error (code TBD in RD-17)** | ✅ Resolved |
| 33 | Architecture | Runtime-routine calling convention (ABI) | registers / ZP block / hw stack / SFA frame | **Hybrid A+B, compiler-marshalled: ≤3 scalar bytes in A/X/Y, rest via reserved ZP arg-block; pointers as ZP pairs for `(ptr),Y`. Return: byte=A, word=A/X. Clobber declared per routine.** | ✅ Resolved |
| 34 | Architecture | ZP argument-block sizing | fixed by core / profile-declared | **Profile-declared with a core-guaranteed minimum (exact floor fixed in RD-17)** | ✅ Resolved |
| 35 | Feature | "Crazy asm" surface in v3 | inline asm / untyped escape / registered routine only | **Platform-author-internal only: sole sanctioned path is a registered T3/T4 runtime routine (typed signature + documented cost + declared ABI/clobber). No inline asm, no untyped escape.** | ✅ Resolved |
| 36 | Feature | End-user `extern function` | expose in v3 / defer | **Deferred to FUT-011; when it lands it reuses the AR-33/34 ABI** | ✅ Resolved |
| 37 | Architecture | First target platform & ordering | pick one / ordered roadmap | **Order: `c64 → c64u → cx16 → a7800 → a800xl`; C64 is the MVP target** | ✅ Resolved |
| 38 | Process | Compiler build methodology | horizontal layers (v2) / vertical walking skeleton | **Vertical walking skeleton: grammar + token set transcribed fully up front; AST + semantic layer grown per slice behind an extensible visitor contract** | ✅ Resolved |
| 39 | Technical | File-set discovery (which `.blend` files form the program) | config globs / CLI list / both | **Both: CLI explicit list overrides; else `blend65.json` `include` globs; default `**/*.blend` from project root** | ✅ Resolved |
| 40 | Architecture | Source-input abstraction (CLI ⇄ LSP boundary) | direct fs / `CompilerHost` interface | **Single `CompilerHost` interface (list/read source files); CLI = disk impl, LSP = open-buffer overlay + disk fallback; shared frontend consumes only this interface (upholds AR-15)** | ✅ Resolved |
| 41 | Architecture | LSP recompilation model (MVP) | incremental / full reparse | **Full whole-program reparse, debounced ~150–250 ms; incremental parsing/caching deferred** | ✅ Resolved |
| 42 | Architecture | Name-resolution architecture | separate import/intrinsic passes / unified | **One unified name resolver for imports + intrinsics against the global symbol table; module merging in Pass 1; circular imports allowed; intrinsic names reserved (AR-31)** | ✅ Resolved |
| 43 | Process | MVP vertical-slice gate program | Option A (poke constant) / Option B (local var) / C / D | **Gate = Option A (`poke` a constant; no SFA/ZP); Option B (local `byte`) = mandatory Phase-A slice 2 forcing SFA frame planner + ZP allocator** | ✅ Resolved |
| 44 | Process | MVP `main` termination convention | terminating / non-terminating | **Terminating `main` (falls through → C64 shim restore-BASIC/`RTS`); VICE asserts via return-to-BASIC or fixed cycle budget; non-terminating `while(true)` supported but tested later** | ✅ Resolved |
| 45 | Architecture | IL shape / form | SSA / flat TAC / tree / stack-bytecode | **Flat three-address code (TAC) over mutable typed virtual temps. SSA explicitly rejected (tried in v2, went badly — φ/dominance cost inverts on a 3-register 8-bit target)** | ✅ Resolved |
| 46 | Architecture | IL typing model | untyped / typed (width+sign) | **Explicitly typed: every temp/op carries `{width:8\|16, signed}` (+`boolean` marker); Ch 02 promotions materialized as explicit `zext`/`sext`/`trunc` ops** | ✅ Resolved |
| 47 | Architecture | IL value/temp binding | bind in IL / bind at codegen | **Unlimited virtual temps in IL; A/X/Y + ZP-scratch binding deferred to IL→`Instr`. Named vars already have SFA slots pre-IL; gate needs 0 temps, slice 2 brings binding online** | ✅ Resolved |
| 48 | Architecture | IL control-flow representation | structured / basic-block CFG | **Basic-block CFG with explicit `br`/`brcond`/`jmp`+labels; no φ-nodes (non-SSA). Substrate for DCE + W10130/W10131 + the two for-loop patterns. Designed now, implemented per slice** | ✅ Resolved |
| 49 | Architecture | Intrinsics in IL | uniform call / split by behavior | **Split: compile-time queries fold to constants pre-IL; `peek`/`poke`/`peekw`/`pokew` → generic IL `load`/`store`; T1/T3/T4 → IL `call` carrying AR-29 descriptor, dispatched on tier at codegen** | ✅ Resolved |
| 50 | Architecture | Number of lowering levels | one / two (IL+Instr) / three | **Two only: IL (target-independent typed CFG/TAC) + `Instr` (structured 6502). No third "ASM-IL" tier (the v2 trap)** | ✅ Resolved |
| 51 | Testing | IL inspectability / testing surface | in-memory only / textual form | **Stable pretty-printed IL text form (in-memory = source of truth); golden-snapshot asserted (C4); exposed via `--emit-il`** | ✅ Resolved |
| 52 | Architecture | IL operand model | various | **Every operand is exactly one of: immediate constant / virtual temp / symbolic location (frame slot, module var, ZP var, `&`-address). Addresses stay symbolic through IL+`Instr`; ACME resolves via labels (upholds P3; feeds `runUntilLabel`)** | ✅ Resolved |
| 53 | Architecture | `Instr` granularity | macro/pseudo-op / one real opcode | **One `Instr` = exactly one real 6502 machine instruction; multi-byte ops are several `Instr`s. Only non-opcode entries are labels/directives (AR-55). No macro-instructions (would re-introduce the AR-50 "ASM-IL" abstraction)** | ✅ Resolved |
| 54 | Architecture | `Instr` shape | string mnemonic / per-opcode class / typed record | **Discriminated record `{ mnemonic, addressingMode, operand, sourceSpan? }`; `mnemonic` = typed opcode enum, `addressingMode` = enum (Implied…IndirectIndexed…Relative). Table-driven, carries originating span for diagnostics + golden readability** | ✅ Resolved |
| 55 | Architecture | Labels/directives placement | side-table keyed by index / inline stream entries | **First-class inline entries: stream is `Array<Instr \| Label \| Directive>` (one union). Survives peephole insert/delete (no index drift); feeds the symbol table for `runUntilLabel` (AR-26/52)** | ✅ Resolved |
| 56 | Architecture | `Instr` operand model | resolved address / symbolic | **Symbolic `Operand` union: `Immediate` / `SymbolRef(name, offset?)` / `LabelRef` / `ZeroPageSlot` / `None`. No hard `$xxxx` in core codegen — ACME resolves via labels (upholds P3); `offset?` covers struct-field/array-element access** | ✅ Resolved |
| 57 | Architecture | Hi/lo byte selection | separate opcodes / operand modifier | **Operand modifier `byteSelect: low\|high\|none` on `SymbolRef`/`LabelRef`, emitted as ACME `<sym`/`>sym`. Carries 16-bit pointer setup + `lo()`/`hi()` (AR-49) to the emitter without pseudo-mnemonics** | ✅ Resolved |
| 58 | Architecture | `Instr` CPU validation | trust codegen / validate vs profile | **Each `Instr` validated against the active CPU's legal opcode+mode table (profile, AR-18/32); NMOS-6502 codegen never emits 65C02-only modes. A violating codegen bug is an internal assertion/diagnostic, not a silent wrong binary (H5/L7)** | ✅ Resolved |
| 59 | Architecture | `Instr` stream organization | nested CFG / flat per-function stream | **Linear per-function `Instr` stream (CFG branches → `Label` + branch `Instr`s); container `{ symbol, segment, instrs[] }` tagged Code/Data/ZP-reservation. Flattening is the IL→`Instr` job; peephole + emitter both want linear windows** | ✅ Resolved |
| 60 | Testing | `Instr` inspectability | separate debug dump / one canonical form | **One canonical deterministic textual form = the pre-ACME assembly text; golden-snapshot asserted (AR-22) and exposed via `--emit-asm`. Same serializer the RD-09 emitter feeds to ACME (no drift; AR-51 lesson at this level)** | ✅ Resolved |
| 61 | Architecture | Which assembler / how many | ACME / ca65 / 64tass / Kick / pluggable | **ACME, exclusively — not a swappable backend. No second/third-party assembler support; if ACME ever proves insufficient the path forward is a purpose-built Blend65 assembler, never adopting ca65/64tass/Kick. RD-09 targets ACME syntax + PRG/`cbm` writer directly with zero abstraction tax** | ✅ Resolved |
| 62 | Technical | ACME executable discovery | PATH-only / vendored-pinned / explicit-then-fallback | **Explicit → PATH → hard error: (1) `--acme-path` flag, else `blend65.json` `acmePath`; (2) probe system `PATH` for `acme`; (3) if neither runnable, stop the build with a dedicated `E1xxxx` (no silent fallback, no partial output). Golden tests assert the `.asm` text (AR-60), not assembled bytes, so a PATH/user ACME version does not threaten golden reproducibility; emulator tier is already local/self-hosted-only (AR-27)** | ✅ Resolved |
| 63 | Architecture | `Instr`→ACME handoff artifact | stdin pipe / second serializer / the `--emit-asm` file | **The single AR-60 serializer writes one `.asm` to the build dir; ACME assembles that exact file. `--emit-asm` output and the real build are byte-identical (no drift, AR-51); a failed build leaves the `.asm` on disk for inspection** | ✅ Resolved |
| 64 | Architecture | Memory layout + startup emission | hardcoded in core / platform-plugin directives | **Emitted by the platform plugin (AR-18) as ACME `Directive` stream entries (AR-55): origin `* = $0801`, the `10 SYS 2061` BASIC stub, and the startup shim (bank-out BASIC, zero BSS, copy DATA inits, `JSR main`, restore-BASIC + `RTS`). Core codegen stays platform-agnostic (P3); every C64 address/byte lives in the `c64` plugin. Segment order: stub → startup → code → const-data → mutable/BSS. Stub uses directive form (`!word`/`!byte`/`!text`) with the fixed literal `"2061"` (stub layout is pinned, appendix-c64 §5.2)** | ✅ Resolved |
| 65 | Architecture | Output binary format | core hand-rolls header / platform via ACME writer | **Chosen by the platform plugin via ACME's native writer: `c64` emits `!to "<name>.prg", cbm` so ACME writes the little-endian `$01 $08` load header (appendix-c64 §5.1) — core never hand-rolls a PRG header. Other platforms select `plain`/binary (XEX segments, A78 cart) or apply a container post-step through the same hook** | ✅ Resolved |
| 66 | Architecture | Address realization split | all symbolic to ACME / compiler assigns some | **Split: the SFA allocator owns exact ZP/frame addresses, materialized as ACME symbol defs (`__zp_c = $02`) at file top — operands stay symbolic (`LDA __zp_c`), ACME substitutes. Code/data labels (function entries, data blocks) are placed by ACME from `* = $0801`; their final addresses are read back via the label file (AR-67)** | ✅ Resolved |
| 67 | Testing | Symbol feedback from ACME | none / VICE label file | **ACME emits a VICE label file (`al C:xxxx .label`), captured as a symbol→address map; first-class build artifact beside `.prg`/`.asm`. Powers harness `runUntilLabel`/`runUntilMemory`-by-name (AR-26) and the build-summary report** | ✅ Resolved |
| 68 | Architecture | ACME-stage failure handling | surface as user error / internal compiler error | **Validated-first: because `Instr`s are CPU-validated (AR-58) and addresses are compiler-assigned, an ACME error is surfaced as a dedicated `E1xxxx` internal-compiler-error (build fails loudly, retains `.asm`, includes ACME stderr verbatim). A user source error must never first surface at the ACME stage — if it does, that is by definition a missed-earlier-diagnostic compiler bug (H5/L7)** | ✅ Resolved |
| 69 | Architecture | Startup-shim optimization | fixed shim / variant selection | **Cross-platform variant contract: three shim variants (terminating / non-terminating fall-through / bare). CORE owns the CFG termination analysis of `main` (AR-48), the `startup: auto\|terminating\|minimal\|bare` config key, and the conservative "unprovable ⇒ terminating" default. Each PLUGIN renders its three concrete variants + declares the per-platform returnable-main policy: clean exit on c64/c64u (→BASIC) and a800xl (→OS warm start $E474); on a7800 a returnable `main` becomes a `JMP *` hang and is **warned** (`W1xxxx`). a7800's natural default is non-terminating. Forcing `minimal` when `main` can return is a compile-time error (L7/H5). MVP (c64) uses the terminating variant per AR-44** | ✅ Resolved |
| 70 | Architecture | Diagnostic code-number namespace | one flat space / partitioned bands | **Partitioned: Ch 14 owns user diagnostics (`E10xxx` errors, `W10xxx` warnings); a distinct `E9xxxx` band is reserved for internal-compiler-errors (ICE). The `E1xxxx`/`W1xxxx` placeholders used in AR-32/62/68/69 resolve to: user-facing codes → the Ch-14 `E10xxx`/`W10xxx` ranges; ICE (ACME-stage, illegal-opcode assertions) → the `E9xxxx` ICE band. No user code and ICE code can ever collide (L6/H5)** | ✅ Resolved |
| 71 | Architecture | Diagnostic value model | pre-rendered strings / structured record | **Single structured `Diagnostic` record produced everywhere: `{ code, severity, message, primarySpan, secondarySpans[], notes[], help? }`. No compiler component ever emits a pre-formatted/caret-rendered string — rendering is a separate concern (AR-76). This is the primary LSP-enabler and the contract every phase reports into** | ✅ Resolved |
| 72 | Architecture | Source-location / span model | line-col strings / interned id + byte offsets | **`SourceId` interning + byte-offset spans `{ source, start, end }` internally; human line/col (and LSP UTF-16 columns) computed on demand by a conversion layer, never stored in the `Diagnostic`. Multi-file aware (AR-39/40). Spans must survive lowering — `Instr.sourceSpan?` (AR-54) carries them so codegen/resource diagnostics (E10032/33/34) point back to source** | ✅ Resolved |
| 73 | Architecture | Diagnostic accumulation | throw-on-first / accumulating collector | **A `DiagnosticBag` collector in `@blend65/core` accumulates rather than throwing; deterministic ordering (by source then offset then code), dedup of identical entries, honors `--max-errors` (default 20). Every phase appends; nothing aborts the program on a single error. Upholds AR-15 (library-first, error-tolerant)** | ✅ Resolved |
| 74 | Architecture | Error-recovery commitment | fail-fast v1 / full recovery now / split | **Split by layer: the recovery **architecture** (accumulate-not-throw, error-sentinel AST/IL nodes — `ErrorExpr`/`ErrorType`/`ErrorStmt` — and a **mandatory** poison/cascade-suppression contract so derived-from-error nodes emit no further diagnostics) is **stable / committed 100% now**; the recovery-**rule coverage** (the set of parser sync points / per-phase heuristics) is **provisional / incremental** (F4) and grows per slice. Determinism is a hard invariant (same input ⇒ same diagnostic set + order, H5), locked by golden snapshots. This puts all retrofit risk in the now-frozen architecture layer; adding sync points later is purely additive** | ✅ Resolved |
| 75 | Architecture | Severity policy (promote/suppress) | scattered per-site / central layer | **One central severity-policy layer applies promotion (`--warn-as-error`, `--warn-as-error=Wxxxxx`) and suppression (`--suppress-warning=Wxxxxx`) over the `DiagnosticBag` after collection; the rest of the compiler stays policy-agnostic (always emits the natural severity). Implements the Ch 14 §4 flags in exactly one place** | ✅ Resolved |
| 76 | Architecture | Diagnostic rendering | single terminal formatter / multi-renderer | **Multiple renderers over the *same* `Diagnostic[]`: (1) a terminal renderer producing the Ch 14 caret format (honoring AR-17 color rules), and (2) a machine-readable **JSON emitter** (`--diagnostics-format=json`) for tooling/LSP consumption. Rendering never re-derives meaning — it only formats structured data (AR-71)** | ✅ Resolved |
| 77 | Architecture | Compiler invocation surface | CLI-only / library-first API | **The compiler is callable as a **library** returning structured `Diagnostic[]` (+ artifacts); the CLI (`@blend65/cli`) is just one consumer that renders them. This is the load-bearing architectural commitment that keeps a future LSP possible without a front-end rewrite — ratifies AR-15/AR-40 at the diagnostics boundary** | ✅ Resolved |
| 78 | Process | LSP build posture | build now / keep-ready / ignore | **"Keep-ready, don't build now": the MVP does **not** ship a language server, but every decision above (structured `Diagnostic`, byte-offset spans + UTF-16 conversion, accumulate-not-throw, recovery architecture, JSON emitter, library-first API) is made LSP-compatible so no rewrite is needed later. A placeholder **future / experimental** RD for editor tooling (LSP) is recorded; AR-14's "full LSP" target is reaffirmed as the eventual goal, deferred past MVP** | ✅ Resolved |
| 79 | Architecture | Where the resource reporter lives | scattered per-stage prints / dedicated aggregator | **Dedicated reporter module in `@blend65/core` aggregating a typed `ResourceReport`; stages *contribute* numbers, never render. Mirrors the AR-71/AR-76 model-vs-render split** | ✅ Resolved |
| 80 | Architecture | Data sources / who owns each number | codegen guesses / each stage reports its own | **SFA planner owns frame-region + peak-simultaneous + ZP allocation (AR-66); code/data/binary sizes come from the ACME label + output artifacts (AR-67); platform profile owns the *budgets*; startup size/cycles from the plugin shim (AR-64/AR-69)** | ✅ Resolved |
| 81 | Architecture | When budget errors fire | all post-ACME / split by knowability | **Split: ZP `E10032` + RAM `E10033` computed **pre-ACME** from the SFA plan (fail fast, before `.asm` emit); binary-size `E10034` checked **post-ACME** from the output artifact. Upholds AR-68 (user errors never first surface as a raw ACME crash)** | ✅ Resolved |
| 82 | Architecture | Report output format / renderers | single text print / multi-renderer | **Multi-renderer over one `ResourceReport` (reuses AR-76 pattern): terminal table = the Ch 11 §6 layout + a JSON emitter for CI/tooling/future LSP. Surfaced via `--emit-report` / `--report=json` (final flag name fixed at RD authoring)** | ✅ Resolved |
| 83 | Process | Default visibility / verbosity | off by default / on by default | **Summary prints on successful build **by default** (core DX promise for constrained targets); a quiet flag suppresses it; JSON is opt-in** | ✅ Resolved |
| 84 | Process | MVP reporter scope | full report now / staged with slices | **Gate (AR-43; 0 frames / 0 ZP) reporter must produce **code size + binary size + platform budgets** + render the table; full SFA/ZP/stack columns come online with slice 2. The `ResourceReport` **shape** is defined fully now; columns populate as stages come online** | ✅ Resolved |
| 85 | Architecture | Where recorded / warning wiring | new RD / fold into RD-11 | **Folds into **RD-11** (already "Diagnostics & resource reporting") — no new RD. Budget **warnings** `W10180`/`W10030`/`W10033` flow through the same AR-75 central severity-policy layer as all other diagnostics** | ✅ Resolved |
| 86 | Architecture | VIC-20 as an additional target platform | add now / defer to last / reject | **Accepted as the 6th and **final** target, sequenced after all others (`c64 → c64u → cx16 → a7800 → a800xl → vic20`). Rides the c64 toolchain (6502 codegen, PETSCII, `.prg`+load-address header, VICE `xvic`); zero core-language impact — purely a profile + appendix (Guard F2). Logged now; spec §2 row + `appendix-vic20.md` + profile variants are deferred to the final platform phase** | ✅ Resolved |
| 87 | Algorithm | Frame-coloring algorithm (Ch 11 §3.4 says "compiler computes from the static call graph" but gives none) | leave latitude / delegate to RD / design now | **Delegated to RD-05.** Soundness is guaranteed by the **complete static call graph** (FN-12: functions are not values, no indirect calls; recursion forbidden). The Ch 11 "30–60% saving" is **illustrative, not contractual**. Baseline approach: interference-graph coloring over call-graph-derived frame lifetimes. Algorithm specified in RD-05, not the spec (Guard C2/F2) | ✅ Resolved |
| 88 | Algorithm | Interrupt-handler frames vs frame coloring (handlers fire asynchronously, breaking non-overlapping-lifetime assumption) | coalesce / treat always-live | **Interrupt-handler frames are modeled as **always-live**: they never coalesce with main-path frames, and use a **separate ZP/temp pool** (Ch 11 §4.1). Conservative by construction — preserves soundness. Owned by RD-05** | ✅ Resolved |
| 89 | Architecture | FN-A9 raw-vector escape (address poked into a hardware vector, called at runtime) | analyze / declare out-of-scope | **Explicitly **outside** the compiler's static analysis, matching Ch 06 FN-A9. The compiler makes **no liveness/reachability guarantee** about a function reached only via a poked vector; the developer owns correctness. A documented limitation, not undefined behavior. The call graph remains total for all language-level calls** | ✅ Resolved |
| 90 | Algorithm | Zero-page allocation + sharing algorithm (Ch 11 §4.2 lists priority order, not the algorithm) | leave latitude / delegate to RD | **Delegated to RD-05.** The Ch 11 §4.2 priority order (user `zeropage` → struct/array pointers → expression temps → IRQ temps) is the **contract**; ZP-pointer sharing reuses the AR-87 frame-coloring lifetime result. Budget overflow → `E10032` (Ch 11 §4.4)** | ✅ Resolved |
| 91 | Algorithm | Module initialization order (Ch 10 "dependency-ordered initialization") | unspecified / topo-sort | **Topological sort over the import/dependency graph; circular dependencies rejected at compile time (already in Ch 10 semantics). Standard, owned by RD-04** | ✅ Resolved |
| 92 | Algorithm | Frame-region peak (worst-case simultaneous usage, Ch 11 §3.5) | separate algorithm / derived | **Derived artifact of the AR-87 coloring result (the peak is the coloring's max simultaneous live-frame footprint); not a separate algorithm. Feeds the build-summary `ResourceReport` (AR-79/RD-11)** | ✅ Resolved |
| 93 | Future | FUT-003 (typed function pointers) impact on frame coloring | ignore until then / design escape-set now | **Insurance recorded now:** when FUT-003 lands it **introduces call-graph incompleteness**. RD-05's coloring must therefore be authored to accept an **"escape set"** of address-taken / indirectly-reachable functions that are **pinned** (never coalesced). Costs nothing now; prevents a coloring rewrite later. v3 escape set is empty (FN-12) | ✅ Resolved |

---








## Resolution Notes


**AR-1:** Compiler written in **TypeScript**. Rationale: v2 was TS and worked; author does not know Rust; Blend65 targets small 8-bit games, not large apps, so TS runtime performance is more than adequate. The compiler is not performance-critical for the target workload.

**AR-2:** User weighted **prototyping speed and personal fluency** over raw long-term performance. Consistent with AR-1.

**AR-3:** Ships as a **Node CLI** invoked as `blendc`. Native-binary packaging is not a goal for now.

**AR-4..AR-12 (toolchain):** Yarn classic (v1); monorepo; Turborepo (`turbo`); `tsc` for building; Vite as bundler (both for VS Code webview UI and for bundling the CLI distributable, available repo-wide, decided per-package); Vitest for unit testing; Node v22 (pinned LTS); GitHub Actions CI; ESLint + Prettier.

**AR-13:** Blend65 project config file is **`blend65.json`** in **JSONC** (comments allowed, like real tsconfig). Holds options such as optimization flags, target platform, paths.

**AR-14:** VS Code extension v1 is a **full LSP**: syntax highlighting + diagnostics + completion + hover + go-to-def. It is a subproject in the same monorepo. Non-negotiable.

**AR-15:** The compiler front-end (lexer/parser/semantic/SFA) is **library-first and error-tolerant** — callable on in-memory, partially-valid source, returning a partial AST + diagnostics rather than throwing. It is the single source of truth shared by both the CLI compiler and the language server. Cross-cutting requirement on RD-02/03/04.

**AR-16:** CLI argument parsing uses **yargs**.

**AR-17:** **Conditional color output.** CLI invocation → colorful output via **chalk**, on by default. Programmatic/library invocation → **no color** (meaningless in code). Auto-detect via `process.stdout.isTTY`; honor `NO_COLOR` env var and `--no-color` flag. Opt-out on CLI; off-by-default via API.

**AR-18:** A **platform profile is a platform plugin** = data (zero-page range, RAM map, char encoding, binary format, cycle timing, CPU variant) **plus behavior** (codegen-strategy hooks the core compiler calls at defined extension points): e.g. emit program header/load address, emit startup stub (C64 BASIC stub vs none), wrap binary in container format (7800 cartridge), char-encode string literals, select output binary format. Platform-specific logic must NOT be hardcoded in core codegen (upholds spec rule P3 at the compiler level). Significantly expands RD-10. Affects RD-07 (codegen calls hooks), RD-09 (emitter asks platform for binary format), RD-04 (string encoding).

**AR-19:** Repo layout:
- **`/spec`** — the language specification (renamed from `language-specification-v3/`); normative, immutable reference (`spec-v3.0`).
- **`/docs`** — reserved for the `make_techdocs` VitePress site (compiler architecture docs).
- **`/plans`** — plans AND requirements live here; **committed to git** (user chose safety + `exec_plan` crash recovery over ephemeral local-only).
- **`/packages`** — the monorepo packages.
- Distinction: `/spec` = "what the language IS"; `/docs` = "how the compiler is BUILT".

**AR-20:** Monorepo uses a **moderate 9-package layout** with a front-end/back-end split (the most important boundary — the language server depends only on the front-end, never on codegen/ACME):

```
packages/
├── @blend65/core            → shared types, diagnostics engine, Instr model, span utils
├── @blend65/frontend        → lexer, parser, AST, semantic analysis, SFA planner
│                              (error-tolerant, library-first; feeds back-end AND LSP)
├── @blend65/codegen         → IL, IL optimizer, 6502 codegen, peephole, ACME emitter
├── @blend65/platforms       → platform plugins (data + codegen hooks): c64, cx16, a800xl, a7800, c64u
├── @blend65/config          → blend65.json loading + validation (JSONC)
├── @blend65/compiler        → thin façade wiring frontend+codegen+platforms+config into the public programmatic API
├── @blend65/cli             → blendc command (yargs + chalk), wraps @blend65/compiler
├── @blend65/language-server → LSP server; depends on @blend65/frontend (+core)
└── @blend65/vscode          → VS Code extension client; bundles language-server
```

**AR-21:** Packages are published/named under the **`@blend65/...`** npm scope (user owns the scope).

---

### Testing Harness (RD-12) — AR-22..AR-27

**AR-22:** **Three-tier test taxonomy**, explicit about what runs where:
- **Unit tests** (Vitest, fast, no emulator): lexer, parser, semantic, SFA, IL.
- **Golden / snapshot tests** (no emulator): assert the structured `Instr` list AND
  the emitted ACME `.asm` text against committed golden files. Deterministic; catch
  codegen regressions without an emulator. Satisfies spec rule C4.
- **Emulator runtime tests** (emulator required): compile a `.blend`, run it in VICE,
  assert on memory/registers. The v2-style harness. Satisfies spec rule C5.

**AR-23:** An **`EmulatorDriver` abstraction** with a defined interface (`launch`,
`loadProgram`, `runUntil*`, `readRegisters`, `readMemory`, `screenshot`, `reset`,
`quit`). The **first/MVP implementation is VICE `x64sc` driven via the binary monitor
protocol** (TCP socket: `-binarymonitor`), chosen over fragile text `moncommands`
screen-scraping for robust, programmatic register/memory access. Other platforms'
emulators (x16emu, Altirra, Stella/a7800) become future drivers behind the same
interface — mirrors AR-18's platform-plugin philosophy. VICE is Commodore-only.

**AR-24:** A dedicated **`@blend65/test-harness`** package (10th package, not in the
original 9). It is a **published package with a supported public API** — NOT a
dev-only internal helper — because it is **exposed to game developers** for testing
their own programs. Consequences: it needs a stable documented API, semver, its own
README/examples, and must NOT depend on compiler internals. It operates on **any
`.prg`/`.bin` + a platform profile**, independent of how the binary was produced (a
game dev may point it at a hand-assembled binary). Supports **both headless**
(`SDL_VIDEODRIVER=dummy`) **and GUI** launch modes via a single `{ headless }` flag.
The emulator tier auto-skips with a clear message when `x64sc` is not found locally,
so unit + golden tiers always run.

**AR-25:** **Assertion surface:** memory and CPU registers are the **deterministic
truth**. Screenshots are saved as **failure diagnostic artifacts**, NOT golden-compared
by default (pixel diffs are flaky/slow). Screenshot golden comparison may be opt-in
later but is not the default contract.

**AR-26:** **Run-synchronization strategies** (games never terminate, so a single
"wait for finish" model is wrong). All built on the VICE binary monitor; **each takes a
mandatory cycle/frame timeout guard so a test can never hang**:
- **`runUntilLabel(symbol)`** — break at a known label/PC and run until hit. **Default
  / backbone.** Enabled because our ACME output carries a symbol table, so a test can
  break at any function/label by name. Most robust, fully deterministic.
- **`runFrames(n)`** — advance exactly N frames, then pause and sample. Natural model
  for **games** ("run 3 frames, screenshot, check sprite registers").
- **`runUntilMemory(addr, value)`** — poll a sentinel address until it equals a value;
  convenience for test programs that signal "assertion point reached" by poking a byte.

**AR-27:** **CI policy:** emulator tier is **local-only for now**; unit + golden tiers
run in GitHub Actions. When a **self-hosted build server** exists, a **headless VICE**
emulator-tier job is added there (with ROM files provisioned). User explicitly deferred
CI emulator runs until that build server is available.

---

### Intrinsics & Platform Package (RD-17 / RD-10) — AR-28..AR-36

These resolve the v2 pain points the user raised: (1) intrinsics were stub functions
whose body the compiler decided ad-hoc; (2) they could not be self-hosted in blend
because only a subset of opcodes was mapped; (3) DX demanded core intrinsics be
ambient while platform ones are imported; (4) some platform helpers need hand-written
assembly that is "not really intrinsic but not writable in blend either." The model
below bounds all four so v2's sprawl and special-casing do not recur. Stays inside the
frozen `spec-v3.0` (consistent with Ch 12, Ch 15, F012/REJ-002, CC-A7, FUT-011).

**AR-28:** **Four-tier intrinsic taxonomy.** Every builtin-like function is classified
into exactly one tier, each with a defined "where the body lives":
- **T1 Opcode** (e.g. `asm_sei`, `asm_nop`; `asm_wai`/`asm_stp` on 65C02) → core
  codegen, exactly one opcode, CPU-conditioned, ambient.
- **T2 Inline / compile-time** (e.g. `peek`/`poke`/`peekw`/`pokew`/`lo`/`hi`/`sizeof`/
  `offsetof`/`length`) → core codegen emits a small inline `Instr` pattern, or the
  value is folded at compile time; universal, ambient.
- **T3 Runtime-routine** (e.g. software `*`/`/`/`%` and future helpers) → precompiled,
  tested `.asm` runtime shipped in **core**, lowered as `JSR <symbol>`; universal,
  ambient; dead-stripped when unreferenced.
- **T4 Platform** (e.g. `petscii`/`screen_codes`, VIC helpers, "crazy asm" helpers) →
  precompiled `.asm` runtime shipped in the **platform package**, lowered as
  `JSR <symbol>` or via a platform codegen hook; platform-conditioned; **explicit
  import** (`import { … } from <platform>.<lib>`).

> *Amended 2026-07-02 (RD-17 preflight):* `asm_stp` is dropped from the T1 examples —
> it has no frozen-spec basis (**AR-99**); the T4 import form `<platform>.<lib>` is not
> expressible in the frozen import grammar and is corrected to a single platform
> pseudo-module, `import { … } from c64;` (**AR-97**).

**AR-29:** **Intrinsic descriptor registry.** Each intrinsic is a typed descriptor:
name, signature (params + return), tier, availability predicate, lowering strategy,
cost metadata (cycles / bytes / ZP), and clobber list. The frontend type-checks calls
against the registry (identically for core and platform intrinsics); codegen dispatches
on the tier. **Platform packages contribute their own registry entries** — this is the
core of RD-10's plugin contract (extends AR-18). The compiler never special-cases an
individual intrinsic name; it consults the registry.

**AR-30:** **Body strategy = hybrid; never blend source.** T1/T2 bodies are emitted by
TS as inline `Instr` patterns / compile-time folds. T3/T4 bodies are **hand-written,
tested, versioned `.asm` runtime modules**, authored by compiler/platform-package
authors, exposed to the language only through their typed descriptor. Codegen emits
`JSR <symbol>`; the ACME emitter includes referenced runtime modules; the linker
dead-strips unreferenced ones (important on the 4 KB 7800). Closes Issue 1 & Issue 2:
intrinsics are not blend functions and are not self-hosted.

**AR-31:** **Auto-import boundary + reserved names.** Core intrinsics (T1–T3) are
**ambient** (no import, like `peek`); platform intrinsics (T4) require an **explicit
import**. All intrinsic names are **reserved** — a user-defined function that shadows
`peek`/`asm_sei`/etc. is a **compile-time error**. Resolves Issue 3 with predictable DX.

**AR-32:** **CPU/platform conditioning.** Availability is a predicate keyed on the
profile's `cpu` / platform. Calling an intrinsic unavailable on the active target (e.g.
`asm_wai` on an NMOS 6502) is a **compile-time error** with a dedicated error code
(exact code number assigned when RD-17 is authored). Upholds spec rules P1/H5/L7.

**AR-33:** **Runtime-routine calling convention (ABI), compiler-marshalled.** A stable
ABI decoupled from SFA so asm authors never see SFA frame addresses; the compiler
marshals SFA → ABI at each call site:
- **Parameters:** up to **3 scalar bytes in registers** (A, X, Y; a 16-bit value as
  A = low, X = high). Anything larger or more numerous goes through a reserved ZP
  **argument block**. **Pointers** (for arrays/structs) are passed as a **2-byte ZP
  pair** so the routine can use indirect-indexed addressing `(__argN),Y`.
- **Return value:** byte in **A**; word in **A (low) / X (high)**; void = nothing.
  Declared per routine in the descriptor.
- **Clobber:** declared per routine in the descriptor, allowing the compiler to beat
  the blanket "clobber-all" model (CC-3) for these calls.
The descriptor *is* the contract; the asm author codes against the ABI, not against
SFA. Directly answers the user's "where do parameters come from?" concern.

**AR-34:** **ZP argument-block sizing = profile-declared with a core-guaranteed
minimum.** The platform profile declares the ZP arg-block size (so the 7800's tiny ZP
is respected), but the **core ABI guarantees a minimum** that every routine author can
rely on. The exact floor (e.g. ≥ 4 ZP arg bytes) is fixed when RD-17 is authored.

**AR-35:** **"Crazy asm" surface is platform-author-internal in v3.** The **only**
sanctioned way to add hand-written assembly is a **registered T3/T4 runtime routine**
with a typed signature, documented cost, and declared ABI/clobber. **No inline asm, no
untyped escape hatch.** End users consume the resulting typed intrinsic via `import`.
Bounds Issue 4 — the exact place v2 sprawled.

**AR-36:** **End-user `extern function` deferred to FUT-011.** Exposing a raw
hand-written-asm linkage to game developers is rejected for v3 because authoring it
correctly requires understanding the ABI, clobber lists, the ZP arg-block, and the
non-reentrancy rules — reasonable for the small expert group of platform-package
authors, unreasonable for game developers. When `extern` eventually lands it reuses the
**same ABI** defined in AR-33/AR-34, so v3 builds the foundation without exposing the
footgun now.

---

### Compiler Infrastructure & Build Methodology (RD-01..RD-04, RD-14..RD-16) — AR-37..AR-42

These resolve two v2 wounds the user raised: (Item 1) the compiler must consume many
`.blend` files, resolve all imports + intrinsics, and behave as a whole-program host —
and that host shapes the LSP; (Item 2) v2 built the lexer/parser "to 100%" before any
downstream stage existed, so later refinements rippled destructively through everything.

**AR-37:** **First target platform & ordering.** The platform roadmap is
`c64 → c64u → cx16 → a7800 → a800xl`. **C64 is the MVP target**: it pins RD-10's first
profile, the first emulator driver (VICE `x64sc`, AR-23), and the first output format
(PRG, per appendix-c64 §5). c64u is deliberately second because it is a C64 superset
(reuses most of the c64 plugin); the Atari targets are last because they introduce a
different I/O architecture and (7800) the tightest constraints. **Amended by AR-86:**
the canonical order now ends with a sixth target — `vic20` — added after all five
above (final order: `c64 → c64u → cx16 → a7800 → a800xl → vic20`).

**AR-38:** **Build methodology = vertical walking skeleton, not horizontal layers.**
The v2 mistake was completing the lexer + parser before any consumer existed; "done"
was unverifiable in isolation, so AST/semantic refinements rippled downstream. v3
instead takes one tiny program all the way to a running `.prg`, then widens the language
surface one slice at a time. Crucial distinction that makes this safe: the **token set
and grammar are frozen and low-churn**, so they are transcribed **fully up front**
(cheap, mechanical); the **churn-prone AST node model + semantic layer are grown per
slice** behind an **extensible, visitor-friendly AST contract** in `@blend65/core`, so
adding a node is *additive* (add node + handle in each visitor), never a breaking
reshape. Affects the implementation order inside RD-02/03/04 and the Phase-A plan.

**AR-39:** **File-set discovery = both (option c).** `blendc` decides which `.blend`
files constitute the program as follows: an explicit CLI file list overrides everything;
otherwise the `include` globs in `blend65.json` are used; otherwise the default is
`**/*.blend` from the project root. Because imports are by **module name** (Ch 10 §2.1)
and filenames carry no semantic meaning (Ch 10 §6.1), the compiler cannot "follow an
import to a file" — it must discover the whole file set first, then resolve names. This
is the whole-program model Ch 10 §6.2 already mandates. Feeds RD-16 (config schema:
`include`) and RD-15 (CLI arg handling).

**AR-40:** **Source-input abstraction = a single `CompilerHost` interface.** Modeled on
TS's `CompilerHost`/`ts.System`: it exposes "list candidate source files" + "read file
contents" (plus path normalization). The **CLI** provides a disk-backed implementation;
the **LSP** provides an open-buffer overlay (unsaved editor documents) with disk
fallback. The shared `@blend65/frontend` consumes **only** this interface — never `fs`
directly — which is what makes the front-end reusable across CLI and LSP (upholds
AR-15). This is the central CLI ⇄ LSP boundary. Feeds RD-04 and RD-14.

**AR-41:** **LSP recompilation model (MVP) = full whole-program reparse, debounced.**
On any document change the language server re-runs the whole-program pipeline through
the error-tolerant front-end, **debounced ~150–250 ms**. Incremental parsing / AST
caching is **deferred** — C64-scale projects reparse in milliseconds, so the complexity
is not justified for the MVP. The `CompilerHost` overlay (AR-40) supplies the in-memory
buffers. Revisitable later without changing the front-end contract. Feeds RD-14.

**AR-42:** **Name-resolution architecture = one unified resolver.** A single resolver
pass resolves **imports and intrinsics together** against the global symbol table built
in Pass 1 (Ch 10 §6.2): Pass 1 lexes/parses all files and **merges same-named modules**;
the resolver then binds every identifier to either a module-exported declaration, a
qualified `Module.name` access, a core-ambient intrinsic (T1–T3, AR-31), or an imported
platform intrinsic (T4) — emitting reserved-name / unresolved / not-exported diagnostics
uniformly. **Circular imports are allowed** (Ch 10 §4.3) because resolution runs after
all declarations are collected. Intrinsic names are reserved (AR-31). Feeds RD-04 and
RD-17.

---

### MVP Vertical Slice (RD-01 / RD-12) — AR-43..AR-44

These pin the concrete first end-to-end target of the AR-38 walking skeleton: the
smallest program that proves the full pipeline (Lexer → Parser → AST → Sema → codegen →
`Instr` list → ACME emit → ACME assembles → `.prg` → VICE assertion) and the order in
which the Blend65-specific backend machinery comes online.

**AR-43:** **MVP gate = Option A (`poke` a constant); Option B = mandatory next slice.**
The gate program is:

```blend65
module Main;

function main(): void {
    poke(0xD020, 5);   // VIC-II border color register (literal lives in the test, not core spec)
}
```

The gate's job is to light up **every pipeline stage exactly once** with the thinnest
possible path — **no locals, no parameters, no arithmetic, no control flow** — so it
deliberately requires **neither the SFA frame planner nor the ZP allocator**. That
Blend65-specific machinery gets its **own** dedicated slice rather than being smuggled
into the plumbing proof. **Phase-A slice 2 is Option B**, which adds a local `byte` and
thereby *forces* the SFA frame planner + ZP allocator online — so SFA is "never
skippable," merely the very next green light:

```blend65
function main(): void {
    let c: byte = 5;
    poke(0xD020, c);
}
```

Option C (for-loop memory fill) and Option D (hello-world string) remain later Phase-A
slices, not gate candidates. Intrinsic signature is `poke(word, byte)` (Ch 12). The
`0xD020` literal lives in the **test program**, not core codegen, so spec rule P3 (no
platform addresses in the core) is upheld. Confirms the slice ordering under AR-38;
feeds RD-01 (MVP scope) and the Phase-A plan.

**AR-44:** **MVP `main` termination = terminating `main`.** `main(): void` falling
through to the end of its body hits the C64 startup shim's **documented return path**
(appendix-c64 §5.2: restore BASIC via `$37`→`$01`, then `RTS` to BASIC) — a
deterministic, fully-defined clean exit. This gives the VICE driver a crisp assertion
strategy: **run until control returns to BASIC** (or, simpler for v1, run a fixed cycle
budget), then read the target memory location ($D020). The **non-terminating `main`**
path (`while (true) { … }`) is **supported by the language** but **tested in a later
slice** via a timed-snapshot assertion (run N cycles → snapshot memory), keeping the MVP
harness simple. Feeds RD-01 and RD-12 (test harness).

---

### IL Design (RD-06 / RD-07) — AR-45..AR-52

These pin the shape of the **target-independent Intermediate Language** that sits
between the SFA frame planner and 6502 codegen, and its interface to the lower
structured `Instr` model. The pipeline already mandates *two* lowering levels (IL +
`Instr`), so this thread defines what IL *is*. A central input was a direct **v2
lessons-learned data point**: v2 used **SSA** and it "ended up very badly" — the
φ-node insertion, dominance-frontier machinery, and out-of-SSA destruction cost far
outweighed the benefit on a 3-register 8-bit target, where the cost/benefit that
justifies SSA on register-rich machines inverts.

**AR-45:** **IL shape = flat three-address code (TAC); SSA explicitly rejected.** IL is
a linear list of three-address operations (`t2 = t0 + t1`) over **mutable** typed
virtual temporaries.
- *Alternatives considered:* **SSA** — rejected on v2 evidence (above): φ/dominance/
  out-of-SSA complexity with little payoff on 6502. **Tree/expression IL** — harder to
  run linear optimization passes over; doesn't match the 6502 load/op/store rhythm.
  **Stack/bytecode IL** — re-introduces a VM abstraction codegen would just unwind;
  poor cost transparency (spec rule H2).
- *Why flat TAC:* simplest form that still supports the passes we actually want
  (constant folding, DCE, strength reduction — spec rule F3) **without** φ-nodes or
  dominance analysis; maps cleanly to 6502; aligns with AR-2 (prototyping speed &
  author fluency). Value-numbering-style wins that *would* want SSA are done locally
  per basic block — sufficient for C64-scale programs. Feeds RD-06.

**AR-46:** **IL is explicitly typed (width + signedness on every temp and op).** Each
temp and operation carries `{ width: 8 | 16, signed: bool }` plus a `boolean` marker.
The Ch 02 type-mixing/promotion rules are **materialized in IL** as explicit `zext` /
`sext` / `trunc` operations, so codegen never re-derives types. This is what lets
codegen pick single-byte `ADC` vs a multi-byte chain, logical-vs-arithmetic `>>`
(TS-19), and unsigned-carry vs signed-N⊕V comparisons (Ch 04 §5) purely from the IL.
Feeds RD-06 and RD-07.

**AR-47:** **Virtual temps in IL; A/X/Y + ZP-scratch binding deferred to codegen.** IL
uses unlimited virtual typed temps; the mapping to the A/X/Y registers and ZP scratch
happens during IL→`Instr` lowering, not in IL. Named variables already have SFA frame
slots assigned **before** IL (the planner runs first), so only anonymous temps remain
to bind. This keeps IL allocation-agnostic and matches the walking skeleton: the gate
program (AR-43) lowers to IL with **zero** temps and needs no ZP allocator; slice 2
(local `byte`, AR-43) is what first brings temp/ZP binding online. Feeds RD-06 and RD-07.

**AR-48:** **Control flow = basic-block CFG with explicit branch ops.** Structured
control flow (`if`/`while`/`do`/`for`/`switch`) lowers to a control-flow graph of basic
blocks joined by explicit `br` / `brcond` / `jmp` + labels. Because IL is **non-SSA**,
block boundaries carry **no φ-nodes** — values flow through temps/memory plainly (the
whole point of dropping SSA). The CFG is the substrate for dead-code elimination and
the unreachable/always-false diagnostics (W10130 / W10131) and for the two for-loop
codegen patterns (compare-branch vs `INX`/`BNE`-wrap, Ch 05 §7.7). Designed now,
implemented per slice: the gate is a single block; the for-loop fill slice lights up
the branch ops. Feeds RD-06 and RD-07.

**AR-49:** **Intrinsics in IL = fold queries · memory-ops for peek/poke · calls for the
rest**, consistent with the AR-28 tiers:
- **Compile-time queries** (`sizeof` / `offsetof` / `length`, constant `lo` / `hi`) are
  **folded to constants before IL** — they never appear as IL nodes.
- **`peek` / `poke` / `peekw` / `pokew`** (T2) lower to **generic IL `load` / `store`
  ops**, so the optimizer sees real memory traffic. This makes the gate's `poke` a
  first-class IL `store` — the simplest possible first implementation.
- **T1 opcode / T3 core-runtime / T4 platform** intrinsics lower to IL **`call` nodes**
  carrying the AR-29 descriptor reference, dispatched on tier at codegen.
Feeds RD-06, RD-07, and RD-17.

**AR-50:** **Two lowering levels only (IL + `Instr`), no third tier.** IL =
target-independent typed CFG/TAC; `Instr` = structured 6502 (mnemonic + addressing
mode + operand). There is **no** intermediate "ASM-IL" — that was the v2 trap already
flagged in the glossary. Two levels give a clean optimization seam (Optimizer 1 on IL,
peephole on `Instr`) without re-introducing a spec'd assembly language. Feeds RD-06,
RD-07, RD-08.

**AR-51:** **IL has a deterministic textual form for golden tests (`--emit-il`).** The
in-memory IL structure is the source of truth, but IL also gets a stable pretty-printed
text form that is golden-snapshot asserted (AR-22 lists IL as a tested stage; satisfies
spec rule C4) and exposed via a `--emit-il` flag for debugging. This gives the walking
skeleton a cheap per-slice regression check at the IL stage before codegen exists.
Feeds RD-06 and RD-12.

**AR-52:** **IL operand model = constant | virtual-temp | symbolic location.** Every IL
operand is exactly one of: an immediate constant, a virtual temp, or a **symbolic**
memory location (SFA frame slot / module variable / ZP variable / `&`-address). Address
binding stays **symbolic** through both IL and `Instr`; ACME resolves the actual
addresses via labels. This keeps IL portable, upholds spec rule P3 at the IL level (no
hard addresses in core IL), and lets the ACME emitter — and the symbol table the test
harness relies on for `runUntilLabel` (AR-26) — work in terms of names, not addresses.
Feeds RD-06, RD-07, and RD-09.

---

### Structured `Instr` Model (RD-07 / RD-08 / RD-09) — AR-53..AR-60

These pin the lower of the two lowering levels (AR-50): the structured, in-memory
representation of 6502 machine code that codegen *produces*, the peephole optimizer
*rewrites*, and the ACME emitter *serializes*. Where IL is target-independent typed
TAC/CFG, `Instr` is the concrete 6502 layer — but it is **not** a separately-spec'd
assembly language (the v2 "ASM-IL" trap). This thread fixes exactly what one `Instr`
*is* so RD-07, RD-08, and RD-09 share one contract. Diagnostics remain the shared
`@blend65/core` engine (AR-20) reporting into one collector at this stage too — INSTR-F
(AR-58) is this stage's contribution to that cross-cutting guarantee.

**AR-53:** **`Instr` granularity = one real 6502 machine instruction.** Each `Instr` is
a single real opcode (`LDA #5`), never a macro or pseudo-sequence; multi-byte operations
(e.g. a 16-bit add) are emitted as *several* `Instr`s by codegen, not one fat node. The
only non-opcode stream entries permitted are labels/directives (AR-55), kept as distinct
variants. Macro-instructions / pseudo-ops are **rejected** — they would re-introduce the
"ASM-IL" abstraction the peephole would just unwind, violating the two-levels-only rule
(AR-50) and hurting cost transparency (H2). Feeds RD-07, RD-08, RD-09.

**AR-54:** **`Instr` shape = typed discriminated record `{ mnemonic, addressingMode,
operand, sourceSpan? }`.** `mnemonic` is a typed opcode enum (not a free string);
`addressingMode` is an enum (Implied, Accumulator, Immediate, ZeroPage, ZeroPageX,
ZeroPageY, Absolute, AbsoluteX, AbsoluteY, Indirect, IndexedIndirect `(zp,X)`,
IndirectIndexed `(zp),Y`, Relative). This is the standard table-driven 6502 model;
free-form string mnemonics (rejected — stringly-typed peephole matching) and per-opcode
subclasses (rejected — ~56 classes, needless) were considered. The originating IL/AST
span is carried for diagnostics + golden-snapshot readability. Feeds RD-07, RD-08, RD-09.

**AR-55:** **Labels/directives are first-class inline stream entries.** The stream is a
single discriminated union `Array<Instr | Label | Directive>`: `Label` carries a
symbolic name; `Directive` covers the ACME pseudo-ops the emitter needs (`* = $0801`,
`!byte`, `!word`, segment/data markers). Keeping them *inline* (rather than a side-table
keyed by index) preserves the ordered code/label/data relationship and **survives
peephole insert/delete without index drift**. This inline stream feeds the symbol table
the test harness relies on for `runUntilLabel` (AR-26/AR-52). Feeds RD-07, RD-08, RD-09.

**AR-56:** **`Instr` operand model = symbolic, never resolved addresses.** An `Operand`
is exactly one of: `Immediate(constant)` | `SymbolRef(name, offset?)` | `LabelRef(name)`
| `ZeroPageSlot(symbol)` | `None` (implied). Concrete `$xxxx` addresses are **never**
baked into an `Instr` — ACME resolves every symbol via labels at assemble time. Upholds
P3 at the `Instr` level (no hard platform addresses in core codegen) and keeps `Instr`
portable across platforms with different memory maps. The `offset?` on `SymbolRef`
handles struct-field / array-element access (`frameSlot+2`). Mirrors AR-52. Feeds RD-07,
RD-09.

**AR-57:** **Hi/lo byte selection = operand modifier, not separate opcodes.**
`SymbolRef`/`LabelRef` carry an optional `byteSelect: low | high | none`, emitted by the
ACME emitter as `<sym` / `>sym`. This carries 16-bit pointer setup (`LDA #<ptr` /
`LDA #>ptr`) and the `lo()`/`hi()` intrinsics (AR-49) into `Instr` without inventing
pseudo-mnemonics. Pre-computing hi/lo as raw constants in codegen was **rejected** — it
only works for already-known addresses, but symbolic refs aren't resolved until assembly,
so the selector must survive to the emitter. Feeds RD-07, RD-09.

**AR-58:** **`Instr` is validated against the active CPU's legal opcode+mode table.**
Each emitted `Instr` is checkable against the target CPU's instruction table (from the
platform profile, AR-18/AR-32); NMOS-6502 codegen never emits 65C02-only modes (zero-page
indirect `(zp)`, `STZ`, `BRA`, etc.). A codegen bug that produces an illegal opcode/mode
is caught by an **internal assertion/diagnostic**, not silently passed to ACME — because
a wrong addressing mode yields a wrong binary with zero diagnostic on real hardware
(upholds H5 / L7). The MVP target (C64 = NMOS 6502) fixes the baseline table. This is
the codegen stage's entry in the shared diagnostics engine. Feeds RD-07, RD-11.

**AR-59:** **`Instr` stream organization = flat per-function stream tagged by segment.**
Codegen lowers the IL CFG (AR-48) into a **linear** `Instr` stream per function (branches
become `Label` + branch `Instr`s); each stream lives in a lightweight container
`{ symbol, segment, instrs[] }` tagged with its target segment (Code / Data /
ZP-reservation). The basic-block structure is *consumed* at this IL→`Instr` boundary
because peephole windows and ACME emission are inherently linear; keeping a nested CFG
down into `Instr` (rejected) would just force re-deriving linearity later. The container
preserves function identity for frame/symbol reporting. Feeds RD-07, RD-08, RD-09, RD-11.

**AR-60:** **`Instr` has one canonical textual form (`--emit-asm`), golden-snapshotted.**
The `Instr` stream has a deterministic pretty-print that **is** the pre-ACME assembly
text — golden-tested per AR-22 and exposed via a `--emit-asm` flag, giving the walking
skeleton a second cheap regression checkpoint (after `--emit-il`, before invoking ACME).
Crucially this is the **same serializer** RD-09 feeds to the assembler — a separate
debug-dump vs emitter output was **rejected** (two serializers drift; AR-51's lesson
applied at this level). Feeds RD-07, RD-09, RD-12.

---

### ACME Integration (RD-09) — AR-61..AR-69

These pin how the structured `Instr` stream (AR-53..AR-60) becomes an assembled
platform binary: the assembler choice, how it is located and invoked, the handoff
artifact, who emits memory layout / startup / output format, how addresses are split
between the compiler and the assembler, the symbol feedback the test harness consumes,
the failure model, and the cross-platform startup-shim optimization. The ACME stage is
also a contributor to the shared `@blend65/core` diagnostics engine (AR-58/AR-68).

**AR-61:** **Assembler = ACME, exclusively — not a swappable backend.** ACME has been
the assumed assembler across every prior RD; this ratifies it as *the* assembler, not
one of several pluggable backends. We will **not** add second/third-party assembler
support (ca65/ld65, 64tass, KickAssembler were considered). If ACME ever proves
insufficient, the sanctioned path forward is a **purpose-built Blend65 assembler**, not
adopting another third-party tool. This lets RD-09 target ACME's exact syntax and its
PRG/`cbm` writer directly with **zero abstraction tax**. Feeds RD-09.

**AR-62:** **ACME discovery = explicit → PATH → hard error.** The compiler locates the
ACME executable in a fixed priority order: (1) an explicit path — a CLI flag
(`--acme-path`) overrides everything, else the `acmePath` key in `blend65.json`;
(2) probe the system `PATH` for the `acme` executable; (3) if neither yields a runnable
ACME, the build **stops** with a dedicated `E1xxxx` diagnostic (how to install ACME /
set `acmePath`) — **no silent fallback, no partial output**. Note: golden-snapshot tests
assert the `.asm` *text* (AR-60), which the compiler controls deterministically; they do
**not** depend on the assembled bytes, so a user-supplied/PATH ACME version does not
threaten golden reproducibility. The emulator tier — the only place ACME's version
matters — is already local/self-hosted-only (AR-27). Feeds RD-09, RD-15, RD-16.

**AR-63:** **`Instr`→ACME handoff = the single AR-60 serializer writes one `.asm`;
ACME assembles that exact file.** No stdin piping, no second serializer. Consequently
`--emit-asm` output and the real build input are **byte-identical** (no drift, AR-51's
lesson), and a failed build leaves the `.asm` on disk for inspection. Feeds RD-09.

**AR-64:** **Memory layout + startup emitted by the platform plugin as ACME
`Directive`s.** The platform plugin (AR-18) emits the prologue as `Directive` stream
entries (AR-55): origin (`* = $0801`), the `10 SYS 2061` BASIC stub, and the startup
shim (bank-out BASIC, zero BSS, copy DATA inits, `JSR main`, restore-BASIC + `RTS` —
appendix-c64 §5.2). Core codegen stays platform-agnostic (**P3**); every C64 address /
byte lives in the `c64` plugin. Segment order: stub → startup → code → const-data →
mutable/BSS (appendix-c64 §2.3). **Stub style:** directive form (`!word` / `!byte` /
`!text`) with the **fixed literal `"2061"`** — the stub layout is pinned so `__start`
always lands at `$080D` = 2061, and ACME can't easily stringify a label into ASCII
digits inside `!text`, so the known constant is emitted directly. The first concrete
rendering of the AR-69 contract. Feeds RD-09, RD-10.

**AR-65:** **Output format chosen by the platform plugin via ACME's native writer.** The
`c64` plugin emits `!to "<name>.prg", cbm` so ACME writes the little-endian `$01 $08`
load-address header itself (appendix-c64 §5.1) — core never hand-rolls a PRG header.
Other platforms select `plain`/binary (Atari XEX segments, 7800 A78 cartridge) or apply
a container post-step through the same plugin hook. Feeds RD-09, RD-10.

**AR-66:** **Address realization split: compiler assigns ZP/frames, ACME places
code/data labels.** This reconciles "symbolic through `Instr`" (AR-52/AR-56) with the
fact that ZP packing is an SFA decision: the **SFA allocator owns the exact `$02–$8F`
ZP / frame-slot addresses**, materialized as ACME symbol definitions (`__zp_c = $02`) at
the top of the file — operands stay symbolic (`LDA __zp_c`), and ACME merely substitutes.
**Code/data labels** (function entry points, data blocks) are **placed by ACME** as it
lays out from `* = $0801`; their final addresses are read back via the label file
(AR-67). Feeds RD-05, RD-09.

**AR-67:** **Symbol feedback = ACME emits a VICE label file.** ACME is invoked with VICE
label output (`al C:xxxx .label` lines); the build captures it as a symbol→address map,
a **first-class build artifact** beside `.prg` and `.asm`. This powers the test-harness
`runUntilLabel` / `runUntilMemory`-by-name (AR-26) and the resource/build-summary report
(next thread). Feeds RD-09, RD-11, RD-12.

**AR-68:** **ACME-stage failure = internal-compiler-error (validated-first).** Because
every `Instr` is pre-validated against the CPU table (AR-58) and all addresses are
compiler-assigned (AR-66), a correct compiler cannot produce an `.asm` that ACME
rejects. So an ACME error/warning is surfaced as a dedicated `E1xxxx` **ICE** diagnostic
into the shared `@blend65/core` engine — the build fails loudly, retains the `.asm`, and
includes ACME's stderr verbatim. A **user** source error must never first surface at the
ACME stage; if it does, that is by definition a missed-earlier-diagnostic compiler bug
(upholds **H5 / L7**). The ACME stage's entry in the diagnostics cross-cut. Feeds RD-09,
RD-11.

**AR-69:** **Startup-shim variant selection = cross-platform contract.** The startup
shim has **three variants** — *terminating*, *non-terminating fall-through*, *bare* —
and selection is split between core and the plugins so the *decision* is
platform-independent while the *bytes* are platform-specific:
- **Core owns:** a **CFG termination analysis** of `main` (built on AR-48); the
  `startup: auto | terminating | minimal | bare` config key (`blend65.json` / `--startup`);
  and the **conservative default** — `auto` picks the *terminating* variant whenever
  non-termination cannot be proven (never a wrong binary, **H5**). Forcing `minimal`
  when `main` can provably return is a **compile-time error** (**L7/H5**).
- **Each plugin renders** its three concrete variants and declares a **per-platform
  returnable-main policy**, because the same source is fine on one target and suspicious
  on another:
  - `c64` / `c64u` — terminating returns to BASIC (`RTS`); clean exit. (`c64u` inherits
    the `c64` shim verbatim — appendix-c64u §5.)
  - `a800xl` — terminating jumps to **OS warm start `$E474`** (appendix-a800xl §5.2);
    clean exit. XEX RUNAD calls the entry point analogously to `SYS 2061`.
  - `a7800` — **no OS to return to** (appendix-a7800 §5.2): a returnable `main` becomes a
    `JMP *` hang and is **warned** (`W1xxxx`); the plugin's natural default is
    *non-terminating fall-through*.
- **Savings (c64 example):** non-terminating fall-through drops the restore-BASIC tail +
  `jsr`/`rts` (≈8 bytes, ≈18 cycles) versus the 12-byte / 22-cycle terminating shim — a
  one-time launch cost, reported in the build summary (**H2**).
MVP (c64) uses the **terminating** variant so AR-44's VICE "returned to BASIC" assertion
holds. AR-64 is the first concrete rendering. Feeds RD-07, RD-09, RD-10, RD-11.

---

### Diagnostics & Error-Code Wiring (RD-11) — AR-70..AR-78

These pin the **diagnostics engine** that lives in `@blend65/core` and that every
prior thread has been quietly reporting into (AR-32/58/62/68/69 all reference
`E1xxxx`/`W1xxxx` placeholders). Spec Ch 14 already freezes the *catalog* — the
`E10xxx`/`W10xxx` codes, their messages, the caret render format, and the
`--warn-as-error` / `--suppress-warning` / `--max-errors` flags — so this thread defines
the *engine*, not the codes. The driving input was that **AR-14 mandates a full LSP**: a
language server lives or dies on three diagnostics-architecture properties — structured
(not pre-rendered) diagnostics, precise spans, and error recovery (many diagnostics per
run, not just the first) — so deciding them now is what prevents a future front-end
rewrite. The user's explicit concern was avoiding a painful recovery retrofit later; the
resolution isolates **all** retrofit risk into a now-frozen architecture layer.

**AR-70:** **Diagnostic code namespace = partitioned bands.** Ch 14 owns the user-facing
catalog (`E10xxx` errors, `W10xxx` warnings). A **distinct `E9xxxx` band is reserved for
internal-compiler-errors (ICE)**. This resolves the `E1xxxx`/`W1xxxx` placeholders left
in earlier threads: user-triggerable conditions (e.g. AR-32 unavailable-intrinsic, AR-62
missing-ACME-config) map to **Ch-14 `E10xxx`/`W10xxx`** codes; genuine
"compiler-should-never-do-this" conditions (AR-58 illegal-opcode assertion, AR-68
ACME-stage failure) map to the **`E9xxxx` ICE band**. User and ICE codes can therefore
never collide (**L6/H5**). Feeds RD-11.

**AR-71:** **Diagnostic value model = one structured record, never a pre-rendered
string.** Every phase produces the same shape:
`Diagnostic { code, severity, message, primarySpan, secondarySpans[], notes[], help? }`.
No component anywhere emits caret-formatted or colorized text — formatting is a strictly
separate concern (AR-76). This is **the primary LSP-enabler**: the language server
consumes the structured record directly, while the CLI renders it. The whole compiler
reports into this one contract. Feeds RD-11, RD-14.

**AR-72:** **Source-location / span model = interned `SourceId` + byte offsets.**
Internally a span is `{ source: SourceId, start: number, end: number }` (byte offsets);
human line/column — and the **UTF-16 columns the LSP protocol requires** — are computed
on demand by a conversion/`LineMap` layer, never stored in the `Diagnostic`. The model
is multi-file aware (consistent with the whole-program host, AR-39/40). Critically,
**spans must survive lowering**: `Instr.sourceSpan?` (AR-54) carries the originating
source span so that codegen- and resource-stage diagnostics (E10032/33/34, the AR-58
assertion) point back to real source, not to generated assembly. Feeds RD-11, RD-14.

**AR-73:** **Diagnostic accumulation = an accumulating `DiagnosticBag`, never
throw-on-first.** `@blend65/core` provides a `DiagnosticBag` that phases append to;
nothing aborts the whole program on a single error. It guarantees **deterministic
ordering** (sort by source, then start offset, then code), **dedups** identical entries,
and enforces `--max-errors` (default 20, per Ch 14 §4). This is the concrete mechanism
behind AR-15's "library-first, error-tolerant" requirement. Feeds RD-11.

**AR-74:** **Error-recovery commitment = split: architecture stable now, rule-coverage
provisional.** This directly answers the user's "I don't want to come back and do a lot
of refactoring" concern by isolating the retrofit risk:
- **Recovery *architecture* = stable / committed 100% now.** Three non-negotiable pieces
  baked in from day one: (1) accumulate-not-throw (AR-73); (2) **error-sentinel nodes**
  in the AST/IL — `ErrorExpr` / `ErrorType` / `ErrorStmt` — so a malformed construct
  still yields a well-typed node downstream phases can walk; (3) a **mandatory
  poison / cascade-suppression contract** — anything derived from an error node is itself
  poisoned and emits **no** further diagnostics, preventing the classic "1 real error →
  50 garbage errors" cascade. Without (3), statement-level recovery makes UX *worse*, so
  it is not optional.
- **Recovery *rule coverage* = provisional / incremental (F4).** The actual set of parser
  **sync points** ("on error, skip to the next `;` or `}`") and per-phase recovery
  heuristics grows per slice. Because the architecture above already guarantees the
  continue-and-poison contract, **adding sync point #N later is purely additive** — it
  turns one more fatal abort into "one more diagnostic, then continue," touching no
  existing contract and forcing zero downstream refactoring.
- **Determinism is a hard invariant (H5):** same input ⇒ same diagnostic set *and* order,
  every run; locked by golden-snapshot tests (AR-22). The MVP gate slice (AR-43) ships a
  small but real recovery rule set, proving the architecture end-to-end without bloating
  scope. Feeds RD-02, RD-04, RD-11.

**AR-75:** **Severity policy = one central promote/suppress layer.** Promotion
(`--warn-as-error`, `--warn-as-error=Wxxxxx`) and suppression (`--suppress-warning=Wxxxxx`)
are applied in **exactly one place** over the populated `DiagnosticBag` after collection;
the rest of the compiler always emits each diagnostic at its *natural* severity and stays
policy-agnostic. This is the single implementation point for the Ch 14 §4 flags. Feeds
RD-11, RD-15, RD-16.

**AR-76:** **Rendering = multiple renderers over the same `Diagnostic[]`.** Two renderers
in v1, both pure formatters that never re-derive meaning (AR-71): (1) a **terminal
renderer** producing the Ch 14 caret/`-->` format, honoring the AR-17 color rules; and
(2) a machine-readable **JSON emitter** (`--diagnostics-format=json`) for tooling and LSP
consumption. Line/column for rendering comes from the AR-72 conversion layer. Feeds
RD-11, RD-14, RD-15.

**AR-77:** **Compiler invocation surface = library-first, returning structured
diagnostics.** The compiler is callable as a **library** (`@blend65/compiler`) that
returns structured `Diagnostic[]` plus build artifacts; the CLI (`@blend65/cli`) is just
one consumer that renders them via AR-76. This is the load-bearing commitment that keeps
a future LSP possible without a front-end rewrite — it ratifies AR-15 / AR-40 at the
diagnostics boundary. Feeds RD-11, RD-13, RD-14.

**AR-78:** **LSP build posture = "keep-ready, don't build now."** The MVP does **not**
ship a language server. But every decision in this thread (structured `Diagnostic`,
byte-offset spans + on-demand UTF-16 conversion, accumulate-not-throw, the stable
recovery architecture, the JSON emitter, and the library-first API) is deliberately made
**LSP-compatible** so that no rewrite is needed when the LSP lands. A placeholder
**future / experimental** RD for editor tooling is recorded; **AR-14's "full LSP" target
is reaffirmed as the eventual goal, explicitly deferred past the MVP.** Feeds RD-14
(future), RD-11.

---

### Build Summary / Resource Reporting (RD-11) — AR-79..AR-85

These pin **how the compiler computes and emits the build summary** — the RAM / ROM /
ZP / stack usage report. Spec Ch 11 §6 already freezes the *content and format* of that
report (Code / Data / RAM / SFA frames / Zero page / Hardware stack / Startup / Total)
and Ch 11 §8 freezes the *budget diagnostics* (`E10032` ZP, `E10033` RAM, `E10034`
binary-too-large; warnings `W10180` stack, `W10030` large-ZP, `W10033` RAM-nearing) — so
this thread defines the *engine*, not the numbers or codes. It is the **last discovery
thread before the Zero-Ambiguity Gate**, and folds into RD-11 (already titled
"Diagnostics & resource reporting"). Directly serves spec rules **H2** (cost
transparency) and **H4** (memory footprint documented), and consumes the AR-67 label
file.

**AR-79:** **Resource reporter = a dedicated aggregator module in `@blend65/core`.**
A single reporter assembles a typed **`ResourceReport`** value from numbers that each
pipeline stage *contributes*; stages never print or format anything themselves. This
deliberately mirrors the diagnostics model-vs-render split (AR-71 structured value /
AR-76 multi-renderer): one source of truth, formatting kept strictly separate.
Scattered per-stage `console.log`s were **rejected** (no JSON path, untestable,
non-deterministic ordering). Feeds RD-11.

**AR-80:** **Data sources / ownership of each number.** The report is composed, not
guessed:
- The **SFA frame planner** owns the **frame-region size**, **peak-simultaneous frame
  usage** (Ch 11 §3.5), the **ZP allocation** breakdown (user vars / pointers / temps /
  IRQ temps, Ch 11 §4), and the **max call depth** for the stack budget (Ch 11 §5.2).
- **Code / data segment sizes** and the **final binary size** come from the **ACME
  label file + assembled output** (AR-67) — real placed addresses, not estimates.
- The **platform profile** owns every **budget** (available ZP range, RAM size, max
  binary size, stack reserve).
- **Startup size / cycles** come from the platform plugin's chosen shim variant
  (AR-64 / AR-69).
Each contributed number carries its originating span where one exists (AR-72) so budget
diagnostics point back to source. Feeds RD-05, RD-09, RD-10, RD-11.

**AR-81:** **When budget diagnostics fire = split by what is knowable when.** ZP-budget
`E10032` and RAM-budget `E10033` are computable **pre-ACME** straight from the SFA plan
+ profile, so they **fail fast — before the `.asm` is even emitted**. Binary-too-large
`E10034` is only truly known **post-ACME** (final placed size), so it is checked when
the output artifact comes back. This upholds AR-68: a user-triggerable resource overflow
is our *own* `E10xxx` diagnostic, never a raw ACME crash surfacing first. The budget
**warnings** (`W10180` / `W10030` / `W10033`) are emitted at the same points and flow
through the AR-75 central severity layer like any other diagnostic. Feeds RD-05, RD-09,
RD-11.

**AR-82:** **Report rendering = multi-renderer over one `ResourceReport`** (the same
pattern as AR-76). Two renderers in v1: (1) a **terminal table renderer** producing the
Ch 11 §6 layout, and (2) a **JSON emitter** for CI/tooling/future-LSP consumption.
Surfaced via a report flag (working name `--emit-report` / `--report=json`; final flag
name fixed at RD authoring). Renderers never re-derive numbers — they only format the
structured report. Feeds RD-11, RD-15.

**AR-83:** **Default visibility = on for a successful build.** The summary prints **by
default** on a successful build, because memory headroom is a core DX promise on
constrained targets (the whole point of H4). A quiet flag suppresses it; the JSON form
is opt-in. Feeds RD-11, RD-15, RD-16.

**AR-84:** **MVP reporter scope = staged with the slices.** For the AR-43 gate program
(0 frames, 0 ZP) the reporter must already produce **code size + binary size + the
platform budgets** and render the §6 table — proving the report path end-to-end on the
walking skeleton. The full SFA-frames / ZP-detail / stack-depth columns come online with
slice 2 (the local-`byte` slice that brings the SFA planner + ZP allocator up, AR-43).
Crucially the **`ResourceReport` shape is defined in full now**; later slices only
*populate* columns that already exist — no reshape. Feeds RD-01, RD-11.

**AR-85:** **Where recorded = folded into RD-11, no new RD.** Resource reporting lives in
the existing **RD-11 ("Diagnostics & resource reporting")** because it shares the
`@blend65/core` home, the structured-value/multi-renderer architecture, and the central
severity layer (AR-75) with diagnostics. No separate RD is created. This closes the final
discovery thread; with AR-1..AR-85 resolved, the Zero-Ambiguity Gate is ready to pass.
Feeds RD-11.

---

### Preflight Gap Sweep — Under-Specified Algorithms & Soundness (RD-04 / RD-05) — AR-87..AR-93

These were surfaced by a **dedicated preflight protocol** (recorded in
`requirements/01-preflight-checklist.md`) run before passing the Zero-Ambiguity Gate.
The full-spec hygiene grep is clean (zero `TODO`/`FIXME`/`implementation-defined`/
`open question`/`to be decided`), and the spec-level contradictions were already fixed
by `spec/preflight-report.md`. What this sweep caught is a distinct
class: places where Ch 11 says *"the compiler computes X from the static call graph"*
but gives **no algorithm**. None are spec defects or soundness holes — they are
legitimate implementation latitude (Guard **C2/F2**). They are registered here as
**delegation** entries so the audit trail can distinguish "deliberately deferred to a
named RD" from "never noticed."


The load-bearing fact that makes all of this safe was verified directly against Ch 06
and the F006/F007 evaluations:

> **The v3 static call graph is provably complete.** Functions are **not values**
> (Ch 06 FN-12) — they cannot be assigned, passed, or stored. `&fn` yields a **plain
> `word` compile-time constant**, not a callable function pointer. There is **no
> language-level indirect-call mechanism** (typed function pointers are deferred to
> **FUT-003**). Recursion is forbidden and statically detected. The **only** escape is
> FN-A9 (an address poked into a hardware vector), which the spec **explicitly declares
> outside the compiler's static analysis — a documented limitation, not undefined
> behavior**.

Because the call graph is total, SFA frame coloring is **sound by construction**; only
its *efficiency* is an open implementation choice.

**AR-87:** **Frame-coloring algorithm = delegated to RD-05.** Ch 11 §3.4 mandates that
functions with non-overlapping lifetimes *may* share frame memory and cites a typical
"30–60% reduction," but specifies no algorithm. **Resolution:** the algorithm is
RD-05's responsibility, not the spec's (Guard C2/F2). Soundness is guaranteed by the
complete call graph (above). The **"30–60%" figure is illustrative, not contractual** —
the compiler is correct if it shares *zero* frames; sharing is an optimization. Baseline
approach to specify in RD-05: build the call graph, derive per-frame lifetimes/
interference from it, and color the interference graph to overlay non-interfering
frames. Feeds RD-05, RD-11.

**AR-88:** **Interrupt-handler frames vs coloring = always-live.** Interrupt handlers
fire **asynchronously**, so their frames can be live at any point and the
"non-overlapping lifetime" assumption that licenses coalescing does **not** hold for
them. **Resolution:** an interrupt handler's frame (and its transitive callees' frames)
are modeled as **always-live** — they never coalesce with main-path frames — and they
draw temps from the **separate IRQ ZP pool** already mandated by Ch 11 §4.1/§4.2.
Conservative by construction; preserves soundness. Owned by RD-05. Feeds RD-05.

**AR-89:** **FN-A9 raw-vector escape = explicitly outside static analysis.** A function
whose address is taken (`&fn` → `word`) and **poked into a hardware vector** can be
entered at runtime by a path the compiler cannot see. **Resolution:** matching Ch 06
FN-A9, this is **explicitly outside** the compiler's call-graph/liveness analysis. The
compiler makes **no reachability or frame-liveness guarantee** about a function reached
*only* via a poked vector; the developer owns correctness (e.g. by also calling it
directly, or marking it — mechanism, if any, is an RD-05 detail). The call graph remains
**total for all language-level calls**. A documented limitation, not undefined behavior
(upholds H5: defined, just developer-owned). Feeds RD-05.

**AR-90:** **Zero-page allocation + sharing algorithm = delegated to RD-05.** Ch 11
§4.2 fixes the **priority order** (user `zeropage` vars → struct/array pointers →
expression temps → IRQ temps) and §4.3 says pointer bytes are shared between
non-overlapping lifetimes, but gives no allocation algorithm. **Resolution:** the
priority order is the **contract**; the allocation + lifetime-sharing algorithm is
RD-05's (it reuses the AR-87 call-graph lifetime result for ZP-pointer sharing). Budget
overflow is the already-frozen `E10032` (Ch 11 §4.4), fired pre-ACME per AR-81. Feeds
RD-05, RD-11.

**AR-91:** **Module initialization order = topological sort.** Ch 10 promises
"dependency-ordered initialization" without naming the algorithm. **Resolution:** a
**topological sort over the import/dependency graph**; **circular dependencies are
rejected at compile time** (already in Ch 10 semantics — no valid evaluation order).
Standard and low-risk; owned by RD-04. Feeds RD-04.

**AR-92:** **Frame-region peak (worst-case simultaneous usage) = derived, not a separate
algorithm.** Ch 11 §3.5 reports a "peak simultaneous usage" in the build summary.
**Resolution:** this is a **derived artifact** of the AR-87 coloring result — the peak
*is* the maximum simultaneous live-frame footprint the coloring computes — not an
independent analysis. It feeds the `ResourceReport` (AR-79/AR-80) and the Ch 11 §6
summary. Feeds RD-05, RD-11.

**AR-93:** **FUT-003 (typed function pointers) forward-insurance for coloring.** When
typed function pointers / indirect calls eventually land (**FUT-003**), they will
**introduce call-graph incompleteness** — the exact property AR-87's soundness currently
relies on *not* having. **Resolution (insurance, costs nothing now):** RD-05's frame
coloring must be authored from day one to accept an **"escape set"** — the set of
functions that are address-taken or reachable only indirectly — and **pin** those
frames (never coalesce them), exactly as AR-89 already treats FN-A9 targets. In v3 the
escape set is **empty** (FN-12), so there is no behavior change now; recording it
prevents a coloring rewrite when FUT-003 arrives. Stability: this is a **design
constraint on a future feature**, not a v3 commitment. Feeds RD-05, FUT-003.

---


## Open Discovery Threads (to resolve before closing this phase)





Threads resolved so far:

1. ~~**Testing harness**~~ — ✅ RESOLVED (AR-22..AR-27).
2. ~~**Intrinsic functions** (+ platform-package impact)~~ — ✅ RESOLVED (AR-28..AR-36).
3. ~~**First target platform & ordering**~~ — ✅ RESOLVED (AR-37).
4. ~~**Compiler infrastructure (multi-file host, resolution) + build methodology**~~ —
   ✅ RESOLVED (AR-38..AR-42).
5. ~~**MVP vertical-slice definition** (gate program + `main` termination)~~ —
   ✅ RESOLVED (AR-43..AR-44).
6. ~~**IL design** (shape, typing, temps, CFG, intrinsics, levels, textual form,
   operands)~~ — ✅ RESOLVED (AR-45..AR-52).
7. ~~**Structured `Instr` model** (granularity, shape, labels/directives, operands,
   hi/lo, CPU validation, stream organization, textual form)~~ —
   ✅ RESOLVED (AR-53..AR-60).
8. ~~**ACME integration** (assembler choice, discovery, handoff artifact, layout/startup
   emission, output format, address-realization split, symbol feedback, failure model,
   cross-platform startup-shim variants)~~ — ✅ RESOLVED (AR-61..AR-69).
9. ~~**Diagnostics & error-code wiring** (namespace partition, structured `Diagnostic`,
   span model, `DiagnosticBag`, recovery architecture/coverage split, severity policy,
   renderers + JSON emitter, library-first API, LSP "keep-ready" posture)~~ —
   ✅ RESOLVED (AR-70..AR-78).
10. ~~**Build summary / resource reporting** (resource-reporter aggregator, data-source
    ownership, pre-/post-ACME budget-diagnostic timing, multi-renderer + JSON, default
    visibility, staged MVP scope, folded into RD-11)~~ — ✅ RESOLVED (AR-79..AR-85).

11. ~~**Preflight gap sweep** (under-specified Ch-11 algorithms: frame coloring,
    interrupt frames, FN-A9 escape, ZP allocation, module-init order, frame-region
    peak; FUT-003 forward-insurance)~~ — ✅ RESOLVED (AR-87..AR-93).

**✅ GATE PASSED — DISCOVERY CLOSED 2026-05-30 (AR-1..AR-93).** No threads remain open.
A dedicated **preflight protocol** (`requirements/01-preflight-checklist.md`) was run and
recorded: spec-hygiene grep clean, spec contradictions already fixed
(`spec/preflight-report.md`), every "the compiler computes X"
under-specification mapped to a resolved-or-delegated AR, and MVP reachability confirmed
(the AR-43 gate slice depends on zero unresolved items). The **Zero-Ambiguity Gate is
PASSED**; RD authoring is the active phase (MVP-first per the implementation order in
`requirements/README.md`).


> **Note (AR-86):** VIC-20 was subsequently accepted as a sixth target platform,
> sequenced **last** (after `a800xl`). It rides the c64 toolchain (6502 codegen,
> PETSCII, `.prg`, VICE `xvic`) with zero core-language impact, so it does not reopen
> any discovery thread; the spec §2 row, `appendix-vic20.md`, and its RAM-expansion
> profile variants are deferred to the final platform phase.

> **Note (AR-87..AR-93):** the preflight sweep surfaced a class of *algorithm latitude*
> (not spec defects): Ch 11's "the compiler computes X from the static call graph"
> clauses had no algorithm. All are now **delegation entries** owned by RD-05 (frame
> coloring, interrupt frames, ZP allocation, frame-region peak), RD-04 (module-init
> topo-sort), with FN-A9 declared out-of-scope and a FUT-003 "escape-set" insurance note.
> Soundness rests on the **provably complete v3 call graph** (FN-12: functions are not
> values; no indirect calls; recursion forbidden), verified against Ch 06 + F006/F007.

---

### RD-17 Preflight Runtime Resolutions (2026-07-02) — AR-97..AR-101

> Logged per the runtime-ambiguity protocol during the RD-17 requirements preflight
> (`00-preflight-report.md`, findings PF-002/PF-004/PF-006/PF-007/PF-012). AR-94..AR-96
> were consumed by plan-level runtime entries (rd-08/rd-09 plans). All five were
> resolved with the user on 2026-07-02 ("accept all recommendations").

**AR-97 (runtime):** **T4 platform import = one pseudo-module per platform.** The frozen
import grammar (`grammar.ebnf.md` §import_stmt) permits only a single identifier after
`from` — dotted paths (`c64.encoding`, `c64.system`) are not expressible. T4 intrinsics
are imported from a single platform pseudo-module: `import { petscii } from c64;`.
Amends the AR-28 T4 example; corrects RD-17 R19 and RD-10 R24. The module resolver
recognizes the active platform's id as an importable pseudo-module. *(PF-006)*

**AR-98 (runtime):** **T3 runtime-routine set = fused div/mod, matching shipped
codegen.** The core T3 library is exactly `__rt_mul8`, `__rt_mul16`, `__rt_div8`,
`__rt_div16` — the call sites RD-07b codegen already emits. There are **no separate
`mod` routines**: division produces the remainder for free, and `%` consumes it.
Return convention (extends AR-33): `__rt_div8` quotient→A, remainder→X; `__rt_div16`
quotient→A(lo)/X(hi), remainder→first 2 bytes of the ZP arg-block. The per-platform
`runtimeModules` stubs (mul8/mul16/div8/div16 in all five plugins) migrate to
codegen-owned T3 modules per AR-28/RD-17 R4. *(PF-004)*

**AR-99 (runtime):** **`asm_stp` dropped from v3; `asm_wai` retained.** `asm_stp`
appears nowhere in the frozen spec (grep-verified) — adding it would invent a language
feature under the spec freeze (D3). `asm_wai` is retained: it is spec-traceable via
`grammar.ebnf.md` ("65C02 only — platform-gated"), `appendix-cx16.md`, and
`v2-to-v3-migration.md`. Implementation deltas: `asm_wai` joins `RESERVED_BUILTINS`
(size-locked tests grow to 23) and `WAI` joins `W65C02_OPCODES`. Amends the AR-28 T1
example list. *(PF-007)*

**AR-100 (runtime):** **Runtime-module inclusion = textual inlining, not `!source`.**
The emitter reads each *referenced* T3/T4 module's `.asm` text and embeds it into the
single generated `.asm` file, preserving RD-09 R4's single-file contract (no
multi-file output, no include-path plumbing in `invokeAcme`). Dead-stripping (AR-30)
falls out naturally: unreferenced modules are simply not embedded. Refines AR-30's
"the ACME emitter includes referenced runtime modules" mechanism. *(PF-002)*

**AR-101 (runtime):** **Non-constant T2 addresses deferred with a diagnostic.** A
non-compile-time-constant address argument to `peek`/`poke`/`peekw`/`pokew` produces
`E10045` (NonConstantIntrinsicAddress) — a proper user diagnostic replacing today's
ICE. Indirect `(zp),Y` lowering for runtime-computed addresses is deferred to a later
slice (it is genuinely new codegen surface beyond the MVP gate's constant `poke`).
*(PF-012)*

---

### RD-11 Preflight Runtime Resolution (2026-07-03) — AR-102

> Logged per the runtime-ambiguity protocol during the RD-11 requirements preflight
> (`00-preflight-report.md`, finding PF-003). Resolved with the user on 2026-07-03
> ("accept all recommendations").

**AR-102 (runtime):** **Unpopulated build-summary lines render as zero, never omitted.**
The terminal resource-report renderer produces the full Ch 11 §6 layout from v1; lines
whose data source has not yet come online (per the AR-84 staging) render with zero
values rather than being dropped, so golden snapshots change values only — never line
geometry — as slices bring SFA/ACME/plugin data online. Ratifies that the Ch 11 §6
layout (not RD-11 §4.7's former compact grid) is the normative terminal form, upholding
AR-82 and AR-84. *(PF-003)*

---

### RD-11b Plan-Gate Resolutions (2026-07-03) — AR-103..AR-105

> Logged per the runtime-ambiguity protocol during the RD-11b `make_plan`
> Zero-Ambiguity Gate (`plans/rd-11b-diagnostics-reporting/00-ambiguity-register.md`,
> items Q3–Q11, Q14–Q16). Resolved with the user on 2026-07-03 ("all as
> recommended" + three explicit per-item selections). One independent challenger
> was run on the AR-103 cluster (converged on assembly/fields; diverged on the ZP
> breakdown — its position was adopted and user-ratified).

**AR-103 (runtime):** **`ResourceReport` completed against the frozen layout; core
ships the aggregator.** §4.6 gains `platformName`/`targetName` (required — JSON
parity: both renderers are single-arg), optional per-segment `SegmentRange` fields,
`zpAllocations?: readonly ZpAllocation[]` (breakdown moved into v1 — R48's
anti-reshaping rule outweighs R47's slice-2 deferral since the source shipped in
RD-05; `arg-block` folds into the "Compiler temps" line, which has no layout row of
its own), and `stackAnalysis?: StackAnalysis` (same embed-shipped-type pattern —
the layout's depth/overhead lines have no `SfaResourceData` source). §4.8 gains a
pure `buildResourceReport(inputs)` (embeds `AllocationPlan` sub-records verbatim;
no I/O or label parsing — the serializer emits no segment boundary labels, so
ACME-owned fields stay undefined → render zero per AR-102) and
`checkBinaryBudget(report, bag)` (the post-ACME E10034 half of AC-17; RD-15 calls
it after `emitBinary`). *(plan AR-Q3/Q4/Q5/Q6/Q15)*

**AR-104 (runtime):** **`SourceMap` semantics fixed.** Interning is path-keyed:
same path + same content → same id (no-op); same path + new content → same id,
content replaced, cached `LineMap` invalidated (LSP keep-ready, AR-78). Getters
throw on unknown ids; an additive `has(id): boolean` probe joins §4.2 so renderers
implement R51 degradation without throwing (the RD-16 `CONFIG_SOURCE_ID = -2`
sentinel is the concrete case). Ids are sequential from 0 in intern order.
*(plan AR-Q7)*

**AR-105 (runtime):** **Renderer presentation contract fixed (golden-locked).**
Primary caret line renders carets only — no trailing label (the shipped RD-11a
`Diagnostic` record stays frozen; producers use `notes[]`/secondary spans).
Composition: one blank line between blocks, no summary footer (RD-15's), `= note:`
/ `= help:` gutter-aligned, secondary spans as own mini-blocks with labels;
promoted warnings keep their `W` code (`error[W10xxx]`). Color: bold red/yellow
severity+code, severity-colored carets, cyan gutter, hand-rolled SGR. JSON:
`renderJson` emits a top-level array mirroring the record with raw spans;
`renderReportJson` one mirror object with `ruleHits` as name-sorted entries.
Build-summary numbers: hand-rolled comma grouping, `Math.round` percentages (0%
on zero budget), §4.7 geometry transcribed verbatim, unpopulated ranges print the
`($0000–$0000)` placeholder (AC-18's "when available" = real values when
available; geometry never changes, upholding AR-102), `peepholeStats` absent from
the terminal form. *(plan AR-Q8/Q9/Q10/Q11/Q14/Q16)*

> **AR-105 addendum (2026-07-03, RD-11b plan preflight PF-003):** degraded (R51)
> blocks render the header **plus `notes[]`/`help` lines** — these are
> compiler-authored, never source-echoed — with no `-->` location line and no
> excerpt. R51's former "code + severity + message only" wording is amended
> accordingly (the "only" excluded location/excerpt, not notes/help; the concrete
> R51 consumers — RD-16 config diagnostics — carry their actionability in `help`).

**AR-106 (runtime):** **CLI color is zero-dependency; requirements AR-17 amended.**
The RD-15 chalk references (R35/R37/§4.5) are superseded: `@blend65/core` already
hand-rolls ANSI (`core/src/diagnostics/ansi.ts`) and `renderTerminal` takes an
explicit `{ color: boolean }`, so the CLI must own color detection regardless.
The CLI computes one `color: boolean` (explicit `--color` ON > `--no-color` OFF >
`NO_COLOR` env OFF > `isTTY` decides), passes it to `renderTerminal`, and paints
its own accents with local SGR helpers. Chalk is **not** a dependency (avoids a
second color oracle that could disagree, e.g. `FORCE_COLOR` on a pipe). RD-15
R35/R37/§4.5 back-propagated. *(plan AR-V2; user-ratified 2026-07-03)*

**AR-107 (runtime):** **`CompilerOptions.cwd?` added as a routing option.**
`loadConfig` needs a base directory for walk-up discovery and the `projectRoot`
fallback (`config/src/load-config.ts:80,144`), and CLI temp-dir tests cannot bind
it otherwise. `cwd?: string` joins RD-15 §4.1 as a **routing** option (not a
config override): the facade threads it to `loadConfig`; the CLI maps `io.cwd`;
defaults to `process.cwd()`. *(plan AR-V20 / plan preflight PF-002)*

**AR-108 (runtime):** **Exit 3 = ICE band via `isIceCode`; `E10035` → exit 1.**
There is no ACME-specific ICE code — `E90001` is generic (6+ emitters) and an ACME
assembler failure is reported as `IceCode.Unexpected`. Exit 3 therefore keys on the
ICE band (`isIceCode(code)`, `/^E9\d{4}/`), matching R44's "internal compiler error"
rationale with zero shipped-code change. ACME-not-found (`E10035`, a normal
user-actionable error emitted by `discoverAcme`) falls through to **exit 1**. R44/R50
wording clarified. *(plan AR-V21 / plan preflight PF-003)*

**AR-109 (runtime):** **Config-file diagnostics render header-only for v1.**
Config diagnostics carry `CONFIG_SOURCE_ID = -2` spans, which `SourceMap.has()`
rejects (id ≥ 0 required) → header-only rendering (no caret). Accepted for v1 — the
`@blend65/config` surface is out of scope (RD-16 shipped); the AR-P2 `sourceId` seam
(`config/src/validate.ts:47`) is the follow-up. *(plan AR-V22 / plan preflight PF-008)*







