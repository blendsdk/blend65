# God-Level SFA: Address Assignment

> **Document**: god-level-sfa/02c-address-assignment.md
> **Purpose**: Algorithm for assigning frame addresses (Phase 3 of allocation)
> **Created**: 2025-02-01
> **Status**: Complete

## Overview

Address assignment determines the actual memory addresses for each function's frame. This is where **frame coalescing** happens - functions that never call each other can share the same memory.

---

## 1. Two Allocation Strategies

### 1.1 Without Coalescing (Simple)

Every function gets a unique address range:

```
Frame Region: $0200-$03FF (512 bytes)

main_frame:      $0200-$0211 (18 bytes)
calculate_frame: $0212-$0219 (8 bytes)
process_frame:   $021A-$022D (20 bytes)

Total used: 46 bytes
```

### 1.2 With Coalescing (Memory-Efficient)

Functions that don't call each other share memory:

```
Frame Region: $0200-$03FF (512 bytes)

Group 1: main, irq_handler (can't share - different threads)
  main_frame:        $0200-$0211 (18 bytes)
  irq_handler_frame: $0212-$0215 (4 bytes)

Group 2: calculate, draw (don't call each other)
  [shared]:          $0216-$022D (max of both = 20 bytes)

Total used: 32 bytes (30% savings!)
```

---

## 2. Coalescing Algorithm

### 2.1 Building Coalesce Groups

```typescript
interface CoalesceGroup {
  groupId: number;
  members: Set<string>;
  maxFrameSize: number;
  threadContext: ThreadContext;
  baseAddress: number; // Assigned later
}

function buildCoalesceGroups(
  shells: Map<string, FrameShell>,
  callGraph: CallGraph
): CoalesceGroup[] {
  const groups: CoalesceGroup[] = [];
  const assigned = new Set<string>();
  let nextGroupId = 0;

  // Sort functions by frame size (largest first for better packing)
  const sortedFunctions = Array.from(shells.keys()).sort((a, b) => {
    return shells.get(b)!.totalSize - shells.get(a)!.totalSize;
  });

  for (const funcName of sortedFunctions) {
    if (assigned.has(funcName)) continue;

    const shell = shells.get(funcName)!;

    // Try to find an existing group this function can join
    let foundGroup: CoalesceGroup | null = null;

    for (const group of groups) {
      if (canJoinGroup(funcName, shell, group, callGraph)) {
        foundGroup = group;
        break;
      }
    }

    if (foundGroup) {
      // Add to existing group
      foundGroup.members.add(funcName);
      foundGroup.maxFrameSize = Math.max(foundGroup.maxFrameSize, shell.totalSize);
    } else {
      // Create new group
      groups.push({
        groupId: nextGroupId++,
        members: new Set([funcName]),
        maxFrameSize: shell.totalSize,
        threadContext: shell.threadContext,
        baseAddress: 0, // Will be assigned
      });
    }

    assigned.add(funcName);
  }

  return groups;
}
```

### 2.2 Can Join Group Check

```typescript
function canJoinGroup(
  funcName: string,
  shell: FrameShell,
  group: CoalesceGroup,
  callGraph: CallGraph
): boolean {
  // Rule 1: Must have same thread context
  if (shell.threadContext !== group.threadContext) {
    // Special case: MainOnly can join MainOnly, IsrOnly can join IsrOnly
    // But Both cannot coalesce with anything else
    if (shell.threadContext === ThreadContext.Both ||
        group.threadContext === ThreadContext.Both) {
      return false;
    }
  }

  // Rule 2: Must not have overlapping execution
  for (const existingFunc of group.members) {
    if (canOverlap(funcName, existingFunc, callGraph)) {
      return false;
    }
  }

  // Rule 3: Recursive functions cannot coalesce
  if (shell.isRecursive) {
    return false;
  }

  return true;
}
```

### 2.3 Overlap Detection

```typescript
function canOverlap(
  func1: string,
  func2: string,
  callGraph: CallGraph
): boolean {
  const node1 = callGraph.nodes.get(func1);
  const node2 = callGraph.nodes.get(func2);

  if (!node1 || !node2) return true; // Unknown = assume overlap

  // Check if func1 is in func2's recursive caller set
  if (node2.recursiveCallers.has(func1)) {
    return true;
  }

  // Check if func2 is in func1's recursive caller set
  if (node1.recursiveCallers.has(func2)) {
    return true;
  }

  // Check direct call relationship
  if (node1.callees.has(func2) || node2.callees.has(func1)) {
    return true;
  }

  return false;
}
```

---

## 3. Address Assignment Algorithm

### 3.1 Linear Assignment

```typescript
function assignAddresses(
  groups: CoalesceGroup[],
  config: FrameAllocatorConfig
): AddressAssignmentResult {
  let currentAddress = config.platform.frameRegionStart;
  const diagnostics: AllocationDiagnostic[] = [];

  // Sort groups by size (largest first) for better packing
  groups.sort((a, b) => b.maxFrameSize - a.maxFrameSize);

  for (const group of groups) {
    // Check if we have room
    if (currentAddress + group.maxFrameSize > config.platform.frameRegionEnd) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        code: DiagnosticCodes.FRAME_OVERFLOW,
        message: `Frame region overflow at group ${group.groupId}.\n` +
                 `Needed: ${currentAddress + group.maxFrameSize - config.platform.frameRegionStart} bytes, ` +
                 `Available: ${config.platform.frameRegionSize} bytes.`,
        suggestion: `Reduce frame sizes or enable more aggressive coalescing.`,
      });
      break;
    }

    // Assign address
    group.baseAddress = currentAddress;
    currentAddress += group.maxFrameSize;

    // Apply alignment if needed
    if (config.platform.alignment > 1) {
      const remainder = currentAddress % config.platform.alignment;
      if (remainder !== 0) {
        currentAddress += config.platform.alignment - remainder;
      }
    }
  }

  return {
    groups,
    totalUsed: currentAddress - config.platform.frameRegionStart,
    diagnostics,
    hasErrors: diagnostics.some(d => d.severity === DiagnosticSeverity.Error),
  };
}
```

### 3.2 Building Frame Map from Groups

```typescript
function buildFrameMapFromGroups(
  groups: CoalesceGroup[],
  shells: Map<string, FrameShell>
): Map<string, Frame> {
  const frames = new Map<string, Frame>();

  for (const group of groups) {
    for (const funcName of group.members) {
      const shell = shells.get(funcName)!;

      // Create frame with assigned address
      const frame = createFrameFromShell(shell, group.baseAddress, group.groupId);
      frames.set(funcName, frame);
    }
  }

  return frames;
}

function createFrameFromShell(
  shell: FrameShell,
  baseAddress: number,
  groupId: number
): Frame {
  // Convert slots to FrameSlot with offsets
  const slots: FrameSlot[] = [];
  let offset = 0;

  for (const slotInfo of shell.slots) {
    slots.push({
      ...slotInfo,
      location: SlotLocation.FrameRegion, // May change in ZP phase
      address: baseAddress + offset,
      offset,
      accessCount: 0,
      maxLoopDepth: 0,
      zpScore: 0,
      isArrayElement: false,
    });
    offset += slotInfo.size;
  }

  return {
    functionName: shell.functionName,
    slots,
    totalFrameSize: shell.totalSize,
    totalZpSize: 0, // Calculated in ZP phase
    frameBaseAddress: baseAddress,
    isRecursive: shell.isRecursive,
    coalesceGroupId: groupId,
    threadContext: shell.threadContext,
    getSlot: (name) => slots.find(s => s.name === name),
    getParameters: () => slots.filter(s => s.kind === SlotKind.Parameter),
    getLocals: () => slots.filter(s => s.kind === SlotKind.Local),
    getReturnSlot: () => slots.find(s => s.kind === SlotKind.Return),
    getZpSlots: () => slots.filter(s => s.location === SlotLocation.ZeroPage),
    getFrameSlots: () => slots.filter(s => s.location === SlotLocation.FrameRegion),
  };
}
```

---

## 4. Memory Savings Calculation

```typescript
function calculateCoalescingSavings(
  shells: Map<string, FrameShell>,
  groups: CoalesceGroup[]
): CoalescingStats {
  // Raw size: sum of all frame sizes
  let rawSize = 0;
  for (const shell of shells.values()) {
    rawSize += shell.totalSize;
  }

  // Coalesced size: sum of group max sizes
  let coalescedSize = 0;
  for (const group of groups) {
    coalescedSize += group.maxFrameSize;
  }

  const bytesSaved = rawSize - coalescedSize;
  const efficiency = rawSize > 0 ? (bytesSaved / rawSize) * 100 : 0;

  return {
    rawSize,
    coalescedSize,
    bytesSaved,
    efficiency,
    groupCount: groups.length,
    functionCount: shells.size,
    averageGroupSize: shells.size / groups.length,
  };
}
```

---

## 5. Coalescing Visualization

### 5.1 Example Program Call Graph

```
main() ─┬─ update() ─── move_player()
        │
        └─ draw() ─┬─ draw_player()
                   └─ draw_enemies()

irq_handler() ─┬─ update_timer()
               └─ play_sound()
```

### 5.2 Coalescing Analysis

| Function | Thread | Callers | Can Coalesce With |
|----------|--------|---------|-------------------|
| main | Main | - | Nothing (entry point) |
| update | Main | main | draw, draw_player, draw_enemies |
| move_player | Main | update | draw, draw_player, draw_enemies |
| draw | Main | main | update, move_player |
| draw_player | Main | draw | update, move_player |
| draw_enemies | Main | draw | update, move_player |
| irq_handler | ISR | - | Nothing (entry point, different thread) |
| update_timer | ISR | irq_handler | Nothing (different thread) |
| play_sound | ISR | irq_handler | Nothing (different thread) |

### 5.3 Resulting Groups

```
Group 0 (Main Entry):
  main (18 bytes)
  → Base: $0200, Size: 18 bytes

Group 1 (Main Coalesced A):
  update (12 bytes), draw (10 bytes)
  → Base: $0212, Size: 12 bytes (max)

Group 2 (Main Coalesced B):
  move_player (4 bytes), draw_player (4 bytes), draw_enemies (4 bytes)
  → Base: $021E, Size: 4 bytes (max)

Group 3 (ISR Entry):
  irq_handler (4 bytes)
  → Base: $0222, Size: 4 bytes

Group 4 (ISR Coalesced):
  update_timer (2 bytes), play_sound (2 bytes)
  → Base: $0226, Size: 2 bytes (max)

Raw Total: 56 bytes
Coalesced Total: 40 bytes
Savings: 16 bytes (28.6%)
```

---

## 6. Edge Cases

### 6.1 Functions Called from Multiple Paths

```
main() ─┬─ path_a() ─── helper()
        │
        └─ path_b() ─── helper()
```

`helper()` is called from both `path_a()` and `path_b()`, so:
- `helper` cannot coalesce with `path_a`
- `helper` cannot coalesce with `path_b`
- `path_a` CAN coalesce with `path_b` (they don't call each other)

### 6.2 Diamond Call Pattern

```
        ┌─ B ─┐
main ───┤     ├─── D
        └─ C ─┘
```

- A calls B and C
- B and C both call D
- B and C CAN coalesce (same level, don't call each other)
- D cannot coalesce with B or C

### 6.3 Recursive Functions

```
fn factorial(n) → factorial(n-1)
```

Recursive functions cannot coalesce because their own instance might be on the stack when called again.

---

## 7. Complete Address Assignment Pipeline

```typescript
function performAddressAssignment(
  shells: Map<string, FrameShell>,
  callGraph: CallGraph,
  config: FrameAllocatorConfig
): AddressAssignmentResult {
  const diagnostics: AllocationDiagnostic[] = [];

  // Step 1: Build coalesce groups
  const groups = config.enableCoalescing
    ? buildCoalesceGroups(shells, callGraph)
    : buildSingletonGroups(shells); // Each function is its own group

  // Step 2: Assign addresses to groups
  const assignmentResult = assignAddresses(groups, config);
  diagnostics.push(...assignmentResult.diagnostics);

  // Step 3: Build frame map
  const frames = buildFrameMapFromGroups(assignmentResult.groups, shells);

  // Step 4: Calculate savings
  const stats = calculateCoalescingSavings(shells, groups);

  // Step 5: Report savings
  if (stats.bytesSaved > 0) {
    diagnostics.push({
      severity: DiagnosticSeverity.Info,
      code: DiagnosticCodes.COALESCING_SAVED,
      message: `Frame coalescing saved ${stats.bytesSaved} bytes (${stats.efficiency.toFixed(1)}% reduction).`,
    });
  }

  return {
    frames,
    groups: assignmentResult.groups,
    stats,
    diagnostics,
    hasErrors: diagnostics.some(d => d.severity === DiagnosticSeverity.Error),
  };
}

function buildSingletonGroups(shells: Map<string, FrameShell>): CoalesceGroup[] {
  return Array.from(shells.entries()).map(([name, shell], i) => ({
    groupId: i,
    members: new Set([name]),
    maxFrameSize: shell.totalSize,
    threadContext: shell.threadContext,
    baseAddress: 0,
  }));
}
```

---

## 8. Output to Next Phase

After address assignment:

```typescript
interface AddressAssignmentResult {
  /** Frames with addresses assigned */
  frames: Map<string, Frame>;

  /** Coalesce groups */
  groups: CoalesceGroup[];

  /** Coalescing statistics */
  stats: CoalescingStats;

  /** Diagnostics */
  diagnostics: AllocationDiagnostic[];

  /** Any errors? */
  hasErrors: boolean;
}
```

The next phase (slot layout) will:
1. Receive frames with base addresses
2. Perform ZP allocation for high-priority slots
3. Finalize slot addresses within each frame

---

## Summary

| Step | Purpose | Output |
|------|---------|--------|
| 1. Build groups | Find coalescable functions | CoalesceGroup[] |
| 2. Assign addresses | Give each group a base address | Groups with baseAddress |
| 3. Build frames | Create Frame objects | Frame map |
| 4. Calculate stats | Report memory savings | CoalescingStats |

---

**Previous Document:** [02b-frame-size-calculation.md](02b-frame-size-calculation.md)  
**Next Document:** [02d-slot-layout.md](02d-slot-layout.md)