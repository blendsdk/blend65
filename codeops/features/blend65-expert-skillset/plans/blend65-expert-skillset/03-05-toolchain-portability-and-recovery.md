# Component Specification: Toolchain, Portability, and Recovery Knowledge

> **Document**: 03-05-toolchain-portability-and-recovery.md
> **Parent**: [Index](00-index.md)
> **Owns**: `acme-and-artifacts.md`, `target-portability.md`, `evidence-parity-and-recovery.md`

## Objective

Teach the agent how emitted machine intent becomes a verified target artifact, how to keep a
shared 6502-family compiler modular without pretending all platforms are alike, and how to perform
the later Blend65 recovery audit without preserving complexity merely because it already exists.

## `acme-and-artifacts.md`

### Qualified Tool Baseline

The v1.0.0 knowledge and probes pin the locally accepted baseline:

| Tool | Version/model | Authority |
|---|---|---|
| ACME | 0.97 “Zem”, 2021-01-31 | Official release/repository documentation plus executable probes |
| VICE | `x64sc` 3.10 | VICE 3.10 manual/source plus executable monitor/runtime probes |
| Target artifact | C64 PRG | Commodore format/startup sources plus assembled-byte inspection |

If execution discovers the repository intentionally targets another exact ACME build, that is
material evidence: stop, add a runtime ambiguity, and reconcile the required baseline rather than
silently changing it.

### ACME Knowledge Coverage

| Concern | Required content |
|---|---|
| CPU selection | NMOS/6510/65C02 mode directives and illegal-form rejection expectations |
| Literals/expressions | Radices, unary/binary precedence, width/value behavior, low/high byte operators, parentheses |
| Symbols | Global/local/anonymous labels, forward references, scopes/zones, equates, redefinition rules |
| Addressing | Immediate/ZP/absolute/indexed/indirect syntax, automatic encoding choice, force-width controls, boundary cases |
| Branches | Relative range diagnostics, source versus assembled displacement, relaxation ownership in Blend65 |
| Placement | PC/origin, segments/pseudopc if used, alignment semantics, fill/skip behavior, overlap risks |
| Data/include | Byte/word/text/binary directives, encoding interaction, file path/version boundary |
| Output | PRG versus raw output flags/directives, report/symbol/label artifacts, error behavior |
| Inspection | Compare source intent, listing/report, labels, and actual binary bytes; never infer encoding from emitted text alone |

### Mandatory Executable Probes

Small temporary inputs—never a new permanent framework—pin:

1. expression precedence and low/high symbolic-byte results;
2. ZP versus absolute addressing selection at value and symbol boundaries;
3. forced-width behavior where supported;
4. forward/local/anonymous symbol resolution;
5. in-range and out-of-range relative branches;
6. origin and alignment output bytes;
7. data/text/binary directive behavior actually used by Blend65;
8. PRG two-byte load address and body origin agreement; and
9. a VICE-observable program proving the assembled artifact executes at the declared address.

Each probe records source, exact command, tool version, expected bytes/diagnostic, observed result,
and the knowledge section it validates. Shell input is fixed repository-owned text; no external
content is executed.

### Emitter Boundary

The skill distinguishes:

- machine representation: opcode, operand, label, data, origin/placement intent;
- ACME serialization: textual syntax and directives;
- assembler behavior: encoded bytes, resolution, diagnostics, reports;
- packaging: PRG header/container and target loader contract; and
- execution: CPU/device-visible behavior under a fixed model.

An ACME expression is not a substitute for lost compiler semantics, and a valid `.asm` file is not
proof of a valid PRG or correct C64 execution.

## `target-portability.md`

### Composition Model

The module teaches one shared 6502-family compiler composed with selected definitions:

```text
target-neutral semantics/IR
    ↓
shared 6502-family legalization + selection responsibilities
    + selected CPU model
    + selected platform memory/device/runtime model
    + selected assembler serializer
    + selected artifact packager
```

This is a responsibility model, not a prescribed set of classes. A copied backend per machine is
rejected by default; so is a single “platform” object that obscures whether a rule belongs to CPU,
machine, serializer, or container.

### Constraint Matrix

The runtime module includes a compact matrix with at least these fields:

| Field | C64 | C64U | C128 | X16 | Atari 8-bit | Atari 7800 |
|---|---|---|---|---|---|---|
| Qualification status | Production | Constraint only | Constraint only | Constraint only | Constraint only | Constraint only |
| CPU family/variant | NMOS 6510 | C64-compatible core plus extensions as selected | 8502/C64-mode considerations | W65C02 | NMOS 6502-family | 6502C-family |
| Address/banking model | Concrete C64 | Must preserve C64 base plus enhanced resources | Multiple modes/banks | Banked RAM + VERA | OS/banked/cart variants | Scarce RAM + cartridge/ROM |
| Video/audio/input owner | VIC-II/SID/CIA | C64 compatibility plus extensions | VIC-II/VDC/etc. | VERA/PSG/etc. | ANTIC/GTIA/POKEY/PIA | MARIA/TIA/RIOT/etc. |
| Startup/runtime | Qualified C64 patterns | To research/qualify | To research/qualify | To research/qualify | To research/qualify | To research/qualify |
| Artifact | PRG qualified | Constraint only | Constraint only | Constraint only | XEX/cart variants | A78/cart variants |
| Key seam pressure | Banking/timing/MMIO | acceleration/expansion | dual-mode/CPU/device | CPU delta/banking/device | display-list/OS/ZP | ROM layout/timing/RAM |

Exact facts in non-C64 columns are conservative signposts backed by authoritative sources or marked
unknown. They prevent C64-specific assumptions from entering shared stages; they do not provide
production guidance for those machines.

### Portability Decision Rules

- Put instruction legality/timing in the CPU model.
- Put memory visibility, devices, reserved regions, clocks, and runtime ownership in the platform
  model.
- Put syntax and expression rules in the assembler serializer.
- Put headers/load records/cartridge layout in the packager.
- Keep language meaning and target-neutral optimization independent of all four.
- Add a shared abstraction only when at least two qualified consumers share semantics—not merely
  similarly named hooks.
- A placeholder plugin delegating C64 behavior is classified as scaffold, never target support.

## `evidence-parity-and-recovery.md`

### Evidence Ladder

| Level | What it can prove | What it cannot prove alone |
|---|---|---|
| Source/shape inspection | Presence, control/data path, obvious stub/delegation | Runtime correctness or completeness |
| Focused stage test | Behavior at parser/semantic/SFA/IL/machine boundary | Downstream assembly/runtime behavior |
| Emitted assembly | Selected symbolic instructions and structure | Actual encodings, container, hardware result |
| Assembled bytes/reports | Encoding, placement, symbols, size | Device behavior and timing under a machine model |
| VICE 3.10 observation | Primary automated evidence for declared model behavior and measurable paths | Universal silicon/revision behavior; use `VICE-verified / hardware-unverified` where physical QA is still required |
| Physical hardware/revision measurement | Targeted evidence for silicon/analog/revision-sensitive behavior on that unit/configuration | Universal behavior without a justified generalization |
| Expert equivalent-work comparison | Local parity and cost cause | Language expressibility outside the compiled corpus |

### Capability Status

Use only `Verified complete`, `Verified partial`, `Scaffold/stub`, `Incorrect`, or `Unknown`.
Evidence must cover the full named contract. A parser accepting syntax cannot make code generation
complete; a green golden cannot prove hardware behavior; a skipped VICE suite is not a runtime
pass.

### Equivalent-Work Parity

Before comparing generated and hand-written forms, equalize:

- source semantics, inputs, outputs, side effects, error/wrap behavior;
- memory placement, initial hardware state, bank state, and interrupt assumptions;
- ABI, calling, preservation, reentrancy, startup, and return obligations;
- data/tables/runtime helpers and attribution policy; and
- hot/cold path and page/bus timing conditions.

Report generated and expert costs separately for code, data, padding, ZP, static frames, hardware
stack, scratch, and path cycles. Local parity ratio `<= 1.0` is the floor; whole-program compiler
wins come from global allocation, propagation, layout, consistency, dead stripping, and exhaustive
optimization. If the generated routine only meets, record the concrete gap/path to a future win as
authorized project debt during implementation work.

### Expressiveness

A useful program that cannot be expressed has no finite parity ratio. Record the missing modern
source capability and forced hardware-lore workaround in the expressiveness ledger during the
later recovery audit. Do not hide it by benchmarking only programs that compile.

### Recovery Audit Record

For each compiler segment/capability, collect:

| Field | Required evidence |
|---|---|
| Knowledge lineage | Active skill version, exact content commit, `referencePath#heading`, source keys, and a claim key only when the heading contains multiple independent rules |
| Contract | Reconciled frozen spec, explicit product/API decision, or current requested program behavior; never existing compiler behavior or a feasibility snapshot |
| Live path | Files/functions/data transformations with line evidence |
| Tests | Positive/boundary/negative and exact tier actually executed |
| Artifact/runtime | Assembly, bytes, symbols, VICE/hardware observation as applicable |
| Status | Five-class result with explicit boundary |
| Complexity | Mechanisms, consumers, maintenance/verification burden, duplication |
| Salvage | Keep, simplify, rewrite, or delete—with dependency/evidence reason |
| Next proof | Smallest decisive test or implementation action |

When a later qualified skill version changes a rule, follow only recorded lineage and classify each
dependent conclusion as `unaffected`, `revalidated`, `corrected`, or `invalidated/reopened`. Do not
re-audit unrelated work and do not create a claim registry or service.

### Salvage Rule

Keep a component only when it has a necessary current responsibility, a comprehensible boundary,
correct evidence, and lower recovery cost than replacement. Simplify when the responsibility is
valid but mechanism exceeds current consumers. Rewrite when the contract is useful but the design
blocks correctness/modularity/parity. Delete when it is unused, duplicative, speculative, or
costlier to prove than rebuild. Sunk implementation effort is not evidence.

### Harness-Value Test

A readiness/workflow artifact earns its cost only if it catches a named material failure that a
smaller stage test, representative compiled program, assembly assertion, or VICE assertion cannot
catch; has a real decision consumer; and replaces or consolidates other proof. Otherwise remove or
decline it during recovery. The skill does not prescribe a replacement meta-harness.

## Failure Conditions

This component fails if assembly text is treated as bytes, current local tool behavior is
generalized without version pinning, future target scaffolds are called complete, portability
collapses all target concerns into one object, parity compares unequal obligations, or recovery
preserves machinery because of sunk cost or roadmap status. The optional game-feasibility snapshot
is never recovery authority or an audit-scope source.
