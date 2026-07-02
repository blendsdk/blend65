# Ambiguity Register: RD-09 ACME Emitter & Assembler Integration

> **Status**: ✅ GATE PASSED — 1 item added during planning (AR-94) / 2 items added during execution (AR-95, AR-96)
> **Last Updated**: 2026-06-10
> **Parent**: [Index](00-index.md)

This register is the audit trail for RD-09's plan. RD-09's discovery is **closed** — every
requirement (R1–R47) in `requirements/RD-09-acme-emitter.md` already traces to a resolved
entry in the repo-level register `requirements/00-ambiguity-register.md` (AR-55..AR-69,
AR-80, AR-81). The preflight against the RD passed all five gates (2026-06-10).

**AR-94** is a *runtime* ambiguity surfaced while reading the live code during planning: the
RD's §4.2 serializer pseudocode uses illustrative field names that do not match the
implemented `AllocationPlan` / `InstrStream` types. **AR-95** is a *runtime* ambiguity
surfaced during the execution-preflight of the authored plan: two immutable spec-test oracles
(ST-S8 vs ST-AG1) disagreed on whether the canonical `.asm` carries section comments. Per the
project runtime-ambiguity protocol both were resolved with the user before any plan document
fixed a behavior on them.

> **Note on `AllocationPlan` location:** the `AllocationPlan` / `SymbolDefinition` **types** are
> *defined* in `@blend65/core` (`packages/core/src/sfa/allocation-plan.ts`). The frontend file
> `packages/frontend/src/sfa/plan-allocation.ts` only *populates* the plan (it imports the type
> from `@blend65/core`). Where the AR-94 note below says `plan-allocation.ts` for
> `generateSymbolDefinitions`, the population site is frontend; the type home is core.

---

## Register

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|----------------|-------------------|---------------|--------|
| 94 | Technical (runtime) | RD §4.2 reads `allocationPlan.zpSymbols/frameSymbols/moduleVarSymbols` and `stream.segment === 'bss'`; the live `AllocationPlan` exposes a single flat `symbolDefinitions[]` and `InstrStream.segment` is `"code" \| "data" \| "zp"` (no `bss`). How should the serializer source symbol defs and order segments? | **1A** verbatim `symbolDefinitions` under one header / **1B** reconstruct 3 groups / **1C** prefix-sniff group comments · **2A** `code→data`, skip `zp`, no `bss` / **2B** empty BSS placeholder now | **1A + 2A** — least coupling to RD-05 naming internals, purely-additive BSS extension path, no future refactor debt | ✅ Resolved |
| 95 | Testing (runtime) | ST-S8 requires `serializeToAcme`'s gate output to be **byte-identical** to the existing RD-07c golden **ST-AG1** (`packages/compiler/src/assemble.golden.spec.test.ts`). But ST-AG1 hand-composes `printInstr` and has **no** `; --- symbol definitions ---` header and **no** `; --- function: _main ---` comment, while `serializeToAcme` (R10, ST-S3, ST-S4, RD §4.8) **always** emits both. Two immutable oracles disagree. | **A** canonical = header-bearing (§4.8); migrate ST-AG1 to call `serializeToAcme`, +2 comment lines / **B** keep ST-AG1 frozen, drop the "equals ST-AG1" claim from ST-S8 (two independent goldens) / **C** strip section comments so `serializeToAcme` matches ST-AG1 (violates R10/ST-S3/ST-S4) | **A** — one canonical serializer (RD-09's charter, AR-60/AR-63/D4); only A satisfies R10+ST-S3+ST-S4+ST-S8 together; ST-AG1 migration is faithful (every instruction/preamble byte unchanged, +2 comment lines) and spec-aligned (§4.8 shows the header form) | ✅ Resolved |
| 96 | Testing (runtime) | RD-09 widens `packages/codegen/vitest.config.ts` to the `{spec,impl}` glob so RD-09's own `serialize-acme.impl.test.ts` actually runs (mirroring the core package, AR-P8). This exposed **3 dormant pre-existing failures** in `translate.impl.test.ts` (RD-07b) that the spec-only glob had never executed: they assert the function label `M.f:`, but the shipped + spec-tested `sanitize()` (RD-07c D4) renders it `M_f:` (`.`→`_`, the same rule that produces `_main`). Is the test or the code wrong? | **1** fix the 3 stale expectations to `M_f:` / **2** keep codegen config spec-only (leave RD-09 impl tests un-run) / **3** change `sanitize` (would break the green ST-AG1 `_main` golden) | **1** — the code is correct and spec-tested; the dormant tests were stale oracles describing a label form that predates the RD-07c sanitize rule. Widening the glob is required so RD-09's impl tier runs | ✅ Resolved |

### Resolution Notes

**AR-94 (runtime):** RD-09 §4.2's `zpSymbols/frameSymbols/moduleVarSymbols` and
`segment==='bss'` are **illustrative**, not literal type references.

Confirmed facts from the live codebase (read during planning):

- `allocationPlan.symbolDefinitions: readonly SymbolDefinition[]` is fully populated by
  `generateSymbolDefinitions()` (`packages/frontend/src/sfa/plan-allocation.ts` step 9,
  `symbols.ts`). It is a real, ordered, golden-stable array — **frames (sorted by FQN) →
  module variables (layout order) → ZP allocations (allocation order)** — asserted by
  spec test **ST-A4** (`packages/frontend/src/sfa/symbols.spec.test.ts`). Each entry is
  `{ name: string; value: number }`.
- `InstrStream.segment` (`packages/core/src/instr-model/stream.ts`) is
  `"code" | "data" | "zp"`. There is **no** `"bss"` value. The live single-block lowering
  only ever produces `"code"` streams today; `zp` allocations are realized as **header
  symbol definitions**, not stream bodies.

**Resolution — 1A + 2A:**

- **1A (symbol source):** `serializeToAcme` emits each entry of `allocationPlan.symbolDefinitions`
  verbatim as `name = $XXXX`, in array order, under a single `; --- symbol definitions ---`
  section comment. The emitter does **not** re-derive symbol names or re-group by category —
  that logic lives once, in RD-05's `symbols.ts`. **Rationale:** zero coupling to the
  `__frame_`/`__var_`/`__zp_` naming scheme; any future symbol category RD-05 adds (e.g. a
  runtime-ABI `__arg_` block) flows through automatically, already correctly ordered.
- **2A (segment mapping):** segment order is preamble → `code` streams → `data` (const)
  streams. `zp` streams carry no emittable body (already realized as header symbol defs) and
  are skipped. No `bss`/`!fill` reservation is emitted because the live lowering produces no
  mutable/BSS region. **Rationale:** matches current reality exactly (the gate program is
  code-only); when mutable-data lowering lands, adding a `"bss"` arm is purely additive (one
  new segment value + one render branch) with no change to existing code.

**Spec impact:** none. `spec/` is the frozen baseline (decision D3) and is untouched. The
RD's *intent* — symbol definitions at the top of the `.asm`, code emitted before const
data — is fully preserved; only the illustrative field names are reconciled to the
implemented types. The RD requirements R11–R17 are satisfied; R13's three cosmetic
sub-section comments are folded into one header (R13 is documented as illustrative).

**Traceability:** the deviation between the RD pseudocode and the implementation is
recorded here so Phase-1 serializer spec tests assert the **1A+2A** behavior, not the
literal §4.2 pseudocode.

**AR-95 (runtime):** The authored plan's `07-testing-strategy.md` declared two immutable
oracles that cannot both hold:

- **ST-S8** said `serializeToAcme`'s gate output must equal the **existing ST-AG1 golden**
  in `packages/compiler/src/assemble.golden.spec.test.ts`.
- That ST-AG1 golden hand-composes `printInstr` over `program.preamble` + `program.streams`
  and contains **no** `; --- symbol definitions ---` header and **no** `; --- function: _main ---`
  comment.
- But `serializeToAcme` (R10, ST-S3, ST-S4, RD §4.8) **always** emits the symbol-definitions
  header (even when empty) and a `; --- function: <sym> ---` comment before each code stream.

So ST-S8 contradicted ST-S3 + ST-S4 (and the RD's own §4.8 worked example, which *shows* the
header-bearing form).

**Resolution — A (one canonical serializer):**

- `serializeToAcme` is the **single canonical** whole-program output (RD-09's charter,
  AR-60/AR-63/D4). It emits the section comments per R10/ST-S3/ST-S4/§4.8.
- **ST-S8** is reworded to assert the §4.8 header-bearing text (symbol-defs header + per-function
  comment), **not** byte-equality with the *current* ST-AG1 text.
- **ST-AG1 is migrated** to call `serializeToAcme(program)` instead of hand-composing
  `printInstr`. Its expected golden gains exactly two comment lines
  (`; --- symbol definitions ---`, `; --- function: _main ---`); every instruction and preamble
  byte is unchanged. This is a legitimate oracle update (testing.md Rule 10) because the new
  expected text is composed from the RD §4.8 worked example, with explicit user approval — not
  derived by running the code.
- **Rationale:** keeps exactly one whole-program rendering path (no `--emit-asm` vs build drift,
  which is the entire point of RD-09); satisfies R10 + ST-S3 + ST-S4 + ST-S8 simultaneously;
  preserves ST-AG1's purpose (real `c64Plugin` × real `assembleProgram` → correct gate code).

**Plan-doc impact:** `07-testing-strategy.md` (ST-S8 reworded) and `99-execution-plan.md`
(new Phase-1 task to migrate ST-AG1; task count 24 → 25). **Spec impact:** none — `spec/`
untouched (D3). The ST-AG1 migration is the one pre-existing test file changed; it is updated
in Phase 1's green step so the suite stays consistent.
