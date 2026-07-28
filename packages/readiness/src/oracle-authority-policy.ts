import { isDeepStrictEqual } from "node:util";

import {
  oracleMutationDispatchMarker,
  requireOracleMutationDispatchMarker,
  selectedOracleMutationVariant,
} from "./oracle-conformance-v1.js";
import { oracleFailure, type OracleFailure } from "./oracle-input.js";
import type {
  BindingRejectionRecordV1,
  DiagnosticContextV1,
  DiagnosticOracleRecordV1,
} from "./oracle-model.js";

interface DiagnosticAuthorityCandidate {
  readonly ruleId: string;
  readonly neighborId: string;
  readonly diagnosticContext?: string;
  readonly diagnosticCode: string;
  readonly phase: string;
  readonly severity: string;
  readonly observableFields: readonly string[];
}

interface BindingAuthorityCandidate {
  readonly ruleId: string;
  readonly neighborId: string;
  readonly spelling: string;
  readonly rejectionCode: string;
}

function diagnosticRow(
  ruleId: string,
  neighborId: string,
  diagnosticCode: string,
  diagnosticContext?: DiagnosticContextV1,
): DiagnosticOracleRecordV1 {
  return Object.freeze({
    ruleId,
    neighborId,
    ...(diagnosticContext === undefined ? {} : { diagnosticContext }),
    diagnosticCode,
    phase: "semantic",
    severity: "error",
    observableFields: Object.freeze(["code", "phase", "severity"] as const),
  });
}

/**
 * Exact independently authored diagnostic population for the initial modeled rules.
 *
 * This package-private value is not derived from compiler output and is not re-exported by the
 * package entry point.
 */
export const EXPECTED_DIAGNOSTIC_AUTHORITY: readonly DiagnosticOracleRecordV1[] = Object.freeze([
  diagnosticRow(
    "rule.ch02.2-primitive-types.boolean.range.true",
    "neighbor.scalar.boolean.wrong-type",
    "E10152",
    "initializer",
  ),
  diagnosticRow(
    "rule.ch02.2-primitive-types.boolean.range.true",
    "neighbor.scalar.boolean.wrong-type",
    "E10172",
    "return-expression",
  ),
  diagnosticRow(
    "rule.ch02.2-primitive-types.byte.range.0-255",
    "neighbor.scalar.byte.above-max",
    "E10084",
  ),
  diagnosticRow(
    "rule.ch02.2-primitive-types.byte.range.0-255",
    "neighbor.scalar.byte.below-min",
    "E10084",
  ),
  diagnosticRow(
    "rule.ch02.2-primitive-types.sbyte.range.128-127",
    "neighbor.scalar.sbyte.above-max",
    "E10084",
  ),
  diagnosticRow(
    "rule.ch02.2-primitive-types.sbyte.range.128-127",
    "neighbor.scalar.sbyte.below-min",
    "E10084",
  ),
  diagnosticRow(
    "rule.ch02.2-primitive-types.sword.range.32768-32767",
    "neighbor.scalar.sword.above-max",
    "E10084",
  ),
  diagnosticRow(
    "rule.ch02.2-primitive-types.sword.range.32768-32767",
    "neighbor.scalar.sword.below-min",
    "E10084",
  ),
  diagnosticRow(
    "rule.ch02.2-primitive-types.word.range.0-65535",
    "neighbor.scalar.word.above-max",
    "E10084",
  ),
  diagnosticRow(
    "rule.ch02.2-primitive-types.word.range.0-65535",
    "neighbor.scalar.word.below-min",
    "E10084",
  ),
  diagnosticRow(
    "rule.ch12.3-1-memory-access.peek-addr.signature.word",
    "neighbor.memory.peek.wrong-address-type",
    "E10172",
  ),
  diagnosticRow(
    "rule.ch12.3-1-memory-access.peek-addr.signature.word",
    "neighbor.memory.peek.wrong-arity",
    "E10041",
  ),
  diagnosticRow(
    "rule.ch12.3-1-memory-access.peekw-addr.signature.word",
    "neighbor.memory.peekw.wrong-address-type",
    "E10172",
  ),
  diagnosticRow(
    "rule.ch12.3-1-memory-access.peekw-addr.signature.word",
    "neighbor.memory.peekw.wrong-arity",
    "E10041",
  ),
  diagnosticRow(
    "rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte",
    "neighbor.memory.poke.wrong-address-type",
    "E10172",
  ),
  diagnosticRow(
    "rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte",
    "neighbor.memory.poke.wrong-arity",
    "E10041",
  ),
  diagnosticRow(
    "rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte",
    "neighbor.memory.poke.wrong-value-type",
    "E10172",
  ),
  diagnosticRow(
    "rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word",
    "neighbor.memory.pokew.wrong-address-type",
    "E10172",
  ),
  diagnosticRow(
    "rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word",
    "neighbor.memory.pokew.wrong-arity",
    "E10041",
  ),
  diagnosticRow(
    "rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word",
    "neighbor.memory.pokew.wrong-value-type",
    "E10172",
  ),
]);

/** Exact independently authored external binding-rejection population. */
export const EXPECTED_BINDING_AUTHORITY: readonly BindingRejectionRecordV1[] = Object.freeze([
  Object.freeze({
    ruleId: "rule.ch02.2-primitive-types.boolean.range.true",
    neighborId: "neighbor.scalar.boolean.wrong-type",
    spelling: "parameter" as const,
    rejectionCode: "binding.value.type-invalid" as const,
  }),
  ...[
    ["rule.ch02.2-primitive-types.byte.range.0-255", "neighbor.scalar.byte.above-max"],
    ["rule.ch02.2-primitive-types.byte.range.0-255", "neighbor.scalar.byte.below-min"],
    ["rule.ch02.2-primitive-types.sbyte.range.128-127", "neighbor.scalar.sbyte.above-max"],
    ["rule.ch02.2-primitive-types.sbyte.range.128-127", "neighbor.scalar.sbyte.below-min"],
    ["rule.ch02.2-primitive-types.sword.range.32768-32767", "neighbor.scalar.sword.above-max"],
    ["rule.ch02.2-primitive-types.sword.range.32768-32767", "neighbor.scalar.sword.below-min"],
    ["rule.ch02.2-primitive-types.word.range.0-65535", "neighbor.scalar.word.above-max"],
    ["rule.ch02.2-primitive-types.word.range.0-65535", "neighbor.scalar.word.below-min"],
  ].map(([ruleId, neighborId]) =>
    Object.freeze({
      ruleId,
      neighborId,
      spelling: "parameter" as const,
      rejectionCode: "binding.value.range-invalid" as const,
    }),
  ),
]);

function diagnosticMutationPath(record: DiagnosticOracleRecordV1): string {
  return `diagnostic.mapping.${record.neighborId}${
    record.diagnosticContext === undefined ? "" : `.${record.diagnosticContext}`
  }`;
}

function bindingMutationPath(record: BindingRejectionRecordV1): string {
  return `binding-rejection.mapping.${record.neighborId}.${record.spelling}`;
}

/** Closed authority-mapping branches required by mutation conformance. */
export const ORACLE_AUTHORITY_MUTATION_PATHS = Object.freeze([
  oracleMutationDispatchMarker(
    "binding-rejection.mapping",
    "binding-rejection.mapping.neighbor.scalar.boolean.wrong-type.parameter",
    "wrong-exact-rejection-v1",
  ),
  oracleMutationDispatchMarker(
    "binding-rejection.mapping",
    "binding-rejection.mapping.neighbor.scalar.byte.above-max.parameter",
    "wrong-exact-rejection-v1",
  ),
  oracleMutationDispatchMarker(
    "binding-rejection.mapping",
    "binding-rejection.mapping.neighbor.scalar.byte.below-min.parameter",
    "wrong-exact-rejection-v1",
  ),
  oracleMutationDispatchMarker(
    "binding-rejection.mapping",
    "binding-rejection.mapping.neighbor.scalar.sbyte.above-max.parameter",
    "wrong-exact-rejection-v1",
  ),
  oracleMutationDispatchMarker(
    "binding-rejection.mapping",
    "binding-rejection.mapping.neighbor.scalar.sbyte.below-min.parameter",
    "wrong-exact-rejection-v1",
  ),
  oracleMutationDispatchMarker(
    "binding-rejection.mapping",
    "binding-rejection.mapping.neighbor.scalar.sword.above-max.parameter",
    "wrong-exact-rejection-v1",
  ),
  oracleMutationDispatchMarker(
    "binding-rejection.mapping",
    "binding-rejection.mapping.neighbor.scalar.sword.below-min.parameter",
    "wrong-exact-rejection-v1",
  ),
  oracleMutationDispatchMarker(
    "binding-rejection.mapping",
    "binding-rejection.mapping.neighbor.scalar.word.above-max.parameter",
    "wrong-exact-rejection-v1",
  ),
  oracleMutationDispatchMarker(
    "binding-rejection.mapping",
    "binding-rejection.mapping.neighbor.scalar.word.below-min.parameter",
    "wrong-exact-rejection-v1",
  ),
  oracleMutationDispatchMarker(
    "diagnostic.mapping",
    "diagnostic.mapping.neighbor.memory.peek.wrong-address-type",
    "wrong-exact-mapping-v1",
  ),
  oracleMutationDispatchMarker(
    "diagnostic.mapping",
    "diagnostic.mapping.neighbor.memory.peek.wrong-arity",
    "wrong-exact-mapping-v1",
  ),
  oracleMutationDispatchMarker(
    "diagnostic.mapping",
    "diagnostic.mapping.neighbor.memory.peekw.wrong-address-type",
    "wrong-exact-mapping-v1",
  ),
  oracleMutationDispatchMarker(
    "diagnostic.mapping",
    "diagnostic.mapping.neighbor.memory.peekw.wrong-arity",
    "wrong-exact-mapping-v1",
  ),
  oracleMutationDispatchMarker(
    "diagnostic.mapping",
    "diagnostic.mapping.neighbor.memory.poke.wrong-address-type",
    "wrong-exact-mapping-v1",
  ),
  oracleMutationDispatchMarker(
    "diagnostic.mapping",
    "diagnostic.mapping.neighbor.memory.poke.wrong-arity",
    "wrong-exact-mapping-v1",
  ),
  oracleMutationDispatchMarker(
    "diagnostic.mapping",
    "diagnostic.mapping.neighbor.memory.poke.wrong-value-type",
    "wrong-exact-mapping-v1",
  ),
  oracleMutationDispatchMarker(
    "diagnostic.mapping",
    "diagnostic.mapping.neighbor.memory.pokew.wrong-address-type",
    "wrong-exact-mapping-v1",
  ),
  oracleMutationDispatchMarker(
    "diagnostic.mapping",
    "diagnostic.mapping.neighbor.memory.pokew.wrong-arity",
    "wrong-exact-mapping-v1",
  ),
  oracleMutationDispatchMarker(
    "diagnostic.mapping",
    "diagnostic.mapping.neighbor.memory.pokew.wrong-value-type",
    "wrong-exact-mapping-v1",
  ),
  oracleMutationDispatchMarker(
    "diagnostic.mapping",
    "diagnostic.mapping.neighbor.scalar.boolean.wrong-type.initializer",
    "wrong-exact-mapping-v1",
  ),
  oracleMutationDispatchMarker(
    "diagnostic.mapping",
    "diagnostic.mapping.neighbor.scalar.boolean.wrong-type.return-expression",
    "wrong-exact-mapping-v1",
  ),
  oracleMutationDispatchMarker(
    "diagnostic.mapping",
    "diagnostic.mapping.neighbor.scalar.byte.above-max",
    "wrong-exact-mapping-v1",
  ),
  oracleMutationDispatchMarker(
    "diagnostic.mapping",
    "diagnostic.mapping.neighbor.scalar.byte.below-min",
    "wrong-exact-mapping-v1",
  ),
  oracleMutationDispatchMarker(
    "diagnostic.mapping",
    "diagnostic.mapping.neighbor.scalar.sbyte.above-max",
    "wrong-exact-mapping-v1",
  ),
  oracleMutationDispatchMarker(
    "diagnostic.mapping",
    "diagnostic.mapping.neighbor.scalar.sbyte.below-min",
    "wrong-exact-mapping-v1",
  ),
  oracleMutationDispatchMarker(
    "diagnostic.mapping",
    "diagnostic.mapping.neighbor.scalar.sword.above-max",
    "wrong-exact-mapping-v1",
  ),
  oracleMutationDispatchMarker(
    "diagnostic.mapping",
    "diagnostic.mapping.neighbor.scalar.sword.below-min",
    "wrong-exact-mapping-v1",
  ),
  oracleMutationDispatchMarker(
    "diagnostic.mapping",
    "diagnostic.mapping.neighbor.scalar.word.above-max",
    "wrong-exact-mapping-v1",
  ),
  oracleMutationDispatchMarker(
    "diagnostic.mapping",
    "diagnostic.mapping.neighbor.scalar.word.below-min",
    "wrong-exact-mapping-v1",
  ),
]);

/**
 * Classifies one structurally valid diagnostic population against reviewed facts.
 *
 * @param records Candidate records in supplied order.
 * @returns The exact policy failure, or undefined when every record agrees.
 */
export function validateDiagnosticAuthorityCandidate(
  records: readonly DiagnosticAuthorityCandidate[],
): OracleFailure | undefined {
  if (records.length < EXPECTED_DIAGNOSTIC_AUTHORITY.length) {
    return oracleFailure(
      "oracle.authority.missing",
      "/diagnosticManifestBytes/records",
      "Diagnostic authority is missing a required reviewed record.",
    );
  }
  if (records.length > EXPECTED_DIAGNOSTIC_AUTHORITY.length) {
    return oracleFailure(
      "oracle.authority.not-accepted",
      "/diagnosticManifestBytes/records",
      "Diagnostic authority contains an unaccepted record.",
    );
  }
  for (let index = 0; index < EXPECTED_DIAGNOSTIC_AUTHORITY.length; index += 1) {
    const baselineExpected = EXPECTED_DIAGNOSTIC_AUTHORITY[index];
    const actual = records[index];
    if (baselineExpected === undefined || actual === undefined) continue;
    const expected =
      selectedOracleMutationVariant(
        requireOracleMutationDispatchMarker(
          ORACLE_AUTHORITY_MUTATION_PATHS,
          "diagnostic.mapping",
          diagnosticMutationPath(baselineExpected),
          "wrong-exact-mapping-v1",
        ),
      ) === "wrong-exact-mapping-v1"
        ? Object.freeze({
            ...baselineExpected,
            diagnosticCode: `${baselineExpected.diagnosticCode}.mutated`,
          })
        : baselineExpected;
    if (actual.ruleId !== expected.ruleId || actual.neighborId !== expected.neighborId) {
      return oracleFailure(
        "oracle.authority.not-accepted",
        "/diagnosticManifestBytes/records",
        "Diagnostic authority population or order is not accepted.",
      );
    }
    if (actual.diagnosticContext !== expected.diagnosticContext) {
      const acceptedIndex = EXPECTED_DIAGNOSTIC_AUTHORITY.findIndex(
        (record) =>
          record.ruleId === actual.ruleId &&
          record.neighborId === actual.neighborId &&
          record.diagnosticContext === actual.diagnosticContext,
      );
      if (acceptedIndex >= 0) {
        return oracleFailure(
          "oracle.authority.not-accepted",
          "/diagnosticManifestBytes/records",
          "Diagnostic authority population or order is not accepted.",
        );
      }
      return oracleFailure(
        "oracle.contract.invalid",
        `/diagnosticManifestBytes/records/${index}/diagnosticContext`,
        "Diagnostic authority uses an unaccepted source context.",
      );
    }
    for (const field of ["diagnosticCode", "phase", "severity", "observableFields"] as const) {
      if (!isDeepStrictEqual(actual[field], expected[field])) {
        return oracleFailure(
          "oracle.contract.invalid",
          `/diagnosticManifestBytes/records/${index}/${field}`,
          "Diagnostic authority contradicts the reviewed contract.",
        );
      }
    }
  }
  return undefined;
}

/**
 * Classifies one structurally valid binding population against reviewed facts.
 *
 * @param records Candidate records in supplied order.
 * @returns The exact policy failure, or undefined when every record agrees.
 */
export function validateBindingAuthorityCandidate(
  records: readonly BindingAuthorityCandidate[],
): OracleFailure | undefined {
  if (records.length < EXPECTED_BINDING_AUTHORITY.length) {
    return oracleFailure(
      "oracle.authority.missing",
      "/bindingRejectionBytes/records",
      "Binding authority is missing a required reviewed record.",
    );
  }
  if (records.length > EXPECTED_BINDING_AUTHORITY.length) {
    return oracleFailure(
      "oracle.authority.not-accepted",
      "/bindingRejectionBytes/records",
      "Binding authority contains an unaccepted record.",
    );
  }
  for (let index = 0; index < EXPECTED_BINDING_AUTHORITY.length; index += 1) {
    const baselineExpected = EXPECTED_BINDING_AUTHORITY[index];
    const actual = records[index];
    if (baselineExpected === undefined || actual === undefined) continue;
    const expected =
      selectedOracleMutationVariant(
        requireOracleMutationDispatchMarker(
          ORACLE_AUTHORITY_MUTATION_PATHS,
          "binding-rejection.mapping",
          bindingMutationPath(baselineExpected),
          "wrong-exact-rejection-v1",
        ),
      ) === "wrong-exact-rejection-v1"
        ? Object.freeze({
            ...baselineExpected,
            rejectionCode:
              baselineExpected.rejectionCode === "binding.value.type-invalid"
                ? ("binding.value.range-invalid" as const)
                : ("binding.value.type-invalid" as const),
          })
        : baselineExpected;
    if (actual.ruleId !== expected.ruleId || actual.neighborId !== expected.neighborId) {
      return oracleFailure(
        "oracle.authority.not-accepted",
        "/bindingRejectionBytes/records",
        "Binding authority population or order is not accepted.",
      );
    }
    for (const field of ["spelling", "rejectionCode"] as const) {
      if (actual[field] !== expected[field]) {
        return oracleFailure(
          "oracle.contract.invalid",
          `/bindingRejectionBytes/records/${index}/${field}`,
          "Binding authority contradicts the reviewed contract.",
        );
      }
    }
  }
  return undefined;
}
