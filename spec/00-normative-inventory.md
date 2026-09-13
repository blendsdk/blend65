# Blend65 Specification 4 — Normative Inventory

> **Version**: 4.0
> **Role**: Non-normative membership and identity record
> **Frozen identity**: `BLEND65-SPEC-4-415831d3a0949d7e183673c56eec8c422e5f44eb74a8d50639ef96c6156b46e2`

## Authority Rule

Only the files in the normative table define Blend65 Specification 4. The non-normative files help
readers find, understand, or reconsider that authority but cannot change it. Every listed path is
relative to this `spec/` directory.

All retained entries must be regular UTF-8 Markdown files with LF line endings. Symlinks, paths
outside `spec/`, unlisted files, and duplicate paths are invalid. The inventory is non-normative and
is excluded from its own digest, so the identity is not self-referential.

## Normative Files

| Relative path | Role |
|---------------|------|
| `00-introduction.md` | Language scope, axioms, and document map |
| `01-lexical-structure.md` | Lexical grammar and reserved names |
| `02-type-system.md` | Types, conversions, and value rules |
| `03-variables.md` | Declarations, storage forms, and initialization |
| `04-expressions-operators.md` | Expressions and operators |
| `05-statements-control-flow.md` | Statements, blocks, loops, and switch |
| `06-functions.md` | Functions, calls, compile-time evaluation, and SFA behavior |
| `07-structs.md` | Struct layout and value semantics |
| `08-arrays-strings.md` | Arrays, literals, indexing, and encodings |
| `09-enums.md` | Enum declarations and nominal semantics |
| `10-modules.md` | Modules, imports, exports, and visibility |
| `11-memory-model.md` | Addressing, lifetimes, aliasing, stack, and memory effects |
| `12-intrinsics.md` | Core and CPU-control intrinsics |
| `13-data-inclusion.md` | Embedded/loadable data and asset contracts |
| `14-diagnostics.md` | Canonical public diagnostic registry |
| `15-platform-profile.md` | Qualified profile contract and exact active profile set |
| `appendix-c64.md` | Commodore 64 platform, library, asset, and artifact contract |
| `grammar.ebnf.md` | Master syntax grammar |

## Non-Normative Files

| Relative path | Role |
|---------------|------|
| `00-feature-index.md` | Reader navigation |
| `00-normative-inventory.md` | Membership and identity record |
| `evaluations/F001-multi-file.md` | Design evaluation |
| `evaluations/F002-modules.md` | Design evaluation |
| `evaluations/F003-module-contents.md` | Design evaluation |
| `evaluations/F004-entry-point.md` | Design evaluation |
| `evaluations/F005-memory-placement.md` | Design evaluation |
| `evaluations/F006-address-of.md` | Design evaluation |
| `evaluations/F007-interrupt-functions.md` | Design evaluation |
| `evaluations/F008-for-loop.md` | Design evaluation |
| `evaluations/F009-switch-statement.md` | Design evaluation |
| `evaluations/F010-signed-types.md` | Design evaluation |
| `evaluations/F011-structs.md` | Design evaluation |
| `evaluations/F012-cpu-control-intrinsics.md` | Design evaluation |
| `evaluations/F013-control-flow.md` | Design evaluation |
| `evaluations/F014-arrays.md` | Design evaluation |
| `evaluations/F015-data-inclusion.md` | Design evaluation |
| `evaluations/F016-type-system.md` | Design evaluation |
| `evaluations/F017-operators.md` | Design evaluation |
| `evaluations/F018-functions.md` | Design evaluation |
| `evaluations/F019-variables.md` | Design evaluation |
| `evaluations/F020-memory-intrinsics.md` | Design evaluation |
| `evaluations/F021-lexical-structure.md` | Design evaluation |
| `evaluations/F022-enums.md` | Design evaluation |
| `evaluations/F024-conditional-operator.md` | Design evaluation |
| `evaluations/F025-comptime-functions.md` | Design evaluation |
| `future-considerations.md` | Deferred, resolved, and rejected idea register |

## Corpus Digest

For each normative file, compute its raw SHA-256 and write one GNU-style record:

```text
<64 lowercase hexadecimal characters><two spaces><relative path><LF>
```

Sort those records by bytewise relative path under `LC_ALL=C`, concatenate them without extra
bytes, and SHA-256 the result. The resulting lowercase digest is:

```text
415831d3a0949d7e183673c56eec8c422e5f44eb74a8d50639ef96c6156b46e2
```

This single central identity names the normative corpus. Normative files do not repeat it. Raw
hashes for all retained files, including non-normative files and this inventory, are recorded in
the RD-01 closeout so changes outside the normative digest remain detectable.
