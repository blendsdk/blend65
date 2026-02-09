# Phase 4: Pattern Registry

> **Document**: 02-pattern-registry.md  
> **Phase**: 4 - IL Peephole  
> **Focus**: Pattern registration, priority management, category organization  
> **Est. Lines**: ~250

---

## Overview

The **Pattern Registry** manages pattern registration, organization by category, and priority-based execution ordering. It serves as the central hub for collecting and managing all optimization patterns.

**Key Responsibilities:**
1. Register patterns by category
2. Manage pattern priorities
3. Provide filtered pattern sets
4. Support pattern enable/disable configuration
5. Generate optimization reports

---

## Registry Interface

### PatternRegistry Class

```typescript
/**
 * Categories for organizing patterns.
 */
export enum PatternCategory {
  /** Load/store elimination patterns */
  LOAD_STORE = 'load-store',
  
  /** Arithmetic identity patterns (x+0, x*1, etc.) */
  ARITHMETIC = 'arithmetic',
  
  /** Strength reduction patterns (x*2→x<<1) */
  STRENGTH_REDUCTION = 'strength-reduction',
  
  /** Comparison simplification patterns */
  COMPARISON = 'comparison',
  
  /** Control flow patterns */
  CONTROL_FLOW = 'control-flow',
  
  /** 6502-specific patterns (used in later phases) */
  TARGET_SPECIFIC = 'target-specific',
  
  /** Miscellaneous patterns */
  MISC = 'misc'
}

/**
 * Configuration for a registered pattern.
 */
export interface PatternConfig {
  /** Pattern instance */
  readonly pattern: Pattern<any>;
  
  /** Category assignment */
  readonly category: PatternCategory;
  
  /** Whether pattern is enabled */
  enabled: boolean;
  
  /** Override priority (if different from pattern default) */
  priorityOverride?: number;
  
  /** Tags for filtering */
  readonly tags: Set<string>;
}

/**
 * Central registry for optimization patterns.
 */
export class PatternRegistry<TInstruction> {
  protected readonly patterns: Map<string, PatternConfig> = new Map();
  protected readonly byCategory: Map<PatternCategory, Set<string>> = new Map();
  protected readonly byTag: Map<string, Set<string>> = new Map();
  
  constructor() {
    // Initialize category sets
    for (const category of Object.values(PatternCategory)) {
      this.byCategory.set(category, new Set());
    }
  }
  
  /**
   * Register a pattern with the registry.
   */
  register(
    pattern: Pattern<TInstruction>,
    category: PatternCategory,
    options: { enabled?: boolean; priorityOverride?: number; tags?: string[] } = {}
  ): this {
    if (this.patterns.has(pattern.name)) {
      throw new Error(`Pattern "${pattern.name}" is already registered`);
    }
    
    const config: PatternConfig = {
      pattern,
      category,
      enabled: options.enabled ?? true,
      priorityOverride: options.priorityOverride,
      tags: new Set(options.tags ?? [])
    };
    
    this.patterns.set(pattern.name, config);
    this.byCategory.get(category)!.add(pattern.name);
    
    for (const tag of config.tags) {
      if (!this.byTag.has(tag)) {
        this.byTag.set(tag, new Set());
      }
      this.byTag.get(tag)!.add(pattern.name);
    }
    
    return this;
  }
  
  /**
   * Unregister a pattern by name.
   */
  unregister(name: string): boolean {
    const config = this.patterns.get(name);
    if (!config) {
      return false;
    }
    
    this.patterns.delete(name);
    this.byCategory.get(config.category)!.delete(name);
    
    for (const tag of config.tags) {
      this.byTag.get(tag)?.delete(name);
    }
    
    return true;
  }
  
  /**
   * Enable or disable a pattern.
   */
  setEnabled(name: string, enabled: boolean): boolean {
    const config = this.patterns.get(name);
    if (!config) {
      return false;
    }
    config.enabled = enabled;
    return true;
  }
  
  /**
   * Enable all patterns in a category.
   */
  enableCategory(category: PatternCategory): void {
    const names = this.byCategory.get(category);
    if (names) {
      for (const name of names) {
        this.setEnabled(name, true);
      }
    }
  }
  
  /**
   * Disable all patterns in a category.
   */
  disableCategory(category: PatternCategory): void {
    const names = this.byCategory.get(category);
    if (names) {
      for (const name of names) {
        this.setEnabled(name, false);
      }
    }
  }
  
  /**
   * Get effective priority for a pattern.
   */
  getEffectivePriority(name: string): number {
    const config = this.patterns.get(name);
    if (!config) {
      throw new Error(`Pattern "${name}" not found`);
    }
    return config.priorityOverride ?? config.pattern.priority;
  }
  
  /**
   * Set priority override for a pattern.
   */
  setPriority(name: string, priority: number): boolean {
    const config = this.patterns.get(name);
    if (!config) {
      return false;
    }
    config.priorityOverride = priority;
    return true;
  }
  
  /**
   * Get all enabled patterns, sorted by priority.
   */
  getEnabledPatterns(): Pattern<TInstruction>[] {
    const enabled: Array<{ pattern: Pattern<TInstruction>; priority: number }> = [];
    
    for (const [name, config] of this.patterns) {
      if (config.enabled) {
        enabled.push({
          pattern: config.pattern as Pattern<TInstruction>,
          priority: this.getEffectivePriority(name)
        });
      }
    }
    
    // Sort by priority (highest first)
    enabled.sort((a, b) => b.priority - a.priority);
    
    return enabled.map(e => e.pattern);
  }
  
  /**
   * Get enabled patterns in a specific category.
   */
  getByCategory(category: PatternCategory): Pattern<TInstruction>[] {
    const names = this.byCategory.get(category);
    if (!names) {
      return [];
    }
    
    const result: Array<{ pattern: Pattern<TInstruction>; priority: number }> = [];
    
    for (const name of names) {
      const config = this.patterns.get(name);
      if (config?.enabled) {
        result.push({
          pattern: config.pattern as Pattern<TInstruction>,
          priority: this.getEffectivePriority(name)
        });
      }
    }
    
    result.sort((a, b) => b.priority - a.priority);
    return result.map(e => e.pattern);
  }
  
  /**
   * Get enabled patterns with a specific tag.
   */
  getByTag(tag: string): Pattern<TInstruction>[] {
    const names = this.byTag.get(tag);
    if (!names) {
      return [];
    }
    
    const result: Array<{ pattern: Pattern<TInstruction>; priority: number }> = [];
    
    for (const name of names) {
      const config = this.patterns.get(name);
      if (config?.enabled) {
        result.push({
          pattern: config.pattern as Pattern<TInstruction>,
          priority: this.getEffectivePriority(name)
        });
      }
    }
    
    result.sort((a, b) => b.priority - a.priority);
    return result.map(e => e.pattern);
  }
  
  /**
   * Get total number of registered patterns.
   */
  get size(): number {
    return this.patterns.size;
  }
  
  /**
   * Get number of enabled patterns.
   */
  get enabledCount(): number {
    let count = 0;
    for (const config of this.patterns.values()) {
      if (config.enabled) {
        count++;
      }
    }
    return count;
  }
  
  /**
   * Check if a pattern is registered.
   */
  has(name: string): boolean {
    return this.patterns.has(name);
  }
  
  /**
   * Get pattern configuration.
   */
  get(name: string): PatternConfig | undefined {
    return this.patterns.get(name);
  }
  
  /**
   * Iterate over all pattern names.
   */
  *names(): IterableIterator<string> {
    yield* this.patterns.keys();
  }
  
  /**
   * Generate registry summary report.
   */
  generateReport(): string {
    const lines: string[] = ['Pattern Registry Report', '='.repeat(40)];
    
    lines.push(`Total patterns: ${this.size}`);
    lines.push(`Enabled patterns: ${this.enabledCount}`);
    lines.push('');
    
    for (const category of Object.values(PatternCategory)) {
      const names = this.byCategory.get(category);
      if (names && names.size > 0) {
        lines.push(`${category}:`);
        for (const name of names) {
          const config = this.patterns.get(name)!;
          const status = config.enabled ? '✓' : '✗';
          const priority = this.getEffectivePriority(name);
          lines.push(`  ${status} ${name} (priority: ${priority})`);
        }
        lines.push('');
      }
    }
    
    return lines.join('\n');
  }
}
```

---

## Pre-configured Registry

### createDefaultILRegistry

```typescript
import { ILInstruction } from '../types.js';

/**
 * Create a registry pre-populated with standard IL patterns.
 */
export function createDefaultILRegistry(): PatternRegistry<ILInstruction> {
  const registry = new PatternRegistry<ILInstruction>();
  
  // Load-Store patterns (highest priority - most impactful)
  registry.register(
    new StoreLoadEliminationPattern(),
    PatternCategory.LOAD_STORE,
    { priority: 100, tags: ['memory', 'redundancy'] }
  );
  
  registry.register(
    new LoadLoadEliminationPattern(),
    PatternCategory.LOAD_STORE,
    { priority: 95, tags: ['memory', 'redundancy'] }
  );
  
  // Arithmetic identity patterns (high priority)
  registry.register(
    new AddZeroPattern(),
    PatternCategory.ARITHMETIC,
    { priority: 80, tags: ['identity', 'trivial'] }
  );
  
  registry.register(
    new MultiplyOnePattern(),
    PatternCategory.ARITHMETIC,
    { priority: 80, tags: ['identity', 'trivial'] }
  );
  
  registry.register(
    new MultiplyZeroPattern(),
    PatternCategory.ARITHMETIC,
    { priority: 85, tags: ['identity', 'trivial'] }
  );
  
  registry.register(
    new SubtractSelfPattern(),
    PatternCategory.ARITHMETIC,
    { priority: 80, tags: ['identity', 'trivial'] }
  );
  
  registry.register(
    new DivideSelfPattern(),
    PatternCategory.ARITHMETIC,
    { priority: 80, tags: ['identity', 'trivial'] }
  );
  
  // Strength reduction patterns (medium priority)
  registry.register(
    new MultiplyPowerOfTwoPattern(),
    PatternCategory.STRENGTH_REDUCTION,
    { priority: 70, tags: ['strength', 'shift'] }
  );
  
  registry.register(
    new DividePowerOfTwoPattern(),
    PatternCategory.STRENGTH_REDUCTION,
    { priority: 70, tags: ['strength', 'shift'] }
  );
  
  registry.register(
    new ModuloPowerOfTwoPattern(),
    PatternCategory.STRENGTH_REDUCTION,
    { priority: 70, tags: ['strength', 'mask'] }
  );
  
  return registry;
}
```

---

## Optimization Level Configuration

### OptimizationLevel Presets

```typescript
/**
 * Optimization level presets.
 */
export enum OptimizationLevel {
  /** No optimization */
  O0 = 'O0',
  
  /** Basic optimization (DCE, constant folding, copy prop) */
  O1 = 'O1',
  
  /** Standard optimization (+ peephole) */
  O2 = 'O2',
  
  /** Aggressive optimization (+ 6502-specific) */
  O3 = 'O3',
  
  /** Size optimization */
  Os = 'Os'
}

/**
 * Configure registry for optimization level.
 */
export function configureForLevel(
  registry: PatternRegistry<any>,
  level: OptimizationLevel
): void {
  // Start with all disabled
  for (const name of registry.names()) {
    registry.setEnabled(name, false);
  }
  
  switch (level) {
    case OptimizationLevel.O0:
      // No patterns enabled
      break;
      
    case OptimizationLevel.O1:
      // Only trivial patterns
      enableByTag(registry, 'trivial');
      break;
      
    case OptimizationLevel.O2:
      // Standard patterns
      registry.enableCategory(PatternCategory.ARITHMETIC);
      registry.enableCategory(PatternCategory.LOAD_STORE);
      registry.enableCategory(PatternCategory.STRENGTH_REDUCTION);
      break;
      
    case OptimizationLevel.O3:
      // All patterns including target-specific
      for (const name of registry.names()) {
        registry.setEnabled(name, true);
      }
      break;
      
    case OptimizationLevel.Os:
      // Size-focused patterns
      registry.enableCategory(PatternCategory.ARITHMETIC);
      registry.enableCategory(PatternCategory.LOAD_STORE);
      // Skip patterns that trade size for speed
      break;
  }
}

/**
 * Enable all patterns with a specific tag.
 */
function enableByTag(registry: PatternRegistry<any>, tag: string): void {
  for (const name of registry.names()) {
    const config = registry.get(name);
    if (config?.tags.has(tag)) {
      registry.setEnabled(name, true);
    }
  }
}
```

---

## Registry Builder Pattern

### Fluent Registry Builder

```typescript
/**
 * Fluent builder for constructing pattern registries.
 */
export class RegistryBuilder<TInstruction> {
  protected readonly registry: PatternRegistry<TInstruction>;
  protected currentCategory: PatternCategory = PatternCategory.MISC;
  protected currentTags: string[] = [];
  protected currentPriority?: number;
  
  constructor() {
    this.registry = new PatternRegistry<TInstruction>();
  }
  
  /**
   * Set category for subsequent patterns.
   */
  category(cat: PatternCategory): this {
    this.currentCategory = cat;
    return this;
  }
  
  /**
   * Set tags for subsequent patterns.
   */
  tags(...tags: string[]): this {
    this.currentTags = tags;
    return this;
  }
  
  /**
   * Set priority for subsequent patterns.
   */
  priority(p: number): this {
    this.currentPriority = p;
    return this;
  }
  
  /**
   * Add a pattern with current settings.
   */
  add(pattern: Pattern<TInstruction>): this {
    this.registry.register(pattern, this.currentCategory, {
      priorityOverride: this.currentPriority,
      tags: this.currentTags
    });
    return this;
  }
  
  /**
   * Reset current settings.
   */
  reset(): this {
    this.currentCategory = PatternCategory.MISC;
    this.currentTags = [];
    this.currentPriority = undefined;
    return this;
  }
  
  /**
   * Build the registry.
   */
  build(): PatternRegistry<TInstruction> {
    return this.registry;
  }
}

// Usage example:
// const registry = new RegistryBuilder<ILInstruction>()
//   .category(PatternCategory.ARITHMETIC)
//   .tags('identity')
//   .priority(80)
//   .add(new AddZeroPattern())
//   .add(new MultiplyOnePattern())
//   .category(PatternCategory.STRENGTH_REDUCTION)
//   .tags('shift')
//   .priority(70)
//   .add(new MultiplyPowerOfTwoPattern())
//   .build();
```

---

## Summary

The Pattern Registry provides:

1. **PatternRegistry** - Central management of patterns
2. **PatternCategory** - Logical grouping of patterns
3. **PatternConfig** - Per-pattern configuration (enable, priority, tags)
4. **OptimizationLevel** - Preset configurations for -O0 to -O3
5. **RegistryBuilder** - Fluent API for registry construction

**Key Design Decisions:**
- Patterns organized by category for easy management
- Tags for flexible cross-cutting concerns
- Priority overrides allow tuning without modifying patterns
- Enable/disable without unregistering
- Presets for common optimization levels

---

**Previous**: [01-pattern-framework.md](01-pattern-framework.md)  
**Next**: [03-load-store-il.md](03-load-store-il.md) - IL-level load/store patterns