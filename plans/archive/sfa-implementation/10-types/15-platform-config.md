# Platform Configuration

> **Document**: 10-types/15-platform-config.md
> **Parent**: [10-overview.md](10-overview.md)

## PlatformConfig Interface

```typescript
export interface PlatformConfig {
  name: string;
  zeroPage: ZeroPageConfig;
  frameRegion: MemoryRegion;
  generalRam: MemoryRegion;
}

export interface ZeroPageConfig {
  start: number;      // First usable ZP address
  end: number;        // Last+1 ZP address
  reserved: number[]; // CPU/system reserved
  scratchStart: number;
  scratchEnd: number;
}

export interface MemoryRegion {
  start: number;
  end: number;
}
```

---

## C64 Configuration

```typescript
export const C64_PLATFORM: PlatformConfig = {
  name: 'c64',
  zeroPage: {
    start: 0x02,    // After CPU vectors
    end: 0x90,      // Before KERNAL area
    reserved: [0x00, 0x01],
    scratchStart: 0xfb,
    scratchEnd: 0xff,
  },
  frameRegion: {
    start: 0x0200,  // After stack
    end: 0x0400,    // Before screen RAM
  },
  generalRam: {
    start: 0x0800,  // After screen/BASIC
    end: 0xd000,    // Before I/O
  },
};
// ZP: 142 bytes, Frame: 512 bytes, RAM: ~51KB
```

---

## X16 Configuration

```typescript
export const X16_PLATFORM: PlatformConfig = {
  name: 'x16',
  zeroPage: {
    start: 0x22,    // After KERNAL usage
    end: 0x80,      // Before KERNAL workspace
    reserved: [],
    scratchStart: 0x7c,
    scratchEnd: 0x80,
  },
  frameRegion: {
    start: 0x0400,
    end: 0x0800,
  },
  generalRam: {
    start: 0x0800,
    end: 0x9f00,
  },
};
// ZP: 94 bytes, Frame: 1KB, RAM: ~38KB
```

---

## Helper Functions

```typescript
export function getZPSize(config: PlatformConfig): number {
  return config.zeroPage.end - config.zeroPage.start;
}

export function getFrameRegionSize(config: PlatformConfig): number {
  return config.frameRegion.end - config.frameRegion.start;
}

export function isValidZPAddress(config: PlatformConfig, addr: number): boolean {
  return addr >= config.zeroPage.start && 
         addr < config.zeroPage.end &&
         !config.zeroPage.reserved.includes(addr);
}
```

---

## Unit Tests

```typescript
describe('C64_PLATFORM', () => {
  it('should have 142 bytes ZP', () => {
    expect(getZPSize(C64_PLATFORM)).toBe(142);
  });

  it('should have 512 bytes frame region', () => {
    expect(getFrameRegionSize(C64_PLATFORM)).toBe(512);
  });
});
```

---

## Session
Implement in Session 1.3 per [../99-execution-plan.md](../99-execution-plan.md)