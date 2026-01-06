/**
 * Platform specifications for Commodore 6502-based systems
 * Defines memory layouts, screen dimensions, and hardware registers
 */

import type { PlatformSpec } from './commodore-platform.js';

/**
 * Commodore 64 platform specification
 */
export const C64_SPEC: PlatformSpec = {
  name: 'Commodore 64',
  cpu: '6502',
  processor: '6502',
  basicStart: 0x0801,
  mlStart: 0x0810,
  memory: {
    basicStart: 0x0801,
    codeStart: 0x0810,
    zeroPageStart: 0x02,
    zeroPageEnd: 0x8F,
    screenStart: 0x0400,
    colorStart: 0xD800,
    ioStart: 0xD000,
    ioEnd: 0xDFFF
  },
  screen: {
    width: 40,
    height: 25,
    chars: 1000
  },
  registers: {
    border: 0xD020,
    background: 0xD021,
    sprite: [0xD015, 0xD000, 0xD002, 0xD004, 0xD006, 0xD008, 0xD00A, 0xD00C, 0xD00E]
  }
};

/**
 * VIC-20 platform specification
 */
export const VIC20_SPEC: PlatformSpec = {
  name: 'VIC-20',
  cpu: '6502',
  processor: '6502',
  basicStart: 0x1001,
  mlStart: 0x1010,
  memory: {
    basicStart: 0x1001,
    codeStart: 0x1010,
    zeroPageStart: 0x02,
    zeroPageEnd: 0x8F,
    screenStart: 0x1E00,
    colorStart: 0x9600,
    ioStart: 0x9000,
    ioEnd: 0x9FFF
  },
  screen: {
    width: 22,
    height: 23,
    chars: 506
  },
  registers: {
    border: 0x900F,
    background: 0x900F,
    sprite: [] // VIC-20 has no sprites
  }
};

/**
 * Commodore 128 platform specification (C64 mode)
 */
export const C128_SPEC: PlatformSpec = {
  name: 'Commodore 128 (C64 mode)',
  cpu: '8502',
  processor: '8502',
  basicStart: 0x0801,
  mlStart: 0x0810,
  memory: {
    basicStart: 0x0801,
    codeStart: 0x0810,
    zeroPageStart: 0x02,
    zeroPageEnd: 0x8F,
    screenStart: 0x0400,
    colorStart: 0xD800,
    ioStart: 0xD000,
    ioEnd: 0xDFFF
  },
  screen: {
    width: 40,
    height: 25,
    chars: 1000
  },
  registers: {
    border: 0xD020,
    background: 0xD021,
    sprite: [0xD015, 0xD000, 0xD002, 0xD004, 0xD006, 0xD008, 0xD00A, 0xD00C, 0xD00E]
  }
};

/**
 * Commander X16 platform specification
 */
export const X16_SPEC: PlatformSpec = {
  name: 'Commander X16',
  cpu: '65C02',
  processor: '65C02',
  basicStart: 0x0801,
  mlStart: 0x0810,
  memory: {
    basicStart: 0x0801,
    codeStart: 0x0810,
    zeroPageStart: 0x02,
    zeroPageEnd: 0x7F,
    screenStart: 0x0400,
    colorStart: 0xD800,
    ioStart: 0x9F00,
    ioEnd: 0x9FFF
  },
  screen: {
    width: 80,
    height: 60,
    chars: 4800
  },
  registers: {
    border: 0x9F29,
    background: 0x9F2A,
    sprite: [0x9F10, 0x9F11, 0x9F12, 0x9F13, 0x9F14, 0x9F15, 0x9F16, 0x9F17]
  }
};

/**
 * All supported Commodore platforms
 */
export const COMMODORE_PLATFORMS = {
  c64: C64_SPEC,
  vic20: VIC20_SPEC,
  c128: C128_SPEC,
  x16: X16_SPEC
} as const;

export type SupportedPlatform = keyof typeof COMMODORE_PLATFORMS;

/**
 * Get platform specification by name
 */
export function getPlatformSpec(platform: SupportedPlatform): PlatformSpec {
  const spec = COMMODORE_PLATFORMS[platform];
  if (!spec) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  return spec;
}

/**
 * Get list of all supported platforms
 */
export function getSupportedPlatforms(): SupportedPlatform[] {
  return Object.keys(COMMODORE_PLATFORMS) as SupportedPlatform[];
}

/**
 * Check if platform is supported
 */
export function isPlatformSupported(platform: string): platform is SupportedPlatform {
  return platform in COMMODORE_PLATFORMS;
}

/**
 * Get platform-specific memory layout validation
 */
export function validateMemoryLayout(platform: SupportedPlatform, address: number): {
  valid: boolean;
  region: string;
  platformName: string;
} {
  const spec = getPlatformSpec(platform);
  const region = getMemoryRegion(spec, address);

  return {
    valid: region !== 'invalid',
    region,
    platformName: spec.name
  };
}

/**
 * Helper function to determine memory region for an address
 */
function getMemoryRegion(spec: PlatformSpec, address: number): string {
  if (address >= spec.memory.zeroPageStart && address <= spec.memory.zeroPageEnd) {
    return 'zeropage';
  }
  if (address >= spec.memory.screenStart && address < spec.memory.screenStart + spec.screen.chars) {
    return 'screen';
  }
  if (address >= spec.memory.colorStart && address < spec.memory.colorStart + spec.screen.chars) {
    return 'color';
  }
  if (address >= spec.memory.ioStart && address <= spec.memory.ioEnd) {
    return 'hardware_io';
  }
  if (address >= spec.memory.basicStart && address < spec.memory.codeStart + 0x8000) {
    return 'ram';
  }
  return 'invalid';
}

/**
 * Get optimal addressing mode for memory access on platform
 */
export function getOptimalAddressingMode(platform: SupportedPlatform, address: number): 'zeropage' | 'absolute' {
  const spec = getPlatformSpec(platform);

  if (address >= spec.memory.zeroPageStart && address <= spec.memory.zeroPageEnd) {
    return 'zeropage';
  }

  return 'absolute';
}

/**
 * Platform-specific optimization hints
 */
export const PLATFORM_OPTIMIZATIONS = {
  c64: {
    useZeroPage: true,
    fastMultiply: true,
    spriteHardware: true,
    soundHardware: true
  },
  vic20: {
    useZeroPage: true,
    fastMultiply: false,
    spriteHardware: false,
    soundHardware: true
  },
  c128: {
    useZeroPage: true,
    fastMultiply: true,
    spriteHardware: true,
    soundHardware: true
  },
  x16: {
    useZeroPage: true,
    fastMultiply: true,
    spriteHardware: true,
    soundHardware: true
  }
} as const;
