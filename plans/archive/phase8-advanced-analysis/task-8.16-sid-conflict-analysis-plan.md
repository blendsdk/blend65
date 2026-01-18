# Task 8.16: SID Resource Conflict Analysis Plan

> **Status**: Ready for Implementation  
> **Time Estimate**: 6 hours total (4 steps)  
> **Tests Required**: 15+  
> **Location**: `packages/compiler/src/semantic/analysis/hardware/c64/sid-conflicts.ts`  
> **Integration**: Called from `C64HardwareAnalyzer.analyzeSound()`

---

## Overview

Detect SID voice and filter resource conflicts for the C64.

### Why Critical

The C64 SID chip has strict hardware constraints:
- Only 3 voices available (Voice 0, 1, 2)
- Only 1 filter (shared across all voices)
- Filter + voice conflicts cause audio glitches
- Interrupt timing affects music/SFX coordination

---

## SID Hardware Details

### SID Register Layout ($D400-$D41C)

```
Voice 1: $D400-$D406
  $D400-$D401: Frequency (low/high)
  $D402-$D403: Pulse width (low/high)
  $D404: Control register (waveform, gate, sync, ring)
  $D405: Attack/Decay
  $D406: Sustain/Release

Voice 2: $D407-$D40D
  $D407-$D408: Frequency (low/high)
  $D409-$D40A: Pulse width (low/high)
  $D40B: Control register
  $D40C: Attack/Decay
  $D40D: Sustain/Release

Voice 3: $D40E-$D414
  $D40E-$D40F: Frequency (low/high)
  $D410-$D411: Pulse width (low/high)
  $D412: Control register
  $D413: Attack/Decay
  $D414: Sustain/Release

Filter/Volume: $D415-$D418
  $D415-$D416: Filter cutoff frequency (low/high)
  $D417: Resonance + filter routing (which voices)
  $D418: Volume + filter mode (LP/BP/HP/3off)

Read-only: $D419-$D41C
  $D41B: Voice 3 waveform output
  $D41C: Voice 3 envelope output
```

### Common Conflict Scenarios

1. **Voice Allocation Conflict**: Two functions trying to use same voice
2. **Filter Routing Conflict**: Different code expects different filter routing
3. **Volume Conflict**: Music vs SFX both modifying global volume
4. **Timing Conflict**: IRQ handler interrupting SID updates mid-write

---

## Implementation Steps

### Step 8.16.1: Class Structure and Register Definitions (1h)

**File**: `packages/compiler/src/semantic/analysis/hardware/c64/sid-conflicts.ts`

**Create:**
- `SIDConflictAnalyzer` class
- SID register constants and types
- Voice tracking structures
- Filter state tracking

**Key Types:**
```typescript
// SID register addresses
const SID_BASE = 0xD400;
const SID_VOICE_OFFSET = 7; // 7 registers per voice

const SID_REGISTERS = {
  VOICE1_FREQ_LO: 0xD400,
  VOICE1_FREQ_HI: 0xD401,
  VOICE1_PULSE_LO: 0xD402,
  VOICE1_PULSE_HI: 0xD403,
  VOICE1_CONTROL: 0xD404,
  VOICE1_AD: 0xD405,
  VOICE1_SR: 0xD406,
  // ... Voice 2 at +7, Voice 3 at +14
  FILTER_CUTOFF_LO: 0xD415,
  FILTER_CUTOFF_HI: 0xD416,
  FILTER_RESONANCE: 0xD417,
  VOLUME_MODE: 0xD418,
};

interface VoiceUsage {
  voice: 0 | 1 | 2;
  usedBy: string[];  // Function names
  locations: SourceLocation[];
  registers: Set<number>;  // Which registers written
}

interface FilterUsage {
  routedVoices: Set<0 | 1 | 2>;
  filterMode: 'lowpass' | 'bandpass' | 'highpass' | 'off' | 'unknown';
  usedBy: string[];
  locations: SourceLocation[];
}
```

**Tests (3):**
- SID register constants are correct
- Voice address calculation helper
- Filter address detection

---

### Step 8.16.2: Voice Usage Tracking (1.5h)

**Implement:**
- `trackVoiceWrites()`: Detect writes to voice registers
- `getVoiceForAddress()`: Map address to voice number
- `analyzeVoiceUsage()`: Aggregate voice usage across functions

**Detection Logic:**
```typescript
// Detect which voice a @map or assignment targets
function getVoiceForAddress(address: number): 0 | 1 | 2 | null {
  if (address >= 0xD400 && address <= 0xD406) return 0;
  if (address >= 0xD407 && address <= 0xD40D) return 1;
  if (address >= 0xD40E && address <= 0xD414) return 2;
  return null; // Not a voice register
}
```

**Conflict Detection:**
```typescript
// Voice conflict: multiple functions writing to same voice
interface VoiceConflict {
  voice: 0 | 1 | 2;
  functions: string[];
  severity: 'error' | 'warning';
  message: string;
}
```

**Tests (4):**
- Detect voice 0 register writes
- Detect voice 1 register writes
- Detect voice 2 register writes
- Detect voice conflict between functions

---

### Step 8.16.3: Filter Conflict Detection (2h)

**Implement:**
- `trackFilterWrites()`: Detect writes to filter registers
- `analyzeFilterRouting()`: Determine which voices route to filter
- `detectFilterConflicts()`: Find conflicting filter usage

**Filter Routing Analysis:**
```typescript
// $D417 bits 0-2 select which voices route through filter
// Bit 0 = Voice 1, Bit 1 = Voice 2, Bit 2 = Voice 3
function getFilteredVoices(resonanceRegValue: number): Set<0 | 1 | 2> {
  const voices = new Set<0 | 1 | 2>();
  if (resonanceRegValue & 0x01) voices.add(0);
  if (resonanceRegValue & 0x02) voices.add(1);
  if (resonanceRegValue & 0x04) voices.add(2);
  return voices;
}

// $D418 bits 4-6 select filter mode
function getFilterMode(volumeModeRegValue: number): string {
  const mode = (volumeModeRegValue >> 4) & 0x07;
  if (mode & 0x01) return 'lowpass';
  if (mode & 0x02) return 'bandpass';
  if (mode & 0x04) return 'highpass';
  return 'off';
}
```

**Conflict Types:**
- Filter routing conflict (different voices expected in filter)
- Filter mode conflict (different filter modes expected)
- Volume conflict (multiple writes to global volume)

**Tests (5):**
- Detect filter cutoff writes
- Detect filter routing changes
- Detect filter mode changes
- Detect filter routing conflict
- Detect volume conflict

---

### Step 8.16.4: Integration with C64HardwareAnalyzer (1.5h)

**Integrate:**
- Add `SIDConflictAnalyzer` to `C64HardwareAnalyzer`
- Implement `analyzeSound()` method fully
- Add diagnostic codes for SID conflicts
- Generate metadata for sound analysis

**Diagnostic Codes to Add:**
```typescript
// In diagnostics.ts
SID_VOICE_CONFLICT = 'H200',
SID_FILTER_CONFLICT = 'H201',
SID_VOLUME_CONFLICT = 'H202',
SID_IRQ_TIMING = 'H203',
```

**Metadata Keys:**
```typescript
SIDVoiceUsage;       // Set<number> - which voices used
SIDVoiceConflict;    // boolean - conflict detected
SIDFilterInUse;      // boolean - filter enabled
SIDFilterRouting;    // Set<number> - which voices through filter
SIDTimingRequirements; // number - IRQ timing needs
```

**IRQ Timing Analysis:**
- Music players typically need 50Hz (PAL) or 60Hz (NTSC) IRQ
- Detect if function appears to be music player (writes to all 3 voices)
- Warn if IRQ timing not apparent

**Tests (3):**
- Integration with C64HardwareAnalyzer
- Diagnostic generation for conflicts
- Metadata generation

---

## Test File Location

`packages/compiler/src/__tests__/semantic/analysis/hardware/c64/sid-conflicts.test.ts`

## Dependencies

- `C64HardwareAnalyzer` (base class for integration)
- `C64_CONFIG.soundChip` (SID configuration)
- AST type guards for detecting @map declarations
- DiagnosticCode enum for error codes

---

## Reference Files

- VIC-II Timing Analyzer pattern: `packages/compiler/src/semantic/analysis/hardware/c64/vic-ii-timing.ts`
- C64 Hardware Analyzer: `packages/compiler/src/semantic/analysis/hardware/c64/c64-hardware-analyzer.ts`
- C64 Config: `packages/compiler/src/target/configs/c64.ts`

---

## Success Criteria

- [ ] SID register constants correctly defined
- [ ] Voice usage tracking detects all 3 voices
- [ ] Filter conflict detection works
- [ ] Volume conflict detection works
- [ ] Integration with C64HardwareAnalyzer complete
- [ ] 15+ tests passing
- [ ] Diagnostic codes H200-H203 added
- [ ] Metadata generation for sound analysis