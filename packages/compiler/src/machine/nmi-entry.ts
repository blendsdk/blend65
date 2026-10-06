import type { BindingId } from "../frontend/semantic-types.js";
import type { InterruptExecutionContext } from "../semantic/interrupt-contexts.js";
import type { NmiEntryStackDemand } from "../storage/storage-types.js";
import type { InterruptVariantFacts, TargetProfile } from "../target/profile.js";
import { createC64InterruptEntry } from "./lower-c64-interrupt.js";
import type { MachineFunction, MachineRegister } from "./machine-types.js";

/** One proved NMI body awaiting the completed ordinary-callee machine catalogue. */
export interface PendingC64NmiEntry {
  /** Complete selected body, including its source placement constraints. */
  readonly body: MachineFunction;
  /** Stable published entry identity. */
  readonly id: string;
  /** Selected cooperative entry and terminal contract. */
  readonly variant: InterruptVariantFacts;
  /** Exact immutable predecessor word observed by this entry. */
  readonly linkRequestId: string;
  /** Source handler, retained independently of the machine label spelling. */
  readonly handler: BindingId;
  /** Real reached contexts projected into this selected body, not raw retention. */
  readonly contexts: readonly InterruptExecutionContext[];
}

/**
 * Collect actual transitive register writes without interpreting source values.
 * Unknown calls or indirect jumps preserve all registers conservatively. Local
 * helper blocks are already part of their owning function's instruction set.
 */
function registerClobbers(
  body: MachineFunction,
  callees: ReadonlyMap<string, MachineFunction>,
): ReadonlySet<MachineRegister> {
  const clobbers = new Set<MachineRegister>();
  const pending = [body];
  const visited = new Set<MachineFunction>();
  const preserveAll = () => {
    for (const register of ["a", "x", "y"] as const) clobbers.add(register);
  };
  for (let cursor = 0; cursor < pending.length; cursor += 1) {
    const fn = pending[cursor]!;
    if (visited.has(fn)) continue;
    visited.add(fn);
    for (const block of fn.blocks) {
      for (const instruction of block.instructions) {
        for (const register of instruction.defines.registers) clobbers.add(register);
        if (instruction.opcode === "jmp" && instruction.mode === "indirect") preserveAll();
        if (instruction.opcode !== "jsr") continue;
        const label = instruction.operand?.kind === "label" ? instruction.operand.label : null;
        const callee = label === null ? undefined : callees.get(label);
        if (callee !== undefined) pending.push(callee);
        else if (!fn.blocks.some((local) => local.label === label)) preserveAll();
      }
    }
  }
  return clobbers;
}

/**
 * Construct proved NMI wrappers after every ordinary machine callee is available.
 * @param entries Complete selected bodies with their exact predecessor bindings.
 * @param functions Already lowered ordinary functions and existing IRQ/raw entries.
 * @param profile Exact selected C64 CPU and firmware contract.
 * @returns Complete wrappers and their actual reached stack demands for closure.
 */
export function createC64NmiEntries(
  entries: readonly PendingC64NmiEntry[],
  functions: readonly MachineFunction[],
  profile: TargetProfile,
): {
  /** Complete selected wrappers, including nonexecuted retained dependencies. */
  readonly functions: readonly MachineFunction[];
  /** Only actual generated-entry invocations receive a stack demand. */
  readonly stackDemands: readonly NmiEntryStackDemand[];
} {
  const callees = new Map(
    functions.flatMap((fn) => [
      [fn.id, fn] as const,
      ...fn.blocks.map((block) => [block.label, fn] as const),
    ]),
  );
  const wrappers = Object.freeze(
    entries.map(({ body, id, variant, linkRequestId }) =>
      createC64InterruptEntry(
        body,
        id,
        variant,
        linkRequestId,
        profile,
        registerClobbers(body, callees),
      ),
    ),
  );
  const stackDemands = entries.flatMap((entry, index) => {
    if (entry.contexts.length === 0) return [];
    const entryStackBytes = wrappers[index]!.nmiEntryStackBytes;
    if (entryStackBytes === undefined) throw new Error("Selected NMI entry has no stack cost");
    return [
      Object.freeze({
        id: entry.id,
        handler: entry.handler,
        contexts: Object.freeze([...entry.contexts]),
        entryStackBytes,
      }),
    ];
  });
  return Object.freeze({ functions: wrappers, stackDemands: Object.freeze(stackDemands) });
}
