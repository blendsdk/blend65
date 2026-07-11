# Requirements: RD-18 Slice 6 — Full Expressions & Mixed Width

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-18](../../requirements/RD-18-codegen-language-completion.md) — the OWNING requirements doc (Slice 6 row; AC-5)

## Scope of this plan (delta view)

RD-18's Slice-6 row defines the surface: `&&`/`||` short-circuit, compound assignment,
unary `- ! ~`, casts, mixed-signedness (E10081), auto-promotion, ternary,
`zext`/`sext`/`trunc`, word/variable shifts, non-const `lo`/`hi` — normative rules in
spec Ch 02 (TS-1…TS-21) and Ch 04 (§2–§7, §9.2), backlog rows in the RD-04 deferred
ledger (§6 R31–R36, §7 R40–R43, §8 R50–R55).

### In this plan

- **Full binary-operator typing** — ledger R49 (extended to the full §5.1 matrix),
  R50 (comparisons, TS-7), R51 (logical), R52 (bitwise), R53 (shifts + E10083)
- **Mixed-width auto-promotion** — R31 (TS-4 `commonType`/`isAssignableTo` widening);
  applies to assignments, initializers, arguments, and returns (AR-3)
- **Unary operators** — `-` (TS-8, E10087), `!`, `~`; `&` stays Slice 8 (AR-11)
- **Explicit casts** — R40–R43 on the FR-40 `<type>(expr)` surface (AR-14): TS-11/12/13
  behavior, E10086 boolean↔integer, E10155 other invalid casts
- **Ternary** — R55 (Ch 04 §7): E10134 condition, E10088 arm mismatch, promotion arms
- **Compound assignment** — TS-17 expansion semantics on the R54 l-value rules
- **Signed relational comparisons** — byte+word N⊕V framing (AR-1)
- **Const-eval growth** — width-aware folds for bitwise/shift/cast/ternary/logical
  (RD-18 slice map: "Slice 6 = cast/shift folds"), via the optional type lookup (AR-7)
- **Warnings** — W10160/W10161 (TS-9), W10101 (TS-12), W10174 (Ch 04 §4) (AR-4)
- **Codegen completion** — IL `neg`/`not`/`zext`/`sext`/`trunc` lowering + translation,
  word + variable-count shifts, four comparison framings (operand-typed comparisons
  stamped at all three lowering emission sites — binary, for-loop predicate, switch
  dispatch — fixing the latent word-compare defect, AR-5/AR-9), short-circuit +
  ternary CFG lowering through synthetic SFA slots (AR-6, AR-8), non-const `lo`/`hi`
- **Loud guards** — signed `/`/`%` lowering ICE (AR-2)
- **Three-part acceptance bar** — assemble-clean + committed ASM golden + real-VICE
  runtime with observable short-circuit suppression (RD-18 AC-5; fixture per AR-12)

### Deferred / out of this plan

- `&` address-of → Slice 8; `sizeof`/`offsetof`/`length`, `IndexExpr`, struct literals,
  enum casts → Slice 7; signed `/`/`%` runtime routines → future signed slice;
  non-const `peek`/`poke` addresses stay E10045; optimizers stay passthrough (AR-11)
- W10100 (signed const overflow) and W10173 (possible runtime division by zero) —
  explicitly out of Slice 6 scope (AR-4)
- Intrinsic argument-type checking beyond `lo`/`hi` (e.g. `poke` value-width rules)
  is untouched pre-existing surface — not assigned to Slice 6 by the RD slice map

## Plan-local decisions

| Decision | Chosen | AR Ref |
| -------- | ------ | ------ |
| Signed relational comparisons | Implement in 6 (N⊕V byte+word) | AR-1 |
| Signed `/`/`%` | Loud lowering ICE; signed `*` allowed (bit-exact truncated multiply) | AR-2 |
| Widening reach | Assignment compatibility everywhere (args/returns too); supersedes 5a strict-arg pin | AR-3 |
| Warning set | W10160+W10161, W10101, W10174 in; W10100, W10173 out | AR-4 |
| Latent word-compare miscompile | Fixed inside the comparison work; DEF-1 row + regression witness | AR-5 |
| Cross-block expression results | Synthetic per-site SFA frame slots (incl. `__init`) | AR-6 |
| Const-eval width semantics | Optional per-node type lookup; width-sensitive folds gated on it | AR-7 |
| Condition-position lowering | Generic value path (materialize 0/1 → `brcond`) | AR-8 |
| Comparison IL shape | `type` = operand type; 0/1 result implicit | AR-9 |
| Diagnostic codes | Mint E10086/E10087/E10088; reuse E10083 (renamed)/E10080/E10134/E10155 | AR-10 |
| Boundaries | RD slice map + Won't-Have, unchanged | AR-11 |
| Fixture | Single-file `examples/slice6/main.blend`, `$C000..$C006` band + witness | AR-12 |
| Folder/verify | `rd-18-slice-6-expressions`; CLAUDE.md verify command | AR-13 |
| Cast syntax | FR-40 `<type>(expr)` (shipped parser); TS-11/grammar drift recorded | AR-14 |

## Acceptance Criteria (plan-local)

RD-18 AC-5 owns the slice bar. Plan-local additions:

1. [ ] All six prior slice goldens (gate, 3b, 4a, 4b, 5a, 5b) and the compiler
       assemble goldens stay **byte-exact with no re-mint** — the comparison-shape and
       widening changes must not perturb already-shipped output.
2. [ ] The DEF-1 regression witness (word-operand comparison) fails against the old
       low-byte-only translation and passes after the fix.
3. [ ] `git status --porcelain spec/` empty throughout (D3).
4. [ ] Ledger rows R31/R32(row)/R40–R43/R50–R55 + R49-extension annotated; RD-18 AC-5
       ticked; roadmaps cascaded.
