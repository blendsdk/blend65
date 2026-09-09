# Blend65 v3 Expert Recovery Audit

> **Date**: 2026-09-09
>
> **Audit mode**: Read-only implementation audit; no compiler code changed
>
> **Recommendation**: Stop feature implementation on the current architecture. Preserve the
> repository as evidence, then recover the compiler through C64-first vertical slices that port only
> components whose contracts survive this audit.

## Authority and lineage

This audit uses the following authority order:

1. explicit product decisions and the active reconciled Blend65 specification;
2. the proven Static Frame Allocation (SFA) doctrine;
3. primary 6502, C64, ACME, and VICE evidence;
4. the active Blend65 domain-expert baseline; and
5. current code, tests, roadmaps, examples, and scoreboards as audit evidence only.

| Field | Bound value |
|---|---|
| Expert baseline | `blend65-domain-expert` `1.0.0` |
| Qualified content commit | `a96cfd3c41a456d4d4f983021cf43535a1d5bdaa` |
| Specification identity | `BLEND65-SPEC-P3-4bf8a989` |
| Principal skill references | `compiler-architecture.md`, `blend65-semantics.md`, `sfa-and-abi.md`, `il-and-optimization.md`, `6502-lowering-casebook.md`, `target-portability.md`, `c64-game-engineering.md`, `evidence-parity-and-recovery.md` |
| Principal external source keys | `MOS-PGM-1976`, `CSG-6567-318014`, `MOS-6581-SID`, `ACME-097-R266`, `VICE-310-SOURCE`, `VICE-310-MANUAL` |
| Implementation checkpoint | `30566503ffbd7195498b42a131e824ef5c965c38` at audit start |

The skill release record qualifies all 107 knowledge cases and binds the exact active specification
identity (`.agents/skills/blend65-domain-expert/qualification/release.md:3-32`). Existing compiler
behavior cannot override that authority.

## Executive conclusion

Blend65 v3 is a substantial walking skeleton, not an 18-of-20 complete compiler. It can compile a
limited C64-shaped subset through ACME and execute selected programs in VICE. Several internal
components are worth saving. However, the compiler is currently **Incorrect** as an implementation
of the active language and **Incorrect** against the expert-assembly output requirement.

The main problem is not horizontal development by itself. The problem is that horizontal slices
were declared complete against tests and examples that froze interim behavior. Later specification
corrections did not re-establish conformance at the parser, analyzer, lowering, target, and test
boundaries. The result is broad surface area without a trustworthy vertical contract.

The recovery must not patch every current failure in place. The recommended course is a clean
architectural baseline with controlled salvage:

- keep proven algorithms and small utilities;
- simplify compiler/test orchestration;
- rewrite incorrect semantic and lowering seams;
- delete the readiness product and false target implementations; and
- grow one C64 capability at a time from modern Blend65 source to behavior proof, ACME bytes,
  VICE observation, and expert-equivalent assembly cost.

No aggregate completion percentage is defensible. Package-level averaging would hide the exact
failure that caused the current situation: a component can exist and have hundreds of green tests
while implementing the wrong language contract.

## Status by assessed boundary

The status words below are the skill's exact evidence classifications. Each row assesses one named
boundary; no package-wide average is used.

| Boundary | Status | Evidence-based conclusion | Recovery disposition |
|---|---|---|---|
| Active language specification as audit authority | Verified complete | Version-qualified and internally reconciled by the expert-skill release gate. | Keep |
| ASCII token recognition and recovery | Verified partial | The lexer is real, deterministic, recovery-oriented, and well tested for its established ASCII surface. | Keep and repair |
| UTF-8 source spans | Incorrect | Lexer spans use JavaScript UTF-16 indices while `SourceSpan` and `LineMap` require UTF-8 byte offsets. | Rewrite cursor/span accounting |
| Parser infrastructure | Verified partial | Cursor, recovery, AST construction, and Pratt machinery are substantial and reusable. | Keep core machinery |
| Parser against active syntax | Incorrect | It accepts removed range loops and angle casts, but rejects the active three-clause loop and call-style cast syntax. | Rewrite grammar-facing productions |
| Diagnostic bag, sorting, source maps, renderers | Verified partial | The mechanics are substantial and the directed core suites pass. | Keep |
| Diagnostic registry and producers against active spec | Incorrect | Active and retired meanings conflict; stale codes remain enforced by tests. | Rewrite from one generated/checked registry |
| Semantic analysis framework | Verified partial | Symbols, scopes, types, constant evaluation, call graph, and many aggregate checks are real. | Keep selected data structures and pure analyses |
| Active array/index semantics | Incorrect | The analyzer enforces retired byte/word indexing restrictions and rejects the modern ordinal context. | Rewrite |
| Static Frame Allocation algorithms | Verified partial | Frame computation, interference, coloring, IRQ classification, and budget logic are real and independently testable. | Keep algorithms |
| SFA integration and closure | Incorrect | The live pipeline uses a placeholder profile; later register spilling can discover storage after SFA; nested call shapes are rejected. | Rewrite integration/ABI seam |
| Typed IL and CFG foundation | Verified partial | Real typed operands, CFG blocks, direct volatility markers, structural passes, and printers exist. | Keep concepts; simplify representation |
| IL effect/clobber/alias contract | Scaffold/stub | Calls and most memory operations do not carry enough explicit machine effects for safe global optimization and IRQ reasoning. | Rewrite/extend only as demanded by slices |
| Structural IL optimization | Verified partial | Jump threading and unreachable-block removal are real and used. | Keep |
| Peephole optimizer | Scaffold/stub | The public rule catalog is deliberately empty and `--optimize` is a structural validation pass-through. | Delete empty framework or replace with real rules when needed |
| General optimizer capability | Scaffold/stub | There is no coherent constant propagation, DCE, strength reduction, global allocation, or whole-program optimizer. | Rewrite from semantic/effect facts |
| C64 code generation for selected simple programs | Verified partial | Selected programs reach ACME and VICE successfully. | Salvage serializer/opcode/branch utilities |
| General expression/call lowering | Incorrect | Ordinary modern expressions such as `f() + g()` and same-callee nested calls produce ICEs and demand source workarounds. | Rewrite |
| Expert-assembly parity | Incorrect | The committed corpus totals 3.54× expert bytes and 4.64× expert static cycles; no assessed pair meets the 1.0 local floor. | Rewrite selection/allocation/optimization |
| C64 artifact path | Verified partial | ACME PRGs are produced and focused VICE execution works. | Keep and harden |
| Error-to-artifact boundary | Incorrect | Codegen can add an error after the pre-emit gate, yet `build()` still invokes ACME and returns `.asm`/`.prg` artifacts. | Fix before any recovery slice is trusted |
| C64 platform profile/library | Scaffold/stub | A profile exists, but plugin intrinsics/runtime modules are empty and there is no named VIC/SID/CIA game API. | Rewrite as a real C64 platform layer |
| Raw asset embedding | Verified partial | Containment, size, byte reading, and raw data emission are implemented. | Keep reader/security boundary |
| Native SpritePad/CharPad/Koala/SID pipeline | Scaffold/stub | Format-aware `embed()` is explicitly rejected; no qualified handlers or placement pipeline exist. | Implement later as vertical platform slices |
| Focused ACME/VICE test harness | Verified partial | ACME and VICE 3.10 are installed; the directed gate, driver, and assertion suites passed. | Keep and simplify |
| Test corpus as active-spec oracle | Incorrect | Many `*.spec.test.ts` files and examples assert removed syntax and retired diagnostics. | Re-author from current spec; do not mass-patch |
| Readiness/readiness-execution product | Verified complete | It is a large, working system for its own readiness workflow. That workflow is not required by compiler execution. | Delete, preserving only unique small checks |
| Commander X16 backend | Scaffold/stub | CPU/profile data exists, but startup, PETSCII, and packaging delegate to C64-shaped hooks. | Remove from supported targets; retain constraint notes |
| Atari 800XL backend | Scaffold/stub | It claims XEX/ATASCII but emits C64-style startup and PRG output. | Remove from supported targets; retain constraint notes |
| Atari 7800 backend | Scaffold/stub | It claims A78/ROM but emits C64-style startup and PRG output. | Remove from supported targets; retain constraint notes |
| Language server and VS Code extension | Scaffold/stub | Each production entry point is one version constant. | Defer outside compiler recovery |

## Critical findings

| ID | Claim kind | Severity | Finding and endpoint | Correctness/parity impact | Complexity signal |
|---|---|---|---|---|---|
| A-001 | Fact | Critical | The active spec requires C/JavaScript-style `for (I; C; U)` (`spec/05-statements-control-flow.md:210-269`), while the parser implements only `to`/`downto` range syntax (`packages/frontend/src/parser/parse-stmt.ts:155-216`). A direct active-syntax probe returned parser errors; removed syntax parsed cleanly. | Ordinary current programs cannot enter semantic analysis. Old programs continue to look green. | 17 compiler-relevant test files and 3 examples still contain the removed loop form. |
| A-002 | Fact | Critical | Active casts are `byte(expr)`/`word(expr)` (`spec/02-type-system.md:320-333`), while Pratt parsing recognizes only `<type>(expr)` (`packages/frontend/src/parser/pratt.ts:241-253`). | Legal source is rejected; the suite protects obsolete syntax. | 11 test files and 2 examples contain angle-cast syntax. |
| A-003 | Fact | Critical | All integer types may index all arrays, and unbarriered index arithmetic uses a 16-bit-capable ordinal context (`spec/08-arrays-strings.md:113-166`). The live registry and analyzer retain E10117/E10118 tier rules (`packages/core/src/diagnostics/diagnostic-codes.ts:97-114`; `packages/frontend/src/semantics/type-check/expression-typing.ts:1038-1043`). | `arr[i + 10]` cannot produce ordinal 265 as specified. This is a modern-language expressiveness and correctness failure. | Five test files explicitly protect retired E10117/E10118 behavior. |
| A-004 | Fact | Critical | `poke`/`peek` lowering calls `constAddress()` and emits E10045 for a runtime address (`packages/codegen/src/il/lower.ts:2652-2667,2910-2929`). A direct `poke(variableAddress, value)` probe fails. | The language cannot express ordinary dynamic MMIO/pointer access. This violates the product prime directive and blocks real game code. | The limitation is embedded in lowering rather than forced by 6502 hardware. |
| A-005 | Fact | Critical | Call translation deliberately rejects a value live across another call and tells the developer to split the expression (`packages/codegen/src/instr/translate.ts:513-555`). Lowering also rejects a nested call that can reach the same callee (`packages/codegen/src/il/lower.ts:1032-1079`). Direct probes made `f()+g()` and `f(1,f(2,3))` ICE. | Correct modern expressions are unrepresentable. SFA must stage values/arguments; source workarounds are not acceptable. | Current lowering, SFA scratch, and register binding do not share one closed storage plan. |
| A-006 | Fact | Critical | `assembleAsmText()` checks errors only before lowering (`packages/compiler/src/api/emit.ts:102-125`) and returns serialized assembly without rechecking errors added by codegen (`packages/compiler/src/api/emit.ts:146-173`). `build()` then invokes ACME and returns artifacts (`packages/compiler/src/api/build.ts:70-89,138-149`). A dynamic-POKE build returned E10045 and still wrote `.asm`, `.lbl`, `.prg`, and report files. | A failed compilation can leave a runnable-looking binary. That invalidates artifact success as a correctness signal. | One missing post-stage invariant affects every codegen diagnostic. |
| A-007 | Fact | Critical | The live analyzer receives both a placeholder and canonical target profile, and SFA always receives `DEFAULT_PROFILE` (`packages/compiler/src/api/run-frontend.ts:171-206`). The placeholder explicitly says the full platform profile is not implemented (`packages/core/src/semantics/platform-profile.ts:1-20`). | Allocation and resource decisions are not made from the selected machine. C64 ZP and RAM conclusions can be wrong. | Two incompatible profile types encode overlapping facts. |
| A-008 | Fact | Critical | The C64 profile exposes 142 ZP bytes (`packages/platforms/src/c64.ts:41-75`), while the SFA placeholder exposes 46 (`packages/core/src/semantics/platform-profile.ts:67-87`). Register binding may later ICE and advise raising a pool after planning (`packages/codegen/src/instr/register-binding.ts:248-307`). | SFA is not actually closed before emission, and the generated program can lose scarce resources or fail late. | Allocation, lowering counters, and register spills each infer storage independently. |
| A-009 | Fact | Major | The diagnostic registry assigns meanings that the active spec explicitly retired or reassigned. For example, implementation E10114 means invalid index and E10117/E10118 mean tier width (`packages/core/src/diagnostics/diagnostic-codes.ts:84-114`); the active registry assigns E10114 to fill syntax, E10263 to invalid index, and retires E10117/E10118 (`spec/14-diagnostics.md:308-310`). | Users receive wrong codes and tests cannot distinguish current conformance from historical behavior. | A raw mechanical scan found 66 spec code strings absent from the implementation registry and 38 implementation strings absent from spec; each still needs active/historical classification. |
| A-010 | Fact | Major | Lexer offsets use `text.length` and a UTF-16 cursor, asserting it also represents bytes (`packages/frontend/src/lexer/lexer.ts:71-89`). `LineMap` correctly requires UTF-8 byte offsets (`packages/core/src/diagnostics/line-map.ts:23-35,83-123`). A non-ASCII-comment probe shifted the next token and diagnostic position. | Diagnostics and LSP coordinates become wrong after non-ASCII text; astral characters are especially unsafe. | One cursor serves two incompatible coordinate systems. |
| A-011 | Fact | Major | The peephole stage documents zero rules and exports `V1_RULES = []` (`packages/codegen/src/instr/peephole.ts:1-15,70-75`). A byte divide-by-two probe emitted `JSR __rt_div8`; multiply-by-eight did use shifts. | The optimizer cannot meet expert output. An option named `--optimize` materially overstates what it does. | Forward interfaces exist without a working capability. |
| A-012 | Fact | Critical | The parity scoreboard totals 3,256 generated versus 920 expert bytes and 4,219 versus 909 static cycles (`packages/test-harness/test/golden/SCOREBOARD.md:7-24`). Ratios range as high as 8.70× bytes and 14.50× cycles. | The compiler fails the non-negotiable expert parity floor. | Constant staging, frame traffic, startup ceremony, weak instruction selection, and missing optimization compound globally. |
| A-013 | Fact | Critical | X16 delegates preamble/startup/output/text to C64-shaped PRG/PETSCII hooks (`packages/platforms/src/cx16.ts:1-8,62-95`). Atari 800XL and 7800 claim XEX/A78 profiles but also delegate C64 startup and PRG output (`packages/platforms/src/a800xl.ts:1-9,62-97`; `packages/platforms/src/a7800.ts:1-14,68-103`). Direct emission probes for all four registered targets began with a C64 `!to ...prg, cbm` directive at `$0801`. | The registry presents machine names without target-native artifacts. This is not multi-target support. | One shared hook hides incompatible CPU, machine, serializer, and packager facts. |
| A-014 | Fact | Major | The C64 plugin has empty platform intrinsics and runtime modules (`packages/platforms/src/c64.ts:77-87`). Format-aware embedding returns an internal compiler error (`packages/frontend/src/semantics/type-check/statement-typing.ts:944-958`). | Named VIC/SID/CIA access, native game assets, tracker playback, and compiler-owned placement are absent. | Platform capability is represented by profiles and placeholders rather than usable vertical features. |
| A-015 | Fact | Major | Readiness and readiness-execution contain 109,835 non-test TypeScript lines in 352 files, versus 36,141 non-test TypeScript lines in 193 files for core/frontend/codegen/compiler/platforms/config/CLI. The readiness tree has 577 tracked files and 184,636 total lines. Root `yarn test` always builds/runs readiness smoke tiers (`package.json:17-24`). | The support workflow is a second product and imposes continuing cost without compiling a Blend65 program. | Readiness production code is 3.04× the compiler/toolchain production core measured above. |
| A-016 | Inference | Major | The current tests are strong evidence for historical implementation behavior but weak evidence for the active language. Directed parser, diagnostics, semantics, SFA, and codegen suites passed while A-001 through A-005 remained reproducible. | Green totals currently create false confidence. Tests must be rebound to independent current-spec and machine oracles. | 604 test files and 128,406 test lines make indiscriminate reruns costly; relevance must be slice-based. |

## What is genuinely worth preserving

| Component | Why it survives | Conditions before reuse |
|---|---|---|
| Source host/discovery and raw asset reader | Clear responsibilities; useful path-containment and file-size checks. | Keep independent of semantic authority and platform formats. |
| Lexer recognition/recovery tables | Broad real implementation; defects are concentrated in offset/scalar accounting. | Replace the cursor contract and add UTF-8/astral oracles first. |
| Parser cursor, recovery, and Pratt mechanics | Substantial reusable machinery; wrong productions do not require inventing a new parser framework. | Re-author syntax tests from the active grammar, then change productions. |
| AST, symbols, scopes, and core type records | Useful typed structure already consumed across frontend/SFA. | Remove historical semantics encoded in types or visitors. |
| Diagnostic bag, ordering, source map, and renderers | Valuable infrastructure separate from code-number drift. | Make one active registry and mechanically verify all producers. |
| SFA frame/interference/coloring algorithms | They implement the accepted storage model without a runtime stack. | Feed one target resource profile; close temporaries, spills, helper scratch, and call staging before emission. |
| CFG and typed IL basics | Blocks, terminators, typed operands, and explicit direct volatility are sound foundations. | Add only facts required by proven lowering/optimization cases; do not build a universal IR framework. |
| Opcode legality, timing tables, ACME serialization, and branch relaxation | Bounded, testable machine utilities with direct value. | Requalify under the selected CPU and final artifact path. |
| Focused VICE driver and memory/register assertions | Real end-to-end behavior proof already works. | Keep one simple protocol; remove duplicated readiness/control orchestration. |
| Parity twins and scoreboard concept | It exposes output defects that functional tests cannot. | Use realistic equivalent work and make 1.0 a floor, not a dashboard-only statistic. |
| CLI/config shell | Basic compiler invocation and configuration flow are useful. | Expose only honest targets/options and fail atomically on diagnostics. |

## What should be removed rather than repaired

| Surface | Recommendation | Reason |
|---|---|---|
| `@blend65/readiness` and `@blend65/readiness-execution` | Delete after extracting a short inventory of unique checks. | They are isolated from compilation, larger than the compiler core, and recreate requirements, generation, publication, replay, campaign, and execution systems. Do not replace them with another meta-harness. |
| Public non-C64 target support | Remove from the supported-target list. Keep only constraint documentation until independently qualified. | C64-derived startup/artifact hooks are actively misleading. A name/profile is not a backend. |
| Empty peephole rule framework | Remove unless the first real rule lands in the same recovery slice. | A future-facing interface with zero behavior adds architecture without value. |
| Historical spec tests that assert removed language behavior | Replace from authority, not edit until green. | They are mislabeled implementation oracles. Keeping them as `*.spec.test.ts` corrupts the trust model. |
| Language-server/VS Code placeholders from the active recovery path | Defer or remove until the frontend contract is stable. | One-line packages provide no compiler recovery value. |
| Naive game-feasibility matrix as an engineering input | Ignore; removal remains safe. | It is a historical snapshot, not a compiler or skill authority. |

Deletion does not mean losing history. Git preserves every implementation and test. A small direct
check should be ported only if it protects a unique compiler, artifact, security, or emulator
boundary.

## Recommended replacement architecture

The best architecture is a small responsibility pipeline, not a large pass framework:

```text
Blend65 source
  -> target-neutral lexer / parser / semantic model
  -> target-neutral semantic IR with exact types, order, places and effects
  -> closed call graph + SFA function storage for the selected target profile
  -> shared 6502-family legalization and machine IR
  -> selected CPU instruction choice and cost-guided optimization
  -> selected machine platform expansion, layout and banking
  -> selected assembler serializer
  -> selected artifact packager
  -> ACME bytes + VICE observation + expert parity evidence
```

This is a responsibility map, not a requirement for one package or class per box. Adjacent stages
should remain together when that is simpler. The essential separations are:

- language meaning never depends on C64 addresses or ACME syntax;
- SFA owns only function-execution storage, not assets or whole-machine layout;
- CPU legality is separate from VIC/SID/CIA and memory banking;
- ACME text is separate from PRG/XEX/A78 packaging;
- C64 game techniques enter through semantic facts, cost models, compile-time transformation,
  platform APIs, and layout—not a generic “game optimizer” switch;
- every optimization preserves behavior independently of its generated-assembly expectation; and
- no target becomes public until one target-native vertical artifact is qualified.

For C64 game development, the later platform layer should cover named volatile registers, IRQ/NMI
ownership, raster scheduling, sprite placement and multiplexing, scrolling/display publication,
double buffering, SID song/effect arbitration, loader windows, and qualified native asset handlers.
Integrator-style scene composition belongs in a deterministic compile-time asset/layout pipeline,
not in SFA and not in an editor framework.

## Recovery sequence

This is a direction, not an implementation plan. A new plan should be written only after this audit
is accepted.

| Order | Vertical outcome | Minimum proof before moving on |
|---:|---|---|
| 1 | Honest baseline | Remove false completion/support claims; freeze this audit checkpoint; define the small qualification lattice. |
| 2 | Current frontend | UTF-8 spans, current casts, current three-clause loops, one diagnostic registry, and current fixed-array ordinal semantics. Directed spec cases must replace stale ones. |
| 3 | Closed SFA/ABI seam | One selected target profile owns budgets; calls, nested arguments, results, locals, temporaries, spills, helper scratch, and IRQ domains are closed before emission. |
| 4 | Minimal C64 modern-source slice | `poke(variableAddress, value)` compiles to the expert direct/indirect sequence, fails atomically, assembles, runs in VICE, and meets expert bytes/cycles. |
| 5 | Core language growth | Expressions/calls, arrays and word arrays, control flow, structs, modules, and interrupts grow one behavior-complete slice at a time. |
| 6 | Real optimizer/backend | Add range/constant/effect facts only for measured transformations; qualify constant folding, strength reduction, allocation, branch layout, and peephole rules independently. |
| 7 | C64 game platform | Add zero-cost named hardware APIs, layout, native assets, SID music/SFX, raster/sprite/scrolling systems, and build reports with VICE plus bounded hardware QA. |
| 8 | Secondary targets | Qualify X16 next, then C128/Atari extensions independently. Reuse only already-proven language/CPU responsibilities. |

The first recovery slice is deliberately small. It proves the complete architecture using the exact
kind of modern source that the previous compiler rejected, while also exercising volatile MMIO,
dynamic addressing, SFA, instruction selection, ACME, atomic failure, VICE, and expert parity.

## Verification performed

The audit used directed evidence because a full repository run would spend resources validating
large stale/readiness surfaces rather than answering the audit questions.

| Check | Result | What it establishes |
|---|---|---|
| Lexer/parser directed suites | 172 tests passed | The historical parser/lexer contract is internally stable; it does not establish active-spec conformance. |
| Core diagnostic suites | 122 tests passed | Diagnostic mechanics are healthy under current tests. |
| Semantic suites | 669 passed, 1 todo | The analyzer is substantial; stale array and syntax rules remain outside this result. |
| SFA suites | 133 tests passed | Core SFA algorithms are real; live profile/closure integration remains incorrect. |
| Targeted codegen/optimizer suites | 46 tests passed | Structural passes and selected lowering paths work; one test explicitly requires the empty peephole catalog. |
| ACME/VICE gate, driver, and assertion suites | 13 tests passed | The focused C64 runtime harness executes real generated artifacts under VICE 3.10. |
| Active syntax probes | Failed as described in A-001/A-002 | Current loops and casts are not implemented. |
| Array ordinal probes | Failed with retired E10117/E10118 behavior | Active array semantics are not implemented. |
| Call-expression probes | `f()+g()` and same-callee nesting ICE; ordinary distinct argument calls can compile | Call lowering has shape-dependent correctness gaps. |
| Dynamic POKE build probe | Returned E10045 but still wrote binary artifacts | Error-to-artifact atomicity is broken. |
| Four-target emission probe | Every target emitted C64 PRG/BASIC-start text | Non-C64 backends are scaffolds. |
| Arithmetic shape probe | Byte `/ 2` called `__rt_div8`; byte `* 8` used three `ASL`s | Optimization exists only as isolated translator special cases. |
| Source/test inventory | Counts recorded in A-015/A-016 | Overengineering and test-cost concerns are measurable, not subjective. |

No full repository test, full readiness qualification, or emulator matrix was run. Those checks
would not change the verified architectural findings. No real-hardware claim was tested; runtime
results remain `VICE-verified / hardware-unverified`.

## Remaining unknowns

| Unknown | How it should be closed |
|---|---|
| Exhaustive active-spec failure count | Build a small generated manifest from the active spec, then classify each semantic boundary without importing historical tests as authority. |
| Exact number of silent miscompiles beyond known triage | Add independent behavior oracles to each recovery slice; do not rely on optimized-versus-unoptimized comparison alone. |
| Per-component port-versus-rewrite cost | Measure when extracting each vertical slice; keep only when the old component satisfies the new contract with less risk than a small rewrite. |
| C64 real-hardware edge behavior | Use targeted late QA for raster/badline timing, CIA edges, SID revision/analogue behavior, undocumented opcodes, and unusual banking. |
| Native asset format completeness | Acquire pinned producer fixtures/schema evidence before claiming SpritePad 3.80 or CharPad 3.88 parser qualification. |
| Whole-program beat-the-expert result | Establish only after every local route meets the expert floor and realistic game-shaped parity workloads exist. |

## Decision

**Recommended — accept the controlled clean-slate recovery.** Do not continue RD-13/RD-14 or the
current readiness plan. Do not attempt a broad repair of all 604 test files. Preserve the current
branch and history, then make a new C64-first recovery requirements set and plan based on this
audit, the active specification, and expert baseline `1.0.0`.

The old implementation is a quarry, not the blueprint. Components return only when their contract,
correctness, complexity, and expert-output value are demonstrated inside a vertical slice.
