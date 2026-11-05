import {
  byteContinuationQuery,
  BYTE_WINDOW_CHANGED,
  deriveBooleanExitFacts,
  machineSuccessors,
} from "../machine/lower-control.js";
import { operandAddress, validRange } from "../machine/nmos6510-access.js";
import { provedProducer } from "../machine/optimization-cleanup.js";
import type {
  ByteWindowAddress,
  MachineBlock,
  MachineFunction,
  MachineInstruction,
} from "../machine/machine-types.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import { failure as observerFailure } from "./size-observer-raw-layout.js";
import type { ResidualFailure as ObserverFailure } from "./size-observer-raw-layout.js";
import type { FinalObserverInput } from "./size-observers.js";
import type { ResidualEffectsResult } from "./size-observer-effects.js";

/** Reject shared or redirected ownership rather than guessing which physical Boolean body ran. */
function ordinaryBody(
  body: MachineFunction | undefined,
  owner: BindingId,
): body is MachineFunction {
  return (
    body !== undefined &&
    body.sourceFunction === owner &&
    body.executionContext?.domain === "main" &&
    body.executionContext.activationRoot === undefined &&
    body.observerBodies === undefined &&
    body.blocks.every((block) => block.observerBodies === undefined)
  );
}

/**
 * Discharge only certified returned Boolean flags with no suffix, or one removed CMP #0.
 * Authentication binds source associations; actual final callees still have to establish
 * canonical A/N/Z. CMP leaves A/X alone and agrees on N/Z for 0/1, but its C=1 can differ.
 * Each successor must overwrite carry before observing it, or terminate under the ordinary
 * return contract. Discharged raw/borrow effects elsewhere do not replace this local proof.
 * Other removed instructions, publications and shared ownership retain the ordinary fallback.
 */
function booleanWindowFailure(input: FinalObserverInput): ObserverFailure | null {
  const final = new Map(input.candidate.shared.layout.program.functions.map((fn) => [fn.id, fn]));
  const exits = new Map<string, boolean>();
  for (const symbolic of input.candidate.lowered.program.functions) {
    const proofs = symbolic.booleanCallProofs ?? [];
    if (proofs.length === 0) continue;
    const caller = final.get(symbolic.id);
    const owner = symbolic.sourceFunction;
    if (owner === undefined || !ordinaryBody(symbolic, owner) || !ordinaryBody(caller, owner))
      return observerFailure("rejected", "Boolean caller has unresolved physical ownership");
    const blocks = new Map(caller.blocks.map((block) => [block.label, block]));
    const continuation = byteContinuationQuery(blocks);
    /** Empty fallthrough labels can share an exact final PC; no jump or alias is inferred. */
    const sameEntry = (left: string, right: string) =>
      blocks.get(left)?.origin !== undefined &&
      blocks.get(left)?.origin === blocks.get(right)?.origin;
    for (const proof of proofs) {
      const removed = proof.removed[0];
      const removedComparison =
        proof.removed.length === 1 &&
        removed?.opcode === "cmp" &&
        removed.mode === "immediate" &&
        removed.operand?.kind === "immediate" &&
        removed.operand.value === 0 &&
        removed.memory.length === 0;
      const added = proof.added[0];
      // A retest re-establishes N/Z from the returned Boolean value. CMP #0 is
      // used only when both continuations prove carry dead; AND #$FF is the
      // carry-preserving fallback and therefore needs no C continuation proof.
      const addedTest =
        added !== undefined &&
        added.mode === "immediate" &&
        added.operand?.kind === "immediate" &&
        added.memory.length === 0 &&
        ((added.opcode === "cmp" && added.operand.value === 0) ||
          (added.opcode === "and" && added.operand.value === 0xff));
      const retest =
        proof.kind === "retest" &&
        proof.removed.length === 0 &&
        proof.added.length === 1 &&
        addedTest;
      const comparison = removedComparison || (retest && added?.opcode === "cmp");
      if (
        proof.function !== owner ||
        !((proof.kind === "certified" && proof.added.length === 0) || retest) ||
        (proof.removed.length !== 0 && !comparison)
      )
        return observerFailure(
          "rejected",
          "Boolean suffix needs a stronger machine-state proof",
          proof.call.span,
        );
      const block = blocks.get(proof.block);
      const original = symbolic.blocks.find((block) => block.label === proof.block)?.terminator;
      const edge = block?.terminator;
      const call = retest ? block?.instructions.at(-2) : block?.instructions.at(-1);
      const callee = final.get(proof.callee);
      if (
        block === undefined ||
        original?.kind !== "branch" ||
        (edge?.kind !== "branch" && edge?.kind !== "long-branch") ||
        !["beq", "bne"].includes(original.opcode) ||
        !["beq", "bne"].includes(edge.opcode) ||
        !edge.uses.flags.includes("z") ||
        call?.opcode !== "jsr" ||
        call.mode !== "absolute" ||
        call.source !== proof.call.span ||
        call.operand?.kind !== "label" ||
        call.operand.label !== proof.callee ||
        (call.operand.offset ?? 0) !== 0 ||
        call.operand.addressByte !== undefined ||
        !ordinaryBody(callee, proof.call.callee)
      )
        return observerFailure(
          "rejected",
          "Boolean call or branch has unresolved final association",
          proof.call.span,
        );
      const target = edge.kind === "branch" ? edge.target : edge.jump.target;
      const forward =
        edge.kind === "branch" ? edge.opcode === original.opcode : edge.opcode !== original.opcode;
      if (
        !sameEntry(target, forward ? original.target : original.fallthrough) ||
        !sameEntry(edge.fallthrough, forward ? original.fallthrough : original.target)
      )
        return observerFailure(
          "rejected",
          "Boolean final branch does not preserve its source successors",
          proof.call.span,
        );
      // A retest explicitly rebuilds N/Z after the call, so it does not depend on
      // the callee's all-exit flag certificate. The final lowering recheck only
      // enforces that certificate for `certified` proofs.
      if (proof.kind === "certified") {
        if (!exits.has(callee.id)) exits.set(callee.id, deriveBooleanExitFacts(callee) !== null);
        if (!exits.get(callee.id))
          return observerFailure(
            "rejected",
            "Actual Boolean callee does not establish every returned flag",
            proof.call.span,
          );
      }
      if (
        comparison &&
        (!continuation(target, 0, BYTE_WINDOW_CHANGED.c) ||
          !continuation(edge.fallthrough, 0, BYTE_WINDOW_CHANGED.c))
      )
        return observerFailure(
          "rejected",
          "Actual Boolean continuation can observe changed carry",
          proof.call.span,
        );
    }
  }
  return null;
}

/** Index actual identities once per layout, keeping reference and candidate storage independent. */
function windowSide(shared: FinalObserverInput["candidate"]["shared"]) {
  const program = shared.layout.program;
  const functions = new Map(program.functions.map((fn) => [fn.id, fn]));
  const labels = new Map(shared.layout.intervals.map(({ id, start }) => [id, start]));
  const entries = new Set<number>();
  for (const fn of [program.startup, ...program.functions]) {
    const start = fn.origin ?? fn.blocks[0]?.origin;
    if (start !== undefined) {
      labels.set(fn.id, start);
      entries.add(start);
    }
    for (const block of fn.blocks)
      if (block.origin !== undefined) labels.set(block.label, block.origin);
  }
  const addressed = new Set<number>();
  for (const fn of [program.startup, ...program.functions])
    for (const block of fn.blocks)
      for (const { operand } of block.instructions)
        if (operand?.kind === "label") {
          const base = labels.get(operand.label);
          if (base !== undefined) addressed.add(base + (operand.offset ?? 0));
        }
  return {
    shared,
    functions,
    labels,
    entries,
    addressed,
    requests: new Map(
      shared.certificate.inventory.requests.map((request) => [request.id, request]),
    ),
    homes: new Map(shared.certificate.certificate.homes.map((home) => [home.requestId, home])),
    data: new Map(program.data.map((object) => [object.id, object])),
    intervals: new Map(shared.layout.intervals.map((interval) => [interval.id, interval])),
  };
}

/** Only actual producer IDs identify bytes; equal numeric addresses cannot manufacture identity. */
function resolvedByte(
  address: ByteWindowAddress,
  side: ReturnType<typeof windowSide>,
  owner: BindingId,
): number | null {
  if (!Number.isSafeInteger(address.offset) || address.offset < 0) return null;
  let start: number, bytes: number;
  if (address.kind === "home") {
    const request = side.requests.get(address.id),
      home = side.homes.get(address.id);
    if (
      request === undefined ||
      request.owner !== owner ||
      home === undefined ||
      home.bytes !== request.bytes ||
      (request.domain !== undefined && request.domain !== "main") ||
      request.activationRoot !== undefined
    )
      return null;
    start = home.address;
    bytes = home.bytes;
  } else {
    const object = side.data.get(address.id),
      interval = side.intervals.get(address.id);
    if (
      object === undefined ||
      interval === undefined ||
      interval.kind !== object.kind ||
      interval.end - interval.start + 1 !== object.bytes.length
    )
      return null;
    start = interval.start;
    bytes = object.bytes.length;
  }
  const value = start + address.offset;
  return address.offset < bytes &&
    validRange({ start: value, end: value }, 0xffff) &&
    ((value >= 2 && value <= 0xff) || (value >= 0x200 && value <= 0xcfff))
    ? value
    : null;
}

/** Effective equality successors, independent of short inversion or inverse-branch-over-JMP repair. */
function zeroSuccessors(block: MachineBlock | undefined): readonly [string, string] | null {
  const edge = block?.terminator;
  if (
    (edge?.kind !== "branch" && edge?.kind !== "long-branch") ||
    !["beq", "bne"].includes(edge.opcode) ||
    !edge.uses.flags.includes("z")
  )
    return null;
  const target = edge.kind === "branch" ? edge.target : edge.jump.target;
  const equal = edge.kind === "branch" ? edge.opcode === "beq" : edge.opcode === "bne";
  return equal ? [target, edge.fallthrough] : [edge.fallthrough, target];
}

/** Prove the actual direct read; annotations do not establish a bus view or replace final footprints. */
function readsByte(
  input: FinalObserverInput,
  side: ReturnType<typeof windowSide>,
  instruction: MachineInstruction | undefined,
  opcode: string,
  address: number,
  pc: number,
): boolean {
  const operand = instruction?.operand;
  return (
    instruction !== undefined &&
    instruction.opcode === opcode &&
    ["absolute", "zero-page"].includes(instruction.mode) &&
    operand !== null &&
    (operand?.kind === "absolute" ||
      (operand?.kind === "label" &&
        operand.addressByte === undefined &&
        operand.transform === undefined)) &&
    !instruction.memory.some((effect) => effect.volatile) &&
    operandAddress({ cpu: input.checked.profile.cpu, instruction, pc, labels: side.labels }) ===
      address
  );
}

/** Validate the exact reference/read-elision pair, leaving all physical footprints to the atomic owner. */
function byteWindowFailure(input: FinalObserverInput): ObserverFailure | null {
  const selected = input.candidate.lowered.program.functions.filter(
    (fn) => (fn.byteAvailabilityProofs?.length ?? 0) > 0,
  );
  if (selected.length === 0) return null;
  const asyncHandlers = new Set(
    [
      ...(input.checked.program.interruptRoutes ?? []).map((route) => route.handler),
      ...input.checked.program.roots.flatMap((root) =>
        root.kind === "interrupt" ? [root.function] : [],
      ),
    ].map(bindingIdentityKey),
  );
  if (
    input.reference.kind !== "feasible" ||
    input.checked.program.roots.some(
      (root) => root.kind === "callable" && !asyncHandlers.has(bindingIdentityKey(root.function)),
    )
  )
    return observerFailure("rejected", "Byte windows need both actual synchronous constructions");
  const sides = [windowSide(input.reference.shared), windowSide(input.candidate.shared)];
  for (const symbolic of selected) {
    const owner = symbolic.sourceFunction;
    if (owner === undefined || !ordinaryBody(symbolic, owner))
      return observerFailure("rejected", "Byte window source has unresolved ownership");
    const referenceSymbolic = input.reference.checked.lowered.program.functions.find(
      (fn) => fn.sourceFunction === owner,
    );
    if (referenceSymbolic === undefined)
      return observerFailure("rejected", "Byte window reference owner is unresolved");
    /** The reference keeps a bounds expansion around a body the selected counter proves in range. */
    const referenceLabel = (label: string) => {
      const expanded = `${label}.bounds.0.0.pass`;
      const direct = referenceSymbolic.blocks.find((block) => block.label === label);
      const pass = referenceSymbolic.blocks.find((block) => block.label === expanded);
      const checked =
        direct !== undefined &&
        direct.terminator.kind === "branch" &&
        [direct.terminator.target, direct.terminator.fallthrough].some((target) =>
          target?.includes(".bounds."),
        );
      return checked && pass !== undefined ? expanded : label;
    };
    for (const [sideIndex, side] of sides.entries()) {
      const sideSymbolic = sideIndex === 0 ? referenceSymbolic : symbolic;
      const originalBlocks = new Map(sideSymbolic.blocks.map((block) => [block.label, block]));
      const body = side.functions.get(symbolic.id);
      if (
        body === undefined ||
        body.sourceFunction !== owner ||
        body.observerBodies !== undefined ||
        body.blocks.some(
          (block) => block.observerBodies !== undefined || block.origin === undefined,
        ) ||
        (sideIndex === 1 && !ordinaryBody(body, owner))
      )
        return observerFailure("rejected", "Byte window has unresolved final ownership");
      const blocks = new Map(body.blocks.map((block) => [block.label, block]));
      const continuation = byteContinuationQuery(blocks);
      const incoming = new Map<number, number>();
      for (const block of body.blocks)
        for (const label of machineSuccessors(block)) {
          const pc = blocks.get(label)?.origin;
          if (pc !== undefined) incoming.set(pc, (incoming.get(pc) ?? 0) + 1);
        }
      for (const proof of symbolic.byteAvailabilityProofs ?? []) {
        /** Every rejection stays attached to the actual replaced comparison operation. */
        const reject = (reason: string) => observerFailure("rejected", reason, proof.producer);
        if (proof.function !== owner || proof.domain !== "main")
          return reject("Byte proof belongs to another source context");
        const fromLabel = sideIndex === 0 ? referenceLabel(proof.from) : proof.from;
        const toLabel = sideIndex === 0 ? referenceLabel(proof.to) : proof.to;
        const from = blocks.get(fromLabel),
          to = blocks.get(toLabel);
        const original = zeroSuccessors(originalBlocks.get(fromLabel)),
          actual = zeroSuccessors(from);
        const consumerPC = to?.origin;
        if (
          from?.origin === undefined ||
          to === undefined ||
          consumerPC === undefined ||
          original === null ||
          actual === null ||
          !original.includes(toLabel) ||
          !actual.every(
            (label, index) =>
              blocks.get(label)?.origin !== undefined &&
              blocks.get(label)?.origin === blocks.get(original[index]!)?.origin,
          )
        )
          return reject("Byte final branch does not preserve its source successors");
        if (
          incoming.get(consumerPC) !== 1 ||
          side.entries.has(consumerPC) ||
          side.addressed.has(consumerPC)
        )
          return reject("Byte consumer has an alternate or addressed entry");
        const left = resolvedByte(proof.left, side, owner),
          right = resolvedByte(proof.right, side, owner);
        if (left === null || right === null)
          return reject("Byte window has no complete actual backing identity");
        const load = from.instructions.at(-2),
          compare = from.instructions.at(-1);
        /** A forwarded local store leaves the compared byte in A for the compare. */
        const forwardedProducer =
          load?.opcode === "sta" &&
          operandAddress({
            cpu: input.checked.profile.cpu,
            instruction: load,
            pc: 0,
            labels: side.labels,
          }) === left &&
          provedProducer(from.instructions.at(-3), "a");
        const loadPC =
          from.origin +
          from.instructions
            .slice(0, -2)
            .reduce((sum, instruction) => sum + instruction.cost.bytes, 0);
        const reference = sideIndex === 0;
        const use = to.instructions[reference ? 1 : 0];
        if (
          (!forwardedProducer && !readsByte(input, side, load, "lda", left, loadPC)) ||
          !readsByte(
            input,
            side,
            compare,
            reference ? "eor" : "cmp",
            right,
            loadPC + (load?.cost.bytes ?? 0),
          ) ||
          compare?.source !== proof.producer ||
          use?.source !== proof.consumer ||
          (reference && !readsByte(input, side, to.instructions[0], "lda", left, consumerPC)) ||
          !readsByte(
            input,
            side,
            use,
            "and",
            right,
            consumerPC + (reference ? (to.instructions[0]?.cost.bytes ?? 0) : 0),
          )
        )
          return reject("Byte final copy-free template or resolved reads disagree");
        if (!reference) {
          const sibling = actual.find((label) => blocks.get(label)?.origin !== consumerPC);
          if (
            sibling === undefined ||
            !continuation(toLabel, 1, BYTE_WINDOW_CHANGED.c) ||
            !continuation(
              sibling,
              0,
              BYTE_WINDOW_CHANGED.a | BYTE_WINDOW_CHANGED.n | BYTE_WINDOW_CHANGED.c,
            )
          )
            return reject("Byte continuation can observe changed accumulator or flags");
        }
      }
    }
  }
  return null;
}

/**
 * Check final register/flag windows after the caller authenticates source, storage and layouts.
 * This focused result grants no physical-footprint exemption or whole-candidate acceptance.
 * The required residual argument preserves the call contract but is not inspected or authenticated
 * here. Callers must discharge it for this same input and still perform the remaining atomic checks.
 * @param input Actual constructions sharing the original checked source.
 * @param _effects Residual source closure for this input, not an authentication receipt.
 * @returns A failed proof, or null when the supported window obligations close.
 * @example const invalid = validateByteWindowObservers(input, effects);
 */
export function validateByteWindowObservers(
  input: FinalObserverInput,
  _effects: Extract<ResidualEffectsResult, { readonly kind: "complete" }>,
): ObserverFailure | null {
  return booleanWindowFailure(input) ?? byteWindowFailure(input);
}
