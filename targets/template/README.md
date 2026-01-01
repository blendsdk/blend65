# Target Template

This directory contains template files for creating new Blend65 targets.

## Creating a New Target

### Step 1: Copy Template Files

```bash
cp -r targets/template targets/YOUR_MACHINE
cd targets/YOUR_MACHINE
```

### Step 2: Edit target.toml

1. Replace `TARGET_NAME` with the human-readable machine name
2. Replace `TARGET_ID` with a short identifier (e.g., "vic20", "plus4")
3. Set the correct CPU type ("6502", "6510", "65c02", etc.)
4. Configure capabilities (sprites, colors, screen resolution)
5. Update toolchain settings (assembler, emulator)

### Step 3: Create memory-layout.toml

Define the memory map for your target:

-   Zero page layout and restrictions
-   Program memory area
-   I/O register addresses
-   Special memory regions

### Step 4: Implement Hardware Modules

Create module directories:

```bash
mkdir modules
# Then create .blend65 files for each hardware module
```

### Step 5: Test and Validate

1. Add sample programs to test compilation
2. Validate on real hardware or accurate emulator
3. Document any quirks or special considerations

## Required Files

### target.toml

Defines target capabilities, module mapping, and output format.

### memory-layout.toml

Specifies memory organization and constraints.

### modules/

Directory containing hardware API implementations:

-   `sprites.blend65` (if target supports sprites)
-   `input.blend65` (joystick/keyboard handling)
-   `sound.blend65` (audio functions)
-   `video.blend65` (display functions)
-   `memory.blend65` (universal memory operations)

## Target Categories

### Tier 1 Targets

Production-ready targets with full hardware support and testing.

### Tier 2 Targets

Stable targets with good hardware coverage, community-maintained.

### Development Targets

Experimental targets under active development.

### Planned Targets

Future targets in design or planning phase.

## Hardware API Guidelines

### Function Signatures

Keep function signatures consistent across targets when possible:

```
function setSpritePosition(sprite: byte, x: word, y: byte): void
function readJoystick(port: byte): byte
function setBackgroundColor(color: byte): void
```

### Performance

All hardware functions should inline to optimal register sequences:

```
// This should compile to direct register access
setSpritePosition(0, 100, 50)
// → LDA #100; STA $D000; LDA #50; STA $D001; etc.
```

### Error Handling

Invalid parameters should cause compile-time errors when possible:

```
setSpritePosition(8, 100, 50)  // Error: C64 only has sprites 0-7
```

## Testing Checklist

-   [ ] Target definition validates correctly
-   [ ] Memory layout respects machine constraints
-   [ ] All hardware modules compile and inline properly
-   [ ] Sample programs work on real hardware/emulator
-   [ ] Error messages are clear and helpful
-   [ ] Performance meets expectations (compare to hand-written assembly)

## Documentation Requirements

-   [ ] Clear description of target machine capabilities
-   [ ] Hardware API reference with examples
-   [ ] Memory map documentation
-   [ ] Known limitations or quirks
-   [ ] Recommended development workflow

## Example Targets

See existing targets for reference:

-   `targets/c64/` - Full-featured target (VIC-II, SID, sprites)
-   `targets/x16/` - Modern 6502 target (VERA, YM2151)

## Contributing

When contributing a new target:

1. Follow the template structure exactly
2. Test thoroughly on real hardware
3. Document all hardware-specific behavior
4. Include sample programs demonstrating capabilities
5. Update main documentation to mention new target

```

```
