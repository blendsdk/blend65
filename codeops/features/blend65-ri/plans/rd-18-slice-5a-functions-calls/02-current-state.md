# Current State: RD-18 Slice 5a — User Functions, Parameters & Calls

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> Grounded by three parallel recon agents (frontend semantics / SFA / codegen) + one
> independent challenger, 2026-07-10. Every claim carries a `file:line` verified that day.

## Existing Implementation

### Frontend semantics (`packages/frontend/src/semantics/`)

- **Function collection** (`function-collection.ts`): builds one `module` scope per program
  + one flat `function` body scope per function; collects function symbols (kind
  `"function"`/`"interrupt"`, module-scope-homed for FQN recovery, lines 82-93) and body
  locals (`let` + for-counters, lines 129-178). **Parameters are never collected** — the
  `"parameter"` `SymbolKind` and `byRef` flag exist unused (`core/src/semantics/symbol.ts:21-30,53`).
  Function symbols carry `ERROR_TYPE` (line 85) — no signature type exists anywhere.
- **Call typing**: `computeType` handles only literals/ident/binary/assign/intrinsic-call;
  **user `CallExpr` hits the `default` arm and poisons silently — no diagnostic, no arg
  checks** (`type-check/expression-typing.ts:70-94`, esp. 89-92). The only code touching
  `CallExprNode` is the T4 boundary, which explicitly bails on user calls
  (`intrinsic-validation.ts:239-241`).
- **Return typing** (`type-check/statement-typing.ts:470-485`): knows the enclosing return
  type (threaded parameter); emits only E10173 (value in void fn). `return;` in non-void is
  unchecked (E10172 unwired); return-type mismatch is unchecked (no `checkAssignable` call).
- **Call graph** (`analyze.ts:117-140`): `callGraph.functions` populated; **`edges: new
  Map()`, `findCycles: () => []`** with the in-code note "user calls are wired in later"
  (`analyze.ts:114-115,123-127`; `core/src/semantics/call-graph.ts:15-28,40`).
- **Imports**: `ImportStmtNode {symbols, modulePath}` parsed (dotted paths,
  `parser.ts:194-242`); consumed ONLY by the T4 intrinsic boundary (E10046,
  `intrinsic-validation.ts:227-285`). No import→symbol resolution, no E10012, no module
  merging (fresh module scope per file, `function-collection.ts:72-74`). **`as` aliasing is
  not lexed** (no `KwAs` in `core/src/tokens/token-kind.ts:25-56`).
- **Post-check** (`post-check.ts`): main validity (E10020/E10021/E10022) + all-paths-return
  (E10102) wired; **E10023 explicitly deferred "until call sites exist"** (line 9).
- **Registry** (`core/src/diagnostics/diagnostic-codes.ts`): E10170 `WrongArgCount`,
  E10171 `ArgTypeMismatch` (used today only for intrinsic literal-range), E10172
  `MissingReturnValue`, E10174 `RecursionDetected`, E10175 `TooManyParameters` (dead per
  FN-11), E10012 `ImportNonExported`, E10023 `CallingMainDirectly` — all registered,
  unwired for user calls. **E10051 is absent** (mint per AR-10). Chapter-table numbering in
  `spec/06-functions.md:676-693` is stale drift vs this registry (AR-5/AR-9 record it).

### SFA (`packages/frontend/src/sfa/`, `packages/core/src/sfa/`)

- **Complete and fixture-tested**: params-first frame layout with by-ref slot sizing
  (`frame-computation.ts:29-76`; `FrameSlot.kind: "parameter"|"local"`,
  `core/src/sfa/frame.ts:23-34`), ancestor-descendant interference (`interference.ts:45-111`),
  interval frame coloring (`coloring.ts:77-112`), stack analysis + W10180
  (`stack-analysis.ts`, `budgets.ts:91`), ZP allocator with the `__zp_arg_0..3` /
  `__zp_tmp_0..3` / `__zp_irq_tmp_0..1` runs (`zp-allocator.ts:152-223`).
- **Starved by the adapter**: `modelToFunctionInfo` fills `parameters: []`, `callees: []`,
  `isEscaped: false`, `isReachable: true` (`model-adapter.ts:44-59`). `FunctionInfo`
  already carries all needed fields (`core/src/sfa/function-info.ts:44-59`).
- **Symbols**: `__frame_<sanitized FQN>` base + `__frame_<FQN>_<slot>` per slot;
  `__var_<Module>_<name>`; deterministic emission order (`symbols.ts:44-85`). The
  `sanitize` scheme matches `lower.ts`'s `frameSymbol` exactly.
- **Addresses**: `frameRegionBase = profile.ramStart + moduleLayout.totalSize`;
  `DEFAULT_PROFILE.ramStart = 0x0800` (`core/src/semantics/platform-profile.ts:72`);
  budget checks $A000−$0800 (`plan-allocation.ts:134`, `budgets.ts:63`) — **nothing guards
  the live-code boundary at `$080D`** (the 13-byte ceiling, roadmap 3b AR-1/SR-3).
  `run-frontend.ts:153-174` feeds `DEFAULT_PROFILE`, not `plugin.profile` (per-platform
  semantic profiles deferred; the canonical `c64Profile.ramStart` is `$0801` == code start,
  so the overlap would return with that switch — AR-2's check must key off the plan).

### Codegen (`packages/codegen/src/`)

- **IL vocabulary ready**: `call` op `{op:"call"; dest?; target; args}` and `ret`
  terminator `{kind:"ret"; value?}` defined and printable (`il/instruction.ts:51,126-132,
  163`; `print-il.ts:121-125,169+`). `ILProgram.initCode` exists, empty (`cfg.ts:82-91`).
- **Lowering** (`il/lower.ts`): iterates ALL functions (136-156); params are already
  frame-slot `Location` operands (171-173); `return` lowers to `ret` (252-259); locals vs
  module-vars discriminated via `model.symbolOf` (928-937). **`lowerCall` ICEs on any user
  call** (594-603, `iceUnsupported` at 602).
- **Translate** (`instr/translate.ts`): multi-block `run()` with `prescanAll` +
  `resetBlockState` (173-238); `readOperands` already handles `call` args (1001-1003);
  callee return ABI done — `ret` → `bringValueIntoRegisters` (A / A:X) + `RTS`/`RTI`
  (364-370); `translateStore` word path is the arg-store primitive (421-432); `JSR` exists
  (`marshalAndCall`, 839-889 — the `__rt_*` register/ZP-arg ABI, a *different* convention
  from user frames). **No `case "call"`** — falls to the `default` ICE (303-305).
- **Emission**: per-function streams in `ilProgram.functions` order
  (`instr-program.ts:67-94`); serializer emits each under `; --- function: <symbol> ---`
  (`serialize-acme.ts:110-116`); runtime dead-strip keys on registered routine symbols only
  (`runtime/embed.ts:56-82`) — user `JSR Module_function` targets are unaffected.
  **Startup emits `JSR _main`** (terminating variant, `platforms/src/shared-hooks.ts:82-104`)
  — the spec fall-through note is handled per AR-12.
- **Fixture/golden pattern**: `examples/<slice>/main.blend` + `testing/<slice>.ts`
  (`build*`/`emitAsm*`, `sourceFiles` array — multi-file capable) + byte-exact golden +
  `skipIf(!hasVice||!hasAcme)` runtime suite (see `testing/slice4b.ts`,
  `golden-slice4a.spec.test.ts:29-36`).

## Gaps Identified

| # | Gap | Current | Required | Owning spec |
|---|-----|---------|----------|-------------|
| G1 | Parameters never collected | `FunctionDeclNode.params` ignored | `parameter` symbols + types in function scope; E10003/E10101 | 03-01 §2 |
| G2 | User calls untyped | silent poison | full call typing (E10170/E10171/E10175/E10051/E10023) | 03-01 §3 |
| G3 | Return completion | only E10173 | E10172 + mismatch via checkAssignable | 03-01 §4 |
| G4 | Call graph empty | `edges: new Map()`, stub cycles | Pass-3 edges + Tarjan + E10174, pre-SFA poison | 03-01 §5 |
| G5 | No user-import resolution | T4-only | exported-function imports + E10012 + precedence | 03-01 §6 |
| G6 | Adapter starves SFA | `parameters: []`, `callees: []` | project both + arg-window interference | 03-02 |
| G7 | 13-byte ceiling unguarded | data base $0800, no check | base $2000 + mandatory overlap check (Phase 0) | 03-02 §4 |
| G8 | `lowerCall` ICEs on user calls | `lower.ts:602` | store-per-arg convention + `call` emission + AR-3 guard | 03-03 §2 |
| G9 | translate lacks `case "call"` | default ICE | `JSR` + A/A:X bind + AR-4 live-temp guard | 03-03 §3 |

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Sibling-frame aliasing miscompiles call-in-arg shapes | High (without AR-3) | High — silent wrong binary | AR-3 argument-window interference edges + residual ICE |
| Live-temp-across-call miscompile (`f()+g()`) | High (without AR-4) | High — silent wrong binary | AR-4 translate-time detection → ICE |
| Data region overwrites code | Certain past 13 B | High | AR-2 Phase-0 base move + mandatory overlap check |
| Coloring on a cyclic call graph | Med | High | AR-7 pre-SFA poison ordering |
| Golden churn from address moves | Certain | Low | AR-2: one re-mint in Phase 0, base frozen for the slice |
| E10171 shared with intrinsic literal-range usage | Low | Low | same registered name/meaning; messages differ per call site |

## Dependencies

- **Internal**: RD-18 Slices 3a/3b/4a/4b (shipped model/typing/CFG machinery); RD-05 SFA
  passes; RD-07a/b Instr + translate; RD-09/RD-15 build pipeline (E10034 seam for the AR-2
  check); RD-12 harness (goldens + VICE).
- **External**: ACME + VICE 3.10 locally for the acceptance bar (CI runs the golden tier
  only, AR-27 unchanged).
