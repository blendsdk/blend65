import { createHash } from "node:crypto";

import type {
  ExecutionCaseV1,
  ExecutionInitialStateFixtureV1,
  ExecutionObservationRequestV1,
  ExecutionOperationResultV1,
  ScalarType,
} from "@blend65/readiness";
import {
  getExecutionCaseProjectionV1,
  parseExecutionInitialStateFixtureV1,
  projectC64InitialStateV1,
} from "@blend65/readiness/execution-runtime";
import type { ReductionExecutionPayloadV1 } from "@blend65/readiness/failure-reduction-internals";

/** Canonical source validation proof produced before a compiler is invoked. */
export interface ExecutionValidatedSourceV1 {
  /** Closed validation proof revision. */
  readonly revision: "execution-validated-source-v1";
  /** Digest of the exact canonical envelope source bytes. */
  readonly sourceDigest: string;
}

/** Passive memory readback captured before the generated entry executes. */
export interface ExecutionFixtureReadbackV1 {
  /** Closed readback record revision. */
  readonly revision: "execution-fixture-readback-v1";
  /** Complete projected cells in canonical fixture order. */
  readonly cells: readonly {
    /** Hardware address read by the adapter. */
    readonly address: number;
    /** Hardware-visible projected value. */
    readonly projectedValue: number;
  }[];
  /** Completion byte read before the entry call. */
  readonly completionValueBeforeEntry: number;
}

const TEXT_ENCODER = new TextEncoder();

function failure<T>(path: string, message: string): ExecutionOperationResultV1<T> {
  const issues = [
    Object.freeze({ code: "invalid-evidence-input" as const, path, message }),
  ] as const;
  return Object.freeze({ ok: false, issues: Object.freeze(issues) });
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function renderLiteral(value: number | boolean): string {
  return typeof value === "boolean" ? String(value) : String(value);
}

function scalarDeclarations(byteLength: 1 | 2, returnType: ScalarType): readonly string[] {
  if (returnType === "boolean") {
    return Object.freeze(["let __execution_result_low: boolean = false;"]);
  }
  return Object.freeze([
    "let __execution_result_low: byte = 0;",
    ...(byteLength === 2 ? ["let __execution_result_high: byte = 0;"] : []),
  ]);
}

function scalarStores(
  observation: ExecutionObservationRequestV1,
  returnType: ScalarType,
): readonly string[] {
  if (observation.kind !== "scalar-bytes") return Object.freeze([]);
  if (observation.byteLength === 1) {
    return Object.freeze([
      returnType === "byte" || returnType === "boolean"
        ? "  __execution_result_low = __execution_actual;"
        : "  __execution_result_low = <byte>(__execution_actual);",
    ]);
  }
  return Object.freeze([
    "  __execution_result_low = lo(<word>(__execution_actual));",
    "  __execution_result_high = hi(<word>(__execution_actual));",
  ]);
}

function readEntryReturnType(source: string, entryFunction: string): ScalarType | undefined {
  const match = new RegExp(
    `function ${entryFunction}\\([^)]*\\): (boolean|byte|sbyte|word|sword) \\{`,
    "u",
  ).exec(source);
  const value = match?.[1];
  return value === "boolean" ||
    value === "byte" ||
    value === "sbyte" ||
    value === "word" ||
    value === "sword"
    ? value
    : undefined;
}

function insertEnvelopeDeclarations(
  source: string,
  declarations: readonly string[],
): string | undefined {
  const firstNewline = source.indexOf("\n");
  if (firstNewline < 0 || !source.startsWith("module ")) return undefined;
  return `${source.slice(0, firstNewline + 1)}${declarations.join("\n")}\n${source.slice(firstNewline + 1)}`;
}

function renderEnvelopeSource(
  originalSource: string,
  entryFunction: string,
  argumentsValue: readonly { readonly value: number | boolean }[],
  observation: ExecutionObservationRequestV1,
  sourcePath: string,
): ExecutionOperationResultV1<string> {
  const returnType =
    observation.kind === "scalar-bytes"
      ? readEntryReturnType(originalSource, entryFunction)
      : undefined;
  if (observation.kind === "scalar-bytes" && returnType === undefined) {
    return failure(sourcePath, "Generated scalar entry return type is invalid.");
  }
  const declarations = Object.freeze([
    ...(observation.kind === "scalar-bytes" && returnType !== undefined
      ? scalarDeclarations(observation.byteLength, returnType)
      : []),
    "let __execution_completion: byte = 0;",
  ]);
  const sourceWithDeclarations = insertEnvelopeDeclarations(originalSource, declarations);
  if (sourceWithDeclarations === undefined) {
    return failure(sourcePath, "Generated source has no canonical module header.");
  }
  const argumentsText = argumentsValue.map((argument) => renderLiteral(argument.value)).join(", ");
  const call = `${entryFunction}(${argumentsText})`;
  const body =
    observation.kind === "scalar-bytes" && returnType !== undefined
      ? [
          `  let __execution_actual: ${returnType} = ${call};`,
          ...scalarStores(observation, returnType),
        ]
      : [`  ${call};`];
  return success(
    `${sourceWithDeclarations}function main(): void {\n${[
      ...body,
      "  __execution_completion = 165;",
    ].join("\n")}\n}\n`,
  );
}

/** Renders a deterministic valid-only Blend65 program around a genuine execution case. */
export function renderExecutionEnvelopeV1(
  executionCase: ExecutionCaseV1,
): ExecutionOperationResultV1<string> {
  const projected = getExecutionCaseProjectionV1(executionCase);
  if (!projected.ok) return projected;
  let originalSource: string;
  try {
    originalSource = new TextDecoder("utf-8", { fatal: true }).decode(projected.value.sourceBytes);
  } catch {
    return failure("/executionCase/sourceBytes", "Generated source is not canonical UTF-8.");
  }
  return renderEnvelopeSource(
    originalSource,
    projected.value.envelope.entryFunction,
    projected.value.envelope.arguments,
    projected.value.observation,
    "/executionCase/sourceBytes",
  );
}

/** Renders the original runtime envelope around one authenticated typed-valid candidate source. */
export function renderCandidateExecutionEnvelopeV1(
  executionCase: ExecutionCaseV1,
  payload: ReductionExecutionPayloadV1,
): ExecutionOperationResultV1<string> {
  const projected = getExecutionCaseProjectionV1(executionCase);
  if (!projected.ok || payload.kind !== "typed-valid") {
    return failure("/candidate", "Candidate runtime envelope requires valid source authority.");
  }
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(payload.sourceBytes);
  } catch {
    return failure("/candidate/sourceBytes", "Candidate source is not canonical UTF-8.");
  }
  return renderEnvelopeSource(
    source,
    projected.value.envelope.entryFunction,
    projected.value.envelope.arguments,
    projected.value.observation,
    "/candidate/sourceBytes",
  );
}

/** Requires exact byte equality with source regenerated from genuine execution authority. */
export function validateRenderedExecutionSourceV1(
  executionCase: ExecutionCaseV1,
  sourceBytes: Uint8Array,
): ExecutionOperationResultV1<ExecutionValidatedSourceV1> {
  if (!(sourceBytes instanceof Uint8Array)) {
    return failure("/sourceBytes", "Rendered execution source must be a byte array.");
  }
  const rendered = renderExecutionEnvelopeV1(executionCase);
  if (!rendered.ok) return rendered;
  const expected = TEXT_ENCODER.encode(rendered.value);
  if (
    expected.byteLength !== sourceBytes.byteLength ||
    !expected.every((value, index) => sourceBytes[index] === value)
  ) {
    return failure("/sourceBytes", "Rendered execution source differs from canonical bytes.");
  }
  return success(
    Object.freeze({
      revision: "execution-validated-source-v1" as const,
      sourceDigest: sha256(expected),
    }),
  );
}

/** Derives a canonical content digest for one closed logical initial-state fixture. */
export function deriveExecutionFixtureDigestV1(
  fixture: ExecutionInitialStateFixtureV1,
): ExecutionOperationResultV1<string> {
  const parsed = parseExecutionInitialStateFixtureV1(fixture);
  if (!parsed.ok) return parsed;
  const canonical = {
    revision: parsed.value.revision,
    cells: parsed.value.cells.map((cell) => ({
      address: cell.address,
      logicalValue: cell.logicalValue,
    })),
  };
  return success(sha256(TEXT_ENCODER.encode(JSON.stringify(canonical))));
}

function readRecord(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  try {
    if (Array.isArray(input)) return undefined;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
    ) {
      return undefined;
    }
    const output: Record<string, unknown> = {};
    for (const key of expectedKeys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      output[key] = descriptor.value;
    }
    return output;
  } catch {
    return undefined;
  }
}

function readArray(input: unknown, maximum: number): readonly unknown[] | undefined {
  try {
    if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) return undefined;
    const lengthDescriptor = Reflect.getOwnPropertyDescriptor(input, "length");
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      lengthDescriptor.value > maximum
    ) {
      return undefined;
    }
    const length: number = lengthDescriptor.value;
    if (Reflect.ownKeys(input).length !== length + 1) return undefined;
    const output: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      output.push(descriptor.value);
    }
    return output;
  } catch {
    return undefined;
  }
}

/** Passively validates complete pre-entry hardware readback for a genuine execution case. */
export function validateExecutionFixtureReadbackV1(
  executionCase: ExecutionCaseV1,
  readback: unknown,
): "pass" | "invalid-evidence-input" {
  const projection = getExecutionCaseProjectionV1(executionCase);
  const record = readRecord(readback, ["revision", "cells", "completionValueBeforeEntry"]);
  const cells = readArray(record?.cells, 3);
  if (
    !projection.ok ||
    record?.revision !== "execution-fixture-readback-v1" ||
    record.completionValueBeforeEntry !== 0 ||
    cells === undefined ||
    cells.length !== projection.value.fixture.cells.length
  ) {
    return "invalid-evidence-input";
  }
  for (let index = 0; index < cells.length; index += 1) {
    const actual = readRecord(cells[index], ["address", "projectedValue"]);
    const expected = projection.value.fixture.cells[index];
    if (actual === undefined || expected === undefined || actual.address !== expected.address) {
      return "invalid-evidence-input";
    }
    const projected = projectC64InitialStateV1(expected.address, expected.logicalValue);
    if (!projected.ok || actual.projectedValue !== projected.value) {
      return "invalid-evidence-input";
    }
  }
  return "pass";
}
