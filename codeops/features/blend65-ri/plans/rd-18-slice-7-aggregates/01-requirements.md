# Requirements: RD-18 Slice 7a — Aggregates (direct surface)

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-18](../../requirements/RD-18-codegen-language-completion.md) — the OWNING requirements doc (slice map row 7 + acceptance item 6)
> **Backlog**: `codeops/_archive/rd-04-semantic-analysis/08-deferred-semantics-ledger.md` (the itemized row inventory)

## Scope of this plan (delta view)

Per AR-1, RD-18's Slice 7 is delivered as **7a (this plan, "direct" surface)** + **7b ("pointer"
surface, its own later plan)**. The boundary is addressing-mode-shaped: 7a covers everything
reachable with direct absolute / `abs,X`-indexed addressing; 7b covers everything requiring a ZP
pointer + `(ptr),Y`.

### In this plan (7a)

- **Array/struct/enum declarations validated** — ledger R26–R28 (types exist), R68 (struct decl:
  dup fields E10003, recursion → AR-5/AR-13 E10165), R69 (enum decl: E10003/E10143/E10230 per
  AR-4/AR-13), R35 (`void` element/field → AR-21 E10156)
- **Array literals** — NEW parser/AST surface (AR-2): list + Ch-08 fill form (AR-3), initialiser
  (`let` AND `const` — the const-flag gap closes per PF-001) + assignment-RHS contexts (AR-18),
  size inference, element typing (AR-11, AR-22); statement-head literals rejected E10157 and
  string-initialiser forms loud-rejected until Slice 8 (AR-26)
- **The full const evaluator** — ledger R88–R94 (const-expr array sizes, enum member values,
  width-aware element encoding), unified lazy const/type engine (AR-6), cycle codes (AR-23)
- **Intrinsic query folds** — ledger R60 + RD-06 R48: `sizeof`/`offsetof`/`length` typed
  (value-dependently, AR-16), const-folded, legal in const/size positions
- **Indexing (tier 1)** — ledger R57/R101–R105: unsigned index (E10114), tier rules
  E10117/E10118 (AR-14), static bounds E10115, scaled element access (AR-15)
- **Struct member access & literals** — ledger R56 (E10160), R62 (E10161/E10162 + order E10097
  per AR-9 as amended), whole-struct assignment copy R37, no struct equality R38 (E10080)
- **Enums complete** — ledger R18 (member access), R39/R41/R43 enum-cast remainder (AR-12),
  nominal assignability (E10152), cross-enum comparison → E10080; enum switch dispatch +
  E10077 emission (4b deferral); NO exhaustiveness (AR-4)
- **Const aggregates → data** — ledger R64 aggregate-const completion, R103 (E10113); RD-06
  `constData` channel populated; ACME `!byte` data streams
- **Cross-module type surface** — 5b deferral honored (AR-7): `import { Type } from Mod`,
  `Mod.Type` annotations, `Mod.Enum.Member`, `Mod.constArray[i]`; plus the mandatory
  module-keyed declaration-tables defect fix (bare-name collision, AR-7)
- **Aggregate returns rejected with permanent codes** — E10093/E10120 (AR-1/AR-13; illegal in
  v3 forever, not deferred)
- **Warnings** — W10140/W10141 (AR-17)
- **Three-part acceptance bar** — assemble-clean + ASM golden + real-VICE run of the two-file
  `examples/slice7/` fixture (AR-19)

### Deferred / out of this plan

- **7b (pointer surface)**: by-ref struct/array parameters + const params (ledger R70, CP-1..5,
  W10112), unsized-array params, tier-2 `(ZP),Y` indexing (>256-byte arrays; E10118 emission
  becomes reachable), `load_indirect`/`store_indirect` translate, W10142/W10143 — AR-1. In 7a,
  aggregate params and >256-byte arrays are **loudly rejected** (never silent).
- **Slice 8**: string/char array initialisers + encoding intrinsics, `embed()`, `zeropage`
  aggregates, `&` address-of, W10110 — RD-18 slice map.
- **Runtime `--bounds-check` flag**: deferred per AR-8 (no trap ABI, no config key, no
  acceptance coverage); revisit at Slice 8 / post-slice tooling.
- **Exhaustiveness / duplicate-enum-value / member-cap enforcement**: E10133/E10142/E10141 stay
  registered-unwired per AR-4 (chapters-beat-registry policy).
- **Optimizers**: IL passes + peephole rules stay passthrough (RD-18 Won't-Have, AR-111).

## Plan-local decisions

All 26 decisions live in [00-ambiguity-register.md](00-ambiguity-register.md); the load-bearing
ones: AR-1 (7a/7b split), AR-2/3 (array literals + Ch-08 fill), AR-4 (chapters-beat-registry),
AR-5/6 (unified lazy cycle engine), AR-7 (cross-module types + tables defect), AR-9 (field
order E10097, chapter-number reuse), AR-13/21/22/26 (code table + mints E10156/E10126/E10157/
E10165 + reuses incl. E10097), AR-14 (strict tier rules E10117/E10118), AR-15 (lowering owns
scaling; W10172/W10170 per the translateMul ladder), AR-16/25 (value-dependent intrinsic typing
under the representability rule), AR-24 (one namespace).

## Acceptance Criteria (plan-local; RD-18 item 6 ticks at 7b)

1. [ ] `examples/slice7/` (two files, AR-19) assembles clean through real ACME to a loadable PRG
       (zero undefined symbols) and VICE-verifies the `$C000..` result band: indexed read/write,
       nested member access, enum-dispatch switch, folded `length`/`sizeof`/`offsetof`, a
       cross-module const-table read
2. [ ] A `const byte[N]` with `N` a const-expression (referencing a module const and `sizeof`)
       sizes correctly and lands in the data section as `!byte` rows
3. [ ] Byte-exact ASM golden committed; all seven prior slice goldens unchanged
4. [ ] Negative surface proven via the public facades (codes per AR-13/21/22; one path-carrying
       diagnostic per cycle per AR-5/23)
5. [ ] The bare-name declaration-table collision defect is fixed and regression-tested (AR-7)
6. [ ] Full verify green; `git status --porcelain spec/` empty
