/**
 * Platform Factory for creating platform instances
 * Provides factory methods for Commodore platform creation
 */

import { CommodorePlatform, type PlatformStubOptions } from './commodore-platform.js';
import { getPlatformSpec, type SupportedPlatform, isPlatformSupported } from './platform-specs.js';

/**
 * Factory for creating platform instances
 */
export class PlatformFactory {
  /**
   * Create a platform instance for the specified target (main entry point)
   */
  static create(target: string, options?: PlatformStubOptions): CommodorePlatform {
    if (!isPlatformSupported(target)) {
      throw new Error(`Unsupported platform: ${target}`);
    }

    return PlatformFactory.createPlatform(target as SupportedPlatform, options);
  }

  /**
   * Create a platform instance for the specified target
   */
  static createPlatform(
    target: SupportedPlatform,
    options?: PlatformStubOptions
  ): CommodorePlatform {
    if (!isPlatformSupported(target)) {
      throw new Error(`Unsupported platform: ${target}`);
    }

    const spec = getPlatformSpec(target);
    const defaultOptions: PlatformStubOptions = {
      autoRun: true,
      lineNumber: 10
    };

    return new CommodorePlatform(spec, { ...defaultOptions, ...options });
  }

  /**
   * Create C64 platform instance
   */
  static createC64(options?: PlatformStubOptions): CommodorePlatform {
    return PlatformFactory.createPlatform('c64', options);
  }

  /**
   * Create VIC-20 platform instance
   */
  static createVIC20(options?: PlatformStubOptions): CommodorePlatform {
    return PlatformFactory.createPlatform('vic20', options);
  }

  /**
   * Create Commander X16 platform instance
   */
  static createX16(options?: PlatformStubOptions): CommodorePlatform {
    return PlatformFactory.createPlatform('x16', options);
  }

  /**
   * Get all available platforms
   */
  static getAvailablePlatforms(): SupportedPlatform[] {
    return ['c64', 'vic20', 'x16'];
  }

  /**
   * Create platform with custom stub configuration
   */
  static createWithCustomStub(
    target: SupportedPlatform,
    lineNumber: number,
    sysAddress?: number
  ): CommodorePlatform {
    return PlatformFactory.createPlatform(target, {
      autoRun: true,
      lineNumber,
      sysAddress
    });
  }

  /**
   * Create platform without auto-run stub
   */
  static createWithoutStub(target: SupportedPlatform): CommodorePlatform {
    return PlatformFactory.createPlatform(target, {
      autoRun: false,
      lineNumber: 10
    });
  }

  /**
   * Validate platform target string
   */
  static validateTarget(target: string): target is SupportedPlatform {
    return isPlatformSupported(target);
  }

  /**
   * Get platform capabilities
   */
  static getPlatformCapabilities(target: SupportedPlatform): {
    hasSprites: boolean;
    hasSID: boolean;
    hasVIC: boolean;
    maxMemory: number;
    screenSize: number;
  } {
    const spec = getPlatformSpec(target);

    return {
      hasSprites: spec.registers.sprite.length > 0,
      hasSID: target === 'c64' || target === 'x16',
      hasVIC: target === 'c64' || target === 'vic20',
      maxMemory: target === 'x16' ? 0x10000 : 0x10000, // 64K for all currently
      screenSize: spec.screen.chars
    };
  }
}
