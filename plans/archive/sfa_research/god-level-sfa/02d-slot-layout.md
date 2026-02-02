# God-Level SFA: Slot Layout

> **Document**: god-level-sfa/02d-slot-layout.md
> **Purpose**: Final slot address assignment within frames (Phase 4 of allocation)
> **Created**: 2025-02-01
> **Status**: Complete

## Overview

Slot layout is the final phase of allocation. It assigns the exact address for each slot (parameter, local, return value) within a frame, considering:

1. **ZP allocation** - High-priority slots move to zero page
2. **Frame region layout** - Remaining slots use frame addresses
3. **Access analysis** - Slot usage patterns influence ZP priority

---

## 1. Slot Layout Order

### 1.1 Layout Strategy

Slots are laid out within a frame in this order:

```
Frame Base Address ($0200 example)
├── Parameters (in declaration order)
│   $0200: param1 (byte)
│   $0201: param2 (word, 2 bytes)
├── Return Value (if not void)
│   $0203: __return (word, 2 bytes)
├── Local Variables (in declaration order)
│   $0205: local1 (byte)
│   $0206: local2 (word, 2 bytes)
│   $0208: array (byte[10])
└── Padding (if needed)
    $0212: (1 byte padding for alignment)
```

### 1.2 Why This Order?

1. **Parameters first** - Caller knows where to put arguments
2. **Return value next** - Predictable location for callee
3. **Locals last** - Only callee needs to know these
4. **Padding at end** - Keeps alignment simple

---

## 2. ZP Allocation Integration

### 2.1 When Slots Move to ZP

Some slots are allocated to zero page instead of the frame region:

```
Before ZP Allocation:
  Frame at $0200:
    param buffer: $0200-$020F (16 bytes, @zp)
    param size:   $0210 (1 byte)
    local i:      $0211 (1 byte)
    local sum:    $0212-$0213 (2 bytes)

After ZP Allocation:
  Zero Page:
    param buffer: $02-$11 (16 bytes, moved to ZP!)
  Frame at $0200:
    param size:   $0200 (1 byte, offsets shift!)
    local i:      $0201 (1 byte)
    local sum:    $0202-$0203 (2 bytes)
```

### 2.2 Slot Layout Algorithm

```typescript
function layoutSlots(
  frames: Map<string, Frame>,
  zpAllocation: ZpAllocationResult,
  config: FrameAllocatorConfig
): SlotLayoutResult {
  const diagnostics: AllocationDiagnostic[] = [];

  for (const [funcName, frame] of frames) {
    let frameOffset = 0;

    // Process slots in order
    for (const slot of frame.slots) {
      // Check if this slot was allocated to ZP
      const zpAddress = zpAllocation.allocations.get(slot);

      if (zpAddress !== undefined) {
        // Slot is in zero page
        slot.location = SlotLocation.ZeroPage;
        slot.address = zpAddress;
        slot.offset = -1; // Not applicable for ZP

        frame.totalZpSize += slot.size;
      } else {
        // Slot is in frame region
        slot.location = SlotLocation.FrameRegion;
        slot.address = frame.frameBaseAddress + frameOffset;
        slot.offset = frameOffset;

        frameOffset += slot.size;
      }
    }

    // Update frame's actual size (after ZP extraction)
    frame.totalFrameSize = frameOffset;
  }

  return { frames, diagnostics };
}
```

---

## 3. Access Analysis for ZP Scoring

### 3.1 Collecting Access Information

Before ZP allocation, we analyze how slots are used:

```typescript
interface SlotAccessInfo {
  /** Number of reads */
  readCount: number;
  /** Number of writes */
  writeCount: number;
  /** Maximum loop nesting depth where accessed */
  maxLoopDepth: number;
  /** Is this slot used in a time-critical section? */
  isHotPath: boolean;
}

function analyzeSlotAccess(
  func: FunctionDeclaration,
  slots: FrameSlot[]
): Map<string, SlotAccessInfo> {
  const accessMap = new Map<string, SlotAccessInfo>();

  // Initialize all slots
  for (const slot of slots) {
    accessMap.set(slot.name, {
      readCount: 0,
      writeCount: 0,
      maxLoopDepth: 0,
      isHotPath: false,
    });
  }

  // Walk the function body
  let currentLoopDepth = 0;

  function walk(node: ASTNode): void {
    // Track loop depth
    if (isWhileStatement(node) || isForStatement(node)) {
      currentLoopDepth++;
    }

    // Track variable accesses
    if (isIdentifier(node) && accessMap.has(node.name)) {
      const info = accessMap.get(node.name)!;

      // Determine if read or write based on context
      if (isAssignmentTarget(node)) {
        info.writeCount++;
      } else {
        info.readCount++;
      }

      // Update max loop depth
      if (currentLoopDepth > info.maxLoopDepth) {
        info.maxLoopDepth = currentLoopDepth;
      }
    }

    // Walk children
    for (const child of node.getChildren()) {
      walk(child);
    }

    // Exit loop depth
    if (isWhileStatement(node) || isForStatement(node)) {
      currentLoopDepth--;
    }
  }

  walk(func.body);
  return accessMap;
}
```

### 3.2 Computing ZP Scores

```typescript
function computeZpScore(
  slot: FrameSlot,
  accessInfo: SlotAccessInfo,
  weights: ZpScoringWeights
): number {
  let score = 0;

  // Type weight
  const typeWeight = getTypeWeight(slot.type, weights);
  score += typeWeight;

  // Access count bonus
  const totalAccesses = accessInfo.readCount + accessInfo.writeCount;
  score += Math.min(totalAccesses, 100) * 10;

  // Loop depth multiplier
  const loopMultiplier = Math.pow(weights.loopDepthMultiplier, accessInfo.maxLoopDepth);
  score *= loopMultiplier;

  // ZP directive bonus
  if (slot.zpDirective === ZpDirective.Required) {
    score = Infinity; // Must be allocated
  } else if (slot.zpDirective === ZpDirective.Preferred) {
    score += weights.zpPreferredBonus;
  } else if (slot.zpDirective === ZpDirective.Forbidden) {
    score = -Infinity; // Must NOT be allocated
  }

  return score;
}

function getTypeWeight(type: TypeInfo, weights: ZpScoringWeights): number {
  if (type.isPointer) return weights.pointerWeight; // Highest - enables indirect Y
  if (type.name === 'byte' || type.name === 'bool') return weights.byteWeight;
  if (type.name === 'word') return weights.wordWeight;
  if (type.isArray) return 0; // Arrays rarely fit in ZP
  return weights.byteWeight; // Default
}
```

---

## 4. Register Allocation for Parameters

### 4.1 Register-First Strategy

Small parameters can be passed in CPU registers instead of memory:

```typescript
function allocateParameterRegisters(
  frame: Frame
): void {
  const params = frame.getParameters();

  if (params.length === 0) return;

  // First byte parameter → A register
  if (params.length >= 1 && params[0].size === 1) {
    params[0].location = SlotLocation.Register;
    params[0].register = 'A';
    params[0].address = -1; // Not applicable
  }

  // For single word parameter → A/Y registers
  if (params.length === 1 && params[0].size === 2) {
    params[0].location = SlotLocation.Register;
    params[0].register = 'AY'; // A=low, Y=high
    params[0].address = -1;
  }

  // Two byte parameters → A and Y
  if (params.length === 2 && 
      params[0].size === 1 && params[1].size === 1) {
    params[0].location = SlotLocation.Register;
    params[0].register = 'A';
    params[0].address = -1;

    params[1].location = SlotLocation.Register;
    params[1].register = 'Y';
    params[1].address = -1;
  }

  // More complex cases → use static memory
  // (already handled by frame allocation)
}
```

### 4.2 Parameter Passing Convention

| Parameters | Location |
|------------|----------|
| 1 byte | A register |
| 1 word | A/Y (A=low, Y=high) |
| 2 bytes | A and Y registers |
| 1 byte + 1 word | A register + static |
| 3+ bytes | Static memory |

---

## 5. Complete Slot Layout Pipeline

```typescript
function performSlotLayout(
  frames: Map<string, Frame>,
  module: ModuleDeclaration,
  zpResult: ZpAllocationResult,
  config: FrameAllocatorConfig
): SlotLayoutResult {
  const diagnostics: AllocationDiagnostic[] = [];

  // Phase 1: Analyze access patterns
  const accessInfoMap = new Map<string, Map<string, SlotAccessInfo>>();
  for (const decl of module.declarations) {
    if (isFunctionDeclaration(decl)) {
      const frame = frames.get(decl.name);
      if (frame) {
        const accessInfo = analyzeSlotAccess(decl, frame.slots);
        accessInfoMap.set(decl.name, accessInfo);

        // Update slots with access info
        for (const slot of frame.slots) {
          const info = accessInfo.get(slot.name);
          if (info) {
            slot.accessCount = info.readCount + info.writeCount;
            slot.maxLoopDepth = info.maxLoopDepth;
          }
        }
      }
    }
  }

  // Phase 2: Compute ZP scores
  for (const [funcName, frame] of frames) {
    const accessInfo = accessInfoMap.get(funcName)!;
    for (const slot of frame.slots) {
      const info = accessInfo.get(slot.name) ?? {
        readCount: 0, writeCount: 0, maxLoopDepth: 0, isHotPath: false
      };
      slot.zpScore = computeZpScore(slot, info, config.zpWeights);
    }
  }

  // Phase 3: Apply ZP allocations
  layoutSlots(frames, zpResult, config);

  // Phase 4: Apply register allocations (optional)
  for (const frame of frames.values()) {
    if (config.enableRegisterParams) {
      allocateParameterRegisters(frame);
    }
  }

  // Phase 5: Generate diagnostics
  for (const [funcName, frame] of frames) {
    const zpSlots = frame.getZpSlots();
    if (zpSlots.length > 0) {
      diagnostics.push({
        severity: DiagnosticSeverity.Info,
        code: DiagnosticCodes.ZP_AUTO_ALLOCATED,
        message: `Function '${funcName}': ${zpSlots.length} slot(s) in zero page.`,
        functionName: funcName,
      });
    }
  }

  return { frames, diagnostics };
}
```

---

## 6. Final Frame Layout Example

### 6.1 Source Code

```
fn process(@zp buffer: byte[16], size: byte): word {
    let i: byte = 0;
    let sum: word = 0;
    while i < size {
        sum = sum + buffer[i];
        i = i + 1;
    }
    return sum;
}
```

### 6.2 Access Analysis

| Slot | Reads | Writes | Loop Depth | ZP Score |
|------|-------|--------|------------|----------|
| buffer | 16+ | 0 | 1 | 20480 (@zp + pointer) |
| size | 16+ | 0 | 1 | 320 (byte in loop) |
| i | 32+ | 16+ | 1 | 960 (hot loop var) |
| sum | 16+ | 16+ | 1 | 640 (word in loop) |
| __return | 1 | 1 | 0 | 160 |

### 6.3 Final Layout

```
Zero Page ($02-$8F):
  $02-$11: buffer (16 bytes) ← @zp directive
  $12:     i (1 byte)        ← high score (loop var)
  $13-$14: sum (2 bytes)     ← high score (loop var)

Frame Region ($0200+):
  $0200:   size (1 byte)     ← not critical enough for ZP
  $0201-$0202: __return (2 bytes)

Total ZP used: 19 bytes
Total Frame used: 3 bytes
```

---

## 7. Slot Address Resolution API

### 7.1 Getting Slot Addresses

```typescript
interface SlotAddress {
  /** The slot */
  slot: FrameSlot;
  /** Location type */
  location: SlotLocation;
  /** Absolute address (for ZP and Frame) */
  address: number;
  /** Register name (for Register) */
  register?: string;
  /** Is this address in zero page? */
  isZeroPage: boolean;
}

function resolveSlotAddress(
  frameMap: FrameMap,
  functionName: string,
  slotName: string
): SlotAddress {
  const frame = frameMap.getFrame(functionName);
  if (!frame) {
    throw new Error(`Unknown function: ${functionName}`);
  }

  const slot = frame.getSlot(slotName);
  if (!slot) {
    throw new Error(`Unknown slot: ${slotName} in ${functionName}`);
  }

  return {
    slot,
    location: slot.location,
    address: slot.address,
    register: slot.register,
    isZeroPage: slot.location === SlotLocation.ZeroPage,
  };
}
```

### 7.2 Code Generation Integration

```typescript
// In code generator:
function emitLoadVariable(funcName: string, varName: string): void {
  const addr = resolveSlotAddress(frameMap, funcName, varName);

  switch (addr.location) {
    case SlotLocation.Register:
      // Already in register, no load needed
      // (or TAX/TYA if need to move)
      break;

    case SlotLocation.ZeroPage:
      // Use zero page addressing (2 bytes, 3 cycles)
      emit(`LDA $${addr.address.toString(16).padStart(2, '0')}`);
      break;

    case SlotLocation.FrameRegion:
      // Use absolute addressing (3 bytes, 4 cycles)
      emit(`LDA $${addr.address.toString(16).padStart(4, '0')}`);
      break;
  }
}
```

---

## 8. Summary

| Phase | Input | Output |
|-------|-------|--------|
| 1. Access Analysis | AST | SlotAccessInfo per slot |
| 2. ZP Scoring | Access info + weights | zpScore per slot |
| 3. Layout Slots | Frames + ZP result | Final addresses |
| 4. Register Alloc | Parameters | Register assignments |
| 5. Diagnostics | All info | Info/warning messages |

### Complete Allocation Pipeline

```
Call Graph → Frame Sizes → Address Assignment → Slot Layout → Final FrameMap
    ↓             ↓               ↓                 ↓
Recursion     Shells        Coalesce Groups    ZP + Frame
Detection                                       Addresses
```

---

**Previous Document:** [02c-address-assignment.md](02c-address-assignment.md)  
**Next Document:** [03-zeropage-strategy.md](03-zeropage-strategy.md)