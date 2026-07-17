# Ambiguity Register: RD-18 Slice 8b — Strings & Embed (`rd-18-slice-8b-strings-embed`)

> **Status**: ✅ GATE PASSED — all 17 items resolved (bulk acceptance of all recommendations, 2026-07-17 16:12)
> **Last Updated**: 2026-07-17 16:12
> **Artifact**: implementation plan `codeops/features/blend65-ri/plans/rd-18-slice-8b-strings-embed/`
> **Source RD**: `../../requirements/RD-18-codegen-language-completion.md` (Slice 8 row; acceptance items 7 (embed traversal), 8, 9; Parked Q2)
>
> Register compiled from: the seven named deferrals parked at this gate by the 8a register
> (8a AR-19..24 + AR-28 — each mapped to a row below with its origin cited); a full spec sweep of
> Ch 01 §2/§7/§8, Ch 08 §4–§6/§10.6/§14.3, Ch 12 §5, Ch 13, Ch 15 §3.2/§5, `grammar.ebnf.md`
> §7.3/§8/§9.6; RD-18's Slice-8 row, Security Considerations, and acceptance items 7–9; the RD-04
> deferred-semantics ledger rows R47/R48/R106–R108 + Parked Q2; and a two-agent codebase
> reconnaissance (lexer/AST/semantics + platforms/config/codegen/R15) with every load-bearing claim
> cited at file:line in `02-current-state.md`. One independent challenger reviewed the four
> high-stakes rows (AR-5/AR-6, AR-8, AR-12 — verdicts in the Resolution Notes); its amendments are
> folded into the rows as decided. `spec/` is frozen (D3) — every spec-internal conflict below is
> resolved in plan + `diagnostic-codes.ts` only, with the deviation recorded (AR-115 precedent).

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Scope | **8b charter.** IN: string literals → encoded `const byte[]` (STR-1/4/6), char literals → encoded `byte` (CL-1/3), escape decoding (Ch 01 §7.2), the encoding seam, string array-init forms (`"S"`, `["S"; fill]`, char lists/fills) across const/let/local/zeropage positions, raw `embed()` (EMB-1..4) with traversal safety, RD-18 closure items 8–9, retirement of the E90001 string-init ICE + the 8a zeropage-string pin. OUT: encoding-intrinsic family (AR-4), format-aware embed (AR-11), the six 8a-deferred ICEs, full per-platform encoding-table fidelity beyond AR-5's three encoders. | (a) As stated — RECOMMENDED; (b) adjust | **(a)** — accepted (bulk) | ✅ Resolved |
| 2 | Behavioral | *(from 8a AR-19)* **String/char lexical canon.** Shipped lexer == Ch 01 exactly (`"…"` strings, `'…'` chars, escapes `\\ \" \' \n \r \t \0 \xNN`, E10217–E10223 live). Ch 08 STR-5 lists only 4 escapes ("no `\n \t \r`"); `grammar.ebnf.md` §9.6 has single-quoted strings. | (a) Shipped lexer/Ch 01 canonical; STR-5 + grammar §9.6 recorded as superseded spec-internal deviations (D3) — RECOMMENDED (single viable path; changing the lexer breaks shipped behavior AND Ch 01) | **(a)** — accepted (bulk) | ✅ Resolved |
| 3 | Behavioral | *(from 8a AR-20)* **Default-encoding source of truth.** Ch 08 STR-2: `screen_codes`/`internal_codes`/`raw` defaults. Ch 15 + shipped profiles: `petscii`/`atascii`/`ascii` (`CharEncoding`, `platform-profile.ts:34`; per-platform values in `02-current-state.md`). | (a) Ch 15/shipped profiles win; Ch 08 STR-2 recorded as a **byte-level semantic deviation** (challenger: `screen_codes('A')=1` vs petscii `$41` — different binaries, not naming; Ch 15 §6 (Stability Classifications) itself marks Ch 08 encoding "provisional") — RECOMMENDED; (b) Ch 08 table | **(a)** — accepted (bulk) | ✅ Resolved |
| 4 | Scope | *(from 8a AR-21)* **Encoding-intrinsic scope.** Ch 08 STR-3/CL-2 four named intrinsics + grammar §7.3 `encode()`; E10125 unminted. | (a) Platform-default encoding only; intrinsic family + `encode()` + E10125 deferred (cleanly severable; `petscii("HI")` fails naturally as undeclared identifier E10100) — RECOMMENDED; (b) family now | **(a)** — accepted (bulk) | ✅ Resolved |
| 5 | Technical | **Encoder set & stub correctness** (challenger-REFUTED stubs-as-is: a800xl/a7800 hooks delegate to PETSCII — `"hello"` on a800xl would bake inverse-video ATASCII `$C1-$DA`, `\n` → `$0D` where Ch 01 §7.2 pins ATASCII `$9B`). | (a) Three algorithmic encoders: **petscii** as shipped + `\r`→`$0D`, `\t`→`$09` made explicit; **atascii** = identity for printable ASCII, `\n\r`→`$9B`, `\t` unmappable; **ascii** = identity `$00–$7F`, `\n`→`$0A`, `\r`→`$0D`, `\t`→`$09`. a800xl/a7800 hooks repointed. Full table fidelity deferred under Ch 15 "provisional" — RECOMMENDED; (b) stubs as-is (refuted: silent wrong bytes); (c) hard-error strings on a800xl/a7800 | **(a)** — accepted (bulk) | ✅ Resolved |
| 6 | Technical | *(from 8a AR-28)* **Encoding seam architecture.** Frontend deps = core only; encoders were platforms-resident; `TypeCheckContext` has no platform access; const images fold in the frontend. | (a) **Encoders live in core** keyed by `CharEncoding`; platform hooks delegate (API unchanged); `analyze()` derives the encoder from the `targetProfile.defaultEncoding` it already receives (`analyze.ts:76`), optional injected override for third-party plugins; encoder threaded into `ConstTypeEngine` at construction (typing reaches it via `ctx.engine`). Challenger-amended: compiler-layer-adapter alternative structurally locks the future language-server (core+frontend deps only) out of real encoding → divergent editor-vs-build diagnostics — RECOMMENDED; (b) platforms-resident + compiler adapter | **(a)** — accepted (bulk) | ✅ Resolved |
| 7 | Behavioral | **Unmappable-character policy** (challenger-surfaced hazard: `"héllo"` on C64 silently bakes `$E9`; `"™"` surfaces as nonsense E10084; astral chars → surrogate halves). | (a) **Fallible encoder contract** (unmappable → null); mint **E10127** `UnencodableCharacter` (number verified free 2026-07-17) at the literal's span; code points >`$FF` always unmappable; no-profile default = the raw encoder ≡ the `ascii` encoder (identity `$20–$7E` + `\n\r\t`), everything else unmappable; decode utility yields code-point/raw-byte segments (`\xNN`/`\0`/`\\`→`$5C` bypass the encoder; `\n \r \t \" \'` resolve through it per Ch 01 §7.2) — RECOMMENDED; (b) total encoder with passthrough | **(a)** — accepted (bulk) | ✅ Resolved |
| 8 | Data & state | *(from 8a AR-22)* **String-init mechanism.** Challenger-corrected: a non-AST element list fails four verified pattern-match consumers (`typeArrayLit`, `checkArrayInitCoverage`, `buildConstImage.writeArray`, codegen `lowerAggregateInit`/`lowerInitCode`). | (a) **AST desugar**: string → synthetic `ArrayLitExpr` of `NumericLitExpr` nodes (value = encoded byte, span = the literal's span) spliced as the declaration initializer BEFORE coverage checks — W10140/size-inference/images/codegen work untouched. **E10124** (verified free; Ch 08 wording) checked at the desugar site pre-splice; bracketed `["HELLO"; fill]` (spec-legal, currently escapes the E90001 pin into silent poison) expands too; **E10116** (verified free) minted covering mixed string/value elements AND string-as-fill; `StringLitExpr` in any non-desugar position → E10080 (shipped contextless-array-literal precedent, `expression-typing.ts:1186-1190`) — RECOMMENDED; (b) parallel string path (strictly worse: duplicates four consumers, still breaks codegen) | **(a)** — accepted (bulk) | ✅ Resolved |
| 9 | Behavioral | **Char-literal surface (CL-1/CL-3).** Chars appear anywhere a byte is expected (expressions, case labels, fills, assignments); const engine has no arm. | (a) **Universal desugar**: `CharLitExpr` → synthetic `NumericLitExpr` (encoded byte) in ALL positions via the engine encoder; codegen needs no new arm — RECOMMENDED; (b) array-context only | **(a)** — accepted (bulk) | ✅ Resolved |
| 10 | Security | *(from 8a AR-23 = Parked Q2)* **embed() path policy.** EMB-2 lists `--asset-path`; ledger Q2 offered project-root fallback; config has no asset surface; RD-17 guard precedent `runtime/embed.ts:97-111`. | (a) **Source-file-relative only**; `resolve()` + containment check against `config.projectRoot`; escape-of-root → mint **E10205** `EmbedPathEscapesRoot` (verified free; dedicated code per the shipped E10246 `ConfigPatternEscapesRoot` precedent — no silent conflation into E10201); not-found → E10201; NO `--asset-path` (EMB-2 deviation recorded); path literal must be escape-free ASCII (else invalid-path rejection under E10201) — RECOMMENDED; (b) + project-root fallback; (c) + `--asset-path` | **(a)** — accepted (bulk) | ✅ Resolved |
| 11 | Scope | *(from 8a AR-24)* **embed() scope.** | (a) **Raw-only**: `format` arg → loud E90001 "format-aware embed() is not supported yet" (house precedent; retired-row protocol later); `.selector` fails naturally as field access on an array; **E10200** wired (embed legal ONLY as the full initializer of a module-level `const` array declaration); **E10202** wired (explicit-size mismatch; size inferred for unsized per EMB-4); size cap **65536 bytes enforced by `stat` BEFORE read** (size-bomb guard); E10203/E10204 + Ch 15 `embedFormats` stay dormant — RECOMMENDED; (b) format-aware now | **(a)** — accepted (bulk) | ✅ Resolved |
| 12 | Technical | **embed() pipeline placement.** Typing needs file size (EMB-4) + bytes for the const image; frontend has no fs (R15 discipline); `CompilerHost.readFile` is utf8-text. | (a) **Core-defined `AssetReader` seam injected into `analyze()`** — file read during analysis so size inference, `length()` folding, and index-tier rules land on the symbol (compiler-layer pre-scan duplicates AST walking for zero gain; determinism fine: sorted file order, read-once, cached in `constValues`). Challenger-amended: reader gets its own **`Uint8Array` contract** (utf8 `readFile` corrupts bytes ≥`$80`); absent reader (LS/tests) → documented silent poison, NEVER a fabricated size; `ConstValue` gains embed **provenance** so `ConstDataEntry.type:"embed"` is honestly produced (today `lower.ts:229` derives from `sym.type.kind` only); model records symbol→asset-path for future watch invalidation — RECOMMENDED; (b) codegen-layer read (breaks EMB-4 at analysis); (c) compiler pre-scan pass | **(a)** — accepted (bulk) | ✅ Resolved |
| 13 | Data & state | **Data emission.** | (a) String + embed const data ride the shipped `__data_<Module>_<name>` `!byte` path (16 bytes/row, `constDataStream`); NO ACME `!bin`/`incbin` (hermetic goldens); non-const string vars ride the existing initCode/per-element-store lowering post-desugar — RECOMMENDED; (b) `!bin` for embed | **(a)** — accepted (bulk) | ✅ Resolved |
| 14 | Integration | **Acceptance fixture.** | (a) `examples/slice8b/` on C64: const screen-string copied to `$0400` via by-ref const param (Ch 08 §14.3 shape), `embed("table.bin")` (small committed binary) verified byte-for-byte, `length()` folds, char-literal compare, STR-6 mutable-string mutation; VICE asserts memory bytes. Negatives: E10205, E10201, E10202, E10200, E10116, E10124, E10127, format-arg E90001. Golden + three-part bar — RECOMMENDED; (b) other shape | **(a)** — accepted (bulk) | ✅ Resolved |
| 15 | Scope | **Closure phase (RD-18 items 8–9).** RD-07 AC-09's Pattern-B full-range remains an 8a-deferred ICE; RD-06 AC-02 carries a 7a annotation precedent. | (a) Audit & tick RD-04 AC-02..20, RD-06 AC-02, RD-07 AC-07..09 with **tick-with-annotation** for documented deferrals; retire the RD-04b phantom (3 requirement-doc refs annotated with the AR-114 supersession); refresh roadmap annotations; `spec/` porcelain empty throughout; item-9 security verification recorded in the completion report — RECOMMENDED; (b) closure as separate task after | **(a)** — accepted (bulk) | ✅ Resolved |
| 16 | Process | **Verify command** (from CLAUDE.md). | (a) `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` — RECOMMENDED | **(a)** — accepted (bulk) | ✅ Resolved |
| 17 | Naming | **Plan dir + fixture names.** | (a) Pre-resolved by 8a AR-2: `rd-18-slice-8b-strings-embed`, `examples/slice8b/` — listed for traceability — RECOMMENDED | **(a)** — accepted (bulk) | ✅ Resolved |

### Resolution Notes

**Decisions recorded 2026-07-17 16:12** as one bulk acceptance ("accept all recommendations")
after the full register was presented with per-row recommendations. Bulk-acceptance rows record
the recommendation as spelled out in their Options cell, per the gate's bulk-acceptance rule.

**Challenger review (recommendation-hardening):** one independent challenger reviewed the four
high-stakes rows with code-verified evidence. Verdicts: AR-6 seam AGREE-WITH-AMENDMENTS
(encoders must be core-resident or the language-server is structurally locked out; encoder must
reach `ConstTypeEngine`, not just typing; segments carry code points, not JS strings; `\\` is a
raw `$5C` byte); AR-12 embed AGREE-WITH-AMENDMENTS (bytes-not-string reader API; absent-reader
semantics pinned; E10205 minted rather than conflated; stat-before-read cap; provenance for the
`"embed"` tag; asset-path map for watch invalidation); AR-5 stubs-as-is REFUTED (inverse-video
ATASCII / wrong `\n` — fixed via the two ~15-line identity-based encoders); AR-8 mechanism
corrected to an AST desugar (side-list fails four verified consumers incl. codegen) with the
bracketed-form escape and desugar-site E10124 added. The challenger also surfaced the
unmappable-character hazard, promoted to row AR-7.

**Code-number verification (2026-07-17):** E10116, E10124, E10127, E10205 all verified free in
`diagnostic-codes.ts`; E10125 deliberately left unminted (AR-4). E10200–E10204 already exist with
zero emit sites; 8b wires E10200/E10201/E10202 and leaves E10203/E10204 dormant (AR-11).

**Preflight amendments (2026-07-17, iteration 1 — see `00-preflight-report.md`):** all ten
findings resolved per recommendation; no decided outcome changed. Mechanism-level amendments
folded into the plan docs: the `AssetReader` seam is `SourceId`-keyed with `resolvedPath` in
the ok arm (AR-12 mechanics — the frontend owns no paths); the char desugar converts nodes
in place at the typing choke point, plus a `ConstTypeEngine.evalExpr` arm for Pass-2 lazy
folds (AR-9 mechanics — parent-slot splicing cannot reach folded local bindings or
expression-interior slots); embed containment is canonical (realpath) with a post-read size
re-check (AR-10 mechanics, RD-18 "canonicalize" clause); the raw no-profile encoder ≡ the
`ascii` encoder (AR-7 wording, fixed above); a third string-init pin
(`aggregate-typing.spec.test.ts:228-231`) joins the retirement matrix (AR-8 scope); the
`SemanticModel`/`ConstValue` provenance edits are `@blend65/core` changes; citation fixes
(Ch 15 §6; EMB-1 vs the AR-11 tightening; ST-25..35/ST-40 ids).

**Runtime corrections (2026-07-17, exec_plan Phase 5 — mechanical, no decided outcome changed):**
the 03-04 fixture listing was not legal blend65 on three counts, corrected during execution with
the oracles (observables table, golden landmarks, proof points) preserved byte-for-byte:
(1) `word(i)` → `<word>(i)` (the language's cast form; `word(i)` parses as an undeclared call);
(2) `for (… = 0 to len)` → a hoisted `last = len - 1` bound (`to` is INCLUSIVE — slice7's
`0 to 4` covers five elements — and the for-bound parses as a primary expression);
(3) `poke(dst + <word>(i), …)` violates poke's compile-time-constant-address rule (E10045) —
the copy became by-ref-array staging (`copyBytes(src: const byte[], dst: byte[], len)`) with
unrolled const-address pokes relaying the staged bytes to the observable ranges, which also
exercises the mutable by-ref array parameter path. Additionally the fixture exposed a REAL
shipped codegen bug: `_cmpN`/`_shN` generated labels are global assembler symbols but their
counter reset per function, so any program with two comparison-bearing functions failed ACME
("Symbol already defined") — fixed with a program-shared label allocator threaded through
`generateInstr` (`translate.ts`/`instr-program.ts`); all eleven prior goldens stay byte-exact
(any prior hitting the bug could never have assembled).

**Deferral consequences (stated at deferral):** AR-4 leaves the four encoding intrinsics +
`encode()` unparsed-as-intrinsics (they fail as undeclared identifiers); AR-11 leaves format-aware
embed behind a loud E90001; AR-5 defers full encoding-table fidelity (graphics chars, shifted
sets) under Ch 15's "provisional" status — all named for a future cleanup/Phase-B gate.
