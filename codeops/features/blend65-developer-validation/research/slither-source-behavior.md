# Slither: Source-derived Behavior Inventory

> **Status**: Verified partial — independent original-source reasoning, not a frozen oracle
> **Date**: 2026-10-18
> **Source**: `skrasser/slither_c64@31347444d9547210f698ac98961e794ea671d276`
> **CodeOps Artifact Schema**: 1

## Purpose and Independence

Continue technical discovery under combined-port AR-P6; licensing is user-owned
and is not an agent technical gate. This record identifies original behavior
without using a future port's implementation or observed VICE answers as its
expected result. It is research input for the later behavior contract, not an
approved executable plan, specification test or claim of full game correctness.

Fresh source researcher `ses_eb18cb18effeVKhW1IlMggRK3w`, explicitly requested
`openai/gpt-6.1-sol#medium`, reads only the ten allowlisted original assembly files
through pinned HTTPS URLs. It reports no compiler, future-port, existing-test,
skill-payload, research-record or runtime-answer exposure and performs no
execution. The primary checks the ten exact source lengths/hashes against the
[initial inventory](../requirements/_draft/slither-source-assessment.md#input-inventory).
Some returned line ranges exceeded the actual source lengths; references below
are normalised to actual pinned-file lines, without changing behavior claims.
This establishes source reasoning, not enforced isolation or independent runtime
verification. No authority or immutable oracle is changed.

All source citations below resolve against the
[pinned upstream tree](https://github.com/skrasser/slither_c64/tree/31347444d9547210f698ac98961e794ea671d276).
Original source comments are not hardware authority. Timing, device visibility
and player effects need the separately owned machine evidence.

## States and Update Order

| Boundary | Instruction-derived behavior | Exact source |
| --- | --- | --- |
| Boot | IRQ setup; character copy; SID init; VIC setup; clear; frame; score display; fall into the fire prompt | `code/main.asm:1–10` |
| Start/restart | Wait for fire; start music; clear; draw frame; **print existing score; reset stored score**; initialize position; release crash gate; set retained direction left | `code/main.asm:10–20` |
| Every gameplay iteration | **Increment score; print score; test current pixel**. On a clear bit, draw there; run three busy loops; sample direction; move; repeat | `code/main.asm:22–75` |
| Collision | Stop music; initialize SID; trigger crash; border `15,12,11,0`, with `waitframes(3)` after each; jump back to fire prompt. No direction sample on this branch | `code/main.asm:26–47` |
| Termination | Main gameplay paths return to `joy_read` or `gamestart`, not to BASIC | `code/main.asm:47–77` |

The destination is tested on the iteration **after** movement. A collision
iteration still increments and displays score. Restart prints the previous
score before resetting storage; the next gameplay display becomes `000001`.
There is no explicit intervening score display of reset zero. These ordering
facts are not silently corrected or converted to a conventional game loop.

## Input Interpretation

| Input/state | Logical result | Exact source |
| --- | --- | --- |
| Direction sample | Read `$DC00`, retain low nibble. Zero bits select directions in **up, down, left, right** priority | `code/main.asm:54–75` |
| Multiple directions | Up wins over down; left wins over right. No immediate-reversal rejection | `code/main.asm:59–75` |
| No direction: nibble `$F` | Reload the previous `shd` and continue it | `code/main.asm:54–59` |
| Nonempty direction sample | Store the entire low-nibble combination, not a canonical one-direction value | `code/main.asm:54–59` |
| Initial direction | `shd=$FB`, whose selected direction is left | `code/main.asm:19–20,60–74` |
| Fire | Poll bit 4 until zero. No release or rising/falling-edge requirement; held fire can pass a restart prompt immediately | `code/main.asm:112–123` |
| Fire during gameplay | Removed by the low-nibble mask; it is not a separate gameplay action | `code/main.asm:54–55` |

These are register-value interpretations. They do not independently establish
physical joystick wiring, CIA direction-register ownership or electrical behavior.

## Logical Bitmap and Score

The address arithmetic uses a logical 320×200 bitmap with eight bytes per
8×8 cell. For coordinates `(x,y)` inside that geometry:

```text
address = $2000 + floor(y / 8) * 320 + floor(x / 8) * 8 + (y mod 8)
mask = $80 >> (x mod 8)
```

| Boundary | Source-derived result | Exact source |
| --- | --- | --- |
| Initial position | Pointer `$3000`, mask `$80`: logical **(256,96)** | `code/pixel.asm:1–8` |
| First clear iteration with no direction | Print `000001`, draw (256,96), then move to (255,96) | `code/main.asm:15–24,48–75`; `code/pixel.asm:1–15,23–33` |
| Frame | `x=0/319, y=8…199`; horizontal `y=8/199, x=0…319`. Interior `x=1…318, y=9…198` | `code/gfx.asm:55–121` |
| Drawing | OR the current mask into the byte; retain previous trail pixels | `code/pixel.asm:10–15`; `code/main.asm:48–52` |
| Collision | AND the current byte with the current mask; unrelated bits do not collide | `code/pixel.asm:17–21` |
| Clear | Writes all 8000 bitmap bytes `$2000–$3F3F` and 1000 screen cells; first 40 cells `$81`, others `$51` | `code/gfx.asm:15–53`; `code/main.asm:80–85` |
| Score representation | Three packed-decimal bytes, least significant first; reset clears all three | `code/score.asm:1–26,75` |
| Score display | High then low nibble of byte 2, byte 1, byte 0: six digits including leading zeros | `code/score.asm:28–73` |
| Digit positions | After the six-cell `score ` prefix: cells 6–11, bitmap `$2030,$2038,…,$2058`, logical x=48…95, y=0…7 | `code/main.asm:127–133`; `code/text.asm:54–71`; `code/macro.asm:1–9`; `code/score.asm:28–73` |

Geometry follows the original placement and movement arithmetic
(`code/pixel.asm:23–74`). Actual presentation depends on machine entry state:
VIC setup sets `$D011` bit 5 and writes `$D018=$18`, but does not independently
normalise all mode bits or select every VIC-bank condition
(`code/gfx.asm:5–12`). Character-ROM copying and raster/device visibility remain
machine obligations, not facts proved by the coordinate formula.

## Candidate Logical Cases

These are source-derived inputs and answers for future contract development.
They are not executed results or permission to freeze tests before the actual
planning gate. Score inputs assume valid packed-decimal digits and the NMOS
decimal-instruction contract, with no intervening writer to score storage;
all values below are hexadecimal bytes. Full concurrent player/interrupt
preservation is not established by these sequential logical cases.

| Case input/state | Logical answer | Source basis |
| --- | --- | --- |
| Direction nibble `$C` (up/down active) | Up | `code/main.asm:54–67` |
| Nibble `$3` (left/right active) | Left; retain `$03` | `code/main.asm:54–75` |
| Nibble `$0` (all active) | Up | Same priority chain |
| Nibble `$F` after retained `$03` | Left; retained combination remains `$03` | `code/main.asm:54–59` |
| Fire bit high / low | Continue polling / return, even if already held | `code/main.asm:120–123` |
| `(8,96)` left; `(7,96)` right | `(7,96)`; `(8,96)` | `code/pixel.asm:23–33,49–59` |
| `(256,96)` up; `(256,95)` down | `(256,95)`; `(256,96)` | `code/pixel.asm:35–47,61–74` |
| Byte has other bits set, current mask clear | No collision | `code/pixel.asm:17–21` |
| Byte includes current mask | Collision after increment/display | `code/main.asm:22–30`; `code/pixel.asm:17–21` |
| Draw P; move left to clear Q; choose right at Q | Draw Q; return to occupied P; following iteration increments before collision | `code/main.asm:22–75`; `code/pixel.asm:10–21,23–33,49–59` |
| Score `[09,00,00]` + 1 | `[10,00,00]` | `code/score.asm:8–26` |
| `[99,00,00]` + 1 | `[00,01,00]` | Same decimal carry chain |
| `[99,99,00]` + 1 | `[00,00,01]` | Same decimal carry chain |
| `[99,99,99]` + 1 | `[00,00,00]`; no additional stored overflow digit | Same decimal carry chain |
| Restart after a nonzero score | Print old score; reset storage; next gameplay score display `000001` | `code/main.asm:10–24` |

Whether these unusual ordering/input choices were intentional is not established
by source. The approved complete-port goal does not authorise changing them.
Record their exact mechanisms now; do not silently add reversal protection,
alter scoring or replace busy waits with frame-based movement.

## Audio, Delay and Unproved Boundaries

| Route | Source mechanism | Exact source |
| --- | --- | --- |
| Music start/tick | A=0 to `$1000`; enable raster IRQ; line-zero IRQ acknowledges VIC, calls `$1003`, reaches `$EA81` | `code/irq.asm:1–38` |
| Music stop | Disable `$D01A`; not an exported player stop routine | `code/irq.asm:29–32` |
| SID init/crash/release | Clear 25 registers; volume `$0F`, voice-1 attack/decay `$09`, sustain/release `$00`; crash frequency `$0600`, control `$81`; release `$80` | `code/sfx.asm:1–26` |
| Movement delay | Three calls to an X increment-to-wrap busy loop; not a frame tick | `code/main.asm:49–52,95–99` |
| Crash waits | Each call receives Y=3, disables IRQs, polls raster low byte `$FF`, burns one busy loop per iteration and eventually enables IRQs | `code/main.asm:31–46,101–110` |

`waitframes` does not explicitly test raster high bit or wait for a transition
away from `$FF`. Its name is not proof of exact elapsed frames. Exact cadence,
bus stalls, jitter, music/SFX overlap and audible output remain unproved here.
The independent researcher did not fetch/disassemble the SID payload. The
[runtime follow-up](slither-pal8580-followup.md) and
[public compiler probes](slither-public-support-probes.md) own their separate
execution endpoints; neither turns this inventory into a full player contract.

The technical planning gate remains open for exact player ABI, complete applicable
interrupt/resource/cost proof and qualified public support under existing v4
owners. Source research does not add an adapter, engine, runtime, specification
change or port workaround. No licence enquiry or external publication is needed
for this local technical continuation; clearance is not claimed.

Decimal semantics use expert 2.0.4/content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`,
`mos-6502-family.md#decimal-behavior`, source key MOS-PGM-1976 §§2.2.1.2,
2.2.2 and 3.3. Candidate cases do not rely on NMOS decimal N/Z/V flags. Ordinary
Blend65 arithmetic remains binary; this is a description of the original BCD
routine, not a proposed change to source semantics or interrupt lowering.
