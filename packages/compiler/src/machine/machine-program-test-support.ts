import { NMOS_6510 } from "../target/nmos6510.js";
import { machineCost, machineInstruction, machineState } from "./lower-control.js";
import type {
  MachineBlock,
  MachineFunction,
  MachineInstruction,
  MachineProgram,
} from "./machine-types.js";

/**
 * Minimal machine programs for exercising the validator directly.
 *
 * Several suites judge the same validator and need the same handful of shapes. Keeping the
 * builders here means a change to what a well-formed program looks like is made once, rather
 * than drifting between suites that are supposed to agree.
 */

/**
 * A tiny closed program, so a validator verdict is isolated from source lowering.
 *
 * @param blocks Blocks of the startup function, which is the program's entry.
 * @param functions Further functions the program contains, if any.
 * @returns A complete program with no data and no storage requests.
 * @example program([{ label: "entry", instructions: [], terminator: { kind: "return" } }])
 */
export function machineTestProgram(
  blocks: readonly MachineBlock[],
  functions: readonly MachineFunction[] = [],
): MachineProgram {
  return { startup: { id: "startup", blocks }, functions, data: [], requiredStorage: [] };
}

/**
 * One implied-mode instruction with the exact state and cost the CPU grid records for it.
 *
 * @param opcode Lowercase mnemonic with an implied form.
 * @returns The selected instruction.
 * @example impliedInstruction("clv")
 */
export function impliedInstruction(opcode: string): MachineInstruction {
  return machineInstruction(NMOS_6510, opcode, "implied", null);
}

/**
 * A conditional terminator reading one flag, for proving a branch's producer is required.
 *
 * @param target Block taken when the branch is taken.
 * @param fallthrough Block reached when it is not.
 * @param flag Flag the branch reads; the opcode follows from it.
 * @returns The terminator.
 * @example branchTerminator("then", "else")
 */
export function branchTerminator(
  target: string,
  fallthrough: string,
  flag: "v" | "z" = "v",
): MachineBlock["terminator"] {
  const opcode = flag === "v" ? "bvs" : "beq";
  return {
    kind: "branch",
    opcode,
    target,
    fallthrough,
    uses: machineState([], [flag]),
    cost: machineCost(NMOS_6510, opcode, "relative"),
  };
}

/** An empty block that returns, used as the destination an edge needs in order to be legal. */
export const exitBlock: MachineBlock = {
  label: "exit",
  instructions: [],
  terminator: { kind: "return" },
};
