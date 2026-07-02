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

ZP arg-block base address: the first byte of the profile's ZP arg-block region. The
allocator already reserves `zpArgBlockSize` bytes (RD-05/RD-10); `embed.ts` emits the
`__rt_arg0`/`__rt_arg1` symbol definitions into the serializer's symbol-def header so
routines and marshalling code share them symbolically (no hardcoded addresses).

### Marshalling rewrite (`translate.ts`)
`emitRuntimeCall` → `marshalAndCall(descriptor, left, right, ctx)`:
1. Byte ops: `left`→A (LDA from SFA slot/immediate), `right`→X (LDX). Both operands
   now marshalled (fixes the `void right` stub; AC-10).
2. Word ops: `left`→A/X, `right`→`STA/STX`-free path: load each byte and `STA __rt_arg0/__rt_arg1`.
3. Emit `JSR __rt_<name>`; bind result A (byte) or A/X (word); `%` (mod): after
   `JSR __rt_div8` bind X (remainder→result via `TXA`); word `%`: copy `__rt_arg0/1`
   to the destination slots (AR-98).
4. Before emission, compute the call's ZP arg-block requirement from the descriptor
   (`costMetadata.zpBytes`); if it exceeds `profile.zpArgBlockSize` → **E10044**
   (AR-P11 message) and poison the statement (R35, AC-13).

### Embedding + dead-strip (`embed.ts`, AR-100)
- `collectReferencedRoutines(program): Set<string>` — walk the final Instr streams for
  `JSR` targets matching registered T3/T4 symbols (post-peephole, so only *surviving*
  references count).
- `loadRuntimeModule(descriptor): string` — resolve `asmModulePath` against the owning
  package root via `import.meta.url`; canonicalize and reject any resolution escaping
  the package root (path-traversal guard, security requirement).
- `serializeToAcme` gains a final discrete section:
  `; --- runtime routines (referenced only) ---` + each referenced module's text
  verbatim. Unreferenced modules are simply not embedded (R16, AC-11). Existing golden
  outputs are unchanged for programs that reference no routines.

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
- Spec: marshalling Instr shapes per routine (byte/word × mul/div/mod); E10044 with a shrunken fixture profile; embedding includes exactly the referenced modules; dead-strip case; `.asm` files assemble standalone under ACME (syntax check via existing invoke pattern).
- Impl: symbol collection post-peephole, path-guard cases, `__rt_arg` symbol emission, mod-remainder binding.
