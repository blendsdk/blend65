/**
 * Smart Pattern Registry - Memory-Efficient Pattern Management
 * Smart Modular Architecture - Registry implementation (under 250 lines)
 *
 * This file implements the core pattern registry with:
 * - Lazy loading of pattern modules
 * - Memory-efficient LRU cache
 * - Synchronous loading (no async/await)
 * - Smart memory management
 */

import type {
  OptimizationPattern,
  PatternLoadResult,
  PatternRegistryConfig,
} from './pattern-types';

// Import enums as values (not types) since we need them at runtime
import { PatternCategory, TargetPlatform } from './pattern-types';

// ============================================================================
// PATTERN METADATA
// ============================================================================

interface PatternMetadata {
  id: string;
  category: PatternCategory;
  platforms: TargetPlatform[];
  priority: number;
  lastAccessed: number;
}

// ============================================================================
// SMART PATTERN REGISTRY
// ============================================================================

/**
 * Smart pattern registry with lazy loading and memory management.
 */
export class SmartPatternRegistry {
  private activePatterns = new Map<string, OptimizationPattern>();
  private loadedCategories = new Set<PatternCategory>();
  private patternAccessOrder: string[] = [];
  private patternMetadata = new Map<string, PatternMetadata>();

  constructor(private config: PatternRegistryConfig) {
    this.initializeBasicPatterns();
  }

  /**
   * Get a pattern by ID, loading it if necessary.
   */
  getPattern(patternId: string): OptimizationPattern | null {
    // Try to get from active patterns first
    if (this.activePatterns.has(patternId)) {
      this.updateAccessOrder(patternId);
      return this.activePatterns.get(patternId)!;
    }

    // Try to load the pattern
    const pattern = this.loadSinglePattern(patternId);
    if (pattern) {
      this.addToActivePatterns(pattern);
      return pattern;
    }

    return null;
  }

  /**
   * Get all patterns for a category, loading if necessary.
   */
  getPatternsByCategory(category: PatternCategory): OptimizationPattern[] {
    if (!this.loadedCategories.has(category)) {
      this.loadPatternCategory(category);
    }

    return Array.from(this.activePatterns.values()).filter(
      pattern => pattern.category === category
    );
  }

  /**
   * Get patterns for a specific platform.
   */
  getPatternsByPlatform(platform: TargetPlatform): OptimizationPattern[] {
    const patterns: OptimizationPattern[] = [];

    for (const pattern of this.activePatterns.values()) {
      if (pattern.platforms.includes(platform)) {
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  /**
   * Load all patterns in a category.
   */
  loadPatternCategory(category: PatternCategory): PatternLoadResult {
    if (this.loadedCategories.has(category)) {
      return { success: true, patternsLoaded: 0 };
    }

    try {
      const patterns = this.loadCategoryPatterns(category);
      let loadedCount = 0;

      for (const pattern of patterns) {
        this.addToActivePatterns(pattern);
        loadedCount++;
      }

      this.loadedCategories.add(category);

      return {
        success: true,
        patternsLoaded: loadedCount,
      };
    } catch (error) {
      return {
        success: false,
        patternsLoaded: 0,
        errors: [`Failed to load category ${category}: ${error}`],
      };
    }
  }

  /**
   * Clear patterns to free memory.
   */
  clearPatterns(category?: PatternCategory): void {
    if (category) {
      // Clear specific category
      for (const [id, pattern] of this.activePatterns.entries()) {
        if (pattern.category === category) {
          this.activePatterns.delete(id);
          this.removeFromAccessOrder(id);
        }
      }
      this.loadedCategories.delete(category);
    } else {
      // Clear all patterns
      this.activePatterns.clear();
      this.loadedCategories.clear();
      this.patternAccessOrder = [];
    }
  }

  /**
   * Get registry statistics.
   */
  getStats() {
    return {
      activePatterns: this.activePatterns.size,
      loadedCategories: this.loadedCategories.size,
      memoryUsage: this.estimateMemoryUsage(),
      categoriesLoaded: Array.from(this.loadedCategories),
    };
  }

  // ========================================================================
  // PRIVATE IMPLEMENTATION
  // ========================================================================

  /**
   * Initialize basic patterns that are always loaded.
   */
  private initializeBasicPatterns(): void {
    // Basic patterns are always loaded for immediate access
    const basicPatterns = this.createBasicPatterns();
    for (const pattern of basicPatterns) {
      this.activePatterns.set(pattern.id, pattern);
      this.patternMetadata.set(pattern.id, {
        id: pattern.id,
        category: pattern.category,
        platforms: pattern.platforms,
        priority: pattern.priority,
        lastAccessed: Date.now(),
      });
    }
    this.loadedCategories.add(PatternCategory.BASIC);
  }

  /**
   * Load patterns for a specific category (synchronous).
   */
  private loadCategoryPatterns(category: PatternCategory): OptimizationPattern[] {
    switch (category) {
      case PatternCategory.MATHEMATICS:
        return this.createMathematicsPatterns();
      case PatternCategory.HARDWARE:
        return this.createHardwarePatterns();
      case PatternCategory.CONTROL_FLOW:
        return this.createControlFlowPatterns();
      case PatternCategory.MEMORY:
        return this.createMemoryPatterns();
      case PatternCategory.BASIC:
        return this.createBasicPatterns();
      default:
        return [];
    }
  }

  /**
   * Load a single pattern by ID.
   */
  private loadSinglePattern(patternId: string): OptimizationPattern | null {
    // Try to find pattern in all categories
    const allCategories = Object.values(PatternCategory);

    for (const category of allCategories) {
      const patterns = this.loadCategoryPatterns(category);
      const pattern = patterns.find(p => p.id === patternId);
      if (pattern) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * Add pattern to active patterns with memory management.
   */
  private addToActivePatterns(pattern: OptimizationPattern): void {
    // Check if we need to free memory first
    if (this.activePatterns.size >= this.config.maxActivePatterns) {
      this.freeOldestPattern();
    }

    this.activePatterns.set(pattern.id, pattern);
    this.updateAccessOrder(pattern.id);

    this.patternMetadata.set(pattern.id, {
      id: pattern.id,
      category: pattern.category,
      platforms: pattern.platforms,
      priority: pattern.priority,
      lastAccessed: Date.now(),
    });
  }

  /**
   * Update access order for LRU cache.
   */
  private updateAccessOrder(patternId: string): void {
    // Remove from current position
    this.removeFromAccessOrder(patternId);
    // Add to end (most recently used)
    this.patternAccessOrder.push(patternId);
  }

  /**
   * Remove pattern from access order.
   */
  private removeFromAccessOrder(patternId: string): void {
    const index = this.patternAccessOrder.indexOf(patternId);
    if (index > -1) {
      this.patternAccessOrder.splice(index, 1);
    }
  }

  /**
   * Free the oldest (least recently used) pattern.
   */
  private freeOldestPattern(): void {
    if (this.patternAccessOrder.length > 0) {
      const oldestId = this.patternAccessOrder[0];
      const pattern = this.activePatterns.get(oldestId);

      // Don't free basic patterns
      if (pattern && pattern.category !== PatternCategory.BASIC) {
        this.activePatterns.delete(oldestId);
        this.patternMetadata.delete(oldestId);
        this.removeFromAccessOrder(oldestId);
      }
    }
  }

  /**
   * Estimate memory usage.
   */
  private estimateMemoryUsage(): number {
    // Rough estimate: each pattern ~1KB
    return this.activePatterns.size * 1024;
  }

  // ========================================================================
  // PATTERN CREATION METHODS
  // ========================================================================

  private createBasicPatterns(): OptimizationPattern[] {
    // Basic patterns will be implemented in separate pattern files
    return [];
  }

  private createMathematicsPatterns(): OptimizationPattern[] {
    try {
      // Direct import for synchronous loading
      // In the future, this can be made more dynamic when needed
      return this.loadMathematicsPatterns();
    } catch (error) {
      // Graceful fallback if pattern module doesn't exist yet
      return [];
    }
  }

  /**
   * Load mathematics patterns directly.
   */
  private loadMathematicsPatterns(): OptimizationPattern[] {
    // For now, return empty array - patterns will be added incrementally
    // This allows the system to work without requiring all patterns immediately
    return [];
  }

  private createHardwarePatterns(): OptimizationPattern[] {
    // Hardware patterns will be loaded from hardware module
    return [];
  }

  private createControlFlowPatterns(): OptimizationPattern[] {
    // Control flow patterns will be loaded from control flow module
    return [];
  }

  private createMemoryPatterns(): OptimizationPattern[] {
    // Memory patterns will be loaded from memory module
    return [];
  }
}

/**
 * Create a default pattern registry.
 */
export function createPatternRegistry(
  config?: Partial<PatternRegistryConfig>
): SmartPatternRegistry {
  const defaultConfig: PatternRegistryConfig = {
    maxActivePatterns: 50,
    lazyLoading: true,
    cacheSize: 100,
    enableMetrics: true,
  };

  return new SmartPatternRegistry({ ...defaultConfig, ...config });
}
