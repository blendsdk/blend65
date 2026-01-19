/**
 * SID Resource Conflict Analyzer
 *
 * Detects SID voice and filter resource conflicts for the C64.
 * This is part of Tier 4 (God-Level) hardware analysis.
 *
 * **SID Hardware Constraints:**
 * - Only 3 voices available (Voice 0, 1, 2)
 * - Only 1 filter (shared across all voices)
 * - Filter + voice conflicts cause audio glitches
 * - Interrupt timing affects music/SFX coordination
 *
 * **Analysis Capabilities:**
 * - Voice allocation conflict detection
 * - Filter routing conflict detection
 * - Volume conflict detection
 * - IRQ timing analysis for music/SFX coordination
 *
 * **Integration:**
 * This module is called from `C64HardwareAnalyzer.analyzeSound()`
 * to provide detailed SID conflict analysis.
 *
 * @example
 * ```typescript
 * const analyzer = new SIDConflictAnalyzer(c64Config);
 * const conflicts = analyzer.analyzeVoiceConflicts(ast);
 * const filterIssues = analyzer.analyzeFilterConflicts(ast);
 * ```
 */

import type { SourceLocation } from '../../../../ast/base.js';
import type { TargetConfig } from '../../../../target/config.js';

// ============================================
// SID Register Constants
// ============================================

/**
 * SID base address on the C64
 */
export const SID_BASE = 0xd400;

/**
 * Number of registers per voice (7 registers each)
 */
export const SID_VOICE_OFFSET = 7;

/**
 * SID register addresses for all voices and global registers
 *
 * **Voice Layout (7 registers each):**
 * - Frequency Low/High (2 bytes)
 * - Pulse Width Low/High (2 bytes)
 * - Control Register (1 byte)
 * - Attack/Decay (1 byte)
 * - Sustain/Release (1 byte)
 *
 * **Filter/Volume Registers:**
 * - Filter Cutoff Low/High (2 bytes)
 * - Resonance + Filter Routing (1 byte)
 * - Volume + Filter Mode (1 byte)
 *
 * **Read-Only Registers:**
 * - Voice 3 Waveform Output
 * - Voice 3 Envelope Output
 */
export const SID_REGISTERS = {
  // Voice 1 ($D400-$D406)
  VOICE1_FREQ_LO: 0xd400,
  VOICE1_FREQ_HI: 0xd401,
  VOICE1_PULSE_LO: 0xd402,
  VOICE1_PULSE_HI: 0xd403,
  VOICE1_CONTROL: 0xd404,
  VOICE1_AD: 0xd405,
  VOICE1_SR: 0xd406,

  // Voice 2 ($D407-$D40D)
  VOICE2_FREQ_LO: 0xd407,
  VOICE2_FREQ_HI: 0xd408,
  VOICE2_PULSE_LO: 0xd409,
  VOICE2_PULSE_HI: 0xd40a,
  VOICE2_CONTROL: 0xd40b,
  VOICE2_AD: 0xd40c,
  VOICE2_SR: 0xd40d,

  // Voice 3 ($D40E-$D414)
  VOICE3_FREQ_LO: 0xd40e,
  VOICE3_FREQ_HI: 0xd40f,
  VOICE3_PULSE_LO: 0xd410,
  VOICE3_PULSE_HI: 0xd411,
  VOICE3_CONTROL: 0xd412,
  VOICE3_AD: 0xd413,
  VOICE3_SR: 0xd414,

  // Filter and Volume ($D415-$D418)
  FILTER_CUTOFF_LO: 0xd415,
  FILTER_CUTOFF_HI: 0xd416,
  FILTER_RESONANCE: 0xd417,
  VOLUME_MODE: 0xd418,

  // Read-Only ($D41B-$D41C)
  VOICE3_WAVEFORM: 0xd41b,
  VOICE3_ENVELOPE: 0xd41c,
} as const;

/**
 * SID address range
 */
export const SID_ADDRESS_RANGE = {
  START: 0xd400,
  END: 0xd41c,
} as const;

// ============================================
// Voice Types
// ============================================

/**
 * SID voice number (0, 1, or 2)
 */
export type SIDVoiceNumber = 0 | 1 | 2;

/**
 * SID register type categorization
 */
export enum SIDRegisterType {
  /** Voice frequency registers */
  FREQUENCY = 'frequency',
  /** Voice pulse width registers */
  PULSE_WIDTH = 'pulse_width',
  /** Voice control register (waveform, gate, sync, ring) */
  CONTROL = 'control',
  /** Voice envelope registers (AD, SR) */
  ENVELOPE = 'envelope',
  /** Filter cutoff frequency */
  FILTER_CUTOFF = 'filter_cutoff',
  /** Filter resonance and routing */
  FILTER_RESONANCE = 'filter_resonance',
  /** Volume and filter mode */
  VOLUME_MODE = 'volume_mode',
  /** Read-only registers */
  READ_ONLY = 'read_only',
  /** Unknown/invalid */
  UNKNOWN = 'unknown',
}

/**
 * Information about a SID register
 */
export interface SIDRegisterInfo {
  /** Address of the register */
  readonly address: number;
  /** Type of register */
  readonly type: SIDRegisterType;
  /** Voice number (null for global registers) */
  readonly voice: SIDVoiceNumber | null;
  /** Human-readable name */
  readonly name: string;
  /** Is this register read-only? */
  readonly readOnly: boolean;
}

// ============================================
// Voice Usage Tracking
// ============================================

/**
 * Tracks usage of a single SID voice
 */
export interface VoiceUsage {
  /** Voice number (0, 1, or 2) */
  readonly voice: SIDVoiceNumber;
  /** Functions that write to this voice */
  readonly usedBy: string[];
  /** Source locations of writes */
  readonly locations: SourceLocation[];
  /** Which registers have been written */
  readonly registers: Set<number>;
  /** First write location (for conflict reporting) */
  readonly firstWriteLocation: SourceLocation | null;
}

/**
 * Voice conflict information
 */
export interface VoiceConflict {
  /** Voice number with conflict */
  readonly voice: SIDVoiceNumber;
  /** Functions conflicting over this voice */
  readonly functions: string[];
  /** Locations of conflicting writes */
  readonly locations: SourceLocation[];
  /** Severity of the conflict */
  readonly severity: 'error' | 'warning';
  /** Human-readable message */
  readonly message: string;
}

// ============================================
// Filter Usage Tracking
// ============================================

/**
 * Filter mode values from $D418 bits 4-6
 */
export enum SIDFilterMode {
  /** Filter disabled */
  OFF = 0,
  /** Low-pass filter */
  LOW_PASS = 1,
  /** Band-pass filter */
  BAND_PASS = 2,
  /** High-pass filter */
  HIGH_PASS = 4,
  /** Multiple modes combined */
  COMBINED = 7,
}

/**
 * Tracks usage of the SID filter
 */
export interface FilterUsage {
  /** Which voices are routed through filter */
  readonly routedVoices: Set<SIDVoiceNumber>;
  /** Current filter mode */
  readonly filterMode: SIDFilterMode | 'unknown';
  /** Functions that modify filter settings */
  readonly usedBy: string[];
  /** Source locations of filter modifications */
  readonly locations: SourceLocation[];
  /** Is filter cutoff being modified? */
  readonly cutoffModified: boolean;
  /** Is resonance being modified? */
  readonly resonanceModified: boolean;
}

/**
 * Filter conflict information
 */
export interface FilterConflict {
  /** Type of filter conflict */
  readonly conflictType: 'routing' | 'mode' | 'cutoff' | 'resonance';
  /** Functions conflicting over filter settings */
  readonly functions: string[];
  /** Locations of conflicting writes */
  readonly locations: SourceLocation[];
  /** Severity of the conflict */
  readonly severity: 'error' | 'warning';
  /** Human-readable message */
  readonly message: string;
}

// ============================================
// Volume Conflict Tracking
// ============================================

/**
 * Volume conflict information
 */
export interface VolumeConflict {
  /** Functions conflicting over volume control */
  readonly functions: string[];
  /** Locations of conflicting writes */
  readonly locations: SourceLocation[];
  /** Severity of the conflict */
  readonly severity: 'warning';
  /** Human-readable message */
  readonly message: string;
}

// ============================================
// SID Analysis Result
// ============================================

/**
 * Complete SID analysis result
 */
export interface SIDAnalysisResult {
  /** Voice usage for each voice */
  readonly voiceUsage: Map<SIDVoiceNumber, VoiceUsage>;
  /** Filter usage information */
  readonly filterUsage: FilterUsage;
  /** Detected voice conflicts */
  readonly voiceConflicts: VoiceConflict[];
  /** Detected filter conflicts */
  readonly filterConflicts: FilterConflict[];
  /** Detected volume conflicts */
  readonly volumeConflicts: VolumeConflict[];
  /** Is any voice being used? */
  readonly hasVoiceUsage: boolean;
  /** Is filter being used? */
  readonly hasFilterUsage: boolean;
  /** Total number of conflicts */
  readonly totalConflicts: number;
}

/**
 * SID timing requirements for IRQ-based music
 */
export interface SIDTimingRequirements {
  /** Estimated IRQ frequency needed (Hz) */
  readonly irqFrequency: number;
  /** Is this code likely a music player? */
  readonly isMusicPlayer: boolean;
  /** Number of voices being used */
  readonly voicesUsed: number;
  /** Recommendation for timing */
  readonly recommendation: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get the voice number for a SID address
 *
 * @param address - SID register address
 * @returns Voice number (0, 1, 2) or null if not a voice register
 */
export function getVoiceForAddress(address: number): SIDVoiceNumber | null {
  if (address >= 0xd400 && address <= 0xd406) return 0;
  if (address >= 0xd407 && address <= 0xd40d) return 1;
  if (address >= 0xd40e && address <= 0xd414) return 2;
  return null;
}

/**
 * Check if an address is a SID register
 *
 * @param address - Address to check
 * @returns True if address is a SID register
 */
export function isSIDAddress(address: number): boolean {
  return address >= SID_ADDRESS_RANGE.START && address <= SID_ADDRESS_RANGE.END;
}

/**
 * Check if an address is a SID voice register
 *
 * @param address - Address to check
 * @returns True if address is a voice register
 */
export function isSIDVoiceRegister(address: number): boolean {
  return getVoiceForAddress(address) !== null;
}

/**
 * Check if an address is a SID filter register
 *
 * @param address - Address to check
 * @returns True if address is a filter register
 */
export function isSIDFilterRegister(address: number): boolean {
  return (
    address === SID_REGISTERS.FILTER_CUTOFF_LO ||
    address === SID_REGISTERS.FILTER_CUTOFF_HI ||
    address === SID_REGISTERS.FILTER_RESONANCE
  );
}

/**
 * Check if an address is the volume/mode register
 *
 * @param address - Address to check
 * @returns True if address is the volume/mode register
 */
export function isSIDVolumeRegister(address: number): boolean {
  return address === SID_REGISTERS.VOLUME_MODE;
}

/**
 * Get register information for a SID address
 *
 * @param address - SID register address
 * @returns Register information or null if not a SID register
 */
export function getSIDRegisterInfo(address: number): SIDRegisterInfo | null {
  if (!isSIDAddress(address)) {
    return null;
  }

  const voice = getVoiceForAddress(address);

  // Voice registers
  if (voice !== null) {
    const voiceOffset = address - (SID_BASE + voice * SID_VOICE_OFFSET);
    const voiceNum = voice + 1; // 1-based for display

    switch (voiceOffset) {
      case 0:
        return {
          address,
          type: SIDRegisterType.FREQUENCY,
          voice,
          name: `Voice ${voiceNum} Frequency Low`,
          readOnly: false,
        };
      case 1:
        return {
          address,
          type: SIDRegisterType.FREQUENCY,
          voice,
          name: `Voice ${voiceNum} Frequency High`,
          readOnly: false,
        };
      case 2:
        return {
          address,
          type: SIDRegisterType.PULSE_WIDTH,
          voice,
          name: `Voice ${voiceNum} Pulse Width Low`,
          readOnly: false,
        };
      case 3:
        return {
          address,
          type: SIDRegisterType.PULSE_WIDTH,
          voice,
          name: `Voice ${voiceNum} Pulse Width High`,
          readOnly: false,
        };
      case 4:
        return {
          address,
          type: SIDRegisterType.CONTROL,
          voice,
          name: `Voice ${voiceNum} Control`,
          readOnly: false,
        };
      case 5:
        return {
          address,
          type: SIDRegisterType.ENVELOPE,
          voice,
          name: `Voice ${voiceNum} Attack/Decay`,
          readOnly: false,
        };
      case 6:
        return {
          address,
          type: SIDRegisterType.ENVELOPE,
          voice,
          name: `Voice ${voiceNum} Sustain/Release`,
          readOnly: false,
        };
    }
  }

  // Filter and volume registers
  switch (address) {
    case SID_REGISTERS.FILTER_CUTOFF_LO:
      return {
        address,
        type: SIDRegisterType.FILTER_CUTOFF,
        voice: null,
        name: 'Filter Cutoff Low',
        readOnly: false,
      };
    case SID_REGISTERS.FILTER_CUTOFF_HI:
      return {
        address,
        type: SIDRegisterType.FILTER_CUTOFF,
        voice: null,
        name: 'Filter Cutoff High',
        readOnly: false,
      };
    case SID_REGISTERS.FILTER_RESONANCE:
      return {
        address,
        type: SIDRegisterType.FILTER_RESONANCE,
        voice: null,
        name: 'Filter Resonance/Routing',
        readOnly: false,
      };
    case SID_REGISTERS.VOLUME_MODE:
      return {
        address,
        type: SIDRegisterType.VOLUME_MODE,
        voice: null,
        name: 'Volume/Filter Mode',
        readOnly: false,
      };
    case SID_REGISTERS.VOICE3_WAVEFORM:
      return {
        address,
        type: SIDRegisterType.READ_ONLY,
        voice: 2,
        name: 'Voice 3 Waveform Output',
        readOnly: true,
      };
    case SID_REGISTERS.VOICE3_ENVELOPE:
      return {
        address,
        type: SIDRegisterType.READ_ONLY,
        voice: 2,
        name: 'Voice 3 Envelope Output',
        readOnly: true,
      };
  }

  return {
    address,
    type: SIDRegisterType.UNKNOWN,
    voice: null,
    name: `Unknown SID Register $${address.toString(16).toUpperCase()}`,
    readOnly: false,
  };
}

/**
 * Get which voices are routed through filter from $D417 value
 *
 * $D417 bits 0-2 select which voices route through filter:
 * - Bit 0 = Voice 1
 * - Bit 1 = Voice 2
 * - Bit 2 = Voice 3
 *
 * @param resonanceRegValue - Value written to $D417
 * @returns Set of voices routed through filter
 */
export function getFilteredVoices(resonanceRegValue: number): Set<SIDVoiceNumber> {
  const voices = new Set<SIDVoiceNumber>();
  if (resonanceRegValue & 0x01) voices.add(0);
  if (resonanceRegValue & 0x02) voices.add(1);
  if (resonanceRegValue & 0x04) voices.add(2);
  return voices;
}

/**
 * Get filter mode from $D418 value
 *
 * $D418 bits 4-6 select filter mode:
 * - Bit 4 = Low-pass
 * - Bit 5 = Band-pass
 * - Bit 6 = High-pass
 *
 * @param volumeModeRegValue - Value written to $D418
 * @returns Filter mode
 */
export function getFilterMode(volumeModeRegValue: number): SIDFilterMode {
  const mode = (volumeModeRegValue >> 4) & 0x07;
  if (mode === 0) return SIDFilterMode.OFF;
  if (mode === 1) return SIDFilterMode.LOW_PASS;
  if (mode === 2) return SIDFilterMode.BAND_PASS;
  if (mode === 4) return SIDFilterMode.HIGH_PASS;
  return SIDFilterMode.COMBINED;
}

/**
 * Get volume from $D418 value
 *
 * $D418 bits 0-3 contain volume (0-15)
 *
 * @param volumeModeRegValue - Value written to $D418
 * @returns Volume level (0-15)
 */
export function getVolume(volumeModeRegValue: number): number {
  return volumeModeRegValue & 0x0f;
}

// ============================================
// SID Conflict Analyzer Class (Placeholder for Step 8.16.2+)
// ============================================

/**
 * SID Conflict Analyzer
 *
 * Provides SID voice and filter conflict analysis
 * for C64 sound hardware operations.
 *
 * **Usage:**
 * 1. Create analyzer with target config
 * 2. Use `trackVoiceWrite()` to record voice register writes
 * 3. Use `trackFilterWrite()` to record filter register writes
 * 4. Use `analyzeConflicts()` to detect conflicts
 *
 * **Integration with C64HardwareAnalyzer:**
 * This class provides the core SID analysis logic that
 * `C64HardwareAnalyzer.analyzeSound()` uses for Tier 4 analysis.
 */
export class SIDConflictAnalyzer {
  /** Target configuration */
  protected readonly targetConfig: TargetConfig;

  /** Voice usage tracking */
  protected voiceUsage: Map<SIDVoiceNumber, VoiceUsage>;

  /** Filter usage tracking */
  protected filterUsage: FilterUsage;

  /** Volume write tracking */
  protected volumeWrites: Array<{ functionName: string; location: SourceLocation }>;

  /** Detected conflicts */
  protected conflicts: {
    voice: VoiceConflict[];
    filter: FilterConflict[];
    volume: VolumeConflict[];
  };

  /**
   * Creates a SID conflict analyzer
   *
   * @param targetConfig - C64 target configuration
   */
  constructor(targetConfig: TargetConfig) {
    this.targetConfig = targetConfig;
    this.voiceUsage = new Map();
    this.filterUsage = this.createEmptyFilterUsage();
    this.volumeWrites = [];
    this.conflicts = {
      voice: [],
      filter: [],
      volume: [],
    };

    // Initialize voice usage for all 3 voices
    this.initializeVoiceUsage();
  }

  /**
   * Initialize voice usage tracking for all 3 voices
   */
  protected initializeVoiceUsage(): void {
    for (const voice of [0, 1, 2] as SIDVoiceNumber[]) {
      this.voiceUsage.set(voice, {
        voice,
        usedBy: [],
        locations: [],
        registers: new Set(),
        firstWriteLocation: null,
      });
    }
  }

  /**
   * Create empty filter usage structure
   */
  protected createEmptyFilterUsage(): FilterUsage {
    return {
      routedVoices: new Set(),
      filterMode: 'unknown',
      usedBy: [],
      locations: [],
      cutoffModified: false,
      resonanceModified: false,
    };
  }

  /**
   * Reset analyzer state for new analysis
   */
  public reset(): void {
    this.voiceUsage.clear();
    this.filterUsage = this.createEmptyFilterUsage();
    this.volumeWrites = [];
    this.conflicts = {
      voice: [],
      filter: [],
      volume: [],
    };
    this.initializeVoiceUsage();
  }

  /**
   * Get voice usage for a specific voice
   *
   * @param voice - Voice number
   * @returns Voice usage information
   */
  public getVoiceUsage(voice: SIDVoiceNumber): VoiceUsage | undefined {
    return this.voiceUsage.get(voice);
  }

  /**
   * Get all voice usage information
   *
   * @returns Map of voice number to usage
   */
  public getAllVoiceUsage(): Map<SIDVoiceNumber, VoiceUsage> {
    return new Map(this.voiceUsage);
  }

  /**
   * Get filter usage information
   *
   * @returns Filter usage
   */
  public getFilterUsage(): FilterUsage {
    return { ...this.filterUsage };
  }

  /**
   * Get all detected voice conflicts
   *
   * @returns Array of voice conflicts
   */
  public getVoiceConflicts(): VoiceConflict[] {
    return [...this.conflicts.voice];
  }

  /**
   * Get all detected filter conflicts
   *
   * @returns Array of filter conflicts
   */
  public getFilterConflicts(): FilterConflict[] {
    return [...this.conflicts.filter];
  }

  /**
   * Get all detected volume conflicts
   *
   * @returns Array of volume conflicts
   */
  public getVolumeConflicts(): VolumeConflict[] {
    return [...this.conflicts.volume];
  }

  /**
   * Check if any conflicts were detected
   *
   * @returns True if conflicts exist
   */
  public hasConflicts(): boolean {
    return (
      this.conflicts.voice.length > 0 ||
      this.conflicts.filter.length > 0 ||
      this.conflicts.volume.length > 0
    );
  }

  /**
   * Get total number of conflicts
   *
   * @returns Total conflict count
   */
  public getTotalConflicts(): number {
    return (
      this.conflicts.voice.length + this.conflicts.filter.length + this.conflicts.volume.length
    );
  }

  // ============================================
  // Voice Usage Tracking (Step 8.16.2)
  // ============================================

  /**
   * Track a write to a voice register
   *
   * Records which function writes to which voice registers.
   * This information is used to detect voice allocation conflicts.
   *
   * @param address - SID register address being written
   * @param functionName - Name of function performing the write
   * @param location - Source location of the write
   */
  public trackVoiceWrite(address: number, functionName: string, location: SourceLocation): void {
    const voice = getVoiceForAddress(address);
    if (voice === null) {
      return; // Not a voice register
    }

    const usage = this.voiceUsage.get(voice);
    if (!usage) {
      return; // Should not happen, but guard against it
    }

    // Create mutable copy for update
    const updatedUsage: VoiceUsage = {
      voice: usage.voice,
      usedBy: usage.usedBy.includes(functionName) ? usage.usedBy : [...usage.usedBy, functionName],
      locations: [...usage.locations, location],
      registers: new Set([...usage.registers, address]),
      firstWriteLocation: usage.firstWriteLocation ?? location,
    };

    this.voiceUsage.set(voice, updatedUsage);
  }

  /**
   * Track multiple voice writes from a @map declaration
   *
   * When a @map declaration covers voice registers, this method
   * records all affected registers for the declaring function.
   *
   * @param startAddress - Start address of @map range
   * @param endAddress - End address of @map range
   * @param functionName - Name of function/context with the @map
   * @param location - Source location of the @map declaration
   */
  public trackVoiceWriteRange(
    startAddress: number,
    endAddress: number,
    functionName: string,
    location: SourceLocation
  ): void {
    for (let addr = startAddress; addr <= endAddress; addr++) {
      if (isSIDVoiceRegister(addr)) {
        this.trackVoiceWrite(addr, functionName, location);
      }
    }
  }

  /**
   * Analyze voice usage and detect conflicts
   *
   * Checks all voices for allocation conflicts where multiple
   * functions write to the same voice registers.
   *
   * **Conflict Severity:**
   * - 'error': Multiple functions write to same control register
   * - 'warning': Multiple functions write to same frequency/envelope
   *
   * @returns Array of detected voice conflicts
   */
  public analyzeVoiceConflicts(): VoiceConflict[] {
    this.conflicts.voice = [];

    for (const [voice, usage] of this.voiceUsage) {
      // Check if multiple functions write to this voice
      if (usage.usedBy.length > 1) {
        // Determine severity based on which registers are shared
        const hasControlConflict = usage.registers.has(
          SID_REGISTERS.VOICE1_CONTROL + voice * SID_VOICE_OFFSET
        );

        const conflict: VoiceConflict = {
          voice,
          functions: [...usage.usedBy],
          locations: [...usage.locations],
          severity: hasControlConflict ? 'error' : 'warning',
          message: this.formatVoiceConflictMessage(voice, usage.usedBy, hasControlConflict),
        };

        this.conflicts.voice.push(conflict);
      }
    }

    return this.getVoiceConflicts();
  }

  /**
   * Format a human-readable voice conflict message
   *
   * @param voice - Voice number with conflict
   * @param functions - Functions conflicting over the voice
   * @param isControlConflict - Whether conflict involves control register
   * @returns Formatted message
   */
  protected formatVoiceConflictMessage(
    voice: SIDVoiceNumber,
    functions: string[],
    isControlConflict: boolean
  ): string {
    const voiceNum = voice + 1; // 1-based for display
    const funcList = functions.map(f => `'${f}'`).join(', ');

    if (isControlConflict) {
      return (
        `SID Voice ${voiceNum} control register conflict: ` +
        `Functions ${funcList} all write to Voice ${voiceNum} control ($D4${(0x04 + voice * 7).toString(16).toUpperCase().padStart(2, '0')}). ` +
        `This will cause audio glitches when both functions run.`
      );
    }

    return (
      `SID Voice ${voiceNum} allocation conflict: ` +
      `Functions ${funcList} all write to Voice ${voiceNum} registers. ` +
      `Consider dedicating each voice to a single purpose (music/SFX).`
    );
  }

  /**
   * Check if a specific voice is used
   *
   * @param voice - Voice number to check
   * @returns True if voice has any writes recorded
   */
  public isVoiceUsed(voice: SIDVoiceNumber): boolean {
    const usage = this.voiceUsage.get(voice);
    return usage !== undefined && usage.usedBy.length > 0;
  }

  /**
   * Get count of voices being used
   *
   * @returns Number of voices with recorded writes (0-3)
   */
  public getUsedVoiceCount(): number {
    let count = 0;
    for (const voice of [0, 1, 2] as SIDVoiceNumber[]) {
      if (this.isVoiceUsed(voice)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get set of used voices
   *
   * @returns Set of voice numbers that have recorded writes
   */
  public getUsedVoices(): Set<SIDVoiceNumber> {
    const used = new Set<SIDVoiceNumber>();
    for (const voice of [0, 1, 2] as SIDVoiceNumber[]) {
      if (this.isVoiceUsed(voice)) {
        used.add(voice);
      }
    }
    return used;
  }

  // ============================================
  // Filter Usage Tracking (Step 8.16.3)
  // ============================================

  /**
   * Track a write to a filter register
   *
   * Records which function modifies filter settings.
   * This information is used to detect filter conflicts.
   *
   * @param address - SID register address being written
   * @param functionName - Name of function performing the write
   * @param location - Source location of the write
   * @param value - Optional value being written (for routing/mode analysis)
   */
  public trackFilterWrite(
    address: number,
    functionName: string,
    location: SourceLocation,
    value?: number
  ): void {
    if (!isSIDFilterRegister(address)) {
      return; // Not a filter register
    }

    // Update filter usage
    const usedBy = this.filterUsage.usedBy.includes(functionName)
      ? this.filterUsage.usedBy
      : [...this.filterUsage.usedBy, functionName];

    const locations = [...this.filterUsage.locations, location];

    // Determine what's being modified
    const cutoffModified =
      this.filterUsage.cutoffModified ||
      address === SID_REGISTERS.FILTER_CUTOFF_LO ||
      address === SID_REGISTERS.FILTER_CUTOFF_HI;

    const resonanceModified =
      this.filterUsage.resonanceModified || address === SID_REGISTERS.FILTER_RESONANCE;

    // Extract routing info from $D417 if value is provided
    let routedVoices = new Set(this.filterUsage.routedVoices);
    if (address === SID_REGISTERS.FILTER_RESONANCE && value !== undefined) {
      routedVoices = getFilteredVoices(value);
    }

    this.filterUsage = {
      routedVoices,
      filterMode: this.filterUsage.filterMode,
      usedBy,
      locations,
      cutoffModified,
      resonanceModified,
    };
  }

  /**
   * Track a write to the volume/mode register
   *
   * Records which function modifies volume and filter mode.
   * This information is used to detect volume and filter mode conflicts.
   *
   * @param functionName - Name of function performing the write
   * @param location - Source location of the write
   * @param value - Optional value being written (for mode analysis)
   */
  public trackVolumeWrite(functionName: string, location: SourceLocation, value?: number): void {
    this.volumeWrites.push({ functionName, location });

    // Extract filter mode from $D418 if value is provided
    if (value !== undefined) {
      const mode = getFilterMode(value);
      this.filterUsage = {
        ...this.filterUsage,
        filterMode: mode,
        usedBy: this.filterUsage.usedBy.includes(functionName)
          ? this.filterUsage.usedBy
          : [...this.filterUsage.usedBy, functionName],
        locations: [...this.filterUsage.locations, location],
      };
    }
  }

  /**
   * Analyze filter usage and detect conflicts
   *
   * Checks for filter conflicts where multiple functions
   * modify filter settings in incompatible ways.
   *
   * **Conflict Types:**
   * - 'routing': Different functions set different filter routing
   * - 'mode': Different functions set different filter modes
   * - 'cutoff': Multiple functions modify cutoff frequency
   * - 'resonance': Multiple functions modify resonance
   *
   * @returns Array of detected filter conflicts
   */
  public analyzeFilterConflicts(): FilterConflict[] {
    this.conflicts.filter = [];

    // Check if multiple functions modify filter settings
    if (this.filterUsage.usedBy.length > 1) {
      // Cutoff conflict
      if (this.filterUsage.cutoffModified) {
        this.conflicts.filter.push({
          conflictType: 'cutoff',
          functions: [...this.filterUsage.usedBy],
          locations: [...this.filterUsage.locations],
          severity: 'warning',
          message: this.formatFilterConflictMessage('cutoff', this.filterUsage.usedBy),
        });
      }

      // Resonance/routing conflict
      if (this.filterUsage.resonanceModified) {
        this.conflicts.filter.push({
          conflictType: 'resonance',
          functions: [...this.filterUsage.usedBy],
          locations: [...this.filterUsage.locations],
          severity: 'warning',
          message: this.formatFilterConflictMessage('resonance', this.filterUsage.usedBy),
        });
      }
    }

    return this.getFilterConflicts();
  }

  /**
   * Analyze volume usage and detect conflicts
   *
   * Checks for volume conflicts where multiple functions
   * modify the global volume register.
   *
   * @returns Array of detected volume conflicts
   */
  public analyzeVolumeConflicts(): VolumeConflict[] {
    this.conflicts.volume = [];

    // Get unique functions that write to volume
    const volumeFunctions = [...new Set(this.volumeWrites.map(w => w.functionName))];

    if (volumeFunctions.length > 1) {
      this.conflicts.volume.push({
        functions: volumeFunctions,
        locations: this.volumeWrites.map(w => w.location),
        severity: 'warning',
        message: this.formatVolumeConflictMessage(volumeFunctions),
      });
    }

    return this.getVolumeConflicts();
  }

  /**
   * Format a human-readable filter conflict message
   *
   * @param conflictType - Type of filter conflict
   * @param functions - Functions conflicting over filter
   * @returns Formatted message
   */
  protected formatFilterConflictMessage(
    conflictType: 'routing' | 'mode' | 'cutoff' | 'resonance',
    functions: string[]
  ): string {
    const funcList = functions.map(f => `'${f}'`).join(', ');

    switch (conflictType) {
      case 'routing':
        return (
          `SID filter routing conflict: Functions ${funcList} set different filter routing. ` +
          `Only one filter routing configuration can be active at a time.`
        );
      case 'mode':
        return (
          `SID filter mode conflict: Functions ${funcList} set different filter modes. ` +
          `Consider coordinating filter mode changes to avoid audio glitches.`
        );
      case 'cutoff':
        return (
          `SID filter cutoff conflict: Functions ${funcList} all modify filter cutoff ($D415-$D416). ` +
          `This may cause unexpected filter sweeps when both functions run.`
        );
      case 'resonance':
        return (
          `SID filter resonance/routing conflict: Functions ${funcList} all modify filter resonance ($D417). ` +
          `This may cause unexpected voice routing when both functions run.`
        );
    }
  }

  /**
   * Format a human-readable volume conflict message
   *
   * @param functions - Functions conflicting over volume
   * @returns Formatted message
   */
  protected formatVolumeConflictMessage(functions: string[]): string {
    const funcList = functions.map(f => `'${f}'`).join(', ');
    return (
      `SID volume conflict: Functions ${funcList} all modify global volume ($D418). ` +
      `Consider using a single volume control function to prevent volume jumps.`
    );
  }

  /**
   * Check if filter is being used
   *
   * @returns True if filter has any modifications recorded
   */
  public isFilterUsed(): boolean {
    return this.filterUsage.usedBy.length > 0;
  }

  /**
   * Check if volume is being modified by multiple functions
   *
   * @returns True if multiple functions write to volume
   */
  public hasVolumeConflict(): boolean {
    const uniqueFunctions = new Set(this.volumeWrites.map(w => w.functionName));
    return uniqueFunctions.size > 1;
  }

  // ============================================
  // Complete Analysis (Step 8.16.4 Preparation)
  // ============================================

  /**
   * Analyze all SID conflicts
   *
   * Runs all conflict detection analyses and returns a complete result.
   *
   * @returns Complete SID analysis result
   */
  public analyzeAllConflicts(): SIDAnalysisResult {
    // Run all conflict analyses
    this.analyzeVoiceConflicts();
    this.analyzeFilterConflicts();
    this.analyzeVolumeConflicts();

    return {
      voiceUsage: this.getAllVoiceUsage(),
      filterUsage: this.getFilterUsage(),
      voiceConflicts: this.getVoiceConflicts(),
      filterConflicts: this.getFilterConflicts(),
      volumeConflicts: this.getVolumeConflicts(),
      hasVoiceUsage: this.getUsedVoiceCount() > 0,
      hasFilterUsage: this.isFilterUsed(),
      totalConflicts: this.getTotalConflicts(),
    };
  }

  /**
   * Estimate IRQ timing requirements based on voice usage
   *
   * Detects if code appears to be a music player and
   * estimates the IRQ frequency needed.
   *
   * **Music Player Detection:**
   * - Uses all 3 voices
   * - Writes to control registers for all voices
   * - Likely needs 50Hz (PAL) or 60Hz (NTSC) IRQ
   *
   * @returns SID timing requirements
   */
  public estimateTimingRequirements(): SIDTimingRequirements {
    const voicesUsed = this.getUsedVoiceCount();
    const usedVoices = this.getUsedVoices();

    // Check if all 3 voices are used (likely a music player)
    const isMusicPlayer = voicesUsed === 3;

    // Estimate IRQ frequency based on usage pattern
    let irqFrequency: number;
    let recommendation: string;

    if (isMusicPlayer) {
      // Music players typically need 50Hz (PAL) IRQ
      irqFrequency = 50;
      recommendation =
        'This appears to be a music player. Ensure IRQ is set up for 50Hz (PAL) or 60Hz (NTSC) updates.';
    } else if (voicesUsed > 0) {
      // SFX typically need less frequent updates
      irqFrequency = 25;
      recommendation =
        `Using ${voicesUsed} voice(s) for sound effects. Consider voice allocation to avoid conflicts with music.`;
    } else {
      irqFrequency = 0;
      recommendation = 'No SID voice usage detected.';
    }

    // Check for voice allocation that suggests music vs SFX
    if (voicesUsed === 1 && !isMusicPlayer) {
      const usedVoice = [...usedVoices][0];
      recommendation =
        `Single voice ${usedVoice + 1} in use. This is ideal for SFX that won't interfere with music.`;
    }

    return {
      irqFrequency,
      isMusicPlayer,
      voicesUsed,
      recommendation,
    };
  }
}