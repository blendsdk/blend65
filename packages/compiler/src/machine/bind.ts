import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { StorageClosureCertificate, StorageHome } from "../storage/storage-types.js";
import { NMOS_6510, nmosInstructionState } from "../target/nmos6510.js";
import { machineCost } from "./lower-control.js";
import { validateMachineInstruction } from "./validate.js";
import { findMachineFlagsDefect } from "./validate-flags.js";
import {
  machineProgramDefect,
  UNKNOWN_MACHINE_SITE,
  type MachineProgramDefect,
} from "./machine-defect.js";
import type {
  MachineBindingResult,
  MachineFunction,
  MachineInstruction,
  MachineMemoryAddress,
  MachineMemoryEffect,
  MachineOperand,
  MachineProgram,
  MachineBlock,
  MachineBodyOrigin,
  MachineTerminator,
  MachineValidationResult,
} from "./machine-types.js";

/** Explain each rejected-instruction family in the terms whoever wrote the source can check. */
const INSTRUCTION_DEFECTS: Readonly<
  Record<Extract<MachineValidationResult, { readonly kind: "error" }>["reason"], string>
> = {
  "opcode-mode": "is not a legal instruction form on this CPU",
  cost: "carries a recorded cycle cost that does not match the instruction",
  operand: "has an operand that does not fit its addressing mode",
  flag: "carries recorded processor-state effects that do not match the instruction",
};

/**
 * The checks that can refuse to bind one instruction's storage, kept apart from each other.
 *
 * They fail for unrelated reasons, and the refusal an author receives names the one that fired.
 * By the time an instruction is bound every demand the program declared already has a home, so
 * describing any of these as a missing home would report a check that passed.
 */
type StorageBindingFault = "unhomed" | "offset" | "indirect-page";

/**
 * Wording for each failed check, phrased for whoever wrote the source.
 *
 * Each one names the compiler or its generated code as the subject, because that is who is
 * responsible: an author supplies no storage homes and chooses no addresses, so a sentence about
 * certificates and homes would describe machinery they neither provided nor control.
 */
const STORAGE_BINDING_FAULTS: Readonly<Record<StorageBindingFault, string>> = {
  unhomed: "generated code refers to memory the compiler never allocated",
  // Not every rejected offset lies past the end of its home: one may be negative or not a whole
  // number of bytes, and an address-byte operand may legally name the byte one past the last.
  offset:
    "generated code refers to a byte that is not part of the storage " +
    "the compiler allocated for that value",
  // The pointer begins at the last byte of a page, which is what this processor mishandles. It
  // need not be the end of its home: an offset into a larger home reaches the same address.
  "indirect-page":
    "the compiler placed an indirect pointer at the last byte of a page, " +
    "where this processor takes its high byte from the start of that same page",
};

/** Resolve and bounds-check one certified storage home plus byte offset. */
function resolveHome(
  homes: ReadonlyMap<string, StorageHome>,
  requestId: string,
  offset: number,
): { readonly home: StorageHome; readonly address: number } | StorageBindingFault {
  const home = homes.get(requestId);
  if (home === undefined) return "unhomed";
  if (!Number.isInteger(offset) || offset < 0 || offset >= home.bytes) return "offset";
  return Object.freeze({ home, address: home.address + offset });
}

/** Bind one structured operand, preserving the physical indirect mode where required. */
function bindOperand(
  operand: MachineOperand | null,
  homes: ReadonlyMap<string, StorageHome>,
):
  | {
      readonly operand: MachineOperand | null;
      readonly mode: "immediate" | "zero-page" | "absolute" | null;
    }
  | StorageBindingFault {
  if (operand === null || (operand.kind !== "storage" && operand.kind !== "indirect-y")) {
    return Object.freeze({ operand, mode: null });
  }
  if (operand.kind === "storage" && operand.addressByte !== undefined) {
    const home = homes.get(operand.requestId);
    if (home === undefined) return "unhomed";
    const offset = operand.offset ?? 0;
    // An address byte may point one past the object's last byte (the expected load end).
    if (!Number.isInteger(offset) || offset < 0 || offset > home.bytes) return "offset";
    return Object.freeze({
      operand: Object.freeze({
        kind: "immediate",
        value:
          operand.addressByte === "low"
            ? (home.address + offset) & 0xff
            : ((home.address + offset) >> 8) & 0xff,
      }),
      mode: "immediate",
    });
  }
  const resolved = resolveHome(homes, operand.requestId, operand.offset ?? 0);
  if (typeof resolved === "string") return resolved;
  return Object.freeze({
    operand: Object.freeze({ kind: "absolute", value: resolved.address }),
    mode: resolved.home.region === "zero-page" ? "zero-page" : "absolute",
  });
}

/** Bind a memory-effect address to the same certified physical home. */
function bindAddress(
  address: MachineMemoryAddress,
  homes: ReadonlyMap<string, StorageHome>,
): MachineMemoryAddress | StorageBindingFault {
  if (address.kind !== "storage" && address.kind !== "indirect-y") return address;
  const offset = address.offset ?? 0;
  const resolved = resolveHome(
    homes,
    address.requestId,
    address.kind === "indirect-y" ? 0 : offset,
  );
  if (typeof resolved === "string") return resolved;
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
 * Locate the first failed check in a fully physical machine program.
 *
 * Structure is checked before processor state, exactly as before: a program whose instructions,
 * transfer targets or block exits are malformed is refused without consulting the flag proof,
 * whose answer on such a program would not be meaningful anyway.
 *
 * @param program Program whose storage and layout-owned operands are resolved.
 * @returns The first failing check with its source construct, or null when the program is valid.
 * @example findMachineProgramDefect(boundProgram)?.reason
 */
export function findMachineProgramDefect(program: MachineProgram): MachineProgramDefect | null {
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
  for (const fn of functions) {
    for (const block of fn.blocks) {
      for (const instruction of block.instructions) {
        const checked = validateMachineInstruction(instruction, NMOS_6510, allFlags);
        if (checked.kind !== "complete") {
          return machineProgramDefect({
            stage: "machine storage binding",
            reason: `the selected '${instruction.opcode}' ${INSTRUCTION_DEFECTS[checked.reason]}`,
            functionId: fn.id,
            label: block.label,
            block,
            instruction,
          });
        }
        if (
          (instruction.opcode === "jsr" || instruction.opcode === "jmp") &&
          instruction.operand?.kind === "label" &&
          !labels.has(instruction.operand.label)
        ) {
          return machineProgramDefect({
            stage: "machine storage binding",
            reason: `the selected '${instruction.opcode}' transfers to generated code the program does not contain`,
            functionId: fn.id,
            label: block.label,
            block,
            instruction,
          });
        }
      }
      if (!validTerminator(block.terminator)) {
        return machineProgramDefect({
          stage: "machine storage binding",
          reason: "the generated exit of a code block is not a legal transfer",
          functionId: fn.id,
          label: block.label,
          block,
        });
      }
    }
  }
  return findMachineFlagsDefect(program);
}

/**
 * Validate every instruction and control transfer in a fully physical machine program.
 * @param program Program whose storage and layout-owned operands are resolved.
 * @returns Whether every opcode, operand, state fact, cost and control target is valid.
 * @example validateMachineProgram(boundProgram)
 */
export function validateMachineProgram(program: MachineProgram): boolean {
  return findMachineProgramDefect(program) === null;
}

/** Bind one instruction without creating any storage request. */
function bindInstruction(
  instruction: MachineInstruction,
  homes: ReadonlyMap<string, StorageHome>,
): MachineInstruction | StorageBindingFault {
  const bound = bindOperand(instruction.operand, homes);
  if (typeof bound === "string") return bound;
  const memory: MachineMemoryEffect[] = [];
  for (const effect of instruction.memory) {
    const address = bindAddress(effect.address, homes);
    if (typeof address === "string") return address;
    memory.push(Object.freeze({ ...effect, address }));
  }

  let mode = instruction.mode;
  if (instruction.operand?.kind === "storage") {
    mode =
      instruction.mode === "indirect" ||
      instruction.mode === "absolute-y" ||
      instruction.mode === "absolute-x"
        ? instruction.mode
        : bound.mode!;
    if (
      mode === "indirect" &&
      bound.operand?.kind === "absolute" &&
      (bound.operand.value & 0xff) === 0xff
    ) {
      return "indirect-page";
    }
  } else if (instruction.operand?.kind === "indirect-y") mode = "indirect-indexed-y";
  const cost =
    mode === instruction.mode ? instruction.cost : machineCost(NMOS_6510, instruction.opcode, mode);
  return Object.freeze({
    ...instruction,
    mode,
    operand: bound.operand,
    memory: Object.freeze(memory),
    cost,
  });
}

/**
 * The instruction a body could not bind, with the block it sits in.
 *
 * A body that fails to bind is refused whichever instruction caused it, so what the refusal needs
 * is the first one that could not be bound rather than the fact that one exists. Reporting the
 * body alone would leave an author with a function name and no line inside it.
 */
interface UnboundSite {
  /** Which check refused the instruction. */
  readonly fault: StorageBindingFault;
  /** Label of the block holding it, which is bug-report evidence rather than a message. */
  readonly label: string;
  /** The instruction itself, carrying the opcode and the source that selected it. */
  readonly instruction: MachineInstruction;
}

/** Distinguish a bound body from the site that refused to bind, without inspecting a body. */
function isUnboundSite(result: MachineFunction | UnboundSite): result is UnboundSite {
  return "fault" in result;
}

/** The same distinction from the other side, so a checked list narrows to bound bodies. */
function isBoundBody(result: MachineFunction | UnboundSite): result is MachineFunction {
  return !isUnboundSite(result);
}

/** Bind every instruction in one machine function, or report the first that refuses. */
function bindFunction(
  fn: MachineFunction,
  homes: ReadonlyMap<string, StorageHome>,
): MachineFunction | UnboundSite {
  const blocks: MachineBlock[] = [];
  for (const block of fn.blocks) {
    const instructions: MachineInstruction[] = [];
    for (const instruction of block.instructions) {
      const bound = bindInstruction(instruction, homes);
      if (typeof bound === "string")
        return Object.freeze({ fault: bound, label: block.label, instruction });
      instructions.push(bound);
    }
    blocks.push(Object.freeze({ ...block, instructions: Object.freeze(instructions) }));
  }
  return Object.freeze({ ...fn, blocks: Object.freeze(blocks) });
}

/**
 * Describe a binding refusal in terms of the instruction whose storage could not be bound.
 *
 * Every demand the program declared has a home by the time this can fail, so the refusal names
 * the check that actually gave up — an operand naming memory that was never allocated, a byte
 * the allocated storage does not contain, or a pointer placed where this processor wraps an
 * indirect read back to the start of the same page. The instruction carries the source that
 * selected it, which is the one thing here an author recognizes.
 *
 * @param owner Body the failing instruction belongs to, named as the source spells it.
 * @param site The first instruction that refused to bind, and which check refused it.
 * @returns Located evidence for the service that formats the refusal.
 * @example unboundInstructionDefect(program.startup, site).reason
 */
function unboundInstructionDefect(owner: MachineFunction, site: UnboundSite): MachineProgramDefect {
  return machineProgramDefect({
    stage: "machine storage binding",
    reason: STORAGE_BINDING_FAULTS[site.fault],
    functionId: owner.id,
    label: site.label,
    instruction: { opcode: site.instruction.opcode, source: site.instruction.source },
  });
}

/** Pair the first body that could not bind with the body it belongs to. */
function firstUnboundBody(
  bodies: readonly MachineFunction[],
  results: readonly (MachineFunction | UnboundSite)[],
): { readonly owner: MachineFunction; readonly site: UnboundSite } | null {
  for (const [index, result] of results.entries()) {
    if (isUnboundSite(result)) return Object.freeze({ owner: bodies[index]!, site: result });
  }
  return null;
}

/** Preserve every source association when an existing physical comparison proves code equal. */
function mergeObserverBlock(
  left: MachineBlock,
  right: MachineBlock,
  leftOwner: MachineFunction,
  rightOwner: MachineFunction,
): MachineBlock {
  const bodies: MachineBodyOrigin[] = [];
  const seen = new Set<string>();
  for (const [block, owner] of [
    [left, leftOwner],
    [right, rightOwner],
  ] as const) {
    const origins =
      block.observerBodies ??
      owner.observerBodies ??
      (owner.sourceFunction !== undefined && owner.executionContext !== undefined
        ? [{ sourceFunction: owner.sourceFunction, executionContext: owner.executionContext }]
        : []);
    for (const origin of origins) {
      const key = JSON.stringify(origin);
      if (!seen.has(key)) {
        seen.add(key);
        bodies.push(Object.freeze({ ...origin }));
      }
    }
  }
  let changed = bodies.length > 0;
  const instructions = left.instructions.map((instruction, index) => {
    const extra = right.instructions[index]?.observerOrigins;
    if (extra === undefined) return instruction;
    const origins = [...new Set([...(instruction.observerOrigins ?? []), ...extra])];
    changed = true;
    return Object.freeze({ ...instruction, observerOrigins: Object.freeze(origins) });
  });
  return changed
    ? Object.freeze({
        ...left,
        instructions: Object.freeze(instructions),
        ...(bodies.length === 0 ? {} : { observerBodies: Object.freeze(bodies) }),
      })
    : left;
}

/** Keep whole-body origins as well as per-instruction origins when equivalent root variants share. */
function mergeObserverFunction(left: MachineFunction, right: MachineFunction): MachineFunction {
  const blocks = left.blocks.map((block, index) =>
    mergeObserverBlock(block, right.blocks[index]!, left, right),
  );
  const bodies = blocks[0]?.observerBodies;
  return blocks.every((block, index) => block === left.blocks[index])
    ? left
    : Object.freeze({
        ...left,
        blocks: Object.freeze(blocks),
        ...(bodies === undefined ? {} : { observerBodies: bodies }),
      });
}

/**
 * Point a block's exit at the shared copy of a helper it used to reach directly.
 *
 * A call in tail position reaches its helper by a jump, or by falling into it
 * when the helper was placed next. A shared helper lives in another body, so a
 * fall-through becomes a jump to it; the helper's own return still goes to the
 * original caller's caller, exactly as before.
 */
function redirectedHelperExit(
  terminator: MachineTerminator,
  redirects: ReadonlyMap<string, string>,
): MachineTerminator {
  if (terminator.kind !== "jump" && terminator.kind !== "fallthrough") return terminator;
  const shared = redirects.get(terminator.target);
  if (shared === undefined) return terminator;
  return Object.freeze({
    kind: "jump" as const,
    opcode: "jmp" as const,
    target: shared,
    cost: machineCost(NMOS_6510, "jmp", "absolute"),
    tailTransfer: true as const,
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
  const allBlocks = new Map(
    functions.flatMap((fn) => fn.blocks.map((block) => [block.label, { block, fn }] as const)),
  );
  const mergedBlocks = new Map<string, MachineBlock>();
  for (const fn of functions) {
    const byLabel = new Map(fn.blocks.map((block) => [block.label, block] as const));
    for (const entry of fn.blocks) {
      if (!entry.label.endsWith(".multiply.1")) continue;
      const body = suffixes.map((suffix) => byLabel.get(`${entry.label}${suffix}`));
      if (body.some((block) => block === undefined)) continue;
      // Source spans and private labels differ, but physical operands and costs must agree.
      const fingerprint = JSON.stringify(body, (key, value: unknown) => {
        if (key === "source" || key === "observerOrigins" || key === "observerBodies")
          return undefined;
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
        for (const [index, suffix] of suffixes.entries()) {
          const original = allBlocks.get(`${shared}${suffix}`)!;
          mergedBlocks.set(
            original.block.label,
            mergeObserverBlock(
              mergedBlocks.get(original.block.label) ?? original.block,
              body[index]!,
              original.fn,
              fn,
            ),
          );
        }
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
            .map((block) => mergedBlocks.get(block.label) ?? block)
            .map((block) =>
              Object.freeze({
                ...block,
                terminator: redirectedHelperExit(block.terminator, redirects),
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

/** Redirect calls and structured branches after two physically identical variants share a body. */
function redirectBoundLabels(
  fn: MachineFunction,
  redirects: ReadonlyMap<string, string>,
): MachineFunction {
  const target = (label: string): string => redirects.get(label) ?? label;
  return Object.freeze({
    ...fn,
    blocks: Object.freeze(
      fn.blocks.map((block) => {
        const terminal = block.terminator;
        const rewritten =
          terminal.kind === "jump" || terminal.kind === "fallthrough"
            ? Object.freeze({ ...terminal, target: target(terminal.target) })
            : terminal.kind === "branch"
              ? Object.freeze({
                  ...terminal,
                  target: target(terminal.target),
                  fallthrough: target(terminal.fallthrough),
                })
              : terminal.kind === "long-branch"
                ? Object.freeze({
                    ...terminal,
                    fallthrough: target(terminal.fallthrough),
                    jump: Object.freeze({ ...terminal.jump, target: target(terminal.jump.target) }),
                  })
                : terminal;
        return Object.freeze({
          ...block,
          instructions: Object.freeze(
            block.instructions.map((instruction) => {
              const operand = instruction.operand;
              return operand?.kind === "label" && redirects.has(operand.label)
                ? Object.freeze({
                    ...instruction,
                    operand: Object.freeze({ ...operand, label: target(operand.label) }),
                  })
                : instruction;
            }),
          ),
          terminator: rewritten,
        });
      }),
    ),
  });
}

/** Share only root-specialized bodies with identical final instructions and addresses. */
function shareBoundRootBodies(
  functions: readonly MachineFunction[],
  startup: MachineFunction,
): { readonly functions: readonly MachineFunction[]; readonly startup: MachineFunction } {
  let current = functions;
  let currentStartup = startup;
  // A callee merge can make its callers identical on the next pass. Each pass
  // removes at least one body, so this reaches a fixed point without a cap.
  while (true) {
    const canonical = new Map<string, MachineFunction>();
    const removed = new Set<string>();
    const redirects = new Map<string, string>();
    const merged = new Map<string, MachineFunction>();
    for (const fn of current) {
      const match = /^(.*)\.irq\.root[0-9a-f]+\.depth\d+$/u.exec(fn.id);
      if (match === null || fn.origin !== undefined || fn.placement !== undefined) continue;
      const local = new Map(fn.blocks.map((block, index) => [block.label, `@${index}`] as const));
      const fingerprint = JSON.stringify(
        [fn.sourceName ?? null, fn.blocks],
        (key, value: unknown) =>
          key === "observerOrigins" || key === "observerBodies"
            ? undefined
            : typeof value === "string" &&
                (key === "label" || key === "target" || key === "fallthrough")
              ? (local.get(value) ?? value)
              : value,
      );
      const identity = JSON.stringify([match[1], fingerprint]);
      const previous = canonical.get(identity);
      if (previous === undefined) {
        canonical.set(identity, fn);
        continue;
      }
      removed.add(fn.id);
      const combined = mergeObserverFunction(previous, fn);
      canonical.set(identity, combined);
      merged.set(previous.id, combined);
      redirects.set(fn.id, previous.id);
      fn.blocks.forEach((block, index) => {
        redirects.set(block.label, previous.blocks[index]!.label);
      });
    }
    if (removed.size === 0) return Object.freeze({ functions: current, startup: currentStartup });
    current = Object.freeze(
      current
        .filter((fn) => !removed.has(fn.id))
        .map((fn) => redirectBoundLabels(merged.get(fn.id) ?? fn, redirects)),
    );
    currentStartup = redirectBoundLabels(currentStartup, redirects);
  }
}

/**
 * Describe a binding refusal in terms of the storage demand it failed on.
 *
 * These checks fail before any instruction is implicated — the value asked for a home and the
 * certificate does not supply a usable one — so there is no failing instruction to point at. The
 * request itself knows which source asked for the storage and why, and that is what an author can
 * act on: without it the refusal names a stage and nothing else, which on a target with no
 * debugger leaves nothing to report or work around.
 *
 * The owning function is matched through its source identity rather than its link name, because a
 * body may be specialized or shared under a generated name that means nothing to whoever wrote it.
 * An unmatched owner degrades to the established unknown site rather than guessing.
 *
 * @param program Program being bound, holding the storage requests and their owners.
 * @param requestId Identity of the demand the failed check named.
 * @param reason Failed check, phrased to read after the request it names.
 * @returns Located evidence, or undefined when the program holds no such request.
 * @example storageRequestDefect(program, missing.id, "no storage home was selected for")
 */
function storageRequestDefect(
  program: MachineProgram,
  requestId: string,
  reason: (described: string) => string,
): MachineProgramDefect | undefined {
  // A demand that was certified and one the certificate never reached are both the program's
  // own requirements, so both sets are searched rather than only the one a given check consults.
  const request =
    program.requiredStorage.find(({ id }) => id === requestId) ??
    program.certifiedStorage?.find(({ id }) => id === requestId);
  if (request === undefined) return undefined;
  const owner = program.functions.find(
    (fn) =>
      fn.sourceFunction !== undefined &&
      bindingIdentityKey(fn.sourceFunction) === bindingIdentityKey(request.owner),
  );
  return machineProgramDefect({
    stage: "machine storage binding",
    // The demand's own stable wording is quoted rather than folded into the sentence, so a
    // reason phrased as a clause cannot break the grammar of the message that carries it.
    reason: reason(`'${request.reason}'`),
    functionId: owner?.id ?? UNKNOWN_MACHINE_SITE,
    label: UNKNOWN_MACHINE_SITE,
    source: request.source,
  });
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
    // An empty identity means the certificate disagrees with the program as a whole rather than
    // on one demand, so there is no single request to name and the refusal stays unlocated.
    const requestId = invalidHome.length === 0 ? null : invalidHome;
    const defect =
      requestId === null
        ? undefined
        : storageRequestDefect(
            program,
            requestId,
            (described) => `the storage home selected for ${described} does not satisfy it`,
          );
    return Object.freeze({
      kind: "error",
      reason: "invalid-storage",
      requestId,
      ...(defect === undefined ? {} : { defect }),
    });
  }
  const homes = new Map(certificate.homes.map((home) => [home.requestId, home] as const));
  const missing = program.requiredStorage.find(({ id }) => !homes.has(id));
  if (missing !== undefined) {
    const defect = storageRequestDefect(
      program,
      missing.id,
      (described) => `no storage home was selected for ${described}`,
    );
    return Object.freeze({
      kind: "error",
      reason: "missing-storage",
      requestId: missing.id,
      ...(defect === undefined ? {} : { defect }),
    });
  }
  const bodies = program.functions.map((fn) => bindFunction(fn, homes));
  const startup = bindFunction(program.startup, homes);
  // No demand is implicated here — every one the program declared already has a home — so the
  // refusal carries the instruction instead, which is the only construct this failure has.
  const unbound = firstUnboundBody(program.functions, bodies);
  if (unbound !== null) {
    return Object.freeze({
      kind: "error",
      reason: "invalid-storage",
      requestId: null,
      defect: unboundInstructionDefect(unbound.owner, unbound.site),
    });
  }
  if (isUnboundSite(startup)) {
    return Object.freeze({
      kind: "error",
      reason: "invalid-storage",
      requestId: null,
      defect: unboundInstructionDefect(program.startup, startup),
    });
  }
  const shared = shareBoundRootBodies(
    shareBoundByteMultiplyHelpers(bodies.filter(isBoundBody)),
    startup,
  );
  const boundProgram = Object.freeze({
    ...program,
    functions: shared.functions,
    startup: shared.startup,
  });
  // Carry the failed check outward: this refusal is a compiler limitation, and without the
  // construct that provoked it the author is left with nothing to report or work around.
  const defect = findMachineProgramDefect(boundProgram);
  if (defect !== null) {
    return Object.freeze({ kind: "error", reason: "invalid-storage", requestId: null, defect });
  }
  return Object.freeze({
    kind: "complete",
    program: boundProgram,
  });
}
