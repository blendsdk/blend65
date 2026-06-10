# Requirements: RD-07c Codegen Platform Preamble

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-07](../../requirements/RD-07-codegen-instr.md) (§3.6 R46–R49, §3.9 R55; the
>   deferred "Half A" remainder), with the RD-10 `PlatformPlugin` hooks as the consumed input.

## Feature Overview

RD-07c wires the shipped RD-10 `PlatformPlugin` into the codegen back end so the
`InstrProgram` carries a real, platform-supplied **preamble** and the entry function is
labelled `_main`. After RD-07c, the c64 gate program (`poke(0xD020, 5)`, terminating `main`)
serialises to a complete, assemblable ACME program: output directive, origin, BASIC stub,
startup shim, then the `_main` function code.

This is "Half A" of RD-07's deferred remainder. "Half B" (ops no live lowering emits,
multi-block CFG, calling convention, interrupt body, for-loops, fall-through optimization) is
out of scope per AR-38 and stays deferred until RD-06 widens lowering.

## Functional Requirements

### Must Have

- [ ] **FR-1** A new additive entry point `assembleProgram(ilProgram, plugin, bag): InstrProgram`
  in `@blend65/codegen` that calls `generateInstr(ilProgram, plugin.profile.cpuVariant, bag)`
  and returns a program whose `preamble` is filled from the plugin (R46/R55, D2).
- [ ] **FR-2** `assembleProgram` derives `PreambleOptions` and calls `plugin.emitPreamble(options)`
  to populate `InstrProgram.preamble` (R46/R47, D2).
- [ ] **FR-3** `PreambleOptions.projectName` defaults to `"main"` for the slice (the build
  driver overrides it in RD-15; no live driver consumes it yet).
- [ ] **FR-4** Shim-variant selection (D3): the entry function whose single block ends in a
  `ret` terminator ⇒ `shimVariant: "terminating"`. (Half-A rule; documented seam for the
  Half-B CFG analysis.)
- [ ] **FR-5** `needsBssZero` is `true` only if the `AllocationPlan` reserves a BSS/mutable
  region; `needsDataInit` is `true` only if the program has const/initialised data to copy.
  Both are `false` for the gate program (D3).
- [ ] **FR-6** Codegen labels the **unique entry function** (the function whose bare name is
  `main`, i.e. fqName `Module.main`) with the special label `_main` (R47/R15, D4).
- [ ] **FR-7** Every **other** function's stream label is sanitized: fqName
  `Module.function` → `Module_function` (`.`→`_`; only `[A-Za-z0-9_]`; the `__` prefix stays
  reserved for compiler symbols). `sanitize()` in `translate.ts` becomes a real implementation
  (it is an identity stub today) (D4, RD-05 sanitization).
- [ ] **FR-8** `assembleProgram` is deterministic: the same IL + plugin ⇒ the same
  `InstrProgram` (preamble + streams), so golden snapshots are stable (R53/H5).
- [ ] **FR-9** `assembleProgram` is exported from the `@blend65/codegen` barrel
  (`packages/codegen/src/index.ts`) so RD-09/RD-15 can consume it.
- [ ] **FR-10** The assembled program serialises through the shipped `printInstr` to
  deterministic ACME text — the preamble entries (directives + shim instrs) render with the
  RD-07a serializer, no new serialization code (R52/R54).

### Should Have

- [ ] **FR-11** `programByteSize` (RD-07b) already sums the preamble; confirm it now counts the
  populated preamble entries (no code change expected — covered by an impl test).

### Won't Have (Out of Scope — deferred to Half B / later slices)

- The deferred IL ops (`call`, `br`/`brcond`, indexed/indirect memory, `neg`/`not`, `copy`,
  `intrinsic`, `zext`/`sext`/`trunc`) — still reach the RD-07b `E90001` ICE default arm.
- Multi-block CFG translation (lowering is single-block).
- Calling convention codegen (parameter store → JSR → return extraction).
- Interrupt prologue/epilogue body.
- For-loop Pattern A/B selection.
- The `JSR _main`/`RTS` **fall-through optimization** (needs `main`-termination + layout
  analysis — Half B; D8). The shim is wired exactly as the RD-10 plugin emits it.
- `encodeString`/`encodeChar` hook wiring (no live string/char lowering — D5).
- Real `main`-termination CFG analysis (the Half-A rule FR-4 is the interim).

## Technical Requirements

### Compatibility

- `generateInstr` signature is **unchanged** (D2); existing RD-07b tests stay green.
- No modification to `@blend65/platforms` (the c64 shim is consumed as-is; D8).
- `spec/` is frozen — read-only; `git status --porcelain spec/` stays empty.

### Architecture

- All new code lives in `@blend65/codegen/src/instr/`. The R15/AR-20 boundary is untouched
  (`frontend`/`language-server` still never import `@blend65/codegen`).
- `@blend65/platforms` is added as a **test-only** dependency of `@blend65/codegen` if needed
  for golden tests (mirrors how `@blend65/platforms` took `@blend65/codegen` as a test-only
  dep in RD-10). The `PlatformPlugin` *type* is imported from `@blend65/core` (where it lives),
  so the production `assembleProgram` code depends only on core + the IL/instr model — no
  codegen→platforms production edge.

### Security

- N/A — pure in-memory compiler data transformation; no I/O, no user-supplied runtime input.

## Scope Decisions

| Decision   | Options Considered | Chosen | Rationale | AR Ref |
| ---------- | ------------------ | ------ | --------- | ------ |
| Slice scope | Half A / all / skip→RD-09 | Half A | RD-09 needs the preamble; forced by dep graph | D1 |
| Plugin→codegen | sig change / param / wrapper | wrapper `assembleProgram` | zero churn to `generateInstr` consumers | D2 |
| Shim selection | CFG analysis / simple rule / hardcode | simple rule | CFG is Half B; rule correct for all live programs | D3 |
| Entry label | alias / `_main` direct / change shim | `_main` direct + sanitize others | matches shipped shim + RD-09 R15/R19 | D4 |
| Encoding hooks | wire / defer | defer | no live consumer | D5 |
| Fall-through | now / defer | defer | needs Half-B layout analysis | D8 |

> **Traceability:** Every decision references the Ambiguity Register (`00-ambiguity-register.md`).

## Acceptance Criteria

1. [ ] **AC-01** `assembleProgram(ilProgram, c64Plugin, bag)` returns an `InstrProgram` whose
   `preamble` is non-empty and equals `c64Plugin.emitPreamble({projectName:"main",
   shimVariant:"terminating", needsBssZero:false, needsDataInit:false})` for the gate program.
   (FR-1/FR-2/FR-4/FR-5)
2. [ ] **AC-02** The gate program's entry stream is labelled `_main`; a multi-function fixture
   sanitizes non-entry labels `Module.fn`→`Module_fn`. (FR-6/FR-7)
3. [ ] **AC-03** `assembleProgram` is deterministic — same IL+plugin ⇒ identical program. (FR-8)
4. [ ] **AC-04** End-to-end golden: the gate IL → `assembleProgram` → `printInstr` produces the
   exact expected ACME text (preamble + `_main` body + `RTS`/terminator). (FR-10)
5. [ ] **AC-05** `generateInstr` is unchanged and all pre-existing RD-07b tests stay green.
6. [ ] **AC-06** `assembleProgram` is exported from the codegen barrel. (FR-9)
7. [ ] **AC-07** Spec tests written before implementation, verified red, then green.
8. [ ] **AC-08** All decisions trace to an `AR-NN`/`D-N` or a frozen spec section.
9. [ ] **AC-09** Full verification passes; R15 boundary tier stays green; `spec/` unmodified.
