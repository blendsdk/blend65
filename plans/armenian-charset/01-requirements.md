# Requirements: Armenian Charset Example

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Create a complete Blend65 example program demonstrating custom character set creation for the Commodore 64. The program defines a custom Armenian alphabet font using `@charset`, switches the VIC-II to display it, shows a "Hello World" greeting in Armenian, and animates the full alphabet as a growing serpentine snake across the screen.

## Functional Requirements

### Must Have

- [ ] Custom charset with all 38 Armenian uppercase letters as 8×8 pixel bitmaps
- [ ] Space character in the charset (for word separation)
- [ ] VIC-II character generator switching to custom charset via `$D018`
- [ ] Display "Բարև Աշխdelays" (Barev Ashkharh = Hello World) on screen
- [ ] Display all 38 Armenian letters on screen
- [ ] Snake animation: alphabet crawls in serpentine pattern, growing one letter at a time
- [ ] Delay between each snake step (visible animation speed)
- [ ] Armenian flag color scheme (red, blue, orange)
- [ ] Uses `@charset` sugar keyword (mandatory, not raw `@data(align: 2048)`)
- [ ] Uses `@` address-of operator for charset pointer calculation
- [ ] Compiles and assembles at all 10 optimization levels (O0–O3z)

### Should Have

- [ ] Digit characters 0-9 in the charset (for potential score display)
- [ ] Clean screen clear before display
- [ ] Well-commented source code explaining C64 hardware mechanics
- [ ] README.md with program description and Armenian alphabet reference

### Won't Have (Out of Scope)

- Lowercase Armenian letters (76 additional glyphs — too much for one example)
- User input / keyboard control
- Sound effects
- Multi-module structure (single file is sufficient)
- Scroll or screen wrap behavior

## Technical Requirements

### C64 Hardware

- **VIC-II Register `$D018`**: Bits 1-3 control character generator address within VIC bank
  - Value = `(charset_address / 2048) << 1` combined with screen pointer bits
  - Default value: `$15` (screen at `$0400`, charset at ROM `$1000`)
  - We need to change bits 1-3 to point to our custom charset
- **Screen Memory**: `$0400`–`$07E7` (1000 bytes, 40×25 characters)
- **Color RAM**: `$D800`–`$DBE7` (1000 bytes, 4-bit color per character)
- **Border Color**: `$D020`
- **Background Color**: `$D021`

### Armenian Alphabet (Uppercase)

The 38 letters of the Armenian uppercase alphabet (Հայoce մdelaysdelaysdelays):

| # | Letter | Name | Transliteration | Char Code |
|---|--------|------|-----------------|-----------|
| 0 | Ա | Ayb | A | 0 |
| 1 | Բ | Ben | B | 1 |
| 2 | Գ | Gim | G | 2 |
| 3 | Դ | Da | D | 3 |
| 4 | Ե | Yech | E/Ye | 4 |
| 5 | Զ | Za | Z | 5 |
| 6 | Է | E | É | 6 |
| 7 | Ը | Et | Ə | 7 |
| 8 | Թ | To | T' | 8 |
| 9 | Ժ | Zhe | Zh | 9 |
| 10 | Ի | Ini | I | 10 |
| 11 | Լ | Lyun | L | 11 |
| 12 | Խ | Khe | Kh | 12 |
| 13 | Ծ | Tsa | Ts | 13 |
| 14 | Կ | Ken | K | 14 |
| 15 | Հ | Ho | H | 15 |
| 16 | Ձ | Dza | Dz | 16 |
| 17 | Ղ | Ghat | Gh | 17 |
| 18 | Ճ | Tche | Ch | 18 |
| 19 | Մ | Men | M | 19 |
| 20 | Յ | Yi | Y | 20 |
| 21 | Ն | Nu | N | 21 |
| 22 | Շ | Sha | Sh | 22 |
| 23 | Ո | Vo | Vo/O | 23 |
| 24 | Չ | Cha | Ch' | 24 |
| 25 | Պ | Pe | P | 25 |
| 26 | Ջ | Jhe | J | 26 |
| 27 | Ռ | Ra | Rr | 27 |
| 28 | Ս | Se | S | 28 |
| 29 | Վ | Vev | V | 29 |
| 30 | Տ | Tiwn | T | 30 |
| 31 | Ր | Re | R | 31 |
| 32 | Ց | Co | Ts' | 32 |
| 33 | Ւ | Yiwn | W | 33 |
| 34 | Փ | Piwr | P' | 34 |
| 35 | Delays | Ke | K' | 35 |
| 36 | Օ | O | O | 36 |
| 37 | Ֆ | Fe | F | 37 |
| 38 | (space) | — | — | 38 |

### "Բdelays Աdelaysdelaysdelays" Character Sequence

"Barev Ashkharh" spelled in our character codes:

| Position | Letter | Code |
|----------|--------|------|
| 0 | Բ | 1 |
| 1 | Ա | 0 |
| 2 | Ր | 31 |
| 3 | Ե | 4 |
| 4 | Վ | 29 |
| 5 | (space) | 38 |
| 6 | Ա | 0 |
| 7 | Շ | 22 |
| 8 | Խ | 12 |
| 9 | Ա | 0 |
| 10 | Ր | 31 |
| 11 | Հ | 15 |

### Armenian Flag Colors

| Stripe | Color | C64 Color Code | Register |
|--------|-------|----------------|----------|
| Top | Red | 2 (Red) | Text color row 1 |
| Middle | Blue | 6 (Blue) | Text color row 2 |
| Bottom | Orange | 8 (Orange) | Text color row 3 |
| Border | Blue | 6 (Blue) | `$D020` |
| Background | Black | 0 (Black) | `$D021` |

### Snake Animation Behavior

1. **Start**: Position the head at a starting screen position (e.g., column 5, row 8)
2. **Direction**: Move right initially
3. **Growth**: Each step adds one letter:
   - Step 1: Just **Ա** appears
   - Step 2: ** Delays** appears at new head, **Ա** stays (body)
   - Step 3: **Գ** appears at new head, ** Delays** and **Ա** stay (body)
   - ...continues until all 38 letters are placed
4. **Serpentine turn**: When reaching screen edge, move down one row and reverse direction
5. **Delay**: Visible delay between each step (adjustable via delay loop)
6. **After completion**: All 38 letters visible on screen as a snake trail

### Performance

- No specific cycle-count requirements (this is a visual demo)
- Delay loops should produce ~200ms visible pause between letters
- Must compile at all optimization levels without errors

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Letter case | Upper only, Both | Upper only | Complex glyphs need maximum pixel space |
| Animation | Static display, Snake | Snake | More impressive demo, user request |
| Colors | Monochrome, Flag | Flag colors | Armenian cultural theme |
| Charset size | Partial (38 chars), Full (256) | Full 2048 bytes | `@charset` requires full 2048-byte block |
| File structure | Multi-file, Single | Single | Example simplicity |

## Acceptance Criteria

1. [ ] Program compiles at all 10 optimization levels (O0, O1, O1s, O1z, O2, Os, Oz, O3, O3s, O3z)
2. [ ] ACME assembles all levels successfully
3. [ ] All 38 Armenian letters are defined as recognizable 8×8 glyphs
4. [ ] "Բdelays Աdelaysdelaysdelays" appears correctly on screen
5. [ ] Snake animation plays through all 38 letters
6. [ ] Armenian flag colors are visible (border, background, text)
7. [ ] `diag_app` passes at all levels with no regressions
8. [ ] README.md documents the example
