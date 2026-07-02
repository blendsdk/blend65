# T3 Runtime & Marshalling: RD-17

> **Document**: 03-04-t3-runtime-marshalling.md
> **Parent**: [Index](00-index.md)

## Overview

The four hand-written runtime routines, their textual embedding + dead-strip into the
single RD-09 `.asm` output, and the ABI-correct call-site marshalling that replaces the
shipped left-only stub.

## Architecture

### Current
- `translate.ts:605-624` `emitRuntimeCall`: marshals `left`→A, `void right`, `JSR labelRef(routine)`, binds result to A. Word ops already select `__rt_mul16`/`__rt_div16` names.
- No `.asm` files exist anywhere; no embedding; no dead-strip.
- `serialize-acme.ts:78-120`: single-file serializer, discrete sections.

### Proposed

```
codegen/
├── runtime/                 # package root, NOT src/ (AR-P8)
│   ├── mul8.asm  mul16.asm  div8.asm  div16.asm
└── src/runtime/
    └── embed.ts             # collectReferencedRoutines + loadRuntimeModule
```

## Implementation Details

### `.asm` module convention (RD-17 §4.6)
Each file: ABI comment block (params, return, clobber, cost) → single entry label
`__rt_<name>` → algorithm → `RTS`. Self-contained; internal labels prefixed
`__rt_<name>_` to avoid collisions in the single-file output (AR-100). Algorithms are
standard 6502 shift-and-add multiply / shift-subtract divide taken from well-known
reference implementations (AR-P4); functional math verification is RD-12's (AC-14
deferred).

### ABI per routine (AR-33, AR-98, AR-P7)

| Routine | Inputs | Outputs | Clobbers |
|---------|--------|---------|----------|
| `__rt_mul8`  | a→A, b→X | product lo→A, hi→X | A, X, status |
| `__rt_mul16` | a→A(lo)/X(hi), b→ZP arg[0..1] | product lo→A, hi→X (16-bit result per RD-17 §4.3) | A, X, Y, status |
| `__rt_div8`  | a→A, b→X | quotient→A, remainder→X | A, X, status |
| `__rt_div16` | a→A(lo)/X(hi), b→ZP arg[0..1] | quotient→A(lo)/X(hi), remainder→ZP arg[0..1] (overwrites b — AR-P7) | A, X, Y, status |

ZP arg-block symbols: the SFA allocator **already** reserves the arg-block bytes as
named allocations `__zp_arg_0`, `__zp_arg_1`, … (`frontend/src/sfa/zp-allocator.ts:189-192`),
and every ZP allocation already flows into `AllocationPlan.symbolDefinitions` and thus
into the `.asm` symbol header (`frontend/src/sfa/symbols.ts:84-85`). Routine bodies and
marshalling code reference these **existing** `__zp_arg_N` symbols directly — no new
`__rt_arg*` symbols are minted and `embed.ts` emits no symbol definitions (PF-018;
symbolic, no hardcoded addresses).

### Marshalling rewrite (`translate.ts`)
`emitRuntimeCall` → `marshalAndCall(descriptor, left, right, ctx)`:
1. Byte ops: `left`→A (LDA from SFA slot/immediate), `right`→X (LDX). Both operands
   now marshalled (fixes the `void right` stub; AC-10).
2. Word ops: `left`→A/X, `right`→`STA/STX`-free path: load each byte and `STA __zp_arg_0/__zp_arg_1`.
3. Emit `JSR __rt_<name>`; bind result A (byte) or A/X (word); `%` (mod): after
   `JSR __rt_div8` bind X (remainder→result via `TXA`); word `%`: copy `__zp_arg_0/1`
   to the destination slots (AR-98).
4. Before emission, compute the call's ZP arg-block requirement from the descriptor
   (`costMetadata.zpBytes`); if it exceeds the target's `zpArgBlockSize` — received via
   `generateInstr`'s new optional `opts` param, threaded from `plugin.profile` by
   `assembleProgram` (PF-016) — → **E10044** (AR-P11 message) and poison the statement
   (R35, AC-13). When the option is absent (bare `generateInstr` callers), the check is
   skipped; ST-27 exercises the `assembleProgram` path.

### Embedding + dead-strip (`embed.ts`, AR-100)
- `collectReferencedRoutines(program): Set<string>` — walk the final Instr streams for
  `JSR` targets matching registered T3/T4 symbols (post-peephole, so only *surviving*
  references count).
- `loadRuntimeModule(descriptor): string` — resolve `asmModulePath` against the owning
  package root via `import.meta.url`; canonicalize and reject any resolution escaping
  the package root (path-traversal guard, security requirement).
- `serializeToAcme` gains an optional `opts?: { runtimeSection?: string }` param
  (PF-016) — `embed.ts` computes the section text (`; --- runtime routines (referenced
  only) ---` + each referenced module's text verbatim) and the caller passes it in, so
  the serializer's "pure and deterministic" contract (R5) is preserved. Unreferenced
  modules are simply not embedded (R16, AC-11). Existing golden outputs are unchanged
  for programs that reference no routines (no option → no section).

### Platform stub migration (AR-98)
The five plugins' `runtimeModules` entries for mul8/mul16/div8/div16 are **removed**
(they are codegen-owned T3, not platform modules); `RuntimeModule` stays for genuine
T4 modules (03-05). The spec-locked plugin tests (`c64.spec.test.ts:157-163` etc.)
are updated deliberately in the same phase.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| ZP arg-block requirement > profile size | E10044, poison statement | R35, AR-P11 |
| `asmModulePath` unresolvable/escaping package root | ICE (packaging bug), path guard | Security req |
| Referenced symbol with no registered module | ICE — catalog drift | AC-19 |

## Testing Requirements
- Spec: marshalling Instr shapes per routine (byte/word × mul/div/mod); E10044 with a shrunken fixture profile; embedding includes exactly the referenced modules; dead-strip case; `.asm` files assemble under ACME via a harness that prepends a 2-line prelude defining `__zp_arg_0/1` for the word routines (PF-019 — the symbols live in the program header, not the module files; the syntax-check intent is preserved).
- Impl: symbol collection post-peephole, path-guard cases, `__zp_arg_N` reference correctness, mod-remainder binding.
