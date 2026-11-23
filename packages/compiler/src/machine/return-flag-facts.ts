import { plainEntryLabel } from "./call-site-facts.js";
import type { MachineFunction, MachineInstruction } from "./machine-types.js";

/**
 * Whether one block ending in a return leaves N and Z describing the byte in A.
 *
 * Read backwards from the end of the block: the last instruction to write A must
 * also have written both flags from that same write, and nothing after it may
 * write either flag again. A block that ends in a return without writing A at
 * all refuses rather than looking at its predecessors — a merge point reached
 * from a loop and from a zero-count branch carries the flags of a counter in
 * both cases, so following the edges would have to prove agreement across them
 * and is a wider claim than this one.
 */
function exitSettlesFlags(block: MachineFunction["blocks"][number]): boolean {
  for (let at = block.instructions.length - 1; at >= 0; at -= 1) {
    const instruction = block.instructions[at]!;
    if (instruction.defines.registers.includes("a"))
      return instruction.defines.flags.includes("n") && instruction.defines.flags.includes("z");
    if (instruction.defines.flags.includes("n") || instruction.defines.flags.includes("z"))
      return false;
  }
  return false;
}

/**
 * Whether a called body hands its caller a byte in A with N and Z describing it.
 *
 * The call convention promises no flags, and the call itself encodes none, so a
 * caller that wants to branch on a returned byte has to store and reload it. That
 * reload is only removable when the callee actually settles the pair, which is a
 * fact about the callee's exits rather than about the convention.
 *
 * Every reachable return has to agree, and the weakest one governs: a body whose
 * value falls out of a shift loop leaves the flags of the loop counter at that
 * exit, which describes X and says nothing about the returned byte, so such a
 * body refuses even when another of its exits would have qualified.
 *
 * A body cannot be asked about itself. Recursion is rejected by the language, so
 * no accepted program reaches that barrier; it stays because a certificate that
 * can rest on its own conclusion is not a certificate.
 *
 * @param bodies Every body in the program, indexed by the entry label a call names.
 * @param call The call whose returned byte a caller wants to branch on.
 * @param caller The body making the call.
 * @returns Whether N and Z certainly describe the byte in A after the call.
 *
 * @example
 * // `masked` is `lda seed; and #$07; rts`, so the `and` settles both flags.
 * returnSettlesFlags(bodies, jsrMasked, main); // true
 */
export function returnSettlesFlags(
  bodies: ReadonlyMap<string, MachineFunction>,
  call: MachineInstruction,
  caller: MachineFunction,
): boolean {
  const label = plainEntryLabel(call);
  if (label === undefined || label === caller.id) return false;
  const callee = bodies.get(label);
  if (callee === undefined) return false;
  const exits = callee.blocks.filter((block) => block.terminator.kind === "return");
  return exits.length > 0 && exits.every((block) => exitSettlesFlags(block));
}
