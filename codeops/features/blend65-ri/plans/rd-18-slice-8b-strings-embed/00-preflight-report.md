# Preflight Report: RD-18 Slice 8b — Strings & Embed

> **Status**: ✅ PREFLIGHT PASSED — all 11 findings resolved (10 from iteration 1 + PF-011 caught and fixed in iteration 2)
> **Iteration**: 2 (fixes applied + re-scan complete; iteration-1 header preserved below)
> **Decisions**: user accepted all recommendations in bulk (2026-07-17) and authorized fix application + re-scan
> **Artifact**: implementation plan at `codeops/features/blend65-ri/plans/rd-18-slice-8b-strings-embed/` (11 documents)
> **Codebase Grounded**: 28 source/test files examined directly + 2 Explore-agent sweeps (spec chapters, requirements docs); ~60 references mapped — 57 verified, 3 with citation nuances (folded into findings)
> **Baseline**: plan commit `2784ba7`; code baseline `b341d3e` (8a completion)
> **Last Updated**: 2026-07-17
>
> Note on review independence: the artifact was authored in a **previous** session (committed
> before this session), so this is not a same-session review; it is, however, the same model
> family. Mitigation applied: all high-stakes findings were adversarially re-derived by an
> independent challenger agent before recommendations were recorded (verdicts below).

## Codebase Context Summary

**Tech Stack:** TypeScript ESM (NodeNext, ES2023, strict), Yarn v1 workspaces + Turborepo, Vitest, Node 22 — verified against root/package manifests.
**Architecture:** 10-package compiler pipeline (Lexer → Parser → Analyzer → SFA → IL → Codegen → Emitter). R15 boundary verified: `frontend` deps = `@blend65/core` only; `language-server` deps = core + frontend (package.json both).
**Key files examined:** `frontend/src/lexer/lexer.ts`, `core/src/ast/nodes.ts`, `frontend/src/parser/pratt.ts`, `frontend/src/semantics/{analyze.ts,const-eval.ts,const-images.ts,type-check/{statement-typing,expression-typing,context}.ts}`, `core/src/{diagnostics/diagnostic-codes.ts,platform/{platform-profile,platform-plugin}.ts,semantics/{semantic-model,const-value}.ts,host/compiler-host.ts}`, `platforms/src/{shared-hooks,c64,a800xl,a7800}.ts`, `codegen/src/il/{lower,cfg}.ts`, `codegen/src/runtime/embed.ts`, `compiler/src/api/{run-frontend,build}.ts`, `config/src/types.ts`, plus spec Ch 01/08/13/15 + grammar and RD-04/06/07/18.

**Key verifications that came back CLEAN** (the plan's load-bearing claims hold):

- E10116 / E10124 / E10125 / E10127 / E10205 all free in `diagnostic-codes.ts`; E10200–E10204 defined at :248-252 with **zero** emit sites; E10246 escape-root precedent real.
- The bracketed-form escape hole is real: `rejectStringArrayInit` (statement-typing.ts:886) matches only a bare `StringLitExpr` initialiser.
- Lexer/AST/parser claims exact (escape set, raw-not-decoded values, E10217–E10223, `EmbedExprNode` shape, embed name-special-casing).
- The two wrong encoder stubs confirmed: a800xl + a7800 hooks delegate to `petsciiEncodeChar/String` (platforms/src/a800xl.ts, a7800.ts); zero compile-path callers of the hooks.
- Const-data reuse path (`buildConstImage` → `constValues` → `lower.ts` constData → `__data_<Module>_<name>` `!byte` rows) verified end-to-end; `ConstDataEntry.type` pre-types the unreachable `"embed"` arm; `lower.ts` derives struct/array from symbol type only.
- "Eleven prior slice goldens" is CORRECT (11 `.golden` files: gate + 3a..7b + 8a's `slice8.asm.golden`).
- Spec claims verified: Ch 01 §7.2's 8-escape set + ATASCII `$9B` example; Ch 08 STR-1..6 (STR-5's 4-escape narrowing and `\\`=`$5C` pin real); E10124's exact wording in Ch 08 §12; E10115 spec-assigned to the fill case but spent in code on `StaticIndexOutOfBounds` (the AR-8 fold is sound); Ch 13 EMB-1..4 + `--asset-path` in EMB-2; grammar §9.6 single-quoted-string contradiction real; RD-18 items 7–9 at :412-419 with the traversal clause; the 8a register's seven deferral rows and AR-114/AR-115 precedents.
- Fixture oracles re-derived byte-for-byte (petscii `HELLO C64!` = `48 45 4C 4C 4F 20 43 36 34 21`; `B I . . . . . .` = `42 49 2E×6`; `'H'` = `$48`); duplicate-case E10132 exists; `length()` folds (const-type-engine.ts:356); frontend tests already hand-roll `targetProfile` (intrinsic-validation suites) so ST-9 is feasible under R15.

### Summary by Dimension

| # | Dimension | Findings | Highest severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 1 | 🔵 |
| 3 | Logical Contradictions | 1 | 🟡 |
| 4 | Completeness Gaps | 1 | 🟡 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 1 | 🟠 |
| 7 | Testability | 0 | — |
| 8 | Security Blind Spots | 1 | 🟡 |
| 9 | Edge Cases | 0 | — |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 2 | 🟡 |
| 13 | Codebase Alignment | 3 | 🟠 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 2 | all resolved (fixes applied, iteration 2 verified) |
| 🟡 MINOR | 6 + 1 (PF-011, iteration 2) | all resolved (fixes applied, iteration 2 verified) |
| 🔵 OBSERVATION | 2 | all resolved (fixes applied, iteration 2 verified) |

---

## Findings

### PF-001: `AssetReader` seam contract is unimplementable from the frontend as specified 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (Stale Assumption / Impact Blindness), with 4 — Completeness
**Location:** `03-03-embed.md` §New types + §Analysis-time typing + §Provenance; `99-execution-plan.md` tasks 4.2.1/4.2.3/4.2.4
**Codebase Evidence:** `packages/frontend/src/semantics/analyze.ts:60-77` (`AnalyzeInput` = programs/bag/profile/registry?/targetProfile? — no paths); `packages/core/src/ast/nodes.ts:65-69` (`ProgramNode` carries no file path); `packages/core/src/diagnostics/source-span.ts:18,28-35` (spans carry only `SourceId`); `packages/compiler/src/api/run-frontend.ts:138-149` + `:256-260` (the absolute path is a loop-local; what's interned is the **project-relative display path**); `03-03-embed.md:18-28` (`ok` arm = `{bytes}` only).
**The Problem:** The contract says `readAsset(fromSourcePath, relPath)` where `fromSourcePath` is "the ABSOLUTE path of the .blend file containing the embed()", called from frontend declaration typing — but the frontend has no source paths at all: not in `AnalyzeInput`, not on `ProgramNode`, not in spans (SourceId only), and zero `node:path`/SourceMap usage exists in frontend src. Even passing the SourceMap in wouldn't help — it stores relative display paths. Separately, `SemanticModel.embeddedAssets` (FQN → **resolved absolute asset path**, "populated at the typing site") is also stranded: the `ok` result carries no resolved path, and resolution/containment deliberately live compiler-side. No Phase-4 task adds a bridge. As written, task 4.2.4 dead-ends and would trigger a mid-phase runtime-ambiguity STOP on a security-relevant seam.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Key the reader by `SourceId`: `readAsset(sourceId, relPath)`; compiler impl closes over a `Map<SourceId, absolutePath>` built during interning (path + sourceId already adjacent at run-frontend.ts:145-147); extend the ok arm to `{bytes, resolvedPath}` so typing can populate `embeddedAssets` | Frontend already owns the key (`embedNode.span.sourceId`); absolute paths stay compiler-side; `resolvedPath` is the only honest post-containment path; same shape works for a future LS host; ST-25 needs one line of test setup | Reader interface takes a core `SourceId` instead of a plain string (slightly less generic) |
| B | Keep the path-keyed reader; add `sourcePathOf?: (id: SourceId) => string` to `AnalyzeInput` | Reader interface stays path-generic | Two optional injections only coherent together (dead-seam states); frontend shuttles absolute paths it otherwise never touches; the `resolvedPath` ok-arm extension is still required anyway |
| C | Put the absolute path on `ProgramNode` | Simplest lookup | Violates the recorded SourceId design rationale (source-span.ts:13-17 — spans need no back-pointer); forces a `parse()` API change; leaks a host concern into the AST the LS shares |

**Recommendation:** Option A — smallest surface, keys on what the frontend already possesses, keeps path math and containment policy reader-owned, and fixes both halves (call key + `embeddedAssets` value) in one amendment. Amend `03-03` (interface + ok arm + reader-factory signature) and tasks 4.2.1/4.2.3/4.2.4.
**Confidence:** High. **Hardening:** independent challenger re-derived the gap from the code and CONFIRMED; its counter-argument ("the reader closure already knows everything") turned out to *derive* Option A rather than refute the finding.

**User Decision:** Resolved — user accepted the recommendation (bulk acceptance, 2026-07-17); fix applied and verified in iteration 2.

---

### PF-002: Char-literal desugar mechanism doesn't reach expression-interior AST slots — the acceptance fixture itself would ICE 🟠 MAJOR

**Dimension:** 6 — Feasibility, with 13 — Codebase Alignment
**Location:** `03-02-literal-desugar.md` §Char literals (choke point + splice-site list); `99-execution-plan.md` tasks 2.2.1/2.2.2
**Codebase Evidence:** `packages/codegen/src/il/lower.ts:791-819` (`lowerExpr` default → ICE; no CharLitExpr arm anywhere in codegen), `:258-270` (module-let/zeropage initialisers re-read raw off the AST), `:~650-658` (switch lowering re-lowers case values off `stmt.cases[i].values`), `:2013-2031` (aggregate elements/fill walk); `packages/frontend/src/semantics/const-eval.ts:192-193` (CharLitExpr → `nonConst`); `packages/frontend/src/semantics/type-check/statement-typing.ts:558-559` (**decisive**: `typeCaseValue` types then folds the same *local binding* — splicing the parent `values[i]` slot cannot update it, so even the listed case-label splice site fails → E10071); `expression-typing.ts:226-231` (cross-operand literal adaptation tests `expr.left.kind === "NumericLitExpr"` post-typing — a record-only substitution silently diverges, e.g. `'H' == wordVar`); `03-04-acceptance.md:25-27` (`banner[0] = 'B'`, `TITLE[0] == 'H'` — exactly the uncovered shapes).
**The Problem:** The plan's splice-site list is closed (decl initialisers, array elements, fills, case labels) and the choke point otherwise only "records the substitution" — which nothing consumes (no such map is added to `SemanticModel`, and giving codegen a lookup would itself be the new-consumer contract AR-9 rejects). Binary operands, assignment RHS, intrinsic/call args, and index expressions keep their raw `CharLitExpr` in the AST that codegen re-walks: typing succeeds silently, the bag stays clean, and Phase-5 lowering ICEs on the fixture. The case-label subtlety means no splice-only design can work without restructuring callers.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | **In-place node conversion** at the `typeOfExpr`/`computeType` choke point: one localized typed helper mutates the `CharLitExprNode` object into a `NumericLitExpr` (kind/value/raw; span untouched = original literal's span) | Object identity covers *every* position by construction; typeMap/symbolMap identity keys stay valid; fixes statement-typing.ts:559 and all codegen re-walks with zero caller changes; restores exact numeric-literal adaptation semantics (expression-typing.ts:226-231); naturally idempotent (second visit takes the NumericLitExpr arm); verified feasible — no `Object.freeze` on AST, concrete node interfaces redeclare fields non-readonly, no consumer reads `NumericLitExpr.raw` | Needs one deliberate, documented type assertion inside the helper (localized exception to the no-unsafe-casts rule) |
| B | Recursive pre-typing desugar pass rewriting all child slots | Type-safe, no mutation-in-place | Requires a child-slot-complete visitor over ~18 expression kinds + statement/decl slots that the codebase doesn't have; its completeness is exactly the risk being fixed |
| C | Add CharLitExpr arms to codegen/const-eval/engine | No AST mutation | Contradicts the accepted AR-9 rationale (no downstream consumer learns the node kind) and re-opens the four-consumer spread AR-8's analysis exists to avoid |

**Recommendation:** Option A, with one **required amendment** (challenger-surfaced): the lazy `ConstTypeEngine` can reach a `CharLitExpr` *before* Pass-3 typing (e.g. `const K: byte = 'A'; let a: byte[K];` forces K's fold during Pass-2 array-size resolution, const-type-engine.ts:283-301) — since the engine already holds the encoder (03-01) and is frontend-internal, give `engine.evalExpr` an encode-or-convert CharLitExpr arm and say so explicitly in 03-02/task 2.2.2. Note this amends the *mechanism* only; the AR-9 decision (universal desugar to synthetic numerics, no downstream arms) stands.
**Confidence:** High. **Hardening:** independent challenger CONFIRMED and strengthened the finding (case-label local-binding failure; Pass-2 lazy-fold path; literal-adaptation divergence), and independently picked Option A.

**User Decision:** Resolved — user accepted the recommendation (bulk acceptance, 2026-07-17); fix applied and verified in iteration 2.

---

### PF-003: `SemanticModel` and `ConstValue` live in `@blend65/core`, not the frontend — the plan's file map points at the wrong package 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Phantom Reference / mislocation)
**Location:** `99-execution-plan.md` task 4.2.4 ("+ `semantic-model.ts` for the map/provenance types" under a frontend path); `00-index.md` §Related Files (omits `core/src/semantics/` entirely)
**Codebase Evidence:** `packages/core/src/semantics/semantic-model.ts:28-59` (the real `SemanticModel`, incl. `constValues:36`); `packages/core/src/semantics/const-value.ts:14-29` (the real `ConstValue` — `type`/`value`/`bytes?`, all readonly). There is no `packages/frontend/src/semantics/semantic-model.ts`.
**The Problem:** The AR-12 edits (`ConstValue.source?: "embed"`, `SemanticModel.embeddedAssets`) are **core** changes. Both are additive and architecturally fine (core is upstream of codegen's `lower.ts`, which maps provenance), but an executor following the file map would search the wrong package, and the Related Files index under-declares the touched surface.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Correct the file map: task 4.2.4 and 00-index name `packages/core/src/semantics/{semantic-model,const-value}.ts` for the provenance/map types | Accurate; zero design change | — |

Single viable resolution (a factual path correction); considered "leave as-is, executor will find it" and dropped it — the plan's own standard is a verified file map.

**Recommendation:** Option A.

**User Decision:** Resolved — user accepted the recommendation (bulk acceptance, 2026-07-17); fix applied and verified in iteration 2.

---

### PF-004: "`rejectStringArrayInit` invoked :811 and the const path" is wrong — no const call site exists, and const string-inits die as E10126/E10193 today 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Stale Assumption)
**Location:** `02-current-state.md` §Semantics; `03-02-literal-desugar.md` §String literals ("typeLetDecl / const path / typeZeropageField … replacing `rejectStringArrayInit`")
**Codebase Evidence:** call sites are `statement-typing.ts:140` (**module-let**, inside `typeModuleLet`), `:188` (zeropage field), `:811` (local let) — grep-complete. The const pass (`:255-268`) classifies array/struct consts as aggregates by **symbol type** and skips initialiser typing; a const string-init then hits `evaluateOne`'s unsized handling (`:305-320` → E10126) or `buildConstImage.writeArray` (`const-images.ts:82-88` → E10193) — never E90001.
**The Problem:** The desugar design says it "replaces `rejectStringArrayInit`" on the const path, but there is nothing there to replace — the const hook point must be *added* (in the const pass before the `:307` `init.kind === "ArrayLitExpr"` unsized-inference check and before `buildConstImage`), and the desugar must also run before `typeModuleLet`'s coverage check at `:124` (the plan cites only the local-let ordering site `:808`). Without this correction, ST-15 (`const MSG: byte[] = "HELLO"`) has no specified implementation site.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Amend 02/03-02: name the real sites — module-let `:140`/coverage `:124`, zeropage `:188`, local let `:811`, and the **added** const-pass hook before `:307`; note const string-inits currently emit E10126/E10193 | Executor lands the desugar right first time; ST-15's path is specified | — |

Single viable resolution (factual correction). Considered "leave it, the executor will discover the const pass" — dropped: the mis-claim is exactly where the desugar ordering is most delicate.

**Recommendation:** Option A.

**User Decision:** Resolved — user accepted the recommendation (bulk acceptance, 2026-07-17); fix applied and verified in iteration 2.

---

### PF-005: A third shipped string-init pin exists that the retirement strategy cannot locate 🟡 MINOR

**Dimension:** 4 — Completeness Gaps (Test Impact)
**Location:** `03-02-literal-desugar.md` §Retirement matrix; `99-execution-plan.md` task 3.1.2 ("locate via `rejectStringArrayInit` references")
**Codebase Evidence:** `packages/frontend/src/semantics/aggregate-typing.spec.test.ts:228-231` — `"ST-44b: a string array-initialiser is loudly rejected until strings land"` asserts `diags.some((d) => isIceCode(d.code))` on `let a: byte[10] = "HELLO";`. It contains neither the identifier `rejectStringArrayInit` nor the message substring the other pins carry.
**The Problem:** After the desugar lands, this program compiles clean (W10140 only) and the pin fails — but task 3.1.2's locate strategy (identifier references) and the retirement matrix (which names only the E90001 message pins and the 8a zeropage twins) both miss it. It would surface as a loud phase-3 verify failure and improvised mid-phase test rewrite, violating the retired-row protocol's rewrite-in-the-SPEC-step ordering.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add `aggregate-typing.spec.test.ts:228-231` explicitly to the retirement matrix + task 3.1.2 (rewrite to a bare-form success oracle à la ST-16, W10140 asserted) | Deterministic; protocol-compliant | — |

Single viable resolution. (Broadening 3.1.2's grep to `isIceCode`+string sources was considered and folded in as the *method*; the matrix should still name the known pin.)

**Recommendation:** Option A. Full retirement inventory as verified: `aggregate-typing.spec.test.ts:228` (local let), `zeropage.spec.test.ts:131-136` (frontend zeropage), `test-harness/src/slice8-negatives.spec.test.ts:117-123` (harness twin).

**User Decision:** Resolved — user accepted the recommendation (bulk acceptance, 2026-07-17); fix applied and verified in iteration 2.

---

### PF-006: The no-profile "raw" encoder domain contradicts itself between the register and the design doc 🟡 MINOR

**Dimension:** 3 — Logical Contradictions
**Location:** `00-ambiguity-register.md` row AR-7 ("no-profile default = identity `$00–$7F`, ≥`$80` unmappable") vs `03-01-encoding-seam.md` encoder table ("raw = identity `$20–$7E` + the three ascii control mappings")
**Codebase Evidence:** `packages/core/src/platform/platform-profile.ts:101` ("absent ⇒ raw ASCII bytes") — supports either reading; a literal control char CAN reach the encoder (the lexer passes through raw source chars other than newline/backslash/quote, `lexer.ts` scanString), so e.g. cp `$7F` maps under AR-7's wording but is E10127 under 03-01's.
**The Problem:** Two normative statements of the same contract disagree on `$00–$1F`/`$7F`. The implementer follows 03-01; the register is the decision record — they must say the same thing before ST-4's oracle is pinned.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Pin 03-01's definition (raw ≡ the `ascii` encoder: `$20–$7E` + `\n\r\t` mappings) and amend the AR-7 row wording | Raw and `ascii` collapse to one implementation; stray control cps get a loud E10127 rather than silent odd bytes; consistent with ST-3/ST-4 as written | Marginally narrower than "raw ASCII bytes" reads |
| B | Pin AR-7's `$00–$7F` identity and amend 03-01 | Most literal reading of the profile doc comment | Bakes unprintable control bytes silently — the exact hazard class AR-7 exists to prevent; needs a separate raw implementation |

**Recommendation:** Option A — it matches the fallible-encoder philosophy the user already chose in AR-7, and `\xNN` remains the explicit route to any raw byte.

**User Decision:** Resolved — user accepted the recommendation (bulk acceptance, 2026-07-17); fix applied and verified in iteration 2.

---

### PF-007: Embed containment is lexical, not canonical — symlink escape + a stat→read TOCTOU remain 🟡 MINOR

**Dimension:** 8 — Security Blind Spots
**Location:** `03-03-embed.md` §Disk implementation (policy steps 2–3); `07-testing-strategy.md` impl-test row ("containment on resolved prefix"); 03-03 testing note "symlink-free containment"
**Codebase Evidence:** the policy mirrors `codegen/src/runtime/embed.ts:97-111` — `resolve()` + prefix check. `path.resolve` is lexical: it normalizes `..` but does not resolve symlinks, so a symlink *inside* the project pointing outside passes containment. The precedent guards **packaged runtime files** (its doc comment: "packaging bug — never user input"); embed paths are user input. RD-18's Security clause (RD-18 :242-246) says resolution "**must canonicalize paths** and reject `..` traversal". Separately, the size is `stat`ed before `readFileSync` — the file can grow in between.
**The Problem:** As specified, the plan meets the `..`-rejection half of RD-18 item 9 but arguably not the "canonicalize" half; the plan itself acknowledges the assumption ("symlink-free containment") without recording it as an accepted deviation. Threat model is mild (the project author already controls the build), which is why this is MINOR, not MAJOR.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Canonicalize before the prefix check: `realpathSync` the resolved path (and the project root once) → containment on canonical paths; plus re-check `bytes.byteLength <= 65536` after read (one line) | Satisfies RD-18's "canonicalize" verbatim; closes both residuals for ~2 lines + one syscall; ST-28/29 unchanged | `realpathSync` errors on missing files — order it after the existence check (not-found stays E10201) |
| B | Keep the lexical check; record the symlink residual + TOCTOU as an accepted deviation in the register and in the item-9 security checklist | Zero code | Item 9's evidence record must then carry a caveat forever |

**Recommendation:** Option A — the cost is trivial and it keeps the RD-18 item-9 closure checklist caveat-free.

**User Decision:** Resolved — user accepted the recommendation (bulk acceptance, 2026-07-17); fix applied and verified in iteration 2.

---

### PF-008: ST-number drift in two design docs 🟡 MINOR

**Dimension:** 12 — Consistency
**Location:** `03-03-embed.md` §Testing ("Spec tier ST-25..ST-36") — embed's rows are ST-25..ST-35; ST-36 is the assemble-clean test. `03-04-acceptance.md` §Harness ("(ST-41 rows)") — the negatives suite is ST-40; no ST-41 exists in `07-testing-strategy.md`.
**Codebase Evidence:** n/a (document-internal).
**The Problem:** Executors cross-reference ST ids constantly during the spec-test phases; off-by-one ids in the governing docs invite mis-scoped suites.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Fix both references (ST-25..ST-35; ST-40) | Trivial | — |

Single viable resolution.

**Recommendation:** Option A.

**User Decision:** Resolved — user accepted the recommendation (bulk acceptance, 2026-07-17); fix applied and verified in iteration 2.

---

### PF-009: Citation nuances — Ch 15 "provisional" is §6 (not §5); EMB-1 doesn't itself pin "module-level/full-initializer" 🔵 OBSERVATION

**Dimension:** 12 — Consistency (citation hygiene)
**Location:** AR-3/AR-5 + `01-requirements.md` ("Ch 15 marks encodings 'provisional'… §5"); `03-03-embed.md` §Analysis-time typing ("Legality (EMB-1, AR-11): … module-level `const`")
**Codebase Evidence:** `spec/15-platform-profile.md:210` — the provisional marking lives in **§6 Stability Classifications** (§5 is Compiler Conformance Rules). `spec/13-data-inclusion.md:60-67` — EMB-1 pins const-only + compile-time-only; "module-level" and "full initializer" are AR-11's (properly recorded) tightening, and local `const` IS parseable (`frontend/src/parser/parse-stmt.ts:45` imports `parseConstDecl`), so the tightening is real, not vacuous.
**The Problem:** Substance is correct in both cases; only the attributions are off. Worth one editing pass so the closure phase's RD ticks cite accurately: "provisional" → Ch 15 §6; the E10200 module-level rule → "AR-11 decision (tightens EMB-1's text)".

**Recommendation:** Fix the two attributions in the same pass as PF-008. Single viable resolution.

**User Decision:** Resolved — user accepted the recommendation (bulk acceptance, 2026-07-17); fix applied and verified in iteration 2.

---

### PF-010: ATASCII does define a TAB code (`$7F`) — AR-5's "`\t` unmappable (not in ATASCII)" rationale is factually shaky, though the decision is safe 🔵 OBSERVATION

**Dimension:** 2 — Implicit Assumptions (external standard)
**Location:** `00-ambiguity-register.md` row AR-5; `03-01-encoding-seam.md` encoder table; ST-2
**Codebase Evidence:** none available — the frozen spec pins only ATASCII `\n` = `$9B` (Ch 01 §7.2, spec/01-lexical-structure.md:377) and is silent on TAB. Per the standard-first rule: I cannot cite the ATASCII table from the repo; this observation rests on the well-known ATASCII layout (TAB = `$7F`, alongside `$7D` clear-screen, `$7E` backspace — which the plan's own printable-exception list `` ` `` `{` `}` `~` correctly mirrors).
**The Problem:** The AR-5 *decision* (fallible encoder; `\t` → null → loud E10127 on Atari) stands and is the conservative, safe choice — nothing here re-litigates it. Recording the observation only so the rationale line isn't cited later as "ATASCII has no TAB": it has one; the plan *chooses* not to map it (mapping `\t`→`$7F` would also have been defensible). If desired, one word of the AR-5 row ("not in ATASCII" → "deliberately unmapped") makes it airtight.

**Recommendation:** Optional one-word rationale amendment; no behavior change. Decision unchanged either way.

**User Decision:** Resolved — user accepted the recommendation (bulk acceptance, 2026-07-17); fix applied and verified in iteration 2.

---

## Adversarial-question checklist (pre-conclusion)

- *Assumption unconsciously confirmed?* The plan's central bet — synthetic-AST desugar reusing the four consumers — was re-derived, not assumed: all four consumers verified pattern-matching real nodes, and the desugar's two mechanism gaps became PF-001/PF-002 rather than being waved through.
- *External standards not citable?* ATASCII table (PF-010, flagged); everything else cited to `spec/` lines.
- *What would a dissenting expert flag?* The symlink residual (PF-007) and the E10200 spec-tightening (PF-009) — both recorded.

## Iteration 2 — fixes applied + re-scan (2026-07-17)

> **Previous iteration**: 10 findings — all resolved (user bulk-accepted every recommendation)
> **This iteration**: 1 new finding (PF-011, found in the regression check of the applied fixes, resolved inline)
> **Carried forward**: none

**Fix verification (all 10):** every fix confirmed in place — 03-03 (SourceId-keyed `AssetReader` + `resolvedPath` ok arm, sourceId→path map at interning, canonical containment + post-read re-check, EMB-1/AR-11 attribution, core provenance paths, ST-25..35), 03-02 (in-place conversion + `ConstTypeEngine` arm, four desugar positions incl. the added const-pass hook, three-row retirement matrix with exact locations, conversion-idempotence impl tests), 02-current-state (call-site correction + E10126/E10193 const reality), 03-01 (raw ≡ ascii encoder; ATASCII `\t` rationale), 03-04 (ST-40), 07 (impl rows + retirement locations), 99 (tasks 2.2.1/2.2.2/2.3.1/3.1.2/3.2.2/4.2.1/4.2.3/4.2.4/4.3.1 — task count unchanged at 58), 00-index (core-semantics file-map line, canonical-containment key-decision row), register (AR-3 §6, AR-7 raw wording, Preflight-amendments note in Resolution Notes).

**Regression sweep:** a full-directory grep for the retired vocabulary (`fromSourcePath`, splice sites, splice-once/idempotence, symlink-free, ST-41, ST-25..ST-36, Ch 15 §5, the `$00–$7F` raw claim) matches only this report and the session notes quoting iteration-1 text — all 11 plan documents are clean.

### PF-011: PF-007's canonicalization, as first applied, inverted ST-28's oracle for nonexistent outside-root files 🟡 MINOR

**Dimension:** 3 — Logical Contradictions (introduced by an iteration-2 fix; caught in the same iteration)
**Location:** `03-03-embed.md` §Disk implementation step 3 vs `07-testing-strategy.md` ST-28 ("E10205 — file existence irrelevant")
**The Problem:** The first application of PF-007 ran `realpathSync` (ENOENT → `not-found`) *before* the containment check, so `embed("../../outside.bin")` with no such file would emit E10201 instead of ST-28's pinned E10205.
**Resolution:** single viable fix, applied under the same authorization — containment runs twice: lexically first (no filesystem access, so a `..` escape is E10205 regardless of existence), then `realpathSync` + a canonical re-check (symlink escapes → E10205). ST-28's oracle preserved; the symlink guarantee kept.
**User Decision:** Resolved — corrective amendment to PF-007's accepted fix, applied and verified in this iteration.

## Final Verdict

**✅ PREFLIGHT PASSED — all 11 findings resolved** (10 accepted-and-fixed + PF-011 fixed inline). No Zero-Ambiguity-Gate decision was changed: the register's 17 decided outcomes all stand; the amendments touch mechanisms, wording, file maps, and citations, and are recorded in the register's Resolution Notes. The plan is executable as written. Roadmap: plan row advanced to **Plan Preflighted (🔬)**.
