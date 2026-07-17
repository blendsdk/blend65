# Literal Desugar: RD-18 Slice 8b

> **Document**: 03-02-literal-desugar.md
> **Parent**: [Index](00-index.md)
> **Governs**: AR-8, AR-9 (consumes 03-01's decoder/encoder)

## Overview

How `CharLitExpr` and `StringLitExpr` become bytes without teaching any downstream consumer a
new node kind: both desugar into synthetic `NumericLitExpr` / `ArrayLitExpr` AST nodes, so the
shipped array-init machinery, const images, and codegen work untouched (the challenger-verified
constraint: four consumers pattern-match on real AST nodes — `02-current-state.md` G4/G5).

## Implementation Details

### Synthetic nodes

Nodes are plain interfaces; only `kind`/`span` conventions matter. A synthetic
`NumericLitExpr` carries `value` = the encoded byte, `raw` = its decimal text, `span` = the
ORIGINAL literal's span (diagnostics and `typeMap` keying stay correct; identity-keyed maps
coexist fine with synthetics).

### Char literals — universal desugar (AR-9)

At the top of expression typing, before the kind switch: a `CharLitExpr` is decoded
(one segment; the lexer guarantees exactly one) and encoded via `ctx.engine`'s encoder; the
node's slot in the parent is replaced by the synthetic `NumericLitExpr`, which then types as a
`byte` constant everywhere — expressions, `case` labels (const-eval now folds them), fill
positions, assignments. Unmappable → E10127, poison. Codegen and the const engine need no
`CharLitExpr` arm; the walk simply never sees one after typing.

Implementation note: replacement happens where the parent holds the child reference — the
cleanest single choke point is a pre-pass in `typeOfExpr`/`computeType` that returns the
synthetic node's type AND records the substitution; declaration/initializer sites that hold the
node directly (let/const/zeropage initialisers, array elements, fills, case labels) splice the
replacement into the parent field. The 99-plan's Phase-2 tasks enumerate the splice sites.

### String literals — declaration-site desugar (AR-8)

Desugar runs in declaration typing (`typeLetDecl` / const path / `typeZeropageField`) **before**
`checkArrayInitCoverage` (currently `statement-typing.ts:808`), replacing `rejectStringArrayInit`:

1. **Bare form** `let m: byte[N?] = "S";` — decode+encode the string; length check FIRST:
   if the declared size exists and byteCount > N → **E10124** (Ch 08 wording: "String literal
   (<N> bytes) exceeds array size (<M>)") and stop. Else splice
   `ArrayLitExpr{elements: synthetics, fill: null}` as the initialiser. W10140 (short string on
   sized array), size inference (unsized), const-image folding, and codegen all fall out.
2. **Bracketed form** `["S"]` / `["S"; fillExpr]` — an `ArrayLitExpr` whose elements contain
   string literals. Legal shape: EXACTLY ONE element that is a `StringLitExpr` (fill optional)
   → expand the string into the element list in place (fill preserved). Any other appearance of
   a `StringLitExpr` among elements — with values, with a second string — → **E10116** ("Cannot
   mix string literals with value elements in array initializer"). E10124 applies to the
   expanded-elements+size check the same as the bare form (fill may complete the remainder —
   expanded length alone must not exceed the declared size).
3. **String as fill** `[…; "S"]` → **E10116** (the AR-8 decision folds Ch 08's spent-E10115
   "fill must be single element" case into the E10116 mint; message variant "…as a fill value").
4. **Anywhere else** (argument, binary operand, poke value, …) — `StringLitExpr` reaching
   general expression typing → **E10080** invalid-operand, matching the shipped contextless
   `ArrayLitExpr` precedent (`expression-typing.ts:1186-1190`). No silent poison remains.

Positions covered by (1)/(2): module `const` (→ const image → `__data_*`), module `let`
(→ initCode lowering), local `let` (→ per-element frame stores), `zeropage` fields (8a parity).
The desugar is position-agnostic — it edits the initialiser before any of those paths look.

### Encoding

Decode via `decodeLiteral` (03-01); each `codePoint` segment encodes through `ctx.engine`'s
encoder — `null` → **E10127** naming the character and encoding, poison the declaration,
no splice. `rawByte` segments become element values verbatim (`"\xFF"` is legal everywhere,
including a7800).

### Retirement matrix (retired-row protocol — rewritten to assert success, never deleted)

| Shipped pin | Location | Rewritten to |
|-------------|----------|--------------|
| E90001 "string array initialisers are not supported yet" | `rejectStringArrayInit` call sites' spec tests | bare-form success: bytes/size/W10140 per ST-10..14 |
| 8a zeropage boundary pin `zeropage { msg: byte[6] = "HELLO"; }` → E90001 | 8a negative suite (test-harness + frontend) | zeropage string init succeeds; bytes in the user-ZP category |
| Bracketed-form escape (silent poison — no pin exists) | NEW spec tests | `["HELLO"; 0]` succeeds; mixed forms → E10116 |

`rejectStringArrayInit` itself is deleted (dead code) once the desugar lands.

## Error Handling

| Error case | Code | AR |
|------------|------|----|
| String longer than declared size | E10124 (mint; Ch 08 §12 wording) | AR-8 |
| Mixed string/value elements, two strings, string-as-fill | E10116 (mint) | AR-8 |
| Unmappable character | E10127 (03-01 owns the contract) | AR-7 |
| String literal outside an array-initialiser position | E10080 (reuse) | AR-8 |
| Char literal anywhere | never an error by position — encodes or E10127 | AR-9 |

## Testing Requirements

Spec tier ST-10..ST-24; impl tier: splice idempotence (typing runs once per decl), synthetic
spans point at the original literal, `typeMap` integrity, the four consumers receiving
synthetics (coverage warning, image bytes, initCode lowering, frame stores).
