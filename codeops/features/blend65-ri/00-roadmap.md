# Blend65 Compiler — Implementation Roadmap

> **Purpose**: The single living tracker of *what is implemented* and *what comes next*
> for the Blend65 compiler (`blendc`). This is the implementation counterpart to
> `requirements/README.md` (the RD index) and `spec/build-plan.md` (the spec build plan,
> already complete).
>
> **This file lives at `codeops/features/blend65-ri/00-roadmap.md` and is authoritative for
> implementation status** (rolled up into the portfolio roadmap `codeops/00-roadmap.md`).
> It is governed by the `roadmap` skill — read it at the start of every task and update it
> whenever an RD reaches 100%.
>
> **Last Updated**: 2026-07-11 (**RD-18 Slice 6 ✅ COMPLETE (exec_plan 52/52)** — the full
> expression system ships end-to-end, **closing RD-18 AC-5**. Typing: the complete binary matrix
> (comparisons/logical/bitwise/shifts joining arithmetic) with TS-4 mixed-width promotion under
> ONE `isAssignableTo` rule (args/returns too — the 5a strict-arg interim superseded with the two
> core value-shaped pins flipped per spec §5.3/TS-4), unary `- ! ~` (E10087 negate-unsigned),
> FR-40 casts (E10086 boolean↔integer, E10155 void/aggregate), ternary (E10134/E10088), TS-17
> compound assignment, lo/hi word-context args, W10160/W10161 at all four consuming sites +
> W10101 + W10174. Const-eval: optional per-node type lookup; two's-complement `toBits`/`fromBits`;
> width folds for `~`/shifts/casts/negative-operand bitwise; comparisons; LAZY `&&`/`||` and
> selected-arm-only ternary (an unevaluated-side divByZero never surfaces); `const M: byte =
> $FF & $0F` inlines as $0F. Lowering: synthetic `0sc<N>` SFA slots collected in preorder
> (per-function + `__init` pseudo-frame) with name AND byte-size parity guards; short-circuit/
> ternary value diamonds (the rhs/arm code sits in its own branch block — the GUARANTEE is
> structural); comparisons stamped with the promoted OPERAND type at ALL THREE emission sites
> (fixing the latent DEF-1 word-compare low-bytes-only miscompile); signed `/`/`%` → loud
> rejection; compound desugar (single store); non-const `lo`→trunc / `hi`→storage-location+1
> read (sign-correct for sword); coerce (zext/sext by source sign, trunc, immediates re-encode
> free). Translate: all four byte/word × unsigned/signed comparison framings (N⊕V dance for
> signed; high-first chain for word-unsigned; flag-fresh materialization everywhere), neg/not
> (8+16), zext as a ZERO-cost fold (lo from source home, hi #$00), the pinned branch-free sext
> sequence, trunc, copy, word + variable-count shifts (X-loop with BEQ zero guard; arithmetic
> shr seeds carry via CMP #$80). **3-part bar GREEN on real VICE 3.10**: `examples/slice6/
> main.blend` → `$C000..$C008 = E7 04 DA 05 07 00 01 44 00` incl. the short-circuit suppression
> proof ($C005=$00 — bump() provably not called on two short-circuit paths; $C006=$01 — then ran
> exactly once); 293-line golden with EIGHT `0sc` frame equates; all six prior goldens byte-exact
> NO re-mint; nine negatives/advisories via the public facades. Second latent defect fixed en
> route: printInstr rendered accumulator ops as `ASL A` — ACME parses the `A` as an undefined
> symbol; exposed by the fixture's first real assembly of an accumulator op; now the bare
> mnemonic (no committed golden carried one → zero re-mints). SR-2 delta: 30 B RAM data at
> $2000 (1 B module var + 29 B frames incl. 8 B synthetic slots), ZP 10 B unchanged, binary
> 535 B, no new runtime routines. RD-04 ledger advanced (R31/R32/R33, R41–R43 + R40 drift note,
> R49–R55). Full verify green; `spec/` clean. **Next: Slice 7** (arrays/structs/enums) needs
> `make_plan`; then Slice 8; RD-13/RD-14 remain queued.)
> Prior: 2026-07-11 (**RD-18 Slice 6 🔄 Executing (exec_plan)** — execution started
> on the preflighted plan (6 phases / 52 tasks, auto-commit per phase); progress tracked in
> `plans/rd-18-slice-6-expressions/99-execution-plan.md`. Closes RD-18 AC-5 on completion.)
> Prior: 2026-07-11 (**RD-18 Slice 6 🔬 Plan Preflighted** — preflight iteration 1:
> 1 critical / 3 major / 6 minor / 3 observations — ALL 13 resolved per recommendation, fixes
> applied (✅ PASSED; `plans/rd-18-slice-6-expressions/00-preflight-report.md`; every 🔴/🟠
> verdict hardened by an independent challenger). 🔴 the DEF-1 operand-type fix covered only
> `lowerBinary` — but `compareCounter` (`lower.ts:583`, the for-loop predicate = the plan's
> OWN motivating repro) and `lowerSwitch`'s dispatch `eq` (`lower.ts:517`; word/sword
> discriminants are legal) also stamp `IL_BYTE`; the plan now stamps ALL THREE sites (byte
> operands unchanged → prior goldens byte-exact) with ST-23 widened to all three shapes;
> 🟠 the AR-3 supersession glob missed the load-bearing core pins
> (`type-utils.spec.test.ts:89/:107` — value-shaped, no E-code to grep; task 1.2.6 now names
> them); 🟠 ST-17 + ST-18's W10101 case need the Phase-2 width folds they were gated a phase
> ahead of (moved into the Phase-2 spec set/gates; W10174 stays Phase 1); 🟠 `hi()`'s
> shr-by-8 lowering contradicted translate's word-fold ICE rule (word shift result must feed
> a store) — respecified as a direct high-byte read (location +1; sign-correct for `sword`),
> with computed-word/`sbyte` args a loud ICE. Minors: slot guard gains a size-parity check
> (name-only missed order-drift with mixed byte/word slots); switch-discriminant-with-slot-
> site over-claim documented as a loud-ICE limitation + witness test; `FrameVar`-shape
> snippet + poisoned-site placeholder type corrected; unary `~` context rule pinned
> (no-context per TS-9 — `let x: word = ~1;` = 254); lo/hi boolean arg → E10171 (arg-mismatch
> family); "unassigned in spec" wording fixed (spec DOES assign E10086 + the W-codes — that's
> why AR-10 picked them). 60+ file:line references verified (all exact but one hedged line
> cite); fixture bytes hand-recomputed ✓; sext/neg/signed-shr sequences traced ✓.
> **Next: exec_plan.**)
> Prior: 2026-07-11 (**RD-18 Slice 6 📋 Plan Created (make_plan)** — full
> expressions & mixed width, **closes RD-18 AC-5 on completion**.
> `features/blend65-ri/plans/rd-18-slice-6-expressions/` (6 phases / 52 tasks),
> Zero-Ambiguity Gate ✅ PASSED (AR-1…AR-14; AR-14 surfaced during authoring — cast
> syntax is the shipped RD-03 FR-40 `<type>(expr)` prefix form; the TS-11/grammar
> `as`-form drift recorded for the post-freeze errata pass). Scope: the full binary
> matrix (comparisons TS-7 / logical / bitwise / shifts joining arithmetic), TS-4
> mixed-width promotion with ONE `isAssignableTo` rule everywhere (arguments/returns
> too — supersedes 5a's strict-arg interim pin, documented per-test), unary `- ! ~`
> (**E10087** negate-unsigned mint), FR-40 casts (**E10086** boolean-cast mint;
> E10155 first emission), ternary (**E10088** arm-mismatch mint; E10134 condition),
> TS-17 compound assignment, `&&`/`||` short-circuit **guarantee** lowered as CFG
> diamonds over synthetic `0sc<N>` SFA frame slots (source-illegal leading digit,
> preorder count-parity ICE guard, `__init` pseudo-frame for initializer
> expressions), signed relational comparisons (N⊕V byte+word) + word comparisons —
> fixing **DEF-1**: comparisons are stamped `IL_BYTE` today so translate compares
> LOW BYTES ONLY (a `word` loop bound miscompiles silently), signed `/`/`%` → loud
> lowering ICE (unsigned routines only; signed `*` stays — truncated multiply is
> bit-exact), word + variable-count shifts, non-const `lo`/`hi`, width-aware
> const-eval (optional per-node type lookup, two's-complement fold helpers), and
> warnings **W10160/W10161/W10101/W10174** minted (W10100/W10173 explicitly out).
> Shift-amount signedness gets the never-emitted **E10083** (key renamed). Fixture:
> single-file `examples/slice6/main.blend` → VICE `$C000..$C008 = E7 04 DA 05 07 00
> 01 44 00` with the short-circuit suppression witness (`$C005==$00` — `bump()`
> provably not called on two short-circuit paths, then runs once → `$C006==$01`).
> All six prior goldens + both assemble goldens must stay byte-exact, NO re-mint.
> **Next: preflight → exec_plan.**)
> Prior: (**RD-18 Slice 5b ✅ COMPLETE (exec_plan 42/42) — module
> system end-to-end, closes RD-18 AC-4 (Slice 5 fully ✅).** The module system ships:
> **merging** (name-keyed shared scopes — one scope per module name, first file's
> ModuleDecl representative; cross-file duplicate top-level names → E10003 incl. a NEW
> duplicate-FUNCTION guard collectFunctions never had; 5a's dup-module E90001 ICE removed,
> its pinning impl test superseded by a merged-scope import witness); **full
> qualified-access value surface** (value-first `resolveQualified` ladder in
> name-resolution.ts — E10100 unknown head on the head span, E10012 non-exported incl.
> self-module, platform ids excluded; `typeFieldAccess` + ONE shared `typeCall`
> post-resolution ladder over both callee shapes + `typeAssign` qualified arm — E10191
> const writes, function-member value/write → loud ICE until Slice 8 `&fn`; qualified
> calls feed the same call edges/callSiteSpans/SFA-callee machinery; `modelToModuleVars`
> alias guard = ONE `__var_*` slot per declared variable); **call-free initializers**
> (`typeModuleLet` local-parity E10152/53/54 + E10084/E10082; ANY call — CallExpr or
> non-`lo`/`hi` IntrinsicCallExpr — loud unsupported ICE); **init order**
> (`init-order.ts` `computeInitOrder`: ONE global per-variable graph, two-level order =
> import-edge Kahn + stable topo by (module order, declaring-scope ordinal), ONE E10194
> per cycle with spec message + path; `SemanticModel.initOrder` populated); **scalar
> const completion** (resolver-aware `evalConst` + `poisonedRef`, VAR-6 order-independent
> evaluation, E10193, const-const cycles → E10194, `constValues` populated, use-site
> inlining closes the VERIFIED `__frame_*` mis-lowering hole — a module const owns NO
> storage); **`__init` stream** (`ILProgram.initCode` realized + additive `initTempCount`;
> `generateInstr` translates it FIRST; additive `PreambleOptions.hasInitCode` →
> conditional `JSR __init` after banking through the shared shim + five plugins;
> initializer-free output byte-identical — all six prior goldens + both assemble goldens
> stayed minted; `--startup bare` user-owned, documented). **3-part bar GREEN on real
> VICE 3.10**: `examples/slice5b/` (both math files `module Math`; Main discovered first,
> Math inits first via the import edge) → `$C000..$C006 = 05/08/07/02/01/03/01`; 94-line
> golden; six `compile()` negatives. **SR-2 delta**: 4 B module vars ($2000–$2003) + 3 B
> frame region ($2004–$2006, main's empty frame shares) = 7 B data; `__init` ≈25 B code +
> 3 B shim `JSR`; ZP 10 B unchanged; no new runtime routines (SCALE*2 const-folds).
> Rollout: RD-04 ledger advanced (R17/R20/R21/R23 ✅, R64 scalar subset, R13 extended,
> AC-09/AC-16 ✅; E10192 parser-owned; deviations recorded once — E10194 path appendix,
> intra-import-cycle discovery fallback, §5.3 fall-through-vs-`JSR _main` letter pinned;
> named deferrals: call-bearing inits, qualified fn refs → Slice 8, bare-startup
> `__init`, W10190); **RD-18 AC-4 CLOSED**. Full verify green; `spec/` clean.
> **Next: Slice 6** (expressions — short-circuit, compound assign, unary, casts,
> mixed-width promotion) needs `make_plan`; RD-13/RD-14 remain queued.)
> Prior: (**RD-18 Slice 5b Phase 4 ✅ (acceptance:
> 3-part bar GREEN on real VICE 3.10, 38/42)** — `examples/slice5b/` three-file fixture
> (both math files declare `module Math`; Main imports `add`, calls `Math.twice(4)`
> qualified WITHOUT import, reads/writes `Math.base` qualified; `combo: byte =
> Math.scaled + 1` crosses modules in an initializer) assembles clean through real ACME
> to a loadable PRG and on real VICE computes `$C000..$C006 = 05/08/07/02/01/03/01` —
> initializers run before `main` in dependency order (base → scaled → combo; Main
> discovered first but Math inits first via the import edge — the two-level ordering is
> load-bearing). 94-line golden minted (`__init:` serialized FIRST, `JSR __init` after
> banking, NO `__var_Math_SCALE` — const inlined; note: `SCALE * 2` const-folds to
> `LDA #$06` at translate, so no `__rt_mul8` lands in `__init`; the embed-scan property
> stays witnessed at the instr impl tier). Six negatives (E10194+path / E10012 / E10100 /
> call-bearing-init ICE / cross-file dup E10003 / E10193) pass through the public
> `compile()` facade immediately (codes shipped in Phases 1–2 — documented no-RED). Full
> workspace verify green; `spec/` clean. Next: Phase 5 (rollout bookkeeping — closes
> RD-18 AC-4).)
> Prior: (**Phase 3 ✅ (init codegen +
> lowering arms, 32/42)** — spec-first: 6 STs red (1 pre-passer: the without-initializer
> half pins today's no-`__init` output) → GREEN. Shipped: lowering arms — NEW
> `lowerFieldAccess` (qualified module-var loads + const inlining), `lowerIdent` const arm
> (closes the VERIFIED mis-lowering hole: a module-const ref no longer falls to a
> byte-defaulted phantom `__frame_*` — it inlines as an immediate; `moduleVarOf`
> refactored to the symbol-keyed `moduleVarLocOfSymbol` shared by every path),
> `lowerAssign` qualified targets, `lowerUserCall`/nested-guard accept both callee shapes;
> `ILProgram.initCode` REALIZED (frozen-empty no more): `lowerInitCode` builds the
> `__init` stream over `model.initOrder` (same builder/lowering as function bodies,
> `ret`-closed; `moduleInit` ctx flag → loud ICE instead of any frame fallback) + NEW
> additive `initTempCount` (13 test literals swept), `printIL` renders `__init` first when
> present; `generateInstr` translates/validates the `__init` stream FIRST (embed scan
> reads streams — `JSR __rt_*` inside `__init` auto-collected); additive
> `PreambleOptions.hasInitCode` + `c64StyleStartupShim(variant, hasInitCode=false)` emits
> `JSR __init` after banking (same memory config as `main`), threaded through
> `c64StylePreamble` + all five plugins (`emitPreamble` + optional-param
> `emitStartupShim`); `--startup bare` stays empty — user-owned entry documented in the
> shim + build-API docs. 20 impl tests (incl. NEW `platforms/init-shim.impl.test.ts`, 15
> per-plugin pass-through witnesses). All six goldens + both compiler assemble goldens
> byte-exact, NO re-mint; full workspace verify green; `spec/` clean. Next: Phase 4
> (acceptance — fixture, golden, ACME, VICE).)
> Prior: (**Phase 2 ✅ (initializer typing,
> consts & init order, 22/42)** — spec-first: 11 STs red (no pre-passers) → GREEN first run.
> Shipped: `typeModuleLet` (module `let` initializers typed with local-`let` parity —
> E10152/53/54 + E10084/E10082 — and CALL-FREE: any `CallExpr` or non-`lo`/`hi`
> `IntrinsicCallExpr` anywhere in the initializer → loud not-supported ICE, `lo`/`hi` args
> still searched); module-const compile-time evaluation (declaration-order independent per
> VAR-6): `evalConst` gained an optional `ConstRefResolver` (+ a `poisonedRef` result so
> already-diagnosed references stay silent — one root cause), const→const definition cycles
> → ONE E10194 per cycle via the Symbol-generic Tarjan (members poison, siblings still
> evaluate), values range-checked through the one shared `checkConstRange` path (now
> resolver-aware, boolean return) into `SemanticModel.constValues` (frozen-empty no more);
> `collectModuleVariables` returns the `initializers` map; NEW `semantics/init-order.ts`
> `computeInitOrder` — per-variable dependency edges (imports alias the same Symbol so
> cross-module/qualified reads land automatically; consts fold, initializer-less vars are
> non-edges), ONE E10194 per cycle with the spec message + path anchored at the
> first-declared member, two-level order (import-edge Kahn with discovery tiebreak +
> cycle-tolerant fallback, then stable per-variable topo by (module order, declaring-scope
> ordinal — aliases skipped)) → `SemanticModel.initOrder` (always-`[]` no more). 6 impl
> tests (const chains + lo/hi over consts, importEdges map, cycle poison, non-edges, mixed
> widths). Frontend suite 433 green; full workspace verify green; `spec/` clean. Next:
> Phase 3 (init codegen — `__init` stream + lowering arms).)
> Prior: (**RD-18 Slice 5b Phase 1 ✅ (module merging +
> qualified access, 12/42)** — spec-first: ST-1…ST-11 minted red (1 documented pre-passer:
> the value-shadowed-head status-quo pin), then GREEN. Shipped: name-keyed shared module
> scopes (`moduleScopeByName` in `FunctionTables`; first file's ModuleDeclNode stays the
> representative node) + a NEW duplicate-FUNCTION-name E10003 guard in `collectFunctions`
> (the plan's "existing guard" claim was stale — top-level function names were set
> last-wins silently); `collectModuleVariables` consumes `moduleScopeByProgram`;
> import-resolution drops the E90001 dup-module ICE (superseded impl test replaced with a
> merged-scope import witness), resolves against the merged scope, and returns the new
> `importEdges` map (importer → imported, for Phase-2 init ordering); `resolveQualified`
> ladder in name-resolution.ts (value-first head, E10100 unknown head on the head span,
> E10012 non-exported incl. self-module, platform ids NOT modules) threaded via
> `TypeCheckContext.moduleScopes`; `typeFieldAccess` (module var/const reads; function
> member in value position → loud not-supported ICE) + `typeCall` refactored to ONE shared
> post-resolution ladder over both callee shapes (qualified calls feed the same
> E10051/E10023/E10175/E10170/E10171 ladder + call edges/callSiteSpans) + `typeAssign`
> qualified-target arm (module let accepted, const → E10191, function → ICE);
> SFA parity: `userCalleeOf` FieldAccessExpr arm + `modelToModuleVars` alias guard (an
> imported variable projects exactly ONE `__var_*` slot under its home module). 9 new impl
> tests (merged-scope internals, platform-id head, self-module E10012, import-of-variable
> single-slot witness, a.b.c silent, `Math.add = 5` ICE). Full workspace verify green;
> `spec/` clean. Next: Phase 2 (initializer typing, consts & init order).)
> Prior: 2026-07-11 (**RD-18 Slice 5b 🔬 Plan Preflighted** — preflight iteration 1:
> 1 critical / 3 major / 5 minor / 1 observation — ALL resolved per recommendation, fixes
> applied (✅ PASSED; `plans/rd-18-slice-5b-module-system/00-preflight-report.md`). 🔴 the
> 03-04 fixture was written with a nonexistent `fn` keyword (the language keyword is
> `function`) — fixed across the fixture + ST scenario tables; 🟠 the AR-4 call-rejection
> walk now covers `IntrinsicCallExpr` except `lo`/`hi` (builtins are their own node kind —
> `peek`/`peekw` would have silently lowered into `__init`; new ST-15b pins the ICE);
> 🟠 ST-3/ST-7/ST-10 pinned function-local (top-level lets are untyped until Phase 2, and a
> module-level ST-3 would be the AR-4 ICE, never "typed byte"); 🟠 `modelToModuleVars`
> gains an alias guard (an imported module variable double-projects a phantom
> `__var_<Importer>_*` slot — latent since 5a) + the AR-5 declIdx rule pinned to the
> declaring scope (aliases skipped). Minors: typeAssign lives in expression-typing.ts (task
> 1.2.5 retargeted); SIX existing goldens not five; AR-4 surface corrected (unary is
> neither typed nor lowered today); ST-23 re-cited (spec §5.3 prescribes fall-through — the
> shipped `JSR _main` shim is the pre-existing deviation; AR-8 + §5.4 pin the expectation);
> `hasInitCode` optional-with-default so the five `emitStartupShim` delegations stay valid;
> sanitize() doc-comment staleness noted. ~50 file:line references verified against the
> codebase (48 exact); the AR-7 const mis-lowering hole and the dead `initCode` seam
> re-confirmed real; an independent challenger converged on all four high-stakes findings.
> **Next: exec_plan.**)
> Prior: 2026-07-10 (**RD-18 Slice 5b 📋 Plan Created** — `make_plan` produced
> `plans/rd-18-slice-5b-module-system/` (5 phases / 42 tasks), Zero-Ambiguity Gate ✅ PASSED
> (AR-1…AR-13 + imported I-1…I-3; 3 recon agents + 1 independent challenger — converged on
> all five high-stakes picks). Scope: module merging (R20; name-keyed shared scopes;
> cross-file dup → E10003; replaces the 5a dup-module ICE), **full qualified-access value
> surface** (`Math.fn()` calls + `Math.v` reads + `Math.v = x` writes, exported-only,
> value-first head resolution, E10100/E10012 reuse; call-graph/SFA parity rider — no
> qualified form stays on the silent-poison path; `Math.fn`-as-value → ICE until Slice 8
> `&fn`), **call-free module-var initializers** typed with local-`let` parity (call → loud
> ICE), ONE global per-variable init graph + spec-literal two-level order (import-edge
> module order via cycle-tolerant Kahn, then stable per-variable topo; ONE E10194 per cycle
> with path via the Symbol-generic Tarjan), **scalar const completion** (const-eval +
> `constValues` + E10193 + use-site inlining — closes a VERIFIED latent hole: module-const
> refs mis-lower to an unallocated `__frame_*` byte-defaulted symbol, ACME undefined-symbol
> / silent under `emitAsm`), and the `initCode` seam realized as a synthetic `__init`
> stream (serialized FIRST) + additive `PreambleOptions.hasInitCode` → conditional
> `JSR __init` (initializer-free programs byte-identical — all five prior goldens stay
> minted; `--startup bare` documented user-owned). Fixture: 3 files with BOTH math files
> declaring `module Math`; Main discovered first but Math inits first (import-edge order
> load-bearing); VICE `$C000..$C006 = 05/08/07/02/01/03/01`. **Closes RD-18 AC-4 on
> completion. Next: preflight → exec_plan.**
> Prior: **RD-18 Slice 5a ✅ COMPLETE** — exec_plan 46/46; user
> functions/params/calls/recursion/imports ship end-to-end. **3-part bar GREEN on real VICE
> 3.10**: two-module `examples/slice5a/` (cross-module `add`/`triple` imports, `combo`
> declared after its call site, chain `main → combo → add`) → `$C000==$11` add(10,7) /
> `$C001==$84`+`$C002==$03` triple(300)=$0384 / `$C003==$10` combo(5); byte-exact 164-line
> golden. **Phase 0 retired the 13-byte data ceiling** (closes 3b AR-1/SR-3):
> `DEFAULT_PROFILE.ramStart` `$0800`→`$2000`, five goldens re-minted (equate-only) + VICE
> re-verified, `AllocationPlan.dataBase` + mandatory post-ACME `checkDataOverlap` (E10033
> band, half-open, plan-keyed) wired unconditionally into `build()`. **Phase 1**: param
> collection (dup→E10003; FN-13→E10101 via post-import `checkParameterShadowing`),
> `typeCall` ladder (E10100→E10051→E10023→E10175; count E10170 suppresses per-arg; strict
> same-type E10171 + const-range E10084), return completion (E10172 + assignment family
> with return wording), Pass-3 call edges + core iterative Tarjan `findCallCycles` → ONE
> E10174 per cycle with the full path, new `import-resolution.ts` (E10012,
> user-module-wins, same-Symbol aliasing, dup-module-name → unsupported ICE until 5b);
> registry: E10175→`NotCallable` (Ch 14 divergence recorded), E10051 minted; unresolved
> callees naming platform intrinsics stay with the T4 boundary. **Phase 2**: adapter
> projects params (params-first offsets 0/1/3 witnessed) + sorted callee FQNs;
> `FunctionInfo.argWindowInterferes` + interference union → the sibling shape
> `main → f(1, g())`, `g → h` compiles CORRECTLY (f/h frames disjoint); NEW driver gate
> skips `planAllocation` on `hasErrors` (recursion → no plan, no binary). **Phase 3**:
> `lowerCall` store-per-arg + bare `call` (AR-3 residual guard: later-arg reaching the
> callee → lowering ICE); translate `call` (AR-4 guard via a separate remaining-use
> ledger — `f()+g()` → "value live across a call" ICE, `f(g(1),2)` compiles; `JSR` +
> A/A:X bind, mirrors cleared). **SR-2 delta**: module vars 4 B + frame region 5 B (9 B at
> the `$2000` base; 2 B saved by sharing — `combo`/`triple` frames overlap as siblings);
> ZP unchanged (10 B); `__rt_mul16` embedded. **SR-3 closeout**: the 13-byte
> dead-BASIC-stub ceiling is retired. RD-04 ledger advanced (R58, R22, R66+E10023,
> R80/R81, R84–R87, AC-07/AC-15; R10/R13/R65 partial) + deviations recorded once (E10175
> rename incl. the Ch 06 §10 vs Ch 14 spec inconsistency; FN-11 no-param-limit; E1017x
> chapter drift; JSR-startup scoped; AR-3/AR-4/AR-13 named deferrals). RD-18 AC-4
> annotated "5a partial ✅; closes at 5b". Full verify green; `spec/` clean.
> **Next: Slice 5b** (module merging + `Module.fn` qualified access + call-free
> initializers/E10194) needs `make_plan`.
> Prior: **RD-18 Slice 5a 🔬 Plan Preflighted** — preflight iteration 1:
> 0 critical / 2 major / 4 minor / 1 observation, **all 7 resolved & applied** (iteration 2
> verified, 0 new findings; report `plans/rd-18-slice-5a-functions-calls/00-preflight-report.md`;
> 3 recon agents + 1 independent challenger — converged on both MAJORs). ~60 `file:line` claims
> re-verified; the store-per-arg convention, argument-window interference design, and fixture
> arithmetic confirmed sound; no gate decision changed (the register carries a preflight-amendment
> note). Both MAJORs were stale claims about existing code at never-miscompile seams, fixed as
> plan amendments: **PF-001** — the AR-4 live-temp guard cannot be built on the static prescan
> `useCount` (provably cannot distinguish must-compile `f(g(1),2)` from must-ICE `f()+g()`); it
> gets a NEW **separate** remaining-use map (copy of prescan totals, decremented once per consumed
> operand occurrence, never mutating `useCount` — the fold decisions read it). **PF-002** — the
> `hasErrors`→skip-`planAllocation` gate does NOT exist; it is new driver-level work in
> `run-frontend` guarding the whole call expression (the inline `modelToFunctionInfo` argument +
> its AR-3 `reach()` DFS included — a cyclic graph would hang an unbounded DFS); all new
> reachability walks visited-set-bounded; the plan-allocation-level "still assembles" spec test is
> a different layer and stays untouched. MINORs: PRG load-address read-back must be built, size =
> header-excluded `binarySize` (PF-003); the E10175 rename's divergence from the canonical Ch 14
> spec registry recorded in the 5.1.2 deviation note (PF-004); duplicate module name across files →
> explicit unsupported ICE until 5b merging (PF-005); `lowerCall` unresolvable-callee ICE fallback
> (PF-006); phantom `lowerExprStatement` name fixed (PF-007). Grounding otherwise confirmed strong
> (poke/pokew need no import; the multi-file facade works today). **Next: exec_plan.**
> Prior: **RD-18 Slice 5a 📋 Plan Created** — `make_plan` produced
> `plans/rd-18-slice-5a-functions-calls/` (6 phases / 46 tasks), Zero-Ambiguity Gate ✅ PASSED
> (AR-1…AR-16; 3 recon agents + 1 independent challenger). **Slice 5 split 5a/5b** (AR-1): 5a =
> the calling-convention vertical — parameter collection (never collected today), call typing
> (E10170/E10171 + repurposed **E10175 `NotCallable`** + new mint **E10051** interrupt-call +
> E10023 main-call), return completion (E10172 + assignment-family mismatch), call graph + **one
> E10174 per cycle** (Tarjan, pre-SFA poison), minimal cross-module imported calls (E10012,
> user-module-wins precedence), SFA feed (params/callees + **argument-window interference** —
> challenger-hardened AR-3), and the two codegen cases (`lowerCall` store-per-arg + translate
> `call` = JSR + A/A:X bind) with two never-miscompile ICE guards (same-callee-in-later-arg AR-3;
> live-temp-across-call `f()+g()` AR-4 — both named deferrals). **Phase 0 retires the 13-byte
> data ceiling** (AR-2: `ramStart` `$0800`→`$2000` + mandatory post-ACME code/data overlap check
> keyed off the plan; one golden re-mint + VICE re-verify; closes 3b AR-1/SR-3). Recon headline:
> SFA already complete (params-first frames, interference, coloring — inputs stubbed); IL `call`/
> `ret` + callee return ABI already shipped; the frontend is the bulk. 5b (merging, `Module.fn`,
> call-free initializers + per-variable init order E10194) closes RD-18 AC-4. Fixture:
> two-module `examples/slice5a/` → VICE `$C000==$11`/`$C001==$84`/`$C002==$03`/`$C003==$10`.
> **Next: Slice 5a plan preflight → exec_plan.** Prior: **RD-18 Slice 4b ✅ COMPLETE** — exec_plan 26/26; the
> `switch`/`case`/`default`/`fallthrough` sub-machine ships end-to-end, **closing RD-18 AC-3**.
> **3-part bar GREEN on real VICE 3.10**: `examples/slice4b/main.blend` (multi-value case + `fallthrough`
> + auto-break + `default`) → `$C000==$19` (25) / `$C001==$07` (7), byte-exact ASM golden committed,
> negatives reject via `compile()` (E10071/E10132/E10075). Phase 1 semantics (`statement-typing.ts`
> `typeSwitch` — E10075/E10071/E10084/E10077/E10132/E10073/E10074, switch-transparent break/continue;
> `function-collection.ts` case-body locals). Phase 2 codegen (`lower.ts` `lowerSwitch` — `brcond`
> compare-chain over the 4a CFG keystone, multi-value shared body, `fallthrough`→`br(next body)`,
> auto-break→`br(join)`, default tail; zero new IL terminator / translate work, AR-1). Five codes
> registered additively (E10071/E10073/E10074/E10075 + new mint E10077); **E10076** deferred parser-owned
> (PF-001). RD-04 ledger R75/R79 advanced (R76 exhaustive-enum stays deferred → Slice 7). Full workspace
> verify green; `spec/` clean. **Next: Slice 5** (functions/params/calls) needs `make_plan`.
> Prior: **RD-18 Slice 4b 🔬 Plan Preflighted** — preflight iteration 1:
> 0 critical / 3 major / 2 minor / 1 observation, **all 6 resolved & applied** (report
> `plans/rd-18-slice-4b-switch/00-preflight-report.md`; three recon agents + one challenger). Three
> MAJORs (all Option A): **PF-001** — E10076 (duplicate-`default`) is **unreachable at semantics**
> (the parser silently overwrites a duplicate `default`, last-wins) → **dropped** from 4b's delivered
> validators, deferred parser-owned; a duplicate `default` is accepted silently. **PF-002** — the
> E10077 case-type-match rested on a **fictional "TS-4 auto-promotion"** (assignability is strict
> same-type; widening is Slice 6); case literals adapt to the discriminant and out-of-range constants
> raise **E10084**, so E10077 stays registered+wired but its emission is **deferred-reachable to
> Slice 7**, with precedence **E10071→E10084→E10077** and a bespoke (not E10152/3/4) check; ST-4 split
> into ST-4a (E10084) + ST-4b (`.todo`). **PF-003** — a stray out-of-switch `fallthrough` is **not**
> rejected and still ICEs, so the `unsupportedFixture` is **kept** (not repointed) and the silent-accept
> gap deferred. MINORs: code mint corrected to **five** (E10077 + E10071/E10073/E10074/E10075, all
> absent from the registry & Ch-14 — not "one"; PF-004) + spec cites fixed (PF-005). The
> `00-ambiguity-register.md` carries a preflight-amendment note superseding AR-4/AR-7/AR-11/AR-13.
> Full plan grounding otherwise confirmed strong. Next: exec_plan. Prior: **RD-18 Slice 4b 📋 Plan
> Created** — the `switch` sub-machine; `plans/rd-18-slice-4b-switch/` (4 phases / 26 tasks),
> Zero-Ambiguity Gate ✅ PASSED (AR-1…AR-14). Three-agent recon confirmed switch is **fully parsed**
> (AST/visitor/walk) — 4b is wire-semantics + one `lowerSwitch` case (a `brcond` **compare-chain** over
> the 4a CFG keystone; **zero** new IL terminator / translate work). Four gate decisions (user):
> **compare-chain** dispatch (jump-table → Phase B, AR-1); **integer-only** switches, enums +
> exhaustiveness E10133 → Slice 7 (AR-2); `fallthrough`-in-default = spec **E10073 warning** (dissolves
> Parked-Q4, AR-3); case-type-mismatch → **new E10077** (E10072 taken by the parser's
> `MissingDefaultClause`, AR-4). Closes RD-18 AC-3. Prior: **RD-18 Slice 4a ✅ COMPLETE** — exec_plan 35/35 + DEF-1. The
> conditionals + loops + **multi-block CFG codegen keystone** ships end-to-end: `if`/`else`/`while`/
> `do-while`/`for`(`to`/`downto`/`step`) compile through real control-flow semantics (Pass 1 flat body-local
> collection, Pass 3 condition/loop typing, Pass 4 all-paths-return), IL `br`/`brcond` lowering (loop-context
> stack for `break`/`continue`), and multi-block IL→Instr translate (`prescanAll()` + per-block
> `resetBlockState()`, PF-001). `examples/slice4a/main.blend` (for-loop with `break`/`continue` + a while + a
> two-armed if/else) computes `21` on **real VICE 3.10** (`$C000==$15`, `$C001==$01`); a non-void function
> missing a return path → **E10102** via `compile()` (no binary); byte-exact ASM golden committed. New codes
> minted additively (AR-11 precedent): **E10134** (non-boolean condition), **E10061** (step positivity),
> **E10065** (counter-type integer, AR-15), **E10102** (all-paths-return); `break`/`continue` outside a loop →
> **E10130/E10131**. **DEF-1/AR-16** (latent RD-07b bug, exposed by 4a's first runtime `==`): `translateComparison`
> clobbered the Z flag → `eq`/`ne` always 0; **fixed eq/ne only** (branch directly after `CMP`; carry-based path
> unchanged), goldens re-minted + a no-LDA-between-CMP-and-Z-branch regression added. Rollout bookkeeping done:
> RD-04 ledger rows R71–R74/R77/R78/R80/R11 + AC-12/AC-17 advanced; RD-18 AC-3 annotated "4a partial ✅; closes at
> 4b (switch)". Full workspace verify green; `spec/` clean. **Next: Slice 4b** (`switch`/`case`/`fallthrough`) needs `make_plan`.
> Prior 2026-07-07: **RD-18 Slice 4a 🔬 Plan Preflighted** — preflight iteration 1: 0 critical / 1 major /
> 3 minor / 0 observation, **all 4 resolved & applied** (report `plans/rd-18-slice-4a-conditionals-loops/00-preflight-report.md`).
> Top finding (MAJOR, PF-001): the multi-block `translate.ts` keystone carried block-local peephole state (`prescan`
> scope, the instruction-index `skipIndex`, the `regA`/fold mirror) across basic-block boundaries — an independent
> challenger confirmed two concrete miscompile paths (a stale `skipIndex` dropping a live instruction in the next
> block; `prescan` under-counting non-entry temps → a folded-away second consumer); fixed by mandating `prescanAll()`
> + a per-block `resetBlockState()` (new 03-03 §1a). MINORs: a for-counter with an omitted/non-integer type was
> silently poisoned → now guarded off `integerRange(counterType) === null` → **new code E10065** (AR-15, PF-002); the
> stale "E10003 dup-check in the collector" claim corrected to the real silent-alias behavior (PF-003); the
> contradictory `brcond` flags-live framing removed (PF-004). AR register grew AR-1…AR-15.
> Prior 2026-07-06: **RD-18 Slice 4a 📋 Plan Created** — conditionals + loops + the multi-block CFG
> codegen keystone; `plans/rd-18-slice-4a-conditionals-loops/`, 5 phases / 35 tasks, Gate ✅ AR-1…AR-15; `switch`
> split to 4b. Prior: **Slice 3b ✅ COMPLETE (exec_plan 45/45)** — scalar type/scope
> engine end-to-end: type engine + module scalars + width-aware lowering + 3-part acceptance bar green on real VICE +
> rollout bookkeeping (parent-AC ticks, PF-004 AC-05 correction, SR-2/SR-3). Full workspace verify green;
> runtime AR-12/AR-13 resolved; `spec/` clean.
> Prior 2026-07-05: **Slice 3b 🔬 Plan Preflighted** — `plans/rd-18-slice-3b-scalar-type-engine/`:
> preflight 2 critical / 3 major / 4 minor / 1 observation, **all 10 resolved & applied** (iteration 2).
> Root cause: diagnostic-code drift — the plan took several codes from the **stale frozen spec Ch 02 §5.3**
> and falsely claimed all codes exist. Fixed via **AR-11 code-reconciliation** (register E10084 + E10022
> additively per RD-18 AR-115; realign boolean-arith→E10080, narrowing→E10154, cross-sign→E10153,
> boolean-assign→E10152; drop E10086). Structural build verified sound (all `file:line` cites true; both
> `__var_*`/`__frame_*` symbol formats exact). Report `00-preflight-report.md`; hardened by an independent
> refutation challenger (which corrected the E10022 "no code exists"→"unregistered" framing). Task count
> 44→45. Next: exec_plan. 5 phases / 45 tasks, Zero-Ambiguity Gate ✅ PASSED (AR-1..AR-11). Scope: the scalar **type engine** —
> real RD-04 Pass 3 (expression/literal typing → populate `typeMap`/`symbolMap`, real
> `isAssignableTo`/`commonType`, poison) + Pass 4 (`main()` validity) + minimal const-eval; module-level
> scalar declaration/allocation (`__var_*`); width-aware lowering (thread `typeMap` so word literals
> reach `__rt_mul16`). Recon (3 agents) confirmed codegen already lowers the surface end-to-end — the
> build is semantics + wiring. Key gate calls: same-type only (widening/casts → Slice 6, AR-3);
> module-var **initializers deferred** (declare + assign in body, spec VAR-2, AR-2); the SFA `$0800`
> region stays within the 13-byte dead-BASIC-stub shadow (the `>13-byte` variable/code collision is a
> **documented deferred fix**, AR-1); fixture VICE-asserts `$C000==$11`/`$C001==$58`/`$C002==$02`; signed
> `*`/`/`/`%` out-of-surface (AR-5). Next: exec_plan. Prior: **Slice 3a ✅ COMPLETE**
> — exec_plan 21/21 tasks, 3 phases, full workspace verify green + the 3-part acceptance bar (CI
> assemble-clean + CI golden + local VICE `$D020==0xF5` on real 3.10). The `modelToFunctionInfo` seam is
> closed: new `function-collection.ts`
> populates a minimal real `SemanticModel` (per-module `Scope` + function symbols + ordered locals +
> `mainFunction`), `analyze()` wires it alongside `collectDeclarations`, and `modelToFunctionInfo`
> projects real `FunctionInfo[]` (FQN module from `fn.scope.node.name`, AR-13). Parent ACs ticked
> (RD-05 AC-22 superseded; RD-04 ledger R7/R8; RD-18 AC-1 ✅); gate golden re-minted +1 line (AR-8).
> Next: Slice 3b (`make_plan`). Prior: **🔬 Plan Preflighted** — plan preflight: 0 critical /
> 1 major / 2 minor / 3 observation, all 6 resolved & applied (iteration 2). The MAJOR (AR-13): the
> adapter could not recover a function's module for the FQN from a `SemanticModel` — closed by
> building a per-module `Scope` and reading `fn.scope.node.name` (model-only, no `@blend65/core`
> change, honors AR-4, reusable by 3b; hardened by an independent refutation challenger). Also:
> `analyze()` orchestrates both Pass-1 collectors (PF-002), red-vs-green-guard spec tests annotated
> (PF-003), and three doc-clarity observations. Report at
> `plans/rd-18-slice-3a-model-seam/00-preflight-report.md`. Next: exec_plan. Prior: **📋 Plan
> Created** — `make_plan` produced `plans/rd-18-slice-3a-model-seam/`: 3 phases / 21 tasks,
> Zero-Ambiguity Gate PASSED (AR-1..13).
> Scope is the keystone model-seam proof only (populate a minimal real `SemanticModel` with `main` +
> one local `byte`; implement `modelToFunctionInfo`; 3-part acceptance = CI assemble-clean + CI
> golden + local VICE `$D020==0xF5`). Two-agent codebase recon confirmed the whole downstream
> (SFA→symbols→ACME→PRG→VICE) is already wired — the sole stub is `modelToFunctionInfo`
> (`model-adapter.ts:34`) + the empty-model `analyze()`; IL lowering is name-and-frame-keyed
> (`lower.ts:206,268`), so the local-byte fixture lowers with no new codegen work. Locked: 3a only;
> use-the-local fixture; adapter reads the populated model (not the AST); population = reusable RD-04
> Pass-1 slice in new `function-collection.ts` (3b extends it); `FunctionInfo.name="Main.main"`;
> existing gate golden intentionally re-minted + VICE re-verified (AR-8).
> Prior 2026-07-04: **RD-18 RD Preflighted 🔎** — requirements preflight: 0 critical /
> 2 major / 4 minor, all 6 resolved & applied to RD-18 + `00-ambiguity-register.md`. Root cause of
> both majors: RD-18 had drawn its control-flow/function diagnostic codes from the **stale**
> pre-consolidation numbering (`00-feature-index.md`/F0xx/ch05-06) instead of the **canonical**
> `spec/14-diagnostics.md` + `diagnostic-codes.ts` the compiler implements. Fixes: recursion →
> unified `E10174`; the three code-less Slice-4 checks (non-boolean-condition, all-paths-return,
> `fallthrough`) routed to the slice gate as new `diagnostic-codes.ts` entries with `spec/` frozen
> (AR-115 / Option A); +4 minor (README:195, RD-11 dep, per-slice const-eval, AR-112 init-order).
> One independent challenger confirmed the batch. Report: `requirements/00-preflight-report.md`.
> Prior 2026-07-03: **RD-12 Plan Preflighted 🔬** — plan preflight iteration 1:
> 0 critical / 0 major / 2 minor / 2 observation; all 4 findings fixed & applied to the plan
> docs. An independent challenger lowered the top finding (undeclared `@blend65/codegen`
> test-scope dep + omitted tsconfig refs + AR-H11/dep-table inaccuracy) from MAJOR to MINOR by
> refuting "build-blocking" — Yarn-classic hoisting resolves the import (`eslint.config.mjs`
> is the real R15 gate). Also fixed: gate/RD-17 suites now `skipIf(!hasVice() || !hasAcme())`
> since they compile via ACME (PF-002); ST-02's exact `$0819`/`$080d` moved to a
> build-sensitive impl smoke test, ST-01 keeps the immutable DEF-2 oracle (PF-003); `runFrames`
> frame-approximation documented (PF-004). DEF-2 independently re-verified live (`acme
> --vicelabels` emits `al C:0002 .__zp_arg_0` — 4-hex-digit ZP, regex matches). Report at
> `plans/rd-12-test-harness/00-preflight-report.md`. Next: exec_plan. Earlier same day:
> **RD-12 Plan Created 📋** — `make_plan` produced
> `plans/rd-12-test-harness/`: 4 phases / 10 sessions / 44 tasks, gate PASSED (17 items,
> AR-H1..H17). Full-RD scope. Grounding surfaced blocking RD-09 defect **DEF-2** (empty
> `symbolMap` — `-l` vs `--vicelabels`), fixed as Phase 0 with a regression oracle. VICE 3.10
> + ACME present locally. Next: plan preflight → exec_plan. Earlier same day: **RD-12
> RD-Preflighted 🔎** — requirements preflight iteration 1: 0 critical / 0 major / 6 minor / 2 observations, all applied to the RD-12 doc; both initially-MAJOR findings knocked down by a blind challenger (the interim `mos6502-interpreter.ts` self-declares "RD-12 supersedes this" & is ACME-gated, not an AR-27 violation; RD-12 has its own AC-14 distinct from RD-17's inherited one). RD-12 now cross-references the interim interpreter, discharges RD-17's AC-14 (§5), binds R27/R28 to RD-15 `BuildResult`, pins R19 keys to `parseLabelFile`, adds R7a platform→emulator registry. Ready for `make_plan`. Earlier same day: **RD-15 ✅ COMPLETE** — exec_plan 50/50 tasks, 4 phases, full workspace verify + CI green. Phase 4: AC-18 no-print enforcement (ESLint no-console/no-restricted-properties + ST-39 root witness), CI ACME install, the ST-40 real-ACME build E2E (header-bearing c64 PRG), AC-01..20 ticked with ST evidence + the AC-19 traceability audit, and RD-11 AC-16/AC-10/AC-21 closed. Surfaced & fixed a latent RD-09 defect (DEF-1/AR-V23): `invokeAcme` dropped `-o` so the `!to ...,cbm` directive drives a loadable header-bearing PRG. Phase 3: `@blend65/cli` ships the full `blendc` command — yargs@17 parsing (default-build alias, `check`, PF-009 help/version routing), zero-dependency color (AR-V2), stderr/stdout split, `--emit-*` writes, and the R50 exit ladder. Phase 2: `@blend65/compiler` now ships the `api/` facade — `compile` (frontend-only, the LSP path), `emitIl`/`emitAsm` (partial pipelines with the PF-001 `assembleProgram` override seam threading `--out-name`/`--startup`), and `build` (full ACME pipeline: injectable `BuildDeps`, canonical `checkBinaryBudget` E10034, binary read-back) — all over one `runFrontend` core with two-bag config/pipeline diagnostics and a single R21 `outName` derivation. Full workspace verify green. Earlier Phase 1/4: `@blend65/core` ships the `CompilerHost` interface + host barrel; `@blend65/compiler` ships `DiskCompilerHost` (tinyglobby R47 globs + projectRoot containment + lexicographic sort); driver codes E10250/E10251 added; PF-002 `BuildResult`→`EmitBinaryResult` rename landed with the AR-V5 cross-ref; AR-V2/V20/V21/V22 back-propagated to the requirements register as AR-106..109. Full workspace verify green. Earlier: RD-15 plan **preflighted** 🔬 — iteration 1: 13 findings (3 major/7 minor/3 observation) all resolved on the recommended option & applied to the plan docs; register grew to 22 items (V20 `cwd`, V21 exit-3 ICE band, V22 caret deferral); next: exec_plan. Earlier same day: RD-15 plan created — 4 phases / 13 sessions / 50 tasks, gate PASSED with 19 items. Earlier same day: RD-11b ✅ COMPLETE — exec_plan 39/39 tasks, 4 phases: `SourceMap` registry, severity policy, terminal/JSON diagnostic renderers (Ch 14 §1 goldens + R52 security tier), `ResourceReport` builder + `checkBinaryBudget` + Ch 11 §6 build-summary renderers; RD-11 §6 boxes AC-08/09/11–15/17–20 closed, AC-16 flag half → RD-15; full workspace verify green, core 237 tests; next: RD-15 make_plan)


---

## Current Position


- **Last completed**: **RD-15** (programmatic + CLI API), executed to 100% on 2026-07-03
  (`codeops/features/blend65-ri/plans/rd-15-programmatic-cli-api/99-execution-plan.md`,
  50/50 tasks, 4 phases). `@blend65/compiler` ships the `api/` facade — `compile`
  (frontend-only, the LSP path), `emitIl`/`emitAsm` (partial pipelines with the PF-001
  `assembleProgram` override seam for `--out-name`/`--startup`), and `build` (full ACME
  pipeline: injectable `BuildDeps`, canonical `checkBinaryBudget` E10034, binary
  read-back) over one `runFrontend` core (two-bag config/pipeline diagnostics, single R21
  `outName` derivation) — plus the core `CompilerHost` + compiler `DiskCompilerHost`
  (tinyglobby R47 globs + projectRoot containment) and driver codes E10250/E10251.
  `@blend65/cli` ships the full `blendc` command (yargs@17, zero-dependency color per AR-V2,
  stderr/stdout split, `--emit-*` writes, the R50 exit ladder). AC-18 no-print is
  ESLint-enforced + ST-39-witnessed; CI installs ACME so the ST-40 real-ACME build E2E runs
  live. Discharged the deferred RD-11 items (AC-16 `--quiet` half via ST-30; AC-10/AC-21
  bookkeeping) and the PF-002 `EmitBinaryResult` rename. **Fixed a latent RD-09 defect
  (DEF-1/AR-V23):** `invokeAcme` dropped `-o` so the `!to ...,cbm` directive drives a
  header-bearing, loadable c64 PRG. Full workspace verify + CI green.
- **Previously**: **RD-11b** (diagnostics remainder & resource reporter), 100% on 2026-07-03
  (`codeops/features/blend65-ri/plans/rd-11b-diagnostics-reporting/99-execution-plan.md`,
  39/39 tasks, 4 phases): `@blend65/core` ships the `SourceMap` registry (path-keyed intern,
  cached `LineMap`s, AR-104 `has()`), the R50-precedence severity policy
  (`createSeverityPolicy`/`applySeverityPolicy`, W-code preserved on promotion per AR-Q8),
  the Ch 14 §1 terminal renderer (per-excerpt gutters PF-004, byte-column carets, R51
  degradation, R52 sanitize-then-caret security tier ST-18, AR-Q9 hand-rolled ANSI) +
  verbatim-span JSON renderer, and the `report/` module (`ResourceReport` on the shipped
  `SfaResourceData` per AR-103/PF-002, `buildResourceReport` with by-reference embedding,
  post-ACME `checkBinaryBudget` E10034, Ch 11 §6 build-summary goldens with AR-102
  zero-staging, PF-012 sorted-entries JSON). RD-11 §6: AC-11..13/15/18/19/20 ticked with ST
  evidence, AC-08/09/14/17 audit-closed (AR-Q12), AC-16 core half noted (flag → RD-15).
  Full workspace verify green (core 237 tests).
- **Previously**: **RD-16** (compiler configuration) 100% on 2026-07-02 — `@blend65/config`
  ships `loadConfig()` (walk-up discovery, tolerant JSONC via `jsonc-parser`, E10240–E10246/
  W10240–41 validation, defaults←file←overrides merge); AC-01..AC-14 ticked.
- **Preflighted**: **RD-11** (diagnostics & resource reporting) requirements preflight
  ✅ PASSED 2026-07-03 — 14 findings (3 major, 7 minor, 4 observations), all
  recommendations accepted and fixes applied (see `requirements/00-preflight-report.md`).
  Highlights: `--report=json` semantics deferred to RD-15 (PF-001); `ResourceReport`
  rebuilt on the shipped `SfaResourceData` with `PeepholeStats` core-resident (PF-002);
  the Ch 11 §6 build-summary layout made normative with render-as-zero staging — runtime
  **AR-102** (PF-003, incl. an RD-15 §4.4 cascade fix); RD-11a/11b split + true deps now
  recorded in the RD header. RD-15's requirements preflight passed earlier the same day
  (10 findings; its PF-001 reordered RD-11b ahead of RD-15).
- **Next up**: **RD-13** (non-functional requirements sweep) — needs `make_plan`.
  **RD-12 ✅ COMPLETE (2026-07-03)** — exec_plan 44/44 tasks, 4 phases; `@blend65/test-harness`
  ships the full emulator-verification framework (driver + VICE codec + strategies + assertions
  + fixture + golden), all 16 own ACs ticked + RD-17 inherited AC-14 discharged on real VICE,
  DEF-2 closed, full workspace verify green. Historical planning detail below. Plan at
  `codeops/features/blend65-ri/plans/rd-12-test-harness/` — 4 phases / 10 sessions / 44
  tasks, Zero-Ambiguity Gate PASSED with 17 items (AR-H1..H17). Scope: full RD (all 16 ACs),
  phased. Locked decisions: depend on `@blend65/compiler` and reuse `parseLabelFile` +
  `BuildResult` (H2); prove emulator/RD-17 tests green **locally on VICE 3.10** while
  `skipIf` keeps CI green (H3); hand-rolled zero-dep PNG screenshots (H4); bounded RD-17
  AC-14 vectors (H5); relaunch VICE per binary (H6). **Grounding surfaced a blocking latent
  RD-09 defect — DEF-2:** `invokeAcme` passes `-l` (ACME-native `name = $addr`) instead of
  `--vicelabels`, so `parseLabelFile` yields an **empty `symbolMap`** for every real build
  (verified: gate build → `symbolMap.size === 0`); RD-12's label sync + symbolic
  `assertMemory` need it, so the plan fixes it as **Phase 0** with a regression oracle
  (verified live: `--vicelabels` → `al C:0819 ._main`, `al C:080d .__startup`). Real gate
  symbols pinned: `_main=$0819`, `__startup=$080d`, `__zp_arg_0..3=$02..$05`. VICE 3.10 +
  ACME both installed locally → every tier buildable now. Next: plan preflight → exec_plan.



---

## Per-RD Workflow (mandatory sequence)

Every RD is taken through this exact sequence:

```
preflight  →  make_plan  →  preflight  →  exec_plan
```

1. **preflight** — validate the RD requirements document against the preflight checklist
   (`requirements/01-preflight-checklist.md`) *before* planning. Verdict must be PASS.
2. **make_plan** — author the implementation plan under
   `codeops/features/blend65-ri/plans/<rd-slug>/` (only if no plan directory exists yet;
   otherwise review/refresh the existing plan).
3. **preflight** — re-run preflight against the *authored plan* to confirm it is coherent
   and complete before any code is written. Verdict must be PASS.
4. **exec_plan** — execute the plan phase-by-phase (spec-tests-first), updating the plan's
   `99-execution-plan.md` progress header as each task lands.

When `exec_plan` reaches 100%, **update this roadmap** (see Update Protocol below).

---

## Status — Done

> Completed plans are archived under `codeops/_archive/` to keep the active `plans/`
> directory clean. The `Plan dir` paths below point at their archived locations.

| RD | Title | Plan dir | Status |
|----|-------|----------|--------|
| RD-01 | Project scaffolding & toolchain | `codeops/_archive/rd-01-project-scaffolding-toolchain/` | ✅ COMPLETE |
| RD-02 | Lexer | `codeops/_archive/rd-02-lexer/` | ✅ COMPLETE |
| RD-03 | Parser & AST | `codeops/_archive/rd-03-parser-ast/` | ✅ COMPLETE |
| RD-04 | Semantic analysis & type system | `codeops/_archive/rd-04-semantic-analysis/` | ✅ COMPLETE *(slice-scoped: Pass 1 + intrinsic validation only; Passes 2/4 + real Pass 3 deferred via `08-deferred-semantics-ledger.md` — full scope driven by RD-18, AR-114. RD-18 Slice 3a began real §4.2 scope construction: ledger R7/R8 now build per-module + function scopes with symbols)* |
| RD-05 | SFA frame planner & ZP allocator | `codeops/_archive/rd-05-sfa-frame-planner/` | ✅ COMPLETE *(RD-18 Slice 3a superseded AC-22: `modelToFunctionInfo` now implemented for populated models; empty model still → `[]`)* |
| RD-06 | IL & IL optimizer (walking-skeleton slice) | `codeops/_archive/rd-06-il-optimizer/` | ✅ COMPLETE *(slice-scoped: gate + slice-2 lowering; full "all 51 node kinds" + multi-block CFG driven by RD-18, AR-114. IL-optimizer passes = Phase B)* |
| RD-07a | Structured `Instr` model | `codeops/_archive/rd-07a-instr-model/` | ✅ COMPLETE |
| RD-07b | IL→Instr live-op-set slice | `codeops/_archive/rd-07b-il-to-instr/` | ✅ COMPLETE |
| RD-07c | Codegen platform preamble (Half A) | `codeops/_archive/rd-07c-codegen-platform-preamble/` | ✅ COMPLETE |
| RD-10 | Platform plugin system (slice) | `codeops/_archive/rd-10-platform-plugin-system/` | ✅ COMPLETE |
| RD-11a | Diagnostics core | `codeops/_archive/rd-11a-diagnostics-core/` | ✅ COMPLETE |
| RD-08 | Peephole optimizer (passthrough v1, AR-38) | `codeops/features/blend65-ri/plans/rd-08-peephole-optimizer/` | ✅ COMPLETE |
| RD-09 | ACME emitter & assembler integration | `codeops/features/blend65-ri/plans/rd-09-acme-emitter/` | ✅ COMPLETE |
| RD-17 | Intrinsics & runtime ABI (all four tiers; AC-14 emulator tier ✅ discharged by RD-12 on real VICE, AR-P4/AR-P17) | `codeops/features/blend65-ri/plans/rd-17-intrinsics-runtime-abi/` | ✅ COMPLETE |
| RD-16 | Compiler configuration (`blend65.json` loader) | `codeops/features/blend65-ri/plans/rd-16-compiler-configuration/` | ✅ COMPLETE |
| RD-11b | Diagnostics remainder & resource reporter (`SourceMap`, severity policy, renderers, `ResourceReport`) | `codeops/features/blend65-ri/plans/rd-11b-diagnostics-reporting/` | ✅ COMPLETE |

---

## Status — Pending


> Ordered along the MVP critical path (Phase A first, then Phase B). "Plan dir" shows
> whether an implementation plan already exists or still needs `make_plan`.

| Order | RD | Title | Depends on | Plan dir | Phase | Status |
|-------|----|-------|-----------|----------|-------|--------|
| 1 | RD-15 | Programmatic + CLI API | RD-01, RD-09, RD-10, RD-11, RD-16 | `codeops/features/blend65-ri/plans/rd-15-programmatic-cli-api/` | A | ✅ COMPLETE (2026-07-03 — 50/50 tasks, 4 phases: host + driver codes + PF-002 rename; the full compile/emitIl/emitAsm/build facade (PF-001 codegen seam); the full `blendc` CLI (yargs, zero-dep color, R50 exit codes); AC-18 no-print enforcement + ST-39; CI ACME + ST-40 real-ACME E2E. AC-01..20 ticked; RD-11 AC-16/10/21 closed. Fixed RD-09 DEF-1 (headerless PRG → `!to`-driven cbm). Full verify + CI green.) |
| 2 | RD-12 | Test harness & emulator verification (incl. RD-17 AC-14 emulator tier — AR-P4) | RD-01, RD-09, RD-10, RD-15, RD-17 | `codeops/features/blend65-ri/plans/rd-12-test-harness/` | A | ✅ COMPLETE (2026-07-03 — 44/44 tasks, 4 phases. `@blend65/test-harness` ships the abstract `EmulatorDriver`, the pure VICE binary-monitor codec (CI byte-exact) + `ViceDriver` (real VICE 3.10), zero-dep PNG, the 3 timeout-guarded strategies, register/memory assertions, R7a registry, `setupEmulator` fixture (+`hasVice`/`hasAcme`), and `assertGolden`. All 16 own ACs ticked with ST evidence; **RD-17 inherited AC-14 discharged on real silicon** (ST-30..33, `__rt_*` math on VICE); DEF-2 closed (Phase 0 `--vicelabels` fix). Gate program pokes $D020 on real VICE (ST-29). Full workspace verify green (17/17 turbo, harness 71 tests). Runtime findings: AR-H18 (`advanceInstructions` 10th driver method), AR-H19 ($D020 reads 0xF5). Local emulator suites `skipIf` in CI (AC-13), run sequentially (`fileParallelism:false`). Earlier: Phase 2 COMPLETE 29/44: the three timeout-guarded run strategies (`runUntilLabel`/`runFrames`/`runUntilMemory`), register/memory assertions (numeric + symbolic), the R7a registry, and the `setupEmulator` fixture (+`hasVice`/`hasAcme`); ST-14..23/28 green (CI fake-driver + real VICE gate). Runtime findings: AR-H18 (added `advanceInstructions` 10th driver method) + AR-H19 (`$D020` reads back `0xF5` not `0x05` — VIC-II unused-nibble; AR-H9 value corrected). Full verify green (test-harness 54 tests). Next: Phase 3 golden/barrel/gate/RD-17 vectors. Earlier: Phase 1 COMPLETE 17/44: `@blend65/test-harness` ships the `EmulatorDriver` interface, the pure VICE binary-monitor codec (byte-exact, live-pinned vs VICE 3.10, CI-tested), the `ViceDriver` (spawn + loopback socket + REGISTERS_AVAILABLE id map, ST-09..13 green on real VICE), and the zero-dep truecolor PNG encoder. compiler dep + codegen devDep + tsconfig refs wired (PF-001). Full verify green. Earlier: Phase 0 — DEF-2 fixed (`--vicelabels` → populated `symbolMap`, oracle green). Next: Phase 2 strategies/assertions/registry/fixture. Earlier: 🔬 Plan Preflighted — preflight iteration 1: 0 critical / 0 major / 2 minor / 2 observation, all 4 fixed & applied; report `plans/rd-12-test-harness/00-preflight-report.md`. Top finding lowered MAJOR→MINOR by a challenger (undeclared `@blend65/codegen` test-scope dep + tsconfig refs — not build-blocking under Yarn hoisting). Also: gate/RD-17 suites skipIf VICE+ACME (PF-002); ST-02 exact addrs → impl smoke, ST-01 keeps DEF-2 oracle (PF-003); runFrames approximation documented (PF-004). DEF-2 re-verified live. Earlier: 📋 Plan Created — 4 phases / 10 sessions / 44 tasks; gate PASSED with 17 items (AR-H1..H17); DEF-2 fixed as Phase 0. Next: exec_plan.) |
| 3 | RD-13 | Non-functional requirements (cross-cutting sweep) | — | ❌ needs `make_plan` | A | ⬜ Not started |
| 4 | RD-14 | VS Code extension & Language Server | RD-03, RD-04 | ❌ needs `make_plan` | B | ⬜ Not started |
| 5 | RD-18 | Codegen language-feature completion (thin vertical-slice rollout; 100% working _unoptimized_ codegen for the whole frozen language) | RD-04, RD-05, RD-06, RD-07, RD-09, RD-10, RD-11, RD-12, RD-17 | **Slice 3a**: `codeops/features/blend65-ri/plans/rd-18-slice-3a-model-seam/` (✅ COMPLETE); **Slice 3b**: `codeops/features/blend65-ri/plans/rd-18-slice-3b-scalar-type-engine/` (✅ COMPLETE — 45/45); **Slice 4a**: `codeops/features/blend65-ri/plans/rd-18-slice-4a-conditionals-loops/` (✅ COMPLETE — 35/35); **Slice 4b**: `codeops/features/blend65-ri/plans/rd-18-slice-4b-switch/` (✅ COMPLETE — 26/26); **Slice 5a**: `codeops/features/blend65-ri/plans/rd-18-slice-5a-functions-calls/` (✅ COMPLETE — 46/46); **Slice 5b**: `codeops/features/blend65-ri/plans/rd-18-slice-5b-module-system/` (✅ COMPLETE — 42/42); **Slice 6**: `codeops/features/blend65-ri/plans/rd-18-slice-6-expressions/` (✅ COMPLETE — 52/52); slices 7→8 need `make_plan` | A→B | 🚧 In progress (per-slice). **Slice 6 ✅ COMPLETE (2026-07-11, exec_plan 52/52)** — full expressions & mixed width end-to-end, **closes RD-18 AC-5**: full operator matrix + TS-4 promotion under ONE `isAssignableTo` rule (5a strict-arg interim superseded), unary/casts/ternary/compound, width-aware const-eval (lazy logical/ternary folds, two's-complement helpers), short-circuit GUARANTEE as CFG diamonds over synthetic `0sc<N>` SFA slots (preorder + size-parity guards; `__init` pseudo-frame), comparisons stamped with the promoted operand type at ALL THREE emission sites + all four byte/word × unsigned/signed translate framings — fixing the latent DEF-1 word-compare miscompile; signed div/mod → loud rejection; non-const lo/hi; word + variable-count shifts; zext = zero-cost fold; W10160/W10161/W10101/W10174 live. **3-part bar GREEN on real VICE 3.10**: `$C000..$C008 = E7 04 DA 05 07 00 01 44 00` with the short-circuit suppression proof ($C005=$00, $C006=$01); 293-line golden (8 `0sc` equates); six prior goldens byte-exact NO re-mint; 9 negatives/advisories. Bonus defect fix: ACME accumulator rendering (`ASL A`→`ASL`). SR-2: 30 B data, ZP 10 B unchanged, binary 535 B, no new runtime routines. Ledger R31–R33/R40–R43/R49–R55 advanced. **Next: Slice 7 needs `make_plan`.** Prior: **Slice 6 🔄 Executing (2026-07-11, exec_plan)** — preflight ✅ PASSED same day (13/13 findings resolved & applied — headline: the DEF-1 word-compare fix extended to all three compare-emission sites). Prior: **Slice 6 📋 Plan Created (2026-07-11, make_plan)** — full expressions & mixed width (full operator matrix + TS-4 promotion everywhere, unary/casts/ternary/compound, short-circuit CFG diamonds over synthetic `0sc` SFA slots, signed+word comparisons fixing the latent DEF-1 word-compare miscompile, signed div/mod → loud ICE, word/variable shifts, non-const lo/hi, width-aware const-eval; mints E10086/E10087/E10088 + W10101/W10160/W10161/W10174); gate ✅ AR-1…AR-14; closes AC-5 on completion; next: preflight → exec_plan. Prior: **Slice 5b ✅ COMPLETE (2026-07-11, exec_plan 42/42)** — module system end-to-end (merging, full qualified-access value surface, call-free initializers + per-variable init order/E10194, scalar const completion, `__init` stream); **closes RD-18 AC-4 (Slice 5 fully ✅)**; 3-part bar GREEN on real VICE 3.10 (`$C000..$C006 = 05/08/07/02/01/03/01`); six prior goldens byte-exact, NO re-mint. **Next: Slice 6** needs `make_plan`. Prior: **Slice 5b 📋 Plan Created (2026-07-10, make_plan)** — module-system completion: merging (R20, name-keyed shared scopes, cross-file dup → E10003, replaces the 5a dup-module ICE), full qualified-access value surface (calls/reads/writes, exported-only, value-first heads, E10100/E10012 reuse, call-graph/SFA parity rider, `Math.fn`-as-value → ICE until Slice 8), call-free initializers (local-`let` parity; call → loud ICE) + ONE global per-variable init graph + spec-literal two-level order + ONE E10194 per cycle with path, scalar const completion (const-eval + E10193 + inlining — closes a VERIFIED latent mis-lowering hole for module-const refs), `initCode` → synthetic `__init` stream + additive `hasInitCode` → conditional `JSR __init` (all five prior goldens stay byte-exact; `--startup bare` documented user-owned). `plans/rd-18-slice-5b-module-system/`, Zero-Ambiguity Gate ✅ PASSED (AR-1…AR-13 + imported I-1…I-3; 3 recon agents + 1 independent challenger — converged on all five high-stakes picks, surfaced the bare-startup hole). Fixture: 3 files, both math files declaring `module Math`, Main discovered first but Math inits first (import-edge order load-bearing), VICE `$C000..$C006 = 05/08/07/02/01/03/01`. **Closes RD-18 AC-4 on completion. Next: preflight → exec_plan.** Prior: **Slice 5a ✅ COMPLETE (2026-07-10, exec_plan 46/46)** — user functions/params/calls/recursion/imports end-to-end; **3-part bar GREEN on real VICE 3.10** (`examples/slice5a/` two-module fixture → `$C000==$11`/`$C001==$84`/`$C002==$03`/`$C003==$10`; byte-exact golden). Phase 0 retired the 13-byte data ceiling (`ramStart` `$0800`→`$2000` + mandatory plan-keyed post-ACME overlap check E10033; five goldens re-minted equate-only + VICE re-verified; closes 3b AR-1/SR-3). Frontend: param collection (E10003/E10101-FN-13), `typeCall` ladder (E10100→E10051→E10023→E10175 + E10170/E10171/E10084), return completion (E10172 + assignment family, return wording), Tarjan call-graph → ONE E10174 per cycle w/ path, `import-resolution.ts` (E10012, user-wins, same-Symbol aliasing, dup-module ICE until 5b); E10175→`NotCallable`, E10051 minted. SFA: params-first frames, sorted callees, `argWindowInterferes` interference (sibling call-in-arg shapes compile correctly), NEW `hasErrors`→skip-`planAllocation` driver gate. Codegen: `lowerCall` store-per-arg + bare `call` (AR-3 residual ICE), translate `call` = `JSR` + A/A:X bind with the AR-4 remaining-use-ledger guard (`f()+g()` → ICE; `f(g(1),2)` compiles). SR-2: 9 B data at `$2000` (4 var + 5 frame, 2 B shared), ZP 10 B unchanged, `__rt_mul16` embedded. RD-04 ledger advanced (R58/R22/R66/R80/R81/R84–R87 + AC-07/AC-15; R10/R13/R65 partial) with deviations recorded once (E10175 rename + Ch 14 divergence, FN-11 no-param-limit, E1017x chapter drift, JSR-startup scoped, AR-3/AR-4/AR-13 deferrals). RD-18 AC-4 "5a partial ✅; closes at 5b". Full verify green; `spec/` clean. **Next: Slice 5b** (merging + `Module.fn` + call-free initializers/E10194) needs `make_plan`. Prior: **Slice 5a 🔬 Plan Preflighted (2026-07-10, preflight)** — iteration 1: 0 crit / 2 major / 4 minor / 1 obs, **all 7 resolved & applied** (iteration 2: 0 new findings; report `plans/rd-18-slice-5a-functions-calls/00-preflight-report.md`; 3 recon agents + 1 independent challenger, converged on both MAJORs). Both MAJORs were stale existing-code claims at never-miscompile seams, fixed as plan amendments: **PF-001** — AR-4 live-temp guard → NEW **separate** remaining-use map (the static prescan `useCount` provably cannot distinguish must-compile `f(g(1),2)` from must-ICE `f()+g()`; per-consumed-operand-occurrence decrement, never mutate `useCount`); **PF-002** — the `hasErrors`→skip-`planAllocation` gate does NOT exist → new driver-level gate in `run-frontend` guarding the whole call expression (inline `modelToFunctionInfo` + its AR-3 `reach()` DFS included), all new reachability DFS walks visited-set-bounded, the plan-allocation-level "still assembles" spec test untouched (different layer). MINORs: PRG load-address read-back must be built, size = header-excluded `binarySize` (PF-003); E10175 rename divergence vs the canonical Ch 14 registry recorded in the 5.1.2 deviation note (PF-004); duplicate module name across files → explicit unsupported ICE until 5b merging (PF-005); `lowerCall` unresolvable-callee ICE fallback (PF-006); phantom `lowerExprStatement` name fixed (PF-007). No gate decision changed; the register carries a preflight-amendment note. Grounding otherwise confirmed strong (~60 `file:line` claims verified; poke/pokew need no import; the multi-file facade works today; fixture arithmetic re-derived). Next: exec_plan. Prior: **Slice 5a 📋 Plan Created (2026-07-10, make_plan)** — user functions/params/calls vertical; Slice 5 split 5a/5b at the gate (AR-1). Gate ✅ PASSED (AR-1…AR-16; 3-agent recon + independent challenger). Keystones: Phase-0 data-region relocation `$0800`→`$2000` + mandatory post-ACME overlap check (AR-2, closes 3b AR-1); store-per-arg SFA calling convention + argument-window interference edges (AR-3); live-temp-across-call detect+defer ICE (AR-4); one E10174 per cycle, pre-SFA poison (AR-7); E10175 repurposed → `NotCallable` + E10051 minted (AR-9/AR-10); JSR-startup kept as scoped deviation, fall-through → Slice 8 non-terminating variant (AR-12); import aliasing `as` named-deferred (AR-13). 5b (module merging + `Module.fn` qualified access + call-free initializers + per-variable init order E10194) closes RD-18 AC-4. Next: plan preflight → exec_plan. Prior: **Slice 4b ✅ COMPLETE (2026-07-07, exec_plan 26/26)** — the `switch`/`case`/`default`/`fallthrough` sub-machine ships end-to-end, **closing RD-18 AC-3**. **3-part bar GREEN on real VICE 3.10**: `examples/slice4b/main.blend` (multi-value case + `fallthrough` + auto-break + `default`) computes `$C000==$19` (25, Switch A) / `$C001==$07` (7, Switch B: default path); byte-exact ASM golden committed; negatives reject via `compile()` (non-const case→E10071, duplicate→E10132, boolean switch→E10075). **Phase 1 (semantics)**: `statement-typing.ts` `typeSwitch` — discriminant operand-type **E10075** (poison/cascade-suppressed), per-value precedence **E10071**(non-const)→**E10084**(range)→**E10077**(bespoke type-match, wired but rarely reachable in integer-only 4b — emission from Slice 7, PF-002), cross-clause duplicate **E10132**, `fallthrough` position **E10074**/no-effect **E10073** warning; `function-collection.ts` recurses case/default bodies for flat locals (AR-12); break/continue transparent to switch (target the enclosing loop, AR-6). **Phase 2 (codegen)**: `lower.ts` `lowerSwitch` — a `brcond` **compare-chain** over the 4a multi-block CFG keystone; multi-value cases share a body block (AR-8), explicit `fallthrough`→`br(next clause body)`, auto-break→`br(join)`, default = the unconditional dispatch tail (AR-5); discriminant re-lowered fresh per test block (translate has no cross-block temp liveness); **zero** new IL terminator / translate work (AR-1). **Phase 4 (rollout)**: closed RD-18 AC-3 `[x]`; advanced RD-04 ledger R75 (switch expr + case values) + R79 (`fallthrough` context), R76 (exhaustive enum switch → E10133) stays deferred to Slice 7 (AR-2); five codes registered additively (E10071/E10073/E10074/E10075 + new mint E10077), **E10076** duplicate-`default` deferred parser-owned (parser silently overwrites, unreachable at semantics, PF-001); SR-2 (5B footprint, no new ZP/runtime) + SR-3 deferral closeout. Full workspace verify green; `spec/` clean. **Next: Slice 5** (functions/params/calls) needs `make_plan`. Prior: **Slice 4b 🔬 Plan Preflighted (2026-07-07, preflight)** — iteration 1: 0 crit / 3 major / 2 minor / 1 obs, **all 6 resolved & applied** (report `plans/rd-18-slice-4b-switch/00-preflight-report.md`; 3 recon agents + 1 challenger). Contract changes: **E10076** duplicate-`default` **dropped** → deferred parser-owned (unreachable at semantics — parser silently overwrites, PF-001); **E10077** case-type-match kept registered+wired but emission **deferred-reachable to Slice 7** with corrected precedence E10071→E10084→E10077 ("TS-4 auto-promotion" was fictional; bespoke check; ST-4→ST-4a E10084 + ST-4b `.todo`; PF-002); out-of-switch `fallthrough` ICE fixture **kept** (not repointed) + silent-accept gap deferred (PF-003); code mint corrected to **five** (E10077+E10071/E10073/E10074/E10075; PF-004) + spec cites fixed (PF-005); register carries a preflight-amendment note (supersedes AR-4/AR-7/AR-11/AR-13). Next: exec_plan. Prior: **Slice 4b 📋 Plan Created (2026-07-07, make_plan)** — the `switch`/`case`/`default`/`fallthrough` sub-machine deferred from 4a (AR-1). `plans/rd-18-slice-4b-switch/` (4 phases / 26 tasks), Zero-Ambiguity Gate ✅ PASSED (AR-1…AR-14). Three-agent recon: switch is **fully parsed** (AST/visitor/walk/parser all built) — 4b is **semantics + one `lowerSwitch` case**, no parser/translate/new-IL-terminator work. Codegen = a `brcond` **compare-chain** dispatch over the 4a multi-block CFG keystone; multi-value cases share a body block; explicit `fallthrough` (Swift auto-break default) → `br(next body)`. Validators: E10075 (operand type), E10071 (const case value), **E10077** (case-type-match, new), E10132 (duplicate, wired), E10076 (one default), E10073/E10074 (fallthrough no-effect/position). `break`/`continue` transparent to switch (target the enclosing loop, spec §9, AR-6). Four gate decisions (user): compare-chain (jump-table→Phase B, AR-1); integer-only, enums+E10133→Slice 7 (AR-2); fallthrough-in-default = E10073 warning, dissolves Parked-Q4 (AR-3); case-type-mismatch→new E10077 since E10072 is the parser's `MissingDefaultClause` (AR-4). default-required is RD-03's shipped behavior (fixtures carry `default`, not reconciled here, AR-5). Closes **RD-18 AC-3** on completion. 3-part bar: `examples/slice4b/main.blend` (multi-value + fallthrough + default) → VICE `$C000==$19`/`$C001==$07`. Next: exec_plan. Prior: **Slice 4a ✅ COMPLETE (2026-07-07, exec_plan 35/35 + DEF-1)** — the conditionals + loops + first **multi-block CFG codegen keystone** ships end-to-end. **Phase 5 (rollout bookkeeping)**: advanced RD-04 deferred-ledger rows R71/R72/R73 (condition→E10134), R74 (E10064/E10061/E10065), R77/R78 (E10130/E10131), R80 (all-paths E10102), R11 (flat counter/local collection) + AC-12/AC-17, with a Slice-4a advancement banner; annotated **RD-18 AC-3** `[~]` "4a partial ✅ (conditionals/loops); closes at 4b (switch)" (AR-14) and registered E10061/E10065/E10102/E10134 additively; SR-2 (no new ZP/runtime; footprint 4B within the AR-1 13-byte dead-stub shadow) + SR-3 (switch/`until`/E10060/E10062/E10101 deferrals) closed. **Phase 4 (acceptance — 3-part bar GREEN on real VICE 3.10)**: `examples/slice4a/main.blend` (module `byte result`; `main` runs a `for i=1 to 10` with `if i==7 break` / `if i==3 continue` / `sum+=i`, then a `while n>0` and a two-armed `if result>20`) assembles clean through real ACME to a loadable PRG, byte-exact golden minted (loop labels `Main_main_L0..L13`, Pattern-A `le`/`add`, break→L3 / continue→L2, corrected `eq`), and on real VICE `$C000==$15` (21) / `$C001==$01`. Negative (ST-22): a non-void function missing a return path → **E10102** via `compile()` (no binary). gate/slice3a/slice3b goldens byte-exact (ST-23). **DEF-1/AR-16** (latent RD-07b bug, exposed by 4a's first runtime `==`): `translateComparison` emitted `CMP;LDA #1;B?? done;LDA #0` — the `LDA #1` clobbered the Z flag so `eq`(BEQ)/`ne`(BNE) always yielded 0 (carry-based lt/le/gt/ge were fine); VICE read `$C000==0x3A` not `$15`; user decision: **fix eq/ne only** — branch directly after `CMP` — re-minted translate.spec ST-T13 + generate.golden ST-G3 + slice4a golden, added a DEF-1 no-LDA-between-CMP-and-Z-branch regression. **Phase 3 (multi-block translate)**: `translate.ts` `run()` loops **all** `fn.blocks` with `prescanAll()` + per-block `resetBlockState()` + block-label emission; `br`→JMP, `brcond`→`leftIntoA;BNE trueTarget;JMP falseTarget`, `unreachable`→∅ (PF-001 keystone fix). **Phase 2 (CFG lowering)**: `lower.ts` gains a loop-context stack + `lowerIf`/`lowerWhile`/`lowerDoWhile`/`lowerFor`(Pattern A) / `lowerBreak`/`lowerContinue` over `IlFunctionBuilder`. **Phase 1 (control-flow semantics)**: `function-collection.ts` recurses into control-flow bodies (flat body-local + for-counter collection, AR-9); `statement-typing.ts` gains `loopDepth` threading + `typeCondition` (E10134) + if/while/do-while/for/break/continue + `typeFor` (E10065/E10064/E10061); `post-check.ts` `checkAllPathsReturn` (E10102, structural). Full workspace verify green; `spec/` clean. Next: **Slice 4b** (`switch`) needs `make_plan`. Prior: **Slice 4a 🔬 Plan Preflighted (2026-07-07)** — preflight iteration 1: 0 critical / 1 major / 3 minor / 0 observation, **all 4 resolved & applied** (report `00-preflight-report.md`). **PF-001 (MAJOR)**: the multi-block `translate.ts` keystone carried block-local peephole state (`prescan` scope, the instruction-**index** `skipIndex`, the `regA`/fold mirror) across basic-block boundaries; a blind challenger confirmed two concrete miscompiles (stale `skipIndex` drops a live instruction; `prescan` under-counts non-entry temps → folded-away second consumer) → fixed by mandating `prescanAll()` (all blocks + terminator reads) + a per-block `resetBlockState()` (new 03-03 §1a; exec 3.2.1 + impl-test 3.3.2). **PF-002 (MINOR)**: for-counter with an omitted (parser makes `: type` optional) or non-integer type silently poisoned → guard off `integerRange(counterType) === null` → **new E10065** (AR-15, free/no-Ch05-drift). **PF-003**: stale "E10003 dup-check in the collector" claim → real silent last-wins alias. **PF-004**: contradictory `brcond` flags-live framing removed (`translateComparison` materializes 0/1). **Slice 4a 📋 Plan Created (2026-07-06, make_plan)** — conditionals + loops (`if`/`else`, `while`, `do-while`, `for` `to`/`downto`/`step`) + the first multi-block **CFG codegen keystone** (IL `br`/`brcond` lowering + multi-block IL→Instr translate). 5 phases / 35 tasks, Zero-Ambiguity Gate ✅ PASSED (AR-1…AR-15). Scope locked: **split** — `switch`/`fallthrough` → Slice 4b (AR-1); **core + safety-critical** validators (boolean-condition E10134, break/continue E10130/E10131, all-paths-return E10102, for end-bound E10064, step E10061, counter-type E10065; defer E10060/E10062/E10101); **defer `until`** (parser-blocked, AR-3); for-loop **Pattern A only** (full-range `to 255` wrap → 4b-era, AR-6); for-counter shadowing **deferred** (Parked Q3, AR-5). 4-agent recon confirmed parser/AST complete + codegen scaffolding (terminators/builder) ready — the build is semantics + CFG wiring. New codes E10061/E10065/E10102/E10134 registered additively (AR-11 precedent). Next: exec_plan. Prior: **Slice 3b ✅ COMPLETE (2026-07-06, exec_plan 45/45)** — the scalar type/scope engine ships end-to-end. **Phase 5 (rollout bookkeeping)**: ticked RD-04 AC-02/03/04/06/08/13/14 (scalar subset) in the deferred ledger + a Slice-3b advancement banner (R7/R8, R14–R16/R61, R30–R36, R44–R49, R54, R63, R66, R80/R81, R114); **PF-004 correction** — RD-04 AC-05 `byte + sbyte` is **E10081** (arithmetic operands, R49), *not* E10153 (the assignment cross-sign case, R33); ticked **RD-18 AC-2** with real-VICE evidence; SR-2 delta (module vars 3B + frame 7B = 10B; `__rt_mul8`+`__rt_mul16` embedded) + **SR-3** the AR-1 13-byte dead-stub-shadow ceiling (a >13B var footprint would collide with `__startup` at `$080D` — general fix deferred). **Phase 4 (acceptance — 3-part bar GREEN on real VICE 3.10)**: `examples/slice3b/main.blend` (module `accB:byte`/`accW:word` + local `a,b,c:byte`/`x,y:word`; `accB=a*b+c`→`poke($C000)`, `accW=x*y`→`pokew($C001)`) assembles clean through real ACME to a loadable PRG, byte-exact golden minted (`__var_Main_accB=$0800`/`accW=$0801`, `__rt_mul8`, `__rt_mul16`; footprint $0800–$0809 = 10B ≤ 13B dead-stub shadow, AR-1 ✓), and on real VICE (x64sc) `$C000==$11` / `$C001==$58` / `$C002==$02` — the full type-engine→SFA→codegen→ACME→PRG→VICE path computes correctly. Mixed-sign negative (ST-19) rejects `byte+sbyte` with **E10081** via `compile()` (no binary). gate/slice3a goldens unchanged (ST-20). test-harness 78 green. **Phase 3 (width-aware lowering)**: `lower.ts` now reads `ctx.model.typeOf(expr)` for literal/binary IL width (word literals → `i16u`, `word*word` → `__rt_mul16`; reuses existing `ilTypeOfType`, no new plumbing — PF-007/008) and lowers module scalars to `__var_*` via `model.symbolOf`→`scope.kind==="module"` (`moduleVarOf`/`moduleVarSymbol`, exact `sanitize` match to SFA). Byte path unchanged (gate/slice3a goldens hold); poisoned binary → i8u fallback, never throws. Full verify green (codegen 335). Prior: **Phase 1 (scalar type engine)**: real RD-04 Pass 3 (`type-check/{expression,statement}-typing.ts` + `name-resolution`/`type-resolution`/`const-eval`) populates `typeMap`/`symbolMap`; core `isAssignableTo`/`commonType` same-type rules replace the stubs; Pass 4 `post-check.ts` (`main()` E10020/E10021/E10022) wired into `passes.ts`; `analyze.ts` invokes both, `typeOf`/`symbolOf` read the real maps. Emits E10081/E10080/E10084/E10100/E10152/E10153/E10154/E10173/E10191 + registered E10084/E10022 (AR-11). **Phase 2 (module-level scalars)**: new `module-variable-collection.ts` collects top-level `let`→`variable`/`const`→`constant` into the module scope (E10003 duplicate), wired into `analyze.ts` before typing so body refs resolve; `modelToModuleVars` (`sfa/model-adapter.ts`, barrel-exported) projects module scalars → `ModuleVarInput[]`; `run-frontend.ts` feeds it (`moduleVars: []`→real). Full workspace verify green (frontend semantics+adapter 87, compiler 82, golden-gate/slice3a unchanged, R15 boundary). Two runtime ambiguities resolved: **AR-12** (ST-S21 empty-maps superseded; Pass-4 gated on ≥1 function) + **AR-13** (E10150 parser-owned; ST-7 reframed). Next: Phase 4 (acceptance — fixture + assemble-clean + golden + local VICE). Prior: **Slice 3b 🔬 Plan Preflighted (2026-07-05)** — `plans/rd-18-slice-3b-scalar-type-engine/`: 5 phases / 45 tasks, Zero-Ambiguity Gate ✅ PASSED (AR-1..AR-11); **preflight 2 crit / 3 major / 4 minor / 1 obs, all 10 resolved & applied (iter 2)** — root cause was diagnostic-code drift (codes taken from stale frozen-spec §5.3 + a false "all codes exist" claim), fixed by the **AR-11 code-reconciliation** (register E10084 + E10022 per RD-18 AR-115; realign boolean-arith→E10080 / narrowing→E10154 / cross-sign→E10153 / boolean-assign→E10152; drop E10086); structural build verified sound; report `00-preflight-report.md`. Scope: the scalar **type engine** — real RD-04 Pass 3 (expression/literal typing → `typeMap`/`symbolMap`, real `isAssignableTo`/`commonType`, poison) + Pass 4 (`main()` validity) + minimal const-eval; module-level scalar declaration/allocation (`__var_*`); width-aware lowering (thread `typeMap` so word literals reach `__rt_mul16`). Three parallel recon agents confirmed codegen already lowers the surface end-to-end — the build is **semantics + wiring**, not a codegen rebuild. Gate calls: same-type only (widening/casts → Slice 6, AR-3); module-var initializers **deferred** (declare + assign in body, spec VAR-2, AR-2); SFA `$0800` region kept within the 13-byte dead-BASIC-stub shadow (the `>13-byte` variable/code collision is a **documented deferred fix**, AR-1); signed `*`/`/`/`%` out-of-surface (AR-5); fixture VICE-asserts `$C000==$11`/`$C001==$58`/`$C002==$02`. Next: exec_plan. Prior: **Slice 3a ✅ COMPLETE (2026-07-05)** — exec_plan 21/21 tasks, 3 phases, full workspace verify green + the 3-part acceptance bar (CI assemble-clean + CI golden + local VICE `$D020==0xF5` on real 3.10). The `modelToFunctionInfo` seam is closed: new `function-collection.ts` builds a per-module `Scope` + function symbols + ordered locals + `mainFunction`; `analyze()` wires it alongside `collectDeclarations` (`passes.ts` untouched); `modelToFunctionInfo` projects real `FunctionInfo[]` (`name="Main.main"`, `fn.scope.node.name` FQN module per AR-13). The local-byte fixture (`examples/slice3a/main.blend`) assembles to a loadable PRG (`__frame_Main_main_x = $0800`) and drives the border register on real VICE. Parent ACs ticked (RD-05 AC-22 superseded; RD-04 ledger R7/R8 real scope construction begun; RD-18 AC-1 ✅); gate golden re-minted +1 line (AR-8) with VICE non-regression; SR-2 delta recorded (+6 code / +1 frame RAM / 0 ZP). `spec/` clean. **Next: Slice 3b** (scalar type engine) needs `make_plan`. Prior: **🔬 Plan Preflighted (2026-07-05)** — plan preflight: 0 critical / 1 major / 2 minor / 3 observation, all 6 resolved & applied (iteration 2). MAJOR (AR-13): adapter couldn't recover a function's module for the FQN from a `SemanticModel` → closed by a per-module `Scope` + `fn.scope.node.name` (model-only, no core change, hardened by an independent challenger); report `plans/rd-18-slice-3a-model-seam/00-preflight-report.md`. Next: exec_plan. Prior: **📋 Plan Created (2026-07-05)** — `plans/rd-18-slice-3a-model-seam/`: 3 phases / 21 tasks, Zero-Ambiguity Gate PASSED (AR-1..13). Scope: the keystone model-seam proof only (populate a minimal real `SemanticModel` with `main`+one local `byte`; implement `modelToFunctionInfo`; 3-part acceptance). Grounding confirmed the entire downstream (SFA→symbols→ACME→PRG→VICE) is already wired — the sole stub is `modelToFunctionInfo` (`model-adapter.ts:34`) + the empty-model `analyze()`; IL lowering is name-and-frame-keyed (`lower.ts:206,268`), so the local-byte fixture lowers with no new codegen. Locked decisions: 3a only (AR-1); use-the-local fixture `let x:byte=5; poke($D020,x)` (AR-2); adapter reads the *populated* model, not the AST (AR-4); population is a reusable RD-04 Pass-1 slice in new `function-collection.ts`, extended by 3b (AR-5); `FunctionInfo.name="Main.main"` to match `lower.ts:153` (AR-7); existing gate ASM golden intentionally re-minted to add `__frame_Main_main` + VICE re-verified (AR-8). No new diagnostic codes / parked questions / `spec/` edits (AR-12). Prior: 🔎 RD Preflighted (2026-07-04 — audited, codebase-grounded, 6 findings all resolved & applied: 2 MAJOR diagnostic-code fixes [recursion→canonical `E10174`; three code-less Slice-4 checks routed to the slice gate as new `diagnostic-codes.ts` entries with `spec/` frozen, AR-115/Option A] + 4 MINOR; report at `requirements/00-preflight-report.md`). Prior: ✏️ RD Drafted 2026-07-03 — thin reference-only rollout over RD-04/06/07 + `spec/`; 7 slices 3a→8, each grown across semantics→`modelToFunctionInfo`→IL lowering→IL→Instr and gated by CI assemble-clean + CI golden + local VICE; supersedes phantom `RD-04b` + the ledger's horizontal resume order; drives RD-04/06/07 open ACs shut; optimizers excluded → Phase B. Decisions AR-110..115.) |


> **Why RD-11b leads now (RD-15 preflight PF-001, 2026-07-03):** RD-15's own text consumes
> six RD-11-remainder deliverables that don't exist yet — `SeverityPolicy`, `renderTerminal`,
> `renderJson`, `renderReportTerminal`, `ResourceReport`, and the `SourceMap` registry
> (`core/src/diagnostics/source-span.ts:16` defers it to RD-11b) — and AR-83/AR-84 pin the
> default build summary to the MVP gate, so RD-15 cannot ship without them. RD-11b is
> unblocked today (RD-11a ✅, RD-09 ✅). RD-15 then wires finished pieces into a runnable
> `blendc` (consuming RD-16's config + RD-09's process layer), and RD-12 proves the gate
> program in VICE (including RD-17's deferred AC-14 emulator tier — AR-P4). RD-08's full
> 11-rule optimization catalog remains Phase-B work.
>
> **MVP gate (AR-43/44):** the Phase-A chain (through RD-12) exists to compile the gate
> program — `poke` a constant on c64 → `.prg` → VICE asserts the result — and prove a
> terminating `main`. Slice 2 brings a local `byte` online (SFA + ZP allocator already done).


---

## MVP Critical Path (why this order)

```
RD-07c (finish codegen; consumes RD-10 plugins)
   └── RD-08 (peephole passthrough v1 — completes the Instr pipeline)
         └── RD-09 (Instr stream → ACME .asm → binary)
               └── RD-17 (intrinsics/runtime ABI — the gate `poke` lives here)
                     └── RD-16 (config) → RD-11b (severity policy, renderers, resource reporter)
                           └── RD-15 (CLI/programmatic API to drive the pipeline)
                                 └── RD-12 (emulator verification — proves the gate program runs)
                                       └── RD-13 (non-functional sweep)
Phase B: RD-08 rule catalog (real peephole rules), RD-14 (LSP), additional platforms.
```


---

## Update Protocol

This roadmap MUST NOT drift from the plan headers. Whenever work changes status:

1. When an RD's `codeops/features/blend65-ri/plans/<rd-slug>/99-execution-plan.md` progress
   header reaches **100%**, move its row from **Pending** to **Done** in the same change set.
2. Update **Current Position** (last completed + next up).
3. If a new plan directory is created via `make_plan`, flip that RD's "Plan dir" cell from
   `❌ needs make_plan` to the path.
4. Bump **Last Updated**.
5. Keep the ordering/dependencies consistent with `requirements/README.md`. If they
   diverge, reconcile — `requirements/README.md` owns dependencies; this file owns status.
