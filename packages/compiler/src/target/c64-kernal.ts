import type { C64KernalProfileFacts } from "../profile/c64-kernal.js";

/** C64 device addresses and layout facts owned by the selected machine profile. */
export interface C64MachineFacts {
  /** Stable machine/ROM/video/SID identity. */
  readonly id: `c64-${C64KernalProfileFacts["video"]}-kernal-901227-03-${C64KernalProfileFacts["sidModel"]}`;
  /** Nominal VIC cycles per selected video frame, before device bus denial. */
  readonly cyclesPerFrame: number;
  /** First address in VIC bank zero. */
  readonly vicBankStart: 0x0000;
  /** Last address in VIC bank zero. */
  readonly vicBankEnd: 0x3fff;
  /** Active screen matrix base. */
  readonly screenAddress: 0x0400;
  /** Inclusive end of the active screen matrix. */
  readonly screenEnd: 0x07ff;
  /** First VIC-invisible character-ROM window address in bank zero. */
  readonly characterRomStart: 0x1000;
  /** Last VIC-invisible character-ROM window address in bank zero. */
  readonly characterRomEnd: 0x1fff;
  /** First preferred resident-sprite address. */
  readonly spriteStart: 0x2000;
  /** VIC raster-line register used for frame observation. */
  readonly vicRaster: 0xd012;
  /** Raster line used as the qualified end-of-frame update boundary. */
  readonly frameWaitRasterLine: 0xfb;
  /** First sprite X/Y position register. */
  readonly spritePositionBase: 0xd000;
  /** Sprite X-coordinate most-significant-bit register. */
  readonly spriteXHigh: 0xd010;
  /** Sprite enable register. */
  readonly spriteEnable: 0xd015;
  /** Sprite vertical-expansion register. */
  readonly spriteYExpand: 0xd017;
  /** VIC memory-pointer register. */
  readonly vicMemoryPointer: 0xd018;
  /** Sprite foreground/background-priority register. */
  readonly spritePriority: 0xd01b;
  /** Sprite multicolor-mode register. */
  readonly spriteMulticolor: 0xd01c;
  /** Sprite horizontal-expansion register. */
  readonly spriteXExpand: 0xd01d;
  /** Sprite/sprite participant latch; a read clears it without acknowledging the IRQ. */
  readonly spriteSpriteCollisions: 0xd01e;
  /** Sprite/background participant latch; a read clears it without acknowledging the IRQ. */
  readonly spriteBackgroundCollisions: 0xd01f;
  /** Border color register. */
  readonly borderColor: 0xd020;
  /** Background color register. */
  readonly backgroundColor: 0xd021;
  /** First sprite color register. */
  readonly spriteColorBase: 0xd027;
  /** Joystick port 2 sample register. */
  readonly joystick2: 0xdc00;
  /** Base address of CIA1 timer, control and interrupt registers. */
  readonly cia1Base: 0xdc00;
  /** Base address of CIA2 timer, control and interrupt registers. */
  readonly cia2Base: 0xdd00;
  /** CIA2 port A, including inverted VIC-bank selection bits. */
  readonly cia2PortA: 0xdd00;
  /** CIA2 port-A data-direction register. */
  readonly cia2DataDirection: 0xdd02;
  /** First active screen sprite-pointer byte. */
  readonly spritePointerBase: 0x07f8;
}

/** Serializer identity kept separate from CPU and platform meaning. */
export interface SerializerFacts {
  /** Selected terminal serializer and version. */
  readonly id: "acme-0.97";
}

/** Artifact-packager identity kept separate from machine code. */
export interface PackagerFacts {
  /** Selected container format. */
  readonly id: "cbm-prg";
  /** First loaded byte after the two-byte PRG header. */
  readonly loadAddress: 0x0801;
  /** Machine-code startup entry named by the BASIC stub. */
  readonly startupAddress: 0x080d;
  /** First address admitted for the complete resident artifact. */
  readonly residentStart: 0x0801;
  /** Last address admitted for resident code, data and imported assets. */
  readonly residentEnd: 0xcfff;
}

/** Frozen cooperative C64 resource budgets; emitted bytes and BSS share the same resident range. */
export const C64_RESOURCE_BUDGETS = Object.freeze({
  /** Maximum resident payload bytes in the selected program range. */
  binary: 51_199,
  /** Total bytes available to resident payload and uninitialized storage together. */
  ram: 51_199,
  /** Zero-page bytes owned by the program under the cooperative KERNAL profile. */
  zeroPage: 142,
  /** Percentage of a resource budget at which its advisory warning starts. */
  warningPercent: 75,
  /** Simultaneously live hardware-stack bytes at which its advisory warning starts. */
  stackWarning: 188,
});

/** Device addresses and ownership stay identical across the cooperative video/SID choices. */
const COMMON_MACHINE: Omit<C64MachineFacts, "id" | "cyclesPerFrame"> = Object.freeze({
  vicBankStart: 0x0000,
  vicBankEnd: 0x3fff,
  screenAddress: 0x0400,
  screenEnd: 0x07ff,
  characterRomStart: 0x1000,
  characterRomEnd: 0x1fff,
  spriteStart: 0x2000,
  vicRaster: 0xd012,
  frameWaitRasterLine: 0xfb,
  spritePositionBase: 0xd000,
  spriteXHigh: 0xd010,
  spriteEnable: 0xd015,
  spriteYExpand: 0xd017,
  vicMemoryPointer: 0xd018,
  spritePriority: 0xd01b,
  spriteMulticolor: 0xd01c,
  spriteXExpand: 0xd01d,
  spriteSpriteCollisions: 0xd01e,
  spriteBackgroundCollisions: 0xd01f,
  borderColor: 0xd020,
  backgroundColor: 0xd021,
  spriteColorBase: 0xd027,
  joystick2: 0xdc00,
  cia1Base: 0xdc00,
  cia2Base: 0xdd00,
  cia2PortA: 0xdd00,
  cia2DataDirection: 0xdd02,
  spritePointerBase: 0x07f8,
});

/**
 * Compose machine identity and timing from the same immutable row used by source constants.
 * The selected SID model changes identity only; it adds no initialization or runtime state.
 * @example createC64KernalMachine(facts).cyclesPerFrame === facts.cyclesPerFrame
 */
export function createC64KernalMachine(facts: C64KernalProfileFacts): C64MachineFacts {
  return Object.freeze({
    ...COMMON_MACHINE,
    id: `c64-${facts.video}-kernal-901227-03-${facts.sidModel}`,
    cyclesPerFrame: facts.cyclesPerFrame,
  });
}

/** Exact selected ACME serializer identity. */
export const ACME_097: SerializerFacts = Object.freeze({ id: "acme-0.97" });

/** Exact selected Commodore PRG packager facts. */
export const CBM_PRG: PackagerFacts = Object.freeze({
  id: "cbm-prg",
  loadAddress: 0x0801,
  startupAddress: 0x080d,
  residentStart: 0x0801,
  residentEnd: 0xcfff,
});
