# Ambiguity Register: RD-18 Slice 5b — Module System Completion

> **Status**: ✅ GATE PASSED — all 13 items resolved (2026-07-10; every row answered individually by the user across four themed batches + one surface-during-authoring item)
> **Last Updated**: 2026-07-10 22:38
> **Plan**: `rd-18-slice-5b-module-system` (second half of the Slice-5 split; closes RD-18 AC-4)
> **Hardening**: three recon agents (spec ground truth / frontend semantics / codegen-SFA-driver)
> + one independent challenger over the high-stakes batch (AR-1, AR-2, AR-5, AR-7, AR-8).
> Challenger verdicts: converged on all five; improved AR-1 (silent-poison rider), AR-7 (the
> (a-minus) trim lever), AR-8 (additive `hasInitCode` flag + consume-time wrapper); surfaced
> AR-12 (`--startup bare` never runs `__init`) as a new item.

## Imported pre-resolved context (5a gate — no re-confirmation needed)

| # | Source | Decision (already user-confirmed) |
|---|--------|-----------------------------------|
| I-1 | 5a AR-15 | 5b scope envelope: module merging (R20, cross-file duplicate → E10003), qualified access `Module.fn` (R17), **CALL-FREE** module-var initializers + per-variable topo order + E10194, lowered through the existing `ILProgram.initCode` seam, run before `main`, VICE-verified. Call-bearing initializers → named deferral (owner: user; revisit: the slice that needs them — the spec's dependency rule is defined over variable reads; calls hide reads). |
| I-2 | 5a AR-13 | Import aliasing `import { X as Y }` stays deferred (owner: user; revisit: when a fixture/user program needs a cross-module rename). |
| I-3 | 5a AR-5 | Strict same-type policy (promotion engine = Slice 6) — applies unchanged to initializer-vs-declared-type checking. |

## Register

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Scope | Qualified-access value surface. Spec Ch 10 §4.4: "Exported declarations can also be accessed with full qualification without import… always available" — normative over *declarations*, but both examples are type-position only; R17 is generic. Type-position (`Math.SomeType`) belongs to Slice 7 (structs/enums). | (a) full value surface — calls `Math.fn()`, reads `Math.v`, writes `Math.v = x` (all exported-only); (b) calls + reads (unlanded write form must emit an explicit diagnostic, never silent poison); (c) calls only (not viable: §4.4 makes import-less qualified reads legal input to this slice's init-dependency analysis). Rider (no options — correctness): once the head resolves to a module, NO qualified form stays on the silent-poison path (poison → `hasErrorNode` → lowering silently SKIPS the whole function, lower.ts:146-148); qualified calls feed the same call-graph edges/callSiteSpans/SFA-callees/arg-window machinery + callee ladder as ident calls. | **(a) full value surface** (recommended; challenger converged Med-High) — rider binding. | ✅ Resolved |
| 2 | Behavioral | Qualified-head resolution & collision: `Math.x` where a value symbol `Math` is also in scope (legal today — E10101 only guards params). Spec + RD-04 silent; module names absent from the R15 lookup chain; modules are Scopes, not Symbols. | (a) value-resolution first — head resolving to a value symbol keeps today's silent poison (struct field access is Slice 7); only an UNRESOLVED head consults the user-module map; still-unknown head → E10100. (A "did you mean the module?" hint needs a note/W severity that doesn't exist — not minted now.); (b) module-name first (inverts normal shadowing; collides with Slice-7 struct fields). | **(a) value-first** (recommended; challenger converged High — innermost-binding-wins is the universal norm). | ✅ Resolved |
| 3 | Naming | Qualified-failure diagnostics: NO registry code exists for unknown-module or unknown-member (full Ch 14 sweep). | (a) reuse — unknown head → E10100 on the head span; member missing OR non-exported → E10012 (message shape fits; mirrors the shipped import conflation); exported-only holds even for self-module qualification (spec letter); (b) mint new codes (permanent registry drift). | **(a) reuse E10100 + E10012** (recommended). | ✅ Resolved |
| 4 | Behavioral | Initializer expression surface + call rejection. Call-free pre-agreed (I-1); a call-bearing initializer is SPEC-LEGAL but deferred — what does the user see? | (a) explicit unsupported ICE (IceCode.Unexpected, "call-bearing module initializers are not supported yet — assign in main() instead") — the PF-005 loud-deferral precedent; allowed surface = everything the scalar engine types/lowers (literals, module-var refs incl. imported/qualified per AR-1, binary arith, `lo`/`hi` — unary is currently neither typed nor lowered by the scalar engine and stays out of surface, function-local parity), checked strict-same-type (E10152/53/54 + E10084) exactly like a local `let`; (b) reuse E10193 (semantic lie; const-specific message). | **(a) unsupported ICE** (recommended). | ✅ Resolved |
| 5 | Behavioral | Init-order rule for independent variables. Spec Ch 10 §5.4: per-variable dependency order; independent vars = declaration order within a module; "modules ordered by their dependency edges (imports)". Circular imports LEGAL (R21); call-free initializers pure → base order golden-visible only today, observable once initializers widen. Graph span (grounded, no options): ONE global per-variable graph; edges = initializer references to module vars that themselves have initializers (imports alias the same Symbol; qualified refs per AR-1; consts never runtime edges; initializer-less vars have no init position — W10190 stays deferred, R111). | (a) spec-literal two-level — module base order via Kahn over import edges (discovery-order tiebreak; cycle-tolerant, intra-cycle order = discovery fallback, recorded as the slice's one genuine spec gap), then global per-variable stable topo with priority (module order, declaration order); merged-module declaration order = file discovery order × item order (discovery lexicographically sorted by contract, disk-host.ts:7); (b) discovery×decl only (recorded scoped deviation, golden-baked once observable). | **(a) spec-literal two-level** (recommended; challenger converged High). | ✅ Resolved |
| 6 | UX | E10194 granularity + message. Spec message (Ch 14): `Circular initializer detected — '<name>' depends on itself (directly or indirectly) through module-level initialization order` (single name, no path). RD-04 §4.9's per-symbol-in-cycle contradicts the recorded 5a E10174 one-per-cycle precedent — excluded. | (a) ONE E10194 per cycle (Tarjan via the Symbol-generic `findCallCycles`), anchored first-declared variable, spec message + appended path in the E10174 style (`— cycle: a → b → a`); (b) spec-exact message only. | **(a) one per cycle + path** (recommended). | ✅ Resolved |
| 7 | Scope | Module-level `const` completion. VERIFIED latent hole: a module const collects as a "constant" symbol and types clean, but `lowerIdent` (lower.ts:745-756) matches only kind "variable" → falls to the frame path, `slotIlType` (lower.ts:1064-67) silently defaults to byte → undefined `__frame_*` symbol at ACME (and NO error under `emitAsm`). Spec §5.4's own table row: consts compile-time, inlined, never in runtime init order — `const SCREEN = $0400; let ptr = SCREEN;` is the idiomatic shape. | (a) scalar-const completion — Pass-3 const-eval (identifier→constValue), populate `SemanticModel.constValues`/`Symbol.constValue`, wire E10193 (E10192 recorded parser-owned — `ConstDeclNode.initialiser` non-null by AST type), inline const refs as immediates, consts legal in let-initializers as non-edges; (a-minus) same seams, literal + single-ident const initializers only (const arithmetic → E10193 provisionally); (b) defer consts (ICE guard; third deferral; §5.4's const row ICEs on its idiomatic shape). | **(a) full scalar-const completion** (recommended; challenger converged Med-High; rabbit-hole bounded by the call-free grammar — everything out-of-scope → E10193). | ✅ Resolved |
| 8 | Technical | `initCode` seam realization + startup wiring. Grounded: `ILProgram.initCode: readonly BasicBlock[]` exists frozen-empty, ZERO consumers; startup shim `c64StyleStartupShim` (shared-hooks.ts:82-104) shared by all five plugins; `PreambleOptions.needsDataInit` derived from constData only, documented for const/init DATA copy, ignored by every plugin; streams emit in array order; `sanitize` reserves `__` names. | (a) honor the seam — `lowerToIL` builds init stores (IlFunctionBuilder) into `initCode`; when non-empty, `generateInstr` wraps the blocks in a local synthetic ILFunction-shaped record, reuses `translateFunction`+`validateStream`, unshifts the RTS-terminated `__init` stream FIRST; NEW additive `PreambleOptions.hasInitCode` (do NOT repurpose `needsDataInit`) threads through `emitPreamble` so the shim emits `JSR __init` (after banking, before `JSR _main`) ONLY when initializers exist — initializer-free programs emit nothing new, all five prior goldens stay byte-exact; (b) synthetic `__init` ILFunction in `functions` (seam stays dead; printIL/tests shift); (c) inline at top of `main` (overrides the I-1 seam; contradicts spec §5.3). | **(a) seam + `__init` stream + `hasInitCode`** (recommended; challenger converged High + amendments adopted). | ✅ Resolved |
| 9 | Technical | Merging mechanics bundle (forced by grounding): module scopes keyed by NAME in `collectFunctions` (first file's ModuleDeclNode = scope.node, deterministic); `collectModuleVariables` consumes `moduleScopeByProgram` (fixes the node-identity lookup, module-variable-collection.ts:40-42); E90001 dup-module ICE removed + its pinning test (call-semantics.impl.test.ts:102-114) superseded; cross-file duplicates → E10003 falls out; self-import guard still holds (shared scope); FQN via scope.node unchanged; E10101 param-shadowing now spans the merged module (correct per FN-13). | (a) confirm bundle; (b) adjust a component. | **(a) confirm bundle** (recommended). | ✅ Resolved |
| 10 | Integration | Acceptance fixture + negatives + verify command. | (a) `examples/slice5b/` = THREE files — `main.blend` (module Main; one imported call, one qualified call WITHOUT import, qualified var read, pokes to `$C0xx`), `math.blend` + `math2.blend` (BOTH `module Math` — merging witness; cross-file same-module call; initialized vars incl. a cross-module dependency chain, byte + word, and a const per AR-7); exact values fixed in 07-testing-strategy; negatives compile-only: init cycle → E10194, qualified non-exported → E10012, unknown module head → E10100, call in initializer → ICE (AR-4), cross-file duplicate decl → E10003; four artifacts mirror slice5a (`testing/slice5b.ts`, golden + mint, spec + negatives). Verify = `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` (unchanged); (b) different shape. | **(a) confirm 3-file shape + verify unchanged** (recommended). | ✅ Resolved |
| 11 | Naming | Plan folder `rd-18-slice-5b-module-system`; new frontend module `semantics/init-order.ts` (Pass-4 sibling of checkRecursion); synthetic label `__init`; qualified-access typing lives in `expression-typing.ts` (`typeFieldAccess`). | (a) accept names; (b) alternatives. | **(a) accept names** (recommended). | ✅ Resolved |
| 12 | Edge case | (Challenger find) `--startup bare` emits NO startup code at all (shared-hooks.ts:85-87) — a bare-built program with module initializers never runs `__init`, silently. Bare's shipped RD-15 contract: the user owns the entire entry sequence (no `JSR _main` either). | (a) document as user-owned — the `__init` label exists in the emitted ASM; a bare-startup user owns calling it exactly as they own calling `_main`; recorded in the shim/API doc comments; (b) mint a new W-code warning (registry drift, expert-only seam). | **(a) document user-owned** (recommended). | ✅ Resolved |
| 13 | Edge case | (Surfaced during authoring) A qualified member resolving to a FUNCTION/interrupt in a value position (`let x: byte = Math.add;`, `poke(a, Math.add)`) or as an assignment target (`Math.add = 5`). The AR-1 rider forbids silent poison once the head resolves to a module; function references (`&fn`) arrive with Slice 8. Const write targets already covered (`Math.SCALE = 5` → E10191). | (a) unsupported ICE (IceCode.Unexpected, "function references are not supported yet…") for both value reads and assignment targets of function/interrupt members — the AR-4/PF-005 loud-deferral pattern; revisit: Slice 8 (`&fn`); (b) repurpose E10175/E10191 with adjusted wording (both codes would misstate the defect). | **(a) unsupported ICE** (recommended). Named deferral: qualified function references; owner: user; revisit: Slice 8 (`&fn`). | ✅ Resolved |

### Resolution Notes

**I-1..I-3:** Imported from `plans/rd-18-slice-5a-functions-calls/00-ambiguity-register.md`
(AR-15/AR-13/AR-5) per the shared gate's rule 3 — pre-resolved rows are not re-confirmed. The
5a register's AR-15 footnote explicitly reserves everything inside the envelope for this gate.

**AR-1 rider evidence:** `recordCallEdge` (expression-typing.ts:366-388) and the SFA
`userCalleeOf`/`collectCalls`/`canReach` walks (model-adapter.ts:117-121, lower.ts) are all
IdentExpr-keyed today; each needs the qualified-callee arm or the guarantees break silently.
Because imports alias the SAME Symbol, everything downstream of resolution (typing, edges,
lowering) is symbol-keyed and works unchanged once a shared
`resolveQualified(FieldAccessExpr) → Symbol` helper lands — which is why the write arm is a
thin delta over the read arm (typeAssign const-check + one lowerAssign case).

**AR-5 span evidence:** spec 10-modules.md:197-203 (rules table), 205-215 (examples);
RD-04 §4.9 (symbol-level graph → `SemanticModel.initOrder`, which exists and is always `[]`).
Purity: call-free initializers can only read module vars/consts and literals — no observable
effect distinguishes valid topological orders today; the challenger's decisive point is
temporal: the base order gets golden-baked and becomes observable the moment initializers
widen, so deviating on the fully-specified common case (option b) was the wrong trade.

**AR-7 verification:** lowered chain re-verified in this session (lower.ts:745-756 +
slotIlType 1064-67 + constants excluded from `__var_*` projection at model-adapter.ts:176).
Idle seams verified: `ConstValue` (const-value.ts:14), `Symbol.constValue` (symbol.ts:51),
`SemanticModel.constValues` (semantic-model.ts:36, frozen-empty :72), `NonConstInit`/E10193
wired nowhere. Known rabbit-hole risk (overflow/signedness/narrowing) bounded by scoping
the evaluator to the call-free grammar and routing every out-of-scope shape to E10193.

**AR-8 evidence:** cfg.ts:82-91 (`initCode` typed, doc "empty in v1"); lower.ts:155 (frozen
`[]`); instr-program.ts:76-87 (functions-only loop), 164-171 (`needsDataInit` derived from
constData, hardcoded `needsBssZero: false`); shared-hooks.ts:82-104 (shim), c64.ts:88-90
(plugins ignore the flags); serialize-acme.ts:110-117 (stream order). Bounded residual risk
(challenger counter): init temps have no frame in the AllocationPlan — acceptable because
call-free scalar initializers use the same register/`__zp_tmp` shapes function bodies use
today and nothing is live across `__init`; if a spike shows spill handling is non-trivial,
falling back to option (b) requires returning to the user (the seam agreement is binding).

**Preflight corrections (2026-07-11, `00-preflight-report.md` PF-002/PF-007):** AR-4's
allowed-surface list amended — "unary" removed (UnaryExpr is neither typed nor lowered by
the scalar engine today; module parity with the function-local silent-poison→lowering-ICE
behavior), and the call-rejection walk clarified to cover `IntrinsicCallExpr` (all builtins
except `lo`/`hi`, whose arguments are still recursed) — builtins parse as their own node
kind, so a `CallExpr`-only walk would silently admit `peek`/`peekw`. Neither correction
changes the user's resolved decision (loud call-free deferral); both tighten its mechanics.

**Spec-internal drift recorded for the ledger (cite-only, no gate decision):** RD-04 R23
"import dependency graph" vs frozen Ch 10 §5.4 per-variable order (already adjudicated at 5a
AR-15 — per-variable wins; RD-04 §4.9 agrees); Ch 03 §5.1 ZP-before-RAM vs Ch 10 §5.4
dependency order (unreconciled; zeropage = Slice 8, fixture avoids); grammar.ebnf.md:70-71
mandatory `let` initializer vs Ch 03 §2.1 optional (parser already accepts both; Ch 03 wins);
Ch 03 §7 reserves E10190 absent from Ch 14; dotted module names appear in 5 spec examples but
the grammar's `module`/`from` take a single identifier (all five are T4 platform namespaces).
