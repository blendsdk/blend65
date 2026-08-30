/**
 * Compact index of every legal boundary in one strictly validated UTF-8 buffer.
 *
 * The index implements `ReadonlySet` for existing callers while retaining one bit per
 * byte offset instead of one JavaScript object per code point. Iteration is intentionally
 * linear in the source length; hot paths should use `atOrBefore` and `atOrAfter`.
 */
export interface Utf8ByteBoundaryIndex extends ReadonlySet<number> {
  /** Returns the closest boundary at or before an in-range byte offset. */
  atOrBefore(offset: number): number;
  /** Returns the closest boundary at or after an in-range byte offset. */
  atOrAfter(offset: number): number;
}

/** Stores one boundary bit for each offset from zero through the source length. */
class CompactUtf8BoundaryIndex implements Utf8ByteBoundaryIndex {
  readonly #bits: Uint8Array;
  readonly #lastOffset: number;
  readonly size: number;

  public constructor(bits: Uint8Array, lastOffset: number, size: number) {
    this.#bits = bits;
    this.#lastOffset = lastOffset;
    this.size = size;
  }

  public get [Symbol.toStringTag](): string {
    return "Utf8ByteBoundaryIndex";
  }

  public has(value: number): boolean {
    if (!Number.isSafeInteger(value) || value < 0 || value > this.#lastOffset) return false;
    return (this.#bits[value >>> 3]! & (1 << (value & 7))) !== 0;
  }

  public atOrBefore(offset: number): number {
    let current = Math.min(Math.max(Math.trunc(offset), 0), this.#lastOffset);
    while (!this.has(current)) current -= 1;
    return current;
  }

  public atOrAfter(offset: number): number {
    let current = Math.min(Math.max(Math.trunc(offset), 0), this.#lastOffset);
    while (!this.has(current)) current += 1;
    return current;
  }

  public *values(): SetIterator<number> {
    for (let offset = 0; offset <= this.#lastOffset; offset += 1) {
      if (this.has(offset)) yield offset;
    }
  }

  public keys(): SetIterator<number> {
    return this.values();
  }

  public *entries(): SetIterator<[number, number]> {
    for (const offset of this.values()) yield [offset, offset];
  }

  public forEach(
    callbackfn: (value: number, value2: number, set: ReadonlySet<number>) => void,
    thisArg?: unknown,
  ): void {
    for (const offset of this.values()) callbackfn.call(thisArg, offset, offset, this);
  }

  public [Symbol.iterator](): SetIterator<number> {
    return this.values();
  }
}

const INDEXES = new WeakMap<Uint8Array, Utf8ByteBoundaryIndex>();

function isContinuation(byte: number | undefined): boolean {
  return byte !== undefined && byte >= 0x80 && byte <= 0xbf;
}

/** Validates one non-ASCII sequence and returns its width, or zero when malformed. */
function sequenceWidth(bytes: Uint8Array, offset: number): number {
  const first = bytes[offset];
  const second = bytes[offset + 1];
  if (first === undefined || second === undefined) return 0;
  if (first >= 0xc2 && first <= 0xdf) return isContinuation(second) ? 2 : 0;

  const third = bytes[offset + 2];
  if (first >= 0xe0 && first <= 0xef) {
    if (!isContinuation(third)) return 0;
    if (first === 0xe0) return second >= 0xa0 && second <= 0xbf ? 3 : 0;
    if (first === 0xed) return second >= 0x80 && second <= 0x9f ? 3 : 0;
    return isContinuation(second) ? 3 : 0;
  }

  const fourth = bytes[offset + 3];
  if (first >= 0xf0 && first <= 0xf4) {
    if (!isContinuation(third) || !isContinuation(fourth)) return 0;
    if (first === 0xf0) return second >= 0x90 && second <= 0xbf ? 4 : 0;
    if (first === 0xf4) return second >= 0x80 && second <= 0x8f ? 4 : 0;
    return isContinuation(second) ? 4 : 0;
  }
  return 0;
}

/** Marks one boundary offset in the compact bitmap. */
function markBoundary(bits: Uint8Array, offset: number): void {
  bits[offset >>> 3]! |= 1 << (offset & 7);
}

/**
 * Strictly validates UTF-8 and builds a reusable compact boundary index in one byte-level pass.
 *
 * @param bytes Exact source bytes. Callers must not mutate them while using the returned index.
 * @param reuse Whether the caller privately retains immutable bytes and permits index reuse.
 * @returns A compact index, or `undefined` when any sequence is malformed.
 */
export function createUtf8ByteBoundaryIndex(
  bytes: Uint8Array,
  reuse = false,
): Utf8ByteBoundaryIndex | undefined {
  if (reuse) {
    const retained = INDEXES.get(bytes);
    if (retained !== undefined) return retained;
  }
  const bits = new Uint8Array(Math.ceil((bytes.length + 1) / 8));
  let offset = 0;
  let count = 1;
  markBoundary(bits, 0);
  while (offset < bytes.length) {
    const first = bytes[offset]!;
    const width = first <= 0x7f ? 1 : sequenceWidth(bytes, offset);
    if (width === 0 || offset + width > bytes.length) return undefined;
    offset += width;
    markBoundary(bits, offset);
    count += 1;
  }
  const index = new CompactUtf8BoundaryIndex(bits, bytes.length, count);
  if (reuse) INDEXES.set(bytes, index);
  return index;
}
