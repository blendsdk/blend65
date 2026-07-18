/**
 * Pure VICE binary-monitor protocol codec.
 *
 * A `Uint8Array`↔structured-command transform with NO I/O — the socket transport
 * lives in `vice-driver.ts`. Splitting the codec out lets its byte-exact framing
 * tests run in CI with no emulator. Every body layout here was validated
 * LIVE against real VICE 3.10, not inferred from a spec alone.
 *
 * Frame layout (VICE 3.7+ binary monitor):
 *   command  : STX(0x02) api(0x02) bodylen(u32 LE) reqid(u32 LE) type(u8) body
 *   response : STX(0x02) api(0x02) bodylen(u32 LE) type(u8) errcode(u8) reqid(u32 LE) body
 */

/** The API version byte VICE's 3.7+ binary monitor speaks. */
const API_VERSION = 0x02;
/** Start-of-frame marker. */
const STX = 0x02;
/** Command-frame header length (STX, api, bodylen, reqid, type). */
const CMD_HEADER = 11;
/** Response-frame header length (STX, api, bodylen, type, errcode, reqid). */
const RESP_HEADER = 12;

/**
 * Binary-monitor command types. Values are the wire opcodes; validated
 * live against real VICE 3.10.
 */
export const CMD = {
  MEMORY_GET: 0x01,
  MEMORY_SET: 0x02,
  CHECKPOINT_SET: 0x12,
  CHECKPOINT_DELETE: 0x13,
  REGISTERS_GET: 0x31,
  REGISTERS_SET: 0x32,
  ADVANCE_INSTRUCTIONS: 0x71,
  EXECUTE_UNTIL_RETURN: 0x73,
  REGISTERS_AVAILABLE: 0x83,
  DISPLAY_GET: 0x84,
  VICE_INFO: 0x85,
  PALETTE_GET: 0x91,
  EXIT: 0xaa,
  QUIT: 0xbb,
  RESET: 0xcc,
} as const;

/**
 * Unsolicited event / response types the driver must recognise. Events
 * carry the request id `0xffffffff`.
 */
export const RESP = {
  CHECKPOINT_INFO: 0x11,
  JAM: 0x61,
  STOPPED: 0x62,
  RESUMED: 0x63,
} as const;

/** The request id VICE stamps on unsolicited events. */
export const EVENT_REQUEST_ID = 0xffffffff;

/** A decoded response frame. */
export interface ResponseFrame {
  /** Response/event type (see {@link RESP} and {@link CMD}). */
  type: number;
  /** VICE error code (0 = OK). */
  errorCode: number;
  /** The request id this frame answers (`0xffffffff` for events). */
  requestId: number;
  /** The response body (per-type layout). */
  body: Uint8Array;
}

/**
 * Encode one command frame. `requestId` is supplied by the caller
 * (monotonic per driver).
 *
 * @param type One of {@link CMD}.
 * @param requestId The monotonic request id (u32).
 * @param body The command body (per-command layout).
 * @returns The framed command bytes.
 */
export function encodeCommand(type: number, requestId: number, body: Uint8Array): Uint8Array {
  const frame = new Uint8Array(CMD_HEADER + body.length);
  const dv = new DataView(frame.buffer);
  frame[0] = STX;
  frame[1] = API_VERSION;
  dv.setUint32(2, body.length, true);
  dv.setUint32(6, requestId >>> 0, true);
  frame[10] = type;
  frame.set(body, CMD_HEADER);
  return frame;
}

/**
 * Decode zero or more COMPLETE response frames from a socket-read accumulator.
 * A trailing partial frame is left for the next read: the returned `consumed`
 * count is the number of bytes the caller should drop.
 *
 * @param buffer The accumulated socket bytes.
 * @returns The complete frames and the number of leading bytes consumed.
 */
export function decodeResponses(buffer: Uint8Array): { frames: ResponseFrame[]; consumed: number } {
  const frames: ResponseFrame[] = [];
  const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let off = 0;
  while (buffer.length - off >= RESP_HEADER) {
    // Resync on a lost STX rather than mis-decoding (never a silent mis-frame).
    if (buffer[off] !== STX) {
      off += 1;
      continue;
    }
    const bodyLen = dv.getUint32(off + 2, true);
    if (buffer.length - off < RESP_HEADER + bodyLen) {
      break; // partial trailing frame — wait for more bytes
    }
    frames.push({
      type: buffer[off + 6],
      errorCode: buffer[off + 7],
      requestId: dv.getUint32(off + 8, true),
      body: buffer.slice(off + RESP_HEADER, off + RESP_HEADER + bodyLen),
    });
    off += RESP_HEADER + bodyLen;
  }
  return { frames, consumed: off };
}

// ─────────────────────────── Body builders (little-endian) ───────────────────────────

/** Write a u16 LE into `arr` at `offset`. */
function putU16(arr: number[], value: number): void {
  arr.push(value & 0xff, (value >> 8) & 0xff);
}

/**
 * `MEMORY_GET` body: side-effects(0), start(2), end(2, inclusive), memspace(0),
 * bank(2). The end address is inclusive, so a 1-byte read has `start === end`.
 */
export function memoryGetBody(start: number, end: number): Uint8Array {
  const b: number[] = [0x00];
  putU16(b, start);
  putU16(b, end);
  b.push(0x00);
  putU16(b, 0x0000);
  return new Uint8Array(b);
}

/** `MEMORY_SET` body: side-effects(0), start(2), end(2, inclusive), memspace(0), bank(2), data. */
export function memorySetBody(start: number, data: Uint8Array): Uint8Array {
  const end = start + data.length - 1;
  const b: number[] = [0x00];
  putU16(b, start);
  putU16(b, end);
  b.push(0x00);
  putU16(b, 0x0000);
  return new Uint8Array([...b, ...data]);
}

/**
 * `CHECKPOINT_SET` body: start(2), end(2), stop-when-hit(1), enabled(1),
 * cpu-operation(1)=exec, temporary(1). VICE 3.10 accepts the 8-byte form (memspace
 * defaults to main).
 */
export function checkpointSetBody(address: number): Uint8Array {
  const b: number[] = [];
  putU16(b, address);
  putU16(b, address);
  b.push(0x01 /*stop when hit*/, 0x01 /*enabled*/, 0x04 /*exec*/, 0x00 /*not temporary*/);
  return new Uint8Array(b);
}

/** `CHECKPOINT_DELETE` body: checkpoint number(4). */
export function checkpointDeleteBody(checkpointNumber: number): Uint8Array {
  const b: number[] = [];
  b.push(
    checkpointNumber & 0xff,
    (checkpointNumber >> 8) & 0xff,
    (checkpointNumber >> 16) & 0xff,
    (checkpointNumber >> 24) & 0xff,
  );
  return new Uint8Array(b);
}

/** `REGISTERS_GET` body: memspace(0 = main CPU). */
export function registersGetBody(): Uint8Array {
  return new Uint8Array([0x00]);
}

/** `REGISTERS_AVAILABLE` body: memspace(0 = main CPU). */
export function registersAvailableBody(): Uint8Array {
  return new Uint8Array([0x00]);
}

/** `REGISTERS_SET` body: memspace(0), count(2), then per item item-size(3), id(1), value(2). */
export function registersSetBody(items: Array<{ id: number; value: number }>): Uint8Array {
  const b: number[] = [0x00];
  putU16(b, items.length);
  for (const { id, value } of items) {
    b.push(0x03 /*item size: id + u16 value*/, id & 0xff);
    putU16(b, value);
  }
  return new Uint8Array(b);
}

/**
 * `ADVANCE_INSTRUCTIONS` body: step-over-subroutines(1 bool), count(2 LE). Advances
 * the CPU by `count` instructions, then re-stops (validated live against VICE 3.10).
 */
export function advanceInstructionsBody(count: number, stepOverSubroutines = false): Uint8Array {
  const b: number[] = [stepOverSubroutines ? 0x01 : 0x00];
  putU16(b, count);
  return new Uint8Array(b);
}

/** `EXECUTE_UNTIL_RETURN` body: empty. */
export function executeUntilReturnBody(): Uint8Array {
  return new Uint8Array(0);
}

/** `VICE_INFO` body: empty. */
export function viceInfoBody(): Uint8Array {
  return new Uint8Array(0);
}

/** `DISPLAY_GET` body: use-VIC(0), format(0 = indexed frame buffer). */
export function displayGetBody(): Uint8Array {
  return new Uint8Array([0x00, 0x00]);
}

/** `PALETTE_GET` body: use-VIC(0). */
export function paletteGetBody(): Uint8Array {
  return new Uint8Array([0x00]);
}

// ─────────────────────────── Body parsers ───────────────────────────

/** Read a u16 LE from `body` at `offset`. */
function getU16(body: Uint8Array, offset: number): number {
  return body[offset] | (body[offset + 1] << 8);
}

/** Read a u32 LE from `body` at `offset`. */
function getU32(body: Uint8Array, offset: number): number {
  return (body[offset] | (body[offset + 1] << 8) | (body[offset + 2] << 16) | (body[offset + 3] << 24)) >>> 0;
}

/** Parse a `MEMORY_GET` response body: strip the 2-byte length prefix, return the data. */
export function parseMemoryGet(body: Uint8Array): Uint8Array {
  const length = getU16(body, 0);
  return body.slice(2, 2 + length);
}

/** Parse a `REGISTERS_GET` response body into an id→value map. */
export function parseRegistersGet(body: Uint8Array): Map<number, number> {
  const map = new Map<number, number>();
  const count = getU16(body, 0);
  let o = 2;
  for (let i = 0; i < count; i++) {
    const itemSize = body[o];
    const id = body[o + 1];
    map.set(id, getU16(body, o + 2));
    o += 1 + itemSize;
  }
  return map;
}

/**
 * Parse a `REGISTERS_AVAILABLE` response body into a NAME→id map. Layout:
 * count(2), then per item item-size(1), id(1), bits(1), name-len(1), name.
 */
export function parseRegistersAvailable(body: Uint8Array): Map<string, number> {
  const map = new Map<string, number>();
  const count = getU16(body, 0);
  let o = 2;
  for (let i = 0; i < count; i++) {
    const itemSize = body[o];
    const id = body[o + 1];
    const nameLen = body[o + 3];
    const name = String.fromCharCode(...body.slice(o + 4, o + 4 + nameLen));
    map.set(name, id);
    o += 1 + itemSize;
  }
  return map;
}

/**
 * Parse a `VICE_INFO` response body. Layout: version-length(1), then that many
 * version bytes (major, minor, build, revision), then the svn-revision block.
 * Only major/minor are surfaced — the driver's version gate needs no more.
 */
export function parseViceInfo(body: Uint8Array): { major: number; minor: number } {
  const versionLen = body[0];
  if (versionLen < 2 || body.length < 1 + versionLen) {
    throw new Error(`unparseable VICE_INFO response (${body.length} bytes)`);
  }
  return { major: body[1], minor: body[2] };
}

/** Parse a `CHECKPOINT_INFO` (0x11) response/event body: number(4), currently-hit(1). */
export function parseCheckpointInfo(body: Uint8Array): { number: number; hit: boolean } {
  return { number: getU32(body, 0), hit: body[4] !== 0 };
}

/** A decoded display frame from `DISPLAY_GET`. */
export interface DisplayFrame {
  /** Debug (full) buffer width in pixels. */
  width: number;
  /** Debug (full) buffer height in pixels. */
  height: number;
  /** Bits per pixel (8 → indexed). */
  bpp: number;
  /** The raw indexed pixel bytes (`width * height` for 8bpp). */
  data: Uint8Array;
}

/**
 * Parse a `DISPLAY_GET` response body (indexed frame). Layout: field-length(4),
 * debug-w(2), debug-h(2), x-off(2), y-off(2), vis-w(2), vis-h(2), bpp(1),
 * image-length(4), image.
 */
export function parseDisplayGet(body: Uint8Array): DisplayFrame {
  const fieldLen = getU32(body, 0);
  const width = getU16(body, 4);
  const height = getU16(body, 6);
  const bpp = body[16];
  const imageStart = 4 + fieldLen + 4;
  const imageLen = getU32(body, 4 + fieldLen);
  return { width, height, bpp, data: body.slice(imageStart, imageStart + imageLen) };
}

/** One palette entry (RGB triple). */
export interface PaletteEntry {
  r: number;
  g: number;
  b: number;
}

/** Parse a `PALETTE_GET` response body: num(2), then per entry item-size(1), R, G, B. */
export function parsePaletteGet(body: Uint8Array): PaletteEntry[] {
  const entries: PaletteEntry[] = [];
  const count = getU16(body, 0);
  let o = 2;
  for (let i = 0; i < count; i++) {
    const itemSize = body[o];
    entries.push({ r: body[o + 1], g: body[o + 2], b: body[o + 3] });
    o += 1 + itemSize;
  }
  return entries;
}
