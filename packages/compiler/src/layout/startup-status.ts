import { machineInstruction } from "../machine/lower-control.js";
import type { MachineInstruction, MachineMemoryEffect } from "../machine/machine-types.js";
import type { StartupStackDemand } from "../storage/storage-types.js";
import type { TargetProfile } from "../target/profile.js";

/** Stable identity of the platform-owned cooperative-startup save area. */
export const C64_STARTUP_STATE_ID = "platform.startup-state";

/** Compact forms require display independence; stored status is a pressure-only construction. */
export type C64StartupPolicy =
  | "full"
  | "compact-unrolled"
  | "compact-looped"
  | "compact-stored"
  | "takeover";

/** Full display ownership also records the incoming hardware-stack pointer. */
const STARTUP_STATE = Object.freeze({
  /** Incoming accumulator. */
  a: 0,
  /** Incoming X register. */
  x: 1,
  /** Incoming Y register. */
  y: 2,
  /** Incoming processor status. */
  status: 3,
  /** Incoming stack pointer, used only by the full constructor. */
  stack: 4,
  /** CPU port direction. */
  cpuDirection: 5,
  /** CPU port data. */
  cpuPort: 6,
  /** CIA2 port-A direction; the unreadable output latch is never captured. */
  cia2Direction: 7,
  /** VIC memory selection. */
  vicMemory: 8,
  /** Sprite enable bits. */
  spriteEnable: 9,
  /** Sprite horizontal high bits. */
  spriteXHigh: 10,
  /** Sprite vertical expansion. */
  spriteYExpand: 11,
  /** Sprite/background priority. */
  spritePriority: 12,
  /** Sprite multicolor selection. */
  spriteMulticolor: 13,
  /** Sprite horizontal expansion. */
  spriteXExpand: 14,
  /** Border color. */
  border: 15,
  /** Background color. */
  background: 16,
  /** First of sixteen sprite position bytes. */
  spritePositions: 17,
  /** First of eight sprite color bytes. */
  spriteColors: 33,
  /** First of eight sprite pointer bytes. */
  spritePointers: 41,
  /** Base size, before snapshots of actually borrowed BASIC bytes. */
  bytes: 49,
});

/** Held-P startup needs only mapping bytes; unused full-state offsets are never accessed. */
const COMPACT_STARTUP_STATE = Object.freeze({
  ...STARTUP_STATE,
  cpuDirection: 0,
  cpuPort: 1,
  cia2Direction: 2,
  bytes: 3,
});

/** Balanced stored-P startup preserves registers without retaining a hardware-stack byte. */
const STORED_STARTUP_STATE = Object.freeze({
  ...STARTUP_STATE,
  cpuDirection: 4,
  cpuPort: 5,
  cia2Direction: 6,
  bytes: 7,
});

/** Raw takeover needs the caller/register state and the two owned port bytes only. */
const TAKEOVER_STARTUP_STATE = Object.freeze({
  ...STARTUP_STATE,
  cpuDirection: 5,
  cpuPort: 6,
  cia2Direction: 7,
  bytes: 8,
});

/** Return CPU-independent save offsets for one exact startup construction. */
export function startupStateLayout(policy: C64StartupPolicy) {
  if (policy === "takeover") return TAKEOVER_STARTUP_STATE;
  return policy === "compact-stored"
    ? STORED_STARTUP_STATE
    : policy === "full"
      ? STARTUP_STATE
      : COMPACT_STARTUP_STATE;
}

/** Load or store one byte in the platform save area, with its exact memory effect. */
export function startupStateInstruction(
  cpu: TargetProfile["cpu"],
  opcode: "lda" | "ldx" | "ldy" | "sta" | "stx" | "sty",
  offset: number,
): MachineInstruction {
  const effect: MachineMemoryEffect = Object.freeze({
    kind: opcode.startsWith("st") ? "write" : "read",
    address: Object.freeze({ kind: "symbolic", label: C64_STARTUP_STATE_ID, offset }),
    width: 1,
    volatile: false,
    order: 0,
  });
  return machineInstruction(
    cpu,
    opcode,
    "absolute",
    Object.freeze({ kind: "label", label: C64_STARTUP_STATE_ID, offset }),
    [effect],
  );
}

/**
 * Build register/status fragments without changing the existing constructors' instruction order.
 * Stored-P startup relies on the same proved balanced execution as held-P startup: it never
 * resets SP. Its original I/binary D handoff precedes initialization so initializer effects
 * remain live into main. The final PLP follows all register loads and preserves the caller's P.
 * @param cpu Selected CPU instruction forms.
 * @param policy Exact internal construction, already checked for display independence.
 * @returns Platform state layout, ordered fragments and actual platform stack demand.
 */
export function createStartupStatus(cpu: TargetProfile["cpu"], policy: C64StartupPolicy) {
  const takeover = policy === "takeover";
  const compact =
    policy === "compact-unrolled" || policy === "compact-looped" || policy === "compact-stored";
  const stored = policy === "compact-stored";
  const held = compact && !stored;
  const state = startupStateLayout(policy);
  const entry = [
    ...(held
      ? []
      : [
          startupStateInstruction(cpu, "sta", state.a),
          startupStateInstruction(cpu, "stx", state.x),
          startupStateInstruction(cpu, "sty", state.y),
        ]),
    machineInstruction(cpu, "php", "implied", null),
    ...(compact || takeover ? [machineInstruction(cpu, "sei", "implied", null)] : []),
    ...(held
      ? []
      : [
          machineInstruction(cpu, "pla", "implied", null),
          startupStateInstruction(cpu, "sta", state.status),
          ...(stored
            ? []
            : [
                machineInstruction(cpu, "tsx", "implied", null),
                startupStateInstruction(cpu, "stx", state.stack),
              ]),
        ]),
    machineInstruction(cpu, "cld", "implied", null),
  ];
  const beforeInitializers = stored
    ? [
        startupStateInstruction(cpu, "lda", state.status),
        machineInstruction(cpu, "pha", "implied", null),
        machineInstruction(cpu, "plp", "implied", null),
        machineInstruction(cpu, "cld", "implied", null),
      ]
    : [];
  const beforeMain = held
    ? [
        machineInstruction(cpu, "tsx", "implied", null),
        machineInstruction(cpu, "inx", "implied", null),
        machineInstruction(
          cpu,
          "lda",
          "absolute-x",
          Object.freeze({ kind: "absolute", value: 0x0100 }),
        ),
        machineInstruction(cpu, "pha", "implied", null),
        machineInstruction(cpu, "plp", "implied", null),
        machineInstruction(cpu, "cld", "implied", null),
      ]
    : [];
  const restore = held
    ? [
        machineInstruction(cpu, "tsx", "implied", null),
        machineInstruction(cpu, "inx", "implied", null),
        machineInstruction(
          cpu,
          "lda",
          "absolute-x",
          Object.freeze({ kind: "absolute", value: 0x0100 }),
        ),
        machineInstruction(cpu, "txs", "implied", null),
        machineInstruction(cpu, "pha", "implied", null),
        machineInstruction(cpu, "plp", "implied", null),
      ]
    : [
        ...(stored
          ? []
          : [
              startupStateInstruction(cpu, "ldx", state.stack),
              machineInstruction(cpu, "txs", "implied", null),
            ]),
        startupStateInstruction(cpu, "lda", state.status),
        machineInstruction(cpu, "pha", "implied", null),
        startupStateInstruction(cpu, "lda", state.a),
        startupStateInstruction(cpu, "ldx", state.x),
        startupStateInstruction(cpu, "ldy", state.y),
        machineInstruction(cpu, "plp", "implied", null),
      ];
  const stackDemand: StartupStackDemand = Object.freeze(
    held ? { heldBytes: 1, transientPeakBytes: 2 } : { heldBytes: 0, transientPeakBytes: 1 },
  );
  return Object.freeze({
    /** Exact platform save offsets; unused display offsets are never accessed by compact forms. */
    state,
    /** Capture original register/status values before platform transactions. */
    entry: Object.freeze(entry),
    /** Stored-P handoff before any source initializer. */
    beforeInitializers: Object.freeze(beforeInitializers),
    /** Existing held-P handoff after initialization. */
    beforeMain: Object.freeze(beforeMain),
    /** Final status/register restoration; no later instruction may change flags. */
    restore: Object.freeze(restore),
    /** Simultaneous platform bytes, independent of source/call/interrupt pushes. */
    stackDemand,
  });
}
