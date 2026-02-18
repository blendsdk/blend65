# Memory Map Awareness — Research & Design

> **Document**: 09-memory-map-research.md
> **Parent**: [Index](00-index.md)
> **Item**: K — Memory Map Awareness / ROM Shadow Detection
> **Status**: Research Complete — Ready for Implementation

## 1. C64 VIC Bank Memory Map (Task 5.3.1)

### VIC-II Bank Architecture

The C64's VIC-II video chip can only "see" 16KB of memory at a time. The 64KB address space
is divided into 4 banks of 16KB each, selected by CIA-2 register $DD00 bits 0-1:

| Bank | Address Range | CIA-2 $DD00 bits | Default |
|------|--------------|------------------|---------|
| 0 | $0000-$3FFF | `%xxxxxx11` | ✅ Yes |
| 1 | $4000-$7FFF | `%xxxxxx10` | |
| 2 | $8000-$BFFF | `%xxxxxx01` | |
| 3 | $C000-$FFFF | `%xxxxxx00` | |

### ROM Shadow Regions

Within each VIC bank, the VIC-II chip reads **Character ROM** (not RAM!) at specific
offsets. These are "shadow" regions where the CPU sees RAM but VIC-II sees ROM:

| Bank | ROM Shadow Ranges | Absolute Addresses |
|------|------------------|--------------------|
| 0 | $1000-$1FFF | $1000-$1FFF |
| 1 | (none) | — |
| 2 | $1000-$1FFF | $9000-$9FFF |
| 3 | (none — but I/O at $D000-$DFFF) | $D000-$DFFF* |

*Bank 3 at $D000-$DFFF: VIC-II reads Character ROM here, but the CPU sees I/O registers.

**Key insight**: Banks 0 and 2 have Character ROM shadows at offsets $1000-$1FFF.
Banks 1 and 3 do NOT have ROM shadows (they have full RAM or I/O instead).

### Impact on Blend65

When the compiler places `@charset` or `@data` in a ROM shadow region:
- **CPU can write to it** — the copy operation (`poke`) works correctly
- **CPU can read it** — `peek()` reads RAM as expected
- **VIC-II reads Character ROM instead** — custom data is invisible to the video chip

This is exactly the bug documented in the armenian-charset example:
- `@charset` alignment may place font data at $1000
- The CPU copies data there correctly
- But VIC-II reads built-in Character ROM at $1000, not the custom font
- Result: the custom characters don't appear on screen

### Detailed ROM Shadow Layout (Bank 0 — Default)

```
$0000-$0FFF : VIC sees RAM ✅ (4KB)
$1000-$1FFF : VIC sees Character ROM ❌ (4KB ROM shadow)
$2000-$3FFF : VIC sees RAM ✅ (8KB)
```

The 4KB ROM shadow ($1000-$1FFF = 4096 bytes) covers character ROM — the C64's
built-in font (uppercase at $1000, lowercase at $1800).

This is the ONLY region in Bank 0 where VIC and CPU disagree. Everything else
in $0000-$3FFF is visible to both.

## 2. Design: Compile-Time Region Conflict Detection (Task 5.3.2)

### Challenge: Address Resolution Timing

The Blend65 compiler does NOT know the final addresses of `@data`/`@charset` labels.
Final addresses are resolved by ACME at **assembly time**. The compiler emits symbolic
labels (`__data_armenianFont`) and alignment directives (`!align 2047, 0`), but the
actual address depends on code size, data ordering, and linker placement.

### Solution: ACME Assembly-Time Guards

**Strategy**: Emit ACME conditional directives that check label addresses at assembly time.
ACME supports `!if` conditionals that evaluate label expressions:

```asm
; Guard: warn if charset lands in VIC-II ROM shadow (Bank 0)
!if (__data_armenianFont >= $1000) AND (__data_armenianFont < $2000) {
  !warn "VIC-II ROM shadow: @charset 'armenianFont' at ", __data_armenianFont
  !warn "  VIC-II reads Character ROM at $1000-$1FFF, not RAM."
  !warn "  Move data or copy to a VIC-safe address ($2000+)."
}
```

**Why this works:**
- ACME resolves `__data_armenianFont` to its actual address
- The `!if` checks if that address falls in the ROM shadow
- `!warn` prints a warning but doesn't stop assembly (unlike `!error`)
- Zero runtime cost — this is all assembly-time

### Implementation Strategy

**Where to implement**: In `codegen-phase.ts` where data segment entries are emitted.
After emitting the alignment directive and label for each `@charset`/`@data` entry,
emit an ACME `!if` guard that checks the address against ROM shadow ranges.

### Which Storage Classes to Guard

| Storage Class | Guard? | Reason |
|---------------|--------|--------|
| `@charset` | ✅ Yes | VIC-II charset pointer — most affected |
| `@screen` | ✅ Yes | VIC-II screen memory — affected by ROM shadow |
| `@bitmap` | ✅ Yes | VIC-II bitmap — affected by ROM shadow |
| `@sprite` | ✅ Yes | VIC-II sprite data — affected by ROM shadow |
| `@data` | ⚠️ Optional | Only if aligned and VIC-relevant |
| `@ram` | ❌ No | Not typically VIC-accessed |
| `@zp` | ❌ No | Zero page — never in ROM shadow |

**Implementation**: Guard all `@data` entries that have alignment ≥ 64 (sprite granularity),
since alignment suggests VIC-II hardware use.

### Bank Awareness

For the initial implementation, assume **Bank 0** (default) since:
1. Most C64 programs use Bank 0
2. The compiler doesn't yet have VIC bank configuration
3. Bank 0 has the most common ROM shadow issue

Future enhancement: add `#vic_bank N` compiler directive for bank-aware checking.

### Guard Template

For each guarded data entry:

```asm
; --- ROM shadow guard for [label] ---
!if ([label] >= $1000) AND ([label] < $2000) {
  !warn "[storage_class] '[name]' placed at ROM shadow address."
  !warn "  VIC-II reads Character ROM at $1000-$1FFF in Bank 0."
  !warn "  Data will not be visible to VIC-II at this address."
}
```

### Warning Severity

- **`!warn`** (not `!error`) — assembly continues, binary is still produced
- Programmer may intentionally use ROM shadow (e.g., copying data through CPU reads)
- The armenian-charset example is a valid use case: CPU reads from $1000, copies to $2000

### Files Changed

| File | Change |
|------|--------|
| `pipeline/codegen-phase.ts` | Emit ACME `!if` guards after data labels |
| `codegen/asm-il/builder.ts` | Add `rawDirective()` method for arbitrary ACME directives |
| `codegen/asm-il/types.ts` | Support raw directive element type |
| `codegen/asm-il/emitter.ts` | Emit raw directives |
| `__tests__/e2e/pipeline/` | Test that guards appear in assembly output |

### Estimated Effort

- AsmIL builder/emitter changes: ~30 minutes
- Pipeline guard emission: ~30 minutes
- Tests: ~30 minutes
- **Total: ~1.5 hours (1 session)**

## 3. Implementation Details

### Guard Emission Logic

```typescript
// In codegen-phase.ts, after emitting data label:
if (globalSlot.alignment && globalSlot.alignment >= 64 && globalSlot.dataLabel) {
  // Emit VIC-II ROM shadow guard (Bank 0)
  const label = globalSlot.dataLabel;
  dataSection.elements.push(createRawDirectiveElement(
    `!if (${label} >= $1000) AND (${label} < $2000) {`
  ));
  dataSection.elements.push(createRawDirectiveElement(
    `  !warn "VIC-II ROM shadow: '${globalSlot.qualifiedName}' may land at $1000-$1FFF (Bank 0)."`
  ));
  dataSection.elements.push(createRawDirectiveElement(
    `  !warn "  VIC-II reads Character ROM here, not RAM. Data won't be visible to VIC-II."`
  ));
  dataSection.elements.push(createRawDirectiveElement(`}`));
}
```

### Alternative: Comment-Based Warning (Simpler)

Instead of ACME `!if` guards (which require new AsmIL element types), we could emit
assembly comments documenting the risk:

```asm
; ⚠️ WARNING: @charset data with 2048-byte alignment may land at $1000-$1FFF
; VIC-II reads Character ROM at this address range (Bank 0).
; If the VIC-II shows wrong characters, copy this data to $2000+ at runtime.
!align 2047, 0
__data_armenianFont:
```

**Pros:** Simpler implementation (just comments), no AsmIL changes needed
**Cons:** Not a runtime/assembly-time check — just documentation

### ✅ Decision: ACME Guard + Comment

Use ACME `!if`/`!warn` guards for actual detection, plus a comment for human readers.
This gives both automated checking AND documentation.
