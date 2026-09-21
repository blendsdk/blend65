import type { C64LayoutInterval, C64LayoutResult } from "../layout/c64-layout.js";
import { validateMachineProgram } from "../machine/bind.js";
import type { MachineOperand } from "../machine/machine-types.js";
import type { StorageClosureCertificate } from "../storage/storage-types.js";
import type { TargetProfile } from "../target/profile.js";

/** Final successful C64 layout accepted by terminal serialization. */
export type CompleteC64Layout = Extract<C64LayoutResult, { readonly kind: "complete" }>;

/** Inputs whose final machine forms and placement must agree before source is emitted. */
export interface AcmeValidationInput {
  /** Conflict-free final C64 layout. */
  readonly layout: CompleteC64Layout;
  /** Closed storage proof used to produce the layout. */
  readonly certificate: StorageClosureCertificate;
  /** Exact selected target facts. */
  readonly profile: TargetProfile;
}

/** Validation success or one terminal serializer failure category. */
export type AcmeValidationResult =
  | { readonly kind: "complete" }
  | {
      readonly kind: "error";
      readonly reason: "invalid-program" | "invalid-layout" | "unsupported-form";
      readonly diagnostic: string;
    };

/** Return an immutable terminal validation error without exposing host state. */
function failure(
  reason: Extract<AcmeValidationResult, { readonly kind: "error" }>["reason"],
  diagnostic: string,
): AcmeValidationResult {
  return Object.freeze({ kind: "error", reason, diagnostic });
}

/** Return whether one inclusive interval contains only valid address facts. */
function validInterval(interval: C64LayoutInterval): boolean {
  return (
    Number.isInteger(interval.start) &&
    Number.isInteger(interval.end) &&
    interval.start >= 0 &&
    interval.end <= 0xffff &&
    interval.start <= interval.end &&
    (interval.bytes === null ||
      (interval.bytes.length === interval.end - interval.start + 1 &&
        interval.bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 0xff)))
  );
}

/** Return whether an operand has been reduced to a terminal ACME form. */
function terminalOperand(operand: MachineOperand | null): boolean {
  if (operand === null) return true;
  if (operand.kind === "storage" || operand.kind === "indirect-y" || operand.kind === "register") {
    return false;
  }
  if (operand.kind === "label" && operand.transform !== undefined) return false;
  return true;
}

/**
 * Validate the closed machine/layout boundary immediately before ACME serialization.
 *
 * This check deliberately repeats the final invariants instead of trusting that an earlier phase
 * ran. Serialization is the last point where a malformed instruction or address can be rejected
 * without creating a tool-owned file.
 *
 * @param input Final layout, storage certificate, and selected target.
 * @returns Completion or a closed failure category with a safe explanation.
 * @example validateAcmeInput({ layout, certificate, profile }).kind === "complete"
 */
export function validateAcmeInput(input: AcmeValidationInput): AcmeValidationResult {
  if (
    input.profile.id !== "c64-pal-prg-kernal-6581" ||
    input.profile.serializer.id !== "acme-0.97" ||
    input.profile.packager.id !== "cbm-prg"
  ) {
    return failure("invalid-layout", "ACME serialization requires the selected C64 PRG profile");
  }
  if (!input.certificate.closed || input.certificate.profileId !== input.profile.id) {
    return failure("invalid-program", "ACME serialization requires the final closed storage proof");
  }
  if (!validateMachineProgram(input.layout.program)) {
    return failure(
      "invalid-program",
      "The final machine program is not legal for documented NMOS forms",
    );
  }
  const intervals = input.layout.intervals;
  if (
    intervals.length === 0 ||
    intervals.some((interval) => !validInterval(interval)) ||
    intervals.some((interval, index) => index > 0 && interval.start <= intervals[index - 1]!.end)
  ) {
    return failure(
      "invalid-layout",
      "The final layout contains an invalid or overlapping interval",
    );
  }
  const loaded = intervals.filter(({ bytes }) => bytes !== null);
  if (
    loaded.length === 0 ||
    input.layout.loadRange.start !== loaded[0]!.start ||
    input.layout.loadRange.end !== loaded.at(-1)!.end ||
    loaded.some(
      ({ start, end }) =>
        start < input.profile.packager.residentStart || end > input.profile.packager.residentEnd,
    )
  ) {
    return failure("invalid-layout", "The declared load range does not match the loaded intervals");
  }

  const functions = [input.layout.program.startup, ...input.layout.program.functions];
  const labels = new Set([
    ...functions.map(({ id }) => id),
    ...functions.flatMap(({ blocks }) => blocks.map(({ label }) => label)),
    ...input.layout.program.data.map(({ id }) => id),
  ]);
  for (const fn of functions) {
    if (!Number.isInteger(fn.origin)) {
      return failure("invalid-layout", "Every serialized function requires a final origin");
    }
    for (const block of fn.blocks) {
      if (!Number.isInteger(block.origin)) {
        return failure("invalid-layout", "Every serialized block requires a final origin");
      }
      for (const instruction of block.instructions) {
        if (!terminalOperand(instruction.operand)) {
          return failure(
            "unsupported-form",
            "A machine operand remained unresolved before serialization",
          );
        }
        if (instruction.operand?.kind === "label" && !labels.has(instruction.operand.label)) {
          return failure("invalid-program", "A machine instruction references an unknown label");
        }
      }
      const terminator = block.terminator;
      const targets =
        terminator.kind === "branch"
          ? [terminator.target, terminator.fallthrough]
          : terminator.kind === "long-branch"
            ? [terminator.fallthrough, terminator.jump.target]
            : terminator.kind === "jump" || terminator.kind === "fallthrough"
              ? [terminator.target]
              : [];
      if (targets.some((target) => !labels.has(target))) {
        return failure("invalid-program", "A machine terminator references an unknown label");
      }
    }
  }
  return Object.freeze({ kind: "complete" });
}
