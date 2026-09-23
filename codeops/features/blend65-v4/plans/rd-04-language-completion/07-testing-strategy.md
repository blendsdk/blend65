# Testing Strategy: RD-04 Language Completion

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Evidence | Target |
|---|---|
| Frozen grammar/rule/diagnostic/conformance keys | 100% owned and linked to decisive proof |
| RD-04 acceptance criteria | 100% discharged or explicitly deferred under AR-P5 |
| Runtime semantic families | Independent behavior oracle plus assembled execution where applicable |
| Generated operation families | Equal-contract expert sequence/frontier and complete cost record |
| Error paths | Exact diagnostic plus proof that no runnable-looking artifact is published |

Test names state behavior. Specification tests are authored before implementation and remain the
immutable oracle. Implementation tests cover internal algorithms and malformed states afterward.
Cross-stage tests use the public compiler service; no private AST-to-backend bypass is allowed
(AR-P7).

## 🚨 Specification Test Cases

> These cases derive from the frozen Specification 4 identity, RD-04 and resolved AR-P1–AR-P8.
> Each phase expands its rows into the smallest positive, boundary, negative and interaction matrix
> needed to discharge every corresponding coverage-crosswalk key. Expectations never adapt to the
> current implementation.

### Authority, Lexer, Parser, Modules and Diagnostics

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-01 | Remove one grammar-production row from a copy of `normative-coverage.json`. | The validator reports that exact missing production; the frozen identity and all other rows remain unchanged. | R4.1, R4.2, AC-01, AC-02, AR-P6 |
| ST-02 | Lex `\uFEFFmodule Game;\r\n/*é🎮*/let n: word = $FF_FF;`. | Tokens use exact kinds/values and UTF-8 byte spans; comment scalars do not alter later byte positions. | R4.5, AC-04; Spec 4 Ch 01 |
| ST-03 | Lex each invalid UTF-8, unterminated block comment/string/char, bad escape, separator and maximal-munch boundary from the frozen lexical inventory. | Each case emits its canonical code, severity and exact span; recovery never yields a usable malformed literal. | R4.5, R4.7, R4.10; Spec 4 Ch 01, Ch 14 |
| ST-04 | Parse `a = b ? c + d * e : (f = g);` and the complete grammar-production fixture set. | One Pratt precedence/associativity tree is produced; all productions parse or issue the exact canonical syntax diagnostic. | R4.6, AC-05; Spec 4 Ch 04, grammar |
| ST-05 | Parse a missing `)` followed by two independent valid declarations. | One bounded syntax diagnostic names the opener and recovery point; both later declarations remain discoverable but poison never becomes typed. | R4.7, AC-05; Spec 4 grammar, Ch 14 |
| ST-06 | Compile three files contributing modules `A` and `B`, with qualified aliases, declaration-only cycle, one reachable `main` and shuffled filesystem order. | The same graph, symbols, initializer order and diagnostics result for every file order; filenames do not define modules. | R4.8, AC-06; Spec 4 Ch 10 |
| ST-07 | Compile a function whose parameter is redeclared in its outer body, whose child block legally shadows it, and whose `for` body shadows its header variable. | Outer redeclaration emits E10003 with both locations; child shadows are legal and resolve to distinct stable identities. | R4.9, AC-06; Spec 4 Ch 03, Ch 05 |
| ST-08 | Trigger each RD-04-applicable active Chapter-14 diagnostic once, plus legal shadowing and retired E10101 probes. | Every applicable active code has exact public fields/order; legal shadowing and E10101 emit nothing; no implementation-only code appears. | R4.10, AC-07; Spec 4 Ch 14 |
| ST-09 | Run `check` through CLI and language server on the same invalid snapshot. | Diagnostics are byte-for-byte equivalent and neither boundary imports machine/artifact/emulator code. | R4.53, AC-39, AR-P7 |
| ST-10 | Build a project with one lexical, semantic, layout or ACME error in separate probes. | Each probe returns failure and publishes no current runnable generation or stale-success pointer. | R4.4, AC-03, AC-35 |

### Scalars, Enums, Expressions and Control Flow

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-11 | Type-check the full scalar/enum promotion, cast, assignment and compound-assignment matrix. | Legal cells produce the exact resulting type/conversion; illegal cells emit their canonical diagnostic; enum identity remains nominal. | R4.11, R4.19, AC-08; Spec 4 Ch 02, Ch 09 |
| ST-12 | Compare `const w: word = byte(250) + byte(10);` with `let w: word = byte(250) + byte(10);`. | Constant value is 260; runtime expression wraps at byte width to 4 before widening. | R4.12, AC-09; Spec 4 Ch 02 |
| ST-13 | Execute `a[f()] += g()` where both functions append to an observation log. | Order is `f`, old target read, `g`, one operation, one store; the assigned value is returned without reloading. | R4.13, R4.14, AC-10; Spec 4 Ch 04 |
| ST-14 | Execute false `left && effect()`, true `left || effect()` and both values of `flag ? yes() : no()`. | Unselected calls and effects occur zero times; selected effects occur once in source order. | R4.13, AC-10; Spec 4 Ch 04 |
| ST-15 | Evaluate signed extrema, every shift-count boundary, signed comparison and signed quotient/remainder pairs. | Results match the fixed-width Specification 4 reference, including truncation toward zero and saturated wide shifts. | R4.14, AC-09; Spec 4 Ch 02, Ch 04 |
| ST-16 | Divide by constant zero, runtime zero with checks off and runtime zero with checks on. | Constant errors; unchecked sequence terminates with bounded effects/valid-width bits; checked sequence stops before division at `SEI` plus self-loop with no runtime data. | R4.15, AC-11; Spec 4 Ch 04, Ch 15 |
| ST-17 | Run `for (let i: word = 0; i < 3; i += 1)` with `continue`, `break`, child shadow and omitted-clause variants. | Exact header/body scopes and iteration/update edges result; `continue` reaches update, `break`/`return` skip it, omitted condition is true. | R4.16, AC-12; Spec 4 Ch 05 |
| ST-18 | Compile the canonical byte wrap trap and an explicit ring cursor. | Only the proved finite-looking wrap trap emits E10262; the deliberate modular cursor remains legal. | R4.16, AC-12; Spec 4 Ch 05 |
| ST-19 | Switch on an enum with multi-value cases, terminal fallthrough, nested loop exit and one default. | Cases evaluate once in source order, auto-break unless terminal fallthrough is present, and invalid duplicate/default/type cases diagnose exactly. | R4.17, AC-13; Spec 4 Ch 05 |
| ST-20 | Read a nonzero uninitialized local array on one path and assign only a may-alias range on another. | W10141 appears at declaration, W10190 at possible read, and no blanket clear or false strong-update credit appears. | R4.18, AC-14; Spec 4 Ch 03, Ch 08, Ch 11 |

### Arrays, Strings, Structs, Addresses and Aggregate Values

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-21 | Declare zero/max extents, inferred arrays, nested rectangular arrays and arrays of structs; query every `length` level. | Legal shapes have exact row-major sizes/counts; invalid extent/object sizes emit E10264/E10265; each fixed `length` is word-typed and exact. | R4.20, AC-15; Spec 4 Ch 08 |
| ST-22 | Index `byte[500]` with byte `i=255` using `i+10`, `i<<1`, stored byte result and explicit `byte(...)` barrier. | Direct operations denote word ordinals 265/510; stored/cast barriers retain byte wrap; constant 510 emits E10240. | R4.21, AC-16; Spec 4 Ch 04, Ch 08 |
| ST-23 | Access a word element whose unchecked effective low byte is `$FFFF`, then repeat with bounds checks enabled and a negative signed index. | Unchecked access continues low-first across `$FFFF->$0000`; checked access tests lower/upper bounds before address formation and stops on failure. | R4.22, AC-16; Spec 4 Ch 08, Ch 15 |
| ST-24 | Compile default screen-code `"AZ0 £↑←"`, lower/upper screen and PETSCII sentinels, unsupported scalar and unsupported map. | Exact specified bytes/maps result, no terminator or VIC write appears, and unsupported cases emit E10249/E10125 without substitution. | R4.23, AC-17; Spec 4 Ch 08, Ch 15, Appendix C64 |
| ST-25 | Define nested packed structs, an array of them, `sizeof`, `offsetof`, field address and a containment cycle. | Offsets/sizes follow declaration order with no padding; fields are addressable; the cycle and equality probes diagnose exactly. | R4.24, AC-18; Spec 4 Ch 07 |
| ST-26 | Assign overlapping fixed arrays/structs and use the assignment as an expression. | Destination equals the original source value under overlap, result equals the assigned value, and each source effect occurs once. | R4.25, AC-19; Spec 4 Ch 07, Ch 08, Ch 11 |
| ST-27 | Pass the same array to mutable/const exact and `T[]` parameters, forward it, query runtime length and attempt transitive writes. | Exact ABI carries two address bytes; unsized carries address plus word count; const forwarding is zero-cost and writes reject; scalar `const` rejects. | R4.26, AC-20; Spec 4 Ch 08 |
| ST-28 | Take `&local.field[i]`, derive/copy/cast/select/`lo`/`hi` parts, pass to a proved non-retaining call, then separately return/store/publish it. | Place evaluates once; legal contained borrow extends liveness; provenance survives derivations; first escape emits E10260; loaded data has no address provenance. | R4.27, AC-21; Spec 4 Ch 04, Ch 11 |
| ST-29 | Apply each legal `place(...)` owner/constraint and declare a local/module `loadable const`; attempt ordinary read/address/pass and resident-profile transfer. | Symbolic constraints reach layout; invalid conflicts diagnose; loadable ordinary uses reject and transfer reports unavailable without emitted loader. | R4.28, AC-27; Spec 4 Ch 03, Ch 13 |

### Calls, Function Values, ABI, SFA and Interrupt Domains

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-30 | Execute `f(1, f(2, 3))`, cross-module calls and calls with scalar/aggregate arguments/results. | Left-to-right staging preserves outer values, ABI homes/clobbers are exact, and no source parameter limit/workaround appears. | R4.29, AC-22; Spec 4 Ch 06 |
| ST-31 | Return a nested aggregate directly, through another call and into overlapping caller storage. | Caller-owned destination survives nested calls; direct construction occurs when legal; otherwise the alias-safe snapshot/copy preserves the source. | R4.25, R4.41, AC-19, AC-31; Spec 4 Ch 06, Ch 11 |
| ST-32 | Store/select/pass/return/call an exact-signature function value whose target set is one function. | Source identity survives and call devirtualizes to that function with no registry/dispatcher. | R4.30, AC-23; Spec 4 Ch 06 |
| ST-33 | Merge two compatible address-taken functions, then erase provenance and try raw-word conversion. | Finite compatible set uses the predefined dispatch; safe widening includes all exact-signature address-taken functions; erased/raw word is rejected. | R4.30, AC-23; Spec 4 Ch 06 |
| ST-34 | Compile direct, mutual and finite-indirect recursion plus repeated sequential and nested calls. | Each recursive SCC reports its complete cycle before allocation; non-overlapping calls remain legal. | R4.31, AC-24; Spec 4 Ch 06 |
| ST-35 | Install one interrupt function into qualified firmware and raw sinks. | Only required entry variants emit; callback kind is enforced; firmware path avoids double-save and uses its declared terminal owner. | R4.32, AC-25; Spec 4 Ch 06, Ch 15, Appendix C64 |
| ST-36 | Enter raw/default-chain interrupt paths with D set and observe A/X/Y/P, stack and terminal behavior. | Generated body sees D clear; interrupted/chained state is restored exactly; raw ends `RTI`, ordinary callback ends `RTS`; all stack bytes are reported. | R4.32, R4.41, AC-25; Spec 4 Ch 06, Appendix C64 |
| ST-37 | Exercise nested install/restore across agreeing/disagreeing joins, raw-vector invalidation and `$xxFE/$xxFF` predecessor placement. | Balanced top-matching paths pass; disagreements, invalidated restore and unsafe `$xxFF` placement diagnose; no lifecycle runtime state appears. | R4.32, AC-25; Spec 4 Ch 06, Ch 15 |
| ST-38 | Access one shared byte RMW and one shared word from mainline and IRQ; call a shared helper with live scratch. | Lost-update/tearing warnings are precise; globals stay shared; invocation-private helper homes are disjoint or a finite-resource diagnostic results. | R4.32, R4.40, AC-25, AC-31; Spec 4 Ch 06, Ch 11 |
| ST-39 | Force each parameter/result/local/temp/spill/pointer/helper/domain home and then request one byte after closure. | Every legitimate home appears in SFA/interference/cost evidence; post-closure invention is rejected or returns to bounded closure. | R4.40–R4.42, AC-31, AC-32; Spec 4 Ch 11 |

### Compile-Time Functions, Intrinsics and Embed

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-40 | Evaluate acyclic typed `comptime` functions returning scalar, struct and table values using `sin8/cos8/sin16/cos16`. | Exact frozen constants result and no target code/storage/helper for evaluation appears. | R4.33, AC-26; Spec 4 Ch 06, Ch 04 |
| ST-41 | With reduced internal limits, execute exact N/N+1 step, byte and depth cases plus an unselected infinite branch. | N succeeds; N+1 fails before mutation with E10269/E10270/E10271; unselected branch is uncharged; no partial artifact appears. | R4.33, AC-26; Spec 4 Ch 06 |
| ST-42 | Use variable-address `peek/poke/peekw/pokew`, `lo/hi`, `sizeof/offsetof/length` and a selected profile-fact branch. | Addresses/values evaluate once, word bytes are low-first across wrap, query widths are word, and the unselected profile arm emits no runtime code. | R4.34, AC-28; Spec 4 Ch 04, Ch 12, Ch 15 |
| ST-43 | Exercise all five CPU controls through balanced/unbalanced status-stack paths and try every removed opcode-shaped spelling. | Exact machine/stack effects result; joins/exits require balanced function-local status depth; removed spellings resolve as ordinary unknown names. | R4.35, AC-28; Spec 4 Ch 12 |
| ST-44 | Run byte/word `bcd_add/sub` with valid constants, an invalid constant nibble and runtime-invalid digits. | Valid results are modulo 100/10000 with owned carry/no-borrow and D-clear exit; invalid constant emits E10254; runtime case matches selected NMOS behavior. | R4.35, AC-28; Spec 4 Ch 12 |
| ST-45 | Embed a contained raw file twice via canonical-equivalent paths, then use traversal, registered-native extension and malformed selector probes. | Raw bytes deduplicate to one symbolic object; traversal rejects; registered formats do not fall back to raw; later RD-06 selectors report honest unavailability. | R4.36, AC-29; Spec 4 Ch 13 |

### Machine Output, Artifacts and Closeout

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-46 | Assemble every semantic family fixture under `optimization: none` with ACME `--cpu 6502`. | All output uses documented NMOS instructions/addressing, explicit flag assumptions and legal repaired branches; no CMOS/undocumented opcode appears. | R4.43–R4.46, AC-33 |
| ST-47 | Seed optional rewrite/candidate/peephole hooks while compiling a legal program under `none`. | Optional hooks remain uncalled and decision evidence stays empty; mandatory selection/SFA/layout/emission still completes. | R4.46, AC-34, AR-P4 |
| ST-48 | Build one complete program exercising code, globals, user ZP, SFA, constants, asset, helper, placement and branch repair. | ACME bytes reconcile with one coherent PRG and complete deterministic memory/cost/debug/build evidence; no ranges overlap. | R4.47, AC-35 |
| ST-49 | Mutate value, effect order, alias result, flag, check boundary and interrupt return in isolated oracle controls. | Each independent behavior oracle fails its corresponding mutation even when assembly shape or another compiler path agrees. | R4.50, AC-36 |
| ST-50 | Compare each family fixture with its equal-contract hand-written assembly/frontier. | Generated result is better or equal in every local cost dimension; equal files actionable parity debt; worse blocks qualification. | R4.51, AC-37, AR-P4 |
| ST-51 | Select an RD-05 API, RD-06 native format, RD-07 transfer and unknown future target. | Each reports its exact unavailable/unknown capability and emits no stub, package or support score. | R4.48, AC-38, AR-P1 |
| ST-52 | Scan shared representations for C64 addresses/device assumptions and exercise symbolic bank/space/transfer/clock fields. | Core semantics stay target-neutral while later target facts remain representable; no speculative target package exists. | R4.54, AC-41 |
| ST-53 | Complete all family tests, ACME cases and the bounded sequential VICE corpus on Linux. | One closeout run is green and recorded as `VICE-verified / hardware-unverified`; missing native Windows evidence remains assigned to RD-10. | R4.52, AC-40, AR-P3, AR-P5 |
| ST-54 | Re-scan the ambiguity register, RD Won't Have, `future-considerations.md` and v4 expressiveness ledger after implementation. | Every expired rationale has a named owner/backlog row; the ledger gate fails if a recorded restriction disappears without retirement; no rollout deferral points at closed RD-04. | R4.54, AC-42, AR-P9 |

## Test Categories

### Specification Tests

| Test Area | ST Cases Covered | Location |
|---|---|---|
| Authority/frontend | ST-01–ST-10 | Co-located frontend/project/CLI/LSP specs plus `test/rd04/normative-coverage.spec.test.ts` |
| Values/control | ST-11–ST-20 | Co-located frontend/semantic/machine specs |
| Aggregates/memory | ST-21–ST-29 | Co-located frontend/semantic/storage/machine specs |
| Calls/SFA/domains | ST-30–ST-39 | Co-located semantic/storage/machine specs |
| Compile-time/intrinsics | ST-40–ST-45 | Co-located frontend/semantic/machine/assets specs |
| Qualification | ST-46–ST-54 | Root `test/rd04/*.spec.test.ts` |

### Implementation Tests

| Test Area | Description | Priority |
|---|---|---|
| Parser recovery | Depth/error budgets and synchronization internals | High |
| Flow/call closure | Fixed points, deterministic ordering and malformed graphs | High |
| SFA closure | Fingerprints, interference, allocation and feedback convergence | High |
| Machine binding | Spill/helper discovery, validation and branch repair internals | High |
| Evidence/publication | Malformed tool output, reconciliation and owned cleanup | High |
| Compile-time evaluator | Meter accounting, lifetime release and poisoning internals | High |

### Integration Tests

| Test | Components | Description |
|---|---|---|
| Public check identity | Compiler, CLI, LSP | Same snapshot and diagnostics |
| Public build | Compiler, ACME, layout, publication | Complete successful and failing generations |
| Family runtime | Compiler, ACME, VICE, oracle | Small sequential PRGs by semantic family |
| Expert comparison | Compiler artifacts, hand references | Equal-contract bytes/cycles/resources |

### End-to-End Tests

| Scenario | Steps | Expected Result |
|---|---|---|
| Complete core-language closeout | Build family projects, assemble, run bounded VICE cases, validate sidecars/crosswalk | All Linux evidence green with only AR-P5 native Windows deferral |
| Terminal failure | Inject one error at each pipeline stage | No current runnable artifact or stale publication |

## Test Data

### Fixtures Needed

- Minimal multi-file Blend65 projects grouped by the nine execution phases.
- Exhaustive selected C64 character maps and scalar sentinels.
- Raw embedded byte fixtures with canonical path aliases and invalid path cases.
- Hand-written equal-contract NMOS routines and cost records per machine family.
- Fixed VICE input/state traces with independent expected memory/MMIO/register outcomes.

### Mock Requirements

No compiler stage is mocked. Temporary project directories are real. ACME and VICE are external
processes exercised by the existing bounded drivers. Pure tool-output parser error cases may use
fixed byte/text fixtures.

## Security Tests

- Reject absolute paths, traversal, symlink escape, device files and output overlap.
- Bound source nesting, diagnostics, compile-time steps/storage/depth, subprocess output and VICE
  protocol frames/waits.
- Prove source/project content cannot inject shell, ACME arguments/directives, monitor commands,
  scripts or plugins.
- Prove compile-time functions cannot access filesystem, network, environment, time, randomness or
  processes beyond already validated embedded input.
- Prove LSP analysis launches no process and publishes no telemetry/network service.

## Verification Checklist

- [ ] All ST cases have requirement/spec/AR sources.
- [ ] Specification tests are written before their implementation family.
- [ ] New spec tests fail for the missing capability or document a justified pre-existing pass.
- [ ] Implementation makes the immutable spec tests pass.
- [ ] Implementation tests cover algorithmic edges and malformed internal state.
- [ ] Focused family qualification passes before each phase closes.
- [ ] Generated behavior and expert-output expectations are independent.
- [ ] Full repository and bounded ACME/VICE closeout verification passes on Linux.
- [ ] `spec/` remains unchanged and touched files pass Prettier/whitespace checks.
- [ ] Native Windows evidence remains explicitly owned by RD-10.
