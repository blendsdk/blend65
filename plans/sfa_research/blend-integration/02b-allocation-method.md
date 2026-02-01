# Blend Integration: Allocation Method

> **Document**: blend-integration/02b-allocation-method.md
> **Parent**: [02-allocator-impl.md](02-allocator-impl.md)
> **Status**: Design Complete
> **Target File**: `packages/compiler-v2/src/frame/allocator/frame-calculator.ts`, `frame-allocator.ts`

## Overview

This document details the frame allocation algorithm:

1. **Frame Size Calculation** - Determine bytes needed per function
2. **Coalesce Group Building** - Group functions that can share memory
3. **Address Assignment** - Assign memory addresses to groups
4. **Frame Building** - Create final Frame objects

---

## 1. Frame Size Calculation

### 1.1 Algorithm Overview

```
For each function in program:
  1. Collect parameter slots (in declaration order)
  2. Add return value slot (if not void)
  3. Walk function body to find local variables
  4. Calculate total size
  5. Create FrameShell
```

### 1.2 Implementation

```typescript
/**
 * Calculate frame sizes for all functions.
 * Called from FrameSizeCalculator.calculateFrameSizes()
 */
calculateFrameSizes(program: Program): void {
  for (const module of program.modules) {
    for (const decl of module.declarations) {
      if (isFunctionDeclaration(decl)) {
        const shell = this.calculateFunctionSize(decl);
        this.frameShells.set(decl.name.value, shell);
        
        // Validate frame size
        this.validateFrameSize(shell);
      }
    }
  }
}

/**
 * Calculate frame for a single function.
 */
protected calculateFunctionSize(func: FunctionDeclaration): FrameShell {
  const slots: SlotInfo[] = [];
  let totalSize = 0;
  
  // Step 1: Parameters
  for (const param of func.parameters) {
    const size = this.getTypeSize(param.type);
    slots.push({
      name: param.name.value,
      kind: SlotKind.Parameter,
      size,
      type: param.typeInfo,
      zpDirective: this.extractZpDirective(param),
    });
    totalSize += size;
  }
  
  // Step 2: Return value (if not void)
  if (func.returnType && func.returnTypeInfo.kind !== TypeKind.Void) {
    const size = this.getTypeSize(func.returnTypeInfo);
    slots.push({
      name: '__return',
      kind: SlotKind.Return,
      size,
      type: func.returnTypeInfo,
      zpDirective: ZpDirective.None,
    });
    totalSize += size;
  }
  
  // Step 3: Local variables
  const locals = this.collectLocalVariables(func.body);
  for (const local of locals) {
    const size = this.getTypeSize(local.typeInfo);
    slots.push({
      name: local.name.value,
      kind: SlotKind.Local,
      size,
      type: local.typeInfo,
      zpDirective: this.extractZpDirective(local),
    });
    totalSize += size;
  }
  
  // Step 4: Word alignment padding (optional)
  if (this.config.wordAlignFrames && totalSize % 2 !== 0) {
    totalSize += 1;
  }
  
  // Get call graph info (if available)
  const cgNode = this.callGraph?.nodes.get(func.name.value);
  
  return {
    functionName: func.name.value,
    totalSize,
    slots,
    isRecursive: cgNode?.isRecursive ?? false,
    threadContext: cgNode?.threadContext ?? ThreadContext.MainOnly,
  };
}
```

### 1.3 Local Variable Collection

```typescript
/**
 * Collect all local variable declarations from a function body.
 * Walks the AST to find variables in all scopes.
 */
protected collectLocalVariables(body: BlockStatement): VariableDeclaration[] {
  const locals: VariableDeclaration[] = [];
  
  const walk = (node: ASTNode): void => {
    if (isVariableDeclaration(node)) {
      locals.push(node);
    }
    
    // Walk children
    for (const child of node.getChildren()) {
      walk(child);
    }
  };
  
  walk(body);
  return locals;
}
```

### 1.4 Frame Size Validation

```typescript
/**
 * Validate frame size and emit diagnostics.
 */
protected validateFrameSize(shell: FrameShell): void {
  // Check for oversized frame
  if (shell.totalSize > this.config.maxFrameSize) {
    this.addError(
      DiagnosticCodes.FRAME_TOO_LARGE,
      `Frame for '${shell.functionName}' is ${shell.totalSize} bytes, ` +
      `exceeding maximum of ${this.config.maxFrameSize} bytes.`,
      {
        functionName: shell.functionName,
        suggestion: 'Split into multiple functions or reduce local variable sizes.',
      }
    );
  }
  
  // Warn about large frames
  if (shell.totalSize > 128) {
    this.addWarning(
      DiagnosticCodes.LARGE_FRAME,
      `Frame for '${shell.functionName}' is ${shell.totalSize} bytes, ` +
      `which is relatively large for 6502.`,
      {
        functionName: shell.functionName,
        suggestion: 'Consider if all locals are necessary.',
      }
    );
  }
  
  // Validate individual slots
  for (const slot of shell.slots) {
    if (slot.type.isArray && slot.size > 256) {
      this.addWarning(
        DiagnosticCodes.LARGE_ARRAY,
        `Array '${slot.name}' in '${shell.functionName}' is ${slot.size} bytes.`,
        {
          functionName: shell.functionName,
          variableName: slot.name,
          suggestion: 'Consider using @ram directive for large arrays.',
        }
      );
    }
  }
}
```

---

## 2. Coalesce Group Building

### 2.1 Algorithm Overview

Frame coalescing allows functions that never execute simultaneously to share the same memory region, significantly reducing memory usage.

```
Strategy:
1. Sort functions by frame size (largest first)
2. For each function:
   a. Try to find existing group it can join
   b. If found, add to group and update max size
   c. If not found, create new group
3. Groups become contiguous memory regions
```

### 2.2 Coalescing Rules

| Rule | Description |
|------|-------------|
| **Same Thread** | Functions must have same thread context (Main/ISR) |
| **No Overlap** | Functions cannot be on stack simultaneously |
| **Not Recursive** | Recursive functions cannot coalesce |
| **Not Both** | ThreadContext.Both cannot coalesce with anything |

### 2.3 Implementation

```typescript
/**
 * Build coalesce groups from call graph analysis.
 */
protected buildCoalesceGroups(): void {
  // Sort by frame size (largest first for better packing)
  const sortedFunctions = Array.from(this.frameShells.keys()).sort((a, b) => {
    return this.frameShells.get(b)!.totalSize - 
           this.frameShells.get(a)!.totalSize;
  });
  
  const assigned = new Set<string>();
  let nextGroupId = 0;
  
  for (const funcName of sortedFunctions) {
    if (assigned.has(funcName)) continue;
    
    const shell = this.frameShells.get(funcName)!;
    
    // Skip recursive functions - they get their own group
    if (shell.isRecursive) {
      this.coalesceGroups.push({
        groupId: nextGroupId++,
        members: new Set([funcName]),
        maxFrameSize: shell.totalSize,
        threadContext: shell.threadContext,
        baseAddress: 0,
      });
      assigned.add(funcName);
      continue;
    }
    
    // Try to find existing group to join
    let foundGroup: CoalesceGroup | null = null;
    
    for (const group of this.coalesceGroups) {
      if (this.canJoinGroup(funcName, shell, group)) {
        foundGroup = group;
        break;
      }
    }
    
    if (foundGroup) {
      // Join existing group
      foundGroup.members.add(funcName);
      foundGroup.maxFrameSize = Math.max(
        foundGroup.maxFrameSize, 
        shell.totalSize
      );
    } else {
      // Create new group
      this.coalesceGroups.push({
        groupId: nextGroupId++,
        members: new Set([funcName]),
        maxFrameSize: shell.totalSize,
        threadContext: shell.threadContext,
        baseAddress: 0,
      });
    }
    
    assigned.add(funcName);
  }
  
  // Report coalescing results
  this.reportCoalescingStats();
}

/**
 * Check if a function can join an existing coalesce group.
 */
protected canJoinGroup(
  funcName: string,
  shell: FrameShell,
  group: CoalesceGroup
): boolean {
  // Rule 1: Must have compatible thread context
  if (!this.isCompatibleThreadContext(shell.threadContext, group.threadContext)) {
    return false;
  }
  
  // Rule 2: Must not have overlapping execution with any group member
  for (const existingFunc of group.members) {
    if (this.canOverlap(funcName, existingFunc)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if two thread contexts are compatible for coalescing.
 */
protected isCompatibleThreadContext(
  ctx1: ThreadContext,
  ctx2: ThreadContext
): boolean {
  // Both context cannot coalesce with anything
  if (ctx1 === ThreadContext.Both || ctx2 === ThreadContext.Both) {
    return false;
  }
  
  // Same context is compatible
  return ctx1 === ctx2;
}

/**
 * Report coalescing statistics.
 */
protected reportCoalescingStats(): void {
  const totalFunctions = this.frameShells.size;
  const totalGroups = this.coalesceGroups.length;
  
  // Calculate raw vs coalesced size
  let rawSize = 0;
  for (const shell of this.frameShells.values()) {
    rawSize += shell.totalSize;
  }
  
  let coalescedSize = 0;
  for (const group of this.coalesceGroups) {
    coalescedSize += group.maxFrameSize;
  }
  
  const bytesSaved = rawSize - coalescedSize;
  const efficiency = rawSize > 0 ? (bytesSaved / rawSize) * 100 : 0;
  
  if (bytesSaved > 0) {
    this.addInfo(
      DiagnosticCodes.COALESCING_STATS,
      `Frame coalescing: ${totalFunctions} functions → ${totalGroups} groups, ` +
      `saved ${bytesSaved} bytes (${efficiency.toFixed(1)}% reduction).`
    );
  }
}
```

---

## 3. Address Assignment

### 3.1 Algorithm Overview

```
1. Sort coalesce groups by size (largest first)
2. For each group:
   a. Check if space available
   b. Assign base address
   c. Advance address pointer
   d. Apply alignment if needed
```

### 3.2 Implementation

```typescript
/**
 * Assign addresses to coalesce groups.
 */
protected assignFrameAddresses(): void {
  // Sort groups by size for better packing
  this.coalesceGroups.sort((a, b) => b.maxFrameSize - a.maxFrameSize);
  
  let currentAddress = this.platform.frameRegionStart;
  const endAddress = this.platform.frameRegionEnd;
  
  for (const group of this.coalesceGroups) {
    // Check if we have room
    if (currentAddress + group.maxFrameSize > endAddress) {
      this.addError(
        DiagnosticCodes.FRAME_OVERFLOW,
        `Frame region overflow: need ${currentAddress + group.maxFrameSize - this.platform.frameRegionStart} bytes, ` +
        `but only ${this.platform.frameRegionSize} bytes available.`,
        {
          suggestion: 'Enable coalescing, reduce frame sizes, or expand frame region.',
        }
      );
      break;
    }
    
    // Assign address
    group.baseAddress = currentAddress;
    currentAddress += group.maxFrameSize;
    
    // Apply alignment if needed
    if (this.config.wordAlignFrames) {
      const remainder = currentAddress % 2;
      if (remainder !== 0) {
        currentAddress += 2 - remainder;
      }
    }
  }
  
  // Report total frame region usage
  const usedBytes = currentAddress - this.platform.frameRegionStart;
  const totalBytes = this.platform.frameRegionSize;
  const usagePercent = (usedBytes / totalBytes) * 100;
  
  this.addInfo(
    DiagnosticCodes.FRAME_REGION_USAGE,
    `Frame region usage: ${usedBytes}/${totalBytes} bytes (${usagePercent.toFixed(1)}%).`
  );
}
```

---

## 4. Frame Building

### 4.1 Building Final Frames

```typescript
/**
 * Build a Frame from a FrameShell after address assignment.
 */
protected buildFrame(shell: FrameShell, group: CoalesceGroup): Frame {
  const slots: FrameSlot[] = [];
  let offset = 0;
  
  for (const slotInfo of shell.slots) {
    // Check if this slot has ZP allocation
    const zpAddr = this.getZpAllocation(shell.functionName, slotInfo.name);
    const isZp = zpAddr !== undefined;
    
    const slot: FrameSlot = {
      name: slotInfo.name,
      kind: slotInfo.kind,
      size: slotInfo.size,
      type: slotInfo.type,
      zpDirective: slotInfo.zpDirective,
      location: isZp ? SlotLocation.ZeroPage : SlotLocation.FrameRegion,
      address: isZp ? zpAddr : group.baseAddress + offset,
      offset,
      accessCount: 0,    // Will be updated from access analysis
      maxLoopDepth: 0,   // Will be updated from access analysis
      zpScore: 0,        // Already calculated during ZP allocation
      isArrayElement: false,
    };
    
    slots.push(slot);
    offset += slotInfo.size;
  }
  
  // Calculate ZP vs RAM breakdown
  const zpSlots = slots.filter(s => s.location === SlotLocation.ZeroPage);
  const zpSize = zpSlots.reduce((sum, s) => sum + s.size, 0);
  
  return {
    functionName: shell.functionName,
    slots,
    totalFrameSize: shell.totalSize,
    totalZpSize: zpSize,
    frameBaseAddress: group.baseAddress,
    isRecursive: shell.isRecursive,
    coalesceGroupId: group.groupId,
    threadContext: shell.threadContext,
    
    // Query methods
    getSlot: (name) => slots.find(s => s.name === name),
    getParameters: () => slots.filter(s => s.kind === SlotKind.Parameter),
    getLocals: () => slots.filter(s => s.kind === SlotKind.Local),
    getReturnSlot: () => slots.find(s => s.kind === SlotKind.Return),
    getZpSlots: () => slots.filter(s => s.location === SlotLocation.ZeroPage),
    getFrameSlots: () => slots.filter(s => s.location === SlotLocation.FrameRegion),
  };
}
```

### 4.2 Statistics Calculation

```typescript
/**
 * Calculate allocation statistics.
 */
protected calculateStats(): AllocationStats {
  let totalFunctions = 0;
  let totalSlots = 0;
  let totalFrameBytes = 0;
  let totalZpBytes = 0;
  let zpSlotsCount = 0;
  let maxFrameSize = 0;
  let largestFrame = '';
  
  // Calculate raw size (before coalescing)
  let rawSize = 0;
  for (const shell of this.frameShells.values()) {
    rawSize += shell.totalSize;
  }
  
  // Calculate coalesced size
  let coalescedSize = 0;
  for (const group of this.coalesceGroups) {
    coalescedSize += group.maxFrameSize;
  }
  
  // Analyze frames
  for (const [funcName, frame] of this.frames) {
    totalFunctions++;
    totalSlots += frame.slots.length;
    totalFrameBytes += frame.totalFrameSize;
    totalZpBytes += frame.totalZpSize;
    zpSlotsCount += frame.getZpSlots().length;
    
    if (frame.totalFrameSize > maxFrameSize) {
      maxFrameSize = frame.totalFrameSize;
      largestFrame = funcName;
    }
  }
  
  return {
    totalFunctions,
    totalSlots,
    totalFrameBytes: coalescedSize,
    rawFrameBytes: rawSize,
    coalesceBytesSaved: rawSize - coalescedSize,
    totalZpBytes,
    zpSlotsCount,
    frameRegionUsed: coalescedSize,
    frameRegionTotal: this.platform.frameRegionSize,
    zpUsed: totalZpBytes,
    zpTotal: this.platform.zpEnd - this.platform.zpStart,
    maxFrameSize,
    largestFrame,
    coalesceGroupCount: this.coalesceGroups.length,
  };
}
```

---

## 5. Complete Pipeline Example

```typescript
// Given this program:
fn main(): void {
  let x: byte = 10;
  calculate(x, 20);
  draw();
}

fn calculate(a: byte, b: byte): word {
  let temp: byte = a + b;
  let result: word = temp * 2;
  return result;
}

fn draw(): void {
  @zp let sprite_x: byte = 100;
  @zp let sprite_y: byte = 50;
  // ...
}

// Frame calculation produces:
// main: { params: [], return: none, locals: [x:1] } = 1 byte
// calculate: { params: [a:1, b:1], return: word:2, locals: [temp:1, result:2] } = 7 bytes
// draw: { params: [], return: none, locals: [sprite_x:1, sprite_y:1] } = 2 bytes

// Call graph:
// main → calculate, draw
// calculate → (none)
// draw → (none)

// Coalescing analysis:
// calculate and draw don't call each other → CAN coalesce
// Group 0: main (entry point) = 1 byte
// Group 1: calculate, draw (max 7 bytes) = 7 bytes
// Total: 8 bytes (vs 10 bytes raw)

// Address assignment (C64, frame region $0200-$03FF):
// Group 0 (main): $0200-$0200 (1 byte)
// Group 1 (calculate, draw): $0201-$0207 (7 bytes)

// ZP allocation:
// sprite_x → $02 (ZP preferred)
// sprite_y → $03 (ZP preferred)
```

---

## Summary

| Phase | Input | Output |
|-------|-------|--------|
| **Size Calculation** | FunctionDeclaration | FrameShell per function |
| **Coalescing** | FrameShells + CallGraph | CoalesceGroups |
| **Address Assignment** | CoalesceGroups | Groups with baseAddress |
| **Frame Building** | Shells + Groups + ZP | Final Frame objects |
| **Statistics** | All data | AllocationStats |

---

**Previous Document:** [02a-allocator-class.md](02a-allocator-class.md)  
**Next Document:** [02c-zp-scoring.md](02c-zp-scoring.md)