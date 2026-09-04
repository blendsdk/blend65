# Commodore 64 Game Systems

Use this reference when language or compiler behavior touches the C64 platform, game architecture,
memory layout, graphics, sound, input, interrupts, or emulator verification.

## Fix the machine configuration first

State the following whenever they can affect the result:

- PAL or NTSC and the selected VIC-II model;
- NMOS 6510 CPU assumptions and whether undocumented opcodes are allowed;
- BASIC/KERNAL/I/O banking state;
- startup environment and interrupt ownership;
- VICE model, command-line options, and warp/timing mode.

There is no single honest cycle count for raster-sensitive code without a video standard and
machine-state assumption.

## Memory and banking facts

- `$0000` is the 6510 on-chip port data-direction register and `$0001` is its data port. Their low
  bits participate in mapping RAM, BASIC ROM, KERNAL ROM, character ROM, and I/O.
- Page `$0100` is the hardware stack. Zero page is shared with the operating environment unless the
  program has explicitly taken ownership of selected ranges.
- The default text screen is commonly at `$0400`; color RAM is at `$D800` and stores color nibbles.
- VIC-II, SID, color RAM, and CIA registers occupy the `$D000`-`$DFFF` I/O region when I/O is
  mapped in. Hidden RAM still exists beneath ROM/I/O but requires deliberate banking.
- VIC-II sees one 16 KiB bank at a time. CIA 2 port A selects that bank with inverted low-bit
  encoding; the CPU and VIC-II therefore need not see the same bytes at the same apparent moment.
- `$D018` selects screen and character/bitmap placement within the active VIC bank. Compiler data
  placement must respect both CPU addresses and the VIC's bank-relative interpretation.
- A hardware sprite image consumes 63 visible bytes in a 64-byte block. Its pointer is the
  bank-relative address divided by 64, and the pointer table follows the selected screen matrix.
  Place sprite data on a 64-byte boundary instead of copying it to an arbitrary staging area.

The official [Commodore 64 Programmer's Reference Guide](https://www.zimmers.net/anonftp/pub/cbm/c64/manuals/C64_Programmers_Reference_Guide.pdf)
is the primary platform reference. Use the MOS/CSG chip datasheets when electrical or register
semantics need more precision, including the [6567 VIC-II preliminary datasheet](https://www.zimmers.net/anonftp/pub/cbm/documents/chipdata/6567_vicII_preliminary.pdf)
and [6581 SID datasheet archive](https://www.zimmers.net/anonftp/pub/cbm/documents/chipdata/6581.zip).

## VIC-II rules that affect compiler output

- Model hardware registers as volatile, named, width-exact locations. A read may observe changing
  raster or collision state; a write may acknowledge an interrupt or alter display fetches.
- Raster position spans `$D012` plus the high raster bit in `$D011`. Read sequences can straddle a
  hardware change and need a deliberate consistency strategy when exact position matters.
- VIC interrupt status/acknowledgement (`$D019`) and enable (`$D01A`) have bit-level semantics.
  Do not lower acknowledgement as an ordinary cached read-modify-write.
- Sprite enable, position, expansion, priority, multicolor, and X high bits are distributed across
  shared registers. Zero-cost platform helpers should hide bit packing without adding extra MMIO
  traffic or reordering writes.
- VIC-II steals CPU cycles for display fetches, including badlines and sprite DMA. CPU instruction
  tables alone are insufficient for cycle-exact raster code.
- Stable raster effects may require alignment, controlled interrupt entry, and path-invariant
  instruction timing. Verify the emitted path, not just the source loop.

## CIA, input, and interrupts

- CIA timers, interrupt-control registers, and ports have device-specific read/write side effects.
  A generic memory optimizer must not merge, widen, remove, or reorder these accesses.
- CIA 1 is involved in keyboard/joystick I/O; CIA 2 also participates in VIC bank selection and
  serial/user-port behavior. A platform API must preserve unrelated bits when hardware shares a
  register.
- An interrupt handler must save every register and machine-mode assumption its body or callees
  can clobber, acknowledge the actual source, and return with `RTI`.
- Mainline and IRQ code must not share non-reentrant static frame or scratch storage unless the
  compiler proves exclusion or emits protection.
- Keep interrupt hot paths bounded. Hidden helper calls, parameter homing, bank switching, or
  generic arithmetic are defects when they violate the timing budget.

## SID and audio

- SID exposes three voices plus filter/control registers through MMIO. Write order and timing are
  observable; treat all register access as volatile.
- 6581 and 8580 revisions differ in analog behavior. Do not promise bit-identical audio or filter
  response from register-level emulator tests alone.
- Tracker playback usually calls initialization and play routines at embedded addresses. A usable
  language/platform layer therefore needs a safe, explicit mechanism for external routine entry,
  data placement, and periodic IRQ calls.
- Keep per-frame music work and its clobber contract visible to the allocator and interrupt ABI.

## Game-oriented data and control design

- Keep assets where VIC-II, SID routines, or loaders consume them. Prefer placement and pointer
  changes to copies.
- Use double buffering or pointer flipping where the hardware supports it; never copy a full frame
  merely because the compiler's first abstraction owns one fixed buffer.
- Precompute expensive invariant work, but do not force users to hand-compute addresses, screen
  codes, sprite blocks, or register masks that the compiler/platform library knows.
- Split hot and cold paths. Initialization may spend bytes/cycles to make the frame loop small and
  predictable.
- Prefer incremental per-frame updates over scanning whole maps or object sets when only a small
  subset changes.
- Make named platform registers and zero-cost helpers the normal source interface. Raw `peek` and
  `poke` remain escape hatches, not the ergonomic API.
- Choose data layout from access behavior and DMA constraints. The compiler should preserve both
  idiomatic record-oriented source and efficient structure-of-arrays paths where each is useful.

## C64 verification ladder

1. Inspect generated ACME source for named placement, register width, volatility, and control flow.
2. Assemble it and inspect final bytes/symbol addresses; assembler source alone can hide addressing
   mode and alignment decisions.
3. Run deterministic memory/register assertions in `x64sc`, the cycle-accurate C64 VICE variant.
4. For raster-sensitive behavior, fix PAL/NTSC/VIC model and observe the intended frame/raster
   boundary rather than an arbitrary delay.
5. Use screenshots or frame hashes for graphics only after confirming the memory/register oracle;
   visual similarity alone can hide timing and banking bugs.
6. Reserve real-hardware checks for analog SID behavior, silicon-sensitive tricks, and emulator
   gaps, while keeping deterministic CI-level proofs for everything else.

Use the official [VICE manual](https://vice-emu.sourceforge.io/vice_toc.html) for emulator and
monitor behavior and the official [ACME repository](https://github.com/meonwax/acme) for assembler
syntax and addressing decisions.

## Zero-cost platform API test

A proposed helper is acceptable only when:

- its source-level name expresses the game/hardware intent;
- constant arguments fold to the same or better sequence an expert would write;
- dynamic arguments use the cheapest legal addressing path;
- volatility prevents invalid removal/reordering without blocking unrelated optimization;
- banking, alignment, masks, or pointer formats are hidden from ordinary users;
- the emitted assembly and hardware effects are tested together.
