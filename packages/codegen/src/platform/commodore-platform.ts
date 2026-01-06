/**
 * Commodore Platform Implementation
 * Provides platform-specific code generation for Commodore 64, VIC-20, and X16
 */

export interface MemoryLayout {
  /** BASIC program start */
  basicStart: number;
  /** Machine code start */
  codeStart: number;
  /** Zero page start */
  zeroPageStart: number;
  /** Zero page end */
  zeroPageEnd: number;
  /** Screen memory */
  screenStart: number;
  /** Color memory */
  colorStart: number;
  /** I/O registers */
  ioStart: number;
  /** I/O registers end */
  ioEnd: number;
}

export interface PlatformSpec {
  /** Platform name */
  name: string;
  /** CPU type */
  cpu: string;
  /** Processor type (alias for cpu) */
  processor: string;
  /** BASIC start address */
  basicStart: number;
  /** Machine language start address */
  mlStart: number;
  /** Memory layout */
  memory: MemoryLayout;
  /** Screen dimensions */
  screen: {
    width: number;
    height: number;
    chars: number;
  };
  /** Platform-specific registers */
  registers: {
    border: number;
    background: number;
    sprite: number[];
  };
}

export interface PlatformStubOptions {
  /** Include BASIC stub for auto-run */
  autoRun: boolean;
  /** BASIC line number */
  lineNumber: number;
  /** Custom SYS address */
  sysAddress?: number;
}

/**
 * Commodore platform abstraction for 6502-based systems
 */
export class CommodorePlatform {
  public readonly specification: PlatformSpec;
  public readonly displayName: string;

  constructor(
    public readonly spec: PlatformSpec,
    public readonly options: PlatformStubOptions = { autoRun: true, lineNumber: 10 }
  ) {
    this.specification = spec;
    this.displayName = spec.name;
  }


  /**
   * Generate program header with platform information
   */
  generateHeader(programName: string): string {
    return `; ============================================================================
; Blend65 Generated Assembly - ${programName}
; Target Platform: ${this.spec.name}
; Generated: ${new Date().toISOString()}
; ============================================================================

!cpu ${this.spec.cpu}        ; Specify processor type
!to "${programName}.prg",cbm  ; Output format`;
  }

  /**
   * Generate program footer with cleanup
   */
  generateFooter(): string {
    return `
; Program cleanup
RTS              ; Return to BASIC`;
  }

  /**
   * Map memory address to platform-specific format
   */
  formatAddress(address: number): string {
    return `$${address.toString(16).toUpperCase()}`;
  }

  /**
   * Allocate zero page memory for variables
   */
  allocateZeroPage(variableName: string): number {
    // Simple allocation strategy - in real implementation would track usage
    const hash = variableName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const offset = hash % (this.spec.memory.zeroPageEnd - this.spec.memory.zeroPageStart);
    return this.spec.memory.zeroPageStart + offset;
  }

  /**
   * Get platform-specific register addresses
   */
  getRegisterAddress(register: 'border' | 'background' | 'sprite0'): number {
    switch (register) {
      case 'border':
        return this.spec.registers.border;
      case 'background':
        return this.spec.registers.background;
      case 'sprite0':
        return this.spec.registers.sprite[0];
      default:
        throw new Error(`Unknown register: ${register}`);
    }
  }

  /**
   * Generate platform-specific optimizations
   */
  generateOptimizedCode(operation: 'clearScreen' | 'setColor' | 'enableSprites'): string[] {
    const result: string[] = [];

    switch (operation) {
      case 'clearScreen':
        result.push('; Fast screen clear');
        result.push('LDA #32          ; Space character');
        result.push('LDX #0           ; Clear index');
        result.push('screen_clear_loop:');
        result.push(`STA ${this.formatAddress(this.spec.memory.screenStart)},X`);
        result.push('INX');
        result.push(`CPX #${this.spec.screen.chars}`);
        result.push('BNE screen_clear_loop');
        break;

      case 'setColor':
        result.push('; Set screen colors');
        result.push('LDA #6           ; Blue');
        result.push(`STA ${this.formatAddress(this.spec.registers.border)}`);
        result.push('LDA #0           ; Black');
        result.push(`STA ${this.formatAddress(this.spec.registers.background)}`);
        break;

      case 'enableSprites':
        result.push('; Enable sprites');
        result.push('LDA #$FF         ; Enable all sprites');
        result.push(`STA ${this.formatAddress(this.spec.registers.sprite[0])}`);
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return result;
  }

  /**
   * Validate memory address for platform
   */
  isValidAddress(address: number): boolean {
    // Check if address is within platform memory ranges
    return (
      (address >= this.spec.memory.zeroPageStart && address <= this.spec.memory.zeroPageEnd) ||
      (address >= this.spec.memory.screenStart && address < this.spec.memory.screenStart + this.spec.screen.chars) ||
      (address >= this.spec.memory.ioStart && address <= this.spec.memory.ioEnd)
    );
  }

  /**
   * Get memory region for address
   */
  getMemoryRegion(address: number): 'zeropage' | 'screen' | 'color' | 'hardware_io' | 'ram' | 'invalid' {
    if (address >= this.spec.memory.zeroPageStart && address <= this.spec.memory.zeroPageEnd) {
      return 'zeropage';
    }
    if (address >= this.spec.memory.screenStart && address < this.spec.memory.screenStart + this.spec.screen.chars) {
      return 'screen';
    }
    if (address >= this.spec.memory.colorStart && address < this.spec.memory.colorStart + this.spec.screen.chars) {
      return 'color';
    }
    if (address >= this.spec.memory.ioStart && address <= this.spec.memory.ioEnd) {
      return 'hardware_io';
    }
    if (this.isValidAddress(address)) {
      return 'ram';
    }
    return 'invalid';
  }

  /**
   * Generate platform comment
   */
  generateComment(text: string): string {
    return `; ${text}`;
  }

  /**
   * Generate BASIC stub with parameters expected by code generator
   */
  generateBasicStub(options: { entryPoint: number; autoRun: boolean; preserveStub: boolean }): string {
    if (!options.autoRun) {
      return '';
    }

    const sysAddress = options.entryPoint;
    const lineNumber = this.options.lineNumber;
    const nextLinePtr = this.spec.memory.basicStart + 13;

    return `; BASIC Stub: ${lineNumber} SYS${sysAddress}
* = $${this.spec.memory.basicStart.toString(16).toUpperCase()}
        !word $${nextLinePtr.toString(16).toUpperCase()}  ; Next line pointer
        !word ${lineNumber}        ; Line number
        !byte $9E       ; SYS token
        !text "${sysAddress}"
        !byte $00       ; End of line
        !word $0000     ; End of program

; Machine code starts here
* = $${sysAddress.toString(16).toUpperCase()}`;
  }

  /**
   * Generate platform cleanup code
   */
  generateCleanup(): string {
    return 'RTS              ; Return to BASIC';
  }
}
