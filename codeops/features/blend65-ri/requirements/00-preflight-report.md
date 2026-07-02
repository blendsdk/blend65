# Preflight Report: RD-15 — Programmatic & CLI API

> **Status**: ✅ PASSED — all 10 findings resolved (0 critical, 1 major, 7 minor, 2 observations); user accepted all recommendations 2026-07-03; **fixes applied 2026-07-03** to RD-15 (PF-001 deps header, PF-002 R6/§4.1 `BuildResult` ownership, PF-003 §2+AC-19 `Design` marks, PF-004 R47, PF-005 R50, PF-006 R48/R49 + E10250 band, PF-007 R51 + `CompileResult.config`, PF-008 AC-20, PF-009 §4.3 sketch, PF-010 R4+AC-18 scope), RD-09 (§4.7 `EmitBinaryResult` rename note), the feature + portfolio roadmaps (PF-001 reorder: RD-11b → RD-15 → RD-12; RD-15 → 🔎 RD preflighted; MVP critical-path redrawn), `requirements/README.md` (RD-15 deps/counts + graph annotation), and CLAUDE.md (status paragraph)
> **Iteration**: 1 (first scan)
> **Artifact**: Requirement document at `codeops/features/blend65-ri/requirements/RD-15-programmatic-cli-api.md`
> **Codebase Grounded**: ✅ ~18 source files examined across compiler/cli/core/config/codegen/frontend/platforms + 4 sibling RDs + the ambiguity register + both roadmaps; ~40 references verified
> **Last Updated**: 2026-07-03
>
> Note: per convention this path holds the latest requirements-level audit. The previous
> RD-16 audit (PF-001..PF-014, PASSED 2026-07-02) is preserved in git history. PF numbering
> restarts per artifact.
>
> Same-agent note: RD-15 was authored 2026-05-31 in a prior session — this is NOT a
> same-session review (the RD-16-preflight cross-doc fixes to RD-15 also landed in a prior
> session). The single MAJOR finding was hardened with an independent challenger (blind to
> the auditor's pick) per `_shared/recommendation-hardening.md`; the challenger converged on
> the same resolution and contributed the AR-83/AR-84 grounding and the README/critical-path
> knock-on edits.

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM/NodeNext, strict), Yarn v1 workspaces + Turborepo, Vitest,
Node 22. Workspace's only external runtime dep: `jsonc-parser@3.3.1` (config).
**Architecture:** AOT compiler pipeline, 10 packages. `@blend65/cli` is a stub
(`src/index.ts` = VERSION only; deps: compiler + config — matches R3). `@blend65/compiler`
ships the RD-09 ACME process layer (`discoverAcme`, `invokeAcme`, `parseLabelFile`,
`emitBinary`) plus RD-17 runtime embedding; it does NOT yet ship any facade
(`compile`/`build`/`emitAsm`/`emitIl`). RD-16's `loadConfig()` is live in `@blend65/config`.

**Key files examined:**
- `packages/compiler/src/index.ts` — public barrel; exports RD-09 layer incl. `type BuildResult` (line 36).
- `packages/compiler/src/acme/emit-binary.ts:34-62` — `EmitOptions` + the shipped `BuildResult { success, diagnostics, binaryPath?, asmPath?, symbols?, binarySize? }`; `invoke` seam is async.
- `packages/compiler/src/acme/invoke-acme.ts:111` — `invokeAcme` is `async` → RD-15's `build(): Promise<BuildResult>` is feasible; `compile`/`emitAsm`/`emitIl` sync is feasible (serializer is pure).
- `packages/core/src/diagnostics/` — diagnostic.ts, diagnostic-bag.ts (default cap 20 ✓ R25), diagnostic-codes.ts, line-map.ts, source-span.ts. **No renderers, no SeverityPolicy, no SourceMap, no ResourceReport anywhere in the workspace** (grep-verified).
- `packages/core/src/diagnostics/source-span.ts:16` — "assigned by the (deferred, RD-11b) SourceMap registry".
- `packages/cli/package.json` — no yargs/chalk yet (RD-15 adds them; AR-16/AR-17 sanction both).
- `packages/config/src/types.ts:55-62` — `warnAsError: boolean | string[]`, `diagnosticsFormat: "terminal" | "json"`, `startup: "auto" | "terminating" | "minimal" | "bare"` — all match `CompilerOptions` (R9) exactly.
- `packages/config/src/load-config.ts:72` — `loadConfig({...}) → { config, hasErrors }`; config-error band E10240–E10246 gives the CLI a classification hook for exit code 2.
- Sibling RDs: RD-11 (renderer signatures §4.5, R50 suppression-wins, 11a/11b split), RD-16 (R4/R10/R18/R24/R25 — all consistent with RD-15 R45/R21/R46/R9), RD-13 (R14/R15/R17 color/help/determinism), RD-12 (harness CLI).
- Ambiguity register: AR-3, 15, 16, 17, 39, 40, 51, 60, 62, 63, 68, 69, 73, 75, 76, 77, 78, 82, 83 — all read in full; **every RD-15 citation is faithful to its register entry**.
- Roadmaps: feature pending order RD-15 → RD-12 → RD-11b → RD-13 → RD-14; MVP critical-path diagram.

**Reference Verification:** ~40 references mapped — verified faithful: all 19 AR citations,
RD-16 cross-refs (R45↔R4, R21↔R10, R46↔R18, R9↔R24), maxErrors default 20, exit-3 ICE
semantics (emit-binary retains `.asm` ✓), `--optimize` passthrough (RD-08 v1). Unverifiable
against code (they don't exist yet — see PF-001): `renderTerminal`, `renderJson`,
`renderReportTerminal`, `SeverityPolicy`, `ResourceReport`, `SourceMap`.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | contributes to PF-005, PF-006 | 🟡 |
| 2 | Implicit Assumptions | 2 (PF-004, PF-007) | 🟡 |
| 3 | Logical Contradictions | 1 (PF-003) | 🟡 |
| 4 | Completeness Gaps | 3 (PF-006, PF-007, PF-008) | 🟡 |
| 5 | Dependency Issues | 2 (PF-001, PF-004) | 🟠 |
| 6 | Feasibility Concerns | contributes to PF-001, PF-002 | 🟠 |
| 7 | Testability | 1 (PF-008) | 🟡 |
| 8 | Security Blind Spots | 0 (acmePath trust covered by RD-16 R11/RD-13 R35; glob root-scoping folded into PF-004) | — |
| 9 | Edge Cases | 2 (PF-005, PF-006) | 🟡 |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering & Sequencing | 1 (PF-001) | 🟠 |
| 12 | Consistency | 3 (PF-002, PF-003, PF-009) | 🟡 |
| 13 | Codebase Alignment | 3 (PF-001, PF-002, PF-007) | 🟠 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 1 | ✅ resolved |
| MINOR | 7 | ✅ all resolved |
| OBSERVATION | 2 | ✅ all resolved |

---

### PF-001: RD-15 consumes six RD-11b deliverables that do not exist — and RD-11b is scheduled AFTER it 🟠 MAJOR

**Dimension:** Dependency Issues / Ordering & Sequencing / Codebase Alignment (Phantom References)
**Location:** RD-15 header (`Depends On: RD-01`), R26 (`SeverityPolicy`), R29 + §4.3 (`renderTerminal`, `renderJson`), R24/R36/R38 + §4.1 (`ResourceReport`, `renderReportTerminal`), §4.1 (`CompileResult.sourceMap: SourceMap`)
**Codebase Evidence:** grep across `packages/*/src` finds zero implementations of `renderTerminal`, `renderJson`, `renderReportTerminal`, `SeverityPolicy`, `ResourceReport`, or `SourceMap`. `packages/core/src/diagnostics/` holds only bag/codes/diagnostic/line-map/source-span; `source-span.ts:16` explicitly defers the SourceMap registry to RD-11b. Feature roadmap pending order: RD-15 (1) → RD-12 (2) → RD-11b (3).
**The Problem:** RD-15's own text hard-requires six deliverables owned by the RD-11 remainder (RD-11b), which is ordered two slots after it. Executing RD-15 first stalls immediately: the CLI cannot render diagnostics (R29/AC-13), cannot apply severity policy (R26–R28/AC-12), cannot print the AR-83-mandated default build summary (R38/AC-14), and `CompileResult.sourceMap` is a phantom type. The `Depends On: RD-01` header is wrong even ignoring RD-11 — R2 wires frontend/codegen/platforms/config, and the roadmap itself parenthesizes "(+ RD-09, RD-16)".

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Reorder: RD-11b → RD-15 → RD-12; fix RD-15 `Depends On` to RD-01, RD-09, RD-10, RD-11, RD-16; redraw the roadmap MVP critical-path diagram; reconcile `requirements/README.md` dependency graph | RD-11b is unblocked TODAY (deps RD-11a ✅, RD-09 ✅; aggregator inputs — AllocationPlan, label file, profile budgets — all shipped); RD-15 then wires finished pieces; RD-12's golden CLI-output tests capture the final format once, no rework wave | MVP gate slips by one RD's worth of work (mitigated: RD-11 R47/R48 lets RD-11b's plan scope to the AR-84 MVP columns) |
| B | Fold the needed RD-11 deliverables into RD-15's plan | Single plan, gate reached in one push | RD-11b is RD-sized (severity policy + 4 renderers + aggregator + SourceMap ≈ 10+ of RD-11's ACs); mega-plan wrecks per-RD workflow, AC bookkeeping, and traceability; stretches the RD-16 "pull tiny pre-work" precedent (a handful of code declarations) far past breaking |
| C | Trim RD-15 (defer summary/report flags, ship minimal diagnostics printing), rework after RD-11b | Fastest to a raw blendc | Violates ratified AR-83 (summary prints by default) and effectively AR-75/76/82; AR-84 pins the reporter to the walking-skeleton gate; reopens closed discovery; RD-12 goldens would bake in throwaway output then break |

**Recommendation:** Option A — this is a plain topological-sort error, not a judgment call. RD-11b is implementable standalone right now; RD-15 cannot pass its own ACs without it; AR-83/AR-84 make option C a non-starter without reopening discovery.
**Confidence:** High. **Hardening:** independent challenger (blind) converged on Option A and independently rejected B/C/split-RD-11b on the same grounds; also contributed knock-on edits (README.md graph, critical-path diagram).

**User Decision:** Resolved — user accepted the recommendation ("fix per your recommendations", 2026-07-03); fix applied

---

### PF-002: `BuildResult` name collision — RD-15 §4.1 redefines a type `@blend65/compiler` already exports publicly 🟡 MINOR

**Dimension:** Codebase Alignment (Stale Assumptions) / Consistency
**Location:** RD-15 §4.1 `BuildResult extends CompileResult`; R6
**Codebase Evidence:** `packages/compiler/src/acme/emit-binary.ts:47` exports `BuildResult { success, diagnostics, binaryPath?, asmPath?, symbols?, binarySize? }`, re-exported by the public barrel `packages/compiler/src/index.ts:36`. RD-15's `BuildResult` has a different shape (`asmText?`, `binary?`, `symbolMap?`, `resourceReport?`, extends `CompileResult`). One package cannot export both under one name. Field drift too: RD-09 `symbols` vs RD-15 `symbolMap`; RD-15 adds `binary: Uint8Array` which `emitBinary` never reads back from disk; RD-15 §4 never mentions `emitBinary` although R6's "ACME emit + ACME invoke" is exactly what it does.
**The Problem:** The plan would hit an immediate public-API conflict, and the doc leaves the integration point (facade ↔ `emitBinary`) undefined, inviting a parallel reimplementation.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | RD-15's `BuildResult` becomes THE public type; rename the RD-09 internal aggregate (e.g. `EmitBinaryResult`) and state in §4.1 that `build()` wraps `emitBinary`, mapping `symbols`→`symbolMap` (pick one name) and reading the binary back for `binary` | Public API matches the RD; internal rename is cheap (pre-1.0, consumers are in-repo tests) | Small mechanical rename + test touch-ups |
| B | Reuse RD-09's `BuildResult` shape as-is and drop RD-15's extension | No rename | Loses `CompileResult` inheritance (diagnostics/hasErrors contract, R11) and `resourceReport`; worse public API |

**Recommendation:** Option A — the RD-15 shape is the deliberate public contract (AR-77); the RD-09 type was an internal aggregate that landed first. Also settle `symbolMap` vs `symbols` (recommend `symbolMap`, matching the RD).
**Confidence:** High. **Hardening:** in-context reframing only (MINOR).

**User Decision:** Resolved — user accepted the recommendation ("fix per your recommendations", 2026-07-03); fix applied

---

### PF-003: Traceability contract contradicts the document's own contents (9 `Design` rows vs "No decision may be invented here") 🟡 MINOR

**Dimension:** Logical Contradictions / Consistency
**Location:** RD-15 §2 traceability rule; §6 AC-19; rows R20, R21, R33, R39–R43, R45 ("AR-13 + Design")
**Codebase Evidence:** RD-16 had the identical defect, found as its PF-006 and fixed by legitimizing explicit `Design` marks (RD-16 line 47: "…or be explicitly marked **`Design`** — an uncontroversial default"; RD-16 AC-14 amended to match). The fix was never propagated to RD-15.
**The Problem:** As written, AC-19 ("All decisions trace to an AR-NN or a frozen spec section") fails against 9 of the document's own rows.

**Recommendation (single viable path):** Apply the RD-16 PF-006 fix verbatim — amend §2's traceability rule and AC-19 to allow explicit `Design` marks for uncontroversial defaults. Considered and dropped: retro-fitting AR numbers onto the 9 rows (manufactures fake register history for trivialities like `--version`).
**Confidence:** High.

**User Decision:** Resolved — user accepted the recommendation ("fix per your recommendations", 2026-07-03); fix applied

---

### PF-004: Glob expansion — mechanism, owner, and dependency are unspecified 🟡 MINOR

**Dimension:** Implicit Assumptions / Dependency Issues (+ the root-scoping security angle)
**Location:** R13 (three-tier discovery), R14 (`listSourceFiles()`), §3.3
**Codebase Evidence:** No glob library exists anywhere in the workspace (`jsonc-parser` is the only external runtime dep — a deliberate, register-logged decision in RD-16's plan, AR-P1). RD-16's PF-009 resolution explicitly pushed glob *expansion* out of `@blend65/config` (it carries patterns only) — i.e., onto RD-15's `DiskCompilerHost` — but RD-15 never picks it up: no row says who expands `include`/`exclude`/`**/*.blend`, with what (external dep such as `tinyglobby`/`fast-glob`, Node 22's experimental `fs.globSync`, or a hand-rolled matcher), or how expansion enforces project-root scoping (RD-13 R37; RD-16 R29 validates *patterns* but symlink/traversal enforcement at expansion time is unowned).
**The Problem:** The workspace treats new external runtime deps as register-worthy decisions; leaving this to the plan invites an undocumented dependency or an under-tested hand-rolled globber.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add a requirement row: `DiskCompilerHost.listSourceFiles()` owns expansion (include → exclude → root-scope filter); name the mechanism, preferring a small audited dep (e.g. `tinyglobby`) over hand-rolling; expansion results must resolve within `projectRoot` (RD-13 R37) | Decision lands where the precedent says it must; security enforcement gets an owner | Commits to a dep at RD level (can still carry an "or equivalent, finalized at plan AR-P1-style checkpoint" clause) |
| B | Add the row but defer the library choice to the plan's ambiguity register | Keeps RD stable | Defers exactly the part that needs the decision |

**Recommendation:** Option A with the "finalize exact package at the plan's dependency checkpoint" clause — mirrors how RD-16 handled `jsonc-parser` (named in the RD, verified at plan AR-P1).
**Confidence:** Medium-high (library landscape changes; the ownership/scoping part is unambiguous).

**User Decision:** Resolved — user accepted the recommendation ("fix per your recommendations", 2026-07-03); fix applied

---

### PF-005: Exit-code classification is undefined — what makes an error a "configuration error" (2) vs a "compilation error" (1)? 🟡 MINOR

**Dimension:** Ambiguities / Edge Cases
**Location:** R41–R44, §3.11
**Codebase Evidence:** `packages/config/src/load-config.ts:72` returns `{ config, hasErrors }`, and config errors occupy a dedicated band (E10240–E10246) — two ready-made classification hooks. RD-16 R22/R31 already lean on "exit code 2 (RD-15 R43)".
**The Problem:** Three unspecified cases: (1) the classification rule itself; (2) precedence when a run has both config and compile errors; (3) "invalid flags" — yargs `.strict()` failures exit 1 by default with usage text, so hitting R43's exit-2 contract requires a custom `.fail()` handler, which the doc never mentions.

**Recommendation (single viable path):** Add a decision row: exit 2 iff `loadConfig().hasErrors` is true or yargs rejects the invocation (via a `.fail()` handler); config errors short-circuit before compilation, so mixed runs cannot occur (load-then-compile ordering, RD-16 R22); everything else with errors → 1; ACME ICE → 3. Considered and dropped: classifying by inspecting diagnostic-code bands post-hoc (fragile; the boolean already exists).
**Confidence:** High.

**User Decision:** Resolved — user accepted the recommendation ("fix per your recommendations", 2026-07-03); fix applied

---

### PF-006: Missing-source-file and empty-file-set behavior unspecified; RD-15 claims no diagnostic codes 🟡 MINOR

**Dimension:** Completeness Gaps / Edge Cases
**Location:** R13, R14 (`readFile(): string | undefined`), §3.3
**Codebase Evidence:** `diagnostic-codes.ts` has no "source file not found" or "no source files" code (the only file-level code is E10240 ConfigFileNotFound, config-band). R14's `readFile` returning `undefined` is a contract with no specified consumer behavior.
**The Problem:** Unanswered: explicit CLI file doesn't exist → which E-code, exit 1 or 2? Discovery yields zero `.blend` files → error or silent no-op, and what does `outName` derivation (R21 "first file of the discovered source list") do on an empty list? RD-16 set the precedent that an RD claims its diagnostic band up front (AR-P3: E10240–E10246); RD-15 defines none.

**Recommendation (single viable path):** Add rows: explicit-file-not-found → error (config/invocation class, exit 2); empty discovered set → error (nothing to compile, exit 2); claim the next free error-code band for these (E10250+ suggested, after the config band) with exact codes finalized at plan time. Considered and dropped: silent success on empty set (hides misconfigured `include` and breaks R21's derivation).
**Confidence:** Medium-high (band placement is a suggestion; the behavioral gap is unambiguous).

**User Decision:** Resolved — user accepted the recommendation ("fix per your recommendations", 2026-07-03); fix applied

---

### PF-007: Results never expose the resolved (merged) config — the CLI can't learn effective `quiet`/`diagnosticsFormat`/`outDir` set in `blend65.json` 🟡 MINOR

**Dimension:** Completeness Gaps / Implicit Assumptions / Codebase Alignment
**Location:** §4.1 (`CompileResult`/`BuildResult` fields), R9
**Codebase Evidence:** `loadConfig()` produces the merged `BlendConfig` (`packages/config/src/load-config.ts:160`), and RD-16 R24/R25 route CLI flags into the facade as overrides — so the facade, not the CLI, holds the post-merge truth. But `CompileResult`/`BuildResult` (§4.1) carry no config field. A `blend65.json` with `"quiet": true` or `"diagnosticsFormat": "json"` would be merged inside `build()` and then invisible to the CLI, which must make exactly those rendering decisions (R29, R34, R38).
**The Problem:** As specified, the CLI would have to re-run `loadConfig()` itself (duplicate load, drift risk) or ignore file-set rendering keys (violates RD-16 R25 merge semantics).

**Recommendation (single viable path):** Add `config: BlendConfig` (the resolved, merged config) to `CompileResult` — one field, one source of truth, LSP gets it for free. Considered and dropped: CLI-side re-load (two loads of the same file with divergence risk); CLI-side merging (relocates RD-16 R24's merge into a consumer).
**Confidence:** High.

**User Decision:** Resolved — user accepted the recommendation ("fix per your recommendations", 2026-07-03); fix applied

---

### PF-008: Flags added by the RD-16 preflight (R45 `--config`, R46 `--startup`) — and `--acme-path`/`--optimize` — have no acceptance criteria 🟡 MINOR

**Dimension:** Testability / Completeness Gaps
**Location:** §6 (AC-09 covers only `--platform`/`--out-dir`/`--out-name`)
**Codebase Evidence:** N/A (document-internal; R45/R46 were added 2026-07-02 by RD-16 preflight PF-003 without touching §6).
**The Problem:** Four flag rows have no AC to gate them; the plan's spec-test derivation works from ACs.

**Recommendation (single viable path):** Add AC-20: "`--config`, `--startup`, `--acme-path`, and `--optimize`/`--no-optimize` override their config/default counterparts correctly." Considered and dropped: widening AC-09's wording (buries four behaviors in one unrelated line).
**Confidence:** High.

**User Decision:** Resolved — user accepted the recommendation ("fix per your recommendations", 2026-07-03); fix applied

---

### PF-009: §4.3 yargs sketch drift — `warn-as-error` typing, `no-color` idiom, missing R45/R46 flags 🔵 OBSERVATION

**Dimension:** Consistency
**Location:** §4.3 CLI entry-point sketch
**The Problem:** The illustrative sketch (a) types `warn-as-error` as plain `string` although R26 allows bare boolean use and R27 says "multiple allowed" (needs array + boolean coercion; bare `--warn-as-error` in yargs yields `""`); (b) declares `no-color` as its own option where the yargs idiom is boolean-negation of a `color` option; (c) predates R45/R46 — `--config` and `--startup` are absent. Sketch is non-normative, so observation only.

**Recommendation:** Refresh the sketch when applying the other fixes (add the two options, note the coercion), or leave with an "illustrative, plan refines" caveat.

**User Decision:** Resolved — user accepted the recommendation ("fix per your recommendations", 2026-07-03); fix applied

---

### PF-010: AC-18's absolute "no package other than `@blend65/cli` prints" will collide with RD-12's test-harness CLI 🔵 OBSERVATION

**Dimension:** Consistency (forward-looking)
**Location:** R4, AC-18
**Codebase Evidence:** `@blend65/test-harness` is a published package (CLAUDE.md package table) whose RD-12 harness runner will print to the terminal.
**The Problem:** AC-18 as a workspace-wide absolute becomes false the moment RD-12 lands. Not RD-15's defect to fix in code — its assertion just needs scoping.

**Recommendation:** Scope R4/AC-18 to "no package in the `blendc` compile path (core/frontend/codegen/platforms/config/compiler)" — keeps the R15-style boundary testable and future-proof.

**User Decision:** Resolved — user accepted the recommendation ("fix per your recommendations", 2026-07-03); fix applied
