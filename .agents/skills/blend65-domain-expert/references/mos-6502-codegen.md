# MOS 6502/6510 Code Generation

Use this reference for instruction selection, register/flag reasoning, allocation, byte/cycle
analysis, and CPU legality. The C64 uses the NMOS 6510: for compiler purposes its instruction core
is the NMOS 6502 plus the on-chip I/O port at `$0000`/`$0001`. Do not silently use 65C02
instructions or semantics on this target.

## Machine model that must remain visible

- `A`, `X`, and `Y` are 8-bit registers. The hardware stack pointer is 8-bit and addresses page
  `$0100`; the program counter is 16-bit.
- Status flags are scarce dataflow resources: negative (`N`), overflow (`V`), decimal (`D`),
  interrupt-disable (`I`), zero (`Z`), and carry (`C`). Treat every instruction's flag effects as
  part of its result.
- The address space is 64 KiB, but platform banking can change what the CPU or a device observes at
  an address.
- Zero-page addressing is shorter and usually faster. Zero-page bytes are registers backed by
  memory, not a generic spill area with zero cost.
- Indexed reads may gain a cycle on page crossing. Indexed stores have their documented fixed
  timing. Report best/worst timing when the address can cross a page.
- Relative branches have limited reach. A taken branch costs more than a non-taken branch and gains
  another cycle on a page crossing.

## Cost landmarks

Use the selected CPU's opcode table for final numbers. These NMOS 6502 landmarks catch most bad
instruction choices:

| Form | Bytes | Base cycles | Important condition |
|---|---:|---:|---|
| immediate ALU/load | 2 | 2 | no memory read beyond operand |
| zero-page load/store | 2 | 3 | consumes scarce zero page |
| absolute load/store | 3 | 4 | fixed address |
| absolute indexed load | 3 | 4 | `+1` on page crossing |
| absolute indexed store | 3 | 5 | no page-cross discount |
| `(zp,X)` load/store | 2 | 6 | pointer table in zero page |
| `(zp),Y` load | 2 | 5 | `+1` on page crossing |
| `(zp),Y` store | 2 | 6 | pointer in zero page |
| relative branch | 2 | 2 | `+1` taken, another `+1` if page crossed |
| `JMP abs` / `JSR` / `RTS` | 3/3/1 | 3/6/6 | call cost excludes parameter traffic |
| register transfer | 1 | 2 | flags vary by instruction |
| `PHA` / `PLA` | 1/1 | 3/4 | stack traffic and flag effects matter |

Do not compare only instruction counts. A two-instruction sequence may be slower, larger, or use
scarcer state than three carefully chosen instructions.

## Flag semantics that commonly cause miscompiles

- `ADC` consumes carry as an input and produces carry/overflow. Clear or deliberately preserve
  carry before addition according to the language operation.
- `SBC` uses carry as "no borrow." A normal subtraction starts with carry set.
- `CMP`/`CPX`/`CPY` set carry for unsigned greater-than-or-equal and zero for equality. After
  comparing any byte with zero, unsigned carry alone cannot detect a wrapped countdown exit.
- Signed comparisons require reasoning about `N xor V`, not just `N` or `C`.
- Increment/decrement instructions do not update carry. Shifts and rotates do.
- Loads and transfers usually update `N`/`Z`; stores do not. Never reuse flags across an
  intervening clobber because the emitted text looks adjacent in one example.
- Decimal mode changes `ADC`/`SBC`. On NMOS 6502-family interrupt entry, do not assume decimal mode
  is cleared as it is on later CMOS variants. The ABI must define decimal-mode expectations.

## Addressing and silicon hazards

- Indirect indexed addressing uses a zero-page pointer. Account for both pointer bytes and their
  lifetime.
- Zero-page indexed and indirect pointer fetches wrap within zero page; do not accidentally treat
  them as ordinary 16-bit address arithmetic.
- NMOS `JMP ($xxFF)` fetches the high byte through the page-wrap hardware behavior. Avoid or use it
  only deliberately.
- Read-modify-write instructions have observable bus writes. Treat them cautiously on MMIO.
- Undocumented opcodes are target- and silicon-dependent. Emit them only behind an explicit target
  contract and dedicated verification; never as a general C64 optimization default.
- ACME can choose zero-page or absolute encoding from expression knowledge. Inspect assembled
  bytes, not just source text, when addressing width affects correctness or timing.

Primary references: the MOS Technology
[MCS6500 Programming Manual](https://www.bitsavers.org/components/mosTechnology/6500-50A_MCS6500pgmManJan76.pdf),
the companion [MCS6500 Hardware Manual](https://www.bitsavers.org/components/mosTechnology/6500-10A_MCS6500hwMan_Jan76.pdf),
and ACME's official [addressing-mode documentation](https://github.com/meonwax/acme/blob/master/docs/AddrModes.txt).

## Expert lowering idioms

### Conditions and booleans

- Branch directly on flags when a comparison feeds control flow.
- Invert the branch or swap successor layout to obtain fall-through; do not materialize a boolean
  solely to test it immediately.
- Materialize `0`/`1` only when the value escapes into storage, an argument, or a later expression.

### Loops

- A full 256-iteration byte loop normally uses wraparound deliberately, such as increment plus
  `BNE`, rather than comparing against an unrepresentable exclusive bound.
- A countdown through zero must exit using the post-decrement value or an equality condition that
  actually observes zero; unsigned carry after `CMP #0` cannot express the exit.
- Keep loop counters in `X` or `Y` when that simultaneously enables indexed addressing and does
  not create more transfer/spill cost than it saves.
- Evaluate steady-state path cycles separately from setup and exit.

### Multi-byte arithmetic

- Process addition low byte first with `CLC`/`ADC`, then propagate carry through higher bytes.
- Process subtraction low byte first with `SEC`/`SBC`, then propagate the no-borrow carry.
- Preserve comparison semantics across widths; equality can combine byte differences, while
  relational comparisons need correct high-byte and signedness handling.
- Keep word values in a documented register pair only while its clobber and call rules remain
  explicit. Otherwise use named homes, not implicit translator state.

### Constants, shifts, multiply, and divide

- Emit immediates or assembler-resolved symbolic expressions for link-time facts.
- Replace multiplication/division by powers of two with shifts or byte selection when signedness,
  rounding, and overflow match the language.
- Consider addition chains, tables, or specialized routines for other constants; compare total
  bytes and cycles including setup and call overhead.
- Do not call a general runtime arithmetic helper for an expression the compiler or assembler can
  resolve exactly.

### Data and pointers

- Prefer absolute or absolute-indexed access for statically placed objects.
- Use `(zp),Y` when the base is genuinely dynamic or when object size/page behavior requires it.
- Change a pointer or hardware base register instead of copying a screen, sprite, character set, or
  table solely to put it where a consumer can see it.
- Choose array-of-structs or struct-of-arrays from actual access patterns. On an 8-bit CPU, separate
  byte arrays often improve indexed hot paths, while records may improve ownership and cold-path
  clarity. The language should express both.

## Generated-code review checklist

- Are loads, stores, transfers, and spills necessary for the live value path?
- Are flags reused safely, or repeatedly materialized and recomputed?
- Did a direct or symbolic address become a runtime pointer or helper call?
- Does zero-page allocation save more than its setup, preservation, and scarcity cost?
- Are volatile reads/writes exact in width, order, and count?
- Are page crossings, branch direction, and taken-path frequency reflected in cycle totals?
- Are call/return, parameter homing, runtime helpers, padding, and data copies included?
- Does the sequence remain legal and semantically identical on the selected CPU variant?
