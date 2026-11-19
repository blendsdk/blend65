# Function-local callable placement check (#164 remainder)

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: T-170 / #164
> **Progress**: 2/2 tasks (100%)
> **Status**: Done — the defect is confirmed; repair is planned separately
> **Baseline**: `1f608f3c`, clean `feature/v4-rebuild`
> **Scope**: strict; classification only
> **Reasoning**: high — the same proof boundary, one storage owner further in
> **Created**: 2026-11-19

## Objective and authority

The completed global repair (T-33) deliberately left function-local storage unqualified. This check
answers one question: does the same unsafe acceptance exist when the callable value lives in a
function-local home rather than a module-level variable?

This is classification only. It designs no repair, changes no compiler source, touches no
specification or oracle, and closes no issue.

## What was checked

Two small public builds per case, in the same shape the global diagnosis used. The first build
places storage and reports where it went; the second changes only the literal write address so it
covers those exact bytes, keeping every other source byte identical.

- [x] T-170.1 Establish where a function-local callable home actually lands, and confirm the disjoint control is accepted. Verified 2026-11-19.
- [x] T-170.2 Write over that home before the call and classify the result across the supported modes and both storage shapes. Verified 2026-11-19.

## Confirmed condition

The compiler accepts a program whose local callable bytes are overwritten before the call, and
still calls the original target. This is the **same stale-target-proof defect as #164**, with
function-local storage as the owner instead of a module-level variable.

Emitted code from the accepted `optimization: "none"` build, with the local home at
`[$0AC5,$0AC7)`:

```text
lda #<Game.chosen
sta $0ac5          ; cb = &chosen
lda #>Game.chosen
sta $0ac6
lda #$00
sta $0ac5          ; pokew($0AC5, 0) covers the same two bytes
lda #$00
sta $0ac6
jsr Game.chosen    ; the call still uses the overwritten target
```

### Coverage of the classification

| Shape | Mode | Home | Write | Result |
| --- | --- | --- | --- | --- |
| Scalar local | `none` | `$0AC5–$0AC6` | `$0AC5` | Accepted, unsafe |
| Scalar local | `balanced` | `$0AC5–$0AC6` | `$0AC5` | Accepted, unsafe |
| Scalar local | `speed` | `$0AC5–$0AC6` | `$0AC5` | Accepted, unsafe |
| Scalar local | `size` | `$0AC5–$0AC6` | `$0AC5` | Accepted, unsafe |
| Callable field in a local struct | `none` | `$0AEE–$0AF1` | `$0AEF` | Accepted, unsafe |
| Callable field in a local struct | `balanced` | `$0AE8–$0AEB` | `$0AE9` | Accepted, unsafe |
| Callable field in a local struct | `speed` | `$0AE8–$0AEB` | `$0AE9` | Accepted, unsafe |
| Callable field in a local struct | `size` | `$0AE8–$0AEB` | `$0AE9` | Accepted, unsafe |

Every disjoint control at `$C100` built successfully, so the condition is the overlap itself and
not the presence of a raw write. The reference payload is 659 bytes, SHA-256
`8e03e1ffb40717e2df58fffcb768164ed02f2cd246eb7638aab37e9e33c03d99`; the accepted overlapping
payload is also 659 bytes, SHA-256
`0a0ffd3106bb94bd767da02f59fb9a047bab0c636fde08a694c8a64a01f287b9`.

## The one fact that makes this harder than the global case

A module-level variable owns its bytes for the whole program. A function-local home does not:
storage closure assigns homes using an interference graph
(`packages/compiler/src/storage/interference.ts`), so two values whose lifetimes do not overlap can
share the same address. "The bytes holding this callable" is therefore a property of a live range,
not of an address alone.

A repair that treats a local home like a global interval would reject programs where the write
happens while a different, unrelated value owns those bytes. The proof has to be tied to the live
range the call actually reads.

## Evidence limits

Compile-time classification only. No emulator run was needed or performed, because the compiled
output already contradicts the proof it claims. No full suite ran; only the two builds per case
above. No existing test, specification file or release record was touched, and the worktree was
clean before and after. Temporary projects were removed.

A follow-up probe widened the condition: a **function-typed parameter** has its own home in a
separate storage class, and writing over that home before the call is accepted in exactly the same
way. The repair therefore has to cover binding-backed frame storage, not locals alone.

```text
sfa home: src/game.blend:52:129:parameter:src/game.blend:70:84  $0AC3-$0AC4
write over the parameter home -> ACCEPTED (unsafe)
```

Not examined here, and still unqualified under #164: interference between an interrupt handler and
the main program over callable bytes, and relocating storage instead of rejecting the program.
