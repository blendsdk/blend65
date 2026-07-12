# Ambiguity Register: RD-18 Slice 7b — Pointer surface (by-ref params / tier-2 arrays)

> **Status**: ✅ GATE PASSED — all 14 items resolved at the gate (2026-07-12)
> **Last Updated**: 2026-07-12 01:59
> **Artifact**: `plans/rd-18-slice-7b-pointers/` (implements blend65-ri/RD-18, acceptance item 6 — closes it)

Codebase grounding for every row was verified against the working tree at commit `9fb607e`
(branch `v3`, Slice 7a complete). Key evidence files: `spec/06-functions.md:85-134` (FN-2/FN-3 —
scalars by value; struct/array params by reference; *"The caller stores the base address (2 bytes)
into the callee's frame. The callee uses indirect indexed addressing"*), `spec/08-arrays-strings.md`
(CP-1..5 const params §7, sized/unsized params §8, tiers §10.3/AR-3, codes §12),
`spec/07-structs.md` (SR-3, §4.7 aliasing/W10112, §5.2-5.6 by-ref sketches),
`spec/11-memory-model.md:93-101,138-168` (§3.3 by-ref param = 2 FRAME bytes; §4.1-4.3 ZP pointer
pairs per active by-ref level, lifetime-shared), `spec/grammar.ebnf.md:89-90,118-126` (param/type
productions lack `const` and unsized — grammar drift, chapters win),
`packages/frontend/src/parser/parse-decl.ts:53-94` + `parse-type.ts:82-101` (`ArrayTypeNode.size:
ExprNode | null` already parses `[]`), `packages/core/src/semantics/symbol.ts:60` (`byRef` exists,
hardcoded false), `packages/core/src/semantics/type.ts:30-35` (`ArrayType.size: number` — no
unsized form), `packages/frontend/src/semantics/annotation-resolution.ts:121-131` (aggregate-param
E90001) + `type-check/type-resolution.ts:72-81` (>256-byte E90001) — the two rejections to retire,
`packages/frontend/src/sfa/frame-computation.ts:29-37` (2-byte pointer slot rule SHIPS),
`zp-allocator.ts:74-122,152-223` (`computePeakPointers` + `__zp_ptr_N` pool, dormant),
`packages/codegen/src/il/instruction.ts:114-136` (`load_indirect`/`store_indirect` `{value, ptr,
offset}` modeled; `call` args always `[]` — store-per-arg), `il/operand.ts:22-29` (NO address
operand form — the gap), `instr/translate.ts:372-377` (the indirect ICE seam) + `:1619-1710`
(prescan def/read already correct for the indirect pair), `core/src/instr-model/addressing-mode.ts:36`
(`IndirectY` ships) + `codegen/src/instr/print-instr.ts:128-129` (`(sym),Y` renders) +
`instr/cpu-table.ts:38-39` (LDA/STA IndirectY legal), `packages/platforms/src/c64.ts:50-51`
(ZP $02–$8F), `packages/core/src/diagnostics/diagnostic-codes.ts` (E10118 registered-unreachable;
E10122/E10123/W10112/W10142/W10143 unregistered).

**Hardening:** AR-2 (the load-bearing convention decision) was challenged by an independent
adversarial agent before presentation — verdict CONFIRM, with three sharpenings folded into AR-2/
AR-4/AR-9 (const-aggregate scratch demand, translate ICE backstop, Slice-8 IRQ scratch-twin note)
and one honest counter-argument recorded in the AR-2 resolution note (the spec cost-table drift).

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Scope | 7b surface: the 7a AR-1 split promised by-ref/const params, unsized params, tier-2 `(zp),Y` for >256-byte arrays, `load_indirect`/`store_indirect` translate, W10112/W10142/W10143, E10118 emission — and retiring the two 7a E90001 loud rejections. RD-18 acceptance item 6 closes at 7b | A: confirm that surface (whole-struct copy through params included; OUT: strings/`embed`/`&`/`zeropage`/interrupts → Slice 8; runtime `--bounds-check`; optimizers) / B: adjust | User confirmed A — the full pointer surface as scoped; RD-18 item 6 ticks when the 3-part bar passes | ✅ Resolved |
| 2 | Technical | **Calling convention / pointer placement** (load-bearing): where does a by-ref param's pointer live and who stages it for `(zp),Y`? FN-3's normative sentence says caller→frame; Ch 11 §3.3 accounts 2 frame bytes AND §4.2 allocates ZP pairs; the Ch 07 §5.3/Ch 08 §10.7 *sketches* store direct-to-ZP | A: caller stores direct into the callee's bound ZP pair (no frame slot; fastest, matches sketches + ~10-cycle cost table; deviates from FN-3 wording + §3.3 accounting) / B: frame home + per-access copy through shared scratch (cheapest ZP; per-access cycles or new translate pair-state caching) / **C: frame home + dedicated pair + prologue copy** (caller stores address into the 2-byte frame slot — 5a convention uniform; SFA binds each by-ref param a pair by interference coloring; callee entry block copies frame→pair once as two byte copies; accesses `LDY #off / LDA (pair),Y`) | User chose **C** — spec-conformant (FN-3 + Ch 11 §3.3 + §4.2 simultaneously), maximal shipped-machinery reuse (`slotSize` 2-byte rule untouched, 5a arg-window inheritance). Refinement included: params never accessed through their pair (dead / pass-through-only) skip the pair binding AND the prologue copy. Challenger: CONFIRMED; counter-argument recorded (cost-table drift, see note) | ✅ Resolved |
| 3 | Behavioral | By-ref **argument forms**: statically-addressable places (whole vars incl. `Mod.var`, const-indexed elements, member chains → symbol + const offset) are link-time constants; runtime-indexed places (`enemies[i]`) and pair-relative places (`p.field` where `p` is itself a by-ref param) need runtime address arithmetic | A: static-only + whole pass-through of a by-ref param (word copy of the frame slot); runtime-indexed AND pair-relative arg places → loud unsupported ICE (5b/7a precedent), revisit at Slice 8 `&` / B: also pair-relative / C: all places | User chose A — static + whole pass-through; both hard classes ICE loudly at lowering. Place-shape classification runs on the RESOLVED chain (a runtime index buried mid-chain ICEs) | ✅ Resolved |
| 4 | Technical | Tier-2 **scratch pair**: runtime pointer formation (base+index) needs one designated scratch ZP pair; unconditional reservation shifts `__zp_tmp_N` in every program and breaks all 8 prior goldens. First-draft predicate (by-ref param OR >256-byte variable) was BROKEN by the challenger: `const TABLE: byte[300]` with a runtime word index demands scratch with neither | A: **hardened conditional predicate** — reserve iff any reachable function has ≥1 by-ref param OR any declared storage **or const aggregate** transitively (through struct fields / nested arrays) contains an array >256 bytes total; plus a loud translate ICE backstop when staging is demanded without the reservation; plus a recorded Slice-8 deferral (IRQ code needs an `__zp_irq_ptr` scratch twin per Ch 06 §7.6) / B: always reserve (re-mint all 8 goldens) | User chose A — hardened predicate + backstop + Slice-8 note; pointer-free programs keep byte-identical ZP layout | ✅ Resolved |
| 5 | Behavioral | **Unsized array params** (`T[]`): semantic `ArrayType.size` is a mandatory `number`; unsized needs representation. Index widths: Ch 08 §8.2's own example indexes an unsized param with a BYTE loop var, and the bound array may exceed 256 bytes so word must work; Ch 08 AR-3's tier errors are keyed to KNOWN total bytes | A: `size: number \| null` (null = unsized, legal only on parameter symbols; the 7a inference path keeps owning `let a: T[] = […]`); `T[N] → T[]` assignable for matching element type, any N, all element types; byte AND word indexes both legal (byte = `LDY idx` direct, word = scratch-pair add); E10117/E10118 stay known-tier-only / B: word-only indexing on unsized | User chose A — both widths; the spec's own example stays legal | ✅ Resolved |
| 6 | Behavioral | **Const-param model**: how `const` is carried and enforced (CP-1..5). E10191's gate keys on `kind === "constant"` — parameters never are; needs a new predicate. Is `const` on a SCALAR param legal (CP-1's wording is general; its examples are aggregates)? | A: `ParameterNode` gains `isConst` (field, not a new node kind — AST stays 51 kinds); const-param Symbol carries `mutable: false`; `assignmentRootSymbol` predicate extends — root is parameter && !mutable → **E10123** (root kind constant → E10191 unchanged); **E10122** fires when an argument's root is a const symbol OR a const param and the target is a MUTABLE by-ref param (scalars exempt — by-value copies); `const` scalar params allowed, enforced read-only by the same predicate / B: same but reject scalar const | User chose A — one predicate, zero bespoke machinery; scalar const params legal and read-only | ✅ Resolved |
| 7 | Behavioral | Struct field offsets **>255** through a by-ref pair (`LDY #off` caps at 255; >256-byte structs are constructible via large array fields) | A: scratch-add fold — const offsets ≤255 ride `LDY #off`; larger offsets fold into pointer formation via the scratch pair (same machinery as word indexes), Y carries the remainder; no struct-size cap (matches Ch 07 §5.6's 16-bit-calculation note) / B: cap by-ref struct offsets at 255 (invents a rule the frozen spec doesn't state) | User chose A — uniform scratch-add, no cap | ✅ Resolved |
| 8 | Behavioral | **W10112 aliasing** scope (Ch 07 §4.7: "may emit for obvious cases — same variable passed twice — but cannot catch all aliasing") | A: warn when the same ROOT SYMBOL feeds ≥2 by-ref arguments of a single call — exactly the chapter's obvious case; no cross-call or overlap analysis / B: wider overlap analysis (more than the chapter asks) | User chose A — same root symbol, one call | ✅ Resolved |
| 9 | Naming | **Diagnostic-code table** (additive, AR-115 precedent; registry numbering authority, chapters normative for rules): register E10122 ConstToMutableParam + E10123 ModifyConstParam (Ch 08's own numbers, free in the registry); mint W10112 PossibleAliasing (Ch 07 number), W10142 Tier2Overhead + W10143 LargeArrayOnPlatform (Ch 08 numbers); wire the registered-unreachable E10118. Reuses: sized-param size/type mismatch → E10171 ArgTypeMismatch (structural array assignability rejects naturally; the chapter assigns no code); E10112 stays unwired (count>size already E10152 per 7a AR-22) | A: accept the full table / B: adjust entries | User accepted the full table | ✅ Resolved |
| 10 | Naming | `length()` on an UNSIZED param is "not available" (Ch 08 §9) — no code assigned anywhere in spec or registry | A: reuse **E10080** InvalidOperandType with a bespoke message ("length() is not available for unsized array parameter '<p>' — pass an explicit length parameter") — the 7a reuse pattern / B: mint E10127 (E10127–E10129 free) | User chose A — E10080 reuse | ✅ Resolved |
| 11 | Behavioral | **W10143 trigger** — the chapter gives the message ("consider total RAM budget") but no threshold | A: fires when a single array's byte size ≥ **25% of the platform profile's RAM region** — platform-relative, scales across targets, quiet for ordinary tier-2 arrays (W10142 covers those) / B: fixed byte threshold (platform-blind) / C: alongside every W10142 (redundant pair) | User chose A — ≥25% of platform RAM | ✅ Resolved |
| 12 | Technical | **IL address form**: lowering must express "store the ADDRESS of symbol(+const offset)" for arg marshalling; `il/operand.ts` has immediate/temp/location only | A: new **`addr` operand kind** `{ symbol, offset }` (word-typed), legal as a `store` source and NOTHING else initially — every untaught IL path ICEs loudly via union exhaustiveness; translate renders `LDA #<sym+off / #>sym+off` through the shipped `symbolRef` byteSelect / B: `addr_of` instruction → word temp (burns A:X, interacts with the live-across-call guard in arg windows) | User chose A — the `addr` operand kind; challenger-confirmed | ✅ Resolved |
| 13 | UX | **Acceptance fixture** shape (`examples/slice7b/`, results in the `$C000..` band on real VICE) | A: two files, six runtime observables — by-ref struct mutation through a call (FN-3 shape), const-param table sum (const→const), unsized-param sum with `length()` at the call site (byte index), tier-2 `byte[300]` write+read straddling index 255 (word index — proves the high byte), a pass-through chain (f forwards its by-ref param to g), whole-struct copy through two by-ref params; W10112/W10142/W10143 witnessed by CI spec tests, not the fixture / B: adjust | User chose A — two files, six observables, warnings in the spec suites | ✅ Resolved |
| 14 | Process | Plan folder name + verify command | A: folder `rd-18-slice-7b-pointers`; verify = CLAUDE.md canonical `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` / B: adjust | User confirmed both | ✅ Resolved |

### Resolution Notes

**AR-2 (convention):** Option C is the only shape satisfying FN-3's normative sentence and BOTH
Ch 11 allocations at once. The recorded counter-argument (challenger, honest): the spec's ~10-cycle
param-passing figure (Ch 08 §11) and the Ch 07 §5.3 ~16-cycle call sketch are Option A's costs;
C runs ~26 cycles per call per by-ref param (+2 frame bytes). This is **accepted cost-table drift**
(illustrative sketches; the AR-3-grammar-drift precedent) with a Phase-B mitigation on record: a
whole-program peephole may later legally rewrite C→A per callee (when a param's frame slot is read
only by its own prologue, call sites may store direct to the pair and the copy drops). The
dead/pass-through-only refinement ships in 7b itself: lowering knows each param's access set; a
by-ref param never accessed through its pair gets no pair binding and no prologue copy (the
forwarding-wrapper pattern costs nothing extra).

**AR-2/AR-4 (pair binding & coloring):** pairs are named per-param (`__zp_ptr_<Module_fn>_<param>`)
and OVERLAID onto pool addresses by interference coloring — mirroring frame coloring — so lowering
references pair symbols without seeing the plan, and `computePeakPointers`' conservative peak
(shipped) bounds the pool. A pair is written only inside its own function's activation (prologue),
which is exactly the liveness the peak formula models; no new interference machinery.

**AR-3 (arg forms):** "statically addressable" = the resolved place chain yields symbol + const
offset with NO runtime index anywhere in the chain and a direct (non-pair) base. Pass-through of a
whole by-ref param is legal via a word copy of the caller's own frame slot (its canonical home —
the pair is a derived cache). `p.field` as an argument (pair base + const offset) is in the
DEFERRED class with runtime-indexed places: both ICE loudly at lowering until Slice 8's `&`
machinery lands address materialization.

**AR-5 (unsized):** `null` size never escapes parameter symbols — declaration inference (7a) fills
a concrete size before a variable symbol's type is finalized. `sizeof` on an unsized param type
and `length()` on an unsized param are both rejected (AR-10's E10080 message family); tier
advisories W10142/W10143 key off DECLARED array types, never param types (unknown size).

**AR-6 (const model):** `mutable: false` is the single enforcement bit; E10122's argument-side
check needs the root's const-ness — `kind === "constant"` (module const aggregates: their images
live in the read-only `__data_*` stream, so E10122 is load-bearing for image integrity, not
advisory) or a const param root. CP-4 zero-runtime-cost holds: constness never changes emitted code.

**AR-9 (codes):** E10122–E10125 are chapter-assigned numbers; 7b registers only the two it wires
(E10122/E10123). E10124/E10125 (string band) stay unregistered for Slice 8. E10116 (mixed
string/value init) likewise. The E10112 unwired status is re-affirmed — with tier-2 arrays legal,
count>size still lands on the 7a E10152 reuse.

**AR-12 (addr):** `addr` deliberately starts store-source-only. The prologue copy needs no `addr`
at all — it is two BYTE load/stores (frame+0→pair+0, frame+1→pair+1), sidestepping the word-temp
machinery entirely (challenger refinement).

**AR-13 (fixture):** observable (4) must witness an index ≥256 so a dropped index high byte
produces a wrong answer, not a coincidentally-right one (the 7a "suppression proof" discipline).
