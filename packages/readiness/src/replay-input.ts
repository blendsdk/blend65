import { copyUint8Array, uint8ArrayByteLength } from "./canonical-identity.js";
import { normalizeReplayEnvelope } from "./replay-envelope-normalizer.js";
import { inspectReplayJson } from "./replay-json-inspector.js";
import {
  REPLAY_V1_LIMITS,
  replayDiagnostic,
  replayFailure,
  type ReplayEnvelopeParseResult,
} from "./replay-input-model.js";

export {
  REPLAY_V1_LIMITS,
  type ReplayDiagnostic,
  type ReplayEnvelopeParseResult,
  type ReplayEnvelopeV1,
  type ReplayInputLimits,
} from "./replay-input-model.js";

const parseJson: (text: string) => unknown = JSON.parse;

function decodeStrictUtf8(bytes: Uint8Array): string | ReturnType<typeof replayDiagnostic> {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return replayDiagnostic("replay.input.invalid-utf8", "", "Replay input is not valid UTF-8.");
  }
}

/**
 * Parses bounded strict JSON and verifies every carried replay identity.
 *
 * @param bytes Raw UTF-8 replay envelope bytes.
 * @returns A deeply closed replay envelope or deterministic diagnostics.
 *
 * @example
 * ```ts
 * const parsed = parseReplayEnvelope(new TextEncoder().encode(json));
 * ```
 */
export function parseReplayEnvelope(bytes: Uint8Array): ReplayEnvelopeParseResult {
  try {
    const byteLength = uint8ArrayByteLength(bytes);
    if (byteLength === undefined) {
      return replayFailure("replay.input.invalid-json", "", "Replay input must be a byte array.");
    }
    if (byteLength > REPLAY_V1_LIMITS.maxInputBytes) {
      return replayFailure(
        "replay.input.limit",
        "",
        `Replay input exceeds ${REPLAY_V1_LIMITS.maxInputBytes} bytes.`,
      );
    }
    const input = copyUint8Array(bytes, byteLength);
    if (input === undefined) {
      return replayFailure("replay.input.invalid-json", "", "Replay input must be a byte array.");
    }
    const decoded = decodeStrictUtf8(input);
    if (typeof decoded !== "string") {
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([decoded]),
      });
    }
    const structuralFailure = inspectReplayJson(decoded, REPLAY_V1_LIMITS);
    if (structuralFailure !== undefined) {
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([structuralFailure]),
      });
    }
    let parsed: unknown;
    try {
      parsed = parseJson(decoded);
    } catch {
      return replayFailure("replay.input.invalid-json", "", "Replay input is not valid JSON.");
    }
    return normalizeReplayEnvelope(parsed);
  } catch {
    return replayFailure(
      "replay.input.invalid-json",
      "",
      "Replay input could not be inspected safely.",
    );
  }
}
