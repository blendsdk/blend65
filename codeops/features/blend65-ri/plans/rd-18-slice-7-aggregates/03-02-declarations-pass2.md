# Declaration Tables & Pass 2: RD-18 Slice 7a

> **Document**: 03-02-declarations-pass2.md
> **Parent**: [Index](00-index.md)

## Overview

Module-qualifies the struct/enum declaration tables (fixing the verified bare-name collision
defect, AR-7), realises Pass 2 (`resolveTypes`, a no-op since RD-04), surfaces the silent
recursive-struct placeholder as a loud path-carrying diagnostic (AR-5), validates enum members
(AR-4/AR-13), and threads the tables into type resolution so `NamedType`/`ArrayType`
annotations — including `Mod.Type` — resolve for real.

## Architecture

### Current
`collectDeclarationTables` (`declaration-collection.ts:48-139`) runs once over ALL programs
(`passes.ts:35`), keys by bare name, computes offsets/`byteSize` eagerly with an `inProgress`
set that swallows cycles into a zero-size placeholder (`:96-98`), and reads array sizes only
from `NumericLitExpr` (`:84`). `resolveTypes` is a no-op (`passes.ts:47-49`).
`resolveTypeNode` (`type-check/type-resolution.ts:23-25`) returns `ERROR_TYPE` for everything
non-primitive. `SemanticModel.structTypes`/`enumTypes` are bare-name maps.

### Proposed changes

1. **Module-keyed tables (defect fix, AR-7).** `DeclarationTables` becomes per-module:
   `Map<moduleName, { structs: Map<name, StructDeclNode>; enums: Map<name, EnumDeclNode> }>`,
   built during the existing Pass-1 module merge (name-keyed shared scopes, 5b). Same-module
   duplicate type names (cross-file included) → E10003; a type name colliding with a
   function/variable/const in the module → E10003 (one namespace, AR-24).
   `SemanticModel.structTypes`/`enumTypes` re-key to FQN `"Module.Name"`; the **three** shipped
   consumers (`lower.ts` `sizeOfType:1346-1363`, `offsetOfField:1366-1371`, and
   `intrinsic-validation.ts:188-209` — which reads the struct/enum tables via the Pass-1
   context; PF-006) switch to FQN lookups in the same change (re-keying the table *type* makes
   TypeScript flag any straggler).
2. **Sizing moves behind the unified engine (03-03).** `collectDeclarationTables` stops sizing
   eagerly; it only registers declarations. Offsets/`byteSize` and enum member values are
   computed by the lazy engine (AR-6) so const-expression array sizes and `sizeof` references
   resolve regardless of declaration order.
3. **Pass 2 realised** (`resolveTypes`): drives the engine over every declared struct/enum +
   module const so ALL cycle/validation diagnostics surface deterministically (module order,
   then declaration order — the 5b init-order convention), even for types nothing references:
   - struct: field-type validity (`void` → E10156 AR-21; unknown named type → E10151; unsized
     array field → E10110 family), duplicate fields → E10003, pure field-graph cycle →
     **E10165** with the full path (AR-5/AR-23), field offsets + `byteSize` totals
   - enum: member value const-evaluable → **E10230** (AR-13), value in 0–255 / auto-increment
     past 255 → E10143, duplicate member names → E10003; duplicate VALUES legal (EN-5, AR-4);
     member map materialised
4. **Type resolution threaded** (`resolveTypeNode` gains the tables + current-module context):
   - `PrimitiveType` unchanged; `void` in variable/field/element position → E10156 (AR-21)
   - `NamedType "X"` → current module's types; if absent, import-bound type names
     (`import { Point } from Gfx;` binds `Point` per AR-24 — non-exported → E10012, 5a rule);
     else E10151 UnknownType
   - `NamedType "Mod.X"` (dotted) → exported type of `Mod` (E10012 non-exported / E10100
     unknown head — the 5b ladder's codes)
   - `ArrayType` → element resolve (recursively; struct/enum elements legal per Ch 08 §2.2) +
     size via the engine: non-const → E10110, <1 → E10111, > platform data budget → E10112,
     total byte size > 256 → **loud 7a-unsupported rejection** (AR-1; tier 2 = 7b); unsized
     `byte[]` legal ONLY with an initialiser (size inferred) — elsewhere → E10110

   > Parser note (verified at preflight, PF-013): `parse-type.ts:51-54` consumes exactly ONE
   > identifier — dotted `Mod.X` type annotations do NOT parse today. The type-position dotted
   > form is a required small `parse-type.ts` extension (identifier `.` identifier), same-shape
   > node (`NamedTypeNode.name` is already a plain string, `nodes.ts:486-489`), no new kind.
5. **`Symbol` types for aggregates**: let/const/module-var symbols carry the resolved
   `ArrayType`/`StructType`/`EnumType`; `SymbolKind` `"struct"|"enum"|"enumMember"` populated so
   name resolution (03-04) can classify heads.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Cross-module duplicate `struct Point` | legal (distinct FQNs) — the defect was the collision, not the duplication | AR-7 |
| Same-module dup type / type-vs-value name | E10003 | AR-24 |
| `struct A { b: B }` + `struct B { a: A }` | ONE E10165, path `A → B → A` | AR-5, AR-23 |
| `enum E { X = someVar }` | E10230 | AR-13 |
| `enum E { A = 255, B }` | E10143 (auto past 255) | AR-13 |
| >256 members, distinct values impossible | E10143 covers; E10141 stays unwired | AR-4 |
| `let a: byte[0]` / `byte[n]` (runtime n) / huge | E10111 / E10110 / E10112 | AR-13 |
| `let a: word[200]` (400 B, tier 2) | loud 7a-unsupported rejection (never silent) | AR-1 |

## Testing Requirements
- Spec: ST-7..ST-9, ST-12..ST-16 (the cycle rows ST-10/ST-11 land with the engine, 03-03).
  Impl: table shape, FQN lookups, deterministic diagnostic order, collision-defect regression
  (two modules, same struct name, both usable).
