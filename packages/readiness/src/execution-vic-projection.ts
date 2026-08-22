import type { ExecutionOperationResultV1 } from "./execution-contracts.js";

interface VicRegisterBehavior {
  readonly address: number;
  readonly readableHighBits: number;
  readonly writableMask: number;
}

const VIC_COLOR_BEHAVIORS: ReadonlyMap<number, VicRegisterBehavior> = new Map(
  [0xd020, 0xd021, 0xd022].map((address) => [
    address,
    Object.freeze({ address, readableHighBits: 0xf0, writableMask: 0x0f }),
  ]),
);

function projectVicColorByte(
  address: number,
  logicalByte: number,
): ExecutionOperationResultV1<number> {
  const behavior = VIC_COLOR_BEHAVIORS.get(address);
  if (
    behavior === undefined ||
    !Number.isSafeInteger(logicalByte) ||
    logicalByte < 0 ||
    logicalByte > 0xff
  ) {
    const issues = [
      Object.freeze({
        code: "invalid-evidence-input" as const,
        path: behavior === undefined ? "/address" : "/logicalByte",
        message: "C64 color projection requires one supported address and one logical byte.",
      }),
    ] as const;
    return Object.freeze({
      ok: false,
      issues: Object.freeze(issues),
    });
  }
  return Object.freeze({
    ok: true,
    value: behavior.readableHighBits | (logicalByte & behavior.writableMask),
  });
}

/** Projects a logical fixture byte through the C64 VIC color-register readback behavior. */
export function projectC64InitialStateV1(
  address: number,
  logicalByte: number,
): ExecutionOperationResultV1<number> {
  return projectVicColorByte(address, logicalByte);
}

/** Projects a logical write through the C64 VIC color-register observation behavior. */
export function projectC64ActualWriteV1(
  address: number,
  logicalByte: number,
): ExecutionOperationResultV1<number> {
  return projectVicColorByte(address, logicalByte);
}
