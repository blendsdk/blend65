# Component Specification: 6502 CPU and Lowering Knowledge

> **Document**: 03-03-cpu-and-lowering-knowledge.md
> **Parent**: [Index](00-index.md)
> **Owns**: `mos-6502-family.md`, `6502-lowering-casebook.md`

## Objective

Make CPU and code-generation guidance safe enough to review real generated assembly. The modules
must not merely list opcodes or familiar idioms: every operation is modeled through value widths,
status-flag producers/consumers, memory/bus effects, legal addressing, clobbers, bytes, path cycles,
page conditions, silicon variant, and ABI context.

## `mos-6502-family.md`

### Qualified CPU Scope

| CPU | Baseline status | Required treatment |
|---|---|---|
| NMOS MOS 6502 | Production-depth CPU model | Complete documented instruction/addressing/effect/timing model relevant to Blend65 |
| NMOS 6510 | Production-depth C64 CPU model | 6502 core plus `$0000/$0001` on-chip port, banking consequences, and C64 interrupt/runtime context |
| WDC W65C02S | Authoritative delta only | Added/changed instructions, addressing modes, decimal/interrupt behavior, corrected hazards, timing differences, and portability flags |
| Undocumented NMOS opcodes | Policy knowledge, not default lowering | Stability/variant risk and explicit opt-in/verification requirements; no general optimization use |

### Machine-State Model

The module gives a source-linked table for:

- A, X, Y, SP, PC, and P; widths and programmer-visible effects;
- N, V, D, I, Z, and C as independently live values;
- reset, IRQ, NMI, BRK, JSR/RTS, RTI, PHP/PLP, and stack byte order;
- little-endian words and address formation;
- page zero, page one, wrap behavior, and indirect pointer fetches;
- decimal-mode assumptions and NMOS/CMOS differences;
- 6510 I/O direction/data port behavior and bank-switch visibility; and
- bus-visible reads/writes, dummy accesses, and read-modify-write sequences when observable to
  MMIO or timing-sensitive hardware.

### Complete Instruction/Addressing Grid

For each official NMOS instruction and addressing form, record:

| Field | Content |
|---|---|
| Legality | NMOS 6502/6510 and W65C02S availability/delta |
| Encoding | Opcode/operand width or authoritative table reference |
| Cycles | Base and conditional page/branch cycles |
| Reads/writes | Memory access count/order and dummy/RMW behavior where material |
| Register effects | Explicit and implicit inputs/outputs |
| Flag effects | Produced, preserved, undefined, or input flags |
| Compiler use | Operations/idioms for which the form is a candidate |
| Hazards | Decimal, page, wrap, self-modifying, MMIO, interrupt, or silicon caveat |

The grid can use compact authoritative tables, but narrative rules must explain implications and
counterexamples. “See datasheet” alone is insufficient for runtime decision knowledge.

### Mandatory Hazard Coverage

- conditional cycle additions for taken/page-crossing branches and indexed reads;
- fixed indexed-store timing versus indexed-read timing;
- NMOS indirect `JMP ($xxFF)` high-byte wrap;
- zero-page indexed and indirect-pointer wrap;
- page-boundary behavior of multi-byte objects and indirect-indexed access;
- `ADC` carry input and `SBC` no-borrow convention;
- decimal-mode arithmetic and interrupt-entry assumptions;
- the pushed status `B` representation versus a physical status bit;
- interrupt sampling/latency assumptions needed by generated handlers;
- RMW bus accesses and why MMIO substitution is not generally safe;
- instructions that do not update flags commonly assumed to change; and
- self-modifying code visibility/ownership constraints when discussed as an optimization.

### W65C02S Delta Matrix

The matrix distinguishes:

- added instructions/addressing forms;
- removed/changed NMOS hazards;
- decimal and interrupt behavior differences;
- timing differences that alter cycle budgets;
- WAI/STP and other system-state implications;
- illegal-on-NMOS forms that target validation must reject for C64; and
- semantics common enough to share versus facts that require selected-CPU dispatch.

It must never imply that Commander X16 or another W65C02 platform is qualified merely because the
CPU delta is known.

## `6502-lowering-casebook.md`

### Case Entry Schema

Each operation family provides a decision table with:

1. Blend65 input semantics and width/signedness;
2. operand location/constant/alias/volatile variants;
3. recognizable source, IL, layout, target, and profile facts;
4. required incoming state (especially carry/decimal/interrupt assumptions);
5. legal candidate sequences;
6. register/flag/memory/clobber effects;
7. bytes plus best/worst or path-specific cycles;
8. compiler disposition and its exact enabling/preventing preconditions;
9. selection rule and whole-program considerations;
10. counterexample showing when a tempting sequence is wrong or worse;
11. helper-call threshold/ABI cost where relevant;
12. any machine-wide target fact or local semantic/timing/risk contract required;
13. deterministic realization obligation for the later compiler audit/redesign; and
14. source and qualification-case keys.

Any entry used as an optimization also names an independent behavior oracle and a separate
assembly/cost expectation. Matching the intended sequence is not proof that the changed machine
program remains correct; differential execution against unoptimized output is supporting evidence
only.

### Technique Realization Boundary

Every expert idiom is assigned exactly one primary disposition before it can guide implementation:

| Disposition | When it applies | Durable compiler result |
|---|---|---|
| Automatic semantics-preserving optimization | Legality and benefit are provable from existing facts for every affected execution | Deterministic rewrite/selection with no user flag |
| Cost-guided selection | Several legal forms trade cycles, code, data, ZP, layout, or helper cost | Deterministic cost model using declared optimization goals and whole-program facts |
| Zero-cost API or specialized lowering | The operation expresses C64 intent or a coordinated subsystem more clearly than generic source patterns | Typed/named operation, compile-time parameters, lowering rule, or link-time template with no hidden work |
| Explicit local contract | Cycle-exact, writable-code, IRQ-ownership, chip-risk, or other non-local assumptions cannot be inferred safely | Narrow source-level annotation/block/API contract validated at the use site |
| Diagnostic or no transformation | Required safety/legality facts are missing or contradictory | Explainable rejection, warning, or preserved general code |

Machine-wide target facts such as selected CPU, PAL/NTSC model, VIC revision policy, and ROM/IRQ
ownership may live in the target profile. Risky or timing-sensitive permission is local unless the
fact truly governs the whole program. There is no generic “game optimization” switch and no blind
recognition of arbitrary loops as hardware tricks.

### Required Operation Inventory

| Family | Required variants |
|---|---|
| Loads/stores/moves | constant, direct, ZP, absolute, indexed, pointer, volatile/MMIO, overlapping source/destination |
| Boolean/control | direct flag branch, short-circuit, materialized `0/1`, inversion/fall-through, long branch, switch choices |
| Equality/unsigned compare | byte/word, constant/variable, branch/value result, lexicographic high/low ordering |
| Signed compare | byte/word, constant/variable, branch/value result, sign-different and same-sign paths, controlled subtract alternatives |
| Addition/subtraction | byte/word/multi-byte, constant, carry chain, wrapping, increment/decrement forms, volatile destination |
| Bit operations | AND/OR/XOR, masks, set/clear/test, BIT applicability, MMIO read/write semantics |
| Shifts/rotates | constant/dynamic count, byte/word, signed right shift, carry propagation, count zero/out-of-range semantics |
| Multiply | constants (0/1/powers/addition chains), variable operands, widths, tables, inline versus helper |
| Divide/modulo | powers of two, signed rounding, variable divisor, zero handling, combined quotient/remainder helper opportunities |
| Negation/absolute | byte/word, minimum signed value, carry/overflow behavior |
| Loops | 0/1/255/256 counts, up/down counters, index-register synergy, nested loops, steady-state/setup/exit costs |
| Calls/returns | leaf/non-leaf, parameter/return homes, register preservation, tail position, helper clobbers, interrupt entry |
| Pointers/addresses | static symbol, constant offset, dynamic index, `(zp),Y`, pointer arithmetic, page/wrap, bank visibility |
| Aggregates/copies | small unrolled, looped copy, table/data placement, overlap, volatile/device destinations, SoA/AoS choice |
| Constants/link-time facts | immediates, low/high symbolic bytes, assembler expressions, no unnecessary runtime materialization |
| Runtime helpers | semantic contract, ABI, reachability/dead stripping, call/setup cost, interrupt/reentrancy safety |

### Game-Relevant Code-Shaping Families

The casebook also covers loop unrolling, page/branch alignment, ZP promotion, lookup tables and
addition chains, pre-shifted/precomputed data, computed dispatch, and self-modifying absolute
operand specialization. Each entry includes code/data/alignment/ZP costs and the workload boundary
where it wins. No family is universally preferred.

Self-modifying code is never a default merely because it is fast in isolation. It requires code in
writable RAM, exclusive or synchronized ownership of the modified bytes, non-reentrant execution
or an explicit concurrency protocol, interrupt-safety proof, code-write visibility for the selected
6502-family target/emulator, and measured benefit over indirect/direct alternatives.
Undocumented opcodes likewise require an explicit selected-silicon contract and never appear in
general C64 output.

### Signed Comparison Correction

The current advice must be explicitly corrected and protected by a negative case:

- `CMP`, `CPX`, and `CPY` produce N/Z/C but do not produce V. Therefore a rule that branches on
  `N xor V` after `CMP` can read stale V and is invalid.
- Valid families include sign-bit normalization where operands permit it, a sign-difference split
  followed by an unsigned comparison for same-sign operands, or a controlled binary `SEC`/`SBC`
  sequence whose V is actually produced. Each has location/clobber/decimal/cost constraints.
- Word signed comparison must reason from the high byte's signed relation and use lower bytes only
  when high bytes are equal; no low-byte carry can repair a wrong signed-high decision.
- Qualification seeds both V states and includes boundary pairs around `-128`, `-1`, `0`, `1`, and
  `127`, preventing a plausible sequence from passing only under a favorable prior flag.

### Volatility and MMIO

The casebook never treats an RMW instruction as an automatic replacement for load/ALU/store on a
device register. It must compare exact bus activity and device side effects. A volatile operation
preserves width, order, count, and identity; common-subexpression elimination, dead-store
elimination, duplicated reads, or reordered acknowledgements are invalid unless the platform
contract explicitly proves equivalence.

### Cost Accounting

Comparisons report more than instruction count:

| Resource | Required accounting |
|---|---|
| Code | opcode/operand bytes, helper body attribution, call sites, jump tables, padding/alignment |
| Data | tables, constants, copied assets, initialization stream, duplicated bytes |
| Fast memory | ZP homes/pairs/scratch and their opportunity cost |
| Frames/stack | static homes, spills, hardware pushes, call/interrupt depth |
| Cycles | setup, steady-state, taken/not-taken, page-cross, success/failure, hot/cold paths |
| State | A/X/Y/flags, banking, decimal and interrupt state, clobber/preservation work |

Whole-program wins may justify a locally equal sequence, but a hidden global cost may not be
omitted to manufacture a win.

## Source Baseline

At minimum, the manifest must pin the MOS MCS6500 Programming Manual, MCS6500 Hardware Manual, WDC
W65C02S datasheet, and exact ACME/VICE sources used to resolve observable behavior. Comparative
compiler material may include LLVM's target-independent code-generator documentation and the
llvm-mos implementation/SDK plus real 6502-family compilers such as Oscar64, KickC, Prog8, and
cc65, labelled as comparative—not normative—evidence.

## Failure Conditions

This component fails if any legal operation family has only a slogan, any sequence lacks a flag or
memory-effect account, timing omits material branch/page variants, C64 output can silently use a
65C02-only form, signed comparison repeats the stale-V defect, or undocumented instructions become
an unqualified default. It also fails if a game technique remains prose without a compiler
disposition, machine-recognizable preconditions, full cost, a counterexample, and proof duties.
