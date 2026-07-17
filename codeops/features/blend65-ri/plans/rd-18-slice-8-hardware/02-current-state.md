# Current State: RD-18 Slice 8a — Hardware

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### Headline

The lexer, AST, and parser are **already complete** for the whole 8a surface. The wall is
uniformly analyzer → SFA → IL lowering → translate, and several downstream assets are
pre-plumbed but dormant.

### What Exists (per feature)

**`&` address-of** — `Ampersand` token; `UnaryExpr` op `"&"` parsed with correct prefix/binary
disambiguation (`pratt.ts:119,227-239`). Typing walks the operand and **silently poisons**
(`expression-typing.ts:499-501`); lowering ICEs `"address-of (not supported yet)"`
(`lower.ts:1304-1307`). The `addr` IL operand from 7b is shipped and consumed by translate as a
store source and ALU right operand (`operand.ts:30-44,96-100`; consumers at `translate.ts:557,
780,813,837,894,1481,1765`); it is produced today only for by-ref marshalling and pointer
formation (`lower.ts:912,1779,1786`). `model-adapter.ts:68` hardcodes `isEscaped: false` with a
comment reserving it for `&fn`.

**`interrupt` functions** — `KwInterrupt`; `InterruptDeclNode`; `parseInterruptDecl` requires
`interrupt function name()` and **rejects `: void`** (`parse-decl.ts:141-172`); `export
interrupt` → E10311 by design (`parse-decl.ts:456-487`). The analyzer collects the symbol with
`kind: "interrupt"` (`function-collection.ts:112,132`), never as `main`; direct calls reject
with the wired **E10051** (`expression-typing.ts:1197`). Lowering accepts `InterruptDecl`
(`lower.ts:304-342`, `isInterrupt` flag threaded); translate emits **RTI** for `ret` when
`isInterrupt` (`translate.ts:497`). **Gap**: no register save/restore around the body, and no
E10050.

**`zeropage {}`** — `KwZeropage`; block/field nodes parsed (`parse-decl.ts:396-453`, fields
`name: type [= constExpr];`). The analyzer is **entirely silent** on the nodes (no collection,
typing, or init-order). The ZP allocator already has the **user category at priority 1**
(`zp-allocator.ts:186-216`) with E10032 overflow (once) and W10030 wired (`budgets.ts:82`) —
but `run-frontend.ts:174` hardcodes `zpUserVars: []`; no projection exists. 7b's
`SymbolDefinition.zeroPage` 2-digit-equate discipline is shipped.

**Non-terminating `main`** — the shim union is `"terminating" | "non-terminating" | "bare"`;
`"non-terminating"` emits `JMP _main` (`shared-hooks.ts:88-114`) and is user-reachable via
config `startup: "minimal"` (`emit.ts:38-51`). `derivePreambleOptions` hardcodes
`"terminating"` under `auto` behind an explicit SEAM comment deferring "true termination
analysis" until CFG lowering existed (`instr-program.ts:191-213`) — it exists since 4a.
Platforms carry `getMainTerminationPolicy().canReturn` (c64 true, a7800 **false**).

**T1 intrinsics** — 13 `asm_*` registered (`catalog.ts:201-221`) with opcode lowering and
`T1_OPCODES` translate entries (`translate.ts:123`). Believed complete; unproven end-to-end.

**By-ref argument places (AR-29)** — runtime-indexed / pair-relative places ICE at
`lower.ts:904-908` ("needs address-of"), pinned by `lower-indirect.spec.test.ts:182` (ST-40).
The 7b formation machinery (base `addrOf` + word add through `__zp_ptr_scratch`,
`lower.ts:1779-1786`) is the reusable building block.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/frontend/src/semantics/type-check/expression-typing.ts` | expression typing | real `&` arm (03-01) |
| `packages/frontend/src/parser/parse-decl.ts` | declarations | optional `: void` (03-02) |
| `packages/frontend/src/semantics/module-variable-collection.ts` (+ passes) | module vars | zeropage collection/merge (03-04) |
| `packages/frontend/src/sfa/model-adapter.ts` | model→SFA projection | `isEscaped`, irq-reachability, `zpUserVars`, scratch-twin predicate (03-01/03/04) |
| `packages/frontend/src/sfa/interference.ts` | interference graph | irq-reachable always-live (03-03) |
| `packages/frontend/src/sfa/zp-allocator.ts` / `plan-allocation.ts` | ZP placement | irq scratch pair alias; user vars flow (03-03/04) |
| `packages/codegen/src/il/lower.ts` | IL lowering | `&` lowering; arg-place address materialization (03-01) |
| `packages/codegen/src/instr/translate.ts` | IL→Instr | interrupt prologue/epilogue; irq temp-pool flag (03-02/03) |
| `packages/codegen/src/instr/register-binding.ts` | spill temps | pool selection by irq membership (03-03) |
| `packages/codegen/src/instr/instr-program.ts` | preamble derivation | termination analysis consumption (03-05) |
| `packages/compiler/src/api/run-frontend.ts` | pipeline driver | feed `zpUserVars` (03-04) |
| `packages/core/src/diagnostics/diagnostic-codes.ts` | registry | +E10047/48/49/50 (additive) |
| `packages/test-harness/src/testing/` + `examples/slice8/` | acceptance | new fixture trio + golden (03-06) |

## Gaps Identified

### Gap 1: Two miscompile-class SFA holes (challenger-confirmed)
**Current:** (i) an irq-only helper's frame gets no interference edge to mainline frames and can
legally overlap them (`interference.ts:97-112` — only the handler itself is always-live, pinned
by ST-I3); (ii) the register binder draws spill slots from the `"temp"` category only
(`register-binding.ts:133-135`) — the allocated `__zp_irq_tmp_N` pool has **zero consumers**, so
an IRQ mid-block corrupts live mainline spills.
**Required:** the AR-15 rule (03-03).

### Gap 2: The RD's own acceptance sketch is unbuildable
**Current:** `pokew($0314, &onIRQ)` + the spec RTI epilogue crashes (KERNAL pushes A/X/Y before
dispatch); the spec's Ch 06 §7.7 example carries the same defect; the shipped shim keeps KERNAL
banked in ($01=$36).
**Required:** the AR-16 hardened raw-vector fixture (03-06).

### Gap 3: Everything else is dormant-asset wiring
Silent-poison `&` typing, absent zeropage semantics, hardcoded `zpUserVars: []`, hardcoded
`"terminating"` shim — each has its landing zone already built (see What Exists).

## Dependencies

- **Internal:** 7b pointer machinery (`addr` operand, formation scratch, `(zp),Y` framings);
  5b module-merge + `__init` stream (zeropage parity); 4a CFG (termination analysis); 5a call
  graph (irq reachability); RD-12 harness (`runFrames`, memory asserts).
- **External:** ACME + VICE 3.10 locally for the acceptance tier (AR-27 — CI runs
  assemble-clean + goldens only).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Golden churn: `isEscaped`/always-live changes perturb SFA layout of prior fixtures | Low | Med | Prior fixtures contain no interrupts/`&`; irq-reachability is empty for them — assert all ten goldens byte-exact (01-req AC-5) |
| VICE flake on the IRQ fixture (timing) | Med | Low | Saturating counter + `>=` assertions (AR-16); slice3b flake precedent: re-run before diagnosing |
| Termination analysis misclassifies | Low | High if non-terminating wrongly chosen | Conservative bias mandated (AR-25): non-terminating only when NO `ret` reachable under const-aware successors |
| Irq temp-pool sizing (profile `irqTempBytes: 2`) too small for real handlers | Med | Med | Profile-constant pool (the main pool's own mechanism — PF-003); the binder's spill-exhaustion ICE names the dry pool; raising `irqTempBytes` is a pure profile change (03-03) |
