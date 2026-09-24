import type { StorageClosureCertificate, StorageHome } from "../storage/storage-types.js";
import { NMOS_6510, nmosInstructionState } from "../target/nmos6510.js";
import { machineCost } from "./lower-control.js";
import { validateMachineInstruction } from "./validate.js";
import type {
  MachineBindingResult,
  MachineFunction,
  MachineInstruction,
  MachineMemoryAddress,
  MachineOperand,
  MachineProgram,
} from "./machine-types.js";

/** Resolve and bounds-check one certified storage home plus byte offset. */
function resolveHome(
  homes: ReadonlyMap<string, StorageHome>,
  requestId: string,
  offset: number,
): { readonly home: StorageHome; readonly address: number } | null {
  const home = homes.get(requestId);
  if (home === undefined || !Number.isInteger(offset) || offset < 0 || offset >= home.bytes) {
    return null;
  }
  return Object.freeze({ home, address: home.address + offset });
}

/** Bind one structured operand, preserving the physical indirect mode where required. */
function bindOperand(
  operand: MachineOperand | null,
  homes: ReadonlyMap<string, StorageHome>,
): {
  readonly operand: MachineOperand | null;
  readonly mode: "immediate" | "zero-page" | "absolute" | null;
} | null {
  if (operand === null || (operand.kind !== "storage" && operand.kind !== "indirect-y")) {
    return Object.freeze({ operand, mode: null });
  }
  const resolved = resolveHome(homes, operand.requestId, operand.offset ?? 0);
  if (resolved === null) return null;
  if (operand.kind === "storage" && operand.addressByte !== undefined) {
    return Object.freeze({
      operand: Object.freeze({
        kind: "immediate",
        value:
          operand.addressByte === "low" ? resolved.address & 0xff : (resolved.address >> 8) & 0xff,
      }),
      mode: "immediate",
    });
  }
  return Object.freeze({
    operand: Object.freeze({ kind: "absolute", value: resolved.address }),
    mode: resolved.home.region === "zero-page" ? "zero-page" : "absolute",
  });
}

/** Bind a memory-effect address to the same certified physical home. */
function bindAddress(
  address: MachineMemoryAddress,
  homes: ReadonlyMap<string, StorageHome>,
): MachineMemoryAddress | null {
  if (address.kind !== "storage" && address.kind !== "indirect-y") return address;
  const offset = address.offset ?? 0;
  const resolved = resolveHome(
    homes,
    address.requestId,
    address.kind === "indirect-y" ? 0 : offset,
  );
  if (resolved === null) return null;
  if (address.kind === "indirect-y") {
    return Object.freeze({
      kind: "indirect-y-bound",
      pointer: resolved.address,
      displacement: address.offset ?? 0,
    });
  }
  return Object.freeze({ kind: "absolute", value: resolved.address });
}

/** Return whether an inclusive address range is contained in one profile window. */
function inRanges(
  address: number,
  bytes: number,
  ranges: readonly { readonly start: number; readonly end: number }[],
): boolean {
  return ranges.some(({ start, end }) => address >= start && address + bytes - 1 <= end);
}

/** Verify certificate identity and every request-to-home fact before binding. */
function validateHomes(
  program: MachineProgram,
  certificate: StorageClosureCertificate,
): string | null {
  if (
    (program.storageInventoryHash !== undefined &&
      program.storageInventoryHash !== certificate.inventoryHash) ||
    (program.storageProfileId !== undefined && program.storageProfileId !== certificate.profileId)
  ) {
    return "";
  }
  const certifiedRequests = program.certifiedStorage ?? program.requiredStorage;
  const requests = new Map(certifiedRequests.map((request) => [request.id, request] as const));
  if (requests.size !== certifiedRequests.length) return "";
  const homes = new Map(certificate.homes.map((home) => [home.requestId, home] as const));
  if (homes.size !== certificate.homes.length || homes.size !== requests.size) return "";
  for (const request of certifiedRequests) {
    const home = homes.get(request.id);
    if (home === undefined) return request.id;
    if (
      home.bytes !== request.bytes ||
      home.address % request.alignment !== 0 ||
      (request.region === "zero-page-required" && home.region !== "zero-page") ||
      (request.region === "ram" && home.region !== "ram")
    ) {
      return request.id;
    }
    const profile = program.storageProfile;
    if (
      profile !== undefined &&
      !inRanges(
        home.address,
        home.bytes,
        home.region === "zero-page" ? profile.zeroPage : profile.ram,
      )
    ) {
      return request.id;
    }
  }
  for (const { left, right } of certificate.interference) {
    const leftHome = homes.get(left);
    const rightHome = homes.get(right);
    if (leftHome === undefined || rightHome === undefined)
      return leftHome === undefined ? left : right;
    if (
      leftHome.region === rightHome.region &&
      leftHome.address <= rightHome.address + rightHome.bytes - 1 &&
      rightHome.address <= leftHome.address + leftHome.bytes - 1
    ) {
      return left;
    }
  }
  return null;
}

/**
 * Validate every instruction and control transfer in a fully physical machine program.
 * @param program Program whose storage and layout-owned operands are resolved.
 * @returns Whether every opcode, operand, state fact, cost and control target is valid.
 * @example validateMachineProgram(boundProgram)
 */
export function validateMachineProgram(program: MachineProgram): boolean {
  const allFlags = Object.freeze(["n", "v", "d", "i", "z", "c"] as const);
  const functions = [program.startup, ...program.functions];
  const labels = new Set([
    ...functions.map(({ id }) => id),
    ...functions.flatMap(({ blocks }) => blocks.map(({ label }) => label)),
    ...program.data.map(({ id }) => id),
  ]);
  const exactCost = (
    actual: { readonly bytes: number; readonly minCycles: number; readonly maxCycles: number },
    expected: { readonly bytes: number; readonly minCycles: number; readonly maxCycles: number },
  ) =>
    actual.bytes === expected.bytes &&
    actual.minCycles === expected.minCycles &&
    actual.maxCycles === expected.maxCycles;
  const validTerminator = (
    terminator: MachineFunction["blocks"][number]["terminator"],
  ): boolean => {
    if (terminator.kind === "unreachable") return true;
    if (terminator.kind === "fallthrough") return labels.has(terminator.target);
    if (terminator.kind === "return") {
      return (
        (terminator.opcode === undefined || terminator.opcode === "rts") &&
        (terminator.cost === undefined ||
          exactCost(terminator.cost, machineCost(NMOS_6510, "rts", "implied")))
      );
    }
    if (terminator.kind === "jump") {
      return (
        terminator.opcode === "jmp" &&
        labels.has(terminator.target) &&
        exactCost(terminator.cost, machineCost(NMOS_6510, "jmp", "absolute"))
      );
    }
    const state = nmosInstructionState(NMOS_6510, terminator.opcode, "relative");
    if (
      state === null ||
      terminator.uses.registers.join("\u0000") !== state.usesRegisters.join("\u0000") ||
      terminator.uses.flags.join("\u0000") !== state.usesFlags.join("\u0000") ||
      !labels.has(terminator.fallthrough)
    ) {
      return false;
    }
    if (terminator.kind === "branch") {
      return (
        labels.has(terminator.target) &&
        exactCost(terminator.cost, machineCost(NMOS_6510, terminator.opcode, "relative"))
      );
    }
    return (
      labels.has(terminator.jump.target) &&
      terminator.jump.opcode === "jmp" &&
      exactCost(terminator.jump.cost, machineCost(NMOS_6510, "jmp", "absolute")) &&
      exactCost(terminator.cost, { bytes: 5, minCycles: 3, maxCycles: 5 })
    );
  };
  return functions.every((fn) =>
    fn.blocks.every(
      (block) =>
        block.instructions.every((instruction) => {
          if (validateMachineInstruction(instruction, NMOS_6510, allFlags).kind !== "complete") {
            return false;
          }
          if (
            (instruction.opcode === "jsr" || instruction.opcode === "jmp") &&
            instruction.operand?.kind === "label"
          ) {
            return labels.has(instruction.operand.label);
          }
          return true;
        }) && validTerminator(block.terminator),
    ),
  );
}

/** Bind one instruction without creating any storage request. */
function bindInstruction(
  instruction: MachineInstruction,
  homes: ReadonlyMap<string, StorageHome>,
): MachineInstruction | null {
  const bound = bindOperand(instruction.operand, homes);
  if (bound === null) return null;
  const memory = instruction.memory.map((effect) => {
    const address = bindAddress(effect.address, homes);
    return address === null ? null : Object.freeze({ ...effect, address });
  });
  if (memory.some((effect) => effect === null)) return null;

  let mode = instruction.mode;
  if (instruction.operand?.kind === "storage") mode = bound.mode!;
  else if (instruction.operand?.kind === "indirect-y") mode = "indirect-indexed-y";
  const cost =
    mode === instruction.mode ? instruction.cost : machineCost(NMOS_6510, instruction.opcode, mode);
  return Object.freeze({
    ...instruction,
    mode,
    operand: bound.operand,
    memory: Object.freeze(memory.filter((effect) => effect !== null)),
    cost,
  });
}

/** Bind every instruction in one machine function. */
function bindFunction(
  fn: MachineFunction,
  homes: ReadonlyMap<string, StorageHome>,
): MachineFunction | null {
  const blocks = fn.blocks.map((block) => {
    const instructions = block.instructions.map((instruction) =>
      bindInstruction(instruction, homes),
    );
    if (instructions.some((instruction) => instruction === null)) return null;
    return Object.freeze({
      ...block,
      instructions: Object.freeze(instructions.filter((instruction) => instruction !== null)),
    });
  });
  if (blocks.some((block) => block === null)) return null;
  return Object.freeze({
    ...fn,
    blocks: Object.freeze(blocks.filter((block) => block !== null)),
  });
}

/** Share byte-multiply bodies only when final physical scratch and instructions match exactly. */
function shareBoundByteMultiplyHelpers(
  functions: readonly MachineFunction[],
): readonly MachineFunction[] {
  const suffixes = ["", ".loop", ".add", ".skip", ".finish"];
  const canonical = new Map<string, string>();
  const redirects = new Map<string, string>();
  const removed = new Set<string>();
  for (const fn of functions) {
    const byLabel = new Map(fn.blocks.map((block) => [block.label, block] as const));
    for (const entry of fn.blocks) {
      if (!entry.label.endsWith(".multiply.1")) continue;
      const body = suffixes.map((suffix) => byLabel.get(`${entry.label}${suffix}`));
      if (body.some((block) => block === undefined)) continue;
      // Source spans and private labels differ, but physical operands and costs must agree.
      const fingerprint = JSON.stringify(body, (key, value: unknown) => {
        if (key === "source") return undefined;
        if (
          (key === "label" || key === "target" || key === "fallthrough") &&
          typeof value === "string" &&
          value.startsWith(entry.label)
        ) {
          return value.slice(entry.label.length);
        }
        return value;
      });
      const shared = canonical.get(fingerprint);
      if (shared === undefined) {
        canonical.set(fingerprint, entry.label);
      } else {
        redirects.set(entry.label, shared);
        for (const suffix of suffixes) removed.add(`${entry.label}${suffix}`);
      }
    }
  }
  if (redirects.size === 0) return functions;
  return Object.freeze(
    functions.map((fn) =>
      Object.freeze({
        ...fn,
        blocks: Object.freeze(
          fn.blocks
            .filter((block) => !removed.has(block.label))
            .map((block) =>
              Object.freeze({
                ...block,
                instructions: Object.freeze(
                  block.instructions.map((instruction) => {
                    if (instruction.opcode !== "jsr" || instruction.operand?.kind !== "label") {
                      return instruction;
                    }
                    const target = redirects.get(instruction.operand.label);
                    return target === undefined
                      ? instruction
                      : Object.freeze({
                          ...instruction,
                          operand: Object.freeze({ ...instruction.operand, label: target }),
                        });
                  }),
                ),
              }),
            ),
        ),
      }),
    ),
  );
}

/**
 * Replace every symbolic storage operand using one final closure certificate.
 * @param program Structured machine program with finite storage operands.
 * @param certificate Final no-addition storage proof.
 * @returns A bound program or a terminal post-closure failure.
 */
export function bindMachineProgram(
  program: MachineProgram,
  certificate: StorageClosureCertificate,
): MachineBindingResult {
  if (!certificate.closed) {
    return Object.freeze({ kind: "error", reason: "certificate", requestId: null });
  }
  const invalidHome = validateHomes(program, certificate);
  if (invalidHome !== null) {
    return Object.freeze({
      kind: "error",
      reason: "invalid-storage",
      requestId: invalidHome.length === 0 ? null : invalidHome,
    });
  }
  const homes = new Map(certificate.homes.map((home) => [home.requestId, home] as const));
  const missing = program.requiredStorage.find(({ id }) => !homes.has(id));
  if (missing !== undefined) {
    return Object.freeze({ kind: "error", reason: "missing-storage", requestId: missing.id });
  }
  const functions = program.functions.map((fn) => bindFunction(fn, homes));
  const startup = bindFunction(program.startup, homes);
  if (functions.some((fn) => fn === null) || startup === null) {
    return Object.freeze({ kind: "error", reason: "invalid-storage", requestId: null });
  }
  const boundProgram = Object.freeze({
    ...program,
    functions: shareBoundByteMultiplyHelpers(functions.filter((fn) => fn !== null)),
    startup,
  });
  if (!validateMachineProgram(boundProgram)) {
    return Object.freeze({ kind: "error", reason: "invalid-storage", requestId: null });
  }
  return Object.freeze({
    kind: "complete",
    program: boundProgram,
  });
}
