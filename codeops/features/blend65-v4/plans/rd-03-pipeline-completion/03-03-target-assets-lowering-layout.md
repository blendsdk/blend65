# Target, Assets, Lowering and Layout: RD-03 Pipeline Completion

> **Document**: 03-03-target-assets-lowering-layout.md
> **Parent**: [Index](00-index.md)

## Overview

Compose one exact target, resolve the one raw asset, lower target-neutral operations to documented
NMOS 6510 machine operations, bind resources and produce one conflict-free C64 layout. CPU,
machine, serializer and packager facts remain distinct direct records even though RD-03 selects one
combination (AR-C5–AR-C7).

## Selected Profile

`c64-pal-prg-kernal-6581` directly composes:

| Owner | Exact RD-03 facts | Must not own | AR Ref |
|---|---|---|---|
| CPU | Documented NMOS 6502 instruction grid, 6510 `$0000/$0001` port, flags, addressing, bytes/cycles, wrap hazards | C64 layout, ACME spelling | AR-C5 |
| Machine | PAL timing, stock C64 map, KERNAL 901227-03 cooperative startup/return, VIC/CIA/6581 identities, RAM/ZP/stack reservations | Source typing, assembler syntax | AR-C5, AR-C7 |
| Serializer | ACME 0.97 tokens, expressions, labels, directives and explicit width syntax | Legality, allocation, policy | AR-C5, AR-C8 |
| Packager | CBM PRG header/load/startup contract and component set | Semantic or instruction decisions | AR-C5, AR-C8 |

Selection is a direct exhaustive `switch` over the one admitted profile ID. An unknown ID receives
the normative profile diagnostic. No registry, hook, plugin or speculative target record is added
(AR-C5).

## Frontend Profile Surface

The backend-free frontend declaration record exposes exactly the M1 operations below. The root
compiler binds the same capability identities to machine lowering; spelling alone never selects a
hardware operation (AR-C7, AR-C17).

| Module operation | Source signature | Semantic effect |
|---|---|---|
| `c64.video.waitNextFrame` | `(): void` | Ordered wait for the next qualified PAL frame boundary |
| `c64.input.readJoystick2` | `(): byte` | One ordered volatile sample of joystick port 2 |
| `c64.input.joystickLeft`, `joystickRight`, `joystickFire` | `(sample: byte): boolean` | Pure named interpretation of the captured active-low sample |
| `c64.vic.setSpriteEnabled` | `(index: byte, enabled: boolean): void` | One selected sprite-enable-bit update |
| `c64.vic.setSpritePosition` | `(index: byte, x: word, y: byte): void` | Selected X-low/Y writes and one X-MSB-bit update |
| `c64.vic.setSpritePointer` | `(index: byte, block: byte): void` | One active screen-pointer-table write |
| `c64.vic.setSpriteColor` | `(index: byte, color: byte): void` | One selected sprite-color write |
| `c64.vic.setBorderColor` | `(color: byte): void` | One border-color write |
| `c64.vic.vicSpriteBlock` | `(address: word): byte` | Compile/layout-time validated VIC-bank-relative address divided by 64 |

All runtime operations lower inline to the same direct volatile accesses and necessary control flow
an expert would write. They are not callable helper bodies and add no runtime dispatch. The one
joystick byte is reused by the three pure predicates, so M1 reads CIA once per update and source
authors do not handle active-low hardware bits (AR-C7, AR-C17).

## Raw Asset Resolver

### Input Contract

Only `embed("sprites.bin")` with one literal path and no selector is admitted. The resolver:

1. converts the literal's UTF-8 spelling to a host path only after rejecting absolute paths, empty
   components, `.`/`..`, NUL and malformed Unicode;
2. tries canonical RD-02 asset roots in manifest order;
3. opens without following a final symlink and proves canonical containment/ordinary-file identity;
4. reads exactly 512 bytes, rejecting empty/short/long/non-regular/changed/aliased input;
5. hashes the bytes, revalidates the opened identity and records the selected project-relative
   source; and
6. supplies one `EmbeddedValue` of exact type `const byte[512]` and one `SemanticAsset` containing
   the same immutable bytes (AR-C6, AR-C14).

The checked-in fixture consists of eight distinct nonblank 64-byte records in RD-03 order. Its
generation recipe is a small deterministic development script or documented byte algorithm run to
produce the checked-in file; it is not part of the compiler and adds no asset format (AR-C1, AR-C6).

### Asset Identity and Deduplication

The single declaration produces one asset object. Repeated references share its identity/address;
they do not copy bytes. Layout emits all 512 bytes once in source order. No record table, metadata,
decoder, runtime parser or SFA request exists (AR-C6).

## Structured Machine Representation

```ts
interface MachineProgram {
  readonly functions: readonly MachineFunction[];
  readonly data: readonly MachineDataObject[];
  readonly startup: MachineFunction;
  readonly requiredStorage: readonly StorageRequest[];
}

interface MachineInstruction {
  readonly opcode: NmosOpcode;
  readonly mode: NmosAddressingMode;
  readonly operand: MachineOperand | null;
  readonly uses: MachineStateUse;
  readonly defines: MachineStateUse;
  readonly memory: readonly MachineMemoryEffect[];
  readonly cost: MachineCost;
  readonly source: SourceSpan | null;
}
```

Machine operands are registers, immediates, symbolic addresses, storage IDs or labels. There is no
assembly text field. Flags, ordinary/volatile memory access, clobbers, bytes and path cycles are
explicit. Every constructor checks the documented selected-CPU opcode/mode grid (AR-C3, AR-C5).

## Canonical `optimization: none` Lowering

RD-03 implements only correct mandatory lowering and the direct forms needed by M1/focused cases:

- byte/word constants, loads, stores, copies, conversions and little-endian values;
- byte/word add/subtract with owned `CLC`/`SEC` and low-to-high carry/no-borrow;
- equality and signed/unsigned comparisons with direct branch results rather than forced Boolean
  materialization;
- bit tests/masks and the constant scaling required by fixed aggregate indexing;
- explicit CFG branches, calls/returns and inverse-branch-over-`JMP` range repair;
- fixed array/struct address calculation and loads/stores;
- direct absolute memory access where statically known and `(zp),Y` through an SFA pointer pair for
  dynamic `PEEK`/`POKE`, preserving exact byte/word order and modulo-65536 behavior; and
- the platform operations above (AR-C7, AR-C13).

Candidate choice is deterministic from legality, live state and complete local cost. This is
instruction selection, not the optional RD-08 optimizer. It must not materialize a Boolean that is
used only by one branch, reload an identical live ordinary value without cause, turn MMIO into an
RMW access, or use undocumented/CMOS instructions. Every code-shape case has an independent
behavior oracle and assembly/cost expectation (AR-C5, AR-C13).

Resource binding assigns A/X/Y, live flags, SFA homes and ZP pointers directly. Any spill/helper
request returns to the SFA loop before closure. After closure, structured block layout selects
fall-through and repairs out-of-range conditional branches monotonically; it cannot create storage
(AR-C4).

## Platform Layout

Layout places these object classes, in deterministic stable-ID order where no fixed order applies:

1. exact BASIC stub at `$0801..$080c` and startup entry at `$080d`;
2. startup, reachable machine functions and immutable scalar/data objects;
3. mutable globals/BSS and closed SFA homes in profile RAM;
4. one 64-byte-aligned 512-byte sprite object wholly inside the selected 16-KiB VIC bank, outside
   the active 1-KiB screen matrix, its pointer table, VIC character-ROM visibility windows and all
   other objects; and
5. explicit fill bytes required to keep the PRG body contiguous to its highest loaded byte
   (AR-C5–AR-C7).

M1 selects VIC bank 0 and the profile-owned `$0400` screen matrix while running, preserving/restoring
the relevant CIA2/VIC state. `vicSpriteBlock` derives each record pointer from final bank-relative
placement; no runtime division or copy occurs. `$2000` is the first candidate sprite interval, but
the layout algorithm owns the final first-fitting aligned address and reports any padding. It fails
instead of overlapping or moving data to a non-visible bank (AR-C6, AR-C7).

Startup emits the exact 12-byte auto-start line, captures compiler-owned state, establishes stack,
binary mode, cooperative banking and selected VIC/CIA state, initializes language storage in proved
module order and falls into `main`. A returning `main` restores every captured field and executes
the profile's `RTS` back to BASIC. Initialized data already resides at its final address and is not
copied (AR-C7).

## Error Handling

| Error case | Handling | AR Ref |
|---|---|---|
| Unknown profile/API capability | Selected-profile diagnostic; no fallback target or raw address | AR-C5, AR-C17 |
| Raw asset missing, escaping, aliased, changed or not exactly 512 bytes | Proving input diagnostic; no typed value or artifact | AR-C6, AR-C14 |
| Illegal opcode/mode or stale flag candidate | Candidate rejected before machine program acceptance | AR-C5 |
| Dynamic memory access lacks fitting pointer home | Return request to SFA or issue resource diagnostic | AR-C4, AR-C7 |
| Branch out of range | Structured inverse-branch repair; failure only if final target layout is impossible | AR-C3, AR-C5 |
| Asset/code/screen/SFA interval conflict or VIC invisibility | Exact E10238-style resource/layout failure with intervals | AR-C6 |
| Post-closure lowering asks for storage | Internal pipeline failure; no assembly | AR-C4, AR-C14 |

## Testing Requirements

- Profile declaration tests contain no addresses/ACME details; backend profile tests bind exact
  CPU/machine/emitter/packager identities.
- Asset cases cover search precedence, traversal, symlink/alias, size, mutation, hash, type and
  one-copy behavior.
- Machine tests cover carry/no-borrow, signed compare stale-V counterexamples, direct branch,
  dynamic byte/word PEEK/POKE, pointer wrap, branch endpoints and documented-opcode validation.
- Platform operation tests assert exact MMIO count/order and separate instruction/cost shape.
- Layout tests prove stub/entry bytes, non-overlap, bank visibility, 64-byte alignment, derived
  pointer values, contiguous PRG fill and no runtime asset copy.
