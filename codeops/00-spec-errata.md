# Spec errata log

> **Status**: Recording only — `spec/` is the FROZEN spec-v3.0 baseline and stays untouched
> under decision **D3**. Nothing here is applied; this is the queue for a future errata pass.
> **Created**: 2026-07-21

Contradictions *internal to the specification* — cases where the frozen text disagrees with
itself, so an implementer cannot conform to all of it at once. These are distinct from
conformance defects, where the implementation disagrees with a spec that is itself coherent;
those live in [`00-conformance-triage.md`](00-conformance-triage.md).

Recording them matters because each one has already been resolved *unilaterally* by whoever
implemented that area. An unrecorded unilateral resolution reads later as a deliberate design
choice, and the next person has no way to tell the difference.

| # | Subject | The contradiction | Resolved in practice as | Consequence |
|---|---------|-------------------|-------------------------|-------------|
| E-01 | Division by zero | `spec/15-platform-profile.md:174` — "Returns 0 (defined, documented)". `spec/04-expressions-operators.md:91` — the maximum value. The runtime (`packages/codegen/runtime/div8.asm:11`) — "the result is unspecified" | Quotient `$FF`/`$FFFF`, matching Ch 04 and contradicting Ch 15 | The A5 "no undefined behaviour" axiom is broken on paper. Deterministic in practice, but pinned by no test |
| E-02 | C64 default string encoding | `spec/08-arrays-strings.md` STR-2 — the C64 default is `screen_codes`, rationale "games overwhelmingly write directly to screen memory". `spec/appendix-c64.md` profile — `petscii` | PETSCII (`packages/platforms/src/c64.ts:110-114`) | Both halves promise a `screen_codes` capability that has no implementation at all |
| E-03 | Duplicate enum values | `spec/09-enums.md:145` EN-5 explicitly **permits** duplicate values. `E10142 DuplicateEnumValue` is registered as a diagnostic for the case the spec allows | Duplicates accepted; the code never fires | A registered diagnostic exists for a rule the specification rejects |
| E-04 | Cast syntax | Three answers: `spec/02-type-system.md:302` (TS-11) documents `byte(expr)`; `spec/grammar.ebnf.md:305` documents `expr as type`; the parser accepts only `<byte>(expr)` | Prefix `<byte>(expr)` | Every cast example in Ch 02 and Ch 04 is a parse error. Casts are mandatory for the narrowing the spec itself requires |
| E-05 | Diagnostic code assignments | Dozens of Ch 14 code assignments carry different meanings in the registry (Ch-14 E10072 case-type-mismatch → impl missing-default; E10161/2 shift/ternary → impl struct-field; E10200-03 sizeof/offsetof → impl embed family). The registry documents this as accepted deviation | The registry's meanings | Behaviour is present; the numbers lie. Breaks `--suppress-warning` and any tooling keyed on published codes |
| E-06 | `poke`/`peek` runtime lowering | `spec/12-intrinsics.md:159` mandates **zero-page indirect** for a runtime address. For a constant base plus an index, the idiomatic 6502 form is absolute-indexed `STA base,X` — 4 cycles against ZP-indirect's 6 plus pointer setup | Not yet implemented either way | Implementing the spec's letter uniformly would itself violate Prime Directive clause 1. The divergence needs an explicit decision at authoring, recorded here so it is not mistaken for an oversight |

| E-07 | `E10154` is assigned twice | `spec/14-diagnostics.md:92` — "Width narrowing without cast". `spec/04-expressions-operators.md:149` and `spec/00-feature-index.md:158` — ordered comparison applied to `boolean`. Two unrelated errors, one code | The registry implements the Ch 14 meaning (`WidthNarrowingNoCast`) | Found while selecting the code for the silent two-byte `poke`. The narrowing meaning is the one in use and the one that fits, so it is kept — but a user hitting the boolean case will get a code the spec documents for something else |

| E-08 | The `INX`/`BNE` full-range loop idiom | `spec/05-statements-control-flow.md:253` promises `for (i = 0 to 255)` "uses INX/BNE-wrap codegen". Read literally that mandates an X-resident counter, but every counter this backend emits is SFA frame-homed memory (`lower.ts:700-706`) and codegen clobbers X freely — no register-resident user counters exist, and creating them is register allocation | Read as naming the **wrap-exit family**, not the X register. The deliverable is the counter step on its slot followed by a **branch on wrap**, implemented as a `brcmp` of the post-step counter against a compile-time immediate (ascending `next < typeMin + step`, descending `next > typeMax − step`), type-stamped so it is correct for byte/word/sbyte/sword. This supplements the retained bound compare and is emitted only when the loop is not provably wrap-safe. (An earlier reading proposed a flag/carry test; that was dropped — carry is the unsigned wrap flag only, and there is no IL flag-branch terminator, so the value-level immediate compare is used instead.) | Recorded so the reading is deliberate rather than an unremarked divergence |

| E-09 | For-loop `step` upper bound | `spec/05-statements-control-flow.md §7.3` requires a `step` to be "a positive compile-time constant" and places **no** upper bound. But a step larger than the counter type's maximum masks to a smaller effective step — possibly zero — on 8/16-bit hardware, so the counter never makes real progress and the loop silently never terminates | `E10061` extended to also reject `step > typeMax`, the same range framing `E10064` applies to the end bound (`statement-typing.ts`) | Narrows spec-legal input. No correct program wants an over-width step; recorded so the narrowing is deliberate and a later conformance pass does not "fix" the compiler back into the silent hang |

## How to use this file

- Add a row when the frozen text contradicts itself, or when an implementation must knowingly
  diverge from its letter to satisfy the Prime Directive.
- Never edit `spec/` to fix one. D3 holds for the duration of compiler implementation.
- At a v3.1 spec pass, this file is the agenda.
