# MOS 6502/6510 Processor Model

Use this reference when a Blend65 decision depends on instruction legality, addressing, flags,
stack or interrupt behavior, bus-visible accesses, or exact NMOS timing. Read
`6502-lowering-casebook.md` as well when choosing a sequence rather than checking a machine fact.

This module is production-depth for the official NMOS 6502 instruction core and the 6510 CPU
delta used by the C64. Its W65C02S content is a portability delta only. It does not qualify a
Commander X16 backend or any other W65C02 platform.

## Authority and notation

The source keys below are defined and version-pinned in `source-manifest.md`:

- `MOS-PGM-1976`: programming model, official instructions, addressing, flags, bytes, and cycles;
- `MOS-HW-1976`: documented reset, interrupt, stack, and bus integration;
- `MOS-6510-1982`: the 6510-compatible core and six-bit on-chip I/O port;
- `WDC-65C02S-2022`: the selected CMOS delta, not C64 behavior;
- `ZAKS-6502-1980`: the bounded published NMOS indirect-`JMP` wrap corroboration;
- `VISUAL6502-RESET-2010`: the transistor-model reset bus trace and stack-pointer effects; and
- `VICE-TEST-EF8E8EFE`: pinned empirical CPU-test source for observable behavior the early MOS
  manuals do not fully specify. Source inspection does not replace a later configured execution
  result.

Grid cells use `opcode/bytes/cycles`. `+p` adds one cycle when effective-address formation crosses
a page. `+t` adds one cycle when a branch is taken; a taken branch adds another `+p` when its
post-operand PC and destination lie on different pages. Hexadecimal opcodes omit `$`. A blank cell
is illegal on the official NMOS 6502/6510. `BRK` is shown as `1+1` bytes because it consumes a
signature/padding byte and stacks `PC+2`, although only `$00` is the opcode.

## Selected-CPU boundary

| Selected core | What this module authorizes | What it forbids |
|---|---|---|
| `nmos6502` | Official NMOS grid and explicitly bounded NMOS behavior | 6510-port assumptions and every CMOS-only form |
| `nmos6510` | NMOS grid plus the `$0000/$0001` port | Treating the port bytes as ordinary RAM; every CMOS-only form |
| `w65c02s` | Shared official forms plus the exact WDC delta below | Projecting CMOS timing, decimal, interrupt, or bus behavior back onto C64 |

Instruction legality is a target fact, not an assembler convenience. If ACME accepts a wider CPU
mode, target validation must still reject a W65C02-only opcode in C64 output. The serializer must
select the target's CPU mode and the post-assembly byte check must agree with that target.

## Programmer-visible state

| State | Width | Meaning and compiler obligation |
|---|---:|---|
| `A` | 8 | Accumulator and implicit operand/result of most arithmetic and logic. Track its exact live value, not merely whether it was recently loaded. |
| `X`, `Y` | 8 each | Index registers. Their value can simultaneously represent source data and enable an addressing form; include transfer/spill cost before claiming that use is free. |
| `S` | 8 | Stack offset within page `$0100`; push writes `$0100+S` then decrements, pull increments then reads. It is not a general unbounded frame pointer. |
| `PC` | 16 | Address of the next opcode/operand fetch. Branches add a signed 8-bit displacement to the PC after the displacement byte. |
| `P` | 8 representation | `N V 1 B D I Z C` in pushed form. Bit 5 is represented high; `B` distinguishes pushed causes and is not a persistent physical latch. |
| address bus | 16 | Wraps modulo 65536. Words are little-endian: low byte at `a`, high byte at `a+1` unless an addressing-mode-specific wrap rule says otherwise. |

The compiler tracks `A`, `X`, `Y`, each live flag, memory effects, and bank/visibility state as
separate resources. A sequence is not equivalent merely because its final scalar value matches.
Stores and `TXS` preserve all arithmetic flags; loads and most register transfers do not.

## Status flags as dataflow

| Flag | Meaning when produced | Important consumers and traps |
|---|---|---|
| `N` | Copy of result bit 7 for the instructions marked `NZ`; `BIT` copies memory bit 7 | Signed reasoning may consume `N` only when the producer is known. `CMP` supplies `N` but not `V`. |
| `V` | Signed two's-complement overflow from binary `ADC`/`SBC`; `BIT` copies memory bit 6 | `CMP`, `CPX`, and `CPY` preserve `V`. Therefore `N xor V` after a compare reads stale `V` and is invalid. |
| `D` | Selects packed-decimal behavior for `ADC`/`SBC` | Ordinary Blend65 arithmetic requires binary mode. NMOS reset/interrupt entry does not provide the W65C02S clear guarantee. |
| `I` | Masks maskable IRQ recognition when set | It does not mask NMI. Timing-sensitive enable/disable sequences require a selected-core interrupt-sampling proof. |
| `Z` | Set when the produced 8-bit result is zero; compare sets it on equality | Stores, jumps, and most flag-control instructions preserve it. Do not assume a store describes the stored value in flags. |
| `C` | Carry out for addition; **no borrow** for subtraction/compare; shifted-out bit for shifts/rotates | Plain addition starts with `CLC`; plain subtraction starts with `SEC`. `INC`/`DEC` and index increments preserve it. |

`ADC` and `SBC` consume the incoming carry. `ROL` and `ROR` also consume it. An optimizer must
either prove the incoming flag or emit the instruction that establishes it. Carry is not ambient
scratch state.

## Addressing modes

| Mode | Effective operand | Program bytes | Timing class and hazards |
|---|---|---:|---|
| implied | No encoded operand | 1 | Normally 2 cycles; stack/control forms have their listed timing. |
| accumulator | `A` | 1 | Shift/rotate `A` in 2 cycles. No memory access beyond instruction fetch. |
| immediate `#n` | Next instruction byte | 2 | 2 cycles. It is data, not an address dereference. |
| zero page `zp` | `$00nn` | 2 | Ordinary read/write is 3 cycles. It consumes scarce page-zero placement. |
| zero page indexed `zp,X/Y` | `$00((nn+index)&$ff)` | 2 | Wraps within zero page; no carry enters the high byte. Ordinary access is 4 cycles. |
| absolute `abs` | 16-bit little-endian operand | 3 | Ordinary read/write is 4 cycles. |
| absolute indexed `abs,X/Y` | `(abs+index)&$ffff` | 3 | Read is 4 `+p`; store is fixed 5; NMOS memory RMW with X is fixed 7. |
| indexed indirect `(zp,X)` | Add X in zero page, then fetch low/high pointer bytes in zero page | 2 | 6 cycles. Both addition and pointer-byte fetch wrap inside zero page. |
| indirect indexed `(zp),Y` | Fetch little-endian base through zero page, then add Y | 2 | Read is 5 `+p`; store is fixed 6. A pointer starting at `$FF` takes its high byte from `$00`. |
| relative `rel` | Signed byte added to PC after operand | 2 | 2 `+t`, and taken adds `+p` when crossing. Legal displacement is `-128..127`. |
| indirect `JMP (abs)` | Fetch destination low/high through the encoded pointer | 3 | 5 cycles on NMOS; pointer `$xxFF` fetches high from `$xx00`, not `$(xx+1)00`. |

Source: `MOS-PGM-1976` Chapters 4–6 and Appendices B–C. The indirect-`JMP` boundary is bounded by
`ZAKS-6502-1980` Chapter 3 p.3-13 and contrasted with `WDC-65C02S-2022` Table 7-1.

## Official NMOS instruction and addressing grid

This is the complete documented NMOS 6502/6510 grid. The following mode columns are used:
`#`, `zp`, `zpX`, `zpY`, `abs`, `absX`, `absY`, `(zpX)`, `(zp)Y`, `A`, `rel`, `ind`, and implied
`impl`.

| Mnemonic | `#` | `zp` | `zpX` | `zpY` | `abs` | `absX` | `absY` | `(zpX)` | `(zp)Y` | `A`/`rel`/`ind`/`impl` |
|---|---|---|---|---|---|---|---|---|---|---|
| `ADC` | `69/2/2` | `65/2/3` | `75/2/4` | — | `6D/3/4` | `7D/3/4+p` | `79/3/4+p` | `61/2/6` | `71/2/5+p` | — |
| `AND` | `29/2/2` | `25/2/3` | `35/2/4` | — | `2D/3/4` | `3D/3/4+p` | `39/3/4+p` | `21/2/6` | `31/2/5+p` | — |
| `ASL` | — | `06/2/5` | `16/2/6` | — | `0E/3/6` | `1E/3/7` | — | — | — | `A:0A/1/2` |
| `BCC` | — | — | — | — | — | — | — | — | — | `rel:90/2/2+t+p` |
| `BCS` | — | — | — | — | — | — | — | — | — | `rel:B0/2/2+t+p` |
| `BEQ` | — | — | — | — | — | — | — | — | — | `rel:F0/2/2+t+p` |
| `BIT` | — | `24/2/3` | — | — | `2C/3/4` | — | — | — | — | — |
| `BMI` | — | — | — | — | — | — | — | — | — | `rel:30/2/2+t+p` |
| `BNE` | — | — | — | — | — | — | — | — | — | `rel:D0/2/2+t+p` |
| `BPL` | — | — | — | — | — | — | — | — | — | `rel:10/2/2+t+p` |
| `BRK` | — | — | — | — | — | — | — | — | — | `impl:00/1+1/7` |
| `BVC` | — | — | — | — | — | — | — | — | — | `rel:50/2/2+t+p` |
| `BVS` | — | — | — | — | — | — | — | — | — | `rel:70/2/2+t+p` |
| `CLC` | — | — | — | — | — | — | — | — | — | `impl:18/1/2` |
| `CLD` | — | — | — | — | — | — | — | — | — | `impl:D8/1/2` |
| `CLI` | — | — | — | — | — | — | — | — | — | `impl:58/1/2` |
| `CLV` | — | — | — | — | — | — | — | — | — | `impl:B8/1/2` |
| `CMP` | `C9/2/2` | `C5/2/3` | `D5/2/4` | — | `CD/3/4` | `DD/3/4+p` | `D9/3/4+p` | `C1/2/6` | `D1/2/5+p` | — |
| `CPX` | `E0/2/2` | `E4/2/3` | — | — | `EC/3/4` | — | — | — | — | — |
| `CPY` | `C0/2/2` | `C4/2/3` | — | — | `CC/3/4` | — | — | — | — | — |
| `DEC` | — | `C6/2/5` | `D6/2/6` | — | `CE/3/6` | `DE/3/7` | — | — | — | — |
| `DEX` | — | — | — | — | — | — | — | — | — | `impl:CA/1/2` |
| `DEY` | — | — | — | — | — | — | — | — | — | `impl:88/1/2` |
| `EOR` | `49/2/2` | `45/2/3` | `55/2/4` | — | `4D/3/4` | `5D/3/4+p` | `59/3/4+p` | `41/2/6` | `51/2/5+p` | — |
| `INC` | — | `E6/2/5` | `F6/2/6` | — | `EE/3/6` | `FE/3/7` | — | — | — | — |
| `INX` | — | — | — | — | — | — | — | — | — | `impl:E8/1/2` |
| `INY` | — | — | — | — | — | — | — | — | — | `impl:C8/1/2` |
| `JMP` | — | — | — | — | `4C/3/3` | — | — | — | — | `ind:6C/3/5` |
| `JSR` | — | — | — | — | `20/3/6` | — | — | — | — | — |
| `LDA` | `A9/2/2` | `A5/2/3` | `B5/2/4` | — | `AD/3/4` | `BD/3/4+p` | `B9/3/4+p` | `A1/2/6` | `B1/2/5+p` | — |
| `LDX` | `A2/2/2` | `A6/2/3` | — | `B6/2/4` | `AE/3/4` | — | `BE/3/4+p` | — | — | — |
| `LDY` | `A0/2/2` | `A4/2/3` | `B4/2/4` | — | `AC/3/4` | `BC/3/4+p` | — | — | — | — |
| `LSR` | — | `46/2/5` | `56/2/6` | — | `4E/3/6` | `5E/3/7` | — | — | — | `A:4A/1/2` |
| `NOP` | — | — | — | — | — | — | — | — | — | `impl:EA/1/2` |
| `ORA` | `09/2/2` | `05/2/3` | `15/2/4` | — | `0D/3/4` | `1D/3/4+p` | `19/3/4+p` | `01/2/6` | `11/2/5+p` | — |
| `PHA` | — | — | — | — | — | — | — | — | — | `impl:48/1/3` |
| `PHP` | — | — | — | — | — | — | — | — | — | `impl:08/1/3` |
| `PLA` | — | — | — | — | — | — | — | — | — | `impl:68/1/4` |
| `PLP` | — | — | — | — | — | — | — | — | — | `impl:28/1/4` |
| `ROL` | — | `26/2/5` | `36/2/6` | — | `2E/3/6` | `3E/3/7` | — | — | — | `A:2A/1/2` |
| `ROR` | — | `66/2/5` | `76/2/6` | — | `6E/3/6` | `7E/3/7` | — | — | — | `A:6A/1/2` |
| `RTI` | — | — | — | — | — | — | — | — | — | `impl:40/1/6` |
| `RTS` | — | — | — | — | — | — | — | — | — | `impl:60/1/6` |
| `SBC` | `E9/2/2` | `E5/2/3` | `F5/2/4` | — | `ED/3/4` | `FD/3/4+p` | `F9/3/4+p` | `E1/2/6` | `F1/2/5+p` | — |
| `SEC` | — | — | — | — | — | — | — | — | — | `impl:38/1/2` |
| `SED` | — | — | — | — | — | — | — | — | — | `impl:F8/1/2` |
| `SEI` | — | — | — | — | — | — | — | — | — | `impl:78/1/2` |
| `STA` | — | `85/2/3` | `95/2/4` | — | `8D/3/4` | `9D/3/5` | `99/3/5` | `81/2/6` | `91/2/6` | — |
| `STX` | — | `86/2/3` | — | `96/2/4` | `8E/3/4` | — | — | — | — | — |
| `STY` | — | `84/2/3` | `94/2/4` | — | `8C/3/4` | — | — | — | — | — |
| `TAX` | — | — | — | — | — | — | — | — | — | `impl:AA/1/2` |
| `TAY` | — | — | — | — | — | — | — | — | — | `impl:A8/1/2` |
| `TSX` | — | — | — | — | — | — | — | — | — | `impl:BA/1/2` |
| `TXA` | — | — | — | — | — | — | — | — | — | `impl:8A/1/2` |
| `TXS` | — | — | — | — | — | — | — | — | — | `impl:9A/1/2` |
| `TYA` | — | — | — | — | — | — | — | — | — | `impl:98/1/2` |

Source: `MOS-PGM-1976` Appendix B instruction tables and Appendix C addressing-time tables. This
table deliberately contains only official NMOS forms; undocumented encodings are not spare
optimization slots.

## Instruction effects

| Family | Inputs | Outputs and flags | Memory/bus class | Compiler use and primary trap |
|---|---|---|---|---|
| `ADC` | `A`, operand, `C`, `D` | `A`; binary produces `N Z C V`; NMOS decimal `N/Z/V` are not portable result flags | read | Establish `C`; ordinary arithmetic must establish `D=0` by ABI or local proof. |
| `SBC` | `A`, operand, `C`, `D` | `A`; binary produces `N Z C V`; `C=1` means no borrow | read | Plain subtraction begins `SEC`; `CMP` is subtraction flags without storing the result but does not produce `V`. |
| `AND/EOR/ORA` | `A`, operand | `A`, `N Z` | read | Mask/combine values. Preserve `C/V`; do not claim they describe the result. |
| `ASL/LSR` | target | target, `N Z C` (`LSR` forces `N=0`) | accumulator or RMW | Signed right shift needs sign injection; `LSR` alone is unsigned. |
| `ROL/ROR` | target, incoming `C` | target, `N Z C` | accumulator or RMW | Multi-byte shifts/rotates require explicit byte order and initial carry. |
| `BIT` | `A`, memory | `Z=(A&M)==0`, `N=M7`, `V=M6` | read | Useful only when all three flag effects are legal. It is not a general non-destructive `AND`. |
| `CMP/CPX/CPY` | register, operand | `N Z C`; preserves `V` | read | Direct unsigned comparison/equality. General signed `N xor V` is invalid because `V` is stale. |
| `INC/DEC/INX/INY/DEX/DEY` | target | target, `N Z`; preserves `C V` | register or RMW | Efficient counters when modular behavior and flag consumers match. |
| `LDA/LDX/LDY` | memory/immediate | register, `N Z` | read | Loading solely to recreate already-live flags is often avoidable; volatile loads cannot be removed or duplicated. |
| `STA/STX/STY` | register | memory; flags preserved | write | A following branch sees earlier flags, not the stored value. Stores to MMIO remain exact in count/order/identity. |
| transfers except `TXS` | source register | destination, `N Z` | internal | Register placement is not free if it destroys useful flags or forces later transfers. |
| `TXS` | `X` | `S`; flags preserved | internal | Changing `S` changes page-one ownership; it is not an ordinary move. |
| branches | one flag | `PC`; flags preserved | control fetches | Final layout decides reach and page cost. Relax out-of-range only after addresses are known. |
| `JMP` | address/vector | `PC`; flags/registers preserved | control reads | NMOS indirect form has the `$xxFF` wrap. |
| `JSR/RTS` | `PC`, `S` | `PC`, `S`; flags preserved | page-one stack | `JSR` pushes address of its last operand byte; `RTS` pulls and adds one. Count 12 cycles plus ABI traffic. |
| `PHA/PHP` | `A` or represented `P`, `S` | stack memory, `S`; flags preserved | page-one write | `PHP` pushes `B=1` and bit 5 high. Stack byte kind and maximum depth remain explicit. |
| `PLA` | stack, `S` | `A`, `N Z`, `S` | page-one read | Pull changes flags; it is not equivalent to a load plus independent stack adjustment. |
| `PLP` | stack, `S` | represented status, `S` | page-one read | Restores live `D/I/C/...`; pushed `B` is not a physical mode bit. |
| `BRK/RTI` | `PC/P/S` | vector or restored `P/PC/S` | stack plus vector | Handler contract owns return, clobbers, and extra stack. `BRK` is not a zero-cost debugger call. |
| flag controls | selected flag | selected flag only | internal | `CLC/SEC`, `CLD/SED`, `CLI/SEI`, and `CLV` preserve unrelated flags. |
| `NOP` | — | architectural state preserved except `PC` | opcode fetch | It still costs one byte/two cycles and can be an intentional timing byte. |

## Bus-visible accesses

On NMOS, memory `ASL`, `LSR`, `ROL`, `ROR`, `INC`, and `DEC` perform one read and two writes at the
effective address: the old value is written before the modified value. W65C02S changes this to two
reads and one write. Indexed reads that cross a page perform an extra access using the uncorrected
high byte before the corrected read; indexed stores use fixed timing and a dummy access even when
no page is crossed. Exact addresses can matter to mapped devices. Source: `WDC-65C02S-2022` Table
7-1, bounded against `MOS-HW-1976` bus timing and `VICE-TEST-EF8E8EFE` where a later proof needs
the exact NMOS access trace.

Consequences:

- Never replace load/ALU/store on MMIO with an RMW opcode from code size alone.
- Never duplicate a volatile read to avoid a spill or erase a repeated device write as redundant.
- Do not use an address whose discarded page-cross access has a different device meaning without
  a selected-machine proof.
- A device contract may explicitly authorize a bus pattern, but ordinary RAM equivalence cannot.

## Reset, interrupt, and stack behavior

| Event | Architectural sequence relevant to the compiler | Fixed CPU cost | Required contract |
|---|---|---:|---|
| reset | After reset entry begins: two pre-stack read cycles; read page one at `$0100+S`, `$0100+((S-1)&$ff)`, and `$0100+((S-2)&$ff)` while decrementing `S` three times; read vector low at `$FFFC`, then high at `$FFFD`; set `I` | 7 CPU cycles from sequencer entry through vector-high read; 3 page-one reads, 0 stack writes | Startup explicitly establishes `S`, `D`, banking, and every relied-on register/memory value. |
| `JSR abs` | Push return address high then low using page one; jump to absolute target | 6 cycles, 2 stack bytes | SFA owns function values; hardware stack budget owns the return bytes and any explicit saves. |
| `RTS` | Pull low/high return address and continue at pulled address plus one | 6 cycles | Balanced call edge and preserved ABI state. |
| IRQ | After qualifying instruction-boundary recognition, push PC high, PC low, represented status with `B=0`; set `I`; fetch `$FFFE/$FFFF` | 7 CPU cycles, 3 stack bytes before handler | Selected sink, source acknowledgement, D policy, register saves, SFA concurrency domain, and return/chaining behavior. |
| NMI | Edge-triggered entry using `$FFFA/$FFFB`; same three CPU stack bytes | 7 CPU cycles before handler | NMI nesting/priority and shared-state policy are distinct from IRQ. |
| `BRK` | Consume signature byte, push `PC+2` high/low and represented status with `B=1`; set `I`; fetch shared IRQ/BRK vector | 7 CPU cycles, 3 stack bytes before handler | Exact platform handler decides whether/where it returns. Blend65's bound form emits `$00 $EA`. |
| `RTI` | Pull represented status, then PC low/high | 6 cycles | Returns only from a compatible interrupt frame; handler must balance extra saves first. |

The reset row is the NMOS `nmos6502`/`nmos6510` contract. The two leading read addresses reflect
the CPU's state when reset entry begins and are not useful initialized-language state. The three
would-be interrupt pushes are suppressed into reads, but their post-decrements still occur, so the
architectural result is `S_after = (S_before - 3) & $ff`. In the Visual6502 power-up trace,
`S_before=$00`, the page-one reads are `$0100`, `$01ff`, and `$01fe`, and `S_after=$fd`; a warm
reset instead decrements the incoming stack pointer. The first opcode fetch at the vector target is
the next cycle and is not part of the seven-cycle entry. Reset assertion duration and any work
needed to reach sequencer entry are outside that fixed count. Source: `MOS-HW-1976`, reset timing
and system-initialization sections; `VISUAL6502-RESET-2010`, “RESET,” trace cycles 1–8. The
W65C02S decimal-reset difference remains separately selected below; no CMOS reset detail is
projected onto the C64.

`B` exists in the pushed representation, not as a stable P-register latch. `PHP` also pushes it as
one. An IRQ/NMI copy has it clear. Handler code may inspect the stacked copy to distinguish `BRK`
from hardware entry, subject to platform interposition.

Interrupt recognition is instruction-boundary and selected-core behavior. IRQ is level-sensitive;
NMI is edge-sensitive. NMOS timing around changes to `I`, simultaneous `BRK`/interrupt entry, DMA
stalling, and the exact discarded bus accesses is not safe to infer from mnemonic-level semantics.
A cycle-exact local contract must name the exact instruction stream, selected core, and evidence.
General lowering may assume only the platform ABI's interrupt entry/exit contract.

## Decimal behavior

`D=1` changes `ADC` and `SBC` to packed BCD adjustment. MOS defines carry/no-borrow sequencing for
multi-byte decimal arithmetic, but on NMOS the post-decimal `N`, `Z`, and `V` values are not a
portable mathematical description of the adjusted result. W65C02S makes those flags valid and adds
a cycle. W65C02S also clears `D` after reset and interrupt entry; NMOS does not supply that guarantee.
Source: `MOS-PGM-1976` §§2.2.1.2, 2.2.2, 3.3; `WDC-65C02S-2022` Table 7-1.

Blend65 consequences:

- ordinary `+`, `-`, comparisons, multiply, and division are binary;
- an IRQ body that may preempt explicit BCD code establishes `CLD` before binary arithmetic while
  preserving/restoring the interrupted status as its sink contract requires;
- explicit BCD operations own `D` and carry as effects and may not leak their mode into unrelated
  code; and
- runtime-invalid BCD digits follow the exact selected-hardware contract. The compiler does not
  invent a portable result or silently inject a checker.

## Page and wrap hazards

| Boundary | Exact behavior | Allocation/lowering rule |
|---|---|---|
| zero-page indexed | Low-byte addition wraps in `$0000..$00FF` | Prove wrap is intended or use a non-wrapping address form. |
| `(zp,X)` pointer | Indexed pointer location and high-byte fetch wrap in zero page | A two-byte pointer placement may not straddle `$FF/$00` unless that alias is deliberate. |
| `(zp),Y` pointer | Base high byte for pointer at `$FF` is fetched from `$00`; effective base+Y is 16-bit | Allocate ordinary pointer pairs at `$00..$FE`. Account for read `+p` and fixed store timing. |
| absolute indexed read | Effective address is correct modulo 65536; crossing costs `+1` and has a dummy access | Keep best/worst cycles unless placement proves the page relation. |
| relative branch | Signed displacement from PC after operand, only `-128..127` | Final layout owns validation and branch-over-`JMP` repair. |
| `JMP ($xxFF)` | NMOS high-byte fetch wraps within page | Reject that vector placement or deliberately model it. W65C02S does not wrap and costs one more cycle. |
| multi-byte object | Each byte uses its own address; no atomic multi-byte access exists | Prove page/bank visibility for all bytes and interrupt coherence where shared. |

### Indirect jump page wrap

For `JMP ($xxFF)` on NMOS, the destination low byte comes from `$xxFF` and the high byte comes
from `$xx00`. It does not come from `$(xx+1)00`. Ordinary generated vectors must avoid this
placement; a deliberate use must model the wrapped destination explicitly. W65C02S increments the
pointer page correctly and therefore requires a different selected-CPU result.

## 6510 delta

The C64's 6510 instruction core uses the official NMOS grid above. Its compiler-visible CPU delta
is a six-bit I/O port whose direction register is addressed at `$0000` and data register at `$0001`.
For an output-configured bit the port latch drives the pin; an input-configured bit reads external
pin state subject to the device's electrical behavior. Only bits 0–5 belong to the documented port.
Source: `MOS-6510-1982`, “FUNCTIONAL DESCRIPTION” and “INPUT/OUTPUT PORT REGISTERS.”

On a C64 these bits participate in memory banking. Therefore:

- `$0000/$0001` are volatile platform registers, not allocatable ZP homes;
- a store to either address changes a machine resource and cannot be deleted, reordered, combined,
  or represented as an ordinary frame spill;
- the platform model, not the CPU core, decides which ROM, RAM, or I/O becomes CPU-visible; and
- bank changes require effect and restoration contracts across calls, interrupts, and data access.

Detailed C64 mapping remains in `c64-memory-and-runtime.md`; this section only owns the CPU port.

## W65C02S delta

The following delta is authoritative for selected `w65c02s` reasoning and only a rejection matrix
for the C64 target. Source: `WDC-65C02S-2022` §§4–7, especially Tables 5-1, 5-2, 6-4, and 7-1.

| Delta family | W65C02S behavior | NMOS/C64 consequence |
|---|---|---|
| new direct instructions | `BRA`, `PHX/PHY`, `PLX/PLY`, `STZ`, `TRB/TSB`, `RMB0..7`, `SMB0..7`, `BBR0..7`, `BBS0..7`, `WAI`, `STP` | Illegal in general C64 output. A serializer accepting the token does not make the byte executable by policy. |
| accumulator increment/decrement | `INC A` and `DEC A` | Use register or load/RMW/store NMOS sequences instead. |
| zero-page indirect | `(zp)` added to `ADC`, `AND`, `CMP`, `EOR`, `LDA`, `ORA`, `SBC`, and `STA` | NMOS must use a legal direct, `(zp,X)`, or `(zp),Y` form. |
| expanded `BIT` | immediate, `zp,X`, and `abs,X` forms | NMOS has only `zp` and `abs`; immediate `BIT` also has variant-specific flag implications. |
| indexed indirect jump | `JMP (abs,X)` | Not available on C64. |
| indirect-`JMP` boundary | `$xxFF` increments page correctly and takes one additional cycle versus NMOS form | Never project this fix onto 6510. |
| indexed page-cross bus read | Extra read is of the final instruction byte rather than the NMOS invalid effective address | MMIO/bus proof is selected-core-specific. |
| memory RMW bus pattern | Two reads and one write | NMOS uses one read and two writes. Device equivalence does not transfer. |
| indexed absolute RMW timing | Fixed six cycles where NMOS uses seven | Keep cost tables CPU-dispatched. |
| decimal reset/interrupt | `D` clears on reset and interrupt entry | NMOS ABI must establish binary mode itself. |
| decimal result flags | Valid `N/V/Z`, with an additional cycle | NMOS decimal flags cannot be used as if they were the CMOS contract. |
| invalid opcodes | WDC classifies reserved encodings as specific NOP lengths/cycles | NMOS undocumented behavior remains undefined/risky and cannot inherit this NOP contract. |
| `WAI` | Waits for interrupt and interacts with `RDY` | System integration is platform-specific; knowing the opcode does not qualify an X16 sleep API. |
| `STP` | Stops the processor until reset | Requires explicit platform/system intent; never a generic return lowering. |
| interrupt during `BRK` fetch | W65C02S executes `BRK` and then the interrupt; NMOS can load the interrupt vector while losing the BRK cause | Exact simultaneous-event proofs cannot be shared across variants. |

The W65C02S adds capabilities, not a license to use a family superset. Each target declares one
processor, and instruction selection, validation, costing, serialization, and executable evidence
all dispatch through that identity.

## Undocumented NMOS opcode policy

Undocumented encodings are not part of automatic Blend65 lowering. Their behavior can vary across
NMOS/CMOS implementations, masks, integrated variants, and emulators; some combinations jam until
reset. A general `--fast` or “game” flag is insufficient permission.

A future local opt-in may authorize one exact opcode only when it records:

1. selected physical silicon and excluded variants;
2. opcode bytes, addressing form, complete register/flag/memory/bus behavior;
3. code/data/timing benefit over the best official sequence;
4. interrupt, banking, and device-safety preconditions;
5. emulator configuration plus targeted real-hardware proof; and
6. a legal official-opcode fallback or a compile-time rejection outside that contract.

W65C02S reserved-NOP behavior never proves NMOS undocumented behavior, and VICE agreement alone
does not prove every physical 6510 revision.

## CPU review rules

Reject a generated sequence when any answer is unknown:

- Is every opcode/addressing form legal for the selected core?
- What exact value and location does each instruction consume and produce?
- Which of `N/V/D/I/Z/C` are consumed, produced, preserved, or no longer live?
- What memory addresses are read and written, including dummy and RMW accesses?
- What are bytes and each path's cycles, including branch/page conditions?
- Does a ZP pair, relative branch, indirect vector, multi-byte object, or stack path cross a special
  boundary?
- Can an interrupt observe temporary state or reuse a non-reentrant SFA/helper resource?
- Is banking/visibility a platform fact rather than a CPU assumption?
- Is a tempting CMOS or undocumented shortcut being projected onto the NMOS 6510?

The focused CPU cases are `Q-C01..Q-C13` and `Q-C17`; the remaining `Q-C` cases combine these
machine facts with the lowering decisions in `6502-lowering-casebook.md`.
