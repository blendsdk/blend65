# SFA Wiring: RD-18 Slice 5a — User Functions, Parameters & Calls

> **Document**: 03-02-sfa-wiring.md
> **Parent**: [Index](00-index.md)
> The adapter feed (parameters + callees), the AR-3 argument-window interference channel,
> and the Phase-0 data-region relocation + overlap guard (AR-2). The SFA *passes* need no
> changes — they already implement params-first frames, interference, and coloring
> (02-current-state §SFA).

## 1. Adapter: parameters (`frontend/src/sfa/model-adapter.ts`)

`modelToFunctionInfo` currently hardcodes `parameters: []` (line 50). Change:

- Project the function body scope's `kind === "parameter"` symbols, in insertion order
  (03-01 §2 inserts params before locals), as `FrameVar { name, type, byRef: false }`.
- `collectLocals` (lines 121-129) keeps filtering `kind === "variable"` — parameters are
  now a separate projection, so locals and params never double-count.
- `frame-computation.ts` then lays out params first + locals after automatically
  (`:51-76`), and `symbols.ts` emits `__frame_<FQN>_<param>` slot symbols — the exact
  addresses the caller stores into (03-03).

## 2. Adapter: callees (`model-adapter.ts` + `core/src/sfa/function-info.ts`)

- `callees: []` (line 55) becomes the FQN projection of `model.callGraph.edges` for this
  function: `edges.get(fn) → fqName(callee)[]`, sorted lexicographically for determinism.
- `isEscaped` stays `false` (no `&fn` until Slice 8); `isReachable` stays `true` for all
  (liveness/W10181 named-deferred, AR-11) — unreachable functions cost frame bytes, which
  is correct-but-unoptimized (RD-18 charter).
- The `isMain` name heuristic in `interference.ts:35-37`/`stack-analysis.ts:29-31` is left
  as-is (safe: E10021 guarantees a single `main` program-wide); noted for a cleanup slice.

## 3. Argument-window interference (AR-3)

**Why:** `interference.ts` edges are ancestor-descendant only; `coloring.ts` may alias
sibling frames. In `main → f(1, g())` with `g → h`, `f` and `h` are siblings — their frames
may share bytes, and `g()`'s execution (running *between* the store of `f`'s first arg and
the `JSR f`) can clobber `f`'s already-stored arg slot. The challenger proved the
reachability-only guard unsound; the fix is interference, so the common shape *compiles
correctly* instead of being deferred.

**Channel:**

- `FunctionInfo` gains `argWindowInterferes: readonly string[]` (FQNs;
  `core/src/sfa/function-info.ts`) — "while this function's arguments are being marshalled,
  these functions may execute."
- **Frontend computation** (in the adapter, from the model): for every call site of callee
  `C`, for every call expression nested inside `C`'s argument list **after the first
  argument** (the first arg is stored before anything else can run — AR-3 resolution note),
  add `reach(G)` (visited-set-bounded DFS over `callGraph.edges` from each nested callee
  `G` — must terminate on ANY input, cyclic included, even though cycles are gated
  upstream; PF-002 defense-in-depth) to `C.argWindowInterferes`. Deterministic: sorted,
  deduped.
- **Planner consumption** (`frontend/src/sfa/interference.ts`): after the existing
  ancestor-descendant pass, union `argWindowInterferes` pairs into the undirected edge set
  (skip self-pairs — the same-callee residual is 03-03's ICE, AR-3). No coloring changes.
- Collecting the nested calls: walk each argument expression's subtree for `CallExprNode`s
  whose callee resolved to a user function (the model's `symbolOf` provides this — the
  established Proxy-visitor pattern from `intrinsic-validation.ts:349-374`).

## 4. Phase 0: data-region relocation + overlap guard (AR-2)

Sequenced FIRST (challenger H5): one address change, one golden re-mint, base frozen for
the slice.

### 4.1 Base move

- `core/src/semantics/platform-profile.ts:72`: `ramStart: 0x0800` → `0x2000`. Module vars
  land at `$2000`, frames follow (`plan-allocation.ts:96-99`) — ~6.1 KB of code room above
  `$080D`, 32 KB of data below `$A000`; in-repo precedent `platforms/src/a800xl.ts`
  (`ramStart: 0x2000`). The RAM budget (E10033) derives from `ramEnd − ramStart`
  automatically.
- Re-mint all five goldens (`UPDATE_GOLDEN=1`, `test/golden/*.asm.golden`) — only
  `__var_*`/`__frame_*` equate values change — and re-verify each fixture on local VICE
  (gate `$D020`, slice3a, slice3b `$C000..$C002`, slice4a `$C000/$C001`, slice4b
  `$C000/$C001`). This closes the Slice-3b AR-1/SR-3 deferred fix.

### 4.2 Mandatory post-ACME overlap check

- New check alongside `checkBinaryBudget` (E10034 seam, `core/src/report/`): given the
  binary's load address + size. **Input reality (PF-003):** `size` is the existing
  header-EXCLUDED `binarySize` (`invoke-acme.ts` computes `statSync(...).size − 2`); the
  load address is NOT read back today — derive it from the PRG's first two bytes
  (little-endian; the raw bytes are already in hand at `build.ts:92-93`) or return it
  from `invokeAcme`/`emitBinary`. Assert
  `loadAddress + size <= dataBase`, where **`dataBase` comes from the allocation plan**
  (`min(moduleVariables base, frameRegionBase)` = `profile.ramStart` as planned — exposed
  off `AllocationPlan`, NOT re-read from a constant). Violation → error diagnostic on the
  existing budget-code band (reuse `E10033 RamBudgetExceeded` with an overlap-specific
  message — no new code; the condition IS a RAM-placement failure). Wired unconditionally
  into `build()` (AR-2: mandatory, not optional).
- Keyed-off-the-plan is load-bearing (challenger H3): the canonical `c64Profile.ramStart`
  is `$0801` (== code start); when per-platform semantic profiles are wired later, this
  check is what fails loudly instead of silently clobbering code again.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Code end exceeds the plan's data base | E10033-band error post-ACME, build fails, no binary reported OK | AR-2 |
| Cyclic `callees` reaching the planner | prevented upstream: E10174 poisons the model; `run-frontend` gains a NEW driver-level gate (none exists today) skipping the whole `planAllocation(…)` call — inline `modelToFunctionInfo` argument included — on `hasErrors` (ordering witness ST-24); all new reachability DFS walks are visited-set-bounded as defense | AR-7 / PF-002 |
| Self-pair in argument-window edges | skipped (same-callee residual is the 03-03 ICE) | AR-3 |

## Testing Requirements

- Spec tests: 07 ST-01..ST-04 (Phase-0 goldens + overlap check) and ST-21..ST-24 (adapter
  param/callee projection, arg-window interference disjointness, pre-SFA poison ordering).
- Impl tests: FrameVar ordering (params before locals), `argWindowInterferes` determinism,
  reach() on diamond call graphs, overlap check boundary (`==` exactly at dataBase).
