/**
 * Hardware Optimization Patterns - Entry Point
 *
 * Exports all hardware-specific optimization patterns for C64/C128 VIC/SID chips.
 * This represents the foundation of professional retro development optimization.
 */

// VIC-II Sprite Optimization Patterns
export { getVICSpritePatterns, spriteOptimizationInfo } from './c64/vic-ii/sprite-optimization';

// SID Voice Optimization Patterns
export { getSIDVoicePatterns, sidVoiceOptimizationInfo } from './c64/sid/voice-optimization';

// Export pattern metadata for library management
export const hardwareOptimizationInfo = {
  description: 'Professional VIC-II and SID optimization patterns for C64/C128 development',
  totalPatterns: 19,
  categories: [
    {
      name: 'VIC-II Sprites',
      patterns: 15,
      priority: 'CRITICAL',
      cyclesSavings: '20-150 per optimization',
    },
    {
      name: 'SID Voices',
      patterns: 12,
      priority: 'CRITICAL',
      cyclesSavings: '20-45 per optimization',
    },
  ],
  platforms: ['C64', 'C128'],
  hardwareRequirements: ['VIC_II', 'SID_6581', 'SID_8580', 'DUAL_SID_C128'],
  memoryFootprint: '~7KB total',
};
