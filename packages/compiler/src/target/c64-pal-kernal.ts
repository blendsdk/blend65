/** C64 device addresses and layout facts owned by the selected machine profile. */
export interface C64MachineFacts {
  /** Stable machine/ROM/video/SID identity. */
  readonly id: "c64-pal-kernal-901227-03-6581";
  /** PAL VIC cycles per frame. */
  readonly cyclesPerFrame: 19656;
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
  /** VIC control register used for frame observation. */
  readonly vicControl1: 0xd011;
  /** Sprite X-coordinate most-significant-bit register. */
  readonly spriteXHigh: 0xd010;
  /** Sprite enable register. */
  readonly spriteEnable: 0xd015;
  /** VIC memory-pointer register. */
  readonly vicMemoryPointer: 0xd018;
  /** Border color register. */
  readonly borderColor: 0xd020;
  /** First sprite color register. */
  readonly spriteColorBase: 0xd027;
  /** Joystick port 2 sample register. */
  readonly joystick2: 0xdc00;
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
  readonly residentEnd: 0xbfff;
}

/** Exact selected C64 PAL machine facts. */
export const C64_PAL_KERNAL_6581: C64MachineFacts = Object.freeze({
  id: "c64-pal-kernal-901227-03-6581",
  cyclesPerFrame: 19656,
  vicBankStart: 0x0000,
  vicBankEnd: 0x3fff,
  screenAddress: 0x0400,
  screenEnd: 0x07ff,
  characterRomStart: 0x1000,
  characterRomEnd: 0x1fff,
  spriteStart: 0x2000,
  vicControl1: 0xd011,
  spriteXHigh: 0xd010,
  spriteEnable: 0xd015,
  vicMemoryPointer: 0xd018,
  borderColor: 0xd020,
  spriteColorBase: 0xd027,
  joystick2: 0xdc00,
  cia2PortA: 0xdd00,
  cia2DataDirection: 0xdd02,
  spritePointerBase: 0x07f8,
});

/** Exact selected ACME serializer identity. */
export const ACME_097: SerializerFacts = Object.freeze({ id: "acme-0.97" });

/** Exact selected Commodore PRG packager facts. */
export const CBM_PRG: PackagerFacts = Object.freeze({
  id: "cbm-prg",
  loadAddress: 0x0801,
  startupAddress: 0x080d,
  residentStart: 0x0801,
  residentEnd: 0xbfff,
});
