# Ambiguity Register: RD-18 Slice 6 — Full Expressions & Mixed Width

> **Status**: ✅ GATE PASSED — all 14 items resolved (13 at the gate + AR-14 surfaced during authoring)
> **Last Updated**: 2026-07-11 13:31
> **Artifact**: `plans/rd-18-slice-6-expressions/` (implements blend65-ri/RD-18, AC-5)

Codebase grounding for every row was verified against the working tree at commit `36c71fb`
(branch `v3`). Key evidence files: `packages/frontend/src/semantics/type-check/expression-typing.ts`,
`packages/core/src/semantics/type-utils.ts`, `packages/frontend/src/semantics/const-eval.ts`,
`packages/codegen/src/il/lower.ts`, `packages/codegen/src/instr/translate.ts`,
`packages/core/src/diagnostics/diagnostic-codes.ts`, `spec/02-type-system.md`,
`spec/04-expressions-operators.md`.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Scope | Signed relational comparisons (`sbyte`/`sword` `<` `<=` `>` `>=`): spec §5.2 allows them (N⊕V framing); translate implements unsigned CMP only (`translate.ts:742` "comparison (unsigned)") | A: implement signed byte+word compares in 6 / B: loud ICE, defer to the future signed-arithmetic slice | User chose A — implement signed byte+word comparison framing (N⊕V) in Slice 6 | ✅ Resolved |
| 2 | Behavioral | Signed `/`/`%` silently miscompile today: `translateDivMod` always calls unsigned `__rt_div8/16` regardless of `type.signed`; signed runtime routines are RD-18 Won't-Have | A: loud lowering ICE for signed div/mod (never-miscompile; 5b call-bearing-init precedent) / B: frontend rejection with a new E-code | User chose A — loud ICE at lowering; signed `*` stays allowed (bit-exact via unsigned routines) | ✅ Resolved |
| 3 | Scope | Argument/return widening: Slice 5a shipped strict same-type args (E10171); spec §5.3 + TS-4 make `byte`→`word` / `sbyte`→`sword` implicit everywhere assignment compatibility applies | A: adopt assignment compatibility for args/returns/assignments in 6 (supersedes the 5a interim pin) / B: widen assignments only, keep args strict until a later slice | User chose A — widen everywhere; ONE `isAssignableTo` rule; 5a strict-arg spec tests get a documented supersession note | ✅ Resolved |
| 4 | Scope | Warning mint set for 6 (all free in the registry): W10160/W10161 (intermediate overflow, TS-9), W10101 (narrowing cast truncates const), W10174 (shift ≥ width), W10100 (signed const overflow), W10173 (possible runtime div-by-zero — needs flow analysis) | multi-select; recommendation: W10160+W10161+W10101+W10174 in, W10100+W10173 deferred | User selected W10160+W10161, W10101, W10174 (mint + emit in 6); W10100 and W10173 explicitly OUT of Slice 6 scope (stay spec backlog for the signed-arithmetic / value-range-analysis slices) | ✅ Resolved |
| 5 | Edge cases | Latent word-comparison miscompile: `lowerBinary` stamps comparisons `type: IL_BYTE` (`lower.ts:902`), so translate compares LOW BYTES ONLY for word operands — reachable today via a `word` for-loop counter (compiles silently wrong) | A: fix inside the comparison phase of this slice (typing lands first, same slice) / B: Phase 0 pre-fix + immediate golden re-verify (5a precedent) | User chose A — fix inside the slice's comparison phase; DEF row in the plan + a regression test witnessing the old silent miscompile | ✅ Resolved |
| 6 | Technical | Cross-block result plumbing for `&&`/`\|\|`/ternary values (translate forbids temps crossing block boundaries; `producedThisBlock` guard): synthetic per-site frame slots must be allocated by the frontend model so SFA plans them | Single viable path: frontend-collected synthetic locals (SFA-planned, interference-aware). Rejected: binder ZP-tmp homes (`__zp_tmp_*` block is 4 bytes — nested expressions exhaust it; homes are per-block fold state, not cross-block storage) | User confirmed — synthetic per-site SFA frame slots (source-illegal names, e.g. `$sc0`); `__init` expressions get equivalent slots; mechanics in the 03-codegen doc | ✅ Resolved |
| 7 | Technical | Const-eval width semantics: `evalConst` folds untyped JS numbers; `~`, signed `>>`, and casts are width/signedness-sensitive (TS-9: per-node operand width, NOT the declared type) | A: extend `evalConst` with an optional per-node type lookup (mirrors the existing `ConstRefResolver` seam) / B: don't fold width-sensitive ops (violates TS-18 folding-is-a-language-requirement for const decls) | User chose A — optional per-node type accessor; width-sensitive ops fold only when the type is known, else `nonConst`; existing callers unchanged | ✅ Resolved |
| 8 | Technical | Condition-position lowering of `&&`/`\|\|`/ternary: generic value path (materialize 0/1, then `brcond`) vs direct branch-chaining into the condition's targets | A: generic value path (correctness-first; Phase B peephole optimizes) / B: branch-chaining now (smaller code, more translate surface) | User chose A — one lowering for all contexts: materialize the 0/1, `brcond` on it | ✅ Resolved |
| 9 | Technical | Comparison IL instruction shape: the `type` field must carry the OPERAND type (result is always the 0/1 byte) so translate picks byte/word × signed/unsigned framing | Single viable: reuse the existing `{dest,left,right,type}` shape with `type` = operand type. Rejected: adding a second type field (printer/passes churn for no information gain) | User confirmed — `type` = operand type on `eq/ne/lt/le/gt/ge`; the 0/1 result type stays implicit | ✅ Resolved |
| 10 | Naming | New/reused diagnostic codes (registry-only, additive — AR-115 precedent; spec chapter numbers E10083/E10154/E10161/E10162 are already taken by other registry meanings): mint **E10086** BooleanCast (spec-Ch-02-numbered, free), **E10087** NegateUnsigned, **E10088** TernaryArmMismatch; reuse **E10083** (registered, never emitted) renamed for the signed-shift-amount error; reuse **E10080** for ordered-comparison-on-boolean; reuse **E10134** for ternary non-boolean condition; use registered-unused **E10155** InvalidCast for void/struct/array/enum cast rejections | A: accept the full table / B: adjust specific entries | User accepted the full table (mint E10086/E10087/E10088; reuse E10083-renamed/E10080/E10134/E10155 — see the AR-10 note) | ✅ Resolved |
| 11 | Scope | Out-of-scope boundary confirmation: `&` address-of (→ Slice 8), `sizeof`/`offsetof`/`length` + `IndexExpr` + struct literals (→ Slice 7), enum casts (→ 7), signed `*`//`/`/`%` runtime routines (→ future signed slice; unsigned-routine `*` stays allowed for signed operand types ONLY if bit-exact — see AR-2 resolution), non-const `peek`/`poke` addresses stay E10045, optimizers stay passthrough | A: confirm / B: adjust | User confirmed — boundary matches the RD-18 slice map + Won't-Have exactly | ✅ Resolved |
| 12 | UX | Acceptance fixture shape: `examples/slice6/` — single-module, single-file expression-heavy program; short-circuit observability via a side-effecting helper (`\|\|`/`&&` RHS call that pokes a witness byte, suppressed on the short-circuit path); results in the `$C000..` band | A: single file (modules already proven in 5b; keep the surface orthogonal) / B: multi-file | User chose A — single-file `examples/slice6/main.blend`, side-effecting-helper short-circuit witness, `$C000..` band | ✅ Resolved |
| 13 | Process | Plan folder name `rd-18-slice-6-expressions`; verify command from CLAUDE.md (`yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`) | A: confirm both / B: adjust | User confirmed both — folder `rd-18-slice-6-expressions`; CLAUDE.md verify command | ✅ Resolved |
| 14 | Scope | *(surfaced during authoring)* Cast SYNTAX is spec-inconsistent: `grammar.ebnf.md` `expr as type` (but `as` is not in Ch 01's frozen 32-keyword table), Ch 02 TS-11 `byte(expr)` call syntax, shipped parser = prefix `<byte>(expr)` per RD-03 FR-40 (ST-P13-tested, `pratt.ts:236`) | A: type/lower the FR-40 `<type>(expr)` surface, record the TS-11/grammar drift as an accepted spec deviation / B: also add call-syntax casts (parser work RD-18 does not scope) | User chose A — FR-40 `<type>(expr)` is the surface; drift recorded for the post-freeze errata pass (Ch 02's `sbyte(pos)` examples do not parse today — same drift) | ✅ Resolved |

### Resolution Notes

**AR-1:** Equality (`==`/`!=`) is signedness-neutral (bit compare) — only the four relationals
differ. Signed compares are pure branch logic (SEC/SBC + N⊕V dance), no runtime routine needed,
so the RD's Won't-Have (signed *routines*) does not force deferral. If B is chosen, typing still
accepts `sbyte < sbyte` per spec and lowering/translate must ICE loudly (never silently wrong).

**AR-2:** Signed `*` needs NO guard: two's-complement multiplication truncated to the operand
width is bit-identical for signed/unsigned, so the unsigned `__rt_mul8/16` routines produce
correct signed results. Division/modulo genuinely differ (quotient rounds toward zero).

**AR-4:** W10170/W10171/W10172 already exist and are emitted (`translate.ts:833,857`). W10173's
"may be 0 at runtime" requires value-range analysis that does not exist; a naive version (warn on
every non-const divisor) would be noise.

**AR-6:** Function-collection would count `&&`/`||`/ternary sites per function and append
synthetic locals (names with a character illegal in source identifiers, e.g. `$sc0`) so SFA
frames carry them; module-initializer expressions need the same slots in the `__init` stream's
allocation. Exact naming/collection mechanics land in the 03-codegen doc.

**AR-10:** Detail per entry — (a) E10086: spec Ch 02 assigns E10086 to boolean↔integer cast; the
number is unregistered → mint spec-aligned (4b "spec-Ch-05-numbered" precedent). (b) Spec's
negate-unsigned number E10083 is taken by registry `ShiftAmountOutOfRange` (never emitted);
NegateUnsigned mints at E10087 (unassigned anywhere in `spec/`). (c) Spec's ternary-arm number
E10162 is taken by `ExtraFieldInInit`; TernaryArmMismatch mints at E10088 (free). (d) The
signed-shift-amount error reuses E10083, renaming the never-used TS key to match its first real
use (pure-registry change, zero emissions exist). (e) Ordered-comparison-on-boolean: spec number
E10154 is taken by `WidthNarrowingNoCast`; E10080 `InvalidOperandType` already carries the
"Operator 'X' cannot be applied to type 'boolean'" message pattern (`expression-typing.ts:179`).
(f) Ternary condition: spec Ch 04 §7.2 cites the STALE E10100 (= canonical UndeclaredIdentifier);
E10134 `NonBooleanCondition` (4a mint) is the established statement-condition code.
