import {
  CMD,
  EVENT_REQUEST_ID,
  encodeCommand,
  memoryGetBody,
  memorySetBody,
  parseMemoryGet,
  parseRegistersAvailable,
  parseViceInfo,
  registersAvailableBody,
  viceInfoBody,
  type ResponseFrame,
} from "./protocol.js";
import type { ViceCheckpointHitV1 } from "./vice-control-types.js";

/** Maximum accepted response body; bounds memory retained from an untrusted monitor. */
const MAX_FRAME_BODY_BYTES = 16 * 1024 * 1024;
/** Fixed binary response header size. */
const RESPONSE_HEADER_BYTES = 12;

/**
 * Incrementally assembles validated response frames with bounded linear copying.
 *
 * Each declared frame receives one exact allocation after its fixed header has
 * been validated. Input fragments are then copied directly into that frame.
 */
export class ViceControlFrameAccumulatorV1 {
  readonly #header = new Uint8Array(RESPONSE_HEADER_BYTES);
  #headerBytes = 0;
  #frame: Uint8Array | undefined;
  #frameBytes = 0;

  /** Number of bytes retained for the current partial frame. */
  get partialBytes(): number {
    return this.#frame?.byteLength === undefined ? this.#headerBytes : this.#frameBytes;
  }

  /**
   * Consumes one transport fragment and returns every complete frame it finishes.
   *
   * @example
   * ```ts
   * const frames = accumulator.push(socketFragment);
   * ```
   */
  push(fragment: Uint8Array): readonly ResponseFrame[] {
    if (!(fragment instanceof Uint8Array)) throw new TypeError("VICE fragment is invalid.");
    const frames: ResponseFrame[] = [];
    let offset = 0;
    while (offset < fragment.byteLength) {
      if (this.#frame === undefined) {
        const copied = Math.min(
          RESPONSE_HEADER_BYTES - this.#headerBytes,
          fragment.byteLength - offset,
        );
        this.#header.set(fragment.subarray(offset, offset + copied), this.#headerBytes);
        this.#headerBytes += copied;
        offset += copied;
        if (this.#headerBytes < RESPONSE_HEADER_BYTES) continue;
        if (this.#header[0] !== 0x02 || this.#header[1] !== 0x02) {
          this.reset();
          throw new TypeError("VICE response does not use API-v2 framing.");
        }
        const bodyLength = new DataView(this.#header.buffer).getUint32(2, true);
        if (bodyLength > MAX_FRAME_BODY_BYTES) {
          this.reset();
          throw new RangeError("VICE response body exceeds the bounded frame limit.");
        }
        this.#frame = new Uint8Array(RESPONSE_HEADER_BYTES + bodyLength);
        this.#frame.set(this.#header);
        this.#frameBytes = RESPONSE_HEADER_BYTES;
      }

      const frame = this.#frame;
      const copied = Math.min(frame.byteLength - this.#frameBytes, fragment.byteLength - offset);
      frame.set(fragment.subarray(offset, offset + copied), this.#frameBytes);
      this.#frameBytes += copied;
      offset += copied;
      if (this.#frameBytes !== frame.byteLength) continue;

      const decoded = decodeViceControlFramesV1(frame);
      if (decoded.frames.length !== 1 || decoded.remainder.byteLength !== 0) {
        this.reset();
        throw new TypeError("VICE response frame is invalid.");
      }
      frames.push(decoded.frames[0]);
      this.reset();
    }
    return Object.freeze(frames);
  }

  /** Discards an incomplete frame after a terminal transport failure. */
  reset(): void {
    this.#headerBytes = 0;
    this.#frame = undefined;
    this.#frameBytes = 0;
  }
}

/** Parsed response fragments plus the exact trailing partial frame. */
export interface ViceControlDecodedFramesV1 {
  /** Complete validated response frames. */
  readonly frames: readonly ResponseFrame[];
  /** Fresh copy of a trailing partial frame. */
  readonly remainder: Uint8Array;
}

/** Result of parsing a complete checkpoint event. */
export interface ViceControlCheckpointEventV1 {
  /** Whether VICE reports that this checkpoint is currently hit. */
  readonly hit: boolean;
  /** Structured checkpoint identity and operation. */
  readonly checkpoint: ViceCheckpointHitV1;
}

/** Builds a command while preserving the caller's exact request id. */
export function encodeViceControlCommandV1(
  type: number,
  requestId: number,
  body: Uint8Array,
): Uint8Array {
  return encodeCommand(type, requestId, body);
}

/**
 * Strictly decodes complete VICE API-v2 response frames.
 *
 * Unlike the legacy streaming helper, this parser never scans past malformed
 * bytes. A control authority must fail closed instead of resynchronizing onto
 * attacker-controlled or corrupted data.
 */
export function decodeViceControlFramesV1(bytes: Uint8Array): ViceControlDecodedFramesV1 {
  const frames: ResponseFrame[] = [];
  let offset = 0;
  while (bytes.byteLength - offset >= RESPONSE_HEADER_BYTES) {
    if (bytes[offset] !== 0x02 || bytes[offset + 1] !== 0x02) {
      throw new TypeError("VICE response does not use API-v2 framing.");
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, bytes.byteLength - offset);
    const bodyLength = view.getUint32(2, true);
    if (bodyLength > MAX_FRAME_BODY_BYTES) {
      throw new RangeError("VICE response body exceeds the bounded frame limit.");
    }
    const frameLength = RESPONSE_HEADER_BYTES + bodyLength;
    if (bytes.byteLength - offset < frameLength) break;
    frames.push(
      Object.freeze({
        type: bytes[offset + 6],
        errorCode: bytes[offset + 7],
        requestId: view.getUint32(8, true),
        body: bytes.slice(offset + RESPONSE_HEADER_BYTES, offset + frameLength),
      }),
    );
    offset += frameLength;
  }
  return Object.freeze({ frames: Object.freeze(frames), remainder: bytes.slice(offset) });
}

/** Returns whether a number is an address in the 6502's 16-bit address space. */
export function isViceAddressV1(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 0xffff;
}

/** Returns whether a count is exactly representable by VICE's instruction command. */
export function isViceInstructionCountV1(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 0xffff;
}

/** Builds a validated memory-read body with an inclusive end address. */
export function viceMemoryReadBodyV1(address: number, length: number): Uint8Array {
  if (
    !isViceAddressV1(address) ||
    !Number.isInteger(length) ||
    length < 1 ||
    length > 0x10000 - address
  ) {
    throw new RangeError("VICE memory read is outside the 16-bit address space.");
  }
  return memoryGetBody(address, address + length - 1);
}

/** Builds a validated memory-write body from an already-owned byte snapshot. */
export function viceMemoryWriteBodyV1(address: number, bytes: Uint8Array): Uint8Array {
  if (!isViceAddressV1(address) || bytes.byteLength < 1 || bytes.byteLength > 0x10000 - address) {
    throw new RangeError("VICE memory write is outside the 16-bit address space.");
  }
  return memorySetBody(address, bytes);
}

/** Builds the exact three-byte ADVANCE_INSTRUCTIONS body without masking. */
export function viceAdvanceInstructionsBodyV1(count: number): Uint8Array {
  if (!isViceInstructionCountV1(count)) {
    throw new RangeError("VICE instruction count must be an integer from 1 through 65535.");
  }
  return Uint8Array.of(0, count % 256, Math.floor(count / 256));
}

/** Builds a stopping checkpoint for one exact CPU access class. */
export function viceCheckpointSetBodyV1(
  address: number,
  operation: ViceCheckpointHitV1["operation"],
): Uint8Array {
  if (!isViceAddressV1(address)) throw new RangeError("VICE checkpoint address is invalid.");
  const operationByte = operation === "load" ? 1 : operation === "store" ? 2 : 4;
  return Uint8Array.of(
    address % 256,
    Math.floor(address / 256),
    address % 256,
    Math.floor(address / 256),
    1,
    1,
    operationByte,
    0,
  );
}

/** Builds a main-CPU program-counter register write. */
export function viceProgramCounterBodyV1(registerId: number, address: number): Uint8Array {
  if (!Number.isInteger(registerId) || registerId < 0 || registerId > 0xff) {
    throw new RangeError("VICE PC register id is invalid.");
  }
  if (!isViceAddressV1(address)) throw new RangeError("VICE program counter is invalid.");
  return Uint8Array.of(0, 1, 0, 3, registerId, address % 256, Math.floor(address / 256));
}

/** Builds a length-prefixed resource-name query for the C64 machine probe. */
export function viceC64ResourceBodyV1(): Uint8Array {
  const name = new TextEncoder().encode("VICIIModel");
  return new Uint8Array([name.byteLength, ...name]);
}

/** Parses a memory response and returns a defensive copy. */
export function parseViceMemoryV1(body: Uint8Array): Uint8Array {
  if (body.byteLength < 2) throw new TypeError("VICE memory response is truncated.");
  const length = body[0] | (body[1] << 8);
  if (body.byteLength !== length + 2)
    throw new TypeError("VICE memory response length is invalid.");
  return parseMemoryGet(body).slice();
}

/** Parses and validates the six core register names needed by the control surface. */
export function parseViceCoreRegistersV1(body: Uint8Array): ReadonlyMap<string, number> {
  const registers = parseRegistersAvailable(body);
  for (const name of ["A", "X", "Y", "SP", "PC", "FL"]) {
    if (!registers.has(name)) throw new TypeError(`VICE core register ${name} is unavailable.`);
  }
  return registers;
}

/** Parses VICE's major/minor version response. */
export function parseViceVersionV1(body: Uint8Array): {
  readonly major: number;
  readonly minor: number;
} {
  return Object.freeze(parseViceInfo(body));
}

/** Requires an integer resource response, proving the C64-specific VIC-II resource exists. */
export function parseViceC64ResourceV1(body: Uint8Array): number {
  if (body.byteLength < 3 || body[0] !== 1 || body[1] < 1 || body.byteLength !== body[1] + 2) {
    throw new TypeError("VICE did not return an integer VICIIModel resource.");
  }
  const text = new TextDecoder().decode(body.slice(2));
  if (/^-?\d+$/.test(text)) return Number(text);
  // Some raw-host fixtures use the compact single-byte integer value.
  if (body[1] === 1) return body[2];
  if (body[1] === 4) {
    return new DataView(body.buffer, body.byteOffset + 2, 4).getInt32(0, true);
  }
  throw new TypeError("VICE returned an invalid VICIIModel integer.");
}

/** Parses an exact checkpoint event including its address and CPU access class. */
export function parseViceCheckpointEventV1(body: Uint8Array): ViceControlCheckpointEventV1 {
  if (body.byteLength < 13) throw new TypeError("VICE checkpoint response is truncated.");
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  const operationByte = body[11];
  const operation =
    operationByte === 1
      ? "load"
      : operationByte === 2
        ? "store"
        : operationByte === 4
          ? "execute"
          : undefined;
  if (operation === undefined) throw new TypeError("VICE checkpoint operation is invalid.");
  return Object.freeze({
    hit: body[4] !== 0,
    checkpoint: Object.freeze({
      checkpointId: view.getUint32(0, true),
      address: view.getUint16(5, true),
      operation,
    }),
  });
}

/** Parses the checkpoint id from a command response or checkpoint-info event. */
export function parseViceCheckpointIdV1(body: Uint8Array): number {
  if (body.byteLength < 4) throw new TypeError("VICE checkpoint response is truncated.");
  return new DataView(body.buffer, body.byteOffset, body.byteLength).getUint32(0, true);
}

/** Binary command constants used by the session without exposing legacy internals. */
export const VICE_CONTROL_COMMAND_V1 = Object.freeze({
  memoryGet: CMD.MEMORY_GET,
  memorySet: CMD.MEMORY_SET,
  registersSet: CMD.REGISTERS_SET,
  checkpointSet: CMD.CHECKPOINT_SET,
  advanceInstructions: CMD.ADVANCE_INSTRUCTIONS,
  registersAvailable: CMD.REGISTERS_AVAILABLE,
  viceInfo: CMD.VICE_INFO,
  resourceGet: 0x51,
});

/** Unsolicited request id reserved by VICE. */
export const VICE_CONTROL_EVENT_REQUEST_ID_V1 = EVENT_REQUEST_ID;

/** Handshake command bodies that carry no caller-controlled data. */
export const VICE_CONTROL_HANDSHAKE_BODY_V1 = Object.freeze({
  registersAvailable: registersAvailableBody,
  viceInfo: viceInfoBody,
});
