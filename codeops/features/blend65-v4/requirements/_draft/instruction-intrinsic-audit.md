# Draft: Blend65 v4 Instruction-Intrinsic Audit

> **Status**: Approved decision evidence for AR-006; not yet a requirement
> **Target**: C64 `nmos6510` production baseline
> **Authority**: MOS official NMOS grid through the active expert baseline; current spec behavior is
> audit evidence and does not force v4 preservation

## Admission rule

An `asm_*` source intrinsic is admitted only when all of the following are true:

1. A demonstrated C64 game-development need cannot be expressed by ordinary Blend65 or a zero-cost
   named platform API.
2. Typed inputs, typed results, evaluation order, and every register, flag, stack, memory, bus, and
   control-flow effect are complete.
3. Separate calls do not communicate through hidden A, X, Y, or flag state.
4. Source does not calculate branch displacements, name assembler-local labels, select addressing
   modes, or take ownership of compiler/SFA storage.
5. The selected CPU authorizes the exact instruction and behavior.
6. Semantic analysis, SFA, lowering, optimization, emission, and cost reporting can preserve and
   verify the contract independently.
7. A name promising one instruction emits exactly that instruction. An operation requiring setup,
   result recovery, or several instructions uses an ordinary semantic or platform API name.

The machine representation and emitter still support the complete legal selected-CPU instruction
set. This audit limits source exposure, not backend capability.

## Complete official NMOS family classification

Every one of the 56 documented NMOS mnemonics appears below exactly once.

| Classification | Mnemonics | Reason |
|---|---|---|
| Retain as source intrinsics | `CLI`, `SEI`, `NOP`, `PHP`, `PLP` | These express exact standalone interrupt/timing/status-save effects without borrowing a compiler-owned data register. `PHP`/`PLP` remain a kind-balanced pair charged to the hardware-stack proof. |
| Ordinary Blend65 operations; instruction selector chooses the form | `ADC`, `SBC`, `AND`, `EOR`, `ORA`, `ASL`, `LSR`, `ROL`, `ROR`, `BIT`, `CMP`, `CPX`, `CPY`, `DEC`, `DEX`, `DEY`, `INC`, `INX`, `INY`, `LDA`, `LDX`, `LDY`, `STA`, `STX`, `STY`, `TAX`, `TAY`, `TXA`, `TYA` | Source values, expressions, comparisons, shifts/rotates, assignments, and volatile operations own the semantics. Exposing registers or addressing modes would constrain allocation and often add setup/recovery instructions, so an `asm_*` name would not promise the real emitted cost. A missing useful source operation is designed as a typed semantic operation rather than an opcode call. |
| Backend control-flow only | `BCC`, `BCS`, `BEQ`, `BMI`, `BNE`, `BPL`, `BVC`, `BVS`, `JMP`, `JSR`, `RTS`, `RTI` | Structured source control flow and calls own labels, successors, SFA call edges, interrupt entry/exit, branch repair, and final layout. Raw source forms would bypass those proofs. |
| Backend ABI/stack only | `PHA`, `PLA`, `TSX` | `A`, the hardware stack pointer, and compiler-generated save/restore traffic are backend resources. Parameterless `PHA`/`PLA` have no stable source value because A is compiler-owned. Typed push/pull or stack queries would be different semantic features and require independent need. |
| Backend flag/mode establishment only | `CLC`, `SEC`, `CLD`, `SED`, `CLV` | Carry/overflow are not standalone Blend65 values. Arithmetic, compare, shift/rotate, BCD operations, startup, and interrupt ABIs establish the flags/mode they consume. Raw decimal regions have no admitted raw `ADC`/`SBC` consumer and can corrupt ordinary binary semantics. |
| Prohibited source operation | `TXS` | Arbitrary replacement of the hardware stack pointer violates return-address, interrupt-frame, explicit-stack, and whole-program stack ownership. |
| Profile-bound future semantic operation; absent from initial C64 surface | `BRK` | Stock C64 has no qualified generic returning BRK/debug service. Any later operation requires an exact selected-profile vector, handler, return, clobber, machine-effect, and stack-peak contract. It must not imply a runtime or debugger. |

## Audit of the existing thirteen

| Existing intrinsic | Recommendation | Decisive reason |
|---|---|---|
| `asm_sei()` / `asm_cli()` | Retain | Exact explicit IRQ-mask control is meaningful independently of register allocation. NMI remains unaffected and the interrupt-state effect stays ordered. |
| `asm_php()` / `asm_plp()` | Retain as a matched kind | Provides exact save/restore of prior processor status for a critical region. Static kind/depth analysis prevents consuming return, interrupt, ABI, or caller stack bytes. |
| `asm_nop()` | Retain | Exact one-byte/two-cycle padding is a legitimate timing operation. It is never removed or reordered. |
| `asm_pha()` / `asm_pla()` | Remove from v4 source | The source call neither supplies nor receives A. Its value would depend on a temporary register-allocation decision, so it has no stable language meaning. Compiler-generated accumulator preservation remains legal backend work. |
| `asm_clc()` / `asm_sec()` / `asm_clv()` | Remove from v4 source | There is no admitted following raw flag-consuming operation or source-visible flag value. Each useful operation must own the flags it consumes. |
| `asm_cld()` / `asm_sed()` | Remove from v4 source | Ordinary arithmetic must remain binary; `bcd_add`/`bcd_sub` own decimal mode internally. A raw decimal region without raw ADC/SBC has no useful complete source contract. |
| `asm_brk()` | Remove from the initial C64 source surface | Every baseline target currently rejects reachable BRK because it lacks an exact handler contract. A future profile-bound semantic operation may reopen it without injecting runtime code. |

## Parameterized opcode-shaped calls

The audit admits no parameterized `asm_<instruction>(...)` operation initially:

- `asm_lda(value); asm_adc(other); asm_sta(address)` would communicate through hidden A and C and
  would make correctness depend on whether the compiler inserted a move or reload between calls.
- `asm_sta(address, value)` cannot generally be exactly one instruction because the value must first
  reach a register; ordinary assignment, `poke`, or named volatile registers already own this job.
- `asm_beq(target)` would expose compiler-owned CFG labels and final branch range/layout.
- `asm_inc(value)` duplicates `value += 1`; the selector should choose `INC`, `INX`, or another
  expert sequence from placement and liveness facts.
- A C64 read-modify-write device trick should be a named zero-cost device operation, such as an IRQ
  acknowledgement API, with the exact bus behavior in its platform contract. It should not make a
  modern developer select a misleading generic opcode.

If implementation evidence later presents a real operation that passes every admission condition,
adding it is a language change: it requires the Language Guard, a skill version bump and
qualification, a specification version decision, and independent behavior plus assembly/cost
oracles. It is not added ad hoc during lowering.

## Approved v4 decision

The user approved the initial C64 source set as exactly:

```text
asm_sei()
asm_cli()
asm_php()
asm_plp()
asm_nop()
```

Do not implement external assembly functions, inline assembly blocks, parameterized opcode calls,
or the other eight v3 CPU-control names in the initial v4 language. Keep full legal NMOS 6510
coverage internal to target legalization, instruction selection, machine optimization, and
serialization.

This recommendation changes the active language surface. The v3 specification therefore remains
untouched as historical/frozen authority until the separately governed v4 language revision is
approved; implementation must not silently diverge from whichever specification identity v4
selects.
