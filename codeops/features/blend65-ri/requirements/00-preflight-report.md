# Preflight Report: RD-17 — Intrinsic Functions & Runtime-Routine ABI

> **Status**: ✅ PASSED — all 13 findings resolved (0 critical, 6 major, 6 minor, 1 observation)
> **Iteration**: 2 (fixes applied + verified 2026-07-02)
> **Artifact**: Requirement document at `codeops/features/blend65-ri/requirements/RD-17-intrinsics-runtime-abi.md`
> **Codebase Grounded**: ✅ ~25 source files examined across core/frontend/codegen/platforms/compiler + spec/ + 6 sibling RDs + archived plans; ~40 references verified
> **Last Updated**: 2026-07-02
>
> Note: this file previously held the RD-08 requirements audit (all 9 findings resolved,
> PASS 2026-06-10). That report is preserved in git history; per convention this path holds
> the latest requirements-level audit. PF numbering restarts per artifact.

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM/NodeNext, strict), Yarn v1 workspaces + Turborepo, Vitest.
**Architecture:** AOT compiler pipeline (Lexer → Parser → Analyzer → SFA → IL → Instr → ACME).
RD-17 lands across `@blend65/core` (descriptor types + registry), `@blend65/frontend`
(semantic validation), `@blend65/codegen` (T1/T2 emission, T3 `.asm` modules, marshalling),
`@blend65/platforms` (T4 descriptors).

**Key files examined:**
- `packages/core/src/ast/reserved-builtins.ts` — 22-name `RESERVED_BUILTINS` set (13 CPU + 9 memory), size-locked by tests; syntactic gate only.
- `packages/frontend/src/parser/pratt.ts:330-433` — `IntrinsicCallExprNode` parsing incl. `sizeof`/`offsetof` type + field args.
- `packages/frontend/src/semantics/passes.ts:32-76` — RD-04 analyzer is a documented passthrough no-op; intrinsic validation `DEFERRED(RD-04-checker)`.
- `packages/codegen/src/il/instruction.ts:53,128-141` — IL `call` + `intrinsic` ops; `packages/codegen/src/il/intrinsic-descriptor.ts:23-30` — placeholder descriptor `{name, tier?: number, clobbers?}`.
- `packages/codegen/src/il/lower.ts:270-300` — only `poke`/`peek` lower today (→ `store`/`load`, literal addresses only); all other intrinsics ICE.
- `packages/codegen/src/instr/translate.ts:539-624` — mul/div/mod three-tier lowering; emits `JSR __rt_mul8/__rt_mul16/__rt_div8/__rt_div16`; `mod` reuses the div routine; marshalling stub (only `left`→A).
- `packages/codegen/src/instr/serialize-acme.ts:78-120` — single-file serializer; no `!source`/include mechanism; `packages/core/src/instr-model/stream.ts` `AcmeDirective` union has no source kind.
- `packages/core/src/platform/platform-plugin.ts:81-156` — `PlatformPlugin.intrinsics: IntrinsicDescriptor[]` where `IntrinsicDescriptor = unknown` (DEFERRED RD-17); `RuntimeModule {name, asmPath, exports}`.
- `packages/platforms/src/c64.ts:82-88` — `intrinsics: []`; `runtimeModules` reference `runtime/mul8.asm` etc. — **no `.asm` file exists anywhere in the repo**.
- `packages/core/src/platform/platform-profile.ts:46-112` — canonical profile incl. `cpu: CpuVariant`, `zpArgBlockSize` (all 5 platforms = 8); interim `packages/core/src/semantics/platform-profile.ts:49` has `zpArgBlockMin` (default 0).
- `packages/core/src/instr-model/opcode.ts` — SEI/CLI/NOP/JSR present; **WAI/STP absent** from both opcode sets.
- `packages/core/src/diagnostics/diagnostic-codes.ts:47-49` — E10040-E10042 intrinsic band reserved; E10212 deliberately absent.
- `spec/12-intrinsics.md`, `spec/grammar.ebnf.md:58,392`, `spec/appendix-cx16.md:243-248` — frozen Ch 12 catalog (22 intrinsics), import grammar, `asm_wai` gating.
- Ambiguity register AR-28..AR-36, AR-49; RD-04/06/07/09/10/11/14 + archived plan ledgers.

**Reference Verification:** ~40 references mapped — AR-28..AR-36/AR-49 all verified faithful;
RD-14 R20/R23 verified; peek/poke/peekw/pokew/lo/hi signatures verified vs spec. Mismatches
became the findings below.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 1 (PF-012) | 🟡 |
| 2 | Implicit Assumptions | 1 (PF-006) | 🟠 |
| 3 | Logical Contradictions | 1 (PF-001) | 🟠 |
| 4 | Completeness Gaps | 2 (PF-003, PF-009) | 🟠 |
| 5 | Dependency Issues | contributes to PF-001/PF-002 | 🟠 |
| 6 | Feasibility Concerns | 0 standalone | — |
| 7 | Testability | 0 (ACs are concrete and testable) | — |
| 8 | Security Blind Spots | 0 (compiler-internal; module paths are package-author-controlled) | — |
| 9 | Edge Cases | 1 (PF-012 shared) | 🟡 |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 2 (PF-008, PF-013) | 🟡 |
| 13 | Codebase Alignment | 5 (PF-002, PF-004, PF-005, PF-010, PF-011) + PF-007 | 🟠 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 6 | ✅ 6 resolved |
| 🟡 MINOR | 6 | ✅ 6 resolved |
| 🔵 OBSERVATION | 1 | ✅ 1 resolved |

### Resolution summary (iteration 2, 2026-07-02)

All 13 recommendations accepted by the user and applied:

- **RD-17** (`RD-17-intrinsics-runtime-abi.md`): scope pulls in RD-04's deferred intrinsic
  rules (PF-001); R15/R16 reworded to textual inlining preserving RD-09 R4 (PF-002);
  §4.3 catalog completed to all 22 Ch 12 intrinsics + `asm_wai`, `asm_stp` dropped
  (PF-003/PF-007); internal T3 table aligned to shipped call sites — fused div/mod,
  `__rt_div16` added, `mod8` removed, plugin-stub migration noted (PF-004);
  `sizeof`/`offsetof`/`length` signatures + `poke`/`pokew` costs conformed to frozen
  Ch 12, generic/`string` notation replaced with the parser's type-arg/field-identifier
  model (PF-005); R19 import example → `import { petscii } from c64;` (PF-006); citations
  corrected to RD-04 R95–R100 and RD-10 R23–R26 (PF-008); concrete codes assigned —
  E10043 availability, E10044 ZP arg-block, E10101 shadowing, E10045 non-constant
  address (PF-009, PF-012 → new R39); §4.1 migration note for the two descriptor
  placeholders + `'boolean'` TypeRef + pointer-as-ABI-view (PF-010); `zpArgBlockSize`
  authoritative + `validateProfile()` floor enforcement (PF-011); tier→loweringStrategy
  mapping added to R17 (PF-013); new R40 assigns W10120/W10121 ownership (PF-003).
- **RD-10** (`RD-10-platform-plugin-system.md`): R24 example corrected to
  `import { setIRQ } from c64;` citing AR-97 (PF-006).
- **Ambiguity register** (`00-ambiguity-register.md`): runtime entries **AR-97..AR-101**
  logged (T4 import form; fused div/mod ABI; asm_stp dropped/asm_wai kept; textual
  inlining; non-constant-address deferral) + amendment note on AR-28.

Iteration-2 verification: re-grepped the fixed artifacts for all defect markers
(`E10xxx` placeholders, `asm_stp`, dotted import paths, `!source`, `mod8`, `<T>(`,
stale citation ranges) — none remain; cross-references spot-checked for consistency.

---

## MAJOR findings

### PF-001: Circular deferral — intrinsic semantic validation has no owner 🟠 MAJOR

**Dimension:** Logical Contradictions / Dependency Issues
**Location:** RD-17 §2 line 47 ("Out of scope: Intrinsic validation during semantic analysis → RD-04 (R99–R108)") vs §6 AC-02..AC-06 (lines 348-352)
**Codebase Evidence:** `packages/frontend/src/semantics/passes.ts:32-76` — all four analyzer passes are documented no-ops; line 54 lists intrinsic validation `DEFERRED(RD-04-checker)`. `codeops/_archive/rd-04-semantic-analysis/08-deferred-semantics-ledger.md:74,139,200-205` — R95–R100, R19, R59 all "⛔ DEFERRED — needs RD-17".
**The Problem:** RD-17 points semantic validation at RD-04, but RD-04 shipped 100% as a passthrough skeleton with every intrinsic rule deferred *to RD-17*. Each RD believes the other owns the work, so nobody does — yet RD-17's own AC-02 (arg count/type errors), AC-03 (shadowing error), AC-04 (availability error), and AC-05/AC-06 (import-boundary errors) are unverifiable without exactly those semantic checks. A plan built from RD-17 as written cannot satisfy its own acceptance criteria.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Amend RD-17 scope: implementing the deferred RD-04 intrinsic rules (R95–R100, R19, R59) is IN scope for RD-17; RD-04 remains the rule-spec source | ACs become satisfiable; validation lands with the registry it needs (AC-15 already requires the registry before semantic analysis); no new RD cycle | Fragments the future RD-04b checker across two RDs; grows an already-large RD |
| B | Keep out of scope; drop/reword AC-02..AC-06; create a separate RD-04b checker work item | Keeps RD-17 lean | RD-17 ships a registry with no consumer; MVP gate errors (e.g. wrong `poke` args) remain unchecked; another full RD cycle before intrinsics are safe |

**Recommendation:** Option A — the registry and the validation are one deliverable in practice; under B, RD-17's acceptance criteria evaporate and the registry has no consumer.
Confidence: High — would change only if the user wants a dedicated RD-04b slice scheduled immediately after.
Hardening: no change. Challenger: converged (independently picked A on the same grounds).

**User Decision:** Resolved — user accepted the recommendation (2026-07-02, "resolve with the best possible solutions, accept all recommendations"); fix applied same day.

---

### PF-002: `!source` runtime-module inclusion contradicts RD-09's single-file contract 🟠 MAJOR

**Dimension:** Codebase Alignment (Phantom Reference / Dependency Reality)
**Location:** RD-17 R15 (line 89), R16 (line 90), §5 RD-09 row (line 337)
**Codebase Evidence:** `RD-09-acme-emitter.md:85` R4 — "single `.asm` file. No multi-file ACME output"; `packages/core/src/instr-model/stream.ts:37-44` — `AcmeDirective` union has 7 kinds, no source/include; `packages/codegen/src/instr/serialize-acme.ts:78-120` — renders entries only; `packages/compiler/src/acme/invoke-acme.ts` — no include-path plumbing.
**The Problem:** RD-17 asserts the ACME emitter "includes referenced T3/T4 `.asm` modules via `!source`" and dead-strips unreferenced ones — but completed RD-09 mandates single-file output, the directive model has no include kind, and no dead-strip mechanism exists. The claim is unsupported by RD-09 and by the shipped code; the inclusion mechanism is genuinely undesigned. AR-30 only requires that the emitter "includes referenced runtime modules" — the `!source` wording is RD-17 over-specification.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Textual inlining — the emitter reads each *referenced* module's `.asm` text and embeds it in the single generated file; dead-strip = don't embed unreferenced modules | Preserves RD-09 R4 and its spec tests; `--emit-asm` output stays self-contained/golden-testable; no include-path resolution into installed package dirs | Loses ACME file/line attribution to the original module source; label-collision risk (mitigated: modules follow the strict §4.6 convention — single `__rt_` label, self-contained) |
| B | Add a `!source` directive kind + include-path support to `invokeAcme`; amend RD-09 R4 | Modules stay verbatim files; native ACME error attribution | Amends a completed, spec-tested RD; fragile path resolution across yarn-workspace vs published-package layouts at assembly time |

**Recommendation:** Option A — reword R15/R16 to "textually included in the single generated `.asm`"; dead-stripping falls out naturally (only referenced modules are embedded).
Confidence: High — would change if RD-12's emulator tier turns out to need separately assembled modules (it doesn't: the harness can assemble module + driver independently).
Hardening: no change. Challenger: converged.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02, "resolve with the best possible solutions, accept all recommendations"); fix applied same day.

---

### PF-003: §4.3 catalog omits 10 of the 13 frozen-spec CPU-control intrinsics 🟠 MAJOR

**Dimension:** Completeness Gaps
**Location:** RD-17 §4.3 (lines 235-258) vs scope line 44 ("Complete Ch 12 intrinsic catalog") and AC-01 (line 347)
**Codebase Evidence:** `spec/12-intrinsics.md` §2.2 defines 13 CPU-control intrinsics (`asm_sei, asm_cli, asm_pha, asm_pla, asm_php, asm_plp, asm_clc, asm_sec, asm_cld, asm_sed, asm_clv, asm_nop, asm_brk`); `packages/core/src/ast/reserved-builtins.ts:18-43` already reserves all 13 (set size spec-locked at 22).
**The Problem:** The table presented as the "complete" catalog lists only `asm_sei`, `asm_cli`, `asm_nop` from that set. AC-01 requires *every* Ch 12 intrinsic to have a descriptor — implementing from §4.3 alone would miss 10 intrinsics the parser already reserves. Ch 12 §4's W10120 (`asm_sed` without `asm_cld`) and W10121 (`asm_brk` in release) diagnostics also have no RD-17 owner.

**Recommendation:** Single viable fix — complete §4.3 with all 13 spec CPU-control intrinsics (all T1, `(): void`) and add a row/note assigning W10120/W10121 ownership (they are registry-adjacent semantic checks). Considered and dropped: trimming AC-01 to "the listed subset" — contradicts the frozen spec and the shipped reserved-name set.
Confidence: High. Hardening: no change. Challenger: converged.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02, "resolve with the best possible solutions, accept all recommendations"); fix applied same day.

---

### PF-004: T3 routine catalog contradicts shipped codegen call sites (`__rt_div16` missing, `mod8` never called) 🟠 MAJOR

**Dimension:** Codebase Alignment (Stale Assumptions / Impact Blindness)
**Location:** RD-17 §4.3 rows `mul8/div8/mod8/mul16` (lines 251-254) and R4 (line 68)
**Codebase Evidence:** `packages/codegen/src/instr/translate.ts:583-603` — `div` AND `mod` both lower to `JSR __rt_div8`/`__rt_div16` ("both call the same runtime routine"); no `__rt_mod*` call site exists anywhere; word division already emits `__rt_div16`, which the catalog omits entirely. `packages/platforms/src/c64.ts:83-88` — all platform plugins stub `runtimeModules` = mul8/mul16/div8/div16 (spec-tested, e.g. `c64.spec.test.ts:157-163`), while RD-17 R4 places T3 modules in `@blend65/codegen`.
**The Problem:** Implementing exactly the catalog leaves `__rt_div16` (already emitted by shipped, verified codegen) with no body — an unresolved symbol at assembly time — and ships a `__rt_mod8` that nothing calls. The catalog and the shipped lowering describe two different runtime libraries. Separately, the existing per-platform `runtimeModules` stubs contradict R4's codegen-owned placement and RD-17 never acknowledges them.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Align catalog to shipped codegen: routines = `__rt_mul8/__rt_mul16/__rt_div8/__rt_div16`; div routines return quotient AND remainder (`mod` consumes the remainder); drop `mod8`/`mod16` rows; migrate the platform `runtimeModules` stubs to codegen-owned T3 modules | Matches verified RD-07b code; one fewer routine body (div produces the remainder for free — standard 6502 practice); serves R16's 4KB-7800 size rationale; DRY (no 5× duplication across plugins) | The fused ABI strains R30 for 16-bit: a word quotient fills A/X, so div16's remainder must land in the ZP arg-block — RD-17 must spec that explicitly |
| B | Keep separate mod routines; change `translate.ts` to emit `__rt_mod8/__rt_mod16`; add the 16-bit rows | Cleaner per-routine return convention | Rewrites shipped spec-tested codegen; ~doubles routine bodies (mod duplicates ~95% of div); hostile to the dead-strip/size rationale |

**Recommendation:** Option A — and add an explicit ABI note that `div8` returns quotient→A / remainder→X, `div16` returns quotient→A/X / remainder→ZP arg-block.
Confidence: High — would change only if the fused div16 remainder path proves too costly when the routine is authored.
Hardening: the challenger's counter-argument added the div16 remainder-placement note above. Challenger: converged.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02, "resolve with the best possible solutions, accept all recommendations"); fix applied same day.

---

### PF-005: `sizeof`/`offsetof`/`length` signatures and `poke`/`pokew` costs contradict the frozen spec 🟠 MAJOR

**Dimension:** Codebase Alignment / Logical Contradictions (vs frozen spec, D3)
**Location:** RD-17 §4.3 lines 238, 240, 243-245
**Codebase Evidence:** `spec/12-intrinsics.md:126-129,180-182` — `sizeof(type): byte`, `offsetof(type, field): byte`, `length(array): byte|word`; `poke` = 4 cyc / 3 bytes; `pokew` = 8 cyc / 6 bytes. RD-17 gives `sizeof<T>(): word`, `offsetof<T>(field: string): word`, `length<T>(): word`, `poke` 6 cyc / 5 bytes, `pokew` 12 cyc / 10 bytes. The language has no generics and no `string` type (`packages/core/src/semantics/type.ts:22,69`); the parser models these as a type argument + field identifier (`packages/frontend/src/parser/pratt.ts:387-433`, `nodes.ts:390-397`).
**The Problem:** The spec is frozen (D3) and RD-17's own traceability rule forbids invented decisions — yet three return types, the parameter notation, and two cost rows diverge from Ch 12. The `<T>()` / `field: string` notation is untype-checkable against RD-17's own §4.1 `TypeRef` union (no string/generic kind) and against the shipped parser model.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Conform to the frozen spec: `byte` returns (`length` → `byte\|word` by array size), parameters expressed as type-arg + field-identifier, cost rows matched to Ch 12 (or annotated with the accounting convention) | Spec-frozen conformance; spec tests derive from Ch 12; zero runtime cost since these fold at compile time | `byte` overflows for types ≥ 256 bytes — a latent spec bug that may force a runtime AR later |
| B | Keep `word` returns; log a runtime AR entry ratifying the divergence | Overflow-safe | Diverges from the frozen oracle with no current payoff; sets a precedent for silent spec drift |

**Recommendation:** Option A — conform now; if implementation actually hits a ≥256-byte `sizeof`, surface it then as a runtime AR (the protocol exists for exactly that). For the cost rows: keep the spec figures and state RD-17's fuller accounting (value-load included) as a note.
Confidence: High. Hardening: the challenger surfaced the `poke`/`pokew` cost mismatch, folded in here. Challenger: converged.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02, "resolve with the best possible solutions, accept all recommendations"); fix applied same day.

---

### PF-006: T4 import syntax `from c64.encoding` is not expressible in the frozen grammar 🟠 MAJOR

**Dimension:** Implicit Assumptions / Codebase Alignment (vs frozen spec)
**Location:** RD-17 R19 (line 98); same defect in RD-10 R24
**Codebase Evidence:** `spec/grammar.ebnf.md:58` — `import_stmt = "import" , "{" , import_list , "}" , "from" , identifier , ";"` (single identifier, no dotted paths); `spec/10-modules.md:114-116` examples use bare module names. Additionally `spec/15-platform-profile.md:79-80,125-127` treats `petscii` as a profile *encoding setting*, while Ch 12 §5 calls it an encoding intrinsic — the "petscii as imported callable" model is itself thinly grounded.
**The Problem:** The R19 example (and RD-10 R24's `c64.system`) cannot be parsed under the frozen grammar. This is a cross-RD design assumption, not a typo: T4 platform pseudo-modules don't exist in the module-resolution model either (AR-42 resolves imports against declared modules). Planning RD-17 against R19 as written would produce unparseable test programs.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | One pseudo-module per platform: `import { petscii } from c64;` — fix R19 + RD-10 R24; record the decision as a runtime AR entry | Grammar-legal today; minimal design surface; one obvious resolution point for the module resolver | Flat namespace per platform (no library grouping); still needs resolver work to recognize platform pseudo-modules |
| B | Encode the library in the identifier: `from c64_encoding;` | Grammar-legal; preserves grouping | Invents a naming convention with no spec basis; same resolver work |

**Recommendation:** Option A, ratified by your decision on this finding and recorded as a runtime AR entry (per the repo's runtime-ambiguity protocol) so RD-10 R24 is corrected in the same stroke. Also consider replacing/annotating the `petscii` example if you'd rather not commit to petscii-as-callable while Ch 15 frames it as a profile setting.
Confidence: Med — the platform pseudo-module resolution model is genuinely undesigned; the AR entry is what makes this safe.
Hardening: no change to the pick. Challenger: diverged on mechanism (preferred "log the AR first, then decide"), converged on substance — it noted the preflight decision loop itself provides the ratification the AR needs, which is the path taken here.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02, "resolve with the best possible solutions, accept all recommendations"); fix applied same day.

---

## MINOR findings

### PF-007: `asm_stp` has no spec basis; `asm_wai` needs reserved-set + opcode-model additions 🟡 MINOR

**Dimension:** Codebase Alignment / Traceability (AC-18)
**Location:** RD-17 §4.3 lines 249-250; R2, R24
**Codebase Evidence:** `asm_stp` appears nowhere under `spec/` (grep: zero hits) — RD-17 invents it, violating its own traceability rule. `asm_wai` IS spec-traceable (`spec/grammar.ebnf.md:392` "65C02 only — platform-gated", `spec/appendix-cx16.md:243-248`, `spec/v2-to-v3-migration.md:262`) though absent from Ch 12's own table (internal spec inconsistency, unfixable under the freeze). Neither name is in `RESERVED_BUILTINS` (size-locked at 22 by `reserved-builtins.impl.test.ts:34`), and neither `WAI` nor `STP` exists in the opcode model (`packages/core/src/instr-model/opcode.ts` — 65C02 set is `BRA/PHX/PHY/PLX/PLY/STZ/TRB/TSB`).
**Recommendation:** Keep `asm_wai` (three-way spec traceability; it is RD-17's canonical availability example in R22/AC-04 and AR-32's example) and drop `asm_stp` (no spec basis; marginal utility not worth ratifying a spec addition through an AR side-channel). Note in the RD that implementing `asm_wai` requires growing `RESERVED_BUILTINS` (and its size-locked tests) and adding `WAI` to `W65C02_OPCODES`. Considered and dropped: deferring both — would contradict the frozen grammar and gut AC-04. Challenger: converged.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02, "resolve with the best possible solutions, accept all recommendations"); fix applied same day.

### PF-008: Wrong cross-RD requirement citations 🟡 MINOR

**Dimension:** Consistency
**Location:** RD-17 §2 line 47 ("RD-04 (R99–R108)"), §2 line 51 + §5 line 338 ("RD-10 (R30–R32)")
**Codebase Evidence:** RD-04's intrinsic-validation block is **R95–R100** (`RD-04-semantic-analysis.md:268-273`; its flowchart labels "Validate intrinsic calls (R95–R100)" at :357) — R101–R108 are array/`embed` rules. RD-10's T4-descriptor rows are **R23–R26** (`RD-10-platform-plugin-system.md:131-134`) — R30–R32 cover plugin-set/profile-validation/built-ins.
**Recommendation:** Fix both citations (R95–R100; R23–R26). Only viable resolution.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02, "resolve with the best possible solutions, accept all recommendations"); fix applied same day.

### PF-009: Concrete diagnostic codes never assigned, contrary to AR-32's instruction 🟡 MINOR

**Dimension:** Completeness Gaps
**Location:** RD-17 R22 (line 106), R35 (line 129), AC-04 — all use the placeholder `E10xxx`
**Codebase Evidence:** `00-ambiguity-register.md:272` (AR-32): "exact code number assigned when RD-17 is authored" — never done. `packages/core/src/diagnostics/diagnostic-codes.ts:47-49`: intrinsic band E10040-E10042 occupied, next free E10043+; E10212 deliberately absent ("owned by RD-04", :112-113) while RD-04 R100 routes shadowing to **E10101** (`NameShadows`).
**Recommendation:** Assign concrete codes in the RD: unavailable intrinsic → E10043, ZP arg-block overflow (R35) → E10044; and state explicitly that reserved-name shadowing (R20) uses the existing E10101 path (retiring the E10212 reservation comment), matching RD-04 R100. Only viable resolution shape; the specific numbers are yours to adjust.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02, "resolve with the best possible solutions, accept all recommendations"); fix applied same day.

### PF-010: Existing placeholder `IntrinsicDescriptor` types and TypeRef mismatches unacknowledged 🟡 MINOR

**Dimension:** Codebase Alignment (Impact Blindness)
**Location:** RD-17 §4.1 (lines 145-205)
**Codebase Evidence:** Two unrelated placeholders already exist with the same name: `packages/core/src/platform/platform-plugin.ts:81` (`type IntrinsicDescriptor = unknown` — DEFERRED RD-17) and `packages/codegen/src/il/intrinsic-descriptor.ts:23-30` (`{name, tier?: number, clobbers?}` — embedded in the IL `intrinsic` op, `instruction.ts:135-141`). RD-17's `tier: 'T1'|'T2'|'T3'|'T4'` (string) vs the IL placeholder's `tier?: number`. §4.1's `TypeRef` uses `'bool'` but the semantic type system spells it `"boolean"` (`packages/core/src/semantics/type.ts:22`) and has **no pointer kind** in its `Type` union (:69).
**Recommendation:** Add a short migration note to §4.1: the canonical descriptor replaces both placeholders (including the IL op's embedded reference); align `'bool'`→`'boolean'`; define how the `pointer` TypeRef maps at the frontend (calls type-check against array/struct types; `pointer` is the ABI-level marshalling view per R29, not a user-facing type). Only viable resolution.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02, "resolve with the best possible solutions, accept all recommendations"); fix applied same day.

### PF-011: Dual ZP arg-block fields; interim default violates the ≥4 floor 🟡 MINOR

**Dimension:** Codebase Alignment / Consistency
**Location:** RD-17 R33-R34 (lines 127-128), AC-12 (line 358)
**Codebase Evidence:** Canonical `PlatformProfile.zpArgBlockSize` (`packages/core/src/platform/platform-profile.ts:89`, all 5 platforms = 8) vs interim frontend-SFA `zpArgBlockMin` with `DEFAULT_PROFILE` = **0** (`packages/core/src/semantics/platform-profile.ts:49,68-84`) — below the R34 floor.
**Recommendation:** State in the RD that `zpArgBlockSize` (canonical, RD-10) is the single authoritative field, that AC-12's floor check lives in the plugin's `validateProfile()` (`platform-plugin.ts:155`), and that the interim `zpArgBlockMin`/`DEFAULT_PROFILE` must be reconciled (raised to ≥4 or retired) when RD-17 wires marshalling into the SFA path. Only viable resolution.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02, "resolve with the best possible solutions, accept all recommendations"); fix applied same day.

### PF-012: Non-constant `peek`/`poke` addresses unspecified 🟡 MINOR

**Dimension:** Ambiguities / Edge Cases
**Location:** RD-17 R3, §4.3 cost rows (absolute addressing assumed), AC-08
**Codebase Evidence:** `packages/codegen/src/il/lower.ts:295-300` — today a non-literal address argument ICEs (`addressLocation` requires a numeric literal).
**Recommendation:** Add one requirement row specifying behavior for runtime-computed addresses: either (a) in-scope — lower via ZP pointer + `(zp),Y` indirect (costs differ from the table), or (b) explicitly deferred, with the literal-only constraint stated and a proper diagnostic (not an ICE) for the unsupported case. Recommend (b) for this RD — it matches the MVP gate (constant `poke`) and keeps RD-17's size in check; (a) is real new codegen surface.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02, "resolve with the best possible solutions, accept all recommendations"); fix applied same day.

---

## OBSERVATION

### PF-013: Dispatch keyed on `loweringStrategy` vs AR-49/RD-06's "dispatch on tier" 🔵 OBSERVATION

**Dimension:** Consistency
**Location:** RD-17 R17 (line 91), §5 RD-06 row
**Codebase Evidence:** `00-ambiguity-register.md:474-483` (AR-49) and `RD-06-il-optimizer.md:136` (R26) both say codegen dispatches **on tier**; RD-17 introduces the derived `loweringStrategy` field as the dispatch key. Same intent, different key.
**Recommendation:** Add one sentence stating the tier→strategy mapping (T1→opcode, T2→inline|fold, T3/T4→call) and that `loweringStrategy` is the normalized dispatch form of AR-49's tier dispatch. Optional.

**User Decision:** Resolved — user accepted the recommendation (2026-07-02, "resolve with the best possible solutions, accept all recommendations"); fix applied same day.

---

## Adversarial-question check (same-agent bias safeguard)

- Artifact created 2026-05-31, **not** in this session — no same-session banner required.
- External standards cited from the frozen spec text itself (`spec/12-intrinsics.md`, `grammar.ebnf.md`), not from memory.
- Contrarian sweep produced PF-013 and the div16-remainder ABI note in PF-004; no further findings surfaced.
