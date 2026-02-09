# Phase 4: IL-Level Load-Store Patterns

> **Document**: 03-load-store-il.md  
> **Phase**: 4 - IL Peephole  
> **Focus**: IL-level load/store elimination patterns  
> **Est. Lines**: ~300

---

## Overview

**Load-Store patterns** eliminate redundant memory operations at the IL level. These patterns work on virtual registers and memory operations before lowering to 6502 assembly, enabling more aggressive optimization.

**Key Patterns:**
1. Store-Load Elimination (store then immediately load same location)
2. Load-Load Elimination (redundant loads from same location)
3. Dead Store Elimination (stores to locations never read)
4. Store Forwarding (load can use stored value directly)

---

## IL Memory Model

### IL Memory Operations

```typescript
/**
 * IL opcodes for memory operations.
 */
export enum ILOpcode {
  // Memory operations
  LOAD = 'load',       // Load from memory to virtual register
  STORE = 'store',     // Store from virtual register to memory
  LOAD_IMM = 'load_imm', // Load immediate into virtual register
  
  // Addressing modes
  LOAD_ABS = 'load_abs',     // Load from absolute address
  LOAD_ZP = 'load_zp',       // Load from zero page
  LOAD_IDX = 'load_idx',     // Load indexed
  STORE_ABS = 'store_abs',   // Store to absolute address
  STORE_ZP = 'store_zp',     // Store to zero page
  STORE_IDX = 'store_idx',   // Store indexed
  
  // Other...
}

/**
 * Memory location representation in IL.
 */
export interface MemoryLocation {
  /** Type of memory location */
  kind: 'absolute' | 'zeropage' | 'indexed' | 'indirect';
  
  /** Base address (for absolute/zeropage) */
  address?: number;
  
  /** Symbol name (for symbolic references) */
  symbol?: string;
  
  /** Index register (for indexed) */
  index?: string;
  
  /** Offset (for indexed) */
  offset?: number;
}
```

---

## Store-Load Elimination

### Pattern Definition

When a value is stored and immediately loaded from the same location (with no intervening writes), the load is redundant.

```
; IL Before
STORE %v1, $50      ; Store v1 to address $50
LOAD %v2, $50       ; Load from $50 into v2 (REDUNDANT!)

; IL After  
STORE %v1, $50      ; Keep the store
COPY %v2, %v1       ; Use the stored value directly
```

### StoreLoadEliminationPattern

```typescript
/**
 * Eliminates redundant load after store to same location.
 * 
 * Pattern: STORE %x, addr; LOAD %y, addr → STORE %x, addr; COPY %y, %x
 * 
 * This is the IL-level equivalent of the ASM pattern that will fix
 * sequences like "STA $50; LDA $50" in the final assembly.
 */
export class StoreLoadEliminationPattern extends ILPattern {
  readonly name = 'store-load-elimination';
  readonly description = 'Eliminate load after store to same location';
  
  constructor() {
    super({ minLength: 2, maxLength: 2, priority: 100 });
  }
  
  protected matchCore(
    instructions: readonly ILInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<ILInstruction> | null {
    const store = instructions[index];
    const load = instructions[index + 1];
    
    // Check for STORE followed by LOAD
    if (!this.isStore(store) || !this.isLoad(load)) {
      return null;
    }
    
    // Check same memory location
    const storeLocation = this.getMemoryLocation(store);
    const loadLocation = this.getMemoryLocation(load);
    
    if (!storeLocation || !loadLocation) {
      return null;
    }
    
    if (!this.sameLocation(storeLocation, loadLocation)) {
      return null;
    }
    
    // Get the stored value
    const storedValue = this.getStoredValue(store);
    if (!storedValue) {
      return null;
    }
    
    // Capture for apply phase
    const captures = new Map<string, unknown>();
    captures.set('storedValue', storedValue);
    captures.set('loadResult', load.result);
    captures.set('storeInst', store);
    
    return this.createMatch(instructions, index, 2, captures);
  }
  
  protected applyCore(
    match: MatchResult<ILInstruction>,
    _context: PatternContext
  ): ILInstruction[] {
    const storedValue = match.captures.get('storedValue') as string;
    const loadResult = match.captures.get('loadResult') as string;
    const storeInst = match.captures.get('storeInst') as ILInstruction;
    
    return [
      storeInst,  // Keep original store
      this.createCopy(loadResult, storedValue)  // Replace load with copy
    ];
  }
  
  /**
   * Check if instruction is a store operation.
   */
  protected isStore(inst: ILInstruction): boolean {
    return this.hasAnyOpcode(inst, [
      ILOpcode.STORE,
      ILOpcode.STORE_ABS,
      ILOpcode.STORE_ZP,
      ILOpcode.STORE_IDX
    ]);
  }
  
  /**
   * Check if instruction is a load operation.
   */
  protected isLoad(inst: ILInstruction): boolean {
    return this.hasAnyOpcode(inst, [
      ILOpcode.LOAD,
      ILOpcode.LOAD_ABS,
      ILOpcode.LOAD_ZP,
      ILOpcode.LOAD_IDX
    ]);
  }
  
  /**
   * Extract memory location from instruction.
   */
  protected getMemoryLocation(inst: ILInstruction): MemoryLocation | null {
    // Implementation depends on IL instruction structure
    const addrOperand = inst.operands.find(op => op.kind === 'address');
    if (!addrOperand) {
      return null;
    }
    
    return {
      kind: this.getAddressingKind(inst),
      address: addrOperand.address,
      symbol: addrOperand.symbol,
      index: addrOperand.index,
      offset: addrOperand.offset
    };
  }
  
  /**
   * Check if two memory locations are the same.
   */
  protected sameLocation(a: MemoryLocation, b: MemoryLocation): boolean {
    if (a.kind !== b.kind) {
      return false;
    }
    
    // For indexed addressing, must check index register and offset
    if (a.kind === 'indexed') {
      return a.index === b.index && a.offset === b.offset;
    }
    
    // For absolute/zeropage, check address or symbol
    if (a.address !== undefined && b.address !== undefined) {
      return a.address === b.address;
    }
    
    if (a.symbol && b.symbol) {
      return a.symbol === b.symbol;
    }
    
    return false;
  }
  
  /**
   * Get the value being stored.
   */
  protected getStoredValue(store: ILInstruction): string | null {
    // First operand is typically the value being stored
    const valueOperand = store.operands.find(op => op.kind === 'virtual');
    return valueOperand?.name ?? null;
  }
  
  /**
   * Determine addressing kind from opcode.
   */
  protected getAddressingKind(inst: ILInstruction): MemoryLocation['kind'] {
    switch (inst.opcode) {
      case ILOpcode.LOAD_ZP:
      case ILOpcode.STORE_ZP:
        return 'zeropage';
      case ILOpcode.LOAD_IDX:
      case ILOpcode.STORE_IDX:
        return 'indexed';
      default:
        return 'absolute';
    }
  }
}
```

---

## Load-Load Elimination

### Pattern Definition

When the same location is loaded twice with no intervening write, the second load is redundant.

```
; IL Before
LOAD %v1, $50       ; Load from $50
; ... operations that don't write to $50 ...
LOAD %v2, $50       ; Load same location (REDUNDANT!)

; IL After
LOAD %v1, $50       ; Keep first load
; ... operations ...
COPY %v2, %v1       ; Use the already-loaded value
```

### LoadLoadEliminationPattern

```typescript
/**
 * Eliminates redundant load when value already in a register.
 * 
 * Note: This pattern is more complex as it needs to track
 * intervening instructions. Simplified version for adjacent loads.
 */
export class LoadLoadEliminationPattern extends ILPattern {
  readonly name = 'load-load-elimination';
  readonly description = 'Eliminate redundant load from same location';
  
  constructor() {
    super({ minLength: 2, maxLength: 2, priority: 95 });
  }
  
  protected matchCore(
    instructions: readonly ILInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<ILInstruction> | null {
    const load1 = instructions[index];
    const load2 = instructions[index + 1];
    
    // Both must be loads
    if (!this.isLoad(load1) || !this.isLoad(load2)) {
      return null;
    }
    
    // Must be from same location
    const loc1 = this.getMemoryLocation(load1);
    const loc2 = this.getMemoryLocation(load2);
    
    if (!loc1 || !loc2 || !this.sameLocation(loc1, loc2)) {
      return null;
    }
    
    const captures = new Map<string, unknown>();
    captures.set('firstLoad', load1);
    captures.set('firstResult', load1.result);
    captures.set('secondResult', load2.result);
    
    return this.createMatch(instructions, index, 2, captures);
  }
  
  protected applyCore(
    match: MatchResult<ILInstruction>,
    _context: PatternContext
  ): ILInstruction[] {
    const firstLoad = match.captures.get('firstLoad') as ILInstruction;
    const firstResult = match.captures.get('firstResult') as string;
    const secondResult = match.captures.get('secondResult') as string;
    
    return [
      firstLoad,  // Keep first load
      this.createCopy(secondResult, firstResult)  // Copy instead of reload
    ];
  }
  
  // Reuse helper methods from StoreLoadEliminationPattern
  protected isLoad(inst: ILInstruction): boolean {
    return inst.opcode.startsWith('load');
  }
  
  protected getMemoryLocation(inst: ILInstruction): MemoryLocation | null {
    // Same as StoreLoadEliminationPattern
    const addrOperand = inst.operands.find(op => op.kind === 'address');
    if (!addrOperand) return null;
    return {
      kind: 'absolute',
      address: addrOperand.address,
      symbol: addrOperand.symbol
    };
  }
  
  protected sameLocation(a: MemoryLocation, b: MemoryLocation): boolean {
    if (a.address !== undefined && b.address !== undefined) {
      return a.address === b.address;
    }
    if (a.symbol && b.symbol) {
      return a.symbol === b.symbol;
    }
    return false;
  }
}
```

---

## Store Forwarding Pattern

### Pattern Definition

A load can be replaced with a copy if we can prove the stored value is still available.

```
; IL with intervening operations
STORE %v1, $50      ; Store v1
ADD %v2, %x, %y     ; Some operation (doesn't touch $50)
LOAD %v3, $50       ; Load from $50 → can forward v1

; IL After
STORE %v1, $50
ADD %v2, %x, %y
COPY %v3, %v1       ; Forward the stored value
```

### StoreForwardingPattern

```typescript
/**
 * Forward stored value to later loads (with analysis).
 * 
 * Requires use-def analysis to ensure no intervening writes.
 */
export class StoreForwardingPattern extends ILPattern {
  readonly name = 'store-forwarding';
  readonly description = 'Forward stored value to load across non-interfering instructions';
  
  /** Maximum distance to look ahead */
  protected readonly maxDistance: number = 5;
  
  constructor() {
    super({ minLength: 2, maxLength: 6, priority: 90 });
  }
  
  protected matchCore(
    instructions: readonly ILInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<ILInstruction> | null {
    const store = instructions[index];
    
    if (!this.isStore(store)) {
      return null;
    }
    
    const storeLocation = this.getMemoryLocation(store);
    if (!storeLocation) {
      return null;
    }
    
    // Look for a load from same location
    for (let offset = 1; offset <= this.maxDistance; offset++) {
      const i = index + offset;
      if (i >= instructions.length) {
        break;
      }
      
      const inst = instructions[i];
      
      // Check if this instruction kills our forwarding opportunity
      if (this.mayWriteTo(inst, storeLocation)) {
        break;  // Location overwritten, can't forward
      }
      
      // Check if stored value is still available
      const storedValue = this.getStoredValue(store);
      if (storedValue && this.isRedefined(instructions, index, i, storedValue)) {
        break;  // Value redefined, can't forward
      }
      
      // Found a matching load?
      if (this.isLoad(inst)) {
        const loadLocation = this.getMemoryLocation(inst);
        if (loadLocation && this.sameLocation(storeLocation, loadLocation)) {
          const captures = new Map<string, unknown>();
          captures.set('store', store);
          captures.set('storedValue', storedValue);
          captures.set('loadResult', inst.result);
          captures.set('loadIndex', offset);
          captures.set('intervening', instructions.slice(index + 1, i));
          
          return this.createMatch(instructions, index, offset + 1, captures);
        }
      }
    }
    
    return null;
  }
  
  protected applyCore(
    match: MatchResult<ILInstruction>,
    _context: PatternContext
  ): ILInstruction[] {
    const store = match.captures.get('store') as ILInstruction;
    const storedValue = match.captures.get('storedValue') as string;
    const loadResult = match.captures.get('loadResult') as string;
    const intervening = match.captures.get('intervening') as ILInstruction[];
    
    return [
      store,
      ...intervening,
      this.createCopy(loadResult, storedValue)
    ];
  }
  
  /**
   * Check if instruction may write to location.
   */
  protected mayWriteTo(inst: ILInstruction, loc: MemoryLocation): boolean {
    if (!this.isStore(inst)) {
      return false;
    }
    
    const instLoc = this.getMemoryLocation(inst);
    if (!instLoc) {
      return true;  // Conservative: unknown location may alias
    }
    
    return this.mayAlias(instLoc, loc);
  }
  
  /**
   * Check if two locations may alias.
   */
  protected mayAlias(a: MemoryLocation, b: MemoryLocation): boolean {
    // Same known address = definitely alias
    if (a.address !== undefined && b.address !== undefined) {
      return a.address === b.address;
    }
    
    // Same symbol = alias
    if (a.symbol && b.symbol && a.symbol === b.symbol) {
      return true;
    }
    
    // Different known addresses = no alias
    if (a.address !== undefined && b.address !== undefined) {
      return false;
    }
    
    // Unknown = may alias (conservative)
    return true;
  }
  
  /**
   * Check if value is redefined between two points.
   */
  protected isRedefined(
    instructions: readonly ILInstruction[],
    start: number,
    end: number,
    value: string
  ): boolean {
    for (let i = start + 1; i < end; i++) {
      const inst = instructions[i];
      if (inst.result === value) {
        return true;  // Value redefined
      }
    }
    return false;
  }
  
  // Reuse helper methods
  protected isStore(inst: ILInstruction): boolean {
    return inst.opcode.startsWith('store');
  }
  
  protected isLoad(inst: ILInstruction): boolean {
    return inst.opcode.startsWith('load');
  }
  
  protected getMemoryLocation(inst: ILInstruction): MemoryLocation | null {
    const addrOperand = inst.operands.find(op => op.kind === 'address');
    if (!addrOperand) return null;
    return {
      kind: 'absolute',
      address: addrOperand.address,
      symbol: addrOperand.symbol
    };
  }
  
  protected sameLocation(a: MemoryLocation, b: MemoryLocation): boolean {
    if (a.address !== undefined && b.address !== undefined) {
      return a.address === b.address;
    }
    if (a.symbol && b.symbol) {
      return a.symbol === b.symbol;
    }
    return false;
  }
  
  protected getStoredValue(store: ILInstruction): string | null {
    const valueOperand = store.operands.find(op => op.kind === 'virtual');
    return valueOperand?.name ?? null;
  }
}
```

---

## Dead Store Elimination (IL Level)

### DeadStorePattern

```typescript
/**
 * Eliminate stores to locations that are never read.
 * 
 * Requires liveness analysis to be safe.
 */
export class DeadStorePattern extends ILPattern {
  readonly name = 'dead-store';
  readonly description = 'Eliminate stores to locations never read';
  
  constructor() {
    super({ minLength: 1, maxLength: 1, priority: 85 });
  }
  
  protected matchCore(
    instructions: readonly ILInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<ILInstruction> | null {
    const store = instructions[index];
    
    if (!this.isStore(store)) {
      return null;
    }
    
    // Need liveness analysis
    if (!context.liveness) {
      return null;  // Can't safely determine dead stores
    }
    
    const location = this.getMemoryLocation(store);
    if (!location) {
      return null;
    }
    
    // Check if location is live after this point
    if (this.isLocationLiveAfter(context.liveness, location, index)) {
      return null;  // Location is read later
    }
    
    // Store is dead
    return this.createMatch(instructions, index, 1);
  }
  
  protected applyCore(
    _match: MatchResult<ILInstruction>,
    _context: PatternContext
  ): ILInstruction[] {
    // Remove the dead store entirely
    return [];
  }
  
  /**
   * Check if memory location is live after given index.
   */
  protected isLocationLiveAfter(
    liveness: LivenessAnalysis,
    location: MemoryLocation,
    index: number
  ): boolean {
    // Implementation depends on liveness analysis API
    // Simplified: check if there's a load from this location later
    return liveness.isMemoryLive(location, index);
  }
  
  protected isStore(inst: ILInstruction): boolean {
    return inst.opcode.startsWith('store');
  }
  
  protected getMemoryLocation(inst: ILInstruction): MemoryLocation | null {
    const addrOperand = inst.operands.find(op => op.kind === 'address');
    if (!addrOperand) return null;
    return {
      kind: 'absolute',
      address: addrOperand.address,
      symbol: addrOperand.symbol
    };
  }
}
```

---

## Summary

IL-Level Load-Store patterns provide:

| Pattern | Optimization | Cycle Savings |
|---------|--------------|---------------|
| Store-Load Elimination | Remove redundant load after store | 3-4 cycles |
| Load-Load Elimination | Remove duplicate load | 3-4 cycles |
| Store Forwarding | Use stored value directly | 3-4 cycles |
| Dead Store | Remove unused store | 3-4 cycles |

**Key Insight:** These patterns work at IL level where we have:
- Virtual registers (unlimited, SSA form)
- Full data flow visibility
- No register allocation constraints

The ASM-level patterns in Phase 5 will handle the physical register cases.

---

**Previous**: [02-pattern-registry.md](02-pattern-registry.md)  
**Next**: [04-arithmetic-identity.md](04-arithmetic-identity.md) - Arithmetic identity patterns